<template>
  <!--
    Premium FINAL SCORING REVEAL — the "reward" surface for hidden-VP games.
    Shown the moment a hidden-score game ends, BEFORE the detailed results
    overlay: the score is revealed category by category, each player's running
    total counting up and their lane bar racing, so the winner stays a mystery
    until the last swingy categories land. Wingspan-style suspense, sci-fi skin.

    Numbers come from the SAME endgame model the results screen uses (via the
    pure `finalScoringRevealModel` adapter) — no second source of truth. The
    final totals are NEVER in the DOM until the winner step; lanes only ever
    render the running (revealed-so-far) total.

    Choreography is a small timer-driven step machine + one rAF easing loop
    (transform/opacity/width only). Skippable + speed-up; honours reduced motion.
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

      <!-- Category progress rail. -->
      <ol class="fsr__progress" aria-hidden="true">
        <li v-for="(cat, i) in categories" :key="cat.key"
            class="fsr__progress-node"
            :class="['fsr-cat--' + cat.key, {
              'fsr__progress-node--active': activeCategory === i && phase === 'revealing',
              'fsr__progress-node--done': revealedCount > i,
            }]">
          <span class="fsr__progress-dot" aria-hidden="true"></span>
          <span class="fsr__progress-label" v-i18n>{{ cat.label }}</span>
        </li>
        <li class="fsr__progress-node fsr__progress-node--final"
            :class="{'fsr__progress-node--active': phase === 'tiebreak' || phase === 'winner'}">
          <span class="fsr__progress-dot" aria-hidden="true"></span>
          <span class="fsr__progress-label" v-i18n>Winner</span>
        </li>
      </ol>
    </header>

    <!-- Player lanes (neutral seating order — never ranked, so nothing spoils). -->
    <div class="fsr__lanes">
      <div v-for="p in lanes" :key="p.color"
           class="fsr__lane"
           :class="{
             'fsr__lane--winner': isWinnerLane(p.color),
             'fsr__lane--dim': phase === 'winner' && !isWinnerLane(p.color),
           }">
        <div class="fsr__lane-id">
          <span v-if="isWinnerLane(p.color)" class="fsr__crown" aria-hidden="true">♔</span>
          <span class="fsr__lane-dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
          <span class="fsr__lane-name">{{ p.name }}</span>
          <span v-if="p.corporation !== ''" class="fsr__lane-corp" v-i18n>{{ p.corporation }}</span>
        </div>

        <div class="fsr__lane-bar">
          <div class="fsr__lane-fill" :style="{width: barPct(p.color) + '%'}">
            <span class="fsr__lane-fill-glow" aria-hidden="true"></span>
          </div>
        </div>

        <div class="fsr__lane-total">
          <span class="fsr__lane-total-num">{{ displayedTotal(p.color) }}</span>
          <span class="fsr__lane-total-unit" v-i18n>VP</span>
        </div>

        <transition-group tag="div" class="fsr__lane-chips" name="fsr-chip">
          <span v-for="chip in revealedChipsFor(p.color)" :key="chip.key"
                class="fsr__chip"
                :class="['fsr-cat--' + chip.key, {'fsr__chip--penalty': chip.value < 0, 'fsr__chip--zero': chip.value === 0}]">
            <span class="fsr__chip-label" v-i18n>{{ chip.label }}</span>
            <span class="fsr__chip-val">{{ chip.value >= 0 ? '+' + chip.value : chip.value }}</span>
          </span>
        </transition-group>
      </div>
    </div>

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
import {buildFinalScoringRevealModel, FinalScoringRevealModel} from '@/client/components/endgame/finalScoringRevealModel';
import {openEndgameResults} from '@/client/components/endgame/endgameState';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';

// Base step durations (ms). Fast mode scales them down; reduced motion snaps.
const D = {
  intro: 650,
  highlight: 460,
  count: 720,
  between: 560,
  tiebreak: 1300,
};
const FAST_SCALE = 0.38;
// Per-frame easing fraction for the running-total count-up (higher = snappier).
const EASE = 0.16;
const EASE_FAST = 0.34;

