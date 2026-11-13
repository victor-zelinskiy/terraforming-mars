<template>
  <div class="con-lanes con-venus" :class="{'con-ws': !embedded, 'con-venus--embedded': embedded}"
       :role="embedded ? 'group' : 'dialog'" :aria-label="$t(headlineKey)"
       :data-motion-surface="embedded ? undefined : 'venus-bonus'" :data-venus-bonus-embedded="embedded ? '' : undefined">
    <!-- A plate of the PROMPT-MODAL FAMILY (`console_prompt.less`) — a GIFT, so its tone is a GAIN (the mint crest,
         the plus emblem, «▲ ВЫГОДА», «ВЫ ПОЛУЧИТЕ» at the foot). The wild card's pick is the `xl` tier (a card row). -->
    <div class="con-lanes__panel con-prompt con-prompt--gain"
         :class="stage === 'wildCard' ? 'con-lanes__panel--wide con-prompt--xl' : 'con-prompt--m'"
         data-motion-panel data-prompt-panel data-stick-scroll>
      <!-- EMBEDDED: the question line only — the crumb above is where the stage names itself. -->
      <header v-if="embedded" class="con-lanes__head con-venus__ask">
        <h2 class="con-venus__title con-ws-stage-title">{{ $t(headlineKey) }}</h2>
        <div v-if="blockedSlot" class="con-lanes__blocked" :class="{'con-lanes__blocked--off': !blockedShown}"
             data-venus-blocked :aria-hidden="blockedShown ? undefined : 'true'">⚠ {{ blockedLine }}</div>
      </header>
      <ConsolePromptHead v-else class="con-lanes__head" tone="gain" :kicker="$t('Venus bonus')" :title="$t(headlineKey)"
                         :prompt-key="sequenceKey">
        <!-- The stage tail. Stable context BEFORE the mutable stage, and only the tail advances — the console's
             breadcrumb grammar. -->
        <template v-if="isFinal" #kicker-extra>
          <span class="con-lanes__crumb-sep" aria-hidden="true">›</span>
          <span class="con-lanes__crumb-stage" :class="{'con-lanes__crumb-stage--past': stage === 'place'}">
            {{ $t(stageKey) }}
          </span>
        </template>
        <!-- The honest «why not yet» of a PARTIAL placement (nothing placed → the footer says what is owed). The
             budget itself is the footer's meter — a BUDGET readout, so it goes away entirely when there is no budget
             to spread: «0 / 1» over six radio rows is the same sentence a third time. -->
        <div v-if="blockedSlot" class="con-lanes__blocked" :class="{'con-lanes__blocked--off': !blockedShown}"
             data-venus-blocked :aria-hidden="blockedShown ? undefined : 'true'">⚠ {{ blockedLine }}</div>
      </ConsolePromptHead>

      <!-- THE STEP THAT EARNED IT (P89 · EE): «Шкала Венеры 16 % → 18 %» — in both dresses, the context of the question
           (the server's marker; absent on an older save). -->
      <p v-if="stepReading !== ''" class="con-venus__step" data-venus-step>{{ stepReading }}</p>

      <!-- ── STAGE 1 (final step only): where does the WILD go? ──────────── -->
      <div v-if="stage === 'wild'" class="con-venus__wild">
        <p class="con-venus__wild-lead">{{ $t('The final step adds one wild resource.') }}</p>
        <div v-for="(opt, i) in wildOptions" :key="opt.value"
             class="con-venus__opt"
             :class="{
               'con-venus__opt--focused': wildIdx === i,
               'con-venus__opt--disabled': opt.disabled,
             }">
          <div class="con-venus__opt-head">
            <i class="con-venus__opt-icon" :class="opt.iconClass" aria-hidden="true"></i>
            <span class="con-venus__opt-title">{{ $t(opt.titleKey) }}</span>
            <GamepadGlyph v-if="wildIdx === i && !opt.disabled" control="confirm" class="con-venus__opt-a" />
          </div>
          <div class="con-venus__opt-desc">{{ $t(opt.descKey) }}</div>
          <!-- A blocked branch is SHOWN with its reason, never dropped: losing
               the wild silently because you own no resource card would be a
               reward vanishing without a trace. -->
          <div v-if="opt.disabled" class="con-venus__opt-reason">✕ {{ $t(opt.reasonKey) }}</div>
        </div>
      </div>

      <!-- ── STAGE 1b: which card hosts the wild ────────────────────────────
           THE SHARED PLAYED-TARGET SELECTOR — the same component the card-play
           composer, the blue-action composer, the colony payout, the hydro
           stage and the bot attack all point their targets with. Venus owns no
           picker of its own: the candidates are the server's own `SelectCard`,
           the reading is `было → стало` plus the authoritative ПО move, and the
           fit, the scroll and the navigation are the selector's — which is what
           makes the tenth candidate as reachable as the first. The strip this
           replaced was an `overflow-x` row with an index cursor: past four
           cards the rest were simply off the panel.
           `hostStatesAsk`: the panel header above already IS the ask, and an
           embedded surface must not title itself. -->
      <div v-else-if="stage === 'wildCard'" class="con-venus__pick" data-ws-band ref="wildZone">
        <ConsolePlayedTargetStep v-if="wildModel !== undefined && wildFocus !== undefined"
                                 ref="wildStep"
                                 :model="wildModel"
                                 :layout="wildLayout"
                                 :focus="wildFocus"
                                 :bandHeight="wildZoneH"
                                 :lockedCard="wildCard ?? ''"
                                 hostStatesAsk />
      </div>

      <!-- ── STAGE 2: place the standard resources ──────────────────────── -->
      <div v-else class="con-lanes__main">
        <div class="con-lanes__rows">
          <div v-for="(lane, i) in lanes" :key="lane.key"
               class="con-lanes__row"
               :class="{
                 'con-lanes__row--focused': focusIdx === i,
                 'con-lanes__row--active': valueOf(lane) > 0,
               }">
            <div class="con-lanes__line">
              <span class="con-lanes__id">
                <span class="con-lanes__frame">
                  <i class="con-lanes__icon" :class="lane.iconClass" aria-hidden="true"></i>
                </span>
                <span class="con-lanes__name">{{ $t(lane.label) }}</span>
              </span>

              <!-- current → resulting on the player's OWN stock: the point of
                   choosing where a bonus lands is seeing what it becomes. -->
              <span class="con-lanes__stock">
                <span class="con-lanes__cur" :class="{'con-lanes__cur--faded': valueOf(lane) > 0}">{{ lane.available }}</span>
                <template v-if="valueOf(lane) > 0">
                  <span class="con-lanes__arrow" aria-hidden="true">→</span>
                  <span class="con-lanes__next">{{ (lane.available ?? 0) + valueOf(lane) }}</span>
                </template>
              </span>

              <!-- The «+N» counter belongs to a BUDGET being spread. With one
                   unit to place it repeats what the arrow above already says,
                   so the single-step mode spends that cell on the gesture
                   instead (see the keys cell below). -->
              <span v-if="!singleStep" class="con-lanes__delta" :class="{'con-lanes__delta--empty': valueOf(lane) === 0}">
                <template v-if="valueOf(lane) > 0">+{{ valueOf(lane) }}</template>
              </span>

              <span class="con-lanes__keys" aria-hidden="true">
                <template v-if="singleStep">
                  <!-- The same language the wild question one stage up speaks:
                       A on the row under the cursor, a mark on the chosen one.
                       BOTH when they coincide — the cursor is not the answer, so
                       standing on the chosen row must not erase that it IS the
                       answer (the console's focus / selection / commit rule). -->
                  <span v-if="valueOf(lane) > 0" class="con-lanes__tick">✓</span>
                  <GamepadGlyph v-if="focusIdx === i" control="confirm" />
                </template>
                <template v-else-if="focusIdx === i">
                  <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>
      <!-- What the wild is doing, kept visible through the placement so the
           decision the player already made never disappears. BELOW the lanes,
           not beside them: `.con-lanes__main` is a flex ROW, and a sibling
           there halves the lanes' width — which squeezed every resource name
           out of its own row. -->
      <div v-if="stage === 'place' && isFinal" class="con-venus__wild-recap">
        <span class="con-venus__wild-recap-label">{{ $t('Wild resource') }}</span>
        <span class="con-venus__wild-recap-value">{{ wildRecapText }}</span>
      </div>
      <!-- WHAT THE GIFT DOES — where each resource lands (`current → resulting`) and the budget, at the plate's foot. -->
      <ConsolePromptOutcome v-if="stage === 'place'" tone="gain" :items="outcomeItems"
                            :meter="singleStep ? undefined : {done: placed, of: target}"
                            :pending="blockedText !== '' ? blockedText : $t('Venus bonus')" />
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * THE VENUS TRACK BONUS — the reward for crossing a bonus step on the
 * Alternative Venus Board, console-native.
 *
 * It is a GIFT, and it is presented as one: what you earned is stated as a
 * figure, and the whole surface is about placing it. Two shapes, ONE FLOW —
 * the 30 % final step first asks where its WILD resource goes, and only then
 * opens the same lanes; the frame, the kicker and the meter never move, so the
 * stage advances rather than a second screen arriving.
 *
 * …and the INSTRUMENT follows the budget. Most bonuses are a single resource,
 * where a stepper is the wrong tool for a decision that is really «which one»:
 * `budgetSingleStep` turns the lanes into a RADIO — A places it / takes it
 * back, no −1 / +1 / MAX, no meter — which is the same language the wild
 * question one stage up already speaks. A real budget (2, 3, the final step's
 * wild folded in) keeps the dials.
 *
 * data-motion-*: rides the shared `.con-shade` dim + the surface-motion
 * director — no own backdrop.
 *
 * HOST-AGNOSTIC (P89 · ledger EE — the owner's law «the bonus is a STEP of the surface where the scale step fired»):
 *       `embedded` strips the band (`con-ws`, its own motion id — a kept one would claim the shared shade and dim the
 *       host) and the self-titling kicker (the HOST'S crumb names the stage «БОНУС ВЕНЕРЫ»); the same instance is
 *       teleported by the shell into the host's zone — logic, input path and submit untouched.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/**
 * Presentation + the pad contract. The lane arithmetic is the shared
 * `budgetLanes` engine (the same one the spend-heat surface uses) and every
 * server-shape decision — which `and` holds the amounts for the chosen branch,
 * what the response looks like — lives in the pure `compositePrompts` adapter.
 */
import {computed, nextTick, onBeforeUnmount, PropType, ref, useTemplateRef, watch} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {getCard} from '@/client/cards/ClientCardManifest';
import {$t, translateText} from '@/client/directives/i18n';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import ConsolePromptOutcome, {PromptOutcomeItem} from '@/client/components/console/foundation/ConsolePromptOutcome.vue';
import {promptSequenceKey} from '@/client/console/promptSequence';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  findPlayedTargetFocus, planPlayedTargetLayout, playedTargetAt, reseatPlayedTargetFocus,
  stepPlayedTargetFocus, stepPlayedTargetFocusVia,
} from '@/client/console/played/consolePlayedTargetModel';
import {openPlayedTargetZoom} from '@/client/console/played/playedTargetDossier';
import {buildVenusWildTargetModel, venusWildCandidates} from '@/client/console/venusBonus/venusWildTargetStep';
import {armVenusBonusCell} from '@/client/console/scaleStepReward/venusBonusCellBeat';
import {venusStepReading} from '@/client/console/venusBonus/venusBonusPreselect';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  VenusWildChoice, venusBaseCount, venusBonusLanes, venusBonusResponse, venusWildTargets,
} from '@/client/console/compositePrompts';
import {
  BudgetLane, BudgetRule, BudgetState, budgetBlockedKey, budgetSingleStep, budgetTotal, budgetValid,
  laneValue, maxOntoLane, stepFocus, stepLane, toggleSoleStep,
} from '@/client/console/budgetLanes';

type Stage = 'wild' | 'wildCard' | 'place';

interface WildOption {
  value: VenusWildChoice;
  iconClass: string;
  titleKey: string;
  descKey: string;
  disabled: boolean;
  reasonKey: string;
}

defineOptions({name: 'ConsoleVenusBonus'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  /** Hosted inside a workspace's zone (P89 · EE) — see the HOST-AGNOSTIC note that opens this script. */
  embedded: {type: Boolean, default: false},
});
const emit = defineEmits(['submit', 'defer']);

const wildStep = useTemplateRef<{cells?: () => ReadonlyArray<PlayedTargetCell>} & {ensureFocusVisible?: () => void}>('wildStep');
const wildZone = useTemplateRef<HTMLElement>('wildZone');
const focusIdx = ref(0);
const wildIdx = ref(0);
const picks = ref<BudgetState>({});
const wild = ref<VenusWildChoice | undefined>(undefined);
/** The card the player CHOSE to host the wild. It survives B (the picker
 *  re-opens with it locked and focused), so nothing is re-decided. */
const wildCard = ref<CardName | undefined>(undefined);
/** The picker is the current stage. Separate from `wildCard` on purpose:
 *  «the choice is made» and «the player is looking at the choice» are two
 *  facts, and collapsing them is what made B throw the pick away. */
const wildCardOpen = ref(false);
/** The selector's cursor — a real spatial focus, not a strip index.
 *  RAW: the rendered one is the reseated `wildFocus` computed, so a model
 *  that moved under the player can never leave the cursor pointing at a
 *  candidate that is no longer there. */
const wildFocusRaw = ref<PlayedTargetFocus | undefined>(undefined);
const wildZoneW = ref(0);
const wildZoneH = ref(0);
let stopWildObs: (() => void) | undefined;
const submitting = ref(false);

const meta = computed((): VenusBonusPromptMeta | undefined => {
  return props.playerView.waitingFor?.venusBonusPrompt;
});
/** «Шкала Венеры 16 % → 18 %» — the raise that earned the bonus (`VenusBonusPromptMeta.step`), or ''. */
const stepReading = computed((): string => {
  return venusStepReading(meta.value);
});
const isFinal = computed((): boolean => {
  return meta.value?.kind === 'final';
});
const wildTargets = computed((): ReadonlyArray<CardName> => {
  return meta.value === undefined ? [] : venusWildTargets(meta.value);
});
/**
 * THE STAGE. Derived, never a set of booleans: the base bonus goes straight
 * to the lanes, the final one asks about its wild first and only descends
 * into the card pick when that branch is chosen.
 */
const stage = computed((): Stage => {
  if (!isFinal.value || wild.value === 'asStandard') {
    return 'place';
  }
  if (wild.value === undefined) {
    return 'wild';
  }
  // Undecided OR re-opened — the two enter the picker the same way, and
  // only the second one arrives with a lock already on a card.
  return (wildCard.value === undefined || wildCardOpen.value) ? 'wildCard' : 'place';
});
/**
 * THE AUTHORITATIVE CANDIDATES — the server's own `SelectCard`, read off
 * the prompt by SHAPE. Its models carry the live per-card resource count,
 * which is what the `было → стало` reading is built from.
 */
const wildCandidates = computed((): ReadonlyArray<CardModel> => {
  return venusWildCandidates(props.playerView.waitingFor);
});
const wildModel = computed((): PlayedTargetModel | undefined => {
  if (wildCandidates.value.length === 0) {
    return undefined;
  }
  return buildVenusWildTargetModel({
    candidates: wildCandidates.value,
    players: props.playerView.players.map((p) => ({name: p.name, color: p.color, tableau: p.tableau})),
    viewerColor: props.playerView.thisPlayer.color,
    // The panel header states the ask in full; the step must not restate it
    // (and `hostStatesAsk` hides the line that would).
    ask: '',
    typeOf: (name) => getCard(name)?.type,
    // The wild becomes the card's OWN resource — a per-candidate fact.
    resourceOf: (name) => getCard(name)?.resourceType,
    // The server's own per-candidate ПО reading. Nothing is re-derived here.
    vpBox: meta.value?.wildCardVp,
  });
});
const wildLayout = computed((): PlayedTargetLayout => {
  return planPlayedTargetLayout({
    owners: wildModel.value?.owners ?? [],
    availW: wildZoneW.value,
    ui: conUiScale(),
    handheld: consoleLayoutState.profile === 'handheld',
  });
});
/** The focus the child renders — reseated whenever the model moves. */
const wildFocus = computed((): PlayedTargetFocus | undefined => {
  return reseatPlayedTargetFocus(wildFocusRaw.value, wildModel.value?.owners ?? []);
});
const focusedWildCard = computed((): CardName | undefined => {
  return playedTargetAt(wildFocus.value, wildModel.value?.owners ?? [])?.cardName;
});
/**
 * THE CRUMB'S TAIL — one name per stage, and the tail only ever moves
 * FORWARD: «ДОПОЛНИТЕЛЬНЫЙ РЕСУРС» → «ЦЕЛЬ» → «РАЗМЕЩЕНИЕ». The picker
 * used to inherit the placement's name, so the line said «РАЗМЕЩЕНИЕ»
 * over a title asking which card should receive the resource — a tail one
 * stage ahead of the screen under it.
 */
const stageKey = computed((): string => {
  switch (stage.value) {
  case 'wild': return 'Wild resource';
  case 'wildCard': return 'Target';
  default: return 'Placement';
  }
});
const target = computed((): number => {
  return meta.value === undefined ? 0 : venusBaseCount(meta.value, wild.value);
});
const rule = computed((): BudgetRule => {
  return {kind: 'exact', target: target.value};
});
const lanes = computed((): Array<BudgetLane> => {
  const stock = props.playerView.thisPlayer as unknown as Partial<Record<keyof Units, number>>;
  return venusBonusLanes(target.value, stock);
});
/**
 * THE COMMON CASE: one resource to place, so the decision is «which one» and
 * the surface becomes a RADIO — A puts it here / takes it back, and the
 * stepper verbs are not offered. Asked of the pure engine (a property of the
 * budget, never `target === 1`), so the spend-heat surface reads the same
 * question and the two can't drift.
 */
const singleStep = computed((): boolean => {
  return budgetSingleStep(lanes.value, rule.value);
});
/** The lane under the cursor already holds the unit — A takes it back. */
const focusedPicked = computed((): boolean => {
  const lane = lanes.value[focusIdx.value];
  return lane !== undefined && laneValue(picks.value, lane.key) > 0;
});
/** The decision's identity in the press's sequence (`promptSequence.ts`) — one key for both stages of one gift. */
const sequenceKey = computed((): string => {
  const wf = props.playerView.waitingFor;
  return wf === undefined ? '' : promptSequenceKey(wf, promptIdentityKey(wf));
});
/** The consequence footer: every lane holding part of the gift, the player's stock `current → resulting`. */
const outcomeItems = computed((): Array<PromptOutcomeItem> => {
  return lanes.value
    .filter((lane) => valueOf(lane) > 0)
    .map((lane) => ({
      key: lane.key,
      iconClass: lane.iconClass,
      delta: valueOf(lane),
      from: lane.available !== undefined ? String(lane.available) : undefined,
      to: lane.available !== undefined ? String(lane.available + valueOf(lane)) : undefined,
    }));
});
const placed = computed((): number => {
  return budgetTotal(lanes.value, picks.value);
});
const ready = computed((): boolean => {
  return budgetValid(lanes.value, picks.value, rule.value);
});
/**
 * THE BLOCKER'S SLOT IS RESERVED, its words toggle by VISIBILITY (the owner, 2026-11-02: «размер элемента скачет из-за
 * валидации "распределите весь бонус"»): a budget of more than one unit owns the line for the whole placement —
 * mounted before the first unit, after the last — so the plate never grows or shrinks under the press that changes
 * the state. A single unit has no partial state, so no slot at all.
 */
const blockedSlot = computed((): boolean => {
  return stage.value === 'place' && !singleStep.value;
});
const blockedShown = computed((): boolean => {
  return placed.value > 0 && blockedText.value !== '';
});
/** The reserved line's words — the live blocker, or the same sentence held invisible so the slot keeps its height. */
const blockedLine = computed((): string => {
  return blockedText.value !== '' ? blockedText.value : translateText('Distribute the whole bonus');
});
const blockedText = computed((): string => {
  const key = budgetBlockedKey(lanes.value, picks.value, rule.value);
  return key === undefined ? '' : translateText(key);
});
const headlineKey = computed((): string => {
  switch (stage.value) {
  case 'wild': return 'Where does the wild resource go?';
  case 'wildCard': return 'Choose the card to receive it';
  default: return 'Place your Venus track bonus';
  }
});
const wildOptions = computed((): ReadonlyArray<WildOption> => {
  const noCards = wildTargets.value.length === 0;
  return [
    {
      value: 'onCard',
      iconClass: 'resource_icon resource_icon--cards',
      titleKey: 'Put it on a card',
      descKey: 'One resource of that card\'s own type.',
      disabled: noCards,
      reasonKey: 'You have no card that can hold a resource',
    },
    {
      value: 'asStandard',
      iconClass: 'resource_icon resource_icon--megacredits',
      titleKey: 'Take one more standard resource',
      descKey: 'The wild joins the bonus you are placing.',
      disabled: false,
      reasonKey: '',
    },
  ];
});
const wildRecapText = computed((): string => {
  if (wild.value === 'onCard' && wildCard.value !== undefined) {
    return translateText(wildCard.value);
  }
  return translateText('Taken as a standard resource');
});
const promptKey = computed((): string => {
  return `${meta.value?.kind ?? ''}|${meta.value?.baseCount ?? 0}|${wildTargets.value.join(',')}`;
});
/**
 * WHAT B DOES HERE — one function, so the label can never disagree with the
 * press. There is somewhere to go back TO exactly while the final step's
 * wild question has been answered: from the picker back to the question,
 * and from the placement back into the picker. Everywhere else B minimizes
 * (the board-home card is then the one door back).
 */
const backVerb = computed((): 'back' | 'minimize' => {
  if (stage.value === 'wildCard') {
    return 'back';
  }
  return stage.value === 'place' && isFinal.value ? 'back' : 'minimize';
});
const footCommands = computed((): Array<ConsoleCommand> => {
  const back: ConsoleCommand = {control: 'back', label: backVerb.value === 'back' ? 'Back' : 'Minimize'};
  if (stage.value === 'wild') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Select', enabled: !wildOptions.value[wildIdx.value]?.disabled},
      back,
    ];
  }
  if (stage.value === 'wildCard') {
    // The selector's own grammar (D-pad move · A choose · X inspect · B
    // back), stated by the ONE command bar — the same four verbs every
    // other host of this step publishes. `dpad`, not `dpadH`: the grid the
    // selector plans is two-dimensional the moment there are more
    // candidates than one row holds.
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Select', enabled: focusedWildCard.value !== undefined},
      {control: 'secondary', label: 'Inspect'},
      back,
    ];
  }
  // ONE resource to place → one verb. Offering −1 / +1 / MAX for a dial that
  // can only read 0 or 1 is four ways to say the same thing, and it hides
  // the confirm behind them.
  if (singleStep.value) {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: focusedPicked.value ? 'Remove here' : 'Add here'},
      {control: 'secondary', label: 'Collect', enabled: ready.value, highlight: ready.value},
      back,
    ];
  }
  return [
    {control: 'dpad', label: 'Navigate'},
    {control: 'bumperL', label: '−1'},
    {control: 'bumperR', label: '+1'},
    {control: 'triggerR', label: 'MAX'},
    {control: 'secondary', label: 'Collect', enabled: ready.value, highlight: ready.value},
    back,
  ];
});

