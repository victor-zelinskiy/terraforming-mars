<template>
  <!--
    THE ACTION CONFIRM — the quick wheel's own second press (PL-385): «Пас» always, the heat conversion when the TABLE
    answers it (PL-067's mini-stage — the ruling Greens' 2 M€, a bonus step the raise crosses) or the step is empty.

    A plate of the PROMPT-MODAL FAMILY (`console_prompt.less`): the family's head (category · the ask · why), then the
    OPERATION as ONE object — the wheel slot's own symbol on a medallion (`data-wheel-anchor="confirm"`: the wheel
    flight lands on it) beside the formula the server printed, then «Сработает» — what the table answers — as the
    DOOR of the R3 «Эффекты» layer (PL-394: the key was drawn and nothing answered it), then what the pass leaves
    unused. No in-panel verbs: the ONE command bar owns A / R3 / B.

    The layer is a LEVEL inside this surface, the stages' own (`consoleForecastHost.ts`): the STAGE (the band's box,
    painting nothing) holds the plate centred at its own height and the layer's ROOM centred in the same place — the
    plate parks in place (`data-forecast-browse`), the explorer opens out of the row and B / R3 fold it back.
  -->
  <div class="con-confirm con-ws" role="dialog" :aria-label="$t(titleKey)"
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

        <!-- The one WARNING sentence of the conversion (the temperature's maximum — the step is empty). -->
        <p v-if="body !== ''" class="con-confirm__body">
          <span class="con-confirm__body-mark" aria-hidden="true">⚠</span>{{ $t(body) }}
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

<script lang="ts">
/**
 * @console-shared LIVE — the quick wheel's confirm (`consoleState.confirm`), extracted from the shell's inline markup
 * into the prompt-modal family (PL-385) and given the R3 «Эффекты» layer its «Сработает» row always advertised
 * (PL-394). The SHELL keeps the decision (which verb asks, what A submits, B) and routes the pad here only for the
 * layer — the same split as the standard projects' screen.
 */
import {defineComponent, PropType} from 'vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleForecastRow from '@/client/components/console/ConsoleForecastRow.vue';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import {ForecastSeat} from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {forecastLayerAvailable, forecastRowPresent} from '@/client/console/effectForecastModel';
import {closeEffectForecastLayer, effectForecastOpen} from '@/client/console/consoleEffectForecast';
import {
  foldForecastHost, forecastHostIntent, forecastOwnerColors, forecastStatsByColor, openForecastHost, pulseForecastDoor,
} from '@/client/console/consoleForecastHost';
import {VersionedView} from '@/client/console/gameStateVersion';

export type ActionConfirmKind = 'pass' | 'convertHeat';

/** The ask per verb — the operation's own words, never the shell's generic «Подтверждение». */
const TITLE_KEY: Readonly<Record<ActionConfirmKind, string>> = {
  pass: 'Pass until the next generation',
  convertHeat: 'Raise the temperature with heat',
};

export default defineComponent({
  name: 'ConsoleActionConfirm',
  components: {BarButtonIcon, ActionEffectChip, ConsoleForecastRow, ConsoleForecastLayer, ConsolePromptHead},
  props: {
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
  },
  data() {
    return {
      /** The one-shot COMMIT flare on the «Сработает» door and its clock (a plain handle). */
      forecastPulse: false,
      pulseCall: undefined as {kill: () => void} | undefined,
    };
  },
  computed: {
    titleKey(): string {
      return TITLE_KEY[this.kind];
    },
    consequenceKey(): string {
      return 'You will take no more actions this generation.';
    },
    /** The plate's tier — content decides: the operation and its answer are a compact confirm (`s`); a LIST of what
     *  the pass leaves unused is reading width (`m`). */
    promptSize(): 's' | 'm' {
      return this.warnings.length > 0 || this.quiet !== '' ? 'm' : 's';
    },
    /** The compact row exists iff it has a chip to show. */
    answerShown(): boolean {
      return forecastRowPresent(this.forecast);
    },
    /** R3 has something behind it (the bar advertises the verb off the same fact). */
    forecastCanOpen(): boolean {
      return forecastLayerAvailable(this.forecast);
    },
    fxOpen(): boolean {
      return effectForecastOpen('confirm');
    },
    forecastOwnerColors(): ReadonlyArray<string> {
      return forecastOwnerColors(this.forecast, this.players);
    },
    forecastStatsByColor(): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> {
      return forecastStatsByColor(this.forecastOwnerColors);
    },
  },
  watch: {
    /** A refreshed option with nothing behind R3 any more folds the layer instantly. */
    forecastCanOpen(can: boolean): void {
      if (!can) {
        foldForecastHost('confirm');
      }
    },
  },
  beforeUnmount() {
    // The surface leaves (A committed, B cancelled, the prompt moved on): the layer goes WITH it, instantly — a fold
    // phrase over a dissolving plate is a beat nobody sees.
    foldForecastHost('confirm');
    closeEffectForecastLayer('confirm');
    this.pulseCall?.kill();
    this.pulseCall = undefined;
  },
  methods: {
    /** R3 / a click on the «Сработает» row — the WORKSPACE DESCEND into the layer. The shell calls it on R3. */
    openForecastLayer(): void {
      if (!this.forecastCanOpen || this.fxOpen) {
        return;
      }
      this.pulseCall = pulseForecastDoor((on) => {
        this.forecastPulse = on;
      }, this.pulseCall);
      openForecastHost('confirm', this.$el as HTMLElement | undefined, this.forecastOwnerColors, this.statsView);
    },
    /** Input while the layer is open (the shell routes it here): B folds one level, R3 closes the whole layer. */
    forecastIntent(intent: GamepadIntent): void {
      forecastHostIntent('confirm', intent, this.$refs.forecastLayer as InstanceType<typeof ConsoleForecastLayer> | undefined);
    },
  },
});
</script>
