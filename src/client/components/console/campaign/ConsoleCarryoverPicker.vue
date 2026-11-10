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

    «ТЕНДЕРЫ» (§19 — the owner, 2026-11-09): the legacy tenders execute on THIS page, because this page is what they
    change. The door is the manifest's left block («ТЕНДЕРЫ» with the holder's certificates in miniature, L3 — the left
    stick for the left door, as on the start); it says «МОЖНО ИСПОЛНИТЬ · N» while one can go. L3 parks the album and
    stands the door's LIST (the ones that execute here first, the others with their reason); A on one hands the screen
    back to the album where the tender stands in its MODE — the place it opens is PREVIEWED in the manifest (a dashed
    ghost seat: «+1» for «Расширенное наследие», a prelude seat beside the project seats for «Продление программы»), the
    crumb names the tender, the foot reads what it gives; A executes and the ghost MATERIALIZES in place; B cancels.

    HOSTED ONLY BY THE CAMPAIGN MAP (standalone screen + the endgame's embedded map scene). Input arrives via
    `handleIntent`; the verbs render in the host's ONE command bar. RT confirms; a zero-card confirm over a real hand is
    ARMED first (the first RT warns, the second confirms; B disarms). X inspects in the ONE `consoleCardZoom` pipeline
    (A there is the same toggle). The ENTRY deal and the CONFIRM flight are the host's phrases around this surface
    (`dealIn` / `keptFaces`).

    PRIVACY: this surface only ever receives the VIEWER's own cards.
  -->
  <div class="con-carry" :class="{'con-carry--embedded': embedded, 'con-carry--confirmed': confirmed, 'con-carry--tendermode': tenderMode !== undefined}"
       role="dialog" :aria-label="$t('Project legacy')" data-carry-stage :data-carry-tender-mode="tenderMode?.id">
    <div class="con-carry__shade" aria-hidden="true"></div>
    <!-- The certificates' flight layer (the start's own engine — `startDockMotion`; the start scene is not mounted here). -->
    <div class="con-startdock-layer" ref="flightLayer" aria-hidden="true"></div>
    <div class="con-carry__stage">
      <ConsoleWsHead class="con-carry__head" :root="root" :subject="missionLabel" subject-raw
                     :stage="headStage" :committed="stage === 'album' && confirmed" />

      <!-- THE DOOR's LIST (§19) — a layer of the step: the album rests parked under it and comes back as the same nodes. -->
      <div v-if="hasTenders" v-show="stage === 'list'" ref="listLayer" class="con-carry__layer con-carry__layer--tenders" data-carry-tenders-stage>
        <ConsoleTenderPortfolio v-show="sheet === undefined" ref="portfolio" :entries="doorEntries" :focus="tenderFocus" place="threshold"
                                :busy="tenderBusy" :live="stage === 'list'" :held-names="listHeld" embedded />
        <!-- THE ACTIVATION SHEET (§20 — the start's one grammar, here for the legacy tenders): A on a certificate of this
             step CARRIES it out of its slot onto the sheet's hero seat, the RESULT beside it in the seat's numbers
             («Места наследия 2 → 3», «Прологов в финал 0 → 1»); A stamps it, the sheet folds, the album returns with the
             GHOST of the place it opens, the certificate flies home into its miniature — and only then does the answer
             go out, so the place materializes on the screen the player is looking at. B — back to the list. -->
        <ConsoleTenderActivation v-if="sheet !== undefined && sheetPlan !== undefined" ref="sheetEl"
                                 class="con-carry__sheet"
                                 :plan="sheetPlan" :hero-held="sheetHeroHeld"
                                 :open="sheet.phase === 'open' || sheet.phase === 'committing'"
                                 :committed="sheetCommitted" :stamping="sheetStamping"
                                 :leaving="sheet.phase === 'leaving'" :busy="tenderBusy !== undefined" />
        <div class="con-carry__foot con-carry__foot--tenders">
          <span class="con-carry__status">
            <span v-if="notice !== ''" class="con-carry__status-warn" data-carry-notice>{{ $t(notice) }}</span>
          </span>
        </div>
      </div>

      <div ref="albumLayer" class="con-carry__layer con-carry__layer--album" v-show="stage === 'album'" data-carry-album-stage>
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

      <!-- THE MANIFEST ROW: the tender DOOR (left, L3) · the project seats · the prelude seats. One place per seat of the
           limit: an empty seat is its number, a taken one its number and the card's NAME (a label, never a face — the
           face is the album's); a seat a tender's mode is about to open stands as its dashed GHOST in the very place. -->
      <div v-if="limit > 0 || hasTenders || preludeSeats.length > 0" class="con-carry__seats" data-carry-seats>
        <div v-if="hasTenders" class="con-carry__door" :class="{'con-carry__door--ready': doorReady > 0}"
             data-carry-tender-door :data-carry-tender-door-ready="doorReady">
          <span class="con-carry__door-cap">{{ $t('Tenders') }}</span>
          <span class="con-carry__door-line">
            <GamepadGlyph control="stickL" />
            <span v-if="doorReady > 0" class="con-carry__door-ready" data-carry-tender-door-word>{{ doorReadyText }}</span>
            <span v-else class="con-carry__door-tally">{{ portfolioCounts.executed }}/{{ portfolioCounts.total }}</span>
          </span>
          <span class="con-carry__door-row">
            <span v-for="e in portfolioEntries" :key="e.instance" class="con-tmini"
                  :class="[`con-tmini--${e.status}`, {'con-tmini--active': tenderMode?.instance === e.instance, 'con-tmini--just-executed': stamped === e.instance, 'con-tmini--aloft': miniHeld.includes(e.instance)}]"
                  :data-carry-tender-mini="e.instance">
              <ConsoleTenderCard :id="e.id" size="table" :state="tenderCardStateOf(e.status)" :dim="e.state !== 'ready'" />
            </span>
          </span>
        </div>
        <TransitionGroup name="con-carry-seat" tag="span" class="con-carry__seats-row">
          <span v-for="seat in seats" :key="'seat' + seat.n"
                class="con-carry__seat" :class="{'con-carry__seat--taken': seat.name !== undefined, 'con-carry__seat--tender': seat.tender === true, 'con-carry__seat--ghost': seat.ghost === true, 'con-carry__seat--landed': landedSeat === 'seat' + seat.n}"
                :data-carry-seat="seat.n" :data-carry-seat-card="seat.name" :data-carry-seat-tender="seat.tender === true ? 'yes' : undefined"
                :data-carry-seat-ghost="seat.ghost === true ? 'yes' : undefined">
            <b class="con-carry__seat-num">{{ seat.ghost === true ? '+' + seat.n : seat.n }}</b>
            <span v-if="seat.name !== undefined" :key="seat.name" class="con-carry__seat-name">{{ $t(seat.name) }}</span>
            <!-- A seat a TENDER added («Расширенное наследие») says so — a tag, never a glow. -->
            <span v-if="seat.tender === true" class="con-carry__seat-tag">{{ $t('Tender') }}</span>
          </span>
          <span v-for="seat in preludeSeats" :key="'pseat' + seat.n"
                class="con-carry__seat con-carry__seat--prelude" :class="{'con-carry__seat--taken': seat.name !== undefined, 'con-carry__seat--ghost': seat.ghost === true, 'con-carry__seat--landed': landedSeat === 'pseat' + seat.n}"
                :data-carry-prelude-seat="seat.n" :data-carry-prelude-seat-card="seat.name"
                :data-carry-seat-ghost="seat.ghost === true ? 'yes' : undefined">
            <span class="con-carry__seat-kind">{{ $t('Prelude') }}</span>
            <span v-if="seat.name !== undefined" :key="seat.name" class="con-carry__seat-name">{{ $t(seat.name) }}</span>
            <b v-else class="con-carry__seat-num">{{ seat.ghost === true ? '+1' : seat.n }}</b>
          </span>
        </TransitionGroup>
      </div>

      <!-- THE PRELUDE BAND — «Продление программы»: the viewer's played preludes of the finished mission, up to
           `preludeLimit` of them travel into the finale and are played AGAIN. The band's place is RESERVED while the seat
           holds an executable copy (`preludeBandReserved`): before the activation it stands LOCKED (the faces dimmed, the
           head says what opens it) — so the activation changes the album's size by nothing; after it, the same band is
           live (↑ from the album's top row reaches it, ↓ returns), the same toggle-in-place grammar, the same X. -->
      <Transition name="con-carry-band">
      <div v-if="preludeBandReserved" class="con-carry__preludes"
           :class="{'con-carry__preludes--active': zone === 'preludes', 'con-carry__preludes--locked': preludeLimit === 0, 'con-carry__preludes--preview': previewPreludes}"
           data-carry-preludes :data-carry-preludes-locked="preludeLimit === 0 ? 'yes' : undefined">
        <div class="con-carry__preludes-head">
          <span class="con-carry__preludes-ask" data-carry-prelude-ask>{{ preludeLimit > 0 ? preludeAskText : preludeLockedText }}</span>
          <b v-if="preludeLimit > 0" class="con-carry__preludes-count" data-carry-prelude-count>{{ selectedPreludes.length }} / {{ preludeLimit }}</b>
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

      <!-- THE FOOT — the album spine (where it is) and ONE status line (what the step says now). A tender standing in its
           mode speaks HERE: its name and what the press opens, in the seat's numbers. -->
      <div class="con-carry__foot">
        <ConsoleAlbumSpine v-if="eligible.length > 0 && position !== undefined" variant="foot" :album="position"
                           @page="turnPage($event)" />
        <span class="con-carry__status">
          <span v-if="tenderMode !== undefined" class="con-carry__status-tender" data-carry-tender-reading>
            <b class="con-carry__status-tender-name">{{ $t(tenderNameOf(tenderMode.id)) }}</b>
            <span>{{ tenderBusy === tenderMode.instance ? $t('Executing…') : tenderModeReading }}</span>
          </span>
          <!-- THE TERMINAL WARNING (§16.4): legacy tenders still executable — after the readiness the host may launch at
               any moment and the Committee buys them back. A conscious second press confirms anyway. -->
          <span v-else-if="armedTenders" class="con-carry__status-warn" data-carry-tender-warning>{{ tenderWarningText }}</span>
          <span v-else-if="armed" class="con-carry__status-warn" v-i18n>Nothing is selected — press again to continue WITHOUT a legacy.</span>
          <span v-else-if="tenderError !== ''" class="con-carry__status-err" data-carry-tender-error>{{ $t(tenderError) }}</span>
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
import {CapturedFlight, captureCards, parkSurface, registerStartDockLayer, unparkSurface} from '@/client/console/startDockMotion';
import ConsoleTenderActivation from './ConsoleTenderActivation.vue';
import {legacyActivationPlan, TenderActivationPlan} from '@/client/console/campaign/tenderActivation';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleCardAlbum, {CardAlbumEntry, CardAlbumPosition} from '@/client/components/console/foundation/ConsoleCardAlbum.vue';
import ConsoleAlbumSpine from '@/client/components/console/foundation/ConsoleAlbumSpine.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import Card from '@/client/components/card/CardFace.vue';
import {
  carryoverAskText, carryoverBandText, carryoverPreludeAskText, carryoverPreludeSeats, carryoverSeatsWithGhost, CarryoverSeat,
} from '@/client/console/campaign/carryoverPicker';
import ConsoleTenderPortfolio from './ConsoleTenderPortfolio.vue';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import {CarryoverTenderModel} from '@/common/campaign/CampaignModel';
import {TENDER_COMPENSATION_MC, TenderId} from '@/common/campaign/tenders';
import {
  TenderPortfolioEntry, tenderCardStateOf, tenderDoorList, tenderPortfolio, tenderPortfolioCounts, tenderPortfolioName, tenderReadyHere,
} from '@/client/console/campaign/tenderPortfolio';
import {readingText} from '@/client/console/readingText';
import {tenderZoomEntry} from '@/client/components/card/cardZoomTypes';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';

/** Two painted frames (a layout settled before a flight measures it) — none to wait for where nothing paints. */
function twoFrames(): Promise<void> {
  return new Promise<void>((r) => {
    if (typeof requestAnimationFrame !== 'function') {
      r();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => r()));
  });
}

/** The door's phrase (park / unpark) or an activation on the wire — a press now is absorbed, and SAID so (the ledger). */
const CARRY_TENDER_ABSORBER = 'carry-tender-door';

/** The beat a materialized seat wears its one-shot landing class (the CSS keyframe's own length — never a gate). */
const SEAT_LANDED_MS = 620;

type AlbumApi = {
  step(from: number, dir: 'left' | 'right' | 'up' | 'down'): number,
  jumpPage(from: number, dir: 1 | -1): number,
  slotEl(name: string): HTMLElement | null,
  faceEl(name: string): HTMLElement | null,
  activePageNames(): Array<string>,
};

/** How long a refusal stays named on the status line. */
const NOTICE_MS = 2400;

/** The facts the host's ONE bar reads. */
export type CarryoverBarFacts = {
  primary: string,
  pages: number,
  /** The album · the door's LIST · a tender's activation SHEET · a tender standing in its MODE on the album. */
  stage: 'album' | 'list' | 'sheet' | 'mode',
  primaryEnabled: boolean,
  /** The tender door (L3) stands; `ready` = how many execute here (the verb is lit then). */
  door?: {ready: number},
};

export default defineComponent({
  name: 'ConsoleCarryoverPicker',
  components: {ConsoleWsHead, ConsoleCardAlbum, ConsoleAlbumSpine, Card, ConsoleTenderPortfolio, ConsoleTenderCard, ConsoleTenderActivation, GamepadGlyph},
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
    /** The «Тендеры» mode: how many of `limit` are seats an executed «Расширенное наследие» added (the manifest marks them). */
    tenderSeats: {type: Number, default: 0},
    /** The «Тендеры» mode: the viewer's played preludes of the finished mission («Продление программы» candidates). */
    eligiblePreludes: {type: Array as PropType<ReadonlyArray<CardName>>, default: () => []},
    /** The «Тендеры» mode: how many preludes may travel (one per executed «Продление программы»); 0 = locked / no band. */
    preludeLimit: {type: Number, default: 0},
    selectedPreludes: {type: Array as PropType<ReadonlyArray<CardName>>, default: () => []},
    /** The «Тендеры» mode: EVERY holding of the viewer with its availability on this step (the door's list, §19). */
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
      /** The step's two layers: the ALBUM (always first) and the door's LIST (L3). */
      stage: 'album' as 'list' | 'album',
      /** The list's phrase is running (park / unpark) — input is absorbed for the beat. */
      stageMoving: false,
      tenderFocus: 0,
      /** A tender standing in its MODE on the album (§19): its place previewed, A executes, B cancels. */
      tenderMode: undefined as {instance: string, id: TenderId} | undefined,
      /** The RT terminal warning stands: legacy tenders still executable — the next RT confirms anyway. */
      armedTenders: false,
      /** The seat an activation just materialized (its one-shot landing) and the miniature that took the stamp. */
      landedSeat: undefined as string | undefined,
      stamped: undefined as string | undefined,
      landTimer: undefined as number | undefined,
      absorbOff: undefined as (() => void) | undefined,
      /** The ACTIVATION SHEET (§20): the tender chosen in the list, as the hero of its own scene. */
      sheet: undefined as {instance: string, id: TenderId, phase: 'entering' | 'open' | 'committing' | 'leaving'} | undefined,
      sheetHeroHeld: false,
      sheetCommitted: false,
      sheetStamping: false,
      /** List slots / door miniatures whose certificate is in the air (each waits for its own touchdown). */
      listHeld: [] as Array<string>,
      miniHeld: [] as Array<string>,
      sheetFlight: undefined as CapturedFlight | undefined,
    };
  },
  mounted() {
    this.absorbOff = registerInputAbsorber(CARRY_TENDER_ABSORBER,
      () => this.stageMoving || this.tenderBusy !== undefined || (this.sheet !== undefined && this.sheet.phase !== 'open'), {scope: 'all'});
    registerStartDockLayer((this.$refs.flightLayer ?? undefined) as HTMLElement | undefined);
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
    /** The project seats — with the GHOST of the one a standing «Расширенное наследие» opens. */
    seats(): Array<CarryoverSeat> {
      return carryoverSeatsWithGhost(this.limit, this.selected, this.tenderSeats, this.tenderMode?.id === 'extendedLegacy');
    },
    /** The prelude seats beside them — with the GHOST of the one a standing «Продление программы» opens. */
    preludeSeats(): Array<CarryoverSeat> {
      return carryoverPreludeSeats(this.preludeLimit, this.selectedPreludes, this.tenderMode?.id === 'programExtension');
    },
    /**
     * The prelude band's place is RESERVED from the first frame whenever the seat can carry a prelude now or after an
     * activation here — so an activation never changes the album's size (the owner: «раскладка не должна меняться»).
     */
    preludeBandReserved(): boolean {
      return this.preludeLimit > 0 || this.portfolioEntries.some((e) => e.id === 'programExtension' && e.state === 'ready');
    },
    /** A standing «Продление программы» previews the band it unlocks. */
    previewPreludes(): boolean {
      return this.tenderMode?.id === 'programExtension';
    },
    preludeAskText(): string {
      return carryoverPreludeAskText(this.preludeLimit, this.nextMission);
    },
    preludeLockedText(): string {
      return translateText('Your played preludes — «Programme Extension» lets one travel into the finale');
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
    /** The crumb's tail: the page · the door's list · the tender standing in its mode (its NAME — §19). */
    headStage(): string {
      if (this.sheet !== undefined) {
        return tenderPortfolioName(this.sheet.id);
      }
      if (this.stage === 'list') {
        return 'Tenders';
      }
      if (this.tenderMode !== undefined) {
        return tenderPortfolioName(this.tenderMode.id);
      }
      return 'Project legacy';
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
    /** The sheet's RESULT in the seat's own numbers. */
    sheetPlan(): TenderActivationPlan | undefined {
      const sheet = this.sheet;
      return sheet === undefined ? undefined : legacyActivationPlan(sheet.id, {
        limit: this.limit, handSize: this.eligible.length, preludeLimit: this.preludeLimit, playedPreludes: this.eligiblePreludes.length,
      });
    },
    barFacts(): CarryoverBarFacts {
      if (this.sheet !== undefined) {
        return {primary: this.sheetPlan?.verb ?? 'Execute the tender', pages: 1, stage: 'sheet',
          primaryEnabled: this.sheet.phase === 'open' && this.tenderBusy === undefined};
      }
      if (this.stage === 'list') {
        const e = this.focusedTender;
        return {primary: 'Execute', pages: 1, stage: 'list', primaryEnabled: e !== undefined && e.state === 'ready' && this.tenderBusy === undefined};
      }
      if (this.tenderMode !== undefined) {
        return {primary: 'Execute the tender', pages: 1, stage: 'mode', primaryEnabled: this.tenderBusy === undefined};
      }
      return {
        primary: this.primaryLabel, pages: this.position?.pages ?? 1, stage: 'album', primaryEnabled: true,
        ...(this.hasTenders ? {door: {ready: this.doorReady}} : {}),
      };
    },
    hasTenders(): boolean {
      return this.tenders.length > 0;
    },
    /** Every holding on the THRESHOLD in acquisition order — the seat's limit, the hand, the played preludes are what each changes. */
    portfolioEntries(): ReadonlyArray<TenderPortfolioEntry> {
      if (!this.hasTenders) {
        return [];
      }
      return tenderPortfolio({
        place: 'threshold', tenders: this.tenders, limit: this.limit, handSize: this.eligible.length,
        playedPreludes: this.eligiblePreludes.length, preludeLimit: this.preludeLimit,
      });
    },
    /** …in the DOOR's order: the ones that execute here first, then the others with their reason. */
    doorEntries(): ReadonlyArray<TenderPortfolioEntry> {
      return tenderDoorList(this.portfolioEntries);
    },
    portfolioCounts(): {executed: number, open: number, total: number} {
      return tenderPortfolioCounts(this.portfolioEntries);
    },
    doorReady(): number {
      return this.tenderMode === undefined ? tenderReadyHere(this.portfolioEntries) : 0;
    },
    doorReadyText(): string {
      return translateTextWithParams('Can execute: ${0}', [String(this.doorReady)]);
    },
    focusedTender(): TenderPortfolioEntry | undefined {
      return this.doorEntries[this.tenderFocus];
    },
    /** The standing mode's reading — what the press opens, in the seat's own numbers. */
    tenderModeReading(): string {
      const mode = this.tenderMode;
      const entry = mode === undefined ? undefined : this.portfolioEntries.find((e) => e.instance === mode.instance);
      return entry === undefined ? '' : readingText({label: entry.reading.key, params: [...entry.reading.params]});
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
     * AN ACTIVATION LANDED (a holding turned executed): the ghost the mode stood in the manifest is now the REAL place
     * — the same node (its key is the seat's number), so it materializes in place: the dashed ghost takes the solid
     * kant and the one-shot landing; the miniature in the door takes the Committee's stamp; the mode ends. A prelude
     * seat unlocks the band above the album (its place was reserved — nothing re-flows).
     */
    tenders(now: ReadonlyArray<CarryoverTenderModel>, before: ReadonlyArray<CarryoverTenderModel>): void {
      const wasHeld = new Set(before.filter((t) => t.status === 'held').map((t) => t.instance));
      const landed = now.filter((t) => t.status === 'executed' && wasHeld.has(t.instance));
      if (landed.length === 0) {
        return;
      }
      const t = landed[0];
      if (this.tenderMode?.instance === t.instance) {
        this.tenderMode = undefined;
      }
      this.landedSeat = t.id === 'extendedLegacy' ? 'seat' + this.limit : t.id === 'programExtension' ? 'pseat' + this.preludeLimit : undefined;
      this.stamped = t.instance;
      if (this.landTimer !== undefined) {
        window.clearTimeout(this.landTimer);
      }
      this.landTimer = window.setTimeout(() => {
        this.landTimer = undefined;
        this.landedSeat = undefined;
        this.stamped = undefined;
      }, motionMs(SEAT_LANDED_MS));
      // «Продление программы»: the band is live now — the cursor goes where the choice is.
      if (t.id === 'programExtension' && this.eligiblePreludes.length > 0) {
        this.zone = 'preludes';
        this.preludeCursor = 0;
      }
    },
    /** The facts the host's ONE bar reads: the A verb for the focused card and whether pages exist. */
    'barFacts': {
      immediate: true,
      handler(now: CarryoverBarFacts): void {
        this.$emit('bar', now);
      },
    },
  },
  beforeUnmount() {
    this.absorbOff?.();
    this.sheetFlight?.dispose();
    registerStartDockLayer(undefined);
    for (const f of this.flights) {
      f.dispose();
    }
    this.flights = [];
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
    }
    if (this.landTimer !== undefined) {
      window.clearTimeout(this.landTimer);
    }
    if (this.zoomOpenedHere && consoleCardZoom.card !== undefined) {
      closeConsoleCardZoom();
    }
    this.zoomOpenedHere = false;
  },
  methods: {
    tenderCardStateOf,
    tenderNameOf(id: TenderId): string {
      return tenderPortfolioName(id);
    },
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
    // ── THE TENDER DOOR (§19) ──
    /** L3 on the album: the album PARKS on the spot and the door's list surfaces in its place (the start's phrase). */
    async openTenderList(): Promise<void> {
      if (!this.hasTenders || this.stage !== 'album' || this.stageMoving || this.tenderMode !== undefined) {
        return;
      }
      this.disarm();
      this.stageMoving = true;
      try {
        await parkSurface((this.$refs.albumLayer ?? null) as HTMLElement | null, 1);
        this.tenderFocus = 0;
        this.stage = 'list';
        await this.$nextTick();
        this.fitList();
        await unparkSurface((this.$refs.listLayer ?? null) as HTMLElement | null, 1);
      } finally {
        this.stageMoving = false;
      }
    },
    /** B / L3 from the list — the exact mirror; `then` runs once the ALBUM is the surface on screen. */
    async closeTenderList(then?: () => void): Promise<void> {
      if (this.stage !== 'list' || this.stageMoving) {
        return;
      }
      this.stageMoving = true;
      try {
        await parkSurface((this.$refs.listLayer ?? null) as HTMLElement | null, -1);
        this.stage = 'album';
        then?.();
        await this.$nextTick();
        await unparkSurface((this.$refs.albumLayer ?? null) as HTMLElement | null, -1);
      } finally {
        this.stageMoving = false;
      }
    },
    /** A on a certificate in the list: one that executes here stands on the album in its MODE; any other says why. */
    pressTender(): void {
      const e = this.focusedTender;
      if (e === undefined || this.tenderBusy !== undefined) {
        return;
      }
      if (e.state !== 'ready') {
        if (e.note !== undefined) {
          this.say(e.note);
        }
        return;
      }
      void this.openSheet(e);
    },
    // ── THE ACTIVATION SHEET (§20) ──
    sheetHeroEl(): HTMLElement | null {
      const sheet = (this.$refs.sheetEl ?? undefined) as {heroEl?: () => HTMLElement | undefined} | undefined;
      return sheet?.heroEl?.() ?? null;
    },
    listSlotEl(instance: string): HTMLElement | null {
      return (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-tport-slot="${instance}"]`);
    },
    doorMiniEl(instance: string): HTMLElement | null {
      return (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-carry-tender-mini="${instance}"]`);
    },
    /** The list's certificate size — as large as the layer allows for the whole row (the start's own rule). */
    fitList(): void {
      const pane = (this.$refs.listLayer ?? undefined) as HTMLElement | undefined;
      const list = pane?.querySelector<HTMLElement>('.con-tport');
      if (pane === undefined || list === null || list === undefined || pane.clientHeight < 40) {
        return;
      }
      const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const count = Math.max(1, this.doorEntries.length);
      const gap = 1.6 * rem;
      const foot = pane.querySelector<HTMLElement>('.con-carry__foot--tenders')?.offsetHeight ?? 0;
      const availW = pane.clientWidth - 2.4 * rem - gap * (count - 1);
      const availH = pane.clientHeight - foot - 7.2 * rem;
      const w = Math.max(6 * rem, Math.min(availW / count, availH / 1.42, 20 * rem));
      list.style.setProperty('--tport-w', `${Math.round(w)}px`);
    },
    /** The hero's size — solved from the list layer's own box (the certificate is the scene's hero by size). */
    fitSheet(): void {
      const pane = (this.$refs.listLayer ?? undefined) as HTMLElement | undefined;
      const sheet = pane?.querySelector<HTMLElement>('.con-tsheet');
      if (pane === undefined || sheet === null || sheet === undefined || pane.clientHeight < 40) {
        return;
      }
      const foot = pane.querySelector<HTMLElement>('.con-carry__foot--tenders')?.offsetHeight ?? 0;
      const h = (pane.clientHeight - foot) * 0.88;
      sheet.style.setProperty('--tsheet-hero-w', `${Math.round(Math.min(h / 1.42, pane.clientWidth * 0.34))}px`);
      const panel = sheet.querySelector<HTMLElement>('.con-tsheet__panel');
      if (panel !== null) {
        sheet.style.removeProperty('--tsheet-type');
        const room = (pane.clientHeight - foot) * 0.96;
        if (panel.scrollHeight > room) {
          const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
          sheet.style.setProperty('--tsheet-type', `${(Math.max(0.7, room / panel.scrollHeight) * rem).toFixed(2)}px`);
        }
      }
    },
    /** A on a certificate of this step: the list lets it go — it is CARRIED onto the sheet's hero seat (one object). */
    async openSheet(e: TenderPortfolioEntry): Promise<void> {
      if (this.sheet !== undefined) {
        return;
      }
      const from = this.listSlotEl(e.instance);
      const flight = captureCards(from !== null ? [{name: e.instance as CardName, el: from}] : []);
      this.sheetFlight = flight;
      this.sheetHeroHeld = true;
      this.sheetCommitted = false;
      this.sheet = {instance: e.instance, id: e.id, phase: 'entering'};
      await this.$nextTick();
      this.fitSheet();
      await twoFrames();
      await flight.flyTo(() => this.sheetHeroEl(), () => {
        this.sheetHeroHeld = false;
      }, {reseat: true});
      this.sheetFlight = undefined;
      this.sheetHeroHeld = false;
      if (this.sheet?.instance === e.instance && this.sheet.phase === 'entering') {
        this.sheet = {...this.sheet, phase: 'open'};
      }
    },
    /** B on the sheet — ONE level: the hero is carried back into its list slot. */
    async closeSheet(): Promise<void> {
      const sheet = this.sheet;
      if (sheet === undefined || sheet.phase !== 'open') {
        return;
      }
      const hero = this.sheetHeroEl();
      const flight = captureCards(hero !== null ? [{name: sheet.instance as CardName, el: hero}] : []);
      this.sheetFlight = flight;
      this.listHeld = [sheet.instance];
      this.sheet = undefined;
      this.tenderFocus = Math.max(0, this.doorEntries.findIndex((d) => d.instance === sheet.instance));
      await this.$nextTick();
      await twoFrames();
      await flight.flyTo(() => this.listSlotEl(sheet.instance), () => {
        this.listHeld = [];
      }, {reseat: true});
      this.sheetFlight = undefined;
      this.listHeld = [];
    },
    /**
     * THE ACTIVATION — the stamp comes down on the hero, the sheet folds, the album comes back with the GHOST of the
     * place this tender opens, the certificate flies home into its miniature; then the answer goes out and the ghost
     * materializes in place (the `tenders` watcher's landing). A refusal leaves the ghost standing — B cancels it.
     */
    async commitSheet(): Promise<void> {
      const sheet = this.sheet;
      if (sheet === undefined || sheet.phase !== 'open' || this.tenderBusy !== undefined) {
        return;
      }
      this.sheet = {...sheet, phase: 'committing'};
      this.sheetCommitted = true;
      this.sheetStamping = true;
      window.setTimeout(() => {
        this.sheetStamping = false;
      }, motionMs(620));
      await new Promise<void>((r) => window.setTimeout(r, motionMs(560)));
      const hero = this.sheetHeroEl();
      const flight = captureCards(hero !== null ? [{name: sheet.instance as CardName, el: hero}] : []);
      this.sheetFlight = flight;
      this.sheetHeroHeld = true;
      this.sheet = {...sheet, phase: 'leaving'};
      this.stageMoving = true;
      try {
        await parkSurface((this.$refs.listLayer ?? null) as HTMLElement | null, -1);
        this.sheet = undefined;
        this.miniHeld = [sheet.instance];
        this.stage = 'album';
        this.tenderMode = {instance: sheet.instance, id: sheet.id};
        await this.$nextTick();
        await Promise.all([
          unparkSurface((this.$refs.albumLayer ?? null) as HTMLElement | null, -1),
          flight.flyTo(() => this.doorMiniEl(sheet.instance), () => {
            this.miniHeld = [];
          }, {reseat: false, pressElFor: () => this.doorMiniEl(sheet.instance)}),
        ]);
      } finally {
        this.sheetFlight = undefined;
        this.miniHeld = [];
        this.sheetHeroHeld = false;
        this.stageMoving = false;
      }
      this.$emit('executeTender', sheet.instance);
    },
    /** The sheet's pad: A executes, X reads the hero, B / L3 one level back to the list; nothing else moves. */
    sheetIntent(intent: GamepadIntent): boolean {
      const sheet = this.sheet;
      if (sheet === undefined || sheet.phase !== 'open') {
        noteInputAbsorbed(CARRY_TENDER_ABSORBER);
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      if (intent.button === 'stickL') {
        void this.closeSheet();
        return true;
      }
      switch (consoleActionOf(intent, {})) {
      case 'primary':
        void this.commitSheet();
        return true;
      case 'inspect':
        this.openTenderZoom(this.doorEntries.findIndex((d) => d.instance === sheet.instance));
        return true;
      case 'back':
        void this.closeSheet();
        return true;
      default:
        return true;
      }
    },
    /** The list's pad: ◀ ▶ walk the certificates, A chooses, X reads, B / L3 return to the album. */
    tenderIntent(intent: GamepadIntent): boolean {
      if (this.stageMoving) {
        noteInputAbsorbed(CARRY_TENDER_ABSORBER);
        return true;
      }
      if (intent.kind === 'nav') {
        const n = this.doorEntries.length;
        if (n === 0) {
          return true;
        }
        const step = intent.dir === 'right' || intent.dir === 'down' ? 1 : -1;
        this.tenderFocus = Math.max(0, Math.min(n - 1, this.tenderFocus + step));
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      if (intent.button === 'stickL') {
        void this.closeTenderList();
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
        void this.closeTenderList();
        return true;
      default:
        return true;
      }
    },
    /** A tender standing in its mode on the album: A executes it, B cancels, X reads its certificate; nothing else moves. */
    modeIntent(intent: GamepadIntent): boolean {
      const mode = this.tenderMode;
      if (mode === undefined || intent.kind !== 'press') {
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        if (this.tenderBusy === undefined) {
          this.$emit('executeTender', mode.instance);
        } else {
          noteInputAbsorbed(CARRY_TENDER_ABSORBER);
        }
        return true;
      case 'inspect': {
        const at = this.doorEntries.findIndex((e) => e.instance === mode.instance);
        this.openTenderZoom(at);
        return true;
      }
      case 'back':
        if (this.tenderBusy === undefined) {
          this.tenderMode = undefined;
        }
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
      if (this.tenderMode !== undefined) {
        return;
      }
      this.zone = 'album';
      this.cursor = i;
      this.toggleAt(i);
    },
    onPreludeClick(i: number): void {
      if (this.tenderMode !== undefined || this.preludeLimit === 0) {
        return;
      }
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
      if (this.sheet !== undefined) {
        return this.sheetIntent(intent);
      }
      if (this.stage === 'list' || this.stageMoving) {
        return this.tenderIntent(intent);
      }
      if (this.tenderMode !== undefined) {
        return this.modeIntent(intent);
      }
      // L3 — the tender door (the manifest's left block).
      if (intent.kind === 'press' && intent.button === 'stickL') {
        if (this.hasTenders) {
          void this.openTenderList();
        }
        return true;
      }
      if (intent.kind === 'nav') {
        this.disarm();
        const bandLive = this.preludeLimit > 0 && this.eligiblePreludes.length > 0;
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
          // ▲ against the album's top row reaches the prelude band (when it is live).
          if (intent.dir === 'up' && next === this.cursor && bandLive) {
            this.zone = 'preludes';
            this.preludeCursor = Math.min(this.preludeCursor, this.eligiblePreludes.length - 1);
            return true;
          }
          this.cursor = next;
        } else if (intent.dir === 'up' && bandLive) {
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
        this.$emit('back');
        return true;
      default:
        return true;
      }
    },
    /** X on the door — the holder's certificates in the ONE fullscreen viewer (§16.6), in the list's order. */
    openTenderZoom(at?: number): void {
      const entries = this.doorEntries;
      if (entries.length === 0) {
        return;
      }
      const list = entries.map((e) => tenderZoomEntry(e.id, {instance: e.instance, state: tenderCardStateOf(e.status)}));
      const portfolio = (this.$refs.portfolio ?? undefined) as {slotEl?: (instance: string) => HTMLElement | undefined} | undefined;
      const root = this.$el as HTMLElement | undefined;
      this.zoomOpenedHere = true;
      openConsoleCardZoom(list, Math.min(Math.max(at ?? this.tenderFocus, 0), list.length - 1), undefined, undefined, {
        contextLabel: 'Tenders',
        origin: {
          kind: 'physical',
          resolve: (i) => {
            const e = entries[i];
            if (e === undefined) {
              return null;
            }
            if (this.sheet !== undefined && this.sheet.instance === e.instance) {
              return this.sheetHeroEl();
            }
            return this.stage === 'list' ?
              portfolio?.slotEl?.(e.instance) ?? null :
              root?.querySelector<HTMLElement>(`[data-carry-tender-mini="${e.instance}"]`) ?? null;
          },
          onBrowse: (i) => {
            if (this.stage === 'list') {
              this.tenderFocus = i;
            }
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
