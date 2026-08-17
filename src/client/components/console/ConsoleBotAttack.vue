<template>
  <!--
    THE BOT ATTACK — the console's compact modal for «бот атаковал вас».

    It wears the project's ORDINARY cold glass (the same plate `.con-decision`
    and `.con-task` stand on). The attack is a SEMANTIC accent — one kicker, the
    bridge, the pending-removal ring, the negative delta — never a red surface:
    a modal that repaints itself for one event reads as a combat UI borrowed
    from another game.

    THE COMPOSITION IS A CAUSAL SENTENCE, left to right:

        [ the bot's real card ]  →  ⊖ resource  →  [ your card + result ]
            SOURCE                   BRIDGE            TARGET

    …so the bot's own face is the physical origin of the effect and never a text
    rectangle behind an inspect verb. It is content-sized: with one candidate
    the whole row centres and the panel shrinks with it.
  -->
  <div class="con-botattack con-ws"
       :class="{'con-botattack--committing': committing}"
       role="dialog" :aria-label="ariaLabel"
       data-motion-surface="bot-attack">
    <div class="con-botattack__panel" data-motion-panel>
      <header class="con-botattack__head">
        <!-- WHO. One word plus the SEAT CHIP — the shell's own «dot + name»
             vocabulary, with the name resolved by the ONE display-name helper
             (`displayNameForColor` → the 'MarsBot' key → «Бот»). Never a
             hardcoded name in either language. -->
        <div class="con-botattack__kicker">
          <span class="con-botattack__kicker-mark" aria-hidden="true">◈</span>
          <span class="con-botattack__kicker-word">{{ $t(vm.eyebrowKey) }}</span>
          <span class="con-botattack__kicker-sep" aria-hidden="true">·</span>
          <span class="con-botattack__actor" :class="'player_color_' + vm.attacker">
            <span class="con-botattack__actor-dot" :class="'player_bg_color_' + vm.attacker" aria-hidden="true"></span>
            {{ actorName }}
          </span>
        </div>
        <!-- WHAT HAPPENED — a sentence, not a mechanism («Бот применяет карту
             «Инвазивные виды»»). -->
        <h2 class="con-botattack__title">{{ headlineText }}</h2>
        <!-- WHAT IS REQUIRED, and — quieter but still readable — WHY only these
             cards. The server's own rule key, never a re-derivation. -->
        <p class="con-botattack__ask">{{ explanationText }}</p>
        <p v-if="restrictionText !== ''" class="con-botattack__limit">{{ restrictionText }}</p>
      </header>

      <!-- NO VALID TARGET. The server normally resolves that without ever
           asking, so this is the honest last resort rather than an expected
           state — it says so in words and offers the only move the protocol
           allows. -->
      <div v-if="vm.empty" class="con-botattack__empty">{{ $t(emptyKey) }}</div>

      <div v-else class="con-botattack__scene">
        <!-- SOURCE — the bot's REAL card, drawn by the shared `BonusCardFace`
             through the shared source dock. The same face the bot board, the
             turn theater and the fullscreen inspect all render, at its
             TV-readable size: the player meets the card that attacked them
             without pressing anything. -->
        <console-source-dock class="con-botattack__source" :view="vm.source" ref="sourceCard" />

        <!-- BRIDGE — the causality, in one small directed unit: what leaves,
             which way it goes. Not a decorative arrow; it is the only thing on
             screen that says the effect travels FROM the bot's card TO yours. -->
        <div class="con-botattack__bridge" aria-hidden="true">
          <span class="con-botattack__bridge-line"></span>
          <span class="con-botattack__bridge-chip">
            <span class="con-botattack__bridge-sign">−{{ vm.amountLabel }}</span>
            <i v-if="resourceIcon !== ''" class="con-botattack__bridge-icon" :class="resourceIcon"></i>
          </span>
          <span class="con-botattack__bridge-line con-botattack__bridge-line--to"></span>
        </div>

        <!-- TARGET — the SHARED played-target selector in its `remove`
             direction, plus its own one-line result rail right under the cards.
             data-ws-band: the zone the step sizes against, with a FIXED height
             on purpose (the panel is content-sized, so a zone that grew with
             its content would hand the fit engine its own output back). -->
        <div class="con-botattack__stage" data-ws-band ref="targets">
          <ConsolePlayedTargetStep v-if="targetModel !== undefined && targetFocus !== undefined"
                                   ref="targetStep"
                                   :model="targetModel"
                                   :layout="targetLayout"
                                   :focus="targetFocus"
                                   :bandHeight="targetsHeight"
                                   :lockedCard="selected ?? ''"
                                   hostStatesAsk />
        </div>
      </div>

      <!-- THE COMMIT — the composer's own compact rail (`.con-composer__cta`
           language: graphite while it cannot run, mint when it can, cyan ring
           under the cursor), content-sized and never a full-width web button.
           It is the PANEL's foot rather than a member of the scene, so the
           source card and the target card centre on each other instead of on a
           column that also holds a rail and a button. The ROW names the act;
           the ONE command bar names the press — never the same string twice. -->
      <div v-if="!vm.empty" class="con-botattack__foot">
          <div class="con-botattack__cta"
               :class="{
                 'con-botattack__cta--held': !commitReady && !committing,
                 'con-botattack__cta--ready': commitReady,
                 'con-botattack__cta--focused': zone === 'commit' && commitReady,
                 'con-botattack__cta--armed': committing,
               }"
               :aria-disabled="commitReady ? 'false' : 'true'">
            <GamepadGlyph v-if="commitReady && !committing" control="confirm" class="con-botattack__cta-glyph" />
            <span v-else class="con-botattack__cta-mark" aria-hidden="true">◈</span>
            <span class="con-botattack__cta-label">{{ commitReady || committing ? commitText : $t('Choose a card first') }}</span>
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
 *  · `displayNameForColor` (`marsBotDisplay.ts`) — the ONE display-name
 *    resolver. «MarsBot» never reaches the UI, and neither does a second
 *    hardcoded «Бот»: the label follows the locale.
 *  · `ConsoleSourceDock` → `BonusCardFace` — the bot's real card, the same
 *    renderer every other surface uses.
 *  · `ConsolePlayedTargetStep` — the same "point at a card on the table"
 *    selector the card-play and blue-action composers use, in its `remove`
 *    direction. No second card grid, no second navigation model.
 *  · `consoleCommitGate` — the one authority on «may this be confirmed yet»,
 *    which is what keeps the CTA from ever showing a live Ⓐ it would refuse.
 */
