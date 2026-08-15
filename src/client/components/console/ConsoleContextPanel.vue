<template>
  <aside class="con-inspector con-context con-info__scroll"
         ref="root"
         :class="{'con-inspector--more': moreBelow, 'con-inspector--scrolled': scrolledDown}"
         :aria-label="$t('Cell details')"
         @scroll.passive="measureScroll">
    <!-- ── TASK MODE: active placement ─────────────────────────────── -->
    <template v-if="mode === 'placement'">
      <!-- The kicker names WHAT LANDS, and the host supplies it — a cell pick
           is not always a tile pick (a claim / a camp move puts a MARKER
           down). Hardcoding «Размещение тайла» here announced a tile over a
           prompt reading «выберите место для выкладывания своего маркера». -->
      <div class="con-context__task-kicker">{{ $t(placementKickerKey) }}</div>
      <div class="con-context__task-title">{{ placementTitle }}</div>
      <!-- WHO is placing. The server has named the card on every card-driven
           placement all along (`placementContext.source`) and nothing showed
           it — so a tile that arrives from a triggered effect had no
           attribution on screen at all. A CHIP, not the dock: this panel is
           ~17rem wide and its consequences preview is variable-height, so the
           source may cost one line and no more. X opens the real card. -->
      <console-source-dock v-if="sourceView !== undefined" :view="sourceView" chip ref="sourceChip" />
      <div v-if="sourceCard !== undefined" class="con-context__source-hint">
        <GamepadGlyph control="stickL" /><span>{{ $t('Inspect the source') }}</span>
      </div>
      <!-- P20: the inspect-all toggle announces itself as a distinct mode. -->
      <div v-if="inspectAll" class="con-context__mode-chip">{{ $t('Inspecting all cells') }}</div>

      <div v-if="selectedLegal" class="con-inspector__placement con-inspector__placement--legal">
        <GamepadGlyph control="confirm" />
        <span>{{ $t('Place here') }}</span>
      </div>
      <template v-else>
        <div class="con-inspector__placement con-inspector__placement--illegal">
          <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
          <span>{{ $t('Cannot place here') }}</span>
        </div>
        <div v-if="illegalReason !== ''" class="con-context__reason">{{ illegalReason }}</div>
      </template>

      <div class="con-context__cell-brief" v-if="cellHeader !== ''">
        <span class="con-context__cell-brief-label">{{ $t('Board cell') }}:</span> {{ cellHeader }}
        <span v-if="!selectedLegal" class="con-context__cell-brief-note">— {{ $t('this tile cannot go here') }}</span>
      </div>
      <!-- The CONSEQUENCES of placing here — cost (incl. the Ares
           hazard-adjacency production penalty) / gains / who else receives /
           endgame VP. The SAME component the desktop hover popover + confirm
           dialog render, so the three can never diverge. The hover facts are
           the fallback: an illegal cell (no preview) still explains itself. -->
      <div v-if="preview !== undefined" class="con-inspector__facts">
        <BoardPlacementPreviewContent :preview="preview" :viewerColor="viewerColor" :players="players" />
      </div>
      <div v-else-if="info !== undefined && info.facts.length > 0" class="con-inspector__facts">
        <BoardFactGroups :facts="info.facts" :viewerColor="viewerColor" :players="players" />
      </div>

      <!-- P21: the panel carries NO command rows of its own. The confirm CTA
           sits at the TOP, and the cancel is registered in the command bar
           (ConsoleShell's placementActive branch) — repeating it here only ate
           height in a panel that now carries several fact blocks, and a second
           copy of a bar verb reads as a second, differently-scoped control.
           The "cancelling is not available" note is gone for the same reason:
           it stated a non-event on EVERY placement. -->
    </template>

    <!-- ── TRACK MODE (P27b): a focused global-parameter track bonus ── -->
    <template v-else-if="mode === 'track'">
      <div class="con-context__task-kicker">{{ $t('Track bonus') }}</div>
      <template v-if="trackInfo !== null">
        <div class="con-inspector__name">{{ trackInfo.kicker }}</div>
        <div class="con-context__track-rows">
          <div v-for="(row, i) in trackInfo.rows" :key="i"
               class="con-context__track-row"
               :class="'con-context__track-row--' + row.tone">
            <span v-if="row.dot !== undefined" class="con-status__dot" :style="{background: row.dot}"></span>
            <span>{{ row.text }}</span>
          </div>
        </div>
      </template>
      <div v-else class="con-inspector__loading">{{ $t('Loading') }}…</div>
      <!-- P27c: the owning SCALE's own hover-overview (name + current
           value + description) — the mouse would show it on the band. -->
      <div v-if="trackScale !== null" class="con-context__scale">
        <div class="con-context__scale-title">{{ $t(trackScale.titleKey) }}</div>
        <div class="con-context__track-row con-context__track-row--value">
          <span>{{ $t(trackScale.nounKey) }}: {{ trackScale.valueText }}</span>
        </div>
        <div class="con-context__track-row con-context__track-row--desc">
          <span>{{ $t(trackScale.descriptionKey) }}</span>
        </div>
      </div>
      <div class="con-context__note">{{ $t('Scale bonuses are granted when the parameter passes this step') }}</div>
    </template>

    <!-- ── CELL MODE: inspection — a selected cell, no task ─────────── -->
    <template v-else-if="mode === 'cell'">
      <div class="con-inspector__kicker">{{ cellHeader !== '' ? cellHeader : $t('Board cell') }}</div>
      <div v-if="tileLabel !== ''" class="con-inspector__name">{{ tileLabel }}</div>
      <div v-if="ownerName !== ''" class="con-context__owner">
        <span :class="'con-status__dot player_bg_color_' + ownerColor"></span>
        <span>{{ ownerName }}</span>
      </div>
      <div v-if="cellDescription !== ''" class="con-inspector__desc">{{ cellDescription }}</div>
      <!-- P27b: the curated special-cell LORE (Ganymede, volcanoes…) —
           inspection is the right home for it (placement stays lean). -->
      <div v-if="lore !== undefined" class="con-context__lore">
        <div v-if="loreTitle !== ''" class="con-context__lore-title">{{ $t(lore.title) }}</div>
        <div class="con-context__lore-text">{{ $t(lore.description) }}</div>
      </div>
      <div v-if="info !== undefined && info.facts.length > 0" class="con-inspector__facts">
        <BoardFactGroups :facts="info.facts" :viewerColor="viewerColor" :players="players" />
      </div>
      <div v-else-if="loading" class="con-inspector__loading">{{ $t('Loading') }}…</div>
    </template>

    <!-- (The former IDLE mode is gone: the strategic Milestones/Awards
         summary is the dedicated right STRATEGY RAIL now — this panel is a
         TASK/INSPECTION dossier only, overlaid while one is active.) -->

    <!-- The panel scrolls with the right stick, but a couch player cannot see a
         3 px scrollbar from three metres — so the OVERFLOW announces itself: a
         fade at each cut edge (on the panel, see console.less) plus this one
         line NAMING the control. Last in the flow + sticky, so it rides the
         bottom edge, and it disappears the moment nothing is left to read. -->
    <div v-if="moreBelow" class="con-inspector__more" aria-hidden="true">
      <GamepadGlyph control="stickR" /><span>{{ $t('Scroll') }}</span>
    </div>
  </aside>
