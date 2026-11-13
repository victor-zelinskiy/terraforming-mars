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

<script setup lang="ts">

import {computed, onMounted, ref} from 'vue';
import * as constants from '@/common/constants';
import {translateTextWithParams} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import GameOverview from '@/client/components/admin/GameOverview.vue';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {GameId, ParticipantId} from '@/common/Types';
import {apiUrl} from '@/client/utils/runtimeConfig';

type FetchStatus = {
  id: GameId;
  game: SimpleGameModel | undefined;
  status: 'loading' | 'error' | 'done';
}

// Copied from routes/Game.ts and probably IDatabase. Should be centralized I suppose
type Response = {gameId: GameId, participants: Array<ParticipantId>};

defineOptions({name: 'games-overview'});

const entries = ref<Array<FetchStatus>>([]);
const selectedGameIds = ref<Array<GameId>>([]);
const bulkDeleting = ref(false);
const bulkDeletingGameIds = ref<Array<GameId>>([]);
const serverId = computed((): string => {
  const href = typeof location === 'undefined' ? window.location.href : location.href;
  return (new URL(href)).searchParams.get('serverId') || '';
});
const selectedCount = computed((): number => {
  return selectedGameIds.value.length;
});
const allGamesSelected = computed((): boolean => {
  return entries.value.length > 0 && selectedGameIds.value.length === entries.value.length;
});
async function getGames() {
  try {
    const response = await fetch(apiUrl('api/games?serverId=' + serverId.value));
    if (!response.ok) {
      alert('Unexpected response fetching games from API');
      return;
    }
    const result: Response[] = await response.json();
    if (result instanceof Array) {
      entries.value = result.map((response) => ({
        id: response.gameId,
        game: undefined,
        status: 'loading',
      }));
      entries.value.forEach((_, idx) => getGame(idx));
    } else {
      alert('Unexpected response fetching games from API');
    }
  } catch (error) {
    alert('Error getting games data');
  }
}
async function getGame(idx: number) {
  if (idx >= entries.value.length) {
    return;
  }
  const entry = entries.value[idx];
  const gameId = entry.id;
  try {
    const response = await fetch(apiUrl('api/game?id=' + gameId));
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
}
function onGameDeleted(gameId: GameId) {
  entries.value = entries.value.filter((entry) => entry.id !== gameId);
  selectedGameIds.value = selectedGameIds.value.filter((id) => id !== gameId);
  bulkDeletingGameIds.value = bulkDeletingGameIds.value.filter((id) => id !== gameId);
}
function onGameSelected(payload: {id: GameId, selected: boolean}) {
  if (payload.selected) {
    if (!selectedGameIds.value.includes(payload.id)) {
      selectedGameIds.value.push(payload.id);
    }
  } else {
    selectedGameIds.value = selectedGameIds.value.filter((id) => id !== payload.id);
  }
}
function toggleAllGames(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedGameIds.value = checked ? entries.value.map((entry) => entry.id) : [];
}
function clearSelection() {
  selectedGameIds.value = [];
}
async function bulkDeleteSelected() {
  if (bulkDeleting.value) {
    return;
  }
  const ids = selectedGameIds.value.filter((id) => entries.value.some((entry) => entry.id === id));
  if (ids.length === 0) {
    return;
  }
  if (!confirm(translateTextWithParams('Delete the selected games (${0}) from the database? This action cannot be undone.', [String(ids.length)]))) {
    return;
  }

  bulkDeleting.value = true;
  bulkDeletingGameIds.value = ids.slice();
  const failed: Array<GameId> = [];

  for (const id of ids) {
    try {
      const response = await fetch(apiUrl(`api/game/delete?serverId=${encodeURIComponent(serverId.value)}&id=${encodeURIComponent(id)}`), {method: 'POST'});
      if (response.ok) {
        onGameDeleted(id);
      } else {
        failed.push(id);
      }
    } catch (error) {
      failed.push(id);
    }
  }

  bulkDeleting.value = false;
  bulkDeletingGameIds.value = [];
  if (failed.length > 0) {
    alert(translateTextWithParams('Failed to delete ${0} game(s). They remain in the list.', [String(failed.length)]));
  }
}

onMounted(() => {
  getGames();
});
</script>
