/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ПАНЕЛЬ ИТОГОВ («Заседание v5» §4) — the pure reading of the sitting's last
 * surface, and the ONE place that decides what belongs on it.
 *
 * ══ THE LAW ══
 *
 *   THE RESULTS PANEL NEVER PRINTS WHAT IS VISIBLE IN ANOTHER ZONE OF THE
 *   SCREEN AT THAT MOMENT — not even «for completeness». It says only what is
 *   nowhere else.
 *
 * Three rows were deleted by that one law, each of them plausible on its own:
 *  · ЗАКОН — the enacted resolution, the party that rules by it and the new
 *    chairman quest: all three stand in the GOVERNMENT's zone, and richer
 *    there (quest progress, its reward, the chair).
 *  · В ЛОББИ — who got a delegate back. The DELEGATES ZONE in the head is «the
 *    ONE ledger of every player's places» and shows, for EVERY seat, the lobby
 *    socket and the reserve stack with its count and name; it even marks the
 *    return on the reserve's key as it lands. The row also said less than it
 *    seemed: `lobbyRefilled` is «whose lobby was EMPTY and got filled», a
 *    record of the step — a player who never spent last generation's delegate
 *    has one and was never in the list.
 *
 * What survived is exactly what has no other home: the PAYOUTS per seat, and
 * the POPULAR SUPPORT stock per party (the row of plaques is hidden by this
 * very panel while it stands). Plus the one lobby fact that IS nowhere else
 * and changes plans: the seats that enter the next vote with nothing to vote
 * with. Guard: `console-parliament-results-honesty.spec.ts` § И7, which reads
 * each zone's own words off the live DOM and refuses to find them in here.
 *
 * TWO sections, and nothing beside them:
 *
 *  ① ВЫПЛАТЫ — a row per seat: what each of them actually got. This is the
 *    panel's main content, because a seat saw its OWN reward as chips flying
 *    to its rail and has never been shown anybody else's. A skip names itself
 *    with its reason, exactly as on the reward beat — never a silent loss.
 *    In a solo game it collapses to the one row.
 *  ② СТОЛ — what changed and is already out of sight: the new resolutions with
 *    their parties, the POPULAR SUPPORT STOCK per party after the deal, and
 *    the seats that will enter the next vote with no free delegate.
 *
 *    THE SUPPORT ROW IS A STOCK, never this deal's increment: the increment is
 *    «+1» almost every time and is not worth a row, while the stock is exactly
 *    what a player plans on (accumulated neutral delegates become instant votes
 *    the moment a card of that party reaches the area) — and the row of party
 *    plaques, the only other place that shows it, is hidden by this very panel
 *    while it stands. The increment rides along as a MARK on the fresh places,
 *    never as the row's quantity.
 *
 *    THE RULING PARTY IS NOT IN THAT ROW: its stock is read on its OWN plaque in
 *    the government's zone, which stands beside this panel — and the panel never
 *    restates another zone. It is almost always zero (nothing can pay a party
 *    that rules by an enacted card — the proof is in `ConsolePartyPlaque.vue`);
 *    the one exception, a stock a card paid to a resolution that then won, is
 *    DRAWN there as cubes, so leaving it out loses nothing.
 *
 *    THE «NO FREE DELEGATE» ROW IS AN EXCEPTION, not a list: it exists only
 *    when somebody is in that state, which in an ordinary game is almost never.
 *    It is the one thing the delegates ledger does not say out loud — a seat
 *    whose lobby is empty AND whose reserve is empty cannot vote next
 *    generation at all, and the ledger states that as two separate marks in
 *    two separate columns. A skip names itself (law 4); silence would be the
 *    defect.
 *
 * Every fact is the SERVER's own record (`summary.outcomes` is the whole
 * phase's, not just the viewer's) — nothing is recomputed, and a skip's reason
 * is the reason the server wrote. Pure: no DOM, no Vue, no i18n calls (English
 * text is the key, as everywhere). Spec: `tests/console/parliamentResults.spec.ts`.
 */
