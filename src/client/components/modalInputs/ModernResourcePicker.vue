<template>
  <!--
    Premium replacement for the legacy SelectResource (radio list of standard
    resource types). Hosted inside MandatoryInputModal via ModalInputHost.
    Each candidate resource is a glass tile with its icon + name; the player
    picks one, then confirms.

    Submission is byte-identical to SelectResource.vue:
      {type: 'resource', resource}.
  -->
  <div class="modal-input modal-input--resource">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div class="modal-input__resource-grid">
      <button v-for="unit in playerinput.include"
              :key="unit"
              class="modal-input__resource-tile"
              :class="{'modal-input__resource-tile--selected': selected === unit}"
              @click="select(unit)"
              :data-test="'modern-resource-' + unit">
        <span class="resource_icon" :class="'resource_icon--' + unit"></span>
        <span class="modal-input__resource-label">{{ resourceName(unit) }}</span>
      </button>
    </div>

    <div v-if="!controlled" class="modal-input__actions">
      <button class="modal-input__primary-btn"
              :disabled="selected === undefined"
              @click="confirm"
              data-test="modern-resource-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectResourceModel} from '@/common/models/PlayerInputModel';
import {SelectResourceResponse} from '@/common/inputs/InputResponse';
import {Units} from '@/common/Units';
import {translateText, translateMessage} from '@/client/directives/i18n';

type DataModel = {
  selected: keyof Units | undefined;
};

export default defineComponent({
  name: 'ModernResourcePicker',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectResourceModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectResourceResponse) => void,
      required: true,
    },
    // CONTROLLED mode: hide the inner confirm; the chosen resource is captured
    // live (emitted via @change — `undefined` until a pick, so the host's confirm
    // stays gated) and committed by the host modal's own confirm.
    controlled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
  data(): DataModel {
    return {
      selected: undefined,
    };
  },
  computed: {
    titleText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    buttonText(): string {
      return translateText(this.playerinput.buttonLabel);
    },
  },
  watch: {
    // Controlled: keep the host in sync — a chosen resource is a valid response,
    // no choice yet emits `undefined` (host gates its confirm).
    selected(): void {
      if (this.controlled) {
        this.$emit('change', this.selected === undefined ? undefined : {type: 'resource', resource: this.selected});
      }
    },
  },
  methods: {
    resourceName(unit: keyof Units): string {
      return translateText(unit);
    },
    select(unit: keyof Units): void {
      this.selected = unit;
    },
    confirm(): void {
      if (this.selected === undefined) {
        return;
      }
      this.onsave({type: 'resource', resource: this.selected});
    },
  },
});
</script>
