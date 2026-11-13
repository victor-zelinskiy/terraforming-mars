<template>
  <div ref="rootEl" class="con-carry" :class="{'con-carry--embedded': embedded, 'con-carry--confirmed': confirmed, 'con-carry--tendermode': tenderMode !== undefined}"
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

<script setup lang="ts">
/*
 * «НАСЛЕДИЕ ПРОЕКТОВ» — the interlude's step: up to `limit` cards of the viewer's terminal hand travel into the next
 * mission. P87 (the owner, 2026-11-01): it solved the hand's task in a language of its own — its own grid engine, its
 * own slots and sockets, its own cursor frame — and looked bad on a big hand; putting a card back meant pressing an
 * empty socket. It now stands on the HAND ALBUM'S CHASSIS:
 *
 *   · ONE album (`foundation/ConsoleCardAlbum` — the hand's planner and LESS mixins): strict pages from the box,
 *     the ONE cursor grammar, LB / RB and the d-pad across the edge turn the page, the spine in the foot;
 *   · keeping is a TOGGLE IN PLACE, as the patent sale's: A on a card stands it in its own slot with a kant and its
 *     ordinal band («✓ В миссию 2 · 1»), A on it again lets it go — the same key on the same object; nothing leaves
 *     the album before the confirm, an empty socket does not exist as a concept;
 *   · the SEAT MANIFEST under the question line names what is kept (a label — never a second face), so a many-page
 *     hand reads its legacy without turning back;
 *   · ONE head (`ConsoleWsHead`): the host's root › the mission the cards travel into › НАСЛЕДИЕ ПРОЕКТОВ (cyan →
 *     amber once confirmed); the limit is the SEAT's (`limit`, the server's number — never a client constant).
 *
 * «ТЕНДЕРЫ» (§19 — the owner, 2026-11-09): the legacy tenders execute on THIS page, because this page is what they
 * change. The door is the manifest's left block («ТЕНДЕРЫ» with the holder's certificates in miniature, L3 — the left
 * stick for the left door, as on the start); it says «МОЖНО ИСПОЛНИТЬ · N» while one can go. L3 parks the album and
 * stands the door's LIST (the ones that execute here first, the others with their reason); A on one hands the screen
 * back to the album where the tender stands in its MODE — the place it opens is PREVIEWED in the manifest (a dashed
 * ghost seat: «+1» for «Расширенное наследие», a prelude seat beside the project seats for «Продление программы»), the
 * crumb names the tender, the foot reads what it gives; A executes and the ghost MATERIALIZES in place; B cancels.
 *
 * HOSTED ONLY BY THE CAMPAIGN MAP (standalone screen + the endgame's embedded map scene). Input arrives via
 * `handleIntent`; the verbs render in the host's ONE command bar. RT confirms; a zero-card confirm over a real hand is
 * ARMED first (the first RT warns, the second confirms; B disarms). X inspects in the ONE `consoleCardZoom` pipeline
 * (A there is the same toggle). The ENTRY deal and the CONFIRM flight are the host's phrases around this surface
 * (`dealIn` / `keptFaces`).
 *
 * PRIVACY: this surface only ever receives the VIEWER's own cards.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CloneFlightHandle, flyCardClones} from '@/client/console/cardFlight/cloneFlights';
import {closeConsoleCardZoom, consoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
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
import {span, whenPainted} from '@/client/console/session/sessionWaits';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {vI18n} from '@/client/directives/vDirectives';

// (An exported type stands with the imports, above the script's first statement: the body of a Vapor script-setup block
// is a function body to the type checker, and an `export` below a statement is not at a module's top level there.)
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

defineOptions({name: 'ConsoleCarryoverPicker'});
const props = defineProps({
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
});
const emit = defineEmits(['toggle', 'togglePrelude', 'confirm', 'back', 'armChange', 'bar', 'executeTender']);

const flow = useFlowScope('console-carryover-picker');
const album = useTemplateRef<AlbumApi>('album');
const albumLayer = useTemplateRef<HTMLElement>('albumLayer');
const listLayer = useTemplateRef<HTMLElement>('listLayer');
const sheetEl = useTemplateRef<{heroEl?: () => HTMLElement | undefined}>('sheetEl');
const portfolio = useTemplateRef<{slotEl?: (instance: string) => HTMLElement | undefined}>('portfolio');
const flightLayer = useTemplateRef<HTMLElement>('flightLayer');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const cursor = ref(0);
/** The ARMED zero-carry confirm (the first RT warns, the second confirms; any other input disarms). */
const armed = ref(false);
/** A refusal named on the status line («seats are full»), for a beat. */
const notice = ref('');
let cancelNotice = (() => {}) as () => void;
const position = ref<CardAlbumPosition | undefined>(undefined);
/** Cards whose face waits for its own flight (the entry deal). */
const heldNames = ref<Array<string>>([]);
let flights: Array<CloneFlightHandle> = [];
const zoomOpenedHere = ref(false);
/** Where the cursor stands: the album, or the prelude band above it (↑ from the album's top row). */
const zone = ref('album' as 'album' | 'preludes');
const preludeCursor = ref(0);
/** The step's two layers: the ALBUM (always first) and the door's LIST (L3). */
const stage = ref('album' as 'list' | 'album');
/** The list's phrase is running (park / unpark) — input is absorbed for the beat. */
const stageMoving = ref(false);
const tenderFocus = ref(0);
/** A tender standing in its MODE on the album (§19): its place previewed, A executes, B cancels. */
const tenderMode = ref<{instance: string, id: TenderId} | undefined>(undefined);
/** The RT terminal warning stands: legacy tenders still executable — the next RT confirms anyway. */
const armedTenders = ref(false);
/** The seat an activation just materialized (its one-shot landing) and the miniature that took the stamp. */
const landedSeat = ref<string | undefined>(undefined);
const stamped = ref<string | undefined>(undefined);
let cancelLand = (() => {}) as () => void;
let absorbOff: (() => void) | undefined;
/** The ACTIVATION SHEET (§20): the tender chosen in the list, as the hero of its own scene. */
const sheet = ref<{instance: string, id: TenderId, phase: 'entering' | 'open' | 'committing' | 'leaving'} | undefined>(undefined);
const sheetHeroHeld = ref(false);
const sheetCommitted = ref(false);
const sheetStamping = ref(false);
/** List slots / door miniatures whose certificate is in the air (each waits for its own touchdown). */
const listHeld = ref<Array<string>>([]);
const miniHeld = ref<Array<string>>([]);
const sheetFlight = ref<CapturedFlight | undefined>(undefined);

