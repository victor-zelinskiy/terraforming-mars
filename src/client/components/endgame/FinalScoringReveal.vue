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
        <span v-i18n>Final reveal</span>
        <span class="fsr__eyebrow-sep">·</span>
        <span>{{ reveal.generation }} <span v-i18n>generations</span></span>
        <span class="fsr__eyebrow-tick" aria-hidden="true"></span>
      </div>
      <h2 class="fsr__title" v-i18n>Final scoring</h2>
      <p class="fsr__subtitle" v-i18n>Revealing the result by category.</p>

      <!-- Premium scoring timeline (single row, never wraps; Winner is the last
           node). Hover/focus a node → highlight that group everywhere. -->
      <ol class="fsr__timeline" role="list">
        <template v-for="g in reveal.groups" :key="g.key">
          <li class="fsr__tl-node"
              :class="['fsr-cat--' + g.accent, hlClass(g.key), {
                'fsr__tl-node--active': activeGroupKey === g.key && phase === 'revealing',
                'fsr__tl-node--done': groupDone(g.key),
                'fsr__tl-node--upcoming': !groupStarted(g.key),
                'fsr__tl-node--interactive': canHover(g.key),
              }]"
              :tabindex="canHover(g.key) ? 0 : -1"
              @mouseenter="onPillHover(g.key, $event)" @mouseleave="scheduleClose"
              @focus="onPillHover(g.key, $event)" @blur="scheduleClose">
            <span class="fsr__tl-dot" aria-hidden="true"></span>
            <span class="fsr__tl-label" v-i18n>{{ g.label }}</span>
          </li>
          <li class="fsr__tl-link" :class="{'fsr__tl-link--filled': groupDone(g.key)}" aria-hidden="true"></li>
        </template>
        <li class="fsr__tl-node fsr__tl-node--final"
            :class="{
              'fsr__tl-node--active': phase === 'winner',
              'fsr__tl-node--scanning': phase === 'tiebreak' || phase === 'winnerScan',
              'fsr__tl-node--upcoming': phase === 'intro' || phase === 'revealing',
            }">
          <span class="fsr__tl-dot" aria-hidden="true"></span>
          <span class="fsr__tl-label" v-i18n>Winner</span>
        </li>
      </ol>
    </header>

    <!-- Current-stage text: "Revealing: <group> · <subcategory>" + description. -->
    <transition name="fsr-fade">
      <div v-if="phase === 'revealing' && activeStage !== undefined" class="fsr__stage" :class="'fsr-cat--' + activeStage.accent">
        <span class="fsr__stage-bar" aria-hidden="true"></span>
        <div class="fsr__stage-body">
          <div class="fsr__stage-line">
            <span class="fsr__stage-kicker" v-i18n>Revealing:</span>
            <span class="fsr__stage-group" v-i18n>{{ activeStage.groupLabel }}</span>
            <span v-if="activeStage.subLabel !== ''" class="fsr__stage-sep" aria-hidden="true">·</span>
            <span v-if="activeStage.subLabel !== ''" class="fsr__stage-sub" v-i18n>{{ activeStage.subLabel }}</span>
          </div>
          <span class="fsr__stage-desc" v-i18n>{{ activeStage.description }}</span>
        </div>
        <span class="fsr__stage-step">{{ stageStepText }}</span>
      </div>
    </transition>

    <!-- Player lanes (neutral seating order — never ranked, so nothing spoils). -->
    <div class="fsr__lanes">
      <div v-for="(lane, li) in lanes" :key="lane.color"
           class="fsr__lane"
           :class="{
             'fsr__lane--winner': isWinnerLane(lane.color),
             'fsr__lane--leader': isLeaderLane(lane.color),
             'fsr__lane--dim': phase === 'winner' && !isWinnerLane(lane.color),
             'fsr__lane--hot': hoverLane === lane.color,
             'fsr__lane--scan': phase === 'winnerScan' && scanIndex === li,
           }">
        <div class="fsr__lane-id">
          <span v-if="isWinnerLane(lane.color)" class="fsr__crown" aria-hidden="true">♔</span>
          <span v-else-if="isLeaderLane(lane.color)" class="fsr__leadmark" aria-hidden="true">▲</span>
          <span class="fsr__lane-dot" :class="'player_bg_color_' + lane.color" aria-hidden="true"></span>
          <span class="fsr__lane-name">{{ lane.name }}</span>
          <span v-if="lane.corp !== ''" class="fsr__lane-corp" v-i18n>{{ lane.corp }}</span>
        </div>

        <!-- STACKED segmented bar: absolutely-positioned segments, reveal via scaleX.
             Penalty segments overlay the tail and reveal from the RIGHT (subtractive). -->
        <div class="fsr__lane-bar">
          <div v-for="seg in lane.segs" :key="seg.key"
               class="fsr__seg"
               :class="['fsr-cat--' + seg.key, hlClass(seg.group, seg.key), {
                 'fsr__seg--revealed': seg.index < revealedSegments,
                 'fsr__seg--sub': seg.subtractive,
                 'fsr__seg--active': activeSegment === seg.index,
               }]"
               :style="{left: seg.leftPct + '%', width: seg.widthPct + '%'}"
               @mouseenter="onSegHover(seg.group, seg.key, lane.color, $event)" @mouseleave="scheduleClose"></div>
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

        <!-- One chip per STARTED group (running value; a ▸ marks a group with
             subcategories — hover to expand its subchips below). -->
        <transition-group tag="div" class="fsr__lane-chips" name="fsr-chip">
          <span v-for="g in startedGroupsFor" :key="g.key"
                class="fsr__chip"
                :class="['fsr-cat--' + g.accent, hlClass(g.key), {
                  'fsr__chip--penalty': groupValue(g.key, lane.color) < 0,
                  'fsr__chip--active': groupActive(g.key) || hoverGroup === g.key,
                  'fsr__chip--interactive': canHover(g.key),
                }]"
                :tabindex="canHover(g.key) ? 0 : -1"
                @mouseenter="onChipHover(g.key, lane.color, $event)" @mouseleave="scheduleClose"
                @focus="onChipHover(g.key, lane.color, $event)" @blur="scheduleClose">
            <span class="fsr__chip-label" v-i18n>{{ g.label }}</span>
            <span class="fsr__chip-val">{{ groupValue(g.key, lane.color) >= 0 ? '+' + groupValue(g.key, lane.color) : groupValue(g.key, lane.color) }}</span>
            <span v-if="hasSubs(g.key)" class="fsr__chip-more" aria-hidden="true">▸</span>
          </span>
        </transition-group>

        <!-- TWO PERMANENT breakdown rows (Terraform rating + Cards). Always
             reserved (never display:none) so the lane height is rock-stable;
             chips change STATE (ghost → revealed) rather than the row toggling.
             A leading bracket + label ties each row to its parent category. -->
        <div v-for="row in breakdownRows" :key="row.group"
             class="fsr__brow"
             :class="['fsr-cat--' + row.accent, 'fsr__brow--' + row.group, {
               'fsr__brow--active': activeGroupKey === row.group && phase === 'revealing',
               'fsr__brow--settled': groupDone(row.group),
             }]">
          <span class="fsr__brow-tag" aria-hidden="true">
            <span class="fsr__brow-bracket"></span>
            <span class="fsr__brow-name" v-i18n>{{ row.shortLabel }}</span>
          </span>
          <div class="fsr__brow-chips">
            <span v-for="sub in row.subs" :key="sub.key"
                  class="fsr__subchip"
                  :class="['fsr-cat--' + sub.accent, hlClass(sub.group, sub.key), {
                    'fsr__subchip--ghost': !subRevealed(sub.index),
                    'fsr__subchip--active': activeSegment === sub.index,
                    'fsr__subchip--neg': subRevealed(sub.index) && subValue(sub.index, lane.color) < 0,
                  }]"
                  :tabindex="subRevealed(sub.index) ? 0 : -1"
                  @mouseenter="onSubchipHover(sub.group, sub.key, lane.color, $event)" @mouseleave="scheduleClose"
                  @focus="onSubchipHover(sub.group, sub.key, lane.color, $event)" @blur="scheduleClose">
              <span class="fsr__subchip-dot" aria-hidden="true"></span>
              <span class="fsr__subchip-label" v-i18n>{{ sub.label }}</span>
              <span class="fsr__subchip-val">{{ subRevealed(sub.index) ? (subValue(sub.index, lane.color) >= 0 ? '+' + subValue(sub.index, lane.color) : subValue(sub.index, lane.color)) : '?' }}</span>
            </span>
            <span v-if="row.subs.length === 0" class="fsr__brow-empty" aria-hidden="true">—</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Rich, interactive explainability panel (revealed groups only — never
         leaks future VP). Teleported to body so `position: fixed` resolves
         against the viewport (the .fsr backdrop-filter would otherwise be its
         containing block) and the cursor can travel into it. -->
    <Teleport to="body">
      <transition name="fsr-fade">
        <div v-if="inspector !== undefined" class="fsr__inspector-wrap"
             :style="{top: inspector.top + 'px', left: inspector.left + 'px'}">
          <FinalScoringInspector :content="inspector" @keep="cancelClose" @release="scheduleClose" />
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

    <!-- Bottom panel: the CURRENT LEADER during the reveal (a neutral status),
         which LOCKS IN to the gold winner only after every category. -->
    <div v-if="phase !== 'intro'" class="fsr__leaderboard" :class="{'fsr__leaderboard--winner': phase === 'winner'}">
      <div class="fsr__finale-line" aria-hidden="true"></div>
      <transition name="fsr-rise" mode="out-in">
        <!-- During reveal: current leader (neutral marker, never the crown). -->
        <div v-if="phase !== 'winner'" key="leader" class="fsr__lead">
          <span class="fsr__lead-label" v-i18n>{{ leaderTitleKey }}</span>
          <transition name="fsr-leader" mode="out-in">
            <div :key="leaderNames" class="fsr__lead-main">
              <span class="fsr__leadmark fsr__leadmark--big" aria-hidden="true">▲</span>
              <span v-if="leader.colors.length === 1" class="fsr__lane-dot" :class="'player_bg_color_' + leader.colors[0]" aria-hidden="true"></span>
              <span class="fsr__lead-name">{{ leaderNames }}</span>
              <span class="fsr__lead-total">{{ leader.total }} <span v-i18n>VP</span></span>
            </div>
          </transition>
          <span v-if="leader.colors.length === 1 && leader.margin > 0" class="fsr__lead-sub">{{ leaderMarginText }}</span>
        </div>

        <!-- After every category: the winner locks in (gold treatment + CTA). -->
        <div v-else key="winner" class="fsr__finale">
          <div class="fsr__winner">
            <template v-if="reveal.winner !== undefined">
              <span class="fsr__winner-label" v-i18n>Winner</span>
              <span class="fsr__winner-name">
                <span class="fsr__winner-crown" aria-hidden="true">♔</span>
                <span class="fsr__lane-dot" :class="'player_bg_color_' + reveal.winner" aria-hidden="true"></span>
                {{ nameOf(reveal.winner) }}
                <span class="fsr__winner-total">{{ leader.total }} <span v-i18n>VP</span></span>
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
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardVictoryPointsKind} from '@/common/game/VictoryPointsBreakdown';
import {getCard} from '@/client/cards/ClientCardManifest';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {buildFinalScoringRevealModel, cardKindTotal, FinalScoringRevealModel, FinalScoringInspectorContent, RevealGroupKey} from '@/client/components/endgame/finalScoringRevealModel';
import {openEndgameResults} from '@/client/components/endgame/endgameState';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {translateTextWithParams} from '@/client/directives/i18n';
import FinalScoringInspector from '@/client/components/endgame/FinalScoringInspector.vue';

