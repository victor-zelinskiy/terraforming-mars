<template>
  <div id="game-home" class="game-home-container">
    <h1><span v-i18n>Terraforming Mars</span> [<span v-i18n>game id:</span> <span>{{getGameId()}}</span>]</h1>
    <h4><span v-i18n>Instructions: To start the game, separately copy and share the links with all players, and then click on your name.</span><br/><span v-i18n>Save this page in case you or one of your opponents loses a link.</span></h4>
    <ul>
      <li v-for="(player, index) in (game === undefined ? [] : game.players)" :key="player.color">
        <span class="turn-order" v-i18n>{{getTurnOrder(index)}}</span>
        <span :class="'color-square ' + getPlayerCubeColorClass(player.color)">{{playerSymbol(player.color)}}</span>
        <span class="player-name"><a :href="getHref(player.id)">{{player.name}}</a></span>
        <AppButton title="copy" size="tiny" @click="copyUrl(player.id)"/>
        <span v-if="isPlayerUrlCopied(player.id)" class="copied-notice"><span v-i18n>Copied!</span></span>
      </li>
      <li v-if="game !== undefined && game.spectatorId">
        <p/>
        <span class="turn-order"></span>
        <span class="color-square"></span>
        <span class="player-name"><a :href="getHref(game.spectatorId)" v-i18n>Spectator</a></span>
        <AppButton title="copy" size="tiny" @click="copyUrl(game.spectatorId)"/>
      </li>
    </ul>

    <div class="spacing-setup"></div>

    <purge-warning :expectedPurgeTimeMs="game.expectedPurgeTimeMs"></purge-warning>

    <div class="spacing-setup"></div>
    <div v-if="game !== undefined">
      <h1 v-i18n>Game settings</h1>
      <game-setup-detail :gameOptions="game.gameOptions" :playerNumber="game.players.length" :lastSoloGeneration="game.lastSoloGeneration"></game-setup-detail>
    </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import AppButton from '@/client/components/common/AppButton.vue';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import {playerColorClass} from '@/common/utils/utils';
import GameSetupDetail from '@/client/components/GameSetupDetail.vue';
import {ParticipantId} from '@/common/Types';
import {Color} from '@/common/Color';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {gameDocumentTitle} from '../utils/documentTitle';
import {refAutoReset, useClipboard} from '@vueuse/core';

const DEFAULT_COPIED_PLAYER_ID = '-1';

export default defineComponent({
  name: 'game-home',
  props: {
    game: {
      type: Object as () => SimpleGameModel,
      required: true,
    },
  },
  components: {
    AppButton,
    'game-setup-detail': GameSetupDetail,
    PurgeWarning,
  },
  setup() {
    // VueUse clipboard (navigator.clipboard with the execCommand legacy fallback
    // for older browsers) + a self-resetting "which player id is copied" flag
    // that returns to the default 3s after the last copy (was a leaking
    // setInterval + a hand-rolled execCommand dance).
    const {copy: clipboardCopy} = useClipboard({legacy: true});
    const urlCopiedPlayerId = refAutoReset(DEFAULT_COPIED_PLAYER_ID, 3000);
    return {clipboardCopy, urlCopiedPlayerId};
  },
  methods: {
    getGameId(): string {
      return this.game !== undefined ? this.game.id.toString() : 'n/a';
    },
    getTurnOrder(index: number): string {
      if (index === 0) {
        return '1st';
      } else if (index === 1) {
        return '2nd';
      } else if (index === 2) {
        return '3rd';
      } else if (index > 2) {
        return `${index + 1}th`;
      } else {
        return 'n/a';
      }
    },
    getPlayerCubeColorClass(color: Color): string {
      return playerColorClass(color, 'bg');
    },
    getHref(playerId: ParticipantId): string {
      if (playerId === this.game.spectatorId) {
        return `spectator?id=${playerId}`;
      }
      return `player?id=${playerId}`;
    },
    copyUrl(playerId: ParticipantId | undefined): void {
      if (playerId === undefined) {
        return;
      }
      // Get current location path without game?id=xxxxxxx
      const path = window.location.href.replace(/game\?id=.*/, '');
      void this.clipboardCopy(path + this.getHref(playerId));
      this.urlCopiedPlayerId = playerId; // refAutoReset returns it to default after 3s
    },
    isPlayerUrlCopied(playerId: string): boolean {
      return playerId === this.urlCopiedPlayerId;
    },
    playerSymbol(color: Color) {
      return playerSymbol(color);
    },
  },
  mounted() {
    document.title = gameDocumentTitle(this.game);
  },
});

</script>

