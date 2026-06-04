<template>
  <!--
    Premium replacement for the legacy OrOptions radio stack, hosted inside
    MandatoryInputModal (via ModalInputHost). Renders the options as premium
    glass CHOICE CARDS (not a radio list):

      - SelectOption (type 'option')  → click SELECTS the card (accent + ✓); a
                                         ПОДТВЕРДИТЬ button commits. Nothing is
                                         sent to the server until confirmed.
      - SelectSpace  (type 'space')   → click arms board picker-mode (modal
                                         fades, PlacementBanner shows) — board
                                         click commits. Same mechanism as WGT.
      - anything else (player / amount / card / nested or…) → click expands a
                                         wizard step hosting the nested input via
                                         ModalInputHost.

    Player-target options (the title carries a PLAYER token, e.g. "Remove 6
    plants from Nastya") get that player's COLOUR as the card accent + a colour
    dot, read straight from the Message data — no string matching.

    Submission is byte-identical to OrOptions.vue:
      {type: 'or', index: <ORIGINAL index>, response: <nested InputResponse>}
  -->
  <div class="modal-input modal-input--options">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div v-if="warningText !== ''" class="modal-input__warning">{{ warningText }}</div>

    <!-- Collapsed view: the choice cards. -->
    <div v-if="expandedIdx === -1" class="modal-input__options">
      <button v-for="(opt, i) in displayedOptions"
              :key="i"
              type="button"
              class="modal-input__option-card"
              :class="[
                'modal-input__option-card--' + optionKind(opt),
                {
                  'modal-input__option-card--selected': selectedIdx === i,
                  'modal-input__option-card--armed': isPendingSpace(i),
                  'modal-input__option-card--player': optionColor(opt) !== undefined,
                  'modal-input__option-card--warn': optionWarnings(opt) !== undefined,
                },
              ]"
              @click="pickOption(i)"
              :data-test="'modern-option-' + i">
        <span class="modal-input__option-accent"
              :class="optionColor(opt) !== undefined ? ('player_bg_color_' + optionColor(opt)) : ''"
              aria-hidden="true"></span>
        <span v-if="optionColor(opt) !== undefined"
              class="modal-input__option-dot"
              :class="'player_bg_color_' + optionColor(opt)"
              aria-hidden="true"></span>
        <span class="modal-input__option-body">
          <span class="modal-input__option-label">{{ optionTitle(opt) }}</span>
          <span v-if="optionWarnings(opt) !== undefined" class="modal-input__option-warn-chip">
            <span class="modal-input__option-warn-icon" aria-hidden="true">⚠</span>
            <warnings-component :warnings="optionWarnings(opt)"
                                class="modal-input__option-warnings"></warnings-component>
          </span>
        </span>
        <span v-if="optionKind(opt) === 'space'" class="modal-input__option-hint" v-i18n>on the board</span>
        <span v-else-if="optionKind(opt) === 'nested'" class="modal-input__option-chevron" aria-hidden="true">›</span>
        <span v-else-if="selectedIdx === i" class="modal-input__option-check" aria-hidden="true">✓</span>
      </button>
    </div>

    <!-- Confirm bar — only for a SELECTED leaf option (select → confirm flow).
         Space / nested options act on click and never reach here. -->
    <div v-if="expandedIdx === -1 && confirmableSelection" class="modal-input__actions">
      <button type="button"
              class="modal-input__primary-btn"
              @click="confirmSelectedOption"
              data-test="modern-option-confirm">
        {{ confirmLabel }}
      </button>
    </div>

    <!-- Expanded view: a single nested input (wizard step). Explicit v-if (NOT
         v-else) so the confirm bar's v-if above doesn't capture the else. -->
    <div v-if="expandedIdx !== -1" class="modal-input__nested">
      <button type="button" class="modal-input__back-btn" @click="collapse" data-test="modern-option-back">
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
import {OrOptionsModel, PlayerInputModel, SelectSpaceModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {InputResponse, OrOptionsResponse, SelectSpaceResponse} from '@/common/inputs/InputResponse';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Color} from '@/common/Color';
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
  // Displayed index of the option whose nested input is expanded, or -1.
  expandedIdx: number;
  // Displayed index of the currently SELECTED leaf option (select → confirm),
  // or -1 when none is selected.
  selectedIdx: number;
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
      selectedIdx: -1,
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
    confirmableSelection(): boolean {
      return this.selectedIdx !== -1 && this.displayedOptions[this.selectedIdx]?.type === 'option';
    },
    confirmLabel(): string {
      const opt = this.selectedIdx === -1 ? undefined : this.displayedOptions[this.selectedIdx];
      const label = (opt as SelectOptionModel | undefined)?.buttonLabel;
      return label !== undefined && label !== '' ? translateText(label) : translateText('Confirm');
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
    // Player colour for an option whose title carries a PLAYER token (e.g.
    // "Remove 6 plants from Nastya"). Read straight from the Message data — the
    // PLAYER token's value IS the colour — so no fragile name matching.
    optionColor(opt: PlayerInputModel): Color | undefined {
      const t = opt.title;
      if (t === undefined || typeof t === 'string' || t.data === undefined) {
        return undefined;
      }
      const token = t.data.find((d) => d?.type === LogMessageDataType.PLAYER);
      return token?.value as Color | undefined;
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
        // Select (don't commit) — the confirm bar sends it.
        this.selectedIdx = displayedIdx;
        return;
      }
      // A non-leaf interaction clears any leaf selection.
      this.selectedIdx = -1;
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
    confirmSelectedOption(): void {
      if (!this.confirmableSelection) {
        return;
      }
      this.onsave({
        type: 'or',
        index: this.originalIndices[this.selectedIdx],
        response: {type: 'option'},
      });
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