import {defineComponent, PropType} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {commitAllowed, computeCommitGate} from '@/client/console/consoleCommitGate';
import {botAttackState} from '@/client/console/botAttack/botAttackState';
import {
  buildPlayedTargetModel, findPlayedTargetFocus, planPlayedTargetLayout,
  playedTargetAt, reseatPlayedTargetFocus, stepPlayedTargetFocusAt,
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel,
} from '@/client/console/played/consolePlayedTargetModel';
import {
  botAttackCommandKeys, botAttackPreviewFor, botAttackPressIntent, botAttackResourceFor,
  BotAttackPhrase, BotAttackViewModel, BotAttackZone, EMPTY_NO_TARGETS, VERB_CHOOSE_TARGET,
} from '@/client/console/botAttack/botAttackModel';

/** The commit BEAT: the chosen cube visibly leaves before the answer is sent —
 *  short, once, and never a substitute for the server's own confirmation. */
const COMMIT_BEAT_MS = 420;

function phraseText(phrase: BotAttackPhrase): string {
  if (phrase.params.length === 0) {
    return translateText(phrase.key);
  }
  // A parameter that is itself an i18n key (a card's name) is translated BEFORE
  // interpolation — `translateTextWithParams` substitutes verbatim.
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
    /**
     * THE ACTOR'S VISIBLE NAME — the one existing resolver, never a literal.
     * `displayNameForColor` routes the bot seat through the `'MarsBot'` i18n
     * key («Бот» in Russian) and any other seat through its own name, so a
     * locale change re-labels this surface with no code path of its own.
     */
    actorName(): string {
      return displayNameForColor(this.playerView.players, this.vm.attacker);
    },
    headlineText(): string {
      const card = this.vm.sourceNameKey;
      return card === undefined ?
        translateTextWithParams(this.vm.headlineKey, [this.actorName]) :
        translateTextWithParams(this.vm.headlineKey, [this.actorName, translateText(card)]);
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
    ariaLabel(): string {
      return `${translateText(this.vm.eyebrowKey)}: ${this.actorName}`;
    },
    /** The removed resource's sprite, for the bridge chip. */
    resourceIcon(): string {
      return this.vm.resourceIcon === undefined ? '' : iconClassFor(this.vm.resourceIcon);
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
     * chosen target — so the CTA cannot take the cursor before there is
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
      const controls = ['dpad', 'confirm', 'secondary', 'back'] as const;
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
     * player (an effect removed the last cube), and a CTA still offering to
     * remove from a card the server would refuse is the one state this screen
     * must never be in.
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
     * editable again — a sealed CTA over a prompt the server is still asking is
     * the one state this screen must never be left in.
     */
    'botAttackState.abortNonce'(): void {
      this.resetSubmitting();
    },
  },
  mounted() {
    // NOTHING IS SELECTED ON OPEN. The cursor rests on the first candidate so
    // the pad has somewhere to start; a cursor is not a choice, and the CTA
    // stays refused until the player makes one.
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
      const press = botAttackPressIntent({
        vm: this.vm,
        zone: this.zone,
        focused: this.focusedCard,
        selected: this.selected,
        action: consoleActionOf(intent),
        submitting: this.submitting,
      });
      if (press === undefined) {
        return;
      }
      switch (press.kind) {
      case 'defer':
        this.$emit('defer');
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
        // UP re-opens the choice; every other direction stays put (the CTA is
        // one control, not a grid).
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
      // An EDGE HOLDS inside the grid — except downwards, where the CTA is the
      // next thing on screen and must be reachable by the same d-pad.
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
    /** A rollback the abort signal triggers when the server REFUSES the answer:
     *  the beat is undone and the choice becomes editable again. */
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
