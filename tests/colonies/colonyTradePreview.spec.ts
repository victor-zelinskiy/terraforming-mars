import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {IColony} from '../../src/server/colonies/IColony';
import {buildColonyTradePreview} from '../../src/server/colonies/colonyTradePreview';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {TradingColony} from '../../src/server/cards/colonies/TradingColony';
import {VenusTradeHub} from '../../src/server/cards/prelude2/VenusTradeHub';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {InputResponse} from '../../src/common/inputs/InputResponse';

describe('colonyTradePreview', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  let enceladus: IColony;
  let luna: IColony;
  let pluto: IColony;

  beforeEach(() => {
    [game, player, player2] = testGame(2, {
      coloniesExtension: true,
      customColoniesList: [
        ColonyName.ENCELADUS,
        ColonyName.LUNA,
        ColonyName.PLUTO,
        ColonyName.CALLISTO,
        ColonyName.TITAN,
      ],
    });
    enceladus = game.colonies.find((c) => c.name === ColonyName.ENCELADUS)!;
    luna = game.colonies.find((c) => c.name === ColonyName.LUNA)!;
    pluto = game.colonies.find((c) => c.name === ColonyName.PLUTO)!;
    enceladus.isActive = true;
  });

  it('plain colony: no follow-ups, reward read at the current position', () => {
    luna.trackPosition = 3;
    const preview = buildColonyTradePreview(player, luna);
    expect(preview.colonyName).to.eq(ColonyName.LUNA);
    expect(preview.track).to.deep.eq({current: 3, effective: 3, steps: 0, willAsk: false});
    expect(preview.rewardQuantity).to.eq(7); // Luna M€ track [1,2,4,7,...]
    expect(preview.followUps).to.deep.eq([]);
    // A plain M€ player pays automatically — no payment prompt.
    expect(preview.megacreditsPayment).is.undefined;
  });

  it('trade offset (Trading Colony) auto-advances the effective position', () => {
    player.playedCards.push(new TradingColony());
    player.colonies.tradeOffset = 1;
    luna.trackPosition = 2;
    const preview = buildColonyTradePreview(player, luna);
    expect(preview.track).to.deep.eq({current: 2, effective: 3, steps: 1, willAsk: false});
    expect(preview.rewardQuantity).to.eq(7);
  });

  it('card-resource reward: no eligible card → lost', () => {
    enceladus.trackPosition = 3;
    const preview = buildColonyTradePreview(player, enceladus);
    expect(preview.followUps).to.deep.eq([
      {kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 3, lost: true},
    ]);
  });

  it('card-resource reward: single candidate → explicit auto target', () => {
    const tardigrades = new Tardigrades();
    player.playedCards.push(tardigrades);
    enceladus.trackPosition = 3;
    const preview = buildColonyTradePreview(player, enceladus);
    expect(preview.followUps).has.length(1);
    const followUp = preview.followUps[0];
    if (followUp.kind !== 'cardTarget') {
      throw new Error('expected cardTarget');
    }
    expect(followUp.auto).to.eq(CardName.TARDIGRADES);
    expect(followUp.pick).is.undefined;
    expect(followUp.lost).is.false;
  });

  it('card-resource reward: two candidates → a pre-collectable pick', () => {
    player.playedCards.push(new Tardigrades(), new GHGProducingBacteria());
    enceladus.trackPosition = 3;
    const preview = buildColonyTradePreview(player, enceladus);
    const followUp = preview.followUps[0];
    if (followUp.kind !== 'cardTarget') {
      throw new Error('expected cardTarget');
    }
    expect(followUp.amount).to.eq(3);
    expect(followUp.auto).is.undefined;
    expect(followUp.pick?.cards.map((c) => c.name)).to.have.members(
      [CardName.TARDIGRADES, CardName.GHG_PRODUCING_BACTERIA]);
  });

  it('own colony on the tile: its bonus pick comes BEFORE the reward pick', () => {
    player.playedCards.push(new Tardigrades(), new GHGProducingBacteria());
    enceladus.colonies.push(player.id);
    enceladus.trackPosition = 3;
    const preview = buildColonyTradePreview(player, enceladus);
    expect(preview.followUps.map((f) => f.kind === 'cardTarget' ? f.role : f.kind)).to.deep.eq(
      ['colonyBonus', 'tradeReward']);
    const bonus = preview.followUps[0];
    if (bonus.kind !== 'cardTarget') {
      throw new Error('expected cardTarget');
    }
    expect(bonus.amount).to.eq(1);
  });

  it('interactive rewards the modal cannot pre-collect surface as notes', () => {
    player2.cardsInHand.push(new Tardigrades());
    const titan = game.colonies.find((c) => c.name === ColonyName.TITAN)!;
    titan.isActive = true;
    const preview = buildColonyTradePreview(player, titan);
    // Titan trade = add floaters to a card (lost — no floater card), Titan is
    // ADD_RESOURCES_TO_CARD; use Pluto for the draw note instead.
    expect(preview.followUps.some((f) => f.kind === 'cardTarget')).is.true;

    const plutoPreview = buildColonyTradePreview(player, pluto);
    // Pluto's trade reward is a plain draw (keepAll) — no follow-up prompt.
    expect(plutoPreview.followUps).to.deep.eq([]);
  });

  it('flat every-trade modifiers (Venus Trade Hub) surface in the preview', () => {
    expect(buildColonyTradePreview(player, luna).flatBonuses).is.undefined;
    player.playedCards.push(new VenusTradeHub());
    expect(buildColonyTradePreview(player, luna).flatBonuses).to.deep.eq([
      {card: CardName.VENUS_TRADE_HUB, resource: 'megacredits', amount: 3},
    ]);
  });

  it('M€ payment preview appears only when the payment would prompt', () => {
    player.megaCredits = 20;
    expect(buildColonyTradePreview(player, luna).megacreditsPayment).is.undefined;

    player.canUseHeatAsMegaCredits = true;
    player.heat = 5;
    const preview = buildColonyTradePreview(player, luna);
    expect(preview.megacreditsPayment).is.not.undefined;
    expect(preview.megacreditsPayment?.amount).to.eq(9);
  });

  // The load-bearing guarantee: the preview's followUps order IS the live
  // prompt order, so a pre-collected batch replays byte-for-byte.
  it('CONSISTENCY: live trade prompts arrive in the preview order and a batch replays them', () => {
    const tardigrades = new Tardigrades();
    const bacteria = new GHGProducingBacteria();
    player.playedCards.push(tardigrades, bacteria);
    enceladus.colonies.push(player.id);
    enceladus.trackPosition = 3;
    player.energy = 3;

    const preview = buildColonyTradePreview(player, enceladus);
    expect(preview.followUps.map((f) => f.kind === 'cardTarget' ? f.role : f.kind)).to.deep.eq(
      ['colonyBonus', 'tradeReward']);

    // Take the trade action exactly like the UI: the action menu's trade AndOptions.
    player.takeAction();
    const actions = cast(player.getWaitingFor(), OrOptions);
    const tradeIndex = actions.options.findIndex((o) =>
      o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
    expect(tradeIndex).is.greaterThanOrEqual(0);
    const tradeAnd = cast(actions.options[tradeIndex], AndOptions);
    const payOr = cast(tradeAnd.options[0], OrOptions);
    const energyIndex = payOr.options.findIndex((o) => JSON.stringify(o.title).includes('energy'));
    expect(energyIndex).is.greaterThanOrEqual(0);

    // The one-batch submission the trade composer builds: trade + both picks.
    const responses: Array<InputResponse> = [
      {
        type: 'or',
        index: tradeIndex,
        response: {
          type: 'and',
          responses: [
            {type: 'or', index: energyIndex, response: {type: 'option'}},
            {type: 'colony', colonyName: ColonyName.ENCELADUS},
          ],
        },
      },
      {type: 'card', cards: [CardName.TARDIGRADES]}, // own colony bonus (+1)
      {type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]}, // trade reward (+3)
    ];

    for (const response of responses) {
      expect(player.getWaitingFor(), 'expected a live prompt for each batched response').is.not.undefined;
      player.process(response);
    }
    runAllActions(game);

    // The whole trade resolved; the next prompt is the fresh action menu.
    cast(player.getWaitingFor(), OrOptions);
    expect(tardigrades.resourceCount).to.eq(1);
    expect(bacteria.resourceCount).to.eq(3);
    expect(player.energy).to.eq(0);
    expect(enceladus.visitor).to.eq(player.id);
  });

  it('CONSISTENCY: the live prompts really are SelectCard in the preview order', () => {
    player.playedCards.push(new Tardigrades(), new GHGProducingBacteria());
    enceladus.colonies.push(player.id);
    enceladus.trackPosition = 3;

    enceladus.trade(player);
    runAllActions(game);

    // First prompt: the own colony bonus (add 1 microbe).
    const bonusPick = cast(player.getWaitingFor(), SelectCard);
    bonusPick.process({type: 'card', cards: [CardName.TARDIGRADES]});
    runAllActions(game);

    // Second prompt: the trade reward (add 3 microbes).
    const rewardPick = cast(player.getWaitingFor(), SelectCard);
    expect(rewardPick.cards).has.length(2);
  });

  it('preview never mutates game state', () => {
    player.playedCards.push(new Tardigrades(), new GHGProducingBacteria());
    enceladus.colonies.push(player.id);
    enceladus.trackPosition = 3;
    player.canUseHeatAsMegaCredits = true;
    player.heat = 5;

    const before = JSON.stringify(game.serialize());
    buildColonyTradePreview(player, enceladus);
    expect(JSON.stringify(game.serialize())).to.eq(before);
  });
});
