<template>
  <div class="cminsp" :class="`cminsp--${mission.state}`">
    <!-- The HERO half: the mission's board, enlarged, with its printed
         legend — the same real geometry the route card paints, one scale
         up. No reveal replay: the layer's own unfold FROM the card is the
         transition; the board stands ready inside it. -->
    <div class="cminsp__hero">
      <div class="cminsp__map">
        <PremiumMapFingerprint :map-id="mission.board" variant="hero" :accent="accent" />
      </div>
      <div class="cminsp__board-line">
        <span class="cminsp__board-name">{{ $t(boardLabel) }}</span>
        <span v-if="mission.final" class="cminsp__final">{{ $t('Finale') }}</span>
      </div>
      <div class="cminsp__state" :class="`cminsp__state--${mission.state}`">{{ $t(stateLabel) }}</div>
    </div>

    <!-- The DETAIL half follows the mission's state. -->
    <div class="cminsp__detail">
      <!-- Committed: the full results + the outgoing legacy (shared body). -->
      <CampaignMissionResults
        v-if="mission.state === 'committed' && details !== undefined"
        :details="details"
        :you-seat="youSeat"
        :bot-corporation="botCorporation" />

      <!-- Active: the live facts — who is on the board, which generation. -->
      <template v-else-if="mission.state === 'active'">
        <div class="cminsp__facts">
          <div v-if="liveGeneration !== undefined" class="cminsp__fact">
            <span class="cminsp__fact-label">{{ $t('Generation') }}</span>
            <span class="cminsp__fact-value">{{ liveGeneration }}</span>
          </div>
          <div v-if="party.length > 0" class="cminsp__fact">
            <span class="cminsp__fact-label">{{ $t('Participants') }}</span>
            <span class="cminsp__party">
              <span v-for="p in party" :key="p.color" class="cminsp__party-chip">
                <span class="cminsp__party-cube" :class="`player_bg_color_${p.color}`"></span>{{ p.name }}
              </span>
            </span>
          </div>
        </div>
        <div class="cminsp__note">{{ $t('The mission is being played right now — its results will appear here') }}</div>
      </template>

      <!-- Ahead (ready / locked): the known features of the mission. -->
      <template v-else>
        <div class="cminsp__facts">
          <div class="cminsp__fact">
            <span class="cminsp__fact-label">{{ $t('Mission') }}</span>
            <span class="cminsp__fact-value">{{ missionOrdinal }}</span>
          </div>
          <div v-if="mission.final" class="cminsp__fact">
            <span class="cminsp__fact-label">{{ $t('Finale') }}</span>
            <span class="cminsp__fact-note">{{ $t('Titles and corporations count into this mission’s VP') }}</span>
          </div>
        </div>
        <div class="cminsp__note">{{ $t('The board and its printed bonuses are known ahead — the outcome is not') }}</div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import CampaignMissionResults from './CampaignMissionResults.vue';
import {MissionDetailsVm, OverviewMissionCard} from '@/client/console/campaign/campaignOverviewModel';
import {mapLabelKey, mapMeta} from '@/client/components/create/premium/createGameMeta';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {translateTextWithParams} from '@/client/directives/i18n';

/**
 * MISSION INSPECT («Осмотр миссии») — one body for inspecting ANY mission
 * of the route, whatever its state: the enlarged REAL board is the hero
 * (the visual continuation of the route card the player pressed), and the
 * detail half is honest to the state — committed shows the full results +
 * outgoing legacy, active shows the live facts, a future one shows what is
 * genuinely known ahead (the board, the finale marker) without inventing
 * an outcome. Shared verbatim by the standalone Campaign Map overlay and
 * the in-game Information overview layer. Read-only; zero controller hints
 * (the hosts own the bars).
 */
export default defineComponent({
  name: 'CampaignMissionInspect',
  components: {CampaignMissionResults, PremiumMapFingerprint},
  props: {
    mission: {type: Object as PropType<OverviewMissionCard>, required: true},
    /** The committed results (only meaningful for state 'committed'). */
    details: {type: Object as PropType<MissionDetailsVm | undefined>, default: undefined},
    youSeat: {type: Number as PropType<number | undefined>, default: undefined},
    botCorporation: {type: String as PropType<MarsBotCorpId | undefined>, default: undefined},
    /** The live mission's current generation (in-game host only). */
    liveGeneration: {type: Number as PropType<number | undefined>, default: undefined},
    /** Participant chips for the ACTIVE state (visible names, resolved). */
    party: {type: Array as PropType<ReadonlyArray<{color: string, name: string}>>, default: () => []},
    missionCount: {type: Number, default: 4},
  },
  computed: {
    accent(): string {
      return mapMeta(this.mission.board).accent;
    },
    boardLabel(): string {
      return mapLabelKey(this.mission.board);
    },
    stateLabel(): string {
      switch (this.mission.state) {
      case 'committed': return 'Mission complete';
      case 'active': return 'Mission in progress';
      default: return 'Ahead';
      }
    },
    missionOrdinal(): string {
      return translateTextWithParams('Mission ${0} of ${1}', [String(this.mission.slot + 1), String(this.missionCount)]);
    },
  },
});
</script>
