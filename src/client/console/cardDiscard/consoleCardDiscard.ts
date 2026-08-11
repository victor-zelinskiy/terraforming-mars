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
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  DiscardPhase,
  DISCARD_SAFETY_MS,
  discardPhaseHolds,
  discardTimings,
  discardedFromHand,
} from '@/client/console/cardDiscard/discardModel';
import {
  cardDiscardState,
  discardTrayEl,
  resetCardDiscardStage,
} from '@/client/console/cardDiscard/cardDiscardState';
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
};

export const cardDiscardTransaction = reactive({
  active: false,
  phase: 'idle' as DiscardPhase,
  /** The names the scene is actually disposing of (server-verified). */
  names: [] as Array<CardName>,
});

let armed: CardDiscardArm | undefined;
let armTimer: ReturnType<typeof setTimeout> | undefined;
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
});

function setPhase(phase: DiscardPhase): void {
  cardDiscardTransaction.phase = phase;
  cardDiscardState.phase = phase;
}

function clearArmTimer(): void {
  if (armTimer !== undefined) {
    clearTimeout(armTimer);
    armTimer = undefined;
  }
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
  return cardDiscardTransaction.active ? armed?.meta?.colonyBonus : undefined;
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
  clearArmTimer();
  armTimer = setTimeout(() => {
    if (cardDiscardTransaction.phase === 'armed') {
      abortCardDiscard();
    }
  }, DISCARD_SAFETY_MS);
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
      await overlayHandoff?.(gone);
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
    cardDiscardState.trayVisible = true;
    cardDiscardState.trayArmed = true;
    await Promise.all([
      overlayHandoff?.(gone) ?? Promise.resolve(),
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
export function abortCardDiscard(): void {
  if (armed === undefined && !cardDiscardTransaction.active) {
    return;
  }
  finishCardDiscard();
}

function finishCardDiscard(): void {
  clearArmTimer();
  disposeDiscardProxies(spawned);
  spawned = [];
  armed = undefined;
  cardDiscardTransaction.active = false;
  cardDiscardTransaction.names = [];
  setPhase('idle');
  resetCardDiscardStage();
}

/** Hard reset (shell unmount / game switch). */
export function resetCardDiscard(): void {
  abortCardDiscard();
}

/**
 * Wait for the pile to be measurable (the layer registers its slot on mount).
 * Frame-bounded, never a fixed delay: it resolves the instant the element is
 * there, and gives up after `maxFrames` so a degenerate layout cannot wedge.
 */
function waitForTray(maxFrames: number): Promise<void> {
  return new Promise((resolve) => {
    let left = Math.max(1, maxFrames);
    const step = () => {
      if (discardTrayEl() !== undefined || left <= 0 || !cardDiscardTransaction.active) {
        resolve();
        return;
      }
      left--;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
