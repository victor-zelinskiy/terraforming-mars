<template>
  <aside class="con-inspector con-context con-info__scroll"
         ref="root"
         :class="{'con-inspector--more': moreBelow, 'con-inspector--scrolled': scrolledDown}"
         :aria-label="$t('Cell details')"
         @scroll.passive="measureScroll">
    <!-- ── TASK MODE: active placement — the tactical dossier ─────────
         Reading order is the architecture: WHAT lands (identity) → the
         focused CELL's state → the cell's own toll → the immediate result →
         standing progress → endgame → field rules. The panel carries NO
         command rows and no controller prompts — every verb lives in the ONE
         bottom command bar (P21; the old in-panel «A Разместить здесь» CTA
         and the L3 hint duplicated it and are gone). -->
    <template v-if="mode === 'placement'">
      <header class="con-context__id">
        <!-- The kicker names the TASK, and the host supplies it — a cell pick
             is not always a tile pick (a claim / a camp move puts a MARKER
             down). Kept small: it is context, the OBJECT below is the voice. -->
        <div class="con-context__eyebrow">
          <div class="con-context__task-kicker">{{ $t(placementKickerKey) }}</div>
          <!-- P20: the inspect-all toggle announces itself as a distinct mode. -->
          <div v-if="inspectAll" class="con-context__mode-chip">{{ $t('Inspecting all cells') }}</div>
        </div>
        <!-- WHAT LANDS — the real tile art + its name, never the server's
             whole sentence (placementDossier owns the naming law). -->
        <div class="con-context__head">
          <span v-if="swatchClass !== undefined" class="con-context__tile" aria-hidden="true">
            <span class="con-context__tile-art" :class="swatchClass"></span>
          </span>
          <h2 class="con-context__title"
              :class="identity.tier === 'base' ? undefined : 'con-context__title--' + identity.tier">{{ identity.title }}</h2>
        </div>
        <div v-if="identity.special" class="con-context__qualifier">{{ $t('Special tile') }}</div>
        <!-- The exchange behind a conversion placement — `8 🌱 → 1 [tile]` —
             structural (convert plants), never parsed from the title. -->
        <div v-if="conversion !== undefined" class="con-context__formula">
          <span class="con-context__f-num">{{ conversion.amount }}</span>
          <span class="con-context__f-ico" :class="conversionIconClass" aria-hidden="true"></span>
          <span class="con-context__f-arrow" aria-hidden="true">→</span>
          <span class="con-context__f-num con-context__f-num--res">1</span>
          <span v-if="swatchClass !== undefined" class="con-context__f-tile" aria-hidden="true">
            <span class="con-context__tile-art" :class="swatchClass"></span>
          </span>
        </div>
        <!-- The demoted server sentence — only when it adds a real constraint. -->
        <div v-else-if="identity.actionLine !== ''" class="con-context__action-line">{{ identity.actionLine }}</div>
        <!-- WHO asked — one quiet line of metadata (`.con-src` chip). The
             inspect verb lives in the command bar (L3), not here. -->
        <console-source-dock v-if="sourceView !== undefined" :view="sourceView" chip ref="sourceChip" />
      </header>

      <!-- ── THE FOCUSED CELL: one fixed line; the refusal expands below
           without a jump (grid-rows well), so legal ↔ illegal never shifts
           the identity above it. The LOCKED phase re-registers the same bar
           (amber, «выбрано») — a paint-only change, zero geometry. -->
      <div class="con-context__cell">
        <div class="con-context__cellbar"
             :class="cellbarClass">
          <span class="con-context__cell-mark" aria-hidden="true">{{ selectedLegal ? (cellLocked ? '◈' : '◆') : '✕' }}</span>
          <span class="con-context__cell-name">{{ cellHeader !== '' ? cellHeader : $t('Board cell') }}</span>
          <!-- «Без штрафа» is ONE quiet word on the cell line, not a section:
               a whole «ЭФФЕКТ КЛЕТКИ» block whose entire content was the
               absence of an effect spent a head + a row on a non-event. -->
          <span v-if="cellLocked" class="con-context__cell-tail con-context__cell-tail--locked">· {{ $t(flowPhase === 'committing' ? 'Placing' : 'Cell selected') }}</span>
          <span v-else-if="noToll" class="con-context__cell-tail">· {{ $t('No extra cost') }}</span>
        </div>
        <div class="con-context__reason-well"
             :class="{'con-context__reason-well--open': !selectedLegal}"
             aria-live="polite">
          <div class="con-context__reason">{{ illegalReason !== '' ? illegalReason : $t('Cannot place here') }}</div>
        </div>
      </div>

      <!-- ── THE DOSSIER BODY — the same server facts, grouped by intent and
           COMPACTED into rows (placementDossier).
           ⚠️ NO transition group, and no height/enter/leave animation of any
           kind: this is a HUD of the cell the player is pointing at, and the
           player is pointing with the d-pad. A section that grows, collapses
           or slides on every cursor step turns the panel into the moving
           object on screen — the board stops being where the eye is. Only
           VALUES update (each is keyed on its own rendered text, so the ones
           that did not change do not even re-mount). -->
      <div class="con-context__body">
        <!-- Sections follow each other in ONE natural flow with a shared
             rhythm — a section exists only when it has rows, and the read
             order is the decision order (toll → result → the tile's standing
             mechanic → progress → endgame). Still NO animation of any kind
             on a cell change: content reflows instantly; only values flick. -->
        <section v-for="section in sections" :key="section.key"
                 class="con-context__sec" :class="'con-context__sec--' + section.key">
          <h3 class="con-context__sec-head">
            <span>{{ $t(section.titleKey) }}</span>
            <!-- THE CELL'S OWN FORECAST — the sum of the rows below, which is
                 the number the player is actually after («сколько ПО стоит ЭТА
                 клетка»); shown only when the block has more than one scoring
                 row, so it can never just repeat it. -->
            <span v-if="section.total !== undefined" :key="section.total" class="con-context__sec-total">
              {{ section.total < 0 ? '−' : '+' }}{{ Math.abs(section.total) }} <i>{{ $t('VP') }}</i>
            </span>
          </h3>
          <template v-if="section.groups !== undefined">
            <div v-for="group in section.groups" :key="group.key" class="con-context__grp">
              <div class="con-context__grp-head">
                <span v-if="groupDot(group) !== undefined" class="con-context__grp-dot"
                      :class="'player_bg_color_' + groupDot(group)"></span>
                <span v-i18n>{{ groupLabel(group) }}</span>
              </div>
              <console-placement-fact-row v-for="row in group.rows" :key="row.key" :row="row" />
            </div>
          </template>
          <template v-else>
            <console-placement-fact-row v-for="row in section.rows" :key="row.key" :row="row" />
          </template>
        </section>
        <!-- «Ничего сверх размещения» — names WHAT lands (tile vs marker). -->
        <div v-if="emptyKey !== undefined" class="con-context__none">{{ $t(emptyKey) }}</div>
        <!-- An illegal cell has no preview — the hover facts still explain
             what stands on it (hazard identity, cleanup reward, …). They get
             a head of their own: without one they read as consequences of a
             placement that cannot happen. -->
        <section v-if="fallbackRows.length > 0" class="con-context__sec con-context__sec--cellinfo">
          <h3 class="con-context__sec-head"><span>{{ $t('Board cell') }}</span></h3>
          <console-placement-fact-row v-for="row in fallbackRows" :key="row.key" :row="row" />
        </section>
      </div>
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
 *  - placement: the TACTICAL PLACEMENT DOSSIER — identity (what lands) +
 *    cell state + the server preview regrouped by intent (placementDossier);
 *  - track (P27): a focused global-parameter TRACK bonus — the SAME
 *    already-translated rows the premium ScaleTooltip shows;
 *  - cell: inspection identity (header/name/owner) + facts from the
 *    shared BoardInformation pipeline.
 * Deliberately NOT a duplicate of the bottom command bar: the panel renders
 * ZERO controller prompts — A/L3/R3/B live in the bar and only there.
 * Pure presentation: every value is a prop computed in ConsoleShell from
 * the same sources the desktop buttons use.
 */
