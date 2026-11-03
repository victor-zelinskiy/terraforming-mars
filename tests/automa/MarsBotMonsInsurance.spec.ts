import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {CLAIM_MC, INTEREST_PER, OPENING_FUND, PAYOUT_MC, PREMIUM_MC, insuredCities} from '../../src/server/automa/corps/MarsBotMonsInsurance';
import {MonsInsurance} from '../../src/server/cards/promo/MonsInsurance';
import {TestPlayer} from '../TestPlayer';
import {addCity, runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF4 = MarsBotCorpId.CF4_MONS_INSURANCE;
const BC4 = BonusCardId.BC4_INSURANCE_PAYOUT;

function insuranceGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF4}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function fund(game: IGame): number {
  return game.automa!.corpResources;
}

function resolve(game: IGame) {
  const outcome = resolveBonusCard(game, BC4);
  routeBonusCard(game, BC4, outcome);
  runAllActions(game);
  return outcome;
}

function trackSum(game: IGame): number {
  return game.automa!.board.tracks.reduce((sum, track) => sum + track.position, 0);
}

describe('MarsBot Mons Insurance (CF4, the fork\'s own card) — «the Reserve Fund»', () => {
  describe('the card', () => {
    it('no tag, setup / effect / before-action-phase boxes, the fund on the card, its own BC4, no module condition', () => {
      const info = marsBotCorpInfo(CF4);
      expect(info.original).eq(CardName.MONS_INSURANCE);
      expect(info.cardNumber).eq('CF4');
      expect(info.startingTags).deep.eq([]);
      expect(info.resource).eq('megacredits');
      expect(info.corpBonusCards).deep.eq([BC4]);
      expect(info.requiresModules).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human Mons Insurance', () => {
      const [game, human] = testAutomaGame({}, '-mi-collide');
      human.pickedCorporationCard = new MonsInsurance();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF4);
    });
  });

  describe('SETUP + BEFORE ACTION PHASE — the fund opens, collects premiums, earns interest', () => {
    it('the fund opened with 10 M€ and has already run one before-action-phase box (deltas only)', () => {
      const [game] = insuranceGame('-mi-setup');
      const stats = game.automa!.corpStats;
      // The box already ran once by the first action phase (the C32 law): 10 → +6 → +4 interest = 20, then BC4 may
      // have paid out — so read the stats, never the raw fund.
      expect(stats.insurancePremiumMc).eq(PREMIUM_MC);
      expect(stats.insuranceInterestMc).eq(Math.floor((OPENING_FUND + PREMIUM_MC) / INTEREST_PER));
      expect(game.automa!.recurringBonusCards).contains(BC4);
    });

    it('premiums first, then interest on what the fund holds; MarsBot\'s own M€ untouched; BC4 dealt once', () => {
      const [game, , bot] = insuranceGame('-mi-bap');
      const automa = game.automa!;
      automa.corpResources = 10;
      bot.megaCredits = 7;
      automa.actionDeck = automa.actionDeck.filter((e) => !(e.kind === 'bonus' && e.id === BC4));
      AutomaCorporations.corpFor(CF4).beforeActionPhase!(game);
      expect(fund(game)).eq(10 + PREMIUM_MC + Math.floor((10 + PREMIUM_MC) / INTEREST_PER)); // 16 → +4 = 20
      expect(bot.megaCredits, 'the premiums are the clients\' money').eq(7);
      AutomaCorporations.corpFor(CF4).beforeActionPhase!(game);
      expect(automa.actionDeck.filter((e) => e.kind === 'bonus' && e.id === BC4)).has.length(1);
    });
  });

  describe('BC4 INSURANCE PAYOUT — every full 8 M€ advances the weakest track', () => {
    it('17 M€ pays out twice (16 M€), one advance each; the card recurs', () => {
      const [game] = insuranceGame('-mi-pay');
      const stats = game.automa!.corpStats;
      game.automa!.corpResources = 2 * PAYOUT_MC + 1;
      const payouts = stats.insurancePayouts ?? 0;
      const sum = trackSum(game);
      expect(resolve(game)).eq('discard');
      expect(fund(game)).eq(1);
      expect((stats.insurancePayouts ?? 0) - payouts).eq(2);
      expect(trackSum(game), 'two advances (a space may cascade further)').to.be.at.least(sum + 2);
      expect(game.automa!.recurringBonusCards).contains(BC4);
    });

    it('less than 8 M€ in the fund → nothing moves', () => {
      const [game] = insuranceGame('-mi-wait');
      game.automa!.corpResources = PAYOUT_MC - 1;
      const sum = trackSum(game);
      expect(resolve(game)).eq('discard');
      expect(fund(game)).eq(PAYOUT_MC - 1);
      expect(trackSum(game)).eq(sum);
    });
  });

  describe('EFFECT — the policy repays an attack out of the fund', () => {
    it('a removal of M€: the lost M€ come back, plus 3, out of the fund', () => {
      const [game, human, bot] = insuranceGame('-mi-claim');
      game.automa!.corpResources = 20;
      bot.megaCredits = 10;
      bot.attack(human, Resource.MEGACREDITS, 4, {log: true});
      expect(bot.megaCredits).eq(10 - 4 + 4 + CLAIM_MC);
      expect(fund(game)).eq(20 - 4 - CLAIM_MC);
    });

    it('a theft: the thief keeps the loot, the bot is repaid', () => {
      const [game, human, bot] = insuranceGame('-mi-steal');
      game.automa!.corpResources = 20;
      bot.megaCredits = 10;
      human.megaCredits = 0;
      bot.attack(human, Resource.MEGACREDITS, 2, {log: true, stealing: true});
      expect(human.megaCredits).eq(2);
      expect(bot.megaCredits).eq(10 + CLAIM_MC);
    });

    it('a production decrease regresses a track — the fund pays the printed 3 M€', () => {
      const [game, human, bot] = insuranceGame('-mi-prod');
      game.automa!.corpResources = 20;
      // Steel production rides the building track (rulebook pp.4–5) — move it first so it has a space to give back.
      const index = game.automa!.board.getTrackIndexForTag(Tag.BUILDING)!;
      AutomaResolver.advanceTrack(game, index);
      AutomaResolver.advanceTrack(game, index);
      runAllActions(game);
      const position = game.automa!.board.tracks[index].position;
      const stats = game.automa!.corpStats;
      const claims = stats.insuranceClaims ?? 0;
      const mc = bot.megaCredits;
      bot.production.add(Resource.STEEL, -1, {log: true, from: {player: human}});
      expect(game.automa!.board.tracks[index].position, 'the track regressed').eq(position - 1);
      expect((stats.insuranceClaims ?? 0) - claims).eq(1);
      expect(bot.megaCredits).eq(mc + CLAIM_MC);
    });

    it('an empty fund repays nothing; «as much as possible» is partial', () => {
      const [game, human, bot] = insuranceGame('-mi-empty');
      game.automa!.corpResources = 0;
      bot.megaCredits = 10;
      bot.attack(human, Resource.MEGACREDITS, 4, {log: true});
      expect(bot.megaCredits).eq(6);
      game.automa!.corpResources = 5;
      bot.attack(human, Resource.MEGACREDITS, 4, {log: true});
      expect(bot.megaCredits, '6 − 4 + all 5 the fund held').eq(7);
      expect(fund(game)).eq(0);
    });

    it('an attribution-less production decrease is no claim', () => {
      const [game, , bot] = insuranceGame('-mi-noclaim');
      game.automa!.corpResources = 20;
      const claims = game.automa!.corpStats.insuranceClaims ?? 0;
      for (const resource of [Resource.MEGACREDITS, Resource.STEEL, Resource.PLANTS]) {
        bot.production.add(resource, -1, {log: true});
      }
      expect(game.automa!.corpStats.insuranceClaims ?? 0).eq(claims);
      expect(fund(game)).eq(20);
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Insured property»: 3 VP per 2 cities of the other players; the goal counts space tags; the fund survives a save', () => {
      const [game, human] = insuranceGame('-mi-div');
      const corp = AutomaCorporations.corpFor(CF4);
      const r = marsBotDividendInfo(CF4).rates;
      const before = insuredCities(game);
      addCity(human);
      addCity(human);
      expect(insuredCities(game)).eq(before + 2);
      expect(corp.dividend(game).vp).eq(Math.floor((before + 2) / r.per) * r.each);
      const goal = corp.goal(game);
      game.automa!.playedPile.push(CardName.SATELLITES); // a space tag
      expect(corp.goal(game)).eq(goal + 1);
      game.automa!.corpResources = 13;
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.corpResources).eq(13);
      expect(copy.automa!.corporation).eq(CF4);
    });
  });
});