/** Cards that no longer resolve in this build (post-update loss, §2.12). */
const unavailable = computed((): ReadonlyArray<CardName> => {
  return props.eligible.filter((name) => getCard(name) === undefined);
});
const entries = computed((): Array<CardAlbumEntry> => {
  return props.eligible.map((name) => {
    const seat = props.selected.indexOf(name);
    const vanished = unavailable.value.includes(name) && seat < 0;
    return {
      name,
      card: {name} as CardModel,
      picked: seat >= 0,
      band: seat >= 0 ? carryoverBandText(props.nextMission, seat + 1) : undefined,
      disabled: vanished,
      reason: vanished ? translateText('Unavailable in this build') : undefined,
    };
  });
});
/** The project seats — with the GHOST of the one a standing «Расширенное наследие» opens. */
const seats = computed((): Array<CarryoverSeat> => {
  return carryoverSeatsWithGhost(props.limit, props.selected, props.tenderSeats, tenderMode.value?.id === 'extendedLegacy');
});
/** The prelude seats beside them — with the GHOST of the one a standing «Продление программы» opens. */
const preludeSeats = computed((): Array<CarryoverSeat> => {
  return carryoverPreludeSeats(props.preludeLimit, props.selectedPreludes, tenderMode.value?.id === 'programExtension');
});
/**
 * The prelude band's place is RESERVED from the first frame whenever the seat can carry a prelude now or after an
 * activation here — so an activation never changes the album's size (the owner: «раскладка не должна меняться»).
 */
