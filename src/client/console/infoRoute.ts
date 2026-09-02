/*
 * THE INFORMATION WORKSPACE ROUTE MODEL — pure.
 *
 * «Информация» is an inspect-only OVERLAY workspace: it opens OVER whatever
 * surface the player is on (board, any workspace, a minimized prompt), never
 * touches the workspace stack, and closing restores the exact context the
 * snapshot captured (infoModeState). What THIS module owns is the geography
 * INSIDE the panel: semantic routes, their tree, per-participant capability,
 * and the summary focus ring — so navigation is one model instead of a pile
 * of per-detail conditionals.
 *
 * THE THREE CONTRACTS (each shipped broken in the flat-`detail` era):
 *
 *  1. ROUTES ARE SEMANTIC AND SURVIVE A SEAT SWITCH. LB/RB changes the
 *     inspected participant, never the place: «admin › Победные очки» → RB →
 *     «Бот › Победные очки». A route the new participant cannot serve KEEPS
 *     the route and presents the workspace FALLBACK («Не применимо») — the
 *     old `reconcileInfoDetail` silently reset to the dashboard, so cycling
 *     through the table lost the player's place.
 *
 *  2. CAPABILITY IS A TABLE, NOT SCATTERED `isBot` BRANCHES. One predicate
 *     (`infoRouteApplies`) answers «does this route exist for this
 *     participant kind» for the router, the command bar, the focus ring and
 *     the fallback alike — they can never disagree. Scales to any table
 *     shape (several humans, several bots).
 *
 *  3. BACK IS THE TREE, ONE LEVEL AT A TIME. B pops to the PARENT route
 *     (`botBoard → botScreen → summary`); at the summary there is nothing
 *     shallower, so B closes the overlay (same verb the workspace grammar
 *     uses at its browse layer). Y closes from ANY depth — the overlay's own
 *     exit contract.
 *
 * PURE: no DOM, no Vue, no i18n — unit-tested under the server runner.
 */

/** Every place the player can stand inside the Information workspace. */
export type InfoRouteId =
  /** The participant SUMMARY — the root. One canonical layout for every
   *  participant kind (the human/bot variants fill the SAME zones). */
  | 'summary'
  /** «Победные очки» — the scoring OVERVIEW (level 1 of the score explorer). */
  | 'vp'
  /** One scoring category's detail (level 2). WHICH category is the
   *  `infoModeState.vpCategoryKey` param — the route stays semantic so a
   *  seat switch keeps the depth, and the crumb tail is supplied by the
   *  score explorer model (dynamic stage names). */
  | 'vpCategory'
  /** One card-scoring group's table (level 3, under the cards category).
   *  WHICH group is the `infoModeState.vpCardsGroup` param. */
  | 'vpCards'
  /** «Разыграно» — the embedded premium played-cards table. */
  | 'played'
  /** «Доп. ресурсы» — resources on cards (human) / floaters + shipping
   *  storage + corp store (bot): the same semantic area, two honest fills. */
  | 'extras'
  /** «Действия» — the availability list (humans only). */
  | 'actions'
  /** «Эффекты» — passive effects/discounts (humans only). */
  | 'effects'
  /** «Экран бота» — the bot's internals hub (bot only): decks, piles,
   *  storage rules, conversion, difficulty; hosts the two deep references. */
  | 'botScreen'
  /** «Планшет бота» — the printed board + the teaching layer (inside botScreen). */
  | 'botBoard'
  /** «Бонусные карты» — the open bonus piles (inside botScreen). */
  | 'botBonus';

/** The participant kinds the capability table distinguishes. */
export type InfoParticipantKind = 'human' | 'bot';

/**
 * THE TREE — child → parent. `undefined` = the root. B walks exactly one
 * edge of this relation; nothing else may decide what «one level up» means.
 */
const INFO_ROUTE_PARENT: Record<InfoRouteId, InfoRouteId | undefined> = {
  summary: undefined,
  vp: 'summary',
  vpCategory: 'vp',
  vpCards: 'vpCategory',
  played: 'summary',
  extras: 'summary',
  actions: 'summary',
  effects: 'summary',
  botScreen: 'summary',
  botBoard: 'botScreen',
  botBonus: 'botScreen',
};

export function infoRouteParent(route: InfoRouteId): InfoRouteId | undefined {
  return INFO_ROUTE_PARENT[route];
}

/** Depth in the tree (summary = 0). Drives the descend/rise motion cue. */
export function infoRouteDepth(route: InfoRouteId): number {
  let depth = 0;
  for (let at = INFO_ROUTE_PARENT[route]; at !== undefined; at = INFO_ROUTE_PARENT[at]) {
    depth++;
  }
  return depth;
}

