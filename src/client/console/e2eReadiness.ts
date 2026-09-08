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
import {workspaceStackDepth} from '@/client/console/consoleWorkspaceStack';
import {notificationsSettled} from '@/client/components/notifications/notificationState';
import {InputEchoSnapshot, inputEchoSnapshot} from '@/client/console/inputEcho';

export type ConsoleReadinessSnapshot = {
  input: InputEchoSnapshot;
  /** Names of every live animation hold — empty when the screen owes nothing. */
  holds: Array<string>;
  transport: ReturnType<typeof transportDiagFacts>;
  wsDepth: number;
  notificationsSettled: boolean;
  at: number;
};

export function consoleReadinessSnapshot(): ConsoleReadinessSnapshot {
  return {
    input: inputEchoSnapshot(),
    holds: activeAnimationHoldLabels(),
    transport: transportDiagFacts(),
    wsDepth: workspaceStackDepth(),
    notificationsSettled: notificationsSettled(),
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