import {defineComponent, PropType} from 'vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import ConsolePlacementFactRow from '@/client/components/console/ConsolePlacementFactRow.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {BoardCellInfo, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {ScaleTooltipContent} from '@/client/components/board/scaleTooltipState';
import {CardName} from '@/common/cards/CardName';
import {PromptSourceView} from '@/client/console/promptSource';
import {tileCssClassOf} from '@/client/components/board/BoardSpaceTile.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {
  DossierRecipientGroup,
  DossierRow,
  DossierSection,
  PlacementConversion,
  PlacementIdentity,
  PlacementShape,
  buildDossierRows,
  dossierEmptyKey,
  dossierSections,
  placementIdentity,
} from '@/client/console/placementDossier';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleContextPanel',
  components: {BoardFactGroups, ConsolePlacementFactRow, GamepadGlyph},
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
    /** What lands (tileType / kind / effect / source) — the identity's input. */
    placementShape: {type: Object as PropType<PlacementShape | undefined>, default: undefined},
    /** The structurally-known exchange (convert plants) — the formula line. */
    conversion: {type: Object as PropType<PlacementConversion | undefined>, default: undefined},
    /** Ares tile-art variants are active (tileCssClassOf needs the flag). */
    aresTiles: {type: Boolean, default: false},
    selectedLegal: {type: Boolean, default: false},
    illegalReason: {type: String, default: ''},
    /** The two-phase placement flow's phase — the cell bar's locked accent
     *  (paint-only; the bar renders no controller prompt, per contract). */
    flowPhase: {type: String as PropType<'navigate' | 'locked' | 'committing'>, default: 'navigate'},
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
    /** The source CARD, when there is one — what L3 opens fullscreen. */
    sourceCard(): CardName | undefined {
      return this.sourceView?.inspectable === true ? this.sourceView.card : undefined;
    },
    /** The cell is LOCKED (or its commit is on the wire) — amber register. */
    cellLocked(): boolean {
      return this.selectedLegal && this.flowPhase !== 'navigate';
    },
    cellbarClass(): string {
      if (!this.selectedLegal) {
        return 'con-context__cellbar--no';
      }
      return this.cellLocked ? 'con-context__cellbar--locked' : 'con-context__cellbar--ok';
    },
    /** WHAT LANDS — the pure identity (title / swatch / demoted sentence). */
    identity(): PlacementIdentity {
      return placementIdentity({
        translatedTitle: this.placementTitle,
        tileType: this.placementShape?.tileType,
        placementType: this.placementShape?.placementType,
        placementEffect: this.placementShape?.placementEffect,
        sourceCard: this.placementShape?.sourceCard,
        hasConversion: this.conversion !== undefined,
        translate: (key, params) =>
          (params !== undefined ? translateTextWithParams(key, [...params]) : translateText(key)),
      });
    },
    /** The real board tile art class for the identity / formula swatch. */
    swatchClass(): string | undefined {
      const tt = this.identity.tileType;
      if (tt === undefined) {
        return undefined;
      }
      const suffix = tileCssClassOf(tt, this.aresTiles);
      return suffix === '' ? undefined : 'board-space-tile--' + suffix;
    },
    conversionIconClass(): string {
      return this.conversion !== undefined ? iconClassFor(this.conversion.icon) : '';
    },
    /** The dossier body — the preview's facts regrouped by intent. */
    sections(): ReadonlyArray<DossierSection> {
      return this.preview !== undefined ? dossierSections(this.preview, this.viewerColor) : [];
    },
    /**
     * This cell demands nothing extra — said as one quiet word on the cell
     * line. Only for a LEGAL cell with a live preview: an illegal cell's line
     * already carries the refusal, and no preview means no claim.
     */
    noToll(): boolean {
      return this.selectedLegal && this.preview !== undefined &&
        !this.sections.some((s) => s.key === 'effect');
    },
    emptyKey(): string | undefined {
      return this.preview !== undefined ? dossierEmptyKey(this.preview) : undefined;
    },
    /** An illegal cell has no preview — the hover facts still explain it. */
    fallbackRows(): ReadonlyArray<DossierRow> {
      if (this.mode !== 'placement' || this.preview !== undefined) {
        return [];
      }
      return buildDossierRows(this.info?.facts ?? []);
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
    groupDot(group: DossierRecipientGroup): Color | undefined {
      const r = group.recipient;
      if (r.kind === 'current-player') {
        return this.viewerColor;
      }
      if (r.kind === 'player' || r.kind === 'tile-owner') {
        return r.color;
      }
      return undefined;
    },
    groupLabel(group: DossierRecipientGroup): string {
      const r = group.recipient;
      switch (r.kind) {
      case 'current-player': return 'You';
      case 'player':
      case 'tile-owner': {
        // A colour with no seat behind it must never leak raw («NEUTRAL» over
        // a solo game's setup city) — name it through the i18n key.
        const name = displayNameForColor(this.players, r.color);
        return name === 'neutral' ? 'Neutral' : name;
      }
      case 'neutral': return 'Field rule';
      case 'nobody': return 'Reserved';
      }
    },
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
