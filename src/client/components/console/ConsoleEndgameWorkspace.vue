<template>
  <!--
    CONSOLE FINAL SCORING — the post-game workspace (`?console=1`).

    THE ceremony: every player permanently on screen as one comparable row
    (place · identity · one shared-scale bar · exact values anchored to their
    segments · a large running total), categories revealed in sequence for
    the whole table at once as a four-part phrase (focus → grow → settle →
    breath), TR and Cards opening as quick two-level micro-reveals that MERGE
    back into one calm segment, penalties physically RETRACTING the bar, the
    ranking settled by ONE FLIP after the last number lands, then the winner
    beat AS THE FIRST ROW ITSELF (a hero treatment — never a duplicate
    plate). The MarsBot is an ordinary row — its legacy scoring category is
    dissolved into the card families by the VM (consoleEndgameModel).

    STABILITY CONTRACT (the audit's three findings, kept fixed):
    · the row grid has as many children as columns, ALWAYS — the running
      total lives in its own fixed column and the count-up writes arrive as
      direct textContent (never a reactive per-frame write), so the track
      cannot re-solve mid-count;
    · `--noanim` suppresses TRANSITIONS only — re-enabling a suppressed
      keyframe ANIMATION restarts it from its first frame, which is exactly
      the settled-scene flash this workspace once shipped;
    · sub-segment shades and seams exist only until the category MERGES —
      the settled bar is one hue per top-level category, never a barcode.

    A full-bleed scene (start-scene family): it covers the frame while the
    command bar below stays live. B = «Свернуть» — the scene hides (state
    intact, a running ceremony PAUSES) and the final board is open for
    inspection; B/A returns and resumes. «Обзор партии» is an INTERNAL SCENE
    of this same workspace (ConsoleEndgameOverview): the scoring stage PARKS
    under it (opacity/visibility — never display, so no keyframe restarts and
    no replayed ceremony) and returns on B. The desktop results overlay never
    rises in console mode.
  -->
  <div class="con-endgame" role="region" :aria-label="$t('Final scoring')"
       :class="{'con-endgame--noanim': noanim, 'con-endgame--ovopen': overviewParked || campaignScene !== undefined, ['con-endgame--' + ui.phase]: true}"
       :style="{'--eg-horizon-y': horizonY + 'px', '--eg-arc-r': arcRadius + 'px'}"
       :data-eg-beat="ui.beatStage" :data-eg-cat="ui.catIdx" :data-eg-hurried="ui.hurry === 'off' ? undefined : ui.hurry">
    <div class="con-eg" :class="'con-eg--n' + densityN">
      <header class="con-eg__head">
        <!-- A fixed-height slot + layered crossfade: the title swap
             («ФИНАЛЬНЫЙ ПОДСЧЁТ» → «ИТОГИ ПАРТИИ») may never blank the
             line or shift the meta under it. -->
        <div class="con-eg__title-slot">
          <transition name="con-eg-xfade">
            <div :key="headTitle" class="con-eg__kicker">
              <span class="con-eg__kicker-mark" aria-hidden="true">◈</span>
              <span>{{ $t(headTitle) }}</span>
            </div>
          </transition>
        </div>
        <div class="con-eg__meta">{{ $t('Generation') }} {{ vm.generation }}</div>
      </header>

      <!-- THE STAGE — rail, caption and rows travel as ONE centred group so
           the legend reads as the scoreboard's own header, never a distant
           strip with dead space under it. -->
      <div class="con-eg__stage">
        <!-- CATEGORY RAIL — one stable strip of MEDALLIONS (the dossier's own discs, TR69); the ACTIVE category is the
             spotlight (bright, lifted, accent-lit) whose PLATE stands under the rail; settled ones stay readable,
             future ones wait dim. Identity = symbol + colour + position + name (never colour alone). -->
        <div class="con-eg__rail">
          <div v-for="(cat, i) in vm.categories" :key="cat.key"
               class="con-eg__lchip" :class="lchipClass(cat, i)" :style="{'--eg-ci': i}" :data-eg-rail="cat.key">
            <ConsoleScoreDisc class="con-eg__ldisc" :glyph="glyphOf(cat.key)" />
            <span class="con-eg__lname">{{ $t(cat.legend) }}</span>
          </div>
        </div>

        <!-- THE CATEGORY PLATE (T08; CI «ФИНАЛ — ПРЕМИУМ, НЕ ДИСКОТЕКА») — the active category under the rail: its disc,
             its name, its sources (a TR row / a card family) as the quiet second voice. ONE object for the whole count
             and a STRIP inside it: every category's face stands in one grid cell (the plate is as wide as its widest
             face), shifted by its distance from the active one — a category change SLIDES the strip, never a crossfade
             of two faces; under X it slides after the light at the pass's own step. The plate's frame is neutral: the
             tone is the face's own disc, so nothing on the plate changes colour. -->
        <div class="con-eg__caption" aria-live="polite">
          <div class="con-eg__plate" :class="plateClass" :data-eg-plate="activeCategory?.key ?? ''"
               :style="{'--eg-plate-i': plateIdx, '--eg-sweep-step': ui.sweepStepMs + 'ms'}">
            <div v-for="(cat, i) in vm.categories" :key="cat.key"
                 class="con-eg__plate-face" :class="'con-eg-cat--' + cat.accent" :style="{'--eg-pf': i}" :data-eg-plate-face="cat.key">
              <span class="con-eg__plate-pill">
                <ConsoleScoreDisc class="con-eg__plate-disc" :glyph="glyphOf(cat.key)" />
                <span class="con-eg__plate-name">{{ $t(cat.label) }}</span>
                <!-- The sources stand in one cell too (the slot is as wide as the longest): a source changes by opacity
                     in place, the pill never re-sizes. -->
                <span v-if="cat.subs.length > 1" class="con-eg__plate-subs" :class="'con-eg-ink--' + cat.accent">
                  <span v-for="(sub, si) in cat.subs" :key="sub.key" class="con-eg__plate-sub"
                        :class="{'con-eg__plate-sub--on': i === ui.catIdx && si === ui.subIdx}">{{ $t(sub.label) }}</span>
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- THE PODIUM (TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ») — every player is a SEAT standing on the horizon: the corporation's
             face, the name, the score in the score cell's language, the counting bar under it, the category medallions.
             While the count runs the seats are EQUAL (the ranking is untold); the ranking FLIPs them into order, and the
             crowning RAISES the winner into the hero — the tallest seat, the largest face — while the rest step down.
             The geometry is the pure planner's (`consoleEndgamePodium`), solved from the measured box. -->
        <div ref="rowsEl" class="con-eg__rows" :class="'con-eg__rows--' + podium.mode"
             :style="{'--eg-seat-gap': podium.gap + 'px', '--eg-rise': podium.rise}">
          <div v-for="(color, i) in rowOrder" :key="color"
               class="con-eg__row" :class="rowClass(color)"
               :data-eg-row="color" :style="seatStyle(color, i)">
            <!-- The «ПОБЕДИТЕЛЬ» ribbon and the «ЧЕМПИОН КАМПАНИИ» plate are
                 ONE anchor (the seat's top-left shoulder): on the campaign's
                 final mission the ribbon RELEASES (fade) while the plate
                 unfolds in its place — a transformation, never a swap. Both
                 absolute: zero layout impact at any density, ever. -->
            <transition name="con-eg-fade">
              <div v-if="rowRibbon(color) !== undefined" class="con-eg__ribbon"
                   :class="{'con-eg__ribbon--defeat': soloDefeat, 'con-eg__ribbon--yield': ribbonYields(color)}"
                   :style="ribbonYields(color) ? {'--egb-i': rowTitleBadge(color)!.order} : undefined">{{ $t(rowRibbon(color)!) }}</div>
            </transition>
            <div v-if="championPlateFor(color)" class="con-eg__champline"
                 :class="{'con-eg__champline--animate': campaignCodaAnimated}">
              <!-- The ceremonial gold carries the CHAMPION's own color inside
                   its fixed geometry — the one sanctioned player linkage. -->
              <span class="con-eg__champline-swatch" :class="'player_bg_color_' + color" aria-hidden="true"></span>
              <span class="con-eg__champline-label">{{ $t('Campaign champion') }}</span>
              <!-- The four-mission motif: one pip per mission, lighting in
                   sequence — the arc that this seat just closed. Fixed
                   geometry inside the plate; the full route story stays on
                   the campaign map. -->
              <span class="con-eg__champline-pips" aria-hidden="true">
                <span v-for="p in missionPipCount" :key="p" class="con-eg__champline-pip" :style="{'--pip-i': p - 1}"></span>
              </span>
            </div>
            <!-- The RIM SWEEP — a transient light running the champion seat's
                 own frame (live ceremony only; it ends invisible, so its
                 unmount at settle can never pop). -->
            <div v-if="championSweepFor(color)" class="con-eg__champ-rim" aria-hidden="true">
              <span class="con-eg__champ-rim-bar"></span>
            </div>
            <!-- THE SEAT'S CREST — a campaign mission's TITLE (missions 1–3) on the crest anchor the ribbon and the
                 champion plate share (the seat's top edge, centred): the real insignia, the title in its metal, the
                 Title Points under it. The winner's «ПОБЕДИТЕЛЬ» YIELDS to its Governor crest — the mission is won
                 first, the title conferred second (one anchor, a transformation, never a swap). Absolute, inside
                 the seat's reserved crest padding: it never covers the face, the lineage or the name. Data is the
                 SERVER'S committed result (campaignState), never a client guess; the full story (TP ledger, comeback
                 M€, per-mission provenance) stays on the campaign map. -->
            <div v-if="rowTitleBadge(color) !== undefined" class="con-eg__title"
                 :class="['con-eg__title--' + rowTitleBadge(color)!.kind,
                          {'con-eg__title--animate': campaignCodaAnimated}]"
                 :style="{'--egb-i': rowTitleBadge(color)!.order}" :data-eg-title="rowTitleBadge(color)!.kind">
              <img class="con-eg__title-emblem" :src="titleArtUrl(rowTitleBadge(color)!.art)"
                   :alt="$t(rowTitleBadge(color)!.label)" draggable="false" />
              <span class="con-eg__title-text">
                <span class="con-eg__title-label">{{ $t(rowTitleBadge(color)!.label) }}</span>
                <span v-if="rowTitleBadge(color)!.tp > 0" class="con-eg__title-tp">+{{ rowTitleBadge(color)!.tp }} <span v-i18n>TP</span></span>
              </span>
            </div>
            <!-- THE STAND — the face and the LINEAGE behind it: the seat's other corporations stand BEHIND the face as
                 charters (the deepest first in paint order), each one nameplate higher and a step narrower, so their
                 names rise above the face like the tiers of a pediment and the face stays the one hero. The planner
                 reserves the table's deepest rise for every seat (`--eg-rise`) — the faces stand level. -->
            <div class="con-eg__stand" :data-eg-lineage="rowBy(color).lineage.length">
              <div v-for="charter in lineageShownOf(color)" :key="charter.name"
                   class="con-eg__charter" :style="{'--eg-k': charter.depth}" :data-eg-charter="charter.name">
                <div class="con-eg__face-zoom" :style="{zoom: faceZoomOf(color)}">
                  <ConsoleCardFaceLite :name="charter.name" :card="tableauCard(color, charter.name)" />
                  <i class="con-eg__charter-shade" aria-hidden="true"></i>
                </div>
                <span v-if="charter.more > 0" class="con-eg__charter-more">+{{ charter.more }}</span>
              </div>
              <!-- THE FACE — the corporation the seat stands behind, the premium face at the planner's size (a human's
                   card, the MarsBot corporation's own face); a corpless seat shows its prepared place in its colour. -->
              <div class="con-eg__face" :data-eg-face="rowBy(color).face?.kind ?? 'none'">
                <div v-if="rowBy(color).face !== undefined" class="con-eg__face-zoom" :style="{zoom: faceZoomOf(color)}">
                  <ConsoleCardFaceLite v-if="rowBy(color).face!.kind === 'card'"
                                       :name="faceCardName(color)" :card="corporationModel(color)" />
                  <MarsBotCorpFace v-else :id="faceBotId(color)" :resources="botCorpResources" />
                </div>
                <div v-else class="con-eg__face-empty" :class="'player_bg_color_' + color" aria-hidden="true"></div>
              </div>
            </div>
            <div class="con-eg__read">
              <div class="con-eg__ident">
                <!-- THE PLACE MARK — the player's colour dot while the count runs; once ranked it GROWS into the
                     place medal ringed in that colour, in the slot reserved for it from the start (nothing moves,
                     nothing covers the face's starting row). -->
                <span class="con-eg__mark" :class="{'con-eg__mark--ranked': ui.placesShown}" aria-hidden="true">
                  <span class="con-eg__swatch" :class="'player_bg_color_' + color"></span>
                  <span v-if="ui.placesShown" class="con-eg__place" :class="'player_bg_color_' + color">
                    <span class="con-eg__place-num">{{ rowBy(color).place }}</span>
                  </span>
                </span>
                <div class="con-eg__who">
                  <span class="con-eg__name">{{ rowBy(color).name }}</span>
                  <!-- The bot's corporation is its PRIMARY identity (like a human's);
                       the difficulty stays as the secondary voice on the same line. -->
                  <span v-if="rowBy(color).corporation !== ''" class="con-eg__corp">{{ $t(rowBy(color).corporation) }}<template v-if="rowBy(color).difficulty !== undefined"> · <span class="con-eg__diff">{{ $t(rowBy(color).difficulty!) }}</span></template></span>
                  <!-- Corpless bot (legacy save): WHICH bot was beaten (or won) —
                       its difficulty, where a human shows the corporation. -->
                  <span v-else-if="rowBy(color).difficulty !== undefined" class="con-eg__corp con-eg__diff">{{ $t(rowBy(color).difficulty!) }}</span>
                </div>
              </div>
              <!-- THE SCORE in the score cell's language (TR55): the award shield and the running total — it ticks on
                   the seat's every ignition. No binding on the number: the count-up writes textContent directly. -->
              <div class="con-eg__total">
                <ConsoleVpBadge class="con-eg__shield" :label="$t('VP')" />
                <span class="con-eg__total-num" :data-eg-total="color" :style="{minWidth: totalDigits[color] + 'ch'}">0</span>
                <!-- The champion KEEL — the fixation's persistent witness: a
                     thin gold bar under the final total, mounted at the FIX
                     window and kept by the settled screen (absolute — zero
                     layout impact; reduced motion still gets its appearance). -->
                <span v-if="championFixFor(color)" class="con-eg__champ-keel"
                      :class="{'con-eg__champ-keel--animate': campaignCodaAnimated}" aria-hidden="true"></span>
              </div>
              <!-- THE COUNTING INSTRUMENT — the shared-scale bar under the score: one hue per category, the penalty a scar. -->
              <div class="con-eg__track">
                <div class="con-eg__bar">
                  <div v-for="seg in rowGeo[color].segs" :key="seg.key"
                       class="con-eg__seg" :class="segClass(seg, color)"
                       :style="{left: seg.leftPct + '%', width: seg.widthPct + '%'}">
                    <div v-for="sub in seg.subs" :key="sub.key"
                         class="con-eg__subseg" :class="subClass(seg, sub, color)"
                         :style="{left: sub.leftPct + '%', width: sub.widthPct + '%'}"></div>
                  </div>
                  <!-- The subtractive SCAR — the bar's tip retreats over it when
                       the penalty lands; it stays as the deduction's witness. -->
                  <div v-if="rowGeo[color].reclaim !== undefined" class="con-eg__reclaim"
                       :class="{'con-eg__reclaim--on': reclaimOn(color)}"
                       :style="{left: rowGeo[color].reclaim!.leftPct + '%', width: rowGeo[color].reclaim!.widthPct + '%'}"></div>
                </div>
                <!-- Tie-break M€ — absolute over the track's tail: appearing
                     evidence may never re-flow the bar it explains. -->
                <div v-if="tieChipVisible(color)" class="con-eg__tiechip">
                  <i class="resource_icon resource_icon--megacredits con-eg__mc-icon" aria-hidden="true"></i>
                  <b>{{ rowBy(color).megacredits }}</b>
                </div>
              </div>
              <!-- THE MEDALLIONS — one per category, the dossier's discs: IGNITED in turn when the category's light
                   reaches the seat (T08), with the category's value (a zero stays a quiet «0»); before it, a dim disc
                   keeping its place. The ignition is a soft RISE of the medallion itself (CI — no ring, no flash). -->
              <div class="con-eg__medals">
                <span v-for="(cat, ci) in vm.categories" :key="cat.key"
                      class="con-eg__medal" :class="medalClass(cat, ci, color)" :data-eg-medal="cat.key">
                  <ConsoleScoreDisc :glyph="glyphOf(cat.key)" />
                  <b class="con-eg__medal-val">{{ medalText(cat, ci, color) }}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- THE BOTTOM ZONE — tie-break annunciation → the winner's context
           note → the post-game action list. Layered (no out-in gap): the
           strip fades over the column, never in place of it. -->
      <div class="con-eg__zone">
        <transition name="con-eg-fade">
          <div v-if="ui.phase === 'tiebreak' && vm.tieBreak !== undefined" class="con-eg__tb">
            <div class="con-eg__tb-title">{{ $t('Tie on VP — decided on M€') }}</div>
            <transition name="con-eg-fade">
              <div v-if="ui.tieStage >= 1" class="con-eg__tb-chips">
                <span v-for="c in vm.tieBreak.contenders" :key="c"
                      class="con-eg__tb-chip" :class="{'con-eg__tb-chip--won': ui.tieStage >= 2 && vm.winners.includes(c)}">
                  <span class="con-eg__swatch" :class="'player_bg_color_' + c" aria-hidden="true"></span>
                  <span class="con-eg__tb-name">{{ rowBy(c).name }}</span>
                  <i class="resource_icon resource_icon--megacredits con-eg__mc-icon" aria-hidden="true"></i>
                  <b>{{ vm.tieBreak.values[c] }}</b>
                </span>
              </div>
            </transition>
          </div>
        </transition>
        <div class="con-eg__final">
          <!-- On the campaign finale the note TRANSFORMS mid-scene («Совместная
               победа» → «Чемпионы кампании»), so it needs the header's own
               idiom: a fixed-height slot + layered keyed crossfade. Ordinary
               games keep the original markup byte for byte. -->
          <div v-if="campaignFinal" class="con-eg__wnote-slot">
            <transition name="con-eg-xfade">
              <div v-if="zoneNote !== undefined && ui.winnerShown" :key="zoneNote" class="con-eg__wnote">{{ $t(zoneNote) }}</div>
            </transition>
          </div>
          <transition v-else name="con-eg-fade">
            <div v-if="zoneNote !== undefined && ui.winnerShown" class="con-eg__wnote">{{ $t(zoneNote) }}</div>
          </transition>
          <transition name="con-eg-rise">
            <div v-if="ui.actionsOn" class="con-eg__actions" role="menu">
              <div v-for="(a, i) in actions" :key="a.id"
                   class="con-eg__action" role="menuitem"
                   :class="{
                     'con-eg__action--focused': i === ui.actionsFocus,
                     'con-eg__action--disabled': a.enabled === false,
                     'con-eg__action--committed': a.id === 'overview' && overviewCommitFx,
                   }">
                <!-- The action's SIGN (PL-576): a stroke icon in the plate's ink — the row reads by shape before words. -->
                <svg v-if="actionIcon(a.id) !== ''" class="con-eg__action-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="actionIcon(a.id)" /></svg>
                <span class="con-eg__action-label">{{ $t(a.label) }}</span>
                <span v-if="a.note !== undefined" class="con-eg__action-note">{{ a.note }}</span>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <!-- THE LIGHT LAYER (T08 «СЧЁТ ПРИХОДИТ СВЕТОМ»; CI — ONE light for the whole count) — a soft wash over the podium
         whose hotspot stands under the active category's chip and whose tone is that category's: it RISES once with
         the first category, GLIDES from category to category (hotspot and tone in one motion), and lets go once at the
         preRank. Never an object that crosses the stage; absolute over it, inert, put out by every skip / replay /
         teardown. -->
    <div class="con-eg__light" aria-hidden="true">
      <!-- The wash is a SMALL canvas painted once per category in its tone and stretched by the compositor (a soft
           gradient loses nothing to the upscale): a tone change re-rasters a 256×128 bitmap, never a 4K-wide layer
           (PL-868 — the class-toned div re-rastered ≈ 750 GPU tiles per category). -->
      <div ref="beamEl" class="con-eg__beam" :data-eg-beam="beamCat ?? ''">
        <canvas ref="washEl" class="con-eg__beam-wash" width="256" height="128" data-eg-light="wash"></canvas>
      </div>
    </div>

    <!-- «ОБЗОР ПАРТИИ» — the analytics scene, one level deeper INSIDE this
         workspace. Mounted only while its scene lives; the shared backdrop,
         frame and command bar never move — the scoring stage above parks via
         opacity/visibility and resumes untouched on the way back. -->
    <ConsoleEndgameOverview v-if="ov.phase !== 'closed'"
                            ref="overview"
                            :player-view="playerView"
                            :model="model"
                            :eg-vm="vm" />

    <!-- ── CAMPAIGN SCENE — an internal scene of this same workspace (the
         overview pattern): the scoring stage parks under it and returns on
         B. Never a modal, never a trip through the main menu. ONE scene:
         the map IS the interlude flow — it opens the mandatory carryover
         step itself, then stands as the launch / ready-waiting stage. -->
    <div v-if="campaignScene === 'map'" class="con-eg-campaign-scene">
      <ConsoleCampaignMap ref="campaignMap" :embedded="true" @close="closeCampaignScene" />
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The scoring WORKSPACE component. Rendering + input + the DOM moments the
 * director cannot know (the ranking FLIP, the crowning FLIP, the category
 * tokens' flights, the winner burst, the direct count-up sink); the numbers
 * live in the pure VM, the bar geometry in the pure layout module, the seats'
 * geometry in the pure podium planner, the choreography in the script /
 * director, the observable stages in the module state — all unit-tested
 * without this file.
 */
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {ViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {consoleMotionMs, useConsoleReducedMotion} from '@/client/console/composables/useConsoleReducedMotion';
import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import {playCeremonyBurst, CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {endgameModelFromView, botColorsFromView} from '@/client/components/endgame/endgameViewAdapter';
import {requestEndgameFacts, cachedEndgameFacts} from '@/client/components/endgame/endgameFactsCache';
import {rematchState, submitRematch, rematchJoinHref} from '@/client/components/rematch/rematchState';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {
  buildConsoleEndgameVm, ConsoleEndgameVm, ConsoleEndgameCategory, ConsoleEndgameCategoryKey, ConsoleEndgameRow,
} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildRowGeometry, EndgameRowGeo, EndgameSegGeo, EndgameSubGeo,
} from '@/client/console/endgame/consoleEndgameLayout';
import {
  faceZoom, horizonDrop, horizonRadius, LINEAGE_VISIBLE, lineageShown, planPodium, podiumOrder, PodiumPlan, SeatGeo,
  slotOffset,
} from '@/client/console/endgame/consoleEndgamePodium';
import {CEREMONY_MS} from '@/client/console/endgame/consoleEndgameScript';
import {runEndgameCeremony, CeremonyHandle, CeremonyIgnition, CeremonyLightBeat} from '@/client/console/endgame/consoleEndgameDirector';
import {DossierGlyph, scoreCategoryGlyph} from '@/client/console/infoDossierModel';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import ConsoleScoreDisc from '@/client/components/console/info/ConsoleScoreDisc.vue';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import {
  consoleEndgameUi, ceremonyShouldPlay, resetCeremonyProgress, finalizeCeremony,
} from '@/client/console/endgame/consoleEndgameState';
import {
  consoleOverviewUi, openEndgameOverview, OVERVIEW_MS,
} from '@/client/console/endgame/consoleOverviewState';
import ConsoleEndgameOverview from '@/client/components/console/ConsoleEndgameOverview.vue';
// Campaign mode: the mission coda («Титулы» / champion) and the embedded
// Campaign Map — «Следующая миссия» is ONE flow inside the map scene
// (mandatory carryover step → launch / ready-waiting with auto-join).
import {TitleName} from '@/common/campaign/CampaignTypes';
import {CampaignGameContract} from '@/common/campaign/CampaignGameContract';
import {MissionResultModel} from '@/common/campaign/CampaignModel';
import {
  campaignState, openCampaign, setCampaignViewerName, startCampaignWatch, stopCampaignWatch,
} from '@/client/console/campaign/campaignState';
import {campaignMapUi} from '@/client/console/campaign/campaignMapUi';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {recordLastGameEntered} from '@/client/components/mainMenu/lastGameState';
import {currentServerEndpoint} from '@/client/utils/runtimeConfig';
import {pinServerEndpoint} from '@/client/utils/serverEndpoints';
import {paths} from '@/common/app/paths';
import ConsoleCampaignMap from '@/client/components/console/campaign/ConsoleCampaignMap.vue';
import {$t} from '@/client/directives/i18n';

/**
 * The post-game actions' SIGNS (PL-576) — one stroke path per action family (24 × 24, drawn in the plate's ink), so
 * the row reads by shape before words and never depends on a font's symbol coverage (the Deck's fonts have no ⟳).
 */
const ACTION_ICON: Readonly<Record<string, string>> = {
  'overview': 'M4 5h16v14H4z M4 12h16 M12 5v14',
  'campaign-map': 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
  'campaign-next': 'M5 12h14 M13 6l6 6-6 6',
  'rematch-offer': 'M4 12a8 8 0 0 1 14-5.3 M18 3v4h-4 M20 12a8 8 0 0 1-14 5.3 M6 21v-4h4',
  'rematch-join': 'M4 12a8 8 0 0 1 14-5.3 M18 3v4h-4 M20 12a8 8 0 0 1-14 5.3 M6 21v-4h4',
  'rematch-wait': 'M12 7v5l3 3 M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
  'rematch-accept': 'M5 12.5l4.5 4.5L19 7.5',
  'rematch-decline': 'M6 6l12 12 M18 6L6 18',
  'rematch-cancel': 'M6 6l12 12 M18 6L6 18',
  'replay': 'M4 12a8 8 0 1 0 2.3-5.6 M4 4v5h5',
  'menu': 'M4 11l8-7 8 7 M6 9.5V20h12V9.5',
};

type PostGameAction = {
  id: string,
  label: string, // i18n KEY
  note?: string, // pre-rendered (counts) — never a key
  enabled?: boolean,
  run: () => void,
};

/** The light's state between two paints: its hotspot (0–1 of the podium's width) and its tone. */
type LightPaint = {x: number, r: number, g: number, b: number};

/** `#rgb` / `#rrggbb` → the channels; anything else falls back to the palette's neutral steel. */
function toneRgb(tone: string): [number, number, number] {
  const hex = tone.startsWith('#') ? tone.slice(1) : '';
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return [138, 164, 192];
  }
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * CI — paint the ONE light into its small canvas: a radial wash whose hotspot stands under the active category's chip
 * (`light.x`), brightest at the top, a soft band where it touches the medallion row, the top faded in so the light is
 * born out of the plate's line. The canvas is 256×128 (PL-868 — the compositor stretches it), so a glide re-paints it
 * every frame for the cost of a tiny bitmap — the light MOVES and changes tone without ever switching off.
 */
function paintLightWash(canvas: HTMLCanvasElement, light: LightPaint): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return;
  }
  const w = canvas.width;
  const h = canvas.height;
  const tone = (alpha: number) => `rgba(${Math.round(light.r)}, ${Math.round(light.g)}, ${Math.round(light.b)}, ${alpha})`;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * light.x, 0);
  ctx.scale(0.44 * w, 0.82 * h);
  const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  wash.addColorStop(0, tone(0.32));
  wash.addColorStop(0.55, tone(0.11));
  wash.addColorStop(1, tone(0));
  ctx.fillStyle = wash;
  ctx.fillRect(-3 / 0.44, 0, 6 / 0.44, 1 / 0.82);
  ctx.restore();
  const band = ctx.createLinearGradient(0, 0, 0, h);
  band.addColorStop(0, tone(0));
  band.addColorStop(0.8, tone(0));
  band.addColorStop(0.93, tone(0.15));
  band.addColorStop(1, tone(0));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const born = ctx.createLinearGradient(0, 0, 0, h);
  born.addColorStop(0, 'rgba(0, 0, 0, 0)');
  born.addColorStop(0.14, 'rgba(0, 0, 0, 1)');
  born.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = born;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

