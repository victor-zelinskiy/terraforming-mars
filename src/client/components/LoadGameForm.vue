<template>
  <div id="load-game">
      <h1><span v-i18n>{{ APP_NAME }}</span> — <span v-i18n>Load Game</span></h1>

      <div class="load-game-form load-game--block">
          <div class="container load-game-options">
              <div >
                  <label for="gameId">Game, player, or spectator ID to reload:</label><br/>
                  <input class="form-input form-inline load-game-id" :placeholder="'Game Id'" v-model="gameId" /><br/>
                  <label for="rollbackCount">Number of saves to delete before loading:</label><br/>
                  <input class="form-input form-inline load-game-id" value="0" v-model="rollbackCount" /><br/>
                  <AppButton title="Load Game" size="big" type="success" @click="loadGame" />
              </div>
          </div>
      </div>
  </div>
</template>

<script setup vapor lang="ts">
import {computed, ref} from 'vue';
import * as constants from '@/common/constants';
import AppButton from '@/client/components/common/AppButton.vue';
import {LoadGameFormModel} from '@/common/models/LoadGameFormModel';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {useAppRoot} from '@/client/components/appRoot';
import {GameId} from '@/common/Types';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'LoadGameForm'});

// the app root's port (R26): the loaded game and the screen it lands on are the root's to show
const root = useAppRoot();

const gameId = ref<GameId | undefined>(undefined);
const rollbackCount = ref(0);

const APP_NAME = computed((): string => {
  return constants.APP_NAME;
});

function loadGame() {
  const gameIdNow = gameId.value;
  const rollbackCountNow = rollbackCount.value;
  if (gameIdNow === undefined) {
    alert('Specify a game id');
    return;
  }
  const loadGameForm: LoadGameFormModel = {
    gameId: gameIdNow,
    rollbackCount: rollbackCountNow,
  };

  fetch(apiUrl(paths.LOAD_GAME), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(loadGameForm),
  })
    .then((resp) => {
      if (!resp.ok) {
        throw new Error(`Error getting game data: ${resp.statusText}`);
      }
      return resp.json();
    })
    .then((response: SimpleGameModel) => {
      if (response.players.length === 1) {
        window.location.href = 'player?id=' + response.players[0].id;
        return;
      } else {
        window.history.replaceState(response, `${constants.APP_NAME} - Game`, 'game?id=' + response.id);
        if (root !== undefined) {
          root.game = response;
          root.screen = 'game-home';
        }
      }
    })
    .catch((err) => {
      alert('Error loading game');
      console.error(err);
    });
}
</script>
