<template>
  <div class="ma-block">
    <div class="ma-player" v-if="award.playerName">
      <player-cube :title="award.playerName" :color="award.color" :size="18" />
    </div>

    <div class="ma-name ma-name--awards award-block" :class="nameCss">
      <span v-i18n>{{ award.name }}</span>
      <div v-if="showScores" class="ma-scores player_home_block--milestones-and-awards-scores">
        <template v-for="score in sortedScores" :key="score.color">
          <p
            v-if="playerSymbol(score.color).length > 0"
            class="ma-score"
            :class="`player_bg_color_${score.color}`"
            v-text="playerSymbol(score.color)"
            data-test="player-score"
          />
          <p
            class="ma-score"
            :class="`player_bg_color_${score.color}`"
            v-text="score.score"
            data-test="player-score"
          />
      </template>
      </div>
    </div>

    <div v-if="showDescription" class="ma-description">
      <span v-i18n>{{ description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {vI18n} from '@/client/directives/vDirectives';
import {FundedAwardModel, AwardScore} from '@/common/models/FundedAwardModel';
import {getAward} from '@/client/MilestoneAwardManifest';
import {playerSymbol} from '@/client/utils/playerSymbol';
import PlayerCube from '@/client/components/PlayerCube.vue';

defineOptions({name: 'Award'});
const props = defineProps({
  award: {
    type: Object as () => FundedAwardModel,
    required: true,
  },
  showScores: {
    type: Boolean,
    default: true,
  },
  showDescription: {
    type: Boolean,
  },
});

const nameCss = computed((): string => {
  return 'ma-name--' + props.award.name.replaceAll(' ', '-').replaceAll('.', '').toLowerCase();
});
const sortedScores = computed((): Array<AwardScore> => {
  return [...props.award.scores].sort((s1, s2) => s2.score - s1.score);
});
const description = computed((): string => {
  return getAward(props.award.name).description;
});
</script>
