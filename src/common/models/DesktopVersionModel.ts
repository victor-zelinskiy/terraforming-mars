/**
 * Desktop (Electron) compatibility + update metadata — the `GET /api/desktop/version`
 * response. Phase 7. The Electron MAIN process fetches this on startup to decide whether
 * the installed desktop version is still allowed to play (the authoritative "you're too
 * old, must update" gate) BEFORE the game runtime is restored.
 */
export interface DesktopVersionModel {
  /** The newest available desktop version. */
  latestVersion: string;
  /** The oldest desktop version still allowed to play. */
  minSupportedVersion: string;
  /** Mirrors REALTIME_PROTOCOL_VERSION — a bump forces a desktop upgrade. */
  serverProtocolVersion: number;
  /** True when the caller's `current` version is below min (or an operator force flag is set). */
  updateRequired: boolean;
  channel: string;
  platform: string;
  releaseNotes: Array<string>;
  /** Where to obtain the installer (manual-download fallback when auto-update isn't wired). */
  downloadUrl?: string;
  /** True when a NEWER desktop build is currently building on CI but its release isn't published
   *  yet — the client LOCKS in a waiting mode and polls until it lands, then updates straight to
   *  it. Takes PRECEDENCE over `updateRequired` (they can be set together): the build in flight is
   *  the real latest version, so a client below it must NOT first update to whatever intermediate
   *  release happens to be published — that would make it update twice within minutes. */
  buildInProgress: boolean;
  /** The version the in-progress build will publish (e.g. '1.1.231'), when known. */
  pendingVersion?: string;
}

/**
 * Numeric `x.y.z` comparison (returns -1 / 0 / 1). Deliberately simple — the desktop
 * versions are plain dotted numbers; prerelease/build semantics are not used.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) {
      return d < 0 ? -1 : 1;
    }
  }
  return 0;
}

export interface DesktopVersionOptions {
  latestVersion: string;
  minSupportedVersion: string;
  serverProtocolVersion: number;
  channel: string;
  platform: string;
  releaseNotes: ReadonlyArray<string>;
  downloadUrl?: string;
  /** Operator override (env) to force every client to update regardless of version. */
  forceUpdate?: boolean;
  /** The caller's installed version (`?current=`); when below min → updateRequired. */
  currentVersion?: string;
  /** When true, ALSO require an update whenever the caller is below `latestVersion`
   *  ("always update to the newest release"). Opt-in so the pure default stays min-based
   *  (the route sets it; unit tests keep the historical min-only behaviour). */
  requireLatest?: boolean;
  /** The version a release build currently running on CI will publish (from the in-progress
   *  workflow run). Drives `buildInProgress` when it's newer than the caller's `current`. */
  pendingVersion?: string;
}

/** Pure builder of the compatibility response (unit-tested). */
export function computeDesktopVersion(o: DesktopVersionOptions): DesktopVersionModel {
  const belowMin =
    o.currentVersion !== undefined &&
    o.currentVersion !== '' &&
    compareVersions(o.currentVersion, o.minSupportedVersion) < 0;
  // "Always require an update when a newer version exists" — opt-in via requireLatest.
  const belowLatest =
    o.requireLatest === true &&
    o.currentVersion !== undefined &&
    o.currentVersion !== '' &&
    compareVersions(o.currentVersion, o.latestVersion) < 0;
  const updateRequired = o.forceUpdate === true || belowMin || belowLatest;
  // A build is "pending" whenever CI will publish a version NEWER than the caller has. It is
  // deliberately NOT suppressed by `updateRequired`: the build in flight is the real latest
  // version, so a caller below it should wait for THAT release rather than update to whatever
  // intermediate one is published right now (which would mean updating twice within minutes).
  // The client reads `buildInProgress` first and locks; `updateRequired` stays honest about the
  // caller being out of date and takes over the moment the build lands.
  const buildInProgress =
    o.pendingVersion !== undefined &&
    o.pendingVersion !== '' &&
    o.currentVersion !== undefined &&
    o.currentVersion !== '' &&
    compareVersions(o.currentVersion, o.pendingVersion) < 0;
  return {
    latestVersion: o.latestVersion,
    minSupportedVersion: o.minSupportedVersion,
    serverProtocolVersion: o.serverProtocolVersion,
    updateRequired,
    channel: o.channel,
    platform: o.platform,
    releaseNotes: [...o.releaseNotes],
    downloadUrl: o.downloadUrl,
    buildInProgress,
    pendingVersion: buildInProgress ? o.pendingVersion : undefined,
  };
}
