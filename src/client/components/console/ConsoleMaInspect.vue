<template>
  <!--
    CONSOLE MA INSPECT — the console-native fullscreen READER (X → «Осмотреть»).
    NOT a bigger card: it shows the STRATEGIC picture the mechanic poses, and
    only that (consoleMaInspectModel):
      • AWARD          → the endgame scoring RACE: every player ranked
                          leader→last with a bar + an engine-faithful VP
                          projection (1st = 5, 2nd = 2 in 3+ player games).
      • MILESTONE, open → the CLAIM race: players ranked by progress toward the
                          threshold, "ready" flagged (only ONE ever scores it,
                          so no per-player VP — that would be a lie).
      • MILESTONE, taken → owned: just the owner + the locked +5 VP (a ranking is
                          meaningless once the race is over).
    Read-only: A sponsors/claims when available (→ the confirm), B/X close.
  -->
  <div class="con-mainspect" role="dialog" :aria-label="$t(view.displayName)">
    <div class="con-mainspect__backdrop" aria-hidden="true"></div>
    <div class="con-mainspect__card" :class="'con-mainspect__card--' + view.kind">
      <!-- Top bar: category identity + the taken / funded status. -->
      <div class="con-mainspect__topbar">
        <div class="con-mainspect__kicker">
          <span class="con-mainspect__kicker-mark" aria-hidden="true">{{ view.kind === 'milestone' ? '✦' : '❖' }}</span>
          <span>{{ $t(view.kind === 'milestone' ? 'Achievement' : 'Award') }}</span>
        </div>
        <div class="con-mainspect__statuschip" :class="statusChipClass">
          <span v-if="statusOwner !== undefined" class="con-mainspect__statuschip-dot" :class="'player_bg_color_' + statusOwner.color" aria-hidden="true"></span>
          <span>{{ $t(statusChipKey) }}</span>
        </div>
      </div>

      <!-- Hero: the 512×512 premium icon + name + the viewer's headline. -->
      <div class="con-mainspect__hero">
        <div class="con-mainspect__stage" aria-hidden="true">
          <MaHeroArt :name="view.name" :kind="view.kind" class="con-mainspect__art" />
        </div>
        <div class="con-mainspect__head">
          <div class="con-mainspect__name" v-i18n>{{ view.displayName }}</div>
          <div class="con-mainspect__headline" :class="'con-mainspect__headline--' + headlineTone">{{ headlineText }}</div>
        </div>
      </div>

      <!-- The whole rule — NEVER clamped (the reason the reader exists). -->
      <div class="con-mainspect__desc con-info__scroll" v-i18n>{{ view.description }}</div>

      <!-- ═══ AWARD: the endgame scoring leaderboard ═══ -->
      <div v-if="view.mode === 'award-standings'" class="con-mainspect__panel">
        <div class="con-mainspect__panel-head">
          <span class="con-mainspect__panel-title">{{ $t('Standings') }}</span>
          <div class="con-mainspect__legend">
            <span class="con-mainspect__vpchip con-mainspect__vpchip--first">{{ $t('First place') }} · +{{ view.vpFirst }} {{ $t('VP') }}</span>
            <span v-if="view.vpSecond > 0" class="con-mainspect__vpchip con-mainspect__vpchip--second">{{ $t('Second place') }} · +{{ view.vpSecond }} {{ $t('VP') }}</span>
          </div>
        </div>
        <div class="con-mainspect__rows">
          <div v-for="r in view.rows" :key="r.color"
               class="con-mainspect__row"
               :class="{'con-mainspect__row--viewer': r.viewer, 'con-mainspect__row--leader': r.isLeader}">
            <span class="con-mainspect__rank"
                  :class="{'con-mainspect__rank--gold': r.rank === 1 && r.score > 0, 'con-mainspect__rank--silver': r.rank === 2 && r.score > 0 && view.vpSecond > 0}">{{ r.rank }}</span>
            <span class="con-mainspect__row-dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
            <span class="con-mainspect__row-name">{{ r.viewer ? $t('You') : r.name }}</span>
            <span class="con-mainspect__bar" :class="{'con-mainspect__bar--leader': r.isLeader}">
              <i class="con-mainspect__bar-fill" :class="'player_bg_color_' + r.color" :style="{width: r.barPct + '%'}"></i>
            </span>
            <span class="con-mainspect__row-score">{{ r.score }}</span>
            <span class="con-mainspect__row-vp" :class="{'con-mainspect__row-vp--muted': r.projectedVp === undefined}">
              <template v-if="r.projectedVp !== undefined">+{{ r.projectedVp }}</template>
              <template v-else>—</template>
            </span>
          </div>
        </div>
        <div v-if="!view.taken" class="con-mainspect__note">{{ $t('Projection if funded — points are scored at game end.') }}</div>
      </div>

      <!-- ═══ MILESTONE, unclaimed: the race to claim ═══ -->
      <div v-else-if="view.mode === 'milestone-race'" class="con-mainspect__panel">
        <div class="con-mainspect__panel-head">
          <span class="con-mainspect__panel-title">{{ $t('Race to claim') }}</span>
          <div class="con-mainspect__legend">
            <span class="con-mainspect__vpchip con-mainspect__vpchip--first">{{ $t('Threshold') }} · {{ view.threshold }}</span>
            <span class="con-mainspect__vpchip con-mainspect__vpchip--claim">+5 {{ $t('VP') }} · {{ $t('First to claim wins') }}</span>
          </div>
        </div>
        <div class="con-mainspect__rows">
          <div v-for="r in view.rows" :key="r.color"
               class="con-mainspect__row"
               :class="{'con-mainspect__row--viewer': r.viewer, 'con-mainspect__row--ready': r.canClaim}">
            <span class="con-mainspect__rank">{{ r.rank }}</span>
            <span class="con-mainspect__row-dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
            <span class="con-mainspect__row-name">{{ r.viewer ? $t('You') : r.name }}</span>
            <span class="con-mainspect__bar" :class="{'con-mainspect__bar--ready': r.canClaim}">
              <i class="con-mainspect__bar-fill" :class="r.canClaim ? 'con-mainspect__bar-fill--ready' : ('player_bg_color_' + r.color)" :style="{width: r.barPct + '%'}"></i>
            </span>
            <span class="con-mainspect__row-score">{{ r.score }}<span class="con-mainspect__row-req">/{{ view.threshold }}</span></span>
            <span class="con-mainspect__row-vp" :class="r.canClaim ? 'con-mainspect__row-vp--ready' : 'con-mainspect__row-vp--muted'">
              <template v-if="r.canClaim">{{ $t('Ready') }}</template>
              <template v-else>—</template>
            </span>
          </div>
        </div>
      </div>

      <!-- ═══ MILESTONE, condition (2-of-each / ≤2 cards / pay-extra):
           a met / not-met list — NO threshold bar (there is no target). ═══ -->
      <div v-else-if="view.mode === 'milestone-condition'" class="con-mainspect__panel">
        <div class="con-mainspect__panel-head">
          <span class="con-mainspect__panel-title">{{ $t('Race to claim') }}</span>
          <div class="con-mainspect__legend">
            <span class="con-mainspect__vpchip con-mainspect__vpchip--claim">+5 {{ $t('VP') }} · {{ $t('First to claim wins') }}</span>
          </div>
        </div>
        <div class="con-mainspect__rows">
          <div v-for="r in view.rows" :key="r.color"
               class="con-mainspect__row con-mainspect__row--condition"
               :class="{'con-mainspect__row--viewer': r.viewer, 'con-mainspect__row--ready': r.canClaim}">
            <span class="con-mainspect__cond-mark" :class="{'con-mainspect__cond-mark--met': r.canClaim}" aria-hidden="true">{{ r.canClaim ? '✓' : '○' }}</span>
            <span class="con-mainspect__row-dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
            <span class="con-mainspect__row-name">{{ r.viewer ? $t('You') : r.name }}</span>
            <span class="con-mainspect__cond-status" :class="r.canClaim ? 'con-mainspect__cond-status--met' : 'con-mainspect__cond-status--unmet'">
              {{ $t(r.canClaim ? 'Ready' : 'Not met') }}
            </span>
          </div>
        </div>
      </div>

      <!-- ═══ MILESTONE, claimed: owned — the race is over ═══ -->
      <div v-else class="con-mainspect__claimed">
        <div class="con-mainspect__claimed-owner">
          <span class="con-mainspect__claimed-dot" :class="view.owner !== undefined ? 'player_bg_color_' + view.owner.color : ''" aria-hidden="true"></span>
          <div class="con-mainspect__claimed-text">
            <span class="con-mainspect__claimed-label">{{ $t('claimed by') }}</span>
            <span class="con-mainspect__claimed-name">{{ view.owner ? view.owner.name : '' }}</span>
          </div>
        </div>
        <div class="con-mainspect__claimed-badges">
          <span class="con-mainspect__claimed-vp">+5 {{ $t('VP') }}</span>
          <span class="con-mainspect__claimed-lock">{{ $t('Closed') }}</span>
        </div>
      </div>

      <footer class="con-mainspect__foot" aria-hidden="true">
        <span v-if="item.available" class="con-mainspect__foot-item con-mainspect__foot-item--go">
          <GamepadGlyph control="confirm" /><span>{{ $t(view.kind === 'milestone' ? 'Claim' : 'Fund') }}</span>
        </span>
        <span class="con-mainspect__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {ConsoleMaItem} from '@/client/components/console/consoleMaModel';
