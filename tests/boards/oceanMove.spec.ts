import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceId} from '../../src/common/Types';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {Capital} from '../../src/server/cards/base/Capital';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {
  isPlainOcean, movableOceans, oceanMoveCells, oceanMoveDestinations, oceanMoveOffer, oceanMoveReasoner,
} from '../../src/server/boards/oceanMove';
import {findTileMove, tileMovePromptModel} from '../../src/server/boards/tileMove';
import {
  MOVE_OCEAN_TILE_TITLE, MoveOceanTile, NO_SPACE_TO_MOVE_AN_OCEAN_REASON, OCEAN_MOVE_LABEL,
} from '../../src/server/deferredActions/MoveOceanTile';
import {aggregateByPlayer} from '../../src/common/events/aggregate';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {cast} from '../../src/common/utils/utils';
import {addOcean, maxOutOceans, runAllActions} from '../TestingUtils';

/**
 * AN OCEAN MOVES (Turmoil Redux TR39 Canyon Carving) — the engine's second
 * mover (`Game.moveOceanTile`) and the one reading of «which ocean may move,
 * and where» (`boards/oceanMove.ts`), in the project's one move offer shape
 * (`boards/tileMove.ts`). Every rule reading the card's header lists is
 * pinned here at the engine; the card's own spec pins the play.
 *
 * THE GEOMETRY IS THARSIS'S OWN (the default board), named by cell and
 * asserted before the facts, so a board change fails here by name:
 *   · A (33) — an ocean reserve with two plants printed, beside two other
 *     ocean reserves (32, 34) and four land cells (24, 25, 41, 42);
 *   · B₁ (34) — an empty ocean reserve beside A; B₂ (42) — plant land beside A;
 *   · O₂ (43) — an ocean reserve beside BOTH B₁ and B₂ (never beside A);
 *   · C (24) — land beside A and beside NEITHER B — the Capital's seat.
 */
const A = '33' as SpaceId;
const B_OCEAN = '34' as SpaceId;
const B_LAND = '42' as SpaceId;
const O2 = '43' as SpaceId;
const CAPITAL_CELL = '24' as SpaceId;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer};

function table(options?: {aresExtension?: boolean}): Table {
  const [game, p1, p2] = testGame(2, {aresExtension: options?.aresExtension === true, aresHazards: false});
  const board = game.board;
  const adjacent = (a: SpaceId, b: SpaceId) => board.getAdjacentSpaces(board.getSpaceOrThrow(a)).some((s) => s.id === b);
  expect(board.getSpaceOrThrow(A).spaceType).eq(SpaceType.OCEAN);
  expect(board.getSpaceOrThrow(A).bonus).deep.eq([SpaceBonus.PLANT, SpaceBonus.PLANT]);
  expect(board.getSpaceOrThrow(B_OCEAN).spaceType).eq(SpaceType.OCEAN);
  expect(board.getSpaceOrThrow(B_LAND).spaceType).eq(SpaceType.LAND);
  expect(board.getSpaceOrThrow(O2).spaceType).eq(SpaceType.OCEAN);
  expect(board.getSpaceOrThrow(CAPITAL_CELL).spaceType).eq(SpaceType.LAND);
  expect([adjacent(A, B_OCEAN), adjacent(A, B_LAND), adjacent(A, CAPITAL_CELL)], 'A touches both B and C').deep.eq([true, true, true]);
  expect([adjacent(O2, B_OCEAN), adjacent(O2, B_LAND), adjacent(O2, A)], 'O₂ touches both B, never A').deep.eq([true, true, false]);
  expect([adjacent(CAPITAL_CELL, B_OCEAN), adjacent(CAPITAL_CELL, B_LAND)], 'C touches neither B').deep.eq([false, false]);
  return {game, p1, p2};
}

const cell = (game: IGame, id: SpaceId) => game.board.getSpaceOrThrow(id);
const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

/** An ocean seated WITHOUT the parameter's train (no TR, no count hooks) — the arrangement, never the rule. */
function seatOcean(game: IGame, id: SpaceId): Space {
  const space = cell(game, id);
  space.tile = {tileType: TileType.OCEAN};
  space.player = undefined;
  return space;
}