const preludeBandReserved = computed((): boolean => {
  return props.preludeLimit > 0 || portfolioEntries.value.some((e) => e.id === 'programExtension' && e.state === 'ready');
});
/** A standing «Продление программы» previews the band it unlocks. */
const previewPreludes = computed((): boolean => {
  return tenderMode.value?.id === 'programExtension';
});
const preludeAskText = computed((): string => {
  return carryoverPreludeAskText(props.preludeLimit, props.nextMission);
});
const preludeLockedText = computed((): string => {
  return translateText('Your played preludes — «Programme Extension» lets one travel into the finale');
});
/** The carried prelude's band — it always travels into the FINALE (the only mission a «Продление программы» reaches). */
const preludeBandText = computed((): string => {
  return '✓ ' + translateText('Into the finale');
});
const preludeSummaryText = computed((): string => {
  return translateTextWithParams('Prelude: ${0} / ${1}', [String(props.selectedPreludes.length), String(props.preludeLimit)]);
});
const preludeFull = computed((): boolean => {
  return props.selectedPreludes.length >= props.preludeLimit;
});
const missionLabel = computed((): string => {
  return translateTextWithParams('Mission ${0}', [String(props.nextMission)]);
});
/** The crumb's tail: the page · the door's list · the tender standing in its mode (its NAME — §19). */
const headStage = computed((): string => {
  if (sheet.value !== undefined) {
    return tenderPortfolioName(sheet.value.id);
  }
  if (stage.value === 'list') {
    return 'Tenders';
  }
  if (tenderMode.value !== undefined) {
    return tenderPortfolioName(tenderMode.value.id);
  }
  return 'Project legacy';
});
const askText = computed((): string => {
  return carryoverAskText(props.limit, props.nextMission);
});
const keepingText = computed((): string => {
  return translateTextWithParams('Keeping ${0} / ${1}', [String(props.selected.length), String(props.limit)]);
});
const full = computed((): boolean => {
  return props.selected.length >= props.limit;
});
/** The sheet's RESULT in the seat's own numbers. */
const sheetPlan = computed((): TenderActivationPlan | undefined => {
  const sheetNow = sheet.value;
  return sheetNow === undefined ? undefined : legacyActivationPlan(sheetNow.id, {
    limit: props.limit, handSize: props.eligible.length, preludeLimit: props.preludeLimit, playedPreludes: props.eligiblePreludes.length,
  });
});
const barFacts = computed((): CarryoverBarFacts => {
  if (sheet.value !== undefined) {
    return {primary: sheetPlan.value?.verb ?? 'Execute the tender', pages: 1, stage: 'sheet',
      primaryEnabled: sheet.value.phase === 'open' && props.tenderBusy === undefined};
  }
  if (stage.value === 'list') {
    const e = focusedTender.value;
    return {primary: 'Execute', pages: 1, stage: 'list', primaryEnabled: e !== undefined && e.state === 'ready' && props.tenderBusy === undefined};
  }
  if (tenderMode.value !== undefined) {
    return {primary: 'Execute the tender', pages: 1, stage: 'mode', primaryEnabled: props.tenderBusy === undefined};
  }
  return {
    primary: primaryLabel.value, pages: position.value?.pages ?? 1, stage: 'album', primaryEnabled: true,
    ...(hasTenders.value ? {door: {ready: doorReady.value}} : {}),
  };
});
const hasTenders = computed((): boolean => {
  return props.tenders.length > 0;
});
/** Every holding on the THRESHOLD in acquisition order — the seat's limit, the hand, the played preludes are what each changes. */
const portfolioEntries = computed((): ReadonlyArray<TenderPortfolioEntry> => {
  if (!hasTenders.value) {
    return [];
  }
  return tenderPortfolio({
    place: 'threshold', tenders: props.tenders, limit: props.limit, handSize: props.eligible.length,
    playedPreludes: props.eligiblePreludes.length, preludeLimit: props.preludeLimit,
  });
});
/** …in the DOOR's order: the ones that execute here first, then the others with their reason. */
const doorEntries = computed((): ReadonlyArray<TenderPortfolioEntry> => {
  return tenderDoorList(portfolioEntries.value);
});
const portfolioCounts = computed((): {executed: number, open: number, total: number} => {
  return tenderPortfolioCounts(portfolioEntries.value);
});
const doorReady = computed((): number => {
  return tenderMode.value === undefined ? tenderReadyHere(portfolioEntries.value) : 0;
});
const doorReadyText = computed((): string => {
  return translateTextWithParams('Can execute: ${0}', [String(doorReady.value)]);
});
const focusedTender = computed((): TenderPortfolioEntry | undefined => {
  return doorEntries.value[tenderFocus.value];
});
/** The standing mode's reading — what the press opens, in the seat's own numbers. */
const tenderModeReading = computed((): string => {
  const mode = tenderMode.value;
  const entry = mode === undefined ? undefined : portfolioEntries.value.find((e) => e.instance === mode.instance);
  return entry === undefined ? '' : readingText({label: entry.reading.key, params: [...entry.reading.params]});
});
/** The legacy tenders still executable here — what the readiness press would leave to the buyout. */
const openLegacyTenders = computed((): ReadonlyArray<TenderPortfolioEntry> => {
  return portfolioEntries.value.filter((e) => e.state === 'ready');
});
const tenderWarningText = computed((): string => {
  const names = openLegacyTenders.value.map((e) => translateText(tenderPortfolioName(e.id))).join(' · ');
  return translateTextWithParams('Unexecuted: ${0}', [names]) + ' — ' +
    translateTextWithParams('Unexecuted tenders of this step are bought back for ${0} M€ each after the launch — press again to confirm anyway', [String(TENDER_COMPENSATION_MC)]);
});
/** The A verb for the focused object — the bar reads it (one key, one object, two words). */
const primaryLabel = computed((): string => {
  if (zone.value === 'preludes') {
    const prelude = props.eligiblePreludes[preludeCursor.value];
    return prelude !== undefined && props.selectedPreludes.includes(prelude) ? 'Leave the prelude behind' : 'Carry the prelude';
  }
  const name = props.eligible[cursor.value];
  return name !== undefined && props.selected.includes(name) ? 'Return to hand' : 'Keep for the next mission';
});

