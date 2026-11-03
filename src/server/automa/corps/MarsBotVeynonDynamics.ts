import {Tag} from '../../../common/cards/Tag';
import {ColonyName} from '../../../common/colonies/ColonyName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {shippingAreaFor} from '../../../common/automa/ShippingBoardData';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IColony} from '../../colonies/IColony';
import {AutomaColonies} from '../AutomaColonies';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {pileTagCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF2_VEYNON_DYNAMICS);

/**
 * The tags that put a mech on the card — the outer system's haulers: Jovian and space. Venus is measured OUT (with
 * Venus Next it brought the third hull a generation early and the corporation to 113 VP — the strongest by 5).
 */
export const VEYNON_MECH_TAGS: ReadonlySet<Tag> = new Set([Tag.JOVIAN, Tag.SPACE]);
/** Mechs one new trade fleet costs — the balance knob (docs/AUTOMA_DATA_AUDIT.md §20). */
export const VEYNON_MECHS_PER_FLEET = 3;
/** «… and a mech resource on this card» — the human card's starting mech, the first part of the second hull. */
export const VEYNON_STARTING_MECHS = 1;
/** The fleet cap under this corporation — B19, B20 and its own BC2. */
export const VEYNON_MAX_FLEETS = 3;
/** What one mech of cargo adds to a trade's storage area once every fleet is afloat. */
export const VEYNON_CARGO = 1;

/** A storage area's distance to its next exchange (5 → a track step) — BC2's route; a colony with no area ranks last. */
const EXCHANGE = 5;

/**
 * MarsBot Veynon Dynamics — CF2, the FORK'S OWN bot card (the owner, 2026-11-03): no official MarsBot card exists
 * for the Turmoil Redux corporation TR85. «Mechs in the Hold» — the owner chose it over a convoy and a walker, with
 * three conditions: the fleets the bot trades with are REAL (the table counts them), at most 3; a card of its own;
 * a rhythm of one trade in the first two generations and usually two or three after.
 *
 *   STARTING TAGS        Jovian, Venus — Colonies only
 *   SETUP                MarsBot's first trade fleet sails from the first generation (Shipping Lines joins now),
 *                        and a mech starts on this card.
 *   EFFECT               Each Jovian or space tag MarsBot resolves puts a mech on this card. 3 mechs here
 *                        assemble a new trade fleet — up to 3 fleets: the second sails as Extended Shipping Lines,
 *                        the third as Veynon Run (BC2). With all 3 afloat, each trade spends a mech here to bring
 *                        one more resource to that storage area.
 *   BC2 VEYNON RUN       The third fleet trades with the colony whose storage area is closest to its next exchange
 *                        (5 → a track step); the most-advanced track breaks ties, as for Shipping Lines.
 *
 * THE LORE IS THE RULE: «Veynons "vessels" come with articulating limbs and ground movement tracks, and can change
 * shape to fit narrow hangars» — the corporation BUILDS its hulls out of the mechs it gathers, and routes them by
 * logistics, not by the brightest track.
 *
 * THE BALANCE (measured 2026-11-03 — 30 seeded 8-generation games per variant, the human passing; §20): mechs from
 * Jovian and space tags, 3 a hull, a starting mech, a cargo of 1 → Colonies only 92.8 VP (C38 92.7 · C42 94.6),
 * with Venus + Prelude 107.0 (C42 107.8). Trades a generation: 0–1 in the first, ≈1.3 in the second, 2 in the third
 * and fourth (sometimes 1 or 3), mostly 3 from the fifth. Venus tags pushed it to 113, a cargo of 2 to 111.
 *
 * A FLEET IS A FLEET. `AutomaColonies.gainTradeFleet` grows the bot's player `fleetSize` (the colonies' fleet bar
 * reads it) and arms the fleet's trade card from the next generation — the power track's #9 takes the same road, so
 * the two can never disagree; the cap is this corporation's `maxTradeFleets`.
 */
