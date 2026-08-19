<template>
  <!--
    ИГРОКИ — how the strategies differed. A player ring on ←/→ (the bot is
    an ordinary participant), grouped metric blocks on ↑/↓ — each block shows
    the selected player's values WITH a quiet table-max comparison bar, so
    «много или мало» reads without a second screen. A opens the full
    cross-player comparison of the focused group at one shared scale.
  -->
  <div class="con-ovpl">
    <!-- The player ring. -->
    <div class="con-ovpl__ring">
      <span v-for="(p, i) in vm.players.players" :key="p.color"
            class="con-ovpl__chip"
            :class="{'con-ovpl__chip--on': i === playerIdx, 'con-ovpl__chip--winner': p.isWinner}">
        <span class="con-egov-legend__dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
        <span class="con-ovpl__chip-name">{{ p.name }}</span>
        <b class="con-ovpl__chip-vp">{{ p.total }}</b>
      </span>
    </div>

    <div v-if="player !== undefined" class="con-ovpl__sheet" :style="{'--ov-pc': hex(player.color)}">
      <!-- Identity line. -->
      <div class="con-ovpl__id">
        <span class="con-ovpl__place">{{ player.place }}</span>
        <span class="con-ovpl__name">{{ player.name }}</span>
        <span v-if="player.corporation !== ''" class="con-ovpl__corp">{{ $t(player.corporation) }}</span>
        <span v-if="player.isWinner" class="con-ovpl__crown">{{ $t('Winner') }}</span>
      </div>

      <!-- The metric groups — ↑/↓ walks them. -->
      <div class="con-ovpl__groups">
        <section v-for="(g, gi) in groups" :key="g.key"
                 class="con-ovpl__group" :class="{'con-ovpl__group--focused': gi === groupIdx}">
          <header class="con-ovpl__ghead">{{ $t(g.label) }}</header>

          <div v-if="g.key === 'tags'" class="con-ovpl__tags">
            <span v-for="t in player.tags" :key="t.tag" class="con-ovpl__tag">
              <span class="tag-count con-ovpl__tag-icon" :class="'tag-' + t.tag" aria-hidden="true"></span>
              <b>{{ t.count }}</b>
            </span>
            <span v-if="player.tags.length === 0" class="con-ovpl__quiet">{{ $t('No tags played') }}</span>
          </div>

          <div v-else-if="g.key === 'ma'" class="con-ovpl__ma">
            <span v-for="(d, di) in player.milestones" :key="'m' + di" class="con-ovpl__ma-chip con-ovpl__ma-chip--milestone">{{ maText(d) }}</span>
            <span v-for="(d, di) in player.awards" :key="'a' + di" class="con-ovpl__ma-chip con-ovpl__ma-chip--award">{{ maText(d) }}</span>
            <span v-if="player.milestones.length === 0 && player.awards.length === 0" class="con-ovpl__quiet">{{ $t('No milestones or awards') }}</span>
          </div>

          <div v-else-if="g.key === 'categories'" class="con-ovpl__cats">
            <span v-for="c in player.categories" :key="c.key" class="con-ovpl__cat" :class="'con-eg-cat--' + c.accent">
              <span class="con-ovpl__cat-dot" aria-hidden="true"></span>
              <span class="con-ovpl__cat-name">{{ $t(c.label) }}</span>
              <b class="con-ovpl__cat-val">{{ c.value < 0 ? '−' + Math.abs(c.value) : c.value }}</b>
            </span>
          </div>

          <div v-else class="con-ovpl__metrics">
            <div v-for="m in metricsOf(g.key)" :key="m.key"
                 class="con-ovpl__metric" :class="{'con-ovpl__metric--labeled': resIcon(m.key) === undefined}">
              <i v-if="resIcon(m.key) !== undefined" class="resource_icon con-ovpl__micon" :class="resIcon(m.key)" aria-hidden="true"></i>
              <span v-else class="con-ovpl__mlabel-only">{{ $t(m.label) }}</span>
              <span class="con-ovpl__mtrack"><span class="con-ovpl__mfill" :style="{width: metricPct(m) + '%'}"></span></span>
              <b class="con-ovpl__mval">{{ m.value }}</b>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- NESTED DETAIL — the focused group across EVERY player, one scale. -->
    <div v-if="detailGroup !== undefined" class="con-egov-detail">
      <div class="con-egov-detail__head">
        <span class="con-egov-detail__title">{{ $t(detailGroup.label) }}</span>
        <span class="con-egov-detail__sub">{{ $t('All players') }}</span>
      </div>
      <div class="con-egov-detail__body con-ovpl__cmp" :style="{'--ov-cols': vm.players.players.length}">
        <div class="con-ovpl__cmp-cell con-ovpl__cmp-cell--head"></div>
        <div v-for="p in vm.players.players" :key="'h' + p.color" class="con-ovpl__cmp-cell con-ovpl__cmp-cell--head">
          <span class="con-egov-legend__dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
          <span class="con-ovpl__cmp-name">{{ p.name }}</span>
        </div>
        <template v-for="mkey in detailMetricKeys" :key="mkey">
          <div class="con-ovpl__cmp-cell con-ovpl__cmp-cell--label">
            <i v-if="resIcon(mkey) !== undefined" class="resource_icon con-ovpl__micon" :class="resIcon(mkey)" aria-hidden="true"></i>
            <template v-else>{{ $t(labelOfMetric(mkey)) }}</template>
          </div>
          <div v-for="p in vm.players.players" :key="mkey + p.color" class="con-ovpl__cmp-cell">
            <span class="con-ovpl__mtrack con-ovpl__mtrack--cmp">
              <span class="con-ovpl__mfill" :style="{width: cmpPct(p, mkey) + '%', background: hex(p.color)}"></span>
            </span>
            <b class="con-ovpl__mval">{{ cmpValue(p, mkey) }}</b>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {MADetail} from '@/common/game/VictoryPointsBreakdown';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {AwardName} from '@/common/ma/AwardName';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {$t, translateTextWithParams, translateMessage} from '@/client/directives/i18n';
