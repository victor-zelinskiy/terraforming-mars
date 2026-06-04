<template>
  <!--
    Premium replacement for the legacy OrOptions radio stack, hosted inside
    MandatoryInputModal (via ModalInputHost). Generalises the WGT modal
    pattern (WorldGovernmentModalContent) to ANY card-play OrOptions:

      - SelectOption (type 'option')  → commit instantly on click.
      - SelectSpace  (type 'space')   → enter board picker-mode (modal fades,
                                         PlacementBanner shows, board becomes
                                         clickable) — same mechanism as WGT
                                         "Add an ocean".
      - anything else (player / amount / card / resources / nested or…) →
                                         expand into a wizard step that hosts
                                         the nested input through ModalInputHost
                                         (premium where available, legacy
                                         factory as a visible fallback).

    Submission is byte-identical to OrOptions.vue:
      {type: 'or', index: <ORIGINAL index>, response: <nested InputResponse>}

    The legacy OrOptions.vue is kept for the inline / hidden-legacy path.
  -->
  <div class="modal-input modal-input--options">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div v-if="warningText !== ''" class="modal-input__warning">{{ warningText }}</div>

    <!-- Collapsed view: the list of options. -->
    <div v-if="expandedIdx === -1" class="modal-input__options">
      <button v-for="(opt, i) in displayedOptions"
              :key="i"
              class="modal-input__option-btn"
              :class="[
                'modal-input__option-btn--' + optionKind(opt),
                {'modal-input__option-btn--active': isPendingSpace(i)},
              ]"
              @click="pickOption(i)"
              :data-test="'modern-option-' + i">
        <span class="modal-input__option-marker"
              :class="'modal-input__option-marker--' + optionKind(opt)"></span>
        <span class="modal-input__option-body">
          <span class="modal-input__option-label">{{ optionTitle(opt) }}</span>
          <warnings-component v-if="optionWarnings(opt)"
                              :warnings="optionWarnings(opt)"
                              class="modal-input__option-warnings"></warnings-component>
        </span>
        <span v-if="optionKind(opt) === 'space'" class="modal-input__option-hint" v-i18n>on the board</span>
        <span v-else-if="optionKind(opt) === 'nested'" class="modal-input__option-chevron">›</span>
      </button>
    </div>

    <!-- Expanded view: a single nested input (wizard step). -->
    <div v-else class="modal-input__nested">
      <button class="modal-input__back-btn" @click="collapse" data-test="modern-option-back">
        <span class="modal-input__back-glyph">‹</span>
        <span v-i18n>Back to options</span>
      </button>
      <div class="modal-input__nested-label">{{ optionTitle(displayedOptions[expandedIdx]) }}</div>
      <modal-input-host :playerView="playerView"
                        :playerinput="displayedOptions[expandedIdx]"
                        :onsave="nestedSave" />
    </div>

    <!--
      SelectSpace picker. Mounted (invisible — board tiles are highlighted
      directly) when a 'space' option is picked. Mirrors WorldGovernmentModalContent:
      the modal fades via picker-mode and the player clicks a board tile, which
      fires onSpacePicked → wraps the SelectSpace response in the outer OR.
    -->
    <select-space v-if="pendingSpacePrompt !== undefined && pendingOptionIndex !== undefined"
                  :playerView="playerView"
                  :playerinput="pendingSpacePrompt"
                  :onsave="onSpacePicked"
                  :showsave="false"
                  :showtitle="false" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {OrOptionsModel, PlayerInputModel, SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {InputResponse, OrOptionsResponse, SelectSpaceResponse} from '@/common/inputs/InputResponse';
import {Message} from '@/common/logs/Message';
import {Warning} from '@/common/cards/Warning';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {MANDATORY_MODAL_PICKER_SETTER} from '@/client/components/MandatoryInputModal.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import WarningsComponent from '@/client/components/WarningsComponent.vue';

type PickerModeSetter = (mode: boolean, title?: string | Message) => void;

type DataModel = {
  displayedOptions: Array<PlayerInputModel>;
  originalIndices: Array<number>;
  // Displayed index of the option whose nested input is expanded, or -1 for
  // the list view.
  expandedIdx: number;
  // Active board-picker state (original index + the SelectSpace model).
  pendingSpacePrompt: SelectSpaceModel | undefined;
  pendingOptionIndex: number | undefined;
};

function optionTitleText(title: string | Message | undefined): string {
  if (title === undefined) {
    return '';
  }
  return typeof title === 'string' ? translateText(title) : translateMessage(title);
}

export default defineComponent({
  name: 'ModernOptionPicker',
  components: {
    SelectSpace,
    WarningsComponent,
    // `<modal-input-host>` is registered GLOBALLY (main.ts) so we can host a
    // nested input recursively without importing ModalInputHost here — that
    // static import would re-introduce the ModalInputHost <-> ModernOptionPicker
    // type cycle that collapses vue-tsc inference to `{}`. Same trick the
    // legacy OrOptions uses with the global `<player-input-factory>`.
  },
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
  },
  // Picker-mode setter exposed by MandatoryInputModal (optional — undefined
  // when rendered outside a modal).
  inject: {
    [MANDATORY_MODAL_PICKER_SETTER]: {
      from: MANDATORY_MODAL_PICKER_SETTER,
      default: undefined,
    },
  },
  data(): DataModel {
    const displayedOptions: Array<PlayerInputModel> = [];
    const originalIndices: Array<number> = [];
    this.playerinput.options.forEach((option, i) => {
      // Match legacy OrOptions: hide learner-mode-only card options unless the
      // learner_mode preference is on.
      if (option.type === 'card' && option.showOnlyInLearnerMode !== false && !getPreferences().learner_mode) {
        return;
      }
      displayedOptions.push(option);
      originalIndices.push(i);
    });
    return {
      displayedOptions,
      originalIndices,
      expandedIdx: -1,
      pendingSpacePrompt: undefined,
      pendingOptionIndex: undefined,
    };
  },
  beforeUnmount() {
    // Server resolved this prompt (modal unmounts) — never leave picker-mode
    // stuck on the parent modal.
    this.setPickerMode(false);
  },
  computed: {
    titleText(): string {
      return optionTitleText(this.playerinput.title);
    },
    warningText(): string {
      return optionTitleText(this.playerinput.warning);
    },
  },
  methods: {
    optionTitle(opt: PlayerInputModel): string {
      return optionTitleText(opt.title);
    },
    optionKind(opt: PlayerInputModel): 'option' | 'space' | 'nested' {
      if (opt.type === 'option') {
        return 'option';
      }
      if (opt.type === 'space') {
        return 'space';
      }
      return 'nested';
    },
    optionWarnings(opt: PlayerInputModel): ReadonlyArray<Warning> | undefined {
      if (opt.type === 'option' && opt.warnings !== undefined && opt.warnings.length > 0) {
        return opt.warnings;
      }
      return undefined;
    },
    isPendingSpace(displayedIdx: number): boolean {
      return this.pendingSpacePrompt !== undefined &&
        this.pendingOptionIndex === this.originalIndices[displayedIdx];
    },
    pickOption(displayedIdx: number): void {
      const opt = this.displayedOptions[displayedIdx];
      const orig = this.originalIndices[displayedIdx];
      // Switching options cancels any in-progress board picker.
      this.clearSpacePicker();
      if (opt.type === 'option') {
        this.onsave({type: 'or', index: orig, response: {type: 'option'}});
        return;
      }
      if (opt.type === 'space') {
        this.pendingOptionIndex = orig;
        this.pendingSpacePrompt = opt as SelectSpaceModel;
        this.expandedIdx = -1;
        this.setPickerMode(true, opt.title);
        return;
      }
      // Complex nested input — expand a wizard step.
      this.expandedIdx = displayedIdx;
    },
    collapse(): void {
      this.expandedIdx = -1;
    },
    clearSpacePicker(): void {
      if (this.pendingSpacePrompt !== undefined) {
        this.pendingSpacePrompt = undefined;
        this.pendingOptionIndex = undefined;
        this.setPickerMode(false);
      }
    },
    nestedSave(out: InputResponse): void {
      if (this.expandedIdx === -1) {
        return;
      }
      this.onsave({
        type: 'or',
        index: this.originalIndices[this.expandedIdx],
        response: out,
      });
    },
    onSpacePicked(spaceResponse: SelectSpaceResponse): void {
      if (this.pendingOptionIndex === undefined) {
        return;
      }
      this.onsave({
        type: 'or',
        index: this.pendingOptionIndex,
        response: spaceResponse,
      });
      // Don't clear local state — the server response replaces the playerView
      // and this component unmounts naturally.
    },
    setPickerMode(active: boolean, title?: string | Message): void {
      const setter = (this as unknown as {[k: string]: PickerModeSetter | undefined})[MANDATORY_MODAL_PICKER_SETTER];
      if (typeof setter === 'function') {
        setter(active, title);
      }
    },
  },
});
</script>
