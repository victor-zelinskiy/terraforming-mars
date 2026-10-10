import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {boardCellPreview, withHypotheticalMove} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact, BoardPlacementPreview} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceId} from '../../src/common/Types';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Capital} from '../../src/server/cards/base/Capital';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {quietResolutionOf, seatResolution} from '../parliament/parliamentArrange';

/**
 * THE PREVIEW OF AN OCEAN MOVE (Turmoil Redux TR39 Canyon Carving,
 * `kind: 'ocean-move'`) — its two readings: the SOURCE (may this ocean move,
 * where, and which Capital loses by its leaving) and the DESTINATION (what
 * the cell gives with the ocean already lifted off its old one — the move's
 * own TR, the cell's bonus, the OTHER oceans' adjacency, the parties, the
 * Capitals — and what the old cell stops giving). Every number is read off
 * the engine's own rule sources under the commit's own lift; the ocean
 * parameter's line never appears, because the count does not change.
 *
 * The geometry is Tharsis's own (see tests/boards/oceanMove.spec.ts): A (33)
 * beside B₁ (34, a reserve), B₂ (42, plant land) and C (24, land beside A
 * and neither B); O₂ (43) beside both B and never A.
 */
const A = '33' as SpaceId;
const B_OCEAN = '34' as SpaceId;
const B_LAND = '42' as SpaceId;
const O2 = '43' as SpaceId;
const CAPITAL_CELL = '24' as SpaceId;
/** Land beside B₂ (42) and A (33) alike — a Capital here keeps its count through the move. */
const BOTH_CELL = '41' as SpaceId;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer};

function table(options?: {redux?: boolean}): Table {
  const [game, p1, p2] = testGame(2, options?.redux === true ?
    {turmoilReduxExpansion: true, coloniesExtension: true, aresHazards: false} : {aresHazards: false});
  const adjacent = (a: SpaceId, b: SpaceId) => game.board.getAdjacentSpaces(game.board.getSpaceOrThrow(a)).some((s) => s.id === b);
  expect([adjacent(BOTH_CELL, A), adjacent(BOTH_CELL, B_LAND), adjacent(BOTH_CELL, B_OCEAN)]).deep.eq([true, true, false]);
  return {game, p1, p2};
}

const cell = (game: IGame, id: SpaceId) => game.board.getSpaceOrThrow(id);
const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

function seatOcean(game: IGame, id: SpaceId): Space {
  const space = cell(game, id);
  space.tile = {tileType: TileType.OCEAN};
  space.player = undefined;
  return space;
}

