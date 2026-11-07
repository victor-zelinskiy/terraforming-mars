<template>
  <div class="con-bidding"
       :class="{'con-bidding--embedded': embedded, 'con-bidding--revealing': revealing, 'con-bidding--done': bidding.done, 'con-bidding--reading': reading}"
       role="dialog" :aria-label="$t('Bidding')" data-bidding-stage :data-bidding-turn="turnSeat" :data-bidding-done="bidding.done ? 'yes' : undefined">
    <!--
      «ТОРГИ» — the BIDDING of the «Тендеры» reward mode (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §6), hosted by the endgame
      workspace (its own scene after the ceremony) and by the campaign map (the same instance for a player who comes
      back later). ONE phrase on one stage:
        · the REGISTER stands at the left; the dealt lots arrive from it face-down, one after another, then TURN in
          place left to right — the first time anybody sees what is at stake (a one-shot cinematic, played ONCE per
          bidding on this client, never on a reload);
        · the PICK ORDER strip above the table: seat cubes in standings order with their place, a «жребий» tag inside
          every tie, the last place «без тендера» (nothing disappears — the one who gets nothing is said);
        · the picks go IN TURN: the turn seat wears a kant; the viewer's own pick is A on an open lot (X opens the
          reader); a rival's and the bot's picks arrive by the campaign's push and are PRESENTED one by one — the lot
          receives the taker's stamp; the viewer never sees two things settle at once;
        · every state is MATERIAL: a kant, a stamp, a word — never a glow.
      The host owns the ONE command bar (the scene publishes its verbs through `tenderBiddingUi`) and routes the pad in
      through `handleIntent`. The server is the truth: `bidding` is the model's, the scene decides nothing.
    -->
    <div class="con-bidding__shade" aria-hidden="true"></div>
    <div class="con-bidding__stage">
      <ConsoleWsHead class="con-bidding__head" :root="root" :subject="missionLabel" subject-raw stage="Bidding" :committed="bidding.done" />

      <div class="con-bidding__order" data-bidding-order>
        <span class="con-bidding__order-cap">{{ $t('Pick order') }}</span>
        <span v-for="(entry, i) in orderRows" :key="entry.seat"
              class="con-bidding__seat"
              :class="{'con-bidding__seat--turn': entry.turn, 'con-bidding__seat--done': entry.done, 'con-bidding__seat--none': entry.none, 'con-bidding__seat--you': entry.you}"
              :data-bidding-seat="entry.seat" :data-bidding-lot="entry.lot ? 'yes' : undefined">
          <b class="con-bidding__seat-place">{{ i + 1 }}</b>
          <i class="con-bidding__seat-cube" :class="`player_bg_color_${entry.color}`" aria-hidden="true"></i>
          <span class="con-bidding__seat-name">{{ entry.name }}</span>
          <span v-if="entry.lot" class="con-bidding__seat-tag con-bidding__seat-tag--lot">{{ $t('Lot drawn') }}</span>
          <span v-else-if="entry.none" class="con-bidding__seat-tag">{{ $t('without a tender') }}</span>
        </span>
      </div>

      <div class="con-bidding__table">
        <div class="con-bidding__register" data-bidding-register>
          <div class="con-bidding__register-stack" aria-hidden="true"><i></i><i></i><i></i></div>
          <span class="con-bidding__register-cap">{{ $t('Tender register') }}</span>
        </div>
        <div class="con-bidding__row" data-bidding-row>
          <div v-for="(card, i) in bidding.offer" :key="card.instance"
               class="con-bidding__slot" :class="slotClass(card, i)" :style="{'--i': i}"
               :data-bidding-card="card.instance" :data-bidding-kind="card.id"
               :data-bidding-taken="card.takenBy" :data-bidding-withdrawn="card.withdrawn ? 'yes' : undefined"
               @animationend="onSlotAnimationEnd($event, card, i)">
            <div class="con-bidding__flip">
              <div class="con-bidding__back" aria-hidden="true"></div>
              <ConsoleTenderCard class="con-bidding__face" :id="card.id" :state="cardState(card)" :owner="ownerOf(card)" :focused="cursor === i && !revealing" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="reading && focusedCard !== undefined" class="con-bidding__reader" data-bidding-reader>
        <ConsoleTenderCard size="reader" :id="focusedCard.id" :state="cardState(focusedCard)" :owner="ownerOf(focusedCard)" />
      </div>

      <div class="con-bidding__foot">
        <span class="con-bidding__status" :class="{'con-bidding__status--yours': yourTurn && !revealing}" role="status" data-bidding-status>{{ statusText }}</span>
        <span v-if="error !== ''" class="con-bidding__error" data-bidding-error>{{ $t(error) }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CampaignSeat} from '@/common/campaign/CampaignTypes';
