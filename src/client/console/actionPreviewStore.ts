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
 *  - keyed by the SERVER'S OWN STATE VERSION (`gameStateVersion`) plus a
 *    structural net — see `actionPreviewFingerprint`. A real game-state change
 *    re-asks for EVERY preview; a poll replay of the same state is a no-op;
 *  - freshness is PER ENTRY (`versions`). An entry answered under an older
 *    version keeps PAINTING while its replacement is on the wire and is
 *    overwritten as it lands — true SWR. Blanking the cache instead would
 *    strip every tile's meta line and re-rank the status sort several times
 *    per opponent turn, which is the defect this store was built to remove;
 *  - in-flight de-dup (ensure() is idempotent and cheap to call often);
 *  - a STALE response (the version moved while the request flew) is dropped;
 *  - a fetch failure seeds the confirm-only dynamic fallback — activation is
 *    never blocked by a lost request, and a stale entry never survives its own
 *    failed refetch.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {fetchPreview} from '@/client/utils/previewFetch';
import {buildActionEntries} from '@/client/components/actions/actionModel';
import {findPerformActionCard} from '@/client/console/turnIntents';
import {gameStateVersion} from '@/client/console/gameStateVersion';

export const actionPreviewStore = reactive({
  /** The version the LATEST ensure() asked about. */
  key: '',
  previews: {} as Record<string, ActionPreview | undefined>,
  /**
   * Per card: the version its cached preview was FETCHED under. An entry whose
   * version is behind `key` is stale-in-flight — still painted (see below),
   * already re-requested, replaced the moment its answer lands.
   */
  versions: {} as Record<string, string>,
});

/** Requests queued OR on the wire (per card) — ensure() never double-fetches. */
const inflight = new Set<string>();

/**
 * Bounded fan-out. The wheel-open pre-warm used to fire one fetch per action
 * source in a single synchronous burst (10-20 late game). On the Deck the
 * embedded server shares the APU with the renderer, so N simultaneous preview
 * computations landed exactly under the wheel's entry animation. A small
 * concurrency window drains the same set well inside the human
 * «press → descend» pause without the thundering herd — and the N reactive
 * writes arrive in a few flushes instead of N.
 */
const MAX_CONCURRENT_PREVIEW_FETCHES = 4;
type PreviewFetchJob = {cardName: CardName, key: string, url: string};
const fetchQueue: Array<PreviewFetchJob> = [];
let activeFetches = 0;
/** In-flight aborts — a key change cancels stale requests at the socket, so
 *  fresh previews never queue behind answers nobody will read. */
const activeAborts = new Set<AbortController>();

function abortActiveFetches(): void {
  for (const controller of [...activeAborts]) {
    controller.abort();
  }
}

function runPreviewFetch(job: PreviewFetchJob): void {
  activeFetches++;
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  if (controller !== undefined) {
    activeAborts.add(controller);
  }
  const done = () => {
    activeFetches--;
    if (controller !== undefined) {
      activeAborts.delete(controller);
    }
    inflight.delete(job.cardName);
  };
  // ONE ROAD FOR EVERY OUTCOME (`fetchPreview` never rejects): a preview, a
  // 204 «no preview for that subject» (the card left the tableau), a failed
  // request and an abort all arrive here as `undefined` — and all four end this
  // entry's grace period identically. The key guard makes the abort case a
  // no-op, since an abort only ever follows a key change.
  fetchPreview<ActionPreview>(job.url, controller !== undefined ? {signal: controller.signal} : undefined)
    .then((p) => {
      done();
      if (actionPreviewStore.key === job.key) {
        if (p !== undefined) {
          actionPreviewStore.previews[job.cardName] = p;
          actionPreviewStore.versions[job.cardName] = job.key;
        } else {
          seedFallback(job.cardName, job.key);
        }
      }
      pumpPreviewFetches();
    });
}

function pumpPreviewFetches(): void {
  while (activeFetches < MAX_CONCURRENT_PREVIEW_FETCHES && fetchQueue.length > 0) {
    const job = fetchQueue.shift();
    if (job === undefined) {
      return;
    }
    if (actionPreviewStore.key !== job.key) {
      // The state moved on while this sat in the queue — a stale ask.
      inflight.delete(job.cardName);
      continue;
    }
    runPreviewFetch(job);
  }
}

/**
 * THE cache key — read by the store AND by every surface that watches for
 * "should these previews be refetched?". There is exactly one recipe; a second
 * copy at a call site is how the Action Center's watcher silently stopped
 * agreeing with the store it was driving.
 *
 * TERM 1 — THE SERVER'S OWN STATE VERSION, and it is the one that makes this
 * complete. A preview is a SERVER verdict computed off the server's whole live
 * state, so the client cannot enumerate its inputs: `Factorum`'s first branch
 * reads `player.energy`, `Viron`'s reads the played tableau, a requirement-
 * gated action reads a global parameter, an opponent-targeting action reads
 * another seat. Every hand-listed term below is an allow-list of what somebody
 * remembered, and the cache used to survive changes to its own input — the
 * player spent their energy, none of the structural terms moved, and «Фактотум»
 * stayed blocked with «Только когда у вас нет энергии» for the rest of the
 * game. `gameAge`/`undoCount` cannot miss it: the server bumps one of them for
 * every log event and once per fully-resolved action.
 *
 * TERMS 2+ — the STRUCTURAL NET, kept deliberately. It covers the one window
 * the version does not: state the server has already changed and shown us
 * inside a still-unresolved action (a deferred step mid-chain logs nothing and
 * bumps nothing). It is a net, not the guarantee — never "fix" a staleness bug
 * by adding a term here alone.
 */
