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
  <div class="modal-input modal-input--options"
       :class="{'modal-input--wide-nested': expandedIsWide}">
    <header v-if="!hideHeader" class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div v-if="warningText !== ''" class="modal-input__warning">{{ warningText }}</div>

    <!-- Collapsed view: the real choice cards (skip / "do nothing" options are
         pulled OUT into a separate neutral block below, so a safe fallback never
         sits BETWEEN two real targets). Each card lives in a SLOT so a RISKY option
         (confirmRisky mode) can attach an inline confirm drawer BELOW it without
         nesting buttons. -->
    <div v-if="expandedIdx === -1" class="modal-input__options">
      <div v-for="e in primaryEntries"
           :key="e.i"
           class="modal-input__option-slot"
           :class="{'modal-input__option-slot--confirming': armedIdx === e.i}"
           @keydown.esc="disarm">
        <button type="button"
                class="modal-input__option-card"
                :class="[
                  'modal-input__option-card--' + optionKind(e.opt),
                  {
                    'modal-input__option-card--selected': selectedIdx === e.i,
                    'modal-input__option-card--armed': isPendingSpace(e.i),
                    'modal-input__option-card--confirming': armedIdx === e.i,
                    'modal-input__option-card--risky': isArmableRisky(e.opt),
                    'modal-input__option-card--player': optionColor(e.opt) !== undefined,
                    'modal-input__option-card--warn': optionWarnings(e.opt) !== undefined,
                  },
                ]"
                @click="pickOption(e.i)"
                :data-test="'modern-option-' + e.i">
          <span class="modal-input__option-accent"
                :class="optionColor(e.opt) !== undefined ? ('player_bg_color_' + optionColor(e.opt)) : ''"
                aria-hidden="true"></span>

          <!-- Lead: player chip (colour dot + name) for player-target options,
               else a resource/parameter icon when the metadata supplies one. -->
          <span v-if="optionColor(e.opt) !== undefined" class="modal-input__option-lead modal-input__option-player">
            <span class="modal-input__option-dot" :class="'player_bg_color_' + optionColor(e.opt)" aria-hidden="true"></span>
            <span v-if="optionPlayerName(e.opt) !== ''" class="modal-input__option-player-name">{{ optionPlayerName(e.opt) }}</span>
          </span>
          <span v-else-if="optionIcon(e.opt) !== ''"
                class="modal-input__option-lead modal-input__option-icon"
                :class="optionIconClass(e.opt)"
                aria-hidden="true"></span>

          <span class="modal-input__option-body">
            <span class="modal-input__option-label">{{ optionActionText(e.opt) }}</span>
            <!-- Optional clarifying sub-line (what the option means). -->
            <span v-if="optionDescription(e.opt) !== ''" class="modal-input__option-desc">{{ optionDescription(e.opt) }}</span>
            <!-- Premium result/cost chips (e.g. "+3 TR", "−2 microbes") — reuse the
                 shared ActionEffectChip so they match the action-confirm modal. -->
            <span v-if="optionEffects(e.opt).length > 0" class="modal-input__option-effects">
              <ActionEffectChip v-for="(eff, ei) in optionEffects(e.opt)" :key="ei" :effect="eff" />
            </span>
            <!-- A non-numeric downside / tradeoff of the option (e.g. "card turned
                 face down"), shown as an amber warning so the price is never hidden. -->
            <span v-if="optionTradeoff(e.opt) !== ''" class="modal-input__option-tradeoff">
              <span class="modal-input__option-tradeoff-icon" aria-hidden="true">⚠</span>
              <span class="modal-input__option-tradeoff-text">{{ optionTradeoff(e.opt) }}</span>
            </span>
            <span v-if="optionWarnings(e.opt) !== undefined" class="modal-input__option-warn-chip">
              <span class="modal-input__option-warn-icon" aria-hidden="true">⚠</span>
              <warnings-component :warnings="optionWarnings(e.opt)"
                                  class="modal-input__option-warnings"></warnings-component>
            </span>
          </span>

          <!-- Impact preview. SERVER-computed rows first (correct for a MarsBot —
               it loses M€, shown with the M€ icon), then the single-value
               fallback for options without server changes. -->
          <span v-if="optionChanges(e.opt).length > 0" class="modal-input__option-preview modal-input__option-preview--multi" aria-hidden="true">
            <span v-for="(row, ri) in optionChanges(e.opt)" :key="ri" class="modal-input__option-preview-line">
              <span class="modal-input__option-icon" :class="rowIconClass(row)"></span>
              <span class="modal-input__option-preview-from">{{ row.from }}</span>
              <span class="modal-input__option-preview-arrow">→</span>
              <span class="modal-input__option-preview-to">{{ row.to }}</span>
            </span>
          </span>
          <span v-else-if="hasPreview(e.opt)" class="modal-input__option-preview" aria-hidden="true">
            <span v-if="optionIcon(e.opt) !== ''" class="modal-input__option-icon" :class="optionIconClass(e.opt)"></span>
            <span class="modal-input__option-preview-from">{{ previewFrom(e.opt) }}</span>
            <span class="modal-input__option-preview-arrow">→</span>
            <span class="modal-input__option-preview-to">{{ previewTo(e.opt) }}</span>
          </span>
          <span v-else-if="optionKind(e.opt) === 'space'" class="modal-input__option-hint" v-i18n>on the board</span>
          <span v-else-if="optionKind(e.opt) === 'nested'" class="modal-input__option-chevron" aria-hidden="true">›</span>
          <!-- Selection-indicator slot — a FIXED-width slot RESERVED on every leaf
               option (even unselected, where it's empty) so revealing the ✓ never
               shifts the preview chip (`869 → 862`) left: the indicators stay
               aligned across options. In controlled mode (no inner confirm button)
               the ✓ + the --selected frame ARE the confirmation the pick registered.
               A RISKY armable option shows a small ⚠ "needs confirm" glyph instead. -->
          <span v-if="optionKind(e.opt) === 'option'" class="modal-input__option-mark" aria-hidden="true">
            <span v-if="armedIdx === e.i" class="modal-input__option-arm-glyph">⚠</span>
            <span v-else-if="selectedIdx === e.i" class="modal-input__option-check modal-input__option-check--selected">✓</span>
            <span v-else-if="isArmableRisky(e.opt)" class="modal-input__option-arm-glyph modal-input__option-arm-glyph--idle">⚠</span>
          </span>
        </button>

        <!-- Inline confirm drawer — only for an ARMED risky option (confirmRisky
             mode). The choice is irreversible / has a hidden tradeoff, so the first
             click ARMS this drawer instead of committing; the player confirms
             deliberately. Real buttons (a SIBLING of the card, never nested) so it's
             valid HTML + keyboard-accessible. Safe options never reach here — they
             commit one-click. -->
        <transition name="modal-input-confirm">
          <div v-if="armedIdx === e.i" class="modal-input__option-confirm" data-test="modern-option-confirm-drawer">
            <span class="modal-input__option-confirm-q">
              <span class="modal-input__option-confirm-glyph" aria-hidden="true">⚠</span>
              <span v-i18n>Confirm this choice?</span>
            </span>
            <span class="modal-input__option-confirm-actions">
              <button type="button"
                      class="modal-input__option-confirm-no"
                      @click.stop="disarm"
                      :data-test="'modern-option-cancel-' + e.i">
                <span v-i18n>Cancel</span>
              </button>
              <button type="button"
                      class="modal-input__option-confirm-yes"
                      @click.stop="confirmArmed"
                      :data-test="'modern-option-confirm-' + e.i">
                <span v-i18n>Confirm</span>
              </button>
            </span>
          </div>
        </transition>
      </div>
    </div>

    <!-- Informational, non-selectable targets the server flagged as unavailable
         (e.g. an opponent with no plants), each with a reason. -->
    <div v-if="expandedIdx === -1 && disabledOptions.length > 0" class="modal-input__disabled-options">
      <span class="modal-input__disabled-head" v-i18n>Unavailable targets</span>
      <div v-for="(d, di) in disabledOptions"
           :key="'disabled-' + di"
           class="modal-input__option-card modal-input__option-card--unavailable"
           :data-test="'modern-option-disabled-' + di">
        <span class="modal-input__option-accent"
              :class="disabledColor(d) !== undefined ? ('player_bg_color_' + disabledColor(d)) : ''"
              aria-hidden="true"></span>
        <span v-if="disabledColor(d) !== undefined" class="modal-input__option-lead modal-input__option-player">
          <span class="modal-input__option-dot" :class="'player_bg_color_' + disabledColor(d)" aria-hidden="true"></span>
          <span v-if="disabledName(d) !== ''" class="modal-input__option-player-name">{{ disabledName(d) }}</span>
        </span>
        <span v-else-if="disabledIconClass(d) !== ''"
              class="modal-input__option-lead modal-input__option-icon"
              :class="disabledIconClass(d)"
              aria-hidden="true"></span>
        <span class="modal-input__option-body">
          <span v-if="disabledColor(d) === undefined" class="modal-input__option-label">{{ disabledTitle(d) }}</span>
          <span class="modal-input__option-disabled-reason">{{ disabledReason(d) }}</span>
        </span>
      </div>
    </div>

    <!-- Neutral / SAFE fallback ("Do not remove plants", "Do nothing"). Pulled
         out of the target list into its own block at the bottom + a distinct calm
         look, so it never reads as just another target sitting in the middle. -->
    <div v-if="expandedIdx === -1 && skipEntries.length > 0" class="modal-input__skip-options">
      <button v-for="e in skipEntries"
              :key="'skip-' + e.i"
              type="button"
              class="modal-input__option-card modal-input__option-card--skip"
              :class="{'modal-input__option-card--selected': selectedIdx === e.i}"
              @click="pickOption(e.i)"
              :data-test="'modern-option-' + e.i">
        <span class="modal-input__option-skip-glyph" aria-hidden="true">⊘</span>
        <span class="modal-input__option-body">
          <span class="modal-input__option-label">{{ optionActionText(e.opt) }}</span>
        </span>
        <span v-if="selectedIdx === e.i" class="modal-input__option-check modal-input__option-check--selected" aria-hidden="true">✓</span>
      </button>
    </div>

    <!-- Confirm bar — only for a SELECTED leaf option (select → confirm flow).
         Space / nested options act on click and never reach here. HIDDEN in
         controlled mode: the parent modal's own button is the final submit, so an
         inner confirm button (the bug this addresses) would be redundant. -->
    <div v-if="expandedIdx === -1 && confirmableSelection && !controlled" class="modal-input__actions">
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
      <!-- A lone auto-expanded option has no list to go back to → hide the Back. -->
      <button v-if="!autoExpandedSingle" type="button" class="modal-input__back-btn" @click="collapse" data-test="modern-option-back">
        <span class="modal-input__back-glyph">‹</span>
        <span v-i18n>Back to options</span>
      </button>
      <!--
        The nested-label echoes the expanded option's own title. Premium
        components that render their OWN header (CardSelectionContent shows the
        SelectCard title) would duplicate it, so hide the label for those
        (`expandedIsWide`). Compact inputs without a header keep it for context.
      -->
      <div v-if="!expandedIsWide" class="modal-input__nested-label">{{ optionTitle(displayedOptions[expandedIdx]) }}</div>
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
import {DisabledOptionModel, OrOptionsModel, PlayerInputModel, SelectSpaceModel, SelectOptionModel, OptionMetadata} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';
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
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {enterClientHandSelect} from '@/client/components/handCards/handSelectState';

type PickerModeSetter = (mode: boolean, title?: string | Message) => void;

type DataModel = {
  displayedOptions: Array<PlayerInputModel>;
  originalIndices: Array<number>;
  // Displayed index of the option whose nested input is expanded, or -1.
  expandedIdx: number;
  // True when the lone nested option was auto-expanded on mount — hides the
  // pointless "Back to options" (there is no list to go back to).
  autoExpandedSingle: boolean;
  // Displayed index of the currently SELECTED leaf option (select → confirm),
  // or -1 when none is selected.
  selectedIdx: number;
  // Displayed index of the currently ARMED risky option (its inline confirm drawer
  // is open, awaiting a deliberate Confirm), or -1. Only used in confirmRisky mode.
  armedIdx: number;
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
    ActionEffectChip,
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
    // CONTROLLED mode — used when this picker is hosted as a STEP inside a larger
    // modal (the card-play / action-confirm modals) whose OWN main button does the
    // final submit. In controlled mode a leaf option commits IMMEDIATELY on click
    // (captured by the parent via `onsave`) and the redundant inner confirm bar is
    // hidden; the chosen option is shown via the normal --selected highlight + ✓.
    // Default false → the standalone select→confirm flow (WGT, top-level prompts).
    controlled: {
      type: Boolean,
      default: false,
    },
    // Suppress this component's OWN title header — used when it's WRAPPED by a
    // premium contextual frame (ContextualChoiceContent) that renders the source /
    // trigger / instruction above the option list, so the bare "Select one option"
    // title would be redundant. Default false → standalone keeps its header.
    hideHeader: {
      type: Boolean,
      default: false,
    },
    // Opt-in inline-confirm for RISKY options (only meaningful WITH `controlled`).
    // In plain controlled mode every leaf option commits on the first click (the
    // one-click flow). When `confirmRisky` is on, an option the server flagged as
    // risky — it carries a non-numeric `tradeoff` (e.g. "card turned face down")
    // or `warnings` — instead ARMS an inline Confirm/Cancel drawer on the first
    // click, so an irreversible choice is never a single mis-click. SAFE options
    // still commit one-click. Used by the CONTEXTUAL triggered-effect modal so the
    // standard case is fast while a dangerous option stays deliberate.
    confirmRisky: {
      type: Boolean,
      default: false,
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
    // AUTO-EXPAND a lone NESTED option: an OrOptions with a single option that
    // is itself an input (amount / player / card target / nested or) skips the
    // redundant one-row "pick the only option" list and opens the wizard step
    // directly — the bare single-chevron modal was pure friction. Exceptions:
    // a leaf 'option' keeps its explicit confirm, a 'space' option keeps the
    // explicit "arm the board picker" click, and a hand-card pick stays manual
    // (it opens a full overlay — that hand-off shouldn't fire on mount).
    let expandedIdx = -1;
    let autoExpandedSingle = false;
    if (displayedOptions.length === 1) {
      const only = displayedOptions[0];
      const isNested = only.type !== 'option' && only.type !== 'space';
      let isHandPick = false;
      if (only.type === 'card') {
        const hand = new Set((this.playerView.cardsInHand ?? []).map((c) => c.name));
        const all = [...(only as SelectCardModel).cards, ...((only as SelectCardModel).disabledCards ?? [])];
        isHandPick = all.length > 0 && all.every((c) => hand.has(c.name));
      }
      if (isNested && !isHandPick) {
        expandedIdx = 0;
        autoExpandedSingle = true;
      }
    }
    return {
      displayedOptions,
      originalIndices,
      expandedIdx,
      autoExpandedSingle,
      selectedIdx: -1,
      armedIdx: -1,
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
    disabledOptions(): ReadonlyArray<DisabledOptionModel> {
      return this.playerinput.disabledOptions ?? [];
    },
    // Every shown option paired with its DISPLAYED index (the index pickOption /
    // selectedIdx / data-test all key off — preserved when we split the list).
    optionEntries(): ReadonlyArray<{opt: PlayerInputModel, i: number}> {
      return this.displayedOptions.map((opt, i) => ({opt, i}));
    },
    // Real, actionable choices (targets / space / nested) — skip options excluded.
    primaryEntries(): ReadonlyArray<{opt: PlayerInputModel, i: number}> {
      return this.optionEntries.filter((e) => !this.isSkipOption(e.opt));
    },
    // The neutral "do nothing / don't remove" fallback(s), rendered separately.
    skipEntries(): ReadonlyArray<{opt: PlayerInputModel, i: number}> {
      return this.optionEntries.filter((e) => this.isSkipOption(e.opt));
    },
    // True when the expanded wizard step hosts a "wide" premium input that
    // renders its own header + sizes itself to the viewport (currently the card
    // grid). Drives two things: drop the redundant nested-label, and let the
    // host `.modal-input` shed its 720px max-width cap so the grid isn't squeezed.
    expandedIsWide(): boolean {
      if (this.expandedIdx === -1) {
        return false;
      }
      return this.displayedOptions[this.expandedIdx]?.type === 'card';
    },
  },
  methods: {
    // A skip / neutral-safe option, flagged by the server via metadata.kind.
    isSkipOption(opt: PlayerInputModel): boolean {
      return this.optionMeta(opt)?.kind === 'skip';
    },
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
    // The option's structured UI metadata (premium render), or undefined.
    optionMeta(opt: PlayerInputModel): OptionMetadata | undefined {
      return opt.type === 'option' ? (opt as SelectOptionModel).metadata : undefined;
    },
    // Premium result/cost chips attached to this option (e.g. "+3 TR"), or [].
    optionEffects(opt: PlayerInputModel): ReadonlyArray<ActionEffect> {
      return this.optionMeta(opt)?.effects ?? [];
    },
    // A non-numeric downside/tradeoff line (translated), or '' when none.
    optionTradeoff(opt: PlayerInputModel): string {
      const t = this.optionMeta(opt)?.tradeoff;
      return t === undefined ? '' : optionTitleText(t);
    },
    // A clarifying sub-description (translated), or '' when none.
    optionDescription(opt: PlayerInputModel): string {
      const d = this.optionMeta(opt)?.description;
      return d === undefined ? '' : optionTitleText(d);
    },
    // ----- informational disabled (non-selectable) targets -----
    disabledColor(d: DisabledOptionModel): Color | undefined {
      return d.metadata?.player?.color;
    },
    disabledName(d: DisabledOptionModel): string {
      const color = this.disabledColor(d);
      if (color === undefined) {
        return '';
      }
      const p = (this.playerView.players ?? []).find((pp) => pp.color === color);
      return p?.name ?? '';
    },
    disabledIconClass(d: DisabledOptionModel): string {
      return iconClassFor(d.metadata?.icon);
    },
    disabledTitle(d: DisabledOptionModel): string {
      return optionTitleText(d.title);
    },
    disabledReason(d: DisabledOptionModel): string {
      return optionTitleText(d.reason);
    },
    // Player colour for a player-target option. Prefer the explicit metadata
    // colour; fall back to a PLAYER token in the title Message (the token's
    // value IS the colour) so options without metadata still get the accent.
    optionColor(opt: PlayerInputModel): Color | undefined {
      const meta = this.optionMeta(opt);
      if (meta?.player !== undefined) {
        return meta.player.color;
      }
      const t = opt.title;
      if (t === undefined || typeof t === 'string' || t.data === undefined) {
        return undefined;
      }
      const token = t.data.find((d) => d?.type === LogMessageDataType.PLAYER);
      return token?.value as Color | undefined;
    },
    optionPlayerName(opt: PlayerInputModel): string {
      const color = this.optionColor(opt);
      if (color === undefined) {
        return '';
      }
      const p = this.playerView.players.find((pp) => pp.color === color);
      return p?.name ?? '';
    },
    // Resource/parameter icon key from metadata (e.g. 'plants', 'megacredits',
    // 'temperature'); '' when none.
    optionIcon(opt: PlayerInputModel): string {
      return this.optionMeta(opt)?.icon ?? '';
    },
    optionIconClass(opt: PlayerInputModel): string {
      return iconClassFor(this.optionIcon(opt));
    },
    // SERVER-computed per-target changes (the actual before→after — a MarsBot
    // loses M€, not the named resource). Present for remove/steal options; the
    // client renders these verbatim instead of the single current/resulting.
    optionChanges(opt: PlayerInputModel): ReadonlyArray<TargetImpactChange> {
      return this.optionMeta(opt)?.player?.changes ?? [];
    },
    rowIconClass(row: TargetImpactChange): string {
      return iconClassFor(row.icon);
    },
    // Main action text. For a player-target option the player + amount live in
    // the chip + preview, so the action verb (the buttonLabel — "Remove plants")
    // reads cleaner than the full sentence; otherwise the descriptive title.
    optionActionText(opt: PlayerInputModel): string {
      const meta = this.optionMeta(opt);
      if (meta?.player !== undefined && opt.type === 'option') {
        const label = (opt as SelectOptionModel).buttonLabel;
        if (label !== undefined && label !== '') {
          return translateText(label);
        }
      }
      return this.optionTitle(opt);
    },
    hasPreview(opt: PlayerInputModel): boolean {
      const meta = this.optionMeta(opt);
      return (meta?.player?.current !== undefined && meta?.player?.resulting !== undefined) ||
             (meta?.global?.current !== undefined && meta?.global?.resulting !== undefined);
    },
    previewFrom(opt: PlayerInputModel): string {
      const meta = this.optionMeta(opt);
      if (meta?.player?.current !== undefined) {
        return String(meta.player.current);
      }
      if (meta?.global?.current !== undefined) {
        return String(meta.global.current) + (meta.global.unit ?? '');
      }
      return '';
    },
    previewTo(opt: PlayerInputModel): string {
      const meta = this.optionMeta(opt);
      if (meta?.player?.resulting !== undefined) {
        return String(meta.player.resulting);
      }
      if (meta?.global?.resulting !== undefined) {
        return String(meta.global.resulting) + (meta.global.unit ?? '');
      }
      return '';
    },
    isPendingSpace(displayedIdx: number): boolean {
      return this.pendingSpacePrompt !== undefined &&
        this.pendingOptionIndex === this.originalIndices[displayedIdx];
    },
    // A leaf option that must ask before committing in confirmRisky mode: it carries
    // a non-numeric tradeoff (irreversible side-effect) or warnings. Safe options
    // (a plain gain, "do nothing") are NOT armable → they commit one-click.
    isArmableRisky(opt: PlayerInputModel): boolean {
      if (!this.confirmRisky || opt.type !== 'option') {
        return false;
      }
      if (this.optionMeta(opt)?.tradeoff !== undefined) {
        return true;
      }
      const w = this.optionWarnings(opt);
      return w !== undefined && w.length > 0;
    },
    pickOption(displayedIdx: number): void {
      const opt = this.displayedOptions[displayedIdx];
      const orig = this.originalIndices[displayedIdx];
      // Switching options cancels any in-progress board picker.
      this.clearSpacePicker();
      if (opt.type === 'option') {
        // Risky option (confirmRisky mode): the first click ARMS the inline confirm
        // drawer; a second click on the same card (or the drawer's Confirm) commits.
        // Never a single mis-click on an irreversible choice.
        if (this.isArmableRisky(opt)) {
          if (this.armedIdx === displayedIdx) {
            this.emitOption(displayedIdx);
            return;
          }
          this.armedIdx = displayedIdx;
          this.selectedIdx = -1;
          return;
        }
        this.armedIdx = -1;
        this.selectedIdx = displayedIdx;
        // Controlled (hosted as a step / a one-click contextual modal) → commit
        // immediately. Standalone select→confirm → wait for the confirm bar.
        if (this.controlled) {
          this.emitOption(displayedIdx);
        }
        return;
      }
      // A non-leaf interaction clears any leaf selection / arming.
      this.armedIdx = -1;
      this.selectedIdx = -1;
      if (opt.type === 'space') {
        this.pendingOptionIndex = orig;
        this.pendingSpacePrompt = opt as SelectSpaceModel;
        this.expandedIdx = -1;
        this.setPickerMode(true, opt.title);
        return;
      }
      // A nested "pick a card FROM HAND" SelectCard (Mars University "discard a
      // card to draw") goes to the roomy КАРТЫ В РУКЕ overlay — NOT a cramped
      // in-wizard grid. The picked card resolves back through `onsave` wrapped in
      // this OR. Other card picks (add-resource targets = PLAYED cards) expand
      // inline as before.
      if (opt.type === 'card' && this.isHandCardOption(opt as SelectCardModel)) {
        this.startHandPick(opt as SelectCardModel, orig);
        return;
      }
      // Complex nested input — expand a wizard step.
      this.expandedIdx = displayedIdx;
    },
    // True when every candidate of a SelectCard (selectable + disabled) is in the
    // viewer's hand → it's a "pick from hand" prompt.
    isHandCardOption(opt: SelectCardModel): boolean {
      const hand = new Set((this.playerView.cardsInHand ?? []).map((c) => c.name));
      const all = [...opt.cards, ...(opt.disabledCards ?? [])];
      return all.length > 0 && all.every((c) => hand.has(c.name));
    },
    // Hand off a hand-card pick to the КАРТЫ В РУКЕ overlay (client-pick mode).
    // PlayerHome opens the overlay + suppresses this modal; the picked card
    // resolves back here as the OR-wrapped response.
    startHandPick(opt: SelectCardModel, originalIndex: number): void {
      const reasons: Record<string, string> = {};
      for (const c of opt.disabledCards ?? []) {
        const r = c.disabledReason;
        reasons[c.name] = r === undefined ? '' : (typeof r === 'string' ? translateText(r) : translateMessage(r));
      }
      enterClientHandSelect({
        title: opt.title,
        buttonLabel: opt.buttonLabel,
        selectable: opt.cards.map((c) => c.name),
        reasons,
        onResolve: (cards) => {
          this.onsave({type: 'or', index: originalIndex, response: {type: 'card', cards: [...cards]}});
        },
      });
    },
    confirmSelectedOption(): void {
      if (!this.confirmableSelection) {
        return;
      }
      this.emitOption(this.selectedIdx);
    },
    // Commit the ARMED risky option (the inline confirm drawer's Confirm button).
    confirmArmed(): void {
      if (this.armedIdx === -1) {
        return;
      }
      this.emitOption(this.armedIdx);
    },
    // Close the inline confirm drawer without committing (Cancel / Esc / re-pick).
    disarm(): void {
      this.armedIdx = -1;
      this.selectedIdx = -1;
    },
    // Emit the OR-wrapped {type:'option'} response for a leaf option at the given
    // DISPLAYED index. Shared by the standalone confirm bar and the controlled
    // commit-on-click path.
    emitOption(displayedIdx: number): void {
      this.onsave({
        type: 'or',
        index: this.originalIndices[displayedIdx],
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
