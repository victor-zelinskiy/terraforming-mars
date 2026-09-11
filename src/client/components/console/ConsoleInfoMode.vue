<template>
  <!-- THE INFORMATION WORKSPACE (Y) — an inspect-only OVERLAY workspace: it
       opens OVER whatever surface the player is on (board, any workspace, a
       minimized prompt), never touches the workspace stack, and closing
       restores the exact captured context (infoModeState.snapshot). The root
       is an ABSOLUTE child of `.con-main` filling everything RIGHT of the
       left resource rail; the rail is the mode's SUMMARY half (ConsoleShell
       overrides its player context to the inspected participant).
       data-motion-*: the surface-motion director materializes the frame from
       the rail seam (open) and returns it there (dismiss); the OWN full dim
       STAYS — the workspace opens OVER arbitrary band surfaces (z 11560,
       above the shade; the rail rides at 11561, crisp above the dim). -->
  <div class="con-info" role="dialog" :aria-label="$t('Information')" data-motion-surface="info-mode">
    <div class="con-info__backdrop" aria-hidden="true"></div>
    <div class="con-info__frame" data-motion-panel>

      <!-- ── THE WORKSPACE HEADER — the ONE crumb grammar every workspace
           speaks: ИНФОРМАЦИЯ › <участник> › <раздел>. The participant is the
           SUBJECT (recomposes directionally on LB/RB — its swap transition is
           ConsoleWsHead's own crossfade), the route is the STAGE (the only
           other animating segment; depth 2 reads as the hosted-step phrase
           «ЭКРАН БОТА · ПЛАНШЕТ»). The identity chips + corp/difficulty meta
           ride the trailing slot — never a second title. -->
      <ConsoleWsHead class="con-info__head"
                     root="Information"
                     :subject="viewedDisplayName"
                     subjectRaw
                     :stage="stagePhrase"
                     stageRaw>
        <template #trailing>
          <span class="con-info__meta" data-insp-slide>
            <span :class="'con-status__dot player_bg_color_' + viewed.color"></span>
            <span v-if="isSelf" class="con-info__chip con-info__chip--you">{{ $t('You') }}</span>
            <span v-if="isSelf && myTurn" class="con-info__chip con-info__chip--turn">{{ $t('Your turn') }}</span>
            <span v-if="isPassed" class="con-info__chip con-info__chip--passed">{{ $t('passed') }}</span>
            <!-- The bot with a corporation wears it as its primary identity,
                 difficulty second: «CrediCor · Обычный». A multi-corporation
                 human (campaign lineage) NAMES the count — a single name must
                 never read as the whole composition. -->
            <span v-if="corpName !== ''" class="con-info__corp" :class="{'con-info__corp--bot': viewedIsBot}">{{ $t(corpName) }}<template v-if="corpExtraCount > 0"> · {{ corpExtraText }}</template><template v-if="viewedIsBot"> · {{ $t(botDifficultyLabel) }}</template></span>
            <span v-else-if="viewedIsBot" class="con-info__corp con-info__corp--bot">{{ $t('Automa opponent') }} · {{ $t(botDifficultyLabel) }}</span>
          </span>
        </template>
      </ConsoleWsHead>

      <!-- ── CONTENT ZONES — one keyed swap per ROUTE: entering a detail is
           a descend beat (rises from below), B is the same phrase reversed.
           An LB/RB SEAT switch keeps the key (routes are semantic and
           survive the switch) so it patches INSTANTLY — its beat is the
           inspectSwitchMotion slide, and rapid presses never queue zone
           transitions. -->
      <transition :css="false" mode="out-in"
                  @enter="detailZoneEnter" @leave="detailZoneLeave"
                  @enter-cancelled="detailZoneCancelled" @leave-cancelled="detailZoneCancelled">

      <!-- ── THE PARTICIPANT SUMMARY — ONE canonical layout for EVERY
           participant. The SHARED zones sit at the same coordinates for a
           human and the bot (VP · played · extras); the human-only
           pair (actions / effects) renders AFTER them and its absence never
           shifts the shared geometry. The zones are a focus ring: d-pad
           moves, A opens the focused zone's route. -->
      <div v-if="presentation === 'summary'" key="summary" class="con-info__layout" data-insp-slide>

        <!-- (The «Доп. ресурсы» zone is the RAIL SATELLITE now — the
             persistent column beside the left rail is the ring's leftmost
             stop; the panel renders no duplicate of it. All zones open via
             the ring + A — the per-zone shortcut badges are GONE, the ONE
             bottom bar carries the contextual hint.) -->
        <!-- Col 1 — «ПОБЕДНЫЕ ОЧКИ»: the premium live score. The SAME
             category system, order and colours as the final scoring
             ceremony (liveScoreModel over the ceremony's own tables), so
             live VP, endgame scoring and the finale read as one system.
             The bot has NO opaque «Подсчёт бота» — its summands live inside
             the shared categories (cards), exactly like the finale. -->
        <div class="con-info__col">
          <section class="con-info__zone con-info__zone--vp"
                   :class="zoneStateClass('vp')" data-zone="vp">
            <h3 class="con-info__block-title">{{ $t('Victory Points') }}</h3>
            <template v-if="vpVisible">
              <!-- data-vpx-total / data-vpx-bar / data-vpx-block are the
                   SHARED-ELEMENT anchors of the score explorer's entry: the
                   total and the bar fly INTO the explorer's hero on A and
                   land back here on B (scoreExplorerMotion). -->
              <div class="con-infovp__totalrow" data-vpx-total>
                <span class="con-infovp__total">{{ liveScore.total }}</span>
                <span class="con-infovp__total-label">{{ $t('VP') }}</span>
              </div>
              <!-- The segmented bar: one hue per category (.con-eg-cat--*),
                   widths on the shared positive total. A penalty never draws
                   here (it subtracts — the legend states it). -->
              <div class="con-infovp__bar" data-vpx-bar aria-hidden="true">
                <span v-for="seg in vpBarSegments" :key="seg.key"
                      class="con-infovp__seg" :class="'con-eg-cat--' + seg.accent"
                      :style="{width: seg.widthPct + '%'}"></span>
              </div>
              <div class="con-infovp__legend" data-vpx-block>
                <div v-for="cat in liveScore.categories" :key="cat.key"
                     class="con-infovp__cat" :class="['con-eg-cat--' + cat.accent, {'con-infovp__cat--zero': cat.value === 0, 'con-infovp__cat--penalty': cat.penalty}]">
                  <i class="con-infovp__dot" aria-hidden="true"></i>
                  <span class="con-infovp__cat-label">{{ $t(cat.label) }}</span>
                  <b class="con-infovp__cat-value">{{ cat.value }}</b>
                </div>
              </div>
            </template>
            <div v-else class="con-info__hidden">{{ $t('Score is hidden until the end of the game') }}</div>
          </section>
        </div>

        <!-- Col 2 — the card story: what was PLAYED. What remains to play is
             NOT a panel any more — the HAND DOCK below IS the inspected
             seat's hand for the workspace's whole lifetime (the closed fan +
             exact count for another human / the bot's action deck, the real
             pack for the viewer) — one physical representation, never a
             duplicated readout. -->
        <div class="con-info__col">
          <section class="con-info__zone con-info__zone--played"
                   :class="zoneStateClass('played')" data-zone="played">
            <h3 class="con-info__block-title">{{ $t('Played cards') }}</h3>
            <template v-if="playedSummary.total > 0">
              <div class="con-info__stat-lines">
                <div class="con-info__stat-line con-info__stat-line--total"><span>{{ $t('Total') }}</span><b class="con-info__mint">{{ playedSummary.total }}</b></div>
                <div v-for="r in playedSummary.rows" :key="r.key" class="con-info__stat-line">
                  <span class="con-info__pcat"><i class="con-info__pcat-dot" :class="'con-info__pcat-dot--' + r.key" aria-hidden="true"></i>{{ $t(r.label) }}</span>
                  <b>{{ r.count }}</b>
                </div>
              </div>
            </template>
            <div v-else class="con-info__empty">{{ $t('No cards played yet') }}</div>
          </section>
        </div>

        <!-- Col 3 — the human-only pair / the bot's internals door. All of
             them ordinary ring stops now (A opens; no dedicated buttons). -->
        <div class="con-info__col">
          <section v-if="!viewedIsBot" class="con-info__zone con-info__zone--actions"
                   :class="zoneStateClass('actions')" data-zone="actions">
            <h3 class="con-info__block-title">{{ $t('Actions') }}</h3>
            <div class="con-info__stat-lines">
              <div class="con-info__stat-line"><span>{{ $t('Available now') }}</span><b class="con-info__mint">{{ actionsAvailable }}</b></div>
              <div class="con-info__stat-line"><span>{{ $t('Total') }}</span><b>{{ actionsTotal }}</b></div>
            </div>
          </section>

          <section v-if="!viewedIsBot" class="con-info__zone con-info__zone--effects"
                   :class="zoneStateClass('effects')" data-zone="effects">
            <h3 class="con-info__block-title">{{ $t('Effects') }}</h3>
            <div class="con-info__stat-lines">
              <div class="con-info__stat-line"><span>{{ $t('Active') }}</span><b class="con-info__mint">{{ effectsCount }}</b></div>
              <div v-if="discountCount > 0" class="con-info__stat-line"><span>{{ $t('Discounts') }}</span><b>{{ discountCount }}</b></div>
            </div>
          </section>

          <!-- «КАМПАНИЯ» — campaign missions only: the mission frame (with
               its board), the viewed seat's titles + TP as ONE visual
               statement with the scoring semantics AT the value (never
               under an unrelated line), and the composition count. The
               full overview is one A away. -->
          <section v-if="campaignContract !== undefined" class="con-info__zone con-info__zone--campaign"
                   :class="zoneStateClass('campaign')" data-zone="campaign">
            <h3 class="con-info__block-title">{{ $t('Campaign') }}</h3>
            <div class="con-info__stat-lines">
              <div class="con-info__stat-line"><span>{{ $t('Mission') }}</span><b class="con-info__mint">{{ campaignMissionText }}</b></div>
            </div>
            <div class="con-info__cmp-tprow">
              <span v-if="campaignViewedTitles.length > 0" class="con-info__ctitles">
                <img v-for="(t, i) in campaignViewedTitles" :key="i" class="con-info__ctitle" :src="titleArtUrl(t.title)" :alt="$t(titleLabel(t.title))">
              </span>
              <b class="con-info__cmp-tp">{{ campaignTpText }}</b>
            </div>
            <div class="con-info__note con-info__note--tp">{{ $t(campaignTpNote) }}</div>
            <div class="con-info__stat-lines">
              <div class="con-info__stat-line"><span>{{ $t('Corporations') }}</span><b>{{ campaignCorpCount }}</b></div>
            </div>
          </section>

          <!-- The bot's door to its internals — a calm entry, not a data
               dump: the algorithm's own room is one A away (a ring stop
               like every other zone). -->
          <section v-if="viewedIsBot" class="con-info__zone con-info__zone--botdoor"
                   :class="zoneStateClass('botdoor')" data-zone="botdoor">
            <h3 class="con-info__block-title">{{ $t('MarsBot screen') }}</h3>
            <div class="con-info__note con-info__note--door">{{ $t('Decks, tracks, storage rules and the printed board') }}</div>
          </section>
        </div>
      </div>

      <!-- ── CAPABILITY FALLBACK — the route SURVIVES a seat switch even
           when the new participant cannot serve it: the crumb stays, LB/RB
           keeps cycling at the same depth, and the zone says calmly why
           there is nothing here. Never a silent reset to the summary. -->
      <div v-else-if="presentation === 'fallback'" :key="'na-' + infoModeState.route" class="con-info__na" data-insp-slide>
        <div class="con-info__na-mark" aria-hidden="true">∅</div>
        <div class="con-info__na-title">{{ $t('Not applicable') }}</div>
        <div class="con-info__na-body">{{ $t(fallbackBody) }}</div>
        <div class="con-info__na-hint">
          <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
          <span>{{ $t('Players') }}</span>
        </div>
      </div>

      <!-- ── «РАЗЫГРАНО» — the embedded premium table (X): the SAME
           component as the board-home overlay, re-seated to fill the
           workspace. The seat is the workspace's inspected participant
           (LB/RB switch it globally — rail, header and table move as one);
           B folds an open category first, then returns to the summary. -->
      <div v-else-if="infoModeState.route === 'played'" key="played" class="con-info__playedhost" data-insp-slide>
        <ConsolePlayedOverlay ref="playedView"
                              embedded
                              :players="playerView.players"
                              :thisPlayerColor="playerView.thisPlayer.color"
                              :forcedColor="viewed.color"
                              :automa="botAutoma"
                              @close="closePlayedRoute" />
      </div>

      <!-- ── «ПОБЕДНЫЕ ОЧКИ» — the SCORE EXPLORER: overview → category →
           card family → preview → fullscreen, ONE component for the whole
           vp subtree (the key is constant across its routes, so a level
           change is the explorer's own FLIP phrase — never an out-in
           blink between levels). -->
      <div v-else-if="isVpRouteUp" key="vp" class="con-info__vpxhost" data-insp-slide>
        <ConsoleScoreExplorer ref="scoreView" :playerView="playerView" />
      </div>

      <!-- ── «ДОП. РЕСУРСЫ» — the EXTRAS EXPLORER: the rail satellite is
           the TYPE NAVIGATION (persistent shell chrome — it never moves),
           this zone carries the selected type's content (hero + the card
           gallery + the fact strip). One component, two honest fills
           (human cards / the bot's real pools). -->
      <div v-else-if="infoModeState.route === 'extras'" key="extras" class="con-info__exrhost" data-insp-slide>
        <ConsoleExtrasExplorer ref="extrasView" :playerView="playerView" />
      </div>

      <!-- ── «КАМПАНИЯ» — the full in-game campaign overview: the route
           dominates, participants read second, results/legacy unfold as
           nested layers of the same surface. Read-only by construction. -->
      <div v-else-if="infoModeState.route === 'campaign'" key="campaign" class="con-info__cmphost" data-insp-slide>
        <ConsoleCampaignOverview ref="campaignView" :playerView="playerView" :viewedColor="viewed.color" />
      </div>

      <!-- ── «ДЕЙСТВИЯ» (human) ─────────────────────────────────────────── -->
      <div v-else-if="infoModeState.route === 'actions'" key="actions" class="con-info__scroll con-info__detail-scroll" data-insp-slide>
        <div v-if="actionRows.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No action cards') }}</div>
        <div v-for="row in actionRows" :key="row.name" class="con-info__acrow" :class="{'con-info__acrow--ok': row.available}">
          <span class="con-info__acrow-state" aria-hidden="true">{{ row.available ? '✓' : '·' }}</span>
          <span class="con-info__acrow-name">{{ $t(row.name) }}</span>
          <span v-if="row.available" class="con-info__acrow-badge">{{ $t('Available now') }}</span>
          <span v-else-if="row.reason !== ''" class="con-info__acrow-reason">{{ row.reason }}</span>
        </div>
        <div v-if="!isSelf" class="con-info__note">{{ $t('Opponent state is read-only') }}</div>
      </div>

      <!-- ── «ЭФФЕКТЫ» (human) ──────────────────────────────────────────── -->
      <div v-else-if="infoModeState.route === 'effects'" key="effects" class="con-info__scroll con-info__detail-scroll" data-insp-slide>
        <div v-if="effectGroups.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No passive effects') }}</div>
        <div class="con-info__effects">
          <EffectBlock v-for="g in effectGroups" :key="g.key" :group="g" :card="tableauCard(g.cardName)" />
        </div>
      </div>

      <!-- ── «ЭКРАН БОТА» и его вложенные маршруты — the bot's internals
           hub (decks, piles, storage rules, conversion, difficulty; the
           printed board and the bonus piles are one A deeper). -->
      <div v-else-if="isBotRoute && botAutoma !== undefined" :key="'bot-' + infoModeState.route" class="con-info__scroll con-info__detail-scroll" data-insp-slide>
        <ConsoleMarsBotSections
          :mode="botSectionMode"
          :bot="viewed"
          :automa="botAutoma"
          :ctx="botCardContext"
          :focus="infoModeState.botScreenFocus"
          :megacredits="viewed.megacredits" />
      </div>

      </transition>

      <!-- The command contract publishes to the shell's ONE bottom command
           bar via consolePanelUi (CONSOLE_TV_PREMIUM_PLAN §3.2) — the
           footCommands watch below; no panel-local hint row. -->
    </div>
  </div>
</template>

<script lang="ts">
/**
 * THE INFORMATION WORKSPACE (Y) — the console-native read-only participant
 * dossier: «информация не скрыта — Y, посмотрел, вернулся ровно туда же».
 *
 * ARCHITECTURE (info-panel rework): the panel speaks the workspace language
 * (ConsoleWsHead crumb, semantic routes, one command bar contract) while
 * staying an independent OVERLAY layer — it never enters the workspace
 * stack, so it can open over any surface and hand it back untouched.
 *
 *  · ROUTES — `infoRoute.ts`: a semantic tree (summary → details →
 *    botScreen → botBoard/botBonus) with a capability table. LB/RB keeps
 *    the route; an inapplicable one presents the FALLBACK, never a reset.
 *  · SCORE — `liveScoreModel.ts`: the SAME category tables the final
 *    scoring ceremony uses (order, keys, `.con-eg-cat--*` colours, the bot
 *    normalisation), so live VP and the finale are one system.
 *  · PARITY — one summary layout for every participant; the left rail is
 *    the mode's summary half (economy + the shared tag matrix).
 *
 * All data comes from PUBLIC models (PublicPlayerModel + MarsBotModel + the
 * client card manifest). Input (routes, focus, player switching, scrolling)
 * is routed by ConsoleShell; this component is presentation over
 * infoModeState + the pure models. NEVER submits anything.
 */
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {buildPlayedZones} from '@/client/components/console/consolePlayedModel';
import {botTableauCards} from '@/client/components/marsbot/marsBotView';
import {consolePlayedUi} from '@/client/console/consolePlayedUi';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import {playerActionSourceCount, cardHasAction} from '@/client/components/actions/actionExtraction';
import {playerEffects, playerEffectGroups, EffectGroup} from '@/client/components/effects/effectExtraction';
import {buildLiveScoreModel, LiveScoreModel} from '@/client/console/liveScoreModel';
import {findPerformActionCard} from '@/client/console/turnIntents';
import {infoModeState} from '@/client/console/infoModeState';
import {
  infoRouteDepth,
  infoRoutePresentation,
  infoRouteStagePath,
  infoZoneFocusable,
  isVpRoute,
} from '@/client/console/infoRoute';
import {scoreStagePath} from '@/client/console/scoreExplorerModel';
import {scoreExplorerUi} from '@/client/console/consoleScoreExplorer';
import {extrasExplorerUi} from '@/client/console/consoleExtrasExplorer';
import {armScoreHandoff, disposeScoreHandoff, playScoreHandoff} from '@/client/console/scoreExplorerMotion';
import {
  descendCascade,
  descendCascadeOut,
  descendFold,
  descendRectOf,
  descendUnfold,
} from '@/client/console/surfaceMotion/workspaceDescend';
import ConsoleScoreExplorer from '@/client/components/console/ConsoleScoreExplorer.vue';
import ConsoleExtrasExplorer from '@/client/components/console/ConsoleExtrasExplorer.vue';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {mapLabelKey} from '@/client/components/create/premium/createGameMeta';
import {InfoExtrasChip, infoExtrasChips} from '@/client/console/infoExtrasChips';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import {MarsBotGuideContext} from '@/client/components/marsbot/marsBotGuide';
import {marsBotCorpDisplayName, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleMarsBotSections from '@/client/components/console/ConsoleMarsBotSections.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import EffectBlock from '@/client/components/effects/EffectBlock.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import ConsoleCampaignOverview from '@/client/components/console/campaign/ConsoleCampaignOverview.vue';
import {campaignOverviewUi, campaignStagePath} from '@/client/console/campaign/campaignOverviewUi';
import {campaignState, openCampaign, setCampaignViewerName} from '@/client/console/campaign/campaignState';
import {CampaignGameContract} from '@/common/campaign/CampaignGameContract';
import {TitleName} from '@/common/campaign/CampaignTypes';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {tpStatusLabel} from '@/client/console/campaign/campaignOverviewModel';

/** The played-summary rows follow the table's zone order + caption keys. */
const PLAYED_SUMMARY_LABEL: ReadonlyArray<{key: string, label: string}> = [
  {key: 'corporation', label: 'Corporation'},
  {key: 'prelude', label: 'Preludes'},
  {key: 'ceo', label: 'CEO'},
  {key: 'active', label: 'Active'},
  {key: 'automated', label: 'Automated'},
  {key: 'events', label: 'Events'},
];

export default defineComponent({
  name: 'ConsoleInfoMode',
  components: {ConsoleCampaignOverview, ConsoleMarsBotSections, ConsolePlayedOverlay, ConsoleScoreExplorer, ConsoleExtrasExplorer, ConsoleWsHead, EffectBlock, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
  },
  data() {
    return {
      infoModeState,
      /** The previous route's depth — signs the zone-swap direction
       *  (descend rises from below, B sinks back). */
      lastDepth: 0,
      /** The «Кампания» zone's rect, captured while the summary is still
       *  in the DOM (the out-in enter hook runs after it left) — the
       *  campaign overview unfolds from this box. */
      campaignZoneRect: undefined as {left: number, top: number, width: number, height: number} | undefined,
    };
  },
  computed: {
    viewed(): PublicPlayerModel {
      const color = this.infoModeState.playerColor;
      return this.playerView.players.find((p) => p.color === color) ?? this.playerView.thisPlayer;
    },
    isSelf(): boolean {
      return this.viewed.color === this.playerView.thisPlayer.color;
    },
    /** The viewed participant is the MarsBot seat. */
    viewedIsBot(): boolean {
      return this.viewed.isMarsBot === true;
    },
    viewedKind(): 'human' | 'bot' {
      return this.viewedIsBot && this.botAutoma !== undefined ? 'bot' : 'human';
    },
    viewedDisplayName(): string {
      return participantDisplayName(this.viewed);
    },
    botAutoma(): MarsBotModel | undefined {
      return this.playerView.game.automa;
    },
    botDifficultyLabel(): string {
      const automa = this.botAutoma;
      return automa !== undefined ? DIFFICULTY_LABEL[automa.difficulty] : '';
    },
    /** The expansion context — resolves bonus-card faces + guide sections for THIS game. */
    botCardContext(): MarsBotGuideContext {
      const expansions = this.playerView.game.gameOptions.expansions;
      return {venus: expansions.venus === true, colonies: expansions.colonies === true, deltaProject: expansions.deltaProject === true};
    },
    /** What the current route presents for the current participant —
     *  'summary' | 'content' | 'fallback' (the capability contract). */
    presentation(): 'summary' | 'content' | 'fallback' {
      if (this.infoModeState.route === 'summary') {
        return 'summary';
      }
      return infoRoutePresentation(this.infoModeState.route, this.viewedKind);
    },
    /** The whole vp subtree renders in ONE zone (key 'vp') — a level change
     *  is the explorer's own phrase, never an out-in swap. */
    isVpRouteUp(): boolean {
      return isVpRoute(this.infoModeState.route);
    },
    /** The crumb's stage phrase — depth 1 is one word, deeper the hosted-
     *  step phrase («ЭКРАН БОТА · ПЛАНШЕТ»). The vp subtree names its tail
     *  DYNAMICALLY (the selected category / family — `scoreStagePath`).
     *  Already translated (stageRaw). */
    stagePhrase(): string {
      if (this.infoModeState.route === 'campaign') {
        // The campaign overview names its own tail (its nested layers).
        return campaignStagePath().join(' · ');
      }
      const path = this.isVpRouteUp ?
        scoreStagePath(this.infoModeState.route, this.infoModeState.vpCategoryKey, this.infoModeState.vpCardsGroup) :
        infoRouteStagePath(this.infoModeState.route);
      return path.map((key) => translateText(key)).join(' · ');
    },
    // ── the «КАМПАНИЯ» zone (campaign missions only) ────────────────────
    campaignContract(): CampaignGameContract | undefined {
      return this.playerView.game.gameOptions.campaign;
    },
    /** The viewed participant's campaign seat (grants carry seat + color). */
    campaignViewedSeat(): number | undefined {
      return this.campaignContract?.grants.find((g) => g.color === this.viewed.color)?.seat;
    },
    campaignMissionText(): string {
      const contract = this.campaignContract;
      if (contract === undefined) {
        return '';
      }
      const frame = translateTextWithParams('${0} of ${1}', [String(contract.missionSlot + 1), String(contract.missionCount)]);
      // The mission's BOARD belongs in the frame line — «2 из 4 · Элизий».
      const board = campaignState.model?.missions[contract.missionSlot]?.board;
      return board !== undefined ? `${frame} · ${translateText(mapLabelKey(board))}` : frame;
    },
    campaignViewedTitles(): ReadonlyArray<{title: TitleName}> {
      const seat = this.campaignViewedSeat;
      const model = campaignState.model;
      if (seat === undefined || model === undefined) {
        return [];
      }
      return model.progression.titles.filter((t) => t.seat === seat).map((t) => ({title: t.title}));
    },
    campaignTpText(): string {
      const seat = this.campaignViewedSeat;
      const model = campaignState.model;
      if (seat === undefined || model === undefined) {
        return '…';
      }
      return translateTextWithParams('${0} TP', [String(model.progression.titlePoints[seat] ?? 0)]);
    },
    campaignTpNote(): string {
      return this.campaignContract?.final === true ?
        tpStatusLabel('included-now') : tpStatusLabel('accrues-final');
    },
    campaignCorpCount(): string {
      const seat = this.campaignViewedSeat;
      const contract = this.campaignContract;
      if (seat === undefined || contract === undefined) {
        return '—';
      }
      if (this.viewedIsBot) {
        return '1';
      }
      // The lineage entering this mission + the mission's own pick, read
      // from the LIVE tableau (public) — the same derivation the overview
      // uses.
      let count = 0;
      for (const c of this.viewed.tableau) {
        try {
          if (getCard(c.name)?.type === CardType.CORPORATION) {
            count++;
          }
        } catch (err) {
          // manifest gap — skip
        }
      }
      const lineage = contract.grants.find((g) => g.seat === seat)?.corporations.length ?? 0;
      return String(Math.max(count, lineage));
    },
    fallbackBody(): string {
      return this.viewedKind === 'bot' ?
        'This section exists only for human players' :
        'This section exists only for the bot';
    },
    isBotRoute(): boolean {
      const r = this.infoModeState.route;
      return r === 'botScreen' || r === 'botBoard' || r === 'botBonus';
    },
    botSectionMode(): 'botScreen' | 'botBoard' | 'botBonus' {
      const r = this.infoModeState.route;
      return r === 'botBoard' ? 'botBoard' : r === 'botBonus' ? 'botBonus' : 'botScreen';
    },
    isPassed(): boolean {
      return this.playerView.game.passedPlayers.includes(this.viewed.color);
    },
    /** EVERY corporation in the viewed tableau, in tableau order — a
     *  campaign lineage routinely holds several. */
    corpNames(): ReadonlyArray<string> {
      // The bot's tableau is empty — its corporation rides `automa.corporation`
      // (absent on legacy corpless saves) and resolves through the ONE resolver.
      if (this.viewedIsBot) {
        const corp = this.botAutoma?.corporation;
        return corp !== undefined ? [marsBotCorpDisplayName(corp.id)] : [];
      }
      const names: Array<string> = [];
      for (const c of this.viewed.tableau) {
        try {
          if (getCard(c.name)?.type === CardType.CORPORATION) {
            names.push(c.name);
          }
        } catch (err) {
          // manifest gap — skip
        }
      }
      return names;
    },
    corpName(): string {
      return this.corpNames[0] ?? '';
    },
    corpExtraCount(): number {
      return Math.max(0, this.corpNames.length - 1);
    },
    corpExtraText(): string {
      return translateTextWithParams('and ${0} more', [String(this.corpExtraCount)]);
    },
    // ── the LIVE SCORE (shared with the endgame's category system) ────────
    /** VP visibility: self always; the bot always (its state is open
     *  information — the server ships its real breakdown); opponents only
     *  when the game options allow. */
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
    /** The summary bar's positive segments (a penalty subtracts — it is
     *  stated in the legend, never drawn as a stripe). */
    vpBarSegments(): Array<{key: string, accent: string, widthPct: number}> {
      const positive = this.liveScore.positiveTotal;
      if (positive <= 0) {
        return [];
      }
      return this.liveScore.categories
        .filter((cat) => cat.value > 0)
        .map((cat) => ({
          key: cat.key,
          accent: cat.accent,
          widthPct: (cat.value / positive) * 100,
        }));
    },
    // ── the summary zones ─────────────────────────────────────────────────
    /**
     * The played-table SUMMARY: counts per printed zone through the SAME
     * grouping the «Разыграно» table uses. THE BOT'S CORPORATION COUNTS —
     * the table renders it in the corporation slot (parity: a human's
     * corporation is inside their tableau already), so the summary and the
     * X detail can never disagree.
     */
    playedSummary(): {total: number, rows: Array<{key: string, label: string, count: number}>} {
      const tableau = this.viewedIsBot && this.botAutoma !== undefined ?
        botTableauCards(this.botAutoma) : this.viewed.tableau;
      const zones = buildPlayedZones(tableau);
      const counts: Record<string, number> = {
        corporation: zones.corporations.length,
        prelude: zones.preludes.length,
        ceo: zones.ceos.length,
        active: zones.active.length,
        automated: zones.automated.length,
        events: zones.events.length,
      };
      if (this.viewedIsBot && this.botAutoma?.corporation !== undefined) {
        counts.corporation += 1;
      }
      const rows = PLAYED_SUMMARY_LABEL
        .map(({key, label}) => ({key, label, count: counts[key] ?? 0}))
        .filter((r) => r.count > 0);
      return {total: rows.reduce((n, r) => n + r.count, 0), rows};
    },
    /* («КАРТЫ» — the old shared card-potential readout — is GONE: the HAND
       DOCK is the one physical representation of the inspected seat's hand.
       «ДОП. РЕСУРСЫ» is GONE from the panel too — the RAIL SATELLITE beside
       the left rail is the zone's one physical body: the summary's leftmost
       ring stop and the extras screen's type navigation, pixel-anchored
       across the whole flow.) */
    actionsAvailable(): number {
      return this.viewed.availableBlueCardActionCount;
    },
    actionsTotal(): number {
      return playerActionSourceCount(this.viewed.tableau);
    },
    effectsCount(): number {
      return playerEffects(this.viewed.tableau).length;
    },
    discountCount(): number {
      return playerEffects(this.viewed.tableau).filter((e) => e.signature?.discount !== undefined).length;
    },
    effectGroups(): Array<EffectGroup> {
      return playerEffectGroups(this.viewed.tableau);
    },
    /** Actions detail rows — availability is server truth for SELF only. */
    actionRows(): Array<{name: CardName, available: boolean, reason: string}> {
      const availableNames = this.isSelf ?
        new Set((findPerformActionCard(this.playerView.waitingFor)?.model.cards ?? []).map((c) => c.name)) :
        new Set<CardName>();
      return this.viewed.tableau
        .filter((c) => {
          try {
            return cardHasAction(c.name);
          } catch (err) {
            return false;
          }
        })
        .map((c) => {
          const reason = this.isSelf ? c.actionReasons?.[0] : undefined;
          return {
            name: c.name,
            available: availableNames.has(c.name),
            reason: reason !== undefined ?
              translateTextWithParams(reason.message, (reason.params ?? []).map(String)) : '',
          };
        });
    },
    /** The live command contract — published to the shell's ONE bottom
     *  command bar through consolePanelUi (the footCommands watch below). */
    footCommands(): Array<ConsoleCommand> {
      const route = this.infoModeState.route;
      // The embedded «Разыграно» grammar — honest to the table's live
      // mirrors (consolePlayedUi), same verbs as the board-home overlay.
      if (route === 'played' && this.presentation === 'content') {
        if (consolePlayedUi.categoryBusy) {
          return [{control: 'back', label: 'Back'}];
        }
        if (consolePlayedUi.categoryOpen) {
          return [
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: 'Back'},
            {control: 'inspect', label: 'Close', priority: 0},
          ];
        }
        return [
          {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
          {control: 'confirm', label: 'Open', enabled: consolePlayedUi.focusCategory !== ''},
          {control: 'back', label: 'To overview'},
          {control: 'inspect', label: 'Close', priority: 0},
        ];
      }
      // The SCORE EXPLORER owns its own command contract (focus-honest
      // hints — «X Осмотреть» only over a previewable row). One publisher
      // stays: this computed returns the explorer's list verbatim.
      if (isVpRoute(route) && scoreExplorerUi.barCommands !== undefined) {
        return [...scoreExplorerUi.barCommands];
      }
      // …and so does the EXTRAS EXPLORER (the satellite + gallery screen).
      if (route === 'extras' && extrasExplorerUi.barCommands !== undefined) {
        return [...extrasExplorerUi.barCommands];
      }
      // …and the CAMPAIGN OVERVIEW (its nested layers change the verbs).
      if (route === 'campaign' && campaignOverviewUi.barCommands !== undefined) {
        return [
          {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
          ...campaignOverviewUi.barCommands,
          {control: 'inspect', label: 'Close', priority: 0},
        ];
      }
      const cmds: Array<ConsoleCommand> = [
        {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
      ];
      if (route === 'summary') {
        // ONE navigation model: the ring focuses, A opens. The hint names
        // the FOCUSED zone (the dedicated per-block buttons are gone — this
        // is the one place the press's meaning is spelled out). On the
        // satellite the hint names the FOCUSED CHIP's resource type —
        // «Открыть: астероиды», never a generic group word.
        const focusedChip = this.focusedExtrasChip;
        if (this.infoModeState.summaryFocus === 'extras' && focusedChip !== undefined) {
          cmds.push({control: 'confirm', label: 'Open: ${0}', labelParams: [translateText(focusedChip.label)]});
        } else if (this.summaryFocusEnterable && this.summaryFocusTitle !== '') {
          cmds.push({control: 'confirm', label: 'Open: ${0}', labelParams: [translateText(this.summaryFocusTitle)]});
        } else {
          cmds.push({control: 'confirm', label: 'Open', enabled: false});
        }
      } else if (route === 'botScreen' && this.presentation === 'content') {
        cmds.push({control: 'confirm', label: 'Open'});
        cmds.push({control: 'back', label: 'To overview'});
      } else if (infoRouteDepth(route) >= 2) {
        cmds.push({control: 'back', label: 'Back'});
      } else {
        cmds.push({control: 'back', label: 'To overview'});
      }
      cmds.push({control: 'inspect', label: 'Close', priority: 0});
      return cmds;
    },
    /** The focused summary zone's display title — the contextual half of
     *  the bar's «A Открыть: …» hint. */
    summaryFocusTitle(): string {
      switch (this.infoModeState.summaryFocus) {
      case 'extras': return 'Extra resources';
      case 'vp': return 'Victory Points';
      case 'played': return 'Played cards';
      case 'actions': return 'Actions';
      case 'effects': return 'Effects';
      case 'campaign': return 'Campaign';
      case 'botdoor': return 'MarsBot screen';
      default: return '';
      }
    },
    /** May A enter the currently focused summary zone? */
    summaryFocusEnterable(): boolean {
      return infoZoneFocusable(this.infoModeState.summaryFocus, this.viewedKind, {campaign: this.campaignContract !== undefined});
    },
    /** The inspected seat's satellite chips (same derivation as the rail). */
    extrasChips(): ReadonlyArray<InfoExtrasChip> {
      return infoExtrasChips(this.viewed, this.viewedIsBot ? this.botAutoma : undefined);
    },
    /** The chip the summary ring stands on (clamped — the composition can
     *  shrink under the cursor on a seat switch). */
    focusedExtrasChip(): InfoExtrasChip | undefined {
      const chips = this.extrasChips;
      if (chips.length === 0) {
        return undefined;
      }
      return chips[Math.min(this.infoModeState.extrasCursor, chips.length - 1)];
    },
  },
  watch: {
    /** Warm the extras gallery's art for the NEW seat — the biggest webp
     *  decode on the panel, and the one surface where a late-arriving face
     *  is a visible defect (the 4K faces decode in hundreds of ms). */
    'infoModeState.playerColor'(): void {
      this.warmExtrasArt();
    },
    /** Publish the CONTEXTUAL command contract to the shell's ONE bottom
     *  command bar (consolePanelUi) — hints live only there, never in a
     *  panel-local footer (CONSOLE_TV_PREMIUM_PLAN §3.2). */
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setPanelCommands('infoMode', cmds);
      },
    },
  },
  mounted() {
    this.warmExtrasArt();
    // Campaign missions: prefetch the campaign document at panel open, so
    // the «Кампания» zone fills its personal half and the full overview
    // opens with its data already standing (no intermediate empty page).
    const contract = this.campaignContract;
    if (contract !== undefined) {
      setCampaignViewerName(this.playerView.thisPlayer.name);
      void openCampaign(contract.campaignId);
    }
  },
  beforeUnmount() {
    clearPanelCommands('infoMode');
    disposeScoreHandoff();
  },
  methods: {
    tableauCard(name: CardName): CardModel | undefined {
      return this.viewed.tableau.find((c) => c.name === name);
    },
    /** Pre-decode the resource HOLDERS' premium art at panel open — the
     *  extras gallery then enters with its faces already warm. */
    warmExtrasArt(): void {
      const holders = this.viewed.tableau
        .filter((c) => {
          try {
            return getCard(c.name)?.resourceType !== undefined;
          } catch (err) {
            return false;
          }
        })
        .map((c) => c.name);
      if (holders.length > 0) {
        preloadPremiumCardArt(holders);
      }
    },
    /** The focus-ring state of a summary zone (ring only where A can go). */
    zoneStateClass(zone: string): Record<string, boolean> {
      const focusable = infoZoneFocusable(zone as never, this.viewedKind, {campaign: this.campaignContract !== undefined});
      return {
        'con-info__zone--focusable': focusable,
        'con-info__zone--focused': focusable && this.infoModeState.summaryFocus === zone,
      };
    },
    titleArtUrl,
    titleLabel(title: TitleName): string {
      return TITLE_LABEL[title];
    },
    /** The embedded table's own close event (B at table level). */
    closePlayedRoute(): void {
      this.infoModeState.route = 'summary';
      this.infoModeState.summaryFocus = 'played';
    },
    /** The shell forwards the pad to the embedded «Разыграно» table while
     *  the played route is up (LB/RB and Y are handled globally first). */
    handlePlayedIntent(intent: GamepadIntent): void {
      (this.$refs.playedView as {handleIntent?: (i: GamepadIntent) => void} | undefined)?.handleIntent?.(intent);
    },
    /** …and to the score explorer while a vp route is up (same contract). */
    handleScoreIntent(intent: GamepadIntent): void {
      (this.$refs.scoreView as {handleIntent?: (i: GamepadIntent) => void} | undefined)?.handleIntent?.(intent);
    },
    /** …and to the extras explorer while the extras route is up. */
    handleExtrasIntent(intent: GamepadIntent): void {
      (this.$refs.extrasView as {handleIntent?: (i: GamepadIntent) => void} | undefined)?.handleIntent?.(intent);
    },
    /** …and to the campaign overview while the campaign route is up.
     *  Returns false when the overview did not consume it (B at its base
     *  layer — the shell then walks the route tree back to the summary). */
    handleCampaignIntent(intent: GamepadIntent): boolean {
      return (this.$refs.campaignView as {handleIntent?: (i: GamepadIntent) => boolean} | undefined)?.handleIntent?.(intent) === true;
    },
    /** A satellite cell press routed by the shell (mouse/touch): select
     *  the type inside the live explorer. */
    selectExtrasType(key: string, index: number): void {
      (this.$refs.extrasView as {selectType?: (k: string, i: number) => void} | undefined)?.selectType?.(key, index);
    },
    /** B consumes the explorer's MA inspection before walking the tree. */
    consumeScoreBack(): boolean {
      return (this.$refs.scoreView as {consumeScoreBack?: () => boolean} | undefined)?.consumeScoreBack?.() === true;
    },
    // ── the content-zone swap beat (route changes) ──────────────────────
    // Direction follows DEPTH: descending rises from below (the workspace
    // «one level deeper» phrase), B sinks the leaving zone back down. A
    // same-depth swap (fallback ⇄ content on a seat switch) keeps the calm
    // vertical grammar with the descend sign.
    detailZoneEnter(el: Element, done: () => void): void {
      if (consoleReducedMotionActive()) {
        gsap.set(el, {clearProps: 'transform,opacity'});
        // A SYNCHRONOUS done inside an out-in hook wedges the swap: Vue is
        // still inside the leave/enter patch when the callback fires, and
        // the deferred insertion of the incoming zone never runs (measured:
        // the explorer stayed mounted at the summary route). One microtask
        // of distance is the whole fix — never rAF (headless starves it).
        void Promise.resolve().then(done);
        return;
      }
      // The SCORE HANDOFF: when the leaving zone armed the shared elements
      // (summary → explorer, or explorer → summary on B), the total and the
      // bar FLY between the zones while the categories unfold/cascade —
      // this replaces the plain fade for exactly this pair of zones.
      const host = el as HTMLElement;
      const cascade = Array.from(host.querySelectorAll<HTMLElement>('.con-vpx__tile, .con-infovp__cat'));
      if (playScoreHandoff(host, cascade, done)) {
        this.lastDepth = infoRouteDepth(this.infoModeState.route);
        return;
      }
      // THE EXTRAS ENTRY: the content UNFOLDS OUT OF the satellite column —
      // the very object the player pressed (which itself never moves: it is
      // shell chrome, the pixel-anchored half of this screen). The satellite
      // is alive on both sides of the swap, so no proxy handoff is needed —
      // the continuity IS the column.
      if (host.classList.contains('con-info__exrhost')) {
        this.lastDepth = infoRouteDepth(this.infoModeState.route);
        const satRect = descendRectOf(document.querySelector<HTMLElement>('.con-res-aux'));
        const tl = gsap.timeline({onComplete: done});
        if (!descendUnfold(tl, host, satRect, motionMs(280) / 1000, 0)) {
          tl.fromTo(host, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(160) / 1000, clearProps: 'opacity,visibility'}, 0);
        }
        descendCascade(tl, this.extrasRows(host), motionMs(175) / 1000, motionMs(140) / 1000, 0.03);
        return;
      }
      // THE CAMPAIGN ENTRY: the overview UNFOLDS OUT OF the «Кампания»
      // zone the player pressed (its rect is measured while the summary is
      // still leaving). The overview's own choreography — mission cards
      // surfacing in place, each board's real geometry materializing, the
      // route line drawing, the seats joining — is CSS inside the
      // component, so the unfold only opens the room; one motion, phases
      // overlapping, never a ceremony that replays on seat switches or
      // level returns (those never remount this branch).
      if (host.classList.contains('con-info__cmphost')) {
        this.lastDepth = infoRouteDepth(this.infoModeState.route);
        const tl = gsap.timeline({onComplete: done});
        if (!descendUnfold(tl, host, this.campaignZoneRect, motionMs(300) / 1000, 0)) {
          tl.fromTo(host, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(160) / 1000, clearProps: 'opacity,visibility'}, 0);
        }
        return;
      }
      const depth = infoRouteDepth(this.infoModeState.route);
      const rising = depth >= this.lastDepth;
      this.lastDepth = depth;
      gsap.fromTo(el,
        {opacity: 0, y: (rising ? 10 : -8) * conUiScale()},
        {opacity: 1, y: 0, duration: motionMs(180) / 1000, ease: 'power2.out', clearProps: 'transform,opacity', onComplete: done});
    },
    detailZoneLeave(el: Element, done: () => void): void {
      if (consoleReducedMotionActive()) {
        void Promise.resolve().then(done); // see detailZoneEnter — never sync
        return;
      }
      // Arm the shared-element handoff on the two zones that exchange the
      // total + bar: the summary leaving FOR the explorer, and the explorer
      // leaving BACK to the summary. The proxies bridge the out-in gap, so
      // the total never misses a frame.
      const to = this.infoModeState.route;
      const host = el as HTMLElement;
      const summaryToVp = host.classList.contains('con-info__layout') && isVpRoute(to);
      const vpToSummary = host.classList.contains('con-info__vpxhost') && to === 'summary';
      if (summaryToVp || vpToSummary) {
        armScoreHandoff(host);
      }
      // Capture the «Кампания» zone's box before the summary leaves — the
      // campaign overview's enter unfolds out of it (measuring in the enter
      // hook would read a detached node).
      if (host.classList.contains('con-info__layout') && to === 'campaign') {
        this.campaignZoneRect = descendRectOf(host.querySelector<HTMLElement>('[data-zone="campaign"]'));
      }
      // THE CAMPAIGN EXIT (B): the overview FOLDS BACK INTO the «Кампания»
      // zone's box (the entry's reverse — the zone itself is not in the DOM
      // yet, but its geometry is stable, so the captured rect is honest).
      if (host.classList.contains('con-info__cmphost')) {
        const tl = gsap.timeline({onComplete: done});
        if (!descendFold(tl, host, this.campaignZoneRect, motionMs(240) / 1000, 0)) {
          tl.to(host, {autoAlpha: 0, duration: motionMs(120) / 1000}, 0);
        }
        return;
      }
      // THE EXTRAS EXIT (B): the content FOLDS BACK INTO the satellite
      // column it grew out of — the reverse of the entry phrase, same
      // anchor, while the summary rises behind it.
      if (host.classList.contains('con-info__exrhost')) {
        const satRect = descendRectOf(document.querySelector<HTMLElement>('.con-res-aux'));
        const tl = gsap.timeline({onComplete: done});
        descendCascadeOut(tl, this.extrasRows(host), motionMs(90) / 1000, 0);
        if (!descendFold(tl, host, satRect, motionMs(230) / 1000, motionMs(30) / 1000)) {
          tl.to(host, {autoAlpha: 0, duration: motionMs(120) / 1000}, 0);
        }
        return;
      }
      const depth = infoRouteDepth(to);
      const rising = depth >= this.lastDepth;
      gsap.to(el, {opacity: 0, y: (rising ? -6 : 5) * conUiScale(), duration: motionMs(95) / 1000, ease: 'power1.in', onComplete: done});
    },
    detailZoneCancelled(el: Element): void {
      gsap.killTweensOf(el);
      gsap.set(el, {clearProps: 'transform,opacity,clipPath,visibility'});
      disposeScoreHandoff();
    },
    /** The extras screen's cascade rows (entry/exit choreography). */
    extrasRows(host: HTMLElement): Array<HTMLElement> {
      return Array.from(host.querySelectorAll<HTMLElement>(
        '.con-exr__hero, .con-exr__slot, .con-exr__detail, .con-exr__botpool, .con-exr__botnote, .con-exr__void'));
    },
  },
});
</script>
