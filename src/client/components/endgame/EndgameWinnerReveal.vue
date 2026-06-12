<template>
  <!--
    Cinematic winner announcement shown the moment a game ends (and once on
    re-entering an ended game). Premium sci-fi, NOT a party screen: the board
    sinks behind a deep vignette tinted with the winner's colour, two scan
    sweeps cross the screen, a slow halo ring breathes behind the winner's
    name, the score counts up, then a hero CTA materializes after a beat.
    Choreography is pure CSS delays + one rAF count-up — transform/opacity
    only, so the sequence never stutters. Skippable (button / Esc).
  -->
  <div class="eg-reveal" :style="glowVars" @keydown.esc="skip">
    <div class="eg-reveal__backdrop" aria-hidden="true"></div>
    <div class="eg-reveal__aurora" aria-hidden="true"></div>
    <div class="eg-reveal__glow" aria-hidden="true"></div>
    <div class="eg-reveal__scan" aria-hidden="true"></div>
    <div class="eg-reveal__scan eg-reveal__scan--late" aria-hidden="true"></div>

    <button type="button" class="eg-reveal__skip" @click="skip">
      <span v-i18n>Skip</span> ✕
    </button>

    <div class="eg-reveal__stage" :class="'eg-reveal__stage--' + model.mode">
      <div class="eg-reveal__eyebrow">
        <span class="eg-reveal__eyebrow-tick" aria-hidden="true"></span>
        <span v-i18n>Game over</span>
        <span class="eg-reveal__eyebrow-sep">·</span>
        <span>{{ model.generation }} <span v-i18n>generations</span></span>
        <span class="eg-reveal__eyebrow-tick" aria-hidden="true"></span>
      </div>

      <div class="eg-reveal__title" :class="titleClass">{{ titleText }}</div>

      <template v-if="winner !== undefined">
        <div class="eg-reveal__winner">
          <span class="eg-reveal__halo" aria-hidden="true"></span>
          <span class="eg-reveal__winner-dot" :class="'player_bg_color_' + winner.color" aria-hidden="true"></span>
          <span class="eg-reveal__winner-name">{{ winner.name }}</span>
        </div>
        <div v-if="winnerCorp !== ''" class="eg-reveal__corp">
          <span class="eg-reveal__corp-line" aria-hidden="true"></span>
          <span v-i18n>{{ winnerCorp }}</span>
          <span class="eg-reveal__corp-line" aria-hidden="true"></span>
        </div>

        <div class="eg-reveal__score">
          <span class="eg-reveal__score-value">{{ shownScore }}</span>
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

      <button type="button" class="eg-reveal__cta" @click="open">
        <span class="eg-reveal__cta-sheen" aria-hidden="true"></span>
        <span class="eg-reveal__cta-label" v-i18n>View results</span>
        <span class="eg-reveal__cta-arrow" aria-hidden="true">→</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {openEndgameResults, skipEndgameReveal} from '@/client/components/endgame/endgameState';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';

// When the score count-up starts / how long it runs — tuned to land right
// after the score block's CSS entrance (see endgame.less choreography).
const COUNT_DELAY_MS = 850;
const COUNT_DURATION_MS = 950;

export default defineComponent({
  name: 'EndgameWinnerReveal',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
  },
  data() {
    return {
      shownScore: 0,
      countTimer: undefined as number | undefined,
      raf: undefined as number | undefined,
    };
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
    // rAF count-up 0 → total with an ease-out so the last points land slowly.
    startCountUp(): void {
      const total = this.winner?.total ?? 0;
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / COUNT_DURATION_MS);
        const eased = 1 - Math.pow(1 - k, 3);
        this.shownScore = Math.round(total * eased);
        if (k < 1) {
          this.raf = requestAnimationFrame(tick);
        }
      };
      this.raf = requestAnimationFrame(tick);
    },
  },
  mounted(): void {
    window.addEventListener('keydown', this.onKeydown);
    const total = this.winner?.total ?? 0;
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      this.shownScore = total;
    } else {
      this.countTimer = window.setTimeout(() => this.startCountUp(), COUNT_DELAY_MS);
    }
  },
  beforeUnmount(): void {
    window.removeEventListener('keydown', this.onKeydown);
    if (this.countTimer !== undefined) {
      window.clearTimeout(this.countTimer);
    }
    if (this.raf !== undefined) {
      cancelAnimationFrame(this.raf);
    }
  },
});
</script>
