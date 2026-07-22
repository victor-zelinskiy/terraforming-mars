<template>
  <!--
    CONSOLE «РАЗЫГРАНО» — the console-native played-cards overlay (X from the
    board home). A bottom-anchored TABLE panel: the READ-ONLY physical tableau
    of a player, exactly like the table of the printed game. Cards lie in peek
    piles; events lie face down in one pile.

    NAVIGATION IS BY CATEGORY ONLY (the per-card cursor is gone by design):
    the d-pad moves between the zone blocks (corporation / preludes / CEO /
    active / automated / events), A opens the focused category — its cards
    physically LIFT off their real slots and fly into the category view
    (ConsolePlayedCategoryView owns that whole transition; face-down events
    flip open mid-flight). Closing flies them back onto the table.

    View-only: nothing here ever submits. Input is delegated by the shell
    (handleIntent); command-bar hints are mirrored through consolePlayedUi.
  -->
  <div class="con-played" :class="{'con-played--hero': heroActive, 'con-played--catview': categoryUp}">
    <div class="con-played__panel">
      <div class="con-played__head">
        <span class="con-played__title" v-i18n>Played</span>
        <span class="con-played__seat" :class="{'con-played__seat--cycle': players.length > 1}">
          <span class="con-status__dot" :class="'player_bg_color_' + viewedPlayer.color" aria-hidden="true"></span>
          <span class="con-played__seat-name">{{ viewedPlayer.name }}</span>
        </span>
        <span class="con-played__total">
          <span class="con-played__total-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
          <b>{{ totalCount }}</b>
        </span>
      </div>

      <ConsoleScrollArea ref="scroll" class="con-played__scroll" content-class="con-played__content">
        <!-- Truly empty tableau — a calm compact state, never a bare panel. -->
        <div v-if="categories.length === 0" class="con-played__void">
          <span class="con-played__void-glyph" aria-hidden="true">◈</span>
          <span v-i18n>No cards played yet</span>
        </div>

        <div v-else class="con-played__table">
          <!-- Identity zone: corporation(s) / preludes / CEO — who the player IS. -->
          <div v-if="zones.corporations.length > 0"
               class="con-played__family con-played__family--identity con-played__family--corporation"
               :class="familyClasses('corporation')"
               data-played-cat="corporation"
               @click="onFamilyPress('corporation')">
            <span class="con-played__caption">
              <span v-i18n>Corporation</span>
              <b class="con-played__caption-count">{{ zones.corporations.length }}</b>
              <span class="con-played__caption-open" v-i18n>Open</span>
            </span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.corporations)" :key="'corp' + pi"
                                 :cards="pile" :hiddenKey="heroHiddenKey" :outNames="outNames"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH" />
            </div>
          </div>
          <div v-if="zones.preludes.length > 0"
               class="con-played__family con-played__family--identity con-played__family--prelude"
               :class="familyClasses('prelude')"
               data-played-cat="prelude"
               @click="onFamilyPress('prelude')">
            <span class="con-played__caption">
              <span v-i18n>Preludes</span>
              <b class="con-played__caption-count">{{ zones.preludes.length }}</b>
              <span class="con-played__caption-open" v-i18n>Open</span>
            </span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.preludes)" :key="'prel' + pi"
                                 :cards="pile" :hiddenKey="heroHiddenKey" :outNames="outNames"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH" />
            </div>
          </div>
          <div v-if="zones.ceos.length > 0"
               class="con-played__family con-played__family--identity con-played__family--ceo"
               :class="familyClasses('ceo')"
               data-played-cat="ceo"
               @click="onFamilyPress('ceo')">
            <span class="con-played__caption">
              <span v-i18n>CEO</span>
              <b class="con-played__caption-count">{{ zones.ceos.length }}</b>
              <span class="con-played__caption-open" v-i18n>Open</span>
            </span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.ceos)" :key="'ceo' + pi"
                                 :cards="pile" :hiddenKey="heroHiddenKey" :outNames="outNames"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH" />
            </div>
          </div>

          <!-- The permanent-projects band (blue / green piles). -->
          <div v-if="zones.active.length > 0"
               class="con-played__family con-played__family--active"
               :class="familyClasses('active')"
               data-played-cat="active"
               @click="onFamilyPress('active')">
            <span class="con-played__caption">
              <span v-i18n>Active</span>
              <b class="con-played__caption-count">{{ zones.active.length }}</b>
              <span class="con-played__caption-open" v-i18n>Open</span>
            </span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.active)" :key="'act' + pi"
                                 :cards="pile" :hiddenKey="heroHiddenKey" :outNames="outNames"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH" />
            </div>
          </div>
          <div v-if="zones.automated.length > 0"
               class="con-played__family con-played__family--automated"
               :class="familyClasses('automated')"
               data-played-cat="automated"
               @click="onFamilyPress('automated')">
            <span class="con-played__caption">
              <span v-i18n>Automated</span>
              <b class="con-played__caption-count">{{ zones.automated.length }}</b>
              <span class="con-played__caption-open" v-i18n>Open</span>
            </span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.automated)" :key="'auto' + pi"
                                 :cards="pile" :hiddenKey="heroHiddenKey" :outNames="outNames"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH" />
            </div>
          </div>
          <!-- Identity-only tableau: an honest quiet note in the band's place. -->
          <div v-if="zones.active.length + zones.automated.length === 0" class="con-played__none" v-i18n>No played projects yet</div>

          <!-- Events — face down, one pile, per the printed rules. During the
               hero scene the pile shows the PRE-play count (the counter ticks
               only after the landed card is committed), and a first-ever
               event reserves a HIDDEN pile so the arc has a real target. -->
          <div v-if="zones.events.length > 0"
               class="con-played__family con-played__family--event"
               :class="familyClasses('events')"
               data-played-cat="events"
               @click="onFamilyPress('events')">
            <span class="con-played__caption">
              <span v-i18n>Events</span>
              <b class="con-played__caption-count">{{ zones.events.length }}</b>
              <span class="con-played__caption-open" v-i18n>Open</span>
            </span>
            <ConsolePlayedEventsPile :count="displayedEventsCount"
                                     :reserved="eventsPileReserved"
                                     :focused="focusCategory === 'events'"
                                     :out="eventsOut"
                                     :slotW="plan.slotW" :cardH="plan.cardH" />
          </div>
        </div>
      </ConsoleScrollArea>
    </div>

    <!-- The CATEGORY VIEW — mounted for the whole physical episode (the
         cards lift off the table above, fly into it, and fly back on close).
         It owns the flights; the table only holds the airborne cards' slots. -->
    <ConsolePlayedCategoryView v-if="categoryUp"
                               ref="catView"
                               :cards="categoryViewCards"
                               @settled-closed="onCategorySettled" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {
  buildPlayedZones, splitPiles, planPlayedLayout,
  pickSpatialTarget, NavRect, PlayedPlan, PlayedZones,
} from '@/client/components/console/consolePlayedModel';
import {
  playedCategories, categoryCards, PlayedCategory, PlayedCategoryKey, PLAYED_CATEGORY_LABEL,
} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, resetPlayedCategoryView, isCategoryViewUp, isCategoryViewBusy, categoryOutNames,
} from '@/client/console/played/playedCategoryView';
import {resetCategoryDirector} from '@/client/console/played/playedCategoryDirector';
import {providePlayedHeroTarget} from '@/client/console/played/consolePlayedHero';
import {HeroRect} from '@/client/console/played/playedHeroModel';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePlayedPile from '@/client/components/console/played/ConsolePlayedPile.vue';
import ConsolePlayedEventsPile from '@/client/components/console/played/ConsolePlayedEventsPile.vue';
import ConsolePlayedCategoryView from '@/client/components/console/played/ConsolePlayedCategoryView.vue';

