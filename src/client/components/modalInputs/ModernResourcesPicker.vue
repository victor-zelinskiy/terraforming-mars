<template>
  <!--
    Premium replacement for the legacy SelectResources (distribute N standard
    resources across types). Hosted inside MandatoryInputModal via
    ModalInputHost. Per-resource steppers with a running "X / N" counter; the
    confirm button unlocks once exactly N units are allocated.

    Submission is byte-identical to SelectResources.vue:
      {type: 'resources', units}.
  -->
  <div class="modal-input modal-input--resources">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div class="modal-input__dist">
      <div v-for="unit in keys" :key="unit" class="modal-input__dist-row">
        <span class="resource_icon" :class="'resource_icon--' + unit"></span>
        <span class="modal-input__dist-name">{{ resourceName(unit) }}</span>
        <button class="modal-input__step-btn"
                :disabled="units[unit] <= 0"
                @click="reduce(unit)"
                :data-test="'modern-resources-dec-' + unit">−</button>
        <span class="modal-input__step-value modal-input__step-value--sm"
              :data-test="'modern-resources-value-' + unit">{{ units[unit] }}</span>
        <button class="modal-input__step-btn"
                :disabled="total >= playerinput.count"
                @click="add(unit)"
                :data-test="'modern-resources-inc-' + unit">+</button>
      </div>
    </div>

    <div class="modal-input__dist-counter"
         :class="{'modal-input__dist-counter--complete': total === playerinput.count}">
      {{ counterText }}
    </div>

    <div class="modal-input__actions">
      <button class="modal-input__primary-btn"
              :disabled="total !== playerinput.count"
              @click="confirm"
              data-test="modern-resources-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectResourcesModel} from '@/common/models/PlayerInputModel';
import {SelectResourcesResponse} from '@/common/inputs/InputResponse';
import {Units} from '@/common/Units';
import {sum} from '@/common/utils/utils';
import {translateText, translateMessage} from '@/client/directives/i18n';

type DataModel = {
  units: Units;
};

export default defineComponent({
  name: 'ModernResourcesPicker',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectResourcesModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectResourcesResponse) => void,
      required: true,
    },
  },
  data(): DataModel {
    return {
      units: {...Units.EMPTY},
    };
  },
  computed: {
    keys(): ReadonlyArray<keyof Units> {
      return Units.keys;
    },
    total(): number {
      return sum(Units.values(this.units));
    },
    titleText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    buttonText(): string {
      return translateText(this.playerinput.buttonLabel);
    },
    counterText(): string {
      return translateText('Selected ${0} of ${1}')
        .replace('${0}', String(this.total))
        .replace('${1}', String(this.playerinput.count));
    },
  },
  methods: {
    resourceName(unit: keyof Units): string {
      return translateText(unit);
    },
    add(unit: keyof Units): void {
      if (this.total >= this.playerinput.count) {
        return;
      }
      this.units[unit] += 1;
    },
    reduce(unit: keyof Units): void {
      if (this.units[unit] <= 0) {
        return;
      }
      this.units[unit] -= 1;
    },
    confirm(): void {
      if (this.total !== this.playerinput.count) {
        return;
      }
      this.onsave({type: 'resources', units: this.units});
    },
  },
});
</script>
