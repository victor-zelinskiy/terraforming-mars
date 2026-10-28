/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SCREEN HANDOFF — «what the player is still OWED on this screen before the next one may take it».
 *
 * A SCREEN-TAKING TRANSITION nobody pressed for — the scoring scene on Phase.END, the generation scene rising into
 * the sitting or the draft, the mandatory plate's door into the Parliament — used to fire on the raw server edge
 * (the endgame waited for the BOARD's own story, nothing else). But one response routinely carries a finished effect
 * the player has not been handed yet: the final greenery's cell draws a card, and that card's reveal / its flight
 * into the dock were still playing when the finale stood up over them; a sitting rose with a card still crossing the
 * screen. The owner's report (2026-10-28): «анимация добора карты вылетит ПРЯМО В ЭКРАН ФИНАЛА … то же самое и в
 * экран парламента — нет системы, которая чётко бы занимала внимание игрока конкретным действием сейчас».
 *
 * So there is ONE question every automatic transition asks before it takes the screen, answered from the live
 * presentation facts the console already keeps (never a clock, never a title):
 *
 *   · `board-story`     — the board's own scene (a landing, a reward wave, a scale story, the camera);
 *   · `remote-landing`  — another seat's tile owed to this board (queued, waiting, or flying);
 *   · `reveal`          — a drawn batch the player has not TAKEN yet (standing, pending, or parked — a parked one
 *                         presents once its park drains; the next screen must not bury it);
 *   · `card-arrival`    — cards physically arriving: the deck search, a card on its way into the dock;
 *   · `transfer`        — resource tokens in the air;
 *   · `animation`       — any registered animation hold, EVERY scope (a notification-only hold runs inside a surface
 *                         the next screen would tear down — the mandatory-surface gate deliberately ignores those,
 *                         which is exactly why the finale opened over the intake).
 *
 * The wait is BOUNDED and NAMED: every term is self-bounded by its owner's ceiling (the holds' 35 s, the park's 30 s,
 * the remote stage's 20 s), the reveal by the player's own take, and the whole wait by `SCREEN_HANDOFF_MAX_MS` —
 * past it the transition goes ahead and the ledger says which term never let go. A caller that itself HOLDS the
 * foreground while it waits (the generation scene keeps its hold through the rise) names its own labels in
 * `ignoreHolds`, or it would wait for itself.
 *
 * Import direction: this module sits ABOVE the presentation systems (it imports them, like `rewardPayoutQuiet`);
 * a system that must consult it takes it by INJECTION (the generation scene — `registerGenerationSceneHandoff`).
 */
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';
import {currentRevealEvent, pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';
import {deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive} from '@/client/console/handDock/handDeliveryDirector';
import {owePresentation} from '@/client/console/presentationLedger';
import {probeTick} from '@/client/console/probeTick';
import {isResourceTransferActive} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {boardStorySettling} from '@/client/console/rewardPayoutQuiet';
import {remoteLandingOwed} from '@/client/console/tilePlacement/consoleRemotePlacement';

export type ScreenHandoffReason =
  | 'board-story'
  | 'remote-landing'
  | 'reveal'
  | 'card-arrival'
  | 'transfer'
  | 'animation';

/**
 * The whole wait's ceiling. Above every term's own bound (the park's 30 s is the longest) so an honest chain —
 * a parked batch released by its safety, taken, flown into the dock — completes before the degrade; a transition
 * that waits this long has a wedged term, which the degrade NAMES.
 */
export const SCREEN_HANDOFF_MAX_MS = 45_000;

export type ScreenHandoffOptions = {
  /** Animation-hold labels the CALLER itself raises while it waits (never counted — it would wait for itself). */
  ignoreHolds?: ReadonlyArray<string>,
};

/** Every reason the screen is still owed to the player, in the order a diagnostic names them. Empty = hand it over. */
export function screenHandoffReasons(opts?: ScreenHandoffOptions): Array<ScreenHandoffReason> {
  const reasons: Array<ScreenHandoffReason> = [];
  if (boardStorySettling()) {
    reasons.push('board-story');
  }
  if (remoteLandingOwed()) {
    reasons.push('remote-landing');
  }
  if (currentRevealEvent() !== undefined || pendingRevealEvents().length > 0) {
    reasons.push('reveal');
  }
  if (deckDrawHolds() || isHandDeliveryActive() ||
      handDeliveryState.flights.length > 0 || handDeliveryState.inFlight.length > 0) {
    reasons.push('card-arrival');
  }
  if (isResourceTransferActive()) {
    reasons.push('transfer');
  }
  // The registry names a hold `label[scope]`; a caller ignores by the bare label.
  const ignored = new Set(opts?.ignoreHolds ?? []);
  if (activeAnimationHoldLabels().some((label) => !ignored.has(label.replace(/\[[^\]]*\]$/, '')))) {
    reasons.push('animation');
  }
  return reasons;
}

/** Is the screen still owed to the player right now? */
export function screenHandoffOwed(opts?: ScreenHandoffOptions): boolean {
  return screenHandoffReasons(opts).length > 0;
}

export type ScreenHandoffOutcome =
  /** Nothing is owed any more — the transition may take the screen. */
  | 'quiet'
  /** The caller's reason died (`alive` false) — the transition is superseded; do nothing. */
  | 'dead'
  /** The ceiling passed with a term still raised — go ahead, the ledger named the term. */
  | 'degraded';

/**
 * Resolve once nothing is owed (`quiet`), the caller's reason died (`dead`), or the ceiling passed (`degraded`).
 * Resolves on the next probe tick when already quiet; never rejects. The wait is a ledger story for its whole
 * length, so a diagnostic (`__presentationLedgerDiag`) lists every transition still waiting and on what.
 */
export function waitScreenHandoff(
  id: string,
  opts?: ScreenHandoffOptions & {alive?: () => boolean, maxMs?: number},
): Promise<ScreenHandoffOutcome> {
  const cap = opts?.maxMs ?? SCREEN_HANDOFF_MAX_MS;
  const alive = opts?.alive ?? (() => true);
  const started = Date.now();
  let lastReasons: Array<ScreenHandoffReason> = [];
  const story = owePresentation({
    id: `screen-handoff:${id}`,
    ready: () => false, // the wait polls itself — the story is the diagnostic record, never a redrive
    redrive: () => {},
    dueMs: cap,
    diagnose: () => ({owed: lastReasons, holds: activeAnimationHoldLabels()}),
  });
  return new Promise((done) => {
    const poll = () => {
      if (!alive()) {
        story.settle();
        done('dead');
        return;
      }
      lastReasons = screenHandoffReasons(opts);
      if (lastReasons.length === 0) {
        story.settle();
        done('quiet');
        return;
      }
      if (Date.now() - started >= cap) {
        console.warn(`[screen-handoff] «${id}» took the screen after ${cap} ms with the player still owed: ` +
          `${lastReasons.join(', ')} (holds: ${activeAnimationHoldLabels().join(', ') || 'none'})`);
        story.settle();
        done('degraded');
        return;
      }
      probeTick(poll);
    };
    poll();
  });
}
