/*
 * HAND PLAY PREWARM — the focused card's play preparation, started BEFORE A.
 *
 * WHY. The play level used to begin existing only after the press: A mounted
 * the composer, the composer fetched the authoritative preview over the wire,
 * and until it landed the screen held a «Загрузка…» row whose replacement
 * re-laid the column. Every one of those firsts happened INSIDE the entry
 * transition — which is exactly where a first may never happen.
 *
 * WHAT THIS IS. A tiny staged pipeline keyed to hand focus:
 *
 *   focus lands on a playable card
 *     → (dwell ~90 ms of STABLE focus — riffling through the hand costs nothing)
 *     → fetch the authoritative preview once, into a version-keyed cache
 *     → A reads the cache SYNCHRONOUSLY: no network, no loading row, no
 *       content swap after the reveal.
 *
 * WHAT THIS IS NOT. No hidden pre-mounted workspace, no per-card DOM, no
 * watchers on invisible stages: the only prepared artifact is the DATA (the
 * server's own preview model), because that is the only thing whose absence
 * was visible after A. The card art is already on screen in the grid (same
 * URL → browser cache), fonts are long loaded, and the anchor geometry is
 * content-independent by layout.
 *
 * CORRECTNESS OVER WARMTH. A cache entry is stamped with the game-state
 * VERSION it was fetched under (player + gameAge + undoCount). A read under
 * any other version is a MISS — resources, discounts and requirements may
 * have moved, and showing a stale proposal for the sake of a smooth reveal is
 * exactly the trade this fork never makes. Stale entries are not patched;
 * they simply stop matching.
 */
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';

/** Stable focus this long → the card is being CONSIDERED, not riffled past. */
export const HAND_PLAY_DWELL_MS = 90;

/** Bound the cache: a riffled-through hand must not pin every preview. */
const CACHE_CAP = 14;

type CacheEntry = {version: string, preview: ActionPreview | undefined};

const cache = new Map<string, CacheEntry>();

let armedTimer: ReturnType<typeof setTimeout> | undefined;
let armedName = '';

/** The game-state version a preparation is only valid under. */
export function handPlayVersionOf(view: Pick<PlayerViewModel, 'id' | 'game'>): string {
  return `${view.id}|${view.game.gameAge}|${view.game.undoCount ?? 0}`;
}

/** The ONE preview URL builder — the composer and the prewarm share it, so
 *  the warmed request and the live request can never drift apart. */
export function playPreviewUrl(playerId: string, cardName: string): string {
  return apiUrl(paths.API_CARD_PLAY_PREVIEW) +
    '?id=' + encodeURIComponent(playerId) + '&card=' + encodeURIComponent(cardName);
}

function defaultLoader(view: PlayerViewModel, cardName: string): Promise<ActionPreview | undefined> {
  return fetch(playPreviewUrl(view.id, cardName))
    .then((r) => (r.ok ? r.json() : undefined))
    .then((p) => p as ActionPreview | undefined)
    .catch(() => undefined);
}

function store(cardName: string, entry: CacheEntry): void {
  cache.delete(cardName);
  cache.set(cardName, entry);
  // Map preserves insertion order — the oldest warm entry falls off first.
  while (cache.size > CACHE_CAP) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
}

/**
 * Focus landed on a playable card: after a short STABLE dwell, warm its
 * preview. LATEST FOCUS WINS — re-arming cancels the pending dwell, so
 * riffling across ten cards fires zero requests; only the card the player
 * actually settles on is fetched. A resolve that comes back for an earlier
 * card still stores (under its own name and version) — correct data is
 * correct data — it just never outranks anything.
 */
export function armHandPlayPrewarm(
  view: PlayerViewModel,
  cardName: string,
  loader: (view: PlayerViewModel, cardName: string) => Promise<ActionPreview | undefined> = defaultLoader,
  dwellMs: number = HAND_PLAY_DWELL_MS,
): void {
  cancelHandPlayPrewarm();
  const version = handPlayVersionOf(view);
  const fresh = cache.get(cardName);
  if (fresh !== undefined && fresh.version === version) {
    return; // already warm for THIS game state
  }
  armedName = cardName;
  armedTimer = setTimeout(() => {
    armedTimer = undefined;
    if (armedName !== cardName) {
      return;
    }
    void loader(view, cardName).then((preview) => {
      // Version captured at REQUEST time: if the game state moved while the
      // request flew, the entry simply never matches a read.
      store(cardName, {version, preview});
    });
  }, dwellMs);
}

/** Focus left the playable card (or the hand) — the pending dwell dies. */
export function cancelHandPlayPrewarm(): void {
  if (armedTimer !== undefined) {
    clearTimeout(armedTimer);
    armedTimer = undefined;
  }
  armedName = '';
}

/**
 * The composer's synchronous read at mount. A HIT means: this exact card,
 * fetched under this exact game-state version — safe to show without a
 * round-trip. Anything else is a MISS and the composer fetches live (the
 * fast-A-before-dwell path; the entry transition's stability gate absorbs
 * the frames it costs).
 */
export function takeHandPlayPreview(
  view: Pick<PlayerViewModel, 'id' | 'game'>,
  cardName: string,
): {hit: boolean, preview?: ActionPreview | undefined} {
  const entry = cache.get(cardName);
  if (entry === undefined || entry.version !== handPlayVersionOf(view)) {
    return {hit: false};
  }
  return {hit: true, preview: entry.preview};
}

/** The composer's own fetch feeds the cache too — a pick-bridge return or a
 *  re-open inside the same game state remounts instantly. */
export function storeHandPlayPreview(
  view: Pick<PlayerViewModel, 'id' | 'game'>,
  cardName: string,
  preview: ActionPreview | undefined,
): void {
  store(cardName, {version: handPlayVersionOf(view), preview});
}

/** Game switch / shell unmount / test isolation. */
export function resetHandPlayPrewarm(): void {
  cancelHandPlayPrewarm();
  cache.clear();
}
