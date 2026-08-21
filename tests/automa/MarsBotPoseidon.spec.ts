import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {FAILED_ACTION_MC, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaColonies} from '../../src/server/automa/AutomaColonies';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** A live Poseidon game. Colonies are on, or the corporation could not be seated. */
function poseidonGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C33_POSEIDON): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, coloniesExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function positions(game: IGame): Array<number> {
  return game.automa!.board.tracks.map((t) => t.position);
}

/** A colony the HUMAN can still settle. */
function freeColony(game: IGame, human: IPlayer) {
  const colony = game.colonies.find((c) => c.isActive && !c.isFull() && !c.colonies.includes(human.id));
  expect(colony, 'the table always has a spare tile at this point').is.not.undefined;
  return colony!;
}

describe('MarsBot Poseidon (C33)', () => {
  describe('the printed card', () => {
    it('prints no tag, no priority and a Colonies condition', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C33_POSEIDON);
      expect(info.original).eq(CardName.POSEIDON);
      expect(info.cardNumber).eq('C33');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.requiresModules).deep.eq(['colonies']);
      expect(info.requiresAnyModule).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.whiteMarkerTracks).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });
  });

  describe('the SETUP box — «MarsBot builds a colony»', () => {
    it('founds one, entirely through the shared colony machinery', () => {
      const [game, , bot] = poseidonGame('-ps-setup');
      expect(AutomaColonies.botColonyCount(game), 'exactly one colony').eq(1);
      const settled = game.colonies.find((c) => c.colonies.includes(bot.id));
      expect(settled, 'and the tile really carries it').is.not.undefined;
    });

    it('«INCLUDING DURING SETUP OF THIS CARD» — that colony has already paid it', () => {
      // The corporation is seated BEFORE its Setup box runs, so the colony the
      // box builds reaches its own effect. That order is the whole reason the
      // printed clause is true, and it costs no code.
      const [game] = poseidonGame('-ps-setup-pays');
      expect(stat(game, 'poseidonBotColonies')).eq(1);
      expect(stat(game, 'poseidonSteps'), 'one colony, one step').eq(1);
      expect(positions(game)[THARSIS_TRACK.BUILDING],
        'and with an untouched mat the topmost track is the least advanced').eq(1);
    });

    it('another corporation founds nothing', () => {
      const [game] = poseidonGame('-ps-setup-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaColonies.botColonyCount(game)).eq(0);
      expect(game.automa!.corpStats['poseidonBotColonies']).is.undefined;
    });
  });

  describe('the EFFECT — «when YOU or MarsBot build a colony»', () => {
    it('a colony the HUMAN builds advances the bot\'s least-advanced track', () => {
      const [game, human] = poseidonGame('-ps-human');
      const before = positions(game);
      const builds = stat(game, 'poseidonHumanColonies');

      freeColony(game, human).addColony(human);

      const after = positions(game);
      expect(stat(game, 'poseidonHumanColonies'), 'counted on the opponent\'s side').eq(builds + 1);
      expect(stat(game, 'poseidonSteps')).eq(2); // …plus the setup's own.
      expect(after.some((p, i) => p > before[i]), 'a track really moved').is.true;
    });

    it('«topmost if tied» — the setup left track 0 on #1, so the next one goes to track 1', () => {
      const [game, human] = poseidonGame('-ps-topmost');
      expect(positions(game)[THARSIS_TRACK.BUILDING], 'the setup step').eq(1);

      freeColony(game, human).addColony(human);

      expect(positions(game)[THARSIS_TRACK.SPACE],
        'space was the topmost of the tracks still on 0').is.greaterThan(0);
      expect(positions(game)[THARSIS_TRACK.BUILDING], 'and the building track was left alone').eq(1);
    });

    it('a colony the BOT builds pays exactly the same', () => {
      const [game] = poseidonGame('-ps-bot');
      const builds = stat(game, 'poseidonBotColonies');
      const steps = stat(game, 'poseidonSteps');

      expect(AutomaColonies.botBuildColony(game), 'a spare tile was available').is.true;

      expect(stat(game, 'poseidonBotColonies')).eq(builds + 1);
      expect(stat(game, 'poseidonSteps')).eq(steps + 1);
    });

    it('a mat with every track finished takes the ordinary Failed Action', () => {
      const [game, human, bot] = poseidonGame('-ps-maxed');
      for (const track of game.automa!.board.tracks) {
        track.position = track.maxPosition;
      }
      const steps = stat(game, 'poseidonSteps');
      const mc = bot.megaCredits;

      freeColony(game, human).addColony(human);

      expect(stat(game, 'poseidonHumanColonies'), 'the trigger still fired').eq(1);
      expect(stat(game, 'poseidonSteps'), 'but no step landed').eq(steps);
      expect(bot.megaCredits - mc, 'the shared Failed Action paid instead').eq(FAILED_ACTION_MC);
    });

    it('another corporation collects nothing from either seat', () => {
      const [game, human] = poseidonGame('-ps-other', MarsBotCorpId.C01_CREDICOR);
      const before = positions(game);

      freeColony(game, human).addColony(human);
      AutomaColonies.botBuildColony(game);

      expect(positions(game), 'no track moved for the colonies themselves').deep.eq(before);
      expect(game.automa!.corpStats['poseidonSteps']).is.undefined;
    });
  });

  describe('state', () => {
    it('the counters and the founded colony survive a save/load round trip', () => {
      const [game, human] = poseidonGame('-ps-serialize');
      freeColony(game, human).addColony(human);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C33_POSEIDON);
      expect(restored.automa!.corpStats['poseidonSteps']).eq(2);
      expect(AutomaColonies.botColonyCount(restored), 'its own colony is still on the tile').eq(1);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = poseidonGame('-ps-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C33_POSEIDON);
    });
  });
});
