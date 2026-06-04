/*
 * Single source of truth for the Start Game Flow — the premium App-level
 * orchestration modal that walks a player through the start of generation 1
 * (play their preludes, apply the corporation's mandatory first action, then a
 * final "begin the game" confirmation).
 *
 * This module owns BOTH the reactive UI state AND the prompt-detection
 * predicates, so the overlay (StartGameFlowOverlay.vue) and the two
 * legacy-route-suppression sites (DraftFlowOverlay / WaitingFor) all read one
 * implementation. Mirrors the module-state pattern of draftWaitState.ts /
 * handCards/handSelectState.ts so the flow survives the playerkey++ remount.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {isInitialDraftAwaiting} from '@/client/components/initialDraft/initialDraftSharedState';

// Server-side prompt strings we match on. The prelude title is built by
// PreludesExpansion.selectPreludeToPlay; the corp option title by Player.ts.
const PRELUDE_PROMPT_TITLE = 'Select prelude card to play';
const CORP_FIRST_ACTION_PREFIX = 'Take first action of';
const ACTION_MENU_TITLES: ReadonlySet<string> = new Set([
  'Take your first action',
  'Take your next action',
]);

type StartGameFlowStateShape = {
  // Player ids (PlayerViewModel.id) whose start flow has been ENTERED. Sticky —
  // keeps the modal mounted across prelude → sub-action → waiting → corp → first
  // turn. PER-PLAYER (not a single boolean) because the module is shared across
  // every player viewed in the SAME client (hot-seat / player switch): a global
  // latch would leak one player's state onto another.
  activatedPlayers: Array<string>;
  // Player ids who pressed "begin the game". PER-PLAYER for the same reason — a
  // single boolean made player 1 pressing "begin" unmount/disable player 2's
  // flow (and let the legacy corp modal leak back in).
  completedPlayers: Array<string>;
  // True while a focused sub-action (placement / colony / payment / play-a-card)
  // is the active prompt — the modal collapses to a thin pill so the dedicated
  // surface (PlacementBanner / ColoniesOverlay / MandatoryInputModal) owns the
  // viewport. Single transient value: always reflects the currently-viewed
  // player (re-derived by the overlay watcher on every view change).
  minimized: boolean;
};

export const startGameFlowState: StartGameFlowStateShape = reactive({
  activatedPlayers: [],
  completedPlayers: [],
  minimized: false,
});

export function resetStartGameFlow(): void {
  startGameFlowState.activatedPlayers = [];
  startGameFlowState.completedPlayers = [];
  startGameFlowState.minimized = false;
}

/** Latch this player's flow as entered (called by the overlay when eligible). */
export function markStartFlowActivated(id: string): void {
  if (!startGameFlowState.activatedPlayers.includes(id)) {
    startGameFlowState.activatedPlayers.push(id);
  }
}

/** Mark this player as having pressed "begin the game". */
export function markStartFlowCompleted(id: string): void {
  if (!startGameFlowState.completedPlayers.includes(id)) {
    startGameFlowState.completedPlayers.push(id);
  }
}

function titleText(t: string | Message | undefined): string {
  if (t === undefined) {
    return '';
  }
  return typeof t === 'string' ? t : t.message;
}

/**
 * The current waitingFor IS the start-flow prelude prompt:
 *   title === 'Select prelude card to play' AND every candidate is one of the
 *   player's own awaiting preludes (preludeCardsInHand). The second clause is
 *   load-bearing: ValleyTrust's prelude draws 3 FRESH preludes (NOT in
 *   preludeCardsInHand) reusing the same title — that nested in-card choice must
 *   keep its normal surface, so it fails here.
 */
export function startFlowPreludePrompt(view: PlayerViewModel | undefined): SelectCardModel | undefined {
  if (view === undefined) {
    return undefined;
  }
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'card') {
    return undefined;
  }
  if (titleText(wf.title) !== PRELUDE_PROMPT_TITLE) {
    return undefined;
  }
  const owed = new Set(view.preludeCardsInHand.map((c) => c.name));
  if (wf.cards.length === 0 || owed.size === 0) {
    return undefined;
  }
  if (!wf.cards.every((c) => owed.has(c.name))) {
    return undefined;
  }
  return wf;
}

/**
 * The current waitingFor IS the corp first-action OrOptions
 * ('Take first action of X corporation'). Matched by an option whose title
 * starts with the template head, so it's corp-agnostic and needs no `source`.
 */
export function startFlowCorpPrompt(view: PlayerViewModel | undefined): OrOptionsModel | undefined {
  if (view === undefined) {
    return undefined;
  }
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'or') {
    return undefined;
  }
  const looksLikeCorpFirstAction = wf.options.some(
    (o) => titleText(o.title).startsWith(CORP_FIRST_ACTION_PREFIX));
  return looksLikeCorpFirstAction ? wf : undefined;
}

/**
 * Index of the corp-action option inside the corp OrOptions — the option whose
 * title starts with the template head, NEVER the Pass option ('Pass for this
 * generation'). Returns -1 if not found.
 */
