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

export interface CompatSnapshot {
  latestVersion: string;
  minSupportedVersion: string;
  updateRequired: boolean;
  releaseNotes?: Array<string>;
  downloadUrl?: string;
  /** A newer release is building on CI but isn't published yet → the client waits for it.
   *  Only meaningful from a FRESH fetch (a stale offline value is ignored). */
  buildInProgress?: boolean;
  /** The version the in-progress build will publish (for the waiting-state message). */
  pendingVersion?: string;
}

export type UpdateDecisionMode = 'normal' | 'required' | 'offlineBlocked';

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
    return {
      mode: input.fresh.updateRequired ? 'required' : 'normal',
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
