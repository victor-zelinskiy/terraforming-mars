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
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel, OrOptionsModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {ACTION_MENU_TITLES} from '@/common/inputs/actionMenuTitles';
import {getCard} from '@/client/cards/ClientCardManifest';
import {isInitialDraftAwaiting} from '@/client/components/initialDraft/initialDraftSharedState';

// The per-turn action menu titles are the ONE shared source of truth
// (`@/common/inputs/actionMenuTitles`). Its OrOptions TITLE (unlike the corp
// OPTION titles) is a plain string NOT mutated in place by i18n, so matching it
// is safe — used only to tell the action menu apart from a focused sub-action
// (both are 'or') when deciding whether to collapse to the pill.

function titleText(t: string | Message | undefined): string {
  if (t === undefined) {
    return '';
  }
  return typeof t === 'string' ? t : t.message;
}

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
  // RESOLVED drew-N-choose-ONE prelude decisions (New Partner / Valley Trust).
  // Captured client-side at pick time because the server immediately discards
  // the non-chosen cards — they vanish from playerView — yet we still want to
  // show the player which prelude was РАЗЫГРАНА and which were СБРОШЕНА. Kept
  // per-player; cleared on completion / reset.
  drawChoices: Array<DrawChoiceRecord>;
};

/** A resolved drew-N-choose-ONE prelude decision, for the post-pick display. */
export type DrawChoiceRecord = {
  ownerId: string;
  candidates: ReadonlyArray<CardName>;
  chosen: CardName;
};

export const startGameFlowState: StartGameFlowStateShape = reactive({
  activatedPlayers: [],
  completedPlayers: [],
  minimized: false,
  drawChoices: [],
});

/*
 * STABLE display order of each player's starting preludes (per player id),
 * append-only: a prelude's slot is fixed the first time it appears and NEVER
 * reorders, so playing it only flips its visual status (it does NOT jump to the
 * front). Deliberately NON-reactive — `preludeEntries` records into it during a
 * computed, and a reactive write there would re-trigger the computed; the
 * non-reactive store mutates quietly and is read back on the next natural
 * re-run (driven by tableau/hand changes).
 */
const preludeOrderStore = new Map<string, Array<CardName>>();

export function resetStartGameFlow(): void {
  startGameFlowState.activatedPlayers = [];
  startGameFlowState.completedPlayers = [];
  startGameFlowState.minimized = false;
  startGameFlowState.drawChoices = [];
  preludeOrderStore.clear();
}

/** Record a resolved draw-choice (called at pick time, before submitting). */
export function recordDrawChoice(ownerId: string, candidates: ReadonlyArray<CardName>, chosen: CardName): void {
  startGameFlowState.drawChoices.push({ownerId, candidates: [...candidates], chosen});
}

/** Resolved draw-choices for a given player (newest last). */
export function drawChoicesFor(ownerId: string): ReadonlyArray<DrawChoiceRecord> {
  return startGameFlowState.drawChoices.filter((r) => r.ownerId === ownerId);
}

/** All candidate names across a player's draw-choices — excluded from the grid. */
export function drawChoiceCandidateNames(ownerId: string): ReadonlySet<CardName> {
  const names = new Set<CardName>();
  for (const r of startGameFlowState.drawChoices) {
    if (r.ownerId === ownerId) {
      for (const c of r.candidates) {
        names.add(c);
      }
    }
  }
  return names;
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
  // The draw-choice history + stable order were only for this flow's display —
  // drop them so they can't leak into a later game in the same client session.
  startGameFlowState.drawChoices = startGameFlowState.drawChoices.filter((r) => r.ownerId !== id);
  preludeOrderStore.delete(id);
}

/**
 * A start-flow prelude selection of the given mode, detected PURELY via the
 * explicit server marker (`startGamePrompt`) — never the (translatable) title.
 *   'hand' = the player's own starting preludes (played one at a time → the grid);
 *   'draw' = drew N, choose ONE, discard the rest (New Partner / Valley Trust);
 *   'copy' = pick one already-played prelude to copy (Double Down) — the source
 *            STAYS in the grid, nothing is discarded.
 */
function preludeSelectionPrompt(view: PlayerViewModel | undefined, mode: 'hand' | 'draw' | 'copy'): SelectCardModel | undefined {
  if (view === undefined) {
    return undefined;
  }
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'card') {
    return undefined;
  }
  const m = wf.startGamePrompt;
  return (m?.kind === 'preludeSelection' && m.preludeMode === mode) ? wf : undefined;
}

/** Start-flow 'play your starting preludes' prompt (drives the grid). */
export function startFlowPreludePrompt(view: PlayerViewModel | undefined): SelectCardModel | undefined {
  return preludeSelectionPrompt(view, 'hand');
}

/** Start-flow 'drew N preludes — choose ONE' prompt (New Partner / Valley Trust). */
export function startFlowPreludeDrawPrompt(view: PlayerViewModel | undefined): SelectCardModel | undefined {
  return preludeSelectionPrompt(view, 'draw');
}

