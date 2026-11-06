import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {SpaceType} from '../../../common/boards/SpaceType';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {AutomaAres} from '../AutomaAres';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {divertBotTerraforming} from '../BotDivertedTerraforming';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {botGreenerySpaces, isBotTile, oceanNeighbours, pileTagCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF3_POLDERTECH_DUTCH);

/** The owner's cap (2026-11-03: «пусть карта сжигается после 3-го озеленения на океане, чтобы было умеренно»). */
export const POLDERS_BEFORE_BURN = 3;
/** BC3's printed price — the dikes (the balance knob, docs/AUTOMA_DATA_AUDIT.md §20). */
export const DIKE_COST = 10;
/** «Wind» and «land» — what one ocean / one greenery of the bot pays it. */
export const POLDER_TILE_MC = 1;

/**
 * Nested pushes in flight (an ocean / greenery on a track space pushes a track whose space lays the next tile…) —
 * the depth the shared runaway guard reads, kept in the MODULE (the C22 / CF1 law).
 */


/**
 * MarsBot PolderTECH Dutch — CF3, the FORK'S OWN bot card (the owner, 2026-11-03) for the promo corporation X-3.
 * «The Polder» — the owner chose it over a plain wind-water-land card, with one condition: the reclamation card
 * burns after its third polder, «to keep it moderate».
 *
 *   STARTING TAG         Earth
 *   SETUP                MarsBot places an ocean and a greenery next to it, ignoring the greenery placement rules
 *                        (the human card's first action).
 *   EFFECT               Wind and land: each ocean and each greenery MarsBot places pays it 1 M€ (the human card's
 *                        «ocean → energy, greenery → plant», in the bot's currency).
 *   BEFORE ACTION PHASE  Add Inpoldering (BC3) to MarsBot's action deck.
 *
 *   BC3 INPOLDERING      MarsBot pays 10 M€ for the dikes, if able (else nothing). Then it drains a space reserved
 *                        for an ocean and places a greenery there — a polder;
 *                        beside its own tiles if it can, never a space the remaining oceans need. Nothing to drain:
 *                        an ocean instead. Recurs every generation; destroyed after the third polder.
 *
 * THE LORE IS THE RULE: «A new planet rises thanks to wind, water and land.» — the Dutch win land from the sea, and
 * so does this bot: its greeneries stand on BLUE cells, and every one it takes is an ocean space the table loses.
 *
 * THE BALANCE (measured 2026-11-03, 30 seeded 8-generation games, the human passing — §20): the effect as TRACK
 * pushes (my first proposal) fed itself — the plant track lays greeneries, every greenery pushed it again: 140 VP,
 * once a generation still 119, wind alone 107. Even with NO effect the setup and three free polders made 98.6 (C42's
 * 98.2). Final: 1 M€ a tile and 10 M€ a polder → 95.9 VP (CF1 96.4 · C38 94.5); with Venus + Colonies + Prelude
 * 105.5 (C42 107.8). The owner's cap of three polders holds in every game.
 *
 * THE NINE OCEANS ARE SACRED. A drained cell can never hold an ocean again (a tiled cell leaves the ocean list), so
 * a polder is laid only while the free ocean spaces stay ABOVE the oceans still to place — the game can always end.
 * The tile is an ordinary greenery (TR, oxygen, adjacency, covered icons pay the bot's M€) seated through the shared
 * settle (`placeAndSettle`) — ocean counting is by TILE, so nothing else in the engine reads it as water.
 */
export const MarsBotPolderTechDutch: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF3_POLDERTECH_DUTCH).rates;
    const dikes = botGreenerySpaces(game).filter((space) => oceanNeighbours(game, space) > 0).length;
    return dividendResult([
      perUnitTerm('MarsBot greeneries next to an ocean', dikes, r.each),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return pileTagCount(game, [Tag.BUILDING]);
  },

  setup(game: IGame): void {
    const oceansBefore = new Set(game.board.getOceanSpaces().map((s) => s.id));
    AutomaTilePlacer.placeOcean(game);
    const ocean = game.board.getOceanSpaces().find((s) => !oceansBefore.has(s.id));
    // «… and a greenery next to it, ignoring the greenery placement rules» — any empty land beside the new ocean;
    // with no ocean (a law took it), the greenery is the law's too — nothing to place beside nothing.
    if (ocean === undefined) {
      return;
    }
    const beside = new Set(game.board.getAdjacentSpaces(ocean).map((s) => s.id));
    const bot = marsBotOf(game);
    const candidates = AutomaAres.withoutHazardSpaces(game, game.board.getAvailableSpacesOnLand(bot))
      .filter((space) => beside.has(space.id) && space.tile === undefined);
    if (candidates.length === 0) {
      return;
    }
    if (divertBotTerraforming(game, {kind: 'tile', tile: 'greenery', count: 1})) {
      return;
    }
    const space = AutomaTilePlacer.breakTie(game, candidates);
    AutomaTilePlacer.placeAndSettle(game, bot, space, () => game.addGreenery(bot, space));
    bumpCorpStat(game, 'polderSetupGreeneries');
  },

  onTilePlaced(game: IGame, player: IPlayer, space: Space): void {
    if (player.isMarsBot !== true) {
      return;
    }
    if (Board.isUncoveredOceanSpace(space)) {
      pay(game, player, 'Wind', 'polderWindMc');
    } else if (Board.isGreenerySpace(space)) {
      pay(game, player, 'Land', 'polderLandMc');
    }
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || (automa.corpStats.polders ?? 0) >= POLDERS_BEFORE_BURN) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.BC3_INPOLDERING)) {
      automa.recurringBonusCards.push(BonusCardId.BC3_INPOLDERING);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.BC3_INPOLDERING);
    if (!present) {
      automa.actionDeck.splice(game.rng.nextInt(automa.actionDeck.length + 1), 0, {kind: 'bonus', id: BonusCardId.BC3_INPOLDERING});
      game.log('${0} shuffled Inpoldering into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC3_INPOLDERING) {
      throw new Error(`MarsBot PolderTECH Dutch does not own bonus card ${id}`);
    }
    return inpoldering(game);
  },
};

