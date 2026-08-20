import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {fakeCard} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/** A live Saturn Systems game with the corporation seated (setup already run). */
function saturnGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C08_SATURN_SYSTEMS): [IGame, TestPlayer, IPlayer] {
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

describe('MarsBot Saturn Systems (C08)', () => {
  describe('the printed card', () => {
    it('prints a jovian + three space starting tags and the jovian > space chain', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C08_SATURN_SYSTEMS);
      expect(info.original).eq(CardName.SATURN_SYSTEMS);
      expect(info.cardNumber).eq('C08');
      expect(info.startingTags).deep.eq([Tag.JOVIAN, Tag.SPACE, Tag.SPACE, Tag.SPACE]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.JOVIAN, Tag.SPACE]});
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'effect']);
    });
  });

  describe('«including this» — the printed starting tags', () => {
    it('the starting Jovian tag advances the event track once, the space tags never do', () => {
      const [game] = saturnGame('-sat-setup');
      const automa = game.automa!;
      // Jovian rides the Earth/Power family track; the three space tags climb
      // the space track. Only the Jovian one pays the event track.
      expect(stat(game, 'saturnEventAdvances')).eq(1);
      expect(stat(game, 'saturnFromBot')).eq(1);
      expect(stat(game, 'saturnFromHuman')).eq(0);
      expect(eventTrack(game), 'the event track moved for it').is.greaterThan(0);
      expect(automa.board.tracks[THARSIS_TRACK.SPACE].position, 'three space tags').is.at.least(3);
    });

    it('another corporation gets no event-track bonus at all', () => {
      const [game] = saturnGame('-sat-other', MarsBotCorpId.C01_CREDICOR);
      expect(eventTrack(game)).eq(0);
      expect(game.automa!.corpStats['saturnEventAdvances']).is.undefined;
    });
  });

  describe('the EFFECT — MarsBot resolves a Jovian tag', () => {
    it('advances the event track, on top of what the tag itself did', () => {
      const [game] = saturnGame('-sat-bot-tag');
      const automa = game.automa!;
      automa.board.tracks[THARSIS_TRACK.EVENT].position = 3;
      const energy = automa.board.tracks[THARSIS_TRACK.ENERGY].position;
      const before = stat(game, 'saturnEventAdvances');

      AutomaResolver.resolveTag(game, Tag.JOVIAN);

      expect(automa.board.tracks[THARSIS_TRACK.ENERGY].position,
        'the Jovian tag still advanced its own track').is.greaterThan(energy);
      expect(eventTrack(game), 'and the corporation added the event track').is.greaterThan(3);
      expect(stat(game, 'saturnEventAdvances')).eq(before + 1);
      expect(stat(game, 'saturnFromBot')).eq(before + 1);
    });

    it('any other tag leaves the event track alone', () => {
      const [game] = saturnGame('-sat-bot-other-tag');
      game.automa!.board.tracks[THARSIS_TRACK.EVENT].position = 3;
      const before = stat(game, 'saturnEventAdvances');

      AutomaResolver.resolveTag(game, Tag.PLANT);

      expect(eventTrack(game)).eq(3);
      expect(stat(game, 'saturnEventAdvances')).eq(before);
    });
  });

  describe('the EFFECT — a HUMAN plays a Jovian card', () => {
    it('advances the bot\'s event track from across the table', () => {
      const [game, human] = saturnGame('-sat-human');
      game.automa!.board.tracks[THARSIS_TRACK.EVENT].position = 3;
      const before = stat(game, 'saturnEventAdvances');

      human.playCard(fakeCard({name: 'Jovian Probe' as CardName, tags: [Tag.JOVIAN]}));

      expect(eventTrack(game)).is.greaterThan(3);
      expect(stat(game, 'saturnEventAdvances')).eq(before + 1);
      expect(stat(game, 'saturnFromHuman')).eq(1);
    });

    it('a card with TWO Jovian tags still advances it once — the card is the trigger', () => {
      const [game, human] = saturnGame('-sat-human-double');
      game.automa!.board.tracks[THARSIS_TRACK.EVENT].position = 3;
      const before = stat(game, 'saturnEventAdvances');

      human.playCard(fakeCard({name: 'Double Jupiter' as CardName, tags: [Tag.JOVIAN, Tag.JOVIAN]}));

      expect(stat(game, 'saturnEventAdvances'), 'one card, one advance').eq(before + 1);
    });

    it('a card without a Jovian tag does nothing', () => {
      const [game, human] = saturnGame('-sat-human-none');
      game.automa!.board.tracks[THARSIS_TRACK.EVENT].position = 3;
      const before = stat(game, 'saturnEventAdvances');

      human.playCard(fakeCard({name: 'Just Plants' as CardName, tags: [Tag.PLANT, Tag.SPACE]}));

      expect(eventTrack(game)).eq(3);
      expect(stat(game, 'saturnEventAdvances')).eq(before);
    });

    it('another corporation ignores the human\'s Jovian card', () => {
      const [game, human] = saturnGame('-sat-human-other', MarsBotCorpId.C01_CREDICOR);
      game.automa!.board.tracks[THARSIS_TRACK.EVENT].position = 3;

      human.playCard(fakeCard({name: 'Jovian Probe 2' as CardName, tags: [Tag.JOVIAN]}));

      expect(eventTrack(game)).eq(3);
      expect(game.automa!.corpStats['saturnFromHuman']).is.undefined;
    });
  });

  describe('the shared rules still apply', () => {
    it('a completed event track turns the bonus into the official Failed Action', () => {
      const [game, human, bot] = saturnGame('-sat-maxed');
      const track = game.automa!.board.tracks[THARSIS_TRACK.EVENT];
      track.position = track.maxPosition;
      const mcBefore = bot.megaCredits;

      human.playCard(fakeCard({name: 'Jovian Probe 3' as CardName, tags: [Tag.JOVIAN]}));

      expect(track.position).eq(track.maxPosition);
      expect(bot.megaCredits, 'the Failed Action compensation').eq(mcBefore + 5);
      expect(stat(game, 'saturnEventAdvances'), 'the corporation still fired').is.greaterThan(0);
    });

    it('the counters survive a save/load round trip', () => {
      const [game] = saturnGame('-sat-serialize');
      const advances = stat(game, 'saturnEventAdvances');
      const restored = Game.deserialize(structuredClone(game.serialize()));
      expect(restored.automa!.corporation).eq(MarsBotCorpId.C08_SATURN_SYSTEMS);
      expect(restored.automa!.corpStats['saturnEventAdvances']).eq(advances);
    });
  });
});
