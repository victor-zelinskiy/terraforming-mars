<template>
  <!-- ══ THE DELEGATE MODE («ИЗГНАНИЕ», Turmoil Redux TR72 Banned Delegate:redux) — the Parliament picks ONE FIGURE off
       the table. The objects are the figures where they stand: the three bills' ribbons (one stop per owner — the
       owner's LATEST figure is the one that leaves) and the plaques' support places; the cursor walks them and nothing
       moves (the bills stay on the table, the plaques on their benches — every target in view). THIS panel is the
       reading of the figure under the cursor, standing over the CAREER's row (the one part of the chamber the pick is
       not about). A commits the card's play; the answer plays on this very stage: the figure is taken off its place
       and carried home — its owner's reserve or the common supply — one pose, no swap, then the surface leaves whole. ══ -->
  <div class="con-parl__delegate"
       :class="{
         'con-parl__delegate--committed': flow.delegateCommitted,
         'con-parl__delegate--live': flow.delegateLive,
       }"
       data-parl-delegate-mode
       :data-delegate-beat="flow.delegateBeat || undefined"
       :data-delegate-staged="staged ? '' : undefined">
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
<script lang="ts">
import {defineComponent, PropType} from 'vue';
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
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
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
  delegateRemovalFlow, delegateRemovalSupportStanding, landRemovedDelegate, liftRemovedDelegate, settleDelegateRemoval,
} from '@/client/console/parliament/delegateRemoval';
import {flyRemovedDelegate} from '@/client/console/parliament/delegateRemovalScene';
import {supportCursorOrder} from '@/client/console/parliament/supportPickModel';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';

/** The read beat after the figure has landed home — the table without it is READ before the surface leaves. */
const DELEGATE_READ_MS = 520;

/**
 * THE DELEGATE MODE — the reading of the figure under the cursor, the d-pad over the ring, the commit and the answer
 * (the figure carried home). The submit itself is the section's funnel (`send`). Nothing here computes a forecast:
 * every line is the server's row (`delegatePrompt.targets`).
 */
