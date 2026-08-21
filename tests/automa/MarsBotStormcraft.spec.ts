import {expect} from 'chai';
import * as constants from '../../src/common/constants';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {FAILED_ACTION_MC, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {setTemperature} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** What each box hands the bot. */
const PER_BOX = 1;
/** What the research-phase exchange costs (RB-C p.4). */
const SPEND = 5;

/** A live Stormcraft game. Venus is on, or the corporation could not be seated. */
function stormGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C34_STORMCRAFT): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, venusNextExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

/**
 * Arm the research-phase exchange: enough floaters, and the Hoverlord
 * milestone out of reach. Without Venus Next it is not in the game at all,
 * which is exactly the «no longer available» case — but this game HAS Venus,
 * so the milestone is claimed out of the way instead.
 */
function armSpend(game: IGame, human: TestPlayer) {
  game.automa!.floaters = SPEND;
  for (const milestone of game.milestones.slice(0, 3)) {
    game.claimedMilestones.push({milestone, player: human});
  }
}

describe('MarsBot Stormcraft Incorporated (C34)', () => {
  describe('the printed card', () => {
    it('prints a Jovian starting tag, no priority and an OR module condition', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C34_STORMCRAFT);
      expect(info.original).eq(CardName.STORMCRAFT_INCORPORATED);
      expect(info.cardNumber).eq('C34');
      expect(info.startingTags).deep.eq([Tag.JOVIAN]);
      expect(info.draftPriority, 'no priority plate is printed').is.undefined;
      expect(info.requiresAnyModule).deep.eq(['venus', 'colonies']);
      expect(info.requiresModules).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'roundStart']);
    });

    it('says its shared boxes in EXACTLY C26\'s words — one rule, one phrasing', () => {
      const storm = marsBotCorpInfo(MarsBotCorpId.C34_STORMCRAFT);
      const celestic = marsBotCorpInfo(MarsBotCorpId.C26_CELESTIC);
      const lines = (info: typeof storm, kind: string) =>
        info.sections.find((s) => s.kind === kind)!.lines.map((l) => l.text);
      expect(lines(storm, 'setup'), 'the module condition and the setup floater')
        .deep.eq(lines(celestic, 'setup'));
      expect(lines(storm, 'roundStart')).deep.eq(lines(celestic, 'roundStart'));
      expect(lines(storm, 'effect'), 'but never the effect — that is what they differ in')
        .is.not.deep.eq(lines(celestic, 'effect'));
    });
  });

  describe('the SETUP and ROUND START boxes', () => {
    it('the setup hands the bot one floater', () => {
      const [game] = stormGame('-st-setup');
      expect(stat(game, 'stormcraftSetup')).eq(1);
      expect(game.automa!.floaters).is.at.least(PER_BOX);
    });

    it('the round start hands it one more, once per generation', () => {
      const [game] = stormGame('-st-round');
      game.generation = 2;
      const floaters = game.automa!.floaters;

      AutomaCorporations.onRoundStart(game);
      AutomaCorporations.onRoundStart(game);

      expect(game.automa!.floaters, 'a reload or an undo cannot double it').eq(floaters + PER_BOX);
      expect(stat(game, 'stormcraftRounds')).eq(1);
    });

    it('both feed the ONE pool the exchange later reads', () => {
      const [game] = stormGame('-st-pool');
      game.generation = 2;
      AutomaCorporations.onRoundStart(game);
      expect(stat(game, 'stormcraftFloaters'), 'the card\'s own running total').eq(2);
      expect(game.automa!.floaters).is.at.least(2);
    });

    it('another corporation gets neither', () => {
      const [game] = stormGame('-st-boxes-other', MarsBotCorpId.C01_CREDICOR);
      const floaters = game.automa!.floaters;
      game.generation = 2;

      AutomaCorporations.onRoundStart(game);

      expect(game.automa!.floaters).eq(floaters);
      expect(game.automa!.corpStats['stormcraftFloaters']).is.undefined;
    });
  });

  describe('the EFFECT — «when MarsBot spends floaters to keep an additional card»', () => {
    it('the exchange raises the temperature one step', () => {
      const [game, human] = stormGame('-st-spend');
      armSpend(game, human);
      const temperature = game.getTemperature();

      expect(AutomaResearch.trySpendFloaters(game), 'the exchange really happened').is.true;

      expect(game.automa!.floaters, 'and it really cost five').eq(0);
      expect(game.getTemperature(), 'the printed step').eq(temperature + 2); // 1 step = 2 °C.
      expect(stat(game, 'stormcraftSpends')).eq(1);
      expect(stat(game, 'stormcraftTemperature')).eq(1);
    });

    it('an exchange that CANNOT happen raises nothing', () => {
      const [game] = stormGame('-st-no-spend');
      game.automa!.floaters = SPEND - 1;
      const temperature = game.getTemperature();

      expect(AutomaResearch.trySpendFloaters(game)).is.false;

      expect(game.getTemperature()).eq(temperature);
      expect(game.automa!.corpStats['stormcraftSpends']).is.undefined;
    });

    it('a COMPLETED temperature takes the ordinary Failed Action', () => {
      const [game, human, bot] = stormGame('-st-maxed');
      armSpend(game, human);
      setTemperature(game, constants.MAX_TEMPERATURE);
      const mc = bot.megaCredits;

      expect(AutomaResearch.trySpendFloaters(game)).is.true;

      expect(game.getTemperature()).eq(constants.MAX_TEMPERATURE);
      expect(stat(game, 'stormcraftSpends'), 'the spend still happened').eq(1);
      expect(stat(game, 'stormcraftTemperature'), 'but no step landed').eq(0);
      expect(bot.megaCredits - mc, 'the shared Failed Action paid instead').eq(FAILED_ACTION_MC);
    });

    it('the REAL research-phase build fires it — the wiring, not just the hook', () => {
      const [game, human] = stormGame('-st-wired');
      armSpend(game, human);
      const temperature = game.getTemperature();

      AutomaResearch.buildActionDeck(game);

      expect(stat(game, 'stormcraftSpends'), 'the deck build spent the floaters').eq(1);
      expect(game.getTemperature()).is.greaterThan(temperature);
    });

    it('another corporation spends the same floaters and heats nothing', () => {
      const [game, human] = stormGame('-st-spend-other', MarsBotCorpId.C01_CREDICOR);
      armSpend(game, human);
      const temperature = game.getTemperature();

      expect(AutomaResearch.trySpendFloaters(game)).is.true;

      expect(game.getTemperature()).eq(temperature);
      expect(game.automa!.corpStats['stormcraftSpends']).is.undefined;
    });
  });

  describe('state', () => {
    it('the floaters, the counters and the round marker survive a save/load round trip', () => {
      const [game, human] = stormGame('-st-serialize');
      armSpend(game, human);
      AutomaResearch.trySpendFloaters(game);
      game.generation = 2;
      AutomaCorporations.onRoundStart(game);
      const floaters = game.automa!.floaters;

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C34_STORMCRAFT);
      expect(restored.automa!.floaters).eq(floaters);
      expect(restored.automa!.corpStats['stormcraftSpends']).eq(1);
      expect(restored.automa!.corpRoundStartGeneration,
        'the marker travels, so the round-start box cannot re-pay after a reload').eq(2);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = stormGame('-st-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C34_STORMCRAFT);
    });
  });
});
