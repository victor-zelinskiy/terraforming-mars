<template>
  <div class="con-prodloss con-ws" role="dialog" :aria-label="titleText" data-motion-surface="production-loss">
    <!-- The prompt-modal family's plate (`console_prompt.less`): a LOSS — the hazard-tape crest, the warning emblem,
         «▼ УБЫТОК», the «ВЫ ПОТЕРЯЕТЕ» footer and «Принять убыток» on the bar. -->
    <div class="con-prodloss__panel con-prompt con-prompt--m" :class="'con-prompt--' + tone" data-motion-panel data-prompt-panel>
      <ConsolePromptHead :tone="tone" :kicker="$t('Production loss')" :title="titleText" :prompt-key="sequenceKey" />

      <div class="con-prodloss__main">
        <!-- WHY the reduction is forced — the SHARED source dock, the same one
             every other decision surface uses. A card attack renders the real
             premium card (L3 opens it fullscreen); an Ares hazard renders the
             plate + its rule, in the board's own hazard accent. The old ◈-and-
             a-name chip named the card but gave no way to read it. -->
        <console-source-dock v-if="sourceView !== undefined" :view="sourceView" compact ref="sourceDock" />

        <!-- ── The six production rows ───────────────────────────────── -->
        <div class="con-prodloss__rows">
          <div v-for="(row, i) in rows" :key="row.unit"
               class="con-prodloss__row"
               :class="{
                 'con-prodloss__row--focused': focusIdx === i,
                 'con-prodloss__row--active': lossFor(row.unit) > 0,
                 'con-prodloss__row--disabled': row.disabled,
               }">
            <div class="con-prodloss__line">
              <span class="con-prodloss__row-id">
                <span class="con-prodloss__frame">
                  <i class="con-prodloss__icon" :class="iconClass(row.unit)" aria-hidden="true"></i>
                </span>
                <span class="con-prodloss__name">{{ resourceName(row.unit) }}</span>
              </span>

              <!-- current → resulting (было → станет), shown as signed
                   production so the "income" reads (and negative M€ works). -->
              <span class="con-prodloss__values">
                <span class="con-prodloss__cur" :class="{'con-prodloss__cur--faded': lossFor(row.unit) > 0}">{{ fmt(row.current) }}</span>
                <template v-if="lossFor(row.unit) > 0">
                  <span class="con-prodloss__arrow" aria-hidden="true">→</span>
                  <span class="con-prodloss__next">{{ fmt(resultingFor(row)) }}</span>
                </template>
              </span>

              <!-- The chosen loss (−1 / −2). -->
              <span class="con-prodloss__delta" :class="{'con-prodloss__delta--empty': lossFor(row.unit) <= 0}">
                <template v-if="lossFor(row.unit) > 0">−{{ lossFor(row.unit) }}</template>
              </span>

              <span class="con-prodloss__a" aria-hidden="true">
                <GamepadGlyph v-if="focusIdx === i && !row.disabled" control="confirm" />
              </span>
            </div>

            <!-- Disabled / limited reason — visible, never hidden. -->
            <div v-if="noteFor(row) !== ''" class="con-prodloss__note">✕ {{ noteFor(row) }}</div>
          </div>
        </div>
      </div>

      <!-- WHAT CONFIRMING COSTS — the chosen productions with their `current → resulting`, and the budget. -->
      <ConsolePromptOutcome :tone="tone" :items="outcomeItems" :meter="{done: sum, of: cost}"
                            :pending="$t('Choose the production to lose')" />

      <!-- The command contract publishes to the shell's ONE bottom command
           bar via consolePanelUi (CONSOLE_TV_PREMIUM_PLAN §3.2). -->
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * data-motion-*: rides the shared `.con-shade` dim + the surface-motion
 * director — no own backdrop.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * ConsoleProductionLoss — the console-native premium surface for "reduce your
 * production" (`SelectProductionToLose`). It replaces the generic
 * ConsoleTaskHost distribute lanes for the ONE narrow case an Ares
 * hazard-adjacency penalty (or a card attack) forces the player to shed 1–2
 * steps of production.
 *
 * It changes NO game logic: the pure model (consoleProductionLoss.ts) derives
 * the six rows from the SAME model, and confirming emits the byte-identical
 * `{type:'productionToLose', units}` the desktop ModernProductionToLose POSTs
 * (`@submit` → shell.onTaskSubmit). B defers to the amber chip (`@defer`).
 *
 * Control grammar (user-mandated — a small value surface, no RT actions):
 *   D-pad / L-stick = navigate the six rows
 *   A / RB          = assign a −1 to the focused production
 *   LB              = take a −1 back
 *   X               = confirm · B = minimize (inspect the board)
 * For a cost-1 loss the whole thing is single-pick: A on another row simply
 * MOVES the single −1 there.
 */
