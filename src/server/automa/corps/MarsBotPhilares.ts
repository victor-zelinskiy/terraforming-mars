import {Resource} from '../../../common/Resource';
import {SpaceType} from '../../../common/boards/SpaceType';
import {CardName} from '../../../common/cards/CardName';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {OCEAN_TILES, TileType, isSpecialTile, tileTypeToString} from '../../../common/TileType';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {inplaceShuffle} from '../../utils/shuffle';
import {AutomaAres} from '../AutomaAres';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {resolveBonusCard as resolveBaseBonusCard} from '../AutomaBonusCards';
import {destroyBonusCard} from './MarsBotBonusDeckOps';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C22_PHILARES);
/** The corporation card starts with this much science on it. */
const STARTING_SCIENCE = 1;
/** What one new border with the opponent is worth. */
const SCIENCE_PER_BORDER = 1;
/** The printed conversion: this much science buys one track advance. */
const SCIENCE_PER_ADVANCE = 4;
/** The card the setup box resolves and then destroys. */
const PRELUDE_CARD = BonusCardId.B07_LOCAL_NEURAL_INSTANCE;
/** The corporation's own bonus card, shuffled into the bonus deck at setup. */
const OWN_CARD = BonusCardId.B27_BUILD_BUILD_BUILD;
/** B27 branch (a): what a city beside the opponent's greenery costs. */
const CITY_PRICE = 5;
/** B27 branch (b): what a special tile beside the opponent's city costs. */
const SPECIAL_TILE_PRICE = 3;
/** B27 branch (c): the fallback take. */
const FALLBACK_MC = 3;

/**
 * How deep the science→track conversion may re-enter itself. An advance can
 * place a tile, a tile can create a new border, a border can buy another
 * advance — a real, terminating cascade (science is finite), but a corrupted
 * state must not be able to hang a turn. Same guard as C06's drain loop.
 */
const MAX_CASCADE = 20;
/** Live re-entrancy depth of `spendScienceForTrack` — never serialized. */
let cascadeDepth = 0;

/**
 * MarsBot Philares — official card C22:
 *
 *   SETUP   MarsBot places a greenery tile and raises oxygen 1 step.
 *           Place a science resource on this card.
 *           Resolve Local Neural Instance now, then destroy that card.
 *           Shuffle Build, Build, Build into the bonus deck.
 *   EFFECT  Each new adjacency between your tiles and MarsBot's tiles,
 *           regardless of who just placed the tile, gives MarsBot 1 science
 *           resource here. Then, if able, MarsBot spends 4 science resources
 *           from here to advance its most-advanced non-maxed track.
 *
 * plus its corporation-specific bonus card B27 Build, Build, Build.
 *
 * THE ONLY CORPORATION THAT SCORES THE BORDER ITSELF. Every other one watches
 * a track, a tag or a card; this one watches the SHAPE of the map, and it is
 * deliberately symmetric — «regardless of who just placed the tile» means the
 * human feeds it by building next to the bot exactly as the bot feeds itself
 * by building next to the human. Its setup opens with a greenery precisely so
 * that there is something to build against from turn one, and B27 exists to
 * force borders the human would never volunteer.
 *
 * WHY THE COUNT IS «ADJACENCIES OF THE NEW TILE», not a board-wide recount.
 * Only ONE tile is new, so every border it forms with the other side is new,
 * and no border that did not touch it can have changed. That is both the
 * cheapest reading and the only one that matches the printed «each NEW
 * adjacency ... regardless of who just placed THE TILE» — one placement, one
 * count. Neutral tiles (the solo-setup cities) belong to neither side and are
 * invisible here, in both directions.
 *
 * A MARKER IS NOT A TILE. C18's player markers put `space.player` on a
 * TILE-LESS cell; «between your tiles and MarsBot's tiles» asks for tiles, so
 * the count reads `space.tile !== undefined` and a claim never pays.
 *
 * «THEN, IF ABLE» IS ONE ATTEMPT PER TRIGGER, not a drain: the sentence is
 * part of the same effect, so a border that brings the card to 9 science
 * spends 4 once and leaves 5. But the ADVANCE it buys may place a tile, which
 * re-enters this very hook — a legitimate cascade the rulebook's own «resolve
 * it fully» demands, bounded by `MAX_CASCADE` against a corrupted state.
 *
 * THE TARGET TRACK is the board's own `getMostAdvancedNonMaxedTrackIndex`,
 * whose ties resolve to the topmost track — the same convention as its
 * long-standing sibling `getLeastAdvancedTrackIndex` (RB-B never breaks a
 * track tie by flipping a card). Philares is this method's first caller.
 */
