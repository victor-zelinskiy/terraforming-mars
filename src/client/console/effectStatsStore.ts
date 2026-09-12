/*
 * THE EFFECT-STATS STORE — the console's one cache of `/api/game/effect-stats`
 * (per-source passive-effect aggregates for ONE seat), keyed by
 * `gameStateVersion(view)` + the seat color.
 *
 * A stats answer is SERVER-DERIVED (an aggregate over the game's own event
 * stream), so the cache is version-keyed by law (`gameStateVersion.ts`; the
 * server memoizes the same route on the same `gameAge:undoCount` pair, so a
 * refetch inside an unchanged state is a memo hit). The seat is a STRUCTURAL
 * addition on top of the version, never instead of it — LB/RB inspects other
 * seats and each seat's aggregate is its own answer.
 *
 * SWR: a version change RE-ASKS, it does not blank — the previous answer keeps
 * painting for the few hundred ms its replacement is on the wire (per-seat
 * retention keeps the LB/RB round trip warm). A failed fetch keeps the stale
 * entry and clears the in-flight latch, so the next ensure retries.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {VersionedView, gameStateVersion} from '@/client/console/gameStateVersion';

type StatsEntry = {
  version: string;
  stats: ReadonlyArray<EffectOverlayStat>;
};

const state = reactive({
  entries: {} as Partial<Record<Color, StatsEntry>>,
});

/** The keys currently on the wire (per seat) — de-dups concurrent ensures and
 *  lets a landing answer drop itself when a newer ask superseded it. */
const inFlight = new Map<Color, string>();

/** The version stamp ONE seat's stats are cached under. */
export function effectStatsVersion(view: VersionedView, color: Color): string {
  return `${gameStateVersion(view)}#${color}`;
}

/** The cached stats for a seat (undefined = never answered — loading/absent). */
export function effectStatsFor(color: Color): ReadonlyArray<EffectOverlayStat> | undefined {
  return state.entries[color]?.stats;
}

/** Whether the cached entry for a seat is CURRENT against the view. */
export function effectStatsFresh(view: VersionedView, color: Color): boolean {
  return state.entries[color]?.version === effectStatsVersion(view, color);
}

type EffectStatsView = VersionedView & {id?: unknown};

/**
 * Idempotent ensure: fetch the seat's stats unless the cached entry (or the
 * in-flight ask) already carries the current version. Callers wire it to an
 * `immediate` watcher on `effectStatsVersion(view, color)` — never call fetch
 * themselves (the serverDerivedCacheGuard reads this file as the one talker).
 */
export function ensureEffectStats(view: EffectStatsView, color: Color): void {
  const id = String(view.id ?? '');
  if (id === '' || typeof fetch !== 'function') {
    return;
  }
  const version = effectStatsVersion(view, color);
  if (state.entries[color]?.version === version || inFlight.get(color) === version) {
    return;
  }
  inFlight.set(color, version);
  const url = apiUrl(paths.API_GAME_EFFECT_STATS) +
    '?id=' + encodeURIComponent(id) +
    '&color=' + encodeURIComponent(color);
  fetch(url)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((answer) => {
      // A newer ask superseded this one while it was on the wire — drop it
      // (the newer answer will land with its own version).
      if (inFlight.get(color) !== version) {
        return;
      }
      inFlight.delete(color);
      if (Array.isArray(answer)) {
        state.entries[color] = {version, stats: answer as ReadonlyArray<EffectOverlayStat>};
      }
      // A non-array / failed body keeps the stale entry (SWR) — the cleared
      // latch lets the next ensure retry.
    })
    .catch(() => {
      if (inFlight.get(color) === version) {
        inFlight.delete(color);
      }
    });
}

/** Full reset (the shell's transient-UI epoch — beside `resetActionPreviews`). */
export function resetEffectStats(): void {
  state.entries = {};
  inFlight.clear();
}
