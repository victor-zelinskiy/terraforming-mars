<template>
  <section class="con-hydro" role="region" :aria-label="$t('Mars Hydronetwork')">
    <!-- ── HEADER BAND: identity + live status chips ─────────────────── -->
    <header class="con-hydro__head">
      <div class="con-hydro__id">
        <span class="con-hydro__glyph" aria-hidden="true">≈</span>
        <div class="con-hydro__titles">
          <h2 class="con-hydro__title">{{ $t('Mars Hydronetwork') }}</h2>
          <p class="con-hydro__sub">{{ $t('A joint engineering megaproject: spend energy to advance; only the stage you stop on grants its reward.') }}</p>
        </div>
      </div>
      <!-- No ⚡-stock chip here: the left resource panel stays visible in the
           hydro section — the header never duplicates it. Energy shows only
           CONTEXTUALLY (cost vs have in Требования, N → N−K in the confirm). -->
      <div class="con-hydro__chips">
        <span class="con-hydro__chip">
          <span class="con-hydro__chip-dim">{{ $t('Track position') }}</span>
          <b>{{ model.currentPosition }} / 11</b>
        </span>
        <span class="con-hydro__chip con-hydro__chip--status" :class="'con-hydro__chip--' + statusKind">
          <span class="con-hydro__chip-dot" aria-hidden="true"></span>
          <span>{{ $t(statusLabel) }}</span>
        </span>
      </div>
    </header>

    <!-- ── PROGRESS RAIL: all 12 stops, the selected one magnified ───── -->
    <div class="con-hydro__rail" role="list">
      <template v-for="stop in stops" :key="stop.position">
        <span v-if="stop.position > 0" class="con-hydro__link" :class="'con-hydro__link--' + stop.linkKind" aria-hidden="true"></span>
        <div class="con-hydro__stop"
             role="listitem"
             :class="[
               'con-hydro__stop--' + stop.vm.state,
               stop.grade !== undefined ? 'con-hydro__stop--grade-' + stop.grade : '',
               {
                 'con-hydro__stop--focused': stop.vm.isSelected,
                 'con-hydro__stop--vp': stop.vm.stage.vp !== undefined,
                 'con-hydro__stop--dimmed': !globallyActable && stop.vm.state !== 'current' && stop.vm.state !== 'completed',
               },
             ]"
             @click="selectPosition(stop.position)">
          <div class="con-hydro__stop-req">
            <span v-if="stop.vm.stage.tag !== undefined" class="con-hydro__stop-tag resource-tag" :class="'tag-' + stop.vm.stage.tag" aria-hidden="true"></span>
            <span v-else-if="stop.vm.stage.vp !== undefined" class="con-hydro__stop-vp">{{ stop.vm.stage.vp }}<small>{{ $t('VP') }}</small></span>
            <span v-else class="con-hydro__stop-flag" aria-hidden="true">⚑</span>
            <span class="con-hydro__stop-num">{{ stop.position }}</span>
            <span v-if="stop.vm.rewardedByViewer" class="con-hydro__stop-badge con-hydro__stop-badge--done" aria-hidden="true">✓</span>
            <span v-else-if="stop.vm.skippedByViewer" class="con-hydro__stop-badge con-hydro__stop-badge--skip" aria-hidden="true">↷</span>
            <span v-else-if="stop.gradeGlyph !== ''" class="con-hydro__stop-badge con-hydro__stop-badge--grade" aria-hidden="true">{{ stop.gradeGlyph }}</span>
          </div>
          <!-- The magnified selected stop carries name + reward; compact stops stay glanceable. -->
          <template v-if="stop.vm.isSelected">
            <div class="con-hydro__stop-name">{{ $t(stop.vm.stage.nameKey) }}</div>
            <div class="con-hydro__stop-reward">
              <template v-if="stop.vm.stage.rewardOptions.length > 1">
                <HydroReward :chips="stop.vm.stage.rewardOptions[0]" :compact="true" />
                <span class="con-hydro__stop-or">{{ $t('or') }}</span>
                <HydroReward :chips="stop.vm.stage.rewardOptions[1]" :compact="true" />
              </template>
              <HydroReward v-else-if="stop.vm.stage.rewardOptions.length === 1" :chips="stop.vm.stage.rewardOptions[0]" :compact="true" />
              <span v-else-if="stop.vm.stage.vp === undefined" class="con-hydro__stop-noreward" aria-hidden="true">—</span>
            </div>
          </template>
          <div class="con-hydro__stop-markers">
            <span v-for="m in stop.vm.markers" :key="m.color"
                  class="con-hydro__stop-marker"
                  :class="['player_bg_color_' + m.color, {'con-hydro__stop-marker--viewer': m.isViewer}]"
                  aria-hidden="true"></span>
          </div>
        </div>
      </template>
    </div>

    <!-- ── DECISION PANEL: identity · requirements · reward + CTA ────── -->
    <div class="con-hydro__panel con-info__scroll">
      <!-- Column 1: stage identity + status + route + history -->
      <div class="con-hydro__col con-hydro__col--id">
        <div class="con-hydro__stage-id">
          <span v-if="selectedStage.tag !== undefined" class="con-hydro__stage-tag resource-tag" :class="'tag-' + selectedStage.tag" aria-hidden="true"></span>
          <span v-else-if="selectedStage.vp !== undefined" class="con-hydro__stage-vp">{{ selectedStage.vp }} {{ $t('VP') }}</span>
          <span v-else class="con-hydro__stage-flag" aria-hidden="true">⚑</span>
          <div class="con-hydro__stage-titles">
            <div class="con-hydro__stage-name">{{ $t(selectedStage.nameKey) }}</div>
            <div class="con-hydro__stage-pos">{{ stageOfText }}</div>
          </div>
        </div>
        <div class="con-hydro__stage-badge" :class="'con-hydro__stage-badge--' + stageBadge.kind">
          <span class="con-hydro__chip-dot" aria-hidden="true"></span>
          <span>{{ stageBadge.text }}</span>
        </div>
        <div v-if="model.mode === 'plan'" class="con-hydro__route">
          <span>{{ model.currentPosition }}</span>
          <span aria-hidden="true">→</span>
          <b>{{ model.selectedPosition }}</b>
          <span class="con-hydro__route-cost">
            −{{ model.selectedSpend }}
            <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
          </span>
        </div>
        <!-- Who has been here (plan: visitors · details: full history). -->
        <div v-if="historyRows.length > 0" class="con-hydro__history">
          <div class="con-hydro__section-label">{{ $t('Stage history') }}</div>
          <div v-for="h in historyRows" :key="h.color" class="con-hydro__history-row">
            <span class="con-hydro__history-dot" :class="'player_bg_color_' + h.color" aria-hidden="true"></span>
            <span class="con-hydro__history-name">{{ h.name }}</span>
            <span class="con-hydro__history-status">{{ $t(historyStatusText(h)) }}</span>
          </div>
        </div>
        <div v-else-if="model.mode === 'details' && model.selectedPosition === 0" class="con-hydro__start-note">
          {{ $t('The starting point of the Hydronetwork track.') }}
        </div>
      </div>

      <!-- Column 2: requirements (plan) / stage reward definition (details) -->
      <div class="con-hydro__col con-hydro__col--req">
        <template v-if="model.mode === 'plan'">
          <div class="con-hydro__section-label">{{ $t('Requirements') }}</div>
          <div v-if="requiredTags.length > 0" class="con-hydro__req-tags">
            <span v-for="(t, i) in requiredTags" :key="i"
                  class="con-hydro__req-tag"
                  :class="'con-hydro__req-tag--' + tagStatus(t)">
              <span class="resource-tag" :class="'tag-' + t" aria-hidden="true"></span>
              <span class="con-hydro__req-mark" aria-hidden="true">{{ tagStatus(t) === 'missing' ? '✕' : '✓' }}</span>
              <span v-if="tagStatus(t) === 'wild'" class="con-hydro__req-wild" aria-hidden="true">✱</span>
            </span>
          </div>
          <div v-if="hasWildCovered" class="con-hydro__req-legend">✱ {{ $t('Covered by a wild tag') }}</div>
          <div class="con-hydro__req-energy" :class="{'con-hydro__req-energy--short': !targetAffordable}">
            <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
            <b>{{ model.selectedSpend }}</b>
            <span class="con-hydro__req-have">{{ $t('You have') }}: {{ model.availableEnergy }}</span>
            <span class="con-hydro__req-mark" aria-hidden="true">{{ targetAffordable ? '✓' : '✕' }}</span>
          </div>
          <div v-if="model.destination !== undefined && model.destination.jumpedOverVp2" class="con-hydro__req-note">
            ⤴ {{ $t('The occupied 2 VP position is leapt over to reach the 5 VP slot.') }}
          </div>
          <div v-if="model.skippedStages.length > 0" class="con-hydro__req-note con-hydro__req-note--warn">
            ⚑ {{ $t('Skipped rewards') }}: {{ skippedNames }}
          </div>
        </template>
        <template v-else>
          <div class="con-hydro__section-label">{{ $t('Reward') }}</div>
          <div v-if="selectedStage.rewardOptions.length > 0" class="con-hydro__def-reward">
            <template v-if="selectedStage.rewardOptions.length > 1">
              <HydroReward :chips="selectedStage.rewardOptions[0]" />
              <span class="con-hydro__stop-or">{{ $t('or') }}</span>
              <HydroReward :chips="selectedStage.rewardOptions[1]" />
            </template>
            <HydroReward v-else :chips="selectedStage.rewardOptions[0]" />
          </div>
          <div v-else-if="selectedStage.vp !== undefined" class="con-hydro__vpline">
            <span class="con-hydro__stage-vp">{{ selectedStage.vp }} {{ $t('VP') }}</span>
            <span>{{ $t('VP at game end') }}</span>
          </div>
          <div v-else class="con-hydro__req-note">{{ $t('No reward') }}</div>
        </template>
      </div>

      <!-- Column 3: reward planning + CTA / specific reasons -->
      <div class="con-hydro__col con-hydro__col--act">
        <template v-if="model.mode === 'plan'">
          <!-- Bonus selector (pos 1/2) with the LB/RB glyphs AT the control. -->
          <template v-if="model.targetNeedsChoice && model.targetStage !== undefined">
            <div class="con-hydro__section-label con-hydro__bonus-head">
              <span>{{ $t('Bonus') }}</span>
              <span class="con-hydro__bonus-keys" aria-hidden="true">
                <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                <span>{{ $t('Switch bonus') }}</span>
              </span>
            </div>
            <div class="con-hydro__bonuses" :class="{'con-hydro__bonuses--attention': bonusAttention}">
              <div v-for="(opt, idx) in model.targetStage.rewardOptions" :key="idx"
                   class="con-hydro__bonus"
                   :class="{'con-hydro__bonus--selected': rewardChoice === idx}"
                   @click="onChoice(idx)">
                <HydroReward :chips="opt" />
                <span v-if="rewardChoice === idx" class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="con-hydro__section-label">{{ $t('You will gain') }}</div>
            <div class="con-hydro__gains">
              <div v-for="(l, i) in rewardView.lines" :key="i" class="con-hydro__delta" :class="{'con-hydro__delta--zero': l.delta === 0}">
                <span class="con-hydro__delta-ico" :class="{'con-hydro__delta-ico--prod': l.production}">
                  <span class="con-hydro__delta-img" :class="deltaIconClass(l)" aria-hidden="true"></span>
                </span>
                <span class="con-hydro__beforeafter"><b>{{ l.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydro__after">{{ l.after }}</b></span>
                <span v-if="l.delta !== 0" class="con-hydro__plus">+{{ l.delta }}</span>
                <span v-else class="con-hydro__zero">{{ $t('No change') }}</span>
                <span v-if="l.noteKey" class="con-hydro__delta-note">{{ $t(l.noteKey) }}: {{ l.noteValue }}</span>
              </div>
              <HydroReward v-if="rewardView.lines.length === 0 && rewardView.rawChips.length > 0" :chips="rewardView.rawChips" />
              <div v-if="rewardView.vp !== undefined" class="con-hydro__vpline">
                <span class="con-hydro__stage-vp">{{ rewardView.vp }} {{ $t('VP') }}</span>
                <span>{{ $t('VP at game end') }}</span>
              </div>
            </div>
          </template>

          <!-- Choice-stage deltas once a bonus IS chosen. -->
          <div v-if="model.targetNeedsChoice && rewardView.lines.length > 0" class="con-hydro__gains con-hydro__gains--chosen">
            <div v-for="(l, i) in rewardView.lines" :key="'c' + i" class="con-hydro__delta" :class="{'con-hydro__delta--zero': l.delta === 0}">
              <span class="con-hydro__delta-ico" :class="{'con-hydro__delta-ico--prod': l.production}">
                <span class="con-hydro__delta-img" :class="deltaIconClass(l)" aria-hidden="true"></span>
              </span>
              <span class="con-hydro__beforeafter"><b>{{ l.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydro__after">{{ l.after }}</b></span>
              <span v-if="l.delta !== 0" class="con-hydro__plus">+{{ l.delta }}</span>
              <span v-else class="con-hydro__zero">{{ $t('No change') }}</span>
            </div>
          </div>

          <!-- Pos 7/9 card pick — resolved via the console sheet (A). -->
          <div v-if="model.needsCardSelect !== undefined" class="con-hydro__pick">
            <template v-if="model.eligibleCardNames.length > 0">
              <span v-if="model.selectedCard !== undefined" class="con-hydro__pick-chosen">
                <b>{{ $t(model.selectedCard) }}</b>
                <span v-if="selectedAnimalCurrent !== undefined" class="con-hydro__pick-cur">
                  <span class="card-resource card-resource-animal" aria-hidden="true"></span>{{ selectedAnimalCurrent }}
                </span>
                <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
              </span>
              <span v-else class="con-hydro__pick-pending">
                <GamepadGlyph control="confirm" />
                <span>{{ $t(pickButtonLabel) }}</span>
              </span>
            </template>
            <span v-else class="con-hydro__req-note con-hydro__req-note--warn">
              ⚑ {{ $t('This reward will be skipped') }} — {{ $t(fizzleReason) }}
            </span>
          </div>
          <div v-if="rewardView.followUpKey" class="con-hydro__req-note con-hydro__req-note--muted">
            ↳ {{ $t(rewardView.followUpKey) }}
          </div>

          <!-- CTA or the SPECIFIC reasons — never a bare «Сейчас недоступно». -->
          <div class="con-hydro__cta-zone">
            <button v-if="model.canConfirm" type="button" class="con-hydro__cta" @click="onPrimary">
              <GamepadGlyph control="confirm" />
              <span>{{ $t('Reinforce the hydronetwork') }}</span>
            </button>
            <template v-else>
              <div class="con-hydro__cta con-hydro__cta--disabled" aria-disabled="true">
                <GamepadGlyph control="confirm" />
                <span>{{ $t('Reinforce the hydronetwork') }}</span>
              </div>
              <!-- Requirement blockers (tags / energy) already stand in RED in
                   the «Требования» column — never duplicated here; they fold
                   into ONE pointer line. Only reasons the requirements column
                   can't show (turn / used / occupied / to-dos) get own rows. -->
              <div class="con-hydro__reasons">
                <div v-if="requirementsUnmet" class="con-hydro__reason">
                  <span class="con-hydro__reason-glyph" aria-hidden="true">✕</span>
                  <span>{{ $t('Stage requirements are not met') }}</span>
                </div>
                <div v-for="(r, i) in ctaReasons" :key="i" class="con-hydro__reason" :class="{'con-hydro__reason--todo': !r.blocking}">
                  <span class="con-hydro__reason-glyph" aria-hidden="true">{{ r.blocking ? '✕' : '→' }}</span>
                  <span>{{ reasonText(r) }}</span>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Details mode: the viewer's own relation to this stage. -->
        <template v-else>
          <div class="con-hydro__section-label">{{ $t('Stage details') }}</div>
          <div class="con-hydro__detail-status">{{ detailsStatusText }}</div>
          <div class="con-hydro__req-note con-hydro__req-note--muted">
            → {{ $t('Select a stage ahead to plan the advance') }}
          </div>
        </template>
      </div>
    </div>

    <!-- ── HELP / LORE (X = Подробнее) — the full description, never clipped ── -->
    <transition name="con-layer">
      <div v-if="ui.helpOpen" class="con-task-host con-hydro__help" role="dialog" :aria-label="$t('Mars Hydronetwork')">
        <div class="con-task-host__backdrop" aria-hidden="true" @click="ui.helpOpen = false"></div>
        <div class="con-task con-hydro__help-frame">
          <header class="con-task__head">
            <div class="con-task__kicker">
              <span class="con-task__kicker-mark" aria-hidden="true">≈</span>
              <span>{{ $t('Mars Hydronetwork') }}</span>
            </div>
            <div class="con-task__title">{{ $t('How it works') }}</div>
          </header>
          <div class="con-task__body con-hydro__help-body">
            <p class="con-hydro__help-lore">{{ $t('After the oceans were built, erosion, landslides and subsidence began. The corporations jointly engineer the Mars Hydronetwork — dams, pumping stations, drainage and protective works.') }}</p>
            <ul class="con-hydro__help-rules">
              <li>{{ $t('1 energy = 1 step along the track.') }}</li>
              <li>{{ $t('Only the stage you stop on grants its reward — stages passed over are skipped.') }}</li>
              <li>{{ $t('The Hydronetwork can be reinforced once per generation.') }}</li>
              <li>{{ $t('Reaching a stage requires every tag along the path (wild tags count).') }}</li>
              <li>{{ $t('The finish slots hold one player each: 2 VP, then 5 VP at game end.') }}</li>
            </ul>
          </div>
          <footer class="con-task__foot" aria-hidden="true">
            <span class="con-task__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
          </footer>
        </div>
      </div>
    </transition>

    <!-- ── The console-native confirmation modal ─────────────────────── -->
    <transition name="con-layer">
      <ConsoleHydroConfirm v-if="ui.confirmOpen"
                           ref="confirm"
                           :model="model"
                           :rewardView="rewardView"
                           @confirm="onModalConfirm"
                           @cancel="ui.confirmOpen = false" />
    </transition>
  </section>
</template>

<script lang="ts">
/**
 * CONSOLE HYDRONETWORK SECTION — the console-NATIVE «Гидросеть Марса» screen
 * (the full rework of P24). The desktop HydroNetworkOverlay is no longer
 * mounted in console mode; this screen renders its own composition on the
 * SAME shared brain, so payloads and legality stay byte-identical:
 *
 *  - state:     hydroNetworkState (selection / bonus / card / preview);
 *  - model:     buildHydroModel (pure, unit-tested);
 *  - rewards:   buildRewardView («сейчас → станет» deltas);
 *  - reasons:   hydroPlanReasons (pure, SPECIFIC unavailability);
 *  - submit:    emits the same {spend, rewardChoice, selectedCard} payload
 *               the shell's submitHydroAdvance has always batched.
 *
 * Composition (Steam Deck-first): a header band with live status chips, a
 * single-row PROGRESS RAIL of all 12 stops (the selected one magnified), and
 * a full-width DECISION PANEL (identity · requirements · reward + CTA). The
 * CTA opens {@link ConsoleHydroConfirm} — nothing submits from this screen
 * directly. X opens the full lore/rules (nothing is ever clipped).
 *
 * Grammar: ←/→ stages · LB/RB (+↑/↓) bonus · Y furthest available ·
 * A smart-primary (pick card → confirm modal) · X details · B back.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import ConsoleHydroConfirm from './ConsoleHydroConfirm.vue';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {buildHydroModel, HydroModel, HydroStageVM, HydroStageHistoryEntry} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HydroStage} from '@/client/components/hydronetwork/hydroStages';
import {buildRewardView, HydroDeltaLine, HydroPlayerSnapshot, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {destinationAt, gradeDestination, HydroReason, hydroPlanReasons, HydroStopGrade} from '@/client/components/hydronetwork/hydroReasons';
import {fetchHydroPreview, hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi, resetConsoleHydroUi} from '@/client/console/consoleHydroState';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {DeltaStop} from '@/common/models/DeltaProjectPlayerModel';

/** Reason kinds the «Требования» column already shows as red marks — the
 *  CTA zone folds them into one pointer line instead of duplicating. */
const REQUIREMENT_REASON_KINDS: ReadonlySet<string> = new Set(['missing-tag', 'energy-deficit', 'no-energy']);

type RailStop = {
  position: number;
  vm: HydroStageVM;
  /** Per-stop availability grade (future stops only — from ITS destination). */
  grade: HydroStopGrade | undefined;
  gradeGlyph: string;
  linkKind: 'done' | 'route' | 'dim';
};

export default defineComponent({
  name: 'ConsoleHydroSection',
  components: {GamepadGlyph, HydroReward, ConsoleHydroConfirm},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    actionAvailable: {type: Boolean, default: false},
    /** Preview cache scope (the generation) — refetch on change. */
    cacheKey: {type: String, default: ''},
  },
  emits: ['close', 'confirm', 'pick', 'notice'],
  data() {
    return {
      ui: consoleHydroUi,
      /** One-shot attention pulse on the bonus selector (A with no bonus chosen). */
      bonusAttention: false,
      bonusAttentionTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    viewerColor(): Color {
      return this.playerView.thisPlayer.color;
    },
    preview(): DeltaTrackPreviewModel | undefined {
      return hydroNetworkState.previewColor === this.viewerColor ? hydroNetworkState.preview : undefined;
    },
    rewardChoice(): number | undefined {
      return hydroNetworkState.rewardChoice;
    },
    model(): HydroModel {
      const players = this.playerView.players.map((p) => ({
        color: p.color,
        name: p.name,
        position: p.deltaProject?.position ?? 0,
        isViewer: p.color === this.viewerColor,
        isMarsBot: p.isMarsBot === true,
        stops: p.deltaProject?.stops ?? [],
      }));
      return buildHydroModel({
        preview: this.preview,
        players,
        viewerColor: this.viewerColor,
        selectedPosition: hydroNetworkState.selectedPosition,
        rewardChoice: hydroNetworkState.rewardChoice,
        selectedCard: hydroNetworkState.selectedCard,
        actionAvailable: this.actionAvailable,
      });
    },
    snapshot(): HydroPlayerSnapshot {
      const p = this.playerView.thisPlayer;
      return {
        steel: p.steel, plants: p.plants, titanium: p.titanium, energy: p.energy, heat: p.heat, megacredits: p.megacredits,
        prod: {
          megacredits: p.megacreditProduction, steel: p.steelProduction, titanium: p.titaniumProduction,
          plants: p.plantProduction, energy: p.energyProduction, heat: p.heatProduction,
        },
        plantTags: p.tags[Tag.PLANT] ?? 0,
        jovianTags: p.tags[Tag.JOVIAN] ?? 0,
      };
    },
    /** Candidate cards for the pos 7/9 pick (name + live animal count) — the
     *  shell's hydroPick sheet reads this. */
    eligibleCards(): ReadonlyArray<{name: CardName; current?: number}> {
      const names = this.model.eligibleCardNames;
      if (names.length === 0) {
        return [];
      }
      const byName = new Map(this.playerView.thisPlayer.tableau.map((c) => [c.name, c]));
      const animalMode = this.model.needsCardSelect === 'animal-target';
      return names.map((n) => animalMode ? {name: n, current: byName.get(n)?.resources ?? 0} : {name: n});
    },
    selectedAnimalCurrent(): number | undefined {
      if (this.model.needsCardSelect !== 'animal-target' || this.model.selectedCard === undefined) {
        return undefined;
      }
      return this.eligibleCards.find((c) => c.name === this.model.selectedCard)?.current;
    },
    rewardView(): HydroRewardView {
      return buildRewardView({
        stage: this.model.targetStage,
        snapshot: this.snapshot,
        rewardChoice: this.rewardChoice,
        animalTargetCurrent: this.selectedAnimalCurrent,
        animalTargetCardName: this.model.selectedCard,
      });
    },
    /** The SPECIFIC reason list for the selected plan target (pure, tested). */
    reasons(): ReadonlyArray<HydroReason> {
      return hydroPlanReasons({
        model: this.model,
        preview: this.preview,
        actionAvailable: this.actionAvailable,
        rewardChoice: this.rewardChoice,
        occupantName: this.occupantName,
      });
    },
    /** Reasons ALREADY visualized in the «Требования» column (red chips). */
    requirementsUnmet(): boolean {
      return this.reasons.some((r) => REQUIREMENT_REASON_KINDS.has(r.kind));
    },
    /** The CTA-zone rows: everything the requirements column CAN'T show. */
    ctaReasons(): ReadonlyArray<HydroReason> {
      return this.reasons.filter((r) => !REQUIREMENT_REASON_KINDS.has(r.kind));
    },
    occupantName(): string | undefined {
      const pos = this.model.selectedPosition;
      return this.playerView.players.find((p) =>
        p.color !== this.viewerColor && (p.deltaProject?.position ?? 0) === pos)?.name;
    },
    /** The whole-screen action state: nothing is mint while the action is gone. */
    globallyActable(): boolean {
      return this.actionAvailable && !this.model.usedThisGeneration && this.preview !== undefined;
    },
    statusKind(): 'ready' | 'used' | 'waiting' | 'end' {
      if (this.model.usedThisGeneration) {
        return 'used';
      }
      if (this.model.atEndOfTrack) {
        return 'end';
      }
      if (!this.actionAvailable) {
        return 'waiting';
      }
      return 'ready';
    },
    statusLabel(): string {
      switch (this.statusKind) {
      case 'used': return 'Already used this generation';
      case 'end': return 'End of the track reached';
      case 'waiting': return 'Not your turn';
      default: return 'Reinforcement available';
      }
    },
    stops(): ReadonlyArray<RailStop> {
      return this.model.stages.map((vm): RailStop => {
        const d = destinationAt(this.preview, vm.position);
        const grade = d !== undefined ? gradeDestination(d) : undefined;
        let gradeGlyph = '';
        if (vm.position > this.model.currentPosition && grade !== undefined) {
          gradeGlyph = grade === 'blocked' ? '✕' : grade === 'occupied' ? '⛔' : grade === 'needs-energy' ? '⚡' : '';
        }
        const linkKind: RailStop['linkKind'] =
          vm.position <= this.model.currentPosition ? 'done' :
            (vm.state === 'route' || vm.state === 'target') ? 'route' : 'dim';
        return {position: vm.position, vm, grade, gradeGlyph, linkKind};
      });
    },
    selectedStage(): HydroStage {
      return this.model.stages[this.model.selectedPosition].stage;
    },
    stageOfText(): string {
      return translateTextWithParams('Stage ${0} of ${1}', [String(this.model.selectedPosition), '11']);
    },
    stageBadge(): {kind: string; text: string} {
      if (this.model.mode === 'plan') {
        const blocking = this.reasons.some((r) => r.blocking);
        if (this.model.canConfirm) {
          return {kind: 'ready', text: $t('Available now')};
        }
        if (!blocking && this.reasons.length > 0) {
          return {kind: 'todo', text: $t('Selection is required')};
        }
        return {kind: 'blocked', text: $t('Unavailable right now')};
      }
      const pos = this.model.selectedPosition;
      if (pos === this.model.currentPosition && pos !== 0) {
        return {kind: 'current', text: $t('Current position')};
      }
      if (pos === 0 && this.model.currentPosition === 0) {
        return {kind: 'current', text: $t('Current position')};
      }
      const vmStop = this.model.stages[pos];
      if (vmStop.rewardedByViewer) {
        const stop = this.viewerStopAt(pos);
        return {
          kind: 'built',
          text: stop?.generation !== undefined ?
            translateTextWithParams('Built: generation ${0}', [String(stop.generation)]) :
            $t('Took the reward'),
        };
      }
      if (vmStop.skippedByViewer) {
        return {kind: 'passed', text: $t('Passed through — no reward')};
      }
      return {kind: 'passed', text: $t('Track start')};
    },
    requiredTags(): ReadonlyArray<Tag> {
      return (this.model.destination?.requiredTags ?? []) as ReadonlyArray<Tag>;
    },
    hasWildCovered(): boolean {
      return (this.model.destination?.wildCoveredTags.length ?? 0) > 0;
    },
    targetAffordable(): boolean {
      return this.model.destination?.affordable ?? false;
    },
    skippedNames(): string {
      return this.model.skippedStages.map((s) => translateText(s.nameKey)).join(', ');
    },
    historyRows(): ReadonlyArray<HydroStageHistoryEntry> {
      return this.model.mode === 'plan' ? this.model.targetVisitors : this.model.detailsHistory;
    },
    detailsStatusText(): string {
      switch (this.model.viewerStatusAtDetails) {
      case 'current': return $t('Here now');
      case 'rewarded': return $t('Took the reward');
      case 'passed': return $t('Passed through — no reward');
      default: return $t('Not reached yet');
      }
    },
    pickButtonLabel(): string {
      return this.model.needsCardSelect === 'reuse-action' ? 'Choose an action' : 'Choose a card';
    },
    fizzleReason(): string {
      return this.model.needsCardSelect === 'reuse-action' ?
        'No used actions to repeat' : 'No card can receive the animals';
    },
  },
  watch: {
    cacheKey(): void {
      this.fetchPreview();
    },
    viewerColor(): void {
      this.fetchPreview();
    },
    // MIRROR the live model into consoleHydroUi so the shell's command bar
    // (the truth of the current context) never guesses about enabled verbs.
    model(): void {
      this.syncUiMirrors();
    },
  },
  mounted(): void {
    resetConsoleHydroUi();
    this.syncUiMirrors();
    this.fetchPreview();
  },
  beforeUnmount(): void {
    resetConsoleHydroUi();
    if (this.bonusAttentionTimer !== undefined) {
      clearTimeout(this.bonusAttentionTimer);
    }
  },
  methods: {
    $t,
    fetchPreview(): void {
      fetchHydroPreview(this.playerView.id, this.viewerColor, this.cacheKey + ':' + this.viewerColor);
    },
    syncUiMirrors(): void {
      const m = this.model;
      consoleHydroUi.mode = m.mode;
      consoleHydroUi.bonusChoice = m.mode === 'plan' && m.targetNeedsChoice;
      consoleHydroUi.pickKind = m.mode === 'plan' ? m.needsCardSelect : undefined;
      // A is live when it can confirm OR resolve a to-do (bonus / card pick),
      // and in details mode (it jumps back to planning).
      const todoOnly = this.reasons.length > 0 && this.reasons.every((r) => !r.blocking);
      consoleHydroUi.primaryEnabled = m.mode === 'details' || m.canConfirm || todoOnly;
    },
    reasonText(r: HydroReason): string {
      return r.params !== undefined ?
        translateTextWithParams(r.textKey, r.params.map(String)) :
        translateText(r.textKey);
    },
    historyStatusText(h: HydroStageHistoryEntry): string {
      switch (h.status) {
      case 'current': return 'Here now';
      case 'rewarded': return 'Took the reward';
      case 'passed': return 'Passed through — no reward';
      default: return 'Not reached yet';
      }
    },
    tagStatus(tag: Tag): 'have' | 'wild' | 'missing' {
      const dest = this.model.destination;
      if (dest === undefined) {
        return 'have';
      }
      if ((dest.missingTags as ReadonlyArray<Tag>).includes(tag)) {
        return 'missing';
      }
      if ((dest.wildCoveredTags as ReadonlyArray<Tag>).includes(tag)) {
        return 'wild';
      }
      return 'have';
    },
    deltaIconClass(l: HydroDeltaLine): string {
      if (l.special === 'jovian-tag') {
        return 'resource-tag tag-jovian';
      }
      if (l.special === 'animals') {
        return 'card-resource card-resource-animal';
      }
      return l.resource !== undefined ? iconClassFor(l.resource) : '';
    },
    viewerStopAt(position: number): DeltaStop | undefined {
      const viewer = this.playerView.players.find((p) => p.color === this.viewerColor);
      return (viewer?.deltaProject?.stops ?? []).find((s) => s.position === position);
    },
    selectPosition(position: number): void {
      const last = this.model.stages.length - 1;
      const next = Math.min(last, Math.max(0, position));
      if (next === this.model.selectedPosition) {
        return;
      }
      hydroNetworkState.selectedPosition = next;
      // A different destination invalidates a pending bonus choice / card.
      hydroNetworkState.rewardChoice = undefined;
      hydroNetworkState.selectedCard = undefined;
    },
    onChoice(idx: number): void {
      hydroNetworkState.rewardChoice = idx;
    },
    cycleChoice(step: 1 | -1): void {
      const options = this.model.targetStage?.rewardOptions.length ?? 0;
      if (options <= 1) {
        return;
      }
      const cur = hydroNetworkState.rewardChoice ?? -1;
      this.onChoice(((cur + step) % options + options) % options);
    },
    flashBonus(): void {
      this.bonusAttention = true;
      if (this.bonusAttentionTimer !== undefined) {
        clearTimeout(this.bonusAttentionTimer);
      }
      this.bonusAttentionTimer = setTimeout(() => {
        this.bonusAttention = false;
      }, 900);
    },
    /** A — the smart primary: resolve the first pending step, then confirm. */
    onPrimary(): void {
      if (this.model.mode !== 'plan') {
        // Details view: A jumps back to planning the nearest stage.
        this.selectPosition(this.model.currentPosition + Math.max(1, this.model.defaultSpend));
        return;
      }
      const blocking = this.reasons.filter((r) => r.blocking);
      if (blocking.length > 0) {
        this.$emit('notice', this.reasonText(blocking[0]));
        return;
      }
      if (this.model.targetNeedsChoice && this.rewardChoice === undefined) {
        this.flashBonus();
        this.$emit('notice', translateText('Choose a bonus'));
        return;
      }
      if (this.model.mustSelectCard && this.model.selectedCard === undefined) {
        this.$emit('pick');
        return;
      }
      if (this.model.canConfirm) {
        this.ui.confirmOpen = true;
      }
    },
    onModalConfirm(): void {
      if (!this.model.canConfirm) {
        return;
      }
      this.ui.confirmOpen = false;
      this.$emit('confirm', {
        spend: this.model.selectedSpend,
        rewardChoice: this.model.targetNeedsChoice ? hydroNetworkState.rewardChoice : undefined,
        selectedCard: this.model.mustSelectCard ? this.model.selectedCard : undefined,
      });
    },
    /** The shell routes every hydro-section intent here. */
    handleIntent(intent: GamepadIntent): void {
      // The confirm modal owns input while open.
      if (this.ui.confirmOpen) {
        const confirm = this.$refs.confirm as InstanceType<typeof ConsoleHydroConfirm> | undefined;
        confirm?.handleIntent(intent);
        return;
      }
      if (this.ui.helpOpen) {
        const a = consoleActionOf(intent);
        if (a === 'back' || a === 'inspect') {
          this.ui.helpOpen = false;
        }
        return;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'left' || intent.dir === 'right') {
          this.selectPosition(this.model.selectedPosition + (intent.dir === 'right' ? 1 : -1));
          return;
        }
        // ↑/↓ mirror LB/RB on a choice stage.
        this.cycleChoice(intent.dir === 'down' ? 1 : -1);
        return;
      }
      // Foundation: presses resolve to SEMANTIC actions (no raw button names).
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        this.cycleChoice(-1);
        return;
      case 'nextSection':
        this.cycleChoice(1);
        return;
      case 'nextTab': { // RT — jump to the FURTHEST legal+affordable stage.
        const max = this.preview?.maxLegalSteps ?? 0;
        if (max > 0) {
          this.selectPosition(this.model.currentPosition + max);
        }
        return;
      }
      case 'inspect':
        this.ui.helpOpen = !this.ui.helpOpen;
        return;
      case 'primary':
        this.onPrimary();
        return;
      case 'back':
        this.$emit('close');
        return;
      default:
        return;
      }
    },
  },
});
</script>