/**
 * CAPABILITY — may a participant of this kind SERVE this route?
 *
 * «Serve» is about content existing at all, not about visibility rules:
 * an opponent whose VP the game options hide still SERVES 'vp' (the route
 * renders its honest «скрыто» state); the bot cannot serve 'actions'
 * because the Automa has no activatable cards — there is no state to show.
 */
export function infoRouteApplies(route: InfoRouteId, kind: InfoParticipantKind): boolean {
  switch (route) {
  case 'actions':
  case 'effects':
    return kind === 'human';
  case 'botScreen':
  case 'botBoard':
  case 'botBonus':
    return kind === 'bot';
  default:
    return true;
  }
}

/**
 * What the surface PRESENTS for a route + participant pair. A route that
 * does not apply presents the workspace FALLBACK — the route itself is
 * kept (contract 1), so the next LB/RB lands back in real content at the
 * same depth and the crumb never lies about where the player stands.
 */
export function infoRoutePresentation(route: InfoRouteId, kind: InfoParticipantKind): 'content' | 'fallback' {
  return infoRouteApplies(route, kind) ? 'content' : 'fallback';
}

/**
 * B — one logical level. `undefined` = nothing shallower inside the panel:
 * the caller closes the whole overlay (and restores the snapshot).
 */
export function infoRouteBack(route: InfoRouteId): InfoRouteId | undefined {
  return INFO_ROUTE_PARENT[route];
}

/**
 * THE CRUMB TAIL — the stage segment(s) for `ИНФОРМАЦИЯ › <участник> › …`.
 *
 * i18n KEYS in tree order, outermost first. Depth 2 renders as the phrase
 * «ЭКРАН БОТА · ПЛАНШЕТ» (the hosted-step precedent: «ГАНИМЕД · ТОРГОВЛЯ»)
 * — the stable context still comes first, the deepest word is the tail.
 * Empty for the summary (the crumb is just root + participant there).
 */
export function infoRouteStagePath(route: InfoRouteId): ReadonlyArray<string> {
  const path: Array<string> = [];
  for (let at: InfoRouteId | undefined = route; at !== undefined && at !== 'summary'; at = INFO_ROUTE_PARENT[at]) {
    // A '' stage is DYNAMIC (the vp subtree names its tail from the selected
    // category/group — `scoreStagePath` in the explorer model supplies it).
    if (INFO_ROUTE_STAGE[at] !== '') {
      path.unshift(INFO_ROUTE_STAGE[at]);
    }
  }
  return path;
}

/** The stage name of ONE route (i18n key; '' = root or a DYNAMIC tail the
 *  score explorer supplies from its params). */
const INFO_ROUTE_STAGE: Record<InfoRouteId, string> = {
  summary: '',
  vp: 'Victory Points',
  vpCategory: '',
  vpCards: '',
  played: 'Played',
  extras: 'Extra resources',
  actions: 'Actions',
  effects: 'Effects',
  botScreen: 'MarsBot screen',
  botBoard: 'MarsBot board',
  botBonus: 'Bonus cards',
};

export function infoRouteStage(route: InfoRouteId): string {
  return INFO_ROUTE_STAGE[route];
}

// ── the SUMMARY ZONES — one canonical layout for every participant ─────────

/**
 * The zones of the participant summary in their CANONICAL positions. The
 * SHARED zones come first and sit at the same coordinates for every
 * participant; the human-only pair renders after them and its absence (bot)
 * leaves the shared geometry untouched.
 */
export type InfoZoneId = 'vp' | 'played' | 'extras' | 'actions' | 'effects';

/** The summary layout: columns of zones, read left → right, top → bottom.
 *  (The old «Карты» readout zone is GONE — the HAND DOCK is the inspected
 *  seat's one physical hand representation for the workspace's lifetime.) */
export const INFO_SUMMARY_COLUMNS: ReadonlyArray<ReadonlyArray<InfoZoneId>> = [
  ['vp'],
  ['played'],
  ['extras', 'actions', 'effects'],
];

/** The detail route a zone opens, if any. */
const ZONE_ROUTE: Record<InfoZoneId, InfoRouteId | undefined> = {
  vp: 'vp',
  played: 'played',
  extras: 'extras',
  actions: 'actions',
  effects: 'effects',
};

export function infoZoneRoute(zone: InfoZoneId): InfoRouteId | undefined {
  return ZONE_ROUTE[zone];
}

