<template>
  <!--
    PRE-GAME FULLSCREEN CARD VIEWER HOST — the App-level twin of the
    ConsoleShell zoom host, for the console screens that live OUTSIDE a game
    (main menu, create game, the campaign map). ONE module state drives both:
    a pre-game surface calls `openConsoleCardZoom(...)` exactly like an
    in-game one, and whichever host is mounted serves it — the shell in-game,
    this component everywhere else (never both: App mounts this only off the
    player screen). Presentation, choreography and input are the shell's,
    subsetted to what pre-game contexts attach: the select bridge, browsing,
    the rules side panel, the context caption. The receive/swap/inspect/
    availability bridges are in-game-only and are never attached here.

    The OPEN is PROXY-FIRST (consoleZoomMotion): the landing is measured on
    the still-closed dialog, the premium lift flies the proxy from the source
    slot (ZoomOrigin), and `showModal()` fires only at touchdown — the same
    compositor-safe shape as in-game. The source slot is HELD empty while its
    card is "in the player's hands" (one visual owner), and the close flies
    the card back into the slot of the card currently on screen.

    Input arrives via consoleMenuZoomBridge — installMenuPad consults it
    BEFORE any screen handler, so the viewer owns the pad completely while
    open (the same carve-out the shell runs first in handleIntent).
  -->
  <div v-if="!consoleState.shellMounted" class="con-menu-zoom-host">
    <transition name="con-zoom-veil">
      <div v-if="consoleCardZoom.card !== undefined"
           class="con-zoom-veil"
           :class="{'con-zoom-veil--lifted': zoomClosing}"
           aria-hidden="true"></div>
    </transition>
    <div v-if="zoomOpenProxy !== undefined" class="con-zoom-flight-layer" aria-hidden="true">
      <div ref="zoomFlightProxy" class="con-zoom-flight-proxy">
        <div class="con-zoom-flight-proxy__zoom" :style="{zoom: String(zoomOpenProxy.zoom)}">
          <CardZoomCard :card="zoomOpenProxy.card" :selected="zoomSelected" />
        </div>
      </div>
    </div>
    <CardZoomModal v-if="consoleCardZoom.card !== undefined"
                   ref="cardZoom"
                   class="con-zoom"
                   :class="{'con-zoom--flight': zoomFlight, 'con-zoom--closing': zoomClosing}"
                   :card="consoleCardZoom.card"
                   :cards="consoleCardZoom.cards.length > 1 ? consoleCardZoom.cards : undefined"
                   :index="consoleCardZoom.index"
                   :selected="zoomSelected"
                   :dismissable="!consoleCardZoom.mandatory"
                   :closing="zoomClosing"
                   :consoleMotion="true"
                   :annotationsSuppressed="zoomHasRules"
                   :lore="true"
                   @navigate="onCardZoomNavigate"
                   @close="onCardZoomClosed">
      <template v-if="zoomHasRules" #side="side">
        <div class="con-zoom-sidecol">
          <ConsoleCardRulesPanel v-if="zoomRulesCardName !== undefined"
                                 ref="zoomRulesPanel"
                                 :cardName="zoomRulesCardName"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
        </div>
      </template>
      <template #actions>
        <div v-if="consoleCardZoom.contextLabel !== undefined" class="con-zoom__context">
          <span class="con-zoom__context-mark" aria-hidden="true">◈</span>
          <span>{{ $t(consoleCardZoom.contextLabel) }}</span>
        </div>
        <div class="con-zoom__bar">
          <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
          <button v-if="zoomSelectable" type="button" class="con-zoom__btn con-zoom__btn--select" @click="zoomToggleSelect">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomSelected ? zoomDeselectLabel : zoomSelectLabel) }}</span>
          </button>
          <span v-if="consoleCardZoom.cards.length > 1" class="con-zoom__cmd con-zoom__cmd--flip">
            <GamepadGlyph control="bumperL" />
            <span class="con-zoom__flip-arrow" aria-hidden="true">◀</span>
            <span>{{ $t('Browse') }}</span>
            <span class="con-zoom__flip-arrow" aria-hidden="true">▶</span>
            <GamepadGlyph control="bumperR" />
          </span>
          <button v-if="!consoleCardZoom.mandatory" type="button" class="con-zoom__btn" @click="closeViewer">
            <GamepadGlyph control="back" />
            <span>{{ $t('Close') }}</span>
          </button>
        </div>
      </template>
    </CardZoomModal>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {ZoomCard} from '@/client/components/card/cardZoomTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleState} from '@/client/console/consoleRouter';
