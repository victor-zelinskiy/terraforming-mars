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
       :class="{'con-endgame--noanim': noanim, 'con-endgame--ovopen': overviewParked || campaignScene !== undefined, ['con-endgame--' + ui.phase]: true}">
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
        <!-- CATEGORY RAIL — one stable strip; the ACTIVE category is the
             spotlight (bright, lifted, accent-lit), settled ones stay
             readable, future ones wait dim. Identity = colour + position +
             name (never colour alone). -->
        <div class="con-eg__rail">
          <div v-for="(cat, i) in vm.categories" :key="cat.key"
               class="con-eg__lchip" :class="lchipClass(cat, i)" :style="{'--eg-ci': i}">
            <span class="con-eg__ldot" aria-hidden="true"></span>
            <span class="con-eg__lname">{{ $t(cat.legend) }}</span>
          </div>
        </div>

        <!-- STAGE CAPTION — the micro-reveal voice (a TR source, a card
             family, the full category name during its focus beat). Layered
             crossfade: the line hands over without an empty beat. -->
        <div class="con-eg__caption" aria-live="polite">
          <transition name="con-eg-xfade">
            <span :key="captionKey" class="con-eg__caption-text" :class="captionAccent">{{ captionText }}</span>
          </transition>
        </div>

        <!-- THE ROWS — all players, one comparable composition. -->
        <div ref="rowsEl" class="con-eg__rows">
          <div v-for="(color, i) in rowOrder" :key="color"
               class="con-eg__row" :class="rowClass(color)"
               :data-eg-row="color" :style="{'--eg-i': i}">
            <div v-if="rowRibbon(color) !== undefined" class="con-eg__ribbon"
                 :class="{'con-eg__ribbon--defeat': soloDefeat}">{{ $t(rowRibbon(color)!) }}</div>
            <div class="con-eg__place" aria-hidden="true">
              <span v-if="ui.placesShown" class="con-eg__place-num">{{ rowBy(color).place }}</span>
              <span v-else class="con-eg__place-dot"></span>
            </div>
            <div class="con-eg__ident">
              <span class="con-eg__swatch" :class="'player_bg_color_' + color" aria-hidden="true"></span>
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
            <div class="con-eg__track">
              <div class="con-eg__bar">
                <div v-for="seg in rowGeo[color].segs" :key="seg.key"
                     class="con-eg__seg" :class="segClass(seg)"
                     :style="{left: seg.leftPct + '%', width: seg.widthPct + '%'}">
                  <div v-for="sub in seg.subs" :key="sub.key"
                       class="con-eg__subseg" :class="subClass(seg, sub)"
                       :style="{left: sub.leftPct + '%', width: sub.widthPct + '%'}"></div>
                </div>
                <!-- The subtractive SCAR — the bar's tip retreats over it when
                     the penalty lands; it stays as the deduction's witness. -->
                <div v-if="rowGeo[color].reclaim !== undefined" class="con-eg__reclaim"
                     :class="{'con-eg__reclaim--on': reclaimOn(color)}"
                     :style="{left: rowGeo[color].reclaim!.leftPct + '%', width: rowGeo[color].reclaim!.widthPct + '%'}"></div>
                <!-- Values INSIDE wide segments (clipped by the bar). -->
                <span v-for="lab in insideLabels(color)" :key="lab.key"
                      class="con-eg__inlab" :class="labelStateClass(lab)"
                      :style="{left: lab.xPct + '%'}">{{ fmtLabel(lab.value) }}</span>
              </div>
              <!-- The «+N» chip lives OUTSIDE the bar (its clip would eat it),
                   riding the same growth edge over the track. -->
              <transition name="con-eg-chip">
                <span v-if="chipFor(color) !== undefined" :key="chipFor(color)!.seq"
                      class="con-eg__chip" :class="{'con-eg__chip--minus': chipFor(color)!.value < 0}"
                      :style="{left: chipEdgePct(color) + '%'}">
                  {{ chipFor(color)!.value > 0 ? '+' + chipFor(color)!.value : chipFor(color)!.value }}
                </span>
              </transition>
              <!-- Tie-break M€ — absolute over the track's tail: appearing
                   evidence may never re-flow the bar it explains. -->
              <div v-if="tieChipVisible(color)" class="con-eg__tiechip">
                <i class="resource_icon resource_icon--megacredits con-eg__mc-icon" aria-hidden="true"></i>
                <b>{{ rowBy(color).megacredits }}</b>
              </div>
              <!-- Values BELOW the bar for narrow segments — anchored at
                   their segment's centre, collision-nudged, never re-flowed. -->
              <div class="con-eg__labels">
                <span v-for="lab in belowLabels(color)" :key="lab.key"
                      class="con-eg__blab" :class="labelStateClass(lab)"
                      :style="{left: lab.xPct + '%', '--eg-nudge': lab.nudgePx + 'px'}">{{ fmtLabel(lab.value) }}</span>
              </div>
            </div>
            <div class="con-eg__total">
              <!-- No binding on the number: the count-up writes textContent
                   directly (a reactive write per frame re-lays the row). -->
              <span class="con-eg__total-num" :data-eg-total="color">0</span>
              <span class="con-eg__total-cap">{{ $t('VP') }}</span>
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
        <!-- ── CAMPAIGN «ТИТУЛЫ» — the ceremony's campaign coda (missions 1–3):
             titles ascend Prefect → Administrator → Governor (the Governor is
             the climax), each with its Title Points; the comeback M€ of the
             NEXT mission is a separate line — a seat can have one without a
             title. Final mission: the champion beat instead. Data is the
             SERVER'S committed result (campaignState), never a client guess. -->
        <transition name="con-eg-fade">
          <div v-if="campaignCodaVisible" class="con-eg-titles" :class="{'con-eg-titles--animate': campaignCodaAnimated}">
            <div class="con-eg-titles__kicker" v-i18n>{{ campaignContract !== undefined && campaignContract.final ? 'Campaign champion' : 'Titles' }}</div>
            <div class="con-eg-titles__rows">
              <div v-for="(row, i) in campaignTitleRows" :key="'t' + row.seat + row.title"
                   class="con-eg-titles__row" :class="'con-eg-titles__row--' + row.title" :style="{'--egt-i': i}">
                <img class="con-eg-titles__emblem" :src="titleArtUrl(row.title)" :alt="$t(row.label)" draggable="false" />
                <span class="con-eg-titles__cube" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
                <span class="con-eg-titles__name">{{ row.name }}</span>
                <span class="con-eg-titles__tlabel">{{ $t(row.label) }}<template v-if="row.shared"> · <span v-i18n>shared place</span></template></span>
                <span class="con-eg-titles__tp">+{{ row.titlePoints }} <span v-i18n>TP</span></span>
                <span v-if="row.bonus > 0" class="con-eg-titles__bonus">{{ nextMissionBonusText(row.bonus) }}</span>
              </div>
              <div v-for="row in campaignBonusOnlyRows" :key="'b' + row.seat"
                   class="con-eg-titles__row con-eg-titles__row--bonus" :style="{'--egt-i': campaignTitleRows.length}">
                <span class="con-eg-titles__emblem con-eg-titles__emblem--none" aria-hidden="true"></span>
                <span class="con-eg-titles__cube" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
                <span class="con-eg-titles__name">{{ row.name }}</span>
                <span class="con-eg-titles__bonus">{{ nextMissionBonusText(row.bonus) }}</span>
              </div>
              <div v-for="seat in campaignChampionRows" :key="'c' + seat.seat" class="con-eg-titles__row con-eg-titles__row--champion">
                <img class="con-eg-titles__emblem" :src="titleArtUrl('governor')" :alt="$t('Campaign champion')" draggable="false" />
                <span class="con-eg-titles__cube" :class="'player_bg_color_' + seat.color" aria-hidden="true"></span>
                <span class="con-eg-titles__name">{{ seat.name }}</span>
                <span class="con-eg-titles__tlabel" v-i18n>Campaign champion</span>
              </div>
            </div>
            <div v-if="campaignResultPending" class="con-eg-titles__pending" v-i18n>Committing the mission result…</div>
          </div>
        </transition>
        <div class="con-eg__final">
          <transition name="con-eg-fade">
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
                <span class="con-eg__action-label">{{ $t(a.label) }}</span>
                <span v-if="a.note !== undefined" class="con-eg__action-note">{{ a.note }}</span>
              </div>
            </div>
          </transition>
        </div>
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

    <!-- ── CAMPAIGN SCENES — internal scenes of this same workspace (the
         overview pattern): the scoring stage parks under them and returns on
         B. Never a modal, never a trip through the main menu. -->
    <div v-if="campaignScene === 'map'" class="con-eg-campaign-scene">
      <ConsoleCampaignMap ref="campaignMap" :embedded="true" @close="closeCampaignScene" />
    </div>
    <div v-else-if="campaignScene === 'carryover'" class="con-eg-campaign-scene con-eg-campaign-scene--carry">
      <ConsoleCarryoverPicker
        ref="carryPicker"
        :embedded="false"
        :eligible="carryEligible"
        :selected="carryDraft"
        :confirmed="carryConfirmed && !carryDirty"
        :submitting="campaign.submittingCarryover"
        :error="campaign.error"
        @toggle="toggleCarry($event)"
        @confirm="confirmCarry"
        @back="closeCampaignScene"
      />
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The scoring WORKSPACE component. Rendering + input + the DOM moments the
 * director cannot know (the ranking FLIP, the winner burst, the direct
 * count-up sink); the numbers live in the pure VM, the bar geometry and the
 * anchored-label plan in the pure layout module, the choreography in the
 * script/director, the observable stages in the module state — all
 * unit-tested without this file.
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
  buildConsoleEndgameVm, ConsoleEndgameVm, ConsoleEndgameCategory, ConsoleEndgameRow,
} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildRowGeometry, planValueLabels, progressEdgePct,
  EndgameRowGeo, EndgameSegGeo, EndgameSubGeo, EndgameValueLabel,
} from '@/client/console/endgame/consoleEndgameLayout';
import {CEREMONY_MS} from '@/client/console/endgame/consoleEndgameScript';
import {runEndgameCeremony, CeremonyHandle} from '@/client/console/endgame/consoleEndgameDirector';
import {
  consoleEndgameUi, ceremonyShouldPlay, resetCeremonyProgress, finalizeCeremony,
} from '@/client/console/endgame/consoleEndgameState';
import {
  consoleOverviewUi, openEndgameOverview, OVERVIEW_MS,
} from '@/client/console/endgame/consoleOverviewState';
import ConsoleEndgameOverview from '@/client/components/console/ConsoleEndgameOverview.vue';
// Campaign mode: the mission coda («Титулы» / champion), the carryover scene
// and the embedded Campaign Map (docs/CAMPAIGN_MODE_ARCHITECTURE.md §5.3).
import {CardName} from '@/common/cards/CardName';
import {isPlayerId} from '@/common/Types';
import {TitleName} from '@/common/campaign/CampaignTypes';
import {CampaignGameContract} from '@/common/campaign/CampaignGameContract';
import {MissionResultModel} from '@/common/campaign/CampaignModel';
import {
  campaignState, openCampaign, setCampaignViewerName, startCampaignWatch, stopCampaignWatch, submitCampaignCarryover,
} from '@/client/console/campaign/campaignState';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import ConsoleCampaignMap from '@/client/components/console/campaign/ConsoleCampaignMap.vue';
import ConsoleCarryoverPicker from '@/client/components/console/campaign/ConsoleCarryoverPicker.vue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

