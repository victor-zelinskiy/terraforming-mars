<template>
  <!--
    EFFECT DECISION — the console's ONE screen for an optional game decision.

    It replaces the context-less «Выберите вариант» list for prompts the adapter
    can represent honestly (`effectDecisionModel.buildEffectDecision`); anything
    it cannot, the ordinary task host keeps. Same submit / defer / hand-pick
    contract as the host, so the shell wires it identically.

    The layout answers four questions in reading order: WHAT KIND of decision
    (eyebrow), WHAT is being decided (headline), WHY it appeared (trigger), and
    WHAT each choice costs and gives (the action cards). The source card sits
    beside them — big enough to recognise, never big enough to dominate — and
    the whole panel sizes to its content, so a two-choice decision is a compact
    card and not a half-empty screen.
  -->
  <div class="con-decision con-ws" role="dialog" :aria-label="$t(vm.headlineKey)"
       data-motion-surface="effect-decision">
    <transition name="con-task-swap" mode="out-in">
      <div class="con-decision__panel" :key="panelKey" data-motion-panel>
        <header class="con-decision__head">
          <div class="con-decision__kicker">
            <span class="con-decision__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t(vm.eyebrowKey) }}</span>
          </div>
          <h2 class="con-decision__title">{{ $t(vm.headlineKey) }}</h2>
          <p v-if="triggerText !== ''" class="con-decision__trigger">{{ triggerText }}</p>
        </header>

        <div class="con-decision__main" :class="{'con-decision__main--sourceless': sourceCardName === undefined}">
          <!-- THE SOURCE. Rendered with the real premium card face — the player
               must recognise the same object they see everywhere else. Absent
               sources render NO column at all (never an empty placeholder). -->
          <div v-if="sourceCardName !== undefined" class="con-decision__source" ref="sourceCard">
            <div class="con-decision__source-label">{{ $t('Source') }}</div>
            <Card :card="{name: sourceCardName}" :key="sourceCardName" />
          </div>

          <div class="con-decision__actions">
            <div v-for="(action, i) in vm.actions" :key="action.key"
                 class="con-decision__action"
                 :class="{
                   'con-decision__action--focused': focusIdx === i,
                   'con-decision__action--decline': action.role === 'decline',
                   'con-decision__action--armed': focusIdx === i && armed,
                 }">
              <div class="con-decision__action-head">
                <span v-if="action.playerColor !== undefined" class="con-decision__action-seat">
                  <span :class="'con-status__dot player_bg_color_' + action.playerColor"></span>
                </span>
                <span class="con-decision__action-title">{{ labelOf(action) }}</span>
                <!-- Does this press RESOLVE, or open another screen? The old
                     list never said; a decision screen must. -->
                <span v-if="action.leadKey !== undefined" class="con-decision__action-go" aria-hidden="true">›</span>
                <GamepadGlyph v-if="focusIdx === i" control="confirm" class="con-decision__action-a" />
              </div>
              <div v-if="action.leadKey !== undefined" class="con-decision__action-lead">{{ $t(action.leadKey) }}</div>
              <div v-if="descriptionOf(action) !== ''" class="con-decision__action-desc">{{ descriptionOf(action) }}</div>
              <div v-if="action.chips.length > 0" class="con-decision__action-chips">
                <ActionEffectChip v-for="(chip, k) in action.chips" :key="k" :effect="chip" />
              </div>
              <div v-if="tradeoffOf(action) !== ''" class="con-decision__action-tradeoff">⚠ {{ tradeoffOf(action) }}</div>
            </div>

            <!-- Relevant targets the rules exclude: shown, with the reason,
                 never silently dropped — and never pressable. -->
            <div v-if="vm.unavailable.length > 0" class="con-decision__unavailable">
              <div class="con-decision__unavailable-title">{{ $t('Unavailable targets') }}</div>
              <div v-for="(u, i) in vm.unavailable" :key="'u' + i" class="con-decision__unavailable-row">
                <span v-if="u.playerColor !== undefined" :class="'con-status__dot player_bg_color_' + u.playerColor"></span>
                <span class="con-decision__unavailable-name">{{ textOf(u.title) }}</span>
                <span class="con-decision__unavailable-reason">{{ textOf(u.reason) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
/**
 * The decision SCREEN. It owns focus, the pad contract and the submit — and
 * nothing else: every judgement about what the prompt means was already made
 * by the pure adapter (`effectDecisionModel.ts`), so this file contains no
 * game logic and no text heuristics.
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {orOptionResponse} from '@/client/console/taskResponses';
import {
  decisionCommandKeys, decisionFocusStep, decisionPressIntent,
  EffectDecisionAction, EffectDecisionViewModel,
} from '@/client/console/effectDecision/effectDecisionModel';
import {effectDecisionState, rememberDecisionFocus} from '@/client/console/effectDecision/effectDecisionState';

function textOf(value: string | Message | undefined): string {
  if (value === undefined) {
    return '';
  }
  return typeof value === 'string' ? translateText(value) : translateMessage(value);
}

export default defineComponent({
  name: 'ConsoleEffectDecision',
  components: {Card, GamepadGlyph, ActionEffectChip},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    vm: {type: Object as PropType<EffectDecisionViewModel>, required: true},
  },
  emits: ['submit', 'defer', 'hand-pick'],
  data() {
    return {
      /** Restored on re-entry from an overlay, so B lands the player back on
       *  the very action card they opened. */
      focusIdx: 0,
      /** Guards a double A: the second press must not submit twice. */
      armed: false,
      submitting: false,
    };
  },
  computed: {
    /** A genuinely NEW prompt cross-fades the panel; a re-render does not. */
    panelKey(): string {
      return `${this.vm.eyebrowKey}|${this.vm.headlineKey}|${this.vm.actions.length}`;
    },
    sourceCardName(): CardName | undefined {
      return this.vm.source?.card;
    },
    triggerText(): string {
      return textOf(this.vm.trigger);
    },
    /** The pad contract this screen publishes to the shared command bar. The
     *  KEYS are derived in the pure model — this only picks the glyphs. */
    footCommands(): Array<ConsoleCommand> {
      const controls = ['dpad', 'confirm', 'secondary', 'back'] as const;
      return decisionCommandKeys(this.vm, this.focusIdx).map((label, i) => ({
        control: label === 'Minimize' ? 'back' : controls[Math.min(i, controls.length - 1)],
        label,
      }));
    },
  },
  watch: {
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        setPanelCommands('effectDecision', cmds);
      },
    },
    focusIdx(now: number): void {
      rememberDecisionFocus(now);
    },
  },
  mounted() {
    // Coming back from the hand overlay must land on the action that opened it,
    // not on the top of the list.
    const remembered = effectDecisionState.focusIdx;
    this.focusIdx = remembered < this.vm.actions.length ? remembered : 0;
  },
  beforeUnmount() {
    clearPanelCommands('effectDecision');
  },
  methods: {
    textOf,
    labelOf(action: EffectDecisionAction): string {
      return textOf(action.title);
    },
    descriptionOf(action: EffectDecisionAction): string {
      return textOf(action.description);
    },
    tradeoffOf(action: EffectDecisionAction): string {
      return textOf(action.tradeoff);
    },
    /**
     * The shell routes the pad here while this screen serves. WHAT a press
     * means is decided by the pure model (`decisionPressIntent`) — this only
     * carries it out, so the rules that matter (B is not a decline, a second A
     * cannot submit again) are guarded by a unit test rather than by a
     * component the client bundle cannot even mount in a spec.
     */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.focusIdx = decisionFocusStep(this.vm, this.focusIdx, intent.dir === 'down' || intent.dir === 'right' ? 1 : -1);
        this.armed = false;
        return;
      }
      const press = decisionPressIntent(this.vm, this.focusIdx, consoleActionOf(intent), this.submitting);
      if (press === undefined) {
        return;
      }
      switch (press.kind) {
      case 'defer':
        this.$emit('defer');
        return;
      case 'inspectSource':
        this.inspectSource(press.card);
        return;
      case 'handPick':
        rememberDecisionFocus(this.focusIdx);
        this.$emit('hand-pick', {
          index: press.action.optionIndex,
          cardPrompt: press.action.nested as SelectCardModel,
          source: this.vm.source,
        });
        return;
      case 'submit':
      default:
        rememberDecisionFocus(this.focusIdx);
        this.submitting = true;
        this.armed = true;
        this.$emit('submit', orOptionResponse(press.optionIndex));
      }
    },
    /** X — the source in the ordinary fullscreen viewer (never a private one).
     *  The screen stays mounted underneath, so focus and picks are exactly as
     *  the player left them when the viewer closes. */
    inspectSource(name: CardName): void {
      openConsoleCardZoom([{name}], 0, undefined, undefined, {
        origin: {
          kind: 'physical',
          resolve: () => (this.$refs.sourceCard as HTMLElement | undefined)
            ?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null,
        },
      });
    },
  },
});
</script>
