/*
 * THE REWARD ADDRESS TABLE (Turmoil Redux — the parliament sitting, plan §4).
 *
 * Every outcome an enacted resolution records (`ParliamentEnactOutcomeModel
 * .kind`) has exactly ONE address: where the player SEES it land, where its
 * flight leaves from, what unit the chip speaks, which stage of the sitting
 * hosts it and how a skip of it is named. The sitting director (Э4/Э5) knows
 * ADDRESSES, never resolutions; the resolution author declares outcomes,
 * never presentation; the contract guard (`ResolutionContract.spec`) refuses
 * a `report()` whose kind has no row here.
 *
 * `REWARD_ADDRESS` is a `Record` over the whole `kind` union: a new kind that
 * has no row does not compile, which is the point — a future mechanism of the
 * catalog («−10 M€», «lose all plants but N», «Agenda +1 for everyone», «all
 * colony tracks +2») gets its row (and its kind) BEFORE the first resolution
 * that pays it (`docs/claude/parliament-resolution-checklist.md` § addresses).
 * The kinds expected then — `stockLoss` (the same wave BACK into the source),
 * `agenda`, `colonyTrack`, `tr`, `partyAccessGrant` — are deliberately NOT in
 * the union yet: an address without a payer is a promise nobody keeps.
 *
 * Shared by the server (the guard) and the client (the director, the stage);
 * pure — no DOM, no Vue, no i18n calls (the keys are English text, as
 * everywhere).
 */
import {ParliamentEnactOutcomeModel} from '../models/ParliamentModel';
import {Color} from '../Color';

export type OutcomeKind = ParliamentEnactOutcomeModel['kind'];

/** WHERE the player sees the result land — and finds it afterwards. */
export type RewardSurface =
  | 'rail' // the resource rail on the left (a production chip / a stock number)
  | 'tableau-card' // a card of the player's tableau (a card resource)
  | 'hand-dock' // the hand dock at the bottom (cards)
  | 'board' // the planet (a tile) + the parameter HUD + TR
  | 'stage-plate'; // the sitting's own plate — a skip lives nowhere else

/** WHERE the flight leaves from — the physical source the motion answers «where did this come from». */
export type RewardFlightSource =
  | 'card-icon' // the printed graphic of the carried resolution (`data-graphic-node`)
  | 'party-plaque' // the ruling party's plaque: the law is the party's, not the resolution's
  | 'project-deck' // the project deck pile (`.con-deckstack__pile`)
  | 'none'; // nothing moves (a skip, a tile the board scene places itself)

/** The unit the chip / counter speaks. */
export type RewardUnit = 'production' | 'stock' | 'card-resource' | 'cards' | 'tile' | 'none';

/** The sitting's stage the outcome is presented on (the flow's stage names — Э3). */
export type RewardStage = 'reward' | 'choice' | 'take' | 'board';

/** The reading component the stage binds to the record (Э5 binds names to components). */
export type RewardReading = 'influence-yield' | 'winner-reward' | 'party-reaction' | 'skip-plate';

export type RewardAddress = {
  kind: OutcomeKind;
  surface: RewardSurface;
  source: RewardFlightSource;
  unit: RewardUnit;
  stage: RewardStage;
  reading: RewardReading;
  /** The kind's own skip plate title (an English key); a `skipped` record names its reason itself. */
  skipTitle: string;
};