/** Start-flow 'pick a played prelude to copy' prompt (Double Down). */
export function startFlowPreludeCopyPrompt(view: PlayerViewModel | undefined): SelectCardModel | undefined {
  return preludeSelectionPrompt(view, 'copy');
}

/** Any start-flow prelude prompt — hand / draw / copy (used by suppression). */
export function startFlowAnyPreludePrompt(view: PlayerViewModel | undefined): SelectCardModel | undefined {
  return startFlowPreludePrompt(view) ?? startFlowPreludeDrawPrompt(view) ?? startFlowPreludeCopyPrompt(view);
}

/**
 * The current waitingFor IS the corp first-action OrOptions — detected PURELY
 * via the explicit server marker. Translation-proof; no title/token matching.
 */
export function startFlowCorpPrompt(view: PlayerViewModel | undefined): OrOptionsModel | undefined {
  if (view === undefined) {
    return undefined;
  }
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'or') {
    return undefined;
  }
  return wf.startGamePrompt?.kind === 'corporationInitialAction' ? wf : undefined;
}

/**
 * Index of the corp-action option inside the corp OrOptions — the option that
 * does NOT carry the 'pass' warning (the Pass option always does). Structural &
 * translation-proof. Returns -1 if not found. Used for the single-corp case.
 */
export function corpActionOptionIndex(prompt: OrOptionsModel | undefined): number {
  if (prompt === undefined) {
    return -1;
  }
  return (prompt.options ?? []).findIndex(
    (o) => !((o as SelectOptionModel).warnings ?? []).includes('pass'));
}

/** Card names referenced by an option title's CARD data tokens (NOT translated). */
function titleCardNames(title: string | Message | undefined): ReadonlyArray<string> {
  if (title === undefined || typeof title === 'string') {
    return [];
  }
  return (title.data ?? [])
    .filter((d) => d.type === LogMessageDataType.CARD)
    .map((d) => String(d.value));
}

/**
 * Index of the option inside the corp OrOptions that applies a SPECIFIC corp's
 * first action — matched by the CARD token in the option title (the corp name,
 * which i18n never translates). Needed when the player has MORE than one corp
 * owing an action (Merger): each gets its own ПРИМЕНИТЬ ЭФФЕКТ button. -1 if not
 * present (that corp isn't currently offered).
 */
export function corpActionOptionIndexFor(prompt: OrOptionsModel | undefined, corpName: CardName): number {
  if (prompt === undefined) {
    return -1;
  }
  return (prompt.options ?? []).findIndex(
    (o) => titleCardNames(o.title).includes(corpName));
}

/**
 * The current waitingFor IS the 'choose an additional corporation' SelectCard
 * (Merger) — detected via the explicit server marker. Unaffordable corps arrive
 * with `isDisabled` on their CardModel.
 */
export function startFlowCorpSelectPrompt(view: PlayerViewModel | undefined): SelectCardModel | undefined {
  if (view === undefined) {
    return undefined;
  }
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'card') {
    return undefined;
  }
  return wf.startGamePrompt?.kind === 'corporationSelection' ? wf : undefined;
}

export type PreludeStatus = 'awaiting' | 'playable' | 'played';

export type PreludeEntry = {
  name: CardName;
  status: PreludeStatus;
  // A 'playable' prelude that would FIZZLE right now (server `preludeFizzle`
  // warning — e.g. Double Down with nothing yet to copy) AND there is a better,
  // non-fizzling prelude still to play. Its РАЗЫГРАТЬ is disabled so the player
  // plays the productive one first. NOT set when every remaining prelude would
  // fizzle (then the player must be allowed to play one — no trap).
  blocked: boolean;
};

/**
 * The player's STARTING prelude set for the grid, in a STABLE order: a prelude's
 * slot is fixed the first time it appears (`preludeOrderStore`, append-only) and
 * NEVER moves — playing it only flips its visual status from playable/awaiting to
 * played, it does NOT jump to the front. Statuses: played = a tableau card whose
 * ClientCard.type === PRELUDE; awaiting/playable = a `preludeCardsInHand` card
 * ('playable' when it's a candidate of the live prelude prompt). Filtering by
 * type excludes the corporation + project cards. Drew-N-choose-ONE preludes
 * (New Partner / Valley Trust) are EXCLUDED (their own block); Double Down copy
 * candidates are already-played preludes and DO stay (they're not draw-choices).
 */