export default defineComponent({
  name: 'ConsoleParliamentDelegateMode',
  components: {ConsoleVoteFactRow, GamepadGlyph, PlayerDelegate},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    bridge: {type: Object as PropType<ParliamentPromptBridge>, required: true},
    /** A STAGED card door's locked receipt (the play's price, as the composer settled it). */
    cardReceipt: {type: Object as PropType<StagedReceipt | undefined>, default: undefined},
    stagedFlow: {type: String as PropType<'play' | 'action'>, default: 'play'},
  },
  emits: ['notice', 'inspect', 'inspect-source', 'send', 'flow-complete'],
  data() {
    return {
      latchedCard: undefined as CardName | undefined,
      receiptKey: CARD_DOOR_RECEIPT,
      flight: undefined as string | undefined,
      outcomeHold: undefined as AnimationHold | undefined,
      beat: undefined as ParliamentBeat | undefined,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    meta(): DelegatePromptMeta | undefined {
      return this.bridge.delegatePick?.meta ?? parliamentFlow.delegateMeta;
    },
    staged(): boolean {
      return this.bridge.delegatePick?.staged === true;
    },
    /** The table as the cursor walks it — the bills as shown, the plaques in the order they stand. */
    table(): DelegateTableVm {
      const ruler = parliamentHolds.rulerBefore ?? this.view.rulingParty;
      return {
        slots: this.view.slots.map((slot) => ({party: slot.party, votes: slot.votes})),
        areaOrder: supportCursorOrder(this.view.parties.map((p) => p.party), ruler),
      };
    },
    ring(): Array<DelegateStop> {
      return delegateRing(this.meta, this.table);
    },
    cursorStop(): DelegateStop | undefined {
      return this.ring[parliamentFlow.delegateCursor] ?? this.ring[0];
    },
    reading(): DelegateReadingVm | undefined {
      const snap = parliamentFlow.delegateSnapshot;
      // Past the press the reading is the CHOSEN figure as the server projected it at the press.
      if (snap !== undefined) {
        return delegateReadingOf({zone: snap.place === 'support' ? 'areas' : 'table', target: snap}, Math.max(1, this.ring.length));
      }
      return delegateReadingOf(this.cursorStop, this.ring.length);
    },
    readingKey(): string {
      const r = this.reading;
      return r === undefined ? '' : delegateStopKey({target: {place: r.place, party: r.party, owner: r.owner} as DelegateStop['target']});
    },
    facts(): Array<VoteFactVm> {
      const r = this.reading;
      return r === undefined ? [] : delegateFactsOf(r, {
        owner: (owner) => this.ownerName(owner),
        resolution: (party) => this.view.slots.find((slot) => slot.party === party)?.resolution?.text.name,
      });
    },
    kickerKey(): string {
      return parliamentFlow.delegateCommitted ? 'Leaves the table' : 'Delegate';
    },
    placeLine(): string {
      const r = this.reading;
      if (r === undefined) {
        return '';
      }
      if (r.place === 'support') {
        return translateTextWithParams('From the Popular Support of «${0}»', [translateText(partyNameKey(r.party))]);
      }
      const name = this.view.slots.find((slot) => slot.party === r.party)?.resolution?.text.name;
      return translateTextWithParams('From the resolution «${0}»', [translateText(name ?? partyNameKey(r.party))]);
    },
    destLine(): string {
      const r = this.reading;
      if (r === undefined) {
        return '';
      }
      return r.returnsTo === 'reserve' && r.owner !== 'neutral' ?
        translateTextWithParams('To the reserve of ${0}', [this.ownerName(r.owner)]) :
        translateText('To the common supply');
    },
    figure(): number {
      return delegateFigurePx(34);
    },
    factFigure(): number {
      return delegateFigurePx(18);
    },
    receipt(): StagedReceipt | undefined {
      return this.staged || parliamentFlow.delegateCommitted ? this.cardReceipt : undefined;
    },
    receiptIconClass(): string {
      return iconClassFor(this.receipt?.icon);
    },
    ctaReady(): boolean {
      return !parliamentFlow.delegateCommitted && this.reading !== undefined;
    },
    ctaText(): string {
      if (parliamentFlow.delegateCommitted) {
        return translateText(parliamentFlow.delegateBeat === 'done' ? 'Delegate removed' : 'Performing…');
      }
      return translateText(this.staged ? stagedDoorVerb(this.stagedFlow) : 'Remove delegate');
    },
  },
  beforeUnmount() {
    this.stopOutcome();
  },
  methods: {
    ownerName(owner: DelegateOwner): string {
      if (owner === 'neutral') {
        return translateText('Neutral');
      }
      return this.playerView.players.find((p) => p.color === owner)?.name ?? owner;
    },
    emblemOf(party: PartyName): string {
      return partyEmblemUrl(party as ReduxParty);
    },
    /** X — the object the figure stands on: its bill, or its party's plaque. */
    inspectRequest(): ParliamentInspectRequest | undefined {
      const stop = this.cursorStop;
      const root = parliamentRootEl();
      if (stop === undefined) {
        return undefined;
      }
      const party = stop.target.party as ReduxParty;
      if (stop.zone === 'table') {
        const slots = this.view.slots;
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
    },
    /** The mode's own verbs: the d-pad walks the figures, A commits, X inspects what the figure stands on, L3 the source card (B — the section's). */
    handleIntent(intent: GamepadIntent): void {
      if (parliamentFlow.delegateCommitted || parliamentFlow.stage !== 'delegate') {
        return;
      }
      if (intent.kind === 'nav') {
        const next = delegateCursorStep(this.ring, parliamentFlow.delegateCursor, intent.dir);
        if (next >= 0) {
          parliamentFlow.delegateCursor = next;
        }
        return;
      }
      if (intent.kind === 'press' && intent.button === 'stickL') {
        const card = this.bridge.delegatePick?.card;
        if (card !== undefined) {
          this.$emit('inspect-source', card);
        }
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        this.submit();
        return;
      case 'inspect': {
        const request = this.inspectRequest();
        if (request !== undefined) {
          this.$emit('inspect', request);
        }
        return;
      }
      default:
        return;
      }
    },
    /** A — the pick's commit: the figure under the cursor, ADDRESSED to the card when the door is staged. Never auto. */
    submit(): void {
      const stop = this.cursorStop;
      if (parliamentFlow.stage !== 'delegate' || parliamentFlow.delegateCommitted || stop === undefined) {
        return;
      }
      const response = delegatePickResponse(this.bridge, stop.target);
      if (response === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        return;
      }
      parliamentFlow.delegateMeta = this.meta;
      this.latchedCard = this.bridge.delegatePick?.card;
      parliamentFlow.delegateSnapshot = stop.target;
      // FROM THE PRESS TO THE LEAVE nothing but text, the confirm's state and the flight may change (law 8).
      freezeParliamentFit(true);
      this.$emit('send', {response, from: 'delegate'});
    },
    /**
     * THE ANSWER IS IN (the section's answer-key watcher, post-flush). Three honest outcomes:
     *  · LANDED — the server's removal record arrived (the apply block owed its flight): the figure is carried home;
     *  · RE-ASKED — the card's own pick stands LIVE again: this very mode BECOMES that door, in place;
     *  · PARKED — the play is real but its answer waits behind another prompt: nothing flies, the step leaves whole.
     */
    answerAfterSubmit(): void {
      const f = parliamentFlow;
      const pick = this.bridge.delegatePick;
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
        this.playOutcome();
        return;
      }
      const card = this.latchedCard;
      const committed = card === undefined || this.playerView.thisPlayer.tableau.some((c) => c.name === card);
      if (this.staged && !committed) {
        // A key that moved for somebody else's reason while the staged commit is still on the wire: keep waiting.
        return;
      }
      f.stage = 'delegate';
      f.delegateCommitted = true;
      f.delegateBeat = 'done';
      this.$emit('flow-complete', 'delegate');
    },
    /** LANDED: the stage plays the answer in place — the figure carried home, a read, then the surface leaves whole. */
    playOutcome(): void {
      const f = parliamentFlow;
      f.stage = 'delegate';
      f.delegateCommitted = true;
      f.delegateBeat = 'flight';
      setWorkspaceFramePhase('parliament', 'executing');
      this.outcomeHold?.release();
      this.outcomeHold = beginAnimationHold('parliament-delegate-removal', {maxHoldMs: 4000});
      void this.$nextTick(() => probeTick(() => this.fly()));
    },
    fly(): void {
      const owed = delegateRemovalFlow.owed;
      const root = parliamentRootEl();
      if (owed === undefined || root === undefined) {
        settleDelegateRemoval();
        this.afterFlight();
        return;
      }
      const standing = owed.place === 'support' ? (this.view.parties.find((p) => p.party === owed.party)?.support ?? 0) + delegateRemovalSupportStanding(owed.party) : 0;
      this.flight = flyRemovedDelegate(root, owed, standing, {
        onLifted: () => liftRemovedDelegate(),
        onLanded: () => {
          landRemovedDelegate();
          if (this.flight !== undefined) {
            dropFlight(this.flight);
            this.flight = undefined;
          }
          settleDelegateRemoval();
          this.afterFlight();
        },
        onDegraded: (why) => {
          delegateRemovalFlow.degraded = why;
          console.warn(`[parliament] ${why} — settled without a flight`);
        },
      });
    },
    /** The figure is home: the table without it is READ, then the flow ends by its own hand. */
    afterFlight(): void {
      if (parliamentFlow.delegateBeat !== 'flight') {
        return;
      }
      this.outcomeHold?.release();
      this.outcomeHold = undefined;
      parliamentFlow.delegateBeat = 'read';
      this.beat?.kill();
      this.beat = scheduleParliamentBeat(DELEGATE_READ_MS, () => {
        this.beat = undefined;
        this.finish();
      });
    },
    finish(): void {
      if (parliamentFlow.delegateBeat === 'done') {
        return;
      }
      parliamentFlow.delegateBeat = 'done';
      this.$emit('flow-complete', 'delegate');
    },
    /** Cut every beat of this mode (the section unmounts): the flight lands in its final pose, the hold lets go. */
    stopOutcome(): void {
      this.beat?.kill();
      this.beat = undefined;
      if (this.flight !== undefined) {
        dropFlight(this.flight);
        this.flight = undefined;
      }
      this.outcomeHold?.release();
      this.outcomeHold = undefined;
      settleDelegateRemoval();
    },
  },
});
</script>
