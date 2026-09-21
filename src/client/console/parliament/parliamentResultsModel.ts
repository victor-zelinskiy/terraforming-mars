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
import {returningInstances} from './sittingBeats';

/** ONE part of one seat's payout — an object and an amount, or a skip with its reason. */
export type ResultsPayoutPart = {
  id: string;
  /** The record's kind — the component picks the icon family from it. */
  kind: ParliamentEnactOutcomeModel['kind'];
  /** The unit the chip speaks: a resource / card-resource name, `cards`, or '' for a tile. */
  unit: string;
  /** The unit is a PRODUCTION step (the console's production frame), not a stock gain. */
  production: boolean;
  amount?: number;
  /** A winner's tile: which one. */
  tile?: 'ocean' | 'greenery';
  /** The card a card resource landed on. */
  card?: string;
  /** The RULING PARTY's own answer — its emblem stands beside the amount. */
  party?: ReduxParty;
  /** The part paid nothing: WHAT it was and WHY (both English i18n keys). */
  skipped?: {title: string, reason: string};
};

export type ResultsPayout = {
  player: Color;
  parts: ReadonlyArray<ResultsPayoutPart>;
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

/** ② THE TABLE: what changed and has already left the eye. */
export type ResultsTable = {
  fresh: ReadonlyArray<{instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty, stays: boolean}>;
  support: ReadonlyArray<ResultsSupport>;
  /**
   * THE EXCEPTION: seats that enter the NEXT vote with nothing to vote with —
   * an empty lobby with an empty reserve behind it. Usually empty, and then the
   * row does not exist at all; never a list of who CAN vote (that is the
   * delegates ledger's, seat by seat, at the top of the screen).
   */
  noDelegate: ReadonlyArray<Color>;
};

export type ResultsReading = {
  payouts: ReadonlyArray<ResultsPayout>;
  /** NOBODY was paid: the resolution is a passive / an action, and the kicker says which. */
  quiet?: {kicker: string, kind: 'passive' | 'action'};
  table: ResultsTable;
};

/** The unit a record's chip speaks, and whether it is a production step. */
function unitOf(outcome: ParliamentEnactOutcomeModel): {unit: string, production: boolean} {
  if (outcome.production !== undefined) {
    return {unit: String(outcome.production), production: true};
  }
  if (outcome.stock !== undefined) {
    return {unit: String(outcome.stock), production: false};
  }
  if (outcome.resource !== undefined) {
    return {unit: String(outcome.resource), production: false};
  }
  return {unit: outcome.kind === 'cards' ? 'cards' : '', production: false};
}

/** ONE record as a part of its seat's payout — the server's amount, or the skip the address names. */
export function resultsPayoutPart(outcome: ParliamentEnactOutcomeModel, index: number): ResultsPayoutPart {
  const delivery = rewardAddressOf(outcome, outcome.player);
  const {unit, production} = unitOf(outcome);
  const part: ResultsPayoutPart = {
    id: `${outcome.player}:${outcome.step}:${outcome.part ?? ''}:${index}`,
    kind: outcome.kind,
    unit,
    production,
  };
  if (outcome.amount !== undefined) {
    part.amount = outcome.amount;
  }
  if (outcome.kind === 'ocean' || outcome.kind === 'greenery') {
    part.tile = outcome.kind;
  }
  if (outcome.card !== undefined) {
    part.card = outcome.card;
  }
  if (outcome.kind === 'reaction' && outcome.party !== undefined) {
    part.party = outcome.party as ReduxParty;
  }
  if (delivery.skipped !== undefined) {
    part.skipped = {
      title: outcome.kind === 'skipped' ?
        (outcome.part === 'winner' ? 'Reward for the winner of the vote' : 'Resolution effect') :
        REWARD_ADDRESS[outcome.kind].skipTitle,
      reason: delivery.skipped,
    };
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
    const parts = byPlayer.get(outcome.player);
    if (parts !== undefined) {
      parts.push(resultsPayoutPart(outcome, index));
    }
  });
  const payouts = seats.map((seat) => ({player: seat.player, parts: byPlayer.get(seat.player) ?? []}));
  const staying = returningInstances(summary);
  // What the SUPPORT STEP granted, per party — the freshness mark of the row below. Summed, never
  // assigned: one party gets at most one record today, and a reading may not depend on that.
  const gained = new Map<ReduxParty, number>();
  for (const entry of summary.support) {
    gained.set(entry.party, (gained.get(entry.party) ?? 0) + entry.gained);
  }
  const reading: ResultsReading = {
    payouts,
    table: {
      fresh: summary.refreshed.map((f) => ({
        instance: f.instance, resolution: f.resolution, party: f.party, stays: staying.has(f.instance),
      })),
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
  // A resolution that pays NOBODY: the rows would all be empty, so the section says what stands instead.
  if (extras.quiet !== undefined && payouts.every((p) => p.parts.length === 0)) {
    reading.quiet = extras.quiet;
  }
  return reading;
}
