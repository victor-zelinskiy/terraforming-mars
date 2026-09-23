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
  /**
   * The HUD readout the benefit changes — the rail's TR cell, a discount the
   * action sheet prices, a science tag on the tag matrix: a colony bonus the
   * chip language does not speak (`colonyBonus`) commits through the standard
   * delta-chip path of whatever counter it moved, and the ledger row names it.
   */
  | 'hud'
  /**
   * The COLONIES SCREEN — the tile the winner's cube lands on (Colony Contest):
   * the screen stands INSIDE the sitting as its own step (the colonies frame
   * in the stage's zone), and the cube is placed by that screen's build scene.
   */
  | 'colonies'
  | 'stage-plate'; // the sitting's own plate — a skip lives nowhere else

/** WHERE the flight leaves from — the physical source the motion answers «where did this come from». */
export type RewardFlightSource =
  | 'card-icon' // the printed graphic of the carried resolution (`data-graphic-node`)
  | 'party-plaque' // the ruling party's plaque: the law is the party's, not the resolution's
  | 'project-deck' // the project deck pile (`.con-deckstack__pile`)
  /**
   * A ROW OF THE COLONY LEDGER on the stage — the bonus cell of the tile that
   * pays (`[data-colony-row]`): a record that names its `colony` flies from
   * there, never from the resolution's icon (`rewardFlightSourceOf`).
   */
  | 'colony-row'
  /** The player's HAND: a card leaves it for the discard pile — the discard scene's own flight. */
  | 'hand'
  | 'none'; // nothing moves (a skip, a tile the board scene places itself)

/** The unit the chip / counter speaks. */
export type RewardUnit = 'production' | 'stock' | 'card-resource' | 'cards' | 'tile' | 'none';

/** The sitting's stage the outcome is presented on (the flow's stage names — Э3). */
export type RewardStage = 'reward' | 'choice' | 'take' | 'discard' | 'board' | 'colonies';

/** The reading component the stage binds to the record (Э5 binds names to components). */
/**
 * `world-parameter` — a move of the PLANET the enactment made for nobody in
 * particular (Gas Export: oxygen −1, Venus +2, no TR): the parameter line, and
 * the scales on the board that actually show it. It is not the winner's
 * reading: it belongs to no seat, so every viewer reads the same line.
 */
