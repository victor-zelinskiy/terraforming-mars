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
    <td><a target="blank" :href="'spectator?id=' + game.spectatorId" v-i18n class="player-name spectator">Spectator</a></td>
  </template>
  <td>
    <button
      type="button"
      class="games-overview-delete-btn"
      :disabled="deleting || bulkDeleting"
      @click="deleteGame">УДАЛИТЬ</button>
  </td>
  </tr>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {Phase} from '@/common/Phase';

type Status = 'loading' | 'error' | 'done';

export default defineComponent({
  name: 'GameOverview',
  data() {
    return {
      deleting: false,
    };
  },
  props: {
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
  },
  emits: ['deleted', 'selection-changed'],
  computed: {
    statusClass(): string {
      switch (this.status) {
      case 'loading':
        return 'status-loading';
      case 'error':
        return 'status-error';
      case 'done':
        if (this.isRunning) {
          return 'status-running';
        } else {
          return 'status-finished';
        }
      default:
        return '';
      }
    },
    isRunning(): boolean {
      return this.game?.phase !== Phase.END;
    },
    gameName(): string {
      // Fall back to the raw id while the game model is still loading (or failed to load).
      return this.game?.name ?? this.id;
    },
  },
  methods: {
    onSelected(event: Event) {
      this.$emit('selection-changed', {
        id: this.id,
        selected: (event.target as HTMLInputElement).checked,
      });
    },
    async deleteGame() {
      if (this.deleting) {
        return;
      }
      if (!confirm(`Удалить игру «${this.gameName}» из базы данных? Это действие необратимо.`)) {
        return;
      }
      this.deleting = true;
      try {
        const response = await fetch(`api/game/delete?serverId=${encodeURIComponent(this.serverId)}&id=${encodeURIComponent(this.id)}`, {method: 'POST'});
        if (!response.ok) {
          alert('Не удалось удалить игру');
          this.deleting = false;
          return;
        }
        this.$emit('deleted', this.id);
      } catch (error) {
        alert('Ошибка при удалении игры');
        this.deleting = false;
      }
    },
  },
});
</script>
