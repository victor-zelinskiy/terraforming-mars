import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {Birds} from '../../src/server/cards/base/Birds';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {GeneRepair} from '../../src/server/cards/base/GeneRepair';
import {Venuphile} from '../../src/server/awards/Venuphile';
import {cast} from '../../src/common/utils/utils';
import {runAllActions, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

describe('Automa bonus cards', () => {
  describe('B01 Meteor Shower', () => {
    it('removes 5 plants; ≥3 removed destroys the card', () => {
      const [game, human] = testAutomaGame();
      human.plants = 7;
      expect(resolve(game, BonusCardId.B01_METEOR_SHOWER)).eq('destroy');
      expect(human.plants).eq(2);
      expect(game.automa!.destroyedBonusCards).contains(BonusCardId.B01_METEOR_SHOWER);
    });

    it('fewer than 3 plants removed → discard', () => {
      const [game, human] = testAutomaGame();
      human.plants = 2;
      expect(resolve(game, BonusCardId.B01_METEOR_SHOWER)).eq('discard');
      expect(human.plants).eq(0);
      expect(game.automa!.bonusDiscard).contains(BonusCardId.B01_METEOR_SHOWER);
    });

    it('Protected Habitats blocks the removal — and still destroys the card (FAQ)', () => {
      const [game, human] = testAutomaGame();
      human.plants = 7;
      human.playedCards.push(new ProtectedHabitats());
      expect(resolve(game, BonusCardId.B01_METEOR_SHOWER)).eq('destroy');
      expect(human.plants).eq(7);
    });
  });

  describe('B02 Invasive Species', () => {
    it('base game: MarsBot gains 5 M€; the human picks the highest-scoring cube to remove', () => {
      const [game, human, bot] = testAutomaGame();
      const birds = new Birds(); // 1 VP per animal.
      birds.resourceCount = 2;
      const tardigrades = new Tardigrades(); // 1 VP per 4 microbes.
      tardigrades.resourceCount = 3;
      human.playedCards.push(birds, tardigrades);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      expect(bot.megaCredits).eq(5);

      runAllActions(game);
      const prompt = cast(human.popWaitingFor(), SelectCard);
      // Only the top-rate cube (Birds, 1 VP) is offered.
      expect(prompt.cards.map((c) => c.name)).deep.eq([CardName.BIRDS]);
      prompt.process({type: 'card', cards: [CardName.BIRDS]});
      expect(birds.resourceCount).eq(1);
      expect(tardigrades.resourceCount).eq(3);
    });

    it('with Venus Next (or Colonies): 2 M€ and 1 floater instead of 5 M€', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      expect(bot.megaCredits).eq(2);
      expect(game.automa!.floaters).eq(1);
    });

    it('no cube to remove: the M€ still flows, no prompt appears', () => {
      const [game, human, bot] = testAutomaGame();
      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);
      expect(bot.megaCredits).eq(5);
      expect(human.getWaitingFor()).is.undefined;
    });
  });

  it('B03 Research and Development: draws and resolves a project card immediately', () => {
    const [game] = testAutomaGame();
    game.projectDeck.drawPile.push(new GeneRepair()); // 1 science tag.
    expect(resolve(game, BonusCardId.B03_RESEARCH_AND_DEVELOPMENT)).eq('discard');
    expect(game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position).eq(2);
    expect(game.automa!.playedPile).contains(CardName.GENE_REPAIR);
  });

  describe('B04 Overachievement', () => {
    it('a successful milestone claim destroys the card', () => {
      const [game, /* human */, bot] = testAutomaGame();
      bot.setTerraformRating(35);
      expect(resolve(game, BonusCardId.B04_OVERACHIEVEMENT)).eq('destroy');
      expect(game.claimedMilestones).has.length(1);
    });

    it('before generation 6 a failed claim pays 5 M€ — no award attempt, never a Failed Action', () => {
      const [game, /* human */, bot] = testAutomaGame({difficulty: 'easy'});
      // Easy would make a FAILED action pay 3 — the printed fallback stays 5.
      expect(resolve(game, BonusCardId.B04_OVERACHIEVEMENT)).eq('discard');
      expect(bot.megaCredits).eq(5);
      expect(game.fundedAwards).is.empty;
    });

    it('from generation 6 a failed claim tries an award; success destroys the card', () => {
      const [game, /* human */, bot] = testAutomaGame();
      game.generation = 6;
      game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 4; // Thermalist 9 vs 0.
      expect(resolve(game, BonusCardId.B04_OVERACHIEVEMENT)).eq('destroy');
      expect(game.fundedAwards).has.length(1);
      expect(bot.megaCredits).eq(0); // Free funding.
    });

    it('both attempts failing pays 5 M€', () => {
      const [game, human, bot] = testAutomaGame();
      game.generation = 6;
      human.heat = 20;
      human.steel = 20; // The human is ahead on the leftover awards.
      expect(resolve(game, BonusCardId.B04_OVERACHIEVEMENT)).eq('discard');
      expect(bot.megaCredits).eq(5);
    });
  });

  describe('B05 Expedited Construction (base)', () => {
    it('places a city adjacent to 2+ greenery/ocean tiles and is destroyed', () => {
      const [game, human, bot] = testAutomaGame();
      // Two adjacent greeneries with a shared empty land neighbor.
      const g1 = game.board.spaces.find((s) =>
        s.spaceType === SpaceType.LAND && s.tile === undefined &&
        game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).length >= 4)!;
      const g2 = game.board.getAdjacentSpaces(g1).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      game.simpleAddTile(human, g1, {tileType: TileType.GREENERY});
      game.simpleAddTile(human, g2, {tileType: TileType.GREENERY});

      expect(resolve(game, BonusCardId.B05_EXPEDITED_CONSTRUCTION)).eq('destroy');
      const city = game.board.spaces.find((s) => s.tile?.tileType === TileType.CITY)!;
      expect(city.player?.id).eq(bot.id);
      const around = game.board.getAdjacentSpaces(city).filter((s) => Board.isGreenerySpace(s) || Board.isOceanSpace(s));
      expect(around.length).greaterThanOrEqual(2);
    });

    it('no qualifying spot: nothing happens, the card is discarded', () => {
      const [game] = testAutomaGame();
      expect(resolve(game, BonusCardId.B05_EXPEDITED_CONSTRUCTION)).eq('discard');
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.CITY)).is.false;
    });
  });

  describe('B06 Lobbyists (base)', () => {
    it('a: temperature 2 steps from a bonus step → +2 steps, destroy', () => {
      const [game, /* human */, bot] = testAutomaGame();
      setTemperature(game, -28); // 2 steps to the −24 heat bonus.
      expect(resolve(game, BonusCardId.B06_LOBBYISTS)).eq('destroy');
      expect(game.getTemperature()).eq(-24);
      expect(bot.megaCredits).eq(2); // The bot's −24 bonus: 2 M€ instead of heat production.
      expect(bot.terraformRating).eq(22);
    });

    it('b: oxygen within 2 steps → a greenery (its oxygen) + 1 more step, destroy', () => {
      const [game, /* human */, bot] = testAutomaGame();
      setTemperature(game, -16); // Temperature branch not applicable.
      setOxygenLevel(game, 12); // 2 steps to completion (14).
      expect(resolve(game, BonusCardId.B06_LOBBYISTS)).eq('destroy');
      expect(game.getOxygenLevel()).eq(14);
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id)).is.true;
      expect(bot.terraformRating).eq(22);
    });

    it('c: an empty ocean-reserved space adjacent to 2 oceans → place the ocean there, destroy', () => {
      const [game, human] = testAutomaGame();
      setTemperature(game, -16);
      setOxygenLevel(game, 9); // 5 steps to completion — branch b not applicable.
      // Find an empty ocean space with two ocean-space neighbors and fill those.
      const target = game.board.spaces.find((s) =>
        s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
        game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN).length >= 2)!;
      const neighbors = game.board.getAdjacentSpaces(target).filter((a) => a.spaceType === SpaceType.OCEAN);
      game.simpleAddTile(human, neighbors[0], {tileType: TileType.OCEAN});
      game.simpleAddTile(human, neighbors[1], {tileType: TileType.OCEAN});

      expect(resolve(game, BonusCardId.B06_LOBBYISTS)).eq('destroy');
      expect(target.tile?.tileType).eq(TileType.OCEAN);
    });

    it('d: otherwise advance the parameter furthest from completion (ties: oxygen first); NOT destroyed', () => {
      const [game, /* human */, bot] = testAutomaGame();
      setTemperature(game, -20); // 14 steps left — tied with oxygen (14 left).
      expect(resolve(game, BonusCardId.B06_LOBBYISTS)).eq('discard');
      expect(game.getOxygenLevel()).eq(1); // Oxygen wins the tie.
      expect(bot.terraformRating).eq(21); // Usual TR.
    });
  });

  describe('B07 Local Neural Instance', () => {
    it('places the tile away from edges, tiles and reserved spaces; always destroyed', () => {
      const [game, /* human */, bot] = testAutomaGame();
      expect(resolve(game, BonusCardId.B07_LOCAL_NEURAL_INSTANCE)).eq('destroy');
      const spaceId = game.automa!.neuralInstanceSpaceId!;
      expect(spaceId).is.not.undefined;
      const space = game.board.getSpaceOrThrow(spaceId);
      expect(space.tile?.tileType).eq(TileType.NEURAL_INSTANCE);
      const adjacent = game.board.getAdjacentSpaces(space);
      expect(adjacent).has.length(6); // Not an edge.
      expect(adjacent.every((a) => a.tile === undefined)).is.true;
      expect(adjacent.every((a) => a.spaceType !== SpaceType.OCEAN)).is.true;
      expect(space.player?.id).eq(bot.id);
    });

    it('cannot be placed → draws and resolves a project card instead; still destroyed', () => {
      const [game, human] = testAutomaGame();
      // Fill every empty land space so no legal spot remains.
      for (const space of game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)) {
        game.simpleAddTile(human, space, {tileType: TileType.CITY});
      }
      game.projectDeck.drawPile.push(new GeneRepair());
      expect(resolve(game, BonusCardId.B07_LOCAL_NEURAL_INSTANCE)).eq('destroy');
      expect(game.automa!.neuralInstanceSpaceId).is.undefined;
      expect(game.automa!.playedPile).contains(CardName.GENE_REPAIR);
    });
  });

  describe('B08 Corporate Competition (Tharsis)', () => {
    it('with less than 5 M€ nothing happens', () => {
      const [game, human, bot] = testAutomaGame();
      game.fundAward(human, game.awards[0]);
      bot.megaCredits = 4;
      expect(resolve(game, BonusCardId.B08_CORPORATE_COMPETITION)).eq('discard');
      expect(bot.megaCredits).eq(4);
    });

    it('helps its position on the closest funded award and loses 5 M€', () => {
      const [game, human, bot] = testAutomaGame();
      const scientist = game.awards.find((a) => a.name === 'Scientist')!;
      game.fundAward(human, scientist);
      bot.megaCredits = 6;
      resolve(game, BonusCardId.B08_CORPORATE_COMPETITION);
      // The Scientist helper advanced the Science track (0→1 'advance' → 2).
      expect(game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position).eq(2);
      expect(bot.megaCredits).eq(1);
    });

    it('every helper impossible → draws ANOTHER bonus card and resolves it, both discarded', () => {
      const [game, human, bot] = testAutomaGame();
      const scientist = game.awards.find((a) => a.name === 'Scientist')!;
      game.fundAward(human, scientist);
      game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position = 18; // Helper impossible.
      bot.megaCredits = 6;
      bot.setTerraformRating(35); // The drawn Overachievement will claim a milestone.
      game.automa!.bonusDeck = [BonusCardId.B04_OVERACHIEVEMENT];

      resolve(game, BonusCardId.B08_CORPORATE_COMPETITION);
      expect(bot.megaCredits).eq(6); // No help resolved → the 5 M€ was never paid.
      expect(game.claimedMilestones).has.length(1); // The chained B04 resolved.
      expect(game.automa!.destroyedBonusCards).contains(BonusCardId.B04_OVERACHIEVEMENT);
      expect(game.automa!.bonusDeck).is.empty;
    });

    it('the Venuphile helper advances the Venus track (Adding Expansions p.3)', () => {
      const [game, human, bot] = testAutomaGame({venusNextExtension: true});
      const venuphile = game.awards.find((a) => a.name === 'Venuphile') ?? new Venuphile();
      if (!game.awards.includes(venuphile)) {
        game.awards.push(venuphile);
      }
      game.fundAward(human, venuphile);
      bot.megaCredits = 6;
      resolve(game, BonusCardId.B08_CORPORATE_COMPETITION);
      // Venus track 0→1 = 'floater' cell.
      expect(game.automa!.board.tracks[7].position).eq(1);
      expect(game.automa!.floaters).eq(1);
      expect(bot.megaCredits).eq(1);
    });
  });

  describe('B15 Lobbyists (Venus Next)', () => {
    it('the Venus branch: within 2 steps of a bonus → +2 Venus steps, NOT destroyed', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      setTemperature(game, -16);
      setOxygenLevel(game, 9);
      setVenusScaleLevel(game, 4); // 2 steps to the 8% bonus.
      expect(resolve(game, BonusCardId.B15_LOBBYISTS_VENUS)).eq('discard');
      expect(game.getVenusScaleLevel()).eq(8);
      expect(bot.terraformRating).eq(22);
      expect(bot.cardsInHand).is.empty; // The 8% card bonus never reaches the bot (OQ-7).
      expect(game.automa!.bonusDiscard).contains(BonusCardId.B15_LOBBYISTS_VENUS);
    });

    it('falls through to the furthest MARTIAN parameter — never Venus — in branch d', () => {
      const [game] = testAutomaGame({venusNextExtension: true});
      setTemperature(game, -16);
      setOxygenLevel(game, 9);
      setVenusScaleLevel(game, 20); // 5 steps to completion — the Venus branch is off.
      resolve(game, BonusCardId.B15_LOBBYISTS_VENUS);
      expect(game.getVenusScaleLevel()).eq(20);
      expect(game.getTemperature()).eq(-14); // Temperature was furthest (12 left vs O2 5, oceans 9).
    });
  });

  describe('B16 Government Intervention', () => {
    it('odd generation, Venus incomplete: +1 Venus WITHOUT TR; the card recurs (never discarded)', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      expect(game.generation).eq(1);
      resolve(game, BonusCardId.B16_GOVERNMENT_INTERVENTION);
      expect(game.getVenusScaleLevel()).eq(2);
      expect(bot.terraformRating).eq(20); // No TR from this card.
      expect(game.automa!.bonusDiscard).is.empty; // Recurring: back to the holding pool.
      expect(game.phase).is.not.eq('solar'); // The phase was restored.
    });

    it('even generation: advances the furthest Martian parameter without TR or bonus M€', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      game.generation = 2;
      setTemperature(game, -26); // The raise crosses the −24 heat/M€ bonus step.
      resolve(game, BonusCardId.B16_GOVERNMENT_INTERVENTION);
      expect(game.getTemperature()).eq(-24);
      expect(bot.terraformRating).eq(20);
      expect(bot.megaCredits).eq(0); // No M€ from bonuses either.
      expect(game.getVenusScaleLevel()).eq(0);
    });
  });

  it('B17–B20 stay a loud Phase 6 boundary', () => {
    const [game] = testAutomaGame({coloniesExtension: true});
    expect(() => resolveBonusCard(game, BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES)).to.throw(/Automa Phase 6/);
    expect(() => resolveBonusCard(game, BonusCardId.B19_SHIPPING_LINES)).to.throw(/Automa Phase 6/);
  });
});
