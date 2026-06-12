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
              <span v-if="isCategoryLeader(col.color, key)" class="eg-score__lead" :aria-label="$t('Category leader')" aria-hidden="true">▲</span>
              <span class="eg-score__scale-val">{{ formatVp(scaleTotal(col, key)) }}</span>
            </div>
            <div class="vp-scale__bar eg-score__bar">
              <span v-for="seg in positiveSegments(col, key)" :key="seg.key"
                    class="vp-scale__seg eg-score__seg" :class="segClass(seg)" :style="{width: segWidth(seg.value)}"
                    @mouseenter="onSegEnter(seg, col, $event)" @mouseleave="onSegLeave"></span>
              <span v-for="seg in penaltySegments(col, key)" :key="'p-' + seg.key"
                    class="vp-scale__seg vp-scale__seg--penalty eg-score__seg" :class="segHotClass(seg)" :style="{width: segWidth(seg.value)}"
                    @mouseenter="onSegEnter(seg, col, $event)" @mouseleave="onSegLeave"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!--
      Colour legend: every segment family per scale, with per-player values.
      Hovering a chip highlights the matching segments in EVERY player column
      (and vice versa — hovering a segment lights its chip), so the duel
      breakdown reads like one connected diagram, not two separate charts.
    -->
    <section class="eg-score__legend">
      <h2 class="eg-section-title" v-i18n>Colour legend</h2>
      <div class="eg-score__legend-rows">
        <div v-for="row in legendRows" :key="row.scaleKey" class="eg-score__legend-row">
          <span class="eg-score__legend-scale" v-i18n>{{ row.scaleLabel }}</span>
          <div class="eg-score__legend-chips">
            <button v-for="seg in row.segments" :key="seg.key" type="button"
                    class="eg-score__legend-chip" :class="chipClass(seg)"
                    @mouseenter="hoverKey = seg.key" @mouseleave="hoverKey = null" @focus="hoverKey = seg.key" @blur="hoverKey = null">
              <span class="eg-score__legend-dot" :class="'vp-accent--' + seg.accent" aria-hidden="true"></span>
              <span class="eg-score__legend-label" v-i18n>{{ seg.label }}</span>
              <span v-if="showChipValues" class="eg-score__legend-vals">
                <span v-for="v in seg.values" :key="v.color" class="eg-score__legend-val" :style="{color: hex(v.color)}">{{ v.value }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Floating premium tooltip for the hovered segment -->
    <div v-if="tip !== null" class="eg-score__tip" :style="{left: tip.left + 'px', top: tip.top + 'px'}">
      <div class="eg-score__tip-head">
        <span class="eg-score__legend-dot" :class="'vp-accent--' + tip.accent" aria-hidden="true"></span>
        <span v-i18n>{{ tip.label }}</span>
      </div>
      <div v-for="row in tipRows" :key="row.color" class="eg-score__tip-row" :class="{'eg-score__tip-row--hot': row.color === tip.color}">
        <span class="eg-score__tip-dot" :style="{background: hex(row.color)}"></span>
        <span class="eg-score__tip-name">{{ row.name }}</span>
        <span class="eg-score__tip-val">{{ formatVp(row.value) }}</span>
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

type LegendSegment = {
  key: string;
  accent: string;
  label: string;
  values: Array<{color: Color; value: number}>;
};

type LegendRow = {
  scaleKey: string;
  scaleLabel: string;
  segments: Array<LegendSegment>;
};

type Tip = {
  key: string;
  accent: string;
  label: string;
  color: Color; // the hovered column's player
  left: number;
  top: number;
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
  data() {
    return {
      // The segment family under the pointer (legend chip OR bar segment) —
      // drives the cross-column highlight.
      hoverKey: null as string | null,
      tip: null as Tip | null,
    };
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
    // The union of segment families per scale, with each player's value —
    // the data behind both the legend chips and the tooltip rows.
    legendRows(): Array<LegendRow> {
      const rows: Array<LegendRow> = [];
      for (const scaleKey of this.scaleOrder) {
        const segs: Array<LegendSegment> = [];
        const seen = new Map<string, LegendSegment>();
        for (const col of this.columns) {
          for (const seg of this.scaleObj(col, scaleKey)?.segments ?? []) {
            let entry = seen.get(seg.key);
            if (entry === undefined) {
              entry = {key: seg.key, accent: seg.accent, label: seg.label, values: []};
              seen.set(seg.key, entry);
              segs.push(entry);
            }
          }
        }
        // Per-player values in column order (0 when the player lacks the segment).
        for (const entry of segs) {
          entry.values = this.columns.map((col) => ({
            color: col.color,
            value: (this.scaleObj(col, scaleKey)?.segments ?? []).find((s) => s.key === entry.key)?.value ?? 0,
          }));
        }
        if (segs.length > 0) {
          rows.push({scaleKey, scaleLabel: SCALE_LABEL[scaleKey] ?? scaleKey, segments: segs});
        }
      }
      return rows;
    },
    // Inline values fit comfortably up to a duel; bigger tables read them in
    // the tooltip instead.
    showChipValues(): boolean {
      return this.columns.length <= 2;
    },
    tipRows(): Array<{color: Color; name: string; value: number}> {
      if (this.tip === null) {
        return [];
      }
      const key = this.tip.key;
      const seg = this.legendRows.flatMap((r) => r.segments).find((s) => s.key === key);
      if (seg === undefined) {
        return [];
      }
      return seg.values.map((v) => ({
        color: v.color,
        name: this.columns.find((c) => c.color === v.color)?.name ?? '',
        value: v.value,
      }));
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
    segClass(seg: VPSegment): Record<string, boolean> {
      return {
        ['vp-accent--' + seg.accent]: true,
        ...this.segHotClass(seg),
      };
    },
    segHotClass(seg: VPSegment): Record<string, boolean> {
      return {
        'eg-score__seg--hot': this.hoverKey === seg.key,
        'eg-score__seg--dim': this.hoverKey !== null && this.hoverKey !== seg.key,
      };
    },
    chipClass(seg: LegendSegment): Record<string, boolean> {
      return {
        'eg-score__legend-chip--hot': this.hoverKey === seg.key,
        'eg-score__legend-chip--dim': this.hoverKey !== null && this.hoverKey !== seg.key,
      };
    },
    onSegEnter(seg: VPSegment, col: Column, evt: MouseEvent): void {
      this.hoverKey = seg.key;
      const el = evt.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      // Above the segment, horizontally centred, clamped to the viewport.
      const width = 190;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
      const top = Math.max(8, rect.top - 12);
      this.tip = {key: seg.key, accent: seg.accent, label: seg.label, color: col.color, left, top};
    },
    onSegLeave(): void {
      this.hoverKey = null;
      this.tip = null;
    },
  },
});
</script>
