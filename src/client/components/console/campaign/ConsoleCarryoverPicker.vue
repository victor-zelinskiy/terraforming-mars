<template>
  <!--
    «НАСЛЕДИЕ ПРОЕКТОВ» — the interlude's step: up to `limit` cards of the viewer's terminal hand travel into the next
    mission. P87 (the owner, 2026-11-01): it solved the hand's task in a language of its own — its own grid engine, its
    own slots and sockets, its own cursor frame — and looked bad on a big hand; putting a card back meant pressing an
    empty socket. It now stands on the HAND ALBUM'S CHASSIS:

      · ONE album (`foundation/ConsoleCardAlbum` — the hand's planner and LESS mixins): strict pages from the box,
        the ONE cursor grammar, LB / RB and the d-pad across the edge turn the page, the spine in the foot;
      · keeping is a TOGGLE IN PLACE, as the patent sale's: A on a card stands it in its own slot with a kant and its
        ordinal band («✓ В миссию 2 · 1»), A on it again lets it go — the same key on the same object; nothing leaves
        the album before the confirm, an empty socket does not exist as a concept;
      · the SEAT MANIFEST under the question line names what is kept (a label — never a second face), so a many-page
        hand reads its legacy without turning back;
      · ONE head (`ConsoleWsHead`): the host's root › the mission the cards travel into › НАСЛЕДИЕ ПРОЕКТОВ (cyan →
        amber once confirmed); the limit is the SEAT's (`limit`, the server's number — never a client constant).

    HOSTED ONLY BY THE CAMPAIGN MAP (standalone screen + the endgame's embedded map scene). Input arrives via
    `handleIntent`; the verbs render in the host's ONE command bar. RT confirms; a zero-card confirm over a real hand is
    ARMED first (the first RT warns, the second confirms; B disarms). X inspects in the ONE `consoleCardZoom` pipeline
    (A there is the same toggle). The ENTRY deal and the CONFIRM flight are the host's phrases around this surface
    (`dealIn` / `keptFaces`).

    PRIVACY: this surface only ever receives the VIEWER's own cards.
  -->
  <div class="con-carry" :class="{'con-carry--embedded': embedded, 'con-carry--confirmed': confirmed}"
       role="dialog" :aria-label="$t('Project legacy')" data-carry-stage>
    <div class="con-carry__shade" aria-hidden="true"></div>
    <div class="con-carry__stage">
      <ConsoleWsHead class="con-carry__head" :root="root" :subject="missionLabel" subject-raw
                     :stage="stage === 'tenders' ? 'Tenders' : 'Project legacy'" :committed="stage === 'album' && confirmed" />

      <!-- THE TENDERS stage (§16.1) — the portfolio stands FIRST when the seat holds tenders: the threshold's own place to
           ACTIVATE a legacy tender (A — the seat / the band open in the album right after), read it (X), move on (RT).
           Two layers of one step, never a swap: the album rests under the portfolio and returns the same nodes. -->
      <div v-if="hasTenders" v-show="stage === 'tenders'" class="con-carry__layer con-carry__layer--tenders" data-carry-tenders-stage>
        <ConsoleTenderPortfolio ref="portfolio" :entries="portfolioEntries" :focus="tenderFocus" place="threshold"
                                :armed="tenderConfirm" :busy="tenderBusy" embedded />
        <div class="con-carry__foot con-carry__foot--tenders">
          <span class="con-carry__status">
            <span v-if="tenderError !== ''" class="con-carry__status-err" data-carry-tender-error>{{ $t(tenderError) }}</span>
            <span v-else-if="portfolioCounts.open > 0" class="con-carry__status-hint">{{ $t('Tenders execute from here') }}</span>
          </span>
        </div>
      </div>

      <div class="con-carry__layer con-carry__layer--album" v-show="stage === 'album'" data-carry-album-stage>
      <!-- THE QUESTION LINE (the hand's own chassis): the ask on the left, the running summary on the right. -->
      <div class="con-hand__question con-carry__question" data-pick-question>
        <div class="con-hand__question-ask con-carry__ask">
          <span class="con-hand__question-text" data-carry-ask>{{ askText }}</span>
        </div>
        <span class="con-hand__salebar con-carry__summary" role="status" data-carry-summary>
          <span v-if="selected.length === 0" class="con-hand__salebar-item con-hand__salebar-item--zero">
            <span class="con-hand__salebar-label">{{ $t('Nothing selected') }}</span>
          </span>
          <template v-else>
            <span class="con-hand__salebar-item con-hand__salebar-item--gain">
              <b class="con-hand__salebar-num" data-carry-count>{{ keepingText }}</b>
            </span>
            <span class="con-hand__salebar-item">
              <span class="con-hand__salebar-label">{{ $t('free of charge') }}</span>
            </span>
          </template>
          <span v-if="preludeLimit > 0 && selectedPreludes.length > 0" class="con-hand__salebar-item con-hand__salebar-item--gain">
            <b class="con-hand__salebar-num" data-carry-prelude-summary>{{ preludeSummaryText }}</b>
          </span>
        </span>
      </div>

      <!-- THE SEAT MANIFEST — one place per seat of the limit: an empty seat is its number, a taken one its number and
           the card's NAME (a label, never a face — the face is the album's). -->
      <div v-if="limit > 0" class="con-carry__seats" data-carry-seats>
        <TransitionGroup name="con-carry-seat" tag="span" class="con-carry__seats-row">
          <span v-for="seat in seats" :key="'seat' + seat.n"
                class="con-carry__seat" :class="{'con-carry__seat--taken': seat.name !== undefined, 'con-carry__seat--tender': seat.tender === true}"
                :data-carry-seat="seat.n" :data-carry-seat-card="seat.name" :data-carry-seat-tender="seat.tender === true ? 'yes' : undefined">
            <b class="con-carry__seat-num">{{ seat.n }}</b>
            <span v-if="seat.name !== undefined" :key="seat.name" class="con-carry__seat-name">{{ $t(seat.name) }}</span>
            <!-- A seat a TENDER added («Расширенное наследие») says so — a tag, never a glow. -->
            <span v-if="seat.tender === true" class="con-carry__seat-tag">{{ $t('Tender') }}</span>
          </span>
        </TransitionGroup>
      </div>

      <!-- THE PRELUDE BAND — the «Тендеры» mode's «Продление программы»: the viewer's played preludes of the finished
           mission, up to `preludeLimit` of them travel into the finale and are played AGAIN. A strip above the album
           (↑ from the album's top row reaches it, ↓ returns), the same toggle-in-place grammar, the same X. -->
      <Transition name="con-carry-band">
      <div v-if="preludeLimit > 0" class="con-carry__preludes" :class="{'con-carry__preludes--active': zone === 'preludes'}" data-carry-preludes>
        <div class="con-carry__preludes-head">
          <span class="con-carry__preludes-ask" data-carry-prelude-ask>{{ preludeAskText }}</span>
          <b class="con-carry__preludes-count" data-carry-prelude-count>{{ selectedPreludes.length }} / {{ preludeLimit }}</b>
        </div>
        <div class="con-carry__preludes-row">
          <div v-for="(name, i) in eligiblePreludes" :key="name"
               class="con-carry__prelude"
               :class="{'con-carry__prelude--picked': selectedPreludes.includes(name), 'con-carry__prelude--focused': zone === 'preludes' && preludeCursor === i}"
               :data-carry-prelude="name" :data-carry-prelude-picked="selectedPreludes.includes(name) ? 'yes' : undefined"
               @click="onPreludeClick(i)">
            <Card :card="preludeCard(name)" lightweight :inert="true" />
            <span v-if="selectedPreludes.includes(name)" class="con-carry__prelude-band" aria-hidden="true">{{ preludeBandText }}</span>
          </div>
          <div v-if="eligiblePreludes.length === 0" class="con-carry__preludes-empty" v-i18n>No prelude was played in that mission — nothing to carry.</div>
        </div>
      </div>
      </Transition>

      <ConsoleCardAlbum v-if="eligible.length > 0"
                        ref="album"
                        class="con-carry__album"
                        :entries="entries"
                        :index="cursor"
                        :held-names="heldNames"
                        @pick="onCardClick"
                        @position="position = $event" />
      <div v-else class="con-carry__empty">
        <div class="con-carry__empty-mark" aria-hidden="true">—</div>
        <div class="con-carry__empty-text" v-i18n>No cards remained in your hand — the selection completes with nothing to carry.</div>
      </div>

      <!-- THE FOOT — the album spine (where it is) and ONE status line (what the step says now). -->
      <div class="con-carry__foot">
        <ConsoleAlbumSpine v-if="eligible.length > 0 && position !== undefined" variant="foot" :album="position"
                           @page="turnPage($event)" />
        <span class="con-carry__status">
          <!-- THE TERMINAL WARNING (§16.4): legacy tenders still executable — after the readiness the host may launch at
               any moment and the Committee buys them back. A conscious second press confirms anyway. -->
          <span v-if="armedTenders" class="con-carry__status-warn" data-carry-tender-warning>{{ tenderWarningText }}</span>
          <span v-else-if="armed" class="con-carry__status-warn" v-i18n>Nothing is selected — press again to continue WITHOUT a legacy.</span>
          <span v-else-if="notice !== ''" class="con-carry__status-warn" data-carry-notice>{{ $t(notice) }}</span>
          <span v-else-if="confirmed" class="con-carry__status-ok" v-i18n>Selection confirmed — it can be revised until the next mission launches.</span>
          <span v-else-if="error !== ''" class="con-carry__status-err">{{ $t(error) }}</span>
        </span>
      </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CloneFlightHandle, flyCardClones} from '@/client/console/cardFlight/cloneFlights';
import {closeConsoleCardZoom, consoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleCardAlbum, {CardAlbumEntry, CardAlbumPosition} from '@/client/components/console/foundation/ConsoleCardAlbum.vue';
import ConsoleAlbumSpine from '@/client/components/console/foundation/ConsoleAlbumSpine.vue';
import Card from '@/client/components/card/CardFace.vue';
import {carryoverAskText, carryoverBandText, carryoverPreludeAskText, carryoverSeats, CarryoverSeat} from '@/client/console/campaign/carryoverPicker';
import ConsoleTenderPortfolio from './ConsoleTenderPortfolio.vue';
import {CarryoverTenderModel} from '@/common/campaign/CampaignModel';
import {TENDER_COMPENSATION_MC, tenderDef} from '@/common/campaign/tenders';
import {TenderPortfolioEntry, tenderCardStateOf, tenderPortfolio, tenderPortfolioCounts, tenderPortfolioName} from '@/client/console/campaign/tenderPortfolio';
import {tenderZoomEntry} from '@/client/components/card/cardZoomTypes';

/** The stamp's beat before the album takes the screen to show the seat / the band it opened. */
const TENDER_STAGE_FLIP_MS = 760;

type AlbumApi = {
  step(from: number, dir: 'left' | 'right' | 'up' | 'down'): number,
  jumpPage(from: number, dir: 1 | -1): number,
  slotEl(name: string): HTMLElement | null,
  faceEl(name: string): HTMLElement | null,
  activePageNames(): Array<string>,
};

/** How long a refusal stays named on the status line. */
const NOTICE_MS = 2400;

export default defineComponent({
  name: 'ConsoleCarryoverPicker',
  components: {ConsoleWsHead, ConsoleCardAlbum, ConsoleAlbumSpine, Card, ConsoleTenderPortfolio},
  props: {
    /** The recorded terminal hand (owner-only wire data). */
    eligible: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
    /** The current selection, in pick order — the order IS the seat order. */
    selected: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
    /** The SEAT's carry limit (the server's number). */
    limit: {type: Number, required: true},
    /** The mission the cards travel into (1-based). */
    nextMission: {type: Number, required: true},
    /** The host's workspace root (i18n key) — the endgame's results, or the campaign. */
    root: {type: String, default: 'Campaign'},
    confirmed: {type: Boolean, default: false},
    submitting: {type: Boolean, default: false},
    error: {type: String, default: ''},
    embedded: {type: Boolean, default: false},
    /** The «Тендеры» mode: how many of `limit` are seats a held «Расширенное наследие» adds (the manifest marks them). */
    tenderSeats: {type: Number, default: 0},
    /** The «Тендеры» mode: the viewer's played preludes of the finished mission («Продление программы» candidates). */
    eligiblePreludes: {type: Array as PropType<ReadonlyArray<CardName>>, default: () => []},
    /** The «Тендеры» mode: how many preludes may travel (one per held «Продление программы»); 0 = no band. */
    preludeLimit: {type: Number, default: 0},
    selectedPreludes: {type: Array as PropType<ReadonlyArray<CardName>>, default: () => []},
    /** The «Тендеры» mode: EVERY holding of the viewer with its availability on this step (the portfolio stage, §16.1). */
    tenders: {type: Array as PropType<ReadonlyArray<CarryoverTenderModel>>, default: () => []},
    /** The instance whose activation is on the wire. */
    tenderBusy: {type: String, required: false, default: undefined},
    /** The server's refusal of the last activation (an i18n key), '' when none. */
    tenderError: {type: String, default: ''},
  },
  emits: ['toggle', 'togglePrelude', 'confirm', 'back', 'armChange', 'bar', 'executeTender'],
  data() {
    return {
      cursor: 0,
      /** The ARMED zero-carry confirm (the first RT warns, the second confirms; any other input disarms). */
      armed: false,
      /** A refusal named on the status line («seats are full»), for a beat. */
      notice: '',
      noticeTimer: undefined as number | undefined,
      position: undefined as CardAlbumPosition | undefined,
      /** Cards whose face waits for its own flight (the entry deal). */
      heldNames: [] as Array<string>,
      flights: [] as Array<CloneFlightHandle>,
      zoomOpenedHere: false,
      /** Where the cursor stands: the album, or the prelude band above it (↑ from the album's top row). */
      zone: 'album' as 'album' | 'preludes',
      preludeCursor: 0,
      /** The step's two layers: the PORTFOLIO (first, when the seat holds tenders) and the ALBUM. */
      stage: 'album' as 'tenders' | 'album',
      tenderFocus: 0,
      /** The certificate whose press asked for a second press (a seat nothing can fill). */
      tenderConfirm: undefined as string | undefined,
      /** The RT terminal warning stands: legacy tenders still executable — the next RT confirms anyway. */
      armedTenders: false,
      stageTimer: undefined as number | undefined,
    };
  },
  created() {
    // The portfolio stands FIRST while a tender can still be ACTIVATED here; once every holding is executed, blocked
    // or cashed the step opens on the album (the portfolio stays one B away — a read, not a toll gate).
    this.stage = this.portfolioEntries.some((e) => e.state === 'ready' || e.state === 'step') ? 'tenders' : 'album';
  },
  computed: {
    /** Cards that no longer resolve in this build (post-update loss, §2.12). */
    unavailable(): ReadonlyArray<CardName> {
      return this.eligible.filter((name) => getCard(name) === undefined);
    },
    entries(): Array<CardAlbumEntry> {
      return this.eligible.map((name) => {
        const seat = this.selected.indexOf(name);
        const vanished = this.unavailable.includes(name) && seat < 0;
        return {
          name,
          card: {name} as CardModel,
          picked: seat >= 0,
          band: seat >= 0 ? carryoverBandText(this.nextMission, seat + 1) : undefined,
          disabled: vanished,
          reason: vanished ? translateText('Unavailable in this build') : undefined,
        };
      });
    },
    seats(): Array<CarryoverSeat> {
      return carryoverSeats(this.limit, this.selected, this.tenderSeats);
    },
    preludeAskText(): string {
      return carryoverPreludeAskText(this.preludeLimit, this.nextMission);
    },
    /** The carried prelude's band — it always travels into the FINALE (the only mission a «Продление программы» reaches). */
    preludeBandText(): string {
      return '✓ ' + translateText('Into the finale');
    },
    preludeSummaryText(): string {
      return translateTextWithParams('Prelude: ${0} / ${1}', [String(this.selectedPreludes.length), String(this.preludeLimit)]);
    },
    preludeFull(): boolean {
      return this.selectedPreludes.length >= this.preludeLimit;
    },
    missionLabel(): string {
      return translateTextWithParams('Mission ${0}', [String(this.nextMission)]);
    },
    askText(): string {
      return carryoverAskText(this.limit, this.nextMission);
    },
    keepingText(): string {
      return translateTextWithParams('Keeping ${0} / ${1}', [String(this.selected.length), String(this.limit)]);
    },
    full(): boolean {
      return this.selected.length >= this.limit;
    },
    barFacts(): {primary: string, pages: number, stage: 'tenders' | 'album', primaryEnabled: boolean} {
      if (this.stage === 'tenders') {
        const e = this.focusedTender;
        const live = e !== undefined && (e.state === 'ready' || e.state === 'step') && this.tenderBusy === undefined;
        return {primary: e !== undefined && e.verb !== '' ? e.verb : 'Execute', pages: 1, stage: 'tenders', primaryEnabled: live};
      }
      return {primary: this.primaryLabel, pages: this.position?.pages ?? 1, stage: 'album', primaryEnabled: true};
    },
    hasTenders(): boolean {
      return this.tenders.length > 0;
    },
    /** The portfolio's entries on the THRESHOLD — the seat's limit, the hand, the played preludes are what each tender changes. */
    portfolioEntries(): ReadonlyArray<TenderPortfolioEntry> {
      if (!this.hasTenders) {
        return [];
      }
      return tenderPortfolio({
        place: 'threshold', tenders: this.tenders, limit: this.limit, handSize: this.eligible.length,
        playedPreludes: this.eligiblePreludes.length, preludeLimit: this.preludeLimit,
      });
    },
    portfolioCounts(): {executed: number, open: number, total: number} {
      return tenderPortfolioCounts(this.portfolioEntries);
    },
    focusedTender(): TenderPortfolioEntry | undefined {
      return this.portfolioEntries[this.tenderFocus];
    },
    /** The legacy tenders still executable here — what the readiness press would leave to the buyout. */
    openLegacyTenders(): ReadonlyArray<TenderPortfolioEntry> {
      return this.portfolioEntries.filter((e) => e.state === 'ready');
    },
    tenderWarningText(): string {
      const names = this.openLegacyTenders.map((e) => translateText(tenderPortfolioName(e.id))).join(' · ');
      return translateTextWithParams('Unexecuted: ${0}', [names]) + ' — ' +
        translateTextWithParams('Unexecuted tenders of this step are bought back for ${0} M€ each after the launch — press again to confirm anyway', [String(TENDER_COMPENSATION_MC)]);
    },
    /** The A verb for the focused object — the bar reads it (one key, one object, two words). */
    primaryLabel(): string {
      if (this.zone === 'preludes') {
        const prelude = this.eligiblePreludes[this.preludeCursor];
        return prelude !== undefined && this.selectedPreludes.includes(prelude) ? 'Leave the prelude behind' : 'Carry the prelude';
      }
      const name = this.eligible[this.cursor];
      return name !== undefined && this.selected.includes(name) ? 'Return to hand' : 'Keep for the next mission';
    },
  },
  watch: {
    'selected.length': function(): void {
      this.disarm();
    },
    /**
     * AN ACTIVATION LANDED (a holding turned executed): the certificate takes the Committee's stamp, and after the
     * stamp's beat the ALBUM takes the screen to show what opened — the new seat of the manifest (its own enter), the
     * prelude band (its unfold). The player sees the effect where it lives, then decides.
     */
    tenders(now: ReadonlyArray<CarryoverTenderModel>, before: ReadonlyArray<CarryoverTenderModel>): void {
      const wasHeld = new Set(before.filter((t) => t.status === 'held').map((t) => t.instance));
      const landed = now.filter((t) => t.status === 'executed' && wasHeld.has(t.instance));
      if (landed.length === 0) {
        return;
      }
      this.tenderConfirm = undefined;
      const portfolio = (this.$refs.portfolio ?? undefined) as {playStamp?: (instance: string) => void} | undefined;
      for (const t of landed) {
        portfolio?.playStamp?.(t.instance);
      }
      if (landed.some((t) => tenderDef(t.id).window === 'legacy') && this.stage === 'tenders') {
        if (this.stageTimer !== undefined) {
          window.clearTimeout(this.stageTimer);
        }
        this.stageTimer = window.setTimeout(() => {
          this.stageTimer = undefined;
          this.stage = 'album';
        }, motionMs(TENDER_STAGE_FLIP_MS));
      }
    },
    /** The facts the host's ONE bar reads: the A verb for the focused card and whether pages exist. */
    'barFacts': {
      immediate: true,
      handler(now: {primary: string, pages: number}): void {
        this.$emit('bar', now);
      },
    },
  },
  beforeUnmount() {
    for (const f of this.flights) {
      f.dispose();
    }
    this.flights = [];
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
    }
    if (this.stageTimer !== undefined) {
      window.clearTimeout(this.stageTimer);
    }
    if (this.zoomOpenedHere && consoleCardZoom.card !== undefined) {
      closeConsoleCardZoom();
    }
    this.zoomOpenedHere = false;
  },
  methods: {
    album(): AlbumApi | undefined {
      return (this.$refs.album ?? undefined) as AlbumApi | undefined;
    },
    disarm(): void {
      if (this.armed || this.armedTenders) {
        this.armed = false;
        this.armedTenders = false;
        this.$emit('armChange', false);
      }
    },
    // ── THE TENDERS stage (§16.1 / §16.4) ──
    /** A on the portfolio: a blocked / done certificate says why; a confirm asks for its second press; else the activation goes. */
    pressTender(): void {
      const e = this.focusedTender;
      if (e === undefined || this.tenderBusy !== undefined) {
        return;
      }
      if (e.state !== 'ready' && e.state !== 'step') {
        if (e.reason !== undefined) {
          this.say(e.reason);
        }
        return;
      }
      if (e.confirm !== undefined && this.tenderConfirm !== e.instance) {
        this.tenderConfirm = e.instance;
        return;
      }
      this.tenderConfirm = undefined;
      this.$emit('executeTender', e.instance);
    },
    /** The portfolio stage's pad: ◀ ▶ walk the certificates, A activates, X reads, RT moves on to the album, B closes. */
    tenderIntent(intent: GamepadIntent): boolean {
      if (intent.kind === 'nav') {
        const n = this.portfolioEntries.length;
        if (n === 0) {
          return true;
        }
        const step = intent.dir === 'right' || intent.dir === 'down' ? 1 : -1;
        const next = Math.max(0, Math.min(n - 1, this.tenderFocus + step));
        if (next !== this.tenderFocus) {
          this.tenderFocus = next;
          this.tenderConfirm = undefined;
        }
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      if (intent.button === 'triggerR') {
        this.tenderConfirm = undefined;
        this.stage = 'album';
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        this.pressTender();
        return true;
      case 'inspect':
        this.openTenderZoom();
        return true;
      case 'back':
        this.$emit('back');
        return true;
      default:
        return true;
      }
    },
    say(notice: string): void {
      this.notice = notice;
      if (this.noticeTimer !== undefined) {
        window.clearTimeout(this.noticeTimer);
      }
      this.noticeTimer = window.setTimeout(() => {
        this.notice = '';
        this.noticeTimer = undefined;
      }, motionMs(NOTICE_MS));
    },
    onCardClick(i: number): void {
      this.zone = 'album';
      this.cursor = i;
      this.toggleAt(i);
    },
    onPreludeClick(i: number): void {
      this.zone = 'preludes';
      this.preludeCursor = i;
      this.togglePreludeAt(i);
    },
    preludeCard(name: CardName): CardModel {
      return {name} as CardModel;
    },
    /** THE PRELUDE TOGGLE — carry / leave the same prelude with the same key; a full allowance is a NAMED refusal. */
    togglePreludeAt(i: number): void {
      const name = this.eligiblePreludes[i];
      if (name === undefined || this.submitting) {
        return;
      }
      this.disarm();
      if (this.selectedPreludes.includes(name)) {
        this.$emit('togglePrelude', name);
        return;
      }
      if (this.preludeFull) {
        this.say('Only ${0} prelude(s) can be carried — leave one behind first');
        return;
      }
      this.$emit('togglePrelude', name);
    },
    /** THE TOGGLE IN PLACE — keep / return the same card with the same key; a full set of seats is a NAMED refusal. */
    toggleAt(i: number): void {
      const name = this.eligible[i];
      if (name === undefined || this.submitting) {
        return;
      }
      this.disarm();
      if (this.selected.includes(name)) {
        this.$emit('toggle', name);
        return;
      }
      if (this.unavailable.includes(name)) {
        this.say('Unavailable in this build');
        return;
      }
      if (this.full) {
        this.say(this.limit === 0 ? 'No project card can be carried into this mission' : 'Seats are full — return a card to keep another');
        return;
      }
      this.$emit('toggle', name);
    },
    turnPage(dir: 1 | -1): void {
      const album = this.album();
      if (album !== undefined) {
        this.cursor = album.jumpPage(this.cursor, dir);
      }
    },
    /** The host routes pad intents here. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (consoleCardZoom.card !== undefined || this.submitting) {
        return true; // the zoom host owns the pad while its viewer is up
      }
      if (this.stage === 'tenders') {
        return this.tenderIntent(intent);
      }
      if (intent.kind === 'nav') {
        this.disarm();
        if (this.zone === 'preludes') {
          // The band: ◀ ▶ along the preludes; ▼ (or ▲ with no album to fall into) returns to the album.
          const n = this.eligiblePreludes.length;
          if (intent.dir === 'left' || intent.dir === 'right') {
            const step = intent.dir === 'left' ? -1 : 1;
            this.preludeCursor = Math.max(0, Math.min(Math.max(0, n - 1), this.preludeCursor + step));
          } else if (intent.dir === 'down' && this.eligible.length > 0) {
            this.zone = 'album';
          }
          return true;
        }
        const album = this.album();
        if (album !== undefined) {
          const next = album.step(this.cursor, intent.dir);
          // ▲ against the album's top row reaches the prelude band (when it stands).
          if (intent.dir === 'up' && next === this.cursor && this.preludeLimit > 0 && this.eligiblePreludes.length > 0) {
            this.zone = 'preludes';
            this.preludeCursor = Math.min(this.preludeCursor, this.eligiblePreludes.length - 1);
            return true;
          }
          this.cursor = next;
        } else if (intent.dir === 'up' && this.preludeLimit > 0 && this.eligiblePreludes.length > 0) {
          this.zone = 'preludes';
        }
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'triggerR') {
        // THE TERMINAL WARNING first: a legacy tender still executable would go to the buyout past the readiness.
        if (this.openLegacyTenders.length > 0 && !this.armedTenders) {
          this.armedTenders = true;
          this.$emit('armChange', true);
          return true;
        }
        if (this.selected.length === 0 && this.eligible.length > 0 && this.limit > 0 && !this.armed) {
          this.armed = true;
          this.$emit('armChange', true);
          return true;
        }
        this.$emit('confirm');
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        if (this.zone === 'preludes') {
          this.togglePreludeAt(this.preludeCursor);
        } else {
          this.toggleAt(this.cursor);
        }
        return true;
      case 'inspect':
        this.disarm();
        if (this.zone === 'preludes') {
          this.openPreludeZoom(this.preludeCursor);
        } else {
          this.openZoom(this.cursor);
        }
        return true;
      case 'prevSection':
      case 'nextSection':
        this.disarm();
        this.turnPage(action === 'nextSection' ? 1 : -1);
        return true;
      case 'back':
        if (this.armed || this.armedTenders) {
          this.disarm();
          return true;
        }
        // One level: the album stands over the portfolio when the seat holds tenders — B returns there first.
        if (this.hasTenders) {
          this.stage = 'tenders';
          return true;
        }
        this.$emit('back');
        return true;
      default:
        return true;
      }
    },
    /** X on the portfolio stage — the holder's certificates in the ONE fullscreen viewer (§16.6), the focused one first. */
    openTenderZoom(): void {
      const entries = this.portfolioEntries;
      if (entries.length === 0) {
        return;
      }
      const list = entries.map((e) => tenderZoomEntry(e.id, {instance: e.instance, state: tenderCardStateOf(e.status)}));
      const portfolio = (this.$refs.portfolio ?? undefined) as {slotEl?: (instance: string) => HTMLElement | undefined} | undefined;
      this.zoomOpenedHere = true;
      openConsoleCardZoom(list, Math.min(Math.max(this.tenderFocus, 0), list.length - 1), undefined, undefined, {
        contextLabel: 'Tenders',
        origin: {
          kind: 'physical',
          resolve: (i) => {
            const e = entries[i];
            return e !== undefined ? portfolio?.slotEl?.(e.instance) ?? null : null;
          },
          onBrowse: (i) => {
            this.tenderFocus = i;
          },
        },
      });
    },
    // ── X — the ONE console zoom pipeline; the card lifts out of its album slot, A there is the same toggle ──
    openZoom(at: number): void {
      if (this.eligible.length === 0) {
        return;
      }
      const list = this.eligible.map((name) => ({name} as CardModel));
      const index = Math.min(Math.max(at, 0), list.length - 1);
      this.zoomOpenedHere = true;
      openConsoleCardZoom(list, index, {
        isSelected: (name) => this.selected.includes(name),
        toggle: (name) => {
          const i = this.eligible.indexOf(name);
          if (i >= 0) {
            this.toggleAt(i);
          }
        },
      }, undefined, {
        contextLabel: 'Project legacy',
        origin: {
          kind: 'physical',
          resolve: (i) => {
            const name = this.eligible[i];
            return name !== undefined ? this.album()?.slotEl(name) ?? null : null;
          },
          // LB / RB inside the viewer keeps the album's cursor (and its page) in lockstep.
          onBrowse: (i) => {
            this.cursor = i;
          },
        },
      });
    },
    /** X on the band — the same ONE zoom pipeline over the played preludes; A there is the same toggle. */
    openPreludeZoom(at: number): void {
      if (this.eligiblePreludes.length === 0) {
        return;
      }
      const list = this.eligiblePreludes.map((name) => ({name} as CardModel));
      const index = Math.min(Math.max(at, 0), list.length - 1);
      this.zoomOpenedHere = true;
      openConsoleCardZoom(list, index, {
        isSelected: (name) => this.selectedPreludes.includes(name),
        toggle: (name) => {
          const i = this.eligiblePreludes.indexOf(name);
          if (i >= 0) {
            this.togglePreludeAt(i);
          }
        },
      }, undefined, {
        contextLabel: 'Programme Extension',
        origin: {
          kind: 'physical',
          resolve: (i) => {
            const name = this.eligiblePreludes[i];
            const root = this.$el as HTMLElement | undefined;
            return name !== undefined ? root?.querySelector<HTMLElement>(`[data-carry-prelude="${CSS.escape(name)}"]`) ?? null : null;
          },
          onBrowse: (i) => {
            this.preludeCursor = i;
          },
        },
      });
    },
    // ── the host's phrases ──────────────────────────────────────────────
    /**
     * THE ENTRY DEAL — the active page's cards arrive from `from` (the viewer's seat row: «the cards of your hand from
     * the finished mission») into their slots, each slot's face held until its own touchdown. Reduced motion / an
     * unmeasurable end → the album simply stands (nothing is withheld).
     */
    dealIn(from: DOMRect | undefined): void {
      const album = this.album();
      if (album === undefined || from === undefined || from.width < 4 || motionMs(100) === 0) {
        return;
      }
      const names = album.activePageNames() as Array<CardName>;
      const to = new Map<CardName, DOMRect>();
      for (const name of names) {
        const r = album.faceEl(name)?.getBoundingClientRect();
        if (r === undefined || r.width < 8) {
          return; // a half-measured convoy never flies
        }
        to.set(name, r);
      }
      // The source: a small card standing on the seat row, at the destination's aspect.
      const h = Math.max(24, from.height * 1.6);
      const w = h * ((to.get(names[0])?.width ?? 1) / (to.get(names[0])?.height ?? 1));
      const src = new DOMRect(from.left + from.width * 0.18 - w / 2, from.top + from.height / 2 - h / 2, w, h);
      const fromMap = new Map(names.map((n) => [n, src] as [CardName, DOMRect]));
      this.heldNames = [...names];
      // The layer is the convoy's own: it leaves with the last card (a lingering empty layer is a leak).
      const flight: CloneFlightHandle = flyCardClones({
        names,
        sourceEl: (n) => album.faceEl(n),
        from: fromMap,
        to,
        layerClass: 'con-carry-flight',
        onLand: (n) => {
          this.heldNames = this.heldNames.filter((x) => x !== n);
        },
        onDone: () => {
          this.heldNames = [];
          flight.dispose();
          this.flights = this.flights.filter((x) => x !== flight);
        },
        travelMs: 380,
        staggerMs: 60,
      });
      this.flights.push(flight);
    },
    /** The KEPT cards' faces as they stand now — the confirm flight's sources (armed before the POST). */
    keptFaces(): Map<CardName, {el: HTMLElement, rect: DOMRect}> {
      const out = new Map<CardName, {el: HTMLElement, rect: DOMRect}>();
      const album = this.album();
      for (const name of this.selected) {
        const el = album?.faceEl(name) ?? null;
        const rect = el?.getBoundingClientRect();
        // Only a face ON SCREEN is a flight's source (a neighbour page is mounted beyond the clip).
        if (el !== null && rect !== undefined && rect.width >= 8 && rect.right > 0 && rect.left < window.innerWidth) {
          out.set(name, {el, rect});
        }
      }
      return out;
    },
  },
});
</script>
