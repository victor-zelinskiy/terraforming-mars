/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * START BOARD EXCURSION — the COMPLETION BARRIER of the Game Start Workspace.
 *
 * When a start card's effect asks for a BOARD PLACEMENT, the workspace yields
 * the screen to the board (the board is an always-mounted host — the yield IS
 * the hand-off). The bug this module removes: the yield used to end the moment
 * the space prompt resolved, so the workspace popped back BETWEEN the causally
 * connected parts of one play — over the tile's own commit flight, between the
 * reward transfers and the bonus-card reveal, between the reveal and the Ares
 * hazard prompt. One placement, four returns.
 *
 * ⚠️ A CARD-GRANTED BONUS ACTION IS NOT ONE OF THESE, and the difference is the
 * point. A placement is one demand the board answers and hands straight back,
 * so the workspace stays alive behind it. «Фора» grants an ORDINARY TURN — play
 * a card, activate one, build, trade, claim — and a workspace that stays alive
 * behind THAT fights the player for every surface it still owns (the hand
 * teleports into its hidden zone, walking away defers it and blocks the board).
 * That window is handled by the workspace LETTING GO entirely
 * (`ConsoleShell.bonusTurnLive`), not by this barrier.
 *
 * THE MODEL — a LATCH, engaged when the workspace yields to a placement and
 * released exactly once, when the WHOLE causal chain of that placement has
 * completed:
 *   space answered → commit flight landed → reward transfers flown → the
 *   cell's bonus-card reveal (and its hand intake) finished → every follow-up
 *   prompt the placement raised (Ares production loss, a chained second
 *   placement, a nested choice) answered.
 *
 * The release condition is DERIVED from the same live signals the admission
 * policy already trusts (`tilePlacementHolding`, `isResourceTransferActive`,
 * `isBoardCardBonusActive`, the reveal mode, the hand intake) plus the ONE
 * prompt question: «is the server asking the viewer something that is served
 * OVER the board rather than inside the start workspace?». It deliberately
 * counts ONLY the viewer's own chain — a remote player's placement cinematic
 * (`isRemotePlacementActive`) and the global animation-hold registry are NOT
 * consulted, so an unrelated event of another player can never wedge the
 * latch. Every visual signal in the condition carries its own safety ceiling
 * (12–35 s) in its owning module, so the latch cannot stick on a dead
 * animation either; a pending PROMPT holds it indefinitely by design — the
 * prompt is being served, and answering it is what advances the chain.
 *
 * The consumer is the shell's `startSceneVisible`: the scene stays HIDDEN
 * (collapse semantics — mounted, state intact) while the latch is engaged, so
 * the parent workspace returns exactly once, onto a settled frame.
 */
import {reactive} from 'vue';
import {TaskKind} from '@/client/console/consoleTaskRouter';

export const startExcursionState = reactive({
  /** The latch: the start workspace has yielded to a board placement and the
   *  placement's causal chain has not fully completed yet. */
  active: false,
});

export function engageStartExcursion(): void {
  startExcursionState.active = true;
}

export function releaseStartExcursion(): void {
  startExcursionState.active = false;
}

export function startExcursionActive(): boolean {
  return startExcursionState.active;
}

/**
 * Prompt kinds that KEEP the excursion latched: they are served on surfaces
 * that stand OVER the board (the task host band, the dedicated composites),
 * so the start workspace returning underneath them would be exactly the
 * mid-chain flash the barrier exists to remove. The chain is only over when
 * the server stops asking these.
 *
 * Deliberately NOT here (they release the excursion):
 *  - `startSequence` / `initialDraft` / `corpFirstAction` — the workspace's
 *    OWN prompts: the scene must be back to serve them;
 *  - `projectCard` / `handSelect` / `colony` / `colonyBonus` / `deckSelect` —
 *    hosted as STEPS of the start workspace (`workspaceHostForStep`): their
 *    surface teleports INTO the scene's zone, so the scene must be visible;
 *  - `space` — counted separately (`placementAsked`), raw and unfiltered, so
 *    a chained second placement (Great Aquifer's two oceans) held behind the
 *    first tile's cinematic still counts as chain work;
 *  - `actionMenu` — the deployment is over by definition (a bonus-action turn
 *    is not an exception: the workspace has let go of the screen entirely for
 *    it, so there is no barrier standing to release).
 */
export const EXCURSION_BLOCKING_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>([
  'choice', 'distribute', 'player', 'amount', 'resource', 'payment',
  'spendHeat', 'venusBonus', 'aresGlobal', 'awardFunding', 'composite', 'cardSelect', 'unknown',
]);

/** The live signals of one placement chain, as the shell reads them. */
export type StartExcursionSignals = {
  /** A space is (still) being asked of the viewer — raw `waitingFor.type ===
   *  'space'` plus the client-side pickers, NOT admission-gated: a held
   *  chained placement is still owed chain work. */
  placementAsked: boolean;
  /** The viewer's own tile-placement transaction (approach → landed →
   *  rewarding) is running (`tilePlacementHolding()`). */
  tileHero: boolean;
  /** Reward / bonus resource flights are in the air (`isResourceTransferActive`). */
  transfers: boolean;
  /** The placed cell's bonus-card scene (`isBoardCardBonusActive`). */
  boardBonus: boolean;
  /** A reveal overlay is open, or a drawn reveal is pending presentation. */
  revealBusy: boolean;
  /** Drawn cards are still flying into the hand dock (intake / withheld). */
  handIntake: boolean;
  /** The current top-level task kind (`taskFor(view)?.kind`), undefined when
   *  the server asks nothing. */
  followUpKind: TaskKind | undefined;
};

/**
 * Is the placement chain fully QUIET — every visual beat finished, no chain
 * prompt pending? PURE; the shell latches the release off it (with a
 * next-tick re-check, so a one-flush hand-off between two signals — tile
 * settle → reveal claim — can never slip a false release through).
 */
export function startExcursionQuiet(s: StartExcursionSignals): boolean {
  if (s.placementAsked || s.tileHero || s.transfers || s.boardBonus || s.revealBusy || s.handIntake) {
    return false;
  }
  return s.followUpKind === undefined || !EXCURSION_BLOCKING_KINDS.has(s.followUpKind);
}
