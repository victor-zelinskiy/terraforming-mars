<template>
  <div class="con-lanes con-heat con-ws" role="dialog" :aria-label="titleText" data-motion-surface="spend-heat">
    <!-- A plate of the PROMPT-MODAL FAMILY (`console_prompt.less`). A bill the player chose to pay is a free choice —
         the NEUTRAL tone (the quiet crest, the ◈ emblem); its coverage («ПОКРЫТО N / M») is the footer's meter. -->
    <div class="con-lanes__panel con-prompt con-prompt--m" :class="'con-prompt--' + tone" data-motion-panel data-prompt-panel data-stick-scroll>
      <ConsolePromptHead class="con-lanes__head" :tone="tone" :kicker="$t('Spend heat')" :title="titleText"
                         :prompt-key="sequenceKey">
        <!-- The honest blocker of a PARTIAL or over-covered bill, never a dead confirm with no explanation (nothing
             chosen yet → the footer says what is owed). -->
        <div v-if="covered > 0 && blockedText !== ''" class="con-lanes__blocked">⚠ {{ blockedText }}</div>
      </ConsolePromptHead>

      <div class="con-lanes__main">
        <console-source-dock v-if="sourceView !== undefined" :view="sourceView" compact ref="sourceDock" />

        <div class="con-lanes__rows">
          <div v-for="(lane, i) in lanes" :key="lane.key"
               class="con-lanes__row"
               :class="{
                 'con-lanes__row--focused': focusIdx === i,
                 'con-lanes__row--active': valueOf(lane) > 0,
                 'con-lanes__row--spent': lane.max === 0,
               }">
            <div class="con-lanes__line">
              <span class="con-lanes__id">
                <span class="con-lanes__frame">
                  <i class="con-lanes__icon" :class="lane.iconClass" aria-hidden="true"></i>
                </span>
                <span class="con-lanes__name">{{ $t(lane.label) }}</span>
              </span>

              <!-- The dial, and what it BUYS. A floater is worth 2 heat and the
                   player must never have to do that arithmetic themselves.
                   The dial is a COUNTER: when the bill is one step it can only
                   read 0 or 1, so the single-step mode drops it and keeps what
                   still carries information — what this source pays. -->
              <span v-if="!singleStep" class="con-lanes__dial">
                <b class="con-lanes__value">{{ valueOf(lane) }}</b>
                <span class="con-lanes__of">/ {{ lane.max }}</span>
              </span>
              <span class="con-lanes__pays" :class="{'con-lanes__pays--empty': valueOf(lane) === 0}">
                <template v-if="valueOf(lane) > 0">
                  {{ paysOf(lane) }}<i class="resource_icon resource_icon--heat con-lanes__pays-icon" aria-hidden="true"></i>
                </template>
              </span>

              <span class="con-lanes__keys" aria-hidden="true">
                <template v-if="singleStep">
                  <!-- The mark survives the cursor, and stands BESIDE it on the
                       chosen row: focus is not selection. -->
                  <span v-if="valueOf(lane) > 0" class="con-lanes__tick">✓</span>
                  <GamepadGlyph v-if="focusIdx === i" control="confirm" />
                </template>
                <template v-else-if="focusIdx === i">
                  <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                </template>
              </span>
            </div>
            <div v-if="lane.noteKey !== undefined" class="con-lanes__note">{{ $t(lane.noteKey) }}</div>
          </div>
        </div>
      </div>

      <!-- THE BILL, at the plate's foot: what leaves each source and how much of the bill it covers — the same
           «what does it cost / what is covered» pair the payment panel states. -->
      <ConsolePromptOutcome :tone="tone" label-key="Covered" :items="outcomeItems" :meter="{done: covered, of: target}"
                            :pending="blockedText" />
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * SPEND HEAT — Stormcraft Incorporated's «pay N heat» prompt, console-native.
 *
 * It is a PAYMENT, and it is presented as one: a coverage meter that reads
 * like the payment panel's status line, two source lanes, and a confirm that
 * is only live when the bill is covered EXACTLY (the rules reject an
 * overpayment, so the surface must never offer one). The desktop modal this
 * replaces was a pair of bare number steppers with no idea what they added up
 * to — on a TV it was unreadable and unplayable with a pad.
 *
 * …and when ONE step covers the bill (`budgetSingleStep`) the dials go away
 * too: A picks the source, X pays. Same rule, same engine and same gesture as
 * the Venus bonus's single-resource mode — the two halves of this chassis
 * always answer the same question the same way.
 *
 * data-motion-*: rides the shared `.con-shade` dim + the surface-motion
 * director — no own backdrop.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * Presentation + the pad contract. Every rule (what a step may do, when the
 * bill is covered, when it overpays, what the blocker is) lives in the pure
 * `budgetLanes` engine, shared with the Venus bonus surface — so the two
 * distribution screens can never drift, and the rules are unit-tested without
 * mounting anything.
 */
