<template>
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

<script setup vapor lang="ts">
/*
 * Cinematic winner announcement shown the moment a game ends (and once on
 * re-entering an ended game). Premium sci-fi, NOT a party screen: the board
 * sinks behind a deep vignette tinted with the winner's colour, two scan
 * sweeps cross the screen, a slow halo ring breathes behind the winner's
 * name, the score counts up, then a hero CTA materializes after a beat.
 * Choreography is pure CSS delays + one rAF count-up — transform/opacity
 * only, so the sequence never stutters. Skippable (button / Esc).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {openEndgameResults, skipEndgameReveal} from '@/client/components/endgame/endgameState';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

// When the score count-up starts / how long it runs — tuned to land right
// after the score block's CSS entrance (see endgame.less choreography).
const COUNT_DELAY_MS = 850;
const COUNT_DURATION_MS = 950;

defineOptions({name: 'EndgameWinnerReveal'});
const props = defineProps({
  model: {type: Object as () => EndgameModel, required: true},
});

const flow = useFlowScope('endgame-winner-reveal');
const shownScore = ref(0);
const winner = computed((): EndgamePlayerScore | undefined => {
  return props.model.winner;
});
const winnerCorp = computed((): string => {
  if (winner.value === undefined) {
    return '';
  }
  // The MarsBot seat keeps `corporations` empty — its corp identity rides
  // `botCorporation` (absent on legacy corpless saves).
  return winner.value.corporations.length > 0 ? winner.value.corporations[0] : (winner.value.botCorporation?.name ?? '');
});
const glowVars = computed((): Record<string, string> => {
  const hex = winner.value !== undefined ? endgamePlayerHex(winner.value.color) : '#6ab0e6';
  return {'--eg-glow': hex};
});
const titleText = computed((): string => {
  if (props.model.mode === 'solo') {
    return props.model.soloWin ? $t('Victory') : $t('Defeat');
  }
  return $t('Winner');
});
const titleClass = computed((): string => {
  if (props.model.mode === 'solo' && !props.model.soloWin) {
    return 'eg-reveal__title--defeat';
  }
  return '';
});
// 2nd (and 3rd) place lines under the winner — duel shows the single
// opponent, standings shows up to the next two.
const runners = computed((): Array<EndgamePlayerScore> => {
  if (props.model.mode === 'solo') {
    return [];
  }
  return props.model.players.filter((p) => !p.isWinner).slice(0, props.model.mode === 'duel' ? 1 : 2);
});
function open(): void {
  openEndgameResults();
}
function skip(): void {
  skipEndgameReveal();
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    skip();
  }
}
// rAF count-up 0 → total with an ease-out so the last points land slowly.
function startCountUp(): void {
  const total = winner.value?.total ?? 0;
  const t0 = performance.now();
  // An owned frame loop of the reveal (flow kernel — PLAN §10 · C1): it ends at the total, or with the component.
  flow.everyFrame('the winner\'s score counts up', () => {
    const k = Math.min(1, (performance.now() - t0) / COUNT_DURATION_MS);
    const eased = 1 - Math.pow(1 - k, 3);
    shownScore.value = Math.round(total * eased);
    return k < 1;
  });
}

onMounted((): void => {
  window.addEventListener('keydown', onKeydown);
  const total = winner.value?.total ?? 0;
  if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
    shownScore.value = total;
  } else {
    flow.after(COUNT_DELAY_MS, 'the score block\'s entrance ends', () => startCountUp());
  }
});
onBeforeUnmount((): void => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
