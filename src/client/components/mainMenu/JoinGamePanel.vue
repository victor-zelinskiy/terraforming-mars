<template>
  <teleport to="body">
    <div class="join-panel" role="dialog" aria-modal="true" :aria-label="$t('Your games')">
      <div class="join-panel__backdrop" @click="close"></div>
      <div class="join-panel__card">
        <span class="join-panel__corner join-panel__corner--tl" aria-hidden="true"></span>
        <span class="join-panel__corner join-panel__corner--tr" aria-hidden="true"></span>
        <span class="join-panel__corner join-panel__corner--bl" aria-hidden="true"></span>
        <span class="join-panel__corner join-panel__corner--br" aria-hidden="true"></span>

        <header class="join-panel__head">
          <div class="join-panel__titles">
            <h2 class="join-panel__title" v-i18n>Your games</h2>
            <div class="join-panel__subtitle">
              <span v-i18n>Unfinished games for</span>
              <span class="join-panel__player">
                <span class="join-panel__player-cube" aria-hidden="true">
                  <player-cube :color="color" :size="20" :glow="true" :shadow="true" :overlay-symbol="false" />
                </span>
                <span class="join-panel__player-name">{{ name }}</span>
              </span>
            </div>
          </div>
          <div class="join-panel__head-actions">
            <button type="button" class="join-panel__edit" @click="$emit('edit-identity')">
              <span class="join-panel__edit-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 5.5 L18.5 9.5 M4 20 L4.6 16.4 L15 6 L18 9 L7.6 19.4 Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="join-panel__edit-label" v-i18n>Change name and color</span>
            </button>
            <button type="button" class="join-panel__close" :aria-label="$t('Close')" @click="close">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <div class="join-panel__body">
          <div v-if="showLoading" class="join-panel__skeletons">
            <div v-for="n in 3" :key="n" class="join-skeleton"></div>
          </div>

          <div v-else-if="showError" class="join-panel__state">
            <div class="join-panel__state-title" v-i18n>Could not load your games</div>
            <button type="button" class="join-panel__ghost" @click="reload"><span v-i18n>Retry</span></button>
          </div>

          <div v-else-if="isEmpty" class="join-panel__state">
            <span class="join-panel__empty-glyph" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="12" width="32" height="26" rx="3" stroke="currentColor" stroke-width="1.6" opacity="0.7"/>
                <path d="M8 19 H40 M16 12 V8 M32 12 V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
              </svg>
            </span>
            <div class="join-panel__state-title">{{ emptyMessage }}</div>
            <div class="join-panel__state-actions">
              <button type="button" class="join-panel__cta" @click="$emit('create-game')"><span v-i18n>Create game</span></button>
              <button type="button" class="join-panel__ghost" @click="$emit('edit-identity')"><span v-i18n>Change name</span></button>
            </div>
          </div>

          <transition-group v-else tag="div" class="join-panel__list" name="join-card">
            <join-game-card
              v-for="g in games"
              :key="g.id"
              :game="g"
              :is-new="isNew(g.id)"
              :desired-color="color"
              @edit-identity="$emit('edit-identity')" />
          </transition-group>
        </div>

        <footer class="join-panel__foot">
          <button type="button" class="join-panel__cta join-panel__cta--footer" @click="$emit('create-game')">
            <span v-i18n>Create game</span>
          </button>
          <button type="button" class="join-panel__ghost" @click="close"><span v-i18n>Close</span></button>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {translateTextWithParams} from '@/client/directives/i18n';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {DEFAULT_IDENTITY_COLOR} from '@/client/components/mainMenu/identity/playerIdentity';
import {
  joinGamesState,
  loadJoinableGames,
  startJoinPolling,
  resetJoinGames,
  beginNameReload,
} from '@/client/components/mainMenu/joinGamesState';
import JoinGameCard from '@/client/components/mainMenu/JoinGameCard.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';

export default defineComponent({
  name: 'JoinGamePanel',
  components: {JoinGameCard, PlayerCube},
  emits: ['close', 'edit-identity', 'create-game'],
  computed: {
    name(): string {
      return identityState.identity?.displayName ?? '';
    },
    color(): Color {
      return identityState.identity?.cubeColor ?? DEFAULT_IDENTITY_COLOR;
    },
    games(): ReadonlyArray<JoinableGameSummary> {
      return joinGamesState.games;
    },
    showLoading(): boolean {
      return joinGamesState.loading && !joinGamesState.loadedOnce;
    },
    showError(): boolean {
      return joinGamesState.error && !joinGamesState.loadedOnce;
    },
    isEmpty(): boolean {
      return joinGamesState.loadedOnce && !joinGamesState.error && this.games.length === 0;
    },
    emptyMessage(): string {
      return translateTextWithParams('No unfinished games for ${0}', [this.name]);
    },
  },
  watch: {
    name(newName: string) {
      beginNameReload();
      if (newName !== '') {
        void loadJoinableGames(newName);
      }
    },
  },
  mounted() {
    if (this.name !== '') {
      void loadJoinableGames(this.name);
    }
    startJoinPolling();
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown);
    resetJoinGames();
  },
  methods: {
    isNew(id: string): boolean {
      return joinGamesState.newIds.includes(id);
    },
    reload(): void {
      if (this.name !== '') {
        void loadJoinableGames(this.name);
      }
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        this.close();
      }
    },
    close(): void {
      this.$emit('close');
    },
  },
});
</script>