</template>

<script lang="ts">
/**
 * The right CONTEXT dossier (feedback iteration 2; P27 rework; P30: the
 * strategic idle summary moved OUT into the dedicated STRATEGY RAIL, and
 * this panel became a task-time OVERLAY — the board never reflows for it).
 * Three modes:
 *  - placement: the TASK state (legal/illegal + the SERVER's illegal
 *    reason + cell facts + the minimal command set incl. honest B);
 *  - track (P27): a focused global-parameter TRACK bonus — the SAME
 *    already-translated rows the premium ScaleTooltip shows;
 *  - cell: inspection identity (header/name/owner) + facts from the
 *    shared BoardInformation pipeline.
 * Deliberately NOT a duplicate of the bottom command bar.
 * Pure presentation: every value is a prop computed in ConsoleShell from
 * the same sources the desktop buttons use.
 */
import {defineComponent, PropType} from 'vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import BoardPlacementPreviewContent from '@/client/components/board/BoardPlacementPreviewContent.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {BoardCellInfo, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {ScaleTooltipContent} from '@/client/components/board/scaleTooltipState';
import {CardName} from '@/common/cards/CardName';
import {PromptSourceView} from '@/client/console/promptSource';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleContextPanel',
  components: {BoardFactGroups, BoardPlacementPreviewContent, GamepadGlyph},
  data() {
    return {
      /** Content continues below the fold — drives the fade + the stick hint. */
      moreBelow: false,
      /** Something is already scrolled past — drives the TOP fade. */
      scrolledDown: false,
      resizeObserver: undefined as ResizeObserver | undefined,
    };
  },
  watch: {
    /** P21: a new inspected cell resets the panel scroll — the placement
     *  STATUS is always the first thing visible. */
    cellHeader() {
      this.resetScroll();
    },
    selectedLegal() {
      this.resetScroll();
    },
    /** New facts arrive asynchronously (the preview is fetched per cell), so
     *  the overflow state has to be re-measured when they land. */
    preview() {
      this.$nextTick(() => this.measureScroll());
    },
  },
  mounted() {
    this.measureScroll();
    const root = this.$refs.root as HTMLElement | undefined;
    if (root !== undefined && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measureScroll());
      this.resizeObserver.observe(root);
    }
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  },
  props: {
    mode: {type: String as PropType<'placement' | 'cell' | 'track'>, required: true},
    info: {type: Object as PropType<BoardCellInfo | undefined>, default: undefined},
    /** placement mode: the focused LEGAL cell's placement consequences. */
    preview: {type: Object as PropType<BoardPlacementPreview | undefined>, default: undefined},
    loading: {type: Boolean, default: false},
    viewerColor: {type: String as PropType<Color>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    // placement mode
    /** i18n KEY for the kicker — from `consoleTaskSummary.placementKicker`,
     *  never composed here (that module is the ONE source of prompt copy). */
    placementKickerKey: {type: String, default: 'Tile placement'},
    placementTitle: {type: String, default: ''},
    selectedLegal: {type: Boolean, default: false},
    illegalReason: {type: String, default: ''},
    /** P20: the R3 inspect-all toggle is on (labels + the mode chip). */
    inspectAll: {type: Boolean, default: false},
    /** WHO asked for this placement — normalized by the shared model. */
    sourceView: {type: Object as PropType<PromptSourceView | undefined>, default: undefined},
    // track mode (P27)
    trackInfo: {type: Object as PropType<ScaleTooltipContent | null>, default: null},
    /** P27c: the owning scale's overview (name / current value / description). */
    trackScale: {type: Object as PropType<{titleKey: string, nounKey: string, valueText: string, descriptionKey: string} | null>, default: null},
    // cell mode (P27b): curated special-cell lore
    lore: {type: Object as PropType<{title: string, description: string} | undefined>, default: undefined},
  },
  computed: {
    /** The source CARD, when there is one — what X opens fullscreen. */
    sourceCard(): CardName | undefined {
      return this.sourceView?.inspectable === true ? this.sourceView.card : undefined;
    },
    cellHeader(): string {
      return textOf(this.info?.status.header);
    },
    tileLabel(): string {
      return textOf(this.info?.status.tileLabel);
    },
    cellDescription(): string {
      return textOf(this.info?.description);
    },
    ownerColor(): Color | undefined {
      return this.info?.status.ownerColor;
    },
    ownerName(): string {
      const color = this.ownerColor;
      if (color === undefined) {
        return '';
      }
      const player = this.players.find((p) => p.color === color);
      return player !== undefined ? participantDisplayName(player) : '';
    },
    /** P27b: hide the lore title when the cell header already names it. */
    loreTitle(): string {
      const t = this.lore?.title ?? '';
      if (t === '') {
        return '';
      }
      const translated = translateText(t);
      return translated === this.cellHeader || translated === this.tileLabel ? '' : t;
    },
  },
  methods: {
    /**
     * Recompute the two overflow affordances. Kept cheap (three reads, no
     * layout write) and driven by the passive scroll event, a ResizeObserver and
     * the preview watcher — the three moments the answer can change.
     */
    measureScroll(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined || root === null) {
        return;
      }
      const remaining = root.scrollHeight - root.clientHeight - root.scrollTop;
      this.moreBelow = remaining > 2;
      this.scrolledDown = root.scrollTop > 2;
    },
    resetScroll(): void {
      (this.$refs.root as HTMLElement | undefined)?.scrollTo?.({top: 0});
      this.$nextTick(() => this.measureScroll());
    },
  },
});
</script>
