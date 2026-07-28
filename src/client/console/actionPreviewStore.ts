/*
 * ACTION PREVIEW STORE — the module-level SWR cache of `/api/action-preview`
 * responses for the console Action Center.
 *
 * WHY A MODULE STORE (the "jumping tiles" fix): the browse grid's per-variant
 * refinement (branch availability, reasons, choice markers) rides these
 * previews. When they lived in component data, EVERY open refetched from
 * scratch and each per-card response landed at its own moment — tiles grew
 * their meta lines one by one and the status sort re-ranked groups mid-look
 * (the visible "buttons rebuild and jump"). Here the cache SURVIVES the
 * overlay's mount/unmount, and the SHELL pre-warms it the moment the RT
 * wheel opens — by the time the player commits «Действия карт» (~300 ms of
 * human time later) the data is already complete, so the grid renders its
 * final geometry and order on the FIRST frame.
 *
 * Contract:
 *  - keyed by an availability FINGERPRINT (player id + tableau action state +
 *    the server's activatable set): a real game-state change invalidates the
 *    whole cache and refetches; a poll replay of the same state is a no-op;
 *  - in-flight de-dup (ensure() is idempotent and cheap to call often);
 *  - a STALE response (fingerprint moved while the request flew) is dropped;
 *  - a fetch failure seeds the same confirm-only dynamic fallback the
 *    component used — activation is never blocked by a lost request, and a
 *    later successful pass may overwrite the fallback (SWR).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {buildActionEntries} from '@/client/components/actions/actionModel';
import {findPerformActionCard} from '@/client/console/turnIntents';

export const actionPreviewStore = reactive({
  /** The availability fingerprint the cached previews belong to. */
  key: '',
  previews: {} as Record<string, ActionPreview | undefined>,
});

/** Requests currently on the wire (per card) — ensure() never double-fetches. */
const inflight = new Set<string>();

/** The same availability fingerprint recipe the Action Center watches. */
export function actionPreviewFingerprint(playerView: PlayerViewModel): string {
  const cards = playerView.thisPlayer.tableau
    .map((c) => `${c.name}:${c.actionReasons?.length ?? 0}:${c.resources ?? ''}:${c.isDisabled === true ? 'd' : ''}`)
    .join('|');
  const available = (findPerformActionCard(playerView.waitingFor)?.model.cards ?? [])
    .map((c) => c.name).sort().join(',');
  return `${playerView.id}#${cards}#${available}`;
}

function seedFallback(cardName: CardName): void {
  if (actionPreviewStore.previews[cardName] !== undefined) {
    return;
  }
  actionPreviewStore.previews[cardName] = {
    card: cardName,
    isCorporation: false,
    kind: 'dynamic',
    branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
  };
}

/**
 * Make sure every action source's preview is cached (or on the wire) for the
 * CURRENT game state. Called by the shell when the RT wheel opens (the
 * pre-warm) and by the Action Center on mount / fingerprint change.
 */
export function ensureActionPreviews(playerView: PlayerViewModel): void {
  if (String(playerView.id) === '' || typeof fetch !== 'function') {
    return;
  }
  const key = actionPreviewFingerprint(playerView);
  if (actionPreviewStore.key !== key) {
    actionPreviewStore.key = key;
    actionPreviewStore.previews = {};
    inflight.clear();
  }
  const entries = buildActionEntries(playerView.thisPlayer, {
    availableNames: new Set((findPerformActionCard(playerView.waitingFor)?.model.cards ?? []).map((c) => c.name)),
    isViewerSeat: true,
    awaitingInput: playerView.waitingFor !== undefined,
    usedNames: new Set(playerView.thisPlayer.actionsThisGeneration ?? []),
  });
  for (const entry of entries) {
    const cardName = entry.cardName;
    if (actionPreviewStore.previews[cardName] !== undefined || inflight.has(cardName)) {
      continue;
    }
    inflight.add(cardName);
    const url = apiUrl(paths.API_ACTION_PREVIEW) +
      '?id=' + encodeURIComponent(playerView.id) +
      '&card=' + encodeURIComponent(cardName);
    fetch(url)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((p) => {
        inflight.delete(cardName);
        if (actionPreviewStore.key !== key) {
          return; // the state moved on while this flew — a stale answer
        }
        if (p !== undefined) {
          actionPreviewStore.previews[cardName] = p as ActionPreview;
        } else {
          seedFallback(cardName);
        }
      })
      .catch(() => {
        inflight.delete(cardName);
        if (actionPreviewStore.key === key) {
          seedFallback(cardName);
        }
      });
  }
}

/** The cached previews as the Map the pure model consumes. */
export function actionPreviewMap(): Map<CardName, ActionPreview> {
  const m = new Map<CardName, ActionPreview>();
  for (const [k, v] of Object.entries(actionPreviewStore.previews)) {
    if (v !== undefined) {
      m.set(k as CardName, v);
    }
  }
  return m;
}

/** Game-switch reset (mirrors the other module stores). */
export function resetActionPreviews(): void {
  actionPreviewStore.key = '';
  actionPreviewStore.previews = {};
  inflight.clear();
}
