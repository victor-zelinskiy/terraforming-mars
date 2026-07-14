<template>
  <!--
    `.stop` on the backdrop click: closing the fullscreen by clicking
    outside the card must NOT bubble to document-level outside-click
    handlers (e.g. PlayerHome's `handleOutsideOverlayClick`). Without it,
    the backdrop click closes the dialog AND then bubbles up — and since
    the dialog is already closed by the time it reaches document, the
    `dialog[open]` guard there misses it and the host overlay closes too.
    The inner `.card-zoom-container` already has `@click.stop`, so this
    only ever fires for genuine backdrop clicks.
  -->
  <dialog ref="dialog"
          class="card-zoom-dialog"
          :class="{'card-zoom-dialog--nav': navEnabled}"
          @click.stop="onBackdropClick">
    <!--
      v40 fullscreen presentation rework:
        - Close × button removed; dismissal is backdrop click + Esc only
          (Esc is handled natively by <dialog> via the 'cancel' → 'close'
          event chain).
        - Container is flex-column: card on top, action slot below.
        - @click.stop on the container (NOT just inner pieces) keeps the
          backdrop dismiss working only when the click is genuinely
          outside the presentation area.

      v41 navigation rework (OPT-IN via the `cards` prop):
        - When a parent passes an ordered `cards` list (> 1) the viewer
          turns into a bounded browser: prev/next HUD arrows, a counter,
          keyboard nav (← / →), and a directional slide animation.
          It lets the player decide IN fullscreen across the SAME list
          (filtered/sorted as the source UI showed it), without close +
          reopen. The `#actions` slot keeps mirroring the CURRENT card
          because the parent re-points its zoom variable from `@navigate`.
        - Omitting `cards` (journal chip, played-cards, Card.vue built-in,
          final-confirm preview, …) keeps the classic single-card view —
          no arrows, no keyboard nav, identical to before.
    -->
    <div class="card-zoom-container" @click.stop>

      <!--
        Navigation status zone (nav mode only). A DEDICATED top band that
        owns the position counter as its OWN viewer element — never sitting on
        the card and never competing with the on-card "ВЫБРАНА" ribbon. It is
        IN-FLOW (not absolute), so the card stage is pushed below it and the
        two can't overlap; the fit engine reserves its height. Three interface
        layers, cleanly separated: counter ABOVE the card, "ВЫБРАНА" ON the
        card, actions BELOW the card.
      -->
      <div v-if="navEnabled" class="card-zoom-topbar">
        <div class="card-zoom-counter" aria-hidden="true">
          <span class="card-zoom-counter__corner card-zoom-counter__corner--l" aria-hidden="true"></span>
          <span class="card-zoom-counter__current">{{ currentIndex + 1 }}</span>
          <span class="card-zoom-counter__sep">/</span>
          <span class="card-zoom-counter__total">{{ navCount }}</span>
          <span class="card-zoom-counter__corner card-zoom-counter__corner--r" aria-hidden="true"></span>
        </div>
      </div>

      <!--
        Middle row: [ prev control ] [ card stage ] [ next control ]. A flex
        row so the navigation controls are vertically centred ON the card and
        sit just OUTSIDE its left / right edges — "a viewer, the card inside,
        navigation around it". `display: contents` in the single-card (no-nav)
        path makes this wrapper layout-transparent, so every existing
        single-card use is byte-identical (the stage stays a direct container
        child); only nav mode turns it into the flanking flex row.
      -->
      <div class="card-zoom-midrow">
        <!--
          Prev / next navigation controls. Premium side controls that live in
          the viewer's gutters, never on the card. Bounded: at the first / last
          card the control is DISABLED (dimmed but still visible) so the edge of
          the set is felt, rather than a button vanishing.

          The button is wrapped in a `-slot` that hosts the disabled-reason
          tooltip via `data-hint` — a disabled <button> never fires `:hover`, so
          the hint lives on the wrapper (which DOES get hover from the pointer).
          `data-hint` is empty while the control is enabled (no tooltip then).
        -->
        <div v-if="navEnabled"
             class="card-zoom-nav-slot card-zoom-nav-slot--prev"
             :data-hint="canPrev ? '' : $t('This is the first card')">
          <button type="button"
                  class="card-zoom-nav card-zoom-nav--prev"
                  :disabled="!canPrev"
                  :aria-label="$t('Previous card')"
                  data-test="card-zoom-prev"
                  @click="prev">
            <span class="card-zoom-nav__plate" aria-hidden="true"></span>
            <span class="card-zoom-nav__chevron" aria-hidden="true"></span>
          </button>
        </div>

        <!--
          Card stage. A relative-positioned wrapper around exactly the card,
          so the leaving card can be pinned absolute (overlap, not stack)
          during the slide while the entering card defines the stage size.
          The actions panel below therefore never jumps as cards swap.
        -->
        <div class="card-zoom-stage">
          <!--
            perf (Steam Deck / console LB-RB browsing): the card is a
            PERSISTENT instance. Navigating re-points `:card` — a cheap Vue
            patch of the existing component tree — instead of REMOUNTING the
            whole card (title + cost + tags + the full renderData tree of
            symbols / tiles / production boxes, ~dozens of component instances)
            on every step. The directional slide is a compositor-only Web
            Animations transform on this same element (see `runSlide`), so there
            is never a second card tree in flight and the `zoom` fit no longer
            competes with a mount for the frame. This mirrors exactly why the
            hand carousel is smooth: mount once, move — never remount per step.
          -->
          <CardZoomCard ref="stageCard"
                        :card="activeCard"
                        :selected="selected" />
        </div>

        <div v-if="navEnabled"
             class="card-zoom-nav-slot card-zoom-nav-slot--next"
             :data-hint="canNext ? '' : $t('This is the last card')">
          <button type="button"
                  class="card-zoom-nav card-zoom-nav--next"
                  :disabled="!canNext"
                  :aria-label="$t('Next card')"
                  data-test="card-zoom-next"
                  @click="next">
            <span class="card-zoom-nav__plate" aria-hidden="true"></span>
            <span class="card-zoom-nav__chevron" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <!--
        Fullscreen action zone (v40-o redesign). Glassmorphic sci-fi strip
        that reads as the card's built-in lower chrome. The slot is empty
        when fullscreen is opened from Card.vue's built-in path (no parent
        actions) — only ЗАКРЫТЬ shows. In nav mode the slot still hosts the
        CURRENT card's action (the parent re-points its zoom var on
        @navigate), so the button always applies to what's on screen.
      -->
      <div class="card-zoom-actions">
        <div class="card-zoom-actions__panel">
          <span class="card-zoom-actions__corner card-zoom-actions__corner--tl" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--tr" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--bl" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--br" aria-hidden="true"></span>
          <button class="card-zoom-actions__btn card-zoom-actions__btn--secondary"
                  @click="close"
                  data-test="card-zoom-close">
            <span v-i18n>Close</span>
          </button>
          <slot name="actions" />
        </div>
      </div>

      <!--
        Off-screen preload of the immediate neighbours (nav mode only).
        Warms their render + assets so the next slide is instant. Lives
        OUTSIDE `.card-zoom-stage` so the fit-to-viewport measurer never
        picks it up; refreshed when idle (after each slide settles), not
        during the animation, so it never competes for a frame mid-slide.
      -->
      <div v-if="navEnabled" class="card-zoom-preload" aria-hidden="true">
        <CardZoomCard v-for="c in preloadCards" :key="'preload-' + c.name" :card="c" />
      </div>

      <!--
        Fullscreen rule overlay (premium faces only — the layer self-gates on
        a `.pcard` stage). Mounted INSIDE the container so clicks on a rule
        block ride the container's @click.stop (never a backdrop dismiss).
        `settleNonce` is the SECOND STAGE of the fullscreen choreography: it
        bumps only when the card has LANDED (open settled / slide finished /
        external re-point settled), so the rule blocks always materialize
        around a stationary card — never mid-flight.
      -->
      <CardAnnotationsLayer :cardName="annotationCardName" :nonce="settleNonce" />
    </div>
  </dialog>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {showModal, windowHasHTMLDialogElement} from '@/client/components/HTMLDialogElementCompatibility';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {motionMs} from '@/client/components/motion/motionTokens';
