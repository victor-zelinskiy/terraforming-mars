<template>
  <div class="con-reveal" role="dialog" :aria-label="titleText">
    <div class="con-reveal__backdrop" aria-hidden="true"></div>

    <transition name="con-task-swap" mode="out-in">
      <div class="con-reveal__card" :key="revealKey">
        <!-- ── Header ──────────────────────────────────────────────── -->
        <header class="con-reveal__head">
          <div class="con-task__kicker">
            <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t(kickerText) }}</span>
          </div>
          <div class="con-reveal__headrow">
            <div class="con-reveal__headmain">
              <div class="con-reveal__title">{{ titleText }}</div>
              <div v-if="mode === 'drawn'" class="con-reveal__subtitle">
                {{ $t('Cards were added from a draw source. Pick a card to inspect or take the available ones.') }}
              </div>
            </div>
            <!-- Compact premium count chip (NEVER a full-width strip). -->
            <div v-if="mode === 'drawn' && drawnEvent !== undefined" class="con-reveal__count">
              <span class="con-reveal__count-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
              <span class="con-reveal__count-label">{{ $t('Received') }}</span>
              <b class="con-reveal__count-num">{{ drawnEvent.cards.length }}</b>
            </div>
            <div v-else-if="mode === 'viewer' && viewerReveal !== undefined" class="con-reveal__meta">
              <span v-if="viewerActor !== undefined" class="con-task__opt-player">
                <span :class="'con-status__dot player_bg_color_' + viewerActor.color"></span>
                <span>{{ viewerActor.name }}</span>
              </span>
              <span class="con-reveal__chip">{{ viewerReveal.cards.length }} {{ $t('cards') }}</span>
              <span class="con-reveal__chip">{{ $t(viewerOriginLabel) }}</span>
              <span class="con-reveal__chip">{{ $t(viewerResultLabel) }}</span>
            </div>
          </div>
        </header>

        <!-- ── DRAWN: take the received cards ──────────────────────── -->
        <div v-if="mode === 'drawn' && drawnEvent !== undefined" class="con-reveal__body con-reveal__body--drawn con-info__scroll">
          <!-- INFO PARITY: the SOURCE renders as the REAL premium element,
               inspectable on L3 when it is a card. -->
          <aside v-if="drawnSource !== undefined" class="con-reveal__source">
            <div class="con-start__section-title">{{ $t('Source') }}</div>
            <Card v-if="drawnSource.type === 'card'" :card="{name: drawnSource.cardName}" :key="drawnSource.cardName" lightweight />
            <div v-else-if="drawnSource.type === 'colony' && drawnSourceColony !== undefined" class="con-reveal__source-colony">
              <ColonyTile :colony="drawnSourceColony" mode="view" :selectable="false" />
            </div>
            <div v-else-if="drawnSource.type === 'tile'" class="con-reveal__source-text">{{ $t('Tile bonus') }}</div>
            <div v-if="drawnSourceInspectable" class="con-reveal__source-hint">
              <GamepadGlyph control="stickL" /><span>{{ $t('Source') }}</span>
            </div>
          </aside>
          <div class="con-reveal__main">
            <div class="con-cards__strip con-reveal__strip"
                 :class="{'con-cards__strip--has-focus': drawnUntaken.length > 1}"
                 :style="stripZoomStyle">
              <div v-for="(entry, i) in drawnUntaken" :key="entry.card.name + '#' + entry.index"
                   class="con-cards__slot con-start__deal"
                   :style="dealDelay(i)"
                   :class="{'con-cards__slot--focused': focusIdx === i}"
                   :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                <Card :card="entry.card" :key="entry.card.name" lightweight />
                <div v-if="focusIdx === i" class="con-start__slot-a">
                  <GamepadGlyph control="confirm" /><span>{{ $t('Take card') }}</span>
                </div>
              </div>
            </div>
            <div v-if="drawnUntaken.length > 4" class="con-reveal__pager" aria-hidden="true">
              <span class="con-reveal__pager-b">[</span>
              <span class="con-reveal__pager-i">{{ focusIdx + 1 }}</span>
              <span class="con-reveal__pager-s">/</span>
              <span class="con-reveal__pager-n">{{ drawnUntaken.length }}</span>
              <span class="con-reveal__pager-b">]</span>
            </div>
          </div>
        </div>

        <!-- ── RESULT: the deck-check outcome (SearchForLife etc.) ─── -->
        <div v-else-if="mode === 'result' && lastReveal !== undefined" class="con-reveal__body con-info__scroll">
          <div class="con-reveal__source">
            <div class="con-start__section-title">{{ $t('Source') }}</div>
            <Card :card="{name: lastReveal.action}" :key="lastReveal.action" lightweight />
          </div>
          <div class="con-reveal__main">
            <div class="con-reveal__revealed"
                 :class="lastReveal.conditionMet ? 'con-reveal__revealed--met' : 'con-reveal__revealed--miss'">
              <Card :card="lastReveal.revealed" :key="lastReveal.revealed.name" />
            </div>
            <div class="con-reveal__outcome" :class="lastReveal.conditionMet ? 'con-reveal__outcome--met' : 'con-reveal__outcome--miss'">
              <span class="con-reveal__outcome-badge" aria-hidden="true">{{ lastReveal.conditionMet ? '✓' : '✕' }}</span>
              <span>{{ $t(lastReveal.conditionMet ? 'Condition met' : 'Condition not met') }}</span>
              <ActionEffectChip v-if="lastReveal.reward !== undefined" :effect="lastReveal.reward" />
              <span v-if="vpGain > 0" class="con-reveal__vp">+{{ vpGain }} {{ $t('VP') }}</span>
            </div>
          </div>
        </div>

        <!-- ── VIEWER: another player's public reveal (read-only) ──── -->
        <div v-else-if="mode === 'viewer' && viewerReveal !== undefined" class="con-reveal__body con-info__scroll">
          <div class="con-reveal__main">
            <div class="con-cards__strip">
              <div v-for="(name, i) in viewerReveal.cards" :key="name + '#' + i"
                   class="con-cards__slot con-start__deal"
                   :style="dealDelay(i)"
                   :class="{'con-cards__slot--focused': focusIdx === i}"
                   :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                <Card :card="{name}" :key="name" lightweight />
              </div>
            </div>
          </div>
        </div>

        <!-- ── Footer: the command contract ────────────────────────── -->
        <footer class="con-task__foot" aria-hidden="true">
          <span v-for="(hint, i) in footHints" :key="i" class="con-task__foot-item">
            <GamepadGlyph :control="hint.control" />
            <span>{{ $t(hint.label) }}</span>
          </span>
        </footer>
      </div>
    </transition>

    <!-- The gliding selection frame — THE primary focus indicator of card
         navigation (shared vocabulary with hand / draft / start scene).
         Self-resolving inside this overlay, so it can never target the
         task host's focused card underneath. -->
    <ConsoleCardFocusFrame selector=".con-cards__slot--focused > .card-container" />
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE REVEAL OVERLAY — CTS T6 row 25 (CONSOLE_MODE_CONCEPT.md). The
 * console-native surface for the three REVEAL flows, replacing the desktop
 * modals (gated off in console) with one calm card-reveal frame:
 *
 *  drawn  — «you received N cards»: the REAL source render (card /
 *           ColonyTile / tile-bonus label — info parity with the desktop's
 *           source chips), the untaken cards as a focusable strip;
 *           A = take the focused card, X/B = take all. Take/ack semantics
 *           are the SHARED drawnCardsState functions (byte-identical to
 *           the desktop flow — dismiss first, release + ack after the
 *           backdrop paints out).
 *  result — the deck-check outcome (SearchForLife / AsteroidDeflection-
 *           System): source card + the revealed card in a green/red frame
 *           + the ✓/✗ verdict + the reward chip + VP delta. Driven by the
 *           SERVER's `playerView.lastReveal` directly (the console submits
 *           actions without the desktop confirm modal, so the desktop's
 *           client-side reveal trigger never fires here); OK marks it seen
 *           (the shell keeps the dismissed key until the server clears).
 *  viewer — another player's PUBLIC reveal (opened via a notification
 *           CTA): read-only browse + close.
 *
 * Priority drawn > result > viewer (the shell mounts per `revealMode`).
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import ConsoleCardFocusFrame from '@/client/components/console/cardDeal/ConsoleCardFocusFrame.vue';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ColonyTile from '@/client/components/colonies/ColonyTile.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {
  DrawnCardEntry, closeAndReleaseEvent, currentRevealEvent, markAllTaken, markCardTaken,
} from '@/client/components/drawnCards/drawnCardsState';
import {RevealMeta} from '@/client/components/notifications/notificationTypes';
import {closeRevealViewer, revealViewerState} from '@/client/components/notifications/revealViewerState';
import {closeConsoleCardZoom, consoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type ConsoleRevealMode = 'drawn' | 'result' | 'viewer';

export default defineComponent({
  name: 'ConsoleRevealOverlay',
  components: {Card, ColonyTile, GamepadGlyph, ActionEffectChip, ConsoleCardFocusFrame},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    mode: {type: String as PropType<ConsoleRevealMode>, required: true},
  },
  emits: ['dismiss-result'],
  data() {
    return {
      focusIdx: 0,
    };
  },
  computed: {
    // ── drawn ────────────────────────────────────────────────────────
    drawnEvent(): DrawnCardEntry | undefined {
      return this.mode === 'drawn' ? currentRevealEvent() : undefined;
    },
    drawnSource(): CardDrawRevealSource | undefined {
      const source = this.drawnEvent?.source;
      return source !== undefined && source.type !== 'other' ? source : undefined;
    },
    drawnSourceColony(): ColonyModel | undefined {
      const source = this.drawnSource;
      if (source === undefined || source.type !== 'colony') {
        return undefined;
      }
      try {
        return simpleColonyModel(source.colonyName as ColonyName);
      } catch (err) {
        return undefined;
      }
    },
    /** Untaken cards paired with their FULL-array index (the take mapping). */
    drawnUntaken(): Array<{card: CardModel, index: number}> {
      const e = this.drawnEvent;
      if (e === undefined) {
        return [];
      }
      const out: Array<{card: CardModel, index: number}> = [];
      e.cards.forEach((card, index) => {
        if (!e.takenIndices.has(index)) {
          out.push({card, index});
        }
      });
      return out;
    },
    /** A card source opens fullscreen on L3 (colony/tile/other are not). */
    drawnSourceInspectable(): boolean {
      return this.drawnSource?.type === 'card';
    },
    /**
     * Count-driven card scale so 1–4 cards stay roomy with a generous safe gap
     * (no overlap); larger batches compact and scroll as a focus carousel. The
     * strip's `.con-cards__slot` reads `--con-cards-zoom` (set on the strip).
     */
    stripZoom(): number {
      const n = this.drawnUntaken.length;
      if (n <= 2) {
        return 0.94;
      }
      if (n <= 3) {
        return 0.82;
      }
      if (n <= 4) {
        return 0.72;
      }
      if (n <= 6) {
        return 0.6;
      }
      return 0.52;
    },
    stripZoomStyle(): Record<string, string> {
      return {'--con-cards-zoom': String(this.stripZoom)};
    },
    // ── result ───────────────────────────────────────────────────────
    lastReveal(): RevealResultModel | undefined {
      return this.mode === 'result' ? this.playerView.lastReveal : undefined;
    },
    vpGain(): number {
      const vp = this.lastReveal?.vp;
      return vp !== undefined ? Math.max(0, vp.to - vp.from) : 0;
    },
    // ── viewer ───────────────────────────────────────────────────────
    viewerReveal(): RevealMeta | undefined {
      return this.mode === 'viewer' ? revealViewerState.reveal : undefined;
    },
    viewerActor(): {color: string, name: string} | undefined {
      const color = this.viewerReveal?.actor;
      if (color === undefined) {
        return undefined;
      }
      const p = this.playerView.players.find((pp) => pp.color === color);
      return {color, name: p !== undefined ? participantDisplayName(p) : color};
    },
    viewerOriginLabel(): string {
      return this.viewerReveal?.origin === 'hand' ? 'from hand' : 'from deck';
    },
    viewerResultLabel(): string {
      switch (this.viewerReveal?.result) {
      case 'discarded': return 'discarded';
      case 'shown': return 'shown';
      case 'kept': return 'kept';
      default: return 'revealed';
      }
    },
    // ── frame ────────────────────────────────────────────────────────
    kickerText(): string {
      switch (this.mode) {
      case 'drawn': return 'Cards received';
      case 'result': return 'Reveal result';
      default: return this.viewerReveal?.origin === 'hand' ? 'Shown cards' : 'Revealed cards';
      }
    },
    titleText(): string {
      switch (this.mode) {
      case 'drawn':
        return translateText('Cards received');
      case 'result':
        return this.lastReveal !== undefined ? translateText(this.lastReveal.action) : '';
      default:
        return translateText(this.viewerReveal?.origin === 'hand' ? 'Shown cards' : 'Revealed cards');
      }
    },
    revealKey(): string {
      switch (this.mode) {
      case 'drawn': return `drawn|${this.drawnEvent?.id ?? ''}`;
      case 'result': return `result|${this.lastReveal?.action ?? ''}|${this.lastReveal?.revealed.name ?? ''}`;
      default: return `viewer|${(this.viewerReveal?.cards ?? []).join(',')}`;
      }
    },
    focusCount(): number {
      switch (this.mode) {
      case 'drawn': return this.drawnUntaken.length;
      case 'viewer': return this.viewerReveal?.cards.length ?? 0;
      default: return 0;
      }
    },
    footHints(): Array<{control: GlyphControl, label: string}> {
      switch (this.mode) {
      case 'drawn': {
        const many = this.drawnUntaken.length > 1;
        const hints: Array<{control: GlyphControl, label: string}> = [];
        if (many) {
          hints.push({control: 'dpadH', label: 'Navigate'});
        }
        hints.push({control: 'confirm', label: 'Take card'});
        hints.push({control: 'secondary', label: 'Inspect'});
        if (many) {
          hints.push({control: 'triggerR', label: 'Take all cards'});
        }
        if (this.drawnSourceInspectable) {
          hints.push({control: 'stickL', label: 'Source'});
        }
        hints.push({control: 'back', label: 'Close'});
        return hints;
      }
      case 'result':
        return [
          {control: 'confirm', label: 'OK'},
          {control: 'secondary', label: 'Inspect'},
        ];
      default:
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'Close'},
        ];
      }
    },
  },
  watch: {
    revealKey() {
      this.focusIdx = 0;
    },
    focusCount(now: number) {
      if (this.focusIdx >= now) {
        this.focusIdx = Math.max(0, now - 1);
      }
    },
  },
  methods: {
    dealDelay(i: number): Record<string, string> {
      if (prefersReducedMotion()) {
        return {};
      }
      return {animationDelay: `calc(${Math.min(i, 12) * 55}ms * var(--motion-scale, 1))`};
    },
    /** The shell routes every intent here while the overlay is active. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // L3 = inspect the DRAW SOURCE (screen-specific stick, drawn mode only).
      if (intent.button === 'stickL' && this.mode === 'drawn') {
        this.zoomSource();
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    onNav(dir: NavDirection): void {
      if (dir !== 'left' && dir !== 'right') {
        return;
      }
      const count = this.focusCount;
      if (count === 0) {
        return;
      }
      const next = Math.min(count - 1, Math.max(0, this.focusIdx + (dir === 'right' ? 1 : -1)));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        void this.$nextTick(() => {
          const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
          const el = Array.isArray(slot) ? slot[0] : slot;
          el?.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
        });
      }
    },
    // Foundation: SEMANTIC actions — A(primary) take/dismiss, X(inspect) zoom,
    // RT(nextTab)/B(back) take-all/dismiss. L3 source-zoom handled in handleIntent.
    onPress(action: ConsoleAction): void {
      switch (this.mode) {
      case 'drawn':
        if (action === 'primary') {
          this.takeFocused();
        } else if (action === 'inspect') {
          // P13 global rule: X reads the focused card fullscreen.
          this.zoomFocused();
        } else if (action === 'nextTab' || action === 'back') {
          this.takeAll();
        }
        return;
      case 'result':
        if (action === 'inspect') {
          this.zoomRevealed();
        } else if (action === 'primary' || action === 'nextTab' || action === 'back') {
          this.$emit('dismiss-result');
        }
        return;
      default:
        if (action === 'inspect') {
          this.zoomViewerCard();
        } else if (action === 'primary' || action === 'nextTab' || action === 'back') {
          closeRevealViewer();
        }
        return;
      }
    },
    /** P13: X fullscreen for the focused card — with the RECEIVE bridge so A
     *  takes the card / RT takes all WITHOUT leaving the viewer (until the
     *  last card, which closes it). The take logic is SHARED with the modal. */
    zoomFocused(): void {
      const list = this.drawnUntaken.map((e) => e.card);
      if (list.length === 0) {
        return;
      }
      openConsoleCardZoom(list, this.focusIdx, undefined, undefined, {
        receive: {
          takeLabel: 'Take card',
          takeAt: (idx) => this.takeFromZoom(idx),
          takeAllLabel: list.length > 1 ? 'Take all cards' : undefined,
          takeAll: list.length > 1 ? () => this.takeAllFromZoom() : undefined,
        },
      });
    },
    /** L3: inspect the DRAW SOURCE card fullscreen, captioned as the source. */
    zoomSource(): void {
      const s = this.drawnSource;
      if (s === undefined || s.type !== 'card') {
        return;
      }
      openConsoleCardZoom([{name: s.cardName} as CardModel], 0, undefined, undefined, {
        contextLabel: 'Source of drawn cards',
      });
    },
    zoomRevealed(): void {
      if (this.lastReveal !== undefined) {
        openConsoleCardZoom([this.lastReveal.revealed], 0);
      }
    },
    zoomViewerCard(): void {
      const names = this.viewerReveal?.cards ?? [];
      if (names.length > 0) {
        openConsoleCardZoom(names.map((name) => ({name}) as CardModel), this.focusIdx);
      }
    },
    /** A: take the focused card (last one closes + releases + acks). */
    takeFocused(): void {
      const e = this.drawnEvent;
      const entry = this.drawnUntaken[this.focusIdx];
      if (e === undefined || entry === undefined) {
        return;
      }
      if (this.drawnUntaken.length <= 1) {
        closeAndReleaseEvent(this.playerView.id, e.id, () => markCardTaken(e.id, entry.index));
        return;
      }
      markCardTaken(e.id, entry.index);
    },
    /** RT / B: take everything (the reveal's accept-and-close exit). */
    takeAll(): void {
      const e = this.drawnEvent;
      if (e === undefined) {
        return;
      }
      closeAndReleaseEvent(this.playerView.id, e.id, () => markAllTaken(e.id));
    },
    /** A inside the fullscreen viewer — take the card at the viewer's index.
     *  The last card closes the viewer + releases the batch; otherwise the
     *  live untaken list is pushed to the viewer so its «consume» swap
     *  advances to the next card. `takeFocused`'s twin (same shared logic). */
    takeFromZoom(idx: number): void {
      const e = this.drawnEvent;
      const entry = this.drawnUntaken[idx];
      if (e === undefined || entry === undefined) {
        return;
      }
      if (this.drawnUntaken.length <= 1) {
        closeConsoleCardZoom();
        closeAndReleaseEvent(this.playerView.id, e.id, () => markCardTaken(e.id, entry.index));
        return;
      }
      markCardTaken(e.id, entry.index);
      const remaining = this.drawnUntaken.map((x) => x.card);
      consoleCardZoom.cards = remaining;
      if (remaining.length === 1) {
        // The viewer leaves nav mode (its `cards` prop → undefined, so the
        // modal's list watcher no-ops); drive the single card directly so the
        // `:card` binding shows the SURVIVOR, not the just-taken card.
        consoleCardZoom.card = remaining[0];
        consoleCardZoom.index = 0;
      }
      // remaining.length > 1: the modal's `cards` watcher clamps + «consume»-
      // swaps + re-emits navigate, which re-syncs card/index — nothing to do.
    },
    /** RT inside the fullscreen viewer — close it, then take all. */
    takeAllFromZoom(): void {
      closeConsoleCardZoom();
      this.takeAll();
    },
  },
});
</script>