export const MarsBotVeynonDynamics: MarsBotCorp = {
  info: INFO,
  maxTradeFleets: VEYNON_MAX_FLEETS,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF2_VEYNON_DYNAMICS).rates;
    return dividendResult([
      perUnitTerm('Colony trades of MarsBot', game.automa?.trades ?? 0, r.each),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return pileTagCount(game, [Tag.EARTH]);
  },

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    // «The first fleet sails from the first generation» — Shipping Lines leaves the set-aside pile for the recurring
    // pool now (it would join from generation 2), and takes its place in the generation-1 deck at a seeded index.
    const aside = automa.setAsideBonusCards.indexOf(BonusCardId.B19_SHIPPING_LINES);
    if (aside !== -1) {
      automa.setAsideBonusCards.splice(aside, 1);
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B19_SHIPPING_LINES)) {
      automa.recurringBonusCards.push(BonusCardId.B19_SHIPPING_LINES);
    }
    if (!automa.actionDeck.some((e) => e.kind === 'bonus' && e.id === BonusCardId.B19_SHIPPING_LINES)) {
      automa.actionDeck.splice(game.rng.nextInt(automa.actionDeck.length + 1), 0, {kind: 'bonus', id: BonusCardId.B19_SHIPPING_LINES});
    }
    game.log('${0} launched its first trade fleet: it sails from the first generation', (b) => b.player(marsBotOf(game)));
    // «… and a mech resource on this card» — the human card's own starting mech.
    automa.corpResources += VEYNON_STARTING_MECHS;
    bumpCorpStat(game, 'veynonMechs', VEYNON_STARTING_MECHS);
  },

  onTagResolved(game: IGame, tag: Tag): void {
    if (!VEYNON_MECH_TAGS.has(tag)) {
      return;
    }
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    automa.corpResources++;
    bumpCorpStat(game, 'veynonMechs');
    assembleFleets(game);
  },

  onTradeFleetGained(game: IGame, fleets: number): void {
    const automa = game.automa;
    if (automa === undefined || fleets < VEYNON_MAX_FLEETS) {
      return;
    }
    // The third fleet's trade card: recurring from the next generation (the fleet sails from its next deck).
    if (!automa.recurringBonusCards.includes(BonusCardId.BC2_VEYNON_RUN)) {
      automa.recurringBonusCards.push(BonusCardId.BC2_VEYNON_RUN);
    }
  },

  onBotTrade(game: IGame, colony: ColonyName): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    bumpCorpStat(game, 'veynonTrades');
    if (automa.corpResources < 1) {
      return;
    }
    // Cargo only once the hulls are all built — before that, every mech is a part of the next ship.
    if (AutomaColonies.botFleetCount(game) < VEYNON_MAX_FLEETS) {
      return;
    }
    // Europa stores nothing (its trade pays TR), Titan's «area» is the floater pool, a tile with no area has no
    // hold to fill — the mech stays.
    if (colony === ColonyName.EUROPA || colony === ColonyName.TITAN || shippingAreaFor(colony) === undefined) {
      return;
    }
    automa.corpResources--;
    bumpCorpStat(game, 'veynonCargo');
    const tile = game.colonies.find((c) => c.name === colony);
    if (tile !== undefined) {
      game.log('${0} unloaded a mech\'s cargo at ${1}', (b) => b.player(marsBotOf(game)).colony(tile));
    }
    AutomaColonies.addToStorage(game, colony, VEYNON_CARGO);
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC2_VEYNON_RUN) {
      throw new Error(`MarsBot Veynon Dynamics does not own bonus card ${id}`);
    }
    bumpCorpStat(game, 'veynonRuns');
    const traded = AutomaColonies.botTrade(game, {rank: (colony) => exchangeReadiness(game, colony)});
    AutomaTurnLog.setBonusBranch(game, traded ?
      {key: 'Sailed to the storage area closest to its exchange'} :
      {key: 'No colony left to trade with'});
    return 'discard'; // Recurring: `routeBonusCard` keeps it in the holding pool.
  },
};

/**
 * Mechs → hulls: every 3 mechs on the card become a trade fleet while the cap allows. A loop — one tag can never
 * complete two hulls, but a save from before the threshold changed could hold more than 3.
 */
function assembleFleets(game: IGame): void {
  const automa = game.automa;
  if (automa === undefined) {
    return;
  }
  while (automa.corpResources >= VEYNON_MECHS_PER_FLEET && AutomaColonies.botFleetCount(game) < VEYNON_MAX_FLEETS) {
    automa.corpResources -= VEYNON_MECHS_PER_FLEET;
    if (!AutomaColonies.gainTradeFleet(game)) {
      automa.corpResources += VEYNON_MECHS_PER_FLEET;
      return;
    }
    bumpCorpStat(game, 'veynonFleets');
    game.log('${0} assembled a new trade fleet from ${1} mechs', (b) => b.player(marsBotOf(game)).number(VEYNON_MECHS_PER_FLEET));
  }
}

/** BC2's route — how close a colony's storage area is to its next exchange (4 of 5 is closest); no area ranks last. */
function exchangeReadiness(game: IGame, colony: IColony): number {
  if (colony.name === ColonyName.EUROPA || colony.name === ColonyName.TITAN || shippingAreaFor(colony.name) === undefined) {
    return -1;
  }
  return (game.automa?.shippingStorage[colony.name] ?? 0) % EXCHANGE;
}
