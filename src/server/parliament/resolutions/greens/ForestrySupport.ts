/*
 * FORESTRY SUPPORT (the Greens) — Turmoil Redux resolution RX11: the second
 * LIVE PASSIVE, and the first law that INTRODUCES a rule the engine has no
 * notion of. Development Craze (RX10) only REPEATED what the engine had
 * already paid; this card makes greeneries pay their neighbours, which is a
 * bonus that does not exist in the game until this resolution stands enacted
 * (docs/TURMOIL_REDUX_FORESTRY_SUPPORT.md).
 *
 * Printed: «When enacted: Gain plants equal to twice your Influence. Effect:
 * Greenery tiles give a 2 M€ and 1 plant adjacency bonus when placing tiles
 * next to them.» Chairman quest: place 2 greeneries.
 *
 * THE NEW BONUS HAS A TWIN, AND THE WHOLE CARD IS BUILT ON IT: the OCEAN
 * ADJACENCY. «A neighbour pays me for building beside it» is one physical
 * statement, so the greenery version reuses that statement's every layer
 * rather than growing a parallel one:
 *  · THE RULE lives on the BOARD beside the ocean's —
 *    `MarsBoard.greeneryAdjacencyBonus`, the canonical tile predicate
 *    (`Board.isGreenerySpace` — greenery + Wetlands, never re-implemented) and
 *    the same answer shape (the paying neighbours in board order + the totals).
 *    The live payout, the dossier twin and the specs all read THAT ONE call,
 *    so a promise and a payout cannot drift (the preview↔commit law).
 *  · THE PUBLICATION rides the law's own channel (`lastPlacementLawPayout` —
 *    a MEMBER beside RX10's, never a second player field), so the console
 *    plays ONE extra wave per placement whatever the law is.
 *  · THE SCENE is the ocean beat's language with the grove's material: the
 *    shared edge wakes, a coin AND a plant condense out of the canopy, both
 *    ride the ordinary Resource Transfer Framework.
 *
 * THE READINGS FIXED HERE:
 *  · PLANTS: 2 × the player's influence for EVERY participant (Biodome
 *    Contest's declaration, reused verbatim); influence 0 is a NAMED skip.
 *  · WHO PAYS: every greenery ADJACENT to the tile just placed, of ANY owner —
 *    exactly as any owner's ocean pays. MarsBot's greenery pays a human.
 *  · WHAT: 2 M€ AND 1 plant per neighbour, the law's own constants (never
 *    `player.oceanBonus`, which is the ocean rule's own attribute).
 *  · FOR WHAT: any tile (city, greenery, ocean, special) landing ON MARS. A
 *    reserved area off Mars has no neighbours and is excluded by the card's own
 *    words. A greenery placed beside another greenery is paid for by it, and a
 *    second tile of the same action is paid by the first if they touch.
 *  · TO WHOM: the placing player, while they hold the law (the hook is
 *    per-player); MarsBot never participates in the parliament.
 *  · A COVER pays: the engine's own ocean adjacency is granted on a covering
 *    placement too (`Game.grantPlacementBonuses` gates only the PRINTED
 *    bonuses on `coveringExistingTile`), so the greenery twin mirrors it and
 *    the hook ignores that flag.
 *  · A MARS NOMADS CAMP MOVE pays nothing: `ParliamentHandler.onTilePlaced`
 *    runs inside `space.tile !== undefined`, and a camp move places no tile.
 *  · THE WORLD GOVERNMENT pays nothing: `Game.addTile` skips the whole
 *    placement-bonus block (and with it the parliament hook) in `Phase.SOLAR`.
 *  · THE DOSSIER TWIN states the bonus for the cell under the cursor from the
 *    SAME board call, and names the paying cells so the board lights them.
 *  · THE FORECAST twin states the rule with no number (the cell is chosen
 *    after the forecast; a number there would be a guess).
 *  · ENDS WITH THE LAW: the handler reads the ENACTED definition at the hook.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {SpaceType} from '../../../../common/boards/SpaceType';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {GreeneryAdjacencyBonusModel} from '../../../../common/models/GreeneryAdjacencyBonusModel';
import {BoardFact} from '../../../../common/boards/BoardInformationFacts';
import {IPlayer} from '../../../IPlayer';
import {Space} from '../../../boards/Space';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const FORESTRY_SUPPORT_ID: ResolutionId = 'RDX_GREENS_FORESTRY_SUPPORT';
export const FORESTRY_SUPPORT_CODE: ResolutionCode = 'RX11';

/** THE FORMULA of the immediate part: 2 plants per point of influence, no cap (Biodome Contest's). */
export const FORESTRY_SUPPORT_PLANTS: InfluenceScaledEffect = {
  id: 'plants',
  unit: {kind: 'stock', resource: Resource.PLANTS},
  perInfluence: 2,
  recipient: 'each',
};

/**
 * WHAT ONE NEIGHBOURING GREENERY PAYS — the law's printed rate, the analog of
 * `player.oceanBonus` for a rule that belongs to the card rather than to the
 * player. The board twin, the dossier fact and the published breakdown all
 * take it from here, so the rate is stated once.
 */
export const FORESTRY_SUPPORT_ADJACENCY = {megacredits: 2, plants: 1} as const;

const PLANTS_STEP: EnactStep = {
  key: 'plants',
  run(ctx) {
    const player = ctx.player;
    const effect = FORESTRY_SUPPORT_PLANTS;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no plants from ${1}', (b) => b.player(player).resolution(FORESTRY_SUPPORT_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.PLANTS, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.plants;
    // The ONE journal line below carries the whole calculation, so the add stays silent.
    player.stock.add(Resource.PLANTS, amount, {log: false, from: {resolution: FORESTRY_SUPPORT_ID}});
    const after = player.plants;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 2 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.PLANTS).resolution(FORESTRY_SUPPORT_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.PLANTS, amount, influence, before, after});
    return undefined;
  },
};

