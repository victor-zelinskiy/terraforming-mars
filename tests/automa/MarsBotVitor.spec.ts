import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {resolveProjectCardForBot} from '../../src/server/automa/AutomaCardDraw';
import {newProjectCard} from '../../src/server/createCard';
import {fakeCard} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B04 = BonusCardId.B04_OVERACHIEVEMENT;
/** The printed toll. */
const REWARD_MC = 3;

/** A live Vitor game with the corporation seated (setup + generation-1 BAP run). */
function vitorGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C17_VITOR): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function b04InDeck(game: IGame): number {
  return game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B04).length;
}

function bonusDeckIds(game: IGame): Array<BonusCardId> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Vitor (C17)', () => {
  describe('the printed card', () => {
    it('prints no tag, no priority — a setup, an effect and a before-action-phase box', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C17_VITOR);
      expect(info.original).eq(CardName.VITOR);
      expect(info.cardNumber).eq('C17');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.requiresModules).is.undefined;
      // B04 is a BASE bonus card — Vitor borrows it, it does not OWN it.
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'beforeActionPhase']);
    });
  });

  describe('the SETUP box — Overachievement leaves the rotation', () => {
    it('takes B04 out of the bonus deck and out of the discard', () => {
      const [game] = vitorGame('-vt17-aside');
      expect(bonusDeckIds(game), 'never dealt as an ordinary bonus card again').not.contains(B04);
      expect(game.automa!.bonusDiscard).not.contains(B04);
      expect(game.automa!.destroyedBonusCards, 'set aside is not destroyed').not.contains(B04);
    });

    it('a generation-1 slot B04 already held is handed to the next bonus card', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C17_VITOR}, '-vt17-slot');
      const automa = game.automa!;
      // Force the pre-corporation deck into the awkward state the shuffle can
      // deal: B04 IN the one bonus slot. Modelled as the SWAP `AutomaSetup`
      // would have made (it shifts the slot's card off the bonus deck), so no
      // second copy of B04 is invented anywhere.
      const slot = automa.actionDeck.findIndex((e) => e.kind === 'bonus');
      const inBonusDeck = automa.bonusDeck.findIndex((e) => e.kind === 'bonus' && e.id === B04);
      expect(inBonusDeck, 'the fixture needs B04 still in the bonus deck').is.greaterThan(-1);
      automa.bonusDeck[inBonusDeck] = automa.actionDeck[slot];
      automa.actionDeck[slot] = {kind: 'bonus', id: B04};
      const deckSize = automa.actionDeck.length;
      const bonusDeckSize = automa.bonusDeck.length;

      game.playerIsFinishedWithResearchPhase(human);

      // The slot went to another card, and B04 came back as the EXTRA the
      // Before-Action-Phase box adds — one longer, exactly one B04.
      expect(automa.actionDeck.length).eq(deckSize + 1);
      expect(automa.bonusDeck.length).eq(bonusDeckSize - 1);
      expect(b04InDeck(game)).eq(1);
      expect(automa.actionDeck.filter((e) => e.kind === 'bonus')).has.length(2);
    });

    it('another corporation leaves the bonus deck alone', () => {
      const [game] = vitorGame('-vt17-other', MarsBotCorpId.C01_CREDICOR);
      expect(bonusDeckIds(game).concat(game.automa!.actionDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : [])))
        .contains(B04);
    });
  });

  describe('the BEFORE ACTION PHASE box — the standing free claim', () => {
    it('generation 1 already has it, exactly once, and in the recurring pool', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C17_VITOR}, '-vt17-g1');
      expect(b04InDeck(game), 'the deck was built before the corporation existed').eq(0);

      game.playerIsFinishedWithResearchPhase(human);

      expect(b04InDeck(game)).eq(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B04)).has.length(1);
      expect(stat(game, 'vitorOverachievementGenerations')).eq(1);
    });

    it('never duplicates itself, however often the box runs', () => {
      const [game] = vitorGame('-vt17-idempotent');
      for (let i = 0; i < 2; i++) {
        game.automa!.corpBapGeneration = 0;
        AutomaCorporations.onActionPhaseStart(game);
      }
      expect(b04InDeck(game)).eq(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B04)).has.length(1);
    });

    it('comes back in generation 2 through the ordinary deck rebuild', () => {
      const [game] = vitorGame('-vt17-gen2');
      const automa = game.automa!;
      automa.actionDeck = [];
      game.generation = 2;
      automa.corpBapGeneration = 1;

      AutomaResearch.finishActionDeck(game, []);
      AutomaCorporations.onActionPhaseStart(game);

      expect(b04InDeck(game), 'the rebuild already carried it — the box adds nothing').eq(1);
      expect(stat(game, 'vitorOverachievementGenerations')).eq(2);
    });

    it('«unless it has been destroyed»: a destroyed B04 never returns', () => {
      const [game] = vitorGame('-vt17-destroyed');
      const automa = game.automa!;
      // B04 destroyed itself by claiming a milestone.
      automa.actionDeck = automa.actionDeck.filter((e) => !(e.kind === 'bonus' && e.id === B04));
      routeBonusCard(game, B04, 'destroy');
      expect(automa.recurringBonusCards, 'a destroyed card leaves the recurring pool').not.contains(B04);

      game.generation = 2;
      automa.corpBapGeneration = 1;
      AutomaResearch.finishActionDeck(game, []);
      AutomaCorporations.onActionPhaseStart(game);

      expect(b04InDeck(game)).eq(0);
      expect(automa.recurringBonusCards, 'and it is never put back').not.contains(B04);
      expect(stat(game, 'vitorOverachievementGenerations'), 'the counter stops with it').eq(1);
    });

    it('a resolved-but-not-destroyed B04 stays in the holding pool, never in the discard', () => {
      const [game] = vitorGame('-vt17-discardless');
      routeBonusCard(game, B04, 'discard');
      expect(game.automa!.bonusDiscard).not.contains(B04);
      expect(game.automa!.recurringBonusCards).contains(B04);
    });
  });

  describe('the EFFECT — every scoring project pays', () => {
    // Driven through the DISPATCH POINT, like the C01/C05 effect specs: a
    // fully played card would add its own income (a tagless card is a Failed
    // Action worth 5 M€), and this is a spec about the toll, not the turn.
    it('pays 3 M€ for a card with a non-negative VP icon', () => {
      const [game, , bot] = vitorGame('-vt17-pays');
      const before = bot.megaCredits;

      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.ARTIFICIAL_LAKE)!);

      expect(bot.megaCredits).eq(before + REWARD_MC);
      expect(stat(game, 'vitorTriggers')).eq(1);
      expect(stat(game, 'vitorMc')).eq(REWARD_MC);
    });

    it('zero VP still counts — «non-negative» is the printed word', () => {
      const [game, , bot] = vitorGame('-vt17-zero');
      const before = bot.megaCredits;
      AutomaCorporations.onProjectCardResolving(game, fakeCard({name: 'ZeroVp' as CardName, victoryPoints: 0}));
      expect(bot.megaCredits).eq(before + REWARD_MC);
    });

    it('a NEGATIVE icon and a card with no icon at all pay nothing', () => {
      const [game, , bot] = vitorGame('-vt17-negative');
      const before = bot.megaCredits;

      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.NUCLEAR_ZONE)!);
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.MINE)!);

      expect(bot.megaCredits).eq(before);
      expect(stat(game, 'vitorTriggers')).eq(0);
    });

    it('a countable scorer reads by the sign of its own per-unit value', () => {
      const [game, , bot] = vitorGame('-vt17-countable');
      const before = bot.megaCredits;

      AutomaCorporations.onProjectCardResolving(game,
        fakeCard({name: 'PerMicrobe' as CardName, victoryPoints: {resourcesHere: {}, each: 1, per: 2}}));
      AutomaCorporations.onProjectCardResolving(game,
        fakeCard({name: 'PerCity' as CardName, victoryPoints: {cities: {}, all: true, each: -1}}));

      expect(bot.megaCredits, 'only the non-negative one paid').eq(before + REWARD_MC);
      expect(stat(game, 'vitorTriggers')).eq(1);
    });

    it('fires on the REAL play path too, before the card\'s own tags resolve', () => {
      const [game, , bot] = vitorGame('-vt17-realplay');
      const before = bot.megaCredits;

      resolveProjectCardForBot(game, newProjectCard(CardName.ARTIFICIAL_LAKE)!);

      // The card also does its own work (a tag advance, a tile), so only the
      // toll itself is asserted exactly.
      expect(stat(game, 'vitorMc')).eq(REWARD_MC);
      expect(bot.megaCredits).is.at.least(before + REWARD_MC);
      expect(game.automa!.playedPile).contains(CardName.ARTIFICIAL_LAKE);
    });

    it('another corporation pays nothing for the same card', () => {
      const [game, , bot] = vitorGame('-vt17-othercorp', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.ARTIFICIAL_LAKE)!);
      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['vitorTriggers']).is.undefined;
    });
  });

  describe('state', () => {
    it('the pools and the counters survive a save/load round trip', () => {
      const [game] = vitorGame('-vt17-serialize');
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.ARTIFICIAL_LAKE)!);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C17_VITOR);
      expect(restored.automa!.corpStats['vitorMc']).eq(REWARD_MC);
      expect(restored.automa!.corpStats['vitorOverachievementGenerations']).eq(1);
      expect(restored.automa!.recurringBonusCards).contains(B04);
      expect(restored.automa!.bonusDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : [])).not.contains(B04);
    });
  });
});
