import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {MarketingExperts} from '../../src/server/cards/ares/MarketingExperts';

describe('BoardInformationEngine — Ares', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  function allFacts(preview: ReturnType<typeof boardCellPreview>): ReadonlyArray<BoardFact> {
    return [
      ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
      ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
    ];
  }

  function emptyLand(): Space {
    const s = game.board.spaces.find((x) => x.spaceType === SpaceType.LAND && x.tile === undefined);
    if (s === undefined) throw new Error('no empty land');
    return s;
  }

  it('adjacency bonus: placing next to an Ares tile credits the placer AND the tile owner', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    // An opponent's tile with a +1 M€ adjacency bonus.
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};

    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const facts = allFacts(boardCellPreview(player, place, 'greenery'));

    const mine = facts.find((f) => f.category === 'ares-adjacency-bonus');
    expect(mine, 'ares-adjacency-bonus for the placer').to.not.be.undefined;
    expect(mine!.recipient.kind).to.eq('current-player');
    expect(mine!.delta?.icon).to.eq('megacredits');

    const owner = facts.find((f) => f.category === 'tile-owner-benefit');
    expect(owner, 'tile-owner-benefit').to.not.be.undefined;
    expect(owner!.recipient).to.deep.eq({kind: 'tile-owner', color: player2.color});
    expect(owner!.delta?.amount).to.eq(1);
  });

  it('Marketing Experts doubles the adjacent tile owner M€ benefit', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
    player2.playedCards.push(new MarketingExperts()); // tableau.has(MARKETING_EXPERTS) → owner bonus doubles

    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const owner = allFacts(boardCellPreview(player, place, 'greenery')).find((f) => f.category === 'tile-owner-benefit');
    expect(owner!.delta?.amount).to.eq(2);
  });

  it('hazard hover: shows identity, cleanup reward (+TR) and the adjacency penalty', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const hz = emptyLand();
    hz.tile = {tileType: TileType.EROSION_SEVERE, protectedHazard: false};

    const facts = boardCellInfo(player, hz).facts;
    const identity = facts.find((f) => f.id === 'hazard-identity');
    expect(identity?.title).to.eq('Erosion');
    const reward = facts.find((f) => f.id === 'hazard-cleanup-reward');
    expect(reward?.delta).to.deep.include({icon: 'tr', amount: 2, direction: 'gain'});
    expect(facts.some((f) => f.id === 'hazard-adjacency')).to.be.true;
  });

  it('hazard cleanup preview: building on a hazard surfaces the +TR cleanup reward', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const hz = emptyLand();
    hz.tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};

    const cleanup = allFacts(boardCellPreview(player, hz, 'greenery')).find((f) => f.category === 'hazard-cleanup');
    expect(cleanup?.delta).to.deep.include({icon: 'tr', amount: 1, direction: 'gain'});
  });

  it('no leak: a non-Ares game produces NO ares-adjacency facts even if adjacency data is present', () => {
    [game, player, player2] = testGame(2); // Ares OFF
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const facts = allFacts(boardCellPreview(player, place, 'greenery'));
    expect(facts.some((f) => f.category === 'ares-adjacency-bonus' || f.category === 'tile-owner-benefit')).to.be.false;
  });

  it('placing next to a hazard surfaces the FORCED production-loss amount (with params)', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const hz = emptyLand();
    hz.tile = {tileType: TileType.EROSION_SEVERE, protectedHazard: false}; // severe → 2 production
    const place = game.board.getAdjacentSpaces(hz).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;

    const prod = boardCellPreview(player, place, 'city').costFacts.find((f) => f.id === 'cost-production');
    expect(prod, 'forced production-loss cost fact').to.not.be.undefined;
    expect(prod!.title).to.eq('Reduce production by ${0}');
    expect(prod!.params).to.deep.eq(['2']); // severe adjacent hazard
    expect(prod!.severity).to.eq('danger');
  });

  it('hovering an adjacency-SOURCE tile explains the neighbour bonus AND the owner benefit', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const src = emptyLand();
    src.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    src.player = player2;
    src.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};

    const facts = boardCellInfo(player, src).facts;
    const neighbour = facts.find((f) => f.category === 'ares-adjacency-bonus');
    expect(neighbour, 'neighbour adjacency-bonus fact').to.not.be.undefined;
    expect(neighbour!.delta?.icon).to.eq('megacredits');
    const owner = facts.find((f) => f.category === 'tile-owner-benefit');
    expect(owner, 'owner benefit fact').to.not.be.undefined;
    expect(owner!.recipient).to.deep.eq({kind: 'tile-owner', color: player2.color});
    expect(owner!.delta?.amount).to.eq(1);
  });

  it('is READ-ONLY: hover + preview on hazard/adjacency cells mutate nothing', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const hz = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== place.id)!;
    hz.tile = {tileType: TileType.EROSION_MILD, protectedHazard: false};

    const tr = player.terraformRating;
    const mc = player.megaCredits;
    const ownerMc = player2.megaCredits;
    boardCellInfo(player, hz);
    boardCellPreview(player, place, 'greenery');
    boardCellPreview(player, hz, 'greenery');
    expect(player.terraformRating).to.eq(tr);
    expect(player.megaCredits).to.eq(mc);
    expect(player2.megaCredits).to.eq(ownerMc);
  });
});
