import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, setOxygenLevel} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact, BoardPlacementPreview} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SolarFarm} from '../../src/server/cards/ares/SolarFarm';
import {MiningRights} from '../../src/server/cards/base/MiningRights';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';

/**
 * The CARD-AWARE half of the placement preview: what the card driving the
 * placement does about the cell being pointed at, and what every player's
 * tile-placement triggers pay out. Before this layer existed the panel could only
 * describe the cell (printed bonus, ocean adjacency, cost), so a card whose whole
 * point is WHERE it goes — Solar Farm, Mining Rights — said nothing at all.
 */
describe('placement preview: card-driven facts', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2);
  });

  function allFacts(preview: BoardPlacementPreview): ReadonlyArray<BoardFact> {
    return [
      ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
      ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
      ...(preview.progressFacts ?? []),
    ];
  }

  function emptyLandWith(g: IGame, predicate: (s: Space) => boolean): Space {
    const space = g.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
    if (space === undefined) {
      throw new Error('no matching empty land space');
    }
    return space;
  }

  function countBonus(space: Space, bonus: SpaceBonus): number {
    return space.bonus.filter((b) => b === bonus).length;
  }

  describe('Solar Farm — energy production per plant bonus on the chosen area', () => {
    it('threads its card name onto the placement prompt', () => {
      const card = new SolarFarm();
      card.play(player);
      runAllActions(game);
      const selectSpace = cast(player.popWaitingFor(), SelectSpace);
      expect(selectSpace.sourceCard).to.eq(CardName.SOLAR_FARM);
      // Also reaches the console task summary, which reads placementContext.source.
      expect(selectSpace.placementContext?.source?.card).to.eq(CardName.SOLAR_FARM);
    });

    it('previews the exact energy production the chosen area grants', () => {
      const space = emptyLandWith(game, (s) => countBonus(s, SpaceBonus.PLANT) > 0);
      const plants = countBonus(space, SpaceBonus.PLANT);
      const preview = boardCellPreview(player, space, 'land',
        {tileType: TileType.SOLAR_FARM, sourceCard: CardName.SOLAR_FARM});

      const fact = allFacts(preview).find((f) => f.source?.id === CardName.SOLAR_FARM && f.delta?.production === true);
      expect(fact, 'an energy production fact from Solar Farm').to.not.be.undefined;
      expect(fact!.delta!.icon).to.eq('energy');
      expect(fact!.delta!.amount).to.eq(plants);
      expect(fact!.delta!.direction).to.eq('gain');
      // `current → resulting`, not a bare sign.
      expect(fact!.delta!.current).to.eq(player.production.energy);
      expect(fact!.delta!.resulting).to.eq(player.production.energy + plants);
    });

    it('names the skipped effect on an area with no plant bonus (no silent nothing)', () => {
      const space = emptyLandWith(game, (s) => countBonus(s, SpaceBonus.PLANT) === 0);
      const preview = boardCellPreview(player, space, 'land',
        {tileType: TileType.SOLAR_FARM, sourceCard: CardName.SOLAR_FARM});

      const fact = allFacts(preview).find((f) => f.source?.id === CardName.SOLAR_FARM);
      expect(fact, 'an explicit "no production here" note').to.not.be.undefined;
      expect(fact!.delta, 'never a +0 chip').to.be.undefined;
    });

    it('the preview magnitude equals what the commit actually grants', () => {
      const space = emptyLandWith(game, (s) => countBonus(s, SpaceBonus.PLANT) > 0);
      const preview = boardCellPreview(player, space, 'land',
        {tileType: TileType.SOLAR_FARM, sourceCard: CardName.SOLAR_FARM});
      const promised = allFacts(preview).find((f) => f.delta?.production === true)!.delta!.amount;

      const card = new SolarFarm();
      card.play(player);
      runAllActions(game);
      const before = player.production.energy;
      cast(player.popWaitingFor(), SelectSpace).cb(space);
      runAllActions(game);

      expect(player.production.energy - before).to.eq(promised);
    });

    it('explains the adjacency bonus its tile will grant neighbours (Ares)', () => {
      const [aresGame, aresPlayer] = testGame(2, {aresExtension: true});
      const space = aresGame.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      const preview = boardCellPreview(aresPlayer, space, 'land',
        {tileType: TileType.SOLAR_FARM, sourceCard: CardName.SOLAR_FARM});

      const fact = preview.ruleFacts.find((f) => f.source?.id === CardName.SOLAR_FARM && f.delta?.icon === 'energy');
      expect(fact, 'the 2-energy adjacency bonus this tile will hand out').to.not.be.undefined;
      expect(fact!.delta!.amount).to.eq(2);
    });

    it('says nothing about adjacency when Ares is off', () => {
      const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      const preview = boardCellPreview(player, space, 'land',
        {tileType: TileType.SOLAR_FARM, sourceCard: CardName.SOLAR_FARM});
      expect(preview.ruleFacts.some((f) => f.id.startsWith('place-adj-'))).is.false;
    });
  });

  describe('Mining Rights — which production depends on the area', () => {
    it('previews the single matching production for a steel-only area', () => {
      const space = emptyLandWith(game, (s) =>
        s.bonus.includes(SpaceBonus.STEEL) && !s.bonus.includes(SpaceBonus.TITANIUM));
      const preview = boardCellPreview(player, space, 'land', {sourceCard: CardName.MINING_RIGHTS});

      const facts = allFacts(preview).filter((f) => f.source?.id === CardName.MINING_RIGHTS);
      expect(facts).has.length(1);
      expect(facts[0].delta!.icon).to.eq('steel');
      expect(facts[0].delta!.production).is.true;
    });

    it('shows BOTH branches when the area prints steel and titanium', () => {
      const space = game.board.spaces.find((s) =>
        s.tile === undefined && s.bonus.includes(SpaceBonus.STEEL) && s.bonus.includes(SpaceBonus.TITANIUM));
      if (space === undefined) {
        return; // this map prints no dual-bonus cell
      }
      const preview = boardCellPreview(player, space, 'land', {sourceCard: CardName.MINING_RIGHTS});
      const facts = allFacts(preview).filter((f) => f.source?.id === CardName.MINING_RIGHTS);
      const icons = facts.filter((f) => f.delta !== undefined).map((f) => f.delta!.icon);
      expect(icons).to.have.members(['steel', 'titanium']);
      // The player must know a follow-up will ask — never a surprise modal.
      expect(facts.some((f) => f.timing === 'on-confirm')).is.true;
    });

    it('threads its card name onto the bespoke placement prompt', () => {
      const card = new MiningRights();
      const selectSpace = cast(card.play(player), SelectSpace);
      expect(selectSpace.sourceCard).to.eq(CardName.MINING_RIGHTS);
    });
  });

  describe('what OTHER players receive from your placement', () => {
    it("an opponent's Arctic Algae takes 2 plants off your ocean", () => {
      player2.playedCards.push(new ArcticAlgae());
      const ocean = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      const preview = boardCellPreview(player, ocean, 'ocean', {tileType: TileType.OCEAN});

      const fact = preview.recipientFacts.find((f) => f.source?.id === CardName.ARCTIC_ALGAE);
      expect(fact, "the opponent's Arctic Algae gain").to.not.be.undefined;
      expect(fact!.recipient).to.deep.eq({kind: 'player', color: player2.color});
      expect(fact!.delta!.icon).to.eq('plants');
      expect(fact!.delta!.amount).to.eq(2);
    });

    it("an opponent's Tharsis Republic takes M€ production off your city", () => {
      player2.playedCards.push(new TharsisRepublic());
      const city = game.board.getAvailableSpacesForCity(player)[0];
      const preview = boardCellPreview(player, city, 'city', {tileType: TileType.CITY});

      const facts = preview.recipientFacts.filter((f) => f.source?.id === CardName.THARSIS_REPUBLIC);
      // The +3 M€ is for the PLACING player only, so an opponent gets production only.
      expect(facts).has.length(1);
      expect(facts[0].delta!.production).is.true;
      expect(facts[0].recipient).to.deep.eq({kind: 'player', color: player2.color});
    });

    it('two players holding the same card do not collide on a fact id', () => {
      player.playedCards.push(new ArcticAlgae());
      player2.playedCards.push(new ArcticAlgae());
      const ocean = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      const preview = boardCellPreview(player, ocean, 'ocean', {tileType: TileType.OCEAN});

      const ids = allFacts(preview).filter((f) => f.source?.id === CardName.ARCTIC_ALGAE).map((f) => f.id);
      expect(ids).has.length(2);
      expect(new Set(ids).size, 'ids are unique per owner').to.eq(2);
    });
  });

  describe('global-parameter chain', () => {
    it('a greenery that reaches 8% oxygen also previews the free temperature step', () => {
      setOxygenLevel(game, 7);
      const space = game.board.getAvailableSpacesForGreenery(player)[0];
      const preview = boardCellPreview(player, space, 'greenery', {tileType: TileType.GREENERY});
      const ids = allFacts(preview).map((f) => f.id);

      expect(ids, 'the 8% bonus step is named').to.include('effect-oxygen-chain');
      expect(ids, 'and the temperature it raises').to.include('effect-oxygen-bonus-temperature');
      expect(ids, 'and the TR that step awards').to.include('effect-oxygen-bonus-tr-temperature');
    });

    it('a greenery below the bonus step previews oxygen only', () => {
      setOxygenLevel(game, 3);
      const space = game.board.getAvailableSpacesForGreenery(player)[0];
      const ids = allFacts(boardCellPreview(player, space, 'greenery', {tileType: TileType.GREENERY})).map((f) => f.id);
      expect(ids).to.include('effect-oxygen');
      expect(ids).to.not.include('effect-oxygen-chain');
    });
  });

  describe('milestone / award progress', () => {
    it('a greenery advances the greenery milestone and shows the threshold', () => {
      const space = game.board.getAvailableSpacesForGreenery(player)[0];
      const preview = boardCellPreview(player, space, 'greenery', {tileType: TileType.GREENERY});

      const gardener = (preview.progressFacts ?? []).find((f) => f.id === 'milestone-Gardener');
      expect(gardener, 'Gardener progress').to.not.be.undefined;
      expect(gardener!.progress).to.deep.eq({from: 0, to: 1, target: 3});
    });

    it('an ocean advances no tile-ownership milestone (an ocean belongs to nobody)', () => {
      const ocean = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      const preview = boardCellPreview(player, ocean, 'ocean', {tileType: TileType.OCEAN});
      expect((preview.progressFacts ?? []).some((f) => f.id === 'award-Landlord')).is.false;
    });

    it('the hypothetical tile is fully restored (the engine stays read-only)', () => {
      const space = game.board.getAvailableSpacesForGreenery(player)[0];
      const before = JSON.stringify(game.board.serialize());

      boardCellPreview(player, space, 'greenery', {tileType: TileType.GREENERY});

      expect(space.tile).to.be.undefined;
      expect(space.player).to.be.undefined;
      expect(JSON.stringify(game.board.serialize())).to.eq(before);
    });
  });

  describe('special-tile adjacency VP is previewed, not only explained after the fact', () => {
    it('Capital shows the VP its adjacent oceans will score', () => {
      const ocean = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      game.simpleAddTile(player2, ocean, {tileType: TileType.OCEAN});
      const next = game.board.getAdjacentSpaces(ocean)
        .find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;

      const preview = boardCellPreview(player, next, 'city', {tileType: TileType.CAPITAL});
      const fact = preview.futureScoringFacts.find((f) => f.id === 'place-capital');
      expect(fact, 'Capital ocean VP at the moment of choosing').to.not.be.undefined;
      expect(fact!.vp).to.deep.eq({from: 0, to: 1});
    });
  });
});
