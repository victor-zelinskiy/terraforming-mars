<template>
  <!--
    CONSOLE «РАЗЫГРАНО» — the console-native played-cards TABLE (X from the
    board home). THE TABLE IS A TABLE (TR65): it stands in the central opening
    like every workspace screen, its faces are readable from the couch (the
    hand album's density), its zones are SHELVES on album pages, the
    corporation is the HERO of the identity column and the events lie face
    down beneath it. Nothing is a peek pile any more.

    NAVIGATION IS BY ZONE (the per-card cursor is gone by design): the d-pad
    moves between the zone blocks (corporation / events in the identity
    column, the shelf runs of the active page), A opens the focused zone — its
    cards physically LIFT off their real slots and fly into the category view
    (ConsolePlayedCategoryView owns that whole transition; face-down events
    flip open mid-flight; a card on another page flies in from beyond the
    album's edge). Closing flies them back onto the table. LT/RT turn the
    album's pages; a zone the cursor reaches on another page turns it too.

    View-only: nothing here ever submits. Input is delegated by the shell
    (handleIntent); command-bar hints are mirrored through consolePlayedUi.
  -->
  <!-- `con-ws` + `data-motion-surface` (standalone host only): the workspace
       family's marker and the surface-motion entrance — the player rail stays
       lit left of the table, the strategy rail yields its zone (the shell's
       policy), the frame materializes in place. The EMBEDDED re-seat lives
       inside the Information Workspace, which owns its own chassis. The HERO
       scene mounts without the entrance (its landing is measured on the first
       frames — a materialize would move the target under the flight). -->
  <div class="con-played"
       :class="{'con-played--hero': heroActive, 'con-played--catview': categoryUp, 'con-played--embedded': embedded, 'con-ws': !embedded, 'con-played--live': pageLive && !heroActive}"
       :data-motion-surface="embedded || heroActive ? undefined : 'played'"
       :data-played-page="activePage"
       :data-played-pages="pageCount">
    <div v-if="!embedded" class="con-played__backdrop" aria-hidden="true"></div>
    <div class="con-played__panel" :data-motion-panel="embedded ? undefined : ''">
      <!-- THE WORKSPACE HEADER (standalone): the ONE crumb grammar — РАЗЫГРАНО › ‹участник› › ‹зона›. The seat is
           the SUBJECT (LB/RB recompose it), the open category is the STAGE (the only other animating segment). The
           EMBEDDED host's own header already reads ИНФОРМАЦИЯ › ‹участник› › РАЗЫГРАНО · ‹зона›. -->
      <ConsoleWsHead v-if="!embedded" class="con-played__head"
                     root="Played"
                     :subject="viewedDisplayName"
                     subjectRaw
                     :stage="crumbStage">
        <template #trailing>
          <span class="con-played__meta">
            <span class="con-status__dot" :class="'player_bg_color_' + viewedPlayer.color" aria-hidden="true"></span>
            <span class="con-played__total">
              <span class="con-played__total-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
              <b>{{ totalCount }}</b>
            </span>
          </span>
        </template>
      </ConsoleWsHead>
      <!-- The Automa's table is EVERYTHING it flipped from its action deck —
           an honest provenance line, one calm sentence under the head
           (visible prose, never a hover-only hint). -->
      <div v-if="viewedIsBot" class="con-played__provenance" v-i18n>Everything MarsBot flipped from its action deck this game</div>

      <div class="con-played__body" ref="body">
        <!-- Truly empty tableau — a PREPARED table, never a bare panel: the identity column's empty card place and
             one calm line where the shelves will be. The bot's corporation slot counts as table content. -->
        <div v-if="emptyTable" class="con-played__table con-played__table--void" :style="tableStyle">
          <aside class="con-played__identity" :style="{width: plan.identityW + 'px'}">
            <div class="con-played__family con-played__family--identity con-played__family--corporation con-played__family--empty">
              <span class="con-played__caption"><span v-i18n>Corporation</span></span>
              <div class="con-played__seat-place" :style="{width: plan.hero.slotW + 'px', height: plan.hero.slotH + 'px'}" aria-hidden="true"></div>
            </div>
          </aside>
          <div class="con-played__album con-played__album--void">
            <div class="con-played__void">
              <span class="con-played__void-glyph" aria-hidden="true">◈</span>
              <span v-i18n>No cards played yet</span>
            </div>
          </div>
        </div>

        <div v-else class="con-played__table" :style="tableStyle">
          <!-- ── THE IDENTITY COLUMN — who the player is, and what they have spent (the events). On every page. ── -->
          <aside class="con-played__identity" :style="{width: plan.identityW + 'px'}">
            <!-- The BOT's corporation — its own entity (bot rules, original identity). Lives in the same hero place a
                 human's corporation takes; A/X opens the fullscreen inspect (physical lift via data-zoom-slot). -->
            <div v-if="botCorp !== undefined"
                 class="con-played__family con-played__family--identity con-played__family--corporation"
                 :class="familyClasses('botcorp')"
                 data-played-cat="botcorp"
                 @click="onBotCorpPress()">
              <span class="con-played__caption">
                <span v-i18n>Corporation</span>
                <span class="con-played__caption-open" v-i18n>Open</span>
              </span>
              <div class="con-played__hero">
                <div class="con-played__slot con-played__botcorp" :style="{width: plan.hero.slotW + 'px', height: plan.hero.slotH + 'px'}" :data-zoom-slot="botCorp.id">
                  <div class="con-played__lift">
                    <div class="con-played__face con-played__focusbox" :style="{zoom: String(plan.hero.zoom)}">
                      <MarsBotCorpFace :id="botCorp.id" :resources="botCorp.resources" :resource="botCorp.resource" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- The corporation(s) — the HERO: larger than a shelf face, its stored resources live on its own face. -->
            <div v-else-if="zones.corporations.length > 0"
                 class="con-played__family con-played__family--identity con-played__family--corporation"
                 :class="familyClasses('corporation')"
                 data-played-cat="corporation"
                 @click="onFamilyPress('corporation')">
              <span class="con-played__caption">
                <span v-i18n>Corporation</span>
                <b v-if="zones.corporations.length > 1" class="con-played__caption-count">{{ familyCount(zones.corporations) }}</b>
                <span class="con-played__caption-open" v-i18n>Open</span>
              </span>
              <div class="con-played__hero">
                <ConsolePlayedShelf :cards="zones.corporations" :hiddenKey="heroHiddenKey" :outNames="outNames" :grounded="groundedNames"
                                    :zoom="plan.hero.zoom" :slotW="plan.hero.slotW" :slotH="plan.hero.slotH" :gapX="plan.album.rowGap" column live />
              </div>
            </div>
            <!-- A human seat before its corporation (never past the start) — the prepared place stays honest. -->
            <div v-else class="con-played__family con-played__family--identity con-played__family--corporation con-played__family--empty">
              <span class="con-played__caption"><span v-i18n>Corporation</span></span>
              <div class="con-played__seat-place" :style="{width: plan.hero.slotW + 'px', height: plan.hero.slotH + 'px'}" aria-hidden="true"></div>
            </div>

            <!-- Events — face down, one pile, per the printed rules. During the hero scene the pile shows the
                 PRE-play count (the counter ticks only after the landed card is committed), and a first-ever event
                 reserves a HIDDEN pile so the arc has a real target. The box is reserved always: the first event's
                 landing never moves the hero. -->
            <div v-if="zones.events.length > 0"
                 class="con-played__family con-played__family--event"
                 :class="familyClasses('events')"
                 data-played-cat="events"
                 @click="onFamilyPress('events')">
              <span class="con-played__caption">
                <span v-i18n>Events</span>
                <b class="con-played__caption-count">{{ familyCount(zones.events) }}</b>
                <span class="con-played__caption-open" v-i18n>Open</span>
              </span>
              <ConsolePlayedEventsPile :count="displayedEventsCount"
                                       :reserved="eventsPileReserved"
                                       :focused="focusCategory === 'events'"
                                       :out="eventsOut"
                                       :slotW="plan.events.slotW" :cardH="plan.events.slotH" />
            </div>
            <div v-else class="con-played__family con-played__family--event con-played__family--empty" aria-hidden="true">
              <span class="con-played__caption"><span v-i18n>Events</span></span>
              <div class="con-played__seat-place con-played__seat-place--events" :style="{width: plan.events.slotW + 'px', height: plan.events.slotH + 'px'}"></div>
            </div>
          </aside>

          <!-- ── THE SHELF ALBUM — the project zones as runs of full faces on strict pages. ── -->
          <div class="con-played__album" ref="album" @wheel.prevent="onWheel" @scroll.passive="pinScroll">
            <!-- Identity-only tableau: the shelves' place stays honest — a quiet line, never a bare half. -->
            <div v-if="projectsEmpty" class="con-played__none">
              <span class="con-played__none-shelf" aria-hidden="true"></span>
              <span v-i18n>No played projects yet</span>
            </div>
            <div v-else class="con-played__pagestrip" :class="{'con-played__pagestrip--turning': turning}" :style="stripStyle" @transitionend.self="onStripSettled">
              <div v-for="p in renderPages" :key="'page' + p" class="con-played__page" :style="pageStyle(p)" :data-played-page-index="p">
                <div v-for="(row, ri) in pages[p].rows" :key="ri" class="con-played__row" :style="{columnGap: plan.album.gapX + 'px'}">
                  <!-- A RUN is the zone's block on this row: its caption lane + its shelf. The run carries the zone's
                       focus (every run of the zone on the page rings together) and its `data-played-cat` on the
                       zone's FIRST run of the page (one navigation target per zone). -->
                  <div v-for="run in row.runs" :key="run.zone + ':' + run.start"
                       class="con-played__family con-played__run"
                       :class="[familyClass(run.zone), familyClasses(run.zone)]"
                       :data-played-cat="isFirstRunOnPage(p, run) ? run.zone : undefined"
                       :data-played-run="run.zone"
                       @click="onFamilyPress(run.zone)">
                    <span class="con-played__caption" :style="{height: plan.album.captionH + 'px'}">
                      <span>{{ $t(zoneLabel(run.zone)) }}</span>
                      <b class="con-played__caption-count" :class="{'con-played__caption-count--range': !run.first}">{{ runCount(run) }}</b>
                      <span v-if="isFirstRunOnPage(p, run)" class="con-played__caption-open" v-i18n>Open</span>
                    </span>
                    <ConsolePlayedShelf :cards="runCards(run)" :hiddenKey="heroHiddenKey" :outNames="outNames" :grounded="groundedNames"
                                        :zoom="plan.album.zoom" :slotW="plan.album.slotW" :slotH="plan.album.slotH" :gapX="plan.album.gapX" />
                  </div>
                </div>
              </div>
            </div>
            <!-- THE PAGE EDGES — «there is a page that way»: both always render, an unavailable one is a ghost. -->
            <button v-for="side in ['left', 'right']" :key="side" type="button"
                    class="con-played__pgedge"
                    :class="[
                      `con-played__pgedge--${side}`,
                      {'con-played__pgedge--off': side === 'left' ? activePage === 0 : activePage >= pageCount - 1},
                      {'con-played__pgedge--pulse': edgePulse === side},
                    ]"
                    :aria-hidden="pageCount <= 1 ? 'true' : undefined"
                    tabindex="-1"
                    @click="turnPage(side === 'left' ? -1 : 1)">
              <span class="con-played__pgedge-chev" aria-hidden="true">{{ side === 'left' ? '‹' : '›' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- The CATEGORY VIEW — mounted for the whole physical episode (the
         cards lift off the table above, fly into it, and fly back on close).
         It owns the flights; the table only holds the airborne cards' slots. -->
    <ConsolePlayedCategoryView v-if="categoryUp"
                               ref="catView"
                               :cards="categoryViewCards"
                               :provenanceByName="provenanceByName"
                               :offPageRect="offPageRect"
                               @settled-closed="onCategorySettled" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, markRaw} from 'vue';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {MarsBotCorpModel} from '@/common/automa/MarsBotCorpData';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {botTableauCards} from '@/client/components/marsbot/marsBotView';
import {marsBotCorpZoomEntry} from '@/client/components/card/cardZoomTypes';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {albumLayoutState} from '@/client/console/consoleAlbumLayout';
import {albumSpecFor} from '@/client/components/console/consoleHandAlbum';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {
  buildPlayedZones, planPlayedTable, pickSpatialTarget, unionNavRects, pageOfShelfCard, zonePages, zonesOnPage,
  NavRect, PlayedPage, PlayedRun, PlayedShelfZone, PlayedTablePlan, PlayedZones, PLAYED_SHELF_ORDER,
} from '@/client/components/console/consolePlayedModel';
import {
  playedCategories, categoryCards, PlayedCategory, PlayedCategoryKey, PLAYED_CATEGORY_LABEL, FlightRect,
} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, resetPlayedCategoryView, isCategoryViewUp, isCategoryViewBusy,
  categoryOutNames, categoryAwayNames, categoryGroundedNames,
} from '@/client/console/played/playedCategoryView';
import {resetCategoryDirector} from '@/client/console/played/playedCategoryDirector';
import {providePlayedHeroTarget} from '@/client/console/played/consolePlayedHero';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {HeroRect} from '@/client/console/played/playedHeroModel';
import {openConsoleCardZoom, slotZoomOrigin, ConsoleZoomProvenance} from '@/client/console/consoleCardZoom';
import {playedProvenanceByName, zoomProvenanceOver} from '@/client/components/console/played/playedProvenance';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsolePlayedShelf from '@/client/components/console/played/ConsolePlayedShelf.vue';
import ConsolePlayedEventsPile from '@/client/components/console/played/ConsolePlayedEventsPile.vue';
import ConsolePlayedCategoryView from '@/client/components/console/played/ConsolePlayedCategoryView.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';

/** The table's focusable keys: the card categories + the bot's corporation slot. */
type TableFocusKey = PlayedCategoryKey | 'botcorp' | '';

/** Fallback body box before the first measure / under JSDOM (1080-logical; the planner scales from it). */
const FALLBACK_W = 1400;
const FALLBACK_H = 620;
/** Right-stick page flick: the axis magnitude that fires a turn, and the hold cadence. */
const FLICK_THRESHOLD = 0.5;
const FLICK_REPEAT_MS = 280;
/** The page edge's press response (one shot). */
const EDGE_PULSE_MS = 260;
/** Mouse wheel: notches accumulate into one page turn. */
const WHEEL_NOTCH = 120;
const WHEEL_DECAY_MS = 260;
/** The strip's slide arms only once a fresh mount has landed on its page (never a slide from x = 0). */
const PAGE_LIVE_SETTLE_MS = 80;
/** A card beyond the album's edge (another page) flies from a packet this far past it (1080-logical). */
const OFF_PAGE_GAP = 46;

export default defineComponent({
  name: 'ConsolePlayedOverlay',
  components: {ConsoleWsHead, ConsolePlayedShelf, ConsolePlayedEventsPile, ConsolePlayedCategoryView, MarsBotCorpFace},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    thisPlayerColor: {type: String as PropType<Color>, required: true},
    /**
     * PLAY-ANIMATION mode (the hero scene): the just-played card. The table
     * renders the +1 layout IMMEDIATELY (appended to the viewer's tableau if
     * the commit hasn't landed yet — append-only shelves make the synthetic
     * and the committed layout IDENTICAL), with the card's slot reserved
     * hidden until `heroRevealed`, on the page it lands on.
     */
    heroIncoming: {type: Object as PropType<CardModel | undefined>, default: undefined},
    /** Landing committed — the reserved slot turns real (under the proxy). */
    heroRevealed: {type: Boolean, default: false},
    /** The transaction owns the moment (input inert, frame gated). */
    heroActive: {type: Boolean, default: false},
    /**
     * The public Automa state — lets the table show the BOT seat's cards
     * (its played pile; the bot has no real tableau on its player model).
     * Passed by both hosts; the overlay resolves per viewed seat.
     */
    automa: {type: Object as PropType<MarsBotModel>, default: undefined},
    /**
     * EMBEDDED mode — the table is the Information Workspace's «Разыграно»
     * detail: static inside the workspace frame (no own chassis), the
     * viewed seat is CONTROLLED by `forcedColor` (the workspace's inspected
     * player — LB/RB switches it globally, never here), B is routed by the
     * shell (category-local back only).
     */
    embedded: {type: Boolean, default: false},
    /** The controlled viewed seat (embedded mode only). */
    forcedColor: {type: String as PropType<Color>, default: undefined},
  },
  emits: {
    'close': () => true,
  },
  data() {
    return {
      /** The measured table body (offset box — transform-independent, so a materializing panel never mis-sizes it). */
      box: {w: 0, h: 0},
      ro: undefined as ResizeObserver | undefined,
      /** WHOSE tableau is on the table (LB/RB cycles; defaults to the viewer). */
      viewColor: this.thisPlayerColor as Color,
      /** The focused CATEGORY (the only focusable objects of the table). */
      focusCategory: '' as TableFocusKey,
      /** The album's page. Derived from the focus when a zone lies elsewhere; explicit on LT/RT, a flick, an edge. */
      page: 0,
      /** The strip's slide is armed (a fresh mount LANDS on its page, never slides there from x = 0). */
      pageLive: false,
      liveTimer: undefined as number | undefined,
      turning: false,
      lastFlickAt: 0,
      edgePulse: undefined as 'left' | 'right' | undefined,
      pulseTimer: undefined as number | undefined,
      wheelAcc: 0,
      wheelAt: 0,
      /** Hero-scene target-measurer deregistration (play-animation mode). */
      unregisterHeroTarget: undefined as (() => void) | undefined,
      catState: playedCategoryState,
    };
  },
  computed: {
    /** The seat on the table: controlled by the workspace when embedded. */
    effectiveViewColor(): Color {
      return this.embedded && this.forcedColor !== undefined ? this.forcedColor : this.viewColor;
    },
    viewedPlayer(): PublicPlayerModel {
      return this.players.find((p) => p.color === this.effectiveViewColor) ??
        this.players.find((p) => p.color === this.thisPlayerColor) ??
        this.players[0];
    },
    viewedIsBot(): boolean {
      return this.viewedPlayer?.isMarsBot === true;
    },
    /** The bot's corporation (its own entity — bot rules, original identity). */
    botCorp(): MarsBotCorpModel | undefined {
      return this.viewedIsBot ? this.automa?.corporation : undefined;
    },
    /** The localized seat label — never a raw `MarsBot` for the bot seat. */
    viewedDisplayName(): string {
      return participantDisplayName(this.viewedPlayer);
    },
    /**
     * The cards on the table: a human's real tableau; the BOT seat reads its
     * public played pile (everything it flipped — same premium table, same
     * zone grouping; provenance is named by the head note).
     */
    viewedTableau(): ReadonlyArray<CardModel> {
      if (this.viewedIsBot && this.automa !== undefined) {
        return botTableauCards(this.automa);
      }
      return this.viewedPlayer?.tableau ?? [];
    },
    zones(): PlayedZones {
      const tableau = this.viewedTableau;
      const incoming = this.heroIncoming;
      // Synthetic +1: BEFORE the commit the incoming card is appended so the
      // layout is already final (spec: the table never re-arranges around
      // the landing). After the commit the tableau carries it for real —
      // the guard prevents a duplicate, keys/positions stay identical.
      if (incoming !== undefined &&
          this.viewedPlayer?.color === this.thisPlayerColor &&
          !tableau.some((c) => c.name === incoming.name)) {
        return buildPlayedZones([...tableau, incoming]);
      }
      return buildPlayedZones(tableau);
    },
    /** The focusable categories of the shown tableau, in table order. */
    categories(): ReadonlyArray<PlayedCategory> {
      return playedCategories(this.zones);
    },
    /** The category view episode is mounted (opening / open / closing). */
    categoryUp(): boolean {
      return isCategoryViewUp();
    },
    /** The open category's cards (LIVE — an undo/refresh flows through). */
    categoryViewCards(): ReadonlyArray<CardModel> {
      const key = this.catState.category;
      return key !== undefined ? categoryCards(this.zones, key) : [];
    },
    /** The crumb's STAGE: the open category (an i18n key) — the only segment that ever changes past the seat. */
    crumbStage(): string {
      const key = this.catState.category;
      return this.categoryUp && key !== undefined ? PLAYED_CATEGORY_LABEL[key] : '';
    },
    /** Names lifted OUT of the table (airborne / in the view) — their slots
     *  render held geometry so a card never exists in two places at once. */
    outNames(): ReadonlySet<string> {
      return categoryOutNames();
    },
    /** Names dissolving IN PLACE for a bounded category episode (the cards
     *  beyond the flight budget — opacity, not a visibility hold). */
    groundedNames(): ReadonlySet<string> {
      return categoryGroundedNames();
    },
    /** Names LOGICALLY AWAY in the category view (flown AND grounded) — what
     *  the events-pile count and its full-ghost read. */
    awayNames(): ReadonlySet<string> {
      return categoryAwayNames();
    },
    /** How many EVENTS are currently away (lifted into the view). */
    heldEventsCount(): number {
      if (this.awayNames.size === 0) {
        return 0;
      }
      return this.zones.events.reduce((n, c) => n + (this.awayNames.has(c.name) ? 1 : 0), 0);
    },
    eventsOut(): boolean {
      // Full ghost only when EVERY event is away; mirrors the held semantics
      // of `outNames` (never a frame before proxies exist).
      const total = this.zones.events.length;
      return total > 0 && this.heldEventsCount >= total;
    },
    /** The hero card is an EVENT (classified structurally via the zones). */
    heroIncomingIsEvent(): boolean {
      const incoming = this.heroIncoming;
      return incoming !== undefined && this.zones.events.some((c) => c.name === incoming.name);
    },
    /** The reserved face-up slot stays hidden until the landing commit. */
    heroHiddenKey(): string | undefined {
      const incoming = this.heroIncoming;
      if (incoming === undefined || this.heroRevealed || this.heroIncomingIsEvent) {
        return undefined;
      }
      return incoming.name;
    },
    /** The events counter ticks only AFTER the landed card is revealed, and
     *  drops by the events currently AWAY in the view (physical truth). */
    displayedEventsCount(): number {
      const n = this.zones.events.length - this.heldEventsCount;
      return this.heroIncoming !== undefined && this.heroIncomingIsEvent && !this.heroRevealed ?
        Math.max(0, n - 1) : Math.max(0, n);
    },
    /** First-ever event mid-scene: the pile exists as HIDDEN geometry. */
    eventsPileReserved(): boolean {
      return this.displayedEventsCount === 0 && this.zones.events.length > 0;
    },
    totalCount(): number {
      const z = this.zones;
      const n = z.corporations.length + z.preludes.length + z.ceos.length +
        z.active.length + z.automated.length + z.events.length;
      // The header count stays honest mid-scene: the landing card joins the
      // total only once it is revealed on the table.
      return this.heroIncoming !== undefined && !this.heroRevealed ? Math.max(0, n - 1) : n;
    },
    /**
     * The BY-NAME provenance lookup of THIS table — the plate every
     * fullscreen opened from here carries («лежит на столе <место>, зона
     * <зона>, N из M»). Live: it re-derives with the tableau, so an undo or
     * a fresh play can never leave a stale plate behind.
     */
    provenanceByName(): (name: string | undefined) => ConsoleZoomProvenance | undefined {
      return playedProvenanceByName(this.viewedPlayer, this.viewedTableau);
    },
    /** Nothing on the table at all (the bot's corporation slot counts as content). */
    emptyTable(): boolean {
      return this.categories.length === 0 && this.botCorp === undefined;
    },
    /** No project card lies on the shelves (an identity-only table). */
    projectsEmpty(): boolean {
      const z = this.zones;
      return z.preludes.length + z.ceos.length + z.active.length + z.automated.length === 0;
    },
    shelfCounts(): Record<PlayedShelfZone, number> {
      const z = this.zones;
      return {prelude: z.preludes.length, ceo: z.ceos.length, active: z.active.length, automated: z.automated.length};
    },
    /** THE PLAN — the measured body box, the profile's album page, the zones' counts. */
    plan(): PlayedTablePlan {
      const s = conUiScale();
      const measured = this.box.w > 4 && this.box.h > 4;
      return planPlayedTable({
        availW: measured ? this.box.w : FALLBACK_W * s,
        availH: measured ? this.box.h : FALLBACK_H * s,
        counts: this.shelfCounts,
        corporations: this.botCorp !== undefined ? 1 : this.zones.corporations.length,
        spec: albumSpecFor(consoleLayoutState.profile, albumLayoutState.layout),
        uiScale: s,
      });
    },
    pages(): ReadonlyArray<PlayedPage> {
      return this.plan.pages;
    },
    pageCount(): number {
      return this.plan.pageCount;
    },
    /** The page on screen — the explicit page, clamped into the live count. */
    activePage(): number {
      return Math.max(0, Math.min(this.pageCount - 1, this.page));
    },
    /** The mounted pages: the active one and its neighbours (a slide never lands on an unmounted page). */
    renderPages(): Array<number> {
      const out: Array<number> = [];
      for (let p = this.activePage - 1; p <= this.activePage + 1; p++) {
        if (p >= 0 && p < this.pageCount) {
          out.push(p);
        }
      }
      return out;
    },
    /** The plan's px as CSS variables — the stylesheet lays the chassis out, the planner says how wide. */
    tableStyle(): Record<string, string> {
      const a = this.plan.album;
      return {
        '--con-played-caption-h': a.captionH + 'px',
        '--con-played-col-gap': (a.x - this.plan.identityW) + 'px',
        '--con-played-edge': a.padX + 'px',
      };
    },
    stripStyle(): Record<string, string> {
      return {transform: `translateX(${-this.activePage * this.plan.album.stride}px)`};
    },
  },
  watch: {
    /** Data updated (play / undo / reconnect / seat switch): keep the focused
     *  category while it still exists, else land on the first one. */
    'categories': {
      immediate: true,
      handler(categories: ReadonlyArray<PlayedCategory>) {
        const focusStillExists = this.focusCategory === 'botcorp' ?
          this.botCorp !== undefined :
          categories.some((c) => c.key === this.focusCategory);
        if (!focusStillExists) {
          // The bot's corporation slot is the table's first focusable object.
          this.focusCategory = this.botCorp !== undefined ? 'botcorp' : (categories[0]?.key ?? '');
        }
        // The open category emptied out entirely (an undo) — nothing left to
        // show; the view folds instantly (no cards to fly home).
        if (this.categoryUp && this.categoryViewCards.length === 0) {
          resetCategoryDirector();
          resetPlayedCategoryView();
        }
      },
    },
    'focusCategory': {
      immediate: true,
      handler(key: TableFocusKey) {
        // The mirror carries card categories only — the corp slot reads as
        // «nothing to open as a grid» for the command bar.
        consolePlayedUi.focusCategory = key === 'botcorp' ? '' : key;
        // THE ACTIVE PAGE IS DERIVED FROM THE FOCUS: a shelf zone that lies on another page turns the album to it.
        this.ensurePageForZone(key);
      },
    },
    /** EMBEDDED seat switch (the workspace's LB/RB changed the inspected
     *  player): any open category belongs to the previous seat — fold it
     *  instantly, exactly like the internal cycle does. */
    'forcedColor'(next: Color | undefined, prev: Color | undefined) {
      if (this.embedded && next !== prev) {
        resetCategoryDirector();
        resetPlayedCategoryView();
        this.focusCategory = ''; // the categories watcher reseeds
      }
    },
    // Command-bar mirrors (the bar never pokes refs).
    'catState.phase': {
      immediate: true,
      handler() {
        consolePlayedUi.categoryOpen = this.catState.phase === 'open';
        consolePlayedUi.categoryBusy = isCategoryViewBusy();
        const key = this.catState.category;
        consolePlayedUi.categoryLabel = key !== undefined ? PLAYED_CATEGORY_LABEL[key] : '';
      },
    },
    'players.length': {
      immediate: true,
      handler(n: number) {
        consolePlayedUi.canCyclePlayer = n > 1;
      },
    },
    'activePage': {
      immediate: true,
      handler(p: number) {
        consolePlayedUi.page = p;
      },
    },
    'pageCount': {
      immediate: true,
      handler(n: number) {
        consolePlayedUi.pageCount = n;
        if (this.page > n - 1) {
          this.page = Math.max(0, n - 1);
        }
      },
    },
    // ── the hero scene (play-animation mode) ───────────────────────────
    /** The scene always lands on the VIEWER's own tableau — a manually
     *  open table viewing an opponent snaps to the viewer's seat, and any
     *  open category view folds instantly (the table must be the scene). */
    'heroActive': {
      immediate: true,
      handler(active: boolean) {
        if (active) {
          resetCategoryDirector();
          resetPlayedCategoryView();
          this.viewColor = this.thisPlayerColor;
        }
      },
    },
    /** A DIFFERENT tableau on the table (LB/RB cycle / the workspace's
     *  inspected-player switch) opens on its first page. */
    'effectiveViewColor'() {
      this.page = 0;
    },
    /** The reserved-slot measurer plugs into the transaction while an
     *  incoming card exists (registered fresh per scene). The category
     *  cursor seeds onto the landing card's family and the album turns to
     *  the landing card's PAGE — the slot the arc flies into is on screen. */
    'heroIncoming': {
      immediate: true,
      handler(incoming: CardModel | undefined) {
        this.unregisterHeroTarget?.();
        this.unregisterHeroTarget = undefined;
        if (incoming !== undefined) {
          this.unregisterHeroTarget = providePlayedHeroTarget(() => this.measureHeroTarget(), () => this.peekHeroTarget());
          this.focusCategory = this.familyOf(incoming.name);
          this.ensurePageOfCard(incoming.name);
        }
      },
    },
    /** Touchdown committed: the cursor confirms the landing family. */
    'heroRevealed'(revealed: boolean) {
      if (revealed && this.heroIncoming !== undefined) {
        this.focusCategory = this.familyOf(this.heroIncoming.name);
      }
    },
  },
  mounted() {
    const body = this.$refs.body as HTMLElement | undefined;
    if (body !== undefined && typeof ResizeObserver !== 'undefined') {
      this.ro = markRaw(new ResizeObserver(() => this.measure()));
      this.ro.observe(body);
    }
    this.measure();
    // The slide arms once the fresh mount has landed on its page.
    this.liveTimer = window.setTimeout(() => {
      this.liveTimer = undefined;
      this.pageLive = true;
    }, PAGE_LIVE_SETTLE_MS);
  },
  beforeUnmount() {
    this.ro?.disconnect();
    this.ro = undefined;
    if (this.liveTimer !== undefined) {
      window.clearTimeout(this.liveTimer);
      this.liveTimer = undefined;
    }
    if (this.pulseTimer !== undefined) {
      window.clearTimeout(this.pulseTimer);
      this.pulseTimer = undefined;
    }
    this.unregisterHeroTarget?.();
    this.unregisterHeroTarget = undefined;
    resetCategoryDirector();
    resetPlayedCategoryView();
    resetConsolePlayedUi();
  },
  methods: {
    /** The body box — OFFSET dimensions (a materializing panel's transform never shrinks the plan). */
    measure(): void {
      const body = this.$refs.body as HTMLElement | undefined;
      if (body === undefined) {
        return;
      }
      const w = body.offsetWidth;
      const h = body.offsetHeight;
      if (w !== this.box.w || h !== this.box.h) {
        this.box = {w, h};
      }
    },
    // ── the shelves ─────────────────────────────────────────────────────
    zoneLabel(zone: PlayedShelfZone): string {
      return PLAYED_CATEGORY_LABEL[zone];
    },
    familyClass(zone: PlayedShelfZone): string {
      return `con-played__family--${zone}`;
    },
    runCards(run: PlayedRun): ReadonlyArray<CardModel> {
      return categoryCards(this.zones, run.zone).slice(run.start, run.start + run.count);
    },
    /** The zone's first run carries its HONEST total; a continuation names its range («6–10»). */
    runCount(run: PlayedRun): string {
      if (run.first) {
        return String(this.familyCount(categoryCards(this.zones, run.zone)));
      }
      return `${run.start + 1}–${run.start + run.count}`;
    },
    /** The zone's first run on the page — the one navigation target the zone has there. */
    isFirstRunOnPage(p: number, run: PlayedRun): boolean {
      const page = this.pages[p];
      if (page === undefined) {
        return false;
      }
      for (const row of page.rows) {
        for (const r of row.runs) {
          if (r.zone === run.zone) {
            return r === run;
          }
        }
      }
      return false;
    },
    pageStyle(p: number): Record<string, string> {
      const a = this.plan.album;
      return {
        left: p * a.stride + 'px',
        width: a.w + 'px',
        padding: `${a.padTop}px ${a.padX}px 0`,
        rowGap: a.rowGap + 'px',
      };
    },
    onStripSettled(): void {
      this.turning = false;
    },
    /** A scroll on the album is always programmatic — pin it back so a stray `scrollIntoView` never shifts the strip. */
    pinScroll(): void {
      const album = this.$refs.album as HTMLElement | undefined;
      if (album !== undefined && (album.scrollLeft !== 0 || album.scrollTop !== 0)) {
        album.scrollLeft = 0;
        album.scrollTop = 0;
      }
    },
    familyClasses(key: TableFocusKey): Record<string, boolean> {
      return {
        'con-played__family--focused': this.focusCategory === key && !this.heroActive,
        'con-played__family--out': this.categoryUp && this.catState.category === key,
      };
    },
    /**
     * The HONEST caption count of a family: the synthetic incoming card joins
     * it only when it has physically become the shelf's card (the reveal
     * commit) — until then the caption reads the pre-play truth, exactly like
     * the header total and the events pile already did.
     */
    familyCount(cards: ReadonlyArray<CardModel>): number {
      const incoming = this.heroIncoming;
      if (incoming === undefined || this.heroRevealed) {
        return cards.length;
      }
      return cards.some((c) => c.name === incoming.name) ? Math.max(0, cards.length - 1) : cards.length;
    },
    /** The zone a tableau card belongs to (the hero landing's focus seed). */
    familyOf(name: string): PlayedCategoryKey | '' {
      const z = this.zones;
      if (z.events.some((c) => c.name === name)) {
        return 'events';
      }
      if (z.corporations.some((c) => c.name === name)) {
        return 'corporation';
      }
      if (z.preludes.some((c) => c.name === name)) {
        return 'prelude';
      }
      if (z.ceos.some((c) => c.name === name)) {
        return 'ceo';
      }
      if (z.active.some((c) => c.name === name)) {
        return 'active';
      }
      if (z.automated.some((c) => c.name === name)) {
        return 'automated';
      }
      // A landing card never belongs to the bot's corporation slot — fall
      // back to a CARD category (or none) for the hero focus seed.
      return this.focusCategory === 'botcorp' ? '' : this.focusCategory;
    },
    // ── pages ────────────────────────────────────────────────────────────
    isShelfZone(key: TableFocusKey): key is PlayedShelfZone {
      return (PLAYED_SHELF_ORDER as ReadonlyArray<string>).includes(key);
    },
    /** The page of a shelf card (identity cards lie on every page → the active one). */
    pageOfCard(name: string): number {
      const zone = this.familyOf(name);
      if (!this.isShelfZone(zone)) {
        return this.activePage;
      }
      const index = categoryCards(this.zones, zone).findIndex((c) => c.name === name);
      return pageOfShelfCard(this.pages, zone, index) ?? this.activePage;
    },
    ensurePageOfCard(name: string): void {
      this.page = this.pageOfCard(name);
    },
    /** A zone that lies on another page turns the album to its FIRST page (an identity zone is on every page). */
    ensurePageForZone(key: TableFocusKey): void {
      if (!this.isShelfZone(key)) {
        return;
      }
      const on = zonePages(this.pages, key);
      if (on.length > 0 && !on.includes(this.activePage)) {
        this.page = on[0];
      }
    },
    /** The explicit page turn (LT/RT, the edge, a flick, the wheel): the focus follows onto the new page. */
    turnPage(dir: 1 | -1): void {
      if (this.heroActive) {
        return;
      }
      const next = Math.max(0, Math.min(this.pageCount - 1, this.activePage + dir));
      if (next === this.activePage) {
        return;
      }
      this.pulseEdge(dir === 1 ? 'right' : 'left');
      this.turning = true;
      this.page = next;
      // A focused shelf zone with no run on the new page hands the cursor to the page's first (or last) zone.
      if (this.isShelfZone(this.focusCategory) && !zonePages(this.pages, this.focusCategory).includes(next)) {
        const zones = zonesOnPage(this.pages[next]);
        const landing = dir === 1 ? zones[0] : zones[zones.length - 1];
        if (landing !== undefined) {
          this.focusCategory = landing;
        }
      }
    },
    pulseEdge(side: 'left' | 'right'): void {
      this.edgePulse = side;
      if (this.pulseTimer !== undefined) {
        window.clearTimeout(this.pulseTimer);
      }
      this.pulseTimer = window.setTimeout(() => {
        this.edgePulse = undefined;
        this.pulseTimer = undefined;
      }, EDGE_PULSE_MS);
    },
    /** Right stick — a firm push turns one page toward the push; holding it pages at a controlled cadence. */
    stickScroll(dy: number, dx = 0): void {
      if (this.categoryUp) {
        (this.$refs.catView as {stickScroll?: (dy: number) => void} | undefined)?.stickScroll?.(dy);
        return;
      }
      const v = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      if (Math.abs(v) < FLICK_THRESHOLD) {
        return;
      }
      const now = Date.now();
      if (now - this.lastFlickAt < FLICK_REPEAT_MS) {
        return;
      }
      this.lastFlickAt = now;
      this.turnPage(v > 0 ? 1 : -1);
    },
    /** Mouse wheel over the album: notches accumulate into one page turn. */
    onWheel(e: WheelEvent): void {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = Date.now();
      if (now - this.wheelAt > WHEEL_DECAY_MS) {
        this.wheelAcc = 0;
      }
      this.wheelAt = now;
      this.wheelAcc += d;
      if (Math.abs(this.wheelAcc) >= WHEEL_NOTCH) {
        this.turnPage(this.wheelAcc > 0 ? 1 : -1);
        this.wheelAcc = 0;
      }
    },
    /**
     * A card on a page that is NOT mounted (beyond the neighbours) has no slot to fly from: the category view asks
     * for its PACKET place — just past the album's edge on its side, the page's own packet language. Measured
     * against the album box; the proxy is the only visible copy, so the card reads as coming in from the next page.
     */
    offPageRect(name: string): FlightRect | undefined {
      const album = this.$refs.album as HTMLElement | undefined;
      if (album === undefined || typeof album.getBoundingClientRect !== 'function') {
        return undefined;
      }
      const r = album.getBoundingClientRect();
      if (r.width < 4) {
        return undefined;
      }
      const zone = this.familyOf(name);
      if (!this.isShelfZone(zone)) {
        return undefined;
      }
      const index = categoryCards(this.zones, zone).findIndex((c) => c.name === name);
      const page = pageOfShelfCard(this.pages, zone, index);
      if (page === undefined) {
        return undefined;
      }
      const a = this.plan.album;
      const gap = OFF_PAGE_GAP * conUiScale();
      const x = page < this.activePage ? r.left - a.slotW - gap : r.right + gap;
      const y = r.top + Math.max(0, (r.height - a.slotH) / 2);
      return {x, y, w: a.slotW, h: a.slotH};
    },
    // ── the pad grammar (delegated by the shell) ────────────────────────
    handleIntent(intent: GamepadIntent): void {
      // The category view owns the pad for its whole episode (incl. the
      // flights — B there reverses/snaps; the table is scenery beneath).
      if (this.categoryUp) {
        (this.$refs.catView as {handleIntent?: (i: GamepadIntent) => void} | undefined)?.handleIntent?.(intent);
        return;
      }
      if (intent.kind === 'scroll') {
        this.stickScroll(intent.dy, intent.dx);
        return;
      }
      if (intent.kind === 'nav') {
        this.moveFocus(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
      case 'inspect':
        // A VIEW surface: A (and X) opens the focused category.
        if (this.focusCategory === 'botcorp') {
          this.openBotCorpZoom();
          break;
        }
        this.openCategory(this.focusCategory);
        break;
      case 'prevSection':
        this.cycleViewedPlayer(-1);
        break;
      case 'nextSection':
        this.cycleViewedPlayer(1);
        break;
      case 'prevTab':
        this.turnPage(-1);
        break;
      case 'nextTab':
        this.turnPage(1);
        break;
      case 'back':
        this.$emit('close');
        break;
      default:
        break;
      }
    },
    // ── category focus (spatial over the live zone-block rects) ─────────
    /** One rect per zone: the identity blocks + the UNION of a zone's runs on the active page. */
    collectCategoryRects(): ReadonlyArray<NavRect> {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelectorAll !== 'function') {
        return [];
      }
      const out: Array<NavRect> = [];
      const active = `[data-played-page-index="${this.activePage}"]`;
      root.querySelectorAll<HTMLElement>('[data-played-run], [data-played-cat]').forEach((el) => {
        const key = el.dataset.playedRun ?? el.dataset.playedCat;
        if (key === undefined || key === '') {
          return;
        }
        // A run on a neighbour page is mounted (the slide needs it) but off screen — never a target.
        if (el.dataset.playedRun !== undefined && el.closest(active) === null) {
          return;
        }
        const r = el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) {
          out.push({key, x: r.left, y: r.top, w: r.width, h: r.height});
        }
      });
      return unionNavRects(out);
    },
    moveFocus(dir: NavDirection): void {
      const next = pickSpatialTarget(this.focusCategory, this.collectCategoryRects(), dir);
      if (next !== undefined) {
        this.focusCategory = next as TableFocusKey;
        return;
      }
      // The album's horizontal edge: a further page continues the walk onto it (the order continues — the album's
      // own law); up/down and the identity column feel the edge.
      if (dir === 'right' && this.activePage < this.pageCount - 1 && this.isShelfZone(this.focusCategory)) {
        this.turnPage(1);
      } else if (dir === 'left' && this.activePage > 0 && this.isShelfZone(this.focusCategory)) {
        this.turnPage(-1);
      }
    },
    // ── opening a category (the physical lift is the view's job) ────────
    /** Mouse support: clicking anywhere on a zone focuses it; a click on the
     *  already-focused zone opens it (mirrors the pad's two-step feel). */
    onFamilyPress(key: PlayedCategoryKey): void {
      if (this.heroActive || this.categoryUp) {
        return;
      }
      if (this.focusCategory === key) {
        this.openCategory(key);
      } else {
        this.focusCategory = key;
      }
    },
    /** Mouse: the bot-corporation slot mirrors the two-step family feel. */
    onBotCorpPress(): void {
      if (this.heroActive || this.categoryUp) {
        return;
      }
      if (this.focusCategory === 'botcorp') {
        this.openBotCorpZoom();
      } else {
        this.focusCategory = 'botcorp';
      }
    },
    /** Fullscreen inspect of the bot's corporation — the physical lift out of
     *  its table slot, same as the smart open of a one-card zone. */
    openBotCorpZoom(): void {
      const corp = this.botCorp;
      if (corp === undefined || this.heroActive || this.categoryUp) {
        return;
      }
      const list = [marsBotCorpZoomEntry(corp.id, corp.resources, corp.resource)];
      openConsoleCardZoom(list, 0, undefined, undefined, {
        origin: slotZoomOrigin(() => this.$el as HTMLElement, (i) => list[i]?.name ?? ''),
      });
    },
    openCategory(key: TableFocusKey): void {
      if (key === 'botcorp') {
        this.openBotCorpZoom();
        return;
      }
      if (key === '' || this.heroActive || this.categoryUp) {
        return;
      }
      const cards = categoryCards(this.zones, key);
      if (cards.length === 0) {
        return;
      }
      // SMART OPEN: a zone holding exactly ONE card has nothing to browse —
      // the intermediate grid would be a ceremony around a single tile. Go
      // straight to the fullscreen, lifted PHYSICALLY out of its table slot
      // (and returned into it on close), carrying the provenance plate.
      if (cards.length === 1) {
        this.focusCategory = key;
        const list = [...cards];
        openConsoleCardZoom(list, 0, undefined, undefined, {
          origin: slotZoomOrigin(() => this.$el as HTMLElement, (i) => list[i]?.name ?? ''),
          provenance: zoomProvenanceOver(this.provenanceByName, list),
        });
        return;
      }
      this.focusCategory = key;
      playedCategoryState.category = key;
      playedCategoryState.names = cards.map((c) => c.name);
      playedCategoryState.focusIndex = 0;
      playedCategoryState.flights = [];
      // NOT held yet — the table cards stay visible until the director has
      // painted their proxies (the view flips the hold in that same turn).
      playedCategoryState.holdCards = false;
      playedCategoryState.frameOn = false;
      playedCategoryState.phase = 'opening';
      // The view mounts off `phase` and runs the whole open flight itself.
    },
    onCategorySettled(): void {
      // The episode settled CLOSED — focus stays on the category it came
      // from (the table is exactly as the player left it).
    },
    // ── the hero scene: the reserved-slot measurer ──────────────────────
    heroTargetEl(): HTMLElement | null {
      const incoming = this.heroIncoming;
      const root = this.$el as HTMLElement | undefined;
      if (incoming === undefined || root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(incoming.name) : incoming.name.replace(/"/g, '\\"');
      return this.heroIncomingIsEvent ?
        root.querySelector<HTMLElement>('.con-played__family--event .con-played__backstack') :
        root.querySelector<HTMLElement>(`[data-played-key="${esc}"] .con-played__face`);
    },
    /**
     * Measure the reserved landing geometry for the incoming card: the
     * hidden face-up slot's card box (on the page it lies on — the album is
     * turned there first), or the events backstack. Waits for the rect to
     * hold still across frames (the strip may still be settling) — the arc
     * always flies into REAL, settled geometry, never an estimate.
     */
    async measureHeroTarget(): Promise<HeroRect | undefined> {
      const incoming = this.heroIncoming;
      if (incoming === undefined) {
        return undefined;
      }
      this.ensurePageOfCard(incoming.name);
      await this.$nextTick();
      const el = this.heroTargetEl();
      if (el === null) {
        return undefined;
      }
      // Stability loop: two consecutive frames with the same rect (≤ 30).
      let last: {x: number, y: number, w: number, h: number} | undefined = undefined;
      for (let i = 0; i < 30; i++) {
        await this.heroFrame();
        const r = el.getBoundingClientRect();
        if (r.width > 4 && last !== undefined &&
            Math.abs(r.left - last.x) < 0.5 && Math.abs(r.top - last.y) < 0.5 &&
            Math.abs(r.width - last.w) < 0.5 && Math.abs(r.height - last.h) < 0.5) {
          return last;
        }
        last = r.width > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
      }
      return last;
    },
    /** The reserved slot's REST rect, synchronously (the flight's final
     *  approach / the pre-reveal control measure). */
    peekHeroTarget(): HeroRect | undefined {
      const el = this.heroTargetEl();
      if (el === null) {
        return undefined;
      }
      const r = restingRectOf(el);
      return r.width > 4 && r.height > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
    },
    heroFrame(): Promise<void> {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 16);
        }
      });
    },
    // ── viewed player (LB/RB) ───────────────────────────────────────────
    cycleViewedPlayer(step: 1 | -1): void {
      // Embedded: the workspace owns the seat (LB/RB switch the inspected
      // player globally, before the intent ever reaches this table).
      if (this.embedded || this.players.length < 2) {
        return;
      }
      const idx = Math.max(0, this.players.findIndex((p) => p.color === this.viewColor));
      const next = this.players[(idx + step + this.players.length) % this.players.length];
      if (next !== undefined && next.color !== this.viewColor) {
        // A different tableau: any open category belongs to the old one.
        resetCategoryDirector();
        resetPlayedCategoryView();
        this.viewColor = next.color;
        this.focusCategory = ''; // the categories watcher reseeds
      }
    },
  },
});
</script>
