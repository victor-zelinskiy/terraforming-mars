/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ПАНЕЛЬ ИТОГОВ («Заседание v5» §4) — the pure reading of the sitting's last
 * surface, and the ONE place that decides what belongs on it.
 *
 * THE RULE THAT SHAPES IT: the panel shows only what is NOWHERE ELSE on the
 * screen. The generation's number is in the band above it, the voting area is
 * the voting area, the enacted card stands in the government printing its own
 * effect, the party that rules by it is the plaque in the ruler's slot and the
 * chairman's new quest is the block under them — none of that is repeated
 * here. A LAW section once headed the panel and said those three ONE MORE
 * TIME, poorer than the zone standing beside it (no quest progress, no reward,
 * no chair); it is gone. TWO sections, and nothing beside them:
 *
 *  ① ВЫПЛАТЫ — a row per seat: what each of them actually got. This is the
 *    panel's main content, because a seat saw its OWN reward as chips flying
 *    to its rail and has never been shown anybody else's. A skip names itself
 *    with its reason, exactly as on the reward beat — never a silent loss.
 *    In a solo game it collapses to the one row.
 *  ② СТОЛ — what changed and is already out of sight: the new resolutions with
 *    their parties, the POPULAR SUPPORT STOCK per party after the deal, and
 *    who got a delegate back into the lobby.
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
  lobby: ReadonlyArray<Color>;
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
 * THE READING. `seats` is the order the panel prints (the parliament model's own
 * seat order — the one key the seats zone above already shows); `support` is the
 * LIVE stock per party, read AFTER the deal (the deal turns a party's whole
 * stock into votes on its fresh card, so the summary's own `total` — written one
 * step earlier — is not what stands on the table); `quiet` is the pose of a
 * resolution that pays nobody, and it replaces the rows rather than printing an
 * empty one per seat.
 */
export function resultsReadingOf(
  summary: ParliamentPhaseSummaryModel,
  seats: ReadonlyArray<Color>,
  support: ReadonlyArray<{party: ReduxParty, support: number}>,
  extras: {quiet?: {kicker: string, kind: 'passive' | 'action'}} = {},
): ResultsReading {
  const byPlayer = new Map<Color, Array<ResultsPayoutPart>>();
  for (const seat of seats) {
    byPlayer.set(seat, []);
  }
  (summary.outcomes ?? []).forEach((outcome, index) => {
    const parts = byPlayer.get(outcome.player);
    if (parts !== undefined) {
      parts.push(resultsPayoutPart(outcome, index));
    }
  });
  const payouts = seats.map((player) => ({player, parts: byPlayer.get(player) ?? []}));
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
      lobby: summary.lobbyRefilled,
    },
  };
  // A resolution that pays NOBODY: the rows would all be empty, so the section says what stands instead.
  if (extras.quiet !== undefined && payouts.every((p) => p.parts.length === 0)) {
    reading.quiet = extras.quiet;
  }
  return reading;
}
