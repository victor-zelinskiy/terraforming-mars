/*
 * DEVELOPMENT CRAZE (Mars First) — Turmoil Redux resolution RX10: the FIRST
 * resolution with a LIVE PASSIVE. Until it, the passive family was rehearsed
 * only by the dev example «Urban Charter» (`DEV_PASSIVE`, never dealt); this
 * card walks the seam (`ResolutionPassive` + the mandatory `forecast`) and
 * makes the passive VISIBLE — its own chip graphic, its row in the Information
 * effects list, an explicit trigger on the board (docs/TURMOIL_REDUX_DEVELOPMENT_CRAZE.md).
 *
 * Printed: «When enacted: Gain steel equal to your Influence. Effect: Double
 * all placement and adjacency bonuses you get for placing tiles on Mars.»
 * Chairman quest: place 1 city or special tile.
 *
 * THE READINGS FIXED HERE:
 *  · STEEL: 1 × the player's influence for EVERY participant, into the supply,
 *    no cap — the family's ordinary stock grant (Biodome Contest's plants).
 *    Influence 0 → nothing, NAMED (a journal line and a `skipped` outcome).
 *  · THE PASSIVE, while the card stands enacted: the engine pays a placement's
 *    bonuses BEFORE the parliament hook (`Game.grantPlacementBonuses`: the
 *    cell's printed bonuses → the ocean adjacency → the Ares adjacency →
 *    `ParliamentHandler.onTilePlaced`), so «double» IS «pay the same bonuses
 *    a SECOND time» — through the SAME engine entries the first payout used
 *    (`grantSpaceBonuses` · `grantOceanAdjacencyBonus` · `AresHandler
 *    .earnAdjacencyBonuses`), every mutation under the resolution's own event
 *    source. No rule is restated here; whatever a bonus does once, it does
 *    again: a stock icon pays again, a card draws again, a card-resource icon
 *    asks its holder again, an energy-production icon raises again, and a
 *    PAY-TO-USE bonus (the Hellas ocean, Vastitas' temperature, Terra
 *    Cimmeria's colony) offers its transaction again — the literal reading of
 *    «you get them twice» (the owner's decision; a second offer is bounded and
 *    refusable, and a second ocean on the Hellas pole cannot loop: the pole is
 *    occupied by then).
 *  · ONLY MARS: a reserved area off Mars (`SpaceType.COLONY`) doubles nothing —
 *    the card says «on Mars». Only the placing player's OWN placements (the
 *    hook is per player); MarsBot never participates in the parliament.
 *  · A COVER (an Ares ocean cover): the engine paid NO printed bonus the first
 *    time, so none the second — the hook is told (`coveringExistingTile`) and
 *    repeats only the adjacency. A Mars Nomads camp move places no tile and
 *    runs no hook: a move is not a placement.
 *  · THE FORECAST twin states the doubling for every Mars tile the operation
 *    places — as a DEFERRED fact with no number (the cell is chosen later; a
 *    number here would be a guess). The honesty law: a live hook without its
 *    forecast is a silent lie.
 *  · THE ECHO: the passive publishes what it repeated (`lastPlacementBonusEcho`
 *    — the `lastOceanBonus` pattern) so the premium placement scene plays the
 *    second payout as a SECOND WAVE from the same cell. Presentation only.
 *  · ENDS WITH THE LAW: the handler reads the ENACTED definition at the hook
 *    — a later sitting that enacts another card ends the doubling.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {SpaceType} from '../../../../common/boards/SpaceType';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {PlacementBonusEchoModel} from '../../../../common/models/PlacementBonusEchoModel';
import {AresHandler} from '../../../ares/AresHandler';
import {IPlayer} from '../../../IPlayer';
import {Space} from '../../../boards/Space';
import {EnactStep, ResolutionDefinition, TilePlacementBonusContext} from '../IResolution';

export const DEVELOPMENT_CRAZE_ID: ResolutionId = 'RDX_MARS_DEVELOPMENT_CRAZE';
export const DEVELOPMENT_CRAZE_CODE: ResolutionCode = 'RX10';

/** THE FORMULA: 1 steel per point of influence, for every participant — no cap. */
export const DEVELOPMENT_CRAZE_STEEL: InfluenceScaledEffect = {
  id: 'steel',
  unit: {kind: 'stock', resource: Resource.STEEL},
  perInfluence: 1,
  recipient: 'each',
};

