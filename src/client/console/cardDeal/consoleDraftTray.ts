/*
 * CONSOLE DRAFT TRAY — the reactive brain of the premium draft-pick motion
 * (the "selected cards area" the player physically collects cards into).
 *
 * The tray is ONE persistent physical place (top-centre, on the table,
 * UNDER the task modal): during a pick it sits dimmed beneath the modal
 * backdrop; at the pick BEAT the modal chrome dissolves (`tableView`),
 * the chosen card flies hero-style INTO the tray slot and lands; during
 * the draft wait it is fully visible next to the calm banner; and at the
 * draft→research transition the whole pile RISES into the research row
 * (the buy prompt) — the flagship scene.
 *
 * This module owns:
 *  - the reactive tray state (what the ConsoleDraftTray component renders:
 *    server drafted cards + optimistic in-flight additions, held slots,
 *    the frozen scene snapshot, the processing/waiting readouts);
 *  - the PICK BEAT lifecycle (hero flight orchestration via the exit
 *    director, submit-at-onLift, landing reveals, skip, the slow-server
 *    «processing» state and the error-recovery safety);
 *  - the RESEARCH RISE arming (detecting the draft→research transition in
 *    the shell's playerView watcher and freezing the pile snapshot the
 *    scene animates from);
 *  - `tableView` — the "the table owns the screen" flag the task host
 *    binds as `con-task-host--table-beat` (modal chrome dissolves so the
 *    landing is actually SEEN, then materializes back).
 *
 * Contracts (mirrors cardDealSequence / cardExitDirector):
 *  - submits are NEVER delayed behind animation (commit fires at onLift);
 *  - any input mid-beat skips to the final state;
 *  - reduced motion: no flights — commit + reveal immediately;
 *  - a stalled/failed submit can never strand the UI: a bounded safety
 *    recovers the tray, un-hides the modal chrome and re-arms submission
 *    (`recoverNonce` — the host watches it).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ExitSource, runDraftPickToTray, DraftPickHandle} from '@/client/console/cardDeal/cardExitDirector';

export const draftTrayState = reactive({
  /** Optimistic additions (hero in flight / landed, not yet in the server list). */
  pending: [] as Array<CardName>,
  /** Tray slots currently HELD empty (a proxy flies above / hasn't arrived). */
  held: [] as Array<CardName>,
  /** Frozen pile snapshot while the research-rise scene owns the tray. */
  sceneCards: undefined as ReadonlyArray<CardName> | undefined,
  /** Scene cards that were never on the player's screen (the auto-passed
   *  last card) — they ARRIVE into the tray before the rise. */
  sceneArrivals: [] as Array<CardName>,
  /** The research-rise is armed, waiting for the buy frame to launch it. */
  scenePending: false,
  /** The rise timeline is running on the deal layer. */
  sceneActive: false,
  /** A hero pick flight is in progress (submit already fired at onLift). */
  pickActive: false,
  /** The pick landed but the server answer hasn't — «processing» readout. */
  processing: false,
  /** «Set complete» label state (flips when the arrivals land). */
  setComplete: false,
  /**
   * The TABLE owns the screen: the task-host chrome (frame + backdrop)
   * dissolves so the tray landing / rise is seen. The host binds this as
   * `con-task-host--table-beat`; releasing it IS the frame materialization.
   */
  tableView: false,
  /** One-shot pulse trigger for the pile/count (landings, set-complete). */
  pulseNonce: 0,
  /** Error-recovery signal: the host un-rejects slots + re-arms submission. */
  recoverNonce: 0,
});

/** The slot resolver the mounted tray component registers (data-tray-slot). */
let slotResolver: ((name: CardName) => HTMLElement | null) | undefined;

export function registerTraySlotResolver(fn: ((name: CardName) => HTMLElement | null) | undefined): void {
  slotResolver = fn;
}

export function resolveTraySlot(name: CardName): HTMLElement | null {
  return slotResolver?.(name) ?? null;
}

/** What the tray RENDERS: the frozen scene snapshot, else server + pending. */
export function trayDisplayCards(serverDrafted: ReadonlyArray<CardName>): ReadonlyArray<CardName> {
  if (draftTrayState.sceneCards !== undefined) {
    return draftTrayState.sceneCards;
  }
  const out = [...serverDrafted];
  for (const name of draftTrayState.pending) {
    if (!out.includes(name)) {
      out.push(name);
    }
  }
  return out;
}

export function isTraySlotHeld(name: CardName): boolean {
  return draftTrayState.held.includes(name);
}

/** Any draft beat that must gate input / keep the modal chrome dissolved. */
export function draftPickBeatActive(): boolean {
  return draftTrayState.pickActive || draftTrayState.processing;
}

/** The rise scene in any stage (armed or running). */
export function riseSceneEngaged(): boolean {
  return draftTrayState.scenePending || draftTrayState.sceneActive;
}

// ── pick-beat lifecycle ────────────────────────────────────────────────

