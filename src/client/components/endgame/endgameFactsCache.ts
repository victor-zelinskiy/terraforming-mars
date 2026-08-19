/*
 * ENDGAME FACTS — one fetch per page load, shared by every endgame surface.
 *
 * The analysis-ready facts (`buildEndgameFacts` over the event stream) feed
 * the insight/episode engines. Two hosts need them — the desktop
 * EndgameExperience and the console endgame workspace («Обзор партии») — and
 * they must not race two fetches for the same payload. Module-reactive cache:
 * request once, every model builder reads the same array when it lands.
 *
 * Best-effort by contract: any failure leaves `facts` undefined and the
 * engines fall back to the base template analyzers (old games / offline).
 */
import {reactive} from 'vue';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import type {EndgameFact} from '@/common/events/endgameFacts';

const cache = reactive({
  gameId: undefined as string | undefined,
  facts: undefined as ReadonlyArray<EndgameFact> | undefined,
  requested: false,
});

/** Fire the one fetch (idempotent per game id; a new id restarts the cycle). */
export function requestEndgameFacts(gameId: string | undefined): void {
  if (gameId === undefined || typeof fetch !== 'function') {
    return;
  }
  if (cache.gameId !== gameId) {
    cache.gameId = gameId;
    cache.facts = undefined;
    cache.requested = false;
  }
  if (cache.requested) {
    return;
  }
  cache.requested = true;
  fetch(apiUrl(paths.API_GAME_ENDGAME_FACTS) + '?id=' + encodeURIComponent(gameId))
    .then((r) => (r.ok ? r.json() : undefined))
    .then((f) => {
      if (Array.isArray(f) && cache.gameId === gameId) {
        cache.facts = f as ReadonlyArray<EndgameFact>;
      }
    })
    .catch(() => { /* the base template insights remain */ });
}

/** The cached facts for this game id (undefined until the fetch lands). */
export function cachedEndgameFacts(gameId: string | undefined): ReadonlyArray<EndgameFact> | undefined {
  return gameId !== undefined && cache.gameId === gameId ? cache.facts : undefined;
}

/** Test-only reset. */
export function resetEndgameFactsCache(): void {
  cache.gameId = undefined;
  cache.facts = undefined;
  cache.requested = false;
}