/** Right-stick free-scroll px per intent frame (multiplied by conUiScale). */
const STICK_SCROLL_STEP = 44;
/** Chrome above/below the piles (head + captions + paddings, logical px). */
const CHROME_ALLOWANCE = 296;
/** The pile-height budget never collapses below this (logical px). */
const MIN_PILE_BUDGET = 280;

export default defineComponent({
  name: 'ConsolePlayedOverlay',
  components: {ConsoleScrollArea, ConsolePlayedPile, ConsolePlayedEventsPile, ConsolePlayedCategoryView},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    thisPlayerColor: {type: String as PropType<Color>, required: true},
    /**
     * PLAY-ANIMATION mode (the hero scene): the just-played card. The table
     * renders the +1 layout IMMEDIATELY (appended to the viewer's tableau if
     * the commit hasn't landed yet — append-only piles make the synthetic
     * and the committed layout IDENTICAL), with the card's slot reserved
     * hidden until `heroRevealed`.
     */
    heroIncoming: {type: Object as PropType<CardModel | undefined>, default: undefined},
    /** Landing committed — the reserved slot turns real (under the proxy). */
    heroRevealed: {type: Boolean, default: false},
    /** The transaction owns the moment (input inert, frame gated). */
    heroActive: {type: Boolean, default: false},
  },
  emits: {
    'close': () => true,
  },
  setup() {
    const viewport = useConsoleViewport();
    return {viewportH: viewport.height};
  },
  data() {
    return {
      /** WHOSE tableau is on the table (LB/RB cycles; defaults to the viewer). */
      viewColor: this.thisPlayerColor as Color,
      /** The focused CATEGORY (the only focusable objects of the table). */
      focusCategory: '' as PlayedCategoryKey | '',
      /** Hero-scene target-measurer deregistration (play-animation mode). */
      unregisterHeroTarget: undefined as (() => void) | undefined,
      catState: playedCategoryState,
    };
  },
  computed: {
    viewedPlayer(): PublicPlayerModel {
      return this.players.find((p) => p.color === this.viewColor) ??
        this.players.find((p) => p.color === this.thisPlayerColor) ??
        this.players[0];
    },
    zones(): PlayedZones {
      const tableau = this.viewedPlayer?.tableau ?? [];
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
    /** Names lifted OUT of the table (airborne / in the view) — their slots
     *  render held geometry so a card never exists in two places at once. */
    outNames(): ReadonlySet<string> {
      return categoryOutNames();
    },
    eventsOut(): boolean {
      // Mirrors the held semantics of `outNames`: the stack ghosts only once
      // the proxies own the cards (never a frame before they are painted).
      return this.catState.category === 'events' && this.outNames.size > 0;
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
    /** The events counter ticks only AFTER the landed card is revealed. */
    displayedEventsCount(): number {
      const n = this.zones.events.length;
      return this.heroIncoming !== undefined && this.heroIncomingIsEvent && !this.heroRevealed ?
        Math.max(0, n - 1) : n;
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
    plan(): PlayedPlan {
      const s = conUiScale();
      const budget = Math.max(MIN_PILE_BUDGET * s, this.viewportH - CHROME_ALLOWANCE * s);
      const faceUp = this.zones.corporations.length + this.zones.preludes.length +
        this.zones.ceos.length + this.zones.active.length + this.zones.automated.length;
      return planPlayedLayout({faceUpCount: faceUp, maxPileH: budget, uiScale: s});
    },
  },
  watch: {
    /** Data updated (play / undo / reconnect / seat switch): keep the focused
     *  category while it still exists, else land on the first one. */
    'categories': {
      immediate: true,
      handler(categories: ReadonlyArray<PlayedCategory>) {
        if (!categories.some((c) => c.key === this.focusCategory)) {
          this.focusCategory = categories[0]?.key ?? '';
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
      handler(key: PlayedCategoryKey | '') {
        consolePlayedUi.focusCategory = key;
        void this.$nextTick(() => this.ensureFocusVisible());
      },
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
     *  cursor seeds onto the landing card's family — the landed card's zone
     *  is already the focused one when the player regains the pad. */
    'heroIncoming': {
      immediate: true,
      handler(incoming: CardModel | undefined) {
        this.unregisterHeroTarget?.();
        this.unregisterHeroTarget = undefined;
        if (incoming !== undefined) {
          this.unregisterHeroTarget = providePlayedHeroTarget(() => this.measureHeroTarget());
          this.focusCategory = this.familyOf(incoming.name);
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
  beforeUnmount() {
    this.unregisterHeroTarget?.();
    this.unregisterHeroTarget = undefined;
    resetCategoryDirector();
    resetPlayedCategoryView();
    resetConsolePlayedUi();
  },
  methods: {
    pilesOf(cards: ReadonlyArray<CardModel>): ReadonlyArray<ReadonlyArray<CardModel>> {
      return splitPiles(cards.length, this.plan.cap).map((p) => cards.slice(p.start, p.start + p.size));
    },
    familyClasses(key: PlayedCategoryKey): Record<string, boolean> {
      return {
        'con-played__family--focused': this.focusCategory === key && !this.heroActive,
        'con-played__family--out': this.categoryUp && this.catState.category === key,
      };
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
      return this.focusCategory;
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
        this.stickScroll(intent.dy);
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
    // ── category focus (spatial over the live zone-block rects) ─────────
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
      return out;
    },
    moveFocus(dir: NavDirection): void {
      const next = pickSpatialTarget(this.focusCategory, this.collectCategoryRects(), dir);
      if (next !== undefined) {
        this.focusCategory = next as PlayedCategoryKey;
      }
    },
    ensureFocusVisible(): void {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || this.focusCategory === '') {
        return;
      }
      const el = root.querySelector<HTMLElement>(`[data-played-cat="${this.focusCategory}"]`);
      (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined, margin?: number) => void} | undefined)?.ensureVisible?.(el, 18);
    },
    stickScroll(dy: number): void {
      if (Math.abs(dy) < 0.05) {
        return;
      }
      // The shell routes the right stick here directly (scrollActiveConsole)
      // — while the category view is up, ITS grid is the scroll surface.
      if (this.categoryUp) {
        (this.$refs.catView as {stickScroll?: (dy: number) => void} | undefined)?.stickScroll?.(dy);
        return;
      }
      (this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined)?.scrollByPx?.(dy * STICK_SCROLL_STEP * conUiScale());
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
    openCategory(key: PlayedCategoryKey | ''): void {
      if (key === '' || this.heroActive || this.categoryUp) {
        return;
      }
      const cards = categoryCards(this.zones, key);
      if (cards.length === 0) {
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
      playedCategoryState.pick = undefined;
      playedCategoryState.phase = 'opening';
      // The view mounts off `phase` and runs the whole open flight itself.
    },
    onCategorySettled(): void {
      // The episode settled CLOSED — focus stays on the category it came
      // from (the table is exactly as the player left it).
      void this.$nextTick(() => this.ensureFocusVisible());
    },
    // ── the hero scene: the reserved-slot measurer ──────────────────────
    /**
     * Measure the reserved landing geometry for the incoming card: the
     * hidden face-up slot's card box, or the events backstack. Scrolls the
     * slot into view first, then waits for the rect to hold still across
     * frames (the overlay may still be running its enter transition) —
     * the arc always flies into REAL, settled geometry, never an estimate.
     */
    async measureHeroTarget(): Promise<HeroRect | undefined> {
      const incoming = this.heroIncoming;
      const root = this.$el as HTMLElement | undefined;
      if (incoming === undefined || root === undefined || typeof root.querySelector !== 'function') {
        return undefined;
      }
      await this.$nextTick();
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(incoming.name) : incoming.name.replace(/"/g, '\\"');
      const el = this.heroIncomingIsEvent ?
        root.querySelector<HTMLElement>('.con-played__family--event .con-played__backstack') :
        root.querySelector<HTMLElement>(`[data-played-key="${esc}"] .con-played__face`);
      if (el === null) {
        return undefined;
      }
      const slot = el.closest<HTMLElement>('.con-played__slot') ?? el;
      (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined, margin?: number) => void} | undefined)?.ensureVisible?.(slot, 24);
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
      if (this.players.length < 2) {
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