function valueOf(lane: BudgetLane): number {
  return laneValue(picks.value, lane.key);
}
function reset(): void {
  submitting.value = false;
  focusIdx.value = 0;
  wildIdx.value = 0;
  picks.value = {};
  wild.value = undefined;
  wildCard.value = undefined;
  wildCardOpen.value = false;
  wildFocusRaw.value = undefined;
}
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary': // A
    onConfirmPress();
    return;
  case 'prevSection':
    if (stage.value === 'place') {
      step(-1);
    }
    return;
  case 'nextSection':
    if (stage.value === 'place') {
      step(1);
    }
    return;
  case 'nextTab': // RT
    if (stage.value === 'place') {
      maxOnto();
    }
    return;
  case 'inspect': // X
    if (stage.value === 'wildCard') {
      zoomFocusedCard();
    } else if (stage.value === 'place') {
      collect();
    }
    return;
  case 'back':
    onBack();
    return;
  default:
    return;
  }
}
function onNav(dir: string): void {
  if (stage.value === 'wild') {
    if (dir === 'up' || dir === 'down') {
      wildIdx.value = Math.min(wildOptions.value.length - 1, Math.max(0, wildIdx.value + (dir === 'down' ? 1 : -1)));
    }
    return;
  }
  if (stage.value === 'wildCard') {
    wildNav(dir as PlayedTargetNavDir);
    return;
  }
  if (dir === 'up' || dir === 'down') {
    focusIdx.value = stepFocus(lanes.value, focusIdx.value, dir === 'down' ? 1 : -1);
  }
}
/** A — advances the flow one level, or (single-step placement) puts the one
 *  resource down / takes it back. It never submits; X does. */
