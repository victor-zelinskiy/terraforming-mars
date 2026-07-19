/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';
import {Color} from '@/common/Color';
import {BoardName} from '@/common/boards/BoardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {BoardCellInfo, BoardPlacementKind, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';

/**
 * Module-level reactive store for the premium BoardInformation hover inspector.
 * Survives PlayerHome's `:key` remount (like `journalState`). The board-hover
 * delegate (`Board.vue`) writes the hovered cell; `BoardCellInfoPopover.vue`
 * reads the fetched facts. A short debounce + a per-(color,space) cache keep the
 * bounded `/api/game/board-cell-preview` calls light. No-op under JSDOM / before
 * configuration (`cfg.participantId` unset) so tests don't hit the network.
 */
type Config = {
  participantId: string | undefined;
  color: Color | undefined;
  boardName: BoardName | undefined;
  players: ReadonlyArray<PublicPlayerModel>;
};

type State = {
  /** The cell currently hovered (hover inspector). */
  spaceId: SpaceId | undefined;
  info: BoardCellInfo | undefined;
  loading: boolean;
  // BRD-3 (docs/PERFORMANCE_AUDIT.md): the hovered cell's bounding rect captured at
  // hover-ENTER (the delegate already holds the element), so the popover reads a
  // stored rect instead of running a `querySelector` + layout-forcing
  // `getBoundingClientRect` inside its position computed. undefined when the
  // caller didn't supply one (e.g. the `i` badge) → the popover falls back to
  // the query.
  cellRect: DOMRect | undefined;
  cfg: Config;
};

export const boardInfoState: State = reactive({
  spaceId: undefined,
  info: undefined,
  loading: false,
  cellRect: undefined,
  cfg: {participantId: undefined, color: undefined, boardName: undefined, players: []},
});

const infoCache = new Map<string, BoardCellInfo>();
const previewCache = new Map<string, BoardPlacementPreview>();
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let hoverToken = 0;

export function configureBoardInfo(cfg: Partial<Config>): void {
  const c = boardInfoState.cfg;
  // ALWAYS drop the cached facts. `configureBoardInfo` runs on every playerView
  // update (PlayerHome's playerkey remount → syncBoardInfo) and on a seat switch
  // — i.e. exactly when the board state may have changed. Without this a re-hover
  // would return STALE facts: a city's "+1 VP" after a 2nd greenery is placed
  // next to it, or "Mars Nomads camp" on a cell the nomads already left. The
  // facts are cheap + the fetch is debounced, so re-fetching on hover is fine.
  infoCache.clear();
  previewCache.clear();
  if (cfg.participantId !== undefined) {
    c.participantId = cfg.participantId;
  }
  if (cfg.color !== undefined) {
    c.color = cfg.color;
  }
  if (cfg.boardName !== undefined) {
    c.boardName = cfg.boardName;
  }
  if (cfg.players !== undefined) {
    c.players = cfg.players;
  }
}

function cacheKey(spaceId: SpaceId, kind?: BoardPlacementKind, cleared = false, tileType?: number): string {
  return `${boardInfoState.cfg.color ?? ''}:${spaceId}:${kind ?? ''}:${cleared ? 'c' : ''}:${tileType ?? ''}`;
}

function buildUrl(spaceId: SpaceId, kind?: BoardPlacementKind, cleared = false, tileType?: number): string | undefined {
  const cfg = boardInfoState.cfg;
  if (cfg.participantId === undefined) {
    return undefined;
  }
  const params = new URLSearchParams({id: cfg.participantId, space: spaceId});
  if (cfg.color !== undefined) {
    params.set('color', cfg.color);
  }
  if (kind !== undefined) {
    params.set('kind', kind);
  }
  // A remove-and-replace target (its tile is cleared before placement) → the
  // preview grants the cell bonus + treats the cell as a legal placement.
  if (cleared) {
    params.set('cleared', '1');
  }
  // The concrete tile being placed → a composite over-ocean tile's city VP.
  if (tileType !== undefined) {
    params.set('tile', String(tileType));
  }
  return `${apiUrl(paths.API_GAME_BOARD_CELL_PREVIEW)}?${params.toString()}`;
}

export function hoverBoardCell(spaceId: SpaceId, rect?: DOMRect): void {
  boardInfoState.spaceId = spaceId;
  boardInfoState.cellRect = rect;
  const key = cacheKey(spaceId);
  const cached = infoCache.get(key);
  if (cached !== undefined) {
    boardInfoState.info = cached;
    boardInfoState.loading = false;
    return;
  }
  boardInfoState.info = undefined;
  boardInfoState.loading = true;
  const myToken = ++hoverToken;
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => fetchInfo(spaceId, key, myToken), 110);
}

function fetchInfo(spaceId: SpaceId, key: string, myToken: number): void {
  const url = buildUrl(spaceId);
  if (url === undefined || typeof fetch === 'undefined') {
    boardInfoState.loading = false;
    return;
  }
  fetch(url)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((info: BoardCellInfo | undefined) => {
      if (info !== undefined) {
        infoCache.set(key, info);
      }
      if (myToken === hoverToken && boardInfoState.spaceId === spaceId) {
        boardInfoState.info = info;
        boardInfoState.loading = false;
      }
    })
    .catch(() => {
      if (myToken === hoverToken) {
        boardInfoState.loading = false;
      }
    });
}

export function clearBoardCellHover(spaceId: SpaceId): void {
  if (boardInfoState.spaceId === spaceId) {
    boardInfoState.spaceId = undefined;
    boardInfoState.info = undefined;
    boardInfoState.loading = false;
    boardInfoState.cellRect = undefined;
    hoverToken++;
  }
}

/**
 * Fetch a placement preview for one cell (active placement / confirm modal).
 * Cached per (color, space, kind). Returns undefined under JSDOM / before
 * configuration; the caller falls back to no preview.
 */
export function fetchBoardCellPreview(spaceId: SpaceId, kind: BoardPlacementKind, cleared = false, tileType?: number): Promise<BoardPlacementPreview | undefined> {
  const key = cacheKey(spaceId, kind, cleared, tileType);
  const cached = previewCache.get(key);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }
  const url = buildUrl(spaceId, kind, cleared, tileType);
  if (url === undefined || typeof fetch === 'undefined') {
    return Promise.resolve(undefined);
  }
  return fetch(url)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((preview: BoardPlacementPreview | undefined) => {
      if (preview !== undefined) {
        previewCache.set(key, preview);
      }
      return preview;
    })
    .catch(() => undefined);
}