function tenderNameOf(id: TenderId): string {
  return tenderPortfolioName(id);
}
function albumApi(): AlbumApi | undefined {
  return album.value ?? undefined;
}
function disarm(): void {
  if (armed.value || armedTenders.value) {
    armed.value = false;
    armedTenders.value = false;
    emit('armChange', false);
  }
}
// ── THE TENDER DOOR (§19) ──
/** L3 on the album: the album PARKS on the spot and the door's list surfaces in its place (the start's phrase). */
async function openTenderList(): Promise<void> {
  if (!hasTenders.value || stage.value !== 'album' || stageMoving.value || tenderMode.value !== undefined) {
    return;
  }
  disarm();
  stageMoving.value = true;
  try {
    await parkSurface(albumLayer.value, 1);
    tenderFocus.value = 0;
    stage.value = 'list';
    await nextTick();
    fitList();
    await unparkSurface(listLayer.value, 1);
  } finally {
    stageMoving.value = false;
  }
}
/** B / L3 from the list — the exact mirror; `then` runs once the ALBUM is the surface on screen. */
async function closeTenderList(then?: () => void): Promise<void> {
  if (stage.value !== 'list' || stageMoving.value) {
    return;
  }
  stageMoving.value = true;
  try {
    await parkSurface(listLayer.value, -1);
    stage.value = 'album';
    then?.();
    await nextTick();
    await unparkSurface(albumLayer.value, -1);
  } finally {
    stageMoving.value = false;
  }
}
/** A on a certificate in the list: one that executes here stands on the album in its MODE; any other says why. */
function pressTender(): void {
  const e = focusedTender.value;
  if (e === undefined || props.tenderBusy !== undefined) {
    return;
  }
  if (e.state !== 'ready') {
    if (e.note !== undefined) {
      say(e.note);
    }
    return;
  }
  void openSheet(e);
}
// ── THE ACTIVATION SHEET (§20) ──
function sheetHeroEl(): HTMLElement | null {
  const sheet = sheetEl.value ?? undefined;
  return sheet?.heroEl?.() ?? null;
}
// (Both are a flight's TARGET: the flight asks again on every frame it measures, and those frames are the session's —
// they outlive this surface. The root's ref is `null` once the picker has left, so the guard answers «no target».)
function listSlotEl(instance: string): HTMLElement | null {
  const rootNow = rootEl.value;
  if (rootNow === null) {
    return null;
  }
  return rootNow.querySelector<HTMLElement>(`[data-tport-slot="${instance}"]`);
}
function doorMiniEl(instance: string): HTMLElement | null {
  const rootNow = rootEl.value;
  if (rootNow === null) {
    return null;
  }
  return rootNow.querySelector<HTMLElement>(`[data-carry-tender-mini="${instance}"]`);
}
/** The list's certificate size — as large as the layer allows for the whole row (the start's own rule). */
function fitList(): void {
  const pane = listLayer.value ?? undefined;
  const list = pane?.querySelector<HTMLElement>('.con-tport');
  if (pane === undefined || list === null || list === undefined || pane.clientHeight < 40) {
    return;
  }
  const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const count = Math.max(1, doorEntries.value.length);
  const gap = 1.6 * rem;
  const foot = pane.querySelector<HTMLElement>('.con-carry__foot--tenders')?.offsetHeight ?? 0;
  const availW = pane.clientWidth - 2.4 * rem - gap * (count - 1);
  const availH = pane.clientHeight - foot - 7.2 * rem;
  const w = Math.max(6 * rem, Math.min(availW / count, availH / 1.42, 20 * rem));
  list.style.setProperty('--tport-w', `${Math.round(w)}px`);
}
/** The hero's size — solved from the list layer's own box (the certificate is the scene's hero by size). */
function fitSheet(): void {
  const pane = listLayer.value ?? undefined;
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
}
/** A on a certificate of this step: the list lets it go — it is CARRIED onto the sheet's hero seat (one object). */
async function openSheet(e: TenderPortfolioEntry): Promise<void> {
  if (sheet.value !== undefined) {
    return;
  }
  const from = listSlotEl(e.instance);
  const flight = captureCards(from !== null ? [{name: e.instance as CardName, el: from}] : []);
  sheetFlight.value = flight;
  sheetHeroHeld.value = true;
  sheetCommitted.value = false;
  sheet.value = {instance: e.instance, id: e.id, phase: 'entering'};
  await nextTick();
  fitSheet();
  // Two painted frames (a layout settled before a flight measures it) — bounded where nothing paints.
  await whenPainted(2, 400, flow);
  await flight.flyTo(() => sheetHeroEl(), () => {
    sheetHeroHeld.value = false;
  }, {reseat: true});
  sheetFlight.value = undefined;
  sheetHeroHeld.value = false;
  if (sheet.value?.instance === e.instance && sheet.value.phase === 'entering') {
    sheet.value = {...sheet.value, phase: 'open'};
  }
}
/** B on the sheet — ONE level: the hero is carried back into its list slot. */
async function closeSheet(): Promise<void> {
  const sheetNow = sheet.value;
  if (sheetNow === undefined || sheetNow.phase !== 'open') {
    return;
  }
  const hero = sheetHeroEl();
  const flight = captureCards(hero !== null ? [{name: sheetNow.instance as CardName, el: hero}] : []);
  sheetFlight.value = flight;
  listHeld.value = [sheetNow.instance];
  sheet.value = undefined;
  tenderFocus.value = Math.max(0, doorEntries.value.findIndex((d) => d.instance === sheetNow.instance));
  await nextTick();
  await whenPainted(2, 400, flow);
  await flight.flyTo(() => listSlotEl(sheetNow.instance), () => {
    listHeld.value = [];
  }, {reseat: true});
  sheetFlight.value = undefined;
  listHeld.value = [];
}
/**
 * THE ACTIVATION — the stamp comes down on the hero, the sheet folds, the album comes back with the GHOST of the
 * place this tender opens, the certificate flies home into its miniature; then the answer goes out and the ghost
 * materializes in place (the `tenders` watcher's landing). A refusal leaves the ghost standing — B cancels it.
 */
