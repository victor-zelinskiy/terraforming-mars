<template>
  <!--
    Premium FINAL SCORING REVEAL — the "reward" surface for hidden-VP games.
    Shown the moment a hidden-score game ends, BEFORE the detailed results
    overlay: the score is revealed category by category (TR split into its real
    sub-parts), each player's running total counting up while their STACKED,
    colour-segmented bar fills, so the winner stays a mystery until the swingy
    categories land — then a winner SCAN sweeps the lanes and settles on them.

    Numbers come from the SAME endgame model the results screen uses (via the
    pure `finalScoringRevealModel` adapter) — no second source of truth. The
    final totals are NEVER in the DOM until the winner step; lanes only ever
    render the running (revealed-so-far) total, and a not-yet-revealed group's
    value is never shown.

    Performance: the bars reveal with `transform: scaleX()` (compositor only, no
    layout), the only per-frame work is easing 1 number per player; everything
    else is CSS transitions on transform/opacity. Honours reduced motion.
  -->
  <div class="fsr" :class="{'fsr--done': phase === 'winner'}" tabindex="-1" ref="root" @keydown.esc.stop.prevent="onEsc">
    <div class="fsr__backdrop" aria-hidden="true"></div>
    <div class="fsr__aurora" aria-hidden="true"></div>
    <div class="fsr__scan" aria-hidden="true"></div>

    <!-- Replay controls (hidden once the reveal has finished). -->
    <div v-if="phase !== 'winner'" class="fsr__controls">
      <button type="button" class="fsr__ctl" :class="{'fsr__ctl--on': fast}" @click="toggleFast">
        <span v-i18n>Speed up</span>
      </button>
      <button type="button" class="fsr__ctl" @click="skipAnimation">
        <span v-i18n>Skip animation</span>
      </button>
      <button type="button" class="fsr__ctl fsr__ctl--ghost" @click="openResults">
        <span v-i18n>Open results now</span>
      </button>
    </div>

    <header class="fsr__header">
      <div class="fsr__eyebrow">
        <span class="fsr__eyebrow-tick" aria-hidden="true"></span>
        <span v-i18n>Hidden score mode is on</span>
        <span class="fsr__eyebrow-sep">·</span>
        <span>{{ reveal.generation }} <span v-i18n>generations</span></span>
        <span class="fsr__eyebrow-tick" aria-hidden="true"></span>
      </div>
      <h2 class="fsr__title" v-i18n>Final scoring</h2>
      <p class="fsr__subtitle" v-i18n>Victory points were hidden. Revealing the result by category.</p>

      <!-- Group progress rail. Hover/focus a pill → highlight that group everywhere. -->
      <ol class="fsr__progress" role="list">
        <li v-for="g in reveal.groups" :key="g.key"
            class="fsr__progress-node"
            :class="['fsr-cat--' + g.accent, groupHlClass(g.key), {
              'fsr__progress-node--active': activeGroupKey === g.key && phase === 'revealing',
              'fsr__progress-node--done': groupDone(g.key),
              'fsr__progress-node--upcoming': !groupStarted(g.key),
              'fsr__progress-node--interactive': canHover(g.key),
            }]"
            :tabindex="canHover(g.key) ? 0 : -1"
            @mouseenter="onPillHover(g.key, $event)" @mouseleave="clearHover"
            @focus="onPillHover(g.key, $event)" @blur="clearHover">
          <span class="fsr__progress-dot" aria-hidden="true"></span>
          <span class="fsr__progress-label" v-i18n>{{ g.label }}</span>
        </li>
        <li class="fsr__progress-node fsr__progress-node--final"
            :class="{'fsr__progress-node--active': phase === 'tiebreak' || phase === 'winnerScan' || phase === 'winner'}">
          <span class="fsr__progress-dot" aria-hidden="true"></span>
          <span class="fsr__progress-label" v-i18n>Winner</span>
        </li>
      </ol>
    </header>

    <!-- Current-category stage block. -->
    <transition name="fsr-fade">
      <div v-if="phase === 'revealing' && activeStage !== undefined" class="fsr__stage" :class="'fsr-cat--' + activeStage.accent">
        <span class="fsr__stage-bar" aria-hidden="true"></span>
        <div class="fsr__stage-body">
          <span class="fsr__stage-kicker" v-i18n>Revealing now</span>
          <span class="fsr__stage-group" v-i18n>{{ activeStage.groupLabel }}</span>
          <span v-if="activeStage.subLabel !== ''" class="fsr__stage-sub" v-i18n>{{ activeStage.subLabel }}</span>
        </div>
        <span class="fsr__stage-step" v-i18n="[String(activeStage.index), String(reveal.groups.length)]">Stage ${0} of ${1}</span>
      </div>
    </transition>

    <!-- Player lanes (neutral seating order — never ranked, so nothing spoils). -->
    <div class="fsr__lanes">
      <div v-for="(lane, li) in lanes" :key="lane.color"
           class="fsr__lane"
           :class="{
             'fsr__lane--winner': isWinnerLane(lane.color),
             'fsr__lane--dim': phase === 'winner' && !isWinnerLane(lane.color),
             'fsr__lane--hot': hoverLane === lane.color,
             'fsr__lane--scan': phase === 'winnerScan' && scanIndex === li,
           }">
        <div class="fsr__lane-id">
          <span v-if="isWinnerLane(lane.color)" class="fsr__crown" aria-hidden="true">♔</span>
          <span class="fsr__lane-dot" :class="'player_bg_color_' + lane.color" aria-hidden="true"></span>
          <span class="fsr__lane-name">{{ lane.name }}</span>
          <span v-if="lane.corp !== ''" class="fsr__lane-corp" v-i18n>{{ lane.corp }}</span>
        </div>

        <!-- STACKED segmented bar: absolutely-positioned segments, reveal via scaleX. -->
        <div class="fsr__lane-bar">
          <div v-for="seg in lane.segs" :key="seg.key"
               class="fsr__seg"
               :class="['fsr-cat--' + seg.key, segHlClass(seg.group), {
                 'fsr__seg--revealed': seg.index < revealedSegments,
                 'fsr__seg--penalty': seg.penalty,
                 'fsr__seg--active': activeSegment === seg.index,
               }]"
               :style="{left: seg.leftPct + '%', width: seg.widthPct + '%'}"
               @mouseenter="onSegHover(seg.group, lane.color, $event)" @mouseleave="clearHover"></div>
          <span class="fsr__lane-bar-edge" aria-hidden="true"></span>
        </div>

        <div class="fsr__lane-total">
          <transition name="fsr-pop">
            <span v-if="pendingFor(lane.color) !== 0" class="fsr__lane-pending"
                  :class="{'fsr__lane-pending--neg': pendingFor(lane.color) < 0}">
              {{ pendingFor(lane.color) > 0 ? '+' + pendingFor(lane.color) : pendingFor(lane.color) }}
            </span>
          </transition>
          <span class="fsr__lane-total-num">{{ displayedTotal(lane.color) }}</span>
          <span class="fsr__lane-total-unit" v-i18n>VP</span>
        </div>

        <!-- One chip per STARTED group (running value; TR accumulates as its sub-parts land). -->
        <transition-group tag="div" class="fsr__lane-chips" name="fsr-chip">
          <span v-for="g in startedGroupsFor" :key="g.key"
                class="fsr__chip"
                :class="['fsr-cat--' + g.accent, groupHlClass(g.key), {
                  'fsr__chip--penalty': groupValue(g.key, lane.color) < 0,
                  'fsr__chip--active': groupActive(g.key),
                  'fsr__chip--interactive': canHover(g.key),
                }]"
                :tabindex="canHover(g.key) ? 0 : -1"
                @mouseenter="onChipHover(g.key, lane.color, $event)" @mouseleave="clearHover"
                @focus="onChipHover(g.key, lane.color, $event)" @blur="clearHover">
            <span class="fsr__chip-label" v-i18n>{{ g.label }}</span>
            <span class="fsr__chip-val">{{ groupValue(g.key, lane.color) >= 0 ? '+' + groupValue(g.key, lane.color) : groupValue(g.key, lane.color) }}</span>
          </span>
        </transition-group>
      </div>
    </div>

    <!-- Hover inspector popover (revealed groups only — never leaks future VP).
         Teleported to body so `position: fixed` resolves against the viewport
         (the .fsr backdrop-filter would otherwise be its containing block). -->
    <Teleport to="body">
      <transition name="fsr-fade">
        <div v-if="inspector !== undefined" class="fsr__inspector" :class="'fsr-cat--' + inspector.accent"
             :style="{top: inspector.top + 'px', left: inspector.left + 'px'}" aria-hidden="true">
          <div class="fsr__inspector-head">
            <span class="fsr__inspector-dot"></span>
            <span class="fsr__inspector-name" v-i18n>{{ inspector.label }}</span>
          </div>
          <div class="fsr__inspector-desc" v-i18n>{{ inspector.description }}</div>
          <div class="fsr__inspector-rows">
            <div v-for="row in inspector.rows" :key="row.color" class="fsr__inspector-row" :class="{'fsr__inspector-row--hot': row.color === hoverLane}">
              <span class="fsr__lane-dot" :class="'player_bg_color_' + row.color"></span>
              <span class="fsr__inspector-row-name">{{ row.name }}</span>
              <span class="fsr__inspector-row-val">{{ row.value >= 0 ? '+' + row.value : row.value }}</span>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Dedicated tie-break beat: equal total → decided on M€. -->
    <transition name="fsr-fade">
      <div v-if="showTieBreak && reveal.tieBreak !== undefined" class="fsr__tiebreak">
        <div class="fsr__tiebreak-head">
          <span class="fsr__tiebreak-kicker" v-i18n>Tie-break</span>
          <span class="fsr__tiebreak-text" v-i18n>Tie on VP — decided on M€</span>
        </div>
        <div class="fsr__tiebreak-row">
          <div v-for="c in reveal.tieBreak.contenders" :key="c"
               class="fsr__tiebreak-cell"
               :class="{'fsr__tiebreak-cell--win': reveal.tieBreak.winner === c}">
            <span class="fsr__lane-dot" :class="'player_bg_color_' + c" aria-hidden="true"></span>
            <span class="fsr__tiebreak-name">{{ nameOf(c) }}</span>
            <span class="fsr__tiebreak-mc">{{ reveal.tieBreak.values[c] }} <span class="fsr__tiebreak-mc-unit">M€</span></span>
          </div>
        </div>
      </div>
    </transition>

    <!-- Winner banner + CTA into the detailed results. -->
    <transition name="fsr-rise">
      <div v-if="phase === 'winner'" class="fsr__finale">
        <div class="fsr__finale-line" aria-hidden="true"></div>
        <div class="fsr__winner">
          <template v-if="reveal.winner !== undefined">
            <span class="fsr__winner-label" v-i18n>Winner</span>
            <span class="fsr__winner-name">
              <span class="fsr__lane-dot" :class="'player_bg_color_' + reveal.winner" aria-hidden="true"></span>
              {{ nameOf(reveal.winner) }}
            </span>
          </template>
          <template v-else>
            <span class="fsr__winner-label" v-i18n>Tie</span>
            <span class="fsr__winner-name">{{ winnerNames }}</span>
          </template>
        </div>
        <button type="button" class="fsr__cta" @click="openResults">
          <span class="fsr__cta-sheen" aria-hidden="true"></span>
          <span class="fsr__cta-label" v-i18n>Open detailed results</span>
          <span class="fsr__cta-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {buildFinalScoringRevealModel, FinalScoringRevealModel, RevealGroupKey} from '@/client/components/endgame/finalScoringRevealModel';
