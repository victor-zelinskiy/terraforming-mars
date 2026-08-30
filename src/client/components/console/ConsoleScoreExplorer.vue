<template>
  <!-- THE SCORE EXPLORER — the vp subtree of the Information workspace as
       ONE component: the overview (level 1), a category's detail (level 2)
       and a card family's table (level 3) are LAYERS of one surface, so a
       level change is a real FLIP/unfold phrase, never an out-in blink.
       The HERO (total + segmented bar) is the same object on every level —
       and the same object the summary tile hands over (data-vpx-total /
       data-vpx-bar are the shared-element anchors of both directions). -->
  <div class="con-vpx" :class="{'con-vpx--deep': level >= 2}">
    <template v-if="vpVisible">
      <div class="con-vpx__hero">
        <div class="con-vpx__totalrow" data-vpx-total>
          <span class="con-vpx__total-label">{{ $t('Total') }}</span>
          <b class="con-vpx__total">{{ overview.total }}</b>
          <span class="con-vpx__total-vp">{{ $t('VP') }}</span>
        </div>
        <!-- ONE bar semantic everywhere: width = share of the positive
             total. Past level 1 the bar stays and the selected category's
             stripe keeps its ink — colour continuity, not a re-draw. -->
        <div class="con-vpx__bar" data-vpx-bar aria-hidden="true">
          <span v-for="seg in barSegments" :key="seg.key"
                class="con-vpx__seg"
                :class="['con-eg-cat--' + seg.accent, {'con-vpx__seg--dim': level >= 2 && seg.key !== renderCategoryKey}]"
                :style="{width: seg.widthPct + '%'}"></span>
        </div>
        <div v-if="overview.penaltyTotal < 0" class="con-vpx__pennote">{{ $t('Penalties') }} {{ overview.penaltyTotal }} {{ $t('VP') }}</div>
      </div>

      <div ref="stageEl" class="con-vpx__stage">
        <!-- ── LEVEL 1: the overview grid. PARKS under a category (v-show —
             the cursor and scroll survive); every category is a door. -->
        <div v-show="overviewShown" ref="overviewEl" class="con-vpx__overview">
          <div ref="gridEl" class="con-vpx__grid" data-vpx-block>
            <button v-for="(tile, i) in overview.tiles" :key="tile.key"
                    type="button"
                    class="con-vpx__tile"
                    :class="['con-eg-cat--' + tile.accent, {
                      'con-vpx__tile--zero': tile.zero,
                      'con-vpx__tile--penalty': tile.penalty,
                      'con-vpx__tile--focused': i === ui.gridFocus,
                    }]"
                    :data-vpx-tile="tile.key"
                    @click="tilePressed(i)">
              <span class="con-vpx__tile-head">
                <i class="con-vpx__dot" aria-hidden="true"></i>
                <span class="con-vpx__tile-label">{{ $t(tile.label) }}</span>
                <b class="con-vpx__tile-value">{{ tile.value }}</b>
              </span>
              <span class="con-vpx__tile-track" aria-hidden="true">
                <span class="con-vpx__tile-fill" :style="{width: tile.sharePct + '%'}"></span>
              </span>
              <span class="con-vpx__tile-hint">{{ hintText(tile) }}</span>
              <span class="con-vpx__chev" aria-hidden="true">›</span>
            </button>
          </div>
        </div>

        <!-- ── LEVEL 2: the selected category unfolds OUT OF its tile. -->
        <div v-if="catMounted" v-show="route !== 'vpCards' || tableLeaving || catLeaving || catReceding" ref="catEl" class="con-vpx__cat">
          <header class="con-vpx__cathead" :class="'con-eg-cat--' + renderCategoryKey">
            <i class="con-vpx__dot" aria-hidden="true"></i>
            <span class="con-vpx__cathead-label">{{ $t(categoryLabel) }}</span>
            <b class="con-vpx__cathead-value">{{ categoryValue }}</b>
            <span v-if="categoryShare !== undefined" class="con-vpx__cathead-share">{{ categoryShare }}% {{ $t('of total') }}</span>
          </header>

          <!-- TR: the full provenance — where every point of the rating came
               from; Σ of the rows IS the rating (server invariant). -->
          <ConsoleScrollArea v-if="renderCategoryKey === 'tr'" class="con-vpx__catbody">
            <div class="con-vpx__trrows">
              <div v-for="row in trModel.rows" :key="row.key"
                   class="con-vpx__trrow" :class="'con-vpx__trrow--' + row.flavor" data-vpx-catrow>
                <span class="con-vpx__trrow-label">{{ $t(row.label) }}</span>
                <span v-if="row.generation !== undefined" class="con-vpx__trrow-gen">{{ genText(row.generation) }}</span>
                <b class="con-vpx__trrow-value">{{ signed(row.value) }}</b>
              </div>
            </div>
            <div class="con-vpx__trsum" data-vpx-catrow>
              <span>{{ $t('Total') }}</span>
              <b>{{ trModel.total }}</b>
            </div>
          </ConsoleScrollArea>

          <!-- CARDS: the three family doors. -->
          <div v-else-if="renderCategoryKey === 'cards'" class="con-vpx__catbody con-vpx__catbody--hub">
            <div class="con-vpx__groups">
              <button v-for="(g, i) in cardsHub.tiles" :key="g.key"
                      type="button"
                      class="con-vpx__group"
                      :class="['con-eg-cat--' + g.key, {
                        'con-vpx__group--focused': i === ui.hubFocus,
                        'con-vpx__group--dead': !g.enterable,
                      }]"
                      :data-vpx-group="g.key" data-vpx-catrow
                      @click="groupPressed(i)">
                <span class="con-vpx__group-head">
                  <i class="con-vpx__dot" aria-hidden="true"></i>
                  <span class="con-vpx__group-label">{{ $t(g.label) }}</span>
                  <b class="con-vpx__group-value">{{ g.value }}</b>
                </span>
                <span v-if="g.count !== undefined" class="con-vpx__group-count">{{ $t('Cards') }}: {{ g.count }}</span>
                <span class="con-vpx__group-trait">{{ $t(g.trait) }}</span>
                <span v-if="g.enterable" class="con-vpx__chev" aria-hidden="true">›</span>
              </button>
            </div>
          </div>

          <!-- Every other category: honest fact rows (empty state named). -->
          <ConsoleScrollArea v-else class="con-vpx__catbody">
            <div v-if="factsModel.rows.length === 0" class="con-vpx__empty">{{ $t(factsModel.emptyKey) }}</div>
            <div v-for="row in factsModel.rows" :key="row.key" class="con-vpx__factrow" data-vpx-catrow>
              <span class="con-vpx__factrow-main">
                <span class="con-vpx__factrow-label">{{ factText(row) }}</span>
                <span v-if="row.note !== undefined" class="con-vpx__factrow-note">{{ noteText(row.note) }}</span>
              </span>
              <b class="con-vpx__factrow-value">{{ signed(row.value) }}</b>
            </div>
          </ConsoleScrollArea>
        </div>

        <!-- ── LEVEL 3: one family's table + the live preview column. -->
        <div v-if="tableMounted" ref="tableEl" class="con-vpx__table">
          <header class="con-vpx__tabhead" :class="'con-eg-cat--' + renderGroupKey">
            <i class="con-vpx__dot" aria-hidden="true"></i>
            <span class="con-vpx__tabhead-label">{{ $t(tableModel.label) }}</span>
            <b class="con-vpx__tabhead-value">{{ tableModel.subtotal }}</b>
            <span class="con-vpx__tabhead-count">{{ $t('Cards') }}: {{ tableModel.rows.length }}</span>
          </header>
          <div v-if="tableModel.rows.length === 0" class="con-vpx__empty">{{ $t('Nothing scored here yet') }}</div>
          <div v-else class="con-vpx__split" :class="{'con-vpx__split--nopreview': !hasPreviewColumn}">
            <ConsoleScrollArea ref="rowScroll" class="con-vpx__rows">
              <button v-for="(row, i) in tableModel.rows" :key="row.cardName"
                      type="button"
                      class="con-vpx__row"
                      :class="{
                        'con-vpx__row--focused': i === ui.rowFocus,
                        'con-vpx__row--zero': row.vp === 0,
                        'con-vpx__row--neg': row.vp < 0,
                      }"
                      :data-vpx-row="i"
                      @click="rowPressed(i)">
                <span class="con-vpx__row-name">{{ rowDisplayName(row) }}</span>
                <span class="con-vpx__row-formula">
                  <img v-if="formulaTagIcon(row) !== undefined" class="con-vpx__tagicon" :src="formulaTagIcon(row)" alt="" aria-hidden="true">
                  <i v-else-if="rowResourceIcon(row) !== ''" class="con-vpx__resicon" :class="rowResourceIcon(row)" aria-hidden="true"></i>
                  {{ formulaText(row) }}
                </span>
                <b class="con-vpx__row-vp">{{ signed(row.vp) }}</b>
              </button>
            </ConsoleScrollArea>
            <!-- The PREVIEW is the focused row's REAL card (live tableau
                 model — stored resources honest) and the zoom's physical
                 origin: X lifts THIS very card into the fullscreen viewer
                 and B lands it back here. -->
            <aside v-if="hasPreviewColumn" class="con-vpx__preview">
              <div v-if="previewModel !== undefined" class="con-vpx__preview-card" :data-zoom-slot="currentRowName">
                <Card :card="previewModel" />
              </div>
              <div v-else class="con-vpx__preview-fact">
                <span class="con-vpx__preview-fact-mark" aria-hidden="true">Σ</span>
                <span>{{ $t('An engine fact — not a card') }}</span>
              </div>
              <div class="con-vpx__preview-meta">
                <div class="con-vpx__preview-name">{{ currentRow !== undefined ? rowDisplayName(currentRow) : '' }}</div>
                <div v-if="currentRow !== undefined" class="con-vpx__preview-formula">{{ formulaText(currentRow) }}</div>
                <div v-if="currentRow !== undefined && currentRow.resources !== undefined" class="con-vpx__preview-res">
                  <i :class="rowResourceIcon(currentRow)" aria-hidden="true"></i>
                  <span>×{{ currentRow.resources }}</span>
                  <span v-if="remainderText(currentRow) !== ''" class="con-vpx__preview-rem">{{ remainderText(currentRow) }}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </template>

    <!-- The hidden-VP contract at the SAME depth — the crumb stays honest,
         LB/RB keeps cycling, nothing resets. -->
    <div v-else class="con-vpx__hidden">
      <div class="con-vpx__hidden-mark" aria-hidden="true">•••</div>
      <div>{{ $t('Score is hidden until the end of the game') }}</div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * THE SCORE EXPLORER (Information workspace, vp subtree) — presentation +
 * per-level input over the PURE `scoreExplorerModel` builders. Reads only
 * PUBLIC models; never submits anything (the overlay's read-only contract).
 *
 *  · LEVELS ARE LAYERS of one surface: the overview parks (v-show) under a
 *    category, the category parks under a table — cursors and scroll
 *    survive B for free, and the transitions are the workspace-descend
 *    phrase (unfold out of the pressed tile / fold back into it), never an
 *    out-in blink.
 *  · The HERO (total + bar) persists across levels; the summary ⇄ explorer
 *    handoff (`scoreExplorerMotion`) FLIPs the same two objects between the
 *    zones, so the total never disappears for a frame.
 *  · FULLSCREEN (X) goes through the ONE console card inspector
 *    (`openConsoleCardZoom` + `slotZoomOrigin`): the preview card is the
 *    physical origin, LB/RB inside the viewer walks the same rows via
 *    `onBrowse`, and B lands the card back in the preview — no duplicates,
 *    ever (the endgame's two-instance detail is exactly what this avoids).
 */
import {defineComponent, PropType, nextTick} from 'vue';
import {gsap} from 'gsap';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {Tag} from '@/common/cards/Tag';
import {getCard} from '@/client/cards/ClientCardManifest';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {buildLiveScoreModel, LiveScoreModel} from '@/client/console/liveScoreModel';
import {
  buildAwardFacts,
  buildBotGroupFacts,
  buildCardGroupTable,
  buildCardsHub,
  buildCityFacts,
  buildGreeneryFacts,
  buildHydroFacts,
  buildMilestoneFacts,
  buildPenaltyFacts,
  buildScoreOverview,
  buildTrProvenance,
  CardGroupTableModel,
  CardsHubModel,
  CategoryFactsModel,
  ScoreCardRow,
  ScoreCardGroupKey,
  ScoreExplorerContext,
  ScoreOverviewModel,
  ScoreTile,
  scoreGridNavigate,
  TrProvenanceModel,
} from '@/client/console/scoreExplorerModel';
import {SCORE_CATEGORY_TABLE} from '@/client/console/endgame/consoleEndgameModel';
import {infoModeState} from '@/client/console/infoModeState';
import {InfoRouteId, isVpRoute} from '@/client/console/infoRoute';
import {scoreExplorerUi} from '@/client/console/consoleScoreExplorer';
import {
  armDescendOrigin,
  armDescendRect,
  descendCascade,
  descendCascadeOut,
  descendFold,
  descendRecede,
  descendRectOf,
  descendReturn,
  descendUnfold,
  guardedDescend,
  killDescendEpisode,
  takeDescendOrigin,
  takeDescendRect,
} from '@/client/console/surfaceMotion/workspaceDescend';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import Card from '@/client/components/card/CardFace.vue';

/** The unit noun of a `per` formula (i18n keys — the «what is counted» tail). */
const UNIT_NOUN: Readonly<Record<string, string>> = {
  'tags': 'matching tags',
  'cities': 'cities in play',
  'oceans': 'oceans placed',
  'colonies': 'colonies built',
  'moon-mine': 'Moon mines',
  'moon-road': 'Moon roads',
};

export default defineComponent({
  name: 'ConsoleScoreExplorer',
  components: {Card, ConsoleScrollArea},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  setup() {
    const viewport = useConsoleViewport();
    return {viewport};
  },
  data() {
    return {
      infoModeState,
      ui: scoreExplorerUi,
      /** Leave latches — keep a departing layer mounted through its fold. */
      overviewLeaving: false,
      catLeaving: false,
      tableLeaving: false,
      /** The category stays VISIBLE through its own recede under the
       *  unfolding table (v-show would cut the breath at the route flip). */
      catReceding: false,
    };
  },
  computed: {
    route(): InfoRouteId {
      return this.infoModeState.route;
    },
    level(): number {
      return this.route === 'vpCards' ? 3 : this.route === 'vpCategory' ? 2 : 1;
    },
    viewed(): PublicPlayerModel {
      const color = this.infoModeState.playerColor;
      return this.playerView.players.find((p) => p.color === color) ?? this.playerView.thisPlayer;
    },
    isSelf(): boolean {
      return this.viewed.color === this.playerView.thisPlayer.color;
    },
    viewedIsBot(): boolean {
      return this.viewed.isMarsBot === true;
    },
    vpVisible(): boolean {
      return this.isSelf || this.viewedIsBot ||
        this.playerView.game.gameOptions.showOtherPlayersVP === true;
    },
    liveScore(): LiveScoreModel {
      const game = this.playerView.game;
      return buildLiveScoreModel(this.viewed.victoryPointsBreakdown, {
        isBot: this.viewedIsBot,
        hasMoon: game.moon !== undefined,
        hasPathfinders: game.pathfinders !== undefined,
        hasDelta: game.gameOptions.expansions.deltaProject === true,
      });
    },
    explorerCtx(): ScoreExplorerContext {
      return {
        isBot: this.viewedIsBot,
        deltaPosition: this.viewed.deltaProject?.position,
        awards: this.playerView.game.awards?.map((a) => ({
          name: a.name,
          scores: a.scores.map((s) => ({playerColor: s.color as string, playerScore: s.score})),
        })),
        viewedColor: this.viewed.color,
      };
    },
    overview(): ScoreOverviewModel {
      return buildScoreOverview(this.liveScore, this.viewed.victoryPointsBreakdown, this.explorerCtx);
    },
    barSegments(): Array<{key: string, accent: string, widthPct: number}> {
      return this.overview.tiles
        .filter((t) => t.value > 0)
        .map((t) => ({key: t.key, accent: t.accent, widthPct: t.sharePct}));
    },
    /** The category rendered on level ≥ 2 — the param, kept through a fold. */
    renderCategoryKey(): string {
      return this.infoModeState.vpCategoryKey ?? '';
    },
    renderGroupKey(): string {
      return this.infoModeState.vpCardsGroup ?? '';
    },
    categoryLabel(): string {
      return SCORE_CATEGORY_TABLE.find((c) => c.key === this.renderCategoryKey)?.label ?? '';
    },
    categoryTile(): ScoreTile | undefined {
      return this.overview.tiles.find((t) => t.key === this.renderCategoryKey);
    },
    categoryValue(): number {
      return this.categoryTile?.value ?? 0;
    },
    categoryShare(): number | undefined {
      const tile = this.categoryTile;
      return tile !== undefined && tile.value > 0 ? Math.round(tile.sharePct) : undefined;
    },
    overviewShown(): boolean {
      return this.route === 'vp' || this.overviewLeaving;
    },
    catMounted(): boolean {
      return (this.route === 'vpCategory' || this.route === 'vpCards' || this.catLeaving) &&
        this.renderCategoryKey !== '';
    },
    tableMounted(): boolean {
      return (this.route === 'vpCards' || this.tableLeaving) && this.renderGroupKey !== '';
    },
    trModel(): TrProvenanceModel {
      return buildTrProvenance(this.viewed.victoryPointsBreakdown, this.viewedIsBot);
    },
    cardsHub(): CardsHubModel {
      return buildCardsHub(this.liveScore, this.viewed.victoryPointsBreakdown, this.viewedIsBot);
    },
    factsModel(): CategoryFactsModel {
      const b = this.viewed.victoryPointsBreakdown;
      switch (this.renderCategoryKey) {
      case 'milestones': return buildMilestoneFacts(b);
      case 'awards': return buildAwardFacts(b, this.explorerCtx);
      case 'city': return buildCityFacts(b.detailsCities);
      case 'greenery': return buildGreeneryFacts(b);
      case 'delta': return buildHydroFacts(b, this.explorerCtx);
      case 'penalty': return buildPenaltyFacts(b);
      default: {
        const cat = this.liveScore.categories.find((c) => c.key === this.renderCategoryKey);
        return cat !== undefined ?
          {rows: cat.subs.map((s) => ({key: s.key, label: s.label, value: s.value})), emptyKey: 'Nothing scored here yet'} :
          {rows: [], emptyKey: 'Nothing scored here yet'};
      }
      }
    },
    resourcesByName(): Partial<Record<string, number>> {
      const out: Partial<Record<string, number>> = {};
      for (const c of this.viewed.tableau) {
        if (c.resources !== undefined && c.resources > 0) {
          out[c.name] = c.resources;
        }
      }
      return out;
    },
    tableModel(): CardGroupTableModel {
      const group = (this.renderGroupKey || 'cards-resource') as ScoreCardGroupKey;
      if (this.viewedIsBot) {
        return buildBotGroupFacts(this.viewed.victoryPointsBreakdown, group, this.viewed.megacredits);
      }
      return buildCardGroupTable(
        this.viewed.victoryPointsBreakdown,
        group,
        this.resourcesByName,
        (name) => {
          try {
            const card = getCard(name as never);
            return card === undefined ? undefined : {exists: true, resourceType: card.resourceType};
          } catch (err) {
            return undefined;
          }
        },
      );
    },
    currentRow(): ScoreCardRow | undefined {
      return this.tableModel.rows[this.ui.rowFocus];
    },
    currentRowName(): string {
      return this.currentRow?.cardName ?? '';
    },
    hasPreviewColumn(): boolean {
      return this.tableModel.rows.some((r) => r.previewable);
    },
    previewModel(): CardModel | undefined {
      const row = this.currentRow;
      if (row === undefined || !row.previewable) {
        return undefined;
      }
      return this.viewed.tableau.find((c) => c.name === row.cardName) ?? ({name: row.cardName} as CardModel);
    },
    gridCols(): number {
      return this.viewport.isHandheld.value ? 2 : 3;
    },
    /** The explorer's live command contract — ConsoleInfoMode republishes it. */
    barState(): Array<ConsoleCommand> {
      const cmds: Array<ConsoleCommand> = [
        {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
      ];
      if (!this.vpVisible) {
        cmds.push({control: 'back', label: this.level >= 2 ? 'Back' : 'To overview'});
        cmds.push({control: 'inspect', label: 'Close', priority: 0});
        return cmds;
      }
      if (this.route === 'vp') {
        cmds.push({control: 'confirm', label: 'Open', enabled: this.overview.tiles.length > 0});
        cmds.push({control: 'back', label: 'To overview'});
      } else if (this.route === 'vpCategory') {
        if (this.renderCategoryKey === 'cards') {
          const tile = this.cardsHub.tiles[this.ui.hubFocus];
          cmds.push({control: 'confirm', label: 'Open', enabled: tile?.enterable === true});
        }
        cmds.push({control: 'back', label: 'Back'});
      } else {
        if (this.currentRow?.previewable === true) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'back', label: 'Back'});
      }
      cmds.push({control: 'inspect', label: 'Close', priority: 0});
      return cmds;
    },
  },
  watch: {
    barState: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        scoreExplorerUi.barCommands = cmds;
      },
    },
    'infoModeState.route'(to: InfoRouteId, from: InfoRouteId): void {
      this.onRouteChange(to, from);
    },
    /** Clamp the cursors when a seat switch shrinks a list (same depth). */
    'tableModel.rows.length'(len: number): void {
      if (this.ui.rowFocus >= len) {
        this.ui.rowFocus = Math.max(0, len - 1);
      }
    },
    'overview.tiles.length'(len: number): void {
      if (this.ui.gridFocus >= len) {
        this.ui.gridFocus = Math.max(0, len - 1);
      }
    },
  },
  beforeUnmount() {
    const stage = this.$refs.stageEl as HTMLElement | undefined;
    if (stage !== undefined) {
      killDescendEpisode(stage);
    }
    this.overviewLeaving = false;
    this.catLeaving = false;
    this.tableLeaving = false;
    scoreExplorerUi.barCommands = undefined;
  },
  methods: {
    signed(v: number): string {
      return String(v);
    },
    genText(g: number): string {
      return translateTextWithParams('gen ${0}', [String(g)]);
    },
    hintText(tile: ScoreTile): string {
      const hint = tile.hint;
      if (hint === undefined) {
        return tile.zero ? translateText('No points yet') : '';
      }
      if (hint.kind === 'template') {
        return translateTextWithParams(hint.template, hint.params.map(String));
      }
      return hint.pairs.map((p) => `${translateText(p.label)} ${p.value}`).join(' · ');
    },
    factText(row: {label: string, params?: ReadonlyArray<string | number>}): string {
      return row.params !== undefined ?
        translateTextWithParams(row.label, row.params.map(String)) :
        translateText(row.label);
    },
    noteText(note: {label: string, params?: ReadonlyArray<string | number>}): string {
      return this.factText(note);
    },
    rowDisplayName(row: ScoreCardRow): string {
      if (row.formula.kind === 'fact') {
        return this.factText({label: row.formula.label, params: row.formula.params});
      }
      return translateText(row.cardName);
    },
    /** The formula in the row's own words — never one universal sentence. */
    formulaText(row: ScoreCardRow): string {
      const f = row.formula;
      switch (f.kind) {
      case 'fixed':
        return translateTextWithParams('Printed VP: ${0}', [String(f.vp)]);
      case 'per': {
        const unitTail = f.unit === 'resources' ? '' : (UNIT_NOUN[f.unit] !== undefined ? ` · ${translateText(UNIT_NOUN[f.unit])}` : '');
        const args = (parts: Array<string | number>) => parts.map(String);
        if (f.per === 1 && f.each === 1) {
          return translateTextWithParams('${0} × 1 VP = ${1} VP', args([f.counted, f.vp])) + unitTail;
        }
        if (f.each === 1) {
          return translateTextWithParams('${0} / ${1} = ${2} VP', args([f.counted, f.per, f.vp])) + unitTail;
        }
        if (f.per === 1) {
          return translateTextWithParams('${0} × ${1} VP = ${2} VP', args([f.counted, f.each, f.vp])) + unitTail;
        }
        return translateTextWithParams('${0} × ${1} / ${2} = ${3} VP', args([f.counted, f.each, f.per, f.vp])) + unitTail;
      }
      case 'special':
        return f.counted !== undefined ?
          translateTextWithParams('Special scoring · ${0} stored', [String(f.counted)]) :
          translateText('Special scoring');
      case 'fact':
        return '';
      default:
        return '';
      }
    },
    remainderText(row: ScoreCardRow): string {
      const f = row.formula;
      if (f.kind === 'per' && f.remainder !== undefined && f.remainder > 0) {
        return translateTextWithParams('${0} toward the next VP', [String(f.remainder)]);
      }
      return '';
    },
    formulaTagIcon(row: ScoreCardRow): string | undefined {
      const f = row.formula;
      return f.kind === 'per' && f.tag !== undefined ? tagIconUrl(f.tag as Tag) : undefined;
    },
    rowResourceIcon(row: ScoreCardRow): string {
      const type = row.resourceType;
      if (type === undefined) {
        return '';
      }
      return iconClassFor((type as CardResource).toLowerCase().replace(/ /g, '-'));
    },
    // ── input (forwarded by the shell while a vp route is up) ────────────
    handleIntent(intent: GamepadIntent): void {
      if (!this.vpVisible) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      const action = consoleActionOf(intent);
      if (action === 'primary') {
        this.onPrimary();
      } else if (action === 'inspect') {
        this.onInspectRow();
      }
    },
    onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (this.route === 'vp') {
        this.ui.gridFocus = scoreGridNavigate(this.overview.tiles.length, this.ui.gridFocus, dir, this.gridCols);
        return;
      }
      if (this.route === 'vpCategory') {
        if (this.renderCategoryKey === 'cards') {
          const step = dir === 'down' || dir === 'right' ? 1 : -1;
          this.ui.hubFocus = Math.min(Math.max(this.ui.hubFocus + step, 0), this.cardsHub.tiles.length - 1);
          return;
        }
        this.scrollCatBody(dir);
        return;
      }
      if (this.route === 'vpCards' && (dir === 'up' || dir === 'down')) {
        const step = dir === 'down' ? 1 : -1;
        const next = Math.min(Math.max(this.ui.rowFocus + step, 0), Math.max(0, this.tableModel.rows.length - 1));
        if (next !== this.ui.rowFocus) {
          this.ui.rowFocus = next;
          nextTick(() => {
            const rowEl = (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-vpx-row="${next}"]`);
            const scroll = this.$refs.rowScroll as InstanceType<typeof ConsoleScrollArea> | undefined;
            if (rowEl !== null && scroll !== undefined) {
              (scroll as unknown as {ensureVisible?: (el: HTMLElement) => void}).ensureVisible?.(rowEl);
            }
          });
        }
      }
    },
    scrollCatBody(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (dir !== 'up' && dir !== 'down') {
        return;
      }
      const viewportEl = (this.$el as HTMLElement).querySelector<HTMLElement>('.con-vpx__catbody .con-scroll-area__viewport');
      viewportEl?.scrollBy({top: (dir === 'down' ? 120 : -120) * (window.devicePixelRatio > 0 ? 1 : 1), behavior: 'smooth'});
    },
    onPrimary(): void {
      if (this.route === 'vp') {
        this.descendCategory();
      } else if (this.route === 'vpCategory' && this.renderCategoryKey === 'cards') {
        this.descendGroup();
      }
    },
    tilePressed(i: number): void {
      this.ui.gridFocus = i;
      this.descendCategory();
    },
    groupPressed(i: number): void {
      this.ui.hubFocus = i;
      this.descendGroup();
    },
    rowPressed(i: number): void {
      this.ui.rowFocus = i;
    },
    descendCategory(): void {
      const tile = this.overview.tiles[this.ui.gridFocus];
      if (tile === undefined) {
        return;
      }
      const el = (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-vpx-tile="${CSS.escape(tile.key)}"]`);
      const rect = descendRectOf(el);
      armDescendRect('vpx-cat', rect);
      armDescendOrigin('vpx-cat', rect !== undefined ? {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2} : undefined);
      this.ui.hubFocus = 0;
      this.infoModeState.vpCategoryKey = tile.key;
      this.infoModeState.route = 'vpCategory';
    },
    descendGroup(): void {
      const tileModel = this.cardsHub.tiles[this.ui.hubFocus];
      if (tileModel === undefined || !tileModel.enterable) {
        return;
      }
      const el = (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-vpx-group="${CSS.escape(tileModel.key)}"]`);
      armDescendRect('vpx-grp', descendRectOf(el));
      this.ui.rowFocus = 0;
      this.infoModeState.vpCardsGroup = tileModel.key;
      this.infoModeState.route = 'vpCards';
    },
    onInspectRow(): void {
      if (this.route !== 'vpCards' || this.viewedIsBot) {
        return;
      }
      const rows = this.tableModel.rows.filter((r) => r.previewable);
      const current = this.currentRow;
      if (current === undefined || !current.previewable || rows.length === 0) {
        return;
      }
      const cards = rows.map((r): CardModel =>
        this.viewed.tableau.find((c) => c.name === r.cardName) ?? ({name: r.cardName} as CardModel));
      const idx = Math.max(0, rows.findIndex((r) => r.cardName === current.cardName));
      openConsoleCardZoom(cards, idx, undefined, undefined, {
        contextLabel: 'Victory Points',
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement,
          (i) => rows[i]?.cardName ?? '',
          (i) => {
            const name = rows[i]?.cardName;
            const at = this.tableModel.rows.findIndex((r) => r.cardName === name);
            if (at >= 0) {
              this.ui.rowFocus = at;
            }
          },
        ),
      });
    },
    // ── the level transitions (the workspace-descend phrase) ─────────────
    onRouteChange(to: InfoRouteId, from: InfoRouteId): void {
      const stage = this.$refs.stageEl as HTMLElement | undefined;
      if (stage !== undefined) {
        killDescendEpisode(stage);
      }
      // Settle any interrupted leave FIRST — state stays consistent under
      // rapid presses (an aborted fold never strands a param or a latch).
      this.settleCatLeave();
      this.settleTableLeave();
      this.overviewLeaving = false;
      this.catReceding = false;

      if (!isVpRoute(to)) {
        // Leaving the subtree entirely (a shortcut / Y) — tidy the params.
        this.infoModeState.vpCategoryKey = undefined;
        this.infoModeState.vpCardsGroup = undefined;
        return;
      }
      if (consoleReducedMotionActive() || stage === undefined) {
        if (to === 'vp') {
          this.infoModeState.vpCategoryKey = undefined;
          this.infoModeState.vpCardsGroup = undefined;
        } else if (to === 'vpCategory') {
          this.infoModeState.vpCardsGroup = undefined;
        }
        return;
      }
      if (from === 'vp' && to === 'vpCategory') {
        this.playCatEnter(stage);
      } else if (from === 'vpCategory' && to === 'vp') {
        this.playCatLeave(stage);
      } else if (from === 'vpCategory' && to === 'vpCards') {
        this.playTableEnter(stage);
      } else if (from === 'vpCards' && to === 'vpCategory') {
        this.playTableLeave(stage);
      }
    },
    settleCatLeave(): void {
      if (this.catLeaving) {
        this.catLeaving = false;
        if (this.route !== 'vpCategory' && this.route !== 'vpCards') {
          this.infoModeState.vpCategoryKey = undefined;
        }
      }
    },
    settleTableLeave(): void {
      if (this.tableLeaving) {
        this.tableLeaving = false;
        if (this.route !== 'vpCards') {
          this.infoModeState.vpCardsGroup = undefined;
        }
      }
    },
    playCatEnter(stage: HTMLElement): void {
      this.overviewLeaving = true;
      nextTick(() => {
        guardedDescend(stage, 620, () => {
          this.overviewLeaving = false;
        }, (finish) => {
          const catEl = this.$refs.catEl as HTMLElement | undefined;
          const overviewEl = this.$refs.overviewEl as HTMLElement | undefined;
          if (catEl === undefined || overviewEl === undefined) {
            return undefined;
          }
          const tl = gsap.timeline({onComplete: finish});
          descendRecede(tl, overviewEl, takeDescendOrigin('vpx-cat'), motionMs(150) / 1000, 0);
          const from = takeDescendRect('vpx-cat');
          if (!descendUnfold(tl, catEl, from, motionMs(280) / 1000, motionMs(40) / 1000)) {
            tl.fromTo(catEl, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(160) / 1000, clearProps: 'opacity,visibility'}, 0);
          }
          descendCascade(tl, this.catRows(catEl), motionMs(175) / 1000, motionMs(170) / 1000);
          return tl;
        });
      });
    },
    playCatLeave(stage: HTMLElement): void {
      this.catLeaving = true;
      guardedDescend(stage, 560, () => {
        this.settleCatLeave();
      }, (finish) => {
        const catEl = this.$refs.catEl as HTMLElement | undefined;
        const overviewEl = this.$refs.overviewEl as HTMLElement | undefined;
        if (catEl === undefined || overviewEl === undefined) {
          return undefined;
        }
        const tl = gsap.timeline({onComplete: finish});
        descendCascadeOut(tl, this.catRows(catEl), motionMs(110) / 1000, 0);
        const tile = (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-vpx-tile="${CSS.escape(this.renderCategoryKey)}"]`);
        if (!descendFold(tl, catEl, descendRectOf(tile), motionMs(240) / 1000, motionMs(50) / 1000)) {
          tl.to(catEl, {autoAlpha: 0, duration: motionMs(140) / 1000}, 0);
        }
        descendReturn(tl, overviewEl, motionMs(220) / 1000, motionMs(120) / 1000);
        return tl;
      });
    },
    playTableEnter(stage: HTMLElement): void {
      this.catReceding = true;
      nextTick(() => {
        guardedDescend(stage, 620, () => {
          this.catReceding = false;
        }, (finish) => {
          const tableEl = this.$refs.tableEl as HTMLElement | undefined;
          const catEl = this.$refs.catEl as HTMLElement | undefined;
          if (tableEl === undefined) {
            return undefined;
          }
          const tl = gsap.timeline({onComplete: finish});
          if (catEl !== undefined) {
            descendRecede(tl, catEl, undefined, motionMs(140) / 1000, 0);
          }
          const from = takeDescendRect('vpx-grp');
          if (!descendUnfold(tl, tableEl, from, motionMs(280) / 1000, motionMs(40) / 1000)) {
            tl.fromTo(tableEl, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(160) / 1000, clearProps: 'opacity,visibility'}, 0);
          }
          descendCascade(tl, this.tableRows(tableEl), motionMs(170) / 1000, motionMs(170) / 1000, 0.02);
          return tl;
        });
      });
    },
    playTableLeave(stage: HTMLElement): void {
      this.tableLeaving = true;
      guardedDescend(stage, 560, () => {
        this.settleTableLeave();
      }, (finish) => {
        const tableEl = this.$refs.tableEl as HTMLElement | undefined;
        const catEl = this.$refs.catEl as HTMLElement | undefined;
        if (tableEl === undefined) {
          return undefined;
        }
        const tl = gsap.timeline({onComplete: finish});
        const group = (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-vpx-group="${CSS.escape(this.renderGroupKey)}"]`);
        if (!descendFold(tl, tableEl, descendRectOf(group), motionMs(240) / 1000, motionMs(30) / 1000)) {
          tl.to(tableEl, {autoAlpha: 0, duration: motionMs(140) / 1000}, 0);
        }
        if (catEl !== undefined) {
          descendReturn(tl, catEl, motionMs(210) / 1000, motionMs(110) / 1000);
        }
        return tl;
      });
    },
    catRows(catEl: HTMLElement): Array<HTMLElement> {
      return Array.from(catEl.querySelectorAll<HTMLElement>('[data-vpx-catrow]'));
    },
    tableRows(tableEl: HTMLElement): Array<HTMLElement> {
      return Array.from(tableEl.querySelectorAll<HTMLElement>('.con-vpx__row, .con-vpx__preview, .con-vpx__tabhead'));
    },
  },
});
</script>
