<template>
  <!--
    THE MARSBOT ATTACK — the console's compact modal for «бот атаковал вас».

    It is deliberately NOT a workspace: the player did not open anything, there
    is no flow to descend into and nothing to come back to afterwards. So it is
    a content-sized panel in the modal band, over a moderate shade — focused
    enough to be answered, small enough that the board stays readable behind it.

    The top half answers the three questions the old full-screen picker left
    unanswered, in reading order: WHO did this (the attack eyebrow + the bot's
    seat dot), WITH WHAT (the bot's own card face, drawn by the shared source
    dock), and WHAT THE PLAYER MUST DO (one plain sentence + the rule that
    narrowed the candidates).

    The bottom half is the SHARED played-target selector — the very component
    the card-play and blue-action composers use to point at a card on the table
    — running in its `remove` direction, plus the COMMIT ROW that turns the
    choice into a second, deliberate press.
  -->
  <div class="con-botattack con-ws"
       :class="{'con-botattack--committing': committing}"
       role="dialog" :aria-label="$t(vm.eyebrowKey)"
       data-motion-surface="bot-attack">
    <div class="con-botattack__panel" data-motion-panel>
      <header class="con-botattack__head">
        <div class="con-botattack__eyebrow">
          <span class="con-botattack__eyebrow-dot" :class="'player_bg_color_' + vm.attacker" aria-hidden="true"></span>
          <span class="con-botattack__eyebrow-mark" aria-hidden="true">◆</span>
          <span>{{ $t(vm.eyebrowKey) }}</span>
        </div>
        <h2 class="con-botattack__title">{{ headlineText }}</h2>
        <p class="con-botattack__explain">{{ explanationText }}</p>
        <!-- WHY only these cards. The server's own rule key — never a
             re-derivation, and never silence: «почему не все мои карты» is the
             first thing a player asks of a narrowed target set. -->
        <p v-if="restrictionText !== ''" class="con-botattack__restriction">
          <span class="con-botattack__restriction-mark" aria-hidden="true">◈</span>{{ restrictionText }}
        </p>
      </header>

      <div class="con-botattack__main">
        <!-- THE SOURCE — the SHARED dock. For a bot bonus card it draws the
             REAL `BonusCardFace`, the same face the bot board, the turn
             theater and the fullscreen inspect all use. Compact: the card is
             context here, the decision is about the player's own tableau. -->
        <console-source-dock class="con-botattack__source" :view="vm.source" compact ref="sourceCard" />

        <div class="con-botattack__body">
          <!-- NO VALID TARGET. The server normally resolves that without ever
               asking, so this is the honest last resort rather than an
               expected state — it says so in words and offers the only move
               the protocol allows. -->
          <div v-if="vm.empty" class="con-botattack__empty">{{ $t(emptyKey) }}</div>

          <template v-else>
            <!-- data-ws-band: THE ZONE THE STEP SIZES AGAINST. It has a FIXED
                 height on purpose — the panel is content-sized, so a zone that
                 grew with its content would hand the step's fit engine its own
                 output back (bigger cards → taller zone → bigger cards). The
                 documented forbidden loop; the constant breaks it. -->
            <div class="con-botattack__targets" data-ws-band ref="targets">
              <ConsolePlayedTargetStep v-if="targetModel !== undefined && targetFocus !== undefined"
                                       ref="targetStep"
                                       :model="targetModel"
                                       :layout="targetLayout"
                                       :focus="targetFocus"
                                       :bandHeight="targetsHeight"
                                       :lockedCard="selected ?? ''"
                                       hostStatesAsk />
            </div>

            <!-- THE COMMIT ROW — a cursor stop of its own, and the ONLY place
                 the removal can be triggered from. Selecting a card moves the
                 cursor here; walking back UP changes the choice. That is the
                 console's pre-select → commit grammar (`consoleCommitGate`),
                 and it is what makes an accidental removal unexpressible
                 rather than merely unlikely. -->
            <div class="con-botattack__commit"
                 :class="{
                   'con-botattack__commit--ready': commitReady,
                   'con-botattack__commit--focused': zone === 'commit',
                   'con-botattack__commit--armed': committing,
                 }">
              <span class="con-botattack__commit-verb">{{ commitText }}</span>
              <span v-if="selected !== undefined" class="con-botattack__commit-target">{{ $t(selected) }}</span>
              <span v-else class="con-botattack__commit-hint">{{ $t('Choose a card first') }}</span>
              <!-- The LOSS, stated once and only when it is real. It is a
                   different figure from the card's own points (which the
                   selector's status rail states beside the resource count), so
                   it never repeats a number under a second label. -->
              <span v-if="vpLoss !== 0" class="con-botattack__commit-loss">{{ vpLossText }}</span>
              <GamepadGlyph v-if="zone === 'commit' && commitReady" control="confirm" class="con-botattack__commit-a" />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * THE ATTACK SCREEN. It owns focus, the pad contract and the submit — nothing
 * else. Every judgement about what the prompt MEANS was made by the pure model
 * (`botAttack/botAttackModel.ts`) off the server's own `botAttackPrompt`
 * marker, so this file contains no game logic, no card names and no text
 * heuristics.
 *
 * WHAT IT REUSES, and why that matters more than what it adds:
 *  · `ConsolePlayedTargetStep` — the same "point at a card on the table"
 *    selector the card-play and blue-action composers use, in its `remove`
 *    direction. No second card grid, no second navigation model, no second
 *    idea of what a candidate looks like.
 *  · `ConsoleSourceDock` — the console's one answer to «кто это сделал», here
 *    drawing MarsBot's own `BonusCardFace`.
 *  · `consoleCommitGate` — the one authority on «may this be confirmed yet»,
 *    which is what keeps the commit row from ever showing a live Ⓐ it would
 *    refuse to run.
 */
