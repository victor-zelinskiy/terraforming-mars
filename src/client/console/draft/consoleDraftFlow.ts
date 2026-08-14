/*
 * THE DRAFT WORKSPACE FLOW — the pure derivations and the module-reactive
 * state of the between-generations draft workspace («ДРАФТ»).
 *
 * The workspace is a PHASE-anchored root (like the start workspace): it IS
 * the inter-generation sequence — every pick round, the waits between them,
 * the research buy and the completion beats are stages of ONE flow, so the
 * player never returns to the planet between micro-steps.
 *
 * SERVER TRUTH ONLY. Every stage here is derived from `playerView` structure:
 * the game phase, the `draftPrompt` marker (`Draft.askPlayerToDraft` — the
 * one funnel every draft pick goes through), `optional` (the re-pick offer =
 * «waiting for the others»), and the `buyMode` research prompt. The module
 * never simulates a next packet and never re-implements draft rules — the
 * only client-side additions are LATCHES of values the server already stated
 * (the pick total, the pass direction) so the flow rail stays whole during
 * the waits, plus presentation memory (which packets were already animated).
 *
 * PURE + a small reactive record (the console module-state pattern): the
 * shell and the workspace component both read the same answers, and the pure
 * half is unit-tested under the fast server runner (no Vue imports — the
 * journey types are structural twins of ConsoleJourneyRail's).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {DraftPromptMeta, SelectCardModel} from '@/common/models/PlayerInputModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
// Type-only on purpose: this module stays Vue-free at runtime (the fast
// server-runner spec), and the gate's reactive store must not be dragged in.
import type {MandatoryFlowBeat} from '@/client/console/consoleMandatoryGate';

// ── journey types (structural twins of ConsoleJourneyRail's exports — no
//    .vue import so this module stays pure and server-runner-testable) ──────

export type DraftJourneyItemState = 'completed' | 'current' | 'available' | 'locked';
export type DraftJourneyItem = {id: string, label: string, state: DraftJourneyItemState};
export type DraftJourneyPhase = {
  id: string,
  ordinal: string,
  label: string,
  state: 'completed' | 'current' | 'waiting' | 'locked',
  mode: 'tabs' | 'progress',
  items: ReadonlyArray<DraftJourneyItem>,
};
export type DraftCompactContext = {ordinal: string, phaseLabel: string, itemLabel: string};
export type DraftPresentation = 'expanded' | 'compact' | 'complete';

// ── stage derivation (structural, server-authoritative) ─────────────────────

/**
 * Where the flow stands. Every value is a statement about SERVER structure:
 *  - 'pick' — a required draft pick is in front of the player;
 *  - 'wait' — the pick is locked (the optional re-pick offer, which the fork
 *             deliberately does not surface) or the round-trip is in flight;
 *  - 'buy'  — the research buy prompt over the drafted set;
 *  - 'idle' — the frame lives but another surface owns the prompt (the
 *             Underworld research swap choice, the completion beats).
 */
export type DraftStage = 'pick' | 'wait' | 'buy' | 'idle';

function asCardInput(wf: PlayerViewModel['waitingFor']): SelectCardModel | undefined {
  return wf !== undefined && wf.type === 'card' ? wf : undefined;
}

/** The REQUIRED pick in front of the player ('pick' stage), else undefined. */
export function draftPickInput(view: PlayerViewModel): SelectCardModel | undefined {
  const wf = asCardInput(view.waitingFor);
  if (wf === undefined || wf.draftPrompt === undefined || wf.optional === true) {
    return undefined;
  }
  return wf;
}

/** The optional re-pick offer = «waiting for the other players». */
export function draftWaitInput(view: PlayerViewModel): SelectCardModel | undefined {
  const wf = asCardInput(view.waitingFor);
  if (wf === undefined || wf.draftPrompt === undefined || wf.optional !== true) {
    return undefined;
  }
  return wf;
}

