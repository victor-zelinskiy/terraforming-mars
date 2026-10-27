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
  /**
   * «Парламент» — ONE seat's whole standing in the Mars Parliament (humans
   * only, and only in a game that has one): what its influence is made of,
   * where its Agenda marker stands, where its delegates are, and what every
   * resolution on the table would pay IT. The workspace shows the parliament
   * as a table; this is the same table read from one seat.
   */
  | 'parliament'
  /** «Кампания» — the full campaign overview (campaign missions only):
   *  the route, participants, legacy and mission history, read-only. */
  | 'campaign'
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
  parliament: 'summary',
  campaign: 'summary',
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
    // The bot plays no activatable card and holds no standing effect: nothing to list.
    return kind === 'human';
  case 'parliament':
    // MarsBot sits in the parliament like every player (D16 — it votes, is paid, walks the Career): its standing reads.
    return true;
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
  parliament: 'Parliament',
  // Dynamic: the campaign overview supplies its own tail (its nested
  // read-only layers name themselves — «Кампания · Миссия 2»).
  campaign: '',
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
 * leaves the shared geometry untouched. «extras» is the RAIL SATELLITE —
 * the persistent ДОП.РЕСУРСЫ column beside the left rail (shell chrome,
 * not a panel block), which is why it is the ring's leftmost column.
 * «botdoor» is the bot's entry into its internals screen — a ring stop
 * like every other zone (no dedicated button opens it any more).
 */
export type InfoZoneId = 'extras' | 'vp' | 'played' | 'actions' | 'effects' | 'parliament' | 'campaign' | 'botdoor';

/**
 * Context of the zone table: the GAME shape (`campaign` — what exists in
 * THIS game) plus the one SEAT fact the ring needs (`extras` — the
 * inspected seat has satellite chips; an empty column keeps no ring stop
 * and no ghost plate). Optional everywhere with conservative defaults, so
 * an ordinary call site stays untouched.
 */
export type InfoZoneContext = {campaign?: boolean, extras?: boolean, parliament?: boolean};

/**
 * THE DOSSIER LAYOUT (TR60 — «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА»): the satellite column on the left (shell chrome —
 * the ring's leftmost stop), then TWO TIERS over the whole opening: the HEROES (the score, the card history — the
 * shared zones, at one place for every participant) and the PLATES (the human's actions / effects or the bot's door,
 * the Parliament, the campaign). Each zone carries its share of its tier's width (`weight`, the CSS flex weights),
 * which is how a vertical move finds the zone standing under / over the one it leaves.
 * (The old «Карты» readout zone is GONE — the HAND DOCK is the inspected seat's one physical hand representation
 * for the workspace's lifetime.)
 */
export const INFO_SUMMARY_SATELLITE: InfoZoneId = 'extras';
export const INFO_SUMMARY_TIERS: ReadonlyArray<ReadonlyArray<{zone: InfoZoneId, weight: number}>> = [
  [{zone: 'vp', weight: 1}, {zone: 'played', weight: 1.4}],
  [{zone: 'botdoor', weight: 1}, {zone: 'actions', weight: 1}, {zone: 'effects', weight: 1}, {zone: 'parliament', weight: 1}, {zone: 'campaign', weight: 1}],
];

/** The detail route a zone opens, if any. */
const ZONE_ROUTE: Record<InfoZoneId, InfoRouteId | undefined> = {
  extras: 'extras',
  vp: 'vp',
  played: 'played',
  actions: 'actions',
  effects: 'effects',
  parliament: 'parliament',
  campaign: 'campaign',
  botdoor: 'botScreen',
};

export function infoZoneRoute(zone: InfoZoneId): InfoRouteId | undefined {
  return ZONE_ROUTE[zone];
}

/**
 * Does this zone EXIST on the summary for this participant kind? The
 * human-only pair is HIDDEN for the bot (per the parity contract: absence
 * must not shift the shared zones — the layout reserves their area).
 * «campaign» exists only in campaign missions (a GAME fact, so it shows for
 * every participant kind there and for nobody elsewhere).
 */
export function infoZonePresent(zone: InfoZoneId, kind: InfoParticipantKind, ctx: InfoZoneContext = {}): boolean {
  if (zone === 'actions' || zone === 'effects') {
    return kind === 'human';
  }
  if (zone === 'botdoor') {
    return kind === 'bot';
  }
  if (zone === 'campaign') {
    return ctx.campaign === true;
  }
  // The parliament is a fact of the GAME (the Turmoil Redux expansion), so the zone exists for every
  // participant of such a game — and for nobody elsewhere. The BOT's own fill is its one honest line.
  if (zone === 'parliament') {
    return ctx.parliament === true;
  }
  return true;
}

/**
 * May the FOCUS RING stand on this zone? Present + enterable: a zone with
 * no detail route carries its whole content on the summary, so a cursor on
 * it would advertise an A that does nothing — forbidden by the command-bar
 * honesty rule. An absent zone is not focusable by definition.
 */