export const MarsBotPhilares: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      // 1. The opening greenery. The shared placer, so the placement strategy,
      //    the placement bonuses and the Ares handling are the bot's usual
      //    ones — and its oxygen is raised by the printed line, not by the
      //    tile: `addGreenery` already does that, so raising it again here
      //    would double it. Guarded by reading the parameter around the call.
      const oxygenBefore = game.getOxygenLevel();
      AutomaTilePlacer.placeGreenery(game);
      if (game.getOxygenLevel() === oxygenBefore) {
        // The greenery could not be placed (a full map) or the tile did not
        // raise oxygen (it is already maxed): the printed «and raises oxygen
        // 1 step» is an independent sentence and still tries on its own.
        game.increaseOxygenLevel(bot, 1);
        game.log('${0} raised ${1} ${2} {step|steps}',
          (b) => b.player(bot).globalParameter(GlobalParameter.OXYGEN).number(1));
      }

      // 2. The seed science.
      automa.corpResources += STARTING_SCIENCE;
      bumpCorpStat(game, 'philaresScience', STARTING_SCIENCE);
      game.log('${0} put ${1} science on its corporation ${2}',
        (b) => b.player(bot).number(STARTING_SCIENCE).string('Philares'));

      // 3. «Resolve Local Neural Instance now, then destroy that card.» B07's
      //    own implementation already ends in `'destroy'`, so resolving it is
      //    the whole instruction — but the card has to leave the DECK too, and
      //    that is the shared three-place destroy (C05/C21). Destroy FIRST:
      //    B07's fallback draws a project card, and a deck still holding the
      //    card it is resolving is a state the table never has.
      if (destroyBonusCard(game, PRELUDE_CARD)) {
        resolveBaseBonusCard(game, PRELUDE_CARD);
        game.log('${0} resolved Local Neural Instance and destroyed it', (b) => b.player(bot));
      }

      // 4. Its own card joins the ordinary bonus rotation (the C12/B31 shape:
      //    owned, one-shot, not recurring).
      automa.bonusDeck.push({kind: 'bonus', id: OWN_CARD});
      inplaceShuffle(automa.bonusDeck, game.rng);
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },

  onTilePlaced(game: IGame, player: IPlayer, space: Space): void {
    const automa = game.automa;
    if (automa === undefined || space.tile === undefined) {
      return;
    }
    // THE ENGINE'S OWN READING of the identical printed sentence: the human
    // Philares' `onTilePlaced` returns the moment `space.player === undefined`,
    // so an UNOWNED tile (an ocean, Martian Nature Wonders, Rey Skywalker) is
    // nobody's tile and forms no adjacency — in either direction, since the
    // neighbour test asks the same question. Two entities printing one rule
    // must not disagree.
    if (space.player === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    // Which side just built? A neutral tile belongs to neither and creates no
    // border in either direction.
    const placedByBot = player.id === bot.id;
    if (!placedByBot && player.color === 'neutral') {
      return;
    }
    const isBotTile = (s: Space) => s.tile !== undefined && s.player?.id === bot.id;
    const isHumanTile = (s: Space) => s.tile !== undefined && s.player !== undefined &&
      s.player.id !== bot.id && s.player.color !== 'neutral';
    const otherSide = placedByBot ? isHumanTile : isBotTile;
    const gained = game.board.getAdjacentSpaces(space).filter(otherSide).length * SCIENCE_PER_BORDER;
    if (gained === 0) {
      return;
    }

    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources += gained;
      game.log('${0} gained ${1} science on its corporation ${2} from a new border',
        (b) => b.player(bot).number(gained).string('Philares'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'philaresBorders', gained);
    bumpCorpStat(game, 'philaresScience', gained);

    spendScienceForTrack(game);
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== OWN_CARD) {
      throw new Error(`MarsBot Philares does not own bonus card ${id}`);
    }
    return buildBuildBuild(game);
  },
};

/**
 * «Then, if able, MarsBot spends 4 science resources from here to advance its
 * most-advanced non-maxed track.» ONE attempt, and the advance it buys may
 * re-enter this hook through a tile — see the class comment.
 */
function spendScienceForTrack(game: IGame): void {
  const automa = game.automa;
  if (automa === undefined || automa.corpResources < SCIENCE_PER_ADVANCE) {
    return;
  }
  const trackIndex = automa.board.getMostAdvancedNonMaxedTrackIndex();
  if (trackIndex === undefined) {
    return; // Every track is complete — nothing left to buy.
  }
  if (cascadeDepth >= MAX_CASCADE) {
    return;
  }
  const bot = marsBotOf(game);
  automa.corpResources -= SCIENCE_PER_ADVANCE;
  bumpCorpStat(game, 'philaresSpends');
  bumpCorpStat(game, 'philaresSteps');
  cascadeDepth++;
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    game.log('${0} spent ${1} science off its corporation ${2} to advance a track',
      (b) => b.player(bot).number(SCIENCE_PER_ADVANCE).string('Philares'));
    // The shared advance: the space's printed icon, its cascades and the
    // Failed Action on a completed track all behave as they do anywhere else.
    AutomaResolver.advanceTrack(game, trackIndex);
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
    cascadeDepth--;
  }
}