/** The research BUY prompt (phase RESEARCH, `buyMode` — ChooseCards). */
export function draftBuyInput(view: PlayerViewModel): SelectCardModel | undefined {
  if (view.game.phase !== Phase.RESEARCH) {
    return undefined;
  }
  const wf = asCardInput(view.waitingFor);
  if (wf === undefined || wf.buyMode !== true) {
    return undefined;
  }
  return wf;
}

/**
 * Is the between-generations draft flow ALIVE for this player — the frame-
 * lifetime half the shell's watcher reads (the completion beats extend it
 * via `draftCompletionHolding`).
 *
 * `generation >= 2` is load-bearing: the initial-cards selection ALSO runs in
 * phase RESEARCH (generation 1) and must stay the start workspace's business.
 * The INITIALDRAFTING phase (pre-game packet draft) keeps its own flow too.
 */
export function betweenGenDraftLive(view: PlayerViewModel): boolean {
  if (view.game.gameOptions.draftVariant !== true || view.game.generation < 2) {
    return false;
  }
  if (view.game.phase === Phase.DRAFTING) {
    return true;
  }
  // The research that FOLLOWS the draft — alive until this player's buy is
  // answered (covers the Underworld swap choice standing before the buy).
  return view.game.phase === Phase.RESEARCH && view.thisPlayer.needsToResearch === true;
}

/**
 * The draft's PENDING MANDATORY ACTION descriptor (consoleMandatoryGate's flow
 * beat), or undefined while the flow is not live. The workspace never opens
 * itself any more — this derivation is its registration, and the gate's
 * lifecycle does the rest: the announcement waits out the ordinary-notification
 * feed, the player's A runs `enterWorkspace('draft')`, and the flow going dead
 * (the buy answered, or a rollback) is the action's invalidation.
 *
 * The KEY is the WHOLE flow's semantic identity, `draft:gen<N>` — stable
 * across every pick round, the wait and the research buy (the generation is
 * incremented once, before DRAFTING starts), so the flow is announced and
 * opened exactly ONCE per generation, prompt churn notwithstanding. The
 * `taskKind` is nominal (the plate's copy reads the LIVE task via
 * consoleTaskSummary, so pick/wait/buy each name themselves).
 */
export function draftMandatoryFlowBeat(view: PlayerViewModel): MandatoryFlowBeat | undefined {
  if (!betweenGenDraftLive(view)) {
    return undefined;
  }
  return {key: `draft:gen${view.game.generation}`, taskKind: 'cardSelect', flow: 'draft'};
}

/** The current stage of a LIVE flow (meaningless when it is not live). */
export function draftStageOf(view: PlayerViewModel): DraftStage {
  if (view.game.phase === Phase.DRAFTING) {
    if (draftPickInput(view) !== undefined) {
      return 'pick';
    }
    // The locked pick (optional re-pick) — and the submit round-trip gap,
    // where `waitingFor` is briefly empty: both are honest waits.
    if (draftWaitInput(view) !== undefined || view.waitingFor === undefined) {
      return 'wait';
    }
    return 'idle';
  }
  if (draftBuyInput(view) !== undefined) {
    return 'buy';
  }
  return 'idle';
}

/** The draft marker of the live prompt (pick or wait), if any. */
export function draftMarkerOf(view: PlayerViewModel): DraftPromptMeta | undefined {
  const wf = asCardInput(view.waitingFor);
  return wf?.draftPrompt;
}

/**
 * The identity of the packet in front of the player — the presentation-memory
 * key (deal-once semantics across repeated real-time updates). Card names are
 * folded in because the between-generation draft reuses ONE prompt identity
 * across rounds.
 */
export function draftPacketKey(view: PlayerViewModel): string {
  const pick = draftPickInput(view);
  if (pick === undefined) {
    return '';
  }
  const names = pick.cards.map((c) => c.name).slice().sort().join('+');
  return `${view.game.generation}|${view.draftedCards.length}|${names}`;
}

