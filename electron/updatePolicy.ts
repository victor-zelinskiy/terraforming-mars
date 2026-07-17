// Pure update-decision policy for the Electron main process (unit-tested) — Phase 8.
//
// Hardens the Phase-7 "fail-open on any network error" into a last-known-good policy:
//   - a FRESH compatibility result is authoritative;
//   - if the server is unreachable, fall back to the last result we DID get:
//       * it demanded an update → keep blocking (a known-outdated client shouldn't
//         unlock itself just by going offline) → `offlineBlocked`;
//       * it said we were compatible → fail-open (`normal`);
//   - never verified + no cache → fail-open by default (don't brick a first-run offline
//     launch), unless the operator opts into strict offline blocking.
//
// It also owns the PENDING-BUILD precedence: a CI build in flight is the real latest version, so
// it OUTRANKS an already-available update — the client locks and waits for it instead of updating
// to an intermediate release and then again minutes later.

export interface CompatSnapshot {
  latestVersion: string;
  minSupportedVersion: string;
  updateRequired: boolean;
  releaseNotes?: Array<string>;
  downloadUrl?: string;
  /** A newer release is building on CI but isn't published yet → the client waits for it.
   *  Only meaningful from a FRESH fetch (a stale offline value is ignored — a build that was
   *  running when we last had network has long since finished). */
  buildInProgress?: boolean;
  /** The version the in-progress build will publish (for the waiting-state message). */
  pendingVersion?: string;
}

export type UpdateDecisionMode = 'normal' | 'required' | 'pending' | 'offlineBlocked';

export interface UpdateDecision {
  mode: UpdateDecisionMode;
  /** The compat snapshot the decision used (fresh or cached), if any. */
  info?: CompatSnapshot;
  /** True when the decision fell back to a cached (last-known-good) snapshot. */
  usedCache: boolean;
}

export interface UpdateDecisionInput {
  /** Fresh fetch of /api/desktop/version; `undefined` = the request failed. */
  fresh: CompatSnapshot | undefined;
  /** Last-known-good snapshot persisted from a previous successful check. */
  cached: CompatSnapshot | undefined;
  /** Operator opt-in (env) to block when compatibility was NEVER verified. */
  strictOffline: boolean;
}

export function resolveUpdateDecision(input: UpdateDecisionInput): UpdateDecision {
  if (input.fresh !== undefined) {
    // A build in flight OUTRANKS `required`: it will publish a version newer than anything on the
    // feed right now, so downloading the currently-available release would only make the client
    // update a second time minutes later. Lock and wait for the build instead.
    return {
      mode: input.fresh.buildInProgress === true ?
        'pending' :
        input.fresh.updateRequired ? 'required' : 'normal',
      info: input.fresh,
      usedCache: false,
    };
  }
  if (input.cached !== undefined) {
    return {
      mode: input.cached.updateRequired ? 'offlineBlocked' : 'normal',
      info: input.cached,
      usedCache: true,
    };
  }
  return {mode: input.strictOffline ? 'offlineBlocked' : 'normal', usedCache: false};
}

/**
 * Post-pending BRIDGE plan. The pending poll (main process, ~25s) is what makes a CI-build pickup
 * fast — but it STOPS the moment the gate first reports "no longer pending", and the server's
 * `latestVersion` cache can lag the build's completion by a cache tick. In that gap the client
 * settles to up-to-date and then only re-checks on the slow menu timer, so the freshly-published
 * required update is picked up minutes late. The bridge keeps the fast poll alive for a few extra
 * ticks after leaving `pending`, so the moment the server's latest refreshes, `required` fires and
 * the download starts — without waiting for the menu tick. Self-terminating (bounded ticks); it
 * NEVER fires unless we were actually just pending, so ordinary in-game/idle runs are untouched.
 *
 * PURE (unit-tested). `settled` = the decision resolved to up-to-date/idle (nothing to do);
 * `wasPending` = the mode BEFORE this run was 'pending'. Returns whether to re-arm the fast poll
 * and the remaining tick budget.
 */
export function planPostPendingBridge(input: {
  settled: boolean;
  wasPending: boolean;
  ticksRemaining: number;
  maxTicks: number;
}): {keepPolling: boolean; ticksRemaining: number} {
  if (!input.settled) {
    // A non-settled decision (pending re-arms itself; required/offline take over) → reset bridge.
    return {keepPolling: false, ticksRemaining: 0};
  }
  const next = input.wasPending ? input.maxTicks : Math.max(0, input.ticksRemaining - 1);
  return {keepPolling: next > 0, ticksRemaining: next};
}

/** Identity of the running AppImage file — the thing Velopack's UpdateNix replaces. */
export interface AppImageIdentity {
  ino: number;
  mtimeMs: number;
}

/**
 * Content of the Linux restart marker (TM_RESTART_MARKER) written just before the
 * apply+exit. With the AppImage identity known it is `applying <inode> <mtimeSec>` —
 * the wrapper's restart loop parses it and WAITS until `stat -c '%i %Y'` on the
 * AppImage differs (the swap is a replace → new inode/mtime) before relaunching.
 * Without that wait the wrapper relaunched the moment the app exited, while
 * UpdateNix was still extracting — re-running the OLD version, which then
 * downloaded and applied the same update a second time (the double-apply seen in
 * the 1.1.325 Steam Machine log). mtime is floored to whole SECONDS because
 * that's what the wrapper's `stat -c '%Y'` yields. The identity-less fallback is
 * the legacy bare timestamp — an OLD wrapper ignores the content entirely (it
 * only tests -f), and a NEW wrapper treats a non-`applying` marker as
 * "relaunch immediately", so every app/wrapper version pairing stays safe.
 */
export function restartMarkerStamp(st: AppImageIdentity | undefined, now: number = Date.now()): string {
  if (st === undefined) {
    return String(now);
  }
  return `applying ${st.ino} ${Math.floor(st.mtimeMs / 1000)}`;
}