import {
  ConsoleOverviewVm, OvMetric, OvPlayerCard, PlayerMetricGroup, PLAYER_METRIC_GROUPS,
} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';

const GROUPS = PLAYER_METRIC_GROUPS;

const RES_ICON: Record<string, string> = {
  'megacredits': 'resource_icon--megacredits',
  'steel': 'resource_icon--steel',
  'titanium': 'resource_icon--titanium',
  'plants': 'resource_icon--plants',
  'energy': 'resource_icon--energy',
  'heat': 'resource_icon--heat',
};

export default defineComponent({
  name: 'ConsoleOvTabPlayers',
  props: {
    vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    groups(): ReadonlyArray<PlayerMetricGroup> {
      return GROUPS;
    },
    playerIdx(): number {
      return Math.min(Math.max(this.ui.playerIdx, 0), Math.max(0, this.vm.players.players.length - 1));
    },
    groupIdx(): number {
      return Math.min(Math.max(this.ui.playerGroup, 0), GROUPS.length - 1);
    },
    player(): OvPlayerCard | undefined {
      return this.vm.players.players[this.playerIdx];
    },
    detailGroup(): PlayerMetricGroup | undefined {
      const d = this.ui.detail;
      if (d === undefined || d.kind !== 'players-metric') {
        return undefined;
      }
      return GROUPS.find((g) => g.key === d.group);
    },
    detailMetricKeys(): Array<string> {
      const g = this.detailGroup;
      if (g === undefined || this.player === undefined) {
        return [];
      }
      return this.metricsOfPlayer(this.player, g.key).map((m) => m.key);
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    resIcon(metricKey: string): string | undefined {
      const raw = metricKey.replace(/^(prod|stock):/, '');
      return RES_ICON[raw];
    },
    metricsOfPlayer(p: OvPlayerCard, key: string): ReadonlyArray<OvMetric> {
      switch (key) {
      case 'production': return p.production;
      case 'stock': return p.stock;
      case 'stats': return p.stats;
      default: return [];
      }
    },
    metricsOf(key: string): ReadonlyArray<OvMetric> {
      return this.player !== undefined ? this.metricsOfPlayer(this.player, key) : [];
    },
    metricPct(m: OvMetric): number {
      const max = this.vm.players.maxima[m.key] ?? 1;
      return max > 0 ? Math.min(100, (Math.max(0, m.value) / max) * 100) : 0;
    },
    labelOfMetric(mkey: string): string {
      for (const p of this.vm.players.players) {
        for (const list of [p.production, p.stock, p.stats]) {
          const m = list.find((x) => x.key === mkey);
          if (m !== undefined) {
            return m.label;
          }
        }
      }
      return mkey;
    },
    cmpValue(p: OvPlayerCard, mkey: string): number {
      for (const list of [p.production, p.stock, p.stats]) {
        const m = list.find((x) => x.key === mkey);
        if (m !== undefined) {
          return m.value;
        }
      }
      return 0;
    },
    cmpPct(p: OvPlayerCard, mkey: string): number {
      const max = this.vm.players.maxima[mkey] ?? 1;
      return max > 0 ? Math.min(100, (Math.max(0, this.cmpValue(p, mkey)) / max) * 100) : 0;
    },
    maText(d: MADetail): string {
      if (d.messageArgs !== undefined && d.messageArgs.length >= 3) {
        const message: Message = {
          message: d.message,
          data: [
            {type: LogMessageDataType.STRING, value: d.messageArgs[0]},
            {type: LogMessageDataType.AWARD, value: d.messageArgs[1] as AwardName},
            {type: LogMessageDataType.PLAYER, value: d.messageArgs[2] as Color},
          ],
        };
        return translateMessage(message);
      }
      return translateTextWithParams(d.message, (d.messageArgs ?? []).map($t));
    },
    // ── pane API ──────────────────────────────────────────────────────────
    nav(dir: NavDirection): void {
      if (this.ui.detail !== undefined) {
        return;
      }
      if (dir === 'left' || dir === 'right') {
        const n = this.vm.players.players.length;
        if (n > 0) {
          const delta = dir === 'right' ? 1 : -1;
          this.ui.playerIdx = (this.playerIdx + delta + n) % n;
        }
        return;
      }
      const delta = dir === 'down' ? 1 : -1;
      this.ui.playerGroup = (this.groupIdx + delta + GROUPS.length) % GROUPS.length;
    },
    primary(): void {
      const g = GROUPS[this.groupIdx];
      if (g.comparable && this.ui.detail === undefined) {
        this.ui.detail = {kind: 'players-metric', group: g.key};
      }
    },
  },
});
</script>
