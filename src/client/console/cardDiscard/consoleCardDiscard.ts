/*
 * CONSOLE CARD DISCARD — the ONE transaction every "throw cards away" answer
 * runs through, whoever asked for it: a card effect (Mars University), a
 * colony bonus (Pluto), a colony effect (Hygiea), a global event, a CEO
 * action, a behaviour's `spend.cards`, Sponsored Academies, Project Eden…
 *
 * The console used to grow a flow per case — a flat grid inside the task host
 * for a nested discard, the hand overlay for a top-level one, a button inside
 * the reveal modal for Pluto — and NONE of them showed the card leaving. Now
 * every one of them ends here: the answer arms this scene, the surface hands
 * off, and the card is physically taken out of the hand and thrown on the
 * pile before the new hand is committed.
 *
 * The transaction contract is the console's standard one (patent sale is the
 * reference): ARM at the answer → DETECT the server's truth → RUN while the
 * commit is held → COMMIT → END the post-commit half → ABORT on every error
 * path. The scene NEVER draws a disposal the server did not perform.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ColonyBonusDiscardMeta, DiscardPromptMeta} from '@/common/models/PlayerInputModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {registerLivenessRelease} from '@/client/console/consoleLiveness';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {untilCeiling} from '@/client/console/waitGraph/ceilingWait';
import {frames as paintedFrames} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {createFlowRun} from '@/client/console/session/flowRun';
import {
  DiscardPhase,
  DISCARD_SAFETY_MS,
  discardPhaseHolds,
  discardTimings,
  discardedFromHand,
} from '@/client/console/cardDiscard/discardModel';
import {
  HAND_DISCARD_PILE_LEASE,
  cardDiscardState,
  discardTrayEl,
  resetCardDiscardStage,
} from '@/client/console/cardDiscard/cardDiscardState';
import {discardPileState, expectDiscardPileCount, settleDiscardPile} from '@/client/console/discardPile/discardPile';
import {
  DiscardSource,
  SpawnedDiscard,
  disposeDiscardProxies,
  landOnPile,
  runDiscardCarry,
  runDiscardFixate,
  runDiscardFlip,
  runDiscardGather,
  runDiscardHold,
  runDiscardPileSettle,
  runDiscardTrayWithdraw,
  spawnDiscardProxies,
} from '@/client/console/cardDiscard/discardDirector';

export type CardDiscardArm = {
  /** The cards the player answered with. */
  names: ReadonlyArray<CardName>,
  /** Live elements + pre-commit rects for each card's launch point. */
  sources: ReadonlyArray<DiscardSource>,
  /** The server marker that produced the pick (drives copy elsewhere; kept
   *  here so a diagnosis can name WHICH discard is stuck). */
  meta: DiscardPromptMeta | undefined,
  /**
   * A PRE-SELECTED discard leaving from the DOCK (P68's action, P86's play): no pick surface stands, so phase D hands
   * no overlay off — the ordinary hand close would fold the very workspace the press was made in (a play composer
   * stands in the hand). Absent → a live pick's discard (the album / the zoom is the source).
   */
  fromDock?: boolean,
};

export const cardDiscardTransaction = reactive({
  active: false,
  phase: 'idle' as DiscardPhase,
  /** The names the scene is actually disposing of (server-verified). */
  names: [] as Array<CardName>,
});

let armed: CardDiscardArm | undefined;
/**
 * THE DISPOSAL'S RUN (architecture v2 — PLAN §10 · C4): `scene:card-discard#n` in the session, from the arm to the
 * disposal's end (read, aborted, reset). It owns the arm's safety and the wait for the pile — taken back when the
 * disposal ends, on every path — and when the game screen leaves under it the disposal is aborted (`orphaned`). The
 * HOLD stays derived from the transaction's state.
 */
const run = createFlowRun('card-discard', {orphaned: () => abortCardDiscard()});
let cancelArmTimer: () => void = () => {};
let spawned: ReadonlyArray<SpawnedDiscard> = [];

/** The scene owns the foreground while anything of it is on screen. */
export function cardDiscardHolding(): boolean {
  return cardDiscardTransaction.active && discardPhaseHolds(cardDiscardTransaction.phase);
}

registerAnimationHoldSupplier('card-discard', cardDiscardHolding, {
  diagnose: () => ({
    phase: cardDiscardTransaction.phase,
    names: [...cardDiscardTransaction.names],
    flights: cardDiscardState.flights.length,
  }),
  // THE CEILING ENDS THE WEDGE, NOT JUST THE COUNT: the abort of the disposal itself (the same as the liveness rung) —
  // the proxies gone, the pile settled to the server count, the transaction idle. The cards already left the hand (the
  // truth of the server).
  expire: () => {
    if (!cardDiscardTransaction.active) {
      return;
    }
    console.warn(`[consoleCardDiscard] card discard (${cardDiscardTransaction.phase}): outlived its ceiling — ended`);
    abortCardDiscard();
  },
});