export type RewardReading = 'influence-yield' | 'winner-reward' | 'party-reaction' | 'colony-ledger' | 'world-parameter' | 'skip-plate';

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
  // A CARD THROWN AWAY by a colony bonus's second half (Pluto's «draw 1, then discard 1» — Colonial Affairs):
  // the hand's own discard step, the card leaving the hand for the pile — the ledger's row reads it.
  discard: {
    kind: 'discard', surface: 'hand-dock', source: 'hand', unit: 'cards', stage: 'discard', reading: 'colony-ledger',
    skipTitle: 'Skipped: discard',
  },
  // A COLONY BONUS the chip language does not speak (a card discount, a loss, a science tag, a paid reveal):
  // paid honestly through the standard delta-chip path of the counter it moves; the ledger names the tile's printed bonus.
  colonyBonus: {
    kind: 'colonyBonus', surface: 'hud', source: 'none', unit: 'none', stage: 'reward', reading: 'colony-ledger',
    skipTitle: 'Skipped: colony bonus',
  },
  ocean: {
    kind: 'ocean', surface: 'board', source: 'none', unit: 'tile', stage: 'board', reading: 'winner-reward',
    skipTitle: 'Skipped: the winner\'s ocean',
  },
  greenery: {
    kind: 'greenery', surface: 'board', source: 'none', unit: 'tile', stage: 'board', reading: 'winner-reward',
    skipTitle: 'Skipped: the winner\'s greenery',
  },
  // THE WINNER'S COLONY (Colony Contest): built for free on the colonies screen, hosted as the sitting's own step
  // (`SittingRewardStep 'colony'` — the colonies FRAME in the stage's zone, «КОЛОНИИ»). The cube is placed by that
  // screen's build scene, so nothing flies off the card; the record names the tile (`colony`). A skip names an empty
  // table — no tile the ordinary rules let the winner build on.
  colony: {
    kind: 'colony', surface: 'colonies', source: 'none', unit: 'tile', stage: 'colonies', reading: 'winner-reward',
    skipTitle: 'Skipped: the winner\'s colony',
  },
  // A WORLD MOVE OF A GLOBAL PARAMETER (Gas Export, RX12): the enactment moves the planet for the whole
  // table — nobody is paid and, when the law says so, nobody is credited. Nothing lands in a seat, so there
  // is no rail chip: the sitting YIELDS to the board (the winner-tile grammar), the scale marker makes the
  // step and the frame comes back. The impulse leaves the law's own printed graphic (`card-icon`). A move
  // that cannot happen (the parameter already at the limit it is pushed towards) is NAMED, never silent.
  globalParameter: {
    kind: 'globalParameter', surface: 'board', source: 'card-icon', unit: 'none', stage: 'board', reading: 'world-parameter',
    skipTitle: 'Skipped: the planet does not move',
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
  /** The card the resource landed on (`cardResource`, one recipient). */
  card?: string;
  /** WHERE a `cardResource` landed, card by card — the whole list (one recipient is a list of one). */
  cards?: ReadonlyArray<{card: string; amount: number}>;
  /** The amount actually paid — a skip carries the amount it would have paid, when the record knows it. */
  amount?: number;
  /** The tile's own parameter, before and after (`ocean` / `greenery`). */
  parameter?: {id: string; before: number; after: number};
  /** The answering party (`reaction`). */
  party?: string;
  /** The COLONY whose printed bonus this record pays (Colonial Affairs) — the ledger row it belongs to. */
  colony?: string;
  /** …how many times that bonus was paid in this one record (the resolution's multiplier k). */
  multiplier?: number;
  /** `colonyBonus`: the tile's printed description of the bonus (an English key of the colony's own). */
  description?: string;
};

export type RewardDelivery = {
  address: RewardAddress;
  /**
   * WHERE THIS RECORD'S FLIGHT LEAVES FROM: the address's source, except that a
   * record naming its `colony` is born on its ledger row's bonus cell — the
   * physical place the player read the bonus in (`rewardFlightSourceOf`).
   */
  source: RewardFlightSource;
  /** The record belongs to the viewer: a flight, a plate — else a line about another seat. */
  mine: boolean;
  /** The outcome did NOT pay: the plate's reason (an English key) — a `skipped` record's own, or a zero payout of a paying kind. */
  skipped?: string;
  payload: RewardPayload;
};

/**
 * The flight source of ONE record: a rail chip of a colony-tagged record
 * leaves the LEDGER ROW of that colony (the bonus cell the player read the
 * amount in), every other record its address's source. Pure.
 */
