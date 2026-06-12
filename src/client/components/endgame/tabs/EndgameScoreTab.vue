<template>
  <div class="eg-tab eg-score" :class="'eg-score--' + model.mode">
    <p class="eg-tab__hint" v-i18n>Each bar shares one scale across players — longer means more points from that source.</p>

    <div class="eg-score__grid" :class="{'eg-score__grid--duel': model.mode === 'duel'}">
      <div v-for="col in columns" :key="col.color" class="eg-score__col"
           :class="{'eg-score__col--winner': col.isWinner, 'eg-score__col--you': isViewer(col.color)}"
           :style="{'--eg-pc': hex(col.color)}">
        <header class="eg-score__col-head">
          <span class="eg-score__place">{{ col.place }}</span>
          <span class="eg-score__dot" :class="'player_bg_color_' + col.color"></span>
          <span class="eg-score__name">{{ col.name }}</span>
          <span class="eg-score__total">{{ col.total }}<span class="eg-score__total-unit" v-i18n>VP</span></span>
        </header>

        <div class="eg-score__scales">
          <div v-for="key in scaleOrder" :key="key" class="eg-score__scale"
               :class="{'eg-score__scale--zero': scaleTotal(col, key) === 0}">
            <div class="eg-score__scale-head">
              <span class="eg-score__scale-name" v-i18n>{{ scaleLabel(key) }}</span>
              <span v-if="isCategoryLeader(col.color, key)" class="eg-score__lead" :title="$t('Category leader')" aria-hidden="true">▲</span>
              <span class="eg-score__scale-val">{{ formatVp(scaleTotal(col, key)) }}</span>
            </div>
            <div class="vp-scale__bar eg-score__bar">
              <span v-for="seg in positiveSegments(col, key)" :key="seg.key"
                    class="vp-scale__seg" :class="'vp-accent--' + seg.accent" :style="{width: segWidth(seg.value)}"></span>
              <span v-for="seg in penaltySegments(col, key)" :key="'p-' + seg.key"
                    class="vp-scale__seg vp-scale__seg--penalty" :style="{width: segWidth(seg.value)}"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {buildVictoryPointsModel, VictoryPointsModel, VPScale, VPSegment} from '@/client/components/overview/victoryPointsModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

type Column = {
  color: Color;
  name: string;
  place: number;
  total: number;
  isWinner: boolean;
  vp: VictoryPointsModel;
};

const SCALE_ORDER: ReadonlyArray<string> = ['tr', 'cards', 'board', 'mca', 'moon', 'tracks', 'ev'];
const SCALE_LABEL: Record<string, string> = {
  tr: 'Terraform rating',
  cards: 'Cards',
  board: 'Cities & greenery',
  mca: 'Milestones & awards',
  moon: 'Moon',
  tracks: 'Planetary tracks',
  ev: 'Escape Velocity',
};

export default defineComponent({
  name: 'EndgameScoreTab',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    view: {type: Object as () => ViewModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  computed: {
    columns(): Array<Column> {
      const opts = {
        hasMoon: this.view.game.moon !== undefined,
        hasPathfinders: this.view.game.pathfinders !== undefined,
        hasEscapeVelocity: this.view.game.gameOptions.escapeVelocity !== undefined,
      };
      return this.model.players.map((p: EndgamePlayerScore) => ({
        color: p.color,
        name: p.name,
        place: p.place,
        total: p.total,
        isWinner: p.isWinner,
        vp: buildVictoryPointsModel(p.breakdown, opts),
      }));
    },
    // Shared px-per-VP scale across ALL players so bar lengths are comparable
    // between columns, not just within one.
    scaleMax(): number {
      return this.columns.reduce((m, c) => Math.max(m, c.vp.maxScalePositive), 1);
    },
    // Only render scale rows that ANY player has — keeps columns aligned.
    scaleOrder(): Array<string> {
      return SCALE_ORDER.filter((key) => this.columns.some((c) => c.vp.scales.some((s) => s.key === key)));
    },
    // For the ▲ leader marker: the highest positiveTotal per scale.
    leaders(): Record<string, Set<Color>> {
      const out: Record<string, Set<Color>> = {};
      for (const key of SCALE_ORDER) {
        let max = 0;
        for (const c of this.columns) {
          max = Math.max(max, this.scaleObj(c, key)?.positiveTotal ?? 0);
        }
        const set = new Set<Color>();
        if (max > 0) {
          for (const c of this.columns) {
            if ((this.scaleObj(c, key)?.positiveTotal ?? 0) === max) {
              set.add(c.color);
            }
          }
        }
        out[key] = set;
      }
      return out;
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    isViewer(color: Color): boolean {
      return this.viewerColor === color;
    },
    scaleLabel(key: string): string {
      return SCALE_LABEL[key] ?? key;
    },
    scaleObj(col: Column, key: string): VPScale | undefined {
      return col.vp.scales.find((s) => s.key === key);
    },
    scaleTotal(col: Column, key: string): number {
      return this.scaleObj(col, key)?.total ?? 0;
    },
    positiveSegments(col: Column, key: string): Array<VPSegment> {
      return (this.scaleObj(col, key)?.segments ?? []).filter((s) => s.value > 0);
    },
    penaltySegments(col: Column, key: string): Array<VPSegment> {
      return (this.scaleObj(col, key)?.segments ?? []).filter((s) => s.value < 0);
    },
    isCategoryLeader(color: Color, key: string): boolean {
      return this.leaders[key]?.has(color) ?? false;
    },
    segWidth(value: number): string {
      const max = this.scaleMax;
      if (max <= 0) {
        return '0%';
      }
      return `${(Math.abs(value) / max) * 100}%`;
    },
    formatVp(n: number): string {
      return n > 0 ? `+${n}` : String(n);
    },
  },
});
</script>
