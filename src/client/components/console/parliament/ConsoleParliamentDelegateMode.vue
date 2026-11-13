<template>
  <div class="con-parl__delegate"
       :class="{
         'con-parl__delegate--committed': flow.delegateCommitted,
         'con-parl__delegate--live': flow.delegateLive,
       }"
       data-parl-delegate-mode
       :data-delegate-beat="flow.delegateBeat || undefined"
       :data-delegate-staged="staged ? '' : undefined"
       :data-delegate-source="meta?.source">
    <div class="con-parl__delegate-stage">
      <transition name="con-parl-xfade">
        <div v-if="reading !== undefined" :key="readingKey" class="con-parl__delegate-body"
             data-parl-delegate-reading
             :data-delegate-place="reading.place"
             :data-delegate-party="reading.party"
             :data-delegate-owner="reading.owner"
             :data-delegate-returns="reading.returnsTo"
             :data-delegate-sole="reading.sole ? '' : undefined">
          <div class="con-parl__delegate-who">
            <span class="con-parl__delegate-figure" aria-hidden="true">
              <PlayerDelegate v-if="reading.owner !== 'neutral'" :color="reading.owner" :size="figure" :glow="false" />
              <PlayerDelegate v-else color="neutral" steel :size="figure" :glow="false" />
            </span>
            <span class="con-parl__delegate-id">
              <span class="con-parl__info-kicker con-parl__delegate-kicker">{{ $t(kickerKey) }}</span>
              <b class="con-parl__delegate-name" data-parl-delegate-name>{{ ownerName(reading.owner) }}</b>
              <span class="con-parl__delegate-place">
                <img class="con-parl__delegate-emblem" :src="emblemOf(reading.party)" alt="" />
                <span data-parl-delegate-from>{{ placeLine }}</span>
              </span>
              <span class="con-parl__delegate-dest" data-parl-delegate-dest>
                <span class="con-parl__fact-arrow" aria-hidden="true">→</span>{{ destLine }}
              </span>
              <!-- AN EXCHANGE (TR74): the second half of the one operation — the player's own figure comes from the reserve
                   and takes the place. Its own row, its own figure: «уходит» above, «приходит» here. -->
              <span v-if="reading.arrives !== undefined" class="con-parl__delegate-arrive" data-parl-delegate-arrives :data-delegate-arrives="reading.arrives">
                <PlayerDelegate class="con-parl__delegate-arrive-figure" :color="reading.arrives" :size="factFigure" :glow="false" />
                <span>{{ arriveLine }}</span>
              </span>
              <span v-if="reading.sole" class="con-parl__delegate-sole" data-seeded-mark>{{ $t('The only target') }}</span>
            </span>
          </div>
          <div class="con-parl__facts con-parl__delegate-facts" data-parl-delegate-facts>
            <ConsoleVoteFactRow v-for="fact in facts" :key="fact.id + ':' + fact.before.key" :fact="fact" :figurePx="factFigure" />
          </div>
          <!-- THE RECEIPT of a staged card door: the card's price as the composer settled it — LOCKED here. -->
          <div v-if="receipt !== undefined" class="con-parl__info-receipt con-parl__delegate-receipt" data-parl-delegate-receipt
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
    <div class="con-parl__cta con-parl__delegate-cta"
         :class="{
           'con-parl__cta--ready': ctaReady,
           'con-parl__cta--busy': flow.delegateCommitted && flow.delegateBeat !== 'done',
           'con-parl__cta--done': flow.delegateBeat === 'done',
         }"
         data-parl-delegate-cta @click="submit()">
      <GamepadGlyph v-if="ctaReady" control="confirm" class="con-parl__cta-glyph" />
      <span class="con-parl__cta-label">{{ ctaText }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
/*
 * ══ THE DELEGATE MODE («ИЗГНАНИЕ», Turmoil Redux TR72 Banned Delegate:redux) — the Parliament picks ONE FIGURE off
 *       the table. The objects are the figures where they stand: the three bills' ribbons (one stop per owner — the
 *       owner's LATEST figure is the one that leaves) and the plaques' support places; the cursor walks them and nothing
 *       moves (the bills stay on the table, the plaques on their benches — every target in view). THIS panel is the
 *       reading of the figure under the cursor, standing over the CAREER's row (the one part of the chamber the pick is
 *       not about). A commits the card's play; the answer plays on this very stage: the figure is taken off its place
 *       and carried home — its owner's reserve or the common supply — one pose, no swap, then the surface leaves whole. ══
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, markRaw, nextTick, onBeforeUnmount, PropType, ref} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {DelegatePromptMeta} from '@/common/models/PlayerInputModel';
import {DelegateOwner, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleVoteFactRow from '@/client/components/console/parliament/ConsoleVoteFactRow.vue';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {setWorkspaceFramePhase} from '@/client/console/consoleWorkspaceStack';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {StagedReceipt} from '@/client/console/stagedPlay';
import {probeTick} from '@/client/console/probeTick';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {ParliamentBeat, scheduleParliamentBeat} from '@/client/console/parliament/parliamentBeat';
import {parliamentFlow, parliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {freezeParliamentFit} from '@/client/console/parliament/parliamentCardFit';
import {dropFlight} from '@/client/console/parliament/parliamentFlights';
import {ParliamentInspectRequest} from '@/client/console/parliament/parliamentInspect';
import {stagedDoorVerb} from '@/client/console/parliament/parliamentCommands';
import {CARD_DOOR_RECEIPT, VoteFactVm} from '@/client/console/parliament/voteInfoModel';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {delegatePickResponse, ParliamentPromptBridge, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {
  delegateCursorStep, delegateFactsOf, DelegateReadingVm, delegateReadingOf, delegateRing, DelegateStop, delegateStopKey, DelegateTableVm,
} from '@/client/console/parliament/delegatePickModel';
import {
  delegateRemovalFlow, delegateRemovalSupportStanding, landExchangedDelegate, landRemovedDelegate, liftExchangedDelegate, liftRemovedDelegate,
  settleDelegateRemoval,
} from '@/client/console/parliament/delegateRemoval';
import {flyExchangedDelegate, flyRemovedDelegate} from '@/client/console/parliament/delegateRemovalScene';
import {supportCursorOrder} from '@/client/console/parliament/supportPickModel';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';

/** The read beat after the figure has landed home — the table without it is READ before the surface leaves. */
const DELEGATE_READ_MS = 520;

/**
 * THE DELEGATE MODE — the reading of the figure under the cursor, the d-pad over the ring, the commit and the answer
 * (the figure carried home). The submit itself is the section's funnel (`send`). Nothing here computes a forecast:
 * every line is the server's row (`delegatePrompt.targets`).
 */
defineOptions({name: 'ConsoleParliamentDelegateMode'});
const props = defineProps({
  view: {type: Object as PropType<ParliamentViewVm>, required: true},
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  bridge: {type: Object as PropType<ParliamentPromptBridge>, required: true},
  /** A STAGED card door's locked receipt (the play's price, as the composer settled it). */
  cardReceipt: {type: Object as PropType<StagedReceipt | undefined>, default: undefined},
  stagedFlow: {type: String as PropType<'play' | 'action'>, default: 'play'},
});
const emit = defineEmits(['notice', 'inspect', 'inspect-source', 'send', 'flow-complete']);

const latchedCard = ref<CardName | undefined>(undefined);
const receiptKey = CARD_DOOR_RECEIPT;
const flight = ref<string | undefined>(undefined);
let outcomeHold: AnimationHold | undefined;
let beat: ParliamentBeat | undefined;

const flow = parliamentFlow;
const meta = computed((): DelegatePromptMeta | undefined => {
  return props.bridge.delegatePick?.meta ?? parliamentFlow.delegateMeta;
});
const staged = computed((): boolean => {
  return props.bridge.delegatePick?.staged === true;
});
/** The table as the cursor walks it — the bills as shown, the plaques in the order they stand. */
const table = computed((): DelegateTableVm => {
  const ruler = parliamentHolds.rulerBefore ?? props.view.rulingParty;
  return {
    slots: props.view.slots.map((slot) => ({party: slot.party, votes: slot.votes})),
    areaOrder: supportCursorOrder(props.view.parties.map((p) => p.party), ruler),
  };
});
const ring = computed((): Array<DelegateStop> => {
  return delegateRing(meta.value, table.value);
});
const cursorStop = computed((): DelegateStop | undefined => {
  return ring.value[parliamentFlow.delegateCursor] ?? ring.value[0];
});
const reading = computed((): DelegateReadingVm | undefined => {
  const snap = parliamentFlow.delegateSnapshot;
  // Past the press the reading is the CHOSEN figure as the server projected it at the press.
  // Past the press the reading is the CHOSEN figure, not a cursor: «Единственная цель» is a cursor's mark — never
  // derived from the ring the ANSWER has already reshaped (an exchange that took one of two figures left a ring of one).
  if (snap !== undefined) {
    const chosen = delegateReadingOf({zone: snap.place === 'support' ? 'areas' : 'table', target: snap}, ring.value.length);
    return chosen === undefined ? undefined : {...chosen, sole: false};
  }
  return delegateReadingOf(cursorStop.value, ring.value.length);
});
const readingKey = computed((): string => {
  const r = reading.value;
  return r === undefined ? '' : delegateStopKey({target: {place: r.place, party: r.party, owner: r.owner} as DelegateStop['target']});
});
const facts = computed((): Array<VoteFactVm> => {
  const r = reading.value;
  return r === undefined ? [] : delegateFactsOf(r, {
    owner: (owner) => ownerName(owner),
    resolution: (party) => props.view.slots.find((slot) => slot.party === party)?.resolution?.text.name,
  });
});
const kickerKey = computed((): string => {
  return parliamentFlow.delegateCommitted ? 'Leaves the table' : 'Delegate';
});
const placeLine = computed((): string => {
  const r = reading.value;
  if (r === undefined) {
    return '';
  }
  if (r.place === 'support') {
    return translateTextWithParams('From the Popular Support of «${0}»', [translateText(partyNameKey(r.party))]);
  }
  const name = props.view.slots.find((slot) => slot.party === r.party)?.resolution?.text.name;
  return translateTextWithParams('From the resolution «${0}»', [translateText(name ?? partyNameKey(r.party))]);
});
const destLine = computed((): string => {
  const r = reading.value;
  if (r === undefined) {
    return '';
  }
  return r.returnsTo === 'reserve' && r.owner !== 'neutral' ?
    translateTextWithParams('To the reserve of ${0}', [ownerName(r.owner)]) :
    translateText('To the common supply');
});
/** AN EXCHANGE's arriving row: «Ваш делегат из резерва → на «R»». */
const arriveLine = computed((): string => {
  const r = reading.value;
  if (r === undefined || r.arrives === undefined) {
    return '';
  }
  const name = props.view.slots.find((slot) => slot.party === r.party)?.resolution?.text.name;
  return translateTextWithParams('Your delegate from the reserve → onto «${0}»', [translateText(name ?? partyNameKey(r.party))]);
});
/** The pick EXCHANGES the figure (TR74) rather than removing it — the verbs follow the marker. */
const exchange = computed((): boolean => {
  return meta.value?.source === 'exchange';
});
const figure = computed((): number => {
  return delegateFigurePx(52);
});
const factFigure = computed((): number => {
  return delegateFigurePx(18);
});
const receipt = computed((): StagedReceipt | undefined => {
  return staged.value || parliamentFlow.delegateCommitted ? props.cardReceipt : undefined;
});
const receiptIconClass = computed((): string => {
  return iconClassFor(receipt.value?.icon);
});
const ctaReady = computed((): boolean => {
  return !parliamentFlow.delegateCommitted && reading.value !== undefined;
});
const ctaText = computed((): string => {
  if (parliamentFlow.delegateCommitted) {
    return translateText(parliamentFlow.delegateBeat !== 'done' ? 'Performing…' : exchange.value ? 'Delegate recruited' : 'Delegate removed');
  }
  return translateText(staged.value ? stagedDoorVerb(props.stagedFlow) : exchange.value ? 'Recruit delegate' : 'Remove delegate');
});

function ownerName(owner: DelegateOwner): string {
  if (owner === 'neutral') {
    return translateText('Neutral');
  }
  return props.playerView.players.find((p) => p.color === owner)?.name ?? owner;
}
function emblemOf(party: PartyName): string {
  return partyEmblemUrl(party as ReduxParty);
}
/** X — the object the figure stands on: its bill, or its party's plaque. */
function inspectRequest(): ParliamentInspectRequest | undefined {
  const stop = cursorStop.value;
  const root = parliamentRootEl();
  if (stop === undefined) {
    return undefined;
  }
  const party = stop.target.party as ReduxParty;
  if (stop.zone === 'table') {
    const slots = props.view.slots;
    const index = slots.findIndex((slot) => slot.party === party);
    if (index < 0) {
      return undefined;
    }
    const instance = slots[index].instance;
    return {
      kind: 'resolution', ids: slots.map((s) => s.resolutionId), index,
      origin: () => root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${instance}"] .pcard`) ?? null,
    };
  }
  return {
    kind: 'party', party,
    origin: () => root?.querySelector<HTMLElement>(`[data-parl-support="${party}"]`)?.closest<HTMLElement>('.con-pseal') ?? null,
  };
}
/** The mode's own verbs: the d-pad walks the figures, A commits, X inspects what the figure stands on, L3 the source card (B — the section's). */
function handleIntent(intent: GamepadIntent): void {
  if (parliamentFlow.delegateCommitted || parliamentFlow.stage !== 'delegate') {
    return;
  }
  if (intent.kind === 'nav') {
    const next = delegateCursorStep(ring.value, parliamentFlow.delegateCursor, intent.dir);
    if (next >= 0) {
      parliamentFlow.delegateCursor = next;
    }
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickL') {
    const card = props.bridge.delegatePick?.card;
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
    const request = inspectRequest();
    if (request !== undefined) {
      emit('inspect', request);
    }
    return;
  }
  default:
    return;
  }
}
/** A — the pick's commit: the figure under the cursor, ADDRESSED to the card when the door is staged. Never auto. */
function submit(): void {
  const stop = cursorStop.value;
  if (parliamentFlow.stage !== 'delegate' || parliamentFlow.delegateCommitted || stop === undefined) {
    return;
  }
  const response = delegatePickResponse(props.bridge, stop.target);
  if (response === undefined) {
    emit('notice', translateText('This option is no longer offered'));
    return;
  }
  parliamentFlow.delegateMeta = meta.value;
  latchedCard.value = props.bridge.delegatePick?.card;
  parliamentFlow.delegateSnapshot = stop.target;
  // FROM THE PRESS TO THE LEAVE nothing but text, the confirm's state and the flight may change (law 8).
  freezeParliamentFit(true);
  emit('send', {response, from: 'delegate'});
}
/**
 * THE ANSWER IS IN (the section's answer-key watcher, post-flush). Three honest outcomes:
 *  · LANDED — the server's removal record arrived (the apply block owed its flight): the figure is carried home;
 *  · RE-ASKED — the card's own pick stands LIVE again: this very mode BECOMES that door, in place;
 *  · PARKED — the play is real but its answer waits behind another prompt: nothing flies, the step leaves whole.
 */