export function actionPreviewFingerprint(playerView: PlayerViewModel): string {
  const p = playerView.thisPlayer;
  const cards = p.tableau
    .map((c) => `${c.name}:${c.actionReasons?.length ?? 0}:${c.resources ?? ''}:${c.isDisabled === true ? 'd' : ''}`)
    .join('|');
  const available = (findPerformActionCard(playerView.waitingFor)?.model.cards ?? [])
    .map((c) => c.name).sort().join(',');
  // The viewer's ECONOMY — what most action previews actually price themselves
  // against (`canAfford`, «только когда у вас нет энергии», production steps).
  const stock = `${p.megacredits},${p.steel},${p.titanium},${p.plants},${p.energy},${p.heat},${p.terraformRating}`;
  const prod = `${p.megacreditProduction},${p.steelProduction},${p.titaniumProduction},${p.plantProduction},${p.energyProduction},${p.heatProduction}`;
  // The viewer's OWN Hydronetwork position: a preview may carry a track move's
  // whole verdict (Storm Surge Barrier's `DeltaAdvanceOffer` — from, to, the
  // landing stage), and the ordinary track advance changes NONE of the terms
  // above.
  const delta = p.deltaProject?.position ?? '';
  return `${gameStateVersion(playerView)}#${cards}#${available}#${stock}#${prod}#dp${delta}`;
}

/**
 * A lost request must never block an activation — and, just as importantly,
 * must never leave a STALE verdict standing for good. So the confirm-only
 * dynamic preview replaces an entry from an older version (the failure is the
 * end of that entry's grace period), and is stamped under the current version
 * so ensure() stops re-asking within this state. A fresh entry is kept: it is
 * already the answer for this very version.
 */
function seedFallback(cardName: CardName, key: string): void {
  if (actionPreviewStore.versions[cardName] === key &&
      actionPreviewStore.previews[cardName] !== undefined) {
    return;
  }
  actionPreviewStore.previews[cardName] = {
    card: cardName,
    isCorporation: false,
    kind: 'dynamic',
    branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
  };
  actionPreviewStore.versions[cardName] = key;
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
    // A VERSION CHANGE RE-ASKS; IT DOES NOT BLANK THE GRID. Wiping `previews`
    // here was correct while the key only ever moved on the viewer's OWN
    // committed action (the workspace is mid-commit then, and its `committedPreview`
    // latch hides the gap). The key now moves on ANY server-side change — an
    // opponent's turn included — and the Action Center is explicitly a PLANNING
    // instrument read during opponents' turns, so a wipe would drop every
    // tile's meta line and re-rank the status sort several times per opponent
    // turn: exactly the «jumping tiles» this store exists to remove. The
    // previous answers keep painting for the few hundred ms their replacements
    // are on the wire, per-entry, and each is overwritten as it lands.
    actionPreviewStore.key = key;
    inflight.clear();
    fetchQueue.length = 0;
    abortActiveFetches();
  }
  const entries = buildActionEntries(playerView.thisPlayer, {
    availableNames: new Set((findPerformActionCard(playerView.waitingFor)?.model.cards ?? []).map((c) => c.name)),
    isViewerSeat: true,
    awaitingInput: playerView.waitingFor !== undefined,
    usedNames: new Set(playerView.thisPlayer.actionsThisGeneration ?? []),
  });
  // Drop what is no longer an action source at all (a card left the tableau) —
  // without the wipe, nothing else would ever evict it.
  const live = new Set<string>(entries.map((e) => String(e.cardName)));
  for (const cached of Object.keys(actionPreviewStore.previews)) {
    if (!live.has(cached)) {
      delete actionPreviewStore.previews[cached];
      delete actionPreviewStore.versions[cached];
    }
  }
  for (const entry of entries) {
    const cardName = entry.cardName;
    // FRESHNESS IS PER ENTRY, not «is anything cached»: an entry answered under
    // an older version is exactly what has to be re-asked.
    if (actionPreviewStore.versions[cardName] === key || inflight.has(cardName)) {
      continue;
    }
    inflight.add(cardName);
    const url = apiUrl(paths.API_ACTION_PREVIEW) +
      '?id=' + encodeURIComponent(playerView.id) +
      '&card=' + encodeURIComponent(cardName);
    fetchQueue.push({cardName, key, url});
  }
  pumpPreviewFetches();
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
  actionPreviewStore.versions = {};
  inflight.clear();
  fetchQueue.length = 0;
  abortActiveFetches();
}
