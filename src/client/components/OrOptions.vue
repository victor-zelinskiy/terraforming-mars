<template>
  <div class='wf-options'>
    <label v-if="showtitle"><div>{{ $t(playerinput.title) }}</div></label>
    <label v-if="playerinput.warning !== undefined" class="card-warning"><div>({{ $t(playerinput.warning) }})</div></label>
    <div v-for="(option, idx) in displayedOptions" :key="idx">
      <label class="form-radio" ref="optionLabels">
        <input v-model="selectedOption" type="radio" :name="radioElementName" :value="option" />
        <i class="form-icon" />
        <span>{{ $t(option.title) }}</span>
      </label>
      <div v-if="selectedIdx === idx" style="margin-left: 30px">
        <player-input-factory ref="inputfactory"
                              :playerView="playerView"
                              :playerinput="option"
                              :onsave="playerFactorySaved(idx)"
                              :showsave="showsave && showChildSaveButton(option)"
                              :showtitle="false" />
      </div>
    </div>
    <div v-if="showsave && selectedOption && !showChildSaveButton(selectedOption)">
      <div style="margin: 5px 30px 10px" class="wf-action">
        <AppButton :title="$t(selectedOption.buttonLabel)" type="submit" size="normal" @click="saveData" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {isHTMLElement} from '@/client/utils/vueUtils';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {InputResponse, OrOptionsResponse} from '@/common/inputs/InputResponse';
import {MANDATORY_MODAL_PICKER_SETTER} from '@/client/components/MandatoryInputModal.vue';
import {Message} from '@/common/logs/Message';

/*
 * Setter signature contract with MandatoryInputModal — extended in
 * v40-b to carry the selected option's title alongside the active
 * flag. The title is used by the modal to seed the always-visible
 * PlacementBanner that announces "AWAITING PLACEMENT / <option title>"
 * (e.g. "Add an ocean" during the WGT picker). `title` is allowed to
 * be undefined when active=false (banner unmounts in that case).
 */
type PickerModeSetter = (mode: boolean, title?: string | Message) => void;

let unique = 0;

export default defineComponent({
  name: 'or-options',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => OrOptionsModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: OrOptionsResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  components: {
    AppButton,
  },
  // When this OrOptions is hosted inside a MandatoryInputModal, the modal
  // exposes a `setPickerMode` function via provide(). We inject it (with
  // `default: undefined` so it stays optional for inline use) and call it
  // whenever the selected option becomes / stops being a board-picker
  // SelectSpace — letting the modal step aside for board interaction.
  inject: {
    [MANDATORY_MODAL_PICKER_SETTER]: {
      from: MANDATORY_MODAL_PICKER_SETTER,
      default: undefined,
    },
  },
  data() {
    const displayedOptions: Array<PlayerInputModel> = [];
    const originalIndices: Array<number> = [];
    this.playerinput.options.forEach((option, i) => {
      if (option.type === 'card' && option.showOnlyInLearnerMode !== false && !getPreferences().learner_mode) {
        return;
      }
      displayedOptions.push(option);
      originalIndices.push(i);
    });
    // Legacy radio UI starts with NO option selected. Auto-mounting the
    // default option's child input caused side effects we don't want — most
    // notably SelectSpace children activating board-tile flashing the moment
    // the action menu appears (Convert Plants was the canonical case). This
    // radio stack is now a "push-through" fallback for actions that haven't
    // been promoted to dedicated buttons yet; the user has to explicitly
    // click a radio to engage the inner UI.
    return {
      displayedOptions,
      originalIndices,
      radioElementName: 'selectOption' + unique++,
      selectedOption: undefined as PlayerInputModel | undefined,
      selectedIdx: -1,
    };
  },
  watch: {
    selectedOption(newOption: PlayerInputModel | undefined) {
      this.selectedIdx = newOption === undefined ? -1 : this.displayedOptions.indexOf(newOption);
      // Signal picker-mode to the parent modal (if any) so it can step
      // aside for board interaction when the selected option is a
      // SelectSpace (board-tile picker). When the user picks a different,
      // non-picker option the modal restores. The option's title rides
      // along so the modal can drive a PlacementBanner with the precise
      // prompt name ("Add an ocean" etc.) instead of a generic fallback.
      const isSpacePicker = newOption !== undefined && newOption.type === 'space';
      this.notifyPickerMode(isSpacePicker, isSpacePicker ? newOption?.title : undefined);
      // Clicking the option can shift elements on the page.
      // This preserves the location of the option button the user just clicked by
      // tracking where it was on the screen, where it moved, and then repositioning it.
      const anchorTop = this.getSelectedOptionTop();
      this.$nextTick(() => {
        const newTop = this.getSelectedOptionTop();
        if (anchorTop !== undefined && newTop !== undefined) {
          const delta = newTop - anchorTop;
          if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, delta);
          }
        }
      });
    },
  },
  beforeUnmount() {
    // OrOptions is going away (e.g. server resolved this prompt and we're
    // moving to the next one) — make sure picker mode flag doesn't get
    // stuck in `true` on the modal.
    this.notifyPickerMode(false);
  },
  methods: {
    getSelectedOptionTop(): number | undefined {
      const element = this.getSelectedOptionLabelElement();
      return element?.getBoundingClientRect().top;
    },
    getSelectedOptionLabelElement(): HTMLElement | undefined {
      const idx = this.selectedIdx;
      const optionLabels = this.$refs.optionLabels as HTMLElement | HTMLElement[] | undefined;
      if (idx === -1 || !optionLabels) {
        return undefined;
      }

      const val = Array.isArray(optionLabels) ? optionLabels[idx] : optionLabels;
      return isHTMLElement(val) ? val : undefined;
    },
    playerFactorySaved(displayedIdx: number) {
      const idx = this.originalIndices[displayedIdx];
      return (out: InputResponse) => {
        this.onsave({
          type: 'or',
          index: idx,
          response: out,
        });
      };
    },
    // When the child component is a multi-select card, let it render its own save button.
    // This allows the child to control the button label (e.g. "Sell 3 patents").
    showChildSaveButton(option: PlayerInputModel): boolean {
      return option.type === 'card' && !(option.max === 1 && option.min === 1);
    },
    saveData() {
      let ref = this.$refs['inputfactory'] as {saveData: () => void} | Array<{saveData: () => void}>;
      if (Array.isArray(ref)) {
        ref = ref[0];
      }
      ref.saveData();
    },
    notifyPickerMode(active: boolean, title?: string | Message) {
      const setter = (this as unknown as {[k: string]: PickerModeSetter | undefined})[MANDATORY_MODAL_PICKER_SETTER];
      if (typeof setter === 'function') {
        setter(active, title);
      }
    },
  },
});

</script>

