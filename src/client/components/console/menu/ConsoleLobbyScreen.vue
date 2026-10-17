<template>
  <section class="cm-screen cm-lobby" :class="'cm-lobby--' + kind" :data-lobby-screen="kind" :aria-label="$t(titleKey)">
    <!-- THE PLATE — the one surface the screen UNFOLDS from the pressed menu item (transform only, no text in it). -->
    <div class="cm-screen__plate" aria-hidden="true">
      <span class="cm-screen__corner cm-screen__corner--tl"></span>
      <span class="cm-screen__corner cm-screen__corner--tr"></span>
    </div>

    <!-- THE HEAD — the campaign map's grammar: the stable context, the title, the slice segment, the status. The
         slice is a TAB, not another screen: only the segment changes when L3 toggles it. -->
    <header class="cm-screen__head">
      <div class="cm-screen__crumb">
        <span class="cm-screen__kicker">{{ $t('Main menu') }}</span>
        <span class="cm-screen__sep" aria-hidden="true">›</span>
        <span class="cm-screen__title">{{ $t(titleKey) }}</span>
      </div>
      <div class="cm-gametabs cm-screen__tabs" role="tablist" :aria-label="$t(titleKey)">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="cm-gametab"
          :class="{'cm-gametab--on': t.id === tab}"
          role="tab"
          :aria-selected="t.id === tab"
          @click="$emit('tab', t.id)"
        >
          <span>{{ $t(t.label) }}</span>
          <span class="cm-gametab__count" :class="{'cm-gametab__count--pending': t.count === undefined}">{{ t.count ?? '·' }}</span>
        </button>
        <span class="cm-gametabs__hint" aria-hidden="true"><GamepadGlyph control="stickL" /></span>
      </div>
      <!-- The status names a refresh in flight (RT, a push, the poll) — the list re-asks itself, this says it did. -->
      <div class="cm-screen__status" :class="{'cm-screen__status--busy': refreshing}">
        <span class="cm-screen__status-dot" aria-hidden="true"></span>
        <span class="cm-screen__status-text">{{ $t('Refreshing') }}…</span>
      </div>
    </header>

    <div ref="stage" class="cm-screen__stage">
      <slot name="band" />
      <!-- FOUR HONEST STATES — on the stage, in the stage's voice: no name yet · still asking · asked and failed ·
           asked and there are none. Never one sentence for all of them, never a line in an empty plate. -->
      <div v-if="state !== 'list'" class="cm-lobby__state" :class="'cm-lobby__state--' + state" :data-lobby-state="state">
        <span class="cm-lobby__state-glyph" aria-hidden="true">
          <span v-if="state === 'loading'" class="cm-lobby__spinner"></span>
          <template v-else>{{ stateGlyph }}</template>
        </span>
        <span class="cm-lobby__state-title cm-gamelist__empty" :class="{'cm-gamelist__empty--error': state === 'error'}">{{ $t(stateKey) }}<template v-if="state === 'loading'">…</template></span>
        <span v-if="stateHintKey !== ''" class="cm-lobby__state-hint">
          <GamepadGlyph v-if="state === 'error'" control="triggerR" />{{ $t(stateHintKey) }}
        </span>
      </div>
      <ConsoleScrollArea v-else ref="scroll" class="cm-lobby__scroll" content-class="cm-lobby__grid" :style="gridStyle" :data-lobby-cols="cols">
        <slot />
      </ConsoleScrollArea>
    </div>
  </section>
</template>

<script lang="ts">
/**
 * THE PREGAME SCREEN CHASSIS (TR68 «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА», docs/claude/console/pregame-showcase.md) — the one
 * grammar of a product list before the game: head (the stable context «Главное меню», the title, the slice segment,
 * the status) → the stage in the whole opening → the command bar (the menu's own). «Мои партии» and «Мои кампании»
 * stand on it; a dialog stays only for a confirmation and a field editor.
 *
 * The stage is a GRID of cards solved from the MEASURED box (`showcaseGrid` — never from the card count): two rows
 * fill the stage, a third is a page below, kept in view by the scroll area's `ensureVisible`. The host owns the
 * cursor and the verbs; the screen exposes its column count (`cols`) for the ◀ ▶ ▲ ▼ walk.
 */
import {defineComponent, PropType} from 'vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {ShowcaseGrid, showcaseGrid} from '@/client/console/menu/lobbyCardModel';

export type LobbyScreenState = 'list' | 'need-name' | 'loading' | 'error' | 'empty';
export type LobbyScreenTab = {id: string, label: string, count: number | undefined};