function setPhase(phase: DiscardPhase): void {
  cardDiscardTransaction.phase = phase;
  cardDiscardState.phase = phase;
  if (DEPARTED_PHASES.has(phase)) {
    const waiters = departureWaiters.splice(0);
    for (const w of waiters) {
      w();
    }
  }
}

/**
 * THE PACKET HAS LEFT — the carry started (or the scene ended without one: nothing measurable, an abort). The play's
 * hero lifts on it (P86 — the discard is the play's PRICE, the fourth shipment of `shipPrice`): a row ticks on the
 * DEPARTURE, never on the touchdown (PL-099 / PL-104).
 */
const DEPARTED_PHASES: ReadonlySet<DiscardPhase> = new Set<DiscardPhase>(['carrying', 'landing', 'settling', 'idle']);
const departureWaiters: Array<() => void> = [];

export function cardDiscardDeparted(): Promise<void> {
  if (!cardDiscardTransaction.active || DEPARTED_PHASES.has(cardDiscardTransaction.phase)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => departureWaiters.push(resolve));
}

function clearArmTimer(): void {
  cancelArmTimer();
  cancelArmTimer = () => {};
}

export function isCardDiscardArmed(): boolean {
  return armed !== undefined;
}

export function isCardDiscardActive(): boolean {
  return cardDiscardTransaction.active;
}

/**
 * The COLONY-BONUS marker of the discard being disposed of right now, if the
 * running scene is closing a colony payout (Pluto). The colony RESOLUTION's
 * lifecycle reads this: the workspace that hosts the flow may not fold while
 * the chosen card is still physically leaving the hand.
 */
export function cardDiscardColonyBonus(): ColonyBonusDiscardMeta | undefined {
  // The TRADE's pair only (`colonyBonus`): every reader of this is the colony RESOLUTION's lifecycle. A CARD's pair
  // (`colonyRepeat` — the ledger's Pluto pairs, Ф4) is NOT the resolution's — read as its own, it made the resolution
  // «live» for the discard's flight and its falling edge then cleared the ledger's settlement table mid-turn.
  return cardDiscardTransaction.active ? armed?.meta?.colonyBonus : undefined;
}

/**
 * THE PAIR the running discard answers — a trade's (`colonyBonus`) OR a card's (`colonyRepeat`, Ф4): what a
 * SETTLEMENT TABLE reads to break the next place's seal on this touchdown. Never a colony-resolution witness.
 */
export function cardDiscardSettlementPair(): ColonyBonusDiscardMeta | undefined {
  return cardDiscardTransaction.active ? (armed?.meta?.colonyBonus ?? armed?.meta?.colonyRepeat) : undefined;
}

/**
 * THE CARD WHOSE QUESTION the running discard answers (Mars University's «discard a card to draw one» — the prompt's
 * own source), while the scene disposes of it; undefined otherwise. A QUESTION TABLE («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»
 * Ф4) breaks its place's seal on this discard's touchdown.
 */
export function cardDiscardAskedBy(): string | undefined {
  return cardDiscardTransaction.active ? armed?.meta?.source?.card : undefined;
}

/**
 * ARM — called from the ONE place the player's discard answer is produced,
 * synchronously BEFORE the submit, so the source rects are captured while the
 * pick surface is still on screen (a commit can unmount it three frames later).
 *
 * A pick of zero cards (a legal answer to a `min: 0` discard) arms nothing:
 * there is no disposal to show.
 */
export function armCardDiscard(arm: CardDiscardArm): void {
  if (arm.names.length === 0) {
    return;
  }
  abortCardDiscard();
  armed = arm;
  // Warm the art NOW: the proxies mount a premium face, and a face that mounts
  // on a not-yet-decoded webp shows a BLACK body — glaring on the turn beat,
  // where the card holds still. The server round-trip pays for the decode.
  preloadPremiumCardArt(arm.names);
  cardDiscardTransaction.active = true;
  cardDiscardTransaction.names = [...arm.names];
  setPhase('armed');
  // The answer may never come back (a dropped response, an error path that
  // does not reach abort). The ceiling is BELOW the animation-hold registry's
  // net, so this flow always cleans up its own visuals first.
  run.begin(`${arm.names.length} card(s)`);
  cancelArmTimer = run.after(DISCARD_SAFETY_MS, 'the arm\'s safety (no answer carried the disposal)', () => {
    if (cardDiscardTransaction.phase === 'armed') {
      abortCardDiscard();
    }
  });
}

