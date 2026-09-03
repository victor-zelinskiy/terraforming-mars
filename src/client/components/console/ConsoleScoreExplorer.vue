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
      <!-- The HERO. The shared total keeps ONE structure on both sides of
           the summary handoff (no contextual label inside the anchor — a
           label that exists in only one state snaps the morph). The SHARE
           LINE is the top bar's own voice: which stripe the cursor means
           and what share it holds — absolutely seated, zero layout push. -->
      <div class="con-vpx__hero">
        <div class="con-vpx__totalrow" data-vpx-total>
          <b class="con-vpx__total">{{ overview.total }}</b>
          <span class="con-vpx__total-vp">{{ $t('VP') }}</span>
        </div>
        <div class="con-vpx__bar" data-vpx-bar aria-hidden="true">
          <span v-for="seg in barSegments" :key="seg.key"
                class="con-vpx__seg"
                :class="['con-eg-cat--' + seg.accent, {'con-vpx__seg--dim': litKey !== '' && seg.key !== litKey}]"
                :style="{width: seg.widthPct + '%'}"></span>
        </div>
        <div class="con-vpx__shareline" aria-hidden="true">
          <template v-if="litShare !== ''">
            <i class="con-vpx__shareline-dot" :class="'con-eg-cat--' + shareKey"></i>
            <span>{{ litShare }}</span>
          </template>
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
              <!-- The SOURCE LEDGER — what the subtotal is MADE OF (the top
                   bar already owns «share of the total»; no track here). -->
              <span class="con-vpx__tile-ledger">
                <template v-if="tile.ledger.kind === 'chain'">
                  <span v-for="(p, j) in tile.ledger.pieces" :key="p.key" class="con-vpx__lg-piece">
                    <b v-if="p.value !== undefined" class="con-vpx__lg-num">{{ ledgerNum(p.value, j) }}</b>
                    <span class="con-vpx__lg-word">{{ factText(p) }}</span>
                  </span>
                  <span v-if="tile.ledger.moreCount > 0" class="con-vpx__lg-more">{{ moreText(tile.ledger.moreCount) }}</span>
                </template>
                <template v-else-if="tile.ledger.kind === 'medallions'">
                  <span class="con-vpx__lg-meds" aria-hidden="true">
                    <i v-for="m in tile.ledger.entries" :key="m.slug" class="con-vpx__med" :style="maArtStyle(m.slug)"></i>
                    <span v-if="tile.ledger.moreCount > 0" class="con-vpx__med-more">+{{ tile.ledger.moreCount }}</span>
                  </span>
                  <span class="con-vpx__lg-word">{{ factText(tile.ledger.caption) }}</span>
                </template>
                <span v-else class="con-vpx__lg-empty">{{ factText(tile.ledger.empty) }}</span>
              </span>
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

          <!-- TR: the ARITHMETIC STORY — where every point came from, with
               the running rating after each source («20 → 21 → … = 23»);
               Σ of the rows IS the rating (server invariant). -->
          <ConsoleScrollArea v-if="renderCategoryKey === 'tr'" class="con-vpx__catbody">
            <div class="con-vpx__trrows">
              <div v-for="(row, i) in trModel.rows" :key="row.key"
                   class="con-vpx__trrow" :class="'con-vpx__trrow--' + row.flavor" data-vpx-catrow>
                <span class="con-vpx__trrow-label">{{ $t(row.label) }}</span>
                <span v-if="row.generation !== undefined" class="con-vpx__trrow-gen">{{ genText(row.generation) }}</span>
                <b class="con-vpx__trrow-value">{{ i === 0 ? String(row.value) : plus(row.value) }}</b>
                <span class="con-vpx__trrow-run">→ {{ row.running }}</span>
              </div>
            </div>
            <div class="con-vpx__trsum" data-vpx-catrow>
              <span>{{ $t('Total') }}</span>
              <b>{{ trModel.total }}</b>
            </div>
          </ConsoleScrollArea>

          <!-- ДОСТИЖЕНИЯ / НАГРАДЫ: the REAL earned emblems (the MA
               workspace's own art), one entry per actual laurel — never a
               placeholder, never a future slot. X inspects the focused one. -->
          <ConsoleScrollArea v-else-if="isMaCategory" class="con-vpx__catbody">
            <div v-if="maCollection.entries.length === 0" class="con-vpx__empty">{{ $t(maCollection.emptyKey) }}</div>
            <div v-else class="con-vpx__macoll">
              <button v-for="(e, i) in maCollection.entries" :key="e.key"
                      type="button"
                      class="con-vpx__maent"
                      :class="{
                        'con-vpx__maent--focused': i === ui.catFocus,
                        'con-vpx__maent--award': e.kind === 'award',
                      }"
                      :data-vpx-ma="e.key" data-vpx-catrow
                      @click="ui.catFocus = i">
                <span class="con-vpx__maent-stage" aria-hidden="true">
                  <i class="con-vpx__maent-art" :data-vpx-ma-art="e.key" :style="maArtStyle(e.slug)"></i>
                </span>
                <span class="con-vpx__maent-body">
                  <span class="con-vpx__maent-name">{{ $t(e.shortName) }}</span>
                  <span class="con-vpx__maent-fact">{{ factText(e.fact) }}</span>
                </span>
                <b class="con-vpx__maent-vp">{{ e.vp }}<span>{{ $t('VP') }}</span></b>
              </button>
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
              <b v-if="row.value !== undefined" class="con-vpx__factrow-value">{{ signed(row.value) }}</b>
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

      <!-- ── THE MA INSPECTION (X on a laurel): a read-only layer INSIDE the
           explorer — the focused entry's emblem physically FLIPs into the
           hero pedestal (one object, never a duplicate), the dossier
           unfolds beside it, B folds everything back into the entry. Not a
           route: the crumb stands, a seat switch dismisses it instantly. -->
      <div v-if="ui.inspect !== undefined" ref="inspectEl" class="con-vpx__inspect">
        <div class="con-vpx__inspect-panel" :class="{'con-vpx__inspect-panel--award': ui.inspect.kind === 'award'}">
          <div class="con-vpx__inspect-stage" aria-hidden="true">
            <i class="con-vpx__inspect-art" data-vpx-inspect-art :style="maArtStyle(ui.inspect.slug)"></i>
          </div>
          <div class="con-vpx__inspect-body">
            <span class="con-vpx__inspect-kind" data-vpx-inspect-row>{{ $t(ui.inspect.kind === 'award' ? 'Award' : 'Milestone') }}</span>
            <span class="con-vpx__inspect-name" data-vpx-inspect-row>{{ $t(ui.inspect.shortName) }}</span>
            <span class="con-vpx__inspect-desc" data-vpx-inspect-row>{{ $t(ui.inspect.description) }}</span>
            <span class="con-vpx__inspect-fact" data-vpx-inspect-row>{{ factText(ui.inspect.fact) }}</span>
            <span v-if="ui.inspect.kind === 'milestone' && ui.inspect.threshold !== undefined" class="con-vpx__inspect-fact" data-vpx-inspect-row>
              {{ thresholdText(ui.inspect) }}
            </span>
            <div v-if="ui.inspect.standings !== undefined" class="con-vpx__inspect-standings" data-vpx-inspect-row>
              <div v-for="s in ui.inspect.standings" :key="s.name + s.score"
                   class="con-vpx__inspect-standrow"
                   :class="{'con-vpx__inspect-standrow--mine': s.mine, 'con-vpx__inspect-standrow--scoring': s.scoringPlace}">
                <span class="con-vpx__inspect-place">{{ s.place }}</span>
                <span class="con-vpx__inspect-pname">{{ s.name }}</span>
                <b class="con-vpx__inspect-pscore">{{ s.score }}</b>
              </div>
              <div class="con-vpx__inspect-rule" data-vpx-inspect-row>{{ $t('First place 5 VP · second place 2 VP') }}</div>
            </div>
            <b class="con-vpx__inspect-vp" data-vpx-inspect-row>{{ ui.inspect.vp }} <span>{{ $t('VP') }}</span></b>
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
  buildAwardCollection,
  buildBotGroupFacts,
  buildCardGroupTable,
  buildCardsHub,
  buildCityFacts,
  buildGreeneryFacts,
  buildHydroFacts,
  buildMilestoneCollection,
  buildPenaltyFacts,
  buildTitleFacts,
  buildScoreOverview,
  buildTrProvenance,
  CardGroupTableModel,
  CardsHubModel,
  CategoryFactsModel,
  ScoreCardRow,
  ScoreCardGroupKey,
  ScoreExplorerContext,
  ScoreMaCollection,
  ScoreMaEntry,
  ScoreOverviewModel,
  ScoreTile,
  scoreGridNavigate,
  TrProvenanceModel,
} from '@/client/console/scoreExplorerModel';
import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {SCORE_CATEGORY_TABLE} from '@/client/console/endgame/consoleEndgameModel';
import {infoModeState} from '@/client/console/infoModeState';
import {InfoRouteId, isVpRoute} from '@/client/console/infoRoute';
import {scoreExplorerUi} from '@/client/console/consoleScoreExplorer';
import {
  armDescendOrigin,
  armDescendRect,
  descendCascade,
  descendCascadeOut,
  descendFlipFrom,
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
        hasTitles: game.gameOptions.campaign?.final === true,
      });
    },
    explorerCtx(): ScoreExplorerContext {
      return {
        isBot: this.viewedIsBot,
        deltaPosition: this.viewed.deltaProject?.position,
        awards: this.playerView.game.awards?.map((a) => ({
          name: a.name,
          funder: a.playerName,
          scores: a.scores.map((s) => ({playerColor: s.color as string, playerScore: s.score})),
        })),
        milestones: this.playerView.game.milestones?.map((m) => ({
          name: m.name,
          threshold: m.threshold,
          description: m.description,
          scores: m.scores.map((s) => ({playerColor: s.color as string, playerScore: s.score})),
        })),
        viewedColor: this.viewed.color,
        resolveName: (color) => displayNameForColor(this.playerView.players, color as never),
        describeMa: (kind, name) => {
          try {
            return kind === 'milestone' ?
              getMilestone(name as MilestoneName).description :
              getAward(name as AwardName).description;
          } catch (err) {
            return '';
          }
        },
      };
    },
    isMaCategory(): boolean {
      return this.renderCategoryKey === 'milestones' || this.renderCategoryKey === 'awards';
    },
    maCollection(): ScoreMaCollection {
      const b = this.viewed.victoryPointsBreakdown;
      return this.renderCategoryKey === 'awards' ?
        buildAwardCollection(b, this.explorerCtx) :
        buildMilestoneCollection(b, this.explorerCtx);
    },
    /** The category the top bar LIGHTS — the focused tile on the overview,
     *  the selected category past it (colour continuity of the descend).
     *  A ZERO category has no stripe to link — the bar rests whole (the
     *  share line still answers «0 ПО»). */
    litKey(): string {
      const key = this.level >= 2 ? this.renderCategoryKey :
        (this.route === 'vp' ? this.overview.tiles[this.ui.gridFocus]?.key ?? '' : '');
      const tile = this.overview.tiles.find((t) => t.key === key);
      return tile !== undefined && tile.value > 0 ? key : '';
    },
    /** The share line follows the CURSOR even on a zero tile. */
    shareKey(): string {
      if (this.level >= 2) {
        return this.renderCategoryKey;
      }
      return this.route === 'vp' ? this.overview.tiles[this.ui.gridFocus]?.key ?? '' : '';
    },
    /** The share line beside the bar: «23 / 39 · 59%» for the lit stripe,
     *  an honest «0 ПО» when the cursor stands on a zero category. */
    litShare(): string {
      const tile = this.overview.tiles.find((t) => t.key === this.shareKey);
      if (tile === undefined) {
        return '';
      }
      if (tile.value <= 0) {
        return `${tile.value} ${translateText('VP')}`;
      }
      return `${tile.value} / ${this.overview.total} · ${Math.round(tile.sharePct)}%`;
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
      case 'city': return buildCityFacts(b.detailsCities);
      case 'greenery': return buildGreeneryFacts(b);
      case 'delta': return buildHydroFacts(b, this.explorerCtx);
      case 'titles': return buildTitleFacts(b);
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
      // The INSPECTION owns the pad: one read, one way back.
      if (this.ui.inspect !== undefined) {
        cmds.push({control: 'back', label: 'Back'});
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
        if (this.isMaCategory && this.maCollection.entries[this.ui.catFocus] !== undefined) {
          cmds.push({control: 'secondary', label: 'Inspect'});
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
    /** A seat switch keeps the depth but never a stale dossier — the
     *  entity may not exist for the arriving participant. */
    'infoModeState.playerColor'(): void {
      this.dropInspect();
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
    'maCollection.entries.length'(len: number): void {
      if (this.ui.catFocus >= len) {
        this.ui.catFocus = Math.max(0, len - 1);
      }
    },
  },
  beforeUnmount() {
    this.dropInspect();
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
    /** «+N» for every additive chain piece past the first (the start term). */
    plus(v: number): string {
      return v > 0 ? `+${v}` : String(v);
    },
    ledgerNum(v: number, index: number): string {
      return index === 0 ? String(v) : this.plus(v);
    },
    moreText(n: number): string {
      return translateTextWithParams('+${0} more', [String(n)]);
    },
    maArtStyle(slug: string): Record<string, string> {
      return {backgroundImage: `url(assets/ma/${slug}.png)`};
    },
    thresholdText(e: ScoreMaEntry): string {
      return e.myScore !== undefined ?
        translateTextWithParams('Threshold: ${0} · your score: ${1}', [String(e.threshold), String(e.myScore)]) :
        translateTextWithParams('Threshold: ${0}', [String(e.threshold)]);
    },
    genText(g: number): string {
      return translateTextWithParams('gen ${0}', [String(g)]);
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
      if (this.ui.inspect !== undefined) {
        return; // the inspection is a read — the pad rests until B
      }
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
        if (this.isMaCategory && this.maCollection.entries.length > 0 && (dir === 'up' || dir === 'down')) {
          const step = dir === 'down' ? 1 : -1;
          const next = Math.min(Math.max(this.ui.catFocus + step, 0), this.maCollection.entries.length - 1);
          if (next !== this.ui.catFocus) {
            this.ui.catFocus = next;
            nextTick(() => {
              const el = (this.$el as HTMLElement).querySelector<HTMLElement>('.con-vpx__maent--focused');
              el?.scrollIntoView({block: 'nearest'});
            });
          }
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
      this.ui.catFocus = 0;
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
      // X on a LAUREL — the read-only MA inspection (both participants).
      if (this.route === 'vpCategory' && this.isMaCategory) {
        const entry = this.maCollection.entries[this.ui.catFocus];
        if (entry !== undefined && this.ui.inspect === undefined) {
          this.openMaInspect(entry);
        }
        return;
      }
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
    // ── the MA inspection (X → dossier, B → fold back) ───────────────────
    /** The focused entry's OWN art node in the collection. */
    maSourceArt(key: string): HTMLElement | null {
      return (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-vpx-ma-art="${CSS.escape(key)}"]`);
    },
    openMaInspect(entry: ScoreMaEntry): void {
      const sourceArt = this.maSourceArt(entry.key);
      const entryEl = (this.$el as HTMLElement).querySelector<HTMLElement>(`[data-vpx-ma="${CSS.escape(entry.key)}"]`);
      armDescendRect('vpx-ins-art', descendRectOf(sourceArt));
      armDescendRect('vpx-ins-panel', descendRectOf(entryEl));
      this.ui.inspect = entry;
      if (consoleReducedMotionActive()) {
        return;
      }
      nextTick(() => {
        const layer = this.$refs.inspectEl as HTMLElement | undefined;
        if (layer === undefined) {
          return;
        }
        // The SOURCE emblem yields to its flying twin for the layer's whole
        // life (one physical object; restored on every close path).
        if (sourceArt !== null) {
          sourceArt.style.visibility = 'hidden';
        }
        guardedDescend(layer, 640, () => {}, (finish) => {
          const panel = layer.querySelector<HTMLElement>('.con-vpx__inspect-panel');
          const art = layer.querySelector<HTMLElement>('[data-vpx-inspect-art]');
          if (panel === null) {
            return undefined;
          }
          const tl = gsap.timeline({onComplete: finish});
          if (!descendUnfold(tl, panel, takeDescendRect('vpx-ins-panel'), motionMs(280) / 1000, 0)) {
            tl.fromTo(panel, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(160) / 1000, clearProps: 'opacity,visibility'}, 0);
          }
          if (art !== null) {
            const from = takeDescendRect('vpx-ins-art');
            const flip = from !== undefined ? descendFlipFrom(art, from) : undefined;
            if (flip !== undefined) {
              tl.fromTo(art,
                {x: flip.x, y: flip.y, scale: flip.scale, transformOrigin: 'top left'},
                {x: 0, y: 0, scale: 1, duration: motionMs(320) / 1000, ease: 'expo.out', clearProps: 'transform'}, 0);
            }
          }
          descendCascade(tl, Array.from(layer.querySelectorAll<HTMLElement>('[data-vpx-inspect-row]')), motionMs(170) / 1000, motionMs(150) / 1000, 0.025);
          return tl;
        });
      });
    },
    /** B while the inspection stands — fold it back into its entry.
     *  Returns true when the press was consumed (the shell asks FIRST). */
    consumeScoreBack(): boolean {
      const entry = this.ui.inspect;
      if (entry === undefined) {
        return false;
      }
      const layer = this.$refs.inspectEl as HTMLElement | undefined;
      const sourceArt = this.maSourceArt(entry.key);
      const restore = () => {
        sourceArt?.style.removeProperty('visibility');
        this.ui.inspect = undefined;
      };
      if (consoleReducedMotionActive() || layer === undefined) {
        restore();
        return true;
      }
      guardedDescend(layer, 520, restore, (finish) => {
        const panel = layer.querySelector<HTMLElement>('.con-vpx__inspect-panel');
        const art = layer.querySelector<HTMLElement>('[data-vpx-inspect-art]');
        if (panel === null) {
          return undefined;
        }
        const tl = gsap.timeline({onComplete: finish});
        descendCascadeOut(tl, Array.from(layer.querySelectorAll<HTMLElement>('[data-vpx-inspect-row]')), motionMs(100) / 1000, 0);
        if (art !== null && sourceArt !== null) {
          const home = descendRectOf(sourceArt);
          const flip = home !== undefined ? descendFlipFrom(art, home) : undefined;
          if (flip !== undefined) {
            tl.to(art, {x: flip.x, y: flip.y, scale: flip.scale, transformOrigin: 'top left', duration: motionMs(260) / 1000, ease: 'power2.inOut'}, 0);
          }
        }
        if (!descendFold(tl, panel, descendRectOf((this.$el as HTMLElement).querySelector(`[data-vpx-ma="${CSS.escape(entry.key)}"]`)), motionMs(240) / 1000, motionMs(40) / 1000)) {
          tl.to(panel, {autoAlpha: 0, duration: motionMs(130) / 1000}, 0);
        }
        return tl;
      });
      return true;
    },
    /** A seat switch / route move dismisses the inspection INSTANTLY (the
     *  entity may not exist on the other side — never a stale dossier). */
    dropInspect(): void {
      const entry = this.ui.inspect;
      if (entry === undefined) {
        return;
      }
      const layer = this.$refs.inspectEl as HTMLElement | undefined;
      if (layer !== undefined) {
        killDescendEpisode(layer);
      }
      this.maSourceArt(entry.key)?.style.removeProperty('visibility');
      this.ui.inspect = undefined;
    },
    // ── the level transitions (the workspace-descend phrase) ─────────────
    onRouteChange(to: InfoRouteId, from: InfoRouteId): void {
      this.dropInspect();
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
