import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaScoring} from '../../src/server/automa/AutomaScoring';
import {isBlueActionCard} from '../../src/server/automa/corps/MarsBotViron';
import {newProjectCard} from '../../src/server/createCard';
import {isIActionCard} from '../../src/server/cards/ICard';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** A blue card WITH a red arrow, and one without — both from the real corpus. */
const WITH_ARROW = CardName.WATER_IMPORT_FROM_EUROPA;
const BLUE_NO_ARROW = CardName.ARCTIC_ALGAE;
const NOT_BLUE = CardName.MINE;
/** What one qualifying card is worth. */
const VP_PER_CARD = 1;

/** A live Viron game. Venus is on, or the corporation could not be seated. */
function vironGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C25_VIRON): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame(
    {corporation, venusNextExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Viron (C25)', () => {
  describe('the printed card', () => {
    it('prints a microbe starting tag, no priority and an OR module condition', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C25_VIRON);
      expect(info.original).eq(CardName.VIRON);
      expect(info.cardNumber).eq('C25');
      expect(info.startingTags).deep.eq([Tag.MICROBE]);
      expect(info.draftPriority, 'no priority plate is printed').is.undefined;
      expect(info.requiresModules, 'the condition is an OR, not an AND').is.undefined;
      expect(info.requiresAnyModule).deep.eq(['venus', 'colonies']);
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });

    it('EITHER module satisfies it — and neither leaves it out of the pool', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C25_VIRON);
      const ok = (e: Record<string, boolean>) => AutomaCorporations.hasRequiredModules(info, e);
      expect(ok({venus: true}), 'Venus alone').is.true;
      expect(ok({colonies: true}), 'Colonies alone').is.true;
      expect(ok({venus: true, colonies: true}), 'both').is.true;
      expect(ok({prelude: true}), 'neither').is.false;
      expect(ok({}), 'a plain game').is.false;
    });

    it('an AND condition is untouched by the new field', () => {
      const valley = marsBotCorpInfo(MarsBotCorpId.C16_VALLEY_TRUST);
      expect(AutomaCorporations.hasRequiredModules(valley, {prelude: true})).is.true;
      expect(AutomaCorporations.hasRequiredModules(valley, {venus: true})).is.false;
    });
  });

  describe('«a blue card with a red arrow» is the engine\'s own predicate', () => {
    it('accepts a blue card that has an action', () => {
      const card = newProjectCard(WITH_ARROW)!;
      expect(card.type).eq(CardType.ACTIVE);
      expect(isIActionCard(card), 'the very test the human Viron uses').is.true;
      expect(isBlueActionCard(card)).is.true;
    });

    it('refuses a blue card with only an effect box', () => {
      const card = newProjectCard(BLUE_NO_ARROW)!;
      expect(card.type).eq(CardType.ACTIVE);
      expect(isBlueActionCard(card), 'no arrow, no credit').is.false;
    });

    it('refuses a card that is not blue at all', () => {
      expect(isBlueActionCard(newProjectCard(NOT_BLUE)!)).is.false;
    });
  });

  describe('the EFFECT — a floater per qualifying card', () => {
    it('resolving one hands the bot a floater', () => {
      const [game] = vironGame('-vi-floater');
      const before = game.automa!.floaters;

      AutomaCorporations.onProjectCardResolving(game, newProjectCard(WITH_ARROW)!);

      expect(game.automa!.floaters).eq(before + 1);
      expect(stat(game, 'vironActionCards')).eq(1);
      expect(stat(game, 'vironFloaters')).eq(1);
    });

    it('a blue card without an arrow hands it nothing', () => {
      const [game] = vironGame('-vi-noarrow');
      const before = game.automa!.floaters;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(BLUE_NO_ARROW)!);
      expect(game.automa!.floaters).eq(before);
      expect(stat(game, 'vironActionCards')).eq(0);
    });

    it('a non-blue card hands it nothing', () => {
      const [game] = vironGame('-vi-notblue');
      const before = game.automa!.floaters;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(NOT_BLUE)!);
      expect(game.automa!.floaters).eq(before);
    });

    it('the floaters land in the ONE pool the bot already had', () => {
      const [game] = vironGame('-vi-pool');
      game.automa!.floaters = 5;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(WITH_ARROW)!);
      expect(game.automa!.floaters, 'the same counter Titan and the Venus cell fill').eq(6);
    });

    it('another corporation gains nothing from the same card', () => {
      const [game] = vironGame('-vi-other', MarsBotCorpId.C01_CREDICOR);
      const before = game.automa!.floaters;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(WITH_ARROW)!);
      expect(game.automa!.floaters).eq(before);
      expect(game.automa!.corpStats['vironActionCards']).is.undefined;
    });
  });

  describe('the EFFECT — the endgame clause', () => {
    it('scores 1 VP per qualifying card in the played pile', () => {
      const [game] = vironGame('-vi-score');
      game.automa!.playedPile = [WITH_ARROW, BLUE_NO_ARROW, NOT_BLUE, WITH_ARROW];

      expect(AutomaCorporations.endgameVictoryPoints(game)).eq(2 * VP_PER_CARD);
    });

    it('an empty pile scores nothing', () => {
      const [game] = vironGame('-vi-score-empty');
      game.automa!.playedPile = [];
      expect(AutomaCorporations.endgameVictoryPoints(game)).eq(0);
    });

    it('the term reaches the bot\'s VP breakdown and its total', () => {
      const [game, , bot] = vironGame('-vi-breakdown');
      game.automa!.playedPile = [WITH_ARROW, WITH_ARROW, WITH_ARROW];

      const parts = AutomaScoring.automaVictoryPoints(game);
      expect(parts.corpVp).eq(3);

      const breakdown = bot.getVictoryPoints();
      expect(breakdown.automa!.corpVp, 'the same number the server sends').eq(3);
      expect(breakdown.total, 'and it is inside the total').is.at.least(3);
    });

    it('the endgame clause NEVER mutates state — it is read from the pile', () => {
      const [game] = vironGame('-vi-pure');
      game.automa!.playedPile = [WITH_ARROW, WITH_ARROW];
      const floaters = game.automa!.floaters;
      const stats = JSON.stringify(game.automa!.corpStats);

      AutomaCorporations.endgameVictoryPoints(game);
      AutomaCorporations.endgameVictoryPoints(game);

      expect(game.automa!.floaters, 'scoring is not a play').eq(floaters);
      expect(JSON.stringify(game.automa!.corpStats)).eq(stats);
      expect(AutomaCorporations.endgameVictoryPoints(game), 'and it is stable').eq(2);
    });

    it('another corporation scores no corporation VP', () => {
      const [game] = vironGame('-vi-score-other', MarsBotCorpId.C01_CREDICOR);
      game.automa!.playedPile = [WITH_ARROW, WITH_ARROW];
      expect(AutomaCorporations.endgameVictoryPoints(game)).eq(0);
      expect(AutomaScoring.automaVictoryPoints(game).corpVp).eq(0);
    });
  });

  describe('state', () => {
    it('the floaters and the counters survive a save/load round trip', () => {
      const [game] = vironGame('-vi-serialize');
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(WITH_ARROW)!);
      const floaters = game.automa!.floaters;

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C25_VIRON);
      expect(restored.automa!.floaters).eq(floaters);
      expect(restored.automa!.corpStats['vironActionCards']).eq(1);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = vironGame('-vi-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C25_VIRON);
    });
  });
});
