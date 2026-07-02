<template>
  <div class="con-board" ref="root">
    <div class="con-board__stage">
      <GameBoardView :game="game" :players="playerView.players" :tileView="tileView" @toggleTileView="cycleTileView" />
    </div>

    <!-- The cell dossier — ONE stable detail surface replacing hover popovers
         (CONSOLE_MODE_CONCEPT.md §7). Updates as the selection moves. -->
    <aside class="con-inspector" :aria-label="$t('Cell details')">
      <template v-if="selectedSpaceId !== undefined">
        <div class="con-inspector__kicker">{{ headerText }}</div>
        <div v-if="tileLabelText !== ''" class="con-inspector__name">{{ tileLabelText }}</div>
        <div v-if="descriptionText !== ''" class="con-inspector__desc">{{ descriptionText }}</div>
        <div v-if="placementActive" class="con-inspector__placement"
             :class="selectedAvailable ? 'con-inspector__placement--legal' : 'con-inspector__placement--illegal'">
          <template v-if="selectedAvailable">
            <GamepadGlyph control="confirm" />
            <span>{{ $t('Place here') }}</span>
          </template>
          <template v-else>
            <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
            <span>{{ $t('Cannot place here') }}</span>
          </template>
        </div>
        <div v-if="info !== undefined && info.facts.length > 0" class="con-inspector__facts">
          <BoardFactGroups :facts="info.facts" :viewerColor="playerView.thisPlayer.color" :players="playerView.players" />
        </div>
        <div v-else-if="loading" class="con-inspector__loading">{{ $t('Loading') }}…</div>
      </template>
      <div v-else class="con-inspector__empty">{{ $t('Move across the board to inspect cells') }}</div>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * Console Board section (CONSOLE_MODE_CONCEPT.md §7). Reuses the REAL board
 * (GameBoardView — auto-scaled, premium) and adds controller-native cell
 * selection: geometric hex traversal (spatialNav over cell rects), a
 * spotlight class on the selected cell, and the dossier panel fed by the
 * existing BoardInformation pipeline (boardInfoState → BoardCellInfo facts).
 *
 * Placement (SelectSpace active, hosted headless in the shell's WaitingFor):
 * navigation is CONSTRAINED to `.board-space--available` (free-roam over
 * everything while LT is held), A clicks the selected cell — the existing
 * per-cell onclick contract, byte-identical submission.
 *
 * The shell drives this component through refs (move/seed/activate) — the
 * router owns WHEN, this component owns HOW (it has the DOM).
 */
import {defineComponent, PropType} from 'vue';
import GameBoardView from '@/client/components/GameBoardView.vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {SpaceId} from '@/common/Types';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {NavRect, pickDirectional, pickNearest, rectCenter} from '@/client/gamepad/spatialNav';
import {boardInfoState, hoverBoardCell} from '@/client/components/board/boardInfoState';
import {consoleState} from '@/client/console/consoleRouter';
import {TileView, nextTileView} from '@/client/components/board/TileView';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText} from '@/client/directives/i18n';

