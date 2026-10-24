<template>
  <div class="con-parl-qd" data-parl-quest-dossier role="dialog" :aria-label="$t('Chairman quest')">
    <!-- ══ THE CHAIRMAN QUEST'S DOSSIER (Парламент v8 § 7, the mock `d1`; the owner's point 5: X on the quest opens the
         QUEST, never the ruling party). The viewer's three-zone grammar over the dimmed hall: the CHAIR (who sits in it,
         what it gives) · the QUEST as an object (its printed condition large, the reward, the race of every seat, the
         law it comes from) · § ПРАВИЛА (the condition, what counts, the reward) in words. Read-only; B or X closes. ══ -->
    <section class="con-parl-qd__side con-parl-qd__side--chair" data-parl-qd-chair>
      <span class="con-parl-qd__kicker con-parl-qd__kicker--gold">{{ $t('Chairman seat') }}</span>
      <span class="con-parl-qd__seat" :class="{'con-parl-qd__seat--held': chairman !== undefined}">
        <PremiumChairGlyph class="con-parl-qd__chair-glyph" />
        <span v-if="chairman !== undefined" class="con-parl-qd__seat-cube"><PlayerDelegate :color="chairman" :size="figurePx(26)" :glow="false" /></span>
      </span>
      <span class="con-parl-qd__holder">{{ chairman === undefined ? $t('The seat is vacant') : nameOf(chairman) }}</span>
      <div class="con-parl-qd__note">
        <span class="con-parl-qd__label">{{ $t('What the seat gives') }}</span>
        <p class="con-parl-qd__text">{{ $t('A card requirement «Chairman» is met. The seat changes hands when another player completes a quest.') }}</p>
      </div>
    </section>
    <section class="con-parl-qd__hero" data-parl-qd-quest>
      <span class="con-parl-qd__kicker con-parl-qd__kicker--gold">
        <PremiumChairGlyph class="con-parl-qd__kicker-glyph" />{{ $t('Chairman quest') }}
      </span>
      <div v-if="quest !== undefined" class="con-parl-qd__goal">
        <PremiumMechanicsPanel v-if="mechanics !== undefined && !mechanics.textOnly" class="con-parl-qd__graphic" :mechanics="mechanics" />
        <span v-else class="con-parl-qd__goal-text">{{ $t(quest.text) }}</span>
      </div>
      <div class="con-parl-qd__reward" data-parl-qd-reward>
        <span class="con-parl-qd__label">{{ $t('Reward') }}</span>
        <span class="con-parl-qd__reward-arrow" aria-hidden="true">→</span>
        <PremiumChairGlyph class="con-parl-qd__reward-chair" />
        <span class="con-parl-qd__reward-plus" aria-hidden="true">+</span>
        <i class="career-step-glyph" aria-hidden="true"></i>
        <b>+1</b>
      </div>
      <div v-if="rows.length > 0" class="con-parl-qd__race" data-parl-qd-race>
        <div v-for="row in rows" :key="row.color" class="con-parl-qd__row"
             :class="{'con-parl-qd__row--me': row.color === viewerColor, 'con-parl-qd__row--won': quest?.completedBy === row.color}"
             :data-parl-qd-row="row.color">
          <PlayerDelegate :color="row.color" :size="figurePx(21)" :glow="false" />
          <span class="con-parl-qd__row-name">{{ nameOf(row.color) }}</span>
          <span v-if="row.bot && quest?.botReachable === false" class="con-parl-qd__row-off">✕</span>
          <template v-else>
            <span class="con-parl-qd__pips" aria-hidden="true">
              <span v-for="n in count" :key="n" class="con-parl-qd__pip" :class="{'con-parl-qd__pip--on': n <= row.value}"></span>
            </span>
            <b class="con-parl-qd__row-value">{{ row.value }}/{{ count }}</b>
          </template>
        </div>
      </div>
      <span class="con-parl-qd__source">{{ sourceText }}</span>
    </section>
    <section class="con-parl-qd__side con-parl-qd__side--rules" data-parl-qd-rules>
      <span class="con-parl-qd__kicker"><span class="con-parl-qd__section-mark" aria-hidden="true">§</span>{{ $t('Rules') }}</span>
      <div class="con-parl-qd__rule">
        <span class="con-parl-qd__tag">{{ $t('Condition') }}</span>
        <p class="con-parl-qd__text">{{ quest === undefined ? '' : $t(quest.text) }}</p>
      </div>
      <div class="con-parl-qd__rule">
        <span class="con-parl-qd__tag">{{ $t('What counts') }}</span>
        <p class="con-parl-qd__text">{{ $t('Only your own actions in the action phase count — never the effect of an enacted resolution, the political phase or the action of another player.') }}</p>
      </div>
      <div class="con-parl-qd__rule">
        <span class="con-parl-qd__tag con-parl-qd__tag--reward">{{ $t('Reward') }}</span>
        <p class="con-parl-qd__text">{{ $t('The first to complete it this generation puts a delegate in the chairman seat and makes 1 step of the Agenda track (a sitting chairman keeps the seat). The quest closes for everyone until the next generation.') }}</p>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {PARLIAMENT_GRAPHIC} from '@/client/components/premiumCard/resolutionPremiumVm';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {ParliamentQuestVm, ParliamentViewVm, parliamentPlayerName, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleParliamentQuestDossier',
  components: {PlayerDelegate, PremiumChairGlyph, PremiumMechanicsPanel},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  },
  computed: {
    quest(): ParliamentQuestVm | undefined {
      return this.view.quest;
    },
    chairman(): Color | undefined {
      return this.view.chairman;
    },
    count(): number {
      return this.quest?.definition.count ?? 1;
    },
    mechanics(): MechanicsVM | undefined {
      const root = this.quest?.renderData;
      return root === undefined ? undefined : buildMechanics(root, PARLIAMENT_GRAPHIC);
    },
    rows(): ReadonlyArray<{color: Color, value: number, bot: boolean}> {
      return (this.quest?.progress ?? []).filter((row) => row.participates);
    },
    /** WHERE the quest comes from — the enacted law it is printed on, or the starting rule (generation 1). */
    sourceText(): string {
      const quest = this.quest;
      if (quest === undefined) {
        return '';
      }
      return quest.source === 'starter' ?
        translateText('Starting rule') :
        translateTextWithParams('from the enacted resolution «${0}»', [translateText(resolutionTitleOf(this.view, quest.source))]);
    },
  },
  methods: {
    nameOf(color: Color): string {
      return parliamentPlayerName(this.players, color);
    },
    figurePx(logical: number): number {
      return delegateFigurePx(logical);
    },
  },
});
</script>
