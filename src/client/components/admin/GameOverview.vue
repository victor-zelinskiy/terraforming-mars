<template>
  <tr>

  <!-- single item in GamesOverview -->
  <td>
    <input
      type="checkbox"
      class="games-overview-select"
      :checked="selectedForBulk"
      :disabled="deleting || bulkDeleting"
      :aria-label="'Select game ' + gameName"
      @change="onSelected">
  </td>
  <td><span :class="statusClass"></span></td>
  <td><a :href="'game?id='+id" class="game-id">{{gameName}}</a></td>
  <template v-if="game !== undefined">
    <td v-for="player in game.players" :key="player.color">
      <span class="player-name" :class="'player_bg_color_'+ player.color">
        <a calassc target="blank" :href="'player?id=' + player.id">{{player.name}}</a>
      </span>
    </td>
  </template>
  <td>
    <button
      type="button"
      class="games-overview-delete-btn"
      :disabled="deleting || bulkDeleting"
      @click="deleteGame" v-i18n>Delete</button>
  </td>
  </tr>
</template>

<script setup vapor lang="ts">
import {computed, ref} from 'vue';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {Phase} from '@/common/Phase';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

type Status = 'loading' | 'error' | 'done';

defineOptions({name: 'GameOverview'});
const props = defineProps({
  status: {
    type: String as () => Status,
    required: true,
  },
  game: {
    type: Object as () => SimpleGameModel | undefined,
    required: false,
    default: undefined,
  },
  id: {
    type: String,
    required: true,
  },
  serverId: {
    type: String,
    required: true,
  },
  selectedForBulk: {
    type: Boolean,
    default: false,
  },
  bulkDeleting: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['deleted', 'selection-changed']);

const deleting = ref(false);
const statusClass = computed((): string => {
  switch (props.status) {
  case 'loading':
    return 'status-loading';
  case 'error':
    return 'status-error';
  case 'done':
    if (isRunning.value) {
      return 'status-running';
    } else {
      return 'status-finished';
    }
  default:
    return '';
  }
});
const isRunning = computed((): boolean => {
  return props.game?.phase !== Phase.END;
});
const gameName = computed((): string => {
  // Fall back to the raw id while the game model is still loading (or failed to load).
  return props.game?.name ?? props.id;
});
function onSelected(event: Event) {
  emit('selection-changed', {
    id: props.id,
    selected: (event.target as HTMLInputElement).checked,
  });
}
async function deleteGame() {
  if (deleting.value) {
    return;
  }
  if (!confirm(translateTextWithParams('Delete game «${0}» from the database? This action cannot be undone.', [gameName.value]))) {
    return;
  }
  deleting.value = true;
  try {
    const response = await fetch(apiUrl(`api/game/delete?serverId=${encodeURIComponent(props.serverId)}&id=${encodeURIComponent(props.id)}`), {method: 'POST'});
    if (!response.ok) {
      alert(translateText('Failed to delete the game'));
      deleting.value = false;
      return;
    }
    emit('deleted', props.id);
  } catch (error) {
    alert(translateText('Error deleting the game'));
    deleting.value = false;
  }
}
</script>