import {openEndgameResults} from '@/client/components/endgame/endgameState';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';

// Base step durations (ms). Fast mode scales them down; reduced motion snaps.
const D = {
  intro: 620,
  highlight: 360,
  count: 640,
  between: 460,
  tiebreak: 1300,
  scanStep: 170,
  scanSettle: 460,
};
const FAST_SCALE = 0.4;
// Per-frame easing fraction for the running-total count-up (higher = snappier).
const EASE = 0.16;
const EASE_FAST = 0.34;

type Phase = 'intro' | 'revealing' | 'tiebreak' | 'winnerScan' | 'winner';
type LaneSeg = {index: number; key: string; group: RevealGroupKey; label: string; value: number; leftPct: number; widthPct: number; penalty: boolean};
type Lane = {color: Color; name: string; corp: string; segs: Array<LaneSeg>};
type Inspector = {group: RevealGroupKey; accent: string; label: string; description: string; top: number; left: number; rows: Array<{color: Color; name: string; value: number}>};

// Minimum visible width of a tiny segment (the tooltip still shows the exact value).
const MIN_SEG_PCT = 0.9;

export default defineComponent({
  name: 'FinalScoringReveal',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    // Neutral lane order (seating order) so the lanes never spoil the result.
    playerOrder: {type: Array as () => ReadonlyArray<Color>, required: true},
  },
  data() {
    return {
      phase: 'intro' as Phase,
      // How many segments have been applied to the running totals.
      revealedSegments: 0,
      // The segment index currently being highlighted (-1 = none / between).
      activeSegment: -1,
      // Lane index currently lit by the winner scan (-1 = none).
      scanIndex: -1,
      showTieBreak: false,
      fast: false,
      // Animated running totals + their targets, keyed by color.
      displayed: {} as Record<string, number>,
      targets: {} as Record<string, number>,
      // Hover/focus state — drives cross-highlight + the inspector popover.
      hoverGroup: null as RevealGroupKey | null,
      hoverLane: null as Color | null,
      inspector: undefined as Inspector | undefined,
      timers: [] as Array<number>,
      raf: undefined as number | undefined,
    };
  },
  computed: {
    reveal(): FinalScoringRevealModel {
      return buildFinalScoringRevealModel(this.model, this.playerOrder);
    },
    // Precomputed lane layout (stable) — segment left/width as % of maxTotal,
    // so the per-frame work is only the counters, never layout math.
    lanes(): Array<Lane> {
      const max = this.reveal.maxTotal;
      return this.reveal.players.map((p) => {
        let cum = 0;
        const segs: Array<LaneSeg> = this.reveal.segments.map((seg) => {
          const v = seg.values[p.color] ?? 0;
          let leftPct: number;
          if (v >= 0) {
            leftPct = cum / max * 100;
            cum += v;
          } else {
            cum += v;
            leftPct = cum / max * 100;
          }
          const widthPct = Math.max(MIN_SEG_PCT, Math.abs(v) / max * 100);
          return {index: seg.order, key: seg.key, group: seg.group, label: seg.label, value: v, leftPct, widthPct, penalty: seg.penalty || v < 0};
        });
        return {color: p.color, name: p.name, corp: p.corporation, segs};
      });
    },
    // Groups that have begun revealing — drive the lane chips.
    startedGroupsFor() {
      return this.reveal.groups.filter((g) => this.groupStarted(g.key));
    },
    activeGroupKey(): RevealGroupKey | undefined {
      return this.activeSegment >= 0 ? this.reveal.segments[this.activeSegment]?.group : undefined;
    },
    // The current-stage block content (group label + sub-part + "Stage i of N").
    activeStage(): {accent: string; groupLabel: string; subLabel: string; index: number} | undefined {
      if (this.activeSegment < 0) {
        return undefined;
      }
      const seg = this.reveal.segments[this.activeSegment];
      const gi = this.reveal.groups.findIndex((g) => g.key === seg.group);
      const group = this.reveal.groups[gi];
      if (group === undefined) {
        return undefined;
      }
      // Only show the sub-part line for a multi-segment group (TR).
      const subLabel = group.segmentIndexes.length > 1 ? seg.label : '';
      return {accent: group.accent, groupLabel: group.label, subLabel, index: gi + 1};
    },
    winnerNames(): string {
      return this.reveal.winners.map((c) => this.nameOf(c)).join(' · ');
    },
  },
  methods: {
    nameOf(color: Color): string {
      return this.reveal.players.find((p) => p.color === color)?.name ?? '';
    },
    displayedTotal(color: Color): number {
      return Math.round(this.displayed[color] ?? 0);
    },
    // Running revealed value of a group for a player (sum of its revealed segments).
    groupValue(group: RevealGroupKey, color: Color): number {
      const g = this.reveal.groups.find((x) => x.key === group);
      if (g === undefined) {
        return 0;
      }
      let sum = 0;
      for (const i of g.segmentIndexes) {
        if (i < this.revealedSegments) {
          sum += this.reveal.segments[i].values[color] ?? 0;
        }
      }
      return sum;
    },
    groupStarted(group: RevealGroupKey): boolean {
      const g = this.reveal.groups.find((x) => x.key === group);
      return g !== undefined && g.segmentIndexes.some((i) => i < this.revealedSegments);
    },
    groupDone(group: RevealGroupKey): boolean {
      const g = this.reveal.groups.find((x) => x.key === group);
      return g !== undefined && g.segmentIndexes.every((i) => i < this.revealedSegments);
    },
    groupActive(group: RevealGroupKey): boolean {
      return this.activeGroupKey === group;
    },
    // Hover only on fully-revealed groups — never implies a future value.
    canHover(group: RevealGroupKey): boolean {
      return this.groupDone(group);
    },
    groupHlClass(group: RevealGroupKey): string {
      if (this.hoverGroup === null) {
        return '';
      }
      return this.hoverGroup === group ? 'fsr-hl' : 'fsr-dim';
    },
    segHlClass(group: RevealGroupKey): string {
      return this.groupHlClass(group);
    },
    pendingFor(color: Color): number {
      if (this.phase !== 'revealing' || this.activeSegment < 0) {
        return 0;
      }
      return this.reveal.segments[this.activeSegment]?.values[color] ?? 0;
    },
    isWinnerLane(color: Color): boolean {
      return this.phase === 'winner' && this.reveal.winners.includes(color);
    },
    // ── Hover / inspector ──────────────────────────────────────────────
    onPillHover(group: RevealGroupKey, evt: Event): void {
      this.setHover(group, null, evt);
    },
    onChipHover(group: RevealGroupKey, color: Color, evt: Event): void {
      this.setHover(group, color, evt);
    },
    onSegHover(group: RevealGroupKey, color: Color, evt: Event): void {
      this.setHover(group, color, evt);
    },
    setHover(group: RevealGroupKey, color: Color | null, evt: Event): void {
      if (!this.canHover(group)) {
        return;
      }
      this.hoverGroup = group;
      this.hoverLane = color;
      const g = this.reveal.groups.find((x) => x.key === group);
      const target = evt.currentTarget as HTMLElement | null;
      if (g === undefined || target === null || typeof target.getBoundingClientRect !== 'function') {
        return;
      }
      const r = target.getBoundingClientRect();
      const rows = this.reveal.players.map((p) => ({color: p.color, name: p.name, value: g.values[p.color] ?? 0}));
      // Anchor above the element, clamped to the viewport.
      const width = 232;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, vw - width - 12));
      const top = Math.max(12, r.top - 14 - (74 + rows.length * 22));
      this.inspector = {group, accent: g.accent, label: g.label, description: g.description, top, left, rows};
    },
    clearHover(): void {
      this.hoverGroup = null;
      this.hoverLane = null;
      this.inspector = undefined;
    },
    // ── Controls ───────────────────────────────────────────────────────
    dur(base: number): number {
      if (prefersReducedMotion()) {
        return Math.max(30, base * 0.14);
      }
      return this.fast ? base * FAST_SCALE : base;
    },
    toggleFast(): void {
      this.fast = !this.fast;
    },
    onEsc(): void {
      if (this.phase === 'winner') {
        this.openResults();
      } else {
        this.skipAnimation();
      }
    },
    openResults(): void {
      openEndgameResults();
    },
    setTargets(count: number): void {
      for (const p of this.reveal.players) {
        let sum = 0;
        for (let i = 0; i < count; i++) {
          sum += this.reveal.segments[i].values[p.color] ?? 0;
        }
        this.targets[p.color] = sum;
      }
    },
    // One persistent rAF loop easing every displayed total toward its target.
    startEaseLoop(): void {
      if (typeof requestAnimationFrame === 'undefined') {
        return;
      }
      const tick = () => {
        const ease = this.fast ? EASE_FAST : EASE;
        for (const p of this.reveal.players) {
          const cur = this.displayed[p.color] ?? 0;
          const tgt = this.targets[p.color] ?? 0;
          if (Math.abs(tgt - cur) > 0.4) {
            this.displayed[p.color] = cur + (tgt - cur) * ease;
          } else if (cur !== tgt) {
            this.displayed[p.color] = tgt;
          }
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },
    later(fn: () => void, ms: number): void {
      this.timers.push(window.setTimeout(fn, ms));
    },
    clearTimers(): void {
      for (const id of this.timers) {
        window.clearTimeout(id);
      }
      this.timers = [];
    },
    // ── The step machine: intro → segments → (tie-break) → winner scan → winner.
    runSequence(): void {
      this.later(() => this.revealSegment(0), this.dur(D.intro));
    },
    revealSegment(index: number): void {
      if (index >= this.reveal.segments.length) {
        this.toFinish();
        return;
      }
      this.phase = 'revealing';
      this.activeSegment = index;
      // Highlight (pill + stage + pending +X), then grow the bar + count up.
      this.later(() => {
        this.revealedSegments = index + 1;
        this.setTargets(this.revealedSegments);
        this.later(() => {
          this.activeSegment = -1;
          this.revealSegment(index + 1);
        }, this.dur(D.count) + this.dur(D.between));
      }, this.dur(D.highlight));
    },
    toFinish(): void {
      this.setTargets(this.reveal.segments.length);
      if (this.reveal.tieBreak !== undefined) {
        this.phase = 'tiebreak';
        this.showTieBreak = true;
        this.later(() => this.startWinnerScan(), this.dur(D.tiebreak));
      } else {
        this.startWinnerScan();
      }
    },
    startWinnerScan(): void {
      this.phase = 'winnerScan';
      this.scanStep(0);
    },
    scanStep(i: number): void {
      if (i >= this.lanes.length) {
        this.scanIndex = -1;
        this.later(() => {
          this.phase = 'winner';
        }, this.dur(D.scanSettle));
        return;
      }
      this.scanIndex = i;
      this.later(() => this.scanStep(i + 1), this.dur(D.scanStep));
    },
    // Skip the animation — snap to the finished state, keep the winner CTA.
    skipAnimation(): void {
      this.clearTimers();
      this.revealedSegments = this.reveal.segments.length;
      this.activeSegment = -1;
      this.scanIndex = -1;
      this.setTargets(this.reveal.segments.length);
      for (const p of this.reveal.players) {
        this.displayed[p.color] = this.targets[p.color];
      }
      this.showTieBreak = this.reveal.tieBreak !== undefined;
      this.phase = 'winner';
    },
  },
  created(): void {
    for (const p of this.reveal.players) {
      this.displayed[p.color] = 0;
      this.targets[p.color] = 0;
    }
  },
  mounted(): void {
    this.startEaseLoop();
    (this.$refs.root as HTMLElement | undefined)?.focus?.();
    if (this.reveal.segments.length === 0) {
      this.skipAnimation();
      return;
    }
    this.runSequence();
  },
  beforeUnmount(): void {
    this.clearTimers();
    if (this.raf !== undefined && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.raf);
    }
  },
});
</script>
