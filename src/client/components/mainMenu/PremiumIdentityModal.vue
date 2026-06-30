<template>
  <teleport to="body">
    <div class="pmm-identity-modal" role="dialog" aria-modal="true" :aria-label="$t('Player profile')" @keydown.esc="onCancel">
      <div class="pmm-identity-modal__backdrop" @click="onCancel"></div>
      <form class="pmm-identity-modal__card" @submit.prevent="onSave">
        <span class="pmm-identity-modal__corner pmm-identity-modal__corner--tl" aria-hidden="true"></span>
        <span class="pmm-identity-modal__corner pmm-identity-modal__corner--tr" aria-hidden="true"></span>
        <span class="pmm-identity-modal__corner pmm-identity-modal__corner--bl" aria-hidden="true"></span>
        <span class="pmm-identity-modal__corner pmm-identity-modal__corner--br" aria-hidden="true"></span>

        <header class="pmm-identity-modal__head">
          <h2 class="pmm-identity-modal__title" v-i18n>Player profile</h2>
          <p class="pmm-identity-modal__hint" v-i18n>
            Your player profile — a name and cube colour used across your games.
          </p>
        </header>

        <div class="pmm-identity-modal__field">
          <label class="pmm-identity-modal__label" for="pmm-identity-name" v-i18n>Player name</label>
          <input
            id="pmm-identity-name"
            ref="nameInput"
            v-model="name"
            type="text"
            class="pmm-identity-modal__input"
            :class="{'pmm-identity-modal__input--error': showError}"
            :maxlength="maxLength + 8"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="showError ? 'true' : 'false'"
            @input="touched = true" />
          <transition name="pmm-identity-err">
            <span v-if="showError" class="pmm-identity-modal__error" v-i18n>{{ errorMessage }}</span>
          </transition>
        </div>

        <div class="pmm-identity-modal__field">
          <span class="pmm-identity-modal__label" v-i18n>Cube color</span>
          <cube-color-selector v-model="color" />
        </div>

        <footer class="pmm-identity-modal__actions">
          <button type="button" class="pmm-identity-modal__btn pmm-identity-modal__btn--cancel" @click="onCancel">
            <span v-i18n>Cancel</span>
          </button>
          <button
            type="submit"
            class="pmm-identity-modal__btn pmm-identity-modal__btn--save"
            :class="{'pmm-identity-modal__btn--dim': !valid}"
            :aria-disabled="!valid ? 'true' : 'false'">
            <span v-i18n>Save</span>
          </button>
        </footer>
      </form>
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PLAYER_NAME_MAX_LENGTH, validatePlayerName} from '@/common/utils/playerName';
import {DEFAULT_IDENTITY_COLOR} from '@/client/components/mainMenu/identity/playerIdentity';
import CubeColorSelector from '@/client/components/mainMenu/CubeColorSelector.vue';

export default defineComponent({
  name: 'PremiumIdentityModal',
  components: {CubeColorSelector},
  props: {
    initialName: {type: String, default: ''},
    initialColor: {type: String as PropType<Color>, default: DEFAULT_IDENTITY_COLOR},
  },
  emits: ['save', 'close'],
  data() {
    return {
      name: this.initialName,
      color: this.initialColor,
      touched: false,
      maxLength: PLAYER_NAME_MAX_LENGTH,
    };
  },
  computed: {
    validation() {
      return validatePlayerName(this.name);
    },
    valid(): boolean {
      return this.validation.ok;
    },
    errorMessage(): string {
      if (this.validation.ok) {
        return '';
      }
      switch (this.validation.reason) {
      case 'empty': return 'Enter a player name';
      case 'too-short': return 'Name is too short';
      case 'too-long': return 'Name is too long';
      default: return 'Enter a player name';
      }
    },
    showError(): boolean {
      return this.touched && !this.valid;
    },
  },
  mounted() {
    this.$nextTick(() => {
      const input = this.$refs.nameInput as HTMLInputElement | undefined;
      input?.focus();
      input?.select();
    });
  },
  methods: {
    onSave(): void {
      this.touched = true;
      if (!this.validation.ok) {
        return;
      }
      this.$emit('save', {displayName: this.validation.displayName, color: this.color});
    },
    onCancel(): void {
      this.$emit('close');
    },
  },
});
</script>