export default defineComponent({
  name: 'ConsoleEndgameWorkspace',
  components: {ConsoleEndgameOverview, ConsoleCampaignMap, ConsoleScoreDisc, ConsoleVpBadge, ConsoleCardFaceLite, MarsBotCorpFace},
  props: {
    playerView: {type: Object as PropType<ViewModel>, required: true},
  },
  setup() {
    const {reduced} = useConsoleReducedMotion();
    const {width: vpWidth} = useConsoleViewport();
    // The light's live paint (hotspot + tone) — a plain object, never reactive: a glide writes it every frame.
    const light: LightPaint = {x: 0.5, r: 138, g: 164, b: 192};
    return {reduced, vpWidth, light};
  },
  data() {
    return {
      handle: undefined as CeremonyHandle | undefined,
      bursts: [] as Array<CeremonyBurstHandle>,
      /** The «Обзор партии» pill's short commit response (pressed → scene). */
      overviewCommitFx: false,
      commitCall: undefined as gsap.core.Tween | undefined,
      /** Suppresses every CSS TRANSITION for the skip's atomic jump frame
       *  (never animations — a re-enabled keyframe animation restarts). */
      noanim: false,
      noanimRaf: 0,
      /** The podium's MEASURED box (the seats' stage), px — the planner's one DOM input; 0 while hidden. */
      stageW: 0,
      stageH: 0,
      /** The live rem, px (the TV profile's 40 at 4K). */
      remPx: 20,
      /** The podium's foot, px from the scene's top — where the horizon arc crests (the seats stand ON it). */
      horizonY: 0,
      /** The scene's width, px — the horizon's radius is a share of it. */
      sceneW: 0,
      stageObserver: undefined as ResizeObserver | undefined,
      totalEls: {} as Record<string, HTMLElement | undefined>,
      /** The campaign scene — internal, the overview pattern (park + return).
       *  ONE scene: the map hosts the whole interlude flow itself. */
      campaignScene: undefined as undefined | 'map',
      /** The coda animates only when the ceremony itself played live. */
      campaignCodaAnimated: false,
      /** T08: the category whose light stands over the podium (its tone on the beam), undefined while dark. */
      beamCat: undefined as ConsoleEndgameCategory['accent'] | undefined,
    };
  },
  computed: {
    ui() {
      return consoleEndgameUi;
    },
    ov() {
      return consoleOverviewUi;
    },
    /** The scoring stage is PARKED under the overview scene (a leave keeps
     *  it live so the two layers crossfade — never a blank frame). */
    overviewParked(): boolean {
      return this.ov.phase === 'entering' || this.ov.phase === 'open';
    },
    // ── Campaign mode (docs/CAMPAIGN_MODE_ARCHITECTURE.md §5.3, §7) ──────
    campaignContract(): CampaignGameContract | undefined {
      return this.playerView.game.gameOptions.campaign;
    },
    campaignResult(): MissionResultModel | undefined {
      const contract = this.campaignContract;
      if (contract === undefined) {
        return undefined;
      }
      return campaignState.model?.missions[contract.missionSlot]?.result;
    },
    /**
     * The per-row TITLE BADGE map (Color → badge) — MISSIONS 1–3 only: the
     * mission's title marks the holder's row. The final mission carries NO
     * title badges (title POINTS are already the scoring bar's own «Титулы»
     * category there) and the champion mark is the ceremony's own plate on
     * the winner row — never a Governor-art badge (Governor stays a separate
     * per-mission title, not the champion's emblem). A seat with only a
     * comeback bonus gets no row mark — that consequence belongs to the NEXT
     * mission and reads on the campaign map's seat rail.
     */
    campaignRowBadges(): Partial<Record<Color, {kind: string, art: TitleName, label: string, tp: number, order: number}>> {
      const out: Partial<Record<Color, {kind: string, art: TitleName, label: string, tp: number, order: number}>> = {};
      this.campaignTitleRows.forEach((row, i) => {
        if (out[row.color] === undefined) {
          out[row.color] = {kind: row.title, art: row.title, label: row.label, tp: row.titlePoints, order: i};
        }
      });
      return out;
    },
    campaignSeatName(): (seat: number) => {name: string, color: Color} {
      return (seat: number) => {
        const s = campaignState.model?.seats.find((x) => x.seat === seat);
        return {name: s?.name ?? '', color: (s?.color ?? 'neutral') as Color};
      };
    },
    /** Titles ASCENDING (Prefect → Administrator → Governor — the climax last). */
    campaignTitleRows(): ReadonlyArray<{seat: number, title: TitleName, label: string, name: string, color: Color, titlePoints: number, bonus: number, shared: boolean}> {
      const result = this.campaignResult;
      if (result === undefined || this.campaignContract?.final === true) {
        return [];
      }
      return [...result.titles]
        .sort((a, b) => a.titlePoints - b.titlePoints)
        .map((t) => {
          const who = this.campaignSeatName(t.seat);
          const standing = result.standings.find((s) => s.seat === t.seat);
          return {
            seat: t.seat,
            title: t.title,
            label: TITLE_LABEL[t.title],
            name: who.name,
            color: who.color,
            titlePoints: t.titlePoints,
            bonus: result.bonuses.find((b) => b.seat === t.seat)?.megaCredits ?? 0,
            shared: (standing?.tiedWith.length ?? 0) > 0,
          };
        });
    },
    carryConfirmed(): boolean {
      const you = campaignState.model?.you?.seat;
      if (you === undefined) {
        return false;
      }
      return campaignState.model?.carryover?.bySeat.find((s) => s.seat === you)?.status === 'confirmed';
    },
    viewerHasCarryDoor(): boolean {
      const you = campaignState.model?.you?.seat;
      return you !== undefined &&
        campaignState.model?.phase === 'interlude' &&
        campaignState.model?.carryover?.bySeat.some((s) => s.seat === you) === true;
    },
    /** The current slot's live seat link — «Следующая миссия» enters directly. */
    campaignNextLink(): {playerId: string, gameId?: string} | undefined {
      const model = campaignState.model;
      const current = model?.missions[model.pointer];
      if (current?.state === 'active' && current.yourPlayerId !== undefined) {
        return {playerId: current.yourPlayerId, gameId: current.gameId};
      }
      return undefined;
    },
    /** The honest status line under the one CTA (pre-rendered, never a key). */
    campaignNextNote(): string | undefined {
      const model = campaignState.model;
      if (model === undefined) {
        return undefined;
      }
      if (this.campaignNextLink !== undefined) {
        return $t('mission started — enter');
      }
      if (this.viewerHasCarryDoor && !this.carryConfirmed) {
        return $t('choose the project legacy');
      }
      if (model.you?.seat === 0) {
        return $t(model.canLaunch ? 'ready to launch' : 'waiting for the crew');
      }
      if (this.carryConfirmed) {
        return $t('you are ready — waiting for the launch');
      }
      return undefined;
    },
    /** ONE endgame model for the ceremony AND the overview. The facts feed
     *  only the insight/episode engines — every scoring number is identical
     *  with or without them, so a late fetch never moves a settled bar. */
    model(): EndgameModel {
      return endgameModelFromView(this.playerView, cachedEndgameFacts(this.playerView.id));
    },
    vm(): ConsoleEndgameVm {
      const order = this.playerView.players.map((p) => p.color);
      const contract = this.campaignContract;
      return buildConsoleEndgameVm(this.model, order, {
        botColors: botColorsFromView(this.playerView),
        // The FINAL campaign mission fact rides the server's own contract —
        // it is what appends the champion beat to the ceremony script.
        ...(contract !== undefined && contract.final ?
          {campaignFinale: {missionCount: contract.missionCount}} : {}),
      });
    },
    campaignFinal(): boolean {
      return this.vm.campaignFinale !== undefined;
    },
    /** The champion plate stands from the champion beat's PLATE window on —
     *  and forever after (finalize keeps stage 4 on the settled screen). */
    championPlateOn(): boolean {
      return this.ui.championStage >= 3;
    },
    missionPipCount(): number {
      return this.vm.campaignFinale?.missionCount ?? 0;
    },
    densityN(): number {
      return Math.min(Math.max(this.vm.rows.length, 2), 5);
    },
    headTitle(): string {
      // The campaign finale's header arc: «ФИНАЛЬНЫЙ ПОДСЧЁТ» → (the result
      // fixes) «ИТОГИ ПАРТИИ» → (the seal window) «КАМПАНИЯ ЗАВЕРШЕНА», which
      // the settled screen then keeps. Ordinary games never see the third.
      if (this.ui.championStage >= 1 || this.ui.championShown) {
        return 'Campaign complete';
      }
      return this.ui.phase === 'actions' || this.ui.phase === 'champion' ? 'Game results' : 'Final scoring';
    },
    rowOrder(): ReadonlyArray<Color> {
      if (!this.ui.ranked) {
        return this.vm.rows.map((r) => r.color);
      }
      // TR69: ranked, the seats stand as a PODIUM — the winner on the horizon's crest, the runner-up at its left, the
      // third at its right, outwards; a duel reads left to right (the winner first).
      return this.vm.rows.length <= 2 ? this.vm.rankedColors : podiumOrder(this.vm.rankedColors);
    },
    /** The horizon's radius, px — the arc the seats stand on (CSS draws it with the same number). */
    arcRadius(): number {
      return horizonRadius(this.sceneW);
    },
    /** Per-row track geometry — solved from the VM alone, cached by Vue. */
    /**
     * T08 (PL-868): the running total's box holds the WIDEST number the count will show (the pre-penalty sum, the
     * final total — whichever has more digits), so a digit arriving never moves the shield beside it: that shift
     * re-painted the whole seat layer on every count-up that crossed a power of ten.
     */
    totalDigits(): Record<string, number> {
      const out: Record<string, number> = {};
      for (const row of this.vm.rows) {
        const gross = this.vm.categories.reduce((sum, cat) => sum + Math.max(0, cat.values[row.color] ?? 0), 0);
        out[row.color] = Math.max(String(gross).length, String(row.finalTotal).length);
      }
      return out;
    },
    rowGeo(): Record<string, EndgameRowGeo> {
      const out: Record<string, EndgameRowGeo> = {};
      for (const row of this.vm.rows) {
        out[row.color] = buildRowGeometry(this.vm, row.color);
      }
      return out;
    },
    /** THE PODIUM — the seats' geometry from the measured box (TR69); recomputed only on a box / profile change. */
    podium(): PodiumPlan {
      return planPodium({seats: this.vm.rows.length, boxW: this.stageW, boxH: this.stageH, rem: this.remPx, lineage: this.lineageDepth});
    },
    /** The table's deepest lineage — how many charters stand behind one face (every seat's stand reserves it). */
    lineageDepth(): number {
      return Math.max(0, ...this.vm.rows.map((r) => lineageShown(r.lineage.length)));
    },
    /** The podium FORMED: the crowning has happened (a solo game crowns its one seat, won or lost). */
    podiumFormed(): boolean {
      return this.ui.winnerShown;
    },
    /** The bot corporation's live stock (its face's capsule) — the one MarsBot seat of a bot game. */
    botCorpResources(): number {
      return this.playerView.game.automa?.corporation?.resources ?? 0;
    },
    activeCategory(): ConsoleEndgameCategory | undefined {
      return this.ui.catIdx >= 0 ? this.vm.categories[this.ui.catIdx] : undefined;
    },
    /** The plate stands while the count speaks (its frame neutral — the tone is each face's own disc). */
    plateClass(): Record<string, boolean> {
      return {
        'con-eg__plate--on': this.activeCategory !== undefined && this.ui.phase === 'scoring',
        'con-eg__plate--sweep': this.ui.sweepStepMs > 0,
      };
    },
    /**
     * CI — where the plate's strip stands: the active category; between two categories (and while the plate leaves)
     * it STAYS on the last one — a strip sliding back to the first face while the plate fades would be one more motion.
     */
    plateIdx(): number {
      return this.ui.catIdx >= 0 ? this.ui.catIdx : Math.max(0, this.ui.catsSettled - 1);
    },
    /** X still has a count to hurry — not yet hurried, a category still to tell, the ranking not reached. */
    countHurriable(): boolean {
      const p = this.ui.phase;
      return this.ui.hurry === 'off' && this.ui.catsSettled < this.vm.categories.length &&
        (p === 'idle' || p === 'entering' || p === 'scoring');
    },
    sharedWin(): boolean {
      return this.vm.winners.length > 1;
    },
    soloDefeat(): boolean {
      return this.vm.mode === 'solo' && !this.vm.soloWin;
    },
    zoneNote(): string | undefined {
      if (this.vm.automaClockWin) {
        return 'Won on the clock — the final generation was reached';
      }
      if (this.sharedWin) {
        // A FULL tie on the campaign finale shares the championship — the
        // note announces the plural the moment the plates transform. Every
        // tied row carries its own equal plate; no «main» champion exists.
        return this.championPlateOn ? 'Campaign champions' : 'Shared victory';
      }
      return undefined;
    },
    /** The post-game verbs. Only REAL flows: the console-native overview
     *  scene, the rematch machinery (rematchState — polled by RematchLayer),
     *  the local replay, the main menu (GameExitButton is gone at Phase.END,
     *  so this list is the one road out). The ORDER is the priority: the
     *  natural next step first, the replay a secondary local verb, the exit
     *  last. */
    actions(): Array<PostGameAction> {
      const out: Array<PostGameAction> = [];
      // Campaign mission verbs lead: the campaign owns the continuation.
      // Missions 1–3 additionally SUPPRESS the rematch machinery — a rematch
      // would fork a mission into an unlinked game; the final keeps it (an
      // ordinary new single game with the same roster).
      const contract = this.campaignContract;
      if (contract !== undefined) {
        if (contract.final) {
          out.push({
            id: 'campaign-map',
            label: 'Campaign chronicle',
            run: () => this.openCampaignScene(),
          });
        } else {
          // ONE CTA — «Следующая миссия». It opens the map scene, which IS
          // the interlude flow: the mandatory carryover step opens itself,
          // the confirmation doubles as readiness, the host gets the launch
          // press and a ready non-host waits with the auto-join armed. When
          // the mission is already live, the same press enters it directly.
          out.push({
            id: 'campaign-next',
            label: 'Next mission',
            note: this.campaignNextNote,
            run: () => this.runCampaignNext(),
          });
        }
      }
      out.push({
        id: 'overview',
        label: 'Game overview',
        // «Обзор партии» descends INTO this workspace's own analytics scene
        // (ConsoleEndgameOverview) — a short commit pulse on the pill, then
        // the scoring stage parks and the overview unfolds in its place. The
        // desktop EndgameResultsOverlay stays desktop-only.
        run: () => this.beginOverviewCommit(),
      });
      const rematch = contract !== undefined && !contract.final ? undefined : rematchState.model;
      const busy = rematchState.submitting;
      const viewerId = this.playerView.id;
      if (rematch !== undefined && rematch.viewerIsPlayer && viewerId !== undefined) {
        // ONE human seat (a bot game / solo): the offer creates the new game
        // instantly — «Реванш», never a proposal with nobody to propose to.
        const soloHumans = rematch.votes.length <= 1;
        if (rematch.status === 'created') {
          const href = rematchJoinHref(rematch);
          if (href !== undefined) {
            out.push({
              id: 'rematch-join',
              label: rematch.joinKind === 'spectator' ? 'Watch rematch' : 'Join rematch',
              run: () => navigateWithCurtain(href),
            });
          }
        } else if (rematch.viewerMustVote) {
          out.push({
            id: 'rematch-accept', label: 'Accept rematch', enabled: !busy,
            note: this.rematchTally(rematch.votes),
            run: () => void submitRematch(viewerId, 'accept'),
          });
          out.push({
            id: 'rematch-decline', label: 'Decline', enabled: !busy,
            run: () => void submitRematch(viewerId, 'decline'),
          });
        } else if (rematch.status === 'offered' && rematch.viewerIsOfferer) {
          out.push({
            id: 'rematch-cancel', label: 'Cancel', enabled: !busy,
            note: this.rematchTally(rematch.votes),
            run: () => void submitRematch(viewerId, 'cancel'),
          });
        } else if (rematch.status === 'offered') {
          // A player who already voted while others are still deciding.
          out.push({
            id: 'rematch-wait', label: 'Offer rematch', enabled: false,
            note: this.rematchTally(rematch.votes),
            run: () => { /* disabled */ },
          });
        } else {
          out.push({
            id: 'rematch-offer',
            label: soloHumans ? 'Rematch' : 'Offer rematch',
            enabled: !busy,
            run: () => void submitRematch(viewerId, 'offer'),
          });
        }
      }
      out.push({
        id: 'replay',
        label: 'Replay scoring',
        run: () => this.replayCeremony(),
      });
      out.push({
        id: 'menu',
        label: 'To main menu',
        run: () => navigateWithCurtain('/', 'interface'),
      });
      return out;
    },
    footCommands(): Array<ConsoleCommand> {
      if (this.ui.collapsed) {
        // NOTHING. The board is on show and the pad belongs to the post-game
        // free roam — every surface it reaches publishes its own contract, and
        // the road back («B Итоги партии») is appended by the shell to the
        // BOARD HOME run, the one level where it is actually the next step.
        // Publishing it from here put one verb over every screen the player
        // walked to and hid what that screen could actually do.
        return [];
      }
      if (this.ui.phase === 'champion') {
        // THE MANDATORY CHAMPION CEREMONY: no commands at all. Every hint
        // here would advertise a press the scene deliberately absorbs — and
        // a controller bar must never promise what it will not honour.
        return [];
      }
      if (this.campaignScene === 'map') {
        // The map's OWN command list, mirrored whole through campaignMapUi
        // (a $refs read is not reactive) — the host re-labels only the root
        // B: inside the endgame it returns to the results, not the menu. A
        // hand-copied verb list here is the drift class this replaces.
        return campaignMapUi.commands.map((c) =>
          c.control === 'back' && c.label === 'Main menu' ?
            {...c, label: 'Game results', priority: 5} : c);
      }
      if (this.overviewParked) {
        // The overview scene: its own level's verbs, nothing inherited.
        if (this.ov.detail !== undefined) {
          return [
            {control: 'dpad', label: 'Select'},
            {control: 'back', label: 'Close', priority: 5},
          ];
        }
        const run: Array<ConsoleCommand> = [
          {control: 'bumperL', control2: 'bumperR', spread: true, label: 'Tab'},
          {control: 'dpad', label: 'Select'},
        ];
        if (this.ov.primaryAvailable) {
          run.push({control: 'confirm', label: 'Details'});
        }
        run.push({control: 'back', label: 'Game results', priority: 5});
        return run;
      }
      if (this.ui.phase !== 'actions') {
        // The count runs: B parks it (pause + board), X HURRIES it (T08) —
        // quietly labelled, never the loudest thing on screen (the ceremony
        // is the point). The verb exists only while there is a count left to
        // hurry: once pressed, and through the ranking and the crowning
        // (always at the full pace), the bar offers B alone. A deliberately
        // does nothing (the count is not a dialog).
        const cmds: Array<ConsoleCommand> = [{control: 'back', label: 'Minimize'}];
        if (this.countHurriable) {
          cmds.push({control: 'secondary', label: 'Hurry the count', priority: 0});
        }
        return cmds;
      }
      return [
        {control: 'dpad', label: 'Select'},
        {control: 'confirm', label: 'Confirm'},
        {control: 'back', label: 'Minimize'},
      ];
    },
  },
  watch: {
    'footCommands': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        setPanelCommands('endgame', cmds);
      },
    },
    // The list is live (rematch states arrive by poll) — the cursor must
    // never point past its end.
    'actions.length': function(len: number): void {
      if (this.ui.actionsFocus >= len) {
        this.ui.actionsFocus = Math.max(0, len - 1);
      }
    },
    // Skip / settle jumps suppress CSS TRANSITIONS for one frame, so the
    // final state appears ATOMICALLY (no half-grown bars racing each other).
    // Keyframe animations are deliberately NOT suppressed: re-enabling one
    // restarts it — the settled scene would dip to opacity 0 and show the
    // board (the audit's measured final flash).
    'ui.skipSeq': function(): void {
      this.noanim = true;
      // The skip lands on the canonical final state — no light may still stand over it.
      this.putOutLight();
      this.writeAllTotals();
      cancelAnimationFrame(this.noanimRaf);
      this.noanimRaf = requestAnimationFrame(() => {
        this.noanimRaf = requestAnimationFrame(() => {
          this.noanim = false;
        });
      });
    },
    // The canonical settle record (per-beat boundaries, resets, reloads) —
    // mirror it into the unbound number nodes.
    'ui.displayTotals': {
      deep: true,
      handler(): void {
        this.writeAllTotals();
      },
    },
    // Viewport change (profile flip / window resize): re-measure the podium's box and let the planner re-solve.
    vpWidth(): void {
      void this.$nextTick(() => this.measureStage());
    },
  },
  mounted() {
    // One fetch per load, shared with the desktop host — the facts enrich the
    // overview's insight layer; every scoring number is complete without them.
    requestEndgameFacts(this.playerView.id);
    // Campaign mission: bind the campaign store to THIS game's viewer (the
    // seat name, not the menu identity) and keep it fresh — the coda and the
    // map scene render the SERVER's committed result, never a client guess.
    const contract = this.campaignContract;
    if (contract !== undefined) {
      setCampaignViewerName(this.playerView.thisPlayer?.name);
      this.campaignCodaAnimated = ceremonyShouldPlay();
      void openCampaign(contract.campaignId);
      startCampaignWatch();
    }
    if (ceremonyShouldPlay()) {
      this.startCeremony();
    } else {
      // Reload / re-entry into an already-ended game: the SETTLED final state,
      // instantly and silently. Watching the count again is the explicit
      // «Повторить подсчёт» action, never a side effect of arriving.
      finalizeCeremony(this.vm);
    }
    void this.$nextTick(() => {
      this.measureStage();
      this.writeAllTotals();
    });
    // The podium's box is the free space between the rail and the bottom zone — it changes with the profile, the
    // fonts' arrival and the scene's own reveal (a hidden scene measures nothing and keeps the last box).
    const rows = this.$refs.rowsEl as HTMLElement | undefined;
    if (rows !== undefined && typeof ResizeObserver !== 'undefined') {
      this.stageObserver = new ResizeObserver(() => this.measureStage());
      this.stageObserver.observe(rows);
    }
  },
  beforeUnmount() {
    this.stageObserver?.disconnect();
    this.stageObserver = undefined;
    this.teardown();
    clearPanelCommands('endgame');
    if (this.campaignContract !== undefined) {
      stopCampaignWatch();
      setCampaignViewerName(undefined);
    }
  },
  methods: {
    actionIcon(id: string): string {
      return ACTION_ICON[id] ?? '';
    },
    rowBy(color: Color): ConsoleEndgameRow {
      const row = this.vm.rows.find((r) => r.color === color);
      // Every color in rowOrder/winners comes from the VM itself.
      return row ?? this.vm.rows[0];
    },
    fmtLabel(v: number): string {
      return v < 0 ? '−' + Math.abs(v) : String(v);
    },
    // ── the count-up sink (direct DOM writes — never reactive) ───────────
    totalEl(color: string): HTMLElement | undefined {
      const cached = this.totalEls[color];
      if (cached !== undefined && cached.isConnected) {
        return cached;
      }
      const el = (this.$el as HTMLElement | undefined)
        ?.querySelector<HTMLElement>(`[data-eg-total="${color}"]`) ?? undefined;
      this.totalEls[color] = el;
      return el;
    },
    writeTotal(color: string, value: number): void {
      const el = this.totalEl(color);
      if (el !== undefined) {
        el.textContent = String(value);
      }
    },
    writeAllTotals(): void {
      for (const row of this.vm.rows) {
        this.writeTotal(row.color, this.ui.displayTotals[row.color] ?? 0);
      }
    },
    /**
     * The podium's box: the seats' stage measured from the layout (its height is the free space between the rail and
     * the bottom zone — never the seats' own content), the live rem, and the foot the horizon crests at. A hidden
     * scene (collapse / overview round trip) measures 0 — the last honest box is kept.
     */
    measureStage(): void {
      const root = this.$el as HTMLElement | undefined;
      const rows = this.$refs.rowsEl as HTMLElement | undefined;
      if (root === undefined || rows === undefined) {
        return;
      }
      const box = rows.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) {
        return;
      }
      this.stageW = Math.round(box.width);
      this.stageH = Math.round(box.height);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (Number.isFinite(rem) && rem > 0) {
        this.remPx = rem;
      }
      const scene = root.getBoundingClientRect();
      this.horizonY = Math.round(box.bottom - scene.top);
      this.sceneW = Math.round(scene.width);
    },
    // ── the podium ───────────────────────────────────────────────────────
    glyphOf(key: ConsoleEndgameCategoryKey): DossierGlyph {
      return scoreCategoryGlyph(key);
    },
    /** A seat's geometry NOW: equal while the count runs; the hero or a place once the podium has formed. */
    seatGeoOf(color: Color): SeatGeo {
      if (!this.podiumFormed) {
        return this.podium.equal;
      }
      const crowned = this.vm.rows.length === 1 || this.vm.winners.includes(color);
      return crowned ? this.podium.hero : this.podium.place;
    },
    seatStyle(color: Color, i: number): Record<string, string | number> {
      const geo = this.seatGeoOf(color);
      const hero = this.podiumFormed && geo === this.podium.hero;
      // Once RANKED the seat stands ON the planet's curve — the winner on the crest, the outer places lower. While the
      // count runs the seats stand level: a curve under an untold ranking would crown the middle seat by geometry.
      const drop = this.ui.ranked ? horizonDrop(slotOffset(i, this.rowOrder.length, geo.seatW, this.podium.gap), this.arcRadius) : 0;
      return {
        '--eg-i': i,
        '--eg-seat-drop': Math.round(drop) + 'px',
        '--eg-seat-w': geo.seatW + 'px',
        '--eg-seat-h': geo.seatH + 'px',
        '--eg-face-h': geo.faceH + 'px',
        '--eg-read-h': (hero ? this.podium.heroReadH : this.podium.readH) + 'px',
      };
    },
    faceZoomOf(color: Color): number {
      return faceZoom(this.seatGeoOf(color).faceH);
    },
    /**
     * The charters behind this seat's face, DEEPEST FIRST (paint order — the nearer one covers it): the first
     * `LINEAGE_VISIBLE` corporations behind the face in play order, the deepest naming the rest («+N»).
     */
    lineageShownOf(color: Color): Array<{name: CardName, depth: number, more: number}> {
      const lineage = this.rowBy(color).lineage;
      const shown = lineageShown(lineage.length);
      const out: Array<{name: CardName, depth: number, more: number}> = [];
      for (let depth = shown; depth >= 1; depth--) {
        out.push({name: lineage[depth - 1], depth, more: depth === shown ? lineage.length - LINEAGE_VISIBLE : 0});
      }
      return out;
    },
    /** A corporation card as it stands on this seat's table (its stored resources honest on the face's capsule). */
    tableauCard(color: Color, name: CardName): CardModel | undefined {
      return this.playerView.players.find((p) => p.color === color)?.tableau.find((c) => c.name === name);
    },
    faceCardName(color: Color): CardName {
      const face = this.rowBy(color).face;
      return face?.kind === 'card' ? face.name : CardName.BEGINNER_CORPORATION;
    },
    faceBotId(color: Color): MarsBotCorpId {
      const face = this.rowBy(color).face;
      return face?.kind === 'bot' ? face.id : MarsBotCorpId.C01_CREDICOR;
    },
    /** The seat's corporation card as it stands on the table (its stored resources honest on the face's capsule). */
    corporationModel(color: Color): CardModel | undefined {
      const face = this.rowBy(color).face;
      if (face?.kind !== 'card') {
        return undefined;
      }
      return this.tableauCard(color, face.name);
    },
    /** T08: has THIS seat's medallion of this category IGNITED (its value standing, its segment grown)? */
    landed(idx: number, color: Color): boolean {
      if (idx < this.ui.catsSettled) {
        return true;
      }
      if (idx !== this.ui.catIdx || this.ui.seatCat[color] !== idx) {
        return false;
      }
      const cat = this.vm.categories[idx];
      return cat.subs.length <= 1 || (this.ui.seatSub[color] ?? 0) > 0;
    },
    /** The medallion's value: the category's (a multi-sub category sums the sources THIS seat has lit); none before. */
    medalValue(cat: ConsoleEndgameCategory, idx: number, color: Color): number | undefined {
      if (!this.landed(idx, color)) {
        return undefined;
      }
      if (idx >= this.ui.catsSettled && cat.subs.length > 1) {
        const on = this.ui.seatSub[color] ?? 0;
        return cat.subs.slice(0, on).reduce((sum, sub) => sum + (sub.values[color] ?? 0), 0);
      }
      return cat.values[color] ?? 0;
    },
    medalText(cat: ConsoleEndgameCategory, idx: number, color: Color): string {
      const v = this.medalValue(cat, idx, color);
      return v === undefined ? '' : this.fmtLabel(v);
    },
    medalClass(cat: ConsoleEndgameCategory, idx: number, color: Color): Record<string, boolean> {
      const v = this.medalValue(cat, idx, color);
      return {
        ['con-eg-cat--' + cat.accent]: true,
        'con-eg__medal--on': v !== undefined,
        'con-eg__medal--zero': v === 0,
        'con-eg__medal--minus': v !== undefined && v < 0,
        'con-eg__medal--active': idx === this.ui.catIdx && this.ui.phase === 'scoring',
      };
    },
    // ── layout state ─────────────────────────────────────────────────────
    /** The seat's segment of this category grows out of its medallion — on THAT seat's ignition (T08), never ahead. */
    segOn(idx: number, color: Color): boolean {
      return this.landed(idx, color);
    },
    subOn(idx: number, cat: ConsoleEndgameCategory, sidx: number, color: Color): boolean {
      if (idx < this.ui.catsSettled) {
        return true;
      }
      if (idx !== this.ui.catIdx || this.ui.seatCat[color] !== idx) {
        return false;
      }
      return cat.subs.length <= 1 || (this.ui.seatSub[color] ?? 0) > sidx;
    },
    /** The penalty's scar sweeps in on the seat's ignition of the penalty category (the bar's tip retreats). */
    reclaimOn(color: Color): boolean {
      const reclaim = this.rowGeo[color].reclaim;
      return reclaim !== undefined && this.landed(reclaim.catIdx, color);
    },
    // ── classes ───────────────────────────────────────────────────────────
    lchipClass(cat: ConsoleEndgameCategory, i: number): Record<string, boolean> {
      return {
        ['con-eg-cat--' + cat.accent]: true,
        'con-eg__lchip--active': i === this.ui.catIdx && this.ui.phase === 'scoring',
        'con-eg__lchip--done': i < this.ui.catsSettled,
      };
    },
    segClass(seg: EndgameSegGeo, color: Color): Record<string, boolean> {
      const merged = this.ui.merged[seg.key] === true || seg.subs.length <= 1;
      return {
        ['con-eg-cat--' + seg.accent]: true,
        'con-eg__seg--on': this.segOn(seg.catIdx, color),
        'con-eg__seg--merged': merged,
      };
    },
    subClass(seg: EndgameSegGeo, sub: EndgameSubGeo, color: Color): Record<string, boolean> {
      const merged = this.ui.merged[seg.key] === true || seg.subs.length <= 1;
      const cat = this.vm.categories[seg.catIdx];
      return {
        'con-eg__subseg--on': this.subOn(seg.catIdx, cat, sub.idx, color),
        // The shades and seams are the micro-reveal's own voice — they
        // DISSOLVE at the merge (the settled bar is one hue per category).
        ['con-eg__subseg--s' + sub.shade]: !merged,
        'con-eg__subseg--seamed': !merged,
      };
    },
    rowClass(color: Color): Record<string, boolean> {
      const winner = this.ui.winnerShown && this.vm.winners.includes(color);
      const contender = this.ui.phase === 'tiebreak' && (this.vm.tieBreak?.contenders.includes(color) ?? false);
      return {
        'con-eg__row--winner': winner,
        // The champion FRAME deepens the winner gold from the sweep window on
        // and stays on the settled screen — the campaign's status is a state,
        // not an effect. Every tied champion row carries it equally.
        'con-eg__row--champion': this.ui.championStage >= 2 && this.vm.winners.includes(color),
        'con-eg__row--solo-defeat': this.soloDefeat && this.ui.winnerShown,
        // The rest of the table steps back HALF a tone — readable, never grey noise.
        'con-eg__row--rest': this.ui.winnerShown && !winner && this.vm.winners.length > 0,
        'con-eg__row--contender': contender,
        'con-eg__row--bot': this.rowBy(color).isBot,
        // THE HERO (TR69): a crowned seat of the formed podium — the larger reading block, the gold stage.
        'con-eg__row--hero': this.podiumFormed && (this.vm.rows.length === 1 || this.vm.winners.includes(color)),
        'con-eg__row--place': this.podiumFormed && this.vm.rows.length > 1 && !this.vm.winners.includes(color),
      };
    },
    rowRibbon(color: Color): string | undefined {
      if (!this.ui.winnerShown) {
        return undefined;
      }
      if (this.vm.mode === 'solo') {
        return this.vm.soloWin ? 'Victory' : 'Defeat';
      }
      if (!this.vm.winners.includes(color)) {
        return undefined;
      }
      // On the campaign finale the ribbon yields to the champion plate at the
      // plate window (the ribbon's fade + the plate's unfold share the anchor
      // — one transformation). Before that window it reads «ПОБЕДИТЕЛЬ»: the
      // mission is won first, the campaign crowns second. On missions 1–3 it
      // yields the same way to the winner's title crest (`ribbonYields`) — and
      // a settled screen (a reload, reduced replay) shows the crest alone.
      if (this.rowTitleBadge(color) !== undefined && !this.campaignCodaAnimated) {
        return undefined;
      }
      return this.championPlateOn ? undefined : 'Winner';
    },
    /** The ribbon fades on the crest anchor in the very beat its row's title crest unfolds there (CSS-timed: both
     *  ride the title's ascending delay, so the swap is one motion — never two objects on one anchor). */
    ribbonYields(color: Color): boolean {
      return this.campaignCodaAnimated && this.rowTitleBadge(color) !== undefined;
    },
    /** The champion plate — every row that shares first place, equally. */
    championPlateFor(color: Color): boolean {
      return this.championPlateOn && this.vm.winners.includes(color);
    },
    /** The rim sweep — transient, live champion ceremony only (its unmount
     *  at settle is invisible: the bar's one-shot run ends at opacity 0). */
    championSweepFor(color: Color): boolean {
      return this.ui.phase === 'champion' && this.ui.championStage >= 2 && this.vm.winners.includes(color);
    },
    /** The final VP fixation accent (the champion beat's FIX window). */
    championFixFor(color: Color): boolean {
      return this.ui.championStage >= 4 && this.vm.winners.includes(color);
    },
    /** The campaign TITLE badge for this row — only once the winner is shown
     *  (the titles are a consequence of the standings, so they may never mark
     *  a row before the ranking that earned them has been revealed). */
    rowTitleBadge(color: Color): {kind: string, art: TitleName, label: string, tp: number, order: number} | undefined {
      if (!this.ui.winnerShown) {
        return undefined;
      }
      return this.campaignRowBadges[color];
    },
    tieChipVisible(color: Color): boolean {
      if (this.vm.tieBreak === undefined || !(this.vm.tieBreak.contenders.includes(color))) {
        return false;
      }
      // From the values stage of the tie-break ONWARD — the deciding M€
      // stays readable in the settled state (a reload must still explain
      // why two equal totals rank differently).
      if (this.ui.phase === 'tiebreak') {
        return this.ui.tieStage >= 1;
      }
      return this.ui.winnerShown;
    },
    rematchTally(votes: ReadonlyArray<{status: string}>): string {
      const accepted = votes.filter((v) => v.status === 'accepted').length;
      return `${accepted}/${votes.length}`;
    },
    // ── ceremony control ──────────────────────────────────────────────────
    startCeremony(): void {
      this.teardown();
      resetCeremonyProgress();
      consoleEndgameUi.ceremonyPlayed = true;
      // A live run (first play AND every explicit replay) animates its coda
      // marks; the settled-reload path never sets this.
      this.campaignCodaAnimated = true;
      this.handle = runEndgameCeremony(this.vm, {
        onRankFlip: () => this.performRankFlip(),
        onCrown: () => this.performCrown(),
        onLight: (beat, attach) => this.playLight(beat, attach),
        onIgnite: (ignition, attach) => this.igniteMedal(ignition, attach),
        onWinnerFx: () => this.fireWinnerFx(),
        onCount: (color, value) => this.writeTotal(color, value),
        onChampionFx: () => this.fireChampionFx(),
      });
    },
    replayCeremony(): void {
      this.startCeremony();
    },
    skipCeremony(): void {
      if (this.handle !== undefined) {
        this.handle.skip();
      } else {
        finalizeCeremony(this.vm);
      }
    },
    /**
     * X (CI): HURRY the count — its OWN choreography: the categories left in ONE pass of the light, the totals an
     * odometer, then the ranking and the crowning at ×1; a second press is a no-op. Reduced motion hurries too — the
     * same beats, no light (the hooks draw none there); the atomic jump stays for the net and a reload only.
     */
    hurryCeremony(): void {
      if (this.handle === undefined) {
        this.skipCeremony();
        return;
      }
      this.handle.hurry();
    },
    /** B = «Свернуть»: hide the scene, pause a running count, open the board. */
    collapseToBoard(): void {
      consoleEndgameUi.collapsed = true;
      this.handle?.pause();
    },
    /** The road back: show the scene, then resume from the same beat. */
    expandFromBoard(): void {
      consoleEndgameUi.collapsed = false;
      // Resume only after the scene has painted again — the player must see
      // where the count stood before it moves on.
      requestAnimationFrame(() => {
        this.handle?.resume();
      });
    },
    teardown(): void {
      this.handle?.kill();
      this.handle = undefined;
      this.putOutLight();
      this.commitCall?.kill();
      this.commitCall = undefined;
      for (const b of this.bursts.splice(0)) {
        b.stop();
      }
    },
    /**
     * «Обзор партии»: a short tactile commit on the pill, then the scene
     * descends — the pill fixes, the action list yields, the overview
     * unfolds where the scoring stood. Repeat presses retarget harmlessly.
     */
    beginOverviewCommit(): void {
      if (this.overviewCommitFx || this.overviewParked) {
        return;
      }
      this.overviewCommitFx = true;
      this.commitCall?.kill();
      this.commitCall = gsap.delayedCall(consoleMotionMs(OVERVIEW_MS.commit) / 1000, () => {
        this.overviewCommitFx = false;
        openEndgameOverview();
      });
    },
    /**
     * THE RANKING FLIP — capture, reorder, invert, play. Transform-only; the
     * tweens register with the director so a skip mid-flight clears them
     * atomically (clearProps) instead of stranding half-translated rows.
     */
    performRankFlip(): void {
      const rowsEl = this.$refs.rowsEl as HTMLElement | undefined;
      if (rowsEl === undefined) {
        consoleEndgameUi.ranked = true;
        return;
      }
      const first = new Map<string, DOMRect>();
      rowsEl.querySelectorAll<HTMLElement>('[data-eg-row]').forEach((el) => {
        first.set(el.dataset.egRow ?? '', el.getBoundingClientRect());
      });
      consoleEndgameUi.ranked = true;
      void this.$nextTick(() => {
        const els = [...rowsEl.querySelectorAll<HTMLElement>('[data-eg-row]')];
        const tweens: Array<gsap.core.Tween> = [];
        for (const el of els) {
          const from = first.get(el.dataset.egRow ?? '');
          if (from === undefined) {
            continue;
          }
          // The seats change PLACES on the horizon (TR69: side by side) — the move is along both axes.
          const now = el.getBoundingClientRect();
          const dx = from.left - now.left;
          const dy = from.top - now.top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            continue;
          }
          tweens.push(gsap.fromTo(el,
            {x: dx, y: dy},
            {x: 0, y: 0, duration: consoleMotionMs(CEREMONY_MS.rankFlip) / 1000, ease: 'power3.inOut', clearProps: 'transform'}));
        }
        this.handle?.addCleanup(() => {
          for (const t of tweens) {
            t.kill();
          }
          gsap.set(els, {clearProps: 'transform'});
        });
      });
    },
    /**
     * THE CROWNING FLIP (TR69) — the podium FORMS: the crowned seats rise to the hero's height, the rest step down.
     * Measure every seat before the crowning class lands, then invert each new box to the old one (translate + a
     * uniform scale from the seat's FOOT — the seats stand on the horizon) and play it home. Transform-only; the
     * tweens register with the director so a skip or an unmount clears them atomically.
     */
    performCrown(): void {
      const rowsEl = this.$refs.rowsEl as HTMLElement | undefined;
      if (rowsEl === undefined || this.reduced) {
        return;
      }
      const first = new Map<string, DOMRect>();
      rowsEl.querySelectorAll<HTMLElement>('[data-eg-row]').forEach((el) => {
        first.set(el.dataset.egRow ?? '', el.getBoundingClientRect());
      });
      void this.$nextTick(() => {
        const els = [...rowsEl.querySelectorAll<HTMLElement>('[data-eg-row]')];
        const tweens: Array<gsap.core.Tween> = [];
        for (const el of els) {
          const from = first.get(el.dataset.egRow ?? '');
          if (from === undefined) {
            continue;
          }
          const now = el.getBoundingClientRect();
          if (now.height <= 0 || Math.abs(now.height - from.height) < 1) {
            continue;
          }
          const scale = from.height / now.height;
          const dx = (from.left + from.width / 2) - (now.left + now.width / 2);
          const dy = from.bottom - now.bottom;
          tweens.push(gsap.fromTo(el,
            {x: dx, y: dy, scale, transformOrigin: '50% 100%'},
            {x: 0, y: 0, scale: 1, duration: consoleMotionMs(CEREMONY_MS.crown) / 1000, ease: 'power3.out', clearProps: 'transform,transformOrigin'}));
        }
        this.handle?.addCleanup(() => {
          for (const t of tweens) {
            t.kill();
          }
          gsap.set(els, {clearProps: 'transform,transformOrigin'});
        });
      });
    },
    /**
     * THE ONE LIGHT (CI «ФИНАЛ — ПРЕМИУМ, НЕ ДИСКОТЕКА») — a soft wash over the podium, its hotspot under the active
     * category's chip, its tone that category's. `rise`: the box is posed once (from the plate's line to the foot of
     * the medallion row, across every seat — a static box, never an animated geometry) and the wash comes on, slowly;
     * `glide`: the hotspot and the tone move to the next category in ONE motion (the canvas re-painted per frame — the
     * light never switches off); `sweep` (X): one continuous glide over the categories left; `release`: it lets go,
     * once, in place. Every length is already floored (`CEREMONY_MS.minEvent`). Under the director's clock
     * (`attach`): a pause freezes it, a skip puts it out. Reduced motion draws no light.
     */
    playLight(beat: CeremonyLightBeat, attach: (tween: gsap.core.Animation) => void): void {
      const root = this.$el as HTMLElement | undefined;
      const beam = this.$refs.beamEl as HTMLElement | undefined;
      const wash = this.$refs.washEl as HTMLCanvasElement | undefined;
      if (root === undefined || beam === undefined || wash === undefined || this.vm.categories[beat.catIdx] === undefined || this.reduced) {
        return;
      }
      const light = this.light;
      if (beat.kind === 'release') {
        gsap.killTweensOf(wash);
        attach(gsap.to(wash, {opacity: 0, duration: beat.ms / 1000, ease: 'sine.inOut'}));
        return;
      }
      const rising = beat.kind === 'rise' || Number(getComputedStyle(wash).opacity) < 0.05;
      if (rising && !this.poseBeam(root, beam)) {
        return;
      }
      const path = beat.path ?? [beat.catIdx];
      const target = (idx: number): LightPaint => {
        const [r, g, b] = toneRgb(this.toneOf(root, idx));
        return {x: this.hotspotOf(root, beam, idx), r, g, b};
      };
      gsap.killTweensOf(light);
      if (rising) {
        // The light comes on where it is needed — at the path's first category — and only then moves.
        Object.assign(light, target(path[0]));
        paintLightWash(wash, light);
        this.beamCat = this.vm.categories[path[0]].accent;
        gsap.killTweensOf(wash);
        attach(gsap.fromTo(wash,
          {opacity: 0, scaleY: 0.82, transformOrigin: '50% 0%'},
          {opacity: 1, scaleY: 1, duration: (beat.path === undefined ? beat.ms : Math.max(beat.ms * 0.3, CEREMONY_MS.minEvent)) / 1000, ease: 'sine.out'}));
        if (beat.path === undefined) {
          return;
        }
      }
      // The glide — one tween per leg of the path, chained without a pause (a sweep is ONE motion over the rail).
      const legs = rising ? path.slice(1) : path;
      if (legs.length === 0) {
        return;
      }
      const glide = gsap.timeline({onUpdate: () => paintLightWash(wash, light)});
      const legSec = beat.ms / 1000 / legs.length;
      legs.forEach((idx) => {
        glide.to(light, {...target(idx), duration: legSec, ease: legs.length > 1 ? 'none' : 'power2.inOut'});
      });
      glide.call(() => {
        this.beamCat = this.vm.categories[path[path.length - 1]].accent;
      });
      attach(glide);
    },
    /** Pose the light's box over the podium (once, when it comes on) — false while there is nothing to measure. */
    poseBeam(root: HTMLElement, beam: HTMLElement): boolean {
      const origin = root.getBoundingClientRect();
      const plate = root.querySelector<HTMLElement>('.con-eg__plate')?.getBoundingClientRect();
      const seats = Array.from(root.querySelectorAll<HTMLElement>('[data-eg-row]')).map((el) => el.getBoundingClientRect());
      const medals = Array.from(root.querySelectorAll<HTMLElement>('[data-eg-row] .con-eg__medals'))
        .map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0);
      if (plate === undefined || plate.height <= 0 || seats.length === 0 || medals.length === 0) {
        return false;
      }
      const left = Math.min(...seats.map((r) => r.left)) - origin.left;
      const right = Math.max(...seats.map((r) => r.right)) - origin.left;
      const top = plate.top + plate.height / 2 - origin.top;
      const bottom = Math.max(...medals.map((r) => r.bottom)) - origin.top + this.remPx * 0.6;
      const box = {left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, width: `${Math.round(right - left)}px`, height: `${Math.max(0, Math.round(bottom - top))}px`};
      for (const [prop, value] of Object.entries(box)) {
        if (beam.style.getPropertyValue(prop) !== value) {
          beam.style.setProperty(prop, value);
        }
      }
      return true;
    },
    /** The category's tone — `--eg-c` on its rail chip (the palette has one source). */
    toneOf(root: HTMLElement, idx: number): string {
      const chip = root.querySelector<HTMLElement>(`[data-eg-rail="${this.vm.categories[idx].key}"]`);
      return chip === null ? '' : getComputedStyle(chip).getPropertyValue('--eg-c').trim();
    },
    /**
     * The light's hotspot for a category (0–1 of the podium's width): under its rail chip, pulled most of the way back
     * towards the centre — the light LEANS to the category, it never leaves the podium.
     */
    hotspotOf(root: HTMLElement, beam: HTMLElement, idx: number): number {
      const chip = root.querySelector<HTMLElement>(`[data-eg-rail="${this.vm.categories[idx].key}"]`)?.getBoundingClientRect();
      const box = beam.getBoundingClientRect();
      if (chip === undefined || box.width <= 0) {
        return 0.5;
      }
      const frac = (chip.left + chip.width / 2 - box.left) / box.width;
      return Math.min(0.85, Math.max(0.15, 0.5 + (frac - 0.5) * 0.6));
    },
    /**
     * A SEAT'S MEDALLION IGNITES (T08; CI): a soft RISE of the medallion itself — its disc settles from a hair under
     * its size while the CSS brings it up from dim (`--on`, the same length, ease-out). No ring, no flash, no attack:
     * the light that brought the points is the podium's one wash. The value and the segment are the template's (the
     * ignition is state); a zero rises without the settle (no fake celebration). Under the director's clock; reduced
     * motion plays none of it.
     */
    igniteMedal(ignition: CeremonyIgnition, attach: (tween: gsap.core.Animation) => void): void {
      const root = this.$el as HTMLElement | undefined;
      const cat = this.vm.categories[ignition.catIdx];
      if (root === undefined || cat === undefined || ignition.value === 0 || this.reduced) {
        return;
      }
      const disc = root.querySelector<HTMLElement>(`[data-eg-row="${ignition.color}"] [data-eg-medal="${cat.key}"] .con-dscore__disc`);
      if (disc === null) {
        return;
      }
      const settle = () => gsap.set(disc, {clearProps: 'transform'});
      attach(gsap.fromTo(disc, {scale: 0.92},
        {scale: 1, duration: ignition.ms / 1000, ease: 'power2.out', onComplete: settle, onInterrupt: settle}));
    },
    /** Put the light out at once (a skip, a replay, a teardown) — the wash at rest, the beam dark. */
    putOutLight(): void {
      const wash = this.$refs.washEl as HTMLCanvasElement | undefined;
      if (wash !== undefined) {
        gsap.killTweensOf(wash);
        gsap.set(wash, {opacity: 0, clearProps: 'transform'});
      }
      gsap.killTweensOf(this.light);
      this.beamCat = undefined;
    },
    /** The champion FIX accent — one strong, restrained beat on every champion
     *  total, EQUAL across a shared championship (no «main» champion): a gold
     *  ping + a single GSAP scale pulse on the number (deliberately not a CSS
     *  class — swapping the number's `animation` would restart the winner
     *  crown pulse when the phase class drops). Reduced motion keeps only the
     *  keel's semantic appearance (the fx module spawns nothing, the pulse is
     *  skipped). Tweens register with the director's cleanup, so an unmount
     *  or safety-net finalize can never strand a half-scaled number. */
    fireChampionFx(): void {
      void this.$nextTick(() => {
        const rowsEl = this.$refs.rowsEl as HTMLElement | undefined;
        for (const color of this.vm.winners) {
          const host = rowsEl?.querySelector<HTMLElement>(`[data-eg-row="${color}"] .con-eg__total`);
          if (host !== null && host !== undefined) {
            this.bursts.push(playCeremonyBurst({
              host, accent: 'gold', reduced: this.reduced, intensity: 'ping',
            }));
          }
          if (this.reduced) {
            continue;
          }
          const num = rowsEl?.querySelector<HTMLElement>(`[data-eg-row="${color}"] .con-eg__total-num`);
          if (num !== null && num !== undefined) {
            const tween = gsap.fromTo(num,
              {scale: 1},
              {scale: 1.14, duration: consoleMotionMs(260) / 1000, ease: 'power2.out', yoyo: true, repeat: 1, clearProps: 'transform'});
            this.handle?.addCleanup(() => {
              tween.kill();
              gsap.set(num, {clearProps: 'transform'});
            });
          }
        }
      });
    },
    /** The winner burst — full on the first winner row, a quiet ping on
     *  co-winners (one main focus, even in a shared victory). */
    fireWinnerFx(): void {
      if (this.soloDefeat) {
        return; // a defeat gets a calm row, never a celebration
      }
      void this.$nextTick(() => {
        const rowsEl = this.$refs.rowsEl as HTMLElement | undefined;
        this.vm.winners.forEach((color, i) => {
          const host = rowsEl?.querySelector<HTMLElement>(`[data-eg-row="${color}"]`);
          if (host !== null && host !== undefined) {
            // CI (decision 8): ONE wave with a soft attack — never the strobing rings / flash / sparks of the full
            // burst; a co-winner's is the same wave, quieter.
            this.bursts.push(playCeremonyBurst({
              host, accent: 'gold', reduced: this.reduced, intensity: i === 0 ? 'wave' : 'wave-quiet',
            }));
          }
        });
      });
    },
    // ── the campaign scene ────────────────────────────────────────────────
    titleArtUrl,
    /** Explicit A on «Хроника кампании» / the map door (D9). */
    openCampaignScene(): void {
      this.campaignScene = 'map';
    },
    /**
     * «СЛЕДУЮЩАЯ МИССИЯ» — the one continuation press. A live mission is
     * entered directly (the launch already happened); otherwise the map scene
     * opens and runs the interlude flow (carryover step → launch / waiting).
     */
    runCampaignNext(): void {
      const link = this.campaignNextLink;
      if (link !== undefined) {
        const endpoint = currentServerEndpoint();
        if (endpoint !== undefined) {
          // LAN guest: the mission lives on the SAME pinned server.
          pinServerEndpoint(link.playerId, endpoint);
        }
        recordLastGameEntered(link.gameId ?? '');
        // The curtain carries the NEXT mission's identity — the campaign
        // contract of the finished game knows its own slot and count.
        const contract = this.campaignContract;
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(link.playerId), 'expedition',
          contract === undefined ? undefined : {
            kind: 'campaign-mission',
            mission: Math.min(contract.missionSlot + 2, contract.missionCount),
            missionCount: contract.missionCount,
            resume: false,
          });
        return;
      }
      this.openCampaignScene();
    },
    closeCampaignScene(): void {
      // B never silently confirms or discards: the server keeps whatever was
      // last CONFIRMED (the map's own picker state closes with the scene).
      this.campaignScene = undefined;
    },
    // ── input (delegated by the shell) ────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      // ⚠ COLLAPSED, THIS IS NOT CALLED AT ALL. The shell routes on
      // `endgameStageUp` (mounted AND showing): past «Свернуть» the pad
      // belongs to the post-game READ-ONLY FREE ROAM — the board, the
      // journal, «Разыграно», Information, the colonies — and the shell's own
      // board-home B calls `expandFromBoard()` when there is nothing shallower
      // left to close. A hidden scene must never eat a press; this one did,
      // and the whole inspection was a static board with one live button.
      if (this.ui.collapsed) {
        return;
      }
      // The OVERVIEW SCENE owns the pad while it stands (entering included —
      // a transition must never absorb input). Its `leaving` beat belongs to
      // the scoring scene the player is returning to.
      if (this.overviewParked) {
        (this.$refs.overview as InstanceType<typeof ConsoleEndgameOverview> | undefined)?.handleIntent(intent);
        return;
      }
      // THE CAMPAIGN SCENE owns the pad while it stands (the same law).
      if (this.campaignScene === 'map') {
        (this.$refs.campaignMap as {handleIntent?: (i: GamepadIntent) => boolean} | undefined)?.handleIntent?.(intent);
        return;
      }
      // THE MANDATORY CHAMPION CEREMONY absorbs the whole pad: no skip (X),
      // no collapse (B), no confirm (A), no navigation — mashing lands on
      // nothing and can never break the sequence. Control returns atomically
      // when the director reaches `actions`; if anything goes wrong first,
      // the director's safety net / unmount finalize there anyway, so the
      // lock is bounded by construction.
      if (this.ui.phase === 'champion') {
        return;
      }
      if (intent.kind === 'nav') {
        if (this.ui.phase === 'actions') {
          const delta = intent.dir === 'down' || intent.dir === 'right' ? 1 : -1;
          const len = this.actions.length;
          this.ui.actionsFocus = (this.ui.actionsFocus + delta + len) % len;
        }
        return;
      }
      const action = consoleActionOf(intent);
      if (action === undefined) {
        return;
      }
      if (this.ui.phase !== 'actions') {
        // X — the one labelled hurry verb (only while a count is left to
        // hurry); B parks the ceremony (pause + board). A/Y deliberately do
        // nothing: the count is not a dialog.
        if (action === 'inspect') {
          if (this.countHurriable) {
            this.hurryCeremony();
          }
        } else if (action === 'back') {
          this.collapseToBoard();
        }
        return;
      }
      if (action === 'primary') {
        const a = this.actions[this.ui.actionsFocus];
        if (a !== undefined && a.enabled !== false) {
          a.run();
        }
      } else if (action === 'back') {
        // B at the settled root: «Свернуть» — the final board, inspectable.
        this.collapseToBoard();
      }
    },
  },
});
</script>