/**
 * THE GROVES PAY — the passive's whole body. The neighbours and the totals come
 * from the ONE board call (never a re-derived adjacency); the two gains carry
 * the resolution's own event source, so the journal chip, the notification's
 * «why» and the effect statistics all attribute them to the law. Returns the
 * breakdown the presentation reads (which groves paid, and at what rate), or
 * `undefined` when no greenery touches the cell — then nothing is logged and
 * no `effect-triggered` marker is raised.
 */
export function payGreeneryAdjacency(player: IPlayer, space: Space): GreeneryAdjacencyBonusModel | undefined {
  const game = player.game;
  const {greeneries, megacredits, plants, spaceIds} =
    game.board.greeneryAdjacencyBonus(space, FORESTRY_SUPPORT_ADJACENCY);
  if (greeneries === 0) {
    return undefined;
  }
  player.stock.add(Resource.MEGACREDITS, megacredits, {log: false, from: {resolution: FORESTRY_SUPPORT_ID}});
  player.stock.add(Resource.PLANTS, plants, {log: false, from: {resolution: FORESTRY_SUPPORT_ID}});
  game.log('${0} gained ${1} ${2} and ${3} ${4} for ${6} adjacent greenery(-ies) — ${5}', (b) =>
    b.player(player).number(megacredits).resource(Resource.MEGACREDITS).number(plants).resource(Resource.PLANTS)
      .resolution(FORESTRY_SUPPORT_ID).number(greeneries));
  const bonus: GreeneryAdjacencyBonusModel = {
    spaceId: space.id,
    greenerySpaceIds: spaceIds,
    perGreenery: FORESTRY_SUPPORT_ADJACENCY,
    megacredits,
    plants,
  };
  player.lastPlacementLawPayout = {spaceId: space.id, resolution: FORESTRY_SUPPORT_ID, greeneries: bonus};
  return bonus;
}

export const FORESTRY_SUPPORT: ResolutionDefinition = {
  id: FORESTRY_SUPPORT_ID,
  code: FORESTRY_SUPPORT_CODE,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 1,
  // THE FACE: the per-influence formula on its own row (2 plants / influence —
  // the RESOURCE, never a plant tag), then the passive as a RULE in the game's
  // own dictionary: a tile placed NEXT TO a greenery (the empty hex beside the
  // greenery hex) pays 2 M€ and 1 plant.
  renderData: CardRenderer.builder((b) => {
    b.plants(2).slash().influence().br;
    b.effect(undefined, (eb) => eb.emptyTile('normal', {size: Size.SMALL}).greenery({size: Size.SMALL, withO2: false})
      .startEffect.megacredits(2).plants(1));
  }),
  text: {
    name: 'Forestry Support',
    // The same sentence Biodome Contest prints — one i18n key, one translation.
    effect: 'Gain 2 plants for every point of your influence.',
    passive: 'Greenery tiles pay 2 M€ and 1 plant when you place a tile next to them.',
    quest: 'Place 2 greeneries',
  },
  quest: {goal: {kind: 'tile', tile: 'greenery'}, count: 2},
  scaled: [FORESTRY_SUPPORT_PLANTS],
  immediateSteps: [PLANTS_STEP],
  passive: {
    onTilePlaced(player, space) {
      // «…on Mars»: a reserved area off Mars has no neighbours at all.
      if (space.spaceType === SpaceType.COLONY) {
        return;
      }
      payGreeneryAdjacency(player, space);
    },
    placementFacts(ctx) {
      if (!ctx.onMars || !ctx.firesTilePassive) {
        return [];
      }
      const {greeneries, megacredits, plants, spaceIds} =
        ctx.player.game.board.greeneryAdjacencyBonus(ctx.space, FORESTRY_SUPPORT_ADJACENCY);
      if (greeneries === 0) {
        return [];
      }
      // ONE row per POOL (the dossier's own grammar), both naming the paying
      // cells so the board lights them — the ocean fact's `spaces`, generalized.
      // The arithmetic is spent on the FIRST row only, and only when more than
      // one grove pays: for a single neighbour the chips ARE the rate. The RATE
      // itself is printed in the sentence rather than interpolated — it is this
      // card's own constant (the same numbers its face prints), and a `${n}
      // plants` slot holding 1 cannot be inflected in RU.
      const many = greeneries > 1;
      const out: Array<BoardFact> = [
        ctx.gain('greenery-adjacency-mc', {icon: 'megacredits', amount: megacredits, direction: 'gain'},
          many ? 'Adjacent greeneries: ${0} × (2 M€ + 1 plant)' : undefined,
          {spaces: spaceIds, ...(many ? {params: [String(greeneries)]} : {})}),
        ctx.gain('greenery-adjacency-plants', {icon: 'plants', amount: plants, direction: 'gain'},
          undefined, {spaces: spaceIds}),
      ];
      return out;
    },
    forecast(ctx) {
      const tiles = ctx.tiles.filter((tile) => !tile.offMars).reduce((sum, tile) => sum + tile.count, 0);
      if (tiles === 0) {
        return [];
      }
      // No number: which cell — and therefore how many groves touch it — is
      // decided after this forecast. The fact names the rule and the rate.
      return [ctx.deferred(ctx.source('tile-placed'), [],
        'Forestry Support pays 2 M€ and 1 plant for every greenery next to a tile you place on Mars',
        {id: 'forestry-support-adjacency'})];
    },
  },
};
