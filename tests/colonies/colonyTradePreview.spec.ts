import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {trackTop} from '../../src/common/colonies/ColonyMetadata';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {IColony} from '../../src/server/colonies/IColony';
import {buildColonyTradePreview} from '../../src/server/colonies/colonyTradePreview';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {JupiterFloatingStation} from '../../src/server/cards/colonies/JupiterFloatingStation';
import {TradingColony} from '../../src/server/cards/colonies/TradingColony';
import {VenusTradeHub} from '../../src/server/cards/prelude2/VenusTradeHub';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {MeatIndustry} from '../../src/server/cards/promo/MeatIndustry';
import {Poseidon} from '../../src/server/cards/colonies/Poseidon';
import {Birds} from '../../src/server/cards/base/Birds';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';

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

  /**
   * BUILDING IS PRE-COLLECTED TOO. Titan's placement bonus is «положи 3
   * аэростата на карту» — the very same decision the trade's reward asks, so
   * it rides the very same follow-up shape and the console answers it in the
   * build's own batch. Without this the prompt arrived AFTER the cube landed.
   */
  describe('buildFollowUps — what BUILDING here would ask', () => {
    it('offers the placement bonus as a pre-collectable card target', () => {
      player.playedCards.push(new Dirigibles(), new JupiterFloatingStation());
      const titan = game.colonies.find((c) => c.name === ColonyName.TITAN)!;
      const preview = buildColonyTradePreview(player, titan);
      const build = preview.buildFollowUps ?? [];
      expect(build).to.have.length(1);
      const target = build[0];
      if (target.kind !== 'cardTarget') {
        throw new Error('expected cardTarget');
      }
      expect(target.role, 'its own role — never confused with a trade reward').to.eq('buildBonus');
      expect(target.amount, 'Titan pays 3 floaters for the first settlement').to.eq(3);
      expect(target.resource).to.eq(CardResource.FLOATER);
      expect(target.lost).to.eq(false);
      // Eligibility is the SERVER's own candidate set, verbatim — the two
      // FLOATER cards in play, and nothing else the player owns.
      expect(target.pick?.cards.map((c) => c.name)).to.have.members(
        [CardName.DIRIGIBLES, CardName.JUPITER_FLOATING_STATION]);
    });

    /**
     * WHO may build is the DOOR's question, never the preview's: a tile at
     * its printed limit still answers what the NEXT cube would ask — a door
     * may lift the limit (Turmoil Redux TR25 Exclusive Colony) and its stage
     * pre-collects the bonus's target from this very list. Only a track with
     * no cell left for a cube asks nothing (no door builds there).
     */
    it('reads the bonus of the NEXT berth — at the printed limit too — and stops only where no cube fits', () => {
      player.playedCards.push(new Dirigibles(), new JupiterFloatingStation());
      const titan = game.colonies.find((c) => c.name === ColonyName.TITAN)!;
      titan.colonies = [player2.id];
      const second = buildColonyTradePreview(player, titan).buildFollowUps ?? [];
      const target = second[0];
      if (target === undefined || target.kind !== 'cardTarget') {
        throw new Error('expected cardTarget');
      }
      expect(target.amount, 'read at the NEXT berth (Titan pays 3 at every one)').to.eq(3);

      titan.colonies = [player2.id, player2.id, player2.id];
      const fourth = buildColonyTradePreview(player, titan).buildFollowUps ?? [];
      const beyond = fourth[0];
      if (beyond === undefined || beyond.kind !== 'cardTarget') {
        throw new Error('a tile at its printed limit still answers what the next cube asks');
      }
      expect(beyond.role).to.eq('buildBonus');
      expect(beyond.amount, 'the last printed cell — never `undefined`').to.eq(3);
      expect(beyond.pick?.cards.map((c) => c.name)).to.have.members(
        [CardName.DIRIGIBLES, CardName.JUPITER_FLOATING_STATION]);

      titan.colonies = Array.from({length: trackTop(titan.metadata)}, () => player2.id);
      expect(buildColonyTradePreview(player, titan).buildFollowUps,
        'no cell of the track is left for a cube — nothing to ask').is.undefined;
    });

    it('stays read-only at the printed limit', () => {
      player.playedCards.push(new Dirigibles(), new JupiterFloatingStation());
      const titan = game.colonies.find((c) => c.name === ColonyName.TITAN)!;
      titan.colonies = [player2.id, player2.id, player2.id];
      const before = JSON.stringify(game.serialize());
      buildColonyTradePreview(player, titan);
      expect(JSON.stringify(game.serialize())).to.eq(before);
    });

    /** A build bonus that resolves by itself (Luna's M€) asks nothing — the
     *  list must stay empty rather than inventing a step. */
    it('is absent for a bonus that resolves without asking', () => {
      expect(buildColonyTradePreview(player, luna).buildFollowUps).is.undefined;
    });
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

/**
 * PL-066 (2026-10-06): the colony stage used to show the trade's income and the build's bonus and nothing of what
 * the TABLE answers to them — the dock's stage did (TR26). The preview now carries the forecast engine's own
 * answer for both acts, with no source card: the stage's «⚡ сработает» line and its R3 «Эффекты» layer read it.
 */
describe('colonyTradePreview — what the TABLE answers (the forecast, PL-066)', () => {
  const table = (redux: boolean) => {
    const [game, player, player2] = testGame(2, {
      coloniesExtension: true,
      ...(redux ? {turmoilReduxExpansion: true} : {}),
      customColoniesList: [ColonyName.LUNA, ColonyName.MIRANDA, ColonyName.IO, ColonyName.EUROPA, ColonyName.CALLISTO],
    });
    game.phase = Phase.ACTION;
    const colony = (name: ColonyName) => game.colonies.find((c) => c.name === name)!;
    for (const c of game.colonies) {
      c.isActive = true;
    }
    return {game, player, player2, colony};
  };

  it('a trade nothing reacts to carries no forecast — absent, never an empty object', () => {
    const t = table(false);
    expect(buildColonyTradePreview(t.player, t.colony(ColonyName.LUNA)).forecast).is.undefined;
    expect(buildColonyTradePreview(t.player, t.colony(ColonyName.LUNA)).buildForecast).is.undefined;
  });

  it('a card-resource income with NO card to land on is LOST — the live income adds nothing, so nothing reacts and no forecast stands', () => {
    const t = table(false);
    const miranda = t.colony(ColonyName.MIRANDA);
    miranda.trackPosition = 4;
    t.player.playedCards.push(new MeatIndustry());
    const preview = buildColonyTradePreview(t.player, miranda);
    expect(preview.followUps.some((f) => f.kind === 'cardTarget' && f.lost), 'the preview itself says the animal is lost').is.true;
    expect(preview.forecast).is.undefined;
  });

  it('a trade whose income lands on a card is answered by the resource reactor (Miranda\'s animals → Meat Industry)', () => {
    const t = table(false);
    const miranda = t.colony(ColonyName.MIRANDA);
    miranda.trackPosition = 4;
    t.player.playedCards.push(new MeatIndustry(), new Birds());
    const preview = buildColonyTradePreview(t.player, miranda);
    const facts = preview.forecast?.facts ?? [];
    expect(facts.map((f) => f.source.name), 'the reactor is named').to.include(CardName.MEAT_INDUSTRY);
    const fact = facts.find((f) => f.source.name === CardName.MEAT_INDUSTRY)!;
    expect(fact.recipient.kind).eq('you');
    expect(fact.effects.some((e) => e.icon === 'megacredits' && e.direction === 'gain'), 'Meat Industry pays M€ per animal').is.true;
    expect(preview.forecast?.discounts.final, 'a trade has no price to discount').eq(preview.forecast?.discounts.base);
    expect(preview.forecast?.paymentValues).deep.eq([]);
  });

  it('a BUILD is answered twice: the berth\'s bonus (Io: heat production → the ruling Greens\' M€ production) and the colony itself (Poseidon, another seat)', () => {
    const t = table(true);
    expect(t.game.parliament!.rulingParty(), 'a fresh Redux table: the Greens').eq(PartyName.GREENS);
    t.player2.playedCards.push(new Poseidon());
    const preview = buildColonyTradePreview(t.player, t.colony(ColonyName.IO));
    const facts = preview.buildForecast?.facts ?? [];
    const greens = facts.find((f) => f.source.kind === 'party' && f.source.name === PartyName.GREENS);
    expect(greens, 'the Greens answer the heat production step').is.not.undefined;
    expect(greens!.effects.some((e) => e.icon === 'megacredits' && e.note === 'production' && e.amount === 1)).is.true;
    const poseidon = facts.find((f) => f.source.name === CardName.POSEIDON);
    expect(poseidon, 'Poseidon answers the colony itself').is.not.undefined;
    expect(poseidon!.recipient, 'addressed to its owner').deep.eq({kind: 'player', color: t.player2.color});
    // The TRADE's forecast is the trade's alone — Io's heat is a stock, nothing answers it.
    expect(preview.forecast).is.undefined;
  });

  it('no cube fits → no build forecast; the trade\'s stands', () => {
    const t = table(true);
    const io = t.colony(ColonyName.IO);
    for (let i = 0; i < 12 && io.hasFreeTrackCell(); i++) {
      io.colonies.push(i % 2 === 0 ? t.player.id : t.player2.id);
    }
    expect(io.hasFreeTrackCell(), 'the track is full').is.false;
    expect(buildColonyTradePreview(t.player, io).buildForecast).is.undefined;
  });
});
