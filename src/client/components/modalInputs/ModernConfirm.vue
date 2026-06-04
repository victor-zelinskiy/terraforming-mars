<template>
  <!--
    Premium replacement for a bare top-level SelectOption prompt (a single
    mandatory confirm/acknowledge). Hosted inside MandatoryInputModal via
    ModalInputHost. The legacy SelectOption.vue (a plain AppButton) is kept
    for the inline / nested-radio fallback path, per CLAUDE.md "don't
    refactor the legacy radio stack".

    Submission is byte-identical to SelectOption.vue: `{type: 'option'}`.
  -->
  <div class="modal-input modal-input--confirm">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div v-if="hasWarnings" class="modal-input__warnings">
      <warnings-component :warnings="playerinput.warnings"></warnings-component>
    </div>

    <div class="modal-input__actions">
      <button class="modal-input__primary-btn"
              @click="confirm"
              data-test="modern-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectOptionModel} from '@/common/models/PlayerInputModel';
import {SelectOptionResponse} from '@/common/inputs/InputResponse';
import {translateText, translateMessage} from '@/client/directives/i18n';
import WarningsComponent from '@/client/components/WarningsComponent.vue';

export default defineComponent({
  name: 'ModernConfirm',
  components: {WarningsComponent},
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectOptionModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectOptionResponse) => void,
      required: true,
    },
  },
  computed: {
    titleText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    buttonText(): string {
      return translateText(this.playerinput.buttonLabel);
    },
    hasWarnings(): boolean {
      return this.playerinput.warnings !== undefined && this.playerinput.warnings.length > 0;
    },
  },
  methods: {
    confirm(): void {
      this.onsave({type: 'option'});
    },
  },
});
</script>
