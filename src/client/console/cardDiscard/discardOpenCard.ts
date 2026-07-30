/*
 * @console-shared LIVE — console native stands on this file.
 *
 * DISCARDING AN OPEN CARD — the second entry point into the ONE discard
 * language.
 *
 * The original entry (`consoleCardDiscard.ts`) is a TRANSACTION: it is armed
 * against a server `discardPrompt` marker and confirms the cards actually
 * left by diffing the next hand (`discardedFromHand`). That is right for
 * "throw a card away from your hand" and wrong — actively wrong — for the case
 * here: a card the player has just been SHOWN and refused (Inventors' Guild /
 * Business Network) was never in hand, so a hand diff would report it as
 * "gone" for the trivial reason that it was never there. A false positive is
 * worse than no support.
 *
 * So this is a sibling EPISODE, not a second implementation. Everything
 * physical — the proxies, the flip, the gather, the carry, the tray, the pile
 * settle, the timings, the reduced-motion ladder — is the SAME
 * `discardDirector` + `cardDiscardState` the hand discard drives. Only the
 * trigger and the completion contract differ, because only those were ever
 * hand-specific.
 *
 * The point of the split is that there is now exactly ONE place to make the
 * discard prettier, and both callers get it.
 */
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  DiscardSource, disposeDiscardProxies, runDiscardCarry, runDiscardFixate, runDiscardFlip,
  runDiscardGather, runDiscardHold, runDiscardPileSettle, runDiscardTrayWithdraw, spawnDiscardProxies,
} from './discardDirector';
import {discardTimings} from './discardModel';
import {cardDiscardState, noticeDiscardLanding, resetCardDiscardStage} from './cardDiscardState';

/** One open card being thrown away, with its live slot (or a snapshot rect). */
export type OpenDiscardSource = DiscardSource;

/**
 * Send OPEN cards to the discard pile, physically.
 *
 * The caller keeps its own submit: this is presentation, and it deliberately
 * does not wait for the server — the refusal is already decided, and holding
 * the game behind a flight is what makes a UI feel slow.
 *
 * Face-up on the way out is the whole difference from the hand discard: these
 * cards are being LOOKED at when they are refused, so the turn-over is the
 * beat that says "you are not keeping this one". `runDiscardFlip` is the same
 * flip the hand path uses.
 *
 * Never throws and never strands the stage: a missing tray degrades inside the
 * director (an honest downward exit), and every path disposes.
 */
export async function discardOpenCards(sources: ReadonlyArray<OpenDiscardSource>): Promise<void> {
  if (sources.length === 0) {
    return;
  }
  const reduced = consoleReducedMotionActive();
  const t = discardTimings(reduced);
  cardDiscardState.live = true;
  cardDiscardState.phase = 'fixating';
  const spawned = await spawnDiscardProxies(sources);
  if (spawned.length === 0) {
    // Nothing measurable to fly (a torn-down layout / JSDOM) — leave the stage
    // exactly as we found it rather than parking a live-but-empty scene.
    cardDiscardState.live = false;
    cardDiscardState.phase = 'idle';
    return;
  }
  try {
    await runDiscardFixate(spawned, t);
    cardDiscardState.phase = 'flipping';
    await runDiscardFlip(spawned, t);
    cardDiscardState.phase = 'gathering';
    await runDiscardGather(spawned, t);
    // The pile lights up as a RECEIVER before the cards travel, so it visibly
    // waits for them instead of materialising underneath them.
    cardDiscardState.trayArmed = true;
    cardDiscardState.trayVisible = true;
    await runDiscardHold(spawned, t);
    cardDiscardState.phase = 'carrying';
    await runDiscardCarry(spawned, t, () => noticeDiscardLanding());
    cardDiscardState.phase = 'settling';
    await runDiscardPileSettle(t);
    await runDiscardTrayWithdraw(t);
  } finally {
    disposeDiscardProxies(spawned);
    resetCardDiscardStage();
  }
}
