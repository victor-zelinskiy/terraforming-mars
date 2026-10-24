/*
 * @console-shared LIVE — THE PARTICIPANT DOSSIER (TR60, «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА»).
 *
 * The Information workspace's summary read as OBJECTS instead of label—number rows: the score as medallions with
 * the category's own symbol, the card history as the corporation's face and fans of the faces played by type, the
 * actions as tiles whose STATE is a shape, the effects by family, the Parliament as an emblem, tokens and a ladder.
 * Every number here is a model's (the live score, the played zones, the server's availability, the seat's
 * parliament reading) — this module computes no rule and restates no other zone; it only decides WHICH objects
 * stand and in what order. A hidden score is never read: the sealed cell carries only what is public on the table.
 *
 * PURE: no DOM, no Vue, no i18n (labels are keys) — spec'd under the server runner.
 */
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {ConsoleEndgameCategoryKey, SCORE_CATEGORY_TABLE} from '@/client/console/endgame/consoleEndgameModel';
import {ScoreOverviewModel} from '@/client/console/scoreExplorerModel';
import {EffectFamily, EffectsZoneCounts} from '@/client/console/effectsExplorerModel';
import {PlayedZones} from '@/client/components/console/consolePlayedModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';

// ── THE SCORE — medallions in the ceremony's order ─────────────────────────

/**
 * The symbol a score category stands for itself with. A category with a printed symbol wears it (the TR badge, the
 * city / greenery tile, the card); milestones and awards wear the REAL earned emblems (the explorer's ledger); a
 * category with no printed symbol (the Moon, the planetary tracks, the Hydronetwork, titles, penalties) wears its
 * accent disc — the bar's own colour — never an invented picture.
 */
export type DossierGlyph =
  | {kind: 'icon', icon: string}
  | {kind: 'tile', tile: 'city' | 'greenery'}
  | {kind: 'emblems', slugs: ReadonlyArray<string>}
  | {kind: 'mark'};

export type DossierMedallion = {
  key: ConsoleEndgameCategoryKey;
  label: string;
  /** The ceremony's SHORT name of the category (its rail legend — «РТ», «Награды») — what a medallion prints. */
  short: string;
  accent: ConsoleEndgameCategoryKey;
  value: number;
  zero: boolean;
  penalty: boolean;
  glyph: DossierGlyph;
};

const CATEGORY_GLYPH: Partial<Record<ConsoleEndgameCategoryKey, DossierGlyph>> = {
  tr: {kind: 'icon', icon: 'tr'},
  cards: {kind: 'icon', icon: 'cards'},
  city: {kind: 'tile', tile: 'city'},
  greenery: {kind: 'tile', tile: 'greenery'},
};

/**
 * A category's own symbol — the ONE glyph table the dossier's medallions and the finale's podium share (TR69: the
 * seats' medallions and the ceremony's flying tokens speak the dossier's language). A category with no printed symbol
 * wears its accent disc.
 */
export function scoreCategoryGlyph(key: ConsoleEndgameCategoryKey): DossierGlyph {
  return CATEGORY_GLYPH[key] ?? {kind: 'mark'};
}

/** At most this many earned emblems stand inside one medallion (the rest are the explorer's). */
export const MEDALLION_EMBLEMS_MAX = 3;

/** The score's medallions — one per category of the overview, in its (the ceremony's) order. */
export function dossierMedallions(overview: ScoreOverviewModel): ReadonlyArray<DossierMedallion> {
  return overview.tiles.map((tile) => {
    let glyph: DossierGlyph = scoreCategoryGlyph(tile.key);
    if ((tile.key === 'milestones' || tile.key === 'awards') && tile.ledger.kind === 'medallions' && tile.ledger.entries.length > 0) {
      glyph = {kind: 'emblems', slugs: tile.ledger.entries.slice(0, MEDALLION_EMBLEMS_MAX).map((e) => e.slug)};
    }
    const short = SCORE_CATEGORY_TABLE.find((m) => m.key === tile.key)?.legend ?? tile.label;
    return {key: tile.key, label: tile.label, short, accent: tile.accent, value: tile.value, zero: tile.zero, penalty: tile.penalty, glyph};
  });
}

/**
 * THE SEALED CELL (decision 7a) — what a hidden score leaves on the dossier: NOTHING of the score (no total, no
 * category, no share — `vpVisible` is the only gate and it said no), only what every player can already read on the
 * table — the rating (the rail shows it), the milestones the seat CLAIMED and the awards it FUNDED (the strategy rail
 * shows them). Not one VP number.
 */
export type DossierSealedFacts = {
  rating: number;
  milestones: ReadonlyArray<{name: string, slug: string}>;
  awards: ReadonlyArray<{name: string, slug: string}>;
  /** The seat is UNDER A RATING VETO (RX42): the law (its printed name, an i18n key) — read off the server's live leaders. */
  veto?: {law: string};
};