/**
 * B27 Build, Build, Build — Philares' own card:
 *
 *   a. MarsBot places a city tile adjacent to one of your greenery tiles. If
 *      successful, it loses 5 MC.
 *   b. MarsBot places a special tile matching a card in its played pile
 *      adjacent to one of your city tiles. If successful, destroy that card
 *      and MarsBot loses 3 MC.
 *   c. MarsBot gains 3 MC, and shuffle this card back into the bonus deck.
 *
 * A FIRST-POSSIBLE LADDER (the B06/B15/B25 shape): each branch is attempted in
 * printed order and the first that LANDS ends the card. Both building branches
 * aim at the opponent's tiles on purpose — every one that lands hands Philares
 * at least one new border, so the card is the corporation's engine, not a
 * side effect of it.
 *
 * «IF SUCCESSFUL, IT LOSES N MC» IS NOT A PRICE IT MUST AFFORD. The payment
 * follows the placement and is conditional on it, never the other way round —
 * a broke bot still builds, and pays what it has (the C21 «as much as it is
 * able to lose» reading, which is this card set's default for a loss with no
 * «if able» attached). Nothing here is ever a Failed Action: branch (c) is the
 * printed fallback.
 *
 * THE CARD FOR BRANCH (b) is the FIRST card of the played pile that has a
 * Mars-land special tile — the pile is ordered, the card names no other
 * criterion, and the SPACE is then chosen by the shared tiebreakers. What
 * counts as such a tile is derived, not tabulated: `isSpecialTile` says which
 * tile types are special at all, `tileTypeToString` maps each to the card that
 * prints it, and `NON_MARS_LAND_TILES` removes the two families that cannot go
 * on a Mars land space (the ocean-hosted ones from the engine's own
 * `OCEAN_TILES`, and the Moon board's). `MarsBotPhilares.spec` fails with the
 * exact list if upstream adds a tile type neither branch classifies.
 *
 * «DESTROY THAT CARD» removes it from the played pile — the pile is what the
 * bot scores VP from at the end (`AutomaScoring`), so the card really does
 * cost the bot something for the tile it just planted.
 */
function buildBuildBuild(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  bumpCorpStat(game, 'buildPlayed');

  if (tryCityBesideOpponentGreenery(game)) {
    bumpCorpStat(game, 'buildCities');
    AutomaTurnLog.setBonusBranch(game, {key: 'A city beside your greenery, for ${0} M€', params: [`${CITY_PRICE}`]});
    return 'discard';
  }
  const planted = trySpecialTileBesideOpponentCity(game);
  if (planted !== undefined) {
    bumpCorpStat(game, 'buildSpecialTiles');
    AutomaTurnLog.setBonusBranch(game, {key: '${0} beside your city, for ${1} M€', params: [planted, `${SPECIAL_TILE_PRICE}`]});
    return 'discard';
  }

  // c. The printed fallback — and the ONE card in this set that goes straight
  //    back into the bonus DECK instead of the discard, so it stays in the
  //    rotation for as long as the map refuses it.
  const bot = marsBotOf(game);
  payOrTake(game, FALLBACK_MC, 'gain');
  bumpCorpStat(game, 'buildMc', FALLBACK_MC);
  AutomaTurnLog.setBonusBranch(game, {key: 'Nowhere to build — MarsBot took ${0} M€ instead', params: [`${FALLBACK_MC}`]});
  game.log('${0} found nowhere to build and took ${1} M€ instead', (b) => b.player(bot).number(FALLBACK_MC));
  return 'return-to-deck';
}

/** a. «A city tile adjacent to one of your greenery tiles.» */
function tryCityBesideOpponentGreenery(game: IGame): boolean {
  const bot = marsBotOf(game);
  const besideGreenery = (space: Space): number => game.board.getAdjacentSpaces(space)
    .filter((adj) => Board.isGreenerySpace(adj) && adj.player !== undefined &&
      adj.player.id !== bot.id && adj.player.color !== 'neutral').length;
  // The ordinary city rules still apply (`getAvailableSpacesForCity` refuses a
  // space adjacent to another city), plus the usual Ares handling.
  const candidates = AutomaAres.withoutHazardSpaces(game, game.board.getAvailableSpacesForCity(bot))
    .filter((space) => besideGreenery(space) > 0);
  if (candidates.length === 0) {
    return false;
  }
  // The card's own criterion first (touch as many of them as possible), then
  // hazard avoidance, then the shared tiebreakers — the `tryCitySurroundedByTwo`
  // shape.
  const most = Math.max(...candidates.map(besideGreenery));
  const space = AutomaTilePlacer.breakTie(game,
    AutomaAres.preferAwayFromHazards(game, candidates.filter((s) => besideGreenery(s) === most)));
  game.addCity(bot, space);
  payOrTake(game, CITY_PRICE, 'lose');
  return true;
}