/** The free ocean-reserved spaces — no tile, no claim. */
function freeOceanSpaces(game: IGame): ReadonlyArray<Space> {
  return game.board.spaces.filter((space) => space.spaceType === SpaceType.OCEAN && space.tile === undefined && space.player === undefined);
}

/**
 * The spaces a polder may take: free ocean-reserved spaces, only while the board keeps MORE free ocean spaces than
 * oceans still to place (taking one must leave enough for every remaining ocean); beside the bot's own tiles first.
 */
export function drainableSpaces(game: IGame): ReadonlyArray<Space> {
  const free = AutomaAres.withoutHazardSpaces(game, freeOceanSpaces(game));
  const oceansLeft = Math.max(0, game.max.oceans - game.board.getOceanSpaces().length);
  if (free.length - 1 < oceansLeft) {
    return [];
  }
  const own = isBotTile(game);
  const beside = free.filter((space) => game.board.getAdjacentSpaces(space).some(own));
  return beside.length > 0 ? beside : free;
}

/**
 * Wind and land pay: the human card's «ocean → 1 energy, greenery → 1 plant», in the bot's own currency — 1 M€ each
 * (a track push here was measured out: the plant track lays greeneries, every greenery pushed it again, 140 VP).
 */
function pay(game: IGame, bot: IPlayer, what: 'Wind' | 'Land', stat: string): void {
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    bot.stock.add(Resource.MEGACREDITS, POLDER_TILE_MC, {log: false});
    if (what === 'Wind') {
      game.log('${0} gained ${1} M€ from the wind of its corporation ${2}: an ocean', (b) => b.player(bot).number(POLDER_TILE_MC).string('PolderTECH Dutch'));
    } else {
      game.log('${0} gained ${1} M€ from the land of its corporation ${2}: a greenery', (b) => b.player(bot).number(POLDER_TILE_MC).string('PolderTECH Dutch'));
    }
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, stat, POLDER_TILE_MC);
}

/** BC3 Inpoldering — a polder, else an ocean; destroyed with the third polder. */
function inpoldering(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    return 'discard';
  }
  bumpCorpStat(game, 'inpolderingPlayed');
  const bot = marsBotOf(game);
  // «Pays 10 M€ for the dikes, if able» — all or nothing; no Failed Action (the card prints its own empty branch).
  if (bot.megaCredits < DIKE_COST) {
    AutomaTurnLog.setBonusBranch(game, {key: 'No ${0} M€ for the dikes — no polder this generation', params: [`${DIKE_COST}`]});
    game.log('${0} could not pay the ${1} M€ for the dikes of Inpoldering', (b) => b.player(bot).number(DIKE_COST));
    return 'discard';
  }
  bot.stock.deduct(Resource.MEGACREDITS, DIKE_COST, {log: false});
  game.log('${0} paid ${1} M€ for the dikes of Inpoldering', (b) => b.player(bot).number(DIKE_COST));
  bumpCorpStat(game, 'polderDikeMc', DIKE_COST);
  const candidates = drainableSpaces(game);
  if (candidates.length > 0 && !divertBotTerraforming(game, {kind: 'tile', tile: 'greenery', count: 1})) {
    const space = AutomaTilePlacer.breakTie(game, candidates);
    game.log('${0} drained ${1} and won a polder from the sea', (b) => b.player(bot).space(space));
    AutomaTilePlacer.placeAndSettle(game, bot, space, () => game.addGreenery(bot, space));
    bumpCorpStat(game, 'polders');
    const polders = automa.corpStats.polders ?? 0;
    if (polders >= POLDERS_BEFORE_BURN) {
      AutomaTurnLog.setBonusBranch(game, {key: 'The third polder — the dikes are finished, the card is destroyed'});
      return 'destroy';
    }
    AutomaTurnLog.setBonusBranch(game, {key: 'A polder won from the sea (${0} of ${1})', params: [`${polders}`, `${POLDERS_BEFORE_BURN}`]});
    return 'discard';
  }
  // Nothing to drain (or the law took the greenery): the sea is fed instead — the shared ocean, its own Failed
  // Action when Mars is full.
  AutomaTurnLog.setBonusBranch(game, {key: 'Nothing to drain — an ocean instead'});
  if (game.canAddOcean()) {
    AutomaTilePlacer.placeOcean(game);
  }
  return 'discard';
}