export function dossierSealedFacts(
  rating: number,
  color: Color,
  milestones: ReadonlyArray<{name: string, color?: Color}>,
  awards: ReadonlyArray<{name: string, color?: Color}>,
  slugOf: (name: string) => string,
  veto: {law: string} | undefined = undefined,
): DossierSealedFacts {
  const own = (list: ReadonlyArray<{name: string, color?: Color}>) =>
    list.filter((m) => m.color === color).map((m) => ({name: m.name, slug: slugOf(m.name)}));
  return {rating, milestones: own(milestones), awards: own(awards), ...(veto === undefined ? {} : {veto})};
}

// ── THE CARD HISTORY — the corporation's face + fans by type ──────────────

export type DossierStackKey = 'prelude' | 'ceo' | 'active' | 'automated' | 'events';

export type DossierStack = {
  key: DossierStackKey;
  /** i18n key — the played table's own zone caption. */
  label: string;
  count: number;
  /** The faces the fan shows, the MOST RECENT first (it lies on top); at most `facesPerStack`. */
  faces: ReadonlyArray<CardName>;
  /** How many more cards the fan stands for («+K»). */
  more: number;
};

export type DossierCardHistory = {
  corporations: ReadonlyArray<CardName>;
  stacks: ReadonlyArray<DossierStack>;
  /** Every card on the table, the corporations included (the bot's corporation too — parity, see `extraCorporation`). */
  total: number;
};

const STACK_ORDER: ReadonlyArray<{key: DossierStackKey, label: string, zone: keyof PlayedZones}> = [
  {key: 'active', label: 'Active', zone: 'active'},
  {key: 'automated', label: 'Automated', zone: 'automated'},
  {key: 'events', label: 'Events', zone: 'events'},
  {key: 'prelude', label: 'Preludes', zone: 'preludes'},
  {key: 'ceo', label: 'CEO', zone: 'ceos'},
];

/**
 * The seat's card story, from the SAME grouping the «Разыграно» table uses (`buildPlayedZones` — the dossier and the
 * table can never disagree). Only stacks with cards stand; a fan shows the most recent faces (tableau order is play
 * order) and counts the rest. `extraCorporation` is the bot's corporation, which lives outside its pile and counts
 * like a human's (the parity of the played table).
 */
export function dossierCardHistory(zones: PlayedZones, facesPerStack: number, extraCorporation = 0): DossierCardHistory {
  const stacks: Array<DossierStack> = [];
  for (const {key, label, zone} of STACK_ORDER) {
    const cards = zones[zone] as ReadonlyArray<CardModel>;
    if (cards.length === 0) {
      continue;
    }
    const recent = cards.slice(-facesPerStack).map((c) => c.name).reverse();
    stacks.push({key, label, count: cards.length, faces: recent, more: cards.length - recent.length});
  }
  const corporations = zones.corporations.map((c) => c.name);
  const total = corporations.length + extraCorporation + stacks.reduce((n, s) => n + s.count, 0);
  return {corporations, stacks, total};
}

// ── THE ACTIONS — tiles whose state is a SHAPE ─────────────────────────────

/**
 * The state of one action card, as far as THIS viewer may know it:
 *  · `ready`   — the viewer's own card the server finds NO reason against (`CardModel.actionReasons` — a rules
 *                verdict, turn-independent: «could do» stays a count while another seat moves — the console's «МОГ БЫ ≠
 *                МОГУ ПРЯМО СЕЙЧАС» law; the turn is the commit's gate, never a reason);
 *  · `blocked` — the viewer's own card with the server's reason;
 *  · `used`    — spent this generation (public: `actionsThisGeneration`, any seat);
 *  · `idle`    — another seat's card not yet used: the availability is that seat's server verdict, never the
 *                viewer's to derive (invariant 2), so the tile says nothing beyond «not used».
 */
export type DossierActionState = 'ready' | 'blocked' | 'used' | 'idle';

export type DossierActionTile = {
  /** The card's name — or a POLITICAL source's key (`party:<party>` / `law:<id>`, see `political`). */
  name: string;
  /**
   * A PARLIAMENT action (Turmoil Redux «один фреймворк»): a party's / the enacted law's action stands among the
   * seat's actions like a card's — its emblem in the art's place, its NAME key (the party's glossary name, the law's
   * printed name). Absent for a card.
   */
  political?: {party: ReduxParty, title: string};
  state: DossierActionState;
  /** The server's reason (the viewer's own blocked card only). */
  reason?: {message: string, params: ReadonlyArray<string>};
};

/** The order the plate and the gallery read in: what can be done, what cannot, what is done. */
const ACTION_STATE_ORDER: Readonly<Record<DossierActionState, number>> = {ready: 0, idle: 1, blocked: 2, used: 3};

