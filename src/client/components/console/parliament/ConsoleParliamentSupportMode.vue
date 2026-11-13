<template>
  <div class="con-parl__support"
       :class="{
         'con-parl__support--committed': flow.supportCommitted,
         'con-parl__support--live': flow.supportLive,
       }"
       :style="{'--parl-accent': reading !== undefined ? accentOf(reading.party) : undefined}"
       data-parl-support-mode
       :data-support-beat="flow.supportBeat || undefined"
       :data-support-staged="staged ? '' : undefined">
    <div class="con-parl__support-stage">
    <transition name="con-parl-xfade">
      <div v-if="reading !== undefined" :key="reading.party" class="con-parl__support-body"
           data-parl-support-reading
           :data-support-party="reading.party"
           :data-support-current="reading.current"
           :data-support-resulting="reading.resulting"
           :data-support-available="reading.available ? '' : undefined">
        <div class="con-parl__support-head">
          <img class="con-parl__support-emblem" :src="emblemOf(reading.party)" alt="" />
          <b class="con-parl__support-name">{{ $t(partyNameKey(reading.party)) }}</b>
        </div>
        <div class="con-parl__support-area">
          <span class="con-parl__info-kicker con-parl__support-kicker">{{ $t('Popular support') }}</span>
          <span class="con-parl__support-row">
            <ConsoleSupportPlaces class="con-parl__support-places" :filled="placesFilled" :outgoing="placesOutgoing" />
            <span v-if="reading.available" class="con-parl__support-num" data-parl-support-num>
              <b>{{ reading.current }}</b><span class="con-parl__fact-arrow" aria-hidden="true">→</span><b class="con-parl__support-after">{{ reading.resulting }}</b>
            </span>
          </span>
          <!-- A refused area names its ONE reason; a candidate states the rule in one line — where the cubes go, and
               what does NOT change (the resolutions' votes). Every number above is the server's row. -->
          <span v-if="!reading.available" class="con-parl__support-reason" data-parl-support-reason>{{ $t(reading.reason ?? 'The support area is empty') }}</span>
          <span v-else class="con-parl__support-rule" data-parl-support-rule>{{ $t(ruleKey) }}</span>
        </div>
        <!-- THE RECEIPT of a staged card door: the card's price as the composer settled it — LOCKED here (B walks
             back to the composer, which can change it). -->
        <div v-if="receipt !== undefined" class="con-parl__info-receipt con-parl__support-receipt" data-parl-support-receipt
             :data-receipt-cost="receipt.amount" :data-receipt-icon="receipt.icon">
          <span class="con-parl__info-receipt-key">{{ $t(receiptKey) }}</span>
          <span class="con-parl__info-src-sep" aria-hidden="true">·</span>
          <b class="con-parl__info-src-num">{{ receipt.amount }}</b>
          <i class="con-parl__info-src-mc" :class="receiptIconClass" aria-hidden="true"></i>
        </div>
      </div>
    </transition>
    </div>
    <!-- THE CONFIRM — the flow's own commit verb while the pick is open; a status once it is pressed. -->
    <div class="con-parl__cta con-parl__support-cta"
         :class="{
           'con-parl__cta--ready': ctaReady,
           'con-parl__cta--blocked': !flow.supportCommitted && reading !== undefined && !reading.available,
           'con-parl__cta--busy': flow.supportCommitted && flow.supportBeat !== 'done',
           'con-parl__cta--done': flow.supportBeat === 'done',
         }"
         data-parl-support-cta @click="submit()">
      <GamepadGlyph v-if="ctaReady" control="confirm" class="con-parl__cta-glyph" />
      <span class="con-parl__cta-label">{{ ctaText }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
/*
 * ══ THE SUPPORT-AREA MODE («САНКЦИИ», Turmoil Redux TR12 Party Sanctions) — the Parliament picks a PARTY'S
 *       POPULAR SUPPORT AREA instead of a resolution. The objects are the six party PLAQUES where they stand (the
 *       opposition row and the ruler's tile in the government): the cursor walks them and nothing moves; every
 *       plaque reads «N → 0» or its refusal in its own reserved row. THIS panel is the reading of the plaque under
 *       the cursor, in the voting area's own rect (the voting area recedes under it — nothing flies to or from
 *       there). A commits the card's play; the answer plays on this very stage: the area's cubes leave for the
 *       common supply one by one, then the card's Agenda step — one pose, no swap, then the surface leaves whole. ══
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, markRaw, nextTick, onBeforeUnmount, PropType, ref} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {SupportPromptMeta} from '@/common/models/PlayerInputModel';
import ConsoleSupportPlaces from '@/client/components/console/parliament/ConsoleSupportPlaces.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {setWorkspaceFramePhase} from '@/client/console/consoleWorkspaceStack';
import {$t, translateText} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {StagedReceipt} from '@/client/console/stagedPlay';
import {probeTick} from '@/client/console/probeTick';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {ParliamentBeat, scheduleParliamentBeat} from '@/client/console/parliament/parliamentBeat';
import {parliamentFlow, parliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {freezeParliamentFit} from '@/client/console/parliament/parliamentCardFit';
import {dropFlight} from '@/client/console/parliament/parliamentFlights';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {parliamentBrowseInspectRequest} from '@/client/console/parliament/parliamentNavigation';
import {stagedDoorVerb} from '@/client/console/parliament/parliamentCommands';
import {CARD_DOOR_RECEIPT} from '@/client/console/parliament/voteInfoModel';
import {agendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {AGENDA_BEAT_GAP_MS} from '@/client/console/parliament/agendaWalkDirector';
import {ParliamentPromptBridge, ParliamentViewVm, supportPickResponse} from '@/client/console/parliament/consoleParliamentModel';
import {
  supportCursorOrder, supportCursorStep, supportReadingOf, SupportReadingVm,
} from '@/client/console/parliament/supportPickModel';
import {
  landSupportDiscardCube, liftSupportDiscardCube, promiseSupportDiscard, settleSupportDiscard, supportDiscardFlow, supportDiscardStanding,
} from '@/client/console/parliament/supportDiscard';
import {flySupportDiscard} from '@/client/console/parliament/supportDiscardScene';
import {SUPPORT_DISCARD_RULE_KEY} from '@/client/components/console/parliament/consoleParliamentSupportModeModel';

/** The read beat after the outcome (no walk followed — the end of the track, reduced motion): the empty area is READ before the surface leaves. */
const SUPPORT_READ_MS = 520;

/**
 * THE SUPPORT-AREA MODE — the reading of the plaque under the cursor, the d-pad over the ring, the commit and
 * the answer's first beat (the cubes leaving the area). The Agenda step that follows is the section's ONE walk
 * (`play-walk` — the same director a card's walk and the sitting use), handed a continuation; the submit itself
 * is the section's funnel (`send`). Nothing here computes an area: every number is the server's row.
 */
defineOptions({name: 'ConsoleParliamentSupportMode'});
const props = defineProps({
  view: {type: Object as PropType<ParliamentViewVm>, required: true},
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  bridge: {type: Object as PropType<ParliamentPromptBridge>, required: true},
  /** A STAGED card door's locked receipt (the play's price, as the composer settled it). */
  cardReceipt: {type: Object as PropType<StagedReceipt | undefined>, default: undefined},
  stagedFlow: {type: String as PropType<'play' | 'action'>, default: 'play'},
});
const emit = defineEmits(['notice', 'inspect', 'inspect-source', 'send', 'flow-complete', 'play-walk']);

/** …and the card the press belonged to (the PARKED witness). */
const latchedCard = ref<CardName | undefined>(undefined);
const receiptKey = CARD_DOOR_RECEIPT;
const ruleKey = SUPPORT_DISCARD_RULE_KEY;
const flights = ref<Array<string>>([]);
let outcomeHold: AnimationHold | undefined;
let beat: ParliamentBeat | undefined;

const flow = parliamentFlow;
const meta = computed((): SupportPromptMeta | undefined => {
  return props.bridge.supportPick?.meta ?? parliamentFlow.supportMeta;
});
const staged = computed((): boolean => {
  return props.bridge.supportPick?.staged === true;
});
/** The ruler AS SHOWN (the overview's own answer — the tile standing in the government). */
const ruler = computed((): ReduxParty => {
  return parliamentHolds.rulerBefore ?? props.view.rulingParty;
});
const order = computed((): Array<ReduxParty> => {
  return supportCursorOrder(props.view.parties.map((p) => p.party), ruler.value);
});
/** The plaque under the cursor — the overview's own record (`zone` + `partyIndex`), so the tiles' focus reads it too. */
const cursor = computed((): ReduxParty | undefined => {
  if (parliamentFlow.zone === 'ruler') {
    return ruler.value;
  }
  return props.view.parties[parliamentFlow.partyIndex]?.party;
});
const reading = computed((): SupportReadingVm | undefined => {
  const snap = parliamentFlow.supportSnapshot;
  // Past the press the reading is the CHOSEN area as it stood at the press — the model has already emptied it.
  return supportReadingOf(meta.value, snap?.party ?? cursor.value);
});
/** The panel's places: what stands on the plaque right now (the press's cubes until each has lifted off). */
const placesFilled = computed((): number => {
  const r = reading.value;
  if (r === undefined) {
    return 0;
  }
  if (parliamentFlow.supportCommitted) {
    return supportDiscardStanding(r.party);
  }
  return r.current;
});
const placesOutgoing = computed((): number => {
  return parliamentFlow.supportCommitted ? 0 : (reading.value?.leaving ?? 0);
});
const receipt = computed((): StagedReceipt | undefined => {
  return staged.value || parliamentFlow.supportCommitted ? props.cardReceipt : undefined;
});
const receiptIconClass = computed((): string => {
  return iconClassFor(receipt.value?.icon);
});
const ctaReady = computed((): boolean => {
  return !parliamentFlow.supportCommitted && reading.value?.available === true;
});
const ctaText = computed((): string => {
  if (parliamentFlow.supportCommitted) {
    return translateText(parliamentFlow.supportBeat === 'done' ? 'Sanctions applied' : 'Performing…');
  }
  const r = reading.value;
  if (r !== undefined && !r.available) {
    return translateText(r.reason ?? 'The support area is empty');
  }
  return translateText(staged.value ? stagedDoorVerb(props.stagedFlow) : 'Select');
});

function emblemOf(party: ReduxParty): string {
  return partyEmblemUrl(party);
}
function accentOf(party: ReduxParty): string {
  return partyAccent(party);
}
/** Seat the cursor on `party` — the ruler is its own zone, the five of the row the `parties` zone (the overview's record). */
function moveTo(party: ReduxParty | undefined): void {
  if (party === undefined) {
    return;
  }
  if (party === ruler.value) {
    parliamentFlow.zone = 'ruler';
    return;
  }
  const index = props.view.parties.findIndex((p) => p.party === party);
  if (index >= 0) {
    parliamentFlow.zone = 'parties';
    parliamentFlow.partyIndex = index;
  }
}
/** The mode's own verbs: the d-pad walks the plaques, A commits, X inspects the plaque, L3 the source card (B — the section's). */
function handleIntent(intent: GamepadIntent): void {
  if (parliamentFlow.supportCommitted || parliamentFlow.stage !== 'support') {
    return;
  }
  if (intent.kind === 'nav') {
    // The bench the cursor left keeps its place in `partyIndex` while the dais is focused — ◀ returns there.
    moveTo(supportCursorStep(order.value, ruler.value, cursor.value, intent.dir, props.view.parties[parliamentFlow.partyIndex]?.party));
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickL') {
    const card = props.bridge.supportPick?.card;
    if (card !== undefined) {
      emit('inspect-source', card);
    }
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary':
    submit();
    return;
  case 'inspect': {
    const request = parliamentBrowseInspectRequest(props.view, parliamentRootEl());
    if (request !== undefined) {
      emit('inspect', request);
    }
    return;
  }
  default:
    return;
  }
}
/** A — the pick's commit: the area under the cursor, ADDRESSED to the card when the door is staged. Never auto. */
function submit(): void {
  const party = cursor.value;
  const readingNow = reading.value;
  if (parliamentFlow.stage !== 'support' || parliamentFlow.supportCommitted || party === undefined || readingNow === undefined) {
    return;
  }
  if (!readingNow.available) {
    emit('notice', translateText(readingNow.reason ?? 'The support area is empty'));
    return;
  }
  const response = supportPickResponse(props.bridge, party);
  if (response === undefined) {
    emit('notice', translateText('This option is no longer offered'));
    return;
  }
  parliamentFlow.supportMeta = meta.value;
  latchedCard.value = props.bridge.supportPick?.card;
  parliamentFlow.supportSnapshot = {party, current: readingNow.current};
  // A LIVE door's press promises its discard here; a STAGED door's is promised by the shell's commit (the same
  // funnel every staged party tail goes through), so a refused play can never leave a promise behind.
  if (!staged.value) {
    promiseSupportDiscard({party, ...(latchedCard.value === undefined ? {} : {card: latchedCard.value})});
  }
  // FROM THE PRESS TO THE LEAVE nothing but text, the confirm's state and the flights may change (law 8).
  freezeParliamentFit(true);
  emit('send', {response, from: 'support'});
}
/**
 * THE ANSWER IS IN (the section's answer-key watcher, post-flush). Three honest outcomes:
 *  · LANDED — the chosen area shrank: its cubes leave on this stage, then the card's Agenda step;
 *  · RE-ASKED — the card's own pick stands LIVE again: this very mode BECOMES that door, in place (the
 *    cursor kept, B «Свернуть», the crumb amber) — never a close followed by an open;
 *  · PARKED — the play is real but its answer waits behind another prompt: nothing landed, nothing flies,
 *    the step leaves whole and the area empties with the ordinary update.
 */
function answerAfterSubmit(): void {
  const f = parliamentFlow;
  const snap = f.supportSnapshot;
  const pick = props.bridge.supportPick;
  if (pick !== undefined && pick.staged !== true) {
    f.stage = 'support';
    f.supportCommitted = false;
    f.supportLive = true;
    f.supportSnapshot = undefined;
    freezeParliamentFit(false);
    setWorkspaceFramePhase('parliament', 'committed');
    return;
  }
  const now = snap === undefined ? undefined : props.view.parties.find((p) => p.party === snap.party)?.support;
  if (snap !== undefined && (supportDiscardFlow.owed !== undefined || (now !== undefined && now < snap.current))) {
    playOutcome();
    return;
  }
  const card = latchedCard.value;
  // The COMMIT is real only once the play is on the table — or, for an ACTION's door, once the action is recorded
  // as used: an action's card is on the table the whole time, so tableau membership could never witness its commit
  // (the vote mode's own rule — a key moved by somebody else's update concluded the step under the commit in flight).
  const me = props.playerView.thisPlayer;
  const committed = card !== undefined && (props.stagedFlow === 'action' ? me.actionsThisGeneration.includes(card) : me.tableau.some((c) => c.name === card));
  if (staged.value && !committed) {
    // A key that moved for somebody else's reason while the staged commit is still on the wire: keep waiting.
    return;
  }
  f.stage = 'support';
  f.supportCommitted = true;
  f.supportBeat = 'done';
  emit('flow-complete', 'support');
}
/** LANDED: the stage plays the answer in place — the cubes, then the Agenda step, then the surface leaves whole. */
function playOutcome(): void {
  const f = parliamentFlow;
  f.stage = 'support';
  f.supportCommitted = true;
  f.supportBeat = 'discard';
  setWorkspaceFramePhase('parliament', 'executing');
  outcomeHold?.release();
  const hold = beginAnimationHold('parliament-support-discard', {
    maxHoldMs: 4000 + 900 * (supportDiscardFlow.owed?.count ?? 0),
    // THE CEILING ENDS THE DISCARD, not only its count: the cubes still in the air are dropped where the model has
    // them and the flow goes on by its own hand (`afterDiscard` — the Agenda step of the card, or the read).
    expire: () => {
      if (outcomeHold !== hold || parliamentFlow.supportBeat !== 'discard') {
        return;
      }
      console.warn('[parliament] support discard: outlived its ceiling — ended');
      flights.value.forEach((id) => dropFlight(id, {silent: true}));
      flights.value = [];
      settleSupportDiscard();
      afterDiscard();
    },
  });
  outcomeHold = markRaw(hold);
  void nextTick(() => probeTick(() => flyDiscard()));
}
function flyDiscard(): void {
  const owed = supportDiscardFlow.owed;
  const root = parliamentRootEl();
  if (owed === undefined || root === undefined) {
    settleSupportDiscard();
    afterDiscard();
    return;
  }
  flights.value = flySupportDiscard(root, owed.party, owed.count, {
    onLifted: () => liftSupportDiscardCube(),
    onLanded: () => landSupportDiscardCube(),
    onDegraded: (why) => {
      supportDiscardFlow.degraded = why;
      console.warn(`[parliament] ${why} — settled without a flight`);
    },
    onDone: () => {
      flights.value.forEach((id) => dropFlight(id));
      flights.value = [];
      settleSupportDiscard();
      afterDiscard();
    },
  });
}
/** The cubes are home. A breath, then the card's Agenda step on the SAME pose — or the read, when the track had none. */
function afterDiscard(): void {
  if (parliamentFlow.supportBeat !== 'discard') {
    return;
  }
  outcomeHold?.release();
  outcomeHold = undefined;
  beat?.kill();
  beat = scheduleParliamentBeat(AGENDA_BEAT_GAP_MS, () => {
    beat = undefined;
    if (agendaWalkFlow.owed !== undefined && !agendaWalkFlow.live) {
      parliamentFlow.supportBeat = 'walk';
      emit('play-walk', () => finish());
      return;
    }
    parliamentFlow.supportBeat = 'read';
    beat = scheduleParliamentBeat(SUPPORT_READ_MS, () => {
      beat = undefined;
      finish();
    });
  });
}
/** Everything has landed and been read: the flow ends by its own hand (the shell takes the step and its host down as ONE surface). */
function finish(): void {
  if (parliamentFlow.supportBeat === 'done') {
    return;
  }
  parliamentFlow.supportBeat = 'done';
  emit('flow-complete', 'support');
}
/**
 * THE QUESTION DOOR folds this FINISHED mode back to the overview (wait graph R1 — the conclusion held the frame for
 * a question the overview opens): every beat cut, the fit thawed, the latch let go; the section then closes the stage.
 * A mode still at work is never closed here.
 */
function closeFinished(): void {
  if (parliamentFlow.supportBeat !== 'done') {
    return;
  }
  stopOutcome();
  latchedCard.value = undefined;
  freezeParliamentFit(false);
}
/** Cut every beat of this mode (the section unmounts): the flights land in their final poses, the holds let go. */
function stopOutcome(): void {
  beat?.kill();
  beat = undefined;
  // SILENT: their touchdowns would play the rest of the discard on a mode that is going (settled below by name).
  flights.value.forEach((id) => dropFlight(id, {silent: true}));
  flights.value = [];
  outcomeHold?.release();
  outcomeHold = undefined;
  settleSupportDiscard();
}

onBeforeUnmount(() => {
  stopOutcome();
});
// What `ConsoleParliamentSection` reaches through its `ref="supportMode"`: `answerAfterSubmit()` and `handleIntent()` by
// name, and `closeFinished()` through the `refs` of its port — `foldFinishedStage` (`consoleParliamentSectionLogic.ts`)
// calls it on whichever of the three modes stands finished (an optional call: a mode that did not expose it would be
// folded without its fit thawed, and nothing would complain).
defineExpose({answerAfterSubmit, handleIntent, closeFinished});
</script>
