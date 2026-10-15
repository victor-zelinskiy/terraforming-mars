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

    HOST-AGNOSTIC (`embedded`): the very same instance is TELEPORTED into the
    outcome zone of the workspace whose press raised this decision — «Марсианский
    университет» answering the science tag the player just played from their
    hand. What the prop strips is exactly the standalone SHELL — the band, the
    `con-ws` rail marker, the surface-motion identity, the plate and the KICKER
    (handed UP to the workspace's breadcrumb instead, so the line reads «КАРТЫ В
    РУКЕ › ГАНИМЕД › ЭФФЕКТ» rather than a second title floating inside someone
    else's frame). Content, input path, submit contract and focus memory are
    untouched.
  -->
  <div class="con-decision"
       :class="{'con-ws': !embedded, 'con-decision--embedded': embedded}"
       :role="embedded ? 'group' : 'dialog'" :aria-label="$t(vm.headlineKey)"
       :data-motion-surface="embedded ? undefined : 'effect-decision'">
    <transition name="con-task-swap" mode="out-in">
      <!-- STANDALONE, the panel is a plate of the PROMPT-MODAL FAMILY (`console_prompt.less`) — its tone read off the
           prompt's structural markers, its size off the content (a FULL source card beside the actions is `l`). -->
      <div class="con-decision__panel" :key="panelKey" data-motion-panel
           :class="embedded ? '' : 'con-prompt con-prompt--' + promptSize + ' con-prompt--' + tone"
           :data-prompt-panel="embedded ? undefined : ''">
        <!-- STANDALONE: the family's ONE head — the tone's crest, emblem and tag, the eyebrow, «РЕШЕНИЕ N» for a
             follow-up of the same press, the headline with its decline plate, and why the decision appeared. -->
        <ConsolePromptHead v-if="!embedded" class="con-decision__head" :tone="tone" :kicker="$t(vm.eyebrowKey)"
                           :title="$t(vm.headlineKey)" :trigger="triggerText" :prompt-key="sequenceKey">
          <template v-if="vm.decline !== undefined" #decline>
            <ConsoleDeclinePlate class="con-decision__decline" :label="vm.decline.title" :forgone="vm.decline.forgone" />
          </template>
        </ConsolePromptHead>
        <!-- EMBEDDED: the kicker is the WORKSPACE'S crumb tail, published by `stagePhase` below — a surface that
             announces itself inside another's frame reads as a modal that arrived. -->
        <header v-else class="con-decision__head">
          <!-- THE QUESTION LINE: the headline, and a decline that is a BUTTON (RT) repeated as a plate where the eye
               already is — never one more card among the answers (a YES / NO keeps its two cards). -->
          <div class="con-decision__ask">
            <h2 class="con-decision__title con-ws-stage-title">{{ $t(vm.headlineKey) }}</h2>
            <ConsoleDeclinePlate v-if="vm.decline !== undefined" class="con-decision__decline"
                                 :label="vm.decline.title" :forgone="vm.decline.forgone" />
          </div>
          <!-- WHY this appeared stays in BOTH dresses: an embedded stage may
               never say less than the standalone surface it replaces, and
               «Вы разыграли научную метку» is the whole reason the question
               is on screen. -->
          <p v-if="triggerText !== ''" class="con-decision__trigger">{{ triggerText }}</p>
        </header>

        <div class="con-decision__main" :class="{'con-decision__main--sourceless': sourceCardName === undefined}">
          <!-- THE SOURCE — the SHARED dock (`console-source-dock`), the same
               component every other decision surface uses, so the player meets
               one answer to "who asked?" everywhere. NOT compact: here the card
               IS the subject of the decision. Absent sources render no column
               at all (never an empty placeholder). -->
          <console-source-dock v-if="sourceView !== undefined" class="con-decision__source"
                               :view="sourceView" ref="sourceCard" />

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
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleDeclinePlate from '@/client/components/console/foundation/ConsoleDeclinePlate.vue';
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
import {choiceSourceView, PromptSourceView} from '@/client/console/promptSource';
import {orOptionResponse} from '@/client/console/taskResponses';
import {
  decisionCommands, decisionFocusStep, decisionPressIntent, declineModelOf, nextStageKeyOf,
  EffectDecisionAction, EffectDecisionViewModel,
} from '@/client/console/effectDecision/effectDecisionModel';
import {effectDecisionState, rememberDecisionFocus} from '@/client/console/effectDecision/effectDecisionState';
import {setWorkspaceOutcomePhase, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import {PromptTone, promptCommitLabelKey, promptToneOf} from '@/client/console/promptTone';
import {promptSequenceKey} from '@/client/console/promptSequence';
import {promptIdentityKey} from '@/client/console/turnIntents';

function textOf(value: string | Message | undefined): string {
  if (value === undefined) {
    return '';
  }
  return typeof value === 'string' ? translateText(value) : translateMessage(value);
}

export default defineComponent({
  name: 'ConsoleEffectDecision',
  // `console-source-dock` is GLOBAL (main.ts) — see the note there.
  components: {GamepadGlyph, ActionEffectChip, ConsoleDeclinePlate, ConsolePromptHead},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    vm: {type: Object as PropType<EffectDecisionViewModel>, required: true},
    /** Hosted as a STEP of the workspace whose press raised this decision —
     *  the shell teleports THIS instance into that workspace's outcome zone. */
    embedded: {type: Boolean, default: false},
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
    /** The decision model already resolved WHO asks; normalize it into the one
     *  shape the shared dock speaks. */
    sourceView(): PromptSourceView | undefined {
      return choiceSourceView(this.vm.source);
    },
    sourceCardName(): CardName | undefined {
      return this.vm.source?.card;
    },
    triggerText(): string {
      return textOf(this.vm.trigger);
    },
    /** The crumb tail this stage hands UP while embedded ('' = not ours). */
    stagePhase(): string {
      return this.embedded ? this.vm.stageKey : '';
    },
    /** The decision's character (`promptTone.ts` — structural markers of the prompt this screen answers). */
    tone(): PromptTone {
      return promptToneOf(this.playerView.waitingFor).tone;
    },
    /** The decision's identity in the press's sequence (`promptSequence.ts`); '' while embedded (a stage, not a modal). */
    sequenceKey(): string {
      const wf = this.playerView.waitingFor;
      return this.embedded || wf === undefined ? '' : promptSequenceKey(wf, promptIdentityKey(wf));
    },
    /** The plate's SIZE tier: a FULL source card beside the actions is `l`; actions alone are `m`. */
    promptSize(): 'm' | 'l' {
      return this.sourceView !== undefined ? 'l' : 'm';
    },
    /** The pad contract this screen publishes to the shared command bar. The
     *  KEYS are derived in the pure model — this only picks the glyphs; the
     *  COMMIT (A on a leaf — «Подтвердить») speaks the decision's tone. */
    footCommands(): Array<ConsoleCommand> {
      const cmds = decisionCommands(this.vm, this.focusIdx);
      if (this.embedded || this.tone === 'neutral') {
        return cmds;
      }
      return cmds.map((cmd): ConsoleCommand => {
        if (cmd.control !== 'confirm' || cmd.label !== 'Confirm') {
          return cmd;
        }
        return this.tone === 'loss' ?
          {...cmd, label: promptCommitLabelKey('loss', cmd.label), tone: 'danger'} :
          {...cmd, highlight: cmd.enabled !== false};
      });
    },
  },
  watch: {
    /**
     * Every server response (root identity always changes) re-arms submission —
     * the same contract ConsoleTaskHost carries, and this screen was the one
     * decision surface without it. Two effect decisions routinely follow EACH
     * OTHER in one chain with nothing between them («Конференция на Олимпе»
     * answers the science tag, its «положить жетон» branch draws nothing, and
     * «Марсианский университет» asks in the very next response), so this
     * component never unmounts between the prompts — and a `submitting`
     * latched by the first answer then swallowed EVERY A on the second
     * decision: a visible «Сбросить карту» that answered nothing. `armed`
     * falls with it, so the fresh prompt never paints a pressed row.
     */
    playerView() {
      this.submitting = false;
      this.armed = false;
    },
    /**
     * A genuinely NEW decision must not inherit the previous one's cursor.
     * The shell already resets the MODULE memory (`resetDecisionFocus` on its
     * `effectDecisionKey` watcher — a parent's watcher, so it runs first in
     * the flush), but this instance seeds its own `focusIdx` only in
     * `mounted()` — and in a chained pair of decisions it never remounts, so
     * the second prompt opened with the first one's cursor (an ArrowDown
     * spent on «Олимп» landed the university's fresh question on its decline).
     */
    panelKey() {
      const remembered = effectDecisionState.focusIdx;
      this.focusIdx = remembered < this.vm.actions.length ? remembered : 0;
    },
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
    /**
     * Hand the STAGE NAME up to the hosting workspace's breadcrumb, exactly as
     * the task host and the drawn reveal do — so «КАРТЫ В РУКЕ › ГАНИМЕД ›
     * ЭФФЕКТ» is one continuous line instead of a detached «◈ ЭФФЕКТ КАРТЫ»
     * floating inside somebody else's frame.
     */
    stagePhase: {
      immediate: true,
      handler(key: string): void {
        if (key !== '') {
          setWorkspaceOutcomePhase(key);
        }
      },
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
    // ONLY OUR OWN NAME. This surface unmounts to hand the screen to the very
    // next stage of the SAME flow — the offer's discard opens the real hand,
    // and the shell publishes «СБРОС КАРТЫ» before we go. Clearing
    // unconditionally would blank the crumb's tail for that whole step, i.e.
    // step BACKWARDS through a flow that only moves forward.
    if (this.stagePhase !== '' && workspaceOutcomeState.phaseKey === this.stagePhase) {
      setWorkspaceOutcomePhase('');
    }
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
      case 'decline':
        // RT — the deliberate refusal. Nothing follows it, so an embedded stage hands on an EMPTY tail.
        rememberDecisionFocus(this.focusIdx);
        this.submitting = true;
        if (this.embedded) {
          setWorkspaceOutcomePhase('');
        }
        this.$emit('submit', orOptionResponse(press.optionIndex));
        return;
      case 'handPick':
        rememberDecisionFocus(this.focusIdx);
        this.$emit('hand-pick', {
          index: press.action.optionIndex,
          cardPrompt: press.action.nested as SelectCardModel,
          source: this.vm.source,
          // The decision's refusal rides into the album (RT + the plate there too).
          decline: declineModelOf(this.vm.decline),
          // WHERE THE FLOW GOES once the pick is answered — derived ONCE, in
          // the pure model, so the immediate branch above and this one can
          // never disagree about what follows a card-for-a-card exchange.
          nextStage: nextStageKeyOf(press.action),
        });
        return;
      case 'submit':
      default:
        rememberDecisionFocus(this.focusIdx);
        this.submitting = true;
        this.armed = true;
        // THE TAIL IS HANDED ON, never retracted. This branch resolves ON the
        // press («Олимпийская конференция»: «снять жетон и взять карту»), so
        // between here and the card coming off the deck nobody would own the
        // crumb's stage — and `beforeUnmount` clearing it there dropped the
        // line back to «РАЗЫГРАНО», two steps behind the flow.
        if (this.embedded) {
          setWorkspaceOutcomePhase(nextStageKeyOf(this.vm.actions[this.focusIdx]));
        }
        this.$emit('submit', orOptionResponse(press.optionIndex));
      }
    },
    /** X — the source in the ordinary fullscreen viewer (never a private one).
     *  The screen stays mounted underneath, so focus and picks are exactly as
     *  the player left them when the viewer closes. */
    inspectSource(name: CardName): void {
      openConsoleCardZoom([{name}], 0, undefined, undefined, {
        statusLabel: 'Source',
        origin: {
          kind: 'physical',
          // The dock is a COMPONENT — reach its root element.
          resolve: () => (this.$refs.sourceCard as {$el?: HTMLElement} | undefined)
            ?.$el?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null,
        },
      });
    },
  },
});
</script>
