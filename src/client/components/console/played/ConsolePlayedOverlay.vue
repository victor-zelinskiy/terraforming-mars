<template>
  <!--
    CONSOLE «РАЗЫГРАНО» — the console-native played-cards overlay (X from the
    board home). A bottom-anchored TABLE panel, deliberately NOT full-screen:
    its height follows the content (a young tableau leaves the board visible
    behind it) up to a cap, after which the body scrolls inside a
    ConsoleScrollArea. Cards lie in physical peek piles (see
    consolePlayedModel); events lie face down in one pile that opens a nested
    list. View-only: nothing here ever submits — the fullscreen viewer is
    opened with NO select/action bridges.

    Input: the shell owns the pad and delegates via handleIntent (the
    journal/task-host pattern); the command-bar hints are mirrored through
    consolePlayedUi. Focus is a stable KEY (card name / #events), navigation
    is SPATIAL over the live slot rects — matching what the player sees.
  -->
  <div class="con-played">
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
        <div v-if="targets.length === 0" class="con-played__void">
          <span class="con-played__void-glyph" aria-hidden="true">◈</span>
          <span v-i18n>No cards played yet</span>
        </div>

        <div v-else class="con-played__table">
          <!-- Identity zone: corporation(s) / preludes / CEO — who the player IS. -->
          <div v-if="zones.corporations.length > 0" class="con-played__family con-played__family--identity con-played__family--corporation">
            <span class="con-played__caption" v-i18n>Corporation</span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.corporations)" :key="'corp' + pi"
                                 :cards="pile" :focusKey="focusKey"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH"
                                 @press="onCardPress" />
            </div>
          </div>
          <div v-if="zones.preludes.length > 0" class="con-played__family con-played__family--identity con-played__family--prelude">
            <span class="con-played__caption" v-i18n>Preludes</span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.preludes)" :key="'prel' + pi"
                                 :cards="pile" :focusKey="focusKey"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH"
                                 @press="onCardPress" />
            </div>
          </div>
          <div v-if="zones.ceos.length > 0" class="con-played__family con-played__family--identity con-played__family--ceo">
            <span class="con-played__caption" v-i18n>CEO</span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.ceos)" :key="'ceo' + pi"
                                 :cards="pile" :focusKey="focusKey"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH"
                                 @press="onCardPress" />
            </div>
          </div>

          <!-- The permanent-projects band (blue / green piles). -->
          <div v-if="zones.active.length > 0" class="con-played__family con-played__family--active">
            <span class="con-played__caption" v-i18n>Active</span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.active)" :key="'act' + pi"
                                 :cards="pile" :focusKey="focusKey"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH"
                                 @press="onCardPress" />
            </div>
          </div>
          <div v-if="zones.automated.length > 0" class="con-played__family con-played__family--automated">
            <span class="con-played__caption" v-i18n>Automated</span>
            <div class="con-played__piles">
              <ConsolePlayedPile v-for="(pile, pi) in pilesOf(zones.automated)" :key="'auto' + pi"
                                 :cards="pile" :focusKey="focusKey"
                                 :zoom="plan.zoom" :slotW="plan.slotW" :cardH="plan.cardH" :peekH="plan.peekH"
                                 @press="onCardPress" />
            </div>
          </div>
          <!-- Identity-only tableau: an honest quiet note in the band's place. -->
          <div v-if="zones.active.length + zones.automated.length === 0" class="con-played__none" v-i18n>No played projects yet</div>

          <!-- Events — face down, one pile, per the printed rules. -->
          <div v-if="zones.events.length > 0" class="con-played__family con-played__family--event">
            <span class="con-played__caption" v-i18n>Events</span>
            <ConsolePlayedEventsPile :count="zones.events.length"
                                     :focused="focusKey === EVENTS_PILE_KEY"
                                     :slotW="plan.slotW" :cardH="plan.cardH"
                                     @open="openEvents" />
          </div>
        </div>
      </ConsoleScrollArea>

      <!-- The gliding selection frame — gated off while the events list owns
           the pad (it mounts its own) or the fullscreen viewer is up. -->
      <ConsoleCardFocusFrame selector=".con-played__table .con-played__slot--focused .con-played__focusbox" :active="!eventsOpen" />
    </div>

    <transition name="con-layer">
      <ConsolePlayedEventsOverlay v-if="eventsOpen"
                                  ref="events"
                                  :cards="zones.events"
                                  :focusKey="eventsFocusKey"
                                  :zoom="eventsZoom"
                                  :slotW="eventsSlotW"
                                  :cardH="eventsCardH"
                                  @press="onEventPress"
                                  @close="closeEvents" />
    </transition>
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
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {
  buildPlayedZones, buildPlayedTargets, flatFaceUp, splitPiles, planPlayedLayout,
  pickSpatialTarget, EVENTS_PILE_KEY, NavRect, PlayedPlan, PlayedZones, PlayedTarget,
  PLAYED_CARD_NATURAL_W, PLAYED_CARD_NATURAL_H,
} from '@/client/components/console/consolePlayedModel';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCardFocusFrame from '@/client/components/console/cardDeal/ConsoleCardFocusFrame.vue';
import ConsolePlayedPile from '@/client/components/console/played/ConsolePlayedPile.vue';
import ConsolePlayedEventsPile from '@/client/components/console/played/ConsolePlayedEventsPile.vue';
import ConsolePlayedEventsOverlay from '@/client/components/console/played/ConsolePlayedEventsOverlay.vue';

