<template>
  <!--
    CONSOLE «РАЗЫГРАНО» — the console-native played-cards TABLE (X from the
    board home). ONE PAGE OF TABLE STACKS (the owner, 2026-10-19; TR65's
    chassis stays — the table stands in the central opening like every
    workspace screen): every zone lies as the printed game lays it — the
    corporation, the preludes, the CEO, the active and the automated cards as
    CASCADES (each covered card shows its title band, the newest lies whole
    in front, a long zone continues in a second lane), the events as ONE
    face-down pile with its count. The whole table is ONE screen; how compact
    it is (the face, the band, the lanes) is solved from the measured body
    and the counts (`planPlayedStacks`). Nothing here is paged.

    NAVIGATION IS BY STACK (the per-card cursor is gone by design): the d-pad
    moves between the stacks, A opens the focused zone — its cards physically
    LIFT off the stack and fly into the category view (ConsolePlayedCategoryView
    owns that whole transition; face-down events flip open mid-flight), which
    is where a zone is READ and where pages are allowed (LB/RB turn them
    there). Closing flies them back onto the stack. LB/RB at the table walk
    the seats.

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
       :class="{'con-played--hero': heroActive, 'con-played--catview': categoryUp, 'con-played--embedded': embedded, 'con-ws': !embedded}"
       :data-motion-surface="embedded || heroActive ? undefined : 'played'"
       :data-played-density="measured ? stacks.density : undefined">
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
        <!-- THE CONTENT RENDERS ONCE, against the MEASURED body (PL-625): the body is a flex box whose size never depends
             on what it holds, so the first render lays the chassis out, `mounted()` measures it (a forced layout, no
             paint yet), and the table renders its faces a single time with the real plan before the first paint. -->
        <div v-if="measured" class="con-played__table" :class="`con-played__table--${stacks.density}`" :style="tableStyle">
          <div v-for="st in stacks.stacks" :key="st.key"
               class="con-played__family con-played__stack"
               :class="stackClasses(st)"
               :data-played-cat="stackFocusKey(st)"
               :data-played-stack="st.key"
               :data-played-lanes="st.lanes.length"
               :style="{left: st.x + 'px', top: stacks.padTop + 'px', width: st.w + 'px'}"
               @click="onStackPress(st)">
            <!-- The caption lives inside the stack's width: the label ellipsizes in its OWN box, the count and the A badge
                 (the focused stack's «open» — the bar names the verb) never shrink. -->
            <span class="con-played__caption" :style="{maxWidth: captionRoom(st) + 'px'}">
              <span class="con-played__caption-label">{{ $t(stackLabel(st)) }}</span>
              <b v-if="stackShowsCount(st)" class="con-played__caption-count">{{ stackCount(st) }}</b>
              <GamepadGlyph v-if="stackFocusKey(st) !== undefined" control="confirm" class="con-played__caption-open" />
            </span>

            <!-- The BOT's corporation — its own entity (bot rules, original identity) on the corporation's stack;
                 A/X opens the fullscreen inspect (physical lift via data-zoom-slot). -->
            <div v-if="st.key === 'corporation' && botCorp !== undefined" class="con-played__lanes">
              <div class="con-played__lane" :style="{width: stacks.slotW + 'px', height: stacks.slotH + 'px'}">
                <div class="con-played__slot con-played__slot--front con-played__botcorp" :style="{width: stacks.slotW + 'px', height: stacks.slotH + 'px'}" :data-zoom-slot="botCorp.id">
                  <div class="con-played__lift">
                    <div class="con-played__face con-played__focusbox" :style="{zoom: String(stacks.zoom)}">
                      <MarsBotCorpFace :id="botCorp.id" :resources="botCorp.resources" :resource="botCorp.resource" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Events — face down, one pile, per the printed rules. During the hero scene the pile shows the
                 PRE-play count (the counter ticks only after the landed card is committed), and a first-ever event
                 reserves a HIDDEN pile so the arc has a real target. -->
            <ConsolePlayedEventsPile v-else-if="st.key === 'events' && st.count > 0"
                                     :count="displayedEventsCount"
                                     :reserved="eventsPileReserved"
                                     :focused="false"
                                     :out="eventsOut"
                                     :slotW="stacks.slotW" :cardH="stacks.slotH" />
            <!-- A PREPARED PLACE (PL-620) — the corporation before the choice, the events before the first: a dashed
                 outline that names what is missing, never a card-sized plate. Its box stays: the first card lands here. -->
            <div v-else-if="st.count === 0"
                 class="con-played__seat-place"
                 :class="{'con-played__seat-place--events': st.key === 'events'}"
                 :style="{width: stacks.slotW + 'px', height: stacks.slotH + 'px'}">
              <span v-if="st.key === 'events'" class="con-played__seat-note" v-i18n>No events played yet</span>
            </div>
            <!-- A CASCADE — the zone's cards in their lanes. -->
            <ConsolePlayedStack v-else
                                :cards="stackCards(st.key)" :lanes="st.lanes"
                                :hiddenKey="heroHiddenKey" :outNames="outNames" :grounded="groundedNames"
                                :zoom="stacks.zoom" :slotW="stacks.slotW" :slotH="stacks.slotH" :peek="st.peek" :laneGap="stacks.laneGap"
                                :live="st.key === 'corporation'" />
          </div>
          <!-- Nothing played yet / an identity-only table: one calm line where the project stacks will lie — never a
               bare half (the stacks of the identity stand beside it). -->
          <div v-if="emptyTable || projectsEmpty" class="con-played__none" :style="noneStyle">
            <span class="con-played__none-shelf" aria-hidden="true"></span>
            <span v-if="emptyTable" class="con-played__void"><span class="con-played__void-glyph" aria-hidden="true">◈</span><span v-i18n>No cards played yet</span></span>
            <span v-else v-i18n>No played projects yet</span>
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
                               :faceFloorZoom="stacks.zoom"
                               :boxInset="catInset"
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
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {
  buildPlayedZones, planPlayedStacks, pickSpatialTarget, unionNavRects,
  NavRect, PlayedStackKey, PlayedStackPlan, PlayedStacksPlan, PlayedZones,
} from '@/client/components/console/consolePlayedModel';
import {
  playedCategories, categoryCards, PlayedCategory, PlayedCategoryKey, PLAYED_CATEGORY_LABEL,
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
import ConsolePlayedStack from '@/client/components/console/played/ConsolePlayedStack.vue';
import ConsolePlayedEventsPile from '@/client/components/console/played/ConsolePlayedEventsPile.vue';
import ConsolePlayedCategoryView from '@/client/components/console/played/ConsolePlayedCategoryView.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

/** The table's focusable keys: the card categories + the bot's corporation slot. */
type TableFocusKey = PlayedCategoryKey | 'botcorp' | '';

/** Fallback body box before the first measure / under JSDOM (1080-logical; the planner scales from it). */
const FALLBACK_W = 1400;
const FALLBACK_H = 620;

export default defineComponent({
  name: 'ConsolePlayedOverlay',
  components: {ConsoleWsHead, ConsolePlayedStack, ConsolePlayedEventsPile, ConsolePlayedCategoryView, MarsBotCorpFace, GamepadGlyph},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    thisPlayerColor: {type: String as PropType<Color>, required: true},
    /**
     * PLAY-ANIMATION mode (the hero scene): the just-played card. The table
     * renders the +1 layout IMMEDIATELY (appended to the viewer's tableau if
     * the commit hasn't landed yet — the synthetic and the committed layout
     * are IDENTICAL), with the card's slot reserved hidden until
     * `heroRevealed` — the front of its stack's last lane.
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
      /** The CATEGORY VIEW stands over the table's BODY, never over its head (PL-626): the crumb reads the open zone
       *  («РАЗЫГРАНО › PLAYER1 › АКТИВНЫЕ») and the ДОП. РЕСУРСЫ lane stays clear. Insets from the root, px. */
      catInset: undefined as Record<string, string> | undefined,
      ro: undefined as ResizeObserver | undefined,
      /** WHOSE tableau is on the table (LB/RB cycles; defaults to the viewer). */
      viewColor: this.thisPlayerColor as Color,
      /** The focused CATEGORY (the only focusable objects of the table). */
      focusCategory: '' as TableFocusKey,
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
    /** The body has been measured — the content renders against the real box only (PL-625). */
    measured(): boolean {
      return this.box.w > 4 && this.box.h > 4;
    },
    /** Nothing on the table at all (the bot's corporation slot counts as content). */
    emptyTable(): boolean {
      return this.categories.length === 0 && this.botCorp === undefined;
    },
    /** No project card lies on the table (an identity-only table). */
    projectsEmpty(): boolean {
      const z = this.zones;
      return z.preludes.length + z.ceos.length + z.active.length + z.automated.length === 0;
    },
    stackCounts(): Record<PlayedStackKey, number> {
      const z = this.zones;
      return {
        corporation: this.botCorp !== undefined ? 1 : z.corporations.length,
        prelude: z.preludes.length,
        ceo: z.ceos.length,
        active: z.active.length,
        automated: z.automated.length,
        events: z.events.length,
      };
    },
    /** THE PLAN — the measured body box and the stacks' counts: ONE page, the compactness solved. */
    stacks(): PlayedStacksPlan {
      const s = conUiScale();
      const measured = this.box.w > 4 && this.box.h > 4;
      return planPlayedStacks({
        availW: measured ? this.box.w : FALLBACK_W * s,
        availH: measured ? this.box.h : FALLBACK_H * s,
        counts: this.stackCounts,
        uiScale: s,
      });
    },
    /** The plan's px as CSS variables — the stylesheet lays the chassis out, the planner says how wide. */
    tableStyle(): Record<string, string> {
      return {
        '--con-played-caption-h': this.stacks.captionH + 'px',
      };
    },
    /** The «no projects yet» line takes the room right of the identity stacks (they stand at the left edge then). */
    noneStyle(): Record<string, string> {
      const last = this.stacks.stacks[this.stacks.stacks.length - 1];
      const left = last === undefined ? 0 : last.x + last.w + this.stacks.gap;
      return {
        left: left + 'px',
        top: this.stacks.padTop + 'px',
        width: Math.max(0, this.box.w - left - this.stacks.gap) + 'px',
        height: (this.stacks.captionH + this.stacks.slotH) + 'px',
      };
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
    /** The reserved-slot measurer plugs into the transaction while an
     *  incoming card exists (registered fresh per scene). The category
     *  cursor seeds onto the landing card's family. */
    'heroIncoming': {
      immediate: true,
      handler(incoming: CardModel | undefined) {
        this.unregisterHeroTarget?.();
        this.unregisterHeroTarget = undefined;
        if (incoming !== undefined) {
          this.unregisterHeroTarget = providePlayedHeroTarget(() => this.measureHeroTarget(), () => this.peekHeroTarget());
          this.focusCategory = this.familyOf(incoming.name);
        }
      },
    },
    /** The view takes the BODY's box on its opening edge (pre-flush: the inset is set before the view mounts and
     *  measures itself, so its grid is planned for the room it really stands in). */
    'categoryUp'(up: boolean) {
      if (up) {
        this.measureCatInset();
      }
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
  },
  beforeUnmount() {
    this.ro?.disconnect();
    this.ro = undefined;
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
      if (this.categoryUp) {
        this.measureCatInset();
      }
      if (w !== this.box.w || h !== this.box.h) {
        this.box = {w, h};
      }
    },
    /** The body's box inside the root (rests: no transform runs while a category opens) — the category view's room. */
    measureCatInset(): void {
      const root = this.$el as HTMLElement | undefined;
      const body = this.$refs.body as HTMLElement | undefined;
      if (root === undefined || body === undefined || typeof root.getBoundingClientRect !== 'function') {
        return;
      }
      const r = root.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      if (b.width <= 4 || b.height <= 4) {
        this.catInset = undefined;
        return;
      }
      const px = (v: number) => `${Math.max(0, Math.round(v))}px`;
      this.catInset = {top: px(b.top - r.top), left: px(b.left - r.left), right: px(r.right - b.right), bottom: px(r.bottom - b.bottom)};
    },
    // ── the stacks ──────────────────────────────────────────────────────
    stackLabel(st: PlayedStackPlan): string {
      return PLAYED_CATEGORY_LABEL[st.key];
    },
    stackCards(key: PlayedStackKey): ReadonlyArray<CardModel> {
      return categoryCards(this.zones, key);
    },
    /** A caption may run on into the gap before the next stack (a one-lane stack is narrower than «АВТОМАТИЧЕСКИЕ 3» at
     *  4K) — never under the next stack's own caption; past that the label ellipsizes in its own box. */
    captionRoom(st: PlayedStackPlan): number {
      const list = this.stacks.stacks;
      const next = list[list.indexOf(st) + 1];
      const edge = next === undefined ? this.box.w : next.x;
      return Math.max(st.w, edge - st.x - 8 * conUiScale());
    },
    /** The stack's focus target: its category (the bot's corporation slot is its own); an empty place is no target. */
    stackFocusKey(st: PlayedStackPlan): TableFocusKey | undefined {
      if (st.key === 'corporation' && this.botCorp !== undefined) {
        return 'botcorp';
      }
      return st.count > 0 ? st.key : undefined;
    },
    /** A stack's caption count: a cascade's honest total; a single corporation and an empty place carry none. */
    stackShowsCount(st: PlayedStackPlan): boolean {
      if (st.count === 0 || (st.key === 'corporation' && this.botCorp !== undefined)) {
        return false;
      }
      return st.key !== 'corporation' || st.count > 1;
    },
    stackCount(st: PlayedStackPlan): number {
      return this.familyCount(categoryCards(this.zones, st.key));
    },
    stackClasses(st: PlayedStackPlan): Record<string, boolean> {
      const focus = this.stackFocusKey(st);
      return {
        [st.key === 'events' ? 'con-played__family--event' : `con-played__family--${st.key}`]: true,
        'con-played__family--empty': st.count === 0,
        'con-played__family--focused': focus !== undefined && this.focusCategory === focus && !this.heroActive,
        'con-played__family--out': focus !== undefined && this.categoryUp && this.catState.category === focus,
      };
    },
    /** Mouse: a stack is focused by one click and opened by the next (the pad's two-step feel). */
    onStackPress(st: PlayedStackPlan): void {
      const focus = this.stackFocusKey(st);
      if (focus === 'botcorp') {
        this.onBotCorpPress();
      } else if (focus !== undefined && focus !== '') {
        this.onFamilyPress(focus);
      }
    },
    /**
     * The HONEST caption count of a family: the synthetic incoming card joins
     * it only when it has physically become the stack's card (the reveal
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
    /** Right stick (the shell's own route): inside the category view it turns the album's pages; the table itself is
     *  one page — nothing to scroll there. */
    stickScroll(dy: number, dx = 0): void {
      if (this.categoryUp) {
        (this.$refs.catView as {handleIntent?: (i: GamepadIntent) => void} | undefined)?.handleIntent?.({kind: 'scroll', dx, dy});
      }
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
        return; // one page — the stick has nothing to turn at the table
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
      case 'back':
        this.$emit('close');
        break;
      default:
        break;
      }
    },
    // ── category focus (spatial over the live stack rects) ──────────────
    /** One rect per focusable stack. */
    collectCategoryRects(): ReadonlyArray<NavRect> {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelectorAll !== 'function') {
        return [];
      }
      const out: Array<NavRect> = [];
      root.querySelectorAll<HTMLElement>('[data-played-cat]').forEach((el) => {
        const key = el.dataset.playedCat;
        if (key === undefined || key === '') {
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
     * hidden face-up slot's card box (the FRONT of its stack's last lane), or
     * the events backstack. Waits for the rect to hold still across frames —
     * the arc always flies into REAL, settled geometry, never an estimate.
     */
    async measureHeroTarget(): Promise<HeroRect | undefined> {
      const incoming = this.heroIncoming;
      if (incoming === undefined) {
        return undefined;
      }
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