/** Resolve a circle neighbor's public model by color. */
export function draftNeighbor(view: PlayerViewModel, color: Color | undefined): PublicPlayerModel | undefined {
  if (color === undefined) {
    return undefined;
  }
  return view.players.find((p) => p.color === color);
}

/**
 * The soft requirements HEADS-UP for a focused card: the first PRINTED CARD
 * REQUIREMENT that is not met (the server's own `requirement` marker — set
 * where those reasons are produced, from each `CardRequirement.satisfies`).
 *
 * Everything situational is deliberately dropped: affordability (the money
 * will have changed by the time it matters, and during the buy the economics
 * are the header's story), "no space for the tile", "no valid target", a
 * bespoke rule ("no card action was used this generation" — Project
 * Inspection), the turn/phase. Here the card is being taken FOR LATER, so
 * only what is written ON it can be a fair warning; a momentary blocker
 * would be a lie about the card.
 *
 * A warning, never a blocker: the card can always be taken and bought.
 */
export function requirementHeadsUp(card: CardModel | undefined): UnplayableReason | undefined {
  const reasons = card?.unplayableReasons;
  if (reasons === undefined) {
    return undefined;
  }
  return reasons.find((r) => r.requirement === true);
}

// ── the flow rail (ConsoleJourneyRail data) ─────────────────────────────────

export type DraftJourneyInput = {
  /** The latched pick total (flow-rail substeps). 0 = not yet known. */
  total: number,
  /** Picks locked in so far (server `draftedCards.length`, optimistic-adjusted
   *  by the caller while a pick beat is in flight). */
  picked: number,
  stage: DraftStage,
  /** The purchase commit state ('flights' = cards leaving, 'done' = terminal). */
  completion: 'none' | 'flights' | 'done',
};

/**
 * The two-chapter flow: `01 ВЫБОР: 1 → 2 → … → N` → `02 ПОКУПКА → ГОТОВО`.
 * Substeps mirror the REAL pick count (the marker's `total` — stable across
 * keep-2 rounds and the auto-pushed last card), never a hardcoded 4.
 */
export function draftJourneyPhases(input: DraftJourneyInput): ReadonlyArray<DraftJourneyPhase> {
  const total = Math.max(input.total, input.picked, 1);
  const buyLive = input.stage === 'buy' || input.completion !== 'none';
  const picksDone = buyLive || input.picked >= total;

  const items: Array<DraftJourneyItem> = [];
  for (let i = 0; i < total; i++) {
    let state: DraftJourneyItemState;
    if (picksDone || i < input.picked) {
      state = 'completed';
    } else if (i === input.picked && input.stage === 'pick') {
      state = 'current';
    } else {
      state = 'locked';
    }
    // Bare number nodes («1 → 2 → 3 → 4») — the node figure carries the label.
    items.push({id: `pick-${i + 1}`, label: '', state});
  }

  const done = input.completion === 'done';
  return [
    {
      id: 'picks', ordinal: '01', label: 'Card selection', mode: 'progress',
      state: picksDone ? 'completed' : (input.stage === 'wait' ? 'waiting' : 'current'),
      items,
    },
    {
      id: 'purchase', ordinal: '02', label: 'Purchase', mode: 'progress',
      state: done ? 'completed' : (buyLive ? 'current' : 'locked'),
      // ONE terminal node: the endpoint ring the whole flow runs toward.
      items: [{id: 'ready', label: 'Ready', state: done ? 'completed' : (input.completion === 'flights' ? 'current' : 'locked')}],
    },
  ];
}

export function draftFlowPresentation(input: {completion: 'none' | 'flights' | 'done', inspecting: boolean}): DraftPresentation {
  if (input.completion === 'done') {
    return 'complete';
  }
  return input.inspecting ? 'compact' : 'expanded';
}

/** The compact one-line context while the LT sub-stage owns the screen. */
export function draftCompactContext(input: DraftJourneyInput): DraftCompactContext {
  if (input.stage === 'buy' || input.completion !== 'none') {
    return {ordinal: '02', phaseLabel: 'Purchase', itemLabel: 'Selected cards'};
  }
  return {ordinal: '01', phaseLabel: 'Card selection', itemLabel: 'Selected cards'};
}