function onConfirmPress(): void {
  if (stage.value === 'wild') {
    const opt = wildOptions.value[wildIdx.value];
    if (opt !== undefined && !opt.disabled) {
      wild.value = opt.value;
      // Descending into the picker is what «on a card» MEANS; the pick
      // itself may already exist from an earlier pass through this stage.
      wildCardOpen.value = opt.value === 'onCard';
    }
    return;
  }
  if (stage.value === 'wildCard') {
    const card = focusedWildCard.value;
    if (card !== undefined) {
      wildCard.value = card;
      wildCardOpen.value = false;
    }
    return;
  }
  // In the multi-lane layout A stays free (the budget is spread with LB/RB),
  // so claiming it here costs the flow nothing.
  if (singleStep.value) {
    toggleFocused();
  }
}
/** The single-step gesture: place the unit here, or take it back. */
function toggleFocused(): void {
  const lane = lanes.value[focusIdx.value];
  if (lane !== undefined) {
    picks.value = toggleSoleStep(lanes.value, picks.value, rule.value, lane.key);
  }
}
/**
 * B — ONE logical level, and the earned bonus survives it.
 *
 * From the PLACEMENT of a wild that went on a card, that one level is the
 * PICKER, not the wild question two levels up: the player is undoing where
 * the resource went, and the card they chose stays chosen (it re-opens
 * locked and focused, exactly as this step's «Изменить выбор» does in
 * both composers). It used to reset the whole wild decision, which threw
 * away a pick the player had not asked to take back.
 */