export function infoZoneFocusable(zone: InfoZoneId, kind: InfoParticipantKind, ctx: InfoZoneContext = {}): boolean {
  // An EMPTY satellite is no ring stop: there is no chip to stand on and
  // nothing to open — the ring skips it instead of ringing a ghost plate.
  if (zone === 'extras' && ctx.extras === false) {
    return false;
  }
  const route = ZONE_ROUTE[zone];
  return infoZonePresent(zone, kind, ctx) && route !== undefined && infoRouteApplies(route, kind);
}

/** The zones that STAND on a tier for this participant (present — a door for the bot, the pair for a human). */
export function infoTierZones(tier: number, kind: InfoParticipantKind, ctx: InfoZoneContext = {}): ReadonlyArray<{zone: InfoZoneId, weight: number}> {
  return (INFO_SUMMARY_TIERS[tier] ?? []).filter((z) => infoZonePresent(z.zone, kind, ctx));
}

/** The focusable zones for a participant kind, in canonical order: the satellite, then the tiers, left → right. */
export function infoFocusRing(kind: InfoParticipantKind, ctx: InfoZoneContext = {}): ReadonlyArray<InfoZoneId> {
  const ring: Array<InfoZoneId> = [];
  if (infoZoneFocusable(INFO_SUMMARY_SATELLITE, kind, ctx)) {
    ring.push(INFO_SUMMARY_SATELLITE);
  }
  for (let tier = 0; tier < INFO_SUMMARY_TIERS.length; tier++) {
    for (const {zone} of infoTierZones(tier, kind, ctx)) {
      if (infoZoneFocusable(zone, kind, ctx)) {
        ring.push(zone);
      }
    }
  }
  return ring;
}

/** The horizontal CENTRE of each standing zone of a tier, as a share of the tier's width (the flex weights). */
function tierCentres(zones: ReadonlyArray<{zone: InfoZoneId, weight: number}>): Map<InfoZoneId, number> {
  const total = zones.reduce((n, z) => n + z.weight, 0);
  const centres = new Map<InfoZoneId, number>();
  let at = 0;
  for (const z of zones) {
    centres.set(z.zone, total > 0 ? (at + z.weight / 2) / total : 0);
    at += z.weight;
  }
  return centres;
}

/**
 * D-pad movement over the dossier — the layout's own geometry: left / right walk a tier (left of its first zone is
 * the satellite column), up / down cross to the other tier onto the FOCUSABLE zone whose centre stands nearest
 * (a tie keeps the left one). From the satellite, right enters the heroes' tier. Returns the zone to focus, or the
 * current one at an edge (the ring never wraps — an edge is an edge, the console's d-pad grammar everywhere).
 */
export function infoZoneNavigate(
  from: InfoZoneId,
  dir: 'up' | 'down' | 'left' | 'right',
  kind: InfoParticipantKind,
  ctx: InfoZoneContext = {},
): InfoZoneId {
  const focusable = (z: InfoZoneId) => infoZoneFocusable(z, kind, ctx);
  const tiers = INFO_SUMMARY_TIERS.map((_, t) => infoTierZones(t, kind, ctx));
  const satellite = focusable(INFO_SUMMARY_SATELLITE);
  if (from === INFO_SUMMARY_SATELLITE && satellite) {
    if (dir !== 'right') {
      return from;
    }
    for (const tier of tiers) {
      const first = tier.find((z) => focusable(z.zone));
      if (first !== undefined) {
        return first.zone;
      }
    }
    return from;
  }
  const tierIdx = tiers.findIndex((tier) => tier.some((z) => z.zone === from) && focusable(from));
  if (tierIdx === -1) {
    // The focus stands on a zone that stopped being focusable (a seat
    // switch) — land on the first focusable zone instead of going dark.
    return infoFocusRing(kind, ctx).find((z) => z !== INFO_SUMMARY_SATELLITE) ?? infoFocusRing(kind, ctx)[0] ?? from;
  }
  const row = tiers[tierIdx].filter((z) => focusable(z.zone));
  const at = row.findIndex((z) => z.zone === from);
  if (dir === 'left' || dir === 'right') {
    const next = at + (dir === 'right' ? 1 : -1);
    if (next < 0) {
      return satellite ? INFO_SUMMARY_SATELLITE : from;
    }
    return row[Math.min(next, row.length - 1)].zone;
  }
  const step = dir === 'down' ? 1 : -1;
  for (let t = tierIdx + step; t >= 0 && t < tiers.length; t += step) {
    const target = tiers[t].filter((z) => focusable(z.zone));
    if (target.length === 0) {
      continue;
    }
    const mine = tierCentres(tiers[tierIdx]).get(from) ?? 0;
    const theirs = tierCentres(tiers[t]);
    let best = target[0].zone;
    let bestDist = Infinity;
    for (const z of target) {
      const dist = Math.abs((theirs.get(z.zone) ?? 0) - mine);
      if (dist < bestDist - 1e-9) {
        best = z.zone;
        bestDist = dist;
      }
    }
    return best;
  }
  return from;
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
  case 'parliament': return 'parliament';
  case 'campaign': return 'campaign';
  case 'botScreen':
  case 'botBoard':
  case 'botBonus':
    return 'botdoor';
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
