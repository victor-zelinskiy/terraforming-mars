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
          <transition :name="transitionName"
                      @enter="onCardEnter"
                      @after-enter="onCardAfterEnter">
            <CardZoomCard :key="activeCard.name"
                          :card="activeCard"
                          :selected="selected" />
          </transition>
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
    </div>
  </dialog>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {showModal, windowHasHTMLDialogElement} from '@/client/components/HTMLDialogElementCompatibility';
import {CardModel} from '@/common/models/CardModel';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import CardZoomCard from './CardZoomCard.vue';

import dialogPolyfill from 'dialog-polyfill';

type Refs = {
  dialog: HTMLDialogElement;
};

type SlideDir = '' | 'next' | 'prev' | 'consume';

// Keep in sync with the slide transition duration in preferences.less. Used
// only as a fallback to release the rapid-press guard if a transition hook
// never fires (e.g. reduced-motion, element reuse).
const ANIM_MS = 240;

export default defineComponent({
  name: 'CardZoomModal',
  components: {
    CardZoomCard,
  },
  props: {
    card: {
      type: Object as () => CardModel,
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
      type: Array as () => ReadonlyArray<CardModel> | undefined,
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
  },
  emits: ['close', 'navigate', 'update:index'],
  data() {
    return {
      currentIndex: 0,
      slideDir: '' as SlideDir,
      // True while a slide is mid-flight — blocks rapid arrow/key re-entry so
      // transitions never pile up and the index never races.
      animating: false,
      animTimer: undefined as number | undefined,
      // Names of the cards rendered off-screen for preload (neighbours).
      preloadNames: [] as ReadonlyArray<string>,
    };
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    navList(): ReadonlyArray<CardModel> {
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
    activeCard(): CardModel {
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
    transitionName(): string {
      // No-op name (no matching CSS) so the single-card / initial-mount path
      // never picks up stray default transition classes.
      if (this.slideDir === '') {
        return 'card-zoom-none';
      }
      // Reduced-motion: collapse every direction to a quick fade (no slide).
      if (prefersReducedMotion()) {
        return 'card-zoom-rm';
      }
      return 'card-zoom-' + this.slideDir;
    },
    preloadCards(): ReadonlyArray<CardModel> {
      const out: Array<CardModel> = [];
      for (const name of this.preloadNames) {
        const c = this.navList.find((card) => card.name === name);
        if (c !== undefined) {
          out.push(c);
        }
      }
      return out;
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
    cards(next: ReadonlyArray<CardModel> | undefined, prev: ReadonlyArray<CardModel> | undefined) {
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
        this.$nextTick(() => this.fitCardToViewport());
        this.refreshPreload();
      }
    },
  },
  methods: {
    show() {
      this.currentIndex = this.computeStartIndex();
      this.slideDir = '';
      // Do NOT render the neighbour preloads synchronously on open — that
      // mounts 2 extra full card trees in the SAME frame as the dialog,
      // tripling the open cost. Start empty; warm them once the dialog has
      // painted, in idle time (well before the player can press an arrow).
      // The slide itself never depends on preload — the target card mounts
      // fresh via the keyed transition either way. (perf B13)
      this.preloadNames = [];
      showModal(this.typedRefs.dialog);
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
      if (!this.navEnabled || this.animating) {
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
     * Commit a new index + slide direction. Sets slideDir BEFORE currentIndex
     * so the keyed-card transition in the same render flush picks the right
     * direction. Emits `navigate(card, index)` so the parent re-points its
     * zoom variable → the action slot + selected halo follow the visible card.
     */
    applyIndex(target: number, dir: SlideDir) {
      this.slideDir = dir;
      this.currentIndex = target;
      this.startAnimGuard();
      this.$emit('navigate', this.activeCard, target);
      this.$nextTick(() => this.fitCardToViewport());
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
    onCardEnter(el: Element) {
      // Fit the INCOMING card before its enter frame paints so it never pops
      // from the default zoom to the fitted one mid-slide.
      this.fitCardToViewport(el as HTMLElement);
    },
    onCardAfterEnter() {
      // Slide settled — release the guard early (don't wait for the fallback
      // timer) and warm the next neighbours while idle.
      this.animating = false;
      this.clearAnimTimer();
      this.refreshPreload();
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
        cardRoot.querySelector('.card-container.filterDiv') :
        dialog?.querySelector('.card-zoom-stage .card-zoom-card .card-container.filterDiv')) as HTMLElement | null;
      if (cardEl === null || cardEl === undefined) {
        return;
      }

      // Step 1+2: reset to zoom 1 and force reflow for natural size.
      const previousZoom = cardEl.style.zoom;
      cardEl.style.zoom = '1';
      // Reading offsetHeight forces a synchronous layout pass.
      void cardEl.offsetHeight;

      const naturalWidth = cardEl.offsetWidth;
      const naturalHeight = cardEl.offsetHeight;
      if (naturalWidth === 0 || naturalHeight === 0) {
        // Card not rendered yet (e.g., display:none mid-transition).
        cardEl.style.zoom = previousZoom;
        return;
      }

      // Step 4: available space. Numbers mirror .card-zoom-container's
      // padding (24+24=48) + gap (20) + actions-panel reservation (96) plus a
      // small safety buffer (8). In nav mode reserve MORE so the card lands in
      // a clean centre band: the top counter zone is its OWN in-flow row
      // (~44px + a 20px gap) so the card never grows up under it, and each side
      // gutter (~120px) is wide enough that the navigation controls sit fully
      // OUTSIDE the card, not on it — even on narrow viewports.
      const chromeVertical = 48 + 20 + 96 + 8 + (this.navEnabled ? 64 : 0);
      const chromeHorizontal = 32 + 8 + (this.navEnabled ? 200 : 0);
      const availHeight = window.innerHeight - chromeVertical;
      const availWidth = window.innerWidth - chromeHorizontal;

      // Step 5: per-axis fit zoom.
      const zoomByHeight = availHeight / naturalHeight;
      const zoomByWidth = availWidth / naturalWidth;
      const fitZoom = Math.min(zoomByHeight, zoomByWidth);

      // Step 6: clamp to readable / aesthetic range.
      const MIN_ZOOM = 1.0;
      const MAX_ZOOM = 2.8;
      const finalZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));

      cardEl.style.zoom = String(finalZoom);
    },
  },
  mounted() {
    if (!windowHasHTMLDialogElement()) {
      dialogPolyfill.registerDialog(this.typedRefs.dialog);
    }
    this.typedRefs.dialog.addEventListener('close', () => {
      this.$emit('close');
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
  },
});
</script>
