<template>
  <div class="eg-results" role="dialog" :aria-label="$t('Game results')">
    <div class="eg-results__bg" aria-hidden="true"></div>

    <header class="eg-results__header">
      <div class="eg-results__title-block">
        <span class="eg-results__title-glyph" aria-hidden="true"></span>
        <div class="eg-results__titles">
          <h1 class="eg-results__title" v-i18n>Game results</h1>
          <div class="eg-results__subtitle">
            <span class="eg-results__game-name">{{ view.game.name }}</span>
            <span class="eg-results__sub-sep">·</span>
            <span>{{ model.generation }} <span v-i18n>generations</span></span>
          </div>
        </div>
      </div>

      <div v-if="model.winner !== undefined" class="eg-results__winner-chip" :class="'player_translucent_bg_color_' + model.winner.color">
        <span class="eg-results__winner-crown" aria-hidden="true">♛</span>
        <span class="eg-results__winner-dot" :class="'player_bg_color_' + model.winner.color" aria-hidden="true"></span>
        <span class="eg-results__winner-name">{{ model.winner.name }}</span>
        <span class="eg-results__winner-vp">{{ model.winner.total }} <span v-i18n>VP</span></span>
      </div>

      <div class="eg-results__controls">
        <button type="button" class="eg-results__ctl eg-results__ctl--min" :title="$t('Minimize')" @click="minimize">
          <span aria-hidden="true">↗</span><span class="eg-results__ctl-label" v-i18n>Minimize</span>
        </button>
        <!-- Hidden-VP games: replay the suspenseful category-by-category reveal on demand. -->
        <button v-if="hiddenVpMode" type="button" class="eg-results__ctl eg-results__ctl--replay" :title="$t('Replay scoring')" @click="replayReveal">
          <span aria-hidden="true">⟲</span><span class="eg-results__ctl-label" v-i18n>Replay scoring</span>
        </button>
        <!--
          Rematch control (replaces the legacy "New game" link). State-driven:
          Offer rematch → Waiting N/M (+ Cancel for the offerer) → Join rematch.
          A non-offering player who must vote gets Accept / Decline inline (the
          App-level RematchLayer also shows them the prompt modal). Spectators
          keep "New game", and join the created rematch as a watcher.
        -->
        <template v-if="rematch !== undefined && rematch.status === 'created'">
          <a class="eg-results__ctl eg-results__ctl--cta" :href="rematchJoin">
            <span v-if="viewerIsPlayer" class="eg-results__ctl-label" v-i18n>Join rematch</span>
            <span v-else class="eg-results__ctl-label" v-i18n>Watch rematch</span>
          </a>
        </template>
        <template v-else-if="viewerIsPlayer">
          <template v-if="rematch !== undefined && rematch.status === 'offered' && rematch.viewerMustVote">
            <button type="button" class="eg-results__ctl eg-results__ctl--cta" :disabled="rematchSubmitting" @click="acceptRematch">
              <span class="eg-results__ctl-label" v-i18n>Accept rematch</span>
            </button>
            <button type="button" class="eg-results__ctl eg-results__ctl--danger" :disabled="rematchSubmitting" @click="declineRematch">
              <span class="eg-results__ctl-label" v-i18n>Decline</span>
            </button>
          </template>
          <template v-else-if="rematch !== undefined && rematch.status === 'offered'">
            <span class="eg-results__ctl eg-results__ctl--wait">
              <span class="eg-results__wait-dot" aria-hidden="true"></span>
              <span v-i18n>Waiting for players</span>
              <span class="eg-results__wait-count">{{ acceptedCount }}/{{ totalCount }}</span>
            </span>
            <button v-if="rematch.viewerIsOfferer" type="button" class="eg-results__ctl" :disabled="rematchSubmitting" @click="cancelRematch">
              <span class="eg-results__ctl-label" v-i18n>Cancel</span>
            </button>
          </template>
          <button v-else type="button" class="eg-results__ctl eg-results__ctl--cta" :disabled="rematchSubmitting" @click="offerRematch">
            <span class="eg-results__ctl-label" v-i18n>Offer rematch</span>
          </button>
        </template>
        <a v-else class="eg-results__ctl eg-results__ctl--cta" :href="newGameHref">
          <span class="eg-results__ctl-label" v-i18n>New game</span>
        </a>
        <a class="eg-results__ctl eg-results__ctl--home" href=".">
          <span class="eg-results__ctl-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11 L12 4 L20 11 M6 9.5 V19 H18 V9.5 M10 19 V14 H14 V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="eg-results__ctl-label" v-i18n>To main menu</span>
        </a>
      </div>
    </header>

    <nav class="eg-results__tabs" role="tablist">
      <button v-for="tab in tabs" :key="tab.key" type="button"
              class="eg-results__tab" :class="{'eg-results__tab--active': activeTab === tab.key}"
              role="tab" :aria-selected="activeTab === tab.key" @click="setTab(tab.key)">
        <span class="eg-results__tab-label" v-i18n>{{ tab.label }}</span>
      </button>
    </nav>

    <div class="eg-results__body">
      <component :is="activeComponent" :model="model" :view="view" :viewer-color="viewerColor" />
    </div>

    <footer class="eg-results__footer">
      <span class="eg-results__footer-note">
        <span class="eg-results__footer-dot" aria-hidden="true"></span>
        <span v-i18n>Final report</span>
        <span class="eg-results__sub-sep">·</span>
        <span>{{ view.game.name }}</span>
      </span>
      <button type="button" class="eg-results__share" @click="copyLink">
        <span v-if="copied" v-i18n>Link copied</span>
        <span v-else v-i18n>Copy link</span>
      </button>
    </footer>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * Full-screen premium END-OF-GAME results overlay. Covers the entire viewport
 * (board + both side bars) — after the game ends this IS the main surface.
 * A dark-glass command-center: hero header + tab navigation + per-tab content.
 * "Minimize" collapses to a pill (handled by EndgameExperience) so the board
 * can still be inspected; New game / Home navigate away. No destructive close.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