import {CardName} from '@/common/cards/CardName';
import {ZoomCard, isBonusZoom} from './cardZoomTypes';
import CardZoomCard from './CardZoomCard.vue';
import CardAnnotationsLayer from '@/client/components/cardAnnotations/CardAnnotationsLayer.vue';
import dialogPolyfill from 'dialog-polyfill';

// The measured card element differs by entry kind: a premium face is `.pcard`,
// a legacy card is `.card-container.filterDiv`, an Automa bonus card is
// `.mb-face`. All scoped to the viewer's own card so a stray board `.mb-face`
// is never measured.
const STAGE_CARD_SELECTOR = '.card-zoom-stage .card-zoom-card :is(.card-container.filterDiv, .pcard), .card-zoom-stage .card-zoom-card .mb-face';
const PRELOAD_CARD_SELECTOR = '.card-zoom-preload .card-zoom-card :is(.card-container.filterDiv, .pcard), .card-zoom-preload .card-zoom-card .mb-face';
const CARD_EL_SELECTOR = '.card-container.filterDiv, .pcard, .mb-face';

type Refs = {
  dialog: HTMLDialogElement;
};

type SlideDir = '' | 'next' | 'prev' | 'consume';

// Keep in sync with the slide transition duration in preferences.less. Used
// both as the slide duration and as a fallback to release the rapid-press
// guard if the animation's finish callback never fires (e.g. no WAAPI).
const ANIM_MS = 240;