/** A Capital of `owner` on `id`, its card in the tableau — so the engine's own scorer counts its oceans. */
function seatCapital(game: IGame, owner: TestPlayer, id: SpaceId): Space {
  const capital = new Capital();
  owner.playedCards.push(capital);
  const space = cell(game, id);
  game.simpleAddTile(owner, space, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
  return space;
}

describe('oceanMove', () => {
  describe('Game.moveOceanTile — the one mover', () => {
    it('a plain ocean moves whole: the old cell is bare with no owner, the new one carries an OCEAN of nobody\'s', () => {
      const {game, p1} = table();
      const from = seatOcean(game, A);
      const to = cell(game, B_OCEAN);

      game.moveOceanTile(p1, from, to);

      expect(from.tile).is.undefined;
      expect(from.player).is.undefined;
      expect(to.tile).deep.eq({tileType: TileType.OCEAN});
      expect(to.player, 'an ocean is nobody\'s').is.undefined;
    });

    it('the ocean PARAMETER does not move: the count and the gate are the same before and after — only the move\'s own TR is paid', () => {
      const {game, p1} = table();
      const from = seatOcean(game, A);
      const countBefore = game.board.getOceanSpaces().length;
      const gateBefore = game.canAddOcean();
      const trBefore = p1.terraformRating;
      const fromCardsBefore = p1.terraformRatingFromCards;
      const eventsBefore = game.events.events.length;

      game.moveOceanTile(p1, from, cell(game, B_LAND));

      expect(game.board.getOceanSpaces().length).eq(countBefore);
      expect(game.canAddOcean()).eq(gateBefore);
      expect(p1.terraformRating, '+1 TR for the move').eq(trBefore + 1);
      expect(p1.terraformRatingFromCards, 'the TR is a CARD\'s in the breakdown, never a global parameter\'s').eq(fromCardsBefore + 1);
      expect(p1.terraformRatingSources.at(-1)?.amount).eq(1);
      const fresh = game.events.events.slice(eventsBefore);
      expect(fresh.some((e) => e.type === 'global-parameter-changed'), 'no parameter record — nothing was raised').is.false;
    });

    it('at NINE oceans the move is legal and still pays its TR — the gate is the parameter\'s, not the move\'s', () => {
      const {game, p1} = table();
      maxOutOceans(p1);
      expect(game.canAddOcean()).is.false;
      const offer = oceanMoveOffer(p1);
      const source = offer.sources.find((s) => s.to.length > 0)!;
      expect(source, 'a full board still has an ocean beside a free cell').is.not.undefined;
      const trBefore = p1.terraformRating;

      game.moveOceanTile(p1, source.from, source.to[0]);

      expect(game.board.getOceanSpaces().length).eq(9);
      expect(p1.terraformRating).eq(trBefore + 1);
    });

    it('records ONE `tile-moved` event of an OCEAN in place of `tile-placed`, and «tiles placed» does not grow', () => {
      const {game, p1} = table();
      const from = seatOcean(game, A);
      const to = cell(game, B_OCEAN);
      const placedBefore = aggregateByPlayer(game.events.events).get(p1.color)?.tilesPlaced ?? 0;
      const eventsBefore = game.events.events.length;

      game.moveOceanTile(p1, from, to);

      const fresh = game.events.events.slice(eventsBefore);
      const moved = fresh.filter((e) => e.type === 'tile-moved');
      expect(moved).has.length(1);
      expect(moved[0].impact.tileMove).deep.eq({from: A, to: B_OCEAN, tileType: TileType.OCEAN});
      expect(moved[0].space, 'the destination — «show on map»').eq(B_OCEAN);
      expect(moved[0].tile).eq(TileType.OCEAN);
      expect(fresh.some((e) => e.type === 'tile-placed'), 'no placement event for the move').is.false;
      expect(aggregateByPlayer(game.events.events).get(p1.color)?.tilesPlaced ?? 0).eq(placedBefore);
    });

    it('writes ONE log line naming the tile by its kind — never «their city» — and publishes the move on the `tileMoves` ring', () => {
      const {game, p1} = table();
      const from = seatOcean(game, A);
      const to = cell(game, B_LAND);
      const logBefore = game.gameLog.length;

      game.moveOceanTile(p1, from, to);

      const lines = game.gameLog.slice(logBefore);
      const moveLines = lines.filter((l) => l.message === '${0} moved an ocean tile · ${1} → ${2}');
      expect(moveLines).has.length(1);
      expect(moveLines[0].data.map((d) => d.value)).deep.eq([p1.color, A, B_LAND]);
      expect(lines.some((l) => String(l.message).includes('their city')), 'an ocean is nobody\'s city').is.false;
      expect(lines.some((l) => String(l.message).includes('placed')), 'never «placed ocean tile»').is.false;
      expect(lines.some((l) => l.message === '${0} gained ${1} ${2}'), 'the TR on its own line').is.true;
      expect(game.tileMoves).has.length(1);
      expect(game.tileMoves[0], 'the record\'s colour is who MOVED it — whose scene it is').deep.include({from: A, to: B_LAND, tileType: TileType.OCEAN, color: p1.color});
    });

    it('pays the new cell\'s printed bonus and the adjacency of the OTHER oceans only — the lifted one is gone, a destination beside the source never counts it', () => {
      const {game, p1} = table();
      const from = seatOcean(game, A);
      const to = cell(game, B_OCEAN);
      to.bonus = [SpaceBonus.STEEL, SpaceBonus.STEEL];
      p1.megaCredits = 0;
      p1.steel = 0;

      game.moveOceanTile(p1, from, to);
      expect(p1.steel, 'the printed bonus').eq(2);
      expect(p1.megaCredits, 'B touches A — and A is lifted: nothing to pay').eq(0);

      // The same move with a SECOND ocean beside B: that one pays.
      const second = table();
      seatOcean(second.game, A);
      seatOcean(second.game, O2);
      second.p1.megaCredits = 0;
      second.game.moveOceanTile(second.p1, cell(second.game, A), cell(second.game, B_OCEAN));
      expect(second.p1.megaCredits, 'one other ocean beside B').eq(2);
    });

    it('the freed ocean reserve accepts an ocean AGAIN — paying its TR and its bonus again (the removal\'s own ruling)', () => {
      const {game, p1, p2} = table();
      const from = seatOcean(game, A);
      game.moveOceanTile(p1, from, cell(game, B_OCEAN));
      p2.plants = 0;
      const trBefore = p2.terraformRating;

      addOcean(p2, A);

      expect(from.tile?.tileType).eq(TileType.OCEAN);
      expect(p2.plants, 'the printed plants again').eq(2);
      expect(p2.terraformRating).eq(trBefore + 1);
    });

    it('an ocean standing ON LAND (Artificial Lake\'s family) moves like any other — to land or to a reserve beside it', () => {
      const {game, p1} = table();
      const from = seatOcean(game, B_LAND);
      const offer = oceanMoveOffer(p1);
      const source = offer.sources.find((s) => s.from.id === B_LAND)!;
      expect(source, 'an ocean on land is a source').is.not.undefined;
      expect(ids(source.to), 'its neighbours of both families').to.include.members([A, B_OCEAN, O2]);

      game.moveOceanTile(p1, from, cell(game, A));
      expect(from.tile).is.undefined;
      expect(cell(game, A).tile?.tileType).eq(TileType.OCEAN);
    });

    it('fires everything that answers «an ocean tile was placed» — another player\'s Arctic Algae gains its plants', () => {
      const {game, p1, p2} = table();
      p2.playedCards.push(new ArcticAlgae());
      p2.plants = 0;
      const from = seatOcean(game, A);

      game.moveOceanTile(p1, from, cell(game, B_OCEAN));
      runAllActions(game);

      expect(p2.plants).eq(2);
    });

    it('the Capital recounts by the board — the player\'s own or ANOTHER player\'s: one fewer beside the old cell, one more beside the new', () => {
      const {game, p1, p2} = table();
      seatCapital(game, p2, CAPITAL_CELL);
      const from = seatOcean(game, A);
      expect(p2.getVictoryPoints().victoryPoints, 'the Capital scores its one adjacent ocean').eq(1);

      game.moveOceanTile(p1, from, cell(game, B_LAND));
      expect(p2.getVictoryPoints().victoryPoints, 'the ocean left its side').eq(0);

      // …and back beside it: the point returns.
      game.moveOceanTile(p1, cell(game, B_LAND), cell(game, A));
      expect(p2.getVictoryPoints().victoryPoints).eq(1);
    });

    it('survives a save and a load: the ocean stands on the new cell, the old one is free', () => {
      const {game, p1} = table();
      const from = seatOcean(game, A);
      game.moveOceanTile(p1, from, cell(game, B_OCEAN));
      const live = Game.deserialize(structuredClone(game.serialize()));
      expect(live.board.getSpaceOrThrow(B_OCEAN).tile?.tileType).eq(TileType.OCEAN);
      expect(live.board.getSpaceOrThrow(B_OCEAN).player).is.undefined;
      expect(live.board.getSpaceOrThrow(A).tile).is.undefined;
      expect(live.board.getOceanSpaces()).has.length(1);
      expect(live.getPlayerById(p1.id).terraformRating).eq(p1.terraformRating);
    });

    describe('refuses — before touching anything', () => {
      it('a cell with no plain ocean: empty, a city, an upgraded ocean', () => {
        const {game, p1} = table();
        const city = cell(game, B_LAND);
        game.simpleAddTile(p1, city, {tileType: TileType.CITY});
        const upgraded = seatOcean(game, O2);
        game.addTile(p1, upgraded, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: upgraded.tile});
        for (const from of [cell(game, A), city, upgraded]) {
          expect(() => game.moveOceanTile(p1, from, cell(game, B_OCEAN)), from.id).to.throw('Not a plain ocean tile that can be moved');
        }
        expect(cell(game, B_OCEAN).tile).is.undefined;
        expect(upgraded.tile?.tileType).eq(TileType.OCEAN_CITY);
      });

      it('a cell that is not adjacent, an occupied cell, the Noctis cell, a colony slot, another player\'s claim', () => {
        const {game, p1, p2} = table();
        const from = seatOcean(game, A);
        const far = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
          !game.board.getAdjacentSpaces(from).some((n) => n.id === s.id))!;
        const occupied = cell(game, B_LAND);
        game.simpleAddTile(p2, occupied, {tileType: TileType.GREENERY});
        const claimed = cell(game, '41' as SpaceId);
        claimed.player = p2;
        const noctis = game.board.getSpaceOrThrow(game.board.noctisCitySpaceId!);
        const colony = game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY);
        for (const to of [far, occupied, claimed, noctis, colony]) {
          expect(() => game.moveOceanTile(p1, from, to), to.id).to.throw('cannot be moved to');
        }
        expect(from.tile?.tileType, 'the ocean never left').eq(TileType.OCEAN);
        expect(far.tile).is.undefined;
      });
    });
  });

  describe('who may move, and where — `oceanMoveOffer`', () => {
    it('ANY plain ocean is a source — the player\'s own, another player\'s, one placed by nobody: an ocean has no owner', () => {
      const {game, p1, p2} = table();
      addOcean(p1, A);
      addOcean(p2, O2);
      seatOcean(game, '06' as SpaceId);
      const offer = oceanMoveOffer(p1);
      expect(ids(offer.sources.map((s) => s.from))).to.have.members([A, O2, '06']);
      expect(offer.sources.every((s) => s.tileType === TileType.OCEAN && s.arrives === TileType.OCEAN && s.tiers === 1 && s.card === undefined)).is.true;
      expect(offer.disabledSources).deep.eq([]);
      expect(game.board.spaces.filter(isPlainOcean)).has.length(3);
    });

    it('an upgraded ocean (Ocean City) and a Wetlands only COUNT as an ocean: listed DISABLED with their one reason, never a source', () => {
      const {game, p1} = table({aresExtension: true});
      const upgraded = seatOcean(game, A);
      game.addTile(p1, upgraded, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: upgraded.tile});
      const wetlands = cell(game, B_LAND);
      game.simpleAddTile(p1, wetlands, {tileType: TileType.WETLANDS});
      const offer = oceanMoveOffer(p1);
      expect(offer.sources).deep.eq([]);
      expect(offer.disabledSources.map((d) => [d.space.id, d.reason])).to.have.deep.members([[A, 'upgraded-ocean'], [B_LAND, 'upgraded-ocean']]);
      expect(movableOceans(p1)).deep.eq([]);
    });

    it('the destinations are TWO families beside the ocean: an empty ocean reserve, and land not reserved at all — never Noctis, a colony slot, an occupied cell or another player\'s claim; the player\'s own claim is fine', () => {
      const {game, p1, p2} = table();
      const from = seatOcean(game, A);
      const neighbours = game.board.getAdjacentSpaces(from);
      expect(ids(neighbours)).to.have.members(['24', '25', '34', '42', '41', '32']);
      game.simpleAddTile(p2, cell(game, '25' as SpaceId), {tileType: TileType.GREENERY});
      cell(game, '41' as SpaceId).player = p2; // another player's Land Claim
      cell(game, B_LAND).player = p1; // the player's own claim
      const source = oceanMoveOffer(p1).sources.find((s) => s.from.id === A)!;
      expect(ids(source.to)).to.have.members([CAPITAL_CELL, B_OCEAN, B_LAND, '32']);
      expect(ids(source.to), 'an occupied cell and another\'s claim are out').to.not.include.members(['25', '41']);
      expect(ids(oceanMoveCells(p1))).to.not.include(game.board.noctisCitySpaceId);
      expect(ids(oceanMoveCells(p1))).to.not.include(SpaceName.GANYMEDE_COLONY);
    });

    it('the destinations run clockwise from the EAST neighbour', () => {
      const {game, p1} = table();
      seatOcean(game, A);
      const source = oceanMoveOffer(p1).sources[0];
      // A's ring (top-left, top-right, right, bottom-right, bottom-left, left) = 24, 25, 34, 42, 41, 32 → from the east: 34, 42, 41, 32, 24, 25.
      expect(ids(source.to)).deep.eq([B_OCEAN, B_LAND, '41', '32', CAPITAL_CELL, '25']);
    });

    it('an unprotected Ares hazard beside the ocean is a destination at its own price; a protected one and an unaffordable one are not', () => {
      const {game, p1} = table({aresExtension: true});
      seatOcean(game, A);
      const hazard = cell(game, B_LAND);
      AresHazards.putHazardAt(game, hazard, TileType.DUST_STORM_MILD);
      p1.megaCredits = 20;
      expect(ids(oceanMoveOffer(p1).sources[0].to), 'coverable at 8 M€').to.include(B_LAND);
      p1.megaCredits = 7;
      expect(ids(oceanMoveOffer(p1).sources[0].to), 'too dear').to.not.include(B_LAND);
      p1.megaCredits = 20;
      hazard.tile!.protectedHazard = true;
      expect(ids(oceanMoveOffer(p1).sources[0].to), 'protected').to.not.include(B_LAND);
    });

    it('an ocean with nowhere to go is LISTED with its one reason, never hidden; the card\'s gate reads «no ocean may move»', () => {
      const {game, p1, p2} = table();
      const from = seatOcean(game, A);
      for (const n of game.board.getAdjacentSpaces(from)) {
        if (n.spaceType === SpaceType.OCEAN) {
          seatOcean(game, n.id);
        } else {
          game.simpleAddTile(p2, n, {tileType: TileType.GREENERY});
        }
      }
      const offer = oceanMoveOffer(p1);
      expect(offer.disabledSources.find((d) => d.space.id === A)?.reason).eq('ocean-no-space-to-move');
      // The two oceans seated beside it (32, 34) have free cells of their own — the card is still playable through them.
      expect(ids(offer.sources.map((s) => s.from))).to.have.members(['32', '34']);
    });

    it('the prompt offers the UNION of the destinations; each ocean names the offered cells it cannot reach', () => {
      const {game, p1} = table();
      seatOcean(game, A);
      seatOcean(game, '06' as SpaceId); // the far north-east reserve
      const offer = oceanMoveOffer(p1);
      const union = oceanMoveDestinations(offer);
      expect(ids(union)).deep.eq([...new Set(offer.sources.flatMap((s) => ids(s.to)))].sort());
      const a = offer.sources.find((s) => s.from.id === A)!;
      const far = offer.sources.find((s) => s.from.id === '06')!;
      expect(a.illegal.map((e) => e.spaceId)).to.have.members(ids(far.to));
      expect(a.illegal.every((e) => e.reason === 'not-adjacent-to-the-ocean')).is.true;
      expect(findTileMove(offer, A, far.to[0].id), 'a sibling\'s cell is no move of this ocean\'s').is.undefined;
      expect(findTileMove(offer, A, a.to[0].id)?.to.id).eq(a.to[0].id);
    });

    it('`getAvailableSpacesForType(\'ocean-move\')` is that union, and the reasoner names a far cell of either family — nothing else', () => {
      const {game, p1, p2} = table();
      seatOcean(game, A);
      const offer = oceanMoveOffer(p1);
      expect(ids(game.board.getAvailableSpacesForType(p1, 'ocean-move'))).deep.eq(ids(oceanMoveDestinations(offer)));
      const reasoner = oceanMoveReasoner(p1, offer);
      expect(reasoner(cell(game, '06' as SpaceId)), 'a far ocean reserve').eq('not-adjacent-to-the-ocean');
      expect(reasoner(cell(game, '10' as SpaceId)), 'far land').eq('not-adjacent-to-the-ocean');
      expect(reasoner(cell(game, B_LAND)), 'a neighbour is the offer\'s own').is.undefined;
      const occupied = cell(game, '10' as SpaceId);
      game.simpleAddTile(p2, occupied, {tileType: TileType.CITY});
      expect(oceanMoveReasoner(p1, oceanMoveOffer(p1))(occupied), 'an occupied cell keeps the generic reason').is.undefined;
      expect(game.board.illegalReasonFor(p1, 'ocean-move', occupied)).eq('occupied');
      expect(game.board.illegalReasonFor(p1, 'ocean-move', game.board.getSpaceOrThrow(game.board.noctisCitySpaceId!))).eq('reserved-noctis');
      expect(game.board.illegalReasonFor(p1, 'ocean-move', game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY))).eq('reserved-colony');
      expect(game.board.illegalReasonFor(p1, 'ocean-move', cell(game, '06' as SpaceId)), 'an empty reserve is never «ocean-only» for an ocean').eq('unavailable');
    });

    it('the wire model: sources with `tiers: 1`, `arrives: OCEAN` and no card; the disabled ones with their reason', () => {
      const {game, p1} = table();
      seatOcean(game, A);
      const upgraded = seatOcean(game, O2);
      game.addTile(p1, upgraded, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: upgraded.tile});
      const model = tileMovePromptModel(oceanMoveOffer(p1));
      expect(model.sources).has.length(1);
      expect(model.sources[0]).deep.include({from: A, tileType: TileType.OCEAN, tiers: 1, arrives: TileType.OCEAN});
      expect(model.sources[0].card).is.undefined;
      expect(model.disabledSources).deep.eq([{spaceId: O2, reason: 'upgraded-ocean'}]);
    });
  });

  describe('MoveOceanTile — the shared step under the ocean\'s rule', () => {
    const SOURCE = CardName.CANYON_CARVING;

    function ask(game: IGame, player: TestPlayer): SelectSpace {
      game.defer(new MoveOceanTile(player, {kind: 'card', card: SOURCE}));
      runAllActions(game);
      return cast(player.popWaitingFor(), SelectSpace);
    }

    it('offers the union of every ocean\'s destinations and carries the marker, the kind, the tile and the address', () => {
      const {game, p1} = table();
      seatOcean(game, A);
      const prompt = ask(game, p1);
      expect(prompt.title).eq(MOVE_OCEAN_TILE_TITLE);
      expect(prompt.placementType).eq('ocean-move');
      expect(prompt.tileType).eq(TileType.OCEAN);
      expect(prompt.placementEffect).eq('move');
      expect(prompt.sourceCard).eq(SOURCE);
      expect(ids(prompt.spaces)).deep.eq(ids(oceanMoveDestinations(oceanMoveOffer(p1))));
      expect(prompt.tileMove?.sources.map((s) => s.from.id)).deep.eq([A]);
      expect(prompt.illegalSpaces?.find((e) => e.spaceId === '06')?.reason, 'a far reserve').eq('not-adjacent-to-the-ocean');
      expect(prompt.illegalSpaces?.find((e) => e.spaceId === game.board.noctisCitySpaceId)?.reason).eq('reserved-noctis');
    });

    it('a SINGLE ocean with a SINGLE cell is still asked — never auto-moved', () => {
      const {game, p1, p2} = table();
      const from = seatOcean(game, A);
      for (const n of game.board.getAdjacentSpaces(from)) {
        if (n.id === B_OCEAN) {
          continue;
        }
        if (n.spaceType === SpaceType.OCEAN) {
          seatOcean(game, n.id);
          // …and wall that ocean in too, so it is no source of its own.
          for (const nn of game.board.getAdjacentSpaces(n)) {
            if (nn.tile === undefined && nn.id !== A && nn.id !== B_OCEAN) {
              game.simpleAddTile(p2, nn, {tileType: TileType.GREENERY});
            }
          }
        } else if (n.tile === undefined) {
          game.simpleAddTile(p2, n, {tileType: TileType.GREENERY});
        }
      }
      const prompt = ask(game, p1);
      expect(prompt.tileMove?.sources.filter((s) => s.from.id === A).map((s) => ids(s.to))).deep.eq([[B_OCEAN]]);
      expect(from.tile?.tileType, 'nothing moved by itself').eq(TileType.OCEAN);
      expect(cell(game, B_OCEAN).tile).is.undefined;
    });

    it('NO MOVE AT ALL is a named skip — the degrade of a board that moved under the play', () => {
      const {game, p1} = table();
      game.defer(new MoveOceanTile(p1, {kind: 'card', card: SOURCE}));
      runAllActions(game);
      expect(p1.getWaitingFor()).is.undefined;
      const skips = game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
      expect(skips).deep.eq([{label: OCEAN_MOVE_LABEL, reason: NO_SPACE_TO_MOVE_AN_OCEAN_REASON}]);
    });

    it('the answer names BOTH cells and moves the ocean atomically; the refusals name the OCEAN, never a city', () => {
      const {game, p1} = table();
      const from = seatOcean(game, A);
      const prompt = ask(game, p1);
      expect(() => prompt.process({type: 'space', spaceId: B_OCEAN})).to.throw('A move must name the ocean tile that moves');
      expect(() => prompt.process({type: 'space', spaceId: B_OCEAN, movedFrom: B_LAND})).to.throw('This ocean tile cannot be moved to that space');
      expect(() => prompt.process({type: 'space', spaceId: '06', movedFrom: A})).to.throw('This ocean tile cannot be moved to that space');
      expect(from.tile?.tileType).eq(TileType.OCEAN);
      prompt.process({type: 'space', spaceId: B_OCEAN, movedFrom: A});
      expect(from.tile).is.undefined;
      expect(cell(game, B_OCEAN).tile?.tileType).eq(TileType.OCEAN);
    });

    it('`Board.isOceanSpace` and the count still read the moved ocean — the parameter is the board', () => {
      const {game, p1} = table();
      seatOcean(game, A);
      const prompt = ask(game, p1);
      prompt.process({type: 'space', spaceId: B_LAND, movedFrom: A});
      expect(Board.isOceanSpace(cell(game, B_LAND))).is.true;
      expect(game.board.getOceanSpaces().length).eq(1);
    });
  });
});