/**
 * Does this zone EXIST on the summary for this participant kind? The
 * human-only pair is HIDDEN for the bot (per the parity contract: absence
 * must not shift the shared zones — the layout reserves their area).
 */
export function infoZonePresent(zone: InfoZoneId, kind: InfoParticipantKind): boolean {
  if (zone === 'actions' || zone === 'effects') {
    return kind === 'human';
  }
  return true;
}

/**
 * May the FOCUS RING stand on this zone? Present + enterable: a zone with
 * no detail route carries its whole content on the summary, so a cursor on
 * it would advertise an A that does nothing — forbidden by the command-bar
 * honesty rule. An absent zone is not focusable by definition.
 */
export function infoZoneFocusable(zone: InfoZoneId, kind: InfoParticipantKind): boolean {
  const route = ZONE_ROUTE[zone];
  return infoZonePresent(zone, kind) && route !== undefined && infoRouteApplies(route, kind);
}

/** The focusable zones for a participant kind, in canonical order. */
export function infoFocusRing(kind: InfoParticipantKind): ReadonlyArray<InfoZoneId> {
  const ring: Array<InfoZoneId> = [];
  for (const column of INFO_SUMMARY_COLUMNS) {
    for (const zone of column) {
      if (infoZoneFocusable(zone, kind)) {
        ring.push(zone);
      }
    }
  }
  return ring;
}

/**
 * D-pad movement over the summary zones — column-aware: left/right move
 * between columns (keeping the nearest focusable row), up/down move within
 * a column. Returns the zone to focus, or the current one at an edge (the
 * ring never wraps — an edge is an edge, matching the console's d-pad
 * grammar everywhere else).
 */
export function infoZoneNavigate(
  from: InfoZoneId,
  dir: 'up' | 'down' | 'left' | 'right',
  kind: InfoParticipantKind,
): InfoZoneId {
  const columns = INFO_SUMMARY_COLUMNS
    .map((col) => col.filter((z) => infoZoneFocusable(z, kind)))
    .filter((col) => col.length > 0);
  const colIdx = columns.findIndex((col) => col.includes(from));
  if (colIdx === -1) {
    // The focus stands on a zone that stopped being focusable (a seat
    // switch) — land on the first focusable zone instead of going dark.
    return columns[0]?.[0] ?? from;
  }
  const rowIdx = columns[colIdx].indexOf(from);
  if (dir === 'up' || dir === 'down') {
    const next = rowIdx + (dir === 'down' ? 1 : -1);
    return columns[colIdx][Math.min(Math.max(next, 0), columns[colIdx].length - 1)];
  }
  const nextCol = colIdx + (dir === 'right' ? 1 : -1);
  if (nextCol < 0 || nextCol >= columns.length) {
    return from;
  }
  const target = columns[nextCol];
  return target[Math.min(rowIdx, target.length - 1)];
}

/**
 * Where the focus should STAND after arriving at the summary from a detail
 * (B from 'vp' lands the ring on the VP zone — the player returns to the
 * place they descended from, the workspace «carried object survives» rule).
 */
export function infoZoneForRoute(route: InfoRouteId): InfoZoneId | undefined {
  switch (route) {
  case 'vp':
  case 'vpCategory':
  case 'vpCards':
    return 'vp';
  case 'played': return 'played';
  case 'extras': return 'extras';
  case 'actions': return 'actions';
  case 'effects': return 'effects';
  default: return undefined;
  }
}

/** Is this route inside the score explorer's own subtree? (The explorer is
 *  ONE component for all of them — the zone swap never runs between its
 *  levels, so the descend can be a real FLIP instead of an out-in blink.) */
export function isVpRoute(route: InfoRouteId): boolean {
  return route === 'vp' || route === 'vpCategory' || route === 'vpCards';
}

// ── the BOT SCREEN focus ring ──────────────────────────────────────────────

/** The entries of «Экран бота» the cursor can stand on (its two deep
 *  references). Informational sections are read, not entered. */
export type BotScreenEntry = 'botBoard' | 'botBonus';

export const BOT_SCREEN_ENTRIES: ReadonlyArray<BotScreenEntry> = ['botBoard', 'botBonus'];

export function botScreenNavigate(from: BotScreenEntry, dir: 'up' | 'down' | 'left' | 'right'): BotScreenEntry {
  const idx = BOT_SCREEN_ENTRIES.indexOf(from);
  if (dir === 'down' || dir === 'right') {
    return BOT_SCREEN_ENTRIES[Math.min(idx + 1, BOT_SCREEN_ENTRIES.length - 1)];
  }
  return BOT_SCREEN_ENTRIES[Math.max(idx - 1, 0)];
}
