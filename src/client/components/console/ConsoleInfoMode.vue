<template>
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
            <!-- Another seat is a READ: the head says so once, in words and by shape (a hollow dashed chip — never a
                 tint alone), so no zone below needs to repeat it (TR60 2.В). -->
            <span v-if="!isSelf" class="con-info__chip con-info__chip--readonly" data-info-readonly>{{ $t('Opponent state is read-only') }}</span>
            <!-- The bot with a corporation wears it as its primary identity,
                 difficulty second: «CrediCor · Обычный». A multi-corporation
                 human (campaign lineage) NAMES the count — a single name must
                 never read as the whole composition. -->
            <span v-if="corpName !== ''" class="con-info__corp" :class="{'con-info__corp--bot': viewedIsBot}">{{ $t(corpName) }}<template v-if="corpExtraCount > 0"> · {{ corpExtraText }}</template><template v-if="viewedIsBot"> · {{ $t(botDifficultyLabel) }}</template></span>
            <span v-else-if="viewedIsBot" class="con-info__corp con-info__corp--bot">{{ $t(botDifficultyLabel) }}</span>
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

      <!-- ── THE PARTICIPANT DOSSIER (TR60 — «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА») — ONE canonical layout for EVERY
           participant, over the whole opening, in TWO TIERS: the HEROES (the score — the screen's loudest thing — and
           the card history: the shared zones, at the same coordinates for a human and the bot) and the PLATES (the
           human's actions and effects or the bot's door, the Parliament, the campaign). Every zone shows its OBJECTS at
           the scene's scale — a face, an emblem, a token; a number is the object's badge — never label—number rows.
           The zones are a focus ring (`infoZoneNavigate` reads the tiers' own geometry): d-pad moves, A opens the
           focused zone's route, which unfolds OUT OF the zone's own rect (`detailZone*`). The satellite column (the
           «Доп. ресурсы» zone) is shell chrome left of all of it. -->
      <div v-if="presentation === 'summary'" key="summary" class="con-info__layout con-dossier" data-insp-slide data-dossier>
        <div class="con-dossier__tier con-dossier__tier--heroes">
          <!-- «ПОБЕДНЫЕ ОЧКИ» — the premium live score in the score cell's and the finale's language (liveScoreModel
               over the ceremony's own tables). A hidden score is a SEALED cell with what is public on the table. -->
          <section class="con-info__zone con-info__zone--vp con-dossier__zone con-dossier__zone--hero"
                   :class="zoneStateClass('vp')" data-zone="vp" data-dossier-hero>
            <h3 class="con-info__block-title">{{ $t('Victory Points') }}</h3>
            <ConsoleDossierScore v-if="vpVisible" :liveScore="liveScore" :medallions="dossierMedallions" :segments="vpBarSegments" />
            <ConsoleDossierSealed v-else :facts="sealedFacts" />
          </section>
          <!-- «РАЗЫГРАННЫЕ КАРТЫ» — the card story as the cards themselves (the played table's own grouping). What
               remains to play is NOT a panel: the HAND DOCK below IS the inspected seat's hand. -->
          <section class="con-info__zone con-info__zone--played con-dossier__zone"
                   :class="zoneStateClass('played')" data-zone="played">
            <h3 class="con-info__block-title">{{ $t('Played cards') }}<b v-if="cardHistory.total > 0" class="con-dossier__titlecount">{{ cardHistory.total }}</b></h3>
            <ConsoleDossierCards :history="cardHistory" :tableau="viewed.tableau" :botCorp="viewedIsBot ? botAutoma?.corporation : undefined" />
          </section>
        </div>

        <div class="con-dossier__tier con-dossier__tier--plates">
          <!-- The bot's door to its internals — it stands where a human's actions and effects stand. -->
          <section v-if="viewedIsBot" class="con-info__zone con-info__zone--botdoor con-dossier__zone"
                   :class="zoneStateClass('botdoor')" data-zone="botdoor">
            <h3 class="con-info__block-title">{{ $t('MarsBot screen') }}</h3>
            <!-- The door's PREVIEW, in the SAME grammar as a player's plates (the effects plate's medallions: a ringed
                 symbol, the count, the name) — flipping LB/RB between seats, the bot reads as one more player; its own
                 presentation (the decks as piles, the printed board, the rules beside their objects) lives INSIDE the
                 door. The decks the algorithm plays from, with their public counts, and the one line of what is inside. -->
            <div class="con-deffs con-deffs--bot" data-dossier-door>
              <div class="con-deffs__families">
                <div v-for="pile in botPiles" :key="pile.key" class="con-deff" :class="'con-deff--bot-' + pile.key" :data-dossier-pile="pile.key">
                  <span class="con-deff__disc" aria-hidden="true"><span class="con-deff__glyph">{{ pile.glyph }}</span></span>
                  <b class="con-deff__count">{{ pile.count }}</b>
                  <span class="con-deff__label">{{ $t(pile.label) }}</span>
                </div>
              </div>
              <div class="con-deffs__note">{{ $t('Decks, tracks, storage rules and the printed board') }}</div>
            </div>
          </section>

          <section v-if="!viewedIsBot" class="con-info__zone con-info__zone--actions con-dossier__zone"
                   :class="zoneStateClass('actions')" data-zone="actions">
            <h3 class="con-info__block-title">{{ $t('Actions') }}</h3>
            <ConsoleDossierActions :tiles="dossierActions" :max="8" :columns="4" />
          </section>

          <!-- «ЭФФЕКТЫ» — counted PER EFFECT in the explorer's families (+ what is armed for the next card, TR49). -->
          <section v-if="!viewedIsBot" class="con-info__zone con-info__zone--effects con-dossier__zone"
                   :class="zoneStateClass('effects')" data-zone="effects">
            <h3 class="con-info__block-title">{{ $t('Effects') }}</h3>
            <ConsoleDossierEffects :families="dossierEffects" :cards="effectCardNames" :note="effectsZoneNote" />
          </section>

          <!-- «ПАРЛАМЕНТ» — a parliament game only: influence, the career ladder, the delegates as tokens. -->
          <section v-if="parliamentReading !== undefined" class="con-info__zone con-info__zone--parliament con-dossier__zone"
                   :class="zoneStateClass('parliament')" data-zone="parliament">
            <h3 class="con-info__block-title">{{ $t('Parliament') }}</h3>
            <ConsoleDossierParliament :reading="parliamentReading" :color="viewed.color" />
          </section>

          <!-- «КАМПАНИЯ» — campaign missions only: the mission frame (with its board), the seat's titles + TP as ONE
               statement with the scoring semantics AT the value, the composition count. -->
          <section v-if="campaignContract !== undefined" class="con-info__zone con-info__zone--campaign con-dossier__zone"
                   :class="zoneStateClass('campaign')" data-zone="campaign">
            <h3 class="con-info__block-title">{{ $t('Campaign') }}</h3>
            <ConsoleDossierCampaign :missionSlot="campaignContract.missionSlot" :missionCount="campaignContract.missionCount"
                                    :board="campaignBoard" :missionText="campaignMissionText"
                                    :titles="campaignViewedTitles.map((t) => ({art: titleArtUrl(t.title), label: $t(titleLabel(t.title))}))"
                                    :tpText="campaignTpText" :tpNote="campaignTpNote" :corpCount="campaignCorpCount"
                                    :tenders="campaignViewedTenders" />
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
      <div v-else-if="infoModeState.route === 'played'" key="played" class="con-info__playedhost" data-info-zone="played" data-insp-slide>
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

      <!-- ── «ПАРЛАМЕНТ» — ONE seat's whole standing (`seatParliamentReading`):
           what its influence is made of, the Agenda, its delegates, and what
           every resolution on the table would pay IT. -->
      <div v-else-if="infoModeState.route === 'parliament'" key="parliament" class="con-info__scroll con-info__detail-scroll" data-info-zone="parliament" data-insp-slide>
        <ConsoleInfoParliament v-if="parliamentReading !== undefined" :reading="parliamentReading" />
      </div>

      <!-- ── «КАМПАНИЯ» — the full in-game campaign overview: the route
           dominates, participants read second, results/legacy unfold as
           nested layers of the same surface. Read-only by construction. -->
      <div v-else-if="infoModeState.route === 'campaign'" key="campaign" class="con-info__cmphost" data-info-zone="campaign" data-insp-slide>
        <ConsoleCampaignOverview ref="campaignView" :playerView="playerView" :viewedColor="viewed.color" />
      </div>

      <!-- ── «ДЕЙСТВИЯ» (human) ─────────────────────────────────────────── -->
      <!-- ── «ДЕЙСТВИЯ» — the seat's actions as the «Действия карт» TILES themselves (one component, two hosts —
           TR60, decision 6a), read-only, in pages; X opens a card's face. -->
      <div v-else-if="infoModeState.route === 'actions'" key="actions" class="con-info__dgalhost" data-info-zone="actions" data-insp-slide>
        <ConsoleInfoActionGallery ref="actionsView" :playerView="playerView" :player="viewed" :isSelf="isSelf" />
      </div>

      <!-- ── «ЭФФЕКТЫ» — the EFFECTS EXPLORER: the card-actions browse
           language read-only (dossier column + per-effect tile grid) with
           the in-explorer detail layer (hero card + printed rule + the
           «За партию» stats). One component; its detail is a LAYER, so a
           level change is the explorer's own descend phrase. -->
      <div v-else-if="infoModeState.route === 'effects'" key="effects" class="con-info__efxhost" data-info-zone="effects" data-insp-slide>
        <!-- TR49 class: what the seat has ARMED for its next card (the public model — a rival's too). -->
        <ConsoleArmedEffectsSection :player="viewed" />
        <!-- Turmoil Redux «один фреймворк»: the PARLIAMENT's standing effects this seat holds (the law, the ruling
             party, every party held by a road of its own) are GROUPS OF THE SAME GRID — focusable, faceted, counted,
             X-inspectable — with the party's badge; the meta line reads WHY the seat holds each. -->
        <ConsoleEffectsExplorer ref="effectsView"
                                :cards="viewed.tableau"
                                :color="viewed.color"
                                :stats="effectsStats"
                                :politicalEntries="effectsPolitical" />
      </div>

      <!-- ── «ЭКРАН БОТА» и его вложенные маршруты — the bot's internals
           hub (decks, piles, storage rules, conversion, difficulty; the
           printed board and the bonus piles are one A deeper). -->
      <div v-else-if="isBotRoute && botAutoma !== undefined" :key="'bot-' + infoModeState.route" class="con-info__scroll con-info__detail-scroll" :data-info-zone="infoModeState.route === 'botScreen' ? 'botdoor' : undefined" data-insp-slide>
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

<script setup vapor lang="ts">
/*
 * THE INFORMATION WORKSPACE (Y) — an inspect-only OVERLAY workspace: it
 *       opens OVER whatever surface the player is on (board, any workspace, a
 *       minimized prompt), never touches the workspace stack, and closing
 *       restores the exact captured context (infoModeState.snapshot). The root
 *       is an ABSOLUTE child of `.con-main` filling everything RIGHT of the
 *       left resource rail; the rail is the mode's SUMMARY half (ConsoleShell
 *       overrides its player context to the inspected participant).
 *       data-motion-*: the surface-motion director materializes the frame from
 *       the rail seam (open) and returns it there (dismiss); the OWN full dim
 *       STAYS — the workspace opens OVER arbitrary band surfaces (z 11560,
 *       above the shade; the rail rides at 11561, crisp above the dim).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

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
import {computed, markRaw, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {gsap} from 'gsap';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {motionAfter} from '@/client/console/session/sessionWaits';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {buildPlayedZones} from '@/client/components/console/consolePlayedModel';
import {botTableauCards} from '@/client/components/marsbot/marsBotView';
import {consolePlayedUi} from '@/client/console/consolePlayedUi';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import {cardHasAction} from '@/client/components/actions/actionExtraction';
import {PoliticalEffectEntry, playerEffects} from '@/client/components/effects/effectExtraction';
import {politicalSources} from '@/client/console/parliament/politicalSources';
import {politicalEffectEntries} from '@/client/console/parliament/politicalEffects';
import {dossierPoliticalActions, parliamentActionSources} from '@/client/console/parliament/parliamentActionSources';
import {EffectsZoneCounts, effectsZoneCounts, effectsZoneStatsLine} from '@/client/console/effectsExplorerModel';
import {effectStatsFor, effectStatsVersion, ensureEffectStats} from '@/client/console/effectStatsStore';
import {effectsExplorerUi, effectsStagePath} from '@/client/console/consoleEffectsExplorer';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {buildLiveScoreModel, LiveScoreModel} from '@/client/console/liveScoreModel';
import {infoModeState} from '@/client/console/infoModeState';
import {
  infoRouteDepth,
  infoRoutePresentation,
  infoRouteStagePath,
  infoZoneFocusable,
  infoZoneForRoute,
  isVpRoute,
} from '@/client/console/infoRoute';
import {buildScoreOverview, maArtSlug, scoreStagePath} from '@/client/console/scoreExplorerModel';
import {
  DossierActionTile, dossierActionTiles, withPoliticalActionTiles, DossierCardHistory, dossierCardHistory, DossierEffectFamily, dossierEffectFamilies,
  DossierMedallion, dossierMedallions as dossierMedallionsOf, DossierSealedFacts, dossierSealedFacts,
} from '@/client/console/infoDossierModel';
import ConsoleDossierScore from '@/client/components/console/info/ConsoleDossierScore.vue';
import ConsoleDossierSealed from '@/client/components/console/info/ConsoleDossierSealed.vue';
import ConsoleDossierCards from '@/client/components/console/info/ConsoleDossierCards.vue';
import ConsoleDossierActions from '@/client/components/console/info/ConsoleDossierActions.vue';
import ConsoleDossierEffects from '@/client/components/console/info/ConsoleDossierEffects.vue';
import ConsoleDossierParliament from '@/client/components/console/info/ConsoleDossierParliament.vue';
import ConsoleInfoActionGallery from '@/client/components/console/info/ConsoleInfoActionGallery.vue';
import {infoActionsUi} from '@/client/console/infoActionsUi';
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
import ConsoleEffectsExplorer from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {seatRestricted} from '@/common/models/ParliamentModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import ConsoleArmedEffectsSection from '@/client/components/console/ConsoleArmedEffectsSection.vue';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {seatParliamentReadingOf, SeatParliamentReadingVm} from '@/client/console/parliament/seatParliamentReading';
import ConsoleInfoParliament from '@/client/components/console/ConsoleInfoParliament.vue';
import {mapLabelKey} from '@/client/components/create/premium/createGameMeta';
import {InfoExtrasChip, infoExtrasChips} from '@/client/console/infoExtrasChips';
import {marsBotExtrasContext} from '@/client/components/console/marsBotRailModel';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import {MarsBotGuideContext} from '@/client/components/marsbot/marsBotGuide';
import {marsBotCorpDisplayName, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleMarsBotSections from '@/client/components/console/ConsoleMarsBotSections.vue';
import ConsoleDossierCampaign from '@/client/components/console/info/ConsoleDossierCampaign.vue';
import {BoardName} from '@/common/boards/BoardName';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import ConsoleCampaignOverview from '@/client/components/console/campaign/ConsoleCampaignOverview.vue';
import {campaignOverviewUi, campaignStagePath} from '@/client/console/campaign/campaignOverviewUi';
import {campaignState, openCampaign, setCampaignViewerName} from '@/client/console/campaign/campaignState';
import {CampaignGameContract} from '@/common/campaign/CampaignGameContract';
import {TitleName} from '@/common/campaign/CampaignTypes';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {campaignRewardModeOf, seatTenderHoldings, TenderHoldingView} from '@/client/console/campaign/tenderHoldings';
import {tpStatusLabel} from '@/client/console/campaign/campaignOverviewModel';

/** How many faces a dossier pile shows — ONE, the newest, on top of the paper edges of the rest. */
const DOSSIER_FACES_PER_STACK = 1;

defineOptions({name: 'ConsoleInfoMode'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  myTurn: {type: Boolean, default: false},
});

const flow = useFlowScope('info-mode');
const playedView = useTemplateRef<{handleIntent?: (i: GamepadIntent) => void}>('playedView');
const scoreView = useTemplateRef<{handleIntent?: (i: GamepadIntent) => void} & {consumeScoreBack?: () => boolean}>('scoreView');
const extrasView = useTemplateRef<{handleIntent?: (i: GamepadIntent) => void} & {selectType?: (k: string, i: number) => void}>('extrasView');
const actionsView = useTemplateRef<{handleIntent?: (i: GamepadIntent) => void}>('actionsView');
const effectsView = useTemplateRef<{handleIntent?: (i: GamepadIntent) => void} & {consumeEffectsBack?: () => boolean}>('effectsView');
const campaignView = useTemplateRef<{handleIntent?: (i: GamepadIntent) => boolean}>('campaignView');
/** The previous route's depth — signs the zone-swap direction
 *  (descend rises from below, B sinks back). */
const lastDepth = ref(0);
/**
 * EVERY dossier zone's rect, captured while the summary is still in the DOM (the out-in enter hook runs
 * after it left) — the detail a zone opens UNFOLDS out of its zone's box, and B FOLDS back into it (TR60:
 * «зона раскрывается из плитки», every zone, never a rise from below). Plain (markRaw), never reactive.
 */
const zoneRects = markRaw(new Map<string, {left: number, top: number, width: number, height: number}>());
/** The zone a B is folding back into — the summary's entry keeps it standing while the rest compose. */
const returningZone = ref<string | undefined>(undefined);

const viewed = computed((): PublicPlayerModel => {
  const color = infoModeState.playerColor;
  return props.playerView.players.find((p) => p.color === color) ?? props.playerView.thisPlayer;
});
const isSelf = computed((): boolean => {
  return viewed.value.color === props.playerView.thisPlayer.color;
});
/** The viewed participant is the MarsBot seat. */
const viewedIsBot = computed((): boolean => {
  return viewed.value.isMarsBot === true;
});
const viewedKind = computed((): 'human' | 'bot' => {
  return viewedIsBot.value && botAutoma.value !== undefined ? 'bot' : 'human';
});
const viewedDisplayName = computed((): string => {
  return participantDisplayName(viewed.value);
});
const botAutoma = computed((): MarsBotModel | undefined => {
  return props.playerView.game.automa;
});
const botDifficultyLabel = computed((): string => {
  const automa = botAutoma.value;
  return automa !== undefined ? DIFFICULTY_LABEL[automa.difficulty] : '';
});
/** The expansion context — resolves bonus-card faces + guide sections for THIS game. */
const botCardContext = computed((): MarsBotGuideContext => {
  const expansions = props.playerView.game.gameOptions.expansions;
  // A random-set game's B14 face lists THIS game's awards (`MarsBotModel.competition` — the server's lines).
  const competition = props.playerView.game.automa?.competition;
  return {venus: expansions.venus === true, colonies: expansions.colonies === true, deltaProject: expansions.deltaProject === true,
    ...(competition !== undefined ? {competition} : {})};
});
/** What the current route presents for the current participant —
 *  'summary' | 'content' | 'fallback' (the capability contract). */
const presentation = computed((): 'summary' | 'content' | 'fallback' => {
  if (infoModeState.route === 'summary') {
    return 'summary';
  }
  return infoRoutePresentation(infoModeState.route, viewedKind.value);
});
/** The whole vp subtree renders in ONE zone (key 'vp') — a level change
 *  is the explorer's own phrase, never an out-in swap. */
const isVpRouteUp = computed((): boolean => {
  return isVpRoute(infoModeState.route);
});
/** The crumb's stage phrase — depth 1 is one word, deeper the hosted-
 *  step phrase («ЭКРАН БОТА · ПЛАНШЕТ»). The vp subtree names its tail
 *  DYNAMICALLY (the selected category / family — `scoreStagePath`).
 *  Already translated (stageRaw). */
const stagePhrase = computed((): string => {
  if (infoModeState.route === 'campaign') {
    // The campaign overview names its own tail (its nested layers).
    return campaignStagePath().join(' · ');
  }
  if (infoModeState.route === 'effects') {
    // The effects explorer names its tail dynamically (its detail layer
    // adds the card name — «ЭФФЕКТЫ · <КАРТА>», the tail only advances).
    return effectsStagePath().join(' · ');
  }
  const path = isVpRouteUp.value ?
    scoreStagePath(infoModeState.route, infoModeState.vpCategoryKey, infoModeState.vpCardsGroup) :
    infoRouteStagePath(infoModeState.route);
  // The embedded table's open CATEGORY is the route's own tail («РАЗЫГРАНО · АКТИВНЫЕ») — the category view
  // never titles itself (the host's crumb is the one place a stage is named).
  if (infoModeState.route === 'played' && consolePlayedUi.categoryOpen && consolePlayedUi.categoryLabel !== '') {
    return [...path, consolePlayedUi.categoryLabel].map((key) => translateText(key)).join(' · ');
  }
  return path.map((key) => translateText(key)).join(' · ');
});
// ── the «КАМПАНИЯ» zone (campaign missions only) ────────────────────
const campaignContract = computed((): CampaignGameContract | undefined => {
  return props.playerView.game.gameOptions.campaign;
});
/** The viewed participant's campaign seat (grants carry seat + color). */
const campaignViewedSeat = computed((): number | undefined => {
  return campaignContract.value?.grants.find((g) => g.color === viewed.value.color)?.seat;
});
const campaignMissionText = computed((): string => {
  const contract = campaignContract.value;
  if (contract === undefined) {
    return '';
  }
  const frame = translateTextWithParams('${0} of ${1}', [String(contract.missionSlot + 1), String(contract.missionCount)]);
  // The mission's BOARD belongs in the frame line — «2 из 4 · Элизий».
  const board = campaignState.model?.missions[contract.missionSlot]?.board;
  return board !== undefined ? `${frame} · ${translateText(mapLabelKey(board))}` : frame;
});
/** The mission's board — its miniature in the zone (absent while the campaign model loads). */
const campaignBoard = computed((): BoardName | undefined => {
  const contract = campaignContract.value;
  return contract === undefined ? undefined : campaignState.model?.missions[contract.missionSlot]?.board;
});
const campaignViewedTitles = computed((): ReadonlyArray<{title: TitleName}> => {
  const seat = campaignViewedSeat.value;
  const model = campaignState.model;
  if (seat === undefined || model === undefined) {
    return [];
  }
  return model.progression.titles.filter((t) => t.seat === seat).map((t) => ({title: t.title}));
});
const campaignTpText = computed((): string => {
  const seat = campaignViewedSeat.value;
  const model = campaignState.model;
  if (seat === undefined || model === undefined) {
    return '…';
  }
  return translateTextWithParams('${0} TP', [String(model.progression.titlePoints[seat] ?? 0)]);
});
const campaignTpNote = computed((): string => {
  if (campaignViewedTenders.value !== undefined) {
    return 'Tenders execute at the finale\'s start; an unexecuted one pays 3 M€';
  }
  return campaignContract.value?.final === true ?
    tpStatusLabel('included-now') : tpStatusLabel('accrues-final');
});
/** The «Тендеры» mode: the viewed seat's holdings off the campaign document; `undefined` on a titles campaign. */
const campaignViewedTenders = computed((): ReadonlyArray<TenderHoldingView> | undefined => {
  const seat = campaignViewedSeat.value;
  const model = campaignState.model;
  if (seat === undefined || model === undefined || campaignRewardModeOf(model) !== 'tenders') {
    return undefined;
  }
  return seatTenderHoldings(model, seat);
});
const campaignCorpCount = computed((): string => {
  const seat = campaignViewedSeat.value;
  const contract = campaignContract.value;
  if (seat === undefined || contract === undefined) {
    return '—';
  }
  if (viewedIsBot.value) {
    return '1';
  }
  // The lineage entering this mission + the mission's own pick, read
  // from the LIVE tableau (public) — the same derivation the overview
  // uses.
  let count = 0;
  for (const c of viewed.value.tableau) {
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
});
const fallbackBody = computed((): string => {
  return viewedKind.value === 'bot' ?
    'Nothing here for this player' :
    'This section exists only for the bot';
});
const isBotRoute = computed((): boolean => {
  const r = infoModeState.route;
  return r === 'botScreen' || r === 'botBoard' || r === 'botBonus';
});
const botSectionMode = computed((): 'botScreen' | 'botBoard' | 'botBonus' => {
  const r = infoModeState.route;
  return r === 'botBoard' ? 'botBoard' : r === 'botBonus' ? 'botBonus' : 'botScreen';
});
const isPassed = computed((): boolean => {
  return props.playerView.game.passedPlayers.includes(viewed.value.color);
});
/** EVERY corporation in the viewed tableau, in tableau order — a
 *  campaign lineage routinely holds several. */
const corpNames = computed((): ReadonlyArray<string> => {
  // The bot's tableau is empty — its corporation rides `automa.corporation`
  // (absent on legacy corpless saves) and resolves through the ONE resolver.
  if (viewedIsBot.value) {
    const corp = botAutoma.value?.corporation;
    // …and its campaign holdings are further corporations, counted like a player's lineage.
    return corp !== undefined ? [marsBotCorpDisplayName(corp.id), ...(botAutoma.value?.holdings ?? []).map((h) => marsBotCorpDisplayName(h.id))] : [];
  }
  const names: Array<string> = [];
  for (const c of viewed.value.tableau) {
    try {
      if (getCard(c.name)?.type === CardType.CORPORATION) {
        names.push(c.name);
      }
    } catch (err) {
      // manifest gap — skip
    }
  }
  return names;
});
const corpName = computed((): string => {
  return corpNames.value[0] ?? '';
});
const corpExtraCount = computed((): number => {
  return Math.max(0, corpNames.value.length - 1);
});
const corpExtraText = computed((): string => {
  return translateTextWithParams('and ${0} more', [String(corpExtraCount.value)]);
});
// ── the LIVE SCORE (shared with the endgame's category system) ────────
/** VP visibility: self always; the bot always (its state is open
 *  information — the server ships its real breakdown); opponents only
 *  when the game options allow. */
const vpVisible = computed((): boolean => {
  return isSelf.value || viewedIsBot.value ||
    props.playerView.game.gameOptions.showOtherPlayersVP === true;
});
const liveScore = computed((): LiveScoreModel => {
  const game = props.playerView.game;
  return buildLiveScoreModel(viewed.value.victoryPointsBreakdown, {
    isBot: viewedIsBot.value,
    hasMoon: game.moon !== undefined,
    hasPathfinders: game.pathfinders !== undefined,
    hasDelta: game.gameOptions.expansions.deltaProject === true,
    hasTitles: game.gameOptions.campaign?.final === true,
    hasParliament: game.parliament !== undefined,
  });
});
/** The summary bar's positive segments (a penalty subtracts — it is
 *  stated in the legend, never drawn as a stripe). */
const vpBarSegments = computed((): Array<{key: string, accent: string, widthPct: number}> => {
  const positive = liveScore.value.positiveTotal;
  if (positive <= 0) {
    return [];
  }
  return liveScore.value.categories
    .filter((cat) => cat.value > 0)
    .map((cat) => ({
      key: cat.key,
      accent: cat.accent,
      widthPct: (cat.value / positive) * 100,
    }));
});
// ── THE DOSSIER (TR60) — every object of the summary, from the models (`infoDossierModel`) ──────────────────
/** The score's medallions — the overview's tiles (the ceremony's order) with each category's own symbol. */
const dossierMedallions = computed((): ReadonlyArray<DossierMedallion> => {
  return dossierMedallionsOf(buildScoreOverview(liveScore.value, viewed.value.victoryPointsBreakdown, {isBot: viewedIsBot.value}));
});
/** A hidden score's SEALED cell: only what is public on the table — never a VP number (`vpVisible` said no). */
const sealedFacts = computed((): DossierSealedFacts => {
  const game = props.playerView.game;
  return dossierSealedFacts(viewed.value.terraformRating, viewed.value.color,
    (game.milestones ?? []).map((m) => ({name: m.name, color: m.color})),
    (game.awards ?? []).map((a) => ({name: a.name, color: a.color})),
    maArtSlug, viewedRatingVeto.value);
});
/** The VIEWED seat is under the rating veto (RX42) — the law's name; read off the server's live leaders. */
const viewedRatingVeto = computed((): {law: string} | undefined => {
  const enacted = props.playerView.game.parliament?.enacted;
  const veto = enacted?.trVeto;
  if (enacted === undefined || veto === undefined || !veto.leaders.some((l) => l.color === viewed.value.color)) {
    return undefined;
  }
  const seat = props.playerView.game.parliament?.players.find((p) => p.color === viewed.value.color);
  return seat !== undefined && !seatRestricted(seat) ? undefined : {law: getResolution(enacted.resolution)?.text.name ?? enacted.resolution};
});
/** Display names by colour — for the surfaces that name a seat in words. */
const playerNamesByColor = computed((): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const p of props.playerView.players) {
    out[p.color] = p.name;
  }
  return out;
});
/** The card story — the played table's own grouping (the bot's pile + its corporation, the parity). */
const cardHistory = computed((): DossierCardHistory => {
  const automa = viewedIsBot.value ? botAutoma.value : undefined;
  const tableau = automa !== undefined ? botTableauCards(automa) : viewed.value.tableau;
  return dossierCardHistory(buildPlayedZones(tableau), DOSSIER_FACES_PER_STACK, automa?.corporation !== undefined ? 1 : 0);
});
/** The action cards as tiles — the viewer's own with the server's reasons, another seat's by the public «used». */
const dossierActions = computed((): ReadonlyArray<DossierActionTile> => {
  const hasAction = (name: CardName) => {
    try {
      return cardHasAction(name);
    } catch (err) {
      return false;
    }
  };
  const cards = dossierActionTiles(viewed.value.tableau, hasAction, new Set(viewed.value.actionsThisGeneration ?? []), isSelf.value);
  // The Parliament's actions stand among the seat's actions like cards (the gallery behind the zone lists them too).
  const political = parliamentActionSources({
    parliament: props.playerView.game.parliament,
    color: viewed.value.color,
    viewerColor: props.playerView.thisPlayer?.color,
    waitingFor: isSelf.value ? props.playerView.waitingFor : undefined,
  });
  return withPoliticalActionTiles(cards, dossierPoliticalActions(political));
});
const dossierEffects = computed((): ReadonlyArray<DossierEffectFamily> => {
  return dossierEffectFamilies(effectsZone.value, armedCount.value);
});
/** The bot door's piles — the public counts of the decks the algorithm plays from (its room explains them). */
/** The bot door's medallions — the decks the algorithm plays from, each with a symbol that reads without colour. */
const botPiles = computed((): ReadonlyArray<{key: string, label: string, count: number, glyph: string}> => {
  const automa = botAutoma.value;
  if (automa === undefined) {
    return [];
  }
  return [
    {key: 'action', label: 'Action deck', count: automa.actionDeckSize, glyph: '▤'},
    {key: 'bonus', label: 'Bonus deck', count: automa.bonusDeckSize, glyph: '◈'},
    {key: 'discard', label: 'Bonus discard', count: automa.bonusDiscard.length, glyph: '↺'},
    {key: 'destroyed', label: 'Destroyed cards', count: automa.destroyedBonusCards.length, glyph: '✕'},
  ];
});
/** The cards that carry the seat's passive effects (tableau order, each once) — the effects plate's coins. */
const effectCardNames = computed((): ReadonlyArray<CardName> => {
  return Array.from(new Set(playerEffects(viewed.value.tableau).map((e) => e.cardName)));
});
// ── the summary zones ─────────────────────────────────────────────────
/* («КАРТЫ» — the old shared card-potential readout — is GONE: the HAND
   DOCK is the one physical representation of the inspected seat's hand.
   «ДОП. РЕСУРСЫ» is GONE from the panel too — the RAIL SATELLITE beside
   the left rail is the zone's one physical body: the summary's leftmost
   ring stop and the extras screen's type navigation, pixel-anchored
   across the whole flow.) */
/** The inspected seat's effect stats (undefined while on the wire — the
 *  zone line and the explorer's metas honestly claim nothing). */
const effectsStats = computed((): ReadonlyArray<EffectOverlayStat> | undefined => {
  return viewedIsBot.value ? undefined : effectStatsFor(viewed.value.color);
});
/** The stats cache's OWN key — the watcher below re-ensures on it, so
 *  the surface refetches on exactly the set the cache invalidates on. */
const effectsStatsKey = computed((): string => {
  return effectStatsVersion(props.playerView, viewed.value.color);
});
/** Per-EFFECT family counts for the zone (the old per-card «Активные /
 *  Скидки» pair — whose discount predicate was always true — is gone). */
/** The inspected seat's armed one-play effects (TR49 class — public). */
const armedCount = computed((): number => {
  return viewed.value.armedPlayEffects?.length ?? 0;
});
/** The Parliament's standing effects the inspected seat holds — groups of the explorer's grid, counted in the zone. */
const effectsPolitical = computed((): ReadonlyArray<PoliticalEffectEntry> => {
  const parliament = props.playerView.game.parliament;
  return politicalEffectEntries(politicalSources(parliament, viewed.value.color), {
    parliament,
    viewerColor: props.playerView.thisPlayer?.color,
    playerNames: playerNamesByColor.value,
  });
});
const effectsZone = computed((): EffectsZoneCounts => {
  // ONE count with the grid: a party's / the law's effect is an effect of this seat like a card's (the zone never lies).
  return effectsZoneCounts([...effectsPolitical.value, ...playerEffects(viewed.value.tableau)], viewed.value.tableau);
});
/** The zone's quiet whole-game line («Срабатываний: N · Сэкономлено: M»). */
const effectsZoneNote = computed((): string => {
  const line = effectsZoneStatsLine(effectsStats.value);
  if (line === undefined || line.triggers === 0) {
    return '';
  }
  const parts = [`${translateText('Times triggered')}: ${line.triggers}`];
  if (line.savedMc > 0) {
    parts.push(`${translateText('Saved')}: ${line.savedMc} ${translateText('Megacredits')}`);
  }
  return parts.join(' · ');
});
/** The live command contract — published to the shell's ONE bottom
 *  command bar through consolePanelUi (the footCommands watch below). */
const footCommands = computed((): Array<ConsoleCommand> => {
  const route = infoModeState.route;
  // The embedded «Разыграно» grammar — honest to the table's live
  // mirrors (consolePlayedUi), same verbs as the board-home overlay.
  if (route === 'played' && presentation.value === 'content') {
    if (consolePlayedUi.categoryBusy) {
      return [{control: 'back', label: 'Back'}];
    }
    if (consolePlayedUi.categoryOpen) {
      return [
        {control: 'secondary', label: 'Inspect'},
        ...(consolePlayedUi.pageCount > 1 ? [{control: 'bumperL', control2: 'bumperR', label: 'Browse', priority: 1} as ConsoleCommand] : []),
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
  // …and the «ДЕЙСТВИЯ» gallery (TR60 — its cursor and X; honest to an empty table).
  if (route === 'actions' && presentation.value === 'content' && infoActionsUi.barCommands !== undefined) {
    return [...infoActionsUi.barCommands];
  }
  // …and the EFFECTS EXPLORER (browse ⇄ detail change the verbs).
  if (route === 'effects' && effectsExplorerUi.barCommands !== undefined) {
    return [...effectsExplorerUi.barCommands];
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
    const focusedChip = focusedExtrasChip.value;
    if (infoModeState.summaryFocus === 'extras' && focusedChip !== undefined) {
      cmds.push({control: 'confirm', label: 'Open: ${0}', labelParams: [translateText(focusedChip.label)]});
    } else if (summaryFocusEnterable.value && summaryFocusTitle.value !== '') {
      cmds.push({control: 'confirm', label: 'Open: ${0}', labelParams: [translateText(summaryFocusTitle.value)]});
    } else {
      cmds.push({control: 'confirm', label: 'Open', enabled: false});
    }
  } else if (route === 'botScreen' && presentation.value === 'content') {
    cmds.push({control: 'confirm', label: 'Open'});
    cmds.push({control: 'back', label: 'To overview'});
  } else if (infoRouteDepth(route) >= 2) {
    cmds.push({control: 'back', label: 'Back'});
  } else {
    cmds.push({control: 'back', label: 'To overview'});
  }
  cmds.push({control: 'inspect', label: 'Close', priority: 0});
  return cmds;
});
/** The focused summary zone's display title — the contextual half of
 *  the bar's «A Открыть: …» hint. */
const summaryFocusTitle = computed((): string => {
  switch (infoModeState.summaryFocus) {
  case 'extras': return 'Extra resources';
  case 'vp': return 'Victory Points';
  case 'played': return 'Played cards';
  case 'actions': return 'Actions';
  case 'effects': return 'Effects';
  case 'parliament': return 'Parliament';
  case 'campaign': return 'Campaign';
  case 'botdoor': return 'MarsBot screen';
  default: return '';
  }
});
/** May A enter the currently focused summary zone? */
const summaryFocusEnterable = computed((): boolean => {
  return infoZoneFocusable(infoModeState.summaryFocus, viewedKind.value, zoneCtx.value);
});
/** The inspected seat's satellite chips (same derivation as the rail). */
const extrasChips = computed((): ReadonlyArray<InfoExtrasChip> => {
  return infoExtrasChips(viewed.value, viewedIsBot.value ? botAutoma.value : undefined,
    marsBotExtrasContext(props.playerView.game));
});
/** The zone-table context: game shape + the seat's satellite presence
 *  (an empty extras column is no ring stop — same rule as the shell).
 *  ⚠️ Its GAME terms must match `ConsoleShell.infoZoneCtx`, which navigates
 *  the very ring this draws — see the warning there. */
const zoneCtx = computed((): {campaign: boolean, extras: boolean, parliament: boolean} => {
  return {
    campaign: campaignContract.value !== undefined,
    extras: extrasChips.value.length > 0,
    // A fact of the GAME, exactly like the campaign — not of the inspected seat.
    parliament: props.playerView.game.parliament !== undefined,
  };
});
/**
 * THE INSPECTED SEAT'S STANDING in the parliament — the zone's summary and
 * its whole detail, from ONE model (`seatParliamentReadingOf`), read in the
 * person of whoever is looking. Undefined outside a parliament game.
 */
const parliamentReading = computed((): SeatParliamentReadingVm | undefined => {
  const model = props.playerView.game.parliament;
  if (model === undefined) {
    return undefined;
  }
  return seatParliamentReadingOf(model, viewed.value.color, viewed.value.tableau, {viewer: props.playerView.thisPlayer.color});
});
/** The chip the summary ring stands on (clamped — the composition can
 *  shrink under the cursor on a seat switch). */
const focusedExtrasChip = computed((): InfoExtrasChip | undefined => {
  const chips = extrasChips.value;
  if (chips.length === 0) {
    return undefined;
  }
  return chips[Math.min(infoModeState.extrasCursor, chips.length - 1)];
});

/** Pre-decode the resource HOLDERS' premium art at panel open — the
 *  extras gallery then enters with its faces already warm. */
function warmExtrasArt(): void {
  const holders = viewed.value.tableau
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
}
/** The focus-ring state of a summary zone (ring only where A can go). */
function zoneStateClass(zone: string): Record<string, boolean> {
  const focusable = infoZoneFocusable(zone as never, viewedKind.value, zoneCtx.value);
  return {
    'con-info__zone--focusable': focusable,
    'con-info__zone--focused': focusable && infoModeState.summaryFocus === zone,
  };
}
function titleLabel(title: TitleName): string {
  return TITLE_LABEL[title];
}
/** The embedded table's own close event (B at table level). */
function closePlayedRoute(): void {
  infoModeState.route = 'summary';
  infoModeState.summaryFocus = 'played';
}
/** The shell forwards the pad to the embedded «Разыграно» table while
 *  the played route is up (LB/RB and Y are handled globally first). */
function handlePlayedIntent(intent: GamepadIntent): void {
  playedView.value?.handleIntent?.(intent);
}
/** …and to the score explorer while a vp route is up (same contract). */
function handleScoreIntent(intent: GamepadIntent): void {
  scoreView.value?.handleIntent?.(intent);
}
/** …and to the extras explorer while the extras route is up. */
function handleExtrasIntent(intent: GamepadIntent): void {
  extrasView.value?.handleIntent?.(intent);
}
/** …and to the «Действия» gallery while the actions route is up (TR60). */
function handleActionsIntent(intent: GamepadIntent): void {
  actionsView.value?.handleIntent?.(intent);
}
/** …and to the effects explorer while the effects route is up. */
function handleEffectsIntent(intent: GamepadIntent): void {
  effectsView.value?.handleIntent?.(intent);
}
/** B consumes the effects explorer's open detail before walking the tree. */
function consumeEffectsBack(): boolean {
  return effectsView.value?.consumeEffectsBack?.() === true;
}
/** …and to the campaign overview while the campaign route is up.
 *  Returns false when the overview did not consume it (B at its base
 *  layer — the shell then walks the route tree back to the summary). */
function handleCampaignIntent(intent: GamepadIntent): boolean {
  return campaignView.value?.handleIntent?.(intent) === true;
}
/** A satellite cell press routed by the shell (mouse/touch): select
 *  the type inside the live explorer. */
function selectExtrasType(key: string, index: number): void {
  extrasView.value?.selectType?.(key, index);
}
/** B consumes the explorer's MA inspection before walking the tree. */
function consumeScoreBack(): boolean {
  return scoreView.value?.consumeScoreBack?.() === true;
}
// ── the content-zone swap beat (route changes) ──────────────────────
// TR60 — «ЗОНА РАСКРЫВАЕТСЯ ИЗ ПЛИТКИ»: every zone of the dossier is the
// DOOR of its detail, and the transition is ONE phrase, both ways (the
// workspace law: RELEASE on the spot → UNFOLD from the rect the old
// object occupied → REVEAL from inside — never a `mode="out-in"` gap with
// nothing in it):
//   A — the pressed zone's CONTENT lets go where it stands while the
//       other zones fade; its glass plate stays. At the swap the detail
//       arrives as THAT plate (`con-info__unfolding` — the same glass, the
//       same rect), unfolds to the whole room, its rows rise inside it,
//       and the plate dissolves under them;
//   B — the rows let go, the plate comes back, the detail folds INTO the
//       zone's rect; the summary arrives with that zone standing (its
//       content surfacing in place) while the rest compose around it.
// The score keeps its shared-element handoff (the total and the bar fly)
// and the extras keep the satellite column as their continuity. A seat
// switch keeps the key (routes are semantic) → no beat here at all.
function detailZoneEnter(el: Element, done: () => void): void {
  if (consoleReducedMotionActive()) {
    gsap.set(el, {clearProps: 'transform,opacity'});
    returningZone.value = undefined;
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
  const depth = infoRouteDepth(infoModeState.route);
  const cascade = Array.from(host.querySelectorAll<HTMLElement>('.con-vpx__tile, .con-infovp__cat'));
  if (playScoreHandoff(host, cascade, done)) {
    lastDepth.value = depth;
    returningZone.value = undefined;
    return;
  }
  // THE EXTRAS ENTRY: the content UNFOLDS OUT OF the satellite column —
  // the very object the player pressed (which itself never moves: it is
  // shell chrome, the pixel-anchored half of this screen). The satellite
  // is alive on both sides of the swap, so no proxy handoff is needed —
  // the continuity IS the column.
  if (host.classList.contains('con-info__exrhost')) {
    lastDepth.value = depth;
    const satRect = descendRectOf(document.querySelector<HTMLElement>('.con-res-aux'));
    const tl = gsap.timeline({onComplete: done});
    if (!descendUnfold(tl, host, satRect, motionMs(280) / 1000, 0)) {
      tl.fromTo(host, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(160) / 1000, clearProps: 'opacity,visibility'}, 0);
    }
    descendCascade(tl, extrasRows(host), motionMs(175) / 1000, motionMs(140) / 1000, 0.03);
    return;
  }
  // THE SUMMARY AFTER A B: the zone the detail folded into is STANDING
  // (its plate at once, its content surfacing in place); the rest of the
  // dossier composes around it.
  if (host.classList.contains('con-info__layout') && returningZone.value !== undefined) {
    const zone = host.querySelector<HTMLElement>(`[data-zone="${returningZone.value}"]`);
    returningZone.value = undefined;
    lastDepth.value = depth;
    const others = Array.from(host.querySelectorAll<HTMLElement>('.con-dossier__zone')).filter((z) => z !== zone);
    const tl = gsap.timeline({onComplete: done});
    if (zone !== null) {
      tl.fromTo(Array.from(zone.children), {opacity: 0}, {opacity: 1, duration: motionMs(150) / 1000, ease: 'power2.out', clearProps: 'opacity'}, 0);
    }
    tl.fromTo(others, {opacity: 0}, {opacity: 1, duration: motionMs(190) / 1000, ease: 'power2.out', stagger: 0.03, clearProps: 'opacity'}, motionMs(40) / 1000);
    return;
  }
  // A ZONE'S DETAIL: it arrives as the zone's plate and unfolds out of
  // the rect the zone stood in (captured in the summary's leave hook —
  // the enter runs after the summary detached).
  const zoneKey = host.dataset.infoZone;
  const from = zoneKey === undefined ? undefined : zoneRects.get(zoneKey);
  if (from !== undefined) {
    lastDepth.value = depth;
    host.classList.add('con-info__unfolding');
    host.style.setProperty('--con-unfold-plate', '1');
    const tl = gsap.timeline({onComplete: () => {
      // The plate dissolves UNDER the revealed rows (a CSS opacity transition), then lets go of the host.
      host.style.setProperty('--con-unfold-plate', '0');
      motionAfter(motionMs(280), 'the unfold plate dissolves, then lets go of its host', () => {
        host.classList.remove('con-info__unfolding');
        host.style.removeProperty('--con-unfold-plate');
      }, flow);
      done();
    }});
    // The door gives from its FIRST frame (power3.out): the plate is the continuity, a slow start reads as a stall.
    descendUnfold(tl, host, from, motionMs(320) / 1000, 0, zoneRadiusPx(), 'power3.out');
    descendCascade(tl, detailRows(host), motionMs(170) / 1000, motionMs(160) / 1000, 0.03);
    return;
  }
  const rising = depth >= lastDepth.value;
  lastDepth.value = depth;
  gsap.fromTo(el,
    {opacity: 0, y: (rising ? 10 : -8) * conUiScale()},
    {opacity: 1, y: 0, duration: motionMs(180) / 1000, ease: 'power2.out', clearProps: 'transform,opacity', onComplete: done});
}
function detailZoneLeave(el: Element, done: () => void): void {
  const to = infoModeState.route;
  const host = el as HTMLElement;
  // Every zone's box, measured while the summary still stands — the door
  // geometry both ways (the enter hook runs after this node detached).
  if (host.classList.contains('con-info__layout')) {
    zoneRects.clear();
    for (const zone of Array.from(host.querySelectorAll<HTMLElement>('[data-zone]'))) {
      const rect = descendRectOf(zone);
      if (zone.dataset.zone !== undefined && rect !== undefined) {
        zoneRects.set(zone.dataset.zone, rect);
      }
    }
  }
  if (consoleReducedMotionActive()) {
    void Promise.resolve().then(done); // see detailZoneEnter — never sync
    return;
  }
  // Arm the shared-element handoff on the two zones that exchange the
  // total + bar: the summary leaving FOR the explorer, and the explorer
  // leaving BACK to the summary. The proxies bridge the out-in gap, so
  // the total never misses a frame.
  const summaryToVp = host.classList.contains('con-info__layout') && isVpRoute(to);
  const vpToSummary = host.classList.contains('con-info__vpxhost') && to === 'summary';
  if (summaryToVp || vpToSummary) {
    armScoreHandoff(host);
  }
  // A: THE PRESSED ZONE RELEASES ON THE SPOT — its content lets go where
  // it stands, its plate stays for the detail to unfold out of; every
  // other zone fades around it.
  const pressed = infoZoneForRoute(to);
  if (host.classList.contains('con-info__layout') && pressed !== undefined && pressed !== 'vp' && pressed !== 'extras' &&
      zoneRects.has(pressed)) {
    const zone = host.querySelector<HTMLElement>(`[data-zone="${pressed}"]`);
    const others = Array.from(host.querySelectorAll<HTMLElement>('.con-dossier__zone')).filter((z) => z !== zone);
    const tl = gsap.timeline({onComplete: done});
    tl.to(others, {opacity: 0, duration: motionMs(110) / 1000, ease: 'power1.in'}, 0);
    if (zone !== null) {
      tl.to(Array.from(zone.children), {opacity: 0, duration: motionMs(100) / 1000, ease: 'power1.in'}, 0);
    }
    return;
  }
  // B FROM A ZONE'S DETAIL: the rows let go, the plate comes back, and
  // the detail folds INTO the zone's rect (stable geometry — the captured
  // box is honest); the summary's entry keeps that zone standing.
  const zoneKey = host.dataset.infoZone;
  const into = zoneKey === undefined ? undefined : zoneRects.get(zoneKey);
  if (to === 'summary' && zoneKey !== undefined && into !== undefined) {
    returningZone.value = zoneKey;
    host.classList.add('con-info__unfolding');
    host.style.setProperty('--con-unfold-plate', '0');
    void host.offsetWidth;
    host.style.setProperty('--con-unfold-plate', '1');
    const tl = gsap.timeline({onComplete: done});
    descendCascadeOut(tl, detailRows(host), motionMs(90) / 1000, 0);
    if (!descendFold(tl, host, into, motionMs(240) / 1000, motionMs(40) / 1000, zoneRadiusPx())) {
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
    descendCascadeOut(tl, extrasRows(host), motionMs(90) / 1000, 0);
    if (!descendFold(tl, host, satRect, motionMs(230) / 1000, motionMs(30) / 1000)) {
      tl.to(host, {autoAlpha: 0, duration: motionMs(120) / 1000}, 0);
    }
    return;
  }
  const depth = infoRouteDepth(to);
  const rising = depth >= lastDepth.value;
  gsap.to(el, {opacity: 0, y: (rising ? -6 : 5) * conUiScale(), duration: motionMs(95) / 1000, ease: 'power1.in', onComplete: done});
}
function detailZoneCancelled(el: Element): void {
  gsap.killTweensOf(el);
  gsap.set(el, {clearProps: 'transform,opacity,clipPath,visibility'});
  const host = el as HTMLElement;
  host.classList.remove('con-info__unfolding');
  host.style.removeProperty('--con-unfold-plate');
  for (const child of Array.from(host.querySelectorAll<HTMLElement>('.con-dossier__zone, .con-dossier__zone > *'))) {
    gsap.killTweensOf(child);
    gsap.set(child, {clearProps: 'opacity'});
  }
  disposeScoreHandoff();
}
/** The dossier plate's corner radius in px (the clip's rounded inset matches the glass it grows out of). */
function zoneRadiusPx(): number {
  return 0.75 * 20 * conUiScale();
}
/** A detail's cascade rows: the known blocks of each detail, else the host's own children (entry / exit choreography). */
function detailRows(host: HTMLElement): Array<HTMLElement> {
  const known = Array.from(host.querySelectorAll<HTMLElement>(
    '.con-efx__filters, .con-efx__detail, .con-efx__group, .con-efx__empty, .con-armsec, ' +
    '.con-info__parl-sec, .con-info__empty--big, .con-dgal__tile, .con-dgal__void, .con-dgal__legend'));
  return known.length > 0 ? known : Array.from(host.children) as Array<HTMLElement>;
}
/** The extras screen's cascade rows (entry/exit choreography). */
function extrasRows(host: HTMLElement): Array<HTMLElement> {
  return Array.from(host.querySelectorAll<HTMLElement>(
    '.con-exr__hero, .con-exr__slot, .con-exr__detail, .con-exr__botpool, .con-exr__botnote, .con-exr__void'));
}

/** Warm the extras gallery's art for the NEW seat — the biggest webp
 *  decode on the panel, and the one surface where a late-arriving face
 *  is a visible defect (the 4K faces decode in hundreds of ms). */
watch(() => infoModeState.playerColor, (): void => {
  warmExtrasArt();
});
/** Keep the inspected seat's effect stats warm — the ONE recipe: the
 *  store's own version stamp (gameStateVersion + seat), the same pair
 *  the server memoizes the route on. Feeds both the zone's whole-game
 *  line and the explorer's tile metas / «За партию» panel. */
watch(() => effectsStatsKey.value, (): void => {
  if (!viewedIsBot.value) {
    ensureEffectStats(props.playerView, viewed.value.color);
  }
}, {immediate: true});
/** Publish the CONTEXTUAL command contract to the shell's ONE bottom
 *  command bar (consolePanelUi) — hints live only there, never in a
 *  panel-local footer (CONSOLE_TV_PREMIUM_PLAN §3.2). */
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  setPanelCommands('infoMode', cmds);
}, {immediate: true, deep: true});

onMounted(() => {
  warmExtrasArt();
  // Campaign missions: prefetch the campaign document at panel open, so
  // the «Кампания» zone fills its personal half and the full overview
  // opens with its data already standing (no intermediate empty page).
  const contract = campaignContract.value;
  if (contract !== undefined) {
    setCampaignViewerName(props.playerView.thisPlayer.name);
    void openCampaign(contract.campaignId);
  }
});
onBeforeUnmount(() => {
  clearPanelCommands('infoMode');
  disposeScoreHandoff();
});
defineExpose({consumeEffectsBack, consumeScoreBack, handleActionsIntent, handleCampaignIntent, handleEffectsIntent, handleExtrasIntent, handlePlayedIntent, handleScoreIntent, selectExtrasType});
</script>
