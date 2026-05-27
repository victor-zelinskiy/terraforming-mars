<template>
  <div class="wgt-modal">
    <header class="wgt-modal__header">
      <div class="wgt-modal__header-tab"></div>
      <h3 class="wgt-modal__title">{{ $t(playerinput.title) }}</h3>
    </header>

    <div class="wgt-modal__options">
      <button v-for="opt of options"
              :key="optionKey(opt)"
              class="wgt-modal__option-btn"
              :class="['wgt-modal__option-btn--' + optionKind(opt)]"
              @click="pickOption(opt)">
        <span class="wgt-modal__option-icon" :class="iconClass(opt)"></span>
        <span class="wgt-modal__option-label">{{ $t(opt.title) }}</span>
      </button>
    </div>

    <!--
      When the user picked a SelectSpace option ("Add an ocean" /
      "Remove an unprotected hazard"), the modal hides via picker-mode
      and we mount SelectSpace here so it can drive board interaction.
      It has no visible UI of its own (board tiles are highlighted
      directly via DOM); when the user clicks a tile, SelectSpace fires
      `onSpacePicked` which wraps the response in the outer OR payload
      and submits.
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
import {OrOptionsResponse, SelectSpaceResponse} from '@/common/inputs/InputResponse';
import {Message} from '@/common/logs/Message';
import {MANDATORY_MODAL_PICKER_SETTER} from '@/client/components/MandatoryInputModal.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';

// Map each option's English title to an icon class. The icons live in
// `cards.less` and elsewhere — we just compose the class name. The
// match-by-title approach is OK here because the WGT options are
// hardcoded server-side (Game.ts) with stable English strings; we don't
// have a typed annotation propagated to the client model for them.
const ICON_BY_TITLE: Record<string, string> = {
  'Increase temperature': 'wgt-icon wgt-icon--temperature',
  'Increase oxygen': 'wgt-icon wgt-icon--oxygen',
  'Add an ocean': 'wgt-icon wgt-icon--ocean',
  'Increase Venus scale': 'wgt-icon wgt-icon--venus',
  'Increase the Moon habitat rate': 'wgt-icon wgt-icon--moon-habitat',
  'Increase the Moon mining rate': 'wgt-icon wgt-icon--moon-mining',
  'Increase the Moon logistics rate': 'wgt-icon wgt-icon--moon-logistics',
  'Remove an unprotected hazard': 'wgt-icon wgt-icon--hazard',
};

function titleText(title: string | Message | undefined): string {
  if (title === undefined) return '';
  return typeof title === 'string' ? title : title.message;
}

type PickerModeSetter = (mode: boolean) => void;

type DataModel = {
  pendingSpacePrompt: SelectSpaceModel | undefined;
  pendingOptionIndex: number | undefined;
};

export default defineComponent({
  name: 'WorldGovernmentModalContent',
  components: {'select-space': SelectSpace},
  props: {
    // PlayerViewModel — matches the contract of nested SelectSpace.vue
    // which expects the narrower variant. At runtime the playerView
    // passed in from WaitingFor.vue is always a PlayerViewModel for
    // promptable players (the only case where waitingfor !== undefined),
    // so this is safe.
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
  // Injected from MandatoryInputModal (optional — defaults to undefined when
  // hosted outside a modal, which keeps the component safe to reuse).
  // Called with `true` when the user clicks a SelectSpace option so the
  // modal hides itself and the board becomes interactable.
  inject: {
    [MANDATORY_MODAL_PICKER_SETTER]: {
      from: MANDATORY_MODAL_PICKER_SETTER,
      default: undefined,
    },
  },
  data(): DataModel {
    return {
      pendingSpacePrompt: undefined,
      pendingOptionIndex: undefined,
    };
  },
  computed: {
    options(): ReadonlyArray<PlayerInputModel> {
      return this.playerinput.options;
    },
  },
  methods: {
    optionKey(opt: PlayerInputModel): string {
      return titleText(opt.title);
    },
    optionKind(opt: PlayerInputModel): string {
      // Tag for CSS styling — "space" options get a hint they'll trigger
      // a board picker; "option" options resolve immediately on click.
      return opt.type === 'space' ? 'space' : 'option';
    },
    iconClass(opt: PlayerInputModel): string {
      return ICON_BY_TITLE[titleText(opt.title)] ?? '';
    },
    pickOption(opt: PlayerInputModel): void {
      const idx = this.options.indexOf(opt);
      if (idx === -1) return;
      if (opt.type === 'option') {
        // SelectOption — commit instantly. Modal unmounts via WaitingFor's
        // `v-if` when the server response clears the WGT prompt.
        this.onsave({
          type: 'or',
          index: idx,
          response: {type: 'option'},
        });
        return;
      }
      if (opt.type === 'space') {
        // SelectSpace — switch to board-picker mode. Modal hides itself via
        // the injected picker-mode setter; SelectSpace mounts below and
        // takes over board interaction.
        this.pendingOptionIndex = idx;
        this.pendingSpacePrompt = opt as SelectSpaceModel;
        this.setPickerMode(true);
      }
    },
    onSpacePicked(spaceResponse: SelectSpaceResponse): void {
      if (this.pendingOptionIndex === undefined) return;
      this.onsave({
        type: 'or',
        index: this.pendingOptionIndex,
        response: spaceResponse,
      });
      // Don't clear local state — the server response replaces the whole
      // playerView and this component unmounts naturally. Clearing here
      // would race with the next render.
    },
    setPickerMode(active: boolean): void {
      const setter = (this as unknown as {[k: string]: PickerModeSetter | undefined})[MANDATORY_MODAL_PICKER_SETTER];
      if (typeof setter === 'function') {
        setter(active);
      }
    },
  },
  beforeUnmount() {
    // Component is going away (server resolved WGT) — make sure modal
    // picker-mode flag doesn't get stuck in `true` for the next modal.
    this.setPickerMode(false);
  },
});
</script>