import {defineComponent, PropType} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {openBonusCardZoom} from '@/client/components/marsbot/bonusCardZoomState';
import {commitAllowed, computeCommitGate} from '@/client/console/consoleCommitGate';
import {botAttackState} from '@/client/console/botAttack/botAttackState';
import {
  buildPlayedTargetModel, findPlayedTargetFocus, planPlayedTargetLayout,
  playedTargetAt, reseatPlayedTargetFocus, stepPlayedTargetFocusAt,
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel,
} from '@/client/console/played/consolePlayedTargetModel';
import {
  botAttackCommandKeys, botAttackPreviewFor, botAttackPressIntent, botAttackResourceFor,
  botAttackVpLoss, BotAttackPhrase, BotAttackViewModel, BotAttackZone, EMPTY_NO_TARGETS,
  VERB_CHOOSE_TARGET,
} from '@/client/console/botAttack/botAttackModel';

/** The commit BEAT: the chosen cube visibly leaves before the answer is sent —
 *  short, once, and never a substitute for the server's own confirmation. */
const COMMIT_BEAT_MS = 420;

function phraseText(phrase: BotAttackPhrase): string {
  if (phrase.params.length === 0) {
    return translateText(phrase.key);
  }
  // A parameter that is itself an i18n key (the bot card's name) is translated
  // BEFORE interpolation — `translateTextWithParams` substitutes verbatim.
  const params = phrase.translateParams === true ?
    phrase.params.map((p) => translateText(p)) :
    [...phrase.params];
  return translateTextWithParams(phrase.key, params);
}