let pickHandle: DraftPickHandle | undefined;
let pickWaiters: Array<() => void> = [];
let responseSeen = false;
let safetyTimer: ReturnType<typeof setTimeout> | undefined;

function flushPickWaiters(): void {
  const waiters = pickWaiters;
  pickWaiters = [];
  waiters.forEach((w) => w());
}

/** Resolves once the hero flight has fully landed (deal launches wait here). */
export function whenPickBeatDone(): Promise<void> {
  if (!draftTrayState.pickActive) {
    return Promise.resolve();
  }
  return new Promise((resolve) => pickWaiters.push(resolve));
}

function holdSlot(name: CardName): void {
  if (!draftTrayState.held.includes(name)) {
    draftTrayState.held.push(name);
  }
}

function releaseSlot(name: CardName): void {
  const at = draftTrayState.held.indexOf(name);
  if (at !== -1) {
    draftTrayState.held.splice(at, 1);
  }
}

function clearSafety(): void {
  if (safetyTimer !== undefined) {
    clearTimeout(safetyTimer);
    safetyTimer = undefined;
  }
}

/**
 * The hero flight(s) landed. If the server already answered, the beat
 * settles (the modal chrome returns — unless the rise scene keeps the
 * table); otherwise the tray shows the honest «processing» readout and a
 * bounded safety recovers a stalled/failed submit.
 */
function settlePickBeat(): void {
  draftTrayState.pickActive = false;
  flushPickWaiters();
  if (responseSeen) {
    draftTrayState.processing = false;
    if (!riseSceneEngaged()) {
      draftTrayState.tableView = false;
    }
    return;
  }
  draftTrayState.processing = true;
  clearSafety();
  safetyTimer = setTimeout(() => recoverDraftBeat(), 6000);
}

export type DraftPickBeatArgs = {
  /** The chosen card(s) with their live strip slots (multi-keep drafts). */
  picks: ReadonlyArray<ExitSource>,
  /** Fires ONCE at the first proxy's onLift — the host submits here. */
  commit: () => void,
};

/**
 * The premium draft pick: the chosen card gets the hero beat and flies
 * INTO the tray slot; the modal chrome dissolves under it (`tableView`).
 * Reduced motion: commit + instant tray reveal, no flights.
 */
export function runDraftPickBeat(args: DraftPickBeatArgs): void {
  const names = args.picks.map((p) => p.name);
  responseSeen = false;
  clearSafety();
  for (const name of names) {
    if (!draftTrayState.pending.includes(name)) {
      draftTrayState.pending.push(name);
    }
  }
  if (consoleReducedMotionActive()) {
    args.commit();
    draftTrayState.pulseNonce++;
    // No flights: the beat settles on the next microtask so the submit's
    // response handling still sees a consistent "beat" ordering.
    draftTrayState.pickActive = true;
    Promise.resolve().then(() => settlePickBeat());
    return;
  }
  names.forEach(holdSlot);
  draftTrayState.pickActive = true;
  draftTrayState.tableView = true;
  pickHandle = runDraftPickToTray({
    picks: args.picks,
    resolveSlot: (name) => resolveTraySlot(name),
    onLift: args.commit,
    onLanded: (name) => {
      releaseSlot(name);
      draftTrayState.pulseNonce++;
    },
    onDone: () => {
      pickHandle = undefined;
      names.forEach(releaseSlot); // safety: never leave a slot stranded
      settlePickBeat();
    },
  });
}

/** Any input mid-pick jumps to the final state (the press is consumed). */
export function skipDraftPickBeat(): void {
  pickHandle?.skip();
}

/**
 * Bounded error recovery: the submit failed / stalled (no response within
 * the safety window). Drop the optimistic card, restore the modal chrome
 * and signal the host (`recoverNonce`) to un-reject its slots + re-arm
 * submission. The transport's own error alert handles the messaging.
 */
export function recoverDraftBeat(): void {
  clearSafety();
  pickHandle?.skip();
  pickHandle = undefined;
  draftTrayState.pending = [];
  draftTrayState.held = [];
  draftTrayState.pickActive = false;
  draftTrayState.processing = false;
  draftTrayState.tableView = false;
  draftTrayState.recoverNonce++;
  flushPickWaiters();
}

// ── the research-rise arming (the draft → research transition) ────────

/**
 * Freeze the pile snapshot the rise scene animates from. `buyNames` is the
 * research prompt's card order (the server serves the drafted cards in pick
 * order — the tray order matches); `alreadyOnTable` are the cards the tray
 * is showing (server drafted + optimistic) — everything else ARRIVES.
 */