// (`import type`, on purpose: the template's `<component>` tag makes the SFC compiler count a plain import named
// `Component` as a binding the template uses — a development build would return the type from setup as a value.)
import type {Component} from 'vue';
import {computed, onBeforeUnmount, onMounted} from 'vue';
import {useClipboard} from '@vueuse/core';
import {ViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {endgameState, setEndgameTab, minimizeEndgameResults, replayEndgameReveal, EndgameTab, ENDGAME_TABS} from '@/client/components/endgame/endgameState';
import {rematchState, submitRematch, rematchJoinHref} from '@/client/components/rematch/rematchState';
import {RematchModel} from '@/common/models/RematchModel';
import {paths} from '@/common/app/paths';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import EndgameOverviewTab from '@/client/components/endgame/tabs/EndgameOverviewTab.vue';
import EndgameScoreTab from '@/client/components/endgame/tabs/EndgameScoreTab.vue';
import EndgameTimelineTab from '@/client/components/endgame/tabs/EndgameTimelineTab.vue';
import EndgameCardsTab from '@/client/components/endgame/tabs/EndgameCardsTab.vue';
import EndgameParametersTab from '@/client/components/endgame/tabs/EndgameParametersTab.vue';
import EndgamePlayersTab from '@/client/components/endgame/tabs/EndgamePlayersTab.vue';

const TAB_LABEL: Record<EndgameTab, string> = {
  overview: 'Overview',
  score: 'Score breakdown',
  timeline: 'Timeline',
  cards: 'Card impact',
  parameters: 'Global parameters',
  players: 'Players',
};

const TAB_COMPONENT: Record<EndgameTab, Component> = {
  overview: EndgameOverviewTab,
  score: EndgameScoreTab,
  timeline: EndgameTimelineTab,
  cards: EndgameCardsTab,
  parameters: EndgameParametersTab,
  players: EndgamePlayersTab,
};

defineOptions({name: 'EndgameResultsOverlay'});
const props = defineProps({
  model: {type: Object as () => EndgameModel, required: true},
  view: {type: Object as () => ViewModel, required: true},
  viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
});

// VueUse clipboard: `copied` stays true for 2s after a copy, then auto-resets
// (was a hand-rolled navigator.clipboard branch + setTimeout).
const {copy: clipboardCopy, copied} = useClipboard({legacy: true, copiedDuring: 2000});
const activeTab = computed((): EndgameTab => {
  return endgameState.activeTab;
});
const tabs = computed((): Array<{key: EndgameTab; label: string}> => {
  return ENDGAME_TABS.map((key) => ({key, label: TAB_LABEL[key]}));
});
const activeComponent = computed((): Component => {
  return TAB_COMPONENT[activeTab.value];
});
const newGameHref = computed((): string => {
  // The premium "Mission Control" create-game screen — the self-contained
  // replacement for the legacy create form (no legacy-UI dependency).
  return paths.NEW_GAME_PREMIUM;
});
const rematch = computed((): RematchModel | undefined => {
  return rematchState.model;
});
const rematchSubmitting = computed((): boolean => {
  return rematchState.submitting;
});
const viewerIsPlayer = computed((): boolean => {
  return props.view.thisPlayer !== undefined;
});
const rematchJoin = computed((): string | undefined => {
  return rematchJoinHref(rematch.value);
});
const acceptedCount = computed((): number => {
  return (rematch.value?.votes ?? []).filter((v) => v.status === 'accepted').length;
});
const totalCount = computed((): number => {
  return (rematch.value?.votes ?? []).length;
});
// Hidden-VP game (opt-in, "Show real-time VP" OFF) → offer to replay the
// suspenseful final-scoring reveal.
const hiddenVpMode = computed((): boolean => {
  return props.view.game.gameOptions.showOtherPlayersVP === false && props.view.players.length > 1;
});
function replayReveal(): void {
  replayEndgameReveal();
}
function setTab(tab: EndgameTab): void {
  setEndgameTab(tab);
}
function offerRematch(): void {
  submitRematchAction('offer');
}
function acceptRematch(): void {
  submitRematchAction('accept');
}
function declineRematch(): void {
  submitRematchAction('decline');
}
function cancelRematch(): void {
  submitRematchAction('cancel');
}
function submitRematchAction(action: 'offer' | 'accept' | 'decline' | 'cancel'): void {
  const id = props.view.id;
  if (id !== undefined && viewerIsPlayer.value) {
    void submitRematch(id, action);
  }
}
function minimize(): void {
  minimizeEndgameResults();
}
function copyLink(): void {
  void clipboardCopy(window.location.href); // `copied` flips true for 2s
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (document.querySelector('dialog[open]') !== null) {
      return;
    }
    minimize();
  }
}

onMounted((): void => {
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount((): void => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