function answerAfterSubmit(): void {
  const f = parliamentFlow;
  const pick = props.bridge.delegatePick;
  if (pick !== undefined && pick.staged !== true) {
    f.stage = 'delegate';
    f.delegateCommitted = false;
    f.delegateLive = true;
    f.delegateSnapshot = undefined;
    freezeParliamentFit(false);
    setWorkspaceFramePhase('parliament', 'committed');
    return;
  }
  if (delegateRemovalFlow.owed !== undefined) {
    playOutcome();
    return;
  }
  const card = latchedCard.value;
  // …the vote mode's rule: an ACTION's door commits when the action is recorded as used (its card never leaves the table).
  const me = props.playerView.thisPlayer;
  const committed = card === undefined || (props.stagedFlow === 'action' ? me.actionsThisGeneration.includes(card) : me.tableau.some((c) => c.name === card));
  if (staged.value && !committed) {
    // A key that moved for somebody else's reason while the staged commit is still on the wire: keep waiting.
    return;
  }
  f.stage = 'delegate';
  f.delegateCommitted = true;
  f.delegateBeat = 'done';
  emit('flow-complete', 'delegate');
}
/** LANDED: the stage plays the answer in place — the figure carried home, a read, then the surface leaves whole. */
function playOutcome(): void {
  const f = parliamentFlow;
  f.stage = 'delegate';
  f.delegateCommitted = true;
  f.delegateBeat = 'flight';
  setWorkspaceFramePhase('parliament', 'executing');
  outcomeHold?.release();
  const hold = beginAnimationHold('parliament-delegate-removal', {
    maxHoldMs: 4000,
    // THE CEILING ENDS THE CARRY, not only its count: the figure (and the second one of an exchange) is dropped where
    // the model has it, and the flow goes on by its own hand — the read, then the leave (`afterFlight`).
    expire: () => {
      if (outcomeHold !== hold || parliamentFlow.delegateBeat !== 'flight') {
        return;
      }
      console.warn('[parliament] delegate removal: outlived its ceiling — ended');
      if (flight.value !== undefined) {
        dropFlight(flight.value, {silent: true});
        flight.value = undefined;
      }
      settleDelegateRemoval();
      afterFlight();
    },
  });
  outcomeHold = markRaw(hold);
  void nextTick(() => probeTick(() => fly()));
}
function fly(): void {
  const owed = delegateRemovalFlow.owed;
  const root = parliamentRootEl();
  if (owed === undefined || root === undefined) {
    settleDelegateRemoval();
    afterFlight();
    return;
  }
  const standing = owed.place === 'support' ? (props.view.parties.find((p) => p.party === owed.party)?.support ?? 0) + delegateRemovalSupportStanding(owed.party) : 0;
  flight.value = flyRemovedDelegate(root, owed, standing, {
    onLifted: () => liftRemovedDelegate(),
    onLanded: () => {
      landRemovedDelegate();
      if (flight.value !== undefined) {
        dropFlight(flight.value);
        flight.value = undefined;
      }
      if (owed.exchange !== undefined) {
        // AN EXCHANGE: the same phrase goes on at once — the player's own figure from the reserve onto the place.
        flyArrival();
        return;
      }
      settleDelegateRemoval();
      afterFlight();
    },
    onDegraded: (why) => confess(why),
  });
}
/** THE EXCHANGE'S SECOND MOVE (TR74): the player's figure off their reserve stack, set down where the neutral one stood. */
function flyArrival(): void {
  const owed = delegateRemovalFlow.owed;
  const root = parliamentRootEl();
  if (owed === undefined || root === undefined) {
    settleDelegateRemoval();
    afterFlight();
    return;
  }
  flight.value = flyExchangedDelegate(root, owed, {
    onLifted: () => liftExchangedDelegate(),
    onLanded: () => {
      landExchangedDelegate();
      if (flight.value !== undefined) {
        dropFlight(flight.value);
        flight.value = undefined;
      }
      settleDelegateRemoval();
      afterFlight();
    },
    onDegraded: (why) => confess(why),
  });
}
/** A flight that could not be measured — CONFESSED on the section root, then the figure simply lands. */
function confess(why: string): void {
  delegateRemovalFlow.degraded = why;
  console.warn(`[parliament] ${why} — settled without a flight`);
}
/** The figure is home: the table without it is READ, then the flow ends by its own hand. */
function afterFlight(): void {
  if (parliamentFlow.delegateBeat !== 'flight') {
    return;
  }
  outcomeHold?.release();
  outcomeHold = undefined;
  parliamentFlow.delegateBeat = 'read';
  beat?.kill();
  beat = scheduleParliamentBeat(DELEGATE_READ_MS, () => {
    beat = undefined;
    finish();
  });
}
function finish(): void {
  if (parliamentFlow.delegateBeat === 'done') {
    return;
  }
  parliamentFlow.delegateBeat = 'done';
  emit('flow-complete', 'delegate');
}
/**
 * THE QUESTION DOOR folds this FINISHED mode back to the overview (wait graph R1 — the conclusion held the frame for
 * a question the overview opens): every beat cut, the fit thawed, the latch let go; the section then closes the stage.
 * A mode still at work is never closed here.
 */
function closeFinished(): void {
  if (parliamentFlow.delegateBeat !== 'done') {
    return;
  }
  stopOutcome();
  latchedCard.value = undefined;
  freezeParliamentFit(false);
}
/** Cut every beat of this mode (the section unmounts): the flight lands in its final pose, the hold lets go. */
function stopOutcome(): void {
  beat?.kill();
  beat = undefined;
  if (flight.value !== undefined) {
    // SILENT: its touchdown would start the exchange's second carry or the read on a mode that is going.
    dropFlight(flight.value, {silent: true});
    flight.value = undefined;
  }
  outcomeHold?.release();
  outcomeHold = undefined;
  settleDelegateRemoval();
}

onBeforeUnmount(() => {
  stopOutcome();
});
// What `ConsoleParliamentSection` reaches through its `ref="delegateMode"`: `answerAfterSubmit()` and `handleIntent()` by
// name, and `closeFinished()` through the keyed read of its `foldFinishedStage` (`consoleParliamentSectionLogic.ts` —
// `self.refs[ref]`, 'delegateMode' one of its three keys; the optional call would read `undefined` and fold a finished
// mode without thawing the fit).
defineExpose({answerAfterSubmit, handleIntent, closeFinished});
</script>