function armResearchRise(buyNames: ReadonlyArray<CardName>, alreadyOnTable: ReadonlyArray<CardName>): void {
  const arrivals = buyNames.filter((name) => !alreadyOnTable.includes(name));
  draftTrayState.sceneCards = [...buyNames];
  draftTrayState.sceneArrivals = arrivals;
  draftTrayState.scenePending = true;
  draftTrayState.sceneActive = false;
  draftTrayState.setComplete = arrivals.length === 0;
  // Arrival slots render held until they land; a hero pick still IN FLIGHT
  // (the immediate bot-game case) keeps its own hold — released at its own
  // touchdown, never here (no double-vision under the flying proxy).
  draftTrayState.held = [...new Set([...draftTrayState.held, ...arrivals])];
  draftTrayState.tableView = true;
}

/** The buy frame launches the scene (deal-layer rise timeline running). */
export function beginRiseScene(): void {
  draftTrayState.scenePending = false;
  draftTrayState.sceneActive = true;
}

/** An arrival proxy landed — reveal its tray slot + pulse. */
export function riseArrivalLanded(name: CardName): void {
  releaseSlot(name);
  draftTrayState.pulseNonce++;
}

/** The full set is on the tray — the «НАБОР СОБРАН» beat. */
export function riseSetComplete(): void {
  draftTrayState.setComplete = true;
  draftTrayState.pulseNonce++;
}

/** Lift-off: every tray slot empties under the proxies standing over it. */
export function riseLiftOff(): void {
  if (draftTrayState.sceneCards !== undefined) {
    draftTrayState.held = [...draftTrayState.sceneCards];
  }
}

/** The frame materialization beat — the modal chrome returns around the row. */
export function riseFrameReveal(): void {
  draftTrayState.tableView = false;
}

/** Scene over (landed, skipped or degraded): the tray hands the cards off. */
export function finishRiseScene(): void {
  draftTrayState.sceneCards = undefined;
  draftTrayState.sceneArrivals = [];
  draftTrayState.scenePending = false;
  draftTrayState.sceneActive = false;
  draftTrayState.setComplete = false;
  draftTrayState.pending = [];
  draftTrayState.held = [];
  draftTrayState.tableView = false;
}

/** Restore-path consume: the set was already shown (defer/reload) — no replay. */
export function cancelRiseScene(): void {
  finishRiseScene();
}

// ── the shell's playerView observer ───────────────────────────────────

const DRAFT_PHASES: ReadonlyArray<string> = [Phase.DRAFTING, Phase.INITIALDRAFTING];

function names(cards: ReadonlyArray<{name: CardName}> | undefined): Array<CardName> {
  return (cards ?? []).map((c) => c.name);
}

/**
 * Called from the shell's playerView watcher (pre-flush — BEFORE the new
 * frame renders, so the buy frame mounts already knowing about the scene).
 * Detects the draft→research transition and reconciles the optimistic
 * tray state with the fresh server view.
 */
export function observeDraftTransition(prev: PlayerViewModel | undefined, next: PlayerViewModel): void {
  // Any fresh view while a pick beat is in flight = the submit resolved.
  if (draftTrayState.pickActive || draftTrayState.processing) {
    responseSeen = true;
    if (draftTrayState.processing) {
      clearSafety();
      draftTrayState.processing = false;
      if (!riseSceneEngaged()) {
        draftTrayState.tableView = false;
      }
    }
  }

  // The draft → research transition: the buy prompt arrives while the tray
  // still holds the just-drafted pile (the server cleared draftedCards in
  // runResearchPhase — the tray keeps the frozen snapshot instead).
  const wf = next.waitingFor;
  const prevDrafted = names(prev?.draftedCards);
  const tableCards = trayDisplayCards(prevDrafted);
  const wasDrafting = prev !== undefined && DRAFT_PHASES.includes(prev.game.phase);
  if (
    !riseSceneEngaged() &&
    wasDrafting &&
    next.game.phase === Phase.RESEARCH &&
    wf?.type === 'card' &&
    (wf as {buyMode?: boolean}).buyMode === true &&
    tableCards.length > 0
  ) {
    const buyNames = names((wf as {cards?: ReadonlyArray<{name: CardName}>}).cards);
    if (buyNames.length > 0) {
      if (consoleReducedMotionActive()) {
        finishRiseScene(); // no scene — the sequence's reduced reveal carries it
      } else {
        armResearchRise(buyNames, tableCards);
      }
      return;
    }
  }

  // Self-healing: outside any beat the optimistic state must be empty
  // (a pick's pending card either reached the server list or is stale).
  if (!draftPickBeatActive() && !riseSceneEngaged()) {
    if (draftTrayState.pending.length > 0) {
      draftTrayState.pending = [];
    }
    if (draftTrayState.held.length > 0) {
      draftTrayState.held = [];
    }
    if (draftTrayState.tableView) {
      draftTrayState.tableView = false;
    }
  }
}

/** Game-switch boundary / tests. */
export function resetDraftTray(): void {
  clearSafety();
  pickHandle?.skip();
  pickHandle = undefined;
  responseSeen = false;
  finishRiseScene();
  draftTrayState.pickActive = false;
  draftTrayState.processing = false;
  draftTrayState.pulseNonce = 0;
  draftTrayState.recoverNonce = 0;
  flushPickWaiters();
}