const SELECT_CLASS = 'con-cell-sel';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleBoardSection',
  components: {GameBoardView, BoardFactGroups, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    placementActive: {type: Boolean, required: true},
  },
  data() {
    return {
      boardInfoState,
      consoleState,
      tileView: 'show' as TileView,
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    selectedSpaceId(): string | undefined {
      return this.consoleState.boardSpaceId;
    },
    info() {
      const info = this.boardInfoState.info;
      return info !== undefined && info.space === this.selectedSpaceId ? info : undefined;
    },
    loading(): boolean {
      return this.boardInfoState.loading && this.boardInfoState.spaceId === this.selectedSpaceId;
    },
    headerText(): string {
      return textOf(this.info?.status.header) || translateText('Board cell');
    },
    tileLabelText(): string {
      return textOf(this.info?.status.tileLabel);
    },
    descriptionText(): string {
      return textOf(this.info?.description);
    },
    selectedAvailable(): boolean {
      const el = this.cellEl(this.selectedSpaceId);
      return el !== undefined && el.classList.contains('board-space--available');
    },
  },
  watch: {
    // Entering placement re-seats the selection on a LEGAL cell near the
    // board center (predictable landing); leaving keeps the last cell.
    placementActive(now: boolean) {
      if (now) {
        void this.$nextTick(() => this.seed(true));
      }
    },
    selectedSpaceId: {
      immediate: true,
      handler(now: string | undefined, before: string | undefined) {
        this.applySpotlight(before, now);
        if (now !== undefined) {
          hoverBoardCell(now as SpaceId);
        }
      },
    },
  },
  methods: {
    cycleTileView(): void {
      this.tileView = nextTileView(this.tileView);
    },
    cellEl(spaceId: string | undefined): HTMLElement | undefined {
      if (spaceId === undefined) {
        return undefined;
      }
      const root = this.$refs.root as HTMLElement | undefined;
      return root?.querySelector<HTMLElement>(`[data_space_id="${spaceId}"]`) ?? undefined;
    },
    applySpotlight(before: string | undefined, now: string | undefined): void {
      this.cellEl(before)?.classList.remove(SELECT_CLASS);
      const el = this.cellEl(now);
      el?.classList.add(SELECT_CLASS);
    },
    /** Collect navigable cells: legal-only during placement unless free-roam. */
    candidates(): Array<{id: string, el: HTMLElement, rect: NavRect}> {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined) {
        return [];
      }
      const constrain = this.placementActive && !this.consoleState.freeRoam;
      const selector = constrain ? '.board-space--available[data_space_id]' : '.board-space[data_space_id]';
      const out: Array<{id: string, el: HTMLElement, rect: NavRect}> = [];
      for (const el of root.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          out.push({id: el.getAttribute('data_space_id') ?? '', el, rect: {left: r.left, top: r.top, width: r.width, height: r.height}});
        }
      }
      return out;
    },
    /** Seed the selection: available cell (or any cell) nearest the board center. */
    seed(preferAvailable: boolean): void {
      const cells = this.candidates();
      if (cells.length === 0) {
        return;
      }
      const root = this.$refs.root as HTMLElement;
      const stage = root.querySelector('.board-cont') ?? root;
      const r = stage.getBoundingClientRect();
      const center = {x: r.left + r.width / 2, y: r.top + r.height / 2};
      const pool = preferAvailable ?
        (cells.filter((c) => c.el.classList.contains('board-space--available')) as typeof cells) :
        cells;
      const usable = pool.length > 0 ? pool : cells;
      const idx = pickNearest(center, usable.map((c) => c.rect));
      this.select(usable[idx ?? 0].id);
    },
    select(spaceId: string): void {
      this.consoleState.boardSpaceId = spaceId;
    },
    /** Move the selection one hex in `dir` (geometric — hexes are the nearest centers). */
    move(dir: NavDirection): void {
      const cells = this.candidates();
      if (cells.length === 0) {
        return;
      }
      const current = cells.find((c) => c.id === this.selectedSpaceId);
      if (current === undefined) {
        // Selection left the candidate set (e.g. constraint kicked in) —
        // glide to the nearest candidate instead of jumping to a corner.
        const prevEl = this.cellEl(this.selectedSpaceId);
        if (prevEl !== undefined) {
          const r = prevEl.getBoundingClientRect();
          const idx = pickNearest(rectCenter({left: r.left, top: r.top, width: r.width, height: r.height}), cells.map((c) => c.rect));
          this.select(cells[idx ?? 0].id);
          return;
        }
        this.seed(this.placementActive);
        return;
      }
      const others = cells.filter((c) => c !== current);
      const idx = pickDirectional(current.rect, others.map((c) => c.rect), dir);
      if (idx !== undefined) {
        this.select(others[idx].id);
      }
    },
    /**
     * A on the selected cell during placement: the existing per-cell onclick
     * (SelectSpace) — the same submission contract as a mouse click.
     * Returns false when the cell isn't legal (the shell shows the refusal).
     */
    activate(): boolean {
      if (!this.placementActive) {
        return false;
      }
      const el = this.cellEl(this.selectedSpaceId);
      if (el === undefined || !el.classList.contains('board-space--available')) {
        return false;
      }
      el.click();
      return true;
    },
  },
  mounted() {
    if (this.selectedSpaceId === undefined) {
      this.seed(this.placementActive);
    } else {
      // Re-apply the spotlight to the freshly-rendered board DOM.
      this.applySpotlight(undefined, this.selectedSpaceId);
    }
  },
});
</script>