import {closeConsoleCardZoom, consoleCardZoom, navigateConsoleCardZoom, ZoomOrigin} from '@/client/console/consoleCardZoom';
import {beginZoomOpen, cancelZoomOpen, playZoomClose, playZoomOpenFlight, releaseZoomMotion, retargetZoomHold, zoomOpenSourceRect} from '@/client/console/consoleZoomMotion';
import {setMenuZoomIntentHandler} from '@/client/console/menu/consoleMenuZoomBridge';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {cardHasRules} from '@/client/components/console/consoleCardRules';
import {motionMs} from '@/client/components/motion/motionTokens';

export default defineComponent({
  name: 'ConsoleMenuZoomHost',
  components: {CardZoomModal, CardZoomCard, GamepadGlyph, ConsoleCardRulesPanel},
  data() {
    return {
      consoleState,
      consoleCardZoom,
      /** Chrome hidden while the open flight carries the card (mirrors the shell). */
      zoomFlight: false,
      zoomClosing: false,
      zoomOpening: false,
      zoomOpenProxy: undefined as {card: ZoomCard, zoom: number} | undefined,
      zoomOpenToken: 0,
      zoomOpenClearTimer: undefined as number | undefined,
      offZoomIntent: undefined as (() => void) | undefined,
    };
  },
  computed: {
    zoomSelectable(): boolean {
      return this.consoleCardZoom.select !== undefined && this.consoleCardZoom.card !== undefined;
    },
    zoomSelected(): boolean {
      const z = this.consoleCardZoom;
      return z.select !== undefined && z.card !== undefined && z.select.isSelected(z.card.name as CardName);
    },
    zoomSelectLabel(): string {
      return this.consoleCardZoom.select?.selectLabel ?? 'Select';
    },
    zoomDeselectLabel(): string {
      return this.consoleCardZoom.select?.deselectLabel ?? 'Deselect';
    },
    zoomHasRules(): boolean {
      const name = this.zoomRulesCardName;
      return name !== undefined && cardHasRules(name);
    },
    zoomRulesCardName(): CardName | undefined {
      const name = this.consoleCardZoom.card?.name;
      return name === undefined ? undefined : (name as CardName);
    },
  },
  watch: {
    // The open rides the undefined→defined transition only (navigation keeps
    // the dialog open) — a direct port of the shell's open watcher, including
    // the synchronous `zoomOpening` mark (a B pressed while the landing is
    // being measured must hit the cancel branch, never the normal close).
    'consoleCardZoom.card'(card: ZoomCard | undefined, prev: ZoomCard | undefined) {
      if (this.consoleState.shellMounted) {
        return; // the shell's host serves the module in-game
      }
      if (card === undefined && prev !== undefined) {
        // EXTERNAL clear (an opener closed the module directly, e.g. its own
        // unmount): unwind idempotently — the normal close path already ran
        // these in onCardZoomClosed, so a double run is harmless.
        releaseZoomMotion();
        this.zoomOpenToken++;
        this.zoomFlight = false;
        this.zoomClosing = false;
        this.zoomOpening = false;
        this.clearZoomOpenFlight();
        document.body.classList.remove('con-zoom-open');
        return;
      }
      if (card !== undefined && prev === undefined) {
        this.zoomFlight = true;
        this.zoomClosing = false;
        this.zoomOpening = true;
        document.body.classList.add('con-zoom-open');
        const tryOpen = (attempt: number) => {
          if (this.consoleCardZoom.card === undefined) {
            return; // closed before it ever opened
          }
          const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
          const el = zoom?.$el as HTMLElement | undefined;
          if (zoom === undefined || el === undefined || typeof el.querySelector !== 'function') {
            if (attempt < 10) {
              requestAnimationFrame(() => tryOpen(attempt + 1));
            } else {
              this.onCardZoomClosed(); // never strand an open-but-empty zoom state
            }
            return;
          }
          void this.runZoomOpen(zoom);
        };
        void this.$nextTick(() => tryOpen(0));
      }
    },
  },
  mounted() {
    this.offZoomIntent = setMenuZoomIntentHandler((intent) => this.onIntent(intent));
  },
  beforeUnmount() {
    this.offZoomIntent?.();
    // Screen switch mid-fullscreen (e.g. a mission launch navigates away):
    // never leave the module state / held slots / body class behind.
    if (this.consoleCardZoom.card !== undefined && !this.consoleState.shellMounted) {
      this.onCardZoomClosed();
    }
  },
  methods: {
    /** The pre-game zoom carve-out (consoleMenuZoomBridge): true ⇔ consumed. */
    onIntent(intent: GamepadIntent): boolean {
      if (this.consoleCardZoom.card === undefined || this.consoleState.shellMounted) {
        return false;
      }
      // A close flight is in progress: the card is mid-air — swallow all.
      if (this.zoomClosing) {
        return true;
      }
      // Mid open-flight: only closing is meaningful; B/X aborts cleanly.
      if (this.zoomOpening) {
        if (intent.kind === 'press' && !this.consoleCardZoom.mandatory) {
          const action = consoleActionOf(intent);
          if (action === 'back' || action === 'inspect') {
            void this.closeViewer();
          }
        }
        return true;
      }
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (intent.kind === 'nav') {
        if (intent.dir === 'left') {
          zoom?.prev();
        } else if (intent.dir === 'right') {
          zoom?.next();
        }
        return true;
      }
      if (intent.kind === 'scroll') {
        const rules = this.$refs.zoomRulesPanel as {scrollBody?: (dy: number) => boolean} | undefined;
        rules?.scrollBody?.(intent.dy);
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        zoom?.prev();
        return true;
      case 'nextSection':
        zoom?.next();
        return true;
      case 'primary':
        this.zoomToggleSelect();
        return true;
      case 'back':
      case 'inspect':
        if (!this.consoleCardZoom.mandatory) {
          void this.closeViewer();
        }
        return true;
      default:
        return true;
      }
    },
    onCardZoomNavigate(card: ZoomCard, pos: number): void {
      navigateConsoleCardZoom(card, pos);
      // The card "in hand" changed: the table hold moves to ITS slot, and the
      // opener keeps the underlying cursor in lockstep.
      retargetZoomHold(pos);
      this.consoleCardZoom.origin.onBrowse?.(pos);
    },
    zoomToggleSelect(): void {
      const z = this.consoleCardZoom;
      if (z.select !== undefined && z.card !== undefined) {
        z.select.toggle(z.card.name as CardName);
      }
    },
    /** The open sequence — a direct port of the shell's (consoleZoomMotion). */
    async runZoomOpen(zoom: InstanceType<typeof CardZoomModal>): Promise<void> {
      const token = ++this.zoomOpenToken;
      this.zoomOpening = true;
      const origin: ZoomOrigin = this.consoleCardZoom.origin;
      beginZoomOpen(origin);
      const landing = await zoom.measureLanding();
      if (token !== this.zoomOpenToken || this.consoleCardZoom.card === undefined) {
        return; // closed / reopened while measuring — that sequence owns state
      }
      const index = this.consoleCardZoom.index;
      if (landing === undefined || consoleReducedMotionActive()) {
        zoom.show();
        this.zoomOpening = false;
        window.setTimeout(() => {
          if (token === this.zoomOpenToken) {
            this.zoomFlight = false;
          }
        }, motionMs(140));
        return;
      }
      const source = zoomOpenSourceRect(index);
      this.zoomOpenProxy = {card: this.consoleCardZoom.card, zoom: landing.zoom};
      await this.$nextTick();
      if (token !== this.zoomOpenToken) {
        return;
      }
      const proxyEl = this.$refs.zoomFlightProxy as HTMLElement | undefined;
      playZoomOpenFlight(proxyEl, index, source, landing.rect, {
        onShow: () => {
          if (token === this.zoomOpenToken && this.consoleCardZoom.card !== undefined) {
            zoom.show();
          }
        },
        onDone: () => {
          if (token !== this.zoomOpenToken) {
            return;
          }
          this.zoomOpening = false;
          this.zoomFlight = false;
          this.zoomOpenClearTimer = window.setTimeout(() => this.clearZoomOpenFlight(), motionMs(160));
        },
      });
    },
    clearZoomOpenFlight(): void {
      if (this.zoomOpenClearTimer !== undefined) {
        window.clearTimeout(this.zoomOpenClearTimer);
        this.zoomOpenClearTimer = undefined;
      }
      this.zoomOpenProxy = undefined;
    },
    /** Choreographed close: chrome hides, the card flies back into the CURRENT
     *  card's slot (physical origin) or dives away, THEN the dialog closes. */
    async closeViewer(): Promise<void> {
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (zoom === undefined) {
        return;
      }
      const dialogEl = zoom.$el as HTMLDialogElement | undefined;
      // Closed during the OPEN flight (dialog never shown): abort the flight
      // and unwind directly — dialog.close() would no-op and the 'close'
      // event (the normal state unwinder) would never fire.
      if (this.zoomOpening && dialogEl?.open !== true) {
        cancelZoomOpen();
        this.onCardZoomClosed();
        return;
      }
      this.zoomFlight = true;
      this.zoomClosing = true;
      await playZoomClose(dialogEl as HTMLElement | undefined, this.consoleCardZoom.index);
      zoom.close();
    },
    onCardZoomClosed(): void {
      // Any close path (choreographed B, native Esc, backdrop tap): restore
      // every held slot + kill the flight, then clear the module state.
      releaseZoomMotion();
      this.zoomOpenToken++; // fence out any stale open-sequence callback
      this.zoomFlight = false;
      this.zoomClosing = false;
      this.zoomOpening = false;
      this.clearZoomOpenFlight();
      document.body.classList.remove('con-zoom-open');
      closeConsoleCardZoom();
    },
  },
});
</script>
