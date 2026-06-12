<template>
  <!--
    Cinematic winner announcement shown the moment a game ends (and once on
    re-entering an ended game). Premium sci-fi, NOT a party screen: the board
    dims behind a soft vignette tinted with the winner's colour, a single scan
    sweep, the winner / corporation / score reveal in a short stagger, then the
    "View results" CTA. Skippable (button / Esc) and the CTA opens immediately.
  -->
  <div class="eg-reveal" :style="glowVars" @keydown.esc="skip">
    <div class="eg-reveal__backdrop" aria-hidden="true"></div>
    <div class="eg-reveal__glow" aria-hidden="true"></div>
    <div class="eg-reveal__scan" aria-hidden="true"></div>

    <button type="button" class="eg-reveal__skip" @click="skip">
      <span v-i18n>Skip</span> ✕
    </button>

    <div class="eg-reveal__stage" :class="'eg-reveal__stage--' + model.mode">
      <div class="eg-reveal__eyebrow">
        <span v-i18n>Game over</span>
        <span class="eg-reveal__eyebrow-sep">·</span>
        <span>{{ model.generation }} <span v-i18n>generations</span></span>
      </div>

      <div class="eg-reveal__title" :class="titleClass">{{ titleText }}</div>

      <template v-if="winner !== undefined">
        <div class="eg-reveal__winner">
          <span class="eg-reveal__winner-dot" :class="'player_bg_color_' + winner.color" aria-hidden="true"></span>
          <span class="eg-reveal__winner-name">{{ winner.name }}</span>
        </div>
        <div v-if="winnerCorp !== ''" class="eg-reveal__corp" v-i18n>{{ winnerCorp }}</div>

        <div class="eg-reveal__score">
          <span class="eg-reveal__score-value">{{ winner.total }}</span>
          <span class="eg-reveal__score-unit" v-i18n>VP</span>
        </div>

        <div v-if="model.mode !== 'solo'" class="eg-reveal__delta">
          <span v-if="model.margin > 0" class="eg-reveal__delta-chip">
            <span v-i18n>Lead</span> +{{ model.margin }}
          </span>
          <span v-else class="eg-reveal__delta-chip eg-reveal__delta-chip--tie" v-i18n>Decided on M€</span>
        </div>
      </template>

      <div v-if="runners.length > 0" class="eg-reveal__runners">
        <div v-for="r in runners" :key="r.color" class="eg-reveal__runner">
          <span class="eg-reveal__runner-place">{{ r.place }}</span>
          <span class="eg-reveal__runner-dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
          <span class="eg-reveal__runner-name">{{ r.name }}</span>
          <span class="eg-reveal__runner-vp">{{ r.total }} <span v-i18n>VP</span></span>
        </div>
      </div>

      <button type="button" class="eg-reveal__cta cab-base cab-palette-cta-cyan" @click="open">
        <span class="cab-base__glow" aria-hidden="true"></span>
        <span class="cab-base__label" v-i18n>View results</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {openEndgameResults, skipEndgameReveal} from '@/client/components/endgame/endgameState';

export default defineComponent({
  name: 'EndgameWinnerReveal',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
  },
  computed: {
    winner(): EndgamePlayerScore | undefined {
      return this.model.winner;
    },
    winnerCorp(): string {
      return this.winner !== undefined && this.winner.corporations.length > 0 ? this.winner.corporations[0] : '';
    },
    glowVars(): Record<string, string> {
      const hex = this.winner !== undefined ? endgamePlayerHex(this.winner.color) : '#6ab0e6';
      return {'--eg-glow': hex};
    },
    titleText(): string {
      if (this.model.mode === 'solo') {
        return this.model.soloWin ? this.$t('Victory') : this.$t('Defeat');
      }
      return this.$t('Winner');
    },
    titleClass(): string {
      if (this.model.mode === 'solo' && !this.model.soloWin) {
        return 'eg-reveal__title--defeat';
      }
      return '';
    },
    // 2nd (and 3rd) place lines under the winner — duel shows the single
    // opponent, standings shows up to the next two.
    runners(): Array<EndgamePlayerScore> {
      if (this.model.mode === 'solo') {
        return [];
      }
      return this.model.players.filter((p) => !p.isWinner).slice(0, this.model.mode === 'duel' ? 1 : 2);
    },
  },
  methods: {
    open(): void {
      openEndgameResults();
    },
    skip(): void {
      skipEndgameReveal();
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        this.skip();
      }
    },
  },
  mounted(): void {
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
