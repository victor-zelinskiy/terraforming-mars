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
    <!-- THE QUEST IS TAKEN (the owner, 2026-10-24: «сама композиция переходит в форму "выполнено"» — no stamp laid over
         it): the plate's OWN parts change their form, each in its own cell — the kicker's word turns into «ЗАДАНИЕ
         ВЫПОЛНЕНО ✓» (two words in ONE grid cell, a crossfade), the reward it paid is SEALED in the claimed milestone's
         grammar (the completer's dot + ✓ where «+1 ★» stood, same chip, same box), the condition and its arrow recede
         (they cannot be had again), the completer's race row is the score that won. «Закрыто до следующего поколения»
         is the band's line under the cursor and the dossier's (X). -->
    <span class="con-parl__engine-kicker" :class="{'con-parl__engine-kicker--done': questDoneBy !== undefined}">
      <span class="con-parl__engine-kicker-word" :aria-hidden="questDoneBy !== undefined ? 'true' : undefined">{{ $t('Chairman quest') }}</span>
      <span class="con-parl__engine-kicker-word con-parl__engine-kicker-word--done" data-parl-quest-done-word
            :aria-hidden="questDoneBy === undefined ? 'true' : undefined">{{ $t('Quest completed') }}<i class="con-parl__engine-kicker-tick" aria-hidden="true">✓</i></span>
    </span>
    <!-- THE CHAIR — the office's seat, the chairman SEATED in it at the plate's own scale (the owner, 2026-10-24: «сразу
         понятно, какой игрок председатель»): the medallion rimmed and lit in the holder's cube colour, the throne behind
         the figure, the holder's NAME under it (colour is never the only carrier). Empty: the throne alone. -->
    <span class="con-parl__throne" :style="chairVars">
      <span class="con-parl__chair"
            :class="{'con-parl__chair--seated': chairmanShown !== undefined, 'con-parl__chair--won': questShown?.completedBy !== undefined && questShown.completedBy === chairmanShown, 'con-parl__chair--pulse': flow.chairPulse}"
            data-parl-chair
            @animationend="onChairPulseEnd">
        <PremiumChairGlyph class="con-parl__chair-glyph" />
        <span v-if="chairmanShown !== undefined" class="con-parl__chair-cube" :data-parl-seat-chair="chairmanShown">
          <PlayerDelegate :color="chairmanShown" />
        </span>
      </span>
      <span class="con-parl__chair-name" :class="{'con-parl__chair-name--empty': chairmanName === ''}" data-parl-chair-name>{{ chairmanName === '' ? '\u00a0' : chairmanName }}</span>
    </span>
    <!-- THE CONDITION — its printed graphic (the ONE drawing the face, the dossier and this block share). -->
    <div v-if="questShown !== undefined" class="con-parl__engine-cond">
      <PremiumMechanicsPanel v-if="questMechanics !== undefined && !questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
      <!-- A condition the DSL cannot draw keeps its words: an empty block would be a silent quest. -->
      <span v-else class="con-parl__engine-text">{{ $t(questShown.text) }}</span>
    </div>
    <!-- THE STEP it pays: into the first stop of the track beside it — led by the card face's OWN printed arrow (the
         solid gold shaft-and-head of `.pcard-sym--arrow`, the «→» every formula on a face reads by), never a hairline. -->
    <i v-if="questShown !== undefined" class="con-parl__engine-arrow" aria-hidden="true"></i>
    <span v-if="questShown !== undefined" class="con-parl__engine-step"
          :class="{'con-parl__engine-step--kept': viewerIsChairman && questDoneBy === undefined, 'con-parl__engine-step--taken': questDoneBy !== undefined}"
          data-parl-quest-reward aria-hidden="true">
      <span class="con-parl__engine-step-pay"><span class="con-parl__engine-plus">+1</span><i class="career-step-glyph" aria-hidden="true"></i></span>
      <span class="con-parl__engine-step-seal" data-parl-quest-seal :data-parl-quest-seal-by="questDoneBy">
        <i class="con-parl__engine-step-dot" :class="questDoneBy !== undefined ? 'player_bg_color_' + questDoneBy : ''"></i><i class="con-parl__engine-step-tick">✓</i>
      </span>
    </span>
    <!-- THE RACE — one row per seat, the count as pips (a long count as digits). CLOSED or WON it is the final
         score at the same size (the block's geometry never moves under the government's beats). -->
    <div v-if="questRows.length > 0" class="con-parl__quest-progress" data-parl-quest-progress>
      <span v-for="row in questRows" :key="row.color" class="con-parl__quest-row"
            :class="{'con-parl__quest-row--me': row.color === viewerColor, 'con-parl__quest-row--close': row.value > 0 && row.value >= questCount - 1, 'con-parl__quest-row--unreachable': rowUnreachable(row), 'con-parl__quest-row--won': row.color === questDoneBy, 'con-parl__quest-row--lead': row.color === questLeader, 'con-parl__quest-row--behind': questDoneBy !== undefined && row.color !== questDoneBy}"
            :data-parl-quest-row="row.color"
            :data-parl-quest-unreachable="rowUnreachable(row) ? '' : undefined"
            :data-parl-quest-value="row.value">
        <!-- WHOSE row — the player's DOT (a figure is a delegate that VOTES, never a row's owner). -->
        <i class="con-parl__seat-dot" :class="'player_bg_color_' + row.color" aria-hidden="true"></i>
        <!-- MARSBOT'S ROW, on a quest its play cannot reach: a struck mark, never a race that cannot happen (the dossier says why). -->
        <span v-if="rowUnreachable(row)" class="con-parl__quest-unreachable" aria-hidden="true">✕</span>
        <template v-else-if="questCount <= PIPS_MAX">
          <span class="con-parl__engine-pips" aria-hidden="true">
            <span v-for="n in questCount" :key="n" class="con-parl__engine-pip" :class="{'con-parl__engine-pip--on': n <= row.value}"></span>
          </span>
          <!-- ONE ENCODING (P70 · K4): the pips ARE the count — «0/3» beside them said it twice. The number is the dossier's (X). -->
        </template>
        <template v-else>
          <b :key="row.value" class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ questCount }}</span>
        </template>
      </span>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, markRaw, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {PARLIAMENT_GRAPHIC} from '@/client/components/premiumCard/resolutionPremiumVm';