export function preludeEntries(view: PlayerViewModel): ReadonlyArray<PreludeEntry> {
  const candidates = startFlowPreludePrompt(view)?.cards ?? [];
  const playableNames = new Set(candidates.map((c) => c.name));
  // Candidates the server flagged as 'preludeFizzle' — they'd do nothing now
  // (Double Down with nothing to copy; a prelude with unmet requirements).
  const fizzleNames = new Set(
    candidates.filter((c) => (c.warnings ?? []).includes('preludeFizzle')).map((c) => c.name));
  const drawNames = drawChoiceCandidateNames(view.id);

  // Current name → status (insertion order: played, then hand — only used the
  // FIRST time a name is seen, to seed its permanent slot).
  const statusByName = new Map<CardName, PreludeStatus>();
  for (const c of view.thisPlayer.tableau) {
    if (getCard(c.name)?.type === CardType.PRELUDE && !drawNames.has(c.name)) {
      statusByName.set(c.name, 'played');
    }
  }
  for (const c of view.preludeCardsInHand ?? []) {
    statusByName.set(c.name, playableNames.has(c.name) ? 'playable' : 'awaiting');
  }

  // Append any newly-seen prelude to this player's permanent order, then render
  // in that order so positions never shuffle as cards move hand → tableau.
  let order = preludeOrderStore.get(view.id);
  if (order === undefined) {
    order = [];
    preludeOrderStore.set(view.id, order);
  }
  for (const name of statusByName.keys()) {
    if (!order.includes(name)) {
      order.push(name);
    }
  }

  const entries: Array<PreludeEntry> = [];
  for (const name of order) {
    const status = statusByName.get(name);
    if (status !== undefined) {
      entries.push({name, status, blocked: false});
    }
  }
  // Block a would-fizzle playable prelude ONLY while a non-fizzling playable
  // alternative exists — so the player plays the productive prelude first, but
  // is never trapped when everything left would fizzle.
  const hasNonFizzlePlayable = entries.some((e) => e.status === 'playable' && !fizzleNames.has(e.name));
  if (hasNonFizzlePlayable) {
    for (const e of entries) {
      if (e.status === 'playable' && fizzleNames.has(e.name)) {
        e.blocked = true;
      }
    }
  }
  return entries;
}

/** Every corporation on this player's tableau (CardType.CORPORATION), in play
 * order (base corp first, then any merged corp from Merger). */
export function corporationCardNames(view: PlayerViewModel): ReadonlyArray<CardName> {
  const names: Array<CardName> = [];
  for (const c of view.thisPlayer.tableau) {
    if (getCard(c.name)?.type === CardType.CORPORATION) {
      names.push(c.name);
    }
  }
  return names;
}

/** The (first) corporation on this player's tableau, if any. */
export function corporationCardName(view: PlayerViewModel): CardName | undefined {
  return corporationCardNames(view)[0];
}

export type CorpStatus = 'ready' | 'pending' | 'done';

/**
 * A specific corp's start-effect status: 'ready' = the live corp OrOptions has
 * an option for THIS corp (apply now); 'pending' = it still owes its action but
 * isn't promptable yet; 'done' = no action owed (applied, or never had one).
 */
export function corpStatusFor(view: PlayerViewModel, corpName: CardName): CorpStatus {
  const prompt = startFlowCorpPrompt(view);
  if (prompt !== undefined && corpActionOptionIndexFor(prompt, corpName) !== -1) {
    return 'ready';
  }
  if ((view.pendingInitialActions ?? []).includes(corpName)) {
    return 'pending';
  }
  return 'done';
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
  // Guard against undefined — an older server (not yet restarted after the
  // model change) omits `pendingInitialActions`; `preludeCardsInHand` is always
  // present, but guarded too for safety. Detection must NEVER throw inside a
  // computed (it would break WaitingFor's render and leak the legacy modal).
  const owesPrelude =
    (view.preludeCardsInHand ?? []).length > 0 ||
    startFlowAnyPreludePrompt(view) !== undefined;
  const owesCorp =
    (view.pendingInitialActions ?? []).length > 0 ||
    startFlowCorpPrompt(view) !== undefined ||
    startFlowCorpSelectPrompt(view) !== undefined;
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
    (view.preludeCardsInHand ?? []).length === 0 &&
    startFlowAnyPreludePrompt(view) === undefined;
  const corpDone =
    (view.pendingInitialActions ?? []).length === 0 &&
    startFlowCorpPrompt(view) === undefined &&
    startFlowCorpSelectPrompt(view) === undefined;
  return preludesDone && corpDone;
}

/**
 * Is the active prompt a FOCUSED sub-action the modal must step aside for
 * (board placement / colony / payment / play-a-card / generic mandatory input)?
 * TRUE when waitingFor is defined AND is none of our own start-flow prompts AND
 * not the per-turn action menu. The dedicated surfaces render it; we collapse to
 * the pill. (A sub-action can fire even when `allDone` is true — e.g. the corp
 * action was answered, pendingInitialActions is already empty, and the deferred
 * placement is now resolving — so this must NOT gate on allDone.)
 */
export function startFlowHasFocusedSubAction(view: PlayerViewModel | undefined): boolean {
  if (view === undefined) {
    return false;
  }
  const wf = view.waitingFor;
  if (wf === undefined) {
    return false;
  }
  if (startFlowAnyPreludePrompt(view) !== undefined) {
    return false;
  }
  if (startFlowCorpPrompt(view) !== undefined) {
    return false;
  }
  if (startFlowCorpSelectPrompt(view) !== undefined) {
    return false;
  }
  if (ACTION_MENU_TITLES.has(titleText(wf.title))) {
    return false;
  }
  return true;
}