import {computed, onBeforeUnmount, PropType, ref, useTemplateRef, watch} from 'vue';
import {RootElHolder} from '@/client/components/rootEl';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectProductionToLoseModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {Message} from '@/common/logs/Message';
import {$t, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {productionToLoseResponse} from '@/client/console/taskResponses';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {buildProductionLossRows, firstSelectableIndex, ProductionLossRow} from '@/client/console/consoleProductionLoss';
import {LANE_LABELS} from '@/client/console/compositePrompts';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import ConsolePromptOutcome, {PromptOutcomeItem} from '@/client/components/console/foundation/ConsolePromptOutcome.vue';
import {PromptTone, promptCommitLabelKey, promptToneOf} from '@/client/console/promptTone';
import {promptSequenceKey} from '@/client/console/promptSequence';
import {promptIdentityKey} from '@/client/console/turnIntents';
// `console-source-dock` is the LAZY binding of `asyncComponents` — deliberately not a
// static import of the `.vue`: the dock renders the real card face, and that import chain
// zeroes this file's unit spec (the known baseline class, same reason
// `action-target-card` is lazy).
import {ConsoleSourceDock} from '@/client/components/asyncComponents';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

defineOptions({name: 'ConsoleProductionLoss'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
});
const emit = defineEmits(['submit', 'defer']);

const sourceDock = useTemplateRef<RootElHolder>('sourceDock');
const focusIdx = ref(0);
/** The chosen loss per resource (fills up to `cost`). */
const units = ref<Partial<Record<keyof Units, number>>>({});
/** Blocks a duplicate submit between the emit and the next response. */
const submitting = ref(false);
const model = computed((): SelectProductionToLoseModel | undefined => {
  const wf = props.playerView.waitingFor;
  return wf?.type === 'productionToLose' ? (wf as SelectProductionToLoseModel) : undefined;
});
const cost = computed((): number => {
  return model.value?.payProduction.cost ?? 0;
});
const rows = computed((): Array<ProductionLossRow> => {
  const modelNow = model.value;
  return modelNow !== undefined ? buildProductionLossRows(modelNow.payProduction.units, cost.value) : [];
});
/** WHY the reduction is forced — normalized by the shared model, so a card
 *  attack and an Ares hazard are described in ONE vocabulary. */
const sourceView = computed((): PromptSourceView | undefined => {
  return promptSourceView(model.value);
});
/** The card behind the loss, when it IS a card — what L3 opens. */
const sourceCard = computed((): CardName | undefined => {
  return sourceView.value?.inspectable === true ? sourceView.value.card : undefined;
});
/** Diegetic + translated title (bypasses the server's baked
 *  "Choose N unit(s)…" string), mirroring the desktop premium surface. */
const titleText = computed((): string => {
  return cost.value === 1 ?
    translateText('Reduce a production') :
    translateTextWithParams('Reduce production by ${0}', [String(cost.value)]);
});
const sum = computed((): number => {
  return rows.value.reduce((acc, row) => acc + lossFor(row.unit), 0);
});
const ready = computed((): boolean => {
  return sum.value === cost.value && cost.value > 0;
});
/** The decision's character (`promptTone.ts`) — a production loss is always a LOSS. */
const tone = computed((): PromptTone => {
  return promptToneOf(model.value).tone;
});
/** The decision's identity in the press's sequence (`promptSequence.ts`). */
const sequenceKey = computed((): string => {
  return model.value === undefined ? '' : promptSequenceKey(model.value, promptIdentityKey(model.value));
});
/** The consequence footer: every production the player has marked, `current → resulting`. */
const outcomeItems = computed((): Array<PromptOutcomeItem> => {
  return rows.value
    .filter((row) => lossFor(row.unit) > 0)
    .map((row) => ({
      key: row.unit,
      iconClass: iconClass(row.unit),
      prod: true,
      delta: -lossFor(row.unit),
      from: fmt(row.current),
      to: fmt(resultingFor(row)),
    }));
});
/** Prompt identity — a change is a genuinely new server ask (reset). */
const promptKey = computed((): string => {
  return `${textOf(model.value?.title)}|${cost.value}`;
});
/** The live command contract — published to the shell's ONE bottom
 *  command bar through consolePanelUi (the footCommands watch below). */
const footCommands = computed((): Array<ConsoleCommand> => {
  // The COMMIT speaks the decision's character: a loss is ACCEPTED, in the
  // bar's danger ink — never the same «Подтвердить» that takes a reward.
  const cmds: Array<ConsoleCommand> = [
    {control: 'dpad', label: 'Navigate'},
    {control: 'confirm', label: '−1'},
    {control: 'bumperL', label: 'Take back'},
    {control: 'secondary', label: promptCommitLabelKey(tone.value, 'Confirm'), enabled: ready.value,
      tone: tone.value === 'loss' ? 'danger' : undefined},
  ];
  // L3 = the SOURCE, the console-wide grammar («X = the current object,
  // L3 = the source that produced it»). The subject here is the production
  // rows; the card only caused them. Discoverable nowhere else, so it
  // outlives the self-evident hints when the bar drops for fit.
  if (sourceCard.value !== undefined) {
    cmds.push({control: 'stickL', label: 'Source', priority: 1});
  }
  cmds.push({control: 'back', label: 'Minimize'});
  return cmds;
});
function lossFor(unit: keyof Units): number {
  return units.value[unit] ?? 0;
}
function resultingFor(row: ProductionLossRow): number {
  return row.current - lossFor(row.unit);
}
/** Signed production readout (+3 / +0 / −2) — these are income rates (a true minus, as every signed figure in the family). */
function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}
function iconClass(unit: keyof Units): string {
  return 'resource_icon resource_icon--' + unit;
}
/** The resource's ONE display name — the same key the gain lanes speak (`LANE_LABELS`). */
function resourceName(unit: keyof Units): string {
  return translateText(LANE_LABELS[unit] ?? unit);
}
/** The honest blocker note (never hidden): at-minimum, or a partial cap. */
function noteFor(row: ProductionLossRow): string {
  if (row.disabled) {
    return translateText('Production already at minimum');
  }
  if (row.limitedTo !== undefined) {
    return translateTextWithParams('Can only reduce by ${0}', [String(row.limitedTo)]);
  }
  return '';
}
function resetSelection(): void {
  units.value = {};
  focusIdx.value = firstSelectableIndex(rows.value);
  submitting.value = false;
  // A lone forced option (one reducible production, lose 1) reads as a
  // confirmation — pre-select it so the player just presses X.
  if (cost.value === 1) {
    const selectable = rows.value.filter((r) => !r.disabled);
    if (selectable.length === 1) {
      units.value = {[selectable[0].unit]: 1};
    }
  }
}
/** The shell routes every intent here while the panel is active. */
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  // L3 — the source card fullscreen. Raw button (the stick presses carry no
  // default semantic action by design); the panel is never unmounted, so
  // the chosen distribution survives the round trip.
  if (intent.kind === 'press' && intent.button === 'stickL' && sourceCard.value !== undefined) {
    zoomSource();
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary': // A
  case 'nextSection': // RB — both assign a −1 (user-mandated)
    assignLoss();
    return;
  case 'prevSection': // LB — take a −1 back
    removeLoss();
    return;
  case 'inspect': // X — confirm
    confirm();
    return;
  case 'back': // B — minimize
    emit('defer');
    return;
  default:
    return;
  }
}
function onNav(dir: NavDirection): void {
  const n = rows.value.length;
  if (n === 0) {
    return;
  }
  const step = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
  if (step === 0) {
    return;
  }
  focusIdx.value = Math.min(n - 1, Math.max(0, focusIdx.value + step));
}
/** A / RB: assign a −1 to the focused production. */
function assignLoss(): void {
  const row = rows.value[focusIdx.value];
  if (row === undefined || row.disabled) {
    return; // a maxed row is readable, never selectable
  }
  // Cost 1 is single-pick: MOVE the lone −1 onto the focused row.
  if (cost.value === 1) {
    units.value = {[row.unit]: 1};
    return;
  }
  // Cost 2: accumulate, capped by the row's own max AND the remaining loss.
  if (sum.value >= cost.value || lossFor(row.unit) >= row.max) {
    return;
  }
  units.value = {...units.value, [row.unit]: lossFor(row.unit) + 1};
}
/** LB: take a −1 back from the focused production. */
function removeLoss(): void {
  const row = rows.value[focusIdx.value];
  if (row === undefined) {
    return;
  }
  const current = lossFor(row.unit);
  if (current <= 0) {
    return;
  }
  const next = {...units.value};
  if (current - 1 <= 0) {
    delete next[row.unit];
  } else {
    next[row.unit] = current - 1;
  }
  units.value = next;
}
/** L3: the source card fullscreen, read-only (no select / action bridge,
 *  so it can never submit). It lifts physically out of the dock. */