// ── the breadcrumb (ДРАФТ › <ЭТАП> [› ОСМОТР]) ─────────────────────────────

export type DraftCrumb = {subject: string, stage: string, committed: boolean};

/**
 * Stable context BEFORE the mutable stage (the one workspace grammar):
 * `ДРАФТ › ВЫБОР КАРТ` → `… › ВЫБОР КАРТ › ПЕРЕДАЧА` → `… › ПОКУПКА` →
 * `… › ОТОБРАННЫЕ › ОСМОТР` (LT) → `… › ПОКУПКА › ГОТОВО`.
 * `committed` = the tail describes a move that cannot be unmade (amber).
 */
export function draftCrumb(input: {stage: DraftStage, inspecting: boolean, completion: 'none' | 'flights' | 'done'}): DraftCrumb {
  if (input.inspecting) {
    return {subject: 'Drafted', stage: 'Inspection', committed: false};
  }
  if (input.completion !== 'none') {
    return {subject: 'Purchase', stage: 'Ready', committed: true};
  }
  switch (input.stage) {
  case 'pick':
    return {subject: 'Card selection', stage: '', committed: false};
  case 'wait':
    return {subject: 'Card selection', stage: 'Handover', committed: true};
  case 'buy':
    return {subject: 'Purchase', stage: '', committed: false};
  case 'idle':
    return {subject: 'Card selection', stage: '', committed: false};
  }
}

// ── the module-reactive record ──────────────────────────────────────────────

export const draftWorkspaceState = reactive({
  /** Latched pick total for the CURRENT generation (the marker's `total`). */
  total: 0,
  /** Latched pass metadata (direction / neighbors) for the current generation. */
  meta: undefined as DraftPromptMeta | undefined,
  /** Which generation the latches belong to. */
  generation: 0,
  /**
   * The workspace OBSERVED the live entry into the draft (a phase change under
   * a running session). False after a reload straight into a draft — the
   * current packet then presents instantly, without replaying the entrance.
   */
  sawDraftStart: false,
  /** The LT sub-stage («ОТОБРАННЫЕ › ОСМОТР») owns the staging area. */
  inspecting: false,
  /** The purchase commit's completion beats (frame-lifetime extension). */
  completion: 'none' as 'none' | 'flights' | 'done',
  /**
   * The cards the player has MARKED (the purchase selection, a keep-2 pick).
   *
   * Module state, not component state, because «свернуть» PARKS the stack:
   * the surface unmounts while parked and a fresh one mounts on restore —
   * so a selection living in `data()` is silently thrown away by a button
   * whose whole promise is that the decision stays live. Keyed by the SET
   * (see `draftPicksKey`) so a new prompt can never inherit a stale mark.
   */
  picks: [] as Array<CardName>,
  picksKey: '',
});

/** The identity of the set a selection belongs to — a new packet / a new
 *  generation's buy is a different question, and answers do not carry over. */
export function draftPicksKey(stage: 'pick' | 'buy', generation: number, names: ReadonlyArray<CardName>): string {
  return `${stage}|${generation}|${[...names].sort().join('+')}`;
}

/** Remember the marked cards (survives a collapse → restore). */
export function rememberDraftPicks(key: string, picks: ReadonlyArray<CardName>): void {
  draftWorkspaceState.picksKey = key;
  draftWorkspaceState.picks = [...picks];
}

/** The marks made for THIS set, or none when the question has changed. */
export function recallDraftPicks(key: string): Array<CardName> {
  return draftWorkspaceState.picksKey === key ? [...draftWorkspaceState.picks] : [];
}

/** Packets already presented (entrance played or deliberately skipped). */
const presentedPackets = new Set<string>();

