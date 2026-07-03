/*
 * CONSOLE TASK ROUTER — CTS phase T0 (CONSOLE_MODE_CONCEPT.md §CTS-1/2).
 *
 * The ONE place that knows which console surface owns a server prompt.
 * `taskFor(view)` maps `playerView.waitingFor` to a typed `ConsoleTask` —
 * re-centralizing the routing knowledge that is scattered across
 * `WaitingFor.useModalForCurrentInput`, PlayerHome's dedicated-surface
 * predicates and the App-level flow gates, as one PURE, exhaustively
 * tested table (tests/client/components/console/consoleTaskRouter.spec.ts
 * enumerates every CTS-2 row; its printed red list IS the work queue).
 *
 * `TaskKind` is a CLOSED union — the completeness anchor: a new server
 * prompt shape must either map to a kind or land on the honest `unknown`
 * guard (never a silent pill). The router NEVER mutates anything and NEVER
 * submits — it only classifies.
 */

import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {inputTitleText} from '@/client/console/turnIntents';

export type CardSelectMode = 'draft' | 'buy' | 'select' | 'target';

export type ConsoleTask =
  /** The per-turn action menu — natively handled by the Turn verbs. */
  | {kind: 'actionMenu'}
  /** Board placement — natively handled by the console placement mode. */
  | {kind: 'space'}
  | {kind: 'choice', flavor: 'generic' | 'contextual' | 'wgt' | 'awardFunding' | 'confirm'}
  | {kind: 'player'}
  | {kind: 'amount', flavor: 'generic' | 'delta'}
  | {kind: 'resource'}
  | {kind: 'distribute', mode: 'resources' | 'production'}
  | {kind: 'payment'}
  | {kind: 'cardSelect', mode: CardSelectMode}
  | {kind: 'projectCard', mode: 'playFromHand' | 'standardProject'}
  | {kind: 'colony'}
  | {kind: 'composite'}
  | {kind: 'initialDraft'}
  | {kind: 'startSequence', prompt: 'corporationInitialAction' | 'corporationSelection' | 'preludeSelection'}
  | {kind: 'aresGlobal'}
  /** Out-of-scope / unmapped — renders the honest guard panel, NEVER silence. */
  | {kind: 'unknown', inputType: string};

export type TaskKind = ConsoleTask['kind'];

/**
 * Kinds served natively today: the shell's own surfaces (actionMenu/space)
 * + the T1 ConsoleTaskHost primitives + T2 cardSelect + T3 payment/
 * projectCard + T4 colony + T5 initialDraft/startSequence (the start
 * scene). The red-list spec mirrors this set.
 */
export const NATIVE_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>([
  'actionMenu', 'space',
  'choice', 'player', 'amount', 'resource', 'distribute',
  'cardSelect', 'payment',
  'projectCard', 'colony',
  'initialDraft', 'startSequence',
]);

/** Kinds handled by shell surfaces that need NO task host (detector base). */
export const SHELL_NATIVE_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['actionMenu', 'space']);

/**
 * Kinds served by SHELL SECTIONS (not the task host): the play-from-hand /
 * standard-project prompts ride the hand carousel & the standard-projects
 * sheet; a colony pick rides the colonies rail in pick mode. The shell
 * auto-opens the surface; navigating away DEFERS the task (amber chip).
 */
export const SHELL_SECTION_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['projectCard', 'colony']);

/**
 * Kinds served by the full-screen START SCENE (T5): the `initialCards`
 * wizard (corporation / preludes / CEO / project buy / summary) and the
 * marked start-sequence prompts (play preludes one by one, apply the corp
 * first action, Merger's corp pick). The shell mounts ConsoleStartScene
 * and routes input to it; B defers to the amber chip like every task.
 */
export const SCENE_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['initialDraft', 'startSequence']);

const ACTION_MENU_TITLES: ReadonlyArray<string> = ['Take your first action', 'Take your next action'];
const WGT_TITLE = 'Select action for World Government Terraforming';

/**
 * Option types the task host can serve inside a `choice` (T9 one-level
 * wizard): leaves, board picks, and every nested input it has a native
 * body for. NOT here (→ the desktop modal): `and` composites (combined
 * multi-child submit) and deeper `or` nesting.
 */
const NESTABLE_OPTION_TYPES: ReadonlySet<string> = new Set([
  'option', 'space',
  'card', 'payment', 'amount', 'player', 'resource', 'resources', 'productionToLose',
]);

function isHandSubset(view: PlayerViewModel, cards: ReadonlyArray<{name: string}> | undefined): boolean {
  if (cards === undefined || cards.length === 0) {
    return false;
  }
  const hand = new Set<string>([
    ...view.cardsInHand.map((c) => c.name),
    ...(view.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name),
  ]);
  return cards.every((c) => hand.has(c.name));
}

/**
 * Classify the CURRENT top-level server prompt. `undefined` = nothing
 * pending (client-initiated flows — play card, trade, sale — are owned by
 * the shell, not derived here).
 */