async function commitSheet(): Promise<void> {
  const sheetNow = sheet.value;
  if (sheetNow === undefined || sheetNow.phase !== 'open' || props.tenderBusy !== undefined) {
    return;
  }
  sheet.value = {...sheetNow, phase: 'committing'};
  sheetCommitted.value = true;
  sheetStamping.value = true;
  flow.after(motionMs(620), 'the sheet\'s stamp beat ends', () => {
    sheetStamping.value = false;
  });
  await span(motionMs(560));
  const hero = sheetHeroEl();
  const flight = captureCards(hero !== null ? [{name: sheetNow.instance as CardName, el: hero}] : []);
  sheetFlight.value = flight;
  sheetHeroHeld.value = true;
  sheet.value = {...sheetNow, phase: 'leaving'};
  stageMoving.value = true;
  try {
    await parkSurface(listLayer.value, -1);
    sheet.value = undefined;
    miniHeld.value = [sheetNow.instance];
    stage.value = 'album';
    tenderMode.value = {instance: sheetNow.instance, id: sheetNow.id};
    await nextTick();
    await Promise.all([
      unparkSurface(albumLayer.value, -1),
      flight.flyTo(() => doorMiniEl(sheetNow.instance), () => {
        miniHeld.value = [];
      }, {reseat: false, pressElFor: () => doorMiniEl(sheetNow.instance)}),
    ]);
  } finally {
    sheetFlight.value = undefined;
    miniHeld.value = [];
    sheetHeroHeld.value = false;
    stageMoving.value = false;
  }
  emit('executeTender', sheetNow.instance);
}
/** The sheet's pad: A executes, X reads the hero, B / L3 one level back to the list; nothing else moves. */
function sheetIntent(intent: GamepadIntent): boolean {
  const sheetNow = sheet.value;
  if (sheetNow === undefined || sheetNow.phase !== 'open') {
    noteInputAbsorbed(CARRY_TENDER_ABSORBER);
    return true;
  }
  if (intent.kind !== 'press') {
    return true;
  }
  if (intent.button === 'stickL') {
    void closeSheet();
    return true;
  }
  switch (consoleActionOf(intent, {})) {
  case 'primary':
    void commitSheet();
    return true;
  case 'inspect':
    openTenderZoom(doorEntries.value.findIndex((d) => d.instance === sheetNow.instance));
    return true;
  case 'back':
    void closeSheet();
    return true;
  default:
    return true;
  }
}
/** The list's pad: ◀ ▶ walk the certificates, A chooses, X reads, B / L3 return to the album. */
function tenderIntent(intent: GamepadIntent): boolean {
  if (stageMoving.value) {
    noteInputAbsorbed(CARRY_TENDER_ABSORBER);
    return true;
  }
  if (intent.kind === 'nav') {
    const n = doorEntries.value.length;
    if (n === 0) {
      return true;
    }
    const step = intent.dir === 'right' || intent.dir === 'down' ? 1 : -1;
    tenderFocus.value = Math.max(0, Math.min(n - 1, tenderFocus.value + step));
    return true;
  }
  if (intent.kind !== 'press') {
    return true;
  }
  if (intent.button === 'stickL') {
    void closeTenderList();
    return true;
  }
  const action = consoleActionOf(intent, {});
  switch (action) {
  case 'primary':
    pressTender();
    return true;
  case 'inspect':
    openTenderZoom();
    return true;
  case 'back':
    void closeTenderList();
    return true;
  default:
    return true;
  }
}
/** A tender standing in its mode on the album: A executes it, B cancels, X reads its certificate; nothing else moves. */
function modeIntent(intent: GamepadIntent): boolean {
  const mode = tenderMode.value;
  if (mode === undefined || intent.kind !== 'press') {
    return true;
  }
  const action = consoleActionOf(intent, {});
  switch (action) {
  case 'primary':
    if (props.tenderBusy === undefined) {
      emit('executeTender', mode.instance);
    } else {
      noteInputAbsorbed(CARRY_TENDER_ABSORBER);
    }
    return true;
  case 'inspect': {
    const at = doorEntries.value.findIndex((e) => e.instance === mode.instance);
    openTenderZoom(at);
    return true;
  }
  case 'back':
    if (props.tenderBusy === undefined) {
      tenderMode.value = undefined;
    }
    return true;
  default:
    return true;
  }
}
function say(noticeNow: string): void {
  notice.value = noticeNow;
  cancelNotice();
  cancelNotice = flow.after(motionMs(NOTICE_MS), 'the picker\'s notice has been read', () => {
    notice.value = '';
  });
}
function onCardClick(i: number): void {
  if (tenderMode.value !== undefined) {
    return;
  }
  zone.value = 'album';
  cursor.value = i;
  toggleAt(i);
}
function onPreludeClick(i: number): void {
  if (tenderMode.value !== undefined || props.preludeLimit === 0) {
    return;
  }
  zone.value = 'preludes';
  preludeCursor.value = i;
  togglePreludeAt(i);
}
function preludeCard(name: CardName): CardModel {
  return {name} as CardModel;
}
/** THE PRELUDE TOGGLE — carry / leave the same prelude with the same key; a full allowance is a NAMED refusal. */
function togglePreludeAt(i: number): void {
  const name = props.eligiblePreludes[i];
  if (name === undefined || props.submitting) {
    return;
  }
  disarm();
  if (props.selectedPreludes.includes(name)) {
    emit('togglePrelude', name);
    return;
  }
  if (preludeFull.value) {
    say('Only ${0} prelude(s) can be carried — leave one behind first');
    return;
  }
  emit('togglePrelude', name);
}
/** THE TOGGLE IN PLACE — keep / return the same card with the same key; a full set of seats is a NAMED refusal. */
function toggleAt(i: number): void {
  const name = props.eligible[i];
  if (name === undefined || props.submitting) {
    return;
  }
  disarm();
  if (props.selected.includes(name)) {
    emit('toggle', name);
    return;
  }
  if (unavailable.value.includes(name)) {
    say('Unavailable in this build');
    return;
  }
  if (full.value) {
    say(props.limit === 0 ? 'No project card can be carried into this mission' : 'Seats are full — return a card to keep another');
    return;
  }
  emit('toggle', name);
}
function turnPage(dir: 1 | -1): void {
  const album = albumApi();
  if (album !== undefined) {
    cursor.value = album.jumpPage(cursor.value, dir);
  }
}
/** The host routes pad intents here. Returns true when consumed. */
function handleIntent(intent: GamepadIntent): boolean {
  if (consoleCardZoom.card !== undefined || props.submitting) {
    return true; // the zoom host owns the pad while its viewer is up
  }
  if (sheet.value !== undefined) {
    return sheetIntent(intent);
  }
  if (stage.value === 'list' || stageMoving.value) {
    return tenderIntent(intent);
  }
  if (tenderMode.value !== undefined) {
    return modeIntent(intent);
  }
  // L3 — the tender door (the manifest's left block).
  if (intent.kind === 'press' && intent.button === 'stickL') {
    if (hasTenders.value) {
      void openTenderList();
    }
    return true;
  }
  if (intent.kind === 'nav') {
    disarm();
    const bandLive = props.preludeLimit > 0 && props.eligiblePreludes.length > 0;
    if (zone.value === 'preludes') {
      // The band: ◀ ▶ along the preludes; ▼ (or ▲ with no album to fall into) returns to the album.
      const n = props.eligiblePreludes.length;
      if (intent.dir === 'left' || intent.dir === 'right') {
        const step = intent.dir === 'left' ? -1 : 1;
        preludeCursor.value = Math.max(0, Math.min(Math.max(0, n - 1), preludeCursor.value + step));
      } else if (intent.dir === 'down' && props.eligible.length > 0) {
        zone.value = 'album';
      }
      return true;
    }
    const album = albumApi();
    if (album !== undefined) {
      const next = album.step(cursor.value, intent.dir);
      // ▲ against the album's top row reaches the prelude band (when it is live).
      if (intent.dir === 'up' && next === cursor.value && bandLive) {
        zone.value = 'preludes';
        preludeCursor.value = Math.min(preludeCursor.value, props.eligiblePreludes.length - 1);
        return true;
      }
      cursor.value = next;
    } else if (intent.dir === 'up' && bandLive) {
      zone.value = 'preludes';
    }
    return true;
  }
  if (intent.kind === 'press' && intent.button === 'triggerR') {
    // THE TERMINAL WARNING first: a legacy tender still executable would go to the buyout past the readiness.
    if (openLegacyTenders.value.length > 0 && !armedTenders.value) {
      armedTenders.value = true;
      emit('armChange', true);
      return true;
    }
    if (props.selected.length === 0 && props.eligible.length > 0 && props.limit > 0 && !armed.value) {
      armed.value = true;
      emit('armChange', true);
      return true;
    }
    emit('confirm');
    return true;
  }
  const action = consoleActionOf(intent, {});
  switch (action) {
  case 'primary':
    if (zone.value === 'preludes') {
      togglePreludeAt(preludeCursor.value);
    } else {
      toggleAt(cursor.value);
    }
    return true;
  case 'inspect':
    disarm();
    if (zone.value === 'preludes') {
      openPreludeZoom(preludeCursor.value);
    } else {
      openZoom(cursor.value);
    }
    return true;
  case 'prevSection':
  case 'nextSection':
    disarm();
    turnPage(action === 'nextSection' ? 1 : -1);
    return true;
  case 'back':
    if (armed.value || armedTenders.value) {
      disarm();
      return true;
    }
    emit('back');
    return true;
  default:
    return true;
  }
}
/** X on the door — the holder's certificates in the ONE fullscreen viewer (§16.6), in the list's order. */
function openTenderZoom(at?: number): void {
  const entries = doorEntries.value;
  if (entries.length === 0) {
    return;
  }
  const list = entries.map((e) => tenderZoomEntry(e.id, {instance: e.instance, state: tenderCardStateOf(e.status)}));
  const portfolioNow = portfolio.value ?? undefined;
  const root = rootEl.value ?? undefined;
  zoomOpenedHere.value = true;
  openConsoleCardZoom(list, Math.min(Math.max(at ?? tenderFocus.value, 0), list.length - 1), undefined, undefined, {
    contextLabel: 'Tenders',
    origin: {
      kind: 'physical',
      resolve: (i) => {
        const e = entries[i];
        if (e === undefined) {
          return null;
        }
        if (sheet.value !== undefined && sheet.value.instance === e.instance) {
          return sheetHeroEl();
        }
        return stage.value === 'list' ?
          portfolioNow?.slotEl?.(e.instance) ?? null :
          root?.querySelector<HTMLElement>(`[data-carry-tender-mini="${e.instance}"]`) ?? null;
      },
      onBrowse: (i) => {
        if (stage.value === 'list') {
          tenderFocus.value = i;
        }
      },
    },
  });
}
// ── X — the ONE console zoom pipeline; the card lifts out of its album slot, A there is the same toggle ──
function openZoom(at: number): void {
  if (props.eligible.length === 0) {
    return;
  }
  const list = props.eligible.map((name) => ({name} as CardModel));
  const index = Math.min(Math.max(at, 0), list.length - 1);
  zoomOpenedHere.value = true;
  openConsoleCardZoom(list, index, {
    isSelected: (name) => props.selected.includes(name),
    toggle: (name) => {
      const i = props.eligible.indexOf(name);
      if (i >= 0) {
        toggleAt(i);
      }
    },
  }, undefined, {
    contextLabel: 'Project legacy',
    origin: {
      kind: 'physical',
      resolve: (i) => {
        const name = props.eligible[i];
        return name !== undefined ? albumApi()?.slotEl(name) ?? null : null;
      },
      // LB / RB inside the viewer keeps the album's cursor (and its page) in lockstep.
      onBrowse: (i) => {
        cursor.value = i;
      },
    },
  });
}
/** X on the band — the same ONE zoom pipeline over the played preludes; A there is the same toggle. */
function openPreludeZoom(at: number): void {
  if (props.eligiblePreludes.length === 0) {
    return;
  }
  const list = props.eligiblePreludes.map((name) => ({name} as CardModel));
  const index = Math.min(Math.max(at, 0), list.length - 1);
  zoomOpenedHere.value = true;
  openConsoleCardZoom(list, index, {
    isSelected: (name) => props.selectedPreludes.includes(name),
    toggle: (name) => {
      const i = props.eligiblePreludes.indexOf(name);
      if (i >= 0) {
        togglePreludeAt(i);
      }
    },
  }, undefined, {
    contextLabel: 'Programme Extension',
    origin: {
      kind: 'physical',
      resolve: (i) => {
        const name = props.eligiblePreludes[i];
        const root = rootEl.value ?? undefined;
        return name !== undefined ? root?.querySelector<HTMLElement>(`[data-carry-prelude="${CSS.escape(name)}"]`) ?? null : null;
      },
      onBrowse: (i) => {
        preludeCursor.value = i;
      },
    },
  });
}
// ── the host's phrases ──────────────────────────────────────────────
/**
 * THE ENTRY DEAL — the active page's cards arrive from `from` (the viewer's seat row: «the cards of your hand from
 * the finished mission») into their slots, each slot's face held until its own touchdown. Reduced motion / an
 * unmeasurable end → the album simply stands (nothing is withheld).
 */
