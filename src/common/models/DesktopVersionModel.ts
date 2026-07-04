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
  return {
    latestVersion: o.latestVersion,
    minSupportedVersion: o.minSupportedVersion,
    serverProtocolVersion: o.serverProtocolVersion,
    updateRequired: o.forceUpdate === true || belowMin || belowLatest,
    channel: o.channel,
    platform: o.platform,
    releaseNotes: [...o.releaseNotes],
    downloadUrl: o.downloadUrl,
  };
}