import {Color} from '@/common/Color';
import {ReduxParty, ResolutionId, ResolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {ParliamentEnactOutcomeModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {REWARD_ADDRESS, rewardAddressOf} from '@/common/parliament/rewardAddress';
import {ParameterMoveId} from '@/common/parliament/parameterMove';
import {ColonyName} from '@/common/colonies/ColonyName';
import {colonyTrackRecordOf, colonyTrackTilesOf} from './colonyTrackModel';
import {InfluenceLevelTerm} from '@/common/parliament/influenceScaling';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {LEVEL_NONE_KEY, levelPresentation} from './influenceYieldModel';

/**
 * The LEVEL term of `effect` as the enacted resolution declares it — the card's
 * own word, looked up through the client manifest (never a table by id).
 * Undefined for every record that is not a level part's.
 */
function levelTermOf(resolution: ResolutionId, effect: string | undefined): InfluenceLevelTerm | undefined {
  if (effect === undefined) {
    return undefined;
  }
  return getResolution(resolution)?.scaled?.find((e) => e.id === effect)?.level;
}

/** ONE part of one seat's payout — an object and an amount, or a skip with its reason. */
export type ResultsPayoutPart = {
  id: string;
  /** The record's kind — the component picks the icon family from it. */
  kind: ParliamentEnactOutcomeModel['kind'];
  /** The unit the chip speaks: a resource / card-resource name, `cards`, or '' for a tile. */
  unit: string;
  /**
   * A card-resource part of SEVERAL kinds (Medical Database's «data or microbe») whose units did not all land in
   * one kind — or its skip: the kinds in the declared order, drawn as ONE unit joined by «or»; `unit` is then ''.
   */
  units?: ReadonlyArray<string>;
  /** The unit is a PRODUCTION step (the console's production frame), not a stock gain. */
  production: boolean;
  amount?: number;
  /** A winner's part: which tile — or `colony` for the colony built for free (its tile is `colony`); a granted tier's `city`. */
  tile?: 'ocean' | 'greenery' | 'colony' | 'city';
  /** A CITY TIER (Skyscrapers): the stack the cell became — the record's own height, printed «×N» beside the tile. */
  stack?: number;
  /**
   * THE WINNER'S OWN STEP OF A PARAMETER (Mohole Contest): the parameter it raised, before and after — the
   * seat's row states it (the scales already moved on the board; the row says the step and what it paid),
   * never the planet line, which belongs to a move nobody made.
   */
  parameter?: {id: ParameterMoveId, before: number, after: number};
  /** …and the terraform rating that step paid the seat (the record's own, measured by the engine). */
  tr?: number;
  /**
   * A STEP OF THE CAREER a law granted the seat (Reds Budget, `agenda`): the marker's walk — the row reads
   * «[insignia] 3 → 4» with what it paid beside it: `tr` above, the cards the card step dealt (`drawn`) — MarsBot's
   * included (its card is M€ under the hood, D16 — never a surface's business).
   */
  walk?: {from: number, to: number};
  drawn?: number;
  /** The card a card resource landed on (one recipient). */
  card?: string;
  /**
   * WHERE a card resource landed, card by card — printed when it was SPREAD
   * over several (a distribution): the row then names each recipient with
   * its own share beside the sum; one recipient prints the sum alone.
   */
  cards?: ReadonlyArray<{card: string, amount: number, resource?: string}>;
  /**
   * A card payout that ASKED NOBODY (Sponsored Projects — one of its own kind onto every card that already held a
   * resource): HOW MANY cards received — the row reads «+4 [?] · на 4 карты», then one icon of each card's kind
   * below `EACH_CARD_LIST_MAX` cards, past it the number alone (the names were the receipt's — it showed every face).
   */
  eachCard?: number;
  /** The RULING PARTY's own answer — its emblem stands beside the amount. */
  party?: ReduxParty;
  /**
   * THE COLONY whose printed bonus this part pays (Colonial Affairs) — the panel GROUPS a seat's parts by
   * it, so «Luna +6 M€ · Pluto card → discard ×3» reads tile by tile, as the ledger did.
   */
  colony?: string;
  /** A HUD-side colony bonus (`colonyBonus`): the tile's printed description IS the reading. */
  description?: string;
  /**
   * A LEVEL part's ZERO (Joint Research: a `target` record that paid nothing because the seat was already
   * at its target): the CALM phrase the row prints instead of the skip label («no draw needed») — the rule
   * working, never a skip; the server's reason still reads beside it.
   */
  none?: string;
  /**
   * A LEVY (a budget's «lose 10 M€»): `amount` is NEGATIVE — what left the seat — and this is what was OWED.
   * Above `−amount` exactly when the seat was short; the shortfall's reason is then `note`.
   */
  owed?: number;
  /** A paying part's own reason (a short levy) — printed beside the amount, never a skip. */
  note?: string;
  /** The part paid nothing: WHAT it was and WHY (both English i18n keys). */
  skipped?: {title: string, reason: string};
  /** The WINNER's own part of the law (`part: 'winner'`) — the crown is its source mark. */
  winner?: boolean;
  /** A colony-paid part: how many times its bonus was paid (the law's k) — the source mark's «×k». */
  multiplier?: number;
  /** …and the seat's cubes on that tile when more than one (each pays in full). */
  cubes?: number;
};

export type ResultsPayout = {
  player: Color;
  /** Every record of the seat, in the server's order — the breakdown's lines read them. */
  parts: ReadonlyArray<ResultsPayoutPart>;
  /**
   * What the seat GOT — the card's ledger row (`resultsTotalsOf`): one token per unit, a levy netted into its own
   * unit (the budget's «−10 → +7 = −3» is the M€ total itself), an object per fact, the skips last.
   */
  totals: ReadonlyArray<ResultsTotal>;
  /** …and the quiet marks row under it: where the totals came from (planets ×k, a party's seal, the crown). */
  marks: ReadonlyArray<ResultsTotalSource>;
};

/**
 * ONE PARTICIPATING SEAT as the panel reads it: the order the payouts print in,
 * and what that seat will have to vote with next generation. The two travel
 * together on purpose — the panel's seat list IS the parliament model's own
 * participating players, and a second list beside it could disagree with it.
 */
export type ResultsSeat = {
  player: Color;
  /** A free delegate waits in this seat's lobby (the sitting's last step refills it where it can). */
  lobby: boolean;
  /** Delegates left in this seat's reserve — what the lobby is refilled FROM. */
  reserve: number;
  /**
   * The seat is PAID by the laws (`seatEnacts`). A MarsBot seat is not (decision D3): its payout row exists only
   * for a part it actually received (a winner's reward), never as a «no reward» line for a law that was never
   * about it. Absent = a paid seat (a fixture from before the field).
   */
  enacts?: boolean;
};

/**
 * ONE party's POPULAR SUPPORT as the row states it: the STOCK standing in its
 * places after the deal, and how many of those places this sitting filled.
 */
export type ResultsSupport = {
  party: ReduxParty;
  /** The stock after the deal (0…`PARLIAMENT_MAX_POPULAR_SUPPORT`) — the row's quantity, in places. */
  total: number;
  /**
   * How many of the filled places arrived in THIS sitting — the freshness mark,
   * never the row's quantity. Clamped to `total` on purpose: support the deal
   * moved straight onto a fresh card of that party is no longer a stock, so a
   * gain that left marks nothing (and a gain the server capped at three was
   * already counted honestly by `addPopularSupport`).
   */
  fresh: number;
};

/**
 * ② THE TABLE: what changed and has already left the eye. A fresh resolution
 * is a fresh resolution — a loser dealt straight back from the reshuffled
 * discard LEFT the table and was dealt again by the rules, and the renewal's
 * tact showed exactly that; nothing here says «it stayed».
 */
export type ResultsTable = {
  fresh: ReadonlyArray<{instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty}>;
  support: ReadonlyArray<ResultsSupport>;
  /**
   * THE EXCEPTION: seats that enter the NEXT vote with nothing to vote with —
   * an empty lobby with an empty reserve behind it. Usually empty, and then the
   * row does not exist at all; never a list of who CAN vote (that is the
   * delegates ledger's, seat by seat, at the top of the screen).
   */
  noDelegate: ReadonlyArray<Color>;
  /**
   * THE RULING EFFECT CHANGED HANDS (PL-112): the enactment gave everyone the
   * winner's party effect, and took the previous ruling party's away — told
   * ONCE, here, for the whole table (a seat's OWN gain or loss by its cubes or
   * a card is its own journal root and notification, never this row). Absent
   * when the same party rules on (the effect is nobody's news).
   */
  rulingEffect?: {gained: ReduxParty, lost?: ReduxParty};
};

/**
 * ③ THE PLANET — what the enactment did to the WORLD, which belongs to no seat
 * and therefore to no payout row (Gas Export: «кислород 5 → 4 %, Венера 10 →
 * 14 %, РТ никому»). The panel's law stands: it prints only what is not
 * visible anywhere else — the scales have already moved on the board, so the
 * line states the STEP and the fact nobody was credited, never a celebration.
 * A move that could not happen is here too, with its reason (no silent loss).
 */
export type ResultsPlanetMove = {
  id: string;
  parameter: ParameterMoveId;
  before: number;
  after: number;
  /** Signed steps actually made (negative = lowered); 0 with a `skipped` reason. */
  steps: number;
  /** Nobody was credited with a terraform rating for the move. */
  unrewarded: boolean;
  /** The move did not happen: WHY (an English i18n key). */
  skipped?: string;
};

/**
 * ④ THE COLONY TABLE — what the enactment did to EVERY colony track (Unity Budget: «Луна 3 → 5, Ио: трек
 * на максимуме»), which belongs to no seat and therefore to no payout row. The markers have already
 * glided on the colonies screen (the sitting hosted it for exactly that), so the line states each tile's
 * step and the one fact the screen cannot keep saying — that a tile at its end did not move. A table
 * with no tile at all is here too, with its reason (no silent loss).
 */
export type ResultsTrackMove = {
  id: string;
  colony: ColonyName;
  before: number;
  after: number;
  /** The steps actually made — 0 for a tile whose track stood at its end. */
  steps: number;
  atMax: boolean;
};

export type ResultsTracks = {
  /** The declared steps («+2»). */
  steps: number;
  tiles: ReadonlyArray<ResultsTrackMove>;
  /** The advance did not happen at all: WHY (an English i18n key). */
  skipped?: string;
};

export type ResultsReading = {
  payouts: ReadonlyArray<ResultsPayout>;
  /** NOBODY was paid: the resolution is a passive / an action, and the kicker says which. */
  quiet?: {kicker: string, kind: 'passive' | 'action'};
  /** A RATING-VETOING law (RX42): the seats it binds as the sitting closes, with their ratings — the server's list. */
  veto?: ReadonlyArray<{color: Color, tr: number}>;
  /** The WORLD's own part, when the enactment had one — never a seat's row. */
  planet?: ReadonlyArray<ResultsPlanetMove>;
  /** The COLONY TABLE's own part (Unity Budget), when the enactment had one — never a seat's row. */
  tracks?: ResultsTracks;
  table: ResultsTable;
};

/**
 * THE COLONY TRACK RECORD of a sitting as the colonies line reads it — the
 * record that names no seat. Pure; the order of the tiles is the server's.
 */
export function resultsTrackMoves(summary: ParliamentPhaseSummaryModel): ResultsTracks | undefined {
  const record = colonyTrackRecordOf(summary.outcomes);
  if (record === undefined) {
    return undefined;
  }
  const tiles = colonyTrackTilesOf(record).map((tile, index): ResultsTrackMove => ({
    id: `tracks:${tile.colony}:${index}`, colony: tile.colony, before: tile.before, after: tile.after, steps: tile.steps, atMax: tile.atMax,
  }));
  const out: ResultsTracks = {steps: record.amount ?? 0, tiles};
  const skipped = rewardAddressOf(record, undefined).skipped;
  if (skipped !== undefined) {
    out.skipped = skipped;
  }
  return out;
}

/**
 * THE WORLD RECORDS of a sitting as the planet line reads them — the records
 * that name no seat. Pure; the order is the server's.
 */
export function resultsPlanetMoves(summary: ParliamentPhaseSummaryModel): Array<ResultsPlanetMove> {
  const out: Array<ResultsPlanetMove> = [];
  (summary.outcomes ?? []).forEach((outcome, index) => {
    if (outcome.player !== undefined || outcome.parameter === undefined) {
      return;
    }
    const move: ResultsPlanetMove = {
      id: `world:${outcome.step}:${index}`,
      parameter: outcome.parameter.id,
      before: outcome.parameter.before,
      after: outcome.parameter.after,
      steps: outcome.amount ?? 0,
      unrewarded: outcome.unrewarded === true,
    };
    const skipped = rewardAddressOf(outcome, undefined).skipped;
    if (skipped !== undefined) {
      move.skipped = skipped;
    }
    out.push(move);
  });
  return out;
}

/** A payout that asked nobody lists its cards' kinds below this many — past it the row reads the number alone. */
export const EACH_CARD_LIST_MAX = 6;

/** The unit of a card payout of NO declared kind whose cards took more than one kind — the face's «?» cube. */
export const OWN_KIND_UNIT = 'own-kind';

/** The unit a record's chip speaks, and whether it is a production step. */
function unitOf(outcome: ParliamentEnactOutcomeModel): {unit: string, units?: ReadonlyArray<string>, production: boolean} {
  if (outcome.production !== undefined) {
    return {unit: String(outcome.production), production: true};
  }
  if (outcome.stock !== undefined) {
    return {unit: String(outcome.stock), production: false};
  }
  if (outcome.resource !== undefined) {
    return {unit: String(outcome.resource), production: false};
  }
  // A payout that asked nobody, onto cards of several kinds: the unit is «one of its own kind» — the face's «?».
  if (outcome.onto === 'each-counted') {
    return {unit: OWN_KIND_UNIT, production: false};
  }
  // A card-resource record over SEVERAL kinds with no one kind to name: the kinds, joined by «or» when drawn.
  if (outcome.resources !== undefined && outcome.resources.length > 0) {
    return {unit: '', units: outcome.resources.map((r) => String(r)), production: false};
  }
  // A card thrown away (Pluto's second half) speaks the card unit too; a HUD-side colony bonus has none — its description reads.
  return {unit: outcome.kind === 'cards' || outcome.kind === 'discard' ? 'cards' : '', production: false};
}

/**
 * ONE record as a part of its seat's payout — the server's amount, or the skip
 * the address names. `level` is the DECLARATION of the level term this record
 * belongs to, where it belongs to one: the calm phrase of a zero is the term's
 * own («no draw needed» for a top-up, «nothing to lose» for a cut), and a
 * record cannot say which it was — only the card can.
 */
export function resultsPayoutPart(outcome: ParliamentEnactOutcomeModel, index: number, level?: InfluenceLevelTerm): ResultsPayoutPart {
  const delivery = rewardAddressOf(outcome, outcome.player);
  const owner = outcome.player ?? 'neutral';
  const {unit, units, production} = unitOf(outcome);
  const part: ResultsPayoutPart = {
    id: `${owner}:${outcome.step}:${outcome.part ?? ''}:${index}`,
    kind: outcome.kind,
    unit,
    ...(units === undefined ? {} : {units}),
    production,
  };
  if (outcome.amount !== undefined) {
    part.amount = outcome.amount;
  }
  if (outcome.kind === 'ocean' || outcome.kind === 'greenery' || outcome.kind === 'colony' || outcome.kind === 'city') {
    part.tile = outcome.kind;
  }
  if (outcome.kind === 'city' && outcome.stackHeight !== undefined) {
    part.stack = outcome.stackHeight;
  }
  // A parameter the part MOVED rides the row — the winner's own step (Mohole Contest) and a placed OCEAN /
  // GREENERY alike (the record carries the count it moved): the row reads «0 → 1», never a bare amount of
  // nothing. Without it a tile part fell to the generic tail and printed «0».
  if ((outcome.kind === 'globalParameter' || outcome.kind === 'ocean' || outcome.kind === 'greenery') && outcome.parameter !== undefined) {
    part.parameter = {id: outcome.parameter.id, before: outcome.parameter.before, after: outcome.parameter.after};
    if (outcome.tr !== undefined) {
      part.tr = outcome.tr;
    }
  }
  // A STEP OF THE CAREER: the walk and what it paid — the record's own numbers (the row draws no amount for it).
  if (outcome.kind === 'agenda' && outcome.walk !== undefined && outcome.walk.steps.length > 0) {
    part.walk = {from: outcome.walk.from, to: outcome.walk.to};
    if (outcome.tr !== undefined) {
      part.tr = outcome.tr;
    }
    if (outcome.drawn !== undefined) {
      part.drawn = outcome.drawn;
    }
  }
  if (outcome.card !== undefined) {
    part.card = outcome.card;
  } else if (delivery.payload.cards?.length === 1 && outcome.onto !== 'each-counted') {
    // A distribution that landed on ONE card names it like a single recipient (the ledger's mini name reads it).
    part.card = delivery.payload.cards[0].card;
  }
  if (delivery.payload.cards !== undefined && delivery.payload.cards.length > 1) {
    // Each recipient keeps the kind ITS card took — printed beside its share where the kinds differ.
    part.cards = delivery.payload.cards.map((entry) => ({card: entry.card, amount: entry.amount, ...(entry.resource === undefined ? {} : {resource: entry.resource})}));
  }
  // A PAYOUT THAT ASKED NOBODY names HOW MANY cards received; a long list stays in the receipt that showed it.
  if (outcome.onto === 'each-counted' && delivery.skipped === undefined) {
    const count = delivery.payload.cards?.length ?? 0;
    part.eachCard = count;
    if (count >= EACH_CARD_LIST_MAX) {
      delete part.cards;
    }
  }
  if (outcome.kind === 'reaction' && outcome.party !== undefined) {
    part.party = outcome.party as ReduxParty;
  }
  if (outcome.colony !== undefined) {
    part.colony = outcome.colony;
    if (outcome.multiplier !== undefined) {
      part.multiplier = outcome.multiplier;
    }
    if (outcome.cubes !== undefined) {
      part.cubes = outcome.cubes;
    }
  }
  if (outcome.part === 'winner') {
    part.winner = true;
  }
  if (outcome.description !== undefined) {
    part.description = outcome.description;
  }
  if (outcome.owed !== undefined) {
    part.owed = outcome.owed;
  }
  // A LOSS with a reason is a paying part that says why it took less (a short levy) — never a skip.
  if (delivery.skipped === undefined && delivery.direction === 'loss' && outcome.reason !== undefined) {
    part.note = outcome.reason;
  }
  if (delivery.skipped !== undefined) {
    part.skipped = {
      title: outcome.kind === 'skipped' ?
        (outcome.part === 'winner' ? 'Reward for the winner of the vote' : 'Resolution effect') :
        REWARD_ADDRESS[outcome.kind].skipTitle,
      reason: delivery.skipped,
    };
    // A LEVEL part at its target (a record with a `target` that owed nothing) is the rule working: the row
    // says so calmly, in the same words the band and the panel use, and keeps the server's reason beside it.
    if (outcome.kind === 'skipped' && outcome.target !== undefined && (outcome.amount ?? 0) === 0) {
      part.none = level === undefined ? LEVEL_NONE_KEY : levelPresentation(level).noneKey;
    }
  }
  return part;
}

/**
 * THE READING. `seats` is the order the panel prints and the state each seat
 * enters the next vote in (the parliament model's own participating players —
 * the one visible ordering key, the same the seats zone above shows); `support` is the
 * LIVE stock per party, read AFTER the deal (the deal turns a party's whole
 * stock into votes on its fresh card, so the summary's own `total` — written one
 * step earlier — is not what stands on the table); `quiet` is the pose of a
 * resolution that pays nobody, and it replaces the rows rather than printing an
 * empty one per seat.
 */
/** The ruling effect's change (PL-112) — the winner's party against the party that ruled before, when they differ. */
function rulingEffectOf(summary: ParliamentPhaseSummaryModel): {rulingEffect?: {gained: ReduxParty, lost?: ReduxParty}} {
  const gained = summary.enacted.party;
  const lost = summary.discardedEnacted?.party;
  if (lost === gained) {
    return {};
  }
  return {rulingEffect: lost === undefined ? {gained} : {gained, lost}};
}

export function resultsReadingOf(
  summary: ParliamentPhaseSummaryModel,
  seats: ReadonlyArray<ResultsSeat>,
  support: ReadonlyArray<{party: ReduxParty, support: number}>,
  extras: {quiet?: {kicker: string, kind: 'passive' | 'action'}, veto?: ReadonlyArray<{color: Color, tr: number}>} = {},
): ResultsReading {
  const byPlayer = new Map<Color, Array<ResultsPayoutPart>>();
  for (const seat of seats) {
    byPlayer.set(seat.player, []);
  }
  (summary.outcomes ?? []).forEach((outcome, index) => {
    // A WORLD record names no seat: it belongs to the planet line, never to a payout row.
    const parts = outcome.player === undefined ? undefined : byPlayer.get(outcome.player);
    if (parts !== undefined) {
      // The level term this record belongs to, by the ENACTED card's own declaration: a zero speaks the
      // term's words, and only the declaration knows whether the level was topped up or cut down to.
      parts.push(resultsPayoutPart(outcome, index, levelTermOf(summary.winner.resolution, outcome.effect)));
    }
  });
  // A seat the law never pays (MarsBot) prints a row ONLY for a part it received (its winner's reward) — a «no reward»
  // line would say it lost a contest it was never in.
  const paid = seats.filter((seat) => seat.enacts !== false || (byPlayer.get(seat.player)?.length ?? 0) > 0);
  const payouts = paid.map((seat): ResultsPayout => {
    const parts = byPlayer.get(seat.player) ?? [];
    const totals = resultsTotalsOf(parts);
    return {player: seat.player, parts, totals, marks: seatSourceMarksOf(totals)};
  });
  // What the SUPPORT STEP granted, per party — the freshness mark of the row below. Summed, never
  // assigned: one party gets at most one record today, and a reading may not depend on that.
  const gained = new Map<ReduxParty, number>();
  for (const entry of summary.support) {
    gained.set(entry.party, (gained.get(entry.party) ?? 0) + entry.gained);
  }
  const reading: ResultsReading = {
    payouts,
    table: {
      fresh: summary.refreshed.map((f) => ({instance: f.instance, resolution: f.resolution, party: f.party})),
      // The party that rules by the enacted card is left out: its plaque stands in the government's zone,
      // two hand-spans away from this row, and draws whatever stock it holds (zero unless a card paid it).
      support: support.filter((entry) => entry.party !== summary.enacted.party).map((entry) => ({
        party: entry.party,
        total: entry.support,
        fresh: Math.max(0, Math.min(entry.support, gained.get(entry.party) ?? 0)),
      })),
      // Read from the LIVE seats, after the lobby step: «what will this seat have when the next vote
      // opens» is a state, never the step's own record — `lobbyRefilled` names whose lobby was EMPTY
      // and got filled, which says nothing about a seat that still holds last generation's delegate.
      noDelegate: seats.filter((seat) => !seat.lobby && seat.reserve <= 0).map((seat) => seat.player),
      ...rulingEffectOf(summary),
    },
  };
  const planet = resultsPlanetMoves(summary);
  if (planet.length > 0) {
    reading.planet = planet;
  }
  const tracks = resultsTrackMoves(summary);
  if (tracks !== undefined) {
    reading.tracks = tracks;
  }
  // A resolution that pays NOBODY: the rows would all be empty, so the section says what stands instead.
  // A law that MOVED THE WORLD — the planet, or the colony table — is not «quiet»: that line is its reading.
  if (extras.quiet !== undefined && planet.length === 0 && tracks === undefined && payouts.every((p) => p.parts.length === 0)) {
    reading.quiet = extras.quiet;
  }
  if (extras.veto !== undefined && extras.veto.length > 0) {
    reading.veto = extras.veto;
  }
  return reading;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE SEAT'S TOTALS (P71 · ledger CY) — what the card says about a seat: what it GOT, per unit, never a chip per
// record. Colonial Affairs writes k pairs of Pluto as 2k records; a budget writes the levy, the payout and the party's
// answer as three: the card printed one chip each («Плутон +1 · ⌫1 · +1 · ⌫1 · +1 · ⌫1»), the plates outgrew their
// row and spilled over each other (the owner's two frames, 2026-10-28). The record-by-record story belongs to the
// breakdown one level deeper («ПОДРОБНОСТИ ВЫПЛАТ»), which renders its total with the SAME function — the two
// surfaces cannot disagree on what a seat got.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** WHERE a total came from — its marks under the seat's tokens (icons only: a planet ×k, a party's seal, the crown). */
export type ResultsTotalSource =
  | {kind: 'colony', colony: string, times?: number}
  | {kind: 'party', party: ReduxParty}
  | {kind: 'winner'}
  | {kind: 'law'};

/**
 * ONE TOTAL of one seat:
 *  · `unit`    — a number of one unit (a supply resource, a production step, cards drawn, a resource onto a card),
 *                every record of that unit summed: a levy NETS into its own unit (the M€ total is the day's NET),
 *                the ruling party's answer FLOWS into its unit (the seat received M€ — one number) and marks its source;
 *  · `discard` — cards thrown away (Pluto's second half) — never netted against the draw;
 *  · `object`  — a fact that is not a number of a unit (a tile, a step of a parameter, a walk of the Career, a tile's
 *                printed benefit, a payout that asked nobody): ONE record, drawn by the one record renderer
 *                (`ConsoleSitPayoutPart`);
 *  · `skipped` — a part that paid nothing, with the server's reason (invariant 4 — a skip names itself).
 */
export type ResultsTotal = {
  id: string;
  kind: 'unit' | 'discard' | 'object' | 'skipped';
  /** The unit (a resource / card-resource name, `cards`); '' for an object / a skip. */
  unit: string;
  /** A card-resource unit of several kinds — the declared kinds, drawn as one unit joined by «or». */
  units?: ReadonlyArray<string>;
  /** The family of the unit's icon: a supply resource, a card resource (the cube on a card), cards. */
  family: 'stock' | 'cardResource' | 'cards' | 'none';
  production: boolean;
  /** `unit` / `discard`: the sum. */
  amount?: number;
  /** A card-resource total that landed on ONE card: its name (the mini name beside the icon). */
  card?: string;
  /** …or the recipients card by card when it was spread (summed per card across the records). */
  cards?: ReadonlyArray<{card: string, amount: number}>;
  /** `object` / `skipped`: the record itself — the one renderer draws it. */
  part?: ResultsPayoutPart;
  /** Where it came from, each source once, in the order the records named them. */
  sources: ReadonlyArray<ResultsTotalSource>;
  /** How many records this total stands for (the breakdown's «из чего», and the invariant's count). */
  records: number;
};

/** The merge key of a NUMBER part (undefined = the part is an object or a skip and stands alone). */
function totalKeyOf(part: ResultsPayoutPart): {key: string, kind: 'unit' | 'discard', family: ResultsTotal['family']} | undefined {
  if (part.skipped !== undefined || part.amount === undefined) {
    return undefined;
  }
  // Objects: a tile, a parameter's step, a walk, a payout that asked nobody (it names its count of cards).
  if (part.tile !== undefined || part.parameter !== undefined || part.walk !== undefined || part.eachCard !== undefined) {
    return undefined;
  }
  if (part.kind === 'discard') {
    return {key: 'discard', kind: 'discard', family: 'cards'};
  }
  if (part.kind === 'cards') {
    return {key: 'cards', kind: 'unit', family: 'cards'};
  }
  if (part.kind === 'cardResource') {
    const unit = part.units !== undefined ? part.units.join('|') : part.unit;
    return {key: `cres:${unit}`, kind: 'unit', family: 'cardResource'};
  }
  // A HUD-side colony bonus with no unit (a discount, a science tag) is the tile's printed benefit — an object.
  if (part.unit === '') {
    return undefined;
  }
  return {key: `${part.production ? 'prod' : 'stock'}:${part.unit}`, kind: 'unit', family: 'stock'};
}

/** The sources a part names — a colony (×k), the ruling party, the winner's crown, else the law itself. */
function sourcesOfPart(part: ResultsPayoutPart): Array<ResultsTotalSource> {
  const out: Array<ResultsTotalSource> = [];
  // A colony BUILT names its tile on the record itself (the object leads with it) — no second planet in the marks.
  if (part.colony !== undefined && part.kind !== 'colony') {
    out.push(part.multiplier === undefined ? {kind: 'colony', colony: part.colony} : {kind: 'colony', colony: part.colony, times: part.multiplier});
  }
  if (part.party !== undefined) {
    out.push({kind: 'party', party: part.party});
  }
  if (part.winner === true) {
    out.push({kind: 'winner'});
  }
  if (out.length === 0) {
    out.push({kind: 'law'});
  }
  return out;
}

/** One source's identity — a source is listed once per total (and once per seat in the marks row). */
export function totalSourceKey(source: ResultsTotalSource): string {
  switch (source.kind) {
  case 'colony': return `colony:${source.colony}`;
  case 'party': return `party:${source.party}`;
  case 'winner': return 'winner';
  case 'law': return 'law';
  }
}

function addSources(into: Array<ResultsTotalSource>, add: ReadonlyArray<ResultsTotalSource>): void {
  for (const source of add) {
    if (!into.some((s) => totalSourceKey(s) === totalSourceKey(source))) {
      into.push(source);
    }
  }
}

type TotalDraft = ResultsTotal & {sourcesDraft: Array<ResultsTotalSource>, cardsMap?: Map<string, number>, unaddressed?: boolean};

/**
 * THE TOTALS of one seat's parts — a unit stands where it first appeared, the cards thrown away right after the
 * cards drawn, the skips last. Pure. The invariant (spec'd): per unit, the sum of the totals equals the sum of the
 * parts, and every part — a skip included — is counted in exactly one total (`records`).
 */
export function resultsTotalsOf(parts: ReadonlyArray<ResultsPayoutPart>): Array<ResultsTotal> {
  const byKey = new Map<string, TotalDraft>();
  const out: Array<TotalDraft> = [];
  const skips: Array<TotalDraft> = [];
  parts.forEach((part, index) => {
    const merge = totalKeyOf(part);
    if (merge === undefined) {
      const lone: TotalDraft = {
        id: `${part.skipped !== undefined ? 'skip' : 'obj'}:${part.id}`,
        kind: part.skipped !== undefined ? 'skipped' : 'object',
        unit: '',
        family: 'none',
        production: part.production,
        part,
        sources: [],
        sourcesDraft: sourcesOfPart(part),
        records: 1,
      };
      (part.skipped !== undefined ? skips : out).push(lone);
      return;
    }
    let total = byKey.get(merge.key);
    if (total === undefined) {
      total = {
        id: `total:${merge.key}:${index}`,
        kind: merge.kind,
        unit: merge.family === 'cards' ? 'cards' : part.unit,
        ...(part.units === undefined ? {} : {units: part.units}),
        family: merge.family,
        production: part.production,
        amount: 0,
        sources: [],
        sourcesDraft: [],
        records: 0,
      };
      byKey.set(merge.key, total);
      out.push(total);
    }
    total.amount = (total.amount ?? 0) + (part.amount ?? 0);
    total.records += 1;
    addSources(total.sourcesDraft, sourcesOfPart(part));
    if (merge.family === 'cardResource') {
      const map = total.cardsMap ?? (total.cardsMap = new Map());
      const recipients = part.cards ?? (part.card === undefined ? [] : [{card: part.card, amount: part.amount ?? 0}]);
      for (const entry of recipients) {
        map.set(entry.card, (map.get(entry.card) ?? 0) + entry.amount);
      }
      if (recipients.length === 0) {
        total.unaddressed = true;
      }
    }
  });
  // The cards thrown away stand right after the cards drawn (Pluto's pairs read «+3 [card] · ⌫3»).
  const thrownAt = out.findIndex((t) => t.kind === 'discard');
  if (thrownAt >= 0) {
    const [thrown] = out.splice(thrownAt, 1);
    const drawnAt = out.findIndex((t) => t.kind === 'unit' && t.family === 'cards');
    out.splice(drawnAt >= 0 ? drawnAt + 1 : thrownAt, 0, thrown);
  }
  return [...out, ...skips].map((draft) => {
    const total: ResultsTotal = {
      id: draft.id, kind: draft.kind, unit: draft.unit, family: draft.family, production: draft.production,
      sources: draft.sourcesDraft, records: draft.records,
    };
    if (draft.units !== undefined) {
      total.units = draft.units;
    }
    if (draft.amount !== undefined) {
      total.amount = draft.amount;
    }
    if (draft.part !== undefined) {
      total.part = draft.part;
    }
    const map = draft.cardsMap;
    if (map !== undefined && map.size > 0) {
      if (map.size === 1 && draft.unaddressed !== true) {
        total.card = [...map.keys()][0];
      } else {
        total.cards = [...map.entries()].map(([card, amount]) => ({card, amount}));
      }
    }
    return total;
  });
}

/** The marks row of a seat: every total's sources, each once, minus the bare «law» (the whole card is the law's). */
export function seatSourceMarksOf(totals: ReadonlyArray<ResultsTotal>): Array<ResultsTotalSource> {
  const out: Array<ResultsTotalSource> = [];
  for (const total of totals) {
    if (total.kind === 'skipped') {
      continue;
    }
    addSources(out, total.sources.filter((s) => s.kind !== 'law'));
  }
  return out;
}