/** Right-stick free-scroll px per intent frame (multiplied by conUiScale). */
const STICK_SCROLL_STEP = 44;
/** Chrome above/below the piles (head + captions + paddings, logical px). */
const CHROME_ALLOWANCE = 296;
/** The pile-height budget never collapses below this (logical px). */
const MIN_PILE_BUDGET = 280;

export default defineComponent({
  name: 'ConsolePlayedOverlay',
  components: {ConsoleScrollArea, ConsoleCardFocusFrame, ConsolePlayedPile, ConsolePlayedEventsPile, ConsolePlayedEventsOverlay},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    thisPlayerColor: {type: String as PropType<Color>, required: true},
  },
  emits: {
    close: () => true,
  },
  setup() {
    const viewport = useConsoleViewport();
    return {viewportH: viewport.height};
  },
  data() {
    return {
      /** WHOSE tableau is on the table (LB/RB cycles; defaults to the viewer). */
      viewColor: this.thisPlayerColor as Color,
      /** Focused object — a stable KEY (card name / #events), never an index. */
      focusKey: '',
      eventsOpen: false,
      eventsFocusKey: '',
      EVENTS_PILE_KEY,
    };
  },
  computed: {
    viewedPlayer(): PublicPlayerModel {
      return this.players.find((p) => p.color === this.viewColor) ??
        this.players.find((p) => p.color === this.thisPlayerColor) ??
        this.players[0];
    },
    zones(): PlayedZones {
      return buildPlayedZones(this.viewedPlayer?.tableau ?? []);
    },
    targets(): ReadonlyArray<PlayedTarget> {
      return buildPlayedTargets(this.zones);
    },
    faceUp(): ReadonlyArray<CardModel> {
      return flatFaceUp(this.zones);
    },
    totalCount(): number {
      return this.faceUp.length + this.zones.events.length;
    },
    plan(): PlayedPlan {
      const s = conUiScale();
      const budget = Math.max(MIN_PILE_BUDGET * s, this.viewportH - CHROME_ALLOWANCE * s);
      return planPlayedLayout({faceUpCount: this.faceUp.length, maxPileH: budget, uiScale: s});
    },
    /** The turned-over events read a touch larger than the packed tableau. */
    eventsZoom(): number {
      return Math.max(this.plan.zoom, 0.5 * conUiScale());
    },
    eventsSlotW(): number {
      return PLAYED_CARD_NATURAL_W * this.eventsZoom;
    },
    eventsCardH(): number {
      return PLAYED_CARD_NATURAL_H * this.eventsZoom;
    },
    focusKind(): 'card' | 'events' | 'none' {
      return this.targets.find((t) => t.key === this.focusKey)?.kind ?? 'none';
    },
  },
  watch: {
    /** Data updated (play / undo / reconnect / seat switch): keep the focus
     *  key when the object still exists, else land on the first target. */
    'targets': {
      immediate: true,
      handler(targets: ReadonlyArray<PlayedTarget>) {
        if (!targets.some((t) => t.key === this.focusKey)) {
          this.focusKey = targets[0]?.key ?? '';
        }
        if (this.eventsOpen && this.zones.events.length === 0) {
          this.closeEvents();
        }
        if (this.eventsOpen && !this.zones.events.some((c) => c.name === this.eventsFocusKey)) {
          this.eventsFocusKey = this.zones.events[0]?.name ?? '';
        }
      },
    },
    'focusKey'() {
      void this.$nextTick(() => this.ensureFocusVisible());
    },
    'eventsFocusKey'() {
      void this.$nextTick(() => (this.$refs.events as InstanceType<typeof ConsolePlayedEventsOverlay> | undefined)?.ensureVisible());
    },
    // Command-bar mirrors (the bar never pokes refs).
    'focusKind': {
      immediate: true,
      handler(kind: 'card' | 'events' | 'none') {
        consolePlayedUi.focusKind = kind;
      },
    },
    'eventsOpen'(open: boolean) {
      consolePlayedUi.eventsOpen = open;
    },
    'players.length': {
      immediate: true,
      handler(n: number) {
        consolePlayedUi.canCyclePlayer = n > 1;
      },
    },
  },
  beforeUnmount() {
    resetConsolePlayedUi();
  },
  methods: {
    pilesOf(cards: ReadonlyArray<CardModel>): ReadonlyArray<ReadonlyArray<CardModel>> {
      return splitPiles(cards.length, this.plan.cap).map((p) => cards.slice(p.start, p.start + p.size));
    },
    // ── the pad grammar (delegated by the shell) ────────────────────────
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        this.stickScroll(intent.dy);
        return;
      }
      if (this.eventsOpen) {
        this.handleEventsIntent(intent);
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
        this.activateFocused();
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
    handleEventsIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        const next = pickSpatialTarget(this.eventsFocusKey, this.collectRects('[data-events-key]', 'eventsKey'), intent.dir);
        if (next !== undefined) {
          this.eventsFocusKey = next;
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
      case 'inspect':
        this.inspectEvent();
        break;
      case 'back':
        this.closeEvents();
        break;
      default:
        break;
      }
    },
    // ── spatial focus ───────────────────────────────────────────────────
    collectRects(selector: string, dataKey: 'playedKey' | 'eventsKey'): ReadonlyArray<NavRect> {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelectorAll !== 'function') {
        return [];
      }
      const out: Array<NavRect> = [];
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        const key = el.dataset[dataKey];
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
      const next = pickSpatialTarget(this.focusKey, this.collectRects('[data-played-key]', 'playedKey'), dir);
      if (next !== undefined) {
        this.focusKey = next;
      }
    },
    ensureFocusVisible(): void {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || this.focusKey === '') {
        return;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(this.focusKey) : this.focusKey.replace(/"/g, '\\"');
      const el = root.querySelector<HTMLElement>(`[data-played-key="${esc}"]`);
      (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined, margin?: number) => void} | undefined)?.ensureVisible?.(el, 18);
    },
    stickScroll(dy: number): void {
      if (Math.abs(dy) < 0.05) {
        return;
      }
      const step = dy * STICK_SCROLL_STEP * conUiScale();
      if (this.eventsOpen) {
        (this.$refs.events as InstanceType<typeof ConsolePlayedEventsOverlay> | undefined)?.scrollByPx(step);
        return;
      }
      (this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined)?.scrollByPx?.(step);
    },
    // ── activation ──────────────────────────────────────────────────────
    activateFocused(): void {
      const target = this.targets.find((t) => t.key === this.focusKey);
      if (target === undefined) {
        return;
      }
      if (target.kind === 'events') {
        this.openEvents();
        return;
      }
      this.inspectCard(this.focusKey);
    },
    /** Mouse support (secondary input): click focuses; a second click on the
     *  already-focused card inspects it. */
    onCardPress(name: string): void {
      if (this.focusKey === name) {
        this.activateFocused();
      } else {
        this.focusKey = name;
      }
    },
    onEventPress(name: string): void {
      if (this.eventsFocusKey === name) {
        this.inspectEvent();
      } else {
        this.eventsFocusKey = name;
      }
    },
    /** X on a face-up card: the existing fullscreen viewer over the WHOLE
     *  visible tableau (LB/RB browses it; read-only — no bridges). */
    inspectCard(name: string): void {
      const list = [...this.faceUp];
      const index = list.findIndex((c) => c.name === name);
      if (index < 0) {
        return;
      }
      const origin = slotZoomOrigin(
        () => this.$el as HTMLElement,
        (i) => list[i]?.name ?? '',
        (i) => {
          const browsed = list[i]?.name;
          if (browsed !== undefined) {
            this.focusKey = browsed;
          }
        },
      );
      openConsoleCardZoom(list, index, undefined, undefined, {origin});
    },
    // ── the events pile / nested list ───────────────────────────────────
    openEvents(): void {
      if (this.zones.events.length === 0) {
        return;
      }
      this.focusKey = EVENTS_PILE_KEY;
      this.eventsFocusKey = this.zones.events[0]?.name ?? '';
      this.eventsOpen = true;
    },
    closeEvents(): void {
      this.eventsOpen = false;
      // Focus returns to the pile the list came from.
      if (this.zones.events.length > 0) {
        this.focusKey = EVENTS_PILE_KEY;
      }
    },
    inspectEvent(): void {
      const list = [...this.zones.events];
      const index = list.findIndex((c) => c.name === this.eventsFocusKey);
      if (index < 0) {
        return;
      }
      const origin = slotZoomOrigin(
        () => (this.$refs.events as InstanceType<typeof ConsolePlayedEventsOverlay> | undefined)?.$el as HTMLElement | undefined,
        (i) => list[i]?.name ?? '',
        (i) => {
          const browsed = list[i]?.name;
          if (browsed !== undefined) {
            this.eventsFocusKey = browsed;
          }
        },
      );
      openConsoleCardZoom(list, index, undefined, undefined, {origin});
    },
    // ── viewed player (LB/RB) ───────────────────────────────────────────
    cycleViewedPlayer(step: 1 | -1): void {
      if (this.players.length < 2) {
        return;
      }
      const idx = Math.max(0, this.players.findIndex((p) => p.color === this.viewColor));
      const next = this.players[(idx + step + this.players.length) % this.players.length];
      if (next !== undefined && next.color !== this.viewColor) {
        this.eventsOpen = false;
        this.viewColor = next.color;
        this.focusKey = ''; // the targets watcher reseeds on the new tableau
      }
    },
  },
});
</script>