export const REWARD_ADDRESS: Readonly<Record<OutcomeKind, RewardAddress>> = {
  production: {
    kind: 'production', surface: 'rail', source: 'card-icon', unit: 'production', stage: 'reward', reading: 'influence-yield',
    skipTitle: 'Skipped: production',
  },
  stock: {
    kind: 'stock', surface: 'rail', source: 'card-icon', unit: 'stock', stage: 'reward', reading: 'influence-yield',
    skipTitle: 'Skipped: resources',
  },
  cardResource: {
    kind: 'cardResource', surface: 'tableau-card', source: 'card-icon', unit: 'card-resource', stage: 'choice', reading: 'influence-yield',
    skipTitle: 'Skipped: resources on a card',
  },
  cards: {
    kind: 'cards', surface: 'hand-dock', source: 'project-deck', unit: 'cards', stage: 'take', reading: 'influence-yield',
    skipTitle: 'Skipped: cards',
  },
  ocean: {
    kind: 'ocean', surface: 'board', source: 'none', unit: 'tile', stage: 'board', reading: 'winner-reward',
    skipTitle: 'Skipped: the winner\'s ocean',
  },
  greenery: {
    kind: 'greenery', surface: 'board', source: 'none', unit: 'tile', stage: 'board', reading: 'winner-reward',
    skipTitle: 'Skipped: the winner\'s greenery',
  },
  // The ruling party's answer speaks the unit its RECORD carries (a production step is answered with production); 'stock' is the nominal default.
  reaction: {
    kind: 'reaction', surface: 'rail', source: 'party-plaque', unit: 'stock', stage: 'reward', reading: 'party-reaction',
    skipTitle: 'Skipped: the ruling party\'s answer',
  },
  skipped: {
    kind: 'skipped', surface: 'stage-plate', source: 'none', unit: 'none', stage: 'reward', reading: 'skip-plate',
    skipTitle: 'Skipped',
  },
};

export const OUTCOME_KINDS: ReadonlyArray<OutcomeKind> = Object.keys(REWARD_ADDRESS) as Array<OutcomeKind>;

/** What the outcome DELIVERS at its address — the chip's payload, resolved from the record (never recomputed). */
export type RewardPayload = {
  /** The standard resource (production / stock / a reaction) or the card resource (onto a card). */
  resource?: string;
  /** The card the resource landed on (`cardResource`). */
  card?: string;
  /** The amount actually paid — a skip carries the amount it would have paid, when the record knows it. */
  amount?: number;
  /** The tile's own parameter, before and after (`ocean` / `greenery`). */
  parameter?: {id: string; before: number; after: number};
  /** The answering party (`reaction`). */
  party?: string;
};

export type RewardDelivery = {
  address: RewardAddress;
  /** The record belongs to the viewer: a flight, a plate — else a line about another seat. */
  mine: boolean;
  /** The outcome did NOT pay: the plate's reason (an English key) — a `skipped` record's own, or a zero payout of a paying kind. */
  skipped?: string;
  payload: RewardPayload;
};

/**
 * The delivery of ONE record for ONE viewer. Pure: reads the record, decides
 * nothing about the game; the director turns it into motion.
 */
export function rewardAddressOf(outcome: ParliamentEnactOutcomeModel, viewer: Color | undefined): RewardDelivery {
  const address = REWARD_ADDRESS[outcome.kind];
  const payload: RewardPayload = {};
  const resource = outcome.production ?? outcome.stock ?? outcome.resource;
  if (resource !== undefined) {
    payload.resource = String(resource);
  }
  if (outcome.card !== undefined) {
    payload.card = outcome.card;
  }
  if (outcome.amount !== undefined) {
    payload.amount = outcome.amount;
  }
  if (outcome.parameter !== undefined) {
    payload.parameter = {id: outcome.parameter.id, before: outcome.parameter.before, after: outcome.parameter.after};
  }
  if (outcome.party !== undefined) {
    payload.party = outcome.party;
  }
  const delivery: RewardDelivery = {address, mine: viewer !== undefined && outcome.player === viewer, payload};
  if (outcome.kind === 'skipped') {
    delivery.skipped = outcome.reason ?? address.skipTitle;
  } else if (address.unit !== 'tile' && address.unit !== 'none' && (outcome.amount ?? 0) <= 0) {
    // A paying kind that paid nothing is a skip the record did not name — the address names it.
    delivery.skipped = address.skipTitle;
  }
  return delivery;
}