function seatCapital(game: IGame, owner: TestPlayer, id: SpaceId): Space {
  owner.playedCards.push(new Capital());
  const space = cell(game, id);
  game.simpleAddTile(owner, space, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
  return space;
}

function allFacts(preview: BoardPlacementPreview): ReadonlyArray<BoardFact> {
  return [
    ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
    ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
    ...(preview.progressFacts ?? []),
  ];
}

const source = (t: Table, id: SpaceId) => boardCellPreview(t.p1, cell(t.game, id), 'ocean-move');
const destination = (t: Table, from: SpaceId, to: SpaceId) =>
  boardCellPreview(t.p1, cell(t.game, to), 'ocean-move', {movedFrom: cell(t.game, from), sourceCard: CardName.CANYON_CARVING, placementEffect: 'move'});

describe('oceanMovePreview', () => {
  describe('the SOURCE reading (no `movedFrom`)', () => {
    it('a movable ocean: legal, names its destinations as the fact\'s cells, puts nothing down yet', () => {
      const t = table();
      seatOcean(t.game, A);
      const preview = source(t, A);
      expect(preview.kind).eq('ocean-move');
      expect(preview.legal).is.true;
      expect(preview.illegalReason).is.undefined;
      expect(preview.placesTile, 'lifting an ocean puts nothing down yet').is.false;
      const reach = allFacts(preview).find((f) => f.id === 'move-reach')!;
      expect(reach.category).eq('tile-move');
      expect(reach.params).deep.eq(['6']);
      expect(reach.spaces).to.have.members(['24', '25', '34', '42', '41', '32']);
      expect(allFacts(preview).some((f) => f.id === 'move-scores-now'), 'an ocean scores nothing of its own').is.false;
    });

    it('the Capital beside it — ANOTHER player\'s — loses an adjacent ocean: the other player\'s loss is NAMED, under «other players»', () => {
      const t = table();
      seatOcean(t.game, A);
      seatCapital(t.game, t.p2, CAPITAL_CELL);
      const preview = source(t, A);
      const loss = preview.recipientFacts.find((f) => f.id === `move-capital-${CAPITAL_CELL}`)!;
      expect(loss, 'the rival\'s Capital').is.not.undefined;
      expect(loss.title).eq('Capital loses an adjacent ocean');
      expect(loss.recipient).deep.eq({kind: 'tile-owner', color: t.p2.color});
      expect(loss.vp).deep.eq({from: 1, to: 0});
      expect(loss.spaces).deep.eq([CAPITAL_CELL]);
    });

    it('an upgraded ocean, a walled-in ocean and any other cell are NOT legal and state their ONE reason', () => {
      const t = table();
      const upgraded = seatOcean(t.game, O2);
      t.game.addTile(t.p1, upgraded, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: upgraded.tile});
      const walled = seatOcean(t.game, '06' as SpaceId);
      for (const n of t.game.board.getAdjacentSpaces(walled)) {
        if (n.tile === undefined) {
          n.spaceType === SpaceType.OCEAN ? seatOcean(t.game, n.id) : t.game.simpleAddTile(t.p2, n, {tileType: TileType.GREENERY});
        }
      }
      // …and the oceans seated around it must be walled too, else they are sources: enough that 06 itself is not.
      expect(source(t, O2).illegalReason).eq('upgraded-ocean');
      expect(source(t, '06' as SpaceId).illegalReason).eq('ocean-no-space-to-move');
      expect(source(t, B_LAND).illegalReason, 'empty land').eq('not-an-ocean-tile');
      t.game.simpleAddTile(t.p2, cell(t.game, B_LAND), {tileType: TileType.CITY});
      expect(source(t, B_LAND).illegalReason, 'a city').eq('not-an-ocean-tile');
      expect(source(t, B_OCEAN).illegalReason, 'an empty ocean reserve').eq('not-an-ocean-tile');
    });
  });

  describe('the DESTINATION reading (`movedFrom`)', () => {
    it('reads the cell as an ocean placement: its printed bonus, the OTHER oceans\' adjacency only — and NEVER the ocean parameter\'s line', () => {
      const t = table();
      seatOcean(t.game, A);
      seatOcean(t.game, O2);
      const preview = destination(t, A, B_LAND);
      expect(preview.legal).is.true;
      expect(preview.placesTile).is.true;
      const facts = allFacts(preview);
      expect(facts.find((f) => f.id === 'printed-2')?.delta, 'the plant printed on 42').deep.include({icon: 'plants', amount: 1});
      const ocean = facts.find((f) => f.id === 'ocean-adjacency')!;
      expect(ocean.delta?.amount, 'ONE other ocean (O₂) pays — the lifted one beside B is gone').eq(2);
      expect(ocean.spaces).deep.eq([O2]);
      expect(facts.some((f) => f.id === 'effect-ocean'), 'no «raises the ocean parameter»').is.false;
      expect(facts.some((f) => f.id === 'effect-tr-ocean'), 'no parameter TR').is.false;
      expect(facts.some((f) => f.id === 'remove-ocean' || f.id === 'remove-ocean-no-tr'), 'not a removal either').is.false;
      expect(facts.some((f) => f.delta?.icon === 'ocean'), 'no ocean counter line at all').is.false;
    });

    it('the move\'s own TR: +1, named by the relocation — the Greens answer it with 2 M€, Mars First pays its steel for a tile on Mars', () => {
      const t = table({redux: true});
      const parliament = t.game.parliament!;
      ([PartyName.GREENS, PartyName.MARS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      expect(parliament.rulingParty(), 'the starting rule').eq(PartyName.GREENS);
      // Mars First's effect by two of the player's own delegates.
      const mars = parliament.slotOf(PartyName.MARS)!;
      parliament.placeVote(t.p1, mars, 'lobby');
      parliament.placeVote(t.p1, mars, 'reserve');
      expect(parliament.hasPartyEffect(t.p1, PartyName.MARS)).is.true;
      seatOcean(t.game, A);
      const facts = allFacts(destination(t, A, B_OCEAN));
      const tr = facts.find((f) => f.id === 'move-tr')!;
      expect(tr.delta).deep.include({icon: 'tr', amount: 1, current: t.p1.terraformRating, resulting: t.p1.terraformRating + 1});
      expect(tr.reason).eq('Tile relocation');
      expect(facts.find((f) => f.id === 'redux-greens-tr')?.delta).deep.include({icon: 'megacredits', amount: 2});
      expect(facts.find((f) => f.id === 'redux-mars-first-steel')?.delta).deep.include({icon: 'steel', amount: 1});
      expect(facts.some((f) => f.id === 'redux-mars-first-card'), 'an ocean is no city — no card').is.false;
    });

    it('every «ocean tile placed» trigger: another player\'s Arctic Algae stands under «other players»', () => {
      const t = table();
      t.p2.playedCards.push(new ArcticAlgae());
      seatOcean(t.game, A);
      const preview = destination(t, A, B_OCEAN);
      const algae = preview.recipientFacts.find((f) => f.source?.type === 'card' && f.source.id === CardName.ARCTIC_ALGAE)!;
      expect(algae, JSON.stringify(preview.recipientFacts.map((f) => f.id))).is.not.undefined;
      expect(algae.delta).deep.include({icon: 'plants', amount: 2});
    });

    it('the Capitals recount by the move — the player\'s own and ANOTHER player\'s: a loss beside the old cell, a gain beside the new, one calm line beside both', () => {
      const t = table();
      seatOcean(t.game, A);
      seatCapital(t.game, t.p2, CAPITAL_CELL); // beside A only — loses
      seatCapital(t.game, t.p1, BOTH_CELL); // beside A and B₂ — unchanged
      const toLand = allFacts(destination(t, A, B_LAND));
      const loss = toLand.find((f) => f.id === `move-capital-${CAPITAL_CELL}`)!;
      expect(loss.title).eq('Capital loses an adjacent ocean');
      expect(loss.recipient).deep.eq({kind: 'tile-owner', color: t.p2.color});
      expect(loss.vp).deep.eq({from: 1, to: 0});
      expect(loss.category, 'another player\'s recount is scoring, never the mover\'s departure').eq('future-scoring');
      const same = toLand.find((f) => f.id === `move-capital-${BOTH_CELL}`)!;
      expect(same.title).eq('Capital VP');
      expect(same.description).eq('Capital: unchanged, ${0} VP');
      expect(same.params).deep.eq(['1']);
      expect(same.vp, 'no «+0» badge').is.undefined;
      expect(same.recipient).deep.eq({kind: 'current-player'});
      // To the reserve beside C's far side nothing changes for the rival's Capital either… and a Capital beside B only GAINS.
      const t2 = table();
      seatOcean(t2.game, A);
      seatCapital(t2.game, t2.p1, '25' as SpaceId); // 25 touches A and B₁ (34)
      const gainer = seatCapital(t2.game, t2.p2, '26' as SpaceId); // 26 touches B₁ (34), never A
      expect(ids(t2.game.board.getAdjacentSpaces(gainer))).to.include(B_OCEAN);
      const toReserve = allFacts(destination(t2, A, B_OCEAN));
      const gain = toReserve.find((f) => f.id === 'move-capital-26')!;
      expect(gain.title).eq('Capital gains an adjacent ocean');
      expect(gain.vp).deep.eq({from: 0, to: 1});
      expect(gain.recipient).deep.eq({kind: 'tile-owner', color: t2.p2.color});
      expect(toReserve.find((f) => f.id === 'move-capital-25')?.description, 'own Capital beside both').eq('Capital: unchanged, ${0} VP');
    });

    it('the former cell is freed and names the bonus the NEXT tile there collects — to nobody; no «nobody loses TR» line', () => {
      const t = table();
      seatOcean(t.game, A);
      const facts = allFacts(destination(t, A, B_OCEAN));
      const freed = facts.find((f) => f.id === 'move-vacated')!;
      expect(freed.title).eq('The space is freed');
      expect(freed.recipient).deep.eq({kind: 'nobody'});
      expect(freed.delta, 'the two plants printed on A ride as a chip addressed to nobody').deep.include({icon: 'plants', amount: 2});
      expect(freed.spaces).deep.eq([A]);
      expect(facts.some((f) => f.id === 'remove-ocean-no-tr'), 'here TR is gained').is.false;
    });

    it('an illegal destination states its reason: a far cell, the ocean\'s own cell, an occupied neighbour; a source that cannot move → unavailable', () => {
      const t = table();
      seatOcean(t.game, A);
      expect(destination(t, A, '06' as SpaceId).illegalReason).eq('not-adjacent-to-the-ocean');
      expect(destination(t, A, A).illegalReason).eq('occupied');
      t.game.simpleAddTile(t.p2, cell(t.game, B_LAND), {tileType: TileType.GREENERY});
      expect(destination(t, A, B_LAND).illegalReason).eq('occupied');
      expect(destination(t, B_OCEAN, B_LAND).illegalReason, 'no ocean on the cell named').eq('unavailable');
    });
  });

  describe('the hypothesis is exactly undone', () => {
    it('`withHypotheticalMove` on an ocean shows the board after the move and restores both cells', () => {
      const t = table();
      const from = seatOcean(t.game, A);
      const to = cell(t.game, B_OCEAN);
      const tile = from.tile;
      const seen = withHypotheticalMove(t.p1, from, to, () => ({
        fromTile: from.tile, toTile: to.tile?.tileType, toOwner: to.player, oceans: t.game.board.getOceanSpaces().length,
      }));
      expect(seen).deep.eq({fromTile: undefined, toTile: TileType.OCEAN, toOwner: undefined, oceans: 1});
      expect(from.tile, 'the very same tile object').eq(tile);
      expect(to.tile).is.undefined;
      expect(Object.prototype.hasOwnProperty.call(to, 'player') ? to.player : undefined).is.undefined;
    });

    it('is read-only: both readings, over every cell, mutate no game state', () => {
      const t = table({redux: true});
      seatOcean(t.game, A);
      seatOcean(t.game, O2);
      seatCapital(t.game, t.p2, CAPITAL_CELL);
      t.p2.playedCards.push(new ArcticAlgae());
      const before = JSON.stringify(t.game.serialize());
      for (const space of t.game.board.spaces) {
        source(t, space.id);
        destination(t, A, space.id);
      }
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });
});
