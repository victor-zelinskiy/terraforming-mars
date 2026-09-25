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
 *    THE RULING PARTY IS NOT IN THAT ROW: a party that rules by an enacted card
 *    holds exactly zero support by construction (the proof is in
 *    `ConsolePartyPlaque.vue`, which hides the sockets on the ruler's own tile
 *    for the same reason), and its place is read in the government's zone.
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
  /** The card a card resource landed on (one recipient). */
  card?: string;
  /**
   * WHERE a card resource landed, card by card — printed when it was SPREAD
   * over several (a distribution): the row then names each recipient with
   * its own share beside the sum; one recipient prints the sum alone.
   */
  cards?: ReadonlyArray<{card: string, amount: number, resource?: string}>;
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
};

export type ResultsPayout = {
  player: Color;
  parts: ReadonlyArray<ResultsPayoutPart>;
  /**
   * THE NET of the seat's own SUPPLY parts in one unit — a budget's «−10 → +7 = −3»: read only where the
   * law both TOOK and PAID the same resource (the resolution's own parts, never the ruling party's answer),
   * so the row says the day's balance the chips could not.
   */
  net?: {unit: string, amount: number};
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

export type ResultsReading = {
  payouts: ReadonlyArray<ResultsPayout>;
  /** NOBODY was paid: the resolution is a passive / an action, and the kicker says which. */
  quiet?: {kicker: string, kind: 'passive' | 'action'};
  /** The WORLD's own part, when the enactment had one — never a seat's row. */
  planet?: ReadonlyArray<ResultsPlanetMove>;
  table: ResultsTable;
};

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
  if (outcome.kind === 'globalParameter' && outcome.parameter !== undefined) {
    part.parameter = {id: outcome.parameter.id, before: outcome.parameter.before, after: outcome.parameter.after};
    if (outcome.tr !== undefined) {
      part.tr = outcome.tr;
    }
  }
  if (outcome.card !== undefined) {
    part.card = outcome.card;
  }
  if (delivery.payload.cards !== undefined && delivery.payload.cards.length > 1) {
    // Each recipient keeps the kind ITS card took — printed beside its share where the kinds differ.
    part.cards = delivery.payload.cards.map((entry) => ({card: entry.card, amount: entry.amount, ...(entry.resource === undefined ? {} : {resource: entry.resource})}));
  }
  if (outcome.kind === 'reaction' && outcome.party !== undefined) {
    part.party = outcome.party as ReduxParty;
  }
  if (outcome.colony !== undefined) {
    part.colony = outcome.colony;
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
 * THE NET of a seat's own SUPPLY parts in ONE unit — present only where the law both TOOK (a levy: a negative
 * `stock` part) and PAID that unit into the supply (a positive `stock` part of the resolution's own, never a
 * reaction, never a skip): the balance the row states beside the parts. A seat that was levied and paid
 * nothing in that unit (a named skip) nets the levy alone.
 */
export function netOfParts(parts: ReadonlyArray<ResultsPayoutPart>): {unit: string, amount: number} | undefined {
  const supply = parts.filter((part) => part.kind === 'stock' && !part.production && part.skipped === undefined && part.amount !== undefined);
  const loss = supply.find((part) => (part.amount ?? 0) < 0);
  if (loss === undefined) {
    return undefined;
  }
  const same = supply.filter((part) => part.unit === loss.unit);
  return {unit: loss.unit, amount: same.reduce((sum, part) => sum + (part.amount ?? 0), 0)};
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
export function resultsReadingOf(
  summary: ParliamentPhaseSummaryModel,
  seats: ReadonlyArray<ResultsSeat>,
  support: ReadonlyArray<{party: ReduxParty, support: number}>,
  extras: {quiet?: {kicker: string, kind: 'passive' | 'action'}} = {},
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
  const payouts = seats.map((seat): ResultsPayout => {
    const parts = byPlayer.get(seat.player) ?? [];
    const payout: ResultsPayout = {player: seat.player, parts};
    const net = netOfParts(parts);
    if (net !== undefined) {
      payout.net = net;
    }
    return payout;
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
      // The party that rules by the enacted card is left out: its stock is zero by construction and its
      // plaque stands in the government's zone, two hand-spans away from this row.
      support: support.filter((entry) => entry.party !== summary.enacted.party).map((entry) => ({
        party: entry.party,
        total: entry.support,
        fresh: Math.max(0, Math.min(entry.support, gained.get(entry.party) ?? 0)),
      })),
      // Read from the LIVE seats, after the lobby step: «what will this seat have when the next vote
      // opens» is a state, never the step's own record — `lobbyRefilled` names whose lobby was EMPTY
      // and got filled, which says nothing about a seat that still holds last generation's delegate.
      noDelegate: seats.filter((seat) => !seat.lobby && seat.reserve <= 0).map((seat) => seat.player),
    },
  };
  const planet = resultsPlanetMoves(summary);
  if (planet.length > 0) {
    reading.planet = planet;
  }
  // A resolution that pays NOBODY: the rows would all be empty, so the section says what stands instead.
  // A law that MOVED THE WORLD is not «quiet» — the planet line is its reading.
  if (extras.quiet !== undefined && planet.length === 0 && payouts.every((p) => p.parts.length === 0)) {
    reading.quiet = extras.quiet;
  }
  return reading;
}
