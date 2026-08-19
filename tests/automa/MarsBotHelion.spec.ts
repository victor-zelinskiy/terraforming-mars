import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_MARSBOT_BOARD, THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {newProjectCard} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {setTemperature} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/** A live Helion game with the corporation already seated. */
function helionGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C03_HELION): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park a track one space below `position` so the next advance lands on it. */
function armTrack(game: IGame, trackIndex: number, position: number) {
  game.automa!.board.tracks[trackIndex].position = position - 1;
}

describe('MarsBot Helion (C03)', () => {
  describe('the printed SETUP box — cubes seeded on the tracks', () => {
    it('places 6 white and 6 black cubes on the official spaces', () => {
      const cubes = marsBotCorpInfo(MarsBotCorpId.C03_HELION).trackCubes ?? [];
      expect(cubes.filter((c) => c.cubeType === 'white')).has.length(6);
      expect(cubes.filter((c) => c.cubeType === 'black')).has.length(6);

      const [game] = helionGame('-setup');
      const resolved = AutomaCorporations.cubesOf(game);
      // Building #6, Space #9, Science #10, Power #5/#9, Plant #11 — white.
      expect(resolved.filter((c) => c.cubeType === 'white').map((c) => `${c.trackIndex}:${c.position}`).sort())
        .deep.eq([
          `${THARSIS_TRACK.BUILDING}:6`, `${THARSIS_TRACK.SPACE}:9`, `${THARSIS_TRACK.SCIENCE}:10`,
          `${THARSIS_TRACK.ENERGY}:5`, `${THARSIS_TRACK.ENERGY}:9`, `${THARSIS_TRACK.BIO}:11`,
        ].sort());
      // Earth #3, #6, #9, #12, #13, #14 — black.
      const black = resolved.filter((c) => c.cubeType === 'black');
      expect(black.map((c) => c.position).sort((a, b) => a - b)).deep.eq([3, 6, 9, 12, 13, 14]);
      expect(black.every((c) => c.trackIndex === THARSIS_TRACK.EARTH)).is.true;
    });

    it('every WHITE cube sits on a printed temperature space (the effect replaces it)', () => {
      for (const cube of marsBotCorpInfo(MarsBotCorpId.C03_HELION).trackCubes ?? []) {
        if (cube.cubeType !== 'white') {
          continue;
        }
        const track = THARSIS_MARSBOT_BOARD.find((t) => t.tags.includes(cube.tag));
        expect(track?.layout[cube.position], `${cube.tag} #${cube.position}`).eq('temperature');
      }
    });

    it('another corporation seeds no cubes', () => {
      const [game] = helionGame('-nocubes', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
      expect(AutomaCorporations.cubeModels(game)).is.empty;
    });
  });

  describe('WHITE cube — instead of the temperature, MarsBot draws and resolves a card', () => {
    it('draws and resolves a project card and does NOT raise the temperature', () => {
      const [game] = helionGame('-white');
      const automa = game.automa!;
      setTemperature(game, -30);
      game.projectDeck.drawPile.push(newProjectCard(CardName.GENE_REPAIR)!);
      armTrack(game, THARSIS_TRACK.BUILDING, 6);
      const playedBefore = automa.playedPile.length;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(game.getTemperature(), 'the printed temperature raise was replaced').eq(-30);
      expect(automa.playedPile.length, 'a card was drawn and resolved').eq(playedBefore + 1);
      expect(automa.corpStats['whiteCubesHit']).eq(1);
      expect(automa.corpStats['helionCardsDrawn']).eq(1);
      expect(automa.corpStats['helionTemperatureReplaced']).eq(1);
    });

    it('a spent cube never fires again — not even after a regression', () => {
      const [game] = helionGame('-white-once');
      const automa = game.automa!;
      setTemperature(game, -30);
      game.projectDeck.drawPile.push(newProjectCard(CardName.GENE_REPAIR)!);
      armTrack(game, THARSIS_TRACK.BUILDING, 6);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      expect(automa.corpStats['whiteCubesHit']).eq(1);

      // The human pushes the track back down; the bot climbs onto #6 again.
      automa.board.tracks[THARSIS_TRACK.BUILDING].regress();
      const playedBefore = automa.playedPile.length;
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      expect(automa.corpStats['whiteCubesHit'], 'RB-B: a triggered cube never re-arms').eq(1);
      expect(automa.playedPile.length).eq(playedBefore);
    });
  });

  describe('BLACK cube — MarsBot raises the temperature 1 step', () => {
    it('raises the temperature IN ADDITION to the printed icon (Earth #13 = TR)', () => {
      const [game, , bot] = helionGame('-black');
      setTemperature(game, -30);
      const trBefore = bot.terraformRating;
      armTrack(game, THARSIS_TRACK.EARTH, 13);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(game.getTemperature(), 'the cube raised the temperature').eq(-28);
      // Earth #13 prints tr4 — it still resolves (+1 TR for the raise itself).
      expect(bot.terraformRating).eq(trBefore + 4 + 1);
      expect(game.automa!.corpStats['blackCubesHit']).eq(1);
      expect(game.automa!.corpStats['helionTemperatureSteps']).eq(1);
    });

    it('an empty space (Earth #3) raises the temperature all the same', () => {
      const [game] = helionGame('-black-empty');
      setTemperature(game, -30);
      armTrack(game, THARSIS_TRACK.EARTH, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);
      expect(game.getTemperature()).eq(-28);
    });

    it('a completed temperature makes the cube a Failed Action (the shared raise rules)', () => {
      const [game, , bot] = helionGame('-black-maxed');
      setTemperature(game, 8); // Completed.
      const mcBefore = bot.megaCredits;
      armTrack(game, THARSIS_TRACK.EARTH, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);
      expect(game.getTemperature()).eq(8);
      expect(bot.megaCredits, 'the failed-action compensation').eq(mcBefore + 5);
    });
  });

  describe('the model + serialization', () => {
    it('the cube model marks a spent cube and survives a round-trip', () => {
      const [game] = helionGame('-model');
      setTemperature(game, -30);
      game.projectDeck.drawPile.push(newProjectCard(CardName.GENE_REPAIR)!);
      armTrack(game, THARSIS_TRACK.BUILDING, 6);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      const model = AutomaCorporations.cubeModels(game);
      expect(model).has.length(12);
      const spent = model.filter((c) => c.spent);
      expect(spent).has.length(1);
      expect(spent[0]).deep.include({trackIndex: THARSIS_TRACK.BUILDING, position: 6, cubeType: 'white'});

      const restored = Game.deserialize(structuredClone(game.serialize()));
      expect(restored.automa!.corpCubesTriggered.has(`${THARSIS_TRACK.BUILDING}:6`)).is.true;
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent)).has.length(1);
    });

    it('an old save without the field deserializes with no spent cubes', () => {
      const [game] = helionGame('-oldsave');
      const serialized = structuredClone(game.serialize());
      delete serialized.automa!.corpCubesTriggered;
      const restored = Game.deserialize(serialized);
      expect(restored.automa!.corpCubesTriggered.size).eq(0);
    });
  });

  describe('identity', () => {
    it('maps to the original human Helion (art / lore / collision)', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C03_HELION);
      expect(info.original).eq(CardName.HELION);
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.corpBonusCards).is.empty;
    });
  });
});
