<template>
  <!--
    Premium replacement for the legacy SelectPlayer radio list, hosted inside
    MandatoryInputModal via ModalInputHost. Each selectable player is a glass
    chip with their colour swatch + name; clicking commits the choice (single
    select — same as the legacy radio + save, just one tap).

    Submission is byte-identical to SelectPlayer.vue: {type: 'player', player}.
  -->
  <div class="modal-input modal-input--players">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div v-if="warningText !== ''" class="modal-input__warning">{{ warningText }}</div>

    <div class="modal-input__players">
      <button v-for="color in players"
              :key="color"
              class="modal-input__player-btn"
              @click="pick(color)"
              :data-test="'modern-player-' + color">
        <span class="modal-input__player-swatch" :class="swatchClass(color)"></span>
        <span class="modal-input__player-name">{{ playerName(color) }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectPlayerModel} from '@/common/models/PlayerInputModel';
import {SelectPlayerResponse} from '@/common/inputs/InputResponse';
import {Color} from '@/common/Color';
import {playerColorClass} from '@/common/utils/utils';
import {translateText, translateMessage} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ModernPlayerPicker',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectPlayerModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectPlayerResponse) => void,
      required: true,
    },
  },
  computed: {
    players(): ReadonlyArray<Color> {
      return this.playerinput.players;
    },
    titleText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    warningText(): string {
      const w = this.playerinput.warning;
      if (w === undefined) {
        return '';
      }
      return typeof w === 'string' ? translateText(w) : translateMessage(w);
    },
  },
  methods: {
    playerName(color: Color): string {
      const player = this.playerView.players.find((p) => p.color === color);
      // 'neutral' (solo opponent) isn't in the players list — label it plainly.
      return player !== undefined ? player.name : translateText('Neutral');
    },
    swatchClass(color: Color): string {
      return playerColorClass(color, 'bg');
    },
    pick(color: Color): void {
      this.onsave({type: 'player', player: color});
    },
  },
});
</script>