/** The card's bounds in rem (the logical 1920 layout: FHD and the TV are one geometry, the Deck its own). */
const CARD_MIN_W_REM = 24;
const CARD_MAX_W_REM = 34;
const CARD_MIN_H_REM = 12;
const CARD_MAX_H_REM = 21;
const GAP_REM = 1.2;

const STATE_GLYPH: Readonly<Record<Exclude<LobbyScreenState, 'list' | 'loading'>, string>> = {
  'need-name': '◉',
  'error': '!',
  'empty': '⧉',
};

export default defineComponent({
  name: 'ConsoleLobbyScreen',
  components: {ConsoleScrollArea, GamepadGlyph},
  props: {
    kind: {type: String as PropType<'games' | 'campaigns'>, required: true},
    titleKey: {type: String, required: true},
    tabs: {type: Array as PropType<ReadonlyArray<LobbyScreenTab>>, required: true},
    tab: {type: String, required: true},
    state: {type: String as PropType<LobbyScreenState>, default: 'list'},
    /** The sentence of a non-list state (the lobby's own keys). */
    stateKey: {type: String, default: ''},
    stateHintKey: {type: String, default: ''},
    refreshing: {type: Boolean, default: false},
    /** The cards on the stage — a short list takes as many columns as it has cards (and stands centred). */
    items: {type: Number, default: 0},
  },
  emits: ['tab', 'grid'],
  data() {
    return {
      grid: {cols: 3, cardW: 0, rowH: 0} as ShowcaseGrid,
      observer: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    /** The columns the cards take — never more than there are cards (a short list stands centred, not left). */
    cols(): number {
      return Math.max(1, Math.min(this.grid.cols, this.items > 0 ? this.items : this.grid.cols));
    },
    gridStyle(): Record<string, string> {
      if (this.grid.cardW <= 0) {
        return {'--cm-lobby-cols': String(this.cols)};
      }
      return {
        '--cm-lobby-cols': String(this.cols),
        '--cm-lobby-card-w': `${this.grid.cardW}px`,
        '--cm-lobby-row-h': `${this.grid.rowH}px`,
      };
    },
    stateGlyph(): string {
      return this.state === 'list' || this.state === 'loading' ? '' : STATE_GLYPH[this.state];
    },
  },
  watch: {
    state() {
      void this.$nextTick(() => this.measure());
    },
    /** The walk's row length is the columns the cards TAKE. */
    cols: {
      handler(cols: number) {
        this.$emit('grid', cols);
      },
      immediate: true,
    },
  },
  mounted() {
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.measure());
      this.observer.observe(this.$refs.stage as HTMLElement);
    }
  },
  beforeUnmount() {
    this.observer?.disconnect();
  },
  methods: {
    /** The grid from the measured stage — the band above the cards (LAN) is subtracted. */
    measure(): void {
      const stage = this.$refs.stage as HTMLElement | undefined;
      if (stage === undefined) {
        return;
      }
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
      const scroll = stage.querySelector<HTMLElement>('.cm-lobby__scroll');
      const gridEl = stage.querySelector<HTMLElement>('.cm-lobby__grid');
      // The grid's OWN gap and padding (a profile restates them — the Deck's are tighter) come off the room.
      const gs = gridEl !== null ? getComputedStyle(gridEl) : undefined;
      const gap = gs !== undefined ? parseFloat(gs.columnGap) || GAP_REM * rem : GAP_REM * rem;
      const padX = gs !== undefined ? (parseFloat(gs.paddingLeft) || 0) + (parseFloat(gs.paddingRight) || 0) : 0;
      const padY = gs !== undefined ? (parseFloat(gs.paddingTop) || 0) + (parseFloat(gs.paddingBottom) || 0) : 0;
      const width = (scroll ?? stage).clientWidth - padX;
      const height = (scroll ?? stage).clientHeight - padY;
      if (width <= 0 || height <= 0) {
        return;
      }
      const next = showcaseGrid(width, height, {
        gap,
        minW: CARD_MIN_W_REM * rem,
        maxW: CARD_MAX_W_REM * rem,
        minH: CARD_MIN_H_REM * rem,
        maxH: CARD_MAX_H_REM * rem,
      });
      if (next.cols !== this.grid.cols || next.cardW !== this.grid.cardW || next.rowH !== this.grid.rowH) {
        this.grid = next;
      }
    },
    /** The cursor's card stays in view (the scroll area's own smooth follow). */
    ensureVisible(el: Element | null): void {
      const scroll = this.$refs.scroll as {ensureVisible?: (el: Element | null) => void} | undefined;
      scroll?.ensureVisible?.(el);
    },
  },
});
</script>