export default defineComponent({
  name: 'ConsoleBotAttack',
  // `console-source-dock` is GLOBAL (main.ts) — see the note there.
  components: {ConsolePlayedTargetStep, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    vm: {type: Object as PropType<BotAttackViewModel>, required: true},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      // The module-level store is MIRRORED into `data` on purpose: a path
      // watcher over a module `reactive` does not fire otherwise (the console's
      // own hard-won rule — see `journalState` and friends).
      botAttackState,
      zone: 'targets' as BotAttackZone,
      focus: undefined as PlayedTargetFocus | undefined,
      /** The card the player has CHOSEN — never seeded, never the cursor. */
      selected: undefined as CardName | undefined,
      committing: false,
      submitting: false,
      targetsHeight: 0,
      targetsWidth: 0,
      stopResizeObs: undefined as (() => void) | undefined,
      beat: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    emptyKey(): string {
      return EMPTY_NO_TARGETS;
    },
    prompt(): SelectCardModel | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'card' ? (wf as SelectCardModel) : undefined;
    },
    headlineText(): string {
      return phraseText(this.vm.headline);
    },
    explanationText(): string {
      return phraseText(this.vm.explanation);
    },
    restrictionText(): string {
      return this.vm.restrictionKey === undefined ? '' : translateText(this.vm.restrictionKey);
    },
    commitText(): string {
      return phraseText(this.vm.commit);
    },
    /** The VP this choice actually costs — 0 means «no chip», never «−0». */
    vpLoss(): number {
      return botAttackVpLoss(this.vm, this.selected);
    },
    vpLossText(): string {
      // A typographic minus, not a hyphen — the chip is a number the player
      // reads at TV distance.
      const n = this.vpLoss;
      return translateTextWithParams('${0} VP', [n < 0 ? `−${Math.abs(n)}` : `+${n}`]);
    },
    /**
     * THE TARGET MODEL — the shared builder, in its `remove` direction. The
     * candidate set is the SERVER's own (`prompt.cards`), so eligibility is
     * never re-derived here; the preview is injected from the marker.
     */
    targetModel(): PlayedTargetModel | undefined {
      const prompt = this.prompt;
      if (prompt === undefined) {
        return undefined;
      }
      return buildPlayedTargetModel({
        candidates: prompt.cards,
        players: this.playerView.players,
        viewerColor: this.playerView.thisPlayer.color,
        // The modal's own header states the ask in full; the selector must not
        // restate it (and `hostStatesAsk` hides the line that would).
        ask: '',
        direction: 'remove',
        typeOf: (name) => getCard(name)?.type,
        preview: (name) => botAttackPreviewFor(this.vm, name),
        resourceContext: (name) => botAttackResourceFor(this.vm, name),
      });
    },
    targetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.targetModel?.owners ?? [],
        availW: this.targetsWidth,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** The focus the child renders — reseated whenever the model moves. */
    targetFocus(): PlayedTargetFocus | undefined {
      return reseatPlayedTargetFocus(this.focus, this.targetModel?.owners ?? []);
    },
    focusedCard(): CardName | undefined {
      const at = this.targetFocus;
      const owners = this.targetModel?.owners ?? [];
      return at === undefined ? undefined : playedTargetAt(at, owners)?.cardName;
    },
    /**
     * The ONE authority on «may this be confirmed». A single requirement — a
     * chosen target — so the commit row cannot take the cursor before there is
     * something to commit, and cannot run when the choice went stale.
     */
    gate() {
      const stale = this.selected !== undefined &&
        findPlayedTargetFocus(this.selected, this.targetModel?.owners ?? []) === undefined;
      return computeCommitGate({
        requirements: [{
          index: 0,
          verb: VERB_CHOOSE_TARGET,
          satisfied: this.selected !== undefined && !stale,
          stale,
        }],
        submitting: this.submitting,
      });
    },
    commitReady(): boolean {
      return commitAllowed(this.gate);
    },
    footCommands(): Array<ConsoleCommand> {
      const controls = ['dpad', 'confirm', 'secondary', 'stickL', 'back'] as const;
      return botAttackCommandKeys(this.vm, this.zone, this.selected).map((label, i) => ({
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
        setPanelCommands('botAttack', cmds);
      },
    },
    /**
     * A SELECTION THAT STOPPED BEING LEGAL is dropped, and the cursor goes
     * back to the targets. The realtime path can move the table under the
     * player (an effect removed the last cube), and a commit row still offering
     * to remove from a card the server would refuse is the one state this
     * screen must never be in.
     */
    gate: {
      handler(): void {
        if (this.gate.kind === 'stale') {
          this.selected = undefined;
          this.zone = 'targets';
        }
      },
    },
    /**
     * THE SERVER REFUSED the answer (a stale target, a dropped connection).
     * The removal did not happen, so the beat is undone and the choice becomes
     * editable again — a sealed commit row over a prompt the server is still
     * asking is the one state this screen must never be left in.
     */
    'botAttackState.abortNonce'(): void {
      this.resetSubmitting();
    },
  },
  mounted() {
    // NOTHING IS SELECTED ON OPEN. The cursor rests on the first candidate so
    // the pad has somewhere to start; a cursor is not a choice, and the commit
    // row stays refused until the player makes one.
    this.focus = reseatPlayedTargetFocus(undefined, this.targetModel?.owners ?? []);
    const el = this.$refs.targets as HTMLElement | undefined;
    if (el !== undefined) {
      this.measure();
      this.stopResizeObs = useResizeObserver(el, () => this.measure()).stop;
    }
  },
  beforeUnmount() {
    clearPanelCommands('botAttack');
    this.stopResizeObs?.();
    this.stopResizeObs = undefined;
    if (this.beat !== undefined) {
      clearTimeout(this.beat);
    }
  },
  methods: {
    measure(): void {
      const el = this.$refs.targets as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      this.targetsHeight = el.clientHeight;
      this.targetsWidth = el.clientWidth;
    },
    /**
     * The shell routes the pad here while this screen serves. WHAT a press
     * means is decided by the pure model, so the rules worth guarding (B is
     * never an answer, a second A cannot submit twice, A on a candidate never
     * removes anything) live in a unit-tested module rather than here.
     */
    handleIntent(intent: GamepadIntent): void {
      if (this.committing) {
        return; // the beat owns the screen — input is absorbed BY PHASE
      }
      if (intent.kind === 'nav') {
        this.navigate(intent.dir);
        return;
      }
      // L3 is a raw stick press with no entry in the shared button→action map.
      const action = intent.kind === 'press' && intent.button === 'stickL' ?
        'source' :
        consoleActionOf(intent);
      const press = botAttackPressIntent({
        vm: this.vm,
        zone: this.zone,
        focused: this.focusedCard,
        selected: this.selected,
        action,
        submitting: this.submitting,
      });
      if (press === undefined) {
        return;
      }
      switch (press.kind) {
      case 'defer':
        this.$emit('defer');
        return;
      case 'inspectSource':
        this.inspectSource();
        return;
      case 'inspectTarget':
        openConsoleCardZoom([{name: press.card}], 0);
        return;
      case 'select':
        this.selected = press.card;
        // The cursor follows the gate: with the choice made, the next real
        // step is the commit, so that is where the player is put.
        this.zone = 'commit';
        return;
      case 'skip':
        this.submitting = true;
        this.$emit('submit', {type: 'card', cards: []});
        return;
      case 'commit':
      default:
        this.runCommit(press.card);
      }
    },
    navigate(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (this.zone === 'commit') {
        // UP re-opens the choice; every other direction stays put (the commit
        // row is one control, not a grid).
        if (dir === 'up') {
          this.zone = 'targets';
        }
        return;
      }
      const step = this.$refs.targetStep as {cells?: () => ReadonlyArray<PlayedTargetCell>} | undefined;
      const cells = step?.cells?.() ?? [];
      const at = this.targetFocus;
      const next = at === undefined ? undefined : stepPlayedTargetFocusAt(at, dir, cells);
      if (next !== undefined) {
        this.focus = next;
        return;
      }
      // An EDGE HOLDS inside the grid — except downwards, where the commit row
      // is the next thing on screen and must be reachable by the same d-pad.
      if (dir === 'down' && this.commitReady) {
        this.zone = 'commit';
      }
    },
    /**
     * THE COMMIT BEAT — the cube visibly leaves before the answer is sent.
     *
     * Order is deliberate and is the whole physicality of the moment: the
     * chosen card is marked as losing its resource, the beat plays once, and
     * only then does the response leave. Nothing is destroyed client-side (the
     * counters still read the server's numbers) — the modal closes when the
     * server has answered, so the player never sees a result the game has not
     * committed to. Reduced motion shortens the beat; it never removes the
     * ordering.
     */
    runCommit(card: CardName): void {
      this.committing = true;
      this.submitting = true;
      this.beat = setTimeout(() => {
        this.beat = undefined;
        this.$emit('submit', {type: 'card', cards: [card]});
      }, Math.max(1, consoleMotionMs(COMMIT_BEAT_MS)));
    },
    /** L3 — MarsBot's own card, in ITS own fullscreen viewer (never a fake
     *  project-card face). A project-card source opens the ordinary viewer. */
    inspectSource(): void {
      const bonus = this.vm.source.bonusCard;
      if (bonus !== undefined) {
        openBonusCardZoom(bonus.id, bonus.ctx);
        return;
      }
      const card = this.vm.source.card;
      if (card !== undefined) {
        openConsoleCardZoom([{name: card}], 0, undefined, undefined, {statusLabel: 'Source'});
      }
    },
    /** A rollback the shell calls when the server REFUSES the answer: the beat
     *  is undone and the choice becomes editable again, never a sealed row. */
    resetSubmitting(): void {
      this.submitting = false;
      this.committing = false;
      if (this.beat !== undefined) {
        clearTimeout(this.beat);
        this.beat = undefined;
      }
    },
  },
});
</script>