// Base step durations (ms). Reduced motion snaps them.
const D = {
  intro: 620,
  highlight: 360,
  count: 640,
  between: 460,
  tiebreak: 1300,
  scanStep: 170,
  scanSettle: 460,
};
// Per-frame easing fraction for the running-total count-up.
const EASE = 0.16;
// Close-bridge delay so the cursor can travel from a trigger into the panel.
const INSPECTOR_CLOSE_MS = 240;

type Phase = 'intro' | 'revealing' | 'tiebreak' | 'winnerScan' | 'winner';
type LaneSeg = {index: number; key: string; group: RevealGroupKey; label: string; value: number; leftPct: number; widthPct: number; subtractive: boolean};
type Lane = {color: Color; name: string; corp: string; segs: Array<LaneSeg>};

const CARD_KIND_LABEL: Record<CardVictoryPointsKind, string> = {
  resource: 'Resource cards',
  conditional: 'Conditional cards',
  fixed: 'Fixed VP cards',
  penalty: 'Penalties',
};

// Minimum visible width of a tiny segment (the tooltip still shows the exact value).
const MIN_SEG_PCT = 0.7;
// Group-level card list is capped; hover a subcategory for the full list.
const MAX_GROUP_CARDS = 5;

export default defineComponent({
  name: 'FinalScoringReveal',
  components: {FinalScoringInspector},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    // Neutral lane order (seating order) so the lanes never spoil the result.
    playerOrder: {type: Array as () => ReadonlyArray<Color>, required: true},
    // Resource counts on each player's cards (card name → units) — for the
    // inspector's resource-card detail. Optional → absent rows just omit it.
    cardResources: {type: Object as () => Partial<Record<Color, Partial<Record<CardName, number>>>> | undefined, default: undefined},
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
      // Animated running totals + their targets, keyed by color.
      displayed: {} as Record<string, number>,
      targets: {} as Record<string, number>,
      // Unified interaction state — one selection drives timeline + chips +
      // subchips + bar + popup. `hoverSub` (a segment key) scopes to a single
      // subcategory; null means the whole group.
      hoverGroup: null as RevealGroupKey | null,
      hoverSub: null as string | null,
      hoverLane: null as Color | null,
      inspector: undefined as (FinalScoringInspectorContent & {top: number; left: number}) | undefined,
      closeTimer: undefined as number | undefined,
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
        // Positives stack left→right; penalties are placed as overlays on the
        // TAIL of the positive bar (they reveal from the right and "eat" length).
        let posCum = 0;
        let penCum: number | null = null;
        const segs: Array<LaneSeg> = this.reveal.segments.map((seg) => {
          const v = seg.values[p.color] ?? 0;
          let leftPct: number;
          let subtractive = false;
          if (v >= 0) {
            leftPct = posCum / max * 100;
            posCum += v;
          } else {
            if (penCum === null) {
              penCum = posCum; // penalties begin at the positive end
            }
            penCum -= Math.abs(v);
            leftPct = penCum / max * 100;
            subtractive = true;
          }
          const widthPct = Math.max(MIN_SEG_PCT, Math.abs(v) / max * 100);
          return {index: seg.order, key: seg.key, group: seg.group, label: seg.label, value: v, leftPct, widthPct, subtractive};
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
    // The TWO PERMANENT breakdown rows (Terraform rating + Cards). Each is
    // ALWAYS reserved — its full set of sub-segments is fixed at build time, so
    // the rows never appear/disappear and the lane height stays stable. Chips
    // change STATE (ghost → revealed) instead of the row showing/hiding.
    breakdownRows(): Array<{group: RevealGroupKey; accent: string; shortLabel: string; subs: Array<{index: number; key: string; group: RevealGroupKey; label: string; accent: string}>}> {
      const subsFor = (g: RevealGroupKey) => this.reveal.segments
        .filter((s) => s.group === g)
        .map((s) => ({index: s.order, key: s.key, group: s.group, label: s.label, accent: s.key}));
      return [
        {group: 'tr', accent: 'tr-cards', shortLabel: 'TR', subs: subsFor('tr')},
        {group: 'cards', accent: 'cards', shortLabel: 'Cards', subs: subsFor('cards')},
      ];
    },
    // The current leader by the categories revealed SO FAR (running totals).
    // Neutral mid-reveal status — NOT the final winner.
    leader(): {colors: Array<Color>; total: number; margin: number} {
      const totals = this.reveal.players.map((p) => this.targets[p.color] ?? 0);
      const max = totals.length > 0 ? Math.max(...totals) : 0;
      const colors = this.reveal.players.filter((p) => (this.targets[p.color] ?? 0) === max).map((p) => p.color);
      const sorted = [...totals].sort((a, b) => b - a);
      const margin = sorted.length > 1 ? sorted[0] - sorted[1] : 0;
      return {colors, total: max, margin};
    },
    // The current-stage block content (group label + sub-part + "Stage i of N").
    activeStage(): {accent: string; groupLabel: string; subLabel: string; description: string; index: number} | undefined {
      if (this.activeSegment < 0) {
        return undefined;
      }
      const seg = this.reveal.segments[this.activeSegment];
      const gi = this.reveal.groups.findIndex((g) => g.key === seg.group);
      const group = this.reveal.groups[gi];
      if (group === undefined) {
        return undefined;
      }
      // Only show the sub-part line for a multi-segment group (TR / Cards / Penalties).
      const subLabel = group.segmentIndexes.length > 1 ? seg.label : '';
      return {accent: group.accent, groupLabel: group.label, subLabel, description: group.description, index: gi + 1};
    },
    winnerNames(): string {
      return this.reveal.winners.map((c) => this.nameOf(c)).join(' · ');
    },
    // Leader-panel display text (mid-reveal) — single leader vs tie.
    leaderTitleKey(): string {
      return this.leader.colors.length > 1 ? 'Tie for the lead' : 'Leader after revealed categories';
    },
    leaderNames(): string {
      return this.leader.colors.map((c) => this.nameOf(c)).join(' · ');
    },
    leaderMarginText(): string {
      return translateTextWithParams('+${0} ahead of the runner-up', [String(this.leader.margin)]);
    },
    // Translated + substituted here (NOT via v-i18n="[params]", which mutates the
    // template text on first run and then sticks — "Stage 1 of N" forever).
    stageStepText(): string {
      if (this.activeStage === undefined) {
        return '';
      }
      return translateTextWithParams('Stage ${0} of ${1}', [String(this.activeStage.index), String(this.reveal.groups.length)]);
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
    hasSubs(group: RevealGroupKey): boolean {
      const g = this.reveal.groups.find((x) => x.key === group);
      return g !== undefined && g.segmentIndexes.length > 1;
    },
    // Hover only on fully-revealed groups — never implies a future value.
    canHover(group: RevealGroupKey): boolean {
      return this.groupDone(group);
    },
    // Unified highlight: one selection (group or sub-segment) lights up the
    // matching timeline node / chip / subchip / bar segment, dims the rest.
    // Pass (group) for a top-level element, (group, subKey) for a sub element.
    hlClass(group: RevealGroupKey, subKey?: string): string {
      if (this.hoverSub !== null) {
        if (subKey !== undefined) {
          return subKey === this.hoverSub ? 'fsr-hl' : 'fsr-dim';
        }
        return group === this.hoverGroup ? 'fsr-hl' : 'fsr-dim';
      }
      if (this.hoverGroup === null) {
        return '';
      }
      return group === this.hoverGroup ? 'fsr-hl' : 'fsr-dim';
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
    // Mid-reveal leader lane — a NEUTRAL marker, never the gold winner treatment.
    isLeaderLane(color: Color): boolean {
      return (this.phase === 'revealing' || this.phase === 'tiebreak' || this.phase === 'winnerScan') &&
        this.revealedSegments > 0 && this.leader.colors.length === 1 && this.leader.colors[0] === color;
    },
    // Running revealed value of a single sub-segment (for the subchips).
    subValue(segIndex: number, color: Color): number {
      return this.reveal.segments[segIndex]?.values[color] ?? 0;
    },
    // The two groups that have a PERMANENT breakdown row — their detail lives in
    // those rows, so their top-level chip only highlights (never opens a popup).
    hasBreakdownRow(group: RevealGroupKey): boolean {
      return group === 'tr' || group === 'cards';
    },
    subRevealed(segIndex: number): boolean {
      return segIndex < this.revealedSegments;
    },
    // ── Hover / inspector ──────────────────────────────────────────────
    // A TOP-LEVEL category (pill or chip): TR / Cards only HIGHLIGHT (their
    // detail is the always-visible breakdown row); every other (leaf) category
    // opens its own scoped popup directly.
    onPillHover(group: RevealGroupKey, evt: Event): void {
      if (this.hasBreakdownRow(group)) {
        this.highlightOnly(group);
      } else {
        this.setHover(group, null, null, evt);
      }
    },
    onChipHover(group: RevealGroupKey, color: Color, evt: Event): void {
      if (this.hasBreakdownRow(group)) {
        this.highlightOnly(group);
      } else {
        this.setHover(group, null, color, evt);
      }
    },
    // A subchip opens its subcategory popup (only once its group is revealed —
    // setHover gates on canHover, so a ghost subchip never leaks a value).
    onSubchipHover(group: RevealGroupKey, subKey: string, color: Color, evt: Event): void {
      this.setHover(group, subKey, color, evt);
    },
    // A bar segment IS a subcategory — scope to it (unless its group has one segment).
    onSegHover(group: RevealGroupKey, subKey: string, color: Color, evt: Event): void {
      const g = this.reveal.groups.find((x) => x.key === group);
      const sub = g !== undefined && g.segmentIndexes.length > 1 ? subKey : null;
      this.setHover(group, sub, color, evt);
    },
    // Highlight a group everywhere WITHOUT opening a popup (top-level multi-sub).
    highlightOnly(group: RevealGroupKey): void {
      this.cancelClose();
      this.hoverGroup = group;
      this.hoverSub = null;
      this.hoverLane = null;
      this.inspector = undefined;
    },
    setHover(group: RevealGroupKey, subKey: string | null, color: Color | null, evt: Event): void {
      if (!this.canHover(group)) {
        return;
      }
      this.cancelClose();
      this.hoverGroup = group;
      this.hoverSub = subKey;
      this.hoverLane = color;
      const content = this.buildInspectorContent(group, subKey, color);
      const target = evt.currentTarget as HTMLElement | null;
      if (content === undefined || target === null || typeof target.getBoundingClientRect !== 'function') {
        return;
      }
      const r = target.getBoundingClientRect();
      // Approximate panel height for above/below placement + clamp to viewport.
      const width = 318;
      const estH = 92 + content.subRows.length * 20 + content.cards.length * 22 + content.sources.length * 20 + content.compare.length * 22;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, vw - width - 12));
      let top = r.top - 12 - estH;
      if (top < 12) {
        top = r.bottom + 12; // flip below when there's no room above
      }
      this.inspector = {...content, top, left};
    },
    // Build the breakdown for a category (subKey === null) OR a SINGLE
    // subcategory (subKey set → scoped: only that sub-part's data). Reads
    // model.players[].breakdown — the SAME numbers the results screen uses.
    buildInspectorContent(group: RevealGroupKey, subKey: string | null, color: Color | null): FinalScoringInspectorContent | undefined {
      const g = this.reveal.groups.find((x) => x.key === group);
      if (g === undefined) {
        return undefined;
      }
      const seg = subKey !== null ? this.reveal.segments.find((s) => s.key === subKey) : undefined;
      const base = {
        group,
        accent: seg !== undefined ? seg.key : g.accent,
        label: seg !== undefined ? seg.label : g.label,
        description: g.description,
      };
      if (color === null) {
        // Pill hover → cross-player comparison.
        return {
          ...base, playerName: '', playerColor: undefined, total: 0,
          subRows: [], cards: [], cardsLabel: '', hint: '', sources: [], sourcesLabel: '',
          compare: this.reveal.players.map((p) => ({color: p.color, name: p.name, value: g.values[p.color] ?? 0})),
        };
      }
      const b = this.model.players.find((p) => p.color === color)?.breakdown;
      const content: FinalScoringInspectorContent = {
        ...base, playerName: this.nameOf(color), playerColor: color,
        total: seg !== undefined ? (seg.values[color] ?? 0) : (g.values[color] ?? 0),
        subRows: [], cards: [], cardsLabel: '', hint: '', sources: [], sourcesLabel: '', compare: [],
      };
      if (b === undefined) {
        return content;
      }
      // Resources are only meaningful for RESOURCE cards (their VP = stored resources).
      const cardOf = (d: {cardName: string; kind: CardVictoryPointsKind; victoryPoint: number}) =>
        ({name: d.cardName as CardName, kindLabel: CARD_KIND_LABEL[d.kind], vp: d.victoryPoint, resourcesText: d.kind === 'resource' ? this.resourcesText(color, d.cardName) : undefined});

      // ── SCOPED: a single subcategory ──────────────────────────────────
      if (subKey !== null) {
        const kindBySub: Partial<Record<string, CardVictoryPointsKind>> = {'cards-fixed': 'fixed', 'cards-conditional': 'conditional', 'cards-resource': 'resource'};
        const kind = kindBySub[subKey];
        if (subKey === 'tr-cards') {
          // The "Cards & effects" TR sub-part — itemise the per-source TR entries
          // (card sources get a card preview; the rest are plain source rows).
          content.description = 'TR gained from cards, bonuses and effects';
          for (const e of [...b.terraformRatingBreakdown.cardEntries ?? []].sort((a, c) => c.amount - a.amount)) {
            if (e.sourceCardId !== undefined) {
              content.cards = [...content.cards, {name: e.sourceCardId as CardName, kindLabel: this.trSourceTypeLabel(e.sourceType, e.sourceCardId), vp: e.amount}];
            } else {
              content.sources = [...content.sources, {text: this.$t(e.sourceName), vp: e.amount}];
            }
          }
        } else if (kind !== undefined) {
          content.cards = b.detailsCards.filter((d) => d.kind === kind && d.victoryPoint > 0)
            .slice().sort((a, c) => c.victoryPoint - a.victoryPoint).map(cardOf);
        } else if (subKey === 'penalty-cards') {
          content.cards = b.detailsCards.filter((d) => d.kind === 'penalty' || d.victoryPoint < 0)
            .slice().sort((a, c) => a.victoryPoint - c.victoryPoint).map(cardOf);
        } else if (subKey === 'penalty-ev' && b.escapeVelocity !== 0) {
          content.sources = [{text: this.$t('Escape Velocity'), vp: b.escapeVelocity}];
        }
        // TR / moon sub-parts have no finer breakdown — the header total says it all.
        // No section header (cardsLabel/sourcesLabel) — the title IS the category.
        return content;
      }

      // ── GROUP level: sub-breakdown + a CAPPED card list + a hint ───────
      if (group === 'tr') {
        const t = b.terraformRatingBreakdown;
        content.subRows = ([
          {key: 'tr-base', label: 'Base rating', accent: 'tr-base', value: t.baseRating ?? t.base},
          {key: 'tr-handicap', label: 'Handicap', accent: 'tr-base', value: t.handicap ?? 0},
          {key: 'tr-temperature', label: 'Temperature', accent: 'tr-temperature', value: t.temperature},
          {key: 'tr-oxygen', label: 'Oxygen', accent: 'tr-oxygen', value: t.oxygen},
          {key: 'tr-oceans', label: 'Oceans', accent: 'tr-oceans', value: t.oceans},
          {key: 'tr-venus', label: 'Venus', accent: 'tr-venus', value: t.venus},
          {key: 'tr-cards', label: 'Cards & effects', accent: 'tr-cards', value: t.cards},
        ]).filter((r) => r.value !== 0);
      } else if (group === 'cards') {
        content.subRows = ([
          {key: 'cards-fixed', label: 'Fixed VP cards', accent: 'cards-fixed', value: cardKindTotal(b, 'fixed')},
          {key: 'cards-conditional', label: 'Conditional cards', accent: 'cards-conditional', value: cardKindTotal(b, 'conditional')},
          {key: 'cards-resource', label: 'Resource cards', accent: 'cards-resource', value: cardKindTotal(b, 'resource')},
        ]).filter((r) => r.value !== 0);
        const all = b.detailsCards.filter((d) => d.kind !== 'penalty' && d.victoryPoint > 0).slice().sort((a, c) => c.victoryPoint - a.victoryPoint);
        content.cards = all.slice(0, MAX_GROUP_CARDS).map(cardOf);
        content.cardsLabel = content.cards.length > 0 ? 'Top cards' : '';
        content.hint = all.length > MAX_GROUP_CARDS ? 'Hover a subcategory for the full list' : '';
      } else if (group === 'milestones') {
        content.sources = b.detailsMilestones.map((m) => ({text: translateTextWithParams(m.message, m.messageArgs ?? []), vp: m.victoryPoint}));
        content.sourcesLabel = content.sources.length > 0 ? 'Milestones' : '';
      } else if (group === 'awards') {
        content.sources = b.detailsAwards.map((m) => ({text: translateTextWithParams(m.message, m.messageArgs ?? []), vp: m.victoryPoint}));
        content.sourcesLabel = content.sources.length > 0 ? 'Awards' : '';
      } else if (group === 'penalty') {
        content.subRows = ([
          {key: 'penalty-cards', label: 'Card penalties', accent: 'penalty-cards', value: cardKindTotal(b, 'penalty')},
          {key: 'penalty-ev', label: 'Escape Velocity', accent: 'penalty-ev', value: b.escapeVelocity},
        ]).filter((r) => r.value !== 0);
        content.cards = b.detailsCards.filter((d) => d.kind === 'penalty' || d.victoryPoint < 0)
          .slice().sort((a, c) => a.victoryPoint - c.victoryPoint).map(cardOf);
        content.cardsLabel = content.cards.length > 0 ? 'Card penalties' : '';
      } else if (group === 'moon') {
        content.subRows = ([
          {key: 'moon-hab', label: 'Habitats', accent: 'moon', value: b.moonHabitats},
          {key: 'moon-mine', label: 'Mines', accent: 'moon', value: b.moonMines},
          {key: 'moon-road', label: 'Roads', accent: 'moon', value: b.moonRoads},
        ]).filter((r) => r.value !== 0);
      }
      return content;
    },
    resourcesText(color: Color, cardName: string): string | undefined {
      const n = this.cardResources?.[color]?.[cardName as CardName];
      if (n === undefined || n <= 0) {
        return undefined;
      }
      return translateTextWithParams('${0} res.', [String(n)]);
    },
    // A short "source type" label (i18n KEY — rendered via v-i18n) for a TR
    // entry; refines a card source into prelude / CEO / corporation via the manifest.
    trSourceTypeLabel(sourceType: string, cardId?: string): string {
      if (sourceType === 'venusTrackBonus') {
        return 'Track bonus';
      }
      if (sourceType === 'globalEvent') {
        return 'Global event';
      }
      if (sourceType === 'party') {
        return 'Party';
      }
      if (cardId !== undefined) {
        const t = getCard(cardId as CardName)?.type;
        if (t === CardType.PRELUDE) {
          return 'Prelude';
        }
        if (t === CardType.CEO) {
          return 'CEO';
        }
        if (t === CardType.CORPORATION || sourceType === 'corporation') {
          return 'Corporation';
        }
        return 'Card';
      }
      return 'Effect';
    },
    scheduleClose(): void {
      this.cancelClose();
      this.closeTimer = window.setTimeout(() => this.clearHover(), INSPECTOR_CLOSE_MS);
    },
    cancelClose(): void {
      if (this.closeTimer !== undefined) {
        window.clearTimeout(this.closeTimer);
        this.closeTimer = undefined;
      }
    },
    clearHover(): void {
      this.cancelClose();
      this.hoverGroup = null;
      this.hoverSub = null;
      this.hoverLane = null;
      this.inspector = undefined;
    },
    // ── Controls ───────────────────────────────────────────────────────
    dur(base: number): number {
      if (prefersReducedMotion()) {
        return Math.max(30, base * 0.14);
      }
      return base;
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
        for (const p of this.reveal.players) {
          const cur = this.displayed[p.color] ?? 0;
          const tgt = this.targets[p.color] ?? 0;
          if (Math.abs(tgt - cur) > 0.4) {
            this.displayed[p.color] = cur + (tgt - cur) * EASE;
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
    this.cancelClose();
    if (this.raf !== undefined && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.raf);
    }
  },
});
</script>
