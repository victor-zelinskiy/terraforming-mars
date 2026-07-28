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
import {DiscardPromptMeta} from '@/common/models/PlayerInputModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
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
  runDiscardSeize,
  runDiscardToss,
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
 * RUN — the pre-commit half: seize the cards out of the hand, hand the surface
 * off, and throw them on the pile. Resolves once the last card has physically
 * landed, which is when the caller may commit the new (shorter) hand.
 *
 * Never rejects: a broken beat degrades to the next phase so the shell
 * watchers that key off the ladder can never desynchronise.
 */
export async function runCardDiscard(): Promise<void> {
  const arm = armed;
  if (arm === undefined) {
    return;
  }
  const reduced = consoleReducedMotionActive();
  const t = discardTimings(reduced);
  const gone = new Set(cardDiscardTransaction.names);
  try {
    cardDiscardState.live = true;
    cardDiscardState.trayCount = 0;
    setPhase('seizing');
    spawned = await spawnDiscardProxies(arm.sources.filter((source) => gone.has(source.name)));
    if (!cardDiscardTransaction.active) {
      return;
    }
    await runDiscardSeize(spawned, t);
    if (!cardDiscardTransaction.active) {
      return;
    }
    // The pick surface hands off here: the shell watches this phase and closes
    // the hand section (the survivors fly home to the dock). The tray slides in
    // under the still-flying cards — but ONLY when there is something to catch:
    // a scene with no usable launch rect draws no empty berth.
    setPhase('leaving');
    if (spawned.length === 0) {
      return;
    }
    cardDiscardState.trayVisible = true;
    // The toss MEASURES the pile, so wait for it to actually paint. Bounded:
    // a tray that never mounts degrades to the honest downward exit.
    await waitForTray(reduced ? 3 : 12);
    if (!cardDiscardTransaction.active) {
      return;
    }
    setPhase('consuming');
    await runDiscardToss(spawned, t, () => {
      // A landing after an abort must not thicken a pile nobody is watching.
      if (cardDiscardTransaction.active) {
        landOnPile();
      }
    });
  } catch (err) {
    console.warn('[card-discard] scene failed — degrading to a silent disposal', err);
  } finally {
    if (cardDiscardTransaction.active) {
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