type PostGameAction = {
  id: string,
  label: string, // i18n KEY
  note?: string, // pre-rendered (counts) — never a key
  enabled?: boolean,
  run: () => void,
};

export default defineComponent({
  name: 'ConsoleEndgameWorkspace',
  components: {ConsoleEndgameOverview, ConsoleCampaignMap, ConsoleCarryoverPicker},
  props: {
    playerView: {type: Object as PropType<ViewModel>, required: true},
  },
  setup() {
    const {reduced} = useConsoleReducedMotion();
    const {width: vpWidth} = useConsoleViewport();
    return {reduced, vpWidth};
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
      /** Measured track width, px — the label plan's one DOM input. */
      trackPx: 0,
      /** Resolved label font size, px (the plan's glyph-width estimate). */
      labelFontPx: 14,
      totalEls: {} as Record<string, HTMLElement | undefined>,
      /** Campaign scenes — internal, the overview pattern (park + return). */
      campaignScene: undefined as undefined | 'map' | 'carryover',
      /** The coda animates only when the ceremony itself played live. */
      campaignCodaAnimated: false,
      carryDraft: [] as Array<CardName>,
      carryDirty: false,
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
    campaign() {
      return campaignState;
    },
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
    campaignResultPending(): boolean {
      return this.campaignContract !== undefined && this.campaignResult === undefined;
    },
    campaignCodaVisible(): boolean {
      return this.campaignContract !== undefined &&
        this.ui.phase === 'actions' && !this.overviewParked && this.campaignScene === undefined && !this.ui.collapsed;
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
    /** Comeback M€ without a title — a separate consequence, shown separately. */
    campaignBonusOnlyRows(): ReadonlyArray<{seat: number, name: string, color: Color, bonus: number}> {
      const result = this.campaignResult;
      if (result === undefined || this.campaignContract?.final === true) {
        return [];
      }
      const titled = new Set(result.titles.map((t) => t.seat));
      return result.bonuses.filter((b) => !titled.has(b.seat)).map((b) => {
        const who = this.campaignSeatName(b.seat);
        return {seat: b.seat, name: who.name, color: who.color, bonus: b.megaCredits};
      });
    },
    campaignChampionRows(): ReadonlyArray<{seat: number, name: string, color: Color}> {
      const result = this.campaignResult;
      if (result === undefined || this.campaignContract?.final !== true) {
        return [];
      }
      return (result.championSeats ?? []).map((seat) => ({seat, ...this.campaignSeatName(seat)}));
    },
    /** The viewer's carryover door data (owner-only wire fields). */
    carryEligible(): ReadonlyArray<CardName> {
      return campaignState.model?.carryover?.yourEligible ?? [];
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
    /** ONE endgame model for the ceremony AND the overview. The facts feed
     *  only the insight/episode engines — every scoring number is identical
     *  with or without them, so a late fetch never moves a settled bar. */
    model(): EndgameModel {
      return endgameModelFromView(this.playerView, cachedEndgameFacts(this.playerView.id));
    },
    vm(): ConsoleEndgameVm {
      const order = this.playerView.players.map((p) => p.color);
      return buildConsoleEndgameVm(this.model, order, {botColors: botColorsFromView(this.playerView)});
    },
    densityN(): number {
      return Math.min(Math.max(this.vm.rows.length, 2), 5);
    },
    headTitle(): string {
      return this.ui.phase === 'actions' ? 'Game results' : 'Final scoring';
    },
    rowOrder(): ReadonlyArray<Color> {
      return this.ui.ranked ? this.vm.rankedColors : this.vm.rows.map((r) => r.color);
    },
    /** Per-row track geometry — solved from the VM alone, cached by Vue. */
    rowGeo(): Record<string, EndgameRowGeo> {
      const out: Record<string, EndgameRowGeo> = {};
      for (const row of this.vm.rows) {
        out[row.color] = buildRowGeometry(this.vm, row.color);
      }
      return out;
    },
    /** Per-row anchored value labels — recomputed only when the measured
     *  track width (or the VM) changes, never during the count. */
    labelPlan(): Record<string, ReadonlyArray<EndgameValueLabel>> {
      const out: Record<string, ReadonlyArray<EndgameValueLabel>> = {};
      if (this.trackPx <= 0) {
        return out;
      }
      const charPx = this.labelFontPx * 0.62;
      for (const row of this.vm.rows) {
        out[row.color] = planValueLabels(this.vm, row.color, this.rowGeo[row.color], {
          trackPx: this.trackPx,
          charPx,
          insidePadPx: this.labelFontPx * 1.15,
          minGapPx: this.labelFontPx * 0.6,
        });
      }
      return out;
    },
    activeCategory(): ConsoleEndgameCategory | undefined {
      return this.ui.catIdx >= 0 ? this.vm.categories[this.ui.catIdx] : undefined;
    },
    captionText(): string {
      const cat = this.activeCategory;
      if (cat === undefined) {
        return '';
      }
      const sub = this.ui.subIdx >= 0 ? cat.subs[this.ui.subIdx] : undefined;
      if (sub !== undefined) {
        return this.$t(sub.label);
      }
      return this.$t(cat.label);
    },
    captionKey(): string {
      return `${this.ui.catIdx}:${this.ui.subIdx}`;
    },
    captionAccent(): string {
      const cat = this.activeCategory;
      return cat !== undefined ? `con-eg-ink--${cat.accent}` : '';
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
        return 'Shared victory';
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
        if (!contract.final && this.viewerHasCarryDoor) {
          out.push({
            id: 'campaign-carry',
            label: 'Project legacy',
            note: $t(this.carryConfirmed ? 'selection confirmed' : 'selection pending'),
            run: () => this.openCarryScene(),
          });
        }
        out.push({
          id: 'campaign-map',
          label: contract.final ? 'Campaign chronicle' : 'Campaign map',
          run: () => this.openCampaignScene(),
        });
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
        run: () => navigateWithCurtain('/'),
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
      if (this.campaignScene === 'map') {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Confirm'},
          {control: 'secondary', label: 'Mission dossier'},
          {control: 'inspect', label: 'Campaign dossier'},
          {control: 'back', label: 'Game results', priority: 5},
        ];
      }
      if (this.campaignScene === 'carryover') {
        return [
          {control: 'dpadH', label: 'Choose'},
          {control: 'confirm', label: 'Take / return'},
          {control: 'secondary', label: this.carryDraft.length === 0 ? 'Continue without cards' : 'Keep the selection', highlight: true, priority: 0},
          {control: 'back', label: 'Game results', priority: 5},
        ];
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
        // The count runs: B parks it (pause + board), X skips it — quietly
        // labelled, never the loudest thing on screen (the ceremony is the
        // point). A deliberately does nothing (the count is not a dialog).
        return [
          {control: 'back', label: 'Minimize'},
          {control: 'secondary', label: 'Skip scoring', priority: 0},
        ];
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
    // Viewport change (profile flip / window resize): re-measure the track
    // and let the label plan re-solve against the new width.
    vpWidth(): void {
      void this.$nextTick(() => this.measureTrack());
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
      this.measureTrack();
      this.writeAllTotals();
    });
  },
  beforeUnmount() {
    this.teardown();
    clearPanelCommands('endgame');
    if (this.campaignContract !== undefined) {
      stopCampaignWatch();
      setCampaignViewerName(undefined);
    }
  },
  methods: {
    rowBy(color: Color): ConsoleEndgameRow {
      const row = this.vm.rows.find((r) => r.color === color);
      // Every color in rowOrder/winners comes from the VM itself.
      return row ?? this.vm.rows[0];
    },
    fmtLabel(v: number): string {
      return v < 0 ? '−' + Math.abs(v) : String(v);
    },
    chipFor(color: Color): {value: number, seq: number} | undefined {
      return this.ui.chips[color];
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
    measureTrack(): void {
      // A hidden scene (collapse / overview round trip) measures 0 — keep
      // the last honest width instead of collapsing the label plan.
      const bar = (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-eg__bar');
      const w = bar?.clientWidth ?? 0;
      if (w > 0) {
        this.trackPx = w;
      }
      const labels = (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-eg__labels');
      if (labels !== null && labels !== undefined) {
        const fs = parseFloat(getComputedStyle(labels).fontSize);
        if (Number.isFinite(fs) && fs > 0) {
          this.labelFontPx = fs;
        }
      }
    },
    // ── layout state ─────────────────────────────────────────────────────
    insideLabels(color: Color): Array<EndgameValueLabel> {
      return (this.labelPlan[color] ?? []).filter((l) => l.mode === 'inside');
    },
    belowLabels(color: Color): Array<EndgameValueLabel> {
      return (this.labelPlan[color] ?? []).filter((l) => l.mode === 'below');
    },
    labelStateClass(lab: EndgameValueLabel): Record<string, boolean> {
      return {
        ['con-eg-ink--' + lab.accent]: lab.mode === 'below',
        'con-eg__vlab--on': lab.catIdx < this.ui.catsSettled,
        'con-eg__vlab--zero': lab.zero,
        'con-eg__vlab--minus': lab.value < 0,
      };
    },
    segOn(idx: number): boolean {
      if (idx < this.ui.catsSettled) {
        return true;
      }
      // The active category's own segment lights during grow/settle — never
      // during its focus beat (the spotlight prepares, the grow delivers).
      return idx === this.ui.catIdx && this.ui.beatStage !== 'focus';
    },
    subOn(idx: number, cat: ConsoleEndgameCategory, sidx: number): boolean {
      if (idx < this.ui.catsSettled) {
        return true;
      }
      if (idx !== this.ui.catIdx) {
        return false;
      }
      return (this.ui.subsOn[cat.key] ?? 0) > sidx;
    },
    reclaimOn(color: Color): boolean {
      const reclaim = this.rowGeo[color].reclaim;
      if (reclaim === undefined) {
        return false;
      }
      if (reclaim.catIdx < this.ui.catsSettled) {
        return true;
      }
      return reclaim.catIdx === this.ui.catIdx && this.ui.beatStage !== 'focus';
    },
    chipEdgePct(color: Color): number {
      const cat = this.activeCategory;
      const subsOn = cat !== undefined ? (this.ui.subsOn[cat.key] ?? 0) : 0;
      return progressEdgePct(this.vm, color, this.ui.catsSettled, this.ui.catIdx, subsOn);
    },
    // ── classes ───────────────────────────────────────────────────────────
    lchipClass(cat: ConsoleEndgameCategory, i: number): Record<string, boolean> {
      return {
        ['con-eg-cat--' + cat.accent]: true,
        'con-eg__lchip--active': i === this.ui.catIdx && this.ui.phase === 'scoring',
        'con-eg__lchip--done': i < this.ui.catsSettled,
      };
    },
    segClass(seg: EndgameSegGeo): Record<string, boolean> {
      const merged = this.ui.merged[seg.key] === true || seg.subs.length <= 1;
      return {
        ['con-eg-cat--' + seg.accent]: true,
        'con-eg__seg--on': this.segOn(seg.catIdx),
        'con-eg__seg--merged': merged,
      };
    },
    subClass(seg: EndgameSegGeo, sub: EndgameSubGeo): Record<string, boolean> {
      const merged = this.ui.merged[seg.key] === true || seg.subs.length <= 1;
      const cat = this.vm.categories[seg.catIdx];
      return {
        'con-eg__subseg--on': this.subOn(seg.catIdx, cat, sub.idx),
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
        'con-eg__row--solo-defeat': this.soloDefeat && this.ui.winnerShown,
        // The rest of the table steps back HALF a tone — readable, never grey noise.
        'con-eg__row--rest': this.ui.winnerShown && !winner && this.vm.winners.length > 0,
        'con-eg__row--contender': contender,
        'con-eg__row--bot': this.rowBy(color).isBot,
      };
    },
    rowRibbon(color: Color): string | undefined {
      if (!this.ui.winnerShown) {
        return undefined;
      }
      if (this.vm.mode === 'solo') {
        return this.vm.soloWin ? 'Victory' : 'Defeat';
      }
      return this.vm.winners.includes(color) ? 'Winner' : undefined;
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
      this.handle = runEndgameCeremony(this.vm, {
        onRankFlip: () => this.performRankFlip(),
        onWinnerFx: () => this.fireWinnerFx(),
        onCount: (color, value) => this.writeTotal(color, value),
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
      const first = new Map<string, number>();
      rowsEl.querySelectorAll<HTMLElement>('[data-eg-row]').forEach((el) => {
        first.set(el.dataset.egRow ?? '', el.getBoundingClientRect().top);
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
          const dy = from - el.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) {
            continue;
          }
          tweens.push(gsap.fromTo(el,
            {y: dy},
            {y: 0, duration: consoleMotionMs(CEREMONY_MS.rankFlip) / 1000, ease: 'power3.inOut', clearProps: 'transform'}));
        }
        this.handle?.addCleanup(() => {
          for (const t of tweens) {
            t.kill();
          }
          gsap.set(els, {clearProps: 'transform'});
        });
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
            this.bursts.push(playCeremonyBurst({
              host, accent: 'gold', reduced: this.reduced, intensity: i === 0 ? 'full' : 'ping',
            }));
          }
        });
      });
    },
    // ── campaign scenes ───────────────────────────────────────────────────
    titleArtUrl,
    nextMissionBonusText(bonus: number): string {
      return translateTextWithParams('Next mission: +${0} M€', [String(bonus)]);
    },
    /** Explicit A on «Карта кампании» — the ceremony → map handoff (D9). */
    openCampaignScene(): void {
      this.campaignScene = 'map';
    },
    openCarryScene(): void {
      this.carryDraft = [...(campaignState.model?.carryover?.yourCards ?? [])];
      this.carryDirty = false;
      this.campaignScene = 'carryover';
    },
    closeCampaignScene(): void {
      // B never silently confirms or discards: the server keeps whatever was
      // last CONFIRMED; the local draft simply closes.
      this.campaignScene = undefined;
      this.carryDirty = false;
    },
    toggleCarry(name: CardName): void {
      const idx = this.carryDraft.indexOf(name);
      if (idx >= 0) {
        this.carryDraft.splice(idx, 1);
      } else if (this.carryDraft.length < 2) {
        this.carryDraft.push(name);
      }
      this.carryDirty = true;
    },
    async confirmCarry(): Promise<void> {
      // The bearer credential is THIS mission's own seat — this game IS the
      // carryover's source mission.
      const playerId = this.playerView.id;
      if (playerId === undefined || !isPlayerId(playerId)) {
        return;
      }
      const ok = await submitCampaignCarryover(playerId, this.carryDraft);
      if (ok) {
        this.carryDirty = false;
        this.campaignScene = undefined;
      }
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
      // CAMPAIGN SCENES own the pad while they stand (the same law).
      if (this.campaignScene === 'map') {
        (this.$refs.campaignMap as {handleIntent?: (i: GamepadIntent) => boolean} | undefined)?.handleIntent?.(intent);
        return;
      }
      if (this.campaignScene === 'carryover') {
        (this.$refs.carryPicker as {handleIntent?: (i: GamepadIntent) => boolean} | undefined)?.handleIntent?.(intent);
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
        // X — the one labelled skip verb; B parks the ceremony (pause +
        // board). A/Y deliberately do nothing: the count is not a dialog.
        if (action === 'inspect') {
          this.skipCeremony();
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
