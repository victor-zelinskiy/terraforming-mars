<template>
  <div ref="root" class="con-confirm con-ws" role="dialog" :aria-label="$t(titleKey)"
       data-motion-surface="confirm" :data-confirm-kind="kind">
    <div class="con-confirm__stage" data-forecast-host>
      <ConsoleForecastLayer ref="forecastLayer"
                            host="confirm"
                            operation="action"
                            :forecast="forecast"
                            :cards="thisPlayer?.tableau ?? []"
                            :color="thisPlayer?.color ?? ''"
                            :players="players"
                            :statsByColor="forecastStatsByColor" />
      <div class="con-confirm__card con-prompt con-prompt--neutral"
           :class="'con-prompt--' + promptSize"
           data-motion-panel data-prompt-panel data-forecast-browse>
        <ConsolePromptHead class="con-confirm__head" tone="neutral" :kicker="$t('Basic actions')" :title="$t(titleKey)" />

        <!-- THE OPERATION — the wheel's symbol and what it does, one object: the price, the step and its implied
             rating as the one chip row every door prints (the server's reading of the option); a pass has no
             formula, its consequence is the sentence beside the symbol. -->
        <div class="con-confirm__op" :class="'con-confirm__op--' + kind" data-confirm-op>
          <span class="con-confirm__hero" :class="'con-confirm__hero--' + kind" aria-hidden="true">
            <span class="con-confirm__emblem" data-wheel-anchor="confirm">
              <BarButtonIcon v-if="kind === 'pass'" name="pass" />
              <i v-else-if="kind === 'convertPlants'" class="resource_icon resource_icon--plants"></i>
              <i v-else class="resource_icon resource_icon--heat"></i>
            </span>
          </span>
          <div v-if="effects.length > 0" class="con-confirm__formula" data-confirm-formula>
            <ActionEffectChip v-for="(eff, i) in effects" :key="i" :effect="eff" />
          </div>
          <p v-else class="con-confirm__consequence">{{ $t(consequenceKey) }}</p>
        </div>

        <!-- WHAT THE TABLE ANSWERS — the «Сработает» row, and the DOOR of the «Эффекты» layer (R3 / a click). -->
        <div v-if="answerShown" class="con-confirm__answer">
          <ConsoleForecastRow class="con-confirm__forecast" :class="{'con-forecast--descend': forecastPulse}"
                              :forecast="forecast" @open="openForecastLayer()" />
        </div>

        <!-- THE «WHERE» OF A REPLACED UNIT (Turmoil Redux RX35): a law turned the conversion's step / tile into data,
             and the shared picker — the task host's own plate, teleported here — asks which card takes it. The zone
             is always present (a `<Teleport>` whose target is missing at mount drops its content); the operation
             row above stays, the picker stands under it, B folds back to the plate. -->
        <div class="con-confirm__step" :class="{'con-confirm__step--up': stepUp}"
             data-embed-slot="confirm-step" data-outcome-zone></div>

        <!-- The one WARNING sentence of the conversion (the temperature's maximum — the step is empty). -->
        <p v-if="body !== ''" class="con-confirm__body">
          <span class="con-confirm__body-mark" aria-hidden="true">⚠</span>{{ $t(body) }}
        </p>
        <!-- …and the tile a standing law REPLACES (RX35 — the plants' greenery): NOT placed, said in words. -->
        <p v-for="(w, i) in tileWarnings" :key="'tile' + i" class="con-confirm__body" data-confirm-diverted-tile>
          <span class="con-confirm__body-mark" aria-hidden="true">⚠</span>{{ w.title }} · {{ w.reason }}
        </p>

        <!-- WHAT THE PASS LEAVES UNUSED (the desktop PassConfirmContent parity set) — named, never a bare «are you
             sure»: each is a row of its own under one quiet heading. -->
        <!-- Nothing of value is left — only actions with no effect: ONE quiet line, never a warning (the owner's decision
             of 2026-10-15 — they are still the player's to take, e.g. to stall instead of passing). -->
        <p v-if="quiet !== ''" class="con-confirm__quiet" data-confirm-quiet>
          <span class="con-confirm__quiet-mark" aria-hidden="true">○</span>{{ quiet }}
        </p>

        <section v-if="warnings.length > 0" class="con-confirm__warns" data-confirm-warns>
          <h3 class="con-confirm__warns-title">{{ $t('Still available this generation') }}</h3>
          <div v-for="(w, i) in warnings" :key="i" class="con-confirm__warn">
            <span class="con-confirm__warn-mark" aria-hidden="true">!</span>
            <span class="con-confirm__warn-text">{{ w }}</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * THE ACTION CONFIRM — the quick wheel's own second press (PL-385): «Пас» always, the heat conversion when the TABLE
 * answers it (PL-067's mini-stage — the ruling Greens' 2 M€, a bonus step the raise crosses) or the step is empty.
 *
 * A plate of the PROMPT-MODAL FAMILY (`console_prompt.less`): the family's head (category · the ask · why), then the
 * OPERATION as ONE object — the wheel slot's own symbol on a medallion (`data-wheel-anchor="confirm"`: the wheel
 * flight lands on it) beside the formula the server printed, then «Сработает» — what the table answers — as the
 * DOOR of the R3 «Эффекты» layer (PL-394: the key was drawn and nothing answered it), then what the pass leaves
 * unused. No in-panel verbs: the ONE command bar owns A / R3 / B.
 *
 * The layer is a LEVEL inside this surface, the stages' own (`consoleForecastHost.ts`): the STAGE (the band's box,
 * painting nothing) holds the plate centred at its own height and the layer's ROOM centred in the same place — the
 * plate parks in place (`data-forecast-browse`), the explorer opens out of the row and B / R3 fold it back.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * @console-shared LIVE — the quick wheel's confirm (`consoleState.confirm`), extracted from the shell's inline markup
 * into the prompt-modal family (PL-385) and given the R3 «Эффекты» layer its «Сработает» row always advertised
 * (PL-394). The SHELL keeps the decision (which verb asks, what A submits, B) and routes the pad here only for the
 * layer — the same split as the standard projects' screen.
 */
import {computed, onBeforeUnmount, PropType, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {$t} from '@/client/directives/i18n';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleForecastRow from '@/client/components/console/ConsoleForecastRow.vue';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import {ForecastSeat} from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {DivertedTileWarning, divertedTileWarnings} from '@/client/components/actions/divertedTileWarning';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {forecastLayerAvailable, forecastRowPresent} from '@/client/console/effectForecastModel';
import {closeEffectForecastLayer, effectForecastOpen} from '@/client/console/consoleEffectForecast';
import {
  foldForecastHost, forecastHostIntent, forecastOwnerColors as forecastOwnerColorsOf, forecastStatsByColor as forecastStatsByColorOf,
  openForecastHost, pulseForecastDoor,
} from '@/client/console/consoleForecastHost';
import {VersionedView} from '@/client/console/gameStateVersion';
import type {ActionConfirmKind} from '@/client/components/console/consoleActionConfirmTypes';

export type {ActionConfirmKind};


/** The ask per verb — the operation's own words, never the shell's generic «Подтверждение». */
const TITLE_KEY: Readonly<Record<ActionConfirmKind, string>> = {
  pass: 'Pass until the next generation',
  convertHeat: 'Raise the temperature with heat',
  // The plant conversion stands up a plate only under a law that REPLACES the greenery (RX35) — the board pick is
  // its ordinary door.
  convertPlants: 'Place a greenery with plants',
};

defineOptions({name: 'ConsoleActionConfirm'});
const props = defineProps({
  kind: {type: String as PropType<ActionConfirmKind>, required: true},
  /** The operation's formula — the server's reading of the option (PL-067); none for the pass. */
  effects: {type: Array as PropType<ReadonlyArray<ActionEffect>>, default: () => []},
  /** What the table answers — the option's forecast (PL-067). */
  forecast: {type: Object as PropType<EffectForecast | undefined>, default: undefined},
  /** A WARNING sentence key ('' = none) — the temperature's maximum. */
  body: {type: String, default: ''},
  /** What the pass leaves unused — already translated. */
  warnings: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  /** Only actions with no effect are left — the one quiet line, already translated ('' = none). */
  quiet: {type: String, default: ''},
  /** The viewer (the layer's own tableau) and every seat (the explorer's names and colours). */
  thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
  players: {type: Array as PropType<ReadonlyArray<ForecastSeat>>, default: () => []},
  /** The viewer's versioned view — the reacting seats' effect stats are asked with it. */
  statsView: {type: Object as PropType<VersionedView | undefined>, default: undefined},
  /** The «where» picker of a replaced unit stands in the plate's zone (RX35): the operation row parks. */
  stepUp: {type: Boolean, default: false},
});

/** The surface's own root (the template's `ref="root"`) — the element the layer's host opens on. */
const root = useTemplateRef<HTMLElement>('root');
const forecastLayer = useTemplateRef<ExposedOf<typeof ConsoleForecastLayer>>('forecastLayer');
/** The one-shot COMMIT flare on the «Сработает» door and its clock (a plain handle). */
const forecastPulse = ref(false);
let pulseCall: {kill: () => void} | undefined;

const titleKey = computed((): string => {
  return TITLE_KEY[props.kind];
});
const consequenceKey = computed((): string => {
  return 'You will take no more actions this generation.';
});
/** The tiles the standing law takes (RX35) — read off the server's mark on the formula's own chips. */
const tileWarnings = computed((): Array<DivertedTileWarning> => {
  return divertedTileWarnings(props.effects);
});
/** The plate's tier — content decides: the operation and its answer are a compact confirm (`s`); a LIST of what
 *  the pass leaves unused is reading width (`m`). */
const promptSize = computed((): 's' | 'm' => {
  return props.warnings.length > 0 || props.quiet !== '' ? 'm' : 's';
});
/** The compact row exists iff it has a chip to show. */
const answerShown = computed((): boolean => {
  return forecastRowPresent(props.forecast);
});
/** R3 has something behind it (the bar advertises the verb off the same fact). */
const forecastCanOpen = computed((): boolean => {
  return forecastLayerAvailable(props.forecast);
});
const fxOpen = computed((): boolean => {
  return effectForecastOpen('confirm');
});
const forecastOwnerColors = computed((): ReadonlyArray<string> => {
  return forecastOwnerColorsOf(props.forecast, props.players);
});
const forecastStatsByColor = computed((): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> => {
  return forecastStatsByColorOf(forecastOwnerColors.value);
});

/** R3 / a click on the «Сработает» row — the WORKSPACE DESCEND into the layer. The shell calls it on R3. */
function openForecastLayer(): void {
  if (!forecastCanOpen.value || fxOpen.value) {
    return;
  }
  pulseCall = pulseForecastDoor((on) => {
    forecastPulse.value = on;
  }, pulseCall);
  openForecastHost('confirm', root.value ?? undefined, forecastOwnerColors.value, props.statsView);
}
/** Input while the layer is open (the shell routes it here): B folds one level, R3 closes the whole layer. */
function forecastIntent(intent: GamepadIntent): void {
  forecastHostIntent('confirm', intent, forecastLayer.value ?? undefined);
}

/** A refreshed option with nothing behind R3 any more folds the layer instantly. */
watch(() => forecastCanOpen.value, (can: boolean): void => {
  if (!can) {
    foldForecastHost('confirm');
  }
});
onBeforeUnmount(() => {
  // The surface leaves (A committed, B cancelled, the prompt moved on): the layer goes WITH it, instantly — a fold
  // phrase over a dissolving plate is a beat nobody sees.
  foldForecastHost('confirm');
  closeEffectForecastLayer('confirm');
  pulseCall?.kill();
  pulseCall = undefined;
});

// What the shell's pad router reaches through the surface registry (`surfaces.at('actionConfirm')`): R3 on the plate
// opens the layer (`openForecastLayer`), and the pad goes to `forecastIntent` while it is open — and nothing else.
defineExpose({openForecastLayer, forecastIntent});
</script>