export function taskFor(view: PlayerViewModel): ConsoleTask | undefined {
  const wf: PlayerInputModel | undefined = view.waitingFor;
  if (wf === undefined) {
    return undefined;
  }

  // Start-of-game markers outrank the raw type (a marked SelectCard is the
  // START SEQUENCE's, not a generic card pick) — the structural-marker rule.
  const start = wf.startGamePrompt;
  if (start !== undefined) {
    return {kind: 'startSequence', prompt: start.kind};
  }

  switch (wf.type) {
  case 'initialCards':
    return {kind: 'initialDraft'};

  case 'or': {
    const title = inputTitleText(wf.title) ?? '';
    if (ACTION_MENU_TITLES.includes(title)) {
      return {kind: 'actionMenu'};
    }
    if (wf.awardFundingPrompt?.free === true) {
      return {kind: 'choice', flavor: 'awardFunding'};
    }
    if (title === WGT_TITLE) {
      return {kind: 'choice', flavor: 'wgt'};
    }
    return {kind: 'choice', flavor: wf.choiceContext !== undefined ? 'contextual' : 'generic'};
  }

  case 'option':
    return {kind: 'choice', flavor: 'confirm'};
  case 'player':
    return {kind: 'player'};
  case 'amount':
    return {kind: 'amount', flavor: 'generic'};
  case 'deltaProject':
    // The Hydronetwork energy stepper — the amount family (normally
    // pre-answered by the hydro confirm batch; standalone = a divergence).
    return {kind: 'amount', flavor: 'delta'};
  case 'resource':
    return {kind: 'resource'};
  case 'resources':
    return {kind: 'distribute', mode: 'resources'};
  case 'productionToLose':
    return {kind: 'distribute', mode: 'production'};
  case 'payment':
    return {kind: 'payment'};

  case 'projectCard': {
    // Play-from-hand (EccentricSponsor/EcologyExperts) vs the standalone
    // standard-project prompt (EstablishedMethods) — the PlayerHome
    // dedicated-overlay split, reproduced structurally.
    return {kind: 'projectCard', mode: isHandSubset(view, wf.cards) ? 'playFromHand' : 'standardProject'};
  }

  case 'card': {
    const title = inputTitleText(wf.title) ?? '';
    const buttonLabel = wf.buttonLabel ?? '';
    if (isHandSubset(view, wf.cards)) {
      return {kind: 'cardSelect', mode: 'select'};
    }
    if (buttonLabel === 'Keep') {
      return {kind: 'cardSelect', mode: 'draft'};
    }
    if (title.includes('to buy')) {
      return {kind: 'cardSelect', mode: 'buy'};
    }
    return {kind: 'cardSelect', mode: 'target'};
  }

  case 'space':
    return {kind: 'space'};
  case 'colony':
    return {kind: 'colony'};
  case 'and':
    return {kind: 'composite'};
  case 'aresGlobalParameters':
    return {kind: 'aresGlobal'};

  // Out-of-module-scope prompt families (Turmoil / Underworld / global
  // events) — the honest guard, never a silent dead end.
  case 'delegate':
  case 'party':
  case 'globalEvent':
  case 'claimedUndergroundToken':
  default:
    return {kind: 'unknown', inputType: wf.type};
  }
}

/**
 * Is the current prompt served natively by the console shell already?
 * (Everything else must show SOME surface — a fallback modal during the
 * CTS rollout, the guard panel when nothing exists — the leak detector's
 * stranded-prompt check enforces exactly that.)
 */
export function isNativelyHandled(task: ConsoleTask | undefined): boolean {
  return task !== undefined && NATIVE_KINDS.has(task.kind);
}

/**
 * Does the ConsoleTaskHost FULLY serve this prompt? True for the T1
 * primitives + the T2 card browser + the T3 payment lanes + (T9) a
 * `choice` whose options nest HOSTABLE inputs — the host opens them as a
 * ONE-LEVEL wizard step (pick the branch → complete the nested input →
 * the response is or-wrapped; B returns to the list). The remaining
 * honest carve-out is COMPOSITES: an `and` option (combined multi-child
 * submit — the same gap the desktop premium system defers to its legacy
 * AndOptions.vue) and DEEPER `or` nesting stay on the desktop modal.
 * Leaf options (`option`) and board picks (`space` — routed through the
 * shell's headless SelectSpace) are served as before. The shell
 * suppresses the desktop modal EXACTLY when this returns a task (no dead
 * ends, ever). SHELL_SECTION_KINDS (projectCard / colony) are native too
 * but served by shell SECTIONS, not this host.
 */
export function taskServedByHost(view: PlayerViewModel): ConsoleTask | undefined {
  const task = taskFor(view);
  if (task === undefined) {
    return undefined;
  }
  switch (task.kind) {
  case 'player':
  case 'amount':
  case 'resource':
  case 'distribute':
  case 'cardSelect': // T2: the card browser (draft / buy / select / target)
  case 'payment': // T3: the native payment lanes (SelectPayment prompts)
    return task;
  case 'choice': {
    const wf = view.waitingFor;
    if (wf?.type === 'option') {
      return task; // bare confirm — always a leaf
    }
    if (wf?.type === 'or') {
      const served = wf.options.every((o) => NESTABLE_OPTION_TYPES.has(o.type));
      return served ? task : undefined;
    }
    return undefined;
  }
  default:
    return undefined;
  }
}