/**
 * Should this packet's ENTRANCE cinematic play? True exactly once per packet
 * identity; marked at the moment of asking (a defer/restore never replays).
 * `hydrated` (the workspace mounted over an already-live draft) presents the
 * current packet instantly but keeps every LATER packet animated.
 */
export function shouldPresentPacket(key: string, opts?: {instant?: boolean}): 'animate' | 'instant' | 'never' {
  if (key === '' || presentedPackets.has(key)) {
    return 'never';
  }
  presentedPackets.add(key);
  return opts?.instant === true ? 'instant' : 'animate';
}

/** Test/observability escape hatch. */
export function hasPresentedPacket(key: string): boolean {
  return presentedPackets.has(key);
}

/**
 * The shell's playerView observer (pre-flush, beside the tray observer):
 * maintains the latches so the flow rail and the pass presentation stay
 * whole through waits, round-trips and reloads.
 */
export function observeDraftWorkspace(prev: PlayerViewModel | undefined, next: PlayerViewModel): void {
  const live = betweenGenDraftLive(next);
  if (!live && draftWorkspaceState.completion === 'none') {
    // Out of the flow entirely (and not holding a completion): reset the
    // per-generation latches so the NEXT draft starts clean.
    if (draftWorkspaceState.total !== 0 || draftWorkspaceState.meta !== undefined) {
      draftWorkspaceState.total = 0;
      draftWorkspaceState.meta = undefined;
      draftWorkspaceState.generation = 0;
    }
    draftWorkspaceState.inspecting = false;
    return;
  }

  const generation = next.game.generation;
  if (generation !== draftWorkspaceState.generation) {
    draftWorkspaceState.total = 0;
    draftWorkspaceState.meta = undefined;
    draftWorkspaceState.generation = generation;
  }

  // The live transition INTO the draft — the entrance cinematic's cue.
  const wasDrafting = prev !== undefined && prev.game.phase === Phase.DRAFTING;
  if (next.game.phase === Phase.DRAFTING && !wasDrafting && prev !== undefined) {
    draftWorkspaceState.sawDraftStart = true;
  }

  const marker = draftMarkerOf(next);
  if (marker !== undefined) {
    draftWorkspaceState.meta = marker;
    if (marker.total > draftWorkspaceState.total) {
      draftWorkspaceState.total = marker.total;
    }
  }
}

/** The purchase commit began — cards are physically leaving the workspace. */
export function beginDraftCompletion(): void {
  draftWorkspaceState.completion = 'flights';
  draftWorkspaceState.inspecting = false;
}

/** Every flight landed — the terminal «ГОТОВО» beat owns the frame. */
export function markDraftCompletionFlightsDone(): void {
  if (draftWorkspaceState.completion === 'flights') {
    draftWorkspaceState.completion = 'done';
  }
}

/** The terminal beat played out — the shell may release the frame. */
export function finishDraftCompletion(): void {
  draftWorkspaceState.completion = 'none';
}

/** The completion beats extend the frame's lifetime past `needsToResearch`. */
export function draftCompletionHolding(): boolean {
  return draftWorkspaceState.completion !== 'none';
}

/** Game-switch boundary / tests. */
export function resetDraftWorkspace(): void {
  draftWorkspaceState.total = 0;
  draftWorkspaceState.meta = undefined;
  draftWorkspaceState.generation = 0;
  draftWorkspaceState.sawDraftStart = false;
  draftWorkspaceState.inspecting = false;
  draftWorkspaceState.completion = 'none';
  draftWorkspaceState.picks = [];
  draftWorkspaceState.picksKey = '';
  presentedPackets.clear();
}

/** Names already collected this draft — the shelf's display list (frozen by
 *  the caller across the research transition, where the server clears them). */
export function draftCollectedNames(view: PlayerViewModel, optimistic: ReadonlyArray<CardName>): ReadonlyArray<CardName> {
  const out: Array<CardName> = view.draftedCards.map((c) => c.name);
  for (const name of optimistic) {
    if (!out.includes(name)) {
      out.push(name);
    }
  }
  return out;
}