export function dossierActionTiles(
  cards: ReadonlyArray<CardModel>,
  hasAction: (name: CardName) => boolean,
  used: ReadonlySet<CardName>,
  /** The inspected seat IS the viewer's — the only seat whose cards carry the server's reasons. */
  own: boolean,
): ReadonlyArray<DossierActionTile> {
  const tiles: Array<DossierActionTile & {at: number}> = [];
  cards.forEach((card, at) => {
    if (!hasAction(card.name)) {
      return;
    }
    if (used.has(card.name)) {
      tiles.push({name: card.name, state: 'used', at});
      return;
    }
    if (!own) {
      tiles.push({name: card.name, state: 'idle', at});
      return;
    }
    const reason = card.actionReasons?.[0];
    if (reason === undefined) {
      tiles.push({name: card.name, state: 'ready', at});
      return;
    }
    tiles.push({name: card.name, state: 'blocked', at, reason: {message: String(reason.message), params: (reason.params ?? []).map(String)}});
  });
  tiles.sort((a, b) => ACTION_STATE_ORDER[a.state] - ACTION_STATE_ORDER[b.state] || a.at - b.at);
  return tiles.map(({at: _at, ...tile}) => tile);
}

/** The slice of a Parliament action source the dossier reads (`console/parliament/parliamentActionSources`). */
export type DossierPoliticalAction = {
  key: string;
  party: ReduxParty;
  title: string;
  usesLeft: number;
  available: boolean;
  reason: string;
  /** Another seat's — only its public uses are known. */
  foreign: boolean;
};

/**
 * The Parliament's actions JOINED to the card tiles, in the same state order (a political tile first within a
 * state — the explorer's reading order): used when spent, `idle` for another seat's, else the viewer's verdict.
 */
export function withPoliticalActionTiles(cards: ReadonlyArray<DossierActionTile>, political: ReadonlyArray<DossierPoliticalAction>): ReadonlyArray<DossierActionTile> {
  const tiles: Array<DossierActionTile & {at: number}> = political.map((p, at) => {
    const tile = {name: p.key, political: {party: p.party, title: p.title}, at};
    if (p.usesLeft <= 0) {
      return {...tile, state: 'used' as const};
    }
    if (p.foreign) {
      return {...tile, state: 'idle' as const};
    }
    return p.available ? {...tile, state: 'ready' as const} : {...tile, state: 'blocked' as const, reason: {message: p.reason, params: []}};
  });
  cards.forEach((card, i) => tiles.push({...card, at: political.length + i}));
  tiles.sort((a, b) => ACTION_STATE_ORDER[a.state] - ACTION_STATE_ORDER[b.state] || a.at - b.at);
  return tiles.map(({at: _at, ...tile}) => tile);
}

/**
 * THE TILES THE PLATE SHOWS when there are more than `max` (the rest are counted «+K», the zone shows them all): the
 * order stays the state order, but every STATE that exists keeps its first tile on the plate — a state on the table is
 * never only a number in the legend (ONE FRAMEWORK: the seat's Parliament actions joined the cards, and a used card fell
 * off a plate of ready and blocked ones). One cell goes to «+K».
 */
export function dossierPlateTiles(tiles: ReadonlyArray<DossierActionTile>, max: number): ReadonlyArray<DossierActionTile> {
  if (tiles.length <= max) {
    return tiles;
  }
  const budget = Math.max(1, max - 1);
  const keep = new Set<number>();
  const seen = new Set<DossierActionState>();
  tiles.forEach((t, i) => {
    if (!seen.has(t.state)) {
      seen.add(t.state);
      keep.add(i);
    }
  });
  for (let i = 0; i < tiles.length && keep.size < budget; i++) {
    keep.add(i);
  }
  return tiles.filter((_, i) => keep.has(i)).slice(0, Math.max(budget, seen.size));
}

/** How many tiles stand in each state (the plate's legend — only the states that exist). */
export function dossierActionCounts(tiles: ReadonlyArray<DossierActionTile>): ReadonlyArray<{state: DossierActionState, count: number}> {
  const counts = new Map<DossierActionState, number>();
  for (const t of tiles) {
    counts.set(t.state, (counts.get(t.state) ?? 0) + 1);
  }
  return (['ready', 'idle', 'blocked', 'used'] as const).filter((s) => counts.has(s)).map((state) => ({state, count: counts.get(state) ?? 0}));
}

// ── THE EFFECTS — families as medallions ───────────────────────────────────

export type DossierEffectFamily = {
  family: EffectFamily | 'armed';
  label: string;
  count: number;
};

/** The zone's families (`effectsZoneCounts`, canonical order) led by the effects armed for the next card (TR49). */
export function dossierEffectFamilies(zone: EffectsZoneCounts, armed: number): ReadonlyArray<DossierEffectFamily> {
  const families: Array<DossierEffectFamily> = armed > 0 ? [{family: 'armed', label: 'Armed for your next card', count: armed}] : [];
  for (const f of zone.families) {
    families.push({family: f.family, label: f.label, count: f.count});
  }
  return families;
}

// ── THE PARLIAMENT — the career ladder as pips ─────────────────────────────

export type DossierLadderPip = {step: number, state: 'passed' | 'here' | 'next' | 'ahead'};

/** The Agenda track as pips: every step before the marker passed, the marker's own `here`, the one after it `next`. */
export function dossierLadder(position: number, steps: number): ReadonlyArray<DossierLadderPip> {
  const pips: Array<DossierLadderPip> = [];
  for (let step = 1; step <= steps; step++) {
    pips.push({step, state: step < position ? 'passed' : step === position ? 'here' : step === position + 1 ? 'next' : 'ahead'});
  }
  return pips;
}
