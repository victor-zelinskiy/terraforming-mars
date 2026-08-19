<template>
  <!--
    ОБЗОР — the landing tab. Continues the ceremony's story instead of
    replaying it: a compact result strip (the scoring rows' quiet echo), the
    finish VERDICT, the composed editorial lead, then 2–4 strong deduped
    headline facts and a quiet observation rail. Everything fits one TV
    viewport — depth lives in the other tabs.
  -->
  <div class="con-ovd" :class="{'con-ovd--enter': enterFx}">
    <!-- The compact result strip — the ceremony rows fold into this echo. -->
    <div class="con-ovd__rank" :style="{'--ov-n': vm.digest.ranking.length}">
      <div v-for="(row, i) in vm.digest.ranking" :key="row.color"
           class="con-ovd__rrow" :class="{'con-ovd__rrow--winner': row.isWinner}" :style="{'--ov-i': i}">
        <span class="con-ovd__rplace">{{ row.place }}</span>
        <span class="con-ovd__rdot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
        <span class="con-ovd__rwho">
          <span class="con-ovd__rname">{{ row.name }}</span>
          <span v-if="row.corporation !== ''" class="con-ovd__rcorp">{{ $t(row.corporation) }}</span>
          <span v-else-if="row.difficulty !== undefined" class="con-ovd__rcorp con-ovd__rdiff">{{ $t(row.difficulty) }}</span>
        </span>
        <span class="con-ovd__rgap">{{ row.isWinner ? '' : '−' + row.gapToWinner }}</span>
        <span class="con-ovd__rtotal">{{ row.total }}<i class="con-ovd__runit">{{ $t('VP') }}</i></span>
      </div>
    </div>

    <!-- The finish verdict + the editorial lead — one calm statement zone. -->
    <div class="con-ovd__story">
      <div v-if="vm.digest.verdict !== undefined" class="con-ovd__verdict">
        <span class="con-ovd__verdict-glyph" aria-hidden="true">{{ vm.digest.verdict.glyph }}</span>
        <div class="con-ovd__verdict-body">
          <div class="con-ovd__verdict-title">{{ $t(vm.digest.verdict.titleKey) }}</div>
          <div v-if="vm.digest.verdict.line !== undefined" class="con-ovd__verdict-line">
            <ConsoleOvRich :sentence="vm.digest.verdict.line" />
          </div>
        </div>
        <div v-if="vm.digest.verdict.chips.length > 0" class="con-ovd__chips">
          <span v-for="(ch, ci) in vm.digest.verdict.chips" :key="ci"
                class="con-ovd__chip" :class="'con-ovd__chip--' + (ch.tone ?? 'neutral')">
            {{ chipText(ch) }}
          </span>
        </div>
      </div>
      <p v-if="vm.digest.lead.length > 0" class="con-ovd__lead">
        <template v-for="(s, si) in vm.digest.lead" :key="si"><ConsoleOvRich :sentence="s" />{{ si < vm.digest.lead.length - 1 ? ' ' : '' }}</template>
      </p>
    </div>

    <!-- Headline facts (left) + the quiet observation rail (right): depth by
         WIDTH, so a full digest still fits one TV viewport with no scroll. -->
    <div v-if="vm.digest.headline.length > 0 || vm.digest.observations.length > 0" class="con-ovd__facts-obs">
      <div v-if="vm.digest.headline.length > 0" class="con-ovd__facts">
        <article v-for="(fact, i) in vm.digest.headline" :key="fact.id"
                 class="con-ovd__fact" :class="{'con-ovd__fact--focused': isFocused(i)}"
                 :style="factStyle(fact, i)">
          <header class="con-ovd__fact-head">
            <span class="con-ovd__fact-badge">{{ $t(fact.badge) }}</span>
            <span v-if="fact.generation !== undefined" class="con-ovd__fact-gen">{{ $t('Generation') }} {{ fact.generation }}</span>
          </header>
          <p class="con-ovd__fact-text"><ConsoleOvRich :sentence="fact.sentence" /></p>
          <div v-if="fact.chips.length > 0" class="con-ovd__chips">
            <span v-for="(ch, ci) in fact.chips" :key="ci"
                  class="con-ovd__chip" :class="'con-ovd__chip--' + (ch.tone ?? 'neutral')">{{ chipText(ch) }}</span>
          </div>
        </article>
      </div>

      <div v-if="vm.digest.observations.length > 0" class="con-ovd__obs">
        <div v-for="(o, i) in vm.digest.observations" :key="o.id"
             class="con-ovd__obs-row" :class="{'con-ovd__obs-row--focused': isFocused(vm.digest.headline.length + i)}"
             :style="o.color !== undefined ? {'--ov-pc': hex(o.color)} : {}">
          <span class="con-ovd__obs-badge">{{ $t(o.badge) }}</span>
          <span class="con-ovd__obs-text"><ConsoleOvRich :sentence="o.sentence" /></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {$t} from '@/client/directives/i18n';
import type {EvidenceChip} from '@/client/components/endgame/insightEngine';
import type {ConsoleOverviewVm, OvFactCard} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';
import ConsoleOvRich from '@/client/components/console/ConsoleOvRich.vue';

export default defineComponent({
  name: 'ConsoleOvTabDigest',
  components: {ConsoleOvRich},
  props: {
    vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
  },
  data() {
    return {
      /** LATCHED at mount: the staggered entrance belongs to the SCENE's own
       *  arrival. A later tab-swap remount lands settled instantly (the pane
       *  slide is the only motion) — and a latch never CANCELS a running
       *  animation the way removing a phase class would. */
      enterFx: consoleOverviewUi.phase === 'entering',
    };
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    focusCount(): number {
      return this.vm.digest.headline.length + this.vm.digest.observations.length;
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    isFocused(i: number): boolean {
      return this.focusCount > 0 && this.ui.digestFocus === i;
    },
    factStyle(fact: OvFactCard, i: number): Record<string, string> {
      const style: Record<string, string> = {'--ov-i': String(i)};
      if (fact.color !== undefined) {
        style['--ov-pc'] = endgamePlayerHex(fact.color);
      }
      return style;
    },
    chipText(ch: EvidenceChip): string {
      const value = ch.t === 'raw' ? ch.v : $t(ch.v);
      return ch.label !== undefined ? `${value} ${$t(ch.label)}` : value;
    },
    // ── pane API (driven by the overview root) ────────────────────────────
    nav(dir: NavDirection): void {
      if (this.focusCount === 0) {
        return;
      }
      const delta = dir === 'down' || dir === 'right' ? 1 : -1;
      this.ui.digestFocus = Math.min(Math.max(this.ui.digestFocus + delta, 0), this.focusCount - 1);
    },
    primary(): void {
      // The digest is a reading surface — depth lives in the other tabs.
    },
  },
});
</script>
