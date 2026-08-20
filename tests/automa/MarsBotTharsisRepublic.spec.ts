import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Board} from '../../src/server/boards/Board';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const HUMAN_CITY_MC = 2;

/** A live Tharsis Republic game with the corporation seated (setup already run). */
function republicGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C10_THARSIS_REPUBLIC): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function eventTrack(game: IGame): number {
  return game.automa!.board.tracks[THARSIS_TRACK.EVENT].position;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function botCities(game: IGame): number {
  return game.board.spaces.filter((s) => Board.isCitySpace(s) && s.player?.isMarsBot === true).length;
}

/** A free land space the human can build on. */
function freeLand(game: IGame) {
  return game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId)!;
}

describe('MarsBot Tharsis Republic (C10)', () => {
  describe('the printed card', () => {
    it('prints a city draft priority and no starting tags', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C10_THARSIS_REPUBLIC);
      expect(info.original).eq(CardName.THARSIS_REPUBLIC);
      expect(info.cardNumber).eq('C10');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.CITY]});
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the SETUP box — «these effects also apply to setup»', () => {
    it('places a city AND pushes the event track for it', () => {
      const [game] = republicGame('-tr10-setup');
      expect(botCities(game), 'the setup city is on the board').eq(1);
      expect(stat(game, 'tharsisBotCities'), 'and it triggered the corporation').eq(1);
      expect(eventTrack(game), 'the event track moved for it').is.greaterThan(0);
    });

    it('another corporation places no city and pushes nothing', () => {
      const [game] = republicGame('-tr10-other', MarsBotCorpId.C01_CREDICOR);
      expect(botCities(game)).eq(0);
      expect(eventTrack(game)).eq(0);
      expect(game.automa!.corpStats['tharsisBotCities']).is.undefined;
    });
  });

  describe('the EFFECT — a HUMAN city pays MarsBot 2 M€', () => {
    it('pays when the human founds a city', () => {
      const [game, human, bot] = republicGame('-tr10-human');
      const before = bot.megaCredits;

      game.addCity(human, freeLand(game));

      expect(bot.megaCredits).eq(before + HUMAN_CITY_MC);
      expect(stat(game, 'tharsisHumanCities')).eq(1);
      expect(stat(game, 'tharsisMc')).eq(HUMAN_CITY_MC);
    });

    it('a human city does NOT push the event track', () => {
      const [game, human] = republicGame('-tr10-human-track');
      const track = eventTrack(game);

      game.addCity(human, freeLand(game));

      expect(eventTrack(game)).eq(track);
      expect(stat(game, 'tharsisBotCities'), 'still only the setup city').eq(1);
    });

    it('a human GREENERY pays nothing — the trigger is a city', () => {
      const [game, human, bot] = republicGame('-tr10-greenery');
      const before = bot.megaCredits;

      game.addGreenery(human, freeLand(game));

      expect(bot.megaCredits).eq(before);
      expect(stat(game, 'tharsisHumanCities')).eq(0);
    });

    it('another corporation ignores the human city', () => {
      const [game, human, bot] = republicGame('-tr10-human-other', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      game.addCity(human, freeLand(game));
      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['tharsisHumanCities']).is.undefined;
    });
  });

  describe('the EFFECT — a MarsBot city pushes the event track', () => {
    it('advances the track and pays no M€ for its own city', () => {
      const [game, , bot] = republicGame('-tr10-bot-city');
      const track = eventTrack(game);
      const mc = bot.megaCredits;
      const cities = stat(game, 'tharsisBotCities');

      game.addCity(bot, freeLand(game));

      expect(eventTrack(game)).is.greaterThan(track);
      expect(stat(game, 'tharsisBotCities')).eq(cities + 1);
      expect(stat(game, 'tharsisHumanCities'), 'its own city never pays the human half').eq(0);
      expect(bot.megaCredits, 'no 2 M€ for its own city (placement bonuses aside)').is.at.least(mc);
    });

    it('a completed event track turns it into the official Failed Action', () => {
      const [game, , bot] = republicGame('-tr10-maxed');
      const track = game.automa!.board.tracks[THARSIS_TRACK.EVENT];
      track.position = track.maxPosition;
      const before = bot.megaCredits;

      game.addCity(bot, freeLand(game));

      expect(track.position).eq(track.maxPosition);
      expect(bot.megaCredits, 'the Failed Action compensation').is.at.least(before + 5);
      expect(stat(game, 'tharsisBotCities')).is.greaterThan(1);
    });
  });

  describe('state', () => {
    it('the counters survive a save/load round trip', () => {
      const [game, human] = republicGame('-tr10-serialize');
      game.addCity(human, freeLand(game));
      const humanCities = stat(game, 'tharsisHumanCities');
      const botCityCount = stat(game, 'tharsisBotCities');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C10_THARSIS_REPUBLIC);
      expect(restored.automa!.corpStats['tharsisHumanCities']).eq(humanCities);
      expect(restored.automa!.corpStats['tharsisBotCities']).eq(botCityCount);
      expect(restored.board.spaces.some((s) => s.tile?.tileType === TileType.CITY)).is.true;
    });
  });
});