const STEEL_STEP: EnactStep = {
  key: 'steel',
  run(ctx) {
    const player = ctx.player;
    const effect = DEVELOPMENT_CRAZE_STEEL;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no steel from ${1}', (b) => b.player(player).resolution(DEVELOPMENT_CRAZE_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.STEEL, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.steel;
    // The standard gain under the resolution's source; the ONE journal line
    // below carries the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.STEEL, amount, {log: false, from: {resolution: DEVELOPMENT_CRAZE_ID}});
    const after = player.steel;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.STEEL).resolution(DEVELOPMENT_CRAZE_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.STEEL, amount, influence, before, after});
    return undefined;
  },
};

/**
 * PAY THE PLACEMENT'S BONUSES A SECOND TIME — the passive's whole body, through
 * the engine's own grant entries (never a restated rule), in the engine's own
 * order: the cell's printed bonuses (unless the tile COVERED a tile — the
 * engine paid none the first time), then the ocean adjacency, then the Ares
 * adjacency under Ares. Returns the ECHO the presentation reads (what was
 * repeated, for the second wave), or `undefined` when the cell had nothing to
 * repeat — then nothing is logged and no marker is raised.
 */
export function repeatPlacementBonuses(player: IPlayer, space: Space, placement: TilePlacementBonusContext): PlacementBonusEchoModel | undefined {
  const game = player.game;
  const printed = !placement.coveringExistingTile;
  const printedPaid = printed && space.bonus.length > 0;
  const oceanPaid = game.board.oceanAdjacencyBonus(player, space).megacredits > 0;
  // An Ares neighbour pays only when it carries an adjacency bonus (the same
  // predicate `earnAdjacencyBonuses` reads) — a bare neighbourhood is nothing.
  const aresPays = game.gameOptions.aresExtension === true &&
    game.board.getAdjacentSpaces(space).some((s) => s.adjacency !== undefined && s.adjacency.bonus.length > 0);
  if (!printedPaid && !oceanPaid && !aresPays) {
    return undefined;
  }
  game.log('${0} receives the placement bonuses of the tile a second time — ${1}', (b) => b.player(player).resolution(DEVELOPMENT_CRAZE_ID));
  if (printedPaid) {
    game.grantSpaceBonuses(player, space);
  }
  const ocean = game.grantOceanAdjacencyBonus(player, space);
  AresHandler.ifAres(game, () => AresHandler.earnAdjacencyBonuses(player, space));
  const echo: PlacementBonusEchoModel = {
    spaceId: space.id,
    resolution: DEVELOPMENT_CRAZE_ID,
    printed,
    ...(ocean !== undefined ? {ocean} : {}),
  };
  player.lastPlacementBonusEcho = echo;
  return echo;
}

export const DEVELOPMENT_CRAZE: ResolutionDefinition = {
  id: DEVELOPMENT_CRAZE_ID,
  code: DEVELOPMENT_CRAZE_CODE,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 1,
  // THE FACE: the per-influence steel on its own row; the passive as a RULE in
  // the game's own dictionary — a tile placed on Mars (the empty hex with its
  // spark) → the tile's BONUS (the «tile with a bonus» glyph the Ares adjacency
  // rules print) doubled. The printed «BONUSES × 2» is that composition, not
  // a lettered formula; the SAME drawing serves the bill, the effects list
  // and the inspector.
  renderData: CardRenderer.builder((b) => {
    b.steel(1).slash().influence().br;
    b.effect(undefined, (eb) => eb.emptyTile('normal', {size: Size.SMALL}).asterix().startEffect.adjacencyBonus().text('x2', Size.MEDIUM, false, true));
  }),
  text: {
    name: 'Development Craze',
    effect: 'Gain 1 steel for every point of your influence.',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'All placement and adjacency bonuses you get for placing tiles on Mars are paid twice.',
    quest: 'Place 1 city or special tile',
  },
  quest: {goal: {kind: 'tile', tile: 'cityOrSpecial'}, count: 1},
  scaled: [DEVELOPMENT_CRAZE_STEEL],
  immediateSteps: [STEEL_STEP],
  passive: {
    onTilePlaced(player, space, placement) {
      // «…on Mars»: a reserved area off Mars doubles nothing.
      if (space.spaceType === SpaceType.COLONY) {
        return;
      }
      repeatPlacementBonuses(player, space, placement);
    },
    forecast(ctx) {
      const tiles = ctx.tiles.filter((tile) => !tile.offMars).reduce((sum, tile) => sum + tile.count, 0);
      if (tiles === 0) {
        return [];
      }
      // No number: the cell is chosen after this forecast, and a bonus it does
      // not know is not a bonus it may promise. The fact names the doubling.
      return [ctx.deferred(ctx.source('tile-placed'), [],
        'Development Craze pays the placement and adjacency bonuses of a tile you place on Mars a second time', {id: 'development-craze-double'})];
    },
  },
};
