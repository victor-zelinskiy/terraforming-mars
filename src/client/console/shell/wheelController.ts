/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ACTION WHEEL CONTROLLER — the quick wheel of the console shell: its entries (each mirroring the PRESENCE of a
 * server option — invariant 2), the counts on its tiles, its title and trigger, and the pad's path through it.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {buildRtQuickEntries, buildLtQuickEntries, QuickEntry} from '@/client/console/consoleQuickModel';
import {countTone, wheelPotentialCounts, WheelCounts} from '@/client/console/potentialAvailability';
import {RatingRefusalSource} from '@/client/console/ratingRefusal';
import {closeWorkspaceSheet} from '@/client/console/consoleWorkspaceStack';
import {bonusActionTurnControlReason} from '@/client/console/bonusAction';
import {SKIP_TURN_FAST_MODE_REASON} from '@/common/game/fastMode';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleState, ConsoleQuickId} from '@/client/console/consoleRouter';
import {WheelArmEvent, WheelInputState, initialWheelInput} from '@/client/console/quickWheel/wheelArmModel';
import {ensureActionPreviews} from '@/client/console/actionPreviewStore';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {findEndTurnPath, findPassPath} from '@/client/console/turnIntents';
import type {SeatController} from '@/client/console/shell/seatController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type WheelPort = {
  $nextTick(fn?: () => void): Promise<void>,
  readonly actionBlockedReason: string,
  readonly awaitingInput: boolean,
  readonly cardsTotalCount: number,
  readonly convertHeatFutile: string | undefined,
  readonly convertHeatReady: boolean,
  readonly convertHeatRefusal: RatingRefusalSource | undefined,
  readonly convertHeatVetoed: boolean,
  readonly convertPlantsReady: boolean,
  feedWheelArm(event: WheelArmEvent): void,
  game: UnwrapRef<SeatController['game']>,
  readonly myTurn: boolean,
  readonly playerView: PlayerViewModel,
  readonly postGame: boolean,
  readonly standardProjectsAction: {path: ReadonlyArray<number>, input: SelectProjectCardToPlayModel} | undefined,
  readonly thisPlayer: PublicPlayerModel,
  readonly viewerPassed: boolean,
};