type Phase = 'intro' | 'revealing' | 'tiebreak' | 'winner';
type RevealedChip = {key: string; label: string; value: number};

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
      // How many categories have been applied to the running totals.
      revealedCount: 0,
      // The category index currently being highlighted (-1 = none / between).
      activeCategory: -1,
      showTieBreak: false,
      fast: false,
      // Animated running totals + their targets, keyed by color.
      displayed: {} as Record<string, number>,
      targets: {} as Record<string, number>,
      timers: [] as Array<number>,
      raf: undefined as number | undefined,
    };
  },
  computed: {
    reveal(): FinalScoringRevealModel {
      return buildFinalScoringRevealModel(this.model, this.playerOrder);
    },
    lanes() {
      return this.reveal.players;
    },
    categories() {
      return this.reveal.categories;
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
    barPct(color: Color): number {
      const v = (this.displayed[color] ?? 0) / this.reveal.maxTotal * 100;
      return Math.max(0, Math.min(100, v));
    },
    // The category chips already revealed for a lane (oldest → newest).
    revealedChipsFor(color: Color): Array<RevealedChip> {
      const out: Array<RevealedChip> = [];
      for (let i = 0; i < this.revealedCount; i++) {
        const cat = this.categories[i];
        out.push({key: cat.key, label: cat.label, value: cat.values[color] ?? 0});
      }
      return out;
    },
    isWinnerLane(color: Color): boolean {
      return this.phase === 'winner' && this.reveal.winners.includes(color);
    },
    dur(base: number): number {
      if (prefersReducedMotion()) {
        return Math.max(40, base * 0.16);
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
    // Recompute every lane's target to the running total through `count` categories.
    setTargets(count: number): void {
      for (const p of this.reveal.players) {
        let sum = 0;
        for (let i = 0; i < count; i++) {
          sum += this.categories[i].values[p.color] ?? 0;
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
          } else {
            this.displayed[p.color] = tgt;
          }
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },
    later(fn: () => void, ms: number): void {
      const id = window.setTimeout(fn, ms);
      this.timers.push(id);
    },
    clearTimers(): void {
      for (const id of this.timers) {
        window.clearTimeout(id);
      }
      this.timers = [];
    },
    // The step machine: intro → each category → (tie-break) → winner.
    runSequence(): void {
      this.later(() => this.revealCategory(0), this.dur(D.intro));
    },
    revealCategory(index: number): void {
      if (index >= this.categories.length) {
        this.toFinish();
        return;
      }
      this.phase = 'revealing';
      this.activeCategory = index;
      // Highlight first, then drop the chip + count the totals up.
      this.later(() => {
        this.revealedCount = index + 1;
        this.setTargets(this.revealedCount);
        this.later(() => {
          this.activeCategory = -1;
          this.revealCategory(index + 1);
        }, this.dur(D.count) + this.dur(D.between));
      }, this.dur(D.highlight));
    },
    toFinish(): void {
      // Make sure the counters land exactly on the final totals.
      this.setTargets(this.categories.length);
      if (this.reveal.tieBreak !== undefined) {
        this.phase = 'tiebreak';
        this.showTieBreak = true;
        this.later(() => this.toWinner(), this.dur(D.tiebreak));
      } else {
        this.toWinner();
      }
    },
    toWinner(): void {
      this.phase = 'winner';
    },
    // Skip the animation — snap to the finished state, keep the winner CTA.
    skipAnimation(): void {
      this.clearTimers();
      this.revealedCount = this.categories.length;
      this.activeCategory = -1;
      this.setTargets(this.categories.length);
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
    const el = this.$refs.root as HTMLElement | undefined;
    el?.focus?.();
    if (this.categories.length === 0) {
      // Degenerate (no scoring categories) — go straight to the winner.
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
