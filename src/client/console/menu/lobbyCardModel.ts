// THE LOBBY CARD — the pure view-model of ONE card of the pregame showcase («Мои партии» / «Мои кампании», TR68
// «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА», docs/claude/console/pregame-showcase.md). A game is SHOWN as a card — its board
// miniature, its name in the hero voice, ONE state chip, the generation, the crew with whose turn it is, the
// expansions and how long ago it was created — never as a line of text. Pure (no Vue, no DOM, no i18n): every word is
// an English key with its params, translated by the component; spec'd under the server runner.
//
// It decides nothing the lobby model does not already know: membership is `JoinableGameSummary.you` / `ambiguous`
// (by the identity's NAME, `joinableGames.ts`), the campaign's state is `campaignListModel`'s, the order is the
// caller's (newest first). One card per row the screen walks.

import {JoinableGameSummary} from '../../../common/models/JoinableGameModel';
import {CampaignSummaryModel} from '../../../common/campaign/CampaignSummary';
import {BoardName} from '../../../common/boards/BoardName';
import {Color} from '../../../common/Color';
import {Expansion} from '../../../common/cards/GameModule';
import {
  CampaignSlotMark, CampaignSourceRow, campaignActionRequired, campaignProgress, campaignSlotMarks, campaignStateLabelKey,
  isArchivedCampaign,
} from '../campaign/campaignListModel';

/**
 * The VOICE of the state chip — by form AND colour, never colour alone (the chip carries its words):
 * `turn` the viewer must act (mint, the bar's A glows) · `wait` someone else is to move · `done` the game / campaign
 * is over (`abandoned` — a campaign given up, apart from an ordinary completion) · `note` the row cannot be entered for a stated reason (amber) · `stale` its host stopped answering ·
 * `ready` a mission waits for its launch · `blocked` a campaign needs recovery · `calm` a campaign in progress.
 */
export type LobbyCardTone = 'turn' | 'wait' | 'done' | 'abandoned' | 'note' | 'stale' | 'ready' | 'blocked' | 'calm';

/** A translatable piece of copy: an English i18n key and its params. */
export type LobbyText = {key: string, params?: ReadonlyArray<string>};

export type LobbyCrewMember = {
  name: string;
  color: Color;
  /** The viewer's own seat (by name — the listing's scope). */
  isYou: boolean;
  /** Whose turn it is NOW (never on a finished game: its stored active player means nothing). */
  isActive: boolean;
  /** A champion of a finished campaign. */
  champion: boolean;
};

export type LobbyCardView = {
  kind: 'game' | 'campaign';
  /** Stable key (the game id / the campaign id). */
  key: string;
  /** The hero voice — never cut while the card has room (two lines, then an ellipsis as the last resort). */
  name: string;
  /** The board the miniature draws (the campaign's CURRENT board). */
  board: BoardName;
  /** The quiet line above the name: a campaign mission's «Кампания · Миссия 1 из 4», a campaign's progress. */
  kicker?: ReadonlyArray<LobbyText>;
  /** The ONE state chip. */
  state: LobbyText & {tone: LobbyCardTone};
  /** The generation being played (games only). */
  generation?: number;
  /** The CREATION time — the sort key, said as an age by the screen's one clock. */
  createdTimeMs: number;
  crew: ReadonlyArray<LobbyCrewMember>;
  expansions: ReadonlyArray<Expansion>;
  /** Arrived while the player was watching (the push channel's visible proof). */
  isNew: boolean;
  /** A LAN row names its couch. */
  hostLabel?: string;
  /** A campaign's route: one node per mission, the current one lit. */
  progress?: ReadonlyArray<CampaignSlotMark>;
  /** A second line of state the chip has no room for (a campaign's recovery reason). */
  note?: LobbyText;
  /** A campaign's title points for the viewer (shown only when > 0). */
  titlePoints?: number;
  /** A refused entry is DIMMED with its reason in the chip, never hidden. */
  enterable: boolean;
  /** An archive card (a finished game / campaign). */
  archived: boolean;
};

export type GameCardOptions = {
  /** `lobbyState.newIds` includes it. */
  isNew?: boolean;
  /** A LAN row: the host's advertised name. */
  hostLabel?: string;
  /** A LAN host that stopped answering keeps its rows, marked and not enterable. */
  stale?: boolean;
  /** A LAN host on another build (a warning, the row still enters). */
  versionMismatch?: boolean;
};

/** The viewer is to move in a live game where they hold a seat. */
export function gameIsYourTurn(g: JoinableGameSummary): boolean {
  return g.finished !== true && g.you !== undefined && g.activePlayer === g.you.color;
}

/** A campaign row opens the Campaign Map (its seat is resolved there by name); a game row needs the viewer's seat. */
export function gameJoinable(g: JoinableGameSummary): boolean {
  return g.campaign !== undefined || g.you !== undefined;
}

function gameState(g: JoinableGameSummary, opts: GameCardOptions): LobbyText & {tone: LobbyCardTone} {
  if (opts.stale === true) {
    return {key: 'not responding', tone: 'stale'};
  }
  if (g.finished === true) {
    return {key: 'Game finished', tone: 'done'};
  }
  if (gameIsYourTurn(g)) {
    return {key: 'Your turn', tone: 'turn'};
  }
  if (!gameJoinable(g)) {
    return {key: g.ambiguous ? 'Several players share your name here' : 'No seat with your name', tone: 'note'};
  }
  if (opts.versionMismatch === true) {
    return {key: 'Host version differs from yours', tone: 'note'};
  }
  const active = g.players.find((p) => p.color === g.activePlayer);
  return active === undefined ? {key: 'Game in progress', tone: 'wait'} : {key: 'Turn: ${0}', params: [active.name], tone: 'wait'};
}

