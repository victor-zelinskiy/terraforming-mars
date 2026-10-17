<template>
  <!--
    ИГРОКИ — how the strategies differed. A player ring on ←/→ (the bot is an
    ordinary participant with its OWN honest groups), the participant's metric
    groups on ↑/↓. A bar encodes a real comparison: it renders only when ≥2
    participants carry the metric; a lone value shows as a plain cell (a
    full-width bar against nobody was the tab's shipped lie). A opens the
    cross-player grid for comparable groups.
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
      <!-- THE PARTICIPANT (TR69 «ОБЗОР В МАСШТАБЕ») — the corporation's FACE as the sheet's hero, the identity (every
           participant wears its corporation; the bot adds its difficulty — alone on legacy corpless saves) and the
           total in the score cell's language. -->
      <aside class="con-ovpl__hero" :class="{'con-ovpl__hero--winner': player.isWinner}" :data-ovpl-hero="player.color">
        <span v-if="player.isWinner" class="con-ovpl__crown">{{ $t('Winner') }}</span>
        <div class="con-ovpl__face">
          <div v-if="player.face !== undefined" class="con-ovpl__face-zoom">
            <ConsoleCardFaceLite v-if="player.face.kind === 'card'" :name="player.face.name" />
            <MarsBotCorpFace v-else :id="player.face.id" :resources="0" />
          </div>
          <div v-else class="con-ovpl__face-empty" :class="'player_bg_color_' + player.color" aria-hidden="true"></div>
        </div>
        <div class="con-ovpl__id">
          <span class="con-ovpl__place">{{ player.place }}</span>
          <span class="con-egov-legend__dot" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
          <span class="con-ovpl__name">{{ player.name }}</span>
        </div>
        <span v-if="player.corporation !== ''" class="con-ovpl__corp">{{ $t(player.corporation) }}<template v-if="player.difficulty !== undefined"> · <span class="con-ovpl__diff">{{ $t(player.difficulty) }}</span></template></span>
        <span v-else-if="player.difficulty !== undefined" class="con-ovpl__corp con-ovpl__diff">{{ $t(player.difficulty) }}</span>
        <div class="con-ovpl__total">
          <ConsoleVpBadge class="con-ovpl__shield" :label="$t('VP')" />
          <b class="con-ovpl__total-vp">{{ player.total }}</b>
        </div>
      </aside>

      <!-- The metric groups — ↑/↓ walks THIS participant's own list. -->
      <div class="con-ovpl__groups">
        <section v-for="(g, gi) in player.groups" :key="g.key"
                 class="con-ovpl__group" :class="{'con-ovpl__group--focused': gi === groupIdx}">
          <header class="con-ovpl__ghead">{{ $t(g.label) }}</header>

          <div v-if="g.key === 'tags'" class="con-ovpl__tags">
            <span v-for="t in player.tags" :key="t.tag" class="con-ovpl__tag">
              <span class="tag-count con-ovpl__tag-icon" :class="'tag-' + t.tag" aria-hidden="true"></span>
              <b>{{ t.count }}</b>
            </span>
            <span v-if="player.tags.length === 0" class="con-ovpl__quiet">{{ $t('No tags played') }}</span>
          </div>

          <div v-else-if="g.key === 'bottracks'" class="con-ovpl__tags">
            <span v-for="t in (player.botTracks ?? [])" :key="t.tag" class="con-ovpl__tag">
              <span class="tag-count con-ovpl__tag-icon" :class="'tag-' + t.tag" aria-hidden="true"></span>
              <b class="con-ovpl__track-pos">{{ t.position }}/{{ t.max }}</b>
            </span>
          </div>

          <div v-else-if="g.key === 'boteco'" class="con-ovpl__metrics">
            <div v-for="line in botEconomyLines" :key="line.label" class="con-ovpl__metric con-ovpl__metric--labeled con-ovpl__metric--solo">
              <span class="con-ovpl__mlabel-only">{{ $t(line.label) }}</span>
              <b class="con-ovpl__mval con-ovpl__mval--wide">{{ line.value }}</b>
            </div>
          </div>

          <!-- Milestones & awards as MEDALLIONS (TR69): the emblem's own art, the name, the VP it brought — the
               server's breakdown rows, never a re-told sentence. -->
          <div v-else-if="g.key === 'ma'" class="con-ovpl__ma">
            <span v-for="(m, mi) in player.maMedals" :key="m.kind + mi" class="con-ovpl__medal" :class="'con-ovpl__medal--' + m.kind"
                  :data-ovpl-ma="m.kind">
              <img class="con-ovpl__medal-art" :src="'assets/ma/' + m.slug + '.png'" alt="" draggable="false" />
              <span class="con-ovpl__medal-name">{{ $t(m.name) }}</span>
              <b class="con-ovpl__medal-vp">+{{ m.vp }}</b>
            </span>
            <span v-if="player.maMedals.length === 0" class="con-ovpl__quiet">{{ $t('No milestones or awards') }}</span>
          </div>

          <!-- The score sources as the ceremony's own MEDALLIONS (the dossier's disc · the value · the short name). -->
          <div v-else-if="g.key === 'categories'" class="con-ovpl__cats">
            <span v-for="c in player.categories" :key="c.key" class="con-ovpl__cat" :class="'con-eg-cat--' + c.accent">
              <ConsoleScoreDisc class="con-ovpl__cat-disc" :glyph="glyphOf(c.key)" />
              <b class="con-ovpl__cat-val">{{ c.value < 0 ? '−' + Math.abs(c.value) : c.value }}</b>
              <span class="con-ovpl__cat-name">{{ $t(legendOf(c.key)) }}</span>
            </span>
          </div>

          <div v-else class="con-ovpl__metrics">
            <div v-for="m in metricsOf(g.key)" :key="m.key"
                 class="con-ovpl__metric"
                 :class="{'con-ovpl__metric--labeled': resIcon(m.key) === undefined, 'con-ovpl__metric--solo': !isComparable(m.key)}">
              <i v-if="resIcon(m.key) !== undefined" class="resource_icon con-ovpl__micon" :class="resIcon(m.key)" aria-hidden="true"></i>
              <span v-else class="con-ovpl__mlabel-only">{{ $t(m.label) }}</span>
              <!-- The bar exists only when there is a real comparison behind it. -->
              <span v-if="isComparable(m.key)" class="con-ovpl__mtrack"><span class="con-ovpl__mfill" :style="{width: metricPct(m) + '%'}"></span></span>
              <b class="con-ovpl__mval">{{ m.value }}</b>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- NESTED DETAIL — the focused group across every participant that
         actually carries it, one shared scale. -->
    <div v-if="detailGroup !== undefined" class="con-egov-detail">
      <div class="con-egov-detail__head">
        <span class="con-egov-detail__title">{{ $t(detailGroup.label) }}</span>
        <span class="con-egov-detail__sub">{{ $t('All players') }}</span>
      </div>
      <div class="con-egov-detail__body con-ovpl__cmp" :style="{'--ov-cols': detailPlayers.length}">
        <div class="con-ovpl__cmp-cell con-ovpl__cmp-cell--head"></div>
        <div v-for="p in detailPlayers" :key="'h' + p.color" class="con-ovpl__cmp-cell con-ovpl__cmp-cell--head">
          <span class="con-egov-legend__dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
          <span class="con-ovpl__cmp-name">{{ p.name }}</span>
        </div>
        <template v-for="mkey in detailMetricKeys" :key="mkey">
          <div class="con-ovpl__cmp-cell con-ovpl__cmp-cell--label">
            <i v-if="resIcon(mkey) !== undefined" class="resource_icon con-ovpl__micon" :class="resIcon(mkey)" aria-hidden="true"></i>
            <template v-else>{{ $t(labelOfMetric(mkey)) }}</template>
          </div>
          <div v-for="p in detailPlayers" :key="mkey + p.color" class="con-ovpl__cmp-cell">
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
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {$t} from '@/client/directives/i18n';
import {
  ConsoleOverviewVm, OvMetric, OvPlayerCard, PlayerMetricGroup,
} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';
import {ConsoleEndgameCategoryKey, SCORE_CATEGORY_TABLE} from '@/client/console/endgame/consoleEndgameModel';
import {DossierGlyph, scoreCategoryGlyph} from '@/client/console/infoDossierModel';
import ConsoleScoreDisc from '@/client/components/console/info/ConsoleScoreDisc.vue';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';

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
  components: {ConsoleScoreDisc, ConsoleVpBadge, ConsoleCardFaceLite, MarsBotCorpFace},
  props: {
    vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    playerIdx(): number {
      return Math.min(Math.max(this.ui.playerIdx, 0), Math.max(0, this.vm.players.players.length - 1));
    },
    player(): OvPlayerCard | undefined {
      return this.vm.players.players[this.playerIdx];
    },
    groups(): ReadonlyArray<PlayerMetricGroup> {
      return this.player?.groups ?? [];
    },
    groupIdx(): number {
      return Math.min(Math.max(this.ui.playerGroup, 0), Math.max(0, this.groups.length - 1));
    },
    botEconomyLines(): Array<{label: string; value: string}> {
      const eco = this.player?.botEconomy;
      if (eco === undefined) {
        return [];
      }
      return [
        {label: 'M€ left at scoring', value: String(eco.stock)},
        {label: 'Conversion rate', value: `${eco.rate} M€ → 1 ${$t('VP')}`},
        {label: 'M€ converted to VP', value: `${eco.vp} ${$t('VP')}`},
        {label: 'Cards in the played pile', value: String(eco.playedCount)},
      ];
    },
    detailGroup(): PlayerMetricGroup | undefined {
      const d = this.ui.detail;
      if (d === undefined || d.kind !== 'players-metric') {
        return undefined;
      }
      return this.groups.find((g) => g.key === d.group);
    },
    /** Only the participants that actually CARRY the focused group's metrics. */
    detailPlayers(): Array<OvPlayerCard> {
      const g = this.detailGroup;
      if (g === undefined) {
        return [];
      }
      return this.vm.players.players.filter((p) => this.metricsOfPlayer(p, g.key).length > 0);
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
    isComparable(metricKey: string): boolean {
      return (this.vm.players.comparable[metricKey] ?? 0) >= 2;
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
    glyphOf(key: ConsoleEndgameCategoryKey): DossierGlyph {
      return scoreCategoryGlyph(key);
    },
    /** The ceremony's SHORT name of a category (its rail legend — «РТ», «Награды») — what a medallion prints. */
    legendOf(key: ConsoleEndgameCategoryKey): string {
      return SCORE_CATEGORY_TABLE.find((m) => m.key === key)?.legend ?? key;
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
          // A different participant may carry a different group list.
          this.ui.playerGroup = Math.min(this.groupIdx, Math.max(0, (this.vm.players.players[this.ui.playerIdx]?.groups.length ?? 1) - 1));
        }
        return;
      }
      const n = this.groups.length;
      if (n > 0) {
        const delta = dir === 'down' ? 1 : -1;
        this.ui.playerGroup = (this.groupIdx + delta + n) % n;
      }
    },
    primary(): void {
      const g = this.groups[this.groupIdx];
      if (g !== undefined && g.comparable && this.ui.detail === undefined) {
        this.ui.detail = {kind: 'players-metric', group: g.key};
      }
    },
  },
});
</script>
