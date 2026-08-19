import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {IGame} from '../../src/server/IGame';
import {AutomaHumanTagReactions} from '../../src/server/automa/AutomaHumanTagReactions';
import {VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {newProjectCard} from '../../src/server/createCard';
import {SaturnSystems} from '../../src/server/cards/corporation/SaturnSystems';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {Splice} from '../../src/server/cards/promo/Splice';
import {SolarLogistics} from '../../src/server/cards/promo/SolarLogistics';
import {Tag} from '../../src/common/cards/Tag';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

function botTakesOneTurn(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
}

function flipCard(game: IGame, human: TestPlayer, name: CardName) {
  game.automa!.actionDeck = [{kind: 'project', name}];
  botTakesOneTurn(game, human);
  runAllActions(game);
}

/**
 * RB-B FAQ («Adding Corporations», p.4 — AUTOMA_DATA_AUDIT.md §10): the
 * sanctioned HUMAN corporation effects react to the bot's card flips and
 * microbe advancements. Everything else stays silent by rule.
 */
describe('AutomaHumanTagReactions (RB-B FAQ: Saturn Systems / Pharmacy Union / Splice)', () => {
  describe('Saturn Systems — «triggered when you or MarsBot play a card with a Jovian tag»', () => {
    it('a bot flip with a Jovian tag raises the owner\'s M€ production', () => {
      const [game, human] = testAutomaGame({}, '-sat1');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.IO_MINING_INDUSTRIES); // Jovian + Space.
      expect(human.production.megacredits).eq(1);
    });

    it('a card resolved through Research & Development (B03) triggers it too', () => {
      const [game, human] = testAutomaGame({}, '-sat2');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      game.projectDeck.drawPile.push(newProjectCard(CardName.METHANE_FROM_TITAN)!); // Top of the deck.
      game.automa!.actionDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
      botTakesOneTurn(game, human);
      runAllActions(game);
      expect(human.production.megacredits).eq(1);
    });

    it('a flip without a Jovian tag changes nothing (tracker advances are structurally excluded)', () => {
      const [game, human] = testAutomaGame({}, '-sat3');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.ACQUIRED_COMPANY); // Earth only.
      expect(human.production.megacredits).eq(0);
    });

    it('multiplayer: whichever human holds Saturn Systems reacts (the dispatch walks every seat)', () => {
      const [game, humans] = testAutomaMultiplayerGame(2, {}, '-satmp');
      humans[1].playedCards.push(new SaturnSystems());
      for (const h of humans) {
        game.playerIsFinishedWithResearchPhase(h);
      }
      // The routing property under test is seat-independent — invoke the
      // dispatch the resolution sites call (turn order is its own machinery).
      AutomaHumanTagReactions.onBotCardResolved(game, newProjectCard(CardName.IO_MINING_INDUSTRIES)!);
      runAllActions(game);
      expect(humans[0].production.megacredits).eq(0);
      expect(humans[1].production.megacredits).eq(1);
    });
  });

  describe('Pharmacy Union — «a microbe advancement… as if a card with a microbe was played»', () => {
    it('a bot flip with a microbe tag adds a disease and costs the owner up to 4 M€', () => {
      const [game, human] = testAutomaGame({}, '-pu1');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.megaCredits = 10;
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.GHG_PRODUCING_BACTERIA); // Science + Microbe.
      expect(pu.resourceCount, 'one disease per microbe tag').eq(1);
      expect(human.megaCredits).eq(6);
    });

    it('the science half stays own-plays-only: a bot science flip triggers nothing', () => {
      const [game, human] = testAutomaGame({}, '-pu2');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.megaCredits = 10;
      const trBefore = human.terraformRating;
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.GENE_REPAIR); // Science only.
      // Nothing of Pharmacy Union's science clause fired: no disease, no M€
      // move, no TR (the human's NEXT-turn action prompt is ordinary flow).
      expect(pu.resourceCount).eq(0);
      expect(human.megaCredits).eq(10);
      expect(human.terraformRating).eq(trBefore);
    });

    it('the bot landing on the Venus board\'s microbe cell (9) is a microbe advancement', () => {
      const [game, human] = testAutomaGame({venusNextExtension: true}, '-pu3');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.megaCredits = 10;
      game.playerIsFinishedWithResearchPhase(human);
      const venus = game.automa!.board.tracks[VENUS_TRACK_INDEX];
      venus.position = 8;
      game.automa!.actionDeck = [{kind: 'project', name: CardName.VENUS_GOVERNOR}]; // Venus ×2: 8→9 (microbe cell)→10.
      botTakesOneTurn(game, human);
      runAllActions(game);
      expect(pu.resourceCount).eq(1);
      expect(human.megaCredits).eq(6);
    });
  });

  describe('Splice — the owner gains 2 M€, the bot takes its deterministic M€ half', () => {
    it('a bot flip with a microbe tag: owner +2 M€, bot +2 M€, never a prompt', () => {
      const [game, human, bot] = testAutomaGame({}, '-sp1');
      human.playedCards.push(new Splice());
      game.playerIsFinishedWithResearchPhase(human);
      const humanBefore = human.megaCredits;
      const botBefore = bot.megaCredits;
      flipCard(game, human, CardName.GHG_PRODUCING_BACTERIA);
      expect(human.megaCredits).eq(humanBefore + 2);
      expect(bot.megaCredits).eq(botBefore + 2);
      expect(bot.getWaitingFor(), 'the bot never receives a prompt').is.undefined;
    });

    it('the Venus microbe cell resolves Splice as if a microbe card was played', () => {
      const [game, human, bot] = testAutomaGame({venusNextExtension: true}, '-sp2');
      human.playedCards.push(new Splice());
      game.playerIsFinishedWithResearchPhase(human);
      const humanBefore = human.megaCredits;
      const botBefore = bot.megaCredits;
      const venus = game.automa!.board.tracks[VENUS_TRACK_INDEX];
      venus.position = 8;
      game.automa!.actionDeck = [{kind: 'project', name: CardName.VENUS_GOVERNOR}];
      botTakesOneTurn(game, human);
      runAllActions(game);
      expect(human.megaCredits).eq(humanBefore + 2);
      expect(bot.megaCredits).eq(botBefore + 2);
    });
  });

  describe('the sanction boundary — only the RB-B-enumerated corporations react', () => {
    it('Solar Logistics stays silent on a bot space-event flip (never sanctioned)', () => {
      const [game, human] = testAutomaGame({}, '-sl1');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      const handBefore = human.cardsInHand.length;
      flipCard(game, human, CardName.ASTEROID); // A Space EVENT — its own trigger shape.
      expect(human.cardsInHand.length, 'no draw — bot flips are not sanctioned for it').eq(handBefore);
    });

    it('the starting-tag route reaches Saturn Systems\' non-card-tag clause', () => {
      // No implemented corporation prints a Jovian starting tag — exercise the
      // route directly (the same call selectCorporation makes per tag).
      const [game, human] = testAutomaGame({}, '-sl2');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      AutomaHumanTagReactions.onBotNonCardTag(game, Tag.JOVIAN);
      expect(human.production.megacredits).eq(1);
      AutomaHumanTagReactions.onBotNonCardTag(game, Tag.EARTH);
      expect(human.production.megacredits).eq(1); // Earth is nobody's clause.
    });

    it('a microbe starting tag would route to Pharmacy Union / Splice', () => {
      const [game, human, bot] = testAutomaGame({}, '-sl3');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.playedCards.push(new Splice());
      human.megaCredits = 10;
      game.playerIsFinishedWithResearchPhase(human);
      const botBefore = bot.megaCredits;
      AutomaHumanTagReactions.onBotNonCardTag(game, Tag.MICROBE);
      runAllActions(game);
      expect(pu.resourceCount).eq(1);
      expect(bot.megaCredits).eq(botBefore + 2); // Splice's deterministic bot half.
    });
  });
});

