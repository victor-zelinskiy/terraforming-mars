<template>
  <!--
    Full-screen premium END-OF-GAME results overlay. Covers the entire viewport
    (board + both side bars) — after the game ends this IS the main surface.
    A dark-glass command-center: hero header + tab navigation + per-tab content.
    "Minimize" collapses to a pill (handled by EndgameExperience) so the board
    can still be inspected; New game / Home navigate away. No destructive close.
  -->
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
        <a class="eg-results__ctl" href=".">
          <span class="eg-results__ctl-label" v-i18n>Go to main page</span>
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

<script lang="ts">
import {defineComponent} from 'vue';
import {ViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {endgameState, setEndgameTab, minimizeEndgameResults, replayEndgameReveal, EndgameTab, ENDGAME_TABS} from '@/client/components/endgame/endgameState';
import {rematchState, submitRematch, rematchJoinHref} from '@/client/components/rematch/rematchState';
import {RematchModel} from '@/common/models/RematchModel';
import {paths} from '@/common/app/paths';
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

const TAB_COMPONENT: Record<EndgameTab, string> = {
  overview: 'EndgameOverviewTab',
  score: 'EndgameScoreTab',
  timeline: 'EndgameTimelineTab',
  cards: 'EndgameCardsTab',
  parameters: 'EndgameParametersTab',
  players: 'EndgamePlayersTab',
};

export default defineComponent({
  name: 'EndgameResultsOverlay',
  components: {EndgameOverviewTab, EndgameScoreTab, EndgameTimelineTab, EndgameCardsTab, EndgameParametersTab, EndgamePlayersTab},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    view: {type: Object as () => ViewModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  data() {
    return {copied: false};
  },
  computed: {
    activeTab(): EndgameTab {
      return endgameState.activeTab;
    },
    tabs(): Array<{key: EndgameTab; label: string}> {
      return ENDGAME_TABS.map((key) => ({key, label: TAB_LABEL[key]}));
    },
    activeComponent(): string {
      return TAB_COMPONENT[this.activeTab];
    },
    newGameHref(): string {
      return paths.NEW_GAME;
    },
    rematch(): RematchModel | undefined {
      return rematchState.model;
    },
    rematchSubmitting(): boolean {
      return rematchState.submitting;
    },
    viewerIsPlayer(): boolean {
      return this.view.thisPlayer !== undefined;
    },
    rematchJoin(): string | undefined {
      return rematchJoinHref(this.rematch);
    },
    acceptedCount(): number {
      return (this.rematch?.votes ?? []).filter((v) => v.status === 'accepted').length;
    },
    totalCount(): number {
      return (this.rematch?.votes ?? []).length;
    },
    // Hidden-VP game → offer to replay the suspenseful final-scoring reveal.
    hiddenVpMode(): boolean {
      return this.view.game.gameOptions.showOtherPlayersVP === false && this.view.players.length > 1;
    },
  },
  methods: {
    replayReveal(): void {
      replayEndgameReveal();
    },
    setTab(tab: EndgameTab): void {
      setEndgameTab(tab);
    },
    offerRematch(): void {
      this.submitRematchAction('offer');
    },
    acceptRematch(): void {
      this.submitRematchAction('accept');
    },
    declineRematch(): void {
      this.submitRematchAction('decline');
    },
    cancelRematch(): void {
      this.submitRematchAction('cancel');
    },
    submitRematchAction(action: 'offer' | 'accept' | 'decline' | 'cancel'): void {
      const id = this.view.id;
      if (id !== undefined && this.viewerIsPlayer) {
        void submitRematch(id, action);
      }
    },
    minimize(): void {
      minimizeEndgameResults();
    },
    copyLink(): void {
      const url = window.location.href;
      const done = () => {
        this.copied = true;
        window.setTimeout(() => {
          this.copied = false;
        }, 2000);
      };
      if (navigator.clipboard !== undefined) {
        navigator.clipboard.writeText(url).then(done).catch(() => done());
      } else {
        done();
      }
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (document.querySelector('dialog[open]') !== null) {
          return;
        }
        this.minimize();
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