function zoomSource(): void {
  const name = sourceCard.value;
  if (name === undefined) {
    return;
  }
  openConsoleCardZoom([{name}], 0, undefined, undefined, {
    statusLabel: 'Source',
    origin: {
      kind: 'physical',
      resolve: () => {
        const dock = sourceDock.value;
        return dock?.rootEl?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null;
      },
    },
  });
}
/** X: confirm the distribution (byte-identical to the desktop submit). */
function confirm(): void {
  if (!ready.value || submitting.value) {
    return;
  }
  submitting.value = true;
  emit('submit', productionToLoseResponse(units.value));
}

watch(() => promptKey.value, () => {
  resetSelection();
}, {immediate: true});
/** Every server response re-arms submission (root identity always changes). */
watch(() => props.playerView, () => {
  submitting.value = false;
});
/** Publish the CONTEXTUAL command contract to the shell's ONE bottom
 *  command bar (consolePanelUi) — hints live only there, never in a
 *  panel-local footer (CONSOLE_TV_PREMIUM_PLAN §3.2). */
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  setPanelCommands('productionLoss', cmds);
}, {immediate: true, deep: true});
onBeforeUnmount(() => {
  clearPanelCommands('productionLoss');
});

// What the shell's pad router reaches through the surface registry (`surfaces.at('prodLoss')` → `handedTo` calls
// `handleIntent(intent)`), and nothing else.
defineExpose({handleIntent});
</script>
