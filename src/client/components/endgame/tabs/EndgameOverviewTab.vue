<template>
  <div class="eg-tab eg-overview">
    <!-- ── DUEL: head-to-head ────────────────────────────────────────── -->
    <section v-if="mode === 'duel'" class="eg-overview__duel">
      <div class="eg-duel">
        <div v-for="(p, side) in duelPlayers" :key="p.color"
             class="eg-duel__side" :class="['eg-duel__side--' + (side === 0 ? 'left' : 'right'), {'eg-duel__side--winner': p.isWinner}]"
             :style="{'--eg-pc': hex(p.color)}">
          <div class="eg-duel__crown" v-if="p.isWinner" aria-hidden="true">♛</div>
          <div class="eg-duel__name">
            <span class="eg-duel__dot" :class="'player_bg_color_' + p.color"></span>
            <span>{{ p.name }}</span>
            <span v-if="isViewer(p.color)" class="eg-duel__you" v-i18n>You</span>
          </div>
          <div class="eg-duel__corp" v-if="corp(p) !== ''" v-i18n>{{ corp(p) }}</div>
          <div class="eg-duel__total">{{ p.total }}<span class="eg-duel__total-unit" v-i18n>VP</span></div>
        </div>
        <div class="eg-duel__center">
          <div class="eg-duel__vs">VS</div>
          <div class="eg-duel__delta" v-if="model.margin > 0">
            <span class="eg-duel__delta-val">+{{ model.margin }}</span>
            <span class="eg-duel__delta-lbl" v-i18n>Lead</span>
          </div>
          <div class="eg-duel__delta eg-duel__delta--tie" v-else>
            <span class="eg-duel__delta-lbl" v-i18n>Decided on M€</span>
          </div>
        </div>
      </div>

      <!-- per-category who-won row -->
      <div class="eg-catwins">
        <div v-for="cat in model.categories" :key="cat.key" class="eg-catwin"
             :class="catWinClass(cat)">
          <span class="eg-catwin__label" v-i18n>{{ cat.label }}</span>
          <div class="eg-catwin__bars">
            <span class="eg-catwin__val eg-catwin__val--l">{{ cat.values[duelPlayers[0].color] || 0 }}</span>
            <div class="eg-catwin__track">
              <span class="eg-catwin__fill eg-catwin__fill--l" :style="mirrorStyle(cat, duelPlayers[0].color, 'l')"></span>
              <span class="eg-catwin__fill eg-catwin__fill--r" :style="mirrorStyle(cat, duelPlayers[1].color, 'r')"></span>
            </div>
            <span class="eg-catwin__val eg-catwin__val--r">{{ cat.values[duelPlayers[1].color] || 0 }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── STANDINGS: podium + leaderboard ───────────────────────────── -->
    <section v-else-if="mode === 'standings'" class="eg-overview__standings">
      <div class="eg-podium">
        <div v-for="p in podium" :key="p.color" class="eg-podium__slot" :class="'eg-podium__slot--' + p.place"
             :style="{'--eg-pc': hex(p.color)}">
          <div class="eg-podium__player">
            <span class="eg-podium__dot" :class="'player_bg_color_' + p.color"></span>
            <span class="eg-podium__name">{{ p.name }}</span>
          </div>
          <div class="eg-podium__vp">{{ p.total }}<span v-i18n>VP</span></div>
          <div class="eg-podium__stand">
            <span class="eg-podium__place">{{ p.place }}</span>
          </div>
        </div>
      </div>

      <div class="eg-leaderboard">
        <div v-for="p in model.players" :key="p.color" class="eg-lbrow" :class="{'eg-lbrow--winner': p.isWinner, 'eg-lbrow--you': isViewer(p.color)}"
             :style="{'--eg-pc': hex(p.color)}">
          <span class="eg-lbrow__place">{{ p.place }}</span>
          <span class="eg-lbrow__dot" :class="'player_bg_color_' + p.color"></span>
          <span class="eg-lbrow__name">{{ p.name }}<span v-if="isViewer(p.color)" class="eg-lbrow__you" v-i18n>You</span></span>
          <span class="eg-lbrow__corp" v-if="corp(p) !== ''" v-i18n>{{ corp(p) }}</span>
          <span class="eg-lbrow__strong" v-if="p.strongestCategory !== undefined">
            <span class="eg-lbrow__strong-lbl" v-i18n>{{ categoryLabel(p.strongestCategory) }}</span>
          </span>
          <span class="eg-lbrow__total">{{ p.total }}<span class="eg-lbrow__total-unit" v-i18n>VP</span></span>
        </div>
      </div>

      <!-- per-category who-won chips -->
      <div class="eg-catchips">
        <div v-for="cat in model.categories" :key="cat.key" class="eg-catchip">
          <span class="eg-catchip__label" v-i18n>{{ cat.label }}</span>
          <span v-if="cat.leaders.length === 1" class="eg-catchip__leader" :style="{'--eg-pc': hex(cat.leaders[0])}">
            <span class="eg-catchip__dot" :class="'player_bg_color_' + cat.leaders[0]"></span>
            <span class="eg-catchip__name">{{ nameOf(cat.leaders[0]) }}</span>
          </span>
          <span v-else class="eg-catchip__tie" v-i18n>Tie</span>
        </div>
      </div>
    </section>

    <!-- ── SOLO ──────────────────────────────────────────────────────── -->
    <section v-else class="eg-overview__solo">
      <div class="eg-solo" :class="model.soloWin ? 'eg-solo--win' : 'eg-solo--loss'">
        <div class="eg-solo__verdict" v-i18n>{{ model.soloWin ? 'Victory' : 'Defeat' }}</div>
        <div class="eg-solo__total" v-if="model.winner !== undefined">{{ model.winner.total }}<span v-i18n>VP</span></div>
      </div>
    </section>

    <!-- ── Insights: how it was decided ──────────────────────────────── -->
    <section v-if="insightLines.length > 0" class="eg-insights">
      <h2 class="eg-section-title" v-i18n>How it was decided</h2>
      <div class="eg-insights__list">
        <div v-for="(line, i) in insightLines" :key="i" class="eg-insight" :class="'eg-insight--' + line.kind"
             :style="line.color ? {'--eg-pc': hex(line.color)} : {}">
          <span class="eg-insight__mark" aria-hidden="true"></span>
          <span class="eg-insight__text">{{ line.text }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {EndgameModel, EndgameCategory, EndgameCategoryKey, EndgamePlayerScore, EndgameInsight, ENDGAME_CATEGORY_LABEL} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {translateTextWithParams, $t} from '@/client/directives/i18n';

type InsightLine = {kind: string; text: string; color?: Color};

export default defineComponent({
  name: 'EndgameOverviewTab',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    // Declared so the shell's shared <component :is> props don't fall through
    // as DOM attributes (this tab doesn't read `view`).
    view: {type: Object, required: false, default: undefined},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  computed: {
    mode(): string {
      return this.model.mode;
    },
    duelPlayers(): Array<EndgamePlayerScore> {
      // Winner on the left for a stable, readable head-to-head.
      const [a, b] = this.model.players;
      return a.isWinner ? [a, b] : [b, a];
    },
    podium(): Array<EndgamePlayerScore> {
      // Arrange as 2nd · 1st · 3rd for the classic raised-center podium.
      const top = this.model.players.slice(0, 3);
      const first = top.find((p) => p.place === 1) ?? top[0];
      const others = top.filter((p) => p !== first);
      const result: Array<EndgamePlayerScore> = [];
      if (others[0]) {
        result.push(others[0]);
      }
      result.push(first);
      if (others[1]) {
        result.push(others[1]);
      }
      return result;
    },
    insightLines(): Array<InsightLine> {
      return this.model.insights.map((ins) => this.composeInsight(ins)).filter((l): l is InsightLine => l !== undefined);
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    isViewer(color: Color): boolean {
      return this.viewerColor === color;
    },
    nameOf(color: Color): string {
      return this.model.players.find((p) => p.color === color)?.name ?? '';
    },
    corp(p: EndgamePlayerScore): string {
      return p.corporations.join(' / ');
    },
    categoryLabel(key: EndgameCategoryKey): string {
      return ENDGAME_CATEGORY_LABEL[key];
    },
    catWinClass(cat: EndgameCategory): Record<string, boolean> {
      const left = this.duelPlayers[0].color;
      const right = this.duelPlayers[1].color;
      return {
        'eg-catwin--left': cat.leaders.length === 1 && cat.leaders[0] === left,
        'eg-catwin--right': cat.leaders.length === 1 && cat.leaders[0] === right,
        'eg-catwin--tie': cat.leaders.length !== 1,
      };
    },
    mirrorStyle(cat: EndgameCategory, color: Color, side: 'l' | 'r'): Record<string, string> {
      const v = cat.values[color] ?? 0;
      const pct = cat.max > 0 ? (v / cat.max) * 100 : 0;
      return {width: pct + '%', background: endgamePlayerHex(color), [side === 'l' ? 'marginLeft' : 'marginRight']: 'auto'};
    },
    composeInsight(ins: EndgameInsight): InsightLine | undefined {
      const catsText = (ins.categories ?? []).map((k) => $t(ENDGAME_CATEGORY_LABEL[k])).join(', ');
      const playerName = ins.player !== undefined ? this.nameOf(ins.player) : '';
      switch (ins.kind) {
      case 'winner-strength':
        if (catsText === '') {
          return undefined;
        }
        return {kind: ins.kind, color: ins.player, text: translateTextWithParams('${0} won thanks to a lead in ${1}.', [playerName, catsText])};
      case 'runnerup-strength':
        if (catsText === '') {
          return undefined;
        }
        return {kind: ins.kind, color: ins.player, text: translateTextWithParams('${0} was stronger in ${1}, but it was not enough.', [playerName, catsText])};
      case 'lead-taken':
        return {kind: ins.kind, color: ins.player, text: translateTextWithParams('${0} took the lead in generation ${1} and never gave it back.', [playerName, String(ins.gen)])};
      case 'wire-to-wire':
        return {kind: ins.kind, color: ins.player, text: translateTextWithParams('${0} led from the first generation to the last.', [playerName])};
      case 'margin':
        if (ins.value !== undefined && ins.value > 0) {
          return {kind: ins.kind, color: ins.player, text: translateTextWithParams('Final margin: ${0} VP.', [String(ins.value)])};
        }
        return {kind: ins.kind, color: ins.player, text: $t('The game was decided on the M€ tiebreaker.')};
      default:
        return undefined;
      }
    },
  },
});
</script>