import {computed, onBeforeUnmount, PropType, ref, useTemplateRef, watch} from 'vue';
import {RootElHolder} from '@/client/components/rootEl';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {AndOptionsModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';
import {CardName} from '@/common/cards/CardName';
import {$t, translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
// `<console-source-dock>` is one of the three components that are ASYNC ON PURPOSE: the template's tag resolves to
// this lazy binding (the same one main.ts registers by name) — see the note in asyncComponents.ts.
import {ConsoleSourceDock} from '@/client/components/asyncComponents';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import ConsolePromptOutcome, {PromptOutcomeItem} from '@/client/components/console/foundation/ConsolePromptOutcome.vue';
import {PromptTone, promptToneOf} from '@/client/console/promptTone';
import {promptSequenceKey} from '@/client/console/promptSequence';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {spendHeatLanes, spendHeatResponse} from '@/client/console/compositePrompts';
import {
  BudgetLane, BudgetRule, BudgetState, budgetBlockedKey, budgetSingleStep, budgetTotal, budgetValid,
  forcedAllocation, laneValue, maxOntoLane, stepFocus, stepLane, toggleSoleStep,
} from '@/client/console/budgetLanes';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

defineOptions({name: 'ConsoleSpendHeat'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
});
const emit = defineEmits(['submit', 'defer']);

// The source dock's ref — read for its root element only (`$el`: the physical origin of the L3 zoom).
const sourceDock = useTemplateRef<RootElHolder>('sourceDock');
const focusIdx = ref(0);
const picks = ref<BudgetState>({});
const submitting = ref(false);

const model = computed((): AndOptionsModel | undefined => {
  const wf = props.playerView.waitingFor;
  return wf?.spendHeatPrompt !== undefined && wf.type === 'and' ? (wf as AndOptionsModel) : undefined;
});
const target = computed((): number => {
  return model.value?.spendHeatPrompt?.amount ?? 0;
});
const rule = computed((): BudgetRule => {
  return {kind: 'cover', target: target.value};
});
const lanes = computed((): Array<BudgetLane> => {
  return model.value === undefined ? [] : spendHeatLanes(model.value);
});
/**
 * A bill one step covers (one heat OR one floater): the dials mean nothing,
 * so the surface becomes a RADIO — A picks the source / takes it back. The
 * SAME question the Venus bonus asks, off the same pure engine, so the two
 * halves of this chassis can never drift apart. The BILL itself stays on
 * screen: a payment always states what it costs.
 */
const singleStep = computed((): boolean => {
  return budgetSingleStep(lanes.value, rule.value);
});
/** The lane under the cursor is the chosen source — A takes it back. */
const focusedPicked = computed((): boolean => {
  const lane = lanes.value[focusIdx.value];
  return lane !== undefined && laneValue(picks.value, lane.key) > 0;
});
const covered = computed((): number => {
  return budgetTotal(lanes.value, picks.value);
});
const ready = computed((): boolean => {
  return budgetValid(lanes.value, picks.value, rule.value);
});
const blockedText = computed((): string => {
  const key = budgetBlockedKey(lanes.value, picks.value, rule.value);
  return key === undefined ? '' : translateText(key);
});
const titleText = computed((): string => {
  return textOf(model.value?.title);
});
/** The decision's character (`promptTone.ts`) — a bill the player chose to pay reads NEUTRAL. */
const tone = computed((): PromptTone => {
  return promptToneOf(model.value).tone;
});
/** The decision's identity in the press's sequence (`promptSequence.ts`). */
const sequenceKey = computed((): string => {
  return model.value === undefined ? '' : promptSequenceKey(model.value, promptIdentityKey(model.value));
});
/** The footer: what leaves each chosen source (`owned → left`). */
const outcomeItems = computed((): Array<PromptOutcomeItem> => {
  return lanes.value
    .filter((lane) => valueOf(lane) > 0)
    .map((lane) => ({
      key: lane.key,
      iconClass: lane.iconClass,
      delta: -valueOf(lane),
      from: String(lane.max),
      to: String(lane.max - valueOf(lane)),
    }));
});
const sourceView = computed((): PromptSourceView | undefined => {
  return promptSourceView(model.value);
});
const sourceCard = computed((): CardName | undefined => {
  return sourceView.value?.inspectable === true ? sourceView.value.card : undefined;
});
/** A genuinely new bill resets the dials. */
const promptKey = computed((): string => {
  return `${target.value}|${lanes.value.map((l) => l.max).join(',')}`;
});
const footCommands = computed((): Array<ConsoleCommand> => {
  // One step covers the bill → one verb, and the confirm right beside it.
  const cmds: Array<ConsoleCommand> = singleStep.value ? [
    {control: 'dpad', label: 'Navigate'},
    {control: 'confirm', label: focusedPicked.value ? 'Remove here' : 'Add here'},
    {control: 'secondary', label: 'Pay', enabled: ready.value},
  ] : [
    {control: 'dpad', label: 'Navigate'},
    {control: 'bumperL', label: '−1'},
    {control: 'bumperR', label: '+1'},
    {control: 'triggerR', label: 'MAX'},
    {control: 'secondary', label: 'Pay', enabled: ready.value},
  ];
  if (sourceCard.value !== undefined) {
    cmds.push({control: 'stickL', label: 'Source', priority: 1});
  }
  cmds.push({control: 'back', label: 'Minimize'});
  return cmds;
});

function valueOf(lane: BudgetLane): number {
  return laneValue(picks.value, lane.key);
}
/** What this lane contributes to the bill, in heat. */
function paysOf(lane: BudgetLane): number {
  return valueOf(lane) * lane.weight;
}
function reset(): void {
  submitting.value = false;
  focusIdx.value = 0;
  // Only ONE way to pay → it is a confirmation, not a puzzle. Same rule the
  // production-loss surface applies to a lone reducible row.
  picks.value = forcedAllocation(lanes.value, rule.value) ?? {};
}
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    if (intent.dir === 'up' || intent.dir === 'down') {
      focusIdx.value = stepFocus(lanes.value, focusIdx.value, intent.dir === 'down' ? 1 : -1);
    }
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickL' && sourceCard.value !== undefined) {
    zoomSource();
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary': // A — the single-step gesture (free in the dial layout)
    if (singleStep.value) {
      toggleFocused();
    }
    return;
  case 'prevSection': // LB
    step(-1);
    return;
  case 'nextSection': // RB
    step(1);
    return;
  case 'nextTab': // RT — pour the rest onto the focused lane
    maxOnto();
    return;
  case 'inspect': // X — pay
    confirm();
    return;
  case 'back':
    emit('defer');
    return;
  default:
    return;
  }
}
/** The single-step gesture: pay with this source, or take it back. */
function toggleFocused(): void {
  const lane = lanes.value[focusIdx.value];
  if (lane !== undefined) {
    picks.value = toggleSoleStep(lanes.value, picks.value, rule.value, lane.key);
  }
}
function step(delta: number): void {
  const lane = lanes.value[focusIdx.value];
  if (lane === undefined) {
    return;
  }
  // SINGLE-STEP mode doesn't advertise the stepper verbs, but they still
  // land on its one gesture — muscle memory must never meet a dead button.
  // LB takes the unit off this lane, RB puts it here (MOVING it: a plain
  // `+1` on top of a covered bill is refused by the engine, as it must be).
  if (singleStep.value) {
    picks.value = delta < 0 ?
      (focusedPicked.value ? {} : picks.value) :
      stepLane(lanes.value, {}, rule.value, lane.key, 1);
    return;
  }
  picks.value = stepLane(lanes.value, picks.value, rule.value, lane.key, delta);
}
function maxOnto(): void {
  const lane = lanes.value[focusIdx.value];
  if (lane === undefined) {
    return;
  }
  picks.value = singleStep.value ?
    stepLane(lanes.value, {}, rule.value, lane.key, 1) :
    maxOntoLane(lanes.value, picks.value, rule.value, lane.key);
}
function confirm(): void {
  if (!ready.value || submitting.value) {
    return;
  }
  submitting.value = true;
  emit('submit', spendHeatResponse(lanes.value, picks.value));
}
/** L3 — the source card fullscreen; the dials survive the round trip. */
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

watch(() => promptKey.value, () => {
  reset();
}, {immediate: true});
watch(() => props.playerView, () => {
  submitting.value = false;
});
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  setPanelCommands('spendHeat', cmds);
}, {immediate: true, deep: true});

onBeforeUnmount(() => {
  clearPanelCommands('spendHeat');
});

// What the shell's pad router reaches through the surface registry (`shell.surfaces.at('spendHeat')` → `handedTo`):
// `handleIntent` — and nothing else.
defineExpose({handleIntent});
</script>
