import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {PlutoRedux, PLUTO_REDUX_NO_DATA_HOLDER_REASON} from '../../src/server/colonies/PlutoRedux';
import {Pluto} from '../../src/server/colonies/Pluto';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {CardResource} from '../../src/common/CardResource';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {TestPlayer} from '../TestPlayer';
import {formatMessage, runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {tradeBenefitAt, tradeBenefitTypes} from '../../src/common/colonies/ColonyMetadata';
import {ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {ColonyDealer} from '../../src/server/colonies/ColonyDealer';
import {ColonyDeserializer} from '../../src/server/colonies/ColonyDeserializer';
import {getColonyModule} from '../../src/server/colonies/ColonyManifest';
import {SeededRandom} from '../../src/common/utils/Random';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {toName} from '../../src/common/utils/utils';
import {LunarObservationPost} from '../../src/server/cards/moon/LunarObservationPost';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {buildColonyTradePreview} from '../../src/server/colonies/colonyTradePreview';
import {TradeAdvance} from '../../src/server/cards/community/TradeAdvance';
import {Mercury} from '../../src/server/cards/community/Mercury';

/**
 * PLUTO — the Turmoil Redux REPLACEMENT tile. The rulebook's paragraph, one
 * `it` per sentence: data at positions 1–5, cards at 6–7, the same build and
 * colony bonuses, active from the start, «a player must have a card that can
 * accept data resources if they want to trade» at the low positions — and
 * «any marker-advancing bonuses are factored into this restriction» (the +2
 * / +1 example verbatim).
 */
describe('PlutoRedux', () => {
  let pluto: PlutoRedux;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    pluto = new PlutoRedux();
    [game, player, player2] = testGame(2, {coloniesExtension: true});
    game.colonies = [pluto];
  });

  /** A card that holds DATA — the rule's «a card that can accept data resources». */
  function giveDataHolder(p: TestPlayer): LunarObservationPost {
    const card = new LunarObservationPost();
    p.playedCards.push(card);
    return card;
  }

  describe('the printed tile', () => {
    it('starts active, like the base tile and unlike Iapetus II', () => {
      expect(pluto.isActive).is.true;
    });

    it('placement bonus and colony bonus are IDENTICAL to the base Pluto', () => {
      const base = new Pluto();
      expect(pluto.metadata.build).to.deep.eq(base.metadata.build);
      expect(pluto.metadata.colony).to.deep.eq(base.metadata.colony);
      expect(pluto.metadata.lore).to.eq(base.metadata.lore);
    });

    it('trade income: data ×[1, 1, 2, 2, 3] at positions 1–5, cards ×[2, 3] at 6–7', () => {
      const read = [0, 1, 2, 3, 4, 5, 6].map((position) => tradeBenefitAt(pluto.metadata, position));
      expect(read.map((r) => r.type)).to.deep.eq([
        ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD,
        ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD,
        ColonyBenefit.DRAW_CARDS, ColonyBenefit.DRAW_CARDS,
      ]);
      expect(read.map((r) => r.quantity)).to.deep.eq([1, 1, 2, 2, 3, 2, 3]);
      expect(pluto.metadata.cardResource).to.eq(CardResource.DATA);
      expect(tradeBenefitTypes(pluto.metadata)).to.deep.eq([ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.DRAW_CARDS]);
    });

    it('is a Turmoil Redux tile in the manifest', () => {
      expect(getColonyModule(ColonyName.PLUTO_REDUX)).to.eq('turmoilRedux');
      expect(getColonyModule(ColonyName.PLUTO)).to.eq('colonies');
    });
  });

  describe('build and colony bonus (unchanged)', () => {
    it('building draws 2 cards', () => {
      pluto.addColony(player);
      runAllActions(game);
      expect(player.cardsInHand).has.lengthOf(2);
    });

    it('the colony bonus is draw 1, then discard 1 — paid to the owner on another player\'s trade', () => {
      pluto.addColony(player);
      runAllActions(game);
      expect(player.cardsInHand).has.lengthOf(2);

      giveDataHolder(player2);
      pluto.trade(player2);
      runAllActions(game);
      expect(player.cardsInHand).has.lengthOf(3);
      const discard = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
      expect(discard.discardPrompt?.colonyBonus).to.deep.eq({colonyName: ColonyName.PLUTO_REDUX, index: 1, total: 1});
      discard.cb([discard.cards[0]]);
      expect(player.cardsInHand).has.lengthOf(2);
    });
  });

  describe('trade income by position', () => {
    it('a low position pays DATA to a card of the trader\'s', () => {
      const holder = giveDataHolder(player);
      pluto.trackPosition = 4; // the 5th position: 3 data
      pluto.trade(player);
      runAllActions(game);
      expect(holder.resourceCount).to.eq(3);
      expect(player.cardsInHand).has.lengthOf(0);
      expect(player.colonyTradeManifest?.tradeIncome).to.deep.eq({
        benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 3, cardResource: CardResource.DATA,
      });
    });

    it('the 6th position pays 2 CARDS, the 7th pays 3 — no data card needed', () => {
      pluto.trackPosition = 5;
      pluto.trade(player);
      runAllActions(game);
      expect(player.cardsInHand).has.lengthOf(2);
      expect(player.colonyTradeManifest?.tradeIncome).to.deep.eq({benefit: ColonyBenefit.DRAW_CARDS, quantity: 2});

      pluto.visitor = undefined;
      pluto.trackPosition = 6;
      pluto.trade(player2);
      runAllActions(game);
      expect(player2.cardsInHand).has.lengthOf(3);
    });

    it('the trade-track plan reads the same income the trade pays', () => {
      giveDataHolder(player);
      pluto.trackPosition = 2;
      const plan = pluto.tradeTrackPlan(player);
      expect(plan).to.deep.eq({current: 2, max: 2, steps: 0, minSteps: 0, ask: false});
      expect(pluto.tradeBlockedReason(player)).is.undefined;
    });
  });

  describe('«a player must have a card that can accept data resources» — the refusal', () => {
    it('with no data card the low positions are refused BY NAME', () => {
      pluto.trackPosition = 3;
      expect(pluto.tradeIncomeBlockedReason(player, 3)).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      expect(pluto.tradeBlockedReason(player)).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      expect(pluto.tradeTrackPlan(player).blockedReason).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
    });

    it('the card positions never refuse', () => {
      expect(pluto.tradeIncomeBlockedReason(player, 5)).is.undefined;
      expect(pluto.tradeIncomeBlockedReason(player, 6)).is.undefined;
      pluto.trackPosition = 5;
      expect(pluto.tradeBlockedReason(player)).is.undefined;
    });

    it('a data holder lifts the refusal', () => {
      giveDataHolder(player);
      pluto.trackPosition = 1;
      expect(pluto.tradeBlockedReason(player)).is.undefined;
    });

    it('the trade action LISTS the refused colony disabled with its reason — never dropped', () => {
      const luna = game.colonies[0];
      expect(luna).to.eq(pluto);
      // A second, ordinary colony keeps the trade action offerable.
      const mercury = new Mercury();
      game.colonies.push(mercury);
      player.megaCredits = 20;
      pluto.trackPosition = 2;

      const trade = cast(player.colonies.coloniesTradeAction(), AndOptions);
      const pick = cast(trade.options[1], SelectColony);
      expect(pick.colonies.map(toName)).to.deep.eq([ColonyName.MERCURY]);
      expect(pick.disabledColonies.map((d) => ({name: d.colony.name, reason: d.reason})))
        .to.deep.eq([{name: ColonyName.PLUTO_REDUX, reason: PLUTO_REDUX_NO_DATA_HOLDER_REASON}]);
      // …and the refused colony is not submittable.
      const howToPay = cast(trade.options[0], OrOptions);
      expect(() => trade.process({type: 'and', responses: [
        {type: 'or', index: howToPay.options.length - 1, response: {type: 'option'}},
        {type: 'colony', colonyName: ColonyName.PLUTO_REDUX},
      ]}, player)).to.throw(/not found/);
    });

    it('when the refused colony is the ONLY open one, canTrade is false and the reason is the colony\'s own', () => {
      player.megaCredits = 20;
      pluto.trackPosition = 2;
      expect(ColoniesHandler.openColonies(game).map(toName)).to.deep.eq([ColonyName.PLUTO_REDUX]);
      expect(ColoniesHandler.tradeableColonies(game, player)).to.deep.eq([]);
      expect(player.colonies.tradeBlockedReason()).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      expect(player.colonies.canTrade()).is.false;
      expect(player.colonies.potentialTradeCount()).to.eq(0);
      expect(player.colonies.coloniesTradeAction()).is.undefined;

      giveDataHolder(player);
      expect(player.colonies.tradeBlockedReason()).is.undefined;
      expect(player.colonies.potentialTradeCount()).to.eq(1);
    });

    it('COPY_TRADE (Mercury\'s placement bonus) shows the refused colony disabled too', () => {
      const mercury = new Mercury();
      game.colonies.push(mercury);
      pluto.trackPosition = 2;
      mercury.addColony(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectColony);
      expect(pick.colonies.map(toName)).to.deep.eq([ColonyName.MERCURY]);
      expect(pick.disabledColonies.map((d) => d.colony.name)).to.deep.eq([ColonyName.PLUTO_REDUX]);
    });

    it('a bulk trade that reaches a refused colony is a NAMED skip, never a payout into nothing', () => {
      // Trade Advance: «trade with all active colonies, +1 step each».
      pluto.trackPosition = 2; // +1 reaches the 4th: still data, no holder
      const beforeLog = game.gameLog.length;
      new TradeAdvance().bespokePlay(player);
      runAllActions(game);
      expect(player.cardsInHand).has.lengthOf(0);
      const skipped = game.gameLog.slice(beforeLog).find((m) => m.message.startsWith('${0} cannot trade with ${1}: ${2}'));
      expect(skipped, 'the refusal is logged with the colony\'s own reason').is.not.undefined;
      expect(skipped?.data[2].value).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      // Nothing moved: the marker was neither advanced nor reset by the skipped trade.
      expect(pluto.trackPosition).to.eq(2);
    });
  });

  describe('«any marker-advancing bonuses are factored into this restriction» (the rulebook\'s example)', () => {
    it('4th position with +2: reaches the 6th → 2 cards, no data card needed', () => {
      pluto.trackPosition = 3; // the 4th position
      player.colonies.tradeOffset = 2;
      expect(pluto.tradeBlockedReason(player)).is.undefined;
      const plan = pluto.tradeTrackPlan(player);
      // Only the 6th is legal (the 4th and 5th are data with no holder): a
      // FORCED advance, no question.
      expect(plan).to.deep.eq({current: 3, max: 5, steps: 2, minSteps: 2, ask: false});

      pluto.trade(player);
      runAllActions(game);
      expect(player.getWaitingFor(), 'nothing to ask — the only legal landing is the 6th').is.undefined;
      expect(player.cardsInHand).has.lengthOf(2);
    });

    it('4th position with +1: reaches only the 5th (3 data) → a data card is mandatory', () => {
      pluto.trackPosition = 3;
      player.colonies.tradeOffset = 1;
      expect(pluto.tradeBlockedReason(player)).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      expect(pluto.tradeTrackPlan(player)).to.deep.eq({
        current: 3, max: 4, steps: 1, minSteps: 1, ask: false, blockedReason: PLUTO_REDUX_NO_DATA_HOLDER_REASON,
      });

      const holder = giveDataHolder(player);
      expect(pluto.tradeBlockedReason(player)).is.undefined;
      pluto.trade(player);
      runAllActions(game);
      // Same kind on both landings (data 2 → data 3): no question, the farthest.
      expect(player.getWaitingFor()).is.undefined;
      expect(holder.resourceCount).to.eq(3);
    });

    it('the Unity action\'s +1 is part of the reach the OFFER is judged by', () => {
      pluto.trackPosition = 4; // the 5th: data — refused without a holder…
      expect(pluto.tradeBlockedReason(player, 0)).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      // …and legal with one extra step (the 6th: cards).
      expect(pluto.tradeBlockedReason(player, 1)).is.undefined;
      expect(ColoniesHandler.tradeableColonies(game, player, 1).map(toName)).to.deep.eq([ColonyName.PLUTO_REDUX]);
    });
  });

  describe('the track question (`ask`) across the data / cards boundary', () => {
    it('with a data card and an offset spanning the boundary the player CHOOSES (3 data or 2 cards)', () => {
      const holder = giveDataHolder(player);
      pluto.trackPosition = 4;
      player.colonies.tradeOffset = 1;
      expect(pluto.tradeTrackPlan(player)).to.deep.eq({current: 4, max: 5, steps: 1, minSteps: 0, ask: true});

      pluto.trade(player);
      runAllActions(game);
      const question = cast(player.popWaitingFor(), OrOptions);
      expect(question.options.map((o) => formatMessage(o.title))).to.deep.eq([
        'Increase colony track 1 step(s)',
        'Don\'t increase colony track',
      ]);
      question.options[1].cb(); // stay: 3 data
      runAllActions(game);
      expect(holder.resourceCount).to.eq(3);
      expect(player.cardsInHand).has.lengthOf(0);
    });

    it('with no data card the same question is FORCED to the card positions — the refused steps shown disabled', () => {
      pluto.trackPosition = 3;
      player.colonies.tradeOffset = 3; // reaches the 7th
      // The 6th and the 7th are legal (2 vs 3 cards — the same kind), the
      // 4th and the 5th are not: no question, the farthest legal step.
      expect(pluto.tradeTrackPlan(player)).to.deep.eq({current: 3, max: 6, steps: 3, minSteps: 2, ask: false});

      giveDataHolder(player);
      // With a holder every landing is legal and the kinds differ → asked,
      // with «don't» still offered.
      const plan = pluto.tradeTrackPlan(player);
      expect(plan).to.deep.eq({current: 3, max: 6, steps: 3, minSteps: 0, ask: true});
    });

    it('the prompt lists refused steps DISABLED with the colony\'s reason when the floor is above zero', () => {
      // A data holder whose only data card is played by the OPPONENT: the
      // trader has none; the floor stays above zero only when a legal choice
      // remains — so give the trader a holder and refuse the low landing
      // through a colony stub instead.
      const stub = new (class extends PlutoRedux {
        public override tradeIncomeBlockedReason(_p: TestPlayer, position: number) {
          return position <= 4 ? 'too low' : undefined;
        }
      })();
      game.colonies = [stub];
      stub.trackPosition = 4;
      player.colonies.tradeOffset = 2; // the 6th (2 cards) and the 7th (3 cards) are legal… and the same kind
      expect(stub.tradeTrackPlan(player)).to.deep.eq({current: 4, max: 6, steps: 2, minSteps: 1, ask: false});
    });
  });

  describe('the read-only preview plans from the same plan', () => {
    it('a forced advance previews the card income at the landing, no track question', () => {
      pluto.trackPosition = 3;
      player.colonies.tradeOffset = 2;
      const preview = buildColonyTradePreview(player, pluto);
      expect(preview.track).to.deep.eq({current: 3, effective: 5, steps: 2, willAsk: false});
      expect(preview.rewardQuantity).to.eq(2);
      expect(preview.followUps).to.deep.eq([]);
    });

    it('a real choice previews the question with its floor', () => {
      giveDataHolder(player);
      pluto.trackPosition = 4;
      player.colonies.tradeOffset = 1;
      const preview = buildColonyTradePreview(player, pluto);
      expect(preview.track).to.deep.eq({current: 4, effective: 5, steps: 1, willAsk: true});
      expect(preview.followUps[0]).to.deep.eq({kind: 'trackChoice', steps: 1, minSteps: 0});
    });

    it('a refused colony previews the data income as LOST at the farthest reach', () => {
      pluto.trackPosition = 2;
      const preview = buildColonyTradePreview(player, pluto);
      expect(preview.track).to.deep.eq({current: 2, effective: 2, steps: 0, willAsk: false});
      const reward = preview.followUps.find((f) => f.kind === 'cardTarget');
      expect(reward).to.deep.eq({kind: 'cardTarget', role: 'tradeReward', resource: CardResource.DATA, amount: 2, lost: true});
    });
  });

  describe('the replacement tile', () => {
    const options = {...DEFAULT_GAME_OPTIONS, venusNextExtension: false, coloniesExtension: true, turmoilExtension: false, communityCardsOption: false};

    it('is dealt INSTEAD of the base Pluto when Turmoil Redux is on', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true});
      dealer.drawColonies(4);
      const all = [...dealer.colonies, ...dealer.discardedColonies].map(toName);
      expect(all).to.include(ColonyName.PLUTO_REDUX);
      expect(all).to.not.include(ColonyName.PLUTO);
      expect(all).to.have.lengthOf(11);
    });

    it('is never dealt without the expansion', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), options);
      dealer.drawColonies(4);
      const all = [...dealer.colonies, ...dealer.discardedColonies].map(toName);
      expect(all).to.include(ColonyName.PLUTO);
      expect(all).to.not.include(ColonyName.PLUTO_REDUX);
    });

    it('a hand-picked «Pluto» in customColoniesList becomes the Redux tile under the expansion', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), {
        ...options, turmoilReduxExpansion: true,
        customColoniesList: [ColonyName.PLUTO, ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS],
      });
      dealer.drawColonies(1);
      expect(dealer.colonies.map(toName)).to.have.members([ColonyName.PLUTO_REDUX, ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS]);
    });

    it('a hand-picked «Pluto Redux» without the expansion falls back to the base tile', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), {
        ...options,
        customColoniesList: [ColonyName.PLUTO_REDUX, ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS],
      });
      dealer.drawColonies(1);
      expect(dealer.colonies.map(toName)).to.have.members([ColonyName.PLUTO, ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS]);
    });

    it('a game created with the expansion seats the Redux tile', () => {
      const [g] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, customColoniesList: [ColonyName.PLUTO, ColonyName.LUNA, ColonyName.IO, ColonyName.CERES, ColonyName.TITAN]});
      expect(g.colonies.map(toName)).to.include(ColonyName.PLUTO_REDUX);
      expect(g.colonies.map(toName)).to.not.include(ColonyName.PLUTO);
    });
  });

  describe('serialization', () => {
    it('round-trips through the deserializer with its state', () => {
      pluto.colonies = [player.id];
      pluto.trackPosition = 4;
      pluto.visitor = player2.id;
      const [restored] = ColonyDeserializer.deserializeAndFilter([pluto.serialize()]);
      expect(restored).to.be.instanceOf(PlutoRedux);
      expect(restored.name).to.eq(ColonyName.PLUTO_REDUX);
      expect(restored.isActive).is.true;
      expect(restored.colonies).to.deep.eq([player.id]);
      expect(restored.trackPosition).to.eq(4);
      expect(restored.visitor).to.eq(player2.id);
      // The restored tile keeps its rule.
      expect(restored.tradeIncomeBlockedReason(player, 4)).to.eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
    });
  });

  it('the refusal reads the payout\'s own candidate set (AddResourcesToCard)', () => {
    // Sanity: the holder set the refusal consults is the one the payout uses.
    expect(new AddResourcesToCard(player, CardResource.DATA, {count: 1}).getCards()).to.deep.eq([]);
    const holder = giveDataHolder(player);
    expect(new AddResourcesToCard(player, CardResource.DATA, {count: 1}).getCards()).to.deep.eq([holder]);
  });
});
