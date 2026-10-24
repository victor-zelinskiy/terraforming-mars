/**
 * @console-shared LIVE — console native stands on this file.
 *
 * E2E READINESS PROBE — `window.__conReady`, ONE read-only snapshot of every
 * «is the console busy?» fact the product already tracks internally:
 *
 *   · the NAMED animation holds (`animationHold.ts` — every critical cinematic
 *     registers there by contract, and every hold names itself);
 *   · the transport (in-flight request, cinematic gates, the live prompt's
 *     identity, the server's own change counters `gameAge`/`undoCount`);
 *   · the workspace stack depth;
 *   · the notification feed's settled predicate;
 *   · the input-echo counters (`inputEcho.ts` — folded in so one read answers
 *     «did my press arrive AND is the screen quiet»).
 *
 * WHY: e2e drivers used to GUESS at readiness with fixed sleeps (2213 of
 * them, 2767 s of literal sleep — docs/E2E_ARCHITECTURE_REWORK.md phase 2).
 * This probe replaces the guess with the product's own facts, and a settle
 * timeout can finally say WHICH hold was open instead of «timed out».
 *
 * Read-only by construction: every source is a snapshot getter; nothing here
 * subscribes, watches or mutates. Cost is zero until something calls it.
 *
 * Installed from ConsoleShell's mount — the shell already stands on every
 * module imported here, so this file adds no NEW edges to any import graph
 * (a static chain reaching a webpack-chunk consumer would silently zero
 * mochapack spec files; the menu-safe half lives in `inputEcho.ts` alone).
 */
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';
import {transportDiagFacts} from '@/client/console/transport/gameTransport';
import {stackYieldedToBoard, workspaceStackDepth} from '@/client/console/consoleWorkspaceStack';
import {notificationsSettled} from '@/client/components/notifications/notificationState';
import {InputEchoSnapshot, inputEchoSnapshot} from '@/client/console/inputEcho';
import {parliamentRewardDiag} from '@/client/console/parliament/parliamentRewardBeat';
import {boardCardBonusDiag} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {colonyTrackWaveDiag} from '@/client/console/colonyTrade/consoleColonyTrade';
import {railRewardDiag} from '@/client/console/resourceTransfer/railReward';
import {actionCommitRailState} from '@/client/console/consoleActionCommitRail';
import {transferTrailTail} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {playedHeroState} from '@/client/console/played/consolePlayedHero';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {boardBeatParkState} from '@/client/console/boardBeatPark';
import {scaleStepRatingState} from '@/client/console/scaleStepReward/scaleStepRatingBeat';
import {presentationLedgerSnapshot} from '@/client/console/presentationLedger';
import {planetFocusState} from '@/client/console/planetFocus';

export type ConsoleReadinessSnapshot = {
  input: InputEchoSnapshot;
  /** Names of every live animation hold — empty when the screen owes nothing. */
  holds: Array<string>;
  transport: ReturnType<typeof transportDiagFacts>;
  wsDepth: number;
  /** The workspace stack stands ASIDE for a board placement (its frames wait to come back at the same depth). */
  wsYielded: boolean;
  notificationsSettled: boolean;
  /** The parliament's reward ledger — what the sitting still owes and what it did with each record (Turmoil Redux). */
  parliamentReward: ReturnType<typeof parliamentRewardDiag>;
  /** The board-card-bonus scene (cover lifts) — its phase, its source and why its last scene ended. */
  cardBonus: ReturnType<typeof boardCardBonusDiag>;
  /** A law's WAVE over every colony track (Turmoil Redux, Unity Budget) — on stage, and how the last one ended. */
  colonyTrackWave: ReturnType<typeof colonyTrackWaveDiag>;
  /** The rewards still held ON THE RAIL (a gain shown arriving — `railReward.ts`) and the last one that degraded, by name. */
  railReward: ReturnType<typeof railRewardDiag>;
  /** A card action's RAIL HALF (a direct TR, a capsule timeline — TR28): whose, its phase, the link in the air, why the last one ended early. */
  actionCommitRail: {card: string, phase: string, link: number, lastEnd: string, capsules: Array<string>, fallback: string};
  /** The flights' own trail (T09, decision 8): the runs, their ends, the seeds' verdicts (`rail:seed`), the halves' ends (`rail:end`), the fold's waits. */
  transfer: {trail: ReadonlyArray<unknown>};
  /** The card PLAY's landing scene: its phase and how its SHIPMENT BEAT (the price taken off the rail — PL-107) ended, by name. */
  playedHero: {phase: string, shipment: string, bill: string, host: string};
  /** The workspace OUTCOME claim's gates — who holds it, how far the answer / the beat / the arrival are (an embedded stage swallows presses while `arrivalDone` is false). */
  outcome: {host: string, stage: string, answerIn: boolean, beatDone: boolean, arrivalDone: boolean, arrivalFlown: boolean};
  /**
   * THE SCALES' STORY (PL-778): the camera's phase, the park (draining · the parameters it still holds), the step-rating
   * beat's phase, and every owed presentation story with the reason it still waits — a late token names its cause.
   */
  scaleStory: {camera: string, storyReady: boolean, draining: boolean, held: string, rating: string,
    owed: Array<{id: string, ageMs: number, why: string}>};
  at: number;
};

export function consoleReadinessSnapshot(): ConsoleReadinessSnapshot {
  return {
    input: inputEchoSnapshot(),
    holds: activeAnimationHoldLabels(),
    transport: transportDiagFacts(),
    wsDepth: workspaceStackDepth(),
    wsYielded: stackYieldedToBoard(),
    notificationsSettled: notificationsSettled(),
    parliamentReward: parliamentRewardDiag(),
    cardBonus: boardCardBonusDiag(),
    colonyTrackWave: colonyTrackWaveDiag(),
    railReward: railRewardDiag(),
    actionCommitRail: {card: actionCommitRailState.card, phase: actionCommitRailState.phase, link: actionCommitRailState.link, lastEnd: actionCommitRailState.lastEnd, capsules: [...actionCommitRailState.capsules], fallback: actionCommitRailState.fallback},
    transfer: {trail: transferTrailTail(40)},
    playedHero: {phase: playedHeroState.phase, shipment: playedHeroState.shipment, bill: playedHeroState.bill, host: playedHeroState.host},
    outcome: {
      host: workspaceOutcomeState.host ?? '', stage: workspaceOutcomeState.stage, answerIn: workspaceOutcomeState.answerIn,
      beatDone: workspaceOutcomeState.beatDone, arrivalDone: workspaceOutcomeState.arrivalDone, arrivalFlown: workspaceOutcomeState.arrivalFlown,
    },
    scaleStory: {
      camera: planetFocusState.phase, storyReady: planetFocusState.storyReady,
      draining: boardBeatParkState.draining, held: Object.keys(boardBeatParkState.heldParams ?? {}).join(','),
      rating: scaleStepRatingState.phase,
      owed: presentationLedgerSnapshot().stories.map((s) => ({id: s.id, ageMs: s.ageMs, why: s.why})),
    },
    at: Date.now(),
  };
}

/** Idempotent; ConsoleShell installs it on mount. */
export function installConsoleReadinessProbe(): void {
  if (typeof window === 'undefined') {
    return;
  }
  (window as unknown as {__conReady?: () => ConsoleReadinessSnapshot}).__conReady = consoleReadinessSnapshot;
}
