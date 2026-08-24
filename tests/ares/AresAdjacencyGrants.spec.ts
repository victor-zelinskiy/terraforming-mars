import {expect} from 'chai';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {MarketingExperts} from '../../src/server/cards/ares/MarketingExperts';
import {EmptyBoard} from '../testing/EmptyBoard';
import {TestPlayer} from '../TestPlayer';
import {fakeCard} from '../TestingUtils';
import {testGame} from '../TestGame';

/**
 * The Ares adjacency PRESENTATION MANIFEST (`game.aresAdjacencyGrants`): the
 * grant path records WHICH neighbour paid WHAT to WHOM, beside the grants
 * themselves, so the console placement scenes can fly each chip from the
 * paying tile. Purely presentational — the money moves through the ordinary
 * grant calls; the manifest only mirrors them.
 */
describe('AresAdjacencyGrants', () => {
  let player: TestPlayer;
  let otherPlayer: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    [game, player, otherPlayer] = testGame(2, {aresExtension: true});
    game.board = EmptyBoard.newInstance();
  });

  it('records one grant per placement: entries per unit + owner payouts', () => {
    const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
    const [firstSpace, secondSpace] = game.board.getAdjacentSpaces(greenerySpace);
    firstSpace.adjacency = {bonus: [SpaceBonus.STEEL]};
    game.addTile(otherPlayer, firstSpace, {tileType: TileType.MINING_RIGHTS});
    secondSpace.adjacency = {bonus: [SpaceBonus.HEAT, SpaceBonus.HEAT]};
    game.addTile(otherPlayer, secondSpace, {tileType: TileType.LAVA_FLOWS});
    // The setup placements may have paid each other — only the placement
    // under test matters here.
    game.aresAdjacencyGrants.length = 0;

    game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});

    expect(game.aresAdjacencyGrants).has.length(1);
    const grant = game.aresAdjacencyGrants[0];
    expect(grant.spaceId).eq(greenerySpace.id);
    expect(grant.placerColor).eq(player.color);
    expect(grant.grants).deep.eq([
      {sourceSpaceId: firstSpace.id, bonus: SpaceBonus.STEEL, delivery: 'stock', resource: Resource.STEEL},
      {sourceSpaceId: secondSpace.id, bonus: SpaceBonus.HEAT, delivery: 'stock', resource: Resource.HEAT},
      {sourceSpaceId: secondSpace.id, bonus: SpaceBonus.HEAT, delivery: 'stock', resource: Resource.HEAT},
    ]);
    expect(grant.ownerPayouts).deep.eq([
      {sourceSpaceId: firstSpace.id, ownerColor: otherPlayer.color, megacredits: 1},
      {sourceSpaceId: secondSpace.id, ownerColor: otherPlayer.color, megacredits: 1},
    ]);
  });

  it('M€ and energy adjacency report their stock channel', () => {
    const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
    const [firstSpace] = game.board.getAdjacentSpaces(greenerySpace);
    firstSpace.adjacency = {bonus: [SpaceBonus.MEGACREDITS, SpaceBonus.ENERGY]};
    game.addTile(otherPlayer, firstSpace, {tileType: TileType.COMMERCIAL_DISTRICT});

    game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});

    expect(game.aresAdjacencyGrants[0].grants).deep.eq([
      {sourceSpaceId: firstSpace.id, bonus: SpaceBonus.MEGACREDITS, delivery: 'stock', resource: Resource.MEGACREDITS},
      {sourceSpaceId: firstSpace.id, bonus: SpaceBonus.ENERGY, delivery: 'stock', resource: Resource.ENERGY},
    ]);
  });

  it('an animal with exactly ONE eligible card reports the target card', () => {
    const host = fakeCard({name: 'AnimalHost' as CardName, resourceType: CardResource.ANIMAL});
    player.playedCards.push(host);
    const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
    const [firstSpace] = game.board.getAdjacentSpaces(greenerySpace);
    firstSpace.adjacency = {bonus: [SpaceBonus.ANIMAL]};
    game.addTile(otherPlayer, firstSpace, {tileType: TileType.OCEAN_SANCTUARY});

    game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});

    expect(host.resourceCount).eq(1);
    expect(game.aresAdjacencyGrants[0].grants).deep.eq([
      {sourceSpaceId: firstSpace.id, bonus: SpaceBonus.ANIMAL, delivery: 'card-resource', cardResource: CardResource.ANIMAL, targetCard: host.name},
    ]);
  });

  it('an animal with SEVERAL eligible cards reports a prompt (no flight)', () => {
    player.playedCards.push(
      fakeCard({name: 'AnimalHostA' as CardName, resourceType: CardResource.ANIMAL}),
      fakeCard({name: 'AnimalHostB' as CardName, resourceType: CardResource.ANIMAL}));
    const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
    const [firstSpace] = game.board.getAdjacentSpaces(greenerySpace);
    firstSpace.adjacency = {bonus: [SpaceBonus.ANIMAL]};
    game.addTile(otherPlayer, firstSpace, {tileType: TileType.OCEAN_SANCTUARY});

    game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});

    const entry = game.aresAdjacencyGrants[0].grants[0];
    expect(entry.delivery).eq('prompt');
    expect(entry.targetCard).is.undefined;
  });

  it('an animal with NO eligible card reports the loss and logs it', () => {
    const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
    const [firstSpace] = game.board.getAdjacentSpaces(greenerySpace);
    firstSpace.adjacency = {bonus: [SpaceBonus.ANIMAL]};
    game.addTile(otherPlayer, firstSpace, {tileType: TileType.OCEAN_SANCTUARY});

    game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});

    expect(game.aresAdjacencyGrants[0].grants[0].delivery).eq('none');
    const loss = game.gameLog.find((m) => m.message === '${0} loses the ${1} adjacency bonus (no card can hold it)');
    expect(loss, 'the skipped effect names itself').is.not.undefined;
  });

  it('a DRAW_CARD adjacency reports draw and the reveal names the paying tile', () => {
    const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
    const [firstSpace] = game.board.getAdjacentSpaces(greenerySpace);
    firstSpace.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
    game.addTile(otherPlayer, firstSpace, {tileType: TileType.RESTRICTED_AREA});

    game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});

    expect(game.aresAdjacencyGrants[0].grants).deep.eq([
      {sourceSpaceId: firstSpace.id, bonus: SpaceBonus.DRAW_CARD, delivery: 'draw'},
    ]);
    const reveal = player.cardDrawReveals[player.cardDrawReveals.length - 1];
    expect(reveal, 'the adjacency draw enqueued a reveal').is.not.undefined;
    expect(reveal!.source).deep.eq({type: 'tile', spaceId: firstSpace.id});
  });

  it('a printed cell DRAW_CARD bonus names the placed cell itself', () => {
    const space = game.board.getAvailableSpacesOnLand(player)
      .find((s) => s.bonus.length === 0)!;
    space.bonus = [SpaceBonus.DRAW_CARD];

    game.addTile(player, space, {tileType: TileType.GREENERY});

    const reveal = player.cardDrawReveals[player.cardDrawReveals.length - 1];
    expect(reveal, 'the cell bonus enqueued a reveal').is.not.undefined;
    expect(reveal!.source).deep.eq({type: 'tile', spaceId: space.id});
  });

  it('Marketing Experts doubles the recorded owner payout', () => {
    otherPlayer.playedCards.push(new MarketingExperts());
    const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
    const [firstSpace] = game.board.getAdjacentSpaces(greenerySpace);
    firstSpace.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
    game.addTile(otherPlayer, firstSpace, {tileType: TileType.NATURAL_PRESERVE});

    game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});

    expect(game.aresAdjacencyGrants[0].ownerPayouts).deep.eq([
      {sourceSpaceId: firstSpace.id, ownerColor: otherPlayer.color, megacredits: 2},
    ]);
  });

  it('a placement with no adjacency neighbours records nothing', () => {
    const space = game.board.getAvailableSpacesOnLand(player)
      .find((s) => s.bonus.length === 0)!;
    game.addTile(player, space, {tileType: TileType.GREENERY});
    expect(game.aresAdjacencyGrants).is.empty;
  });

  it('seq is monotonic and the ring is bounded', () => {
    const spaces = game.board.getAvailableSpacesForGreenery(player);
    let previousSeq = -1;
    let recorded = 0;
    for (const space of spaces) {
      if (recorded >= 10) {
        break;
      }
      const neighbour = game.board.getAdjacentSpaces(space)
        .find((s) => s.tile === undefined && s.adjacency === undefined);
      if (neighbour === undefined || space.tile !== undefined) {
        continue;
      }
      neighbour.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
      game.addTile(otherPlayer, neighbour, {tileType: TileType.NATURAL_PRESERVE});
      game.addTile(player, space, {tileType: TileType.GREENERY});
      recorded++;
      const last = game.aresAdjacencyGrants[game.aresAdjacencyGrants.length - 1];
      expect(last.seq).is.greaterThan(previousSeq);
      previousSeq = last.seq;
    }
    expect(recorded).is.greaterThan(8); // the loop really overflowed the ring
    expect(game.aresAdjacencyGrants.length).is.at.most(8);
  });
});