/**
 * THE PRE-SELECTED DISCARD — a card ACTION whose discard is a step the composer answered BEFORE the press (P68 Ceres
 * Tech Market: «discard any number of cards for 2 M€ each»): the album was a pre-select (nothing left the hand then —
 * `leaving: 'none'`), so the cards leave at the COMMIT, from where they stand now — the dock. The composer asks the shell
 * (the one that can measure the dock) to arm the ONE scene through this door, synchronously at the press, before the
 * batch goes; the transport's gate then plays it exactly as for a live discard (the server says which cards left).
 */
export type PreselectedDiscardArm = (names: ReadonlyArray<CardName>, meta: DiscardPromptMeta) => void;

let preselectedArm: PreselectedDiscardArm | undefined;

export function registerPreselectedDiscardArm(fn: PreselectedDiscardArm | undefined): void {
  preselectedArm = fn;
}

export function armPreselectedDiscard(names: ReadonlyArray<CardName>, meta: DiscardPromptMeta): void {
  if (names.length > 0) {
    preselectedArm?.(names, meta);
  }
}

/**
 * DETECT — the server is the truth. Returns the cards it ACTUALLY removed from
 * the hand in this response; `undefined` when nothing was armed or the server
 * kept the cards (a rejected answer must never animate a disposal).
 */
export function detectCardDiscard(next: PlayerViewModel): {names: ReadonlyArray<CardName>} | undefined {
  if (armed === undefined) {
    return undefined;
  }
  const gone = discardedFromHand(armed.names, next.cardsInHand);
  if (gone.length === 0) {
    // The answer did not take: end the transaction without drawing anything.
    abortCardDiscard();
    return undefined;
  }
  clearArmTimer();
  cardDiscardTransaction.names = [...gone];
  return {names: gone};
}

/**
 * THE OVERLAY HAND-OFF, injected by the shell.
 *
 * Phase D reuses the pick surface's ORDINARY close episode — the very same
 * "cards gather back into the dock" animation any other close plays — instead
 * of a discard-only copy of it. The shell owns that episode (it is the only
 * thing that can measure the live grid + the dock), so it registers the call
 * here and the sequence simply awaits it between the gather and the carry.
 *
 * `keep` are the discarded names: the close must NOT fly them home — they are
 * on the discard layer, going the other way.
 */
export type DiscardOverlayHandoff = (discarded: ReadonlySet<CardName>) => Promise<void>;

let overlayHandoff: DiscardOverlayHandoff | undefined;

export function registerDiscardOverlayHandoff(fn: DiscardOverlayHandoff | undefined): void {
  overlayHandoff = fn;
}

/**
 * RUN — the pre-commit half, as ONE orchestrated sequence (never a pile of
 * timers): fixate → flip → gather → hand the overlay off → carry → land.
 * Resolves once the packet has physically come to rest on the pile, which is
 * when the caller may commit the new (shorter) hand.
 *
 * Never rejects: a broken beat degrades to the next phase so the shell watchers
 * that key off the ladder can never desynchronise.
 */
export async function runCardDiscard(): Promise<void> {
  const arm = armed;
  if (arm === undefined) {
    return;
  }
  const reduced = consoleReducedMotionActive();
  const t = discardTimings(reduced);
  const gone = new Set(cardDiscardTransaction.names);
  const alive = () => cardDiscardTransaction.active;
  try {
    cardDiscardState.live = true;
    cardDiscardState.trayCount = 0;

    // ── A · FIXATE — the chosen cards come off the row, the rest recede. ────
    setPhase('fixating');
    spawned = await spawnDiscardProxies(arm.sources.filter((source) => gone.has(source.name)));
    if (!alive()) {
      return;
    }
    if (spawned.length === 0) {
      // Nothing measurable to animate: hand the overlay off anyway so the
      // surface never sticks open, and finish quietly.
      setPhase('leaving');
      // No flight — but a pile another owner holds out (a reveal, a colony) still reads the truth: these cards are on it.
      if (discardPileState.visible) {
        expectDiscardPileCount(HAND_DISCARD_PILE_LEASE, gone.size);
        settleDiscardPile(HAND_DISCARD_PILE_LEASE);
      }
      if (arm.fromDock !== true) {
        await overlayHandoff?.(gone);
      }
      return;
    }
    await runDiscardFixate(spawned, t);
    if (!alive()) {
      return;
    }

    // ── B · FLIP — turned face down where they lie. ─────────────────────────
    setPhase('flipping');
    await runDiscardFlip(spawned, t);
    if (!alive()) {
      return;
    }

    // ── C · GATHER — squared up into one packet. ────────────────────────────
    setPhase('gathering');
    await runDiscardGather(spawned, t);
    if (!alive()) {
      return;
    }

    // ── D · HAND-OFF — the overlay goes home through its OWN close episode
    //    while the packet stays on the discard layer, over everything. The
    //    receiver arms BEFORE the carry, so the pile is visibly waiting for
    //    the cards rather than appearing under them. ─────────────────────────
    setPhase('leaving');
    // THE PILE'S TRUTH (P86): what this scene lays on it is the server's answer — declared as the pile comes out, settled
    // at the read and at any abort (`settleDiscardPile`); the touchdowns tick it with their pulse in between.
    expectDiscardPileCount(HAND_DISCARD_PILE_LEASE, gone.size);
    cardDiscardState.trayVisible = true;
    cardDiscardState.trayArmed = true;
    await Promise.all([
      // A pre-selected discard leaves the DOCK: no pick surface to hand off (the play's own workspace stays).
      arm.fromDock === true ? Promise.resolve() : overlayHandoff?.(gone) ?? Promise.resolve(),
      runDiscardHold(spawned, t),
    ]);
    if (!alive()) {
      return;
    }
    // The carry MEASURES the pile, so wait for it to actually paint. Bounded:
    // a tray that never mounts degrades to the honest downward exit.
    await waitForTray(reduced ? 3 : 12);
    if (!alive()) {
      return;
    }

    // ── E+F · CARRY and LAND. ──────────────────────────────────────────────
    setPhase('carrying');
    cardDiscardState.trayArmed = false;
    await runDiscardCarry(spawned, t, () => {
      // A landing after an abort must not thicken a pile nobody is watching.
      if (alive()) {
        landOnPile();
      }
    });
    if (!alive()) {
      return;
    }
    setPhase('landing');
    await runDiscardPileSettle(t);
  } catch (err) {
    console.warn('[card-discard] scene failed — degrading to a silent disposal', err);
  } finally {
    if (cardDiscardTransaction.active) {
      cardDiscardState.trayArmed = false;
      setPhase('settling');
    }
  }
}