import {buildMaInspect, MaInspectView, MaInspectPlayer} from '@/client/components/console/consoleMaInspectModel';

export default defineComponent({
  name: 'ConsoleMaInspect',
  components: {GamepadGlyph, MaHeroArt},
  props: {
    item: {type: Object as PropType<ConsoleMaItem>, required: true},
    players: {type: Array as PropType<ReadonlyArray<MaInspectPlayer>>, required: true},
  },
  computed: {
    view(): MaInspectView {
      return buildMaInspect(this.item, this.players);
    },
    headlineTone(): string {
      return this.view.summary.tone;
    },
    headlineText(): string {
      const s = this.view.summary;
      switch (s.tone) {
      case 'lead': return $t('You lead');
      case 'tie-lead': return $t('Tied for the lead');
      case 'behind': return `${$t('To the leader')}: +${s.gap}`;
      case 'no-race': return $t('No one has scored in this race yet');
      case 'can-claim': return $t('Threshold reached — claim now');
      case 'progress': return `${$t('To the threshold')}: +${s.gap}`;
      case 'condition-met': return $t('Requirement met — claim now');
      case 'condition-unmet': return $t('Requirement not met yet');
      case 'claimed-you': return $t('You claimed it');
      case 'claimed-other': return `${$t('claimed by')} ${s.name}`;
      default: return '';
      }
    },
    /** The owner shown beside the status chip (funder / claimer). */
    statusOwner(): {color: Color, name: string} | undefined {
      return this.view.mode === 'milestone-race' ? undefined : this.view.owner;
    },
    statusChipKey(): string {
      switch (this.view.mode) {
      case 'award-standings': return this.view.taken ? 'Funded' : 'Not yet funded';
      case 'milestone-race': return 'Unclaimed';
      default: return 'Closed';
      }
    },
    statusChipClass(): string {
      switch (this.view.mode) {
      case 'award-standings': return this.view.taken ? 'con-mainspect__statuschip--live' : 'con-mainspect__statuschip--open';
      case 'milestone-race': return 'con-mainspect__statuschip--open';
      default: return 'con-mainspect__statuschip--closed';
      }
    },
  },
  methods: {$t},
});
</script>
