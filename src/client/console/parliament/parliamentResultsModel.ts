/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ПАНЕЛЬ ИТОГОВ («Заседание v5» §4) — the pure reading of the sitting's last
 * surface, and the ONE place that decides what belongs on it.
 *
 * THE RULE THAT SHAPES IT: the panel shows only what is NOWHERE ELSE on the
 * screen. The generation's number is in the band above it, the voting area is
 * the voting area, the enacted card stands in the government printing its own
 * effect — none of that is repeated here. Three sections, and nothing beside
 * them:
 *
 *  ① ЗАКОН — the enacted resolution, the party that rules by it and the
 *    chairman's new quest. One line with icons: the heading of the results.
 *  ② ВЫПЛАТЫ — a row per seat: what each of them actually got. This is the
 *    panel's main content, because a seat saw its OWN reward as chips flying
 *    to its rail and has never been shown anybody else's. A skip names itself
 *    with its reason, exactly as on the reward beat — never a silent loss.
 *    In a solo game it collapses to the one row.
 *  ③ СТОЛ — what changed and is already out of sight: the new resolutions with
 *    their parties, the popular support per party after the deal, and who got
 *    a delegate back into the lobby.
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

/** ① THE LAW: what now stands, who rules by it, and the quest the chairman is set. */
export type ResultsLaw = {
  resolution: ResolutionId;
  party: ReduxParty;
  /** The chairman's quest for the generation that begins (absent in the final phase / without a quest). */
  quest?: {text: string, generation: number};
  /** The seat holding the chairmanship, when there is one. */
  chairman?: Color;
};

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

/** ③ THE TABLE: what changed and has already left the eye. */
export type ResultsTable = {
  fresh: ReadonlyArray<{instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty, stays: boolean}>;
  support: ReadonlyArray<{party: ReduxParty, total: number}>;
  lobby: ReadonlyArray<Color>;
};

export type ResultsReading = {
  law: ResultsLaw;
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
 * seat order — the one key the seats zone above already shows); `quiet` is the
 * pose of a resolution that pays nobody, and it replaces the rows rather than
 * printing an empty one per seat.
 */
export function resultsReadingOf(
  summary: ParliamentPhaseSummaryModel,
  seats: ReadonlyArray<Color>,
  support: ReadonlyArray<{party: ReduxParty, support: number}>,
  extras: {quest?: {text: string, generation: number}, chairman?: Color, quiet?: {kicker: string, kind: 'passive' | 'action'}} = {},
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
  const reading: ResultsReading = {
    law: {
      resolution: summary.enacted.resolution,
      party: summary.enacted.party,
      ...(extras.quest === undefined ? {} : {quest: extras.quest}),
      ...(extras.chairman === undefined ? {} : {chairman: extras.chairman}),
    },
    payouts,
    table: {
      fresh: summary.refreshed.map((f) => ({
        instance: f.instance, resolution: f.resolution, party: f.party, stays: staying.has(f.instance),
      })),
      support: support.map((entry) => ({party: entry.party, total: entry.support})),
      lobby: summary.lobbyRefilled,
    },
  };
  // A resolution that pays NOBODY: the rows would all be empty, so the section says what stands instead.
  if (extras.quiet !== undefined && payouts.every((p) => p.parts.length === 0)) {
    reading.quiet = extras.quiet;
  }
  return reading;
}