function onBack(): void {
  if (stage.value === 'wildCard') {
    wildCardOpen.value = false;
    wild.value = undefined;
    return;
  }
  if (stage.value === 'place' && isFinal.value) {
    if (wild.value === 'onCard') {
      wildCardOpen.value = true;
      return;
    }
    wild.value = undefined;
    return;
  }
  emit('defer');
}
function step(delta: number): void {
  const lane = lanes.value[focusIdx.value];
  if (lane === undefined) {
    return;
  }
  // SINGLE-STEP mode doesn't advertise the stepper verbs, but they still
  // land on its one gesture: muscle memory from the multi-lane layout must
  // never meet a dead button. LB takes the unit off this lane, RB puts it
  // here (moving it — a plain `+1` under a full budget is refused).
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
function collect(): void {
  if (!ready.value || submitting.value || meta.value === undefined) {
    return;
  }
  submitting.value = true;
  // THE PROMISE of the cell beat (P89 · EE, PL-1436): what this answer pays — the rows (the wild taken as a standard
  // resource is already folded into the picks) and the card the wild lands on; checked against the views on the
  // response, flown off the bonus cell the step reached.
  const units: Partial<Record<string, number>> = {};
  for (const lane of lanes.value) {
    const n = laneValue(picks.value, lane.key);
    if (n > 0) {
      units[lane.key] = n;
    }
  }
  const resource = wild.value === 'onCard' && wildCard.value !== undefined ? getCard(wildCard.value)?.resourceType : undefined;
  armVenusBonusCell({
    units,
    ...(resource !== undefined && wildCard.value !== undefined ?
      {card: {name: wildCard.value, resource: cardResourceKey(String(resource))}} : {}),
    ...(meta.value.step !== undefined ? {step: meta.value.step} : {}),
  });
  emit('submit', venusBonusResponse(meta.value, picks.value, wild.value, wildCard.value));
}
/**
 * THE SELECTOR'S NAVIGATION — resolved against the cards' REAL boxes, so a
 * grid that wrapped to a second row is walked as a grid. The index cursor
 * this replaced could only ever move along one line.
 */
function wildNav(dir: PlayedTargetNavDir): void {
  const owners = wildModel.value?.owners ?? [];
  const focus = wildFocus.value;
  if (focus === undefined || owners.length === 0) {
    return;
  }
  const step = wildStep.value ?? undefined;
  const cells = step?.cells?.() ?? [];
  const next = cells.length > 0 ?
    stepPlayedTargetFocusVia(step, focus, dir, cells) :
    stepPlayedTargetFocus(focus, dir, owners, wildLayout.value);
  if (next === undefined) {
    return; // an edge HOLDS — never a wrap, never a silent jump
  }
  wildFocusRaw.value = next;
  wildStep.value?.ensureFocusVisible?.();
}
/** Seat the cursor: on the already-chosen card when there is one (a re-entry
 *  must not lose the player's place), otherwise on the first candidate. */
function seatWildFocus(): void {
  const owners = wildModel.value?.owners ?? [];
  if (owners.length === 0) {
    return;
  }
  wildFocusRaw.value = findPlayedTargetFocus(wildCard.value ?? '', owners) ??
    reseatPlayedTargetFocus(wildFocusRaw.value, owners);
  void nextTick(() => measureWildZone());
}
function measureWildZone(): void {
  const zone = wildZone.value ?? undefined;
  if (zone === undefined || zone === null) {
    return;
  }
  wildZoneW.value = Math.max(0, zone.clientWidth);
  wildZoneH.value = Math.max(0, zone.clientHeight);
  if (stopWildObs === undefined) {
    stopWildObs = useResizeObserver(zone, () => {
      const el = wildZone.value ?? undefined;
      if (el !== undefined && el !== null) {
        wildZoneW.value = Math.max(0, el.clientWidth);
        wildZoneH.value = Math.max(0, el.clientHeight);
      }
    }).stop;
  }
}
/** X on the card stage — the ordinary fullscreen viewer, read-only, rising
 *  out of the candidate's own slot (the step's shared zoom origin). */
function zoomFocusedCard(): void {
  const owners = wildModel.value?.owners ?? [];
  const focused = focusedWildCard.value;
  if (focused === undefined) {
    return;
  }
  // THE ONE DOOR — with the TARGET DOSSIER. The picker's ZONE is the root the origin resolves inside (an element
  // ref, so the physical entrance survives a build that leaves `$el` a fragment anchor); no source card here — the
  // bonus is paid by the VENUS TRACK, so every candidate is an ordinary slot.
  if (wildModel.value !== undefined && owners.length > 0) {
    openPlayedTargetZoom({model: wildModel.value, cardName: focused, getRoot: () => wildZone.value ?? undefined});
  }
}

watch(() => promptKey.value, () => {
  reset();
}, {immediate: true});
/** A changed budget (the wild folded in) invalidates the placement. */
watch(() => target.value, () => {
  picks.value = {};
  focusIdx.value = 0;
});
watch(() => props.playerView, () => {
  submitting.value = false;
});
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  setPanelCommands('venusBonus', cmds);
}, {immediate: true, deep: true});
/**
 * The picker's zone only exists while its stage does, so its cursor is
 * seated — and its band measured — the moment the stage opens, never at
 * mount. `bandHeight` is measured on the STRETCHED zone before the step's
 * first painted frame, which is what lets the step solve a card size
 * instead of inheriting one from its own content.
 */
watch(() => stage.value, (stage: Stage) => {
  if (stage !== 'wildCard') {
    return;
  }
  seatWildFocus();
  void nextTick(() => measureWildZone());
}, {immediate: true});

onBeforeUnmount(() => {
  clearPanelCommands('venusBonus');
  stopWildObs?.();
  stopWildObs = undefined;
});
defineExpose({handleIntent});
</script>
