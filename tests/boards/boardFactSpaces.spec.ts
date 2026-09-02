import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact, BoardPlacementPreview} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';
import {addCity, addGreenery, addOcean} from '../TestingUtils';
import {AresHandler} from '../../src/server/ares/AresHandler';
import {AresHazards} from '../../src/server/ares/AresHazards';

/**
 * `BoardFact.spaces` — the board cells that make a spatial fact true. The
 * console's on-field relation layer lights EXACTLY these cells, so every
 * spatial fact family must name its participants, and always from the same
 * rule source that computed the fact's own numbers (the facts here are
 * cross-checked against the raw adjacency the rule reads).
 */
describe('BoardFact.spaces (placement relation participants)', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2);
  });

  function emptyLand(predicate: (s: Space) => boolean): Space {
    const space = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
    if (space === undefined) {
      throw new Error('no matching empty land space');
    }
    return space;
  }

  function allFacts(preview: BoardPlacementPreview): ReadonlyArray<BoardFact> {
    return [
      ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
      ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
      ...(preview.progressFacts ?? []),
    ];
  }

  it('the ocean-adjacency fact names the paying oceans', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s)
      .filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).length >= 2);
    const oceans = game.board.getAdjacentSpaces(land)
      .filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).slice(0, 2);
    oceans.forEach((o) => addOcean(player, o.id));

    const fact = boardCellPreview(player, land, 'greenery').immediateFacts
      .find((f) => f.category === 'ocean-adjacency-bonus');
    expect(fact?.spaces).to.have.members(oceans.map((o) => o.id));
  });

  it('a city placement names the greeneries it will score', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s)
      .some((a) => a.spaceType === SpaceType.LAND && a.tile === undefined));
    const green = game.board.getAdjacentSpaces(land)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    addGreenery(player, green.id);

    const fact = boardCellPreview(player, land, 'city').futureScoringFacts
      .find((f) => f.id === 'place-city');
    expect(fact?.spaces).to.have.members([green.id]);
  });

  it('a greenery placement names each adjacent city that scores its owner', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s)
      .some((a) => a.spaceType === SpaceType.LAND && a.tile === undefined));
    const citySpace = game.board.getAdjacentSpaces(land)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    addCity(player2, citySpace.id);

    const preview = boardCellPreview(player, land, 'greenery');
    const fact = allFacts(preview).find((f) => f.id === `place-greenery-city-${citySpace.id}`);
    expect(fact, 'per-city scoring fact').to.not.be.undefined;
    expect(fact?.spaces).to.have.members([citySpace.id]);
  });

  it('a generically-declared Ares adjacency source names its own cell', () => {
    // The engine reads `space.adjacency` GENERICALLY (never "special tile =
    // source"), so a synthetic source exercises the exact production path.
    const [aGame, aPlayer] = testGame(2, {aresExtension: true});
    const land = aGame.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined &&
      aGame.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.LAND && a.adjacency === undefined))!;
    const source = aGame.board.getAdjacentSpaces(land)
      .find((a) => a.spaceType === SpaceType.LAND && a.adjacency === undefined)!;
    source.adjacency = {bonus: [SpaceBonus.STEEL]};

    const fact = boardCellPreview(aPlayer, land, 'greenery').immediateFacts
      .find((f) => f.category === 'ares-adjacency-bonus');
    expect(fact?.spaces).to.have.members([source.id]);
  });

  describe('with Ares hazards on the board', () => {
    let aGame: IGame;
    let aPlayer: TestPlayer;

    beforeEach(() => {
      [aGame, aPlayer] = testGame(2, {aresExtension: true});
    });

    it('the hazard production penalty names the taxing hazards', () => {
      const target = aGame.board.spaces.find((s) =>
        s.spaceType === SpaceType.LAND && s.tile === undefined &&
        aGame.board.getAdjacentSpaces(s).some((a) => AresHandler.hasHazardTile(a)));
      if (target === undefined) {
        throw new Error('no empty land space adjacent to a hazard');
      }
      const hazards = aGame.board.getAdjacentSpaces(target)
        .filter((a) => AresHandler.hasHazardTile(a));

      const fact = boardCellPreview(aPlayer, target, 'greenery').costFacts
        .find((f) => f.id === 'cost-production');
      expect(fact, 'production penalty fact').to.not.be.undefined;
      expect(fact?.spaces).to.have.members(hazards.map((h) => h.id));
    });

    it('the dust-storms-recede planetary event names the wiped storms', () => {
      const hazardData = aGame.aresData!.hazardData;
      const currentOceans = aGame.board.getOceanSpaces().length;
      // Force the threshold onto the NEXT ocean so the preview fires the event.
      hazardData.removeDustStormsOceanCount.threshold = currentOceans + 1;
      hazardData.removeDustStormsOceanCount.available = true;
      // The same filter the mutator walks — the fact must name exactly these.
      const cleared = AresHazards.spacesToClearDustStorms(aGame).map((s) => s.id);
      expect(cleared.length, 'initial dust storms present').to.be.greaterThan(0);

      const ocean = aGame.board.spaces.find((s) =>
        s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      const fact = allFacts(boardCellPreview(aPlayer, ocean, 'ocean'))
        .find((f) => f.id === 'ares-event-dust-storms-recede');
      expect(fact, 'planetary event fact').to.not.be.undefined;
      expect(fact?.spaces).to.have.members(cleared);
    });
  });
});