// Bounded number of animation-frame retries the fit engine takes when the card
// element isn't measurable yet (~0.5s at 60fps). Covers the one-time async
// resolution of the premium face on the first fullscreen open.
const FIT_MAX_RETRIES = 30;

/*
 * perf: a card's NATURAL (zoom = 1) size is deterministic per card name, so it
 * is cached module-wide and survives reopen. A cached card fits with a pure
 * calc + one style write — NO `zoom` reset and NO forced synchronous reflow on
 * the LB/RB navigation frame (the reflow was the second half of the console
 * fullscreen jank, after the per-step remount). A card is measured at most once
 * ever; every later visit — including the very common browse-back-and-forth —
 * is free.
 */
const naturalCardSizeCache = new Map<string, {width: number, height: number}>();

export default defineComponent({
  name: 'CardZoomModal',
  components: {
    CardZoomCard,
    CardAnnotationsLayer,
  },
  props: {
    card: {
      type: Object as () => ZoomCard,
      required: true,
    },
    actionUsed: {
      type: Boolean,
      default: false,
    },
    /*
     * Strong "selected" presentation on the current card — see CardZoomCard.
     * In nav mode the parent re-binds this to the CURRENT card (it re-points
     * its zoom variable on @navigate), so the halo tracks the visible card.
     */
    selected: {
      type: Boolean,
      default: false,
    },
    /*
     * OPT-IN navigation context. The ordered list of cards the player was
     * looking at (filtered/sorted in the SOURCE order). When provided AND it
     * has more than one card, fullscreen navigation turns on. Leave undefined
     * for a pure single-card preview.
     */
    cards: {
      type: Array as () => ReadonlyArray<ZoomCard> | undefined,
      default: undefined,
    },
    /*
     * Optional starting index into `cards`. Used only to seed the initial
     * card on show() (handy when the list can contain duplicate card names,
     * e.g. drawn cards). Navigation afterwards is owned internally; parents
     * track the current card via `@navigate`, not by binding this back.
     */
    index: {
      type: Number as () => number | undefined,
      default: undefined,
    },
    /*
     * CONSOLE-NATIVE browsing feel (opt-in; the console shell passes true).
     * Two changes, both scoped to this flag so desktop stays byte-identical:
     *  - INTERRUPTIBLE navigation: rapid LB/RB never waits for the previous
     *    slide — the in-flight animation is cancelled and the next starts
     *    immediately (a held bumper pages at input rate, not animation rate);
     *  - PHYSICAL slide keyframes: the incoming card sweeps in with a slight
     *    arc (rotation around a low pivot) + settle ease — "the next card
     *    from the stack in hand", not a web-carousel strafe.
     */
    consoleMotion: {
      type: Boolean,
      default: false,
    },
    /*
     * MANDATORY viewer (opt-in; default dismissable). When false the viewer
     * cannot be dismissed by a backdrop tap or the native Esc — used by the
     * single-card «Получены карты» reveal, where the ONLY completion is taking
     * the card. The controller close paths are separately gated in the shell;
     * this covers the DOM-native ones (mouse/touch backdrop, keyboard Esc) so
     * they can't strand the reveal with the card untaken. Desktop leaves it
     * true → byte-identical.
     */
    dismissable: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['close', 'navigate', 'update:index'],
  data() {
    return {
      currentIndex: 0,
      slideDir: '' as SlideDir,
      // True while a slide is mid-flight — blocks rapid arrow/key re-entry so
      // transitions never pile up and the index never races. (In consoleMotion
      // mode this no longer BLOCKS — the in-flight slide is cancelled instead.)
      animating: false,
      animTimer: undefined as number | undefined,
      // The in-flight WAAPI slide (consoleMotion: cancelled on interrupt so
      // rapid LB/RB restarts cleanly instead of piling up).
      slideAnim: undefined as Animation | undefined,
      // Names of the cards rendered off-screen for preload (neighbours).
      preloadNames: [] as ReadonlyArray<string>,
      // The annotation layer's SETTLE signal — bumped (debounced) when the
      // fullscreen card has landed; 0 while closed. See scheduleSettle().
      settleNonce: 0,
      settleTimer: undefined as number | undefined,
      // Bounded rAF retry for the fit engine. On the FIRST-EVER fullscreen open
      // the premium face (`premium-card-face`, an async global registered in
      // main.ts to break the type cycle) hasn't resolved yet when show()'s fit
      // runs, so `.pcard` isn't in the DOM and the measure early-returns — the
      // card then stays at its unscaled CSS size (small). We retry across the
      // next frames until the element appears + measures, then apply the fit.
      fitRetryHandle: 0,
      fitRetries: 0,
      // Bounded retry budget for show() when the dialog ref isn't mounted yet
      // (heavy first-open frame) — see show().
      showRetries: 0,
    };
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    navList(): ReadonlyArray<ZoomCard> {
      return this.cards ?? [];
    },
    navEnabled(): boolean {
      return this.navList.length > 1;
    },
    navCount(): number {
      return this.navList.length;
    },
    // The card currently on screen. In nav mode it's the list entry at
    // currentIndex; otherwise the single `card` prop. Falls back to `card`
    // defensively if the index is ever transiently out of range.
    activeCard(): ZoomCard {
      if (this.navEnabled) {
        const c = this.navList[this.currentIndex];
        if (c !== undefined) {
          return c;
        }
      }
      return this.card;
    },
    canPrev(): boolean {
      return this.navEnabled && this.currentIndex > 0;
    },
    canNext(): boolean {
      return this.navEnabled && this.currentIndex < this.navList.length - 1;
    },
    preloadCards(): ReadonlyArray<ZoomCard> {
      const out: Array<ZoomCard> = [];
      for (const name of this.preloadNames) {
        const c = this.navList.find((card) => card.name === name);
        if (c !== undefined) {
          out.push(c);
        }
      }
      return out;
    },
    /** The rule-overlay card: project cards only (a bonus entry has no rules model). */
    annotationCardName(): CardName | undefined {
      return isBonusZoom(this.activeCard) ? undefined : this.activeCard.name as CardName;
    },
  },
  watch: {
    /*
     * Controlled-index escape hatch: if a parent ever drives `index` two-way,
     * follow it. No bundled context binds it back today (they track the card
     * via @navigate), so this stays a no-op in practice — `index` only seeds
     * the start in show(). Pre-flush (Vue 3 default) so slideDir lands before
     * the keyed card re-renders.
     */
    index(next: number | undefined) {
      if (next === undefined || next === this.currentIndex) {
        return;
      }
      this.applyIndex(next, next > this.currentIndex ? 'next' : 'prev');
    },
    /*
     * The list can mutate under an open modal (drawn-cards "take" removes a
     * card). Clamp the index; if a different card slid into the same slot
     * (a removal shifted the next card into place) play the calmer "consume"
     * swap and re-sync the parent + fit.
     */
    cards(next: ReadonlyArray<ZoomCard> | undefined, prev: ReadonlyArray<ZoomCard> | undefined) {
      if (next === undefined || next.length === 0) {
        return;
      }
      const prevName = prev?.[this.currentIndex]?.name;
      const clamped = Math.min(this.currentIndex, next.length - 1);
      if (clamped !== this.currentIndex) {
        this.currentIndex = clamped;
      }
      const nextName = next[clamped]?.name;
      if (nextName !== undefined && nextName !== prevName) {
        this.slideDir = 'consume';
        this.$emit('navigate', this.activeCard, this.currentIndex);
        this.$nextTick(() => {
          this.fitCardToViewport();
          this.runSlide('consume');
        });
      }
    },
    /*
     * The card on stage changed for ANY reason — internal navigation, a
     * consume swap, or an EXTERNAL re-point (the console reveal's L3 swap
     * re-points the `card` prop on the open viewer). Re-arm the annotation
     * settle with a beat generous enough for the swap-in choreography; the
     * debounce collapses this with the slide-finish bump into ONE reveal.
     */
    'activeCard.name'() {
      this.scheduleSettle(prefersReducedMotion() ? 80 : motionMs(360));
    },
  },
  methods: {
    show() {
      // Robustness on a heavy first-open frame: if the dialog ref hasn't
      // mounted yet, retry on the next frame (bounded) instead of throwing
      // inside showModal(undefined) — which aborted the open and stranded the
      // caller's state ("first fullscreen shows nothing").
      if (this.typedRefs.dialog === undefined) {
        console.warn(`%c[TM-DIAG zoom] show(): dialog ref missing, retry ${this.showRetries}`, 'color:#f59e0b');
        if (this.showRetries < 10) {
          this.showRetries++;
          requestAnimationFrame(() => this.show());
        }
        return;
      }
      this.showRetries = 0;
      this.currentIndex = this.computeStartIndex();
      this.slideDir = '';
      // Fresh fit-retry budget for this open (the persistent-instance reuse case).
      this.clearFitRetry();
      // Do NOT render the neighbour preloads synchronously on open — that
      // mounts 2 extra full card trees in the SAME frame as the dialog,
      // tripling the open cost. Start empty; warm them once the dialog has
      // painted, in idle time (well before the player can press an arrow).
      // The slide never depends on preload — the persistent stage card is just
      // re-pointed on navigation; preload only warms the neighbours' art +
      // primes the natural-size fit cache. (perf B13)
      this.preloadNames = [];
      showModal(this.typedRefs.dialog);

      console.warn(`%c[TM-DIAG zoom] showModal done: open=${this.typedRefs.dialog?.open} activeCard=${String(this.activeCard?.name)}`, 'color:#38bdf8');
      // Sync the parent to the card we actually opened on (the start index may
      // differ from the raw `card` prop, e.g. a list with duplicate names), so
      // the action slot + any index tracking are correct from the first frame.
      if (this.navEnabled) {
        this.$emit('navigate', this.activeCard, this.currentIndex);
      }
      // Fit card after the dialog is open so its natural size can be
      // measured against the actual viewport. nextTick ensures the
      // card's content has flowed before we read offsetHeight.
      this.$nextTick(() => this.fitCardToViewport());
      this.schedulePreloadWarm();
      // Stage 2 of the fullscreen choreography: the rule overlay reveals
      // after the card has landed. In consoleMotion the proxy flight lands
      // BEFORE show() is called (consoleZoomMotion — the dialog opens vanilla
      // at touchdown), so the card is already stationary here; the layer's
      // own stage-stability poll then guards the exact hand-off frame.
      this.scheduleSettle(prefersReducedMotion() ? 80 : (this.consoleMotion ? motionMs(200) : motionMs(220)));
    },
    /*
     * CONSOLE OPEN CHOREOGRAPHY (consoleZoomMotion.playZoomOpenFlight):
     * measure the LANDING geometry of the fullscreen card WITHOUT entering
     * the top layer. The dialog is still CLOSED here; an inline
     * `display:flex; visibility:hidden` overrides `dialog:not([open])`'s
     * display:none, which lays the dialog out EXACTLY as the open state
     * (the top layer never changes layout — same fixed 100vw×100vh box)
     * while painting nothing. The fit engine then sizes the card as usual
     * (priming the natural-size cache, so show()'s own fit is a pure cache
     * hit) and the card's visual rect + applied zoom feed the proxy flight.
     *
     * This exists so `showModal()` can be DEFERRED to the flight's
     * touchdown: the dialog's very first top-layer frame is then the final,
     * fully-visible, untransformed content — the compositor-safe shape (see
     * the consoleZoomMotion.ts header for why this is load-bearing).
     *
     * Bounded frame retries cover the async premium face on a first-ever
     * open; undefined → the caller opens vanilla immediately (JSDOM /
     * degenerate layout / timeout) and the in-show fit retries take over.
     */
    async measureLanding(): Promise<{rect: {left: number, top: number, width: number, height: number}, zoom: number} | undefined> {
      const dialog = this.typedRefs.dialog;
      if (dialog === undefined || dialog.open) {
        return undefined;
      }
      // Seed the index so the fit measures the OPENED card, not slot 0 —
      // show() recomputes the same value later (idempotent).
      this.currentIndex = this.computeStartIndex();
      const prev = {display: dialog.style.display, visibility: dialog.style.visibility, pointerEvents: dialog.style.pointerEvents};
      dialog.style.display = 'flex';
      dialog.style.visibility = 'hidden';
      dialog.style.pointerEvents = 'none';
      try {
        for (let i = 0; i < FIT_MAX_RETRIES; i++) {
          this.fitCardToViewport();
          const cardEl = dialog.querySelector<HTMLElement>(STAGE_CARD_SELECTOR);
          const r = cardEl?.getBoundingClientRect();
          if (cardEl !== null && r !== undefined && r.width >= 10 && r.height >= 10) {
            const zoom = Number(cardEl.style.zoom || '1');
            return {
              rect: {left: r.left, top: r.top, width: r.width, height: r.height},
              zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1,
            };
          }
          if (typeof requestAnimationFrame !== 'function') {
            return undefined; // JSDOM — the caller opens vanilla
          }
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (this.typedRefs.dialog !== dialog || dialog.open) {
            return undefined; // unmounted / shown by someone else mid-measure
          }
        }
        return undefined;
      } finally {
        dialog.style.display = prev.display;
        dialog.style.visibility = prev.visibility;
        dialog.style.pointerEvents = prev.pointerEvents;
        // The measure loop may have burned the fit-retry budget on a card
        // that wasn't measurable yet — show() re-arms it anyway; drop any
        // stray pending frame so it can't double-fit.
        this.clearFitRetry();
      }
    },
    // Warm the neighbour preloads AFTER the open frame has painted, so the
    // initial fullscreen open only renders the one visible card. Self-guards
    // on the dialog still being open (it may close before this fires). (perf B13)
    schedulePreloadWarm() {
      if (!this.navEnabled) {
        return;
      }
      window.setTimeout(() => {
        if (this.typedRefs.dialog?.open === true) {
          this.refreshPreload();
        }
      }, 90);
    },
    close() {
      if (this.typedRefs.dialog.open) {
        this.typedRefs.dialog.close();
      }
    },
    onBackdropClick() {
      // A mandatory viewer (single-card reveal) can't be dismissed by a
      // backdrop tap — the card must be taken.
      if (!this.dismissable) {
        return;
      }
      this.close();
    },
    computeStartIndex(): number {
      if (!this.navEnabled) {
        return 0;
      }
      if (this.index !== undefined && this.index >= 0 && this.index < this.navList.length) {
        return this.index;
      }
      const byName = this.navList.findIndex((c) => c.name === this.card.name);
      return byName >= 0 ? byName : 0;
    },
    prev() {
      this.go(-1);
    },
    next() {
      this.go(1);
    },
    /*
     * Step the viewer. Bounded (no wrap) and guarded against rapid re-entry:
     * while a slide is animating further steps are ignored, so the transition
     * never piles up and currentIndex (the single source of truth) never
     * races. Holding an arrow simply paces at the animation rate.
     */
    go(delta: number) {
      // consoleMotion: never block on an in-flight slide — cancel + restart
      // (runSlide handles the cancel). Desktop keeps the classic guard.
      if (!this.navEnabled || (this.animating && !this.consoleMotion)) {
        return;
      }
      const target = this.currentIndex + delta;
      if (target < 0 || target >= this.navList.length) {
        return;
      }
      this.applyIndex(target, delta > 0 ? 'next' : 'prev');
      this.$emit('update:index', target);
    },
    /*
     * Commit a new index + slide direction. The persistent stage card is
     * re-pointed (patched, not remounted) to `navList[target]`; `dir` only
     * chooses the compositor slide direction in `runSlide`. Emits
     * `navigate(card, index)` so the parent re-points its zoom variable → the
     * action slot + selected halo follow the visible card.
     */
    applyIndex(target: number, dir: SlideDir) {
      this.slideDir = dir;
      this.currentIndex = target;
      this.startAnimGuard();
      this.$emit('navigate', this.activeCard, target);
      // One flush: the persistent card is patched to the new model, then fit
      // (cached → no reflow) and slid — all before the browser paints, so there
      // is no intermediate frame at the old zoom / old card.
      this.$nextTick(() => {
        this.fitCardToViewport();
        this.runSlide(dir);
      });
    },
    startAnimGuard() {
      this.animating = true;
      this.clearAnimTimer();
      const wait = (prefersReducedMotion() ? 0 : ANIM_MS) + 80;
      this.animTimer = window.setTimeout(() => {
        this.animating = false;
        this.animTimer = undefined;
      }, wait);
    },
    clearAnimTimer() {
      if (this.animTimer !== undefined) {
        window.clearTimeout(this.animTimer);
        this.animTimer = undefined;
      }
    },
    releaseAnimGuard() {
      this.animating = false;
      this.clearAnimTimer();
    },
    /*
     * Debounced settle for the rule overlay: every transition path schedules
     * its own beat and the LAST schedule wins, so open + navigation + an
     * external re-point can never stack into a double reveal. The callback
     * self-gates on the dialog still being open.
     */
    scheduleSettle(delayMs: number) {
      this.cancelSettle();
      this.settleTimer = window.setTimeout(() => {
        this.settleTimer = undefined;
        if (this.typedRefs.dialog?.open === true) {
          this.settleNonce++;
        }
      }, delayMs);
    },
    cancelSettle() {
      if (this.settleTimer !== undefined) {
        window.clearTimeout(this.settleTimer);
        this.settleTimer = undefined;
      }
    },
    /*
     * The directional slide of the PERSISTENT card, driven by the Web
     * Animations API — a compositor-only transform + opacity tween on the ONE
     * card element. It never forces layout and never needs a second (leaving)
     * card tree, which is what the old mount/unmount `<transition>` cost per
     * step. No-op (and immediate guard release) where `.animate` is missing
     * (JSDOM under test), so behaviour is unchanged there.
     */
    runSlide(dir: SlideDir) {
      const host = (this.$refs.stageCard as {$el?: HTMLElement} | undefined)?.$el;
      if (host === undefined || host === null || typeof host.animate !== 'function') {
        this.releaseAnimGuard();
        this.refreshPreload();
        this.scheduleSettle(0);
        return;
      }
      // consoleMotion interrupt: a rapid re-step cancels the in-flight slide
      // (the element snaps to identity for one frame, immediately covered by
      // the new slide's from-state) — no pile-up, no stuck intermediate state.
      this.slideAnim?.cancel();
      this.slideAnim = undefined;
      const reduced = prefersReducedMotion();
      let from: Record<string, string>;
      let easing = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
      let duration = reduced ? 120 : ANIM_MS;
      if (reduced || dir === '') {
        from = {opacity: '0'};
      } else if (dir === 'consume') {
        // A card left the set (drawn-cards take): the next one settles in with
        // a gentle scale-up rather than a lateral slide.
        from = {opacity: '0', transform: 'scale(0.92)'};
      } else if (this.consoleMotion) {
        // Physical page-turn: the next card sweeps in from the browse side
        // with a slight arc (rotation around a low pivot set in CSS —
        // `.con-zoom .card-zoom-card { transform-origin: 50% 120% }`) and a
        // damped settle — "the next card from the stack", direction obvious.
        const sign = dir === 'next' ? 1 : -1;
        from = {opacity: '0.1', transform: `translateX(${sign * 96}px) rotate(${sign * 3.2}deg) scale(0.94)`};
        easing = 'cubic-bezier(0.34, 1.26, 0.44, 1)';
        duration = 210;
      } else {
        const dx = dir === 'next' ? '38px' : '-38px';
        from = {opacity: '0', transform: `translateX(${dx}) scale(0.96)`};
      }
      const to = {opacity: '1', transform: 'translateX(0) rotate(0deg) scale(1)'};
      const anim = host.animate([from, to], {duration, easing});
      this.slideAnim = anim;
      anim.onfinish = () => {
        if (this.slideAnim === anim) {
          this.slideAnim = undefined;
        }
        this.releaseAnimGuard();
        // Warm the next neighbours' art + prime the fit cache while idle.
        this.refreshPreload();
        // The landed card is stationary — reveal its rule overlay. (A
        // cancelled slide never finishes, so rapid browsing defers the
        // reveal to the card the player actually lands on.)
        this.scheduleSettle(60);
      };
    },
    refreshPreload() {
      if (!this.navEnabled) {
        this.preloadNames = [];
        return;
      }
      const names: Array<string> = [];
      const before = this.navList[this.currentIndex - 1];
      const after = this.navList[this.currentIndex + 1];
      if (before !== undefined) {
        names.push(before.name);
      }
      if (after !== undefined) {
        names.push(after.name);
      }
      this.preloadNames = names;
      // Idle: the preload clones render at natural (zoom:1) scale off-screen, so
      // reading their box primes the fit cache for the neighbours. The next
      // navigation step onto a neighbour is then a cache hit → zero forced
      // reflow on the input frame (matters when browsing FORWARD through a fresh
      // list, where every card is a first visit).
      this.$nextTick(() => this.primeFitCacheFromPreload());
    },
    /*
     * Prime the natural-size cache from the off-screen preload clones (see the
     * `.card-zoom-preload` CSS — position:fixed off-screen, children at zoom:1,
     * so their offset box IS the natural size). Runs on idle only.
     */
    primeFitCacheFromPreload() {
      const dialog = this.typedRefs.dialog;
      if (dialog === undefined || !dialog.open) {
        return;
      }
      const rendered = this.preloadCards; // same order as the DOM clones
      // One matched element per clone (a project card's `.card-container` or a
      // bonus card's `.mb-face`), so the index aligns with `rendered`.
      const els = dialog.querySelectorAll(PRELOAD_CARD_SELECTOR);
      els.forEach((node, i) => {
        const model = rendered[i];
        if (model === undefined || naturalCardSizeCache.has(model.name)) {
          return;
        }
        const el = node as HTMLElement;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (w > 0 && h > 0) {
          naturalCardSizeCache.set(model.name, {width: w, height: h});
        }
      });
    },
    onKeydown(e: KeyboardEvent) {
      if (!this.navEnabled) {
        return;
      }
      // Only act while THIS dialog is the open one.
      if (this.typedRefs.dialog === undefined || !this.typedRefs.dialog.open) {
        return;
      }
      // Never hijack typing.
      const t = e.target as HTMLElement | null;
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      // Arrow keys only. A/D are deliberately NOT bound: HomeMixin.navigatePage
      // already owns KeyA/KeyD (jump to board / hand) on a window listener that
      // doesn't check for an open dialog, so binding them here would double-fire
      // (navigate the card AND scroll the board behind the modal). Arrow keys
      // have no such global owner.
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      }
      // Escape stays native (<dialog> 'cancel' → 'close' → @close).
    },
    onResize() {
      this.fitCardToViewport();
    },
    /*
     * Dynamic fit-to-viewport zoom calculator. The static media-query
     * ladder in preferences.less worked for short cards but blew past
     * the viewport on tall ones. Algorithm: reset zoom to 1, measure the
     * natural size, compute the largest zoom that fits both axes inside
     * the available viewport (minus chrome), clamp to [1.0, 2.8], apply
     * inline. Runs on show(), on every slide (via @enter), and on resize.
     *
     * `cardRoot` is the entering `.card-zoom-card` passed by the transition
     * @enter hook; without it we query the VISIBLE stage card (never the
     * off-screen preload clones).
     */
    fitCardToViewport(cardRoot?: HTMLElement): void {
      const dialog = this.typedRefs.dialog;
      const cardEl = (cardRoot !== undefined ?
        cardRoot.querySelector(CARD_EL_SELECTOR) :
        dialog?.querySelector(STAGE_CARD_SELECTOR)) as HTMLElement | null;
      if (cardEl === null || cardEl === undefined) {
        // The card face isn't in the DOM yet — on the first fullscreen open the
        // async premium face is still resolving. Retry on the next frame(s).
        if (this.fitRetries === 0 || this.fitRetries === FIT_MAX_RETRIES - 1) {
          console.warn(`%c[TM-DIAG zoom] fit: card element NOT FOUND in stage (retry ${this.fitRetries}/${FIT_MAX_RETRIES})`, 'color:#f59e0b');
        }
        this.scheduleFitRetry();
        return;
      }

      // The natural (zoom = 1) size is deterministic per card, so measure it AT
      // MOST ONCE and cache it module-wide. On a cache HIT (every revisit, and —
      // once the neighbours are warmed — the very next step) the fit is a pure
      // calc plus a single style write: no `zoom` reset, no forced reflow. Only
      // a card never seen before pays the one-time measurement.
      const name = this.activeCard.name;
      let natural = naturalCardSizeCache.get(name);
      if (natural === undefined) {
        const previousZoom = cardEl.style.zoom;
        cardEl.style.zoom = '1';
        // Reading offsetHeight forces the one synchronous layout pass needed to
        // learn this card's natural size.
        void cardEl.offsetHeight;
        const w = cardEl.offsetWidth;
        const h = cardEl.offsetHeight;
        if (w === 0 || h === 0) {
          // Card not laid out yet (e.g. display:none mid-swap, or the premium
          // face resolved but hasn't flowed) — restore and retry next frame.
          cardEl.style.zoom = previousZoom;
          this.scheduleFitRetry();
          return;
        }
        natural = {width: w, height: h};
        naturalCardSizeCache.set(name, natural);
      }

      // Available space. Numbers mirror .card-zoom-container's padding
      // (24+24=48) + gap (20) + actions-panel reservation (96) plus a small
      // safety buffer (8). In nav mode reserve MORE so the card lands in a clean
      // centre band: the top counter zone is its OWN in-flow row (~44px + a 20px
      // gap) so the card never grows up under it, and each side gutter (~120px)
      // is wide enough that the navigation controls sit fully OUTSIDE the card.
      const chromeVertical = 48 + 20 + 96 + 8 + (this.navEnabled ? 64 : 0);
      const chromeHorizontal = 32 + 8 + (this.navEnabled ? 200 : 0);
      const availHeight = window.innerHeight - chromeVertical;
      const availWidth = window.innerWidth - chromeHorizontal;

      // Per-axis fit zoom, clamped to the readable / aesthetic range.
      const fitZoom = Math.min(availHeight / natural.height, availWidth / natural.width);
      const MIN_ZOOM = 1.0;
      const MAX_ZOOM = 2.8;
      const finalZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));

      cardEl.style.zoom = String(finalZoom);
      // Measured + applied — cancel any pending retry and re-arm the budget.
      this.clearFitRetry();
    },
    /*
     * Schedule a bounded animation-frame retry of the fit. Used when the card
     * element isn't measurable yet — the first fullscreen open races the async
     * premium face's resolution. Coalesced (one pending frame) and self-limiting
     * (FIT_MAX_RETRIES), and only re-fires while the dialog is open.
     */
    scheduleFitRetry(): void {
      if (this.fitRetryHandle !== 0 || this.fitRetries >= FIT_MAX_RETRIES) {
        return;
      }
      this.fitRetryHandle = window.requestAnimationFrame(() => {
        this.fitRetryHandle = 0;
        this.fitRetries++;
        if (this.typedRefs.dialog?.open === true) {
          this.fitCardToViewport();
        }
      });
    },
    clearFitRetry(): void {
      this.fitRetries = 0;
      if (this.fitRetryHandle !== 0) {
        window.cancelAnimationFrame(this.fitRetryHandle);
        this.fitRetryHandle = 0;
      }
    },
  },
  mounted() {
    if (!windowHasHTMLDialogElement()) {
      dialogPolyfill.registerDialog(this.typedRefs.dialog);
    }
    this.typedRefs.dialog.addEventListener('close', () => {
      // Rule overlay off: nonce 0 clears the blocks + the target marks so a
      // reopen (the modal instance can persist across opens) starts clean.
      this.cancelSettle();
      this.settleNonce = 0;
      this.$emit('close');
    });
    // A mandatory viewer swallows the native Esc ('cancel' fires before
    // 'close') so a keyboard press can't strand the single-card reveal.
    this.typedRefs.dialog.addEventListener('cancel', (e: Event) => {
      if (!this.dismissable) {
        e.preventDefault();
      }
    });
    // Re-fit on viewport resize so cards stay within bounds when the
    // player resizes the window with the modal open.
    window.addEventListener('resize', this.onResize);
    // Keyboard navigation (nav mode only; the handler self-gates).
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeydown);
    this.clearAnimTimer();
    this.cancelSettle();
    this.clearFitRetry();
  },
});
</script>
