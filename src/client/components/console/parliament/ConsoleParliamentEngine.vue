<template>
  <!-- ══ THE ENGINE OF THE CAREER («Зал» v7, the owner's idea of 2026-10-18): the chairman's CHAIR with its
       QUEST stands at the HEAD of the career track — completing the quest IS a step on that track (one server
       function, `walkAgenda`, for the vote's winner, the quest and the cards), so the quest is drawn where it
       leads: the chair (the office's cube, or its empty silhouette), the printed condition as its GRAPHIC, the
       step it pays («→ +1»), and the RACE as pips per seat. No words: the reading line names the condition and
       the office under the cursor, the dossier (X) states the rule.
       It keeps every anchor the chairman-quest director and the sitting's enactment beat fly to / turn over:
       `[data-parl-quest]` (the block that RELEASES and REVEALS with the government), `[data-parl-chair]` and the
       seat cube `[data-parl-seat-chair]`, the race `[data-parl-quest-progress]`, the condition's graphic.
       DURING THE SITTING it reads the OLD quest, closed, until the enactment's beat turns it over (the display
       holds); during a card's walk the quest as it stood before the walk (its TR is what closes it). ══ -->
  <div class="con-parl__engine"
       :class="{
         'con-parl__engine--done': questShown !== undefined && questShown.completedBy !== undefined,
         // The QUEST's own state name (the plate IS the quest — `[data-parl-quest]`): the walk probes read «done» by it.
         'con-parl__quest--done': questShown !== undefined && questShown.completedBy !== undefined,
         'con-parl__engine--closed': questClosed,
         'con-parl__engine--focus': focused,
         'con-parl__quest--pulse': questPulse || flow.questPulse,
       }"
       @animationend="onQuestPulseEnd"
       data-parl-quest
       data-parl-engine
       :data-parl-quest-text="questShown?.text"
       :data-parl-quest-closed="questClosed ? '' : undefined">
    <!-- Парламент v8: the quest is a PLATE at the head of the career row — its kicker names it (X reads the dossier). The
         plate prints no sentence, so WHICH quest it shows is the attribute `data-parl-quest-text` (the printed text's
         English key — the probes' identity of the quest, language-free). -->
    <span class="con-parl__engine-kicker">{{ $t('Chairman quest') }}</span>
    <!-- THE QUEST IS TAKEN (the owner, 2026-10-24) — the claimed milestone's seal as a STAMP over the condition, its
         arrow and its reward (all receding — they cannot be had again): who completed it, «ВЫПОЛНЕНО ✓», and under it
         «закрыто до следующего поколения» (the server refuses a second completion until the next government's quest).
         It never touches the kicker's line (the 4K frame: a seal there cut «ЗАДАНИЕ ПРЕДСЕДАТЕЛЯ»). The race stays. -->
    <span v-if="questDoneBy !== undefined" class="con-parl__quest-seal" data-parl-quest-seal :data-parl-quest-seal-by="questDoneBy">
      <span class="con-parl__quest-seal-head">
        <i class="con-parl__quest-seal-dot" :class="'player_bg_color_' + questDoneBy" aria-hidden="true"></i>
        <span class="con-parl__quest-seal-word">{{ $t('Completed') }}</span>
        <i class="con-parl__quest-seal-tick" aria-hidden="true">✓</i>
      </span>
      <span class="con-parl__quest-seal-note" data-parl-quest-closed-mark>{{ $t('Closed until the next generation') }}</span>
    </span>
    <!-- THE CHAIR — the office's seat: the chairman's cube stands in it; empty, its silhouette alone. -->
    <span class="con-parl__chair"
          :class="{'con-parl__chair--seated': chairmanShown !== undefined, 'con-parl__chair--won': questShown?.completedBy !== undefined && questShown.completedBy === chairmanShown, 'con-parl__chair--pulse': flow.chairPulse}"
          data-parl-chair
          @animationend="onChairPulseEnd">
      <PremiumChairGlyph class="con-parl__chair-glyph" />
      <span v-if="chairmanShown !== undefined" class="con-parl__chair-cube" :data-parl-seat-chair="chairmanShown">
        <PlayerDelegate :color="chairmanShown" />
      </span>
    </span>
    <!-- THE CONDITION — its printed graphic (the ONE drawing the face, the dossier and this block share). -->
    <div v-if="questShown !== undefined" class="con-parl__engine-cond">
      <PremiumMechanicsPanel v-if="questMechanics !== undefined && !questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
      <!-- A condition the DSL cannot draw keeps its words: an empty block would be a silent quest. -->
      <span v-else class="con-parl__engine-text">{{ $t(questShown.text) }}</span>
    </div>
    <!-- THE STEP it pays: into the first stop of the track beside it. -->
    <svg v-if="questShown !== undefined" class="con-parl__engine-arrow" viewBox="0 0 30 14" aria-hidden="true"><path d="M2 7h24M20 2l6 5-6 5" /></svg>
    <span v-if="questShown !== undefined" class="con-parl__engine-step" :class="{'con-parl__engine-step--kept': viewerIsChairman}" data-parl-quest-reward aria-hidden="true">
      <span class="con-parl__engine-plus">+1</span>
      <i class="career-step-glyph" aria-hidden="true"></i>
    </span>
    <!-- THE RACE — one row per seat, the count as pips (a long count as digits). CLOSED or WON it is the final
         score at the same size (the block's geometry never moves under the government's beats). -->
    <div v-if="questRows.length > 0" class="con-parl__quest-progress" data-parl-quest-progress>
      <span v-for="row in questRows" :key="row.color" class="con-parl__quest-row"
            :class="{'con-parl__quest-row--me': row.color === viewerColor, 'con-parl__quest-row--close': row.value > 0 && row.value >= questCount - 1, 'con-parl__quest-row--unreachable': rowUnreachable(row)}"
            :data-parl-quest-unreachable="rowUnreachable(row) ? '' : undefined"
            :data-parl-quest-value="row.value">
        <PlayerDelegate :color="row.color" :size="figurePx(18)" :glow="false" />
        <!-- MARSBOT'S ROW, on a quest its play cannot reach: a struck mark, never a race that cannot happen (the dossier says why). -->
        <span v-if="rowUnreachable(row)" class="con-parl__quest-unreachable" aria-hidden="true">✕</span>
        <template v-else-if="questCount <= PIPS_MAX">
          <span class="con-parl__engine-pips" aria-hidden="true">
            <span v-for="n in questCount" :key="n" class="con-parl__engine-pip" :class="{'con-parl__engine-pip--on': n <= row.value}"></span>
          </span>
          <b class="con-parl__quest-frac" aria-hidden="true">{{ row.value }}/{{ questCount }}</b>
        </template>
        <template v-else>
          <b :key="row.value" class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ questCount }}</span>
        </template>
      </span>
    </div>
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
import {parliamentFlow, settleParliamentChairPulse, settleParliamentQuestPulse} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {ParliamentQuestVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';

/** A race of up to this many is drawn as pips; a longer one as digits. */
const PIPS_MAX = 5;

export default defineComponent({
  name: 'ConsoleParliamentEngine',
  components: {PlayerDelegate, PremiumChairGlyph, PremiumMechanicsPanel},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The SITTING's stage on screen ('' outside the sitting) — the verdict reads the quest closed. */
    sittingStage: {type: String, default: ''},
    /** The browse cursor stands on the engine. */
    focused: {type: Boolean, default: false},
  },
  data() {
    return {questPulse: false, PIPS_MAX};
  },
  computed: {
    /** Who completed the quest standing on the plate — the seal's subject (undefined while it is open). */
    questDoneBy(): Color | undefined {
      return this.questShown?.completedBy;
    },
    flow() {
      return parliamentFlow;
    },
    holds() {
      return parliamentHolds;
    },
    /**
     * THE QUEST AS SHOWN: the previous quest (closed) until the new one unfolds with the government; during a
     * card's walk of the track (TR04) the quest as it stood before the walk (OPEN, its old progress) until the
     * walk's rewards have landed — the TR a step pays is what closes it.
     */
    questShown(): ParliamentQuestVm | undefined {
      const before = this.holds.questBefore;
      if (before !== undefined) {
        return before.quest;
      }
      return this.holds.questWalkBefore ?? this.view.quest;
    },
    questCount(): number {
      return this.questShown?.definition.count ?? 1;
    },
    chairmanShown(): Color | undefined {
      // «ПРЕДСЕДАТЕЛЬСТВО»: the office has changed on the server and NOT on screen yet — the chair keeps the
      // previous holder (and reads empty from the frame the outgoing delegate lifts off) until the new cube lands.
      const chair = this.holds.chairAwaits;
      if (chair !== undefined) {
        return chair.from;
      }
      const before = this.holds.questBefore;
      return before !== undefined ? before.chairman : this.view.chairman;
    },
    /** THE QUEST READS CLOSED from the VERDICT on (v3 В2): the generation is over, so its race is over. */
    questClosed(): boolean {
      return this.holds.questBefore !== undefined || this.sittingStage === 'verdict';
    },
    viewerIsChairman(): boolean {
      return this.viewerColor !== undefined && this.chairmanShown === this.viewerColor;
    },
    questMechanics(): MechanicsVM | undefined {
      const root = this.questShown?.renderData;
      return root === undefined ? undefined : buildMechanics(root, PARLIAMENT_GRAPHIC);
    },
    questRows(): ReadonlyArray<{color: Color, value: number, bot: boolean}> {
      return (this.questShown?.progress ?? []).filter((row) => row.participates);
    },
    questCompletedBy(): Color | undefined {
      return this.view.quest?.completedBy;
    },
  },
  watch: {
    questCompletedBy(now: Color | undefined, was: Color | undefined): void {
      if (now !== undefined && was === undefined && parliamentFlow.stage !== 'sitting') {
        // A CSS one-shot (`con-parl-quest-pulse`): the flag is cleared by the animation's own end, never by a timer.
        this.questPulse = true;
      }
    },
  },
  methods: {
    /** The bot's row, on a quest its play cannot reach — the server's verdict on the quest, read for the bot seat alone. */
    rowUnreachable(row: {bot: boolean}): boolean {
      return row.bot && this.questShown?.botReachable === false;
    },
    onQuestPulseEnd(event: AnimationEvent): void {
      if (event.animationName === 'con-parl-quest-pulse') {
        this.questPulse = false;
        settleParliamentQuestPulse();
      }
    },
    onChairPulseEnd(event: AnimationEvent): void {
      if (event.animationName === 'con-parl-land-flash') {
        settleParliamentChairPulse();
      }
    },
    figurePx(logical: number): number {
      return delegateFigurePx(logical);
    },
  },
});
</script>
