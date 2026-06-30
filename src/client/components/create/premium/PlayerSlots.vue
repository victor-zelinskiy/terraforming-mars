<template>
  <div class="party-slots" @mouseenter="focusInfo" @focusin="focusInfo">
    <p class="party-slots__hint" v-i18n>Players will find this game by the names you enter, in the «Join» menu.</p>

    <div class="party-slots__list">
      <div
        v-for="(slot, i) in players"
        :key="i"
        class="party-slot"
        :class="{'party-slot--creator': slot.isCreator, 'party-slot--error': nameIssue(i) !== undefined}"
      >
        <span class="party-slot__num">{{ i + 1 }}</span>

        <div class="party-slot__name">
          <input
            type="text"
            class="party-slot__input"
            :class="{'party-slot__input--error': nameIssue(i) !== undefined}"
            :value="slot.name"
            :placeholder="placeholder(i)"
            :maxlength="maxLength + 8"
            autocomplete="off"
            spellcheck="false"
            :aria-label="$t('Player name')"
            :aria-invalid="nameIssue(i) !== undefined ? 'true' : 'false'"
            @input="onName(i, $event)" />
          <span v-if="slot.isCreator" class="party-slot__creator-chip" v-i18n>Creator</span>
          <transition name="party-slot-err">
            <span v-if="nameIssue(i) !== undefined" class="party-slot__err" v-i18n>{{ issueText(i) }}</span>
          </transition>
        </div>

        <slot-color-strip
          :model-value="slot.color"
          :taken="takenColors(i)"
          @update:model-value="onColor(i, $event)" />

        <div v-if="trEnabled" class="party-slot__tr">
          <span class="party-slot__tr-label">TR</span>
          <tr-boost-gauge :model-value="slot.trBoost" @update:model-value="onTr(i, $event)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {PLAYER_NAME_MAX_LENGTH, validatePlayerName} from '@/common/utils/playerName';
import {setIdentity} from '@/client/components/mainMenu/identity/identityState';
import SlotColorStrip from '@/client/components/create/premium/SlotColorStrip.vue';
import TrBoostGauge from '@/client/components/create/premium/TrBoostGauge.vue';
import {
  createGameState,
  PremiumPlayerSlot,
  setInfoFocus,
  setSlotName,
  setSlotColor,
  setSlotTrBoost,
  slotNameIssue,
} from './createGameState';

export default defineComponent({
  name: 'PlayerSlots',
  components: {SlotColorStrip, TrBoostGauge},
  data() {
    return {maxLength: PLAYER_NAME_MAX_LENGTH};
  },
  computed: {
    players(): ReadonlyArray<PremiumPlayerSlot> {
      return createGameState.config.players;
    },
    trEnabled(): boolean {
      return createGameState.config.rules.trBoostEnabled;
    },
  },
  methods: {
    focusInfo(): void {
      setInfoFocus({kind: 'players'});
    },
    placeholder(i: number): string {
      return this.$t('Player name') + ' ' + (i + 1);
    },
    nameIssue(i: number) {
      return slotNameIssue(i);
    },
    issueText(i: number): string {
      const issue = slotNameIssue(i);
      if (issue === 'duplicate') {
        return 'Player names must be unique';
      }
      if (issue === 'invalid') {
        return 'Name is too short';
      }
      return 'Fill in the player name';
    },
    takenColors(i: number): Array<Color> {
      return this.players.filter((_, idx) => idx !== i).map((p) => p.color);
    },
    onName(i: number, e: Event): void {
      const value = (e.target as HTMLInputElement).value;
      setSlotName(i, value);
      // Keep the launcher identity in sync with the creator (slot 0).
      if (i === 0) {
        const v = validatePlayerName(value);
        if (v.ok) {
          setIdentity(v.displayName, this.players[0].color);
        }
      }
    },
    onColor(i: number, color: Color): void {
      setSlotColor(i, color);
      if (i === 0) {
        const v = validatePlayerName(this.players[0].name);
        if (v.ok) {
          setIdentity(v.displayName, this.players[0].color);
        }
      }
    },
    onTr(i: number, value: number): void {
      setSlotTrBoost(i, value);
    },
  },
});
</script>