function dealIn(from: DOMRect | undefined): void {
  const album = albumApi();
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
  heldNames.value = [...names];
  // The layer is the convoy's own: it leaves with the last card (a lingering empty layer is a leak).
  const flight: CloneFlightHandle = flyCardClones({
    names,
    sourceEl: (n) => album.faceEl(n),
    from: fromMap,
    to,
    layerClass: 'con-carry-flight',
    onLand: (n) => {
      heldNames.value = heldNames.value.filter((x) => x !== n);
    },
    onDone: () => {
      heldNames.value = [];
      flight.dispose();
      flights = flights.filter((x) => x !== flight);
    },
    travelMs: 380,
    staggerMs: 60,
  });
  flights.push(flight);
}
/** The KEPT cards' faces as they stand now — the confirm flight's sources (armed before the POST). */
function keptFaces(): Map<CardName, {el: HTMLElement, rect: DOMRect}> {
  const out = new Map<CardName, {el: HTMLElement, rect: DOMRect}>();
  const album = albumApi();
  for (const name of props.selected) {
    const el = album?.faceEl(name) ?? null;
    const rect = el?.getBoundingClientRect();
    // Only a face ON SCREEN is a flight's source (a neighbour page is mounted beyond the clip).
    if (el !== null && rect !== undefined && rect.width >= 8 && rect.right > 0 && rect.left < window.innerWidth) {
      out.set(name, {el, rect});
    }
  }
  return out;
}