export function createWheelController(shell: WheelPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The quick wheel's live input state (focus + arm, wheelArmModel). */
  const wheelInput = ref(initialWheelInput() as WheelInputState);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── action intelligence: POTENTIAL availability, one meaning ────────
  /**
   * The four wheel counts, all of them «what could I do in this game state»
   * — the server's turn-independent projection, clamped for card intake.
   *
   * They used to be read off the LIVE prompt tree, so «КАРТЫ 4» vanished the
   * instant an opponent took over and came back when the turn returned: the
   * wheel described the clock, not the position. Nothing here consults
   * `waitingFor`; the turn gate is an EXECUTION gate and is applied where a
   * move is actually submitted (see `src/common/availability/AvailabilityBlocker.ts`).
   */
  const wheelCounts = computed((): WheelCounts => {
    return wheelPotentialCounts({
      potential: shell.thisPlayer.potentialActions,
      handTotal: shell.cardsTotalCount,
      hasColonies: shell.game.colonies.length > 0,
      hasHydro: shell.game.gameOptions.expansions.deltaProject === true,
    });
  });

  /** Everything the RT wheel could offer, in one number (its bar badge). */
  const wheelCountsTotal = computed((): number => {
    const c = wheelCounts.value;
    return c.cards + c.cardActions + c.hydro + c.trade;
  });

  /** …of which worth doing — an action with no effect is counted above and never invites (the bar's glow). */
  const wheelCountsUseful = computed((): number => {
    return wheelCountsTotal.value - wheelCounts.value.futileCardActions;
  });

  // ── the RT / LT quick selectors (P27 — direct-input command layers) ──
  const quickEntries = computed((): Array<QuickEntry> => {
    if (consoleState.quick === 'actions') {
      return buildRtQuickEntries({
        cardsPlayable: wheelCounts.value.cards,
        cardsTotal: shell.cardsTotalCount,
        actionsAvailable: wheelCounts.value.cardActions,
        actionsFutile: countTone(wheelCounts.value.cardActions, wheelCounts.value.futileCardActions) === 'neutral',
        tradesAvailable: wheelCounts.value.trade,
        hydroAvailable: wheelCounts.value.hydro,
        hasColonies: shell.game.colonies.length > 0,
        hasParliament: shell.game.parliament !== undefined,
        votesAvailable: shell.game.parliament?.viewer?.vote.available === true ? 1 : 0,
        votesPaidOnly: shell.game.parliament?.viewer?.vote.available === true && shell.game.parliament.viewer.vote.source !== 'lobby',
        hasHydro: shell.game.gameOptions.expansions.deltaProject === true,
        postGame: shell.postGame,
      });
    }
    if (consoleState.quick === 'basics') {
      const wf = shell.playerView.waitingFor;
      return buildLtQuickEntries({
        blockedReason: shell.actionBlockedReason,
        myTurn: shell.myTurn,
        awaitingInput: shell.awaitingInput,
        passed: shell.viewerPassed,
        stdAvailable: shell.standardProjectsAction !== undefined,
        endTurnAvailable: findEndTurnPath(wf) !== undefined,
        passAvailable: findPassPath(wf) !== undefined,
        // A card-granted bonus action withholds BOTH turn-control verbs, and
        // says why — the server does not offer them, so without this the
        // wheel would fall back to «сейчас недоступно» over a live menu.
        turnControlReason: bonusActionTurnControlReason(shell.playerView),
        // Fast mode: the skip-turn verb does not exist in this party — the
        // server never offers it, and the tile says so for the whole game.
        skipTurnReason: shell.game.gameOptions.fastModeOption ? SKIP_TURN_FAST_MODE_REASON : '',
        convertPlantsAvailable: shell.convertPlantsReady,
        convertHeatAvailable: shell.convertHeatReady,
        convertHeatFutile: shell.convertHeatFutile,
        convertHeatVetoed: shell.convertHeatVetoed,
        convertHeatRefusal: shell.convertHeatRefusal,
        plantsNeeded: shell.thisPlayer.plantsNeededForGreenery,
        heatNeeded: shell.thisPlayer.heatNeededForTemperature,
      });
    }
    return [];
  });

  const quickTitle = computed((): string => {
    // «ВЫБЕРИТЕ ДЕЙСТВИЕ», not «ДЕЙСТВИЯ»: the top node is «ДЕЙСТВИЯ КАРТ»
    // and the old kicker duplicated its first word right above it.
    return consoleState.quick === 'actions' ? 'Choose an action' : 'Basic actions';
  });

  const quickTrigger = computed((): 'triggerR' | 'triggerL' => {
    return consoleState.quick === 'actions' ? 'triggerR' : 'triggerL';
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── P27: the quick selectors — DIRECT input, no aiming ───────────────
  /**
   * PRESS→RELEASE (wheelArmModel): the DOWN edge of A / a d-pad direction
   * ARMS its slot (the tile seats under the finger), the UP edge of the
   * SAME control COMMITS it. A fast tap arms+commits within its natural
   * duration — no hold threshold. Repeats, cross-control conflicts and
   * stale releases are resolved by the pure machine; this handler only
   * feeds edges in and executes the effects out.
   */
  function handleQuickIntent(intent: GamepadIntent): void {
    if (intent.kind === 'nav') {
      shell.feedWheelArm({type: 'navDown', dir: intent.dir, repeat: intent.repeat, analog: intent.analog === true});
      return;
    }
    if (intent.kind === 'navEnd') {
      shell.feedWheelArm({type: 'navUp', dir: intent.dir});
      return;
    }
    // AIM protocol (left stick): the engaged sector moves the FOCUS; the
    // confirmed return to neutral commits it (gamepadPollModel owns the
    // hysteresis / noise / flick guarantees — this is a pure relay).
    if (intent.kind === 'aim') {
      shell.feedWheelArm({type: 'aim', dir: intent.dir});
      return;
    }
    if (intent.kind === 'aimEnd') {
      shell.feedWheelArm({type: 'aimEnd'});
      return;
    }
    if (intent.kind === 'release') {
      if (intent.button === 'confirm') {
        shell.feedWheelArm({type: 'confirmUp'});
      }
      return;
    }
    if (intent.kind !== 'press') {
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
      shell.feedWheelArm({type: 'confirmDown'});
      break;
    case 'back':
      // B cancels instantly — armed or not, nothing executes.
      shell.feedWheelArm({type: 'cancel'});
      break;
    case 'nextTab':
      // The opening trigger toggles its own selector closed; the other
      // switches wheels in place (any live arm dissolves first).
      shell.feedWheelArm({type: 'reset'});
      consoleState.quick = consoleState.quick === 'actions' ? undefined : 'actions';
      break;
    case 'prevTab':
      shell.feedWheelArm({type: 'reset'});
      consoleState.quick = consoleState.quick === 'basics' ? undefined : 'basics';
      break;
    default:
      break;
    }
  }

  // ── quick selectors / sheets ─────────────────────────────────────────
  /** Open a quick selector from the board home (RT toggles 'actions', LT 'basics'). */
  function openQuick(id: ConsoleQuickId): void {
    if (consoleState.quick === id) {
      consoleState.quick = undefined;
      return;
    }
    consoleState.quick = id;
    closeWorkspaceSheet();
    if (id === 'actions') {
      // PRE-WARM the Action Center's preview cache when the RT wheel opens:
      // by the time the player commits «Действия карт» (~300 ms of human
      // time) the per-card previews are complete, so the grid renders its
      // final geometry and sort on the FIRST frame. Idempotent + SWR.
      // ⚠️ AFTER the flush, never inline: the synchronous form ran the
      // whole-tableau fingerprint + per-card graphic walks + the fetch
      // fan-out BEFORE the wheel's first paint — on a late-game Deck that
      // is exactly the frame the wheel's entry animation needs.
      void shell.$nextTick(() => {
        if (consoleState.quick === 'actions') {
          ensureActionPreviews(shell.playerView);
        }
      });
    }
  }

  // The quick wheel closed or switched under a live arm (closeConsoleLayers,
  // a shell-task surface, the trigger toggle) — the input state dies with
  // its wheel and the NEXT wheel starts at the fixed HOME focus (centre:
  // LT = Standard Projects, RT = Cards — never a remembered position).
  // Eventual releases of still-held controls match nothing and drop.
  function whenConsoleStateQuickChanges(): void {
    wheelInput.value = initialWheelInput();
  }

  // The CONTROL STYLE changed (the Options row applies instantly, no
  // restart): any armed / tracking / pressed state cancels WITHOUT
  // executing, and an open wheel lands in the new strategy's clean start
  // (home focus for focus-confirm; idle for quick-select). Stale releases
  // of the old strategy match nothing afterwards.
  function whenWheelControlModeChanges(): void {
    wheelInput.value = initialWheelInput();
  }

  return {
    wheelInput,
    wheelCounts,
    wheelCountsTotal,
    wheelCountsUseful,
    quickEntries,
    quickTitle,
    quickTrigger,
    handleQuickIntent,
    openQuick,
    whenConsoleStateQuickChanges,
    whenWheelControlModeChanges,
  };
}

export type WheelController = ReturnType<typeof createWheelController>;