import {tokenStyleVars} from '@/client/components/playerToken/playerTokenPalette';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {parliamentFlow, settleParliamentChairPulse, settleParliamentQuestPulse} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {ParliamentQuestVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';

/** A race of up to this many is drawn as pips; a longer one as digits. */
const PIPS_MAX = 5;

/**
 * The smallest the condition's graphic may be solved to before it stops reading (a fraction of the plate's own
 * formula scale). The widest printed condition («3 [heat production]») needs ~0.8 on the Deck; nothing in the catalog
 * comes near this floor — it exists so a future wider goal reads small rather than vanishing.
 */
const ENGINE_FIT_FLOOR = 0.55;

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
    return {
      questPulse: false,
      PIPS_MAX,
      /** The observer that re-solves the condition's fit when the plate's room changes (raw — never reactive). */
      fitObs: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    /** The chair's medallion paints in the holder's cube palette (`--pt-*`); an empty chair keeps the gold. */
    chairVars(): Record<string, string> {
      return this.chairmanShown === undefined ? {} : tokenStyleVars(this.chairmanShown);
    },
    /** The holder's display label under the chair ('' while the chair is empty — the slot keeps its line). */
    chairmanName(): string {
      const color = this.chairmanShown;
      const player = color === undefined ? undefined : this.players.find((p) => p.color === color);
      return player === undefined ? '' : participantDisplayName(player);
    },
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
    /**
     * WHO IS CLOSEST TO THE CHAIR (P70 · K4): the ONE seat strictly ahead of every other in the race, while the quest is
     * open — its pips wear the kant. A tie, nobody started, a quest taken or closed: no leader (nothing is told).
     */
    questLeader(): Color | undefined {
      if (this.questDoneBy !== undefined || this.questClosed) {
        return undefined;
      }
      const rows = this.questRows.filter((row) => !this.rowUnreachable(row));
      const top = Math.max(0, ...rows.map((row) => row.value));
      const leaders = rows.filter((row) => row.value === top);
      return top > 0 && leaders.length === 1 ? leaders[0].color : undefined;
    },
    questCompletedBy(): Color | undefined {
      return this.view.quest?.completedBy;
    },
    /** What the condition's graphic depends on — a new quest is a new drawing to fit. */
    questFitKey(): string {
      return `${this.questShown?.text ?? ''}|${this.questCount}`;
    },
  },
  watch: {
    questFitKey(): void {
      void this.$nextTick(() => this.fitCondition());
    },
    questCompletedBy(now: Color | undefined, was: Color | undefined): void {
      if (now !== undefined && was === undefined && parliamentFlow.stage !== 'sitting') {
        // A CSS one-shot (`con-parl-quest-pulse`): the flag is cleared by the animation's own end, never by a timer.
        this.questPulse = true;
      }
    },
  },
  mounted() {
    if (typeof ResizeObserver !== 'undefined' && this.$el instanceof HTMLElement) {
      // The plate's box (its column token, the profile) and the fixed members beside the condition (the chair, the
      // reward chip — a font swap re-measures them): the condition's fit is a function of their sizes, never of its own.
      this.fitObs = markRaw(new ResizeObserver(() => this.fitCondition()));
      this.fitObs.observe(this.$el);
      this.$el.querySelectorAll<HTMLElement>('.con-parl__throne, [data-parl-quest-reward]').forEach((el) => this.fitObs?.observe(el));
    }
    this.fitCondition();
  },
  beforeUnmount() {
    this.fitObs?.disconnect();
    this.fitObs = undefined;
  },
  methods: {
    /**
     * THE CONDITION FITS ITS PLATE — never under the chair (the owner, 2026-10-24: «задания с большим количеством
     * графики задевают зону кресла»). The formula row is chair · condition · arrow · reward, packed in the middle; the
     * condition's printed graphic rides the plate's formula scale (`--con-parl-engine-zoom`) times the fit solved here
     * (`--con-parl-engine-fit`, ≤ 1): the room is the plate's content width minus the chair, the arrow, the reward
     * and the row's five gaps — all sizes that do not depend on the fit — and the graphic is measured at fit 1 in the
     * same synchronous block (no frame paints the probe). One coordinate space: every length is a rect, the padding
     * and the gap scaled by the plate's own rect/layout ratio (an entry's transform scales both alike).
     */
    fitCondition(): void {
      const root = this.$el;
      if (!(root instanceof HTMLElement)) {
        return;
      }
      const graphic = root.querySelector<HTMLElement>('.con-parl__engine-cond .con-parl__quest-graphic');
      if (graphic === null || root.offsetWidth === 0) {
        root.style.removeProperty('--con-parl-engine-fit');
        return;
      }
      root.style.setProperty('--con-parl-engine-fit', '1');
      const natural = graphic.getBoundingClientRect().width;
      const rect = root.getBoundingClientRect();
      const scale = rect.width / root.offsetWidth;
      const cs = getComputedStyle(root);
      const inner = (root.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)) * scale;
      const gap = (parseFloat(cs.columnGap) || 0) * scale;
      const width = (sel: string) => root.querySelector<HTMLElement>(sel)?.getBoundingClientRect().width ?? 0;
      const room = inner - width('.con-parl__throne') - width('.con-parl__engine-arrow') - width('[data-parl-quest-reward]') - 5 * gap;
      if (natural <= 0 || natural <= room) {
        return;
      }
      const fit = Math.max(ENGINE_FIT_FLOOR, Math.floor((room / natural) * 1000) / 1000);
      root.style.setProperty('--con-parl-engine-fit', String(fit));
    },
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
  },
});
</script>