watch(() => props.selected.length, (): void => {
  disarm();
});
/**
 * AN ACTIVATION LANDED (a holding turned executed): the ghost the mode stood in the manifest is now the REAL place
 * — the same node (its key is the seat's number), so it materializes in place: the dashed ghost takes the solid
 * kant and the one-shot landing; the miniature in the door takes the Committee's stamp; the mode ends. A prelude
 * seat unlocks the band above the album (its place was reserved — nothing re-flows).
 */
watch(() => props.tenders, (now: ReadonlyArray<CarryoverTenderModel>, before: ReadonlyArray<CarryoverTenderModel>): void => {
  const wasHeld = new Set(before.filter((t) => t.status === 'held').map((t) => t.instance));
  const landed = now.filter((t) => t.status === 'executed' && wasHeld.has(t.instance));
  if (landed.length === 0) {
    return;
  }
  const t = landed[0];
  if (tenderMode.value?.instance === t.instance) {
    tenderMode.value = undefined;
  }
  landedSeat.value = t.id === 'extendedLegacy' ? 'seat' + props.limit : t.id === 'programExtension' ? 'pseat' + props.preludeLimit : undefined;
  stamped.value = t.instance;
  cancelLand();
  cancelLand = flow.after(motionMs(SEAT_LANDED_MS), 'the materialized seat\'s landing ends', () => {
    landedSeat.value = undefined;
    stamped.value = undefined;
  });
  // «Продление программы»: the band is live now — the cursor goes where the choice is.
  if (t.id === 'programExtension' && props.eligiblePreludes.length > 0) {
    zone.value = 'preludes';
    preludeCursor.value = 0;
  }
});
/** The facts the host's ONE bar reads: the A verb for the focused card and whether pages exist. */
watch(() => barFacts.value, (now: CarryoverBarFacts): void => {
  emit('bar', now);
}, {immediate: true});

onMounted(() => {
  absorbOff = registerInputAbsorber(CARRY_TENDER_ABSORBER,
    () => stageMoving.value || props.tenderBusy !== undefined || (sheet.value !== undefined && sheet.value.phase !== 'open'), {scope: 'all'});
  registerStartDockLayer(flightLayer.value ?? undefined);
});
onBeforeUnmount(() => {
  absorbOff?.();
  sheetFlight.value?.dispose();
  registerStartDockLayer(undefined);
  for (const f of flights) {
    f.dispose();
  }
  flights = [];
  if (zoomOpenedHere.value && consoleCardZoom.card !== undefined) {
    closeConsoleCardZoom();
  }
  zoomOpenedHere.value = false;
});
defineExpose({dealIn, handleIntent, keptFaces});
</script>