/**
 * END — the post-commit half: the pile keeps its acknowledgement for one beat
 * (the count the player just watched tick), then the tray withdraws and the
 * hold releases. Idempotent.
 */
export async function endCardDiscard(): Promise<void> {
  if (!cardDiscardTransaction.active) {
    return;
  }
  const t = discardTimings(consoleReducedMotionActive());
  setPhase('settling');
  await runDiscardTrayWithdraw(t);
  finishCardDiscard();
}

/** ABORT — every error path. Kills the visuals, releases the hold, fires nothing. */
// THE LIVENESS ARBITER'S RUNG (rank 20): a disposal whose flight never landed holds the pad (`card-discard` blocking)
// and the colony resolution's closing beat — abort it; the cards are already gone from the hand (the server's truth).
registerLivenessRelease({
  rank: 20,
  name: 'card-discard',
  release: () => {
    if (!cardDiscardTransaction.active) {
      return '';
    }
    const what = `${cardDiscardTransaction.phase} [${cardDiscardTransaction.names.join(',')}]`;
    abortCardDiscard();
    return `aborted ${what}`;
  },
});

export function abortCardDiscard(): void {
  if (armed === undefined && !cardDiscardTransaction.active) {
    return;
  }
  finishCardDiscard();
}

function finishCardDiscard(): void {
  // Every way out (the read, an abort, the arbiter's rung, the safety): the pile reads the truth BEFORE its lease goes.
  settleDiscardPile(HAND_DISCARD_PILE_LEASE);
  clearArmTimer();
  disposeDiscardProxies(spawned);
  spawned = [];
  armed = undefined;
  cardDiscardTransaction.active = false;
  cardDiscardTransaction.names = [];
  setPhase('idle');
  resetCardDiscardStage();
  run.end();
}

/** Hard reset (shell unmount / game switch). */
export function resetCardDiscard(): void {
  abortCardDiscard();
}

/**
 * Wait for the pile to be measurable (the layer registers its slot on mount). Bounded on the CLOCK, never a fixed
 * delay: it resolves the instant the element is there (or the disposal is over), and gives up after `maxFrames` frames'
 * worth of time so a degenerate layout cannot wedge — a wait counted in painted frames stood for ever in a window that
 * does not paint. A wait that has to wait is a row of the kernel's wait table and a node of the wait graph; its ceiling
 * ending it is said (`ceilingWait.ts`).
 */
async function waitForTray(maxFrames: number): Promise<void> {
  const frames = Math.max(1, maxFrames);
  // The first look is one PAINTED frame from now (the tray was told to stand in this very stretch) — or 50 ms, when
  // nothing paints.
  await (run.scope ?? consoleSessionScope()).wait(paintedFrames(), {bound: {ms: 50, quiet: 'a frame that did not paint — the look goes on'}});
  await untilCeiling({
    id: 'card-discard:tray', owner: 'consoleCardDiscard', what: 'the discard tray mounted', maxMs: frames * 16,
    detail: `${frames} frames, estimated at 16 ms each`,
  }, () => discardTrayEl() !== undefined || !cardDiscardTransaction.active, run.scope, 16);
}