export function corpActionOptionIndex(prompt: OrOptionsModel | undefined): number {
  if (prompt === undefined) {
    return -1;
  }
  return prompt.options.findIndex(
    (o) => titleText(o.title).startsWith(CORP_FIRST_ACTION_PREFIX));
}

export type PreludeStatus = 'awaiting' | 'playable' | 'played';

export type PreludeEntry = {
  name: CardName;
  status: PreludeStatus;
};

/**
 * The player's prelude set for stable display: played preludes (tableau cards
 * whose ClientCard.type === PRELUDE) first, then still-awaiting preludes
 * (preludeCardsInHand). A still-awaiting prelude is 'playable' when it's a
 * candidate of the live prelude prompt, else 'awaiting'. Filtering tableau by
 * type excludes the corporation + every project card. No cap — we show the
 * truth (a ValleyTrust-played extra prelude shows as played).
 */
export function preludeEntries(view: PlayerViewModel): ReadonlyArray<PreludeEntry> {
  const prompt = startFlowPreludePrompt(view);
  const playableNames = new Set((prompt?.cards ?? []).map((c) => c.name));

  const played: Array<PreludeEntry> = [];
  for (const c of view.thisPlayer.tableau) {
    if (getCard(c.name)?.type === CardType.PRELUDE) {
      played.push({name: c.name, status: 'played'});
    }
  }
  const awaiting: Array<PreludeEntry> = view.preludeCardsInHand.map((c) => ({
    name: c.name,
    status: playableNames.has(c.name) ? 'playable' : 'awaiting',
  }));
  return [...played, ...awaiting];
}

/** The corporation card on this player's tableau (CardType.CORPORATION), if any. */
export function corporationCardName(view: PlayerViewModel): CardName | undefined {
  for (const c of view.thisPlayer.tableau) {
    if (getCard(c.name)?.type === CardType.CORPORATION) {
      return c.name;
    }
  }
  return undefined;
}

/**
 * Does the player have a real start-of-game sequence to orchestrate? TRUE iff
 * generation 1 AND (owes a prelude OR owes a corp first action OR is mid-prompt
 * for either). FALSE when 0 preludes AND no pending corp action — so the modal
 * NEVER appears (e.g. prelude expansion off and the corp has no first action).
 */
export function startGameFlowEligible(view: PlayerViewModel | undefined): boolean {
  if (view === undefined) {
    return false;
  }
  if (view.game.generation !== 1) {
    return false;
  }
  const owesPrelude =
    view.preludeCardsInHand.length > 0 ||
    startFlowPreludePrompt(view) !== undefined;
  const owesCorp =
    view.pendingInitialActions.length > 0 ||
    startFlowCorpPrompt(view) !== undefined;
  return owesPrelude || owesCorp;
}

/**
 * Should the overlay be MOUNTED right now? Sticky activation: once eligible in
 * gen 1, `activated` latches and keeps it mounted across the whole sequence.
 * Unmounts only when `completed` or the game left generation 1. Never shows
 * during the initial-draft awaiting window (that surface owns the screen).
 */
export function startGameFlowActive(view: PlayerViewModel | undefined): boolean {
  if (view === undefined) {
    return false;
  }
  // Keyed by the VIEWED player's id so a different player's "begin"/latch in the
  // same client can never disable this player's flow (the hot-seat leak bug).
  if (startGameFlowState.completedPlayers.includes(view.id)) {
    return false;
  }
  if (view.game.generation !== 1) {
    return false;
  }
  if (isInitialDraftAwaiting(view)) {
    return false;
  }
  return startGameFlowState.activatedPlayers.includes(view.id) || startGameFlowEligible(view);
}

/**
 * Outstanding-work test gating the "begin the game" button: all preludes played
 * (none awaiting, no prelude prompt) AND no corp action owed (pending empty, no
 * corp prompt).
 */
export function startGameFlowAllDone(view: PlayerViewModel): boolean {
  const preludesDone =
    view.preludeCardsInHand.length === 0 &&
    startFlowPreludePrompt(view) === undefined;
  const corpDone =
    view.pendingInitialActions.length === 0 &&
    startFlowCorpPrompt(view) === undefined;
  return preludesDone && corpDone;
}

/**
 * Is the active prompt a FOCUSED sub-action the modal must step aside for
 * (board placement / colony / payment / play-a-card / generic mandatory input)?
 * TRUE when waitingFor is defined AND is neither our prelude prompt nor our corp
 * prompt nor the normal action menu. The dedicated surfaces render it; we
 * collapse to the pill.
 */
export function startFlowHasFocusedSubAction(view: PlayerViewModel | undefined): boolean {
  if (view === undefined) {
    return false;
  }
  const wf: PlayerInputModel | undefined = view.waitingFor;
  if (wf === undefined) {
    return false;
  }
  if (startFlowPreludePrompt(view) !== undefined) {
    return false;
  }
  if (startFlowCorpPrompt(view) !== undefined) {
    return false;
  }
  if (ACTION_MENU_TITLES.has(titleText(wf.title))) {
    return false;
  }
  return true;
}