/** b. «A special tile matching a card in its played pile, beside one of your city tiles.» */
function trySpecialTileBesideOpponentCity(game: IGame): CardName | undefined {
  const automa = game.automa;
  if (automa === undefined) {
    return undefined;
  }
  const bot = marsBotOf(game);
  const besideCity = (space: Space): number => game.board.getAdjacentSpaces(space)
    .filter((adj) => Board.isCitySpace(adj) && adj.player !== undefined &&
      adj.player.id !== bot.id && adj.player.color !== 'neutral').length;
  // Any empty land cell — a special tile is not a city and has no adjacency
  // rules of its own here (the card names ONE criterion and MarsBot never
  // checks a card's own requirements, RB-B).
  const candidates = AutomaAres.withoutHazardSpaces(game, game.board.getAvailableSpacesOnLand(bot))
    .filter((space) => space.spaceType !== SpaceType.OCEAN && besideCity(space) > 0);
  if (candidates.length === 0) {
    return undefined;
  }
  // The FIRST card of the ordered pile that prints a plantable tile.
  let index = -1;
  let tileType: TileType | undefined;
  for (let i = 0; i < automa.playedPile.length && tileType === undefined; i++) {
    tileType = marsLandTileFor(automa.playedPile[i]);
    index = i;
  }
  if (tileType === undefined) {
    return undefined; // Nothing in the pile prints a tile it could plant.
  }
  const name = automa.playedPile[index];
  const most = Math.max(...candidates.map(besideCity));
  const space = AutomaTilePlacer.breakTie(game,
    AutomaAres.preferAwayFromHazards(game, candidates.filter((s) => besideCity(s) === most)));
  game.addTile(bot, space, {tileType});
  // «Destroy that card»: out of the played pile, so it scores nothing.
  automa.playedPile.splice(index, 1);
  game.log('${0} planted ${1} beside your city and destroyed the card',
    (b) => b.player(bot).cardName(name));
  payOrTake(game, SPECIAL_TILE_PRICE, 'lose');
  return name;
}

/**
 * The two tile families a Mars LAND space cannot host. Derived where the
 * engine already states it (`OCEAN_TILES` covers an existing ocean tile) and
 * named explicitly where it does not (the Moon board's own tiles —
 * `isSpecialTile` already drops the three plain ones). A spec asserts this
 * partition stays exhaustive.
 */
export const NON_MARS_LAND_TILES: ReadonlySet<TileType> = new Set<TileType>([
  ...OCEAN_TILES,
  TileType.LUNA_TRADE_STATION,
  TileType.LUNA_MINING_HUB,
  TileType.LUNA_TRAIN_STATION,
  TileType.LUNAR_MINE_URBANIZATION,
]);

/** The special tile a played card prints, if that tile belongs on Mars land. */
export function marsLandTileFor(name: CardName): TileType | undefined {
  for (const [key, value] of Object.entries(tileTypeToString)) {
    if (value !== name) {
      continue;
    }
    const tileType = Number(key) as TileType;
    if (isSpecialTile(tileType) && !NON_MARS_LAND_TILES.has(tileType)) {
      return tileType;
    }
    return undefined;
  }
  return undefined;
}

/**
 * The printed M€ movement. A loss takes what the bot has («as much as it is
 * able to lose» — this card set's default for an unqualified loss), a gain is
 * an ordinary gain, and both ride the corporation scope so the journal, the
 * event stream and any watcher of the bot's income see them.
 */
function payOrTake(game: IGame, amount: number, direction: 'lose' | 'gain'): void {
  const bot = marsBotOf(game);
  const moved = direction === 'lose' ? Math.min(bot.megaCredits, amount) : amount;
  if (moved === 0) {
    game.log('${0} owed ${1} M€ for the build but had nothing to lose', (b) => b.player(bot).number(amount));
    return;
  }
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'bonus'});
  try {
    if (direction === 'lose') {
      bot.stock.deduct(Resource.MEGACREDITS, moved, {log: false});
      game.log('${0} paid ${1} M€ for the build', (b) => b.player(bot).number(moved));
      bumpCorpStat(game, 'buildMcPaid', moved);
    } else {
      bot.stock.add(Resource.MEGACREDITS, moved, {log: false});
    }
  } finally {
    AutomaTurnLog.setCause(game, prior);
  }
}