export function rewardFlightSourceOf(outcome: ParliamentEnactOutcomeModel): RewardFlightSource {
  const address = REWARD_ADDRESS[outcome.kind];
  return outcome.colony !== undefined && address.source === 'card-icon' ? 'colony-row' : address.source;
}

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
  // THE LIST IS THE READING: a record that names its cards one by one is
  // read as that list; an older record with one `card` is the list of one.
  if (outcome.cards !== undefined && outcome.cards.length > 0) {
    payload.cards = outcome.cards.map((entry) => ({card: entry.card, amount: entry.amount}));
  } else if (outcome.card !== undefined && (outcome.amount ?? 0) > 0) {
    payload.cards = [{card: outcome.card, amount: outcome.amount ?? 0}];
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
  if (outcome.colony !== undefined) {
    payload.colony = outcome.colony;
  }
  if (outcome.multiplier !== undefined) {
    payload.multiplier = outcome.multiplier;
  }
  if (outcome.description !== undefined) {
    payload.description = outcome.description;
  }
  // A WORLD RECORD belongs to NO seat (`player` absent) and therefore to every
  // viewer: the planet moved for all of them, and the reading is the same one.
  const world = outcome.player === undefined;
  const delivery: RewardDelivery = {
    address,
    source: rewardFlightSourceOf(outcome),
    mine: viewer !== undefined && (world || outcome.player === viewer),
    payload,
  };
  if (outcome.kind === 'skipped') {
    delivery.skipped = outcome.reason ?? address.skipTitle;
  } else if (outcome.kind === 'globalParameter') {
    // The steps actually made are the record's `amount` (negative LOWERS): a
    // move that made none is a skip, and its own reason names why.
    if ((outcome.amount ?? 0) === 0) {
      delivery.skipped = outcome.reason ?? address.skipTitle;
    }
  } else if (outcome.kind === 'colonyBonus') {
    // A HUD-side colony bonus pays its own counter: a LOSS (Titania) is a negative amount and still a payout —
    // only a bonus that came to nothing at all (0) is a skip.
    if ((outcome.amount ?? 0) === 0) {
      delivery.skipped = address.skipTitle;
    }
  } else if (address.unit !== 'tile' && address.unit !== 'none' && (outcome.amount ?? 0) <= 0) {
    // A paying kind that paid nothing is a skip the record did not name — the address names it.
    delivery.skipped = address.skipTitle;
  }
  return delivery;
}

/*
 * ── FUTURE KINDS — how to add one (final polish D.3) ─────────────────────────────────────────────
 * The table refuses an address without a payer, so none of these rows exists yet; the first card of a
 * kind adds the row TOGETHER with its payer, on this sketch (surface · source · unit · stage · reading ·
 * skip plate · the gallery pose it brings):
 *   · `stockLoss` (a budget: «every player loses N …») — surface `rail`, source `carrier` (the chip flies
 *     the WAVE BACKWARDS, rail → the card's icon), unit `stock`, stage `reward`, reading `influence-yield`
 *     with a loss tone (struck amount, amber), skip «ПРОПУЩЕНО · нечего терять»; pose: the reading with a
 *     minus and the rail's counter ticking DOWN on touchdown.
 *   · (`globalParameter` SHIPPED — Gas Export, RX12: surface `board`, source `card-icon`, unit `none`,
 *     stage `board`, reading `world-parameter`; the frame yields to the board like a winner tile and the
 *     board-beat park plays the scale story. The record belongs to NO seat — every viewer reads it.)
 *   · `agendaStepAll` (every player advances one Agenda step) — surface `agenda`, source `carrier`, unit
 *     `none`, stage `reward`, reading a marker line per seat («Повестка 2 → 3»), never skipped (the track's
 *     end is «уже в конце трека», a line, not a plate); pose: every marker glides on the rail at once.
 *   · `colonyTrack` (a colony's track marker moves) — surface `colonies`, source `carrier`, unit `none`,
 *     stage `reward` (the colonies screen is NOT opened — the reading names the colony and the step), skip
 *     «нет колонии в игре»; pose: a colony chip with its track step, the reward stays on the sitting.
 *   · (`colonyToWinner` SHIPPED as `colony` — Colony Contest, RX09: surface `colonies`, unit `tile`, stage
 *     `colonies`; the colonies SCREEN is the sitting's hosted step rather than a picker in the task host.)
 *   · `cityEveryone` (each player places a city) — surface `board`, source `carrier`, unit `tile`, stage
 *     `board` per seat IN TURN (the sitting yields to the board and comes back, the other seats wait —
 *     the winner-tile route generalized to every seat), skip «нет клетки под город»; pose: the board
 *     placement per seat, then the received line «Город · размещён».
 *   · `drawUpTo` («добор до N карт») — surface `hand`, source `deck`, unit `cards`, stage `take` (the
 *     embedded intake), reading `influence-yield` with the count RESOLVED by the record (never the formula's
 *     N — a hand of N takes nothing: a skip «рука уже полна», not a zero); pose: the intake with 0…N cards.
 * Every row keeps the laws above: the record pays, the address only says where; a skip names itself.
 */
