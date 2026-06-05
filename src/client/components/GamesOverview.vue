<template>
  <div id="games-overview" class="games-overview-container">
    <h1 v-i18n>{{ constants.APP_NAME }} — Games Overview</h1>
      <p v-i18n>The following games are available on this server:</p>
      <div v-if="entries.length > 0" class="games-overview-bulk-actions">
        <label class="games-overview-select-all">
          <input
            type="checkbox"
            :checked="allGamesSelected"
            :disabled="bulkDeleting"
            @change="toggleAllGames">
          <span>Select all</span>
        </label>
        <button
          type="button"
          class="games-overview-delete-btn games-overview-delete-btn--bulk"
          :disabled="selectedCount === 0 || bulkDeleting"
          @click="bulkDeleteSelected">
          DELETE SELECTED<span v-if="selectedCount > 0"> ({{ selectedCount }})</span>
        </button>
        <button
          type="button"
          class="games-overview-clear-btn"
          :disabled="selectedCount === 0 || bulkDeleting"
          @click="clearSelection">
          Clear selection
        </button>
      </div>
      <table>
        <game-overview
          v-for="entry in entries"
          :key="entry.id"
          :id="entry.id"
          :game="entry.game"
          :status="entry.status"
          :server-id="serverId"
          :selected-for-bulk="selectedGameIds.includes(entry.id)"
          :bulk-deleting="bulkDeletingGameIds.includes(entry.id)"
          @deleted="onGameDeleted"
          @selection-changed="onGameSelected"></game-overview>
      </table>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import * as constants from '@/common/constants';
import GameOverview from '@/client/components/admin/GameOverview.vue';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {GameId, ParticipantId} from '@/common/Types';

type FetchStatus = {
  id: GameId;
  game: SimpleGameModel | undefined;
  status: 'loading' | 'error' | 'done';
}
type DataModel = {
  entries: Array<FetchStatus>,
  selectedGameIds: Array<GameId>,
  bulkDeleting: boolean,
  bulkDeletingGameIds: Array<GameId>,
};

// Copied from routes/Game.ts and probably IDatabase. Should be centralized I suppose
type Response = {gameId: GameId, participants: Array<ParticipantId>};

export default defineComponent({
  name: 'games-overview',
  data(): DataModel {
    return {
      entries: [],
      selectedGameIds: [],
      bulkDeleting: false,
      bulkDeletingGameIds: [],
    };
  },
  mounted() {
    this.getGames();
  },
  components: {
    GameOverview,
  },
  methods: {
    async getGames() {
      try {
        const response = await fetch('api/games?serverId=' + this.serverId);
        if (!response.ok) {
          alert('Unexpected response fetching games from API');
          return;
        }
        const result: Response[] = await response.json();
        if (result instanceof Array) {
          this.entries = result.map((response) => ({
            id: response.gameId,
            game: undefined,
            status: 'loading',
          }));
          this.entries.forEach((_, idx) => this.getGame(idx));
        } else {
          alert('Unexpected response fetching games from API');
        }
      } catch (error) {
        alert('Error getting games data');
      }
    },
    async getGame(idx: number) {
      if (idx >= this.entries.length) {
        return;
      }
      const entry = this.entries[idx];
      const gameId = entry.id;
      try {
        const response = await fetch('api/game?id=' + gameId);
        if (response.ok) {
          const game = await response.json() as SimpleGameModel;
          entry.status = 'done';
          entry.game = game;
        } else {
          entry.status = 'error';
        }
      } catch (error) {
        entry.status = 'error';
      }
    },
    onGameDeleted(gameId: GameId) {
      this.entries = this.entries.filter((entry) => entry.id !== gameId);
      this.selectedGameIds = this.selectedGameIds.filter((id) => id !== gameId);
      this.bulkDeletingGameIds = this.bulkDeletingGameIds.filter((id) => id !== gameId);
    },
    onGameSelected(payload: {id: GameId, selected: boolean}) {
      if (payload.selected) {
        if (!this.selectedGameIds.includes(payload.id)) {
          this.selectedGameIds.push(payload.id);
        }
      } else {
        this.selectedGameIds = this.selectedGameIds.filter((id) => id !== payload.id);
      }
    },
    toggleAllGames(event: Event) {
      const checked = (event.target as HTMLInputElement).checked;
      this.selectedGameIds = checked ? this.entries.map((entry) => entry.id) : [];
    },
    clearSelection() {
      this.selectedGameIds = [];
    },
    async bulkDeleteSelected() {
      if (this.bulkDeleting) {
        return;
      }
      const ids = this.selectedGameIds.filter((id) => this.entries.some((entry) => entry.id === id));
      if (ids.length === 0) {
        return;
      }
      if (!confirm(`Удалить выбранные игры (${ids.length}) из базы данных? Это действие необратимо.`)) {
        return;
      }

      this.bulkDeleting = true;
      this.bulkDeletingGameIds = ids.slice();
      const failed: Array<GameId> = [];

      for (const id of ids) {
        try {
          const response = await fetch(`api/game/delete?serverId=${encodeURIComponent(this.serverId)}&id=${encodeURIComponent(id)}`, {method: 'POST'});
          if (response.ok) {
            this.onGameDeleted(id);
          } else {
            failed.push(id);
          }
        } catch (error) {
          failed.push(id);
        }
      }

      this.bulkDeleting = false;
      this.bulkDeletingGameIds = [];
      if (failed.length > 0) {
        alert(`Не удалось удалить игр: ${failed.length}. Они остались в списке.`);
      }
    },
  },
  computed: {
    constants(): typeof constants {
      return constants;
    },
    serverId(): string {
      const href = typeof location === 'undefined' ? window.location.href : location.href;
      return (new URL(href)).searchParams.get('serverId') || '';
    },
    selectedCount(): number {
      return this.selectedGameIds.length;
    },
    allGamesSelected(): boolean {
      return this.entries.length > 0 && this.selectedGameIds.length === this.entries.length;
    },
  },
});
</script>
