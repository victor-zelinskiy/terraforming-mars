import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {newProjectCard} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {setTemperature} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const SETUP_MC = 10;

/** A live ThorGate game with the corporation seated (setup already run). */
function thorgateGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C11_THORGATE): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the power track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = position - 1;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function trackPosition(game: IGame, index: number): number {
  return game.automa!.board.tracks[index].position;
}

describe('MarsBot ThorGate (C11)', () => {
  describe('the printed card', () => {
    it('prints a power starting tag, a Power draft priority and four white cubes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C11_THORGATE);
      expect(info.original).eq(CardName.THORGATE);
      expect(info.cardNumber).eq('C11');
      expect(info.startingTags).deep.eq([Tag.POWER]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.POWER]});
      const cubes = info.trackCubes ?? [];
      expect(cubes).has.length(4);
      expect(cubes.every((c) => c.cubeType === 'white' && c.tag === Tag.POWER)).is.true;
      expect(cubes.map((c) => c.position)).deep.eq([4, 6, 8, 10]);
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the SETUP box', () => {
    it('hands MarsBot 10 M€ and seeds the four cubes on the power track', () => {
      const [game, , bot] = thorgateGame('-tg-setup');
      expect(bot.megaCredits).is.at.least(SETUP_MC);
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(4);
      expect(cubes.every((c) => c.trackIndex === THARSIS_TRACK.ENERGY)).is.true;
      expect(cubes.map((c) => c.position).sort((a, b) => a - b)).deep.eq([4, 6, 8, 10]);
      // The printed starting POWER tag climbed that same track.
      expect(trackPosition(game, THARSIS_TRACK.ENERGY)).is.greaterThan(0);
    });

    it('another corporation seeds no cubes and gets no money', () => {
      const [game, , bot] = thorgateGame('-tg-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
      expect(bot.megaCredits).eq(0);
    });
  });

  describe('the EFFECT — a white cube flips a card by its FIRST tag only', () => {
    it('resolves only the first printed tag, then raises the temperature', () => {
      const [game] = thorgateGame('-tg-cube');
      const automa = game.automa!;
      setTemperature(game, -30);
      // Arctic Algae prints ONE plant tag and its track cell is empty — the
      // card contributes nothing but the tag itself.
      game.projectDeck.drawPile.push(newProjectCard(CardName.ARCTIC_ALGAE)!);
      const science = trackPosition(game, THARSIS_TRACK.SCIENCE);
      armCube(game, 4);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.ENERGY);

      expect(automa.playedPile, 'the card was played').contains(CardName.ARCTIC_ALGAE);
      expect(game.getTemperature(), 'and the temperature followed').eq(-28);
      expect(trackPosition(game, THARSIS_TRACK.SCIENCE), 'no science track movement from this card').eq(science);
      expect(stat(game, 'thorgateCubesHit')).eq(1);
      expect(stat(game, 'thorgateCardsDrawn')).eq(1);
      expect(stat(game, 'thorgateTemperatureSteps')).eq(1);
    });

    it('IGNORES every tag after the first', () => {
      const [game] = thorgateGame('-tg-firsttag');
      const automa = game.automa!;
      setTemperature(game, -30);
      // Space Elevator prints space + building: only the FIRST may move.
      const card = newProjectCard(CardName.SPACE_ELEVATOR)!;
      expect(AutomaResolver.printedTags(card)).deep.eq([Tag.SPACE, Tag.BUILDING]);
      game.projectDeck.drawPile.push(card);
      const space = trackPosition(game, THARSIS_TRACK.SPACE);
      const building = trackPosition(game, THARSIS_TRACK.BUILDING);
      armCube(game, 6);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.ENERGY);

      expect(trackPosition(game, THARSIS_TRACK.SPACE), 'the first tag advanced').is.greaterThan(space);
      expect(trackPosition(game, THARSIS_TRACK.BUILDING), 'the ignored building tag moved nothing').eq(building);
      expect(automa.playedPile).contains(CardName.SPACE_ELEVATOR);
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = thorgateGame('-tg-once');
      const automa = game.automa!;
      setTemperature(game, -30);
      game.projectDeck.drawPile.push(newProjectCard(CardName.ARCTIC_ALGAE)!);
      armCube(game, 8);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.ENERGY);
      expect(stat(game, 'thorgateCubesHit')).eq(1);

      automa.board.tracks[THARSIS_TRACK.ENERGY].regress();
      game.projectDeck.drawPile.push(newProjectCard(CardName.ARCTIC_ALGAE)!);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.ENERGY);

      expect(stat(game, 'thorgateCubesHit'), 'RB-B: a triggered cube never re-arms').eq(1);
    });

    it('a completed temperature makes the closing raise a Failed Action', () => {
      const [game, , bot] = thorgateGame('-tg-maxed');
      setTemperature(game, 8); // Completed.
      game.projectDeck.drawPile.push(newProjectCard(CardName.ARCTIC_ALGAE)!);
      const mcBefore = bot.megaCredits;
      // Power #8 prints nothing — the only money that can move here is the
      // Failed Action's own compensation.
      armCube(game, 8);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.ENERGY);

      expect(game.getTemperature()).eq(8);
      expect(bot.megaCredits, 'the failed-action compensation').eq(mcBefore + 5);
      expect(stat(game, 'thorgateTemperatureSteps')).eq(0);
      expect(stat(game, 'thorgateCardsDrawn'), 'the card still resolved').eq(1);
    });
  });

  describe('state', () => {
    it('the spent cube and the counters survive a save/load round trip', () => {
      const [game] = thorgateGame('-tg-serialize');
      setTemperature(game, -30);
      game.projectDeck.drawPile.push(newProjectCard(CardName.ARCTIC_ALGAE)!);
      armCube(game, 4);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.ENERGY);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C11_THORGATE);
      expect(restored.automa!.corpStats['thorgateCubesHit']).eq(1);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent)).has.length(1);
    });
  });
});