import {BiddingModel} from '@/common/campaign/CampaignModel';
import {BiddingOfferCard, biddingPickerCount, biddingTurnSeat} from '@/common/campaign/tenders';
import {Color} from '@/common/Color';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleTenderCard, {TenderCardState} from './ConsoleTenderCard.vue';
import {
  biddingRevealPlayed, markBiddingRevealPlayed, tenderBiddingUi,
} from '@/client/console/campaign/tenderBiddingUi';

const REVEAL_ABSORBER = 'tender-bidding-reveal';

type OrderRow = {seat: number, name: string, color: Color, you: boolean, turn: boolean, done: boolean, none: boolean, lot: boolean};

export default defineComponent({
  name: 'ConsoleTenderBidding',
  components: {ConsoleWsHead, ConsoleTenderCard},
  props: {
    bidding: {type: Object as PropType<BiddingModel>, required: true},
    seats: {type: Array as PropType<ReadonlyArray<CampaignSeat>>, required: true},
    youSeat: {type: Number as PropType<number | undefined>, default: undefined},
    /** «Миссия N» — the mission whose end this bidding closes (already in the player's language). */
    missionLabel: {type: String, required: true},
    /** The host's workspace root (i18n key). */
    root: {type: String, default: 'Campaign'},
    /** `campaignId:slot` — the reveal plays once per bidding on this client. */
    revealKey: {type: String, required: true},
    submitting: {type: Boolean, default: false},
    error: {type: String, default: ''},
    embedded: {type: Boolean, default: false},
  },
  emits: ['bid', 'back'],
  data() {
    return {
      cursor: 0,
      reading: false,
      revealing: false,
      /** Picks already PRESENTED here (instances) — a taken lot not in it is a pick still to be shown. */
      shown: new Set<string>(),
      /** The lot whose taking plays right now. */
      presenting: undefined as string | undefined,
      queue: [] as Array<string>,
      hold: undefined as AnimationHold | undefined,
      absorbOff: undefined as (() => void) | undefined,
    };
  },
  computed: {
    turnSeat(): number | undefined {
      return biddingTurnSeat(this.bidding);
    },
    yourTurn(): boolean {
      return !this.bidding.done && this.turnSeat !== undefined && this.turnSeat === this.youSeat;
    },
    orderRows(): Array<OrderRow> {
      const pickers = biddingPickerCount(this.bidding.order);
      return this.bidding.order.map((seat, i) => {
        const s = this.seats.find((x) => x.seat === seat);
        return {
          seat,
          name: s === undefined ? '' : participantDisplayName({name: s.name, isMarsBot: s.kind === 'bot'}),
          color: s?.color ?? ('neutral' as Color),
          you: seat === this.youSeat,
          turn: !this.bidding.done && i === this.bidding.pointer,
          done: i < this.bidding.pointer,
          none: i >= pickers,
          lot: this.bidding.lots.some((l) => l.seats.includes(seat)),
        };
      });
    },
    focusedCard(): BiddingOfferCard | undefined {
      return this.bidding.offer[this.cursor];
    },
    focusedOpen(): boolean {
      const card = this.focusedCard;
      return card !== undefined && card.takenBy === undefined && card.withdrawn !== true;
    },
    turnName(): string {
      const seat = this.turnSeat;
      const s = seat === undefined ? undefined : this.seats.find((x) => x.seat === seat);
      return s === undefined ? '' : participantDisplayName({name: s.name, isMarsBot: s.kind === 'bot'});
    },
    statusText(): string {
      if (this.revealing) {
        return translateText('The Register deals the table…');
      }
      if (this.bidding.done) {
        return translateText('The bidding is over');
      }
      if (this.yourTurn) {
        return translateText('Your pick');
      }
      return translateTextWithParams('${0} is picking…', [this.turnName]);
    },
    /** The verbs the host's ONE bar renders. */
    commands(): Array<ConsoleCommand> {
      if (this.revealing) {
        // A swallowed window is DECLARED — a disabled status, never an empty list.
        return [{control: 'confirm', label: 'Take the tender', enabled: false}];
      }
      if (this.reading) {
        return [{control: 'back', label: 'Close the reader', priority: 5}];
      }
      const cmds: Array<ConsoleCommand> = [];
      if (this.bidding.offer.length > 1) {
        cmds.push({control: 'dpadH', label: 'Choose'});
      }
      if (this.yourTurn) {
        cmds.push({control: 'confirm', label: 'Take the tender', enabled: this.focusedOpen && !this.submitting, highlight: true});
      }
      if (this.bidding.offer.length > 0) {
        cmds.push({control: 'secondary', label: 'Inspect the tender'});
      }
      cmds.push({control: 'back', label: 'Minimize', priority: 5});
      return cmds;
    },
  },
  watch: {
    'commands': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        tenderBiddingUi.commands = cmds;
      },
    },
    reading(on: boolean): void {
      tenderBiddingUi.reading = on;
    },
    // A pick that arrived (the viewer's own answer, a rival's push, the bot's instant pick) is PRESENTED — in turn.
    'bidding.offer': {
      deep: true,
      handler(): void {
        this.enqueueNewPicks();
      },
    },
    // The cursor rests on an OPEN lot once the turn is the viewer's.
    yourTurn(mine: boolean): void {
      if (mine && !this.focusedOpen) {
        const open = this.bidding.offer.findIndex((c) => c.takenBy === undefined && c.withdrawn !== true);
        if (open >= 0) {
          this.cursor = open;
        }
      }
    },
  },
  created() {
    // The decision is taken BEFORE the first render: the first painted frame already wears the reveal (never a
    // face-up frame before the deal), and a settled mount stands every past pick stamped from its first frame.
    const playsReveal = !this.bidding.done && this.bidding.offer.length > 0 &&
      !biddingRevealPlayed(this.revealKey) && !consoleReducedMotionActive();
    if (playsReveal) {
      markBiddingRevealPlayed(this.revealKey);
      this.revealing = true;
      tenderBiddingUi.revealing = true;
      // The owner's own end is the last lot's turn; the ceiling's expiry runs the same door.
      this.hold = beginAnimationHold('tender-bidding-reveal', {expire: () => this.endReveal()});
    } else {
      // Settled: every pick already made stands presented.
      for (const card of this.bidding.offer) {
        if (card.takenBy !== undefined) {
          this.shown.add(card.instance);
        }
      }
      // A played reveal with no cinematic (reduced motion / a return) still counts as seen.
      if (!this.bidding.done && this.bidding.offer.length > 0) {
        markBiddingRevealPlayed(this.revealKey);
      }
    }
    if (this.yourTurn && !this.focusedOpen) {
      const open = this.bidding.offer.findIndex((c) => c.takenBy === undefined && c.withdrawn !== true);
      this.cursor = Math.max(0, open);
    }
  },
  mounted() {
    this.absorbOff = registerInputAbsorber(REVEAL_ABSORBER, () => this.revealing);
  },
  beforeUnmount() {
    this.absorbOff?.();
    this.absorbOff = undefined;
    this.endReveal();
    tenderBiddingUi.commands = [];
    tenderBiddingUi.reading = false;
  },
  methods: {
    cardState(card: BiddingOfferCard): TenderCardState {
      if (card.withdrawn === true) {
        return 'withdrawn';
      }
      // A lot being presented keeps its open look until its stamp lands.
      return card.takenBy !== undefined && this.shown.has(card.instance) ? 'taken' : 'open';
    },
    ownerOf(card: BiddingOfferCard): {name: string, color: Color} | undefined {
      if (card.takenBy === undefined || !this.shown.has(card.instance)) {
        return undefined;
      }
      const s = this.seats.find((x) => x.seat === card.takenBy);
      return s === undefined ? undefined : {name: participantDisplayName({name: s.name, isMarsBot: s.kind === 'bot'}), color: s.color};
    },
    slotClass(card: BiddingOfferCard, i: number): Record<string, boolean> {
      return {
        'con-bidding__slot--reveal': this.revealing,
        'con-bidding__slot--taking': this.presenting === card.instance,
        'con-bidding__slot--taken': card.takenBy !== undefined && this.shown.has(card.instance),
        'con-bidding__slot--withdrawn': card.withdrawn === true,
        'con-bidding__slot--focused': this.cursor === i && !this.revealing,
      };
    },
    onSlotAnimationEnd(event: AnimationEvent, card: BiddingOfferCard, i: number): void {
      if (event.animationName === 'con-tender-flip' && i === this.bidding.offer.length - 1) {
        this.endReveal();
        return;
      }
      if (event.animationName === 'con-tender-taking' && this.presenting === card.instance) {
        this.shown.add(card.instance);
        this.presenting = undefined;
        this.pump();
      }
    },
    /** The reveal is over (its own last turn, the ceiling, the unmount) — idempotent. */
    endReveal(): void {
      if (!this.revealing) {
        return;
      }
      this.revealing = false;
      tenderBiddingUi.revealing = false;
      this.hold?.release();
      this.hold = undefined;
      this.enqueueNewPicks();
    },
    enqueueNewPicks(): void {
      for (const card of this.bidding.offer) {
        if (card.takenBy !== undefined && !this.shown.has(card.instance) &&
            this.presenting !== card.instance && !this.queue.includes(card.instance)) {
          this.queue.push(card.instance);
        }
      }
      this.pump();
    },
    /** One presentation at a time — the next pick plays after the previous stamp landed; reduced motion lands at once. */
    pump(): void {
      if (this.revealing || this.presenting !== undefined) {
        return;
      }
      const next = this.queue.shift();
      if (next === undefined) {
        return;
      }
      if (consoleReducedMotionActive()) {
        this.shown.add(next);
        this.pump();
        return;
      }
      this.presenting = next;
    },
    /** The host routes pad intents here. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (this.revealing) {
        noteInputAbsorbed(REVEAL_ABSORBER);
        return true;
      }
      if (intent.kind === 'nav') {
        if (this.reading) {
          return true;
        }
        const n = this.bidding.offer.length;
        if (n > 0 && (intent.dir === 'left' || intent.dir === 'right')) {
          const step = intent.dir === 'left' ? -1 : 1;
          this.cursor = Math.max(0, Math.min(n - 1, this.cursor + step));
        }
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        if (this.reading) {
          return true;
        }
        if (this.yourTurn && this.focusedOpen && !this.submitting && this.focusedCard !== undefined) {
          this.$emit('bid', this.focusedCard.instance);
        }
        return true;
      case 'inspect':
        if (this.focusedCard !== undefined) {
          this.reading = !this.reading;
        }
        return true;
      case 'back':
        if (this.reading) {
          this.reading = false;
          return true;
        }
        this.$emit('back');
        return true;
      default:
        return true;
      }
    },
  },
});
</script>
