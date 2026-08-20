import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {corpOwningBonusCard, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B31 = BonusCardId.B31_GOVERNMENT_SUBSIDY;

/** A live UNMI game with the corporation seated (setup + generation-1 BAP run). */
function unmiGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C12_UNMI): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function bonusEntries(game: IGame): Array<BonusCardId> {
  return game.automa!.actionDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
}

function bonusDeckIds(game: IGame): Array<BonusCardId> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot UNMI (C12) + B31 Government Subsidy', () => {
  describe('the printed card', () => {
    it('prints no tags, no priority — a setup box and a before-action-phase box', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C12_UNMI);
      expect(info.original).eq(CardName.UNITED_NATIONS_MARS_INITIATIVE);
      expect(info.cardNumber).eq('C12');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).deep.eq([B31]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'beforeActionPhase']);
      expect(corpOwningBonusCard(B31)?.id, 'B31 belongs to UNMI').eq(MarsBotCorpId.C12_UNMI);
    });
  });

  describe('the SETUP box', () => {
    it('shuffles Government Subsidy into the bonus deck', () => {
      const [game] = unmiGame('-unmi-shuffle');
      expect(bonusDeckIds(game)).contains(B31);
      expect(game.automa!.recurringBonusCards, 'B31 is NOT recurring').not.contains(B31);
    });

    it('generation 1 keeps NO bonus card — the dealt one goes back to the deck', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C12_UNMI}, '-unmi-nobonus');
      const automa = game.automa!;
      const dealt = bonusEntries(game);
      expect(dealt, 'setup dealt exactly one bonus card').has.length(1);
      const deckBefore = automa.bonusDeck.length;
      const deckSize = automa.actionDeck.length;

      game.playerIsFinishedWithResearchPhase(human);

      expect(bonusEntries(game), 'generation 1 runs on projects alone').is.empty;
      expect(automa.actionDeck.length, 'the deck lost exactly that card').eq(deckSize - 1);
      // The returned card plus B31 — the bonus deck grew by two.
      expect(automa.bonusDeck.length).eq(deckBefore + 2);
      expect(bonusDeckIds(game)).contains(dealt[0]);
    });

    it('another corporation keeps its generation-1 bonus card and never sees B31', () => {
      const [game] = unmiGame('-unmi-other', MarsBotCorpId.C01_CREDICOR);
      expect(bonusEntries(game)).has.length(1);
      expect(bonusDeckIds(game)).not.contains(B31);
    });
  });

  describe('the BEFORE ACTION PHASE box — one EXTRA card from generation 2', () => {
    it('adds nothing in generation 1', () => {
      const [game] = unmiGame('-unmi-gen1');
      expect(game.generation).eq(1);
      expect(stat(game, 'unmiExtraCards')).eq(0);
    });

    it('adds one extra bonus card on top of the generation\'s own', () => {
      const [game] = unmiGame('-unmi-gen2');
      const automa = game.automa!;
      // Enter generation 2 the way the engine does: research builds the deck,
      // then the research → action gate runs the Before-Action-Phase box (the
      // gate itself only fires once EVERY seat has finished, so the spec calls
      // the dispatcher that gate runs).
      game.generation = 2;
      automa.corpBapGeneration = 1;
      AutomaResearch.finishActionDeck(game, []);
      expect(bonusEntries(game), 'the ordinary bonus card').has.length(1);
      const deckBefore = automa.bonusDeck.length;

      AutomaCorporations.onActionPhaseStart(game);

      expect(bonusEntries(game), 'plus the corporation\'s extra one').has.length(2);
      expect(automa.bonusDeck.length).eq(deckBefore - 1);
      expect(stat(game, 'unmiExtraCards')).eq(1);
    });

    it('runs once per generation, never twice', () => {
      const [game] = unmiGame('-unmi-once');
      const automa = game.automa!;
      game.generation = 2;
      automa.corpBapGeneration = 1;
      AutomaResearch.finishActionDeck(game, []);

      AutomaCorporations.onActionPhaseStart(game);
      AutomaCorporations.onActionPhaseStart(game);

      expect(stat(game, 'unmiExtraCards')).eq(1);
      expect(bonusEntries(game)).has.length(2);
    });

    it('an empty bonus deck reshuffles the discard before taking the extra card', () => {
      const [game] = unmiGame('-unmi-reshuffle');
      const automa = game.automa!;
      game.generation = 2;
      automa.corpBapGeneration = 1;
      automa.actionDeck = [];
      automa.bonusDeck = [];
      automa.bonusDiscard = [BonusCardId.B04_OVERACHIEVEMENT];

      AutomaCorporations.onActionPhaseStart(game);

      expect(bonusEntries(game)).deep.eq([BonusCardId.B04_OVERACHIEVEMENT]);
      expect(stat(game, 'unmiExtraCards')).eq(1);
    });
  });

  describe('B31 Government Subsidy', () => {
    it('raises the bot\'s TR one step and goes to the discard', () => {
      const [game, , bot] = unmiGame('-unmi-b31');
      const tr = bot.terraformRating;

      const outcome = resolveBonusCard(game, B31);
      routeBonusCard(game, B31, outcome);

      expect(bot.terraformRating).eq(tr + 1);
      expect(outcome).eq('discard');
      expect(game.automa!.bonusDiscard).contains(B31);
      expect(game.automa!.destroyedBonusCards).not.contains(B31);
      expect(stat(game, 'subsidyTr')).eq(1);
    });

    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = unmiGame('-unmi-foreign');
      expect(() => marsBotCorpInfo(MarsBotCorpId.C12_UNMI) && resolveBonusCard(game, BonusCardId.B23_RAPID_SPROUTING))
        .to.throw();
    });
  });

  describe('state', () => {
    it('the deck contents and counters survive a save/load round trip', () => {
      const [game] = unmiGame('-unmi-serialize');
      game.generation = 2;
      game.automa!.corpBapGeneration = 1;
      AutomaResearch.finishActionDeck(game, []);
      AutomaCorporations.onActionPhaseStart(game);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C12_UNMI);
      expect(restored.automa!.corpStats['unmiExtraCards']).eq(1);
      expect(restored.automa!.actionDeck).deep.eq(game.automa!.actionDeck);
      expect(restored.automa!.bonusDeck).deep.eq(game.automa!.bonusDeck);
    });
  });
});