/** ONE game of «Мои партии» (a campaign mission row stands for its campaign — its front door is the map). */
export function gameCardView(g: JoinableGameSummary, opts: GameCardOptions = {}): LobbyCardView {
  const live = g.finished !== true;
  const view: LobbyCardView = {
    kind: 'game',
    key: g.id,
    name: g.campaign !== undefined ? g.campaign.name : g.name,
    board: g.boardName,
    state: gameState(g, opts),
    generation: g.generation,
    createdTimeMs: g.createdTimeMs,
    crew: g.players.map((p) => ({name: p.name, color: p.color, isYou: p.isYou, isActive: live && g.activePlayer === p.color, champion: false})),
    expansions: [...g.expansions],
    isNew: opts.isNew === true,
    enterable: gameJoinable(g) && opts.stale !== true,
    archived: !live,
  };
  if (g.campaign !== undefined) {
    view.kicker = [{key: 'Campaign'}, {key: 'Mission ${0} of ${1}', params: [String(g.campaign.slot + 1), String(g.campaign.count)]}];
  }
  if (opts.hostLabel !== undefined && opts.hostLabel !== '') {
    view.hostLabel = opts.hostLabel;
  }
  return view;
}

function campaignTone(c: CampaignSummaryModel): LobbyCardTone {
  if (campaignActionRequired(c)) {
    return 'turn';
  }
  switch (c.state) {
  case 'launchReady': return 'ready';
  case 'blocked': return 'blocked';
  case 'finished': return 'done';
  case 'abandoned': return 'abandoned';
  default: return 'calm';
  }
}

/** ONE campaign of «Мои кампании» — the progress rail of its route and the state of the viewer's seat. */
export function campaignCardView(row: CampaignSourceRow, opts: {isNew?: boolean} = {}): LobbyCardView {
  const c = row.summary;
  const progress = campaignProgress(c);
  const view: LobbyCardView = {
    kind: 'campaign',
    key: c.id,
    name: c.name,
    board: c.currentBoard,
    kicker: [{key: progress.key, params: progress.params}],
    state: row.stale ? {key: 'not responding', tone: 'stale'} : {key: campaignStateLabelKey(c), tone: campaignTone(c)},
    createdTimeMs: c.createdTimeMs,
    crew: c.seats.map((s) => ({
      name: s.name, color: s.color, isYou: s.seat === c.you.seat, isActive: false, champion: c.championSeats?.includes(s.seat) === true,
    })),
    expansions: [],
    isNew: opts.isNew === true,
    progress: campaignSlotMarks(c),
    enterable: !row.stale,
    archived: isArchivedCampaign(c),
  };
  if (c.state === 'blocked' && c.blockedReason !== undefined) {
    view.note = {key: c.blockedReason};
  }
  if (c.yourTitlePoints > 0) {
    view.titlePoints = c.yourTitlePoints;
  }
  if (row.hostLabel !== '') {
    view.hostLabel = row.hostLabel;
  }
  return view;
}

/**
 * THE GRID OF THE SHOWCASE — how many columns a stage of `width` holds and how tall a row is, from the MEASURED box
 * (never from the card count: one card and six are the same geometry). The card keeps a wide landscape (its
 * miniature square on the left) between `minW` and `maxW`; two rows fill the stage, a third is a page below (the
 * scroll area's `ensureVisible`). All lengths in px.
 */
export type ShowcaseGrid = {cols: number, cardW: number, rowH: number};

export function showcaseGrid(width: number, height: number, opts: {gap: number, minW: number, maxW: number, minH: number, maxH: number, rows?: number}): ShowcaseGrid {
  const rows = opts.rows ?? 2;
  let cols = Math.max(1, Math.floor((width + opts.gap) / (opts.minW + opts.gap)));
  cols = Math.min(cols, 3);
  const cardW = Math.min(opts.maxW, Math.floor((width - opts.gap * (cols - 1)) / cols));
  const rowH = Math.max(opts.minH, Math.min(opts.maxH, Math.floor((height - opts.gap * (rows - 1)) / rows)));
  return {cols, cardW, rowH};
}

/**
 * THE CURSOR'S STEP over the showcase grid (row-major, `cols` per row): ◀ ▶ walk the ring (wrapping, the lobby's
 * old list rule), ▲ ▼ move a whole row — a row that is not there is a WALL (the cursor stays), except ▼ into a SHORTER
 * last row, which lands on its last card (a card below exists, just not under the cursor).
 */
export function showcaseStep(index: number, dir: 'up' | 'down' | 'left' | 'right', count: number, cols: number): number {
  if (count <= 0) {
    return 0;
  }
  const i = Math.min(Math.max(0, index), count - 1);
  const c = Math.max(1, cols);
  switch (dir) {
  case 'left': return (i - 1 + count) % count;
  case 'right': return (i + 1) % count;
  case 'up': return i - c >= 0 ? i - c : i;
  case 'down': {
    if (i + c < count) {
      return i + c;
    }
    const lastRowStart = Math.floor((count - 1) / c) * c;
    return lastRowStart > i - (i % c) ? count - 1 : i;
  }
  }
}
