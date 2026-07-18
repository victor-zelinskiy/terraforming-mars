/**
 * Resolves a human-facing build version label from the generated
 * `settings.json` shape. ONE shared implementation so the client and the
 * server produce the SAME format — that is what makes the Diagnostics
 * «Client version» / «Server version» rows directly comparable (a difference
 * means the two are genuinely different builds, not two formats of the same
 * one).
 *
 * Resolution: the human release version (package.json — set to the release
 * tag by the release workflow) wins; otherwise the short git head.
 */
export function buildVersionLabel(settings: {version?: string, head?: string}): string {
  const version = settings.version;
  if (version !== undefined && version !== '') {
    return version;
  }
  return settings.head ?? '';
}
