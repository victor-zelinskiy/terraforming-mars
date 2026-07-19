import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {IGame} from '../../src/server/IGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {MonsInsurance} from '../../src/server/cards/promo/MonsInsurance';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {AutomaMilestonesAwards} from '../../src/server/automa/AutomaMilestonesAwards';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {Birds} from '../../src/server/cards/base/Birds';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

/** Every human passes, then the game loop runs (the bot flips until it passes). */
function endGeneration(game: IGame, humans: ReadonlyArray<TestPlayer>): void {
  for (const human of humans) {
    human.popWaitingFor();
    game.playerHasPassed(human);
  }
  game.playerIsFinishedTakingActions();
}

// Mode B — multiplayer with Automa (docs/AUTOMA_PROMO_MULTIPLAYER_FRAME.md §12).
describe('Automa multiplayer (mode B)', () => {
  describe('setup (Q1/Q4)', () => {
    it('seats 2 humans + MarsBot; the mode normalizes to multiplayer', () => {
      const [game, humans, bot] = testAutomaMultiplayerGame(2);
      expect(game.players).has.length(3);
      expect(humans).has.length(2);
      expect(bot.isMarsBot).is.true;
      expect(game.gameOptions.automa?.mode).eq('multiplayer');
    });

    it('a solo game normalizes to official-solo', () => {
      const [game] = testAutomaGame();
      expect(game.gameOptions.automa?.mode).eq('official-solo');
    });

    it('4 humans are accepted', () => {
      const [game, humans] = testAutomaMultiplayerGame(4);
      expect(game.players).has.length(5);
      expect(humans).has.length(4);
      expect(game.gameOptions.automa?.mode).eq('multiplayer');
    });

    it('the mode a client sends is overwritten by the seat count', () => {
      const [game] = testAutomaGame({automa: {difficulty: 'normal', mode: 'multiplayer'}});
      expect(game.gameOptions.automa?.mode).eq('official-solo');
    });
  });

  describe('instant-loss is official-solo only (Q3)', () => {
    it('a multiplayer game plays past generation 20', () => {
      const [game, humans] = testAutomaMultiplayerGame(2);
      game.generation = 19;
      endGeneration(game, humans);
      expect(game.phase).not.eq('end');
      expect(game.generation).eq(20);
      expect(game.automa!.instantWin).is.false;
    });
  });

  describe('victim canon (Q9)', () => {
    it('B01 Meteor Shower hits the human with the most plants', () => {
      const [game, [h1, h2]] = testAutomaMultiplayerGame(2);
      h1.plants = 3;
      h2.plants = 7;
      resolve(game, BonusCardId.B01_METEOR_SHOWER);
      expect(h1.plants).eq(3);
      expect(h2.plants).eq(2);
    });

    it('B01 tie goes to the next human after the bot in turn order', () => {
      const [game, [h1, h2]] = testAutomaMultiplayerGame(2);
      h1.plants = 5;
      h2.plants = 5;
      resolve(game, BonusCardId.B01_METEOR_SHOWER);
      expect(h1.plants).eq(0);
      expect(h2.plants).eq(5);
    });

    it('B01 never attacks into the shield while a valid target exists', () => {
      const [game, [h1, h2]] = testAutomaMultiplayerGame(2);
      h1.plants = 2;
      h2.plants = 9;
      h2.playedCards.push(new ProtectedHabitats());
      expect(resolve(game, BonusCardId.B01_METEOR_SHOWER)).eq('discard'); // 2 removed < 3
      expect(h1.plants).eq(0);
      expect(h2.plants).eq(9);
    });

    it('B01: every plant holder protected → nothing removed, card destroyed', () => {
      const [game, [h1, h2]] = testAutomaMultiplayerGame(2);
      h1.plants = 4;
      h1.playedCards.push(new ProtectedHabitats());
      h2.plants = 0;
      expect(resolve(game, BonusCardId.B01_METEOR_SHOWER)).eq('destroy');
      expect(h1.plants).eq(4);
    });

    it('B02 targets the owner of the globally best cube; only that owner is prompted', () => {
      const [game, [h1, h2], bot] = testAutomaMultiplayerGame(2);
      const tardigrades = new Tardigrades(); // rate 0.25
      tardigrades.resourceCount = 3;
      h1.playedCards.push(tardigrades);
      const birds = new Birds(); // rate 1 — the global best.
      birds.resourceCount = 2;
      h2.playedCards.push(birds);
      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);
      expect(h1.getWaitingFor()).is.undefined;
      const prompt = cast(h2.popWaitingFor(), SelectCard);
      expect(prompt.cards.map((c) => c.name)).deep.eq([CardName.BIRDS]);
      prompt.process({type: 'card', cards: [CardName.BIRDS]});
      expect(birds.resourceCount).eq(1);
      expect(tardigrades.resourceCount).eq(3);
      expect(h2.removingPlayers).contains(bot.id);
    });

    it('B02: protection on the best owner moves the attack to the other human', () => {
      const [game, [h1, h2]] = testAutomaMultiplayerGame(2);
      const birds = new Birds();
      birds.resourceCount = 2;
      h2.playedCards.push(birds, new ProtectedHabitats());
      const tardigrades = new Tardigrades();
      tardigrades.resourceCount = 3;
      h1.playedCards.push(tardigrades);
      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);
      expect(h2.getWaitingFor()).is.undefined;
      const prompt = cast(h1.popWaitingFor(), SelectCard);
      expect(prompt.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
    });
  });

  describe('MA tiebreakers against the BEST human (Q12)', () => {
    it('an award is funded only when the bot leads EVERY human', () => {
      const [game, [h1, h2]] = testAutomaMultiplayerGame(2);
      game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 4; // Thermalist: bot = 4 + 5.
      h1.heat = 0;
      h2.heat = 20; // The best human out-heats the bot.
      h2.steel = 10; // Miner (bot = Space + 5 = 5) is out-led too.
      expect(AutomaMilestonesAwards.selectAwardToFund(game)).is.undefined;
    });
  });

  describe('Mons Insurance in mode B (Q10)', () => {
    it('the corporation is AVAILABLE in the multiplayer mode (predicate ban is official-solo only)', () => {
      const [game, humans] = testAutomaMultiplayerGame(2, {promoCardsOption: true});
      const corpNames = [
        ...game.corporationDeck.drawPile.map((c) => c.name),
        ...humans.flatMap((h) => h.dealtCorporationCards.map((c) => c.name)),
      ];
      expect(corpNames).contains(CardName.MONS_INSURANCE);
    });

    it('a track regress caused by a human pays the bot the insurance', () => {
      const [game, [h1, h2], bot] = testAutomaMultiplayerGame(2, {promoCardsOption: true});
      h2.playedCards.push(new MonsInsurance());
      game.monsInsuranceOwner = h2;
      h2.megaCredits = 10;
      game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 2;
      bot.production.add(Resource.ENERGY, -1, {log: true, from: {player: h1}});
      expect(game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position).eq(1);
      expect(bot.megaCredits).eq(3);
      expect(h2.megaCredits).eq(7);
    });

    it('a stock steal from the bot supply pays the insurance exactly once', () => {
      const [game, [h1, h2], bot] = testAutomaMultiplayerGame(2, {promoCardsOption: true});
      h2.playedCards.push(new MonsInsurance());
      game.monsInsuranceOwner = h2;
      h2.megaCredits = 10;
      bot.megaCredits = 10;
      bot.attack(h1, Resource.MEGACREDITS, 3, {log: true, stealing: true});
      expect(h1.megaCredits).eq(3);
      expect(bot.megaCredits).eq(10); // 10 − 3 stolen + 3 insurance.
      expect(h2.megaCredits).eq(7); // Paid once, not twice.
    });

    it('a STORAGE-only loss claims the insurance too', () => {
      const [game, [h1, h2], bot] = testAutomaMultiplayerGame(2, {coloniesExtension: true, promoCardsOption: true});
      h2.playedCards.push(new MonsInsurance());
      game.monsInsuranceOwner = h2;
      h2.megaCredits = 10;
      bot.megaCredits = 0;
      game.automa!.shippingStorage[ColonyName.GANYMEDE] = 4;
      bot.attack(h1, Resource.PLANTS, 2, {log: true});
      expect(game.automa!.shippingStorage[ColonyName.GANYMEDE]).eq(2);
      expect(bot.megaCredits).eq(3); // The insurance claim.
      expect(h2.megaCredits).eq(7);
    });

    it('nothing removed → no insurance claim', () => {
      const [game, [h1, h2], bot] = testAutomaMultiplayerGame(2, {promoCardsOption: true});
      h2.playedCards.push(new MonsInsurance());
      game.monsInsuranceOwner = h2;
      h2.megaCredits = 10;
      bot.megaCredits = 0;
      bot.attack(h1, Resource.TITANIUM, 2, {log: true});
      expect(bot.megaCredits).eq(0);
      expect(h2.megaCredits).eq(10);
    });

    it("Mons' own on-play −2 M€ production regresses the bot track WITHOUT an insurance claim", () => {
      const [game, [h1, h2], bot] = testAutomaMultiplayerGame(2, {promoCardsOption: true});
      game.automa!.board.tracks[THARSIS_TRACK.EVENT].position = 5;
      h2.megaCredits = 10;
      const mons = new MonsInsurance();
      h1.playedCards.push(mons);
      mons.play(h1);
      game.monsInsuranceOwner = h1;
      // The bot's M€ "production" maps to the Event track: −2 steps.
      expect(game.automa!.board.tracks[THARSIS_TRACK.EVENT].position).eq(3);
      // "This does not trigger the effect below" — no claim for anyone.
      expect(bot.megaCredits).eq(0);
    });
  });

  describe('draft (Q7/Q8)', () => {
    function pick(human: TestPlayer): void {
      const selectCard = cast(human.popWaitingFor(), SelectCard<IProjectCard>);
      selectCard.process({type: 'card', cards: [selectCard.cards[0].name]});
    }

    it('the generation draft runs a 3-seat circle: the bot picks instantly, both humans prompt', () => {
      const [game, humans, bot] = testAutomaMultiplayerGame(2, {draftVariant: true});
      const [h1, h2] = humans;
      for (const h of humans) {
        game.playerIsFinishedWithResearchPhase(h);
      }
      game.automa!.actionDeck = [];
      endGeneration(game, humans);
      expect(game.generation).eq(2);
      expect(game.phase).eq(Phase.DRAFTING);

      // Round 1: 4-card hands everywhere; the bot already picked silently.
      expect(cast(h1.getWaitingFor(), SelectCard<IProjectCard>).cards).has.length(4);
      expect(cast(h2.getWaitingFor(), SelectCard<IProjectCard>).cards).has.length(4);
      expect(bot.draftedCards).has.length(1);
      expect(bot.getWaitingFor()).is.undefined;

      for (let round = 0; round < 3; round++) {
        pick(h1);
        pick(h2);
      }

      // Draft done: the bot's action deck is built (3 projects + 1 bonus), the
      // humans proceed to the ordinary buy step with 4 drafted cards each.
      expect(game.phase).eq(Phase.RESEARCH);
      const automa = game.automa!;
      expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(3);
      expect(automa.actionDeck.filter((c) => c.kind === 'bonus')).has.length(1);
      expect(bot.draftedCards).is.empty;
      expect(h1.getWaitingFor()).is.not.undefined;
      expect(h2.getWaitingFor()).is.not.undefined;
    });

    it('the initial draft excludes the bot: humans pass among themselves (Q8)', () => {
      const [game, humans, bot] = testAutomaMultiplayerGame(2, {initialDraftVariant: true, keepInitialCardSelection: true});
      const [h1, h2] = humans;
      expect(game.phase).eq(Phase.INITIALDRAFTING);
      expect(bot.needsToDraft).is.undefined;
      expect(bot.getWaitingFor()).is.undefined;
      expect(bot.draftHand).is.empty;
      expect(cast(h1.getWaitingFor(), SelectCard<IProjectCard>).cards).has.length(5);
      expect(cast(h2.getWaitingFor(), SelectCard<IProjectCard>).cards).has.length(5);

      // One pick each → round 2: the 4-card hands moved between the HUMANS.
      pick(h1);
      pick(h2);
      expect(cast(h1.getWaitingFor(), SelectCard<IProjectCard>).cards).has.length(4);
      expect(cast(h2.getWaitingFor(), SelectCard<IProjectCard>).cards).has.length(4);
      expect(bot.draftedCards).is.empty;
    });

    it('initial + prelude drafts run end-to-end among the humans; the bot keeps its own setup', () => {
      const [game, humans, bot] = testAutomaMultiplayerGame(2, {
        preludeExtension: true, initialDraftVariant: true, preludeDraftVariant: true,
        keepInitialCardSelection: true,
      });
      // Drive every human draft prompt to completion (bounded — a stuck draft fails).
      for (let step = 0; step < 60 && game.phase !== Phase.RESEARCH; step++) {
        let acted = false;
        for (const h of humans) {
          const wf = h.getWaitingFor();
          if (wf instanceof SelectCard && wf.optional !== true) {
            pick(h);
            acted = true;
          }
        }
        if (!acted) {
          break;
        }
      }
      expect(game.phase).eq(Phase.RESEARCH);
      for (const h of humans) {
        expect(h.dealtProjectCards).has.length(10);
        expect(h.dealtPreludeCards).has.length(4);
      }
      expect(bot.draftedCards).is.empty;
      expect(bot.dealtPreludeCards).is.empty;
      // The bot's own setup is untouched by the drafts: with Prelude its
      // starting action deck is 6 projects + 1 bonus.
      expect(game.automa!.actionDeck.filter((c) => c.kind === 'project')).has.length(6);
    });
  });
});
