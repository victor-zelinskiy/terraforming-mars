/*
 * Rollback lever for the no-remount update model (see
 * REMOUNT_ANIMATION_REWORK_DESIGN.md, Phase 1).
 *
 * By default the in-game update path applies a fresh playerView snapshot
 * REACTIVELY — <player-home> is no longer keyed on `playerkey`, so the game
 * subtree lives across server responses and `playerkey` acts purely as the
 * "reset transient UI" epoch. Setting this flag restores the legacy behavior
 * (`:key="playerkey"` → full remount per update) — an instant, client-side,
 * non-destructive kill-switch mirroring the realtime flag ladder
 * (WEBSOCKET_MIGRATION_PLAN.md §L.6).
 *
 * Enable with `?remount=1` or `localStorage.tm_remount = '1'`.
 */
let cached: boolean | undefined;

export function legacyRemountEnabled(): boolean {
  if (cached !== undefined) {
    return cached;
  }
  cached = readFlag();
  return cached;
}

function readFlag(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    if (/[?&]remount=1/.test(window.location.search)) {
      return true;
    }
    // globalThis first so the test harness's FakeLocalStorage (registered on
    // the global) is honoured; falls back to the real window.localStorage.
    const storage: Storage | undefined =
      (globalThis as {localStorage?: Storage}).localStorage ?? window.localStorage;
    return storage?.getItem('tm_remount') === '1';
  } catch (err) {
    return false;
  }
}

/** Test-only: clear the memoised flag so specs can vary it. */
export function __resetLegacyRemountForTesting(): void {
  cached = undefined;
}
