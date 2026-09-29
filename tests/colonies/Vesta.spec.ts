import {expect} from 'chai';
import {cast, toName} from '@/common/utils/utils';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {Vesta, VESTA_NO_HOLDER_REASON} from '../../src/server/colonies/Vesta';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {CardResource} from '../../src/common/CardResource';
import {Resource} from '../../src/common/Resource';
import {colonyCardResources, tradeBenefitAt, tradeBenefitTypes} from '../../src/common/colonies/ColonyMetadata';
import {COLONY_DESCRIPTIONS} from '../../src/common/colonies/ColonyDescription';
import {isTurmoilReduxAddition, TURMOIL_REDUX_COLONY_NAMES} from '../../src/common/colonies/AllColonies';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {ColonyDealer} from '../../src/server/colonies/ColonyDealer';
import {ColonyDeserializer} from '../../src/server/colonies/ColonyDeserializer';
import {ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {getColonyModule} from '../../src/server/colonies/ColonyManifest';
import {buildColonyTradePreview} from '../../src/server/colonies/colonyTradePreview';
import {SeededRandom} from '../../src/common/utils/Random';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {colonySource} from '../../src/server/inputs/choiceContext';
import {Phase} from '../../src/common/Phase';
import {Server} from '../../src/server/models/ServerModel';
import {ICard} from '../../src/server/cards/ICard';
import {EvaMechs} from '../../src/server/cards/turmoilRedux/EvaMechs';
import {AsteroidHollowing} from '../../src/server/cards/promo/AsteroidHollowing';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {MartianExpress} from '../../src/server/cards/underworld/MartianExpress';
import {TradeAdvance} from '../../src/server/cards/community/TradeAdvance';
import {Mercury} from '../../src/server/cards/community/Mercury';
import {Luna} from '../../src/server/colonies/Luna';
import {shippingAreaFor} from '../../src/common/automa/ShippingBoardData';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * VESTA — the second Turmoil Redux ADDITION tile. The rulebook's paragraph,
 * one `it` per sentence: «Gain 5 steel» (the build), «Gain 1 steel» (the
 * colony bonus), «Add the indicated number of mech, asteroid, or fighter
 * resources to any card. You can only pick one resource type per trade» (the
 * income — ONE pick over the holders of ANY kind, the kind being the chosen
 * card's own), «Vesta starts active and any player can place a colony on it,
 * but only players with a card that can accept mech, asteroid, or fighter
 * resources can trade with it» (the refusal, at EVERY position) — and the
 * dealer's two decisions: an addition beside the base tiles, never on a
 * MarsBot table until the bot can use it.
 */
describe('Vesta', () => {
  const REASON = VESTA_NO_HOLDER_REASON;
  const KINDS = [CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER];
  let vesta: Vesta;
  let player: TestPlayer;
  let player2: TestPlayer;
  let player3: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    vesta = new Vesta();
    [game, player, player2, player3] = testGame(3, {coloniesExtension: true, turmoilReduxExpansion: true});
    game.phase = Phase.ACTION;
    game.colonies = [vesta];
  });

  function give<T extends ICard>(p: TestPlayer, card: T): T {
    p.playedCards.push(card);
    return card;
  }

  describe('the printed tile', () => {
    it('starts active — any player can place a colony on it', () => {
      expect(vesta.isActive).is.true;
      expect(player.colonies.getPlayableColonies()).to.include(vesta);
      expect(player2.colonies.getPlayableColonies()).to.include(vesta);
    });

    it('placement bonus: 5 steel in every berth; colony bonus: 1 steel — plain steel, nobody is asked', () => {
      expect(vesta.metadata.build).to.deep.eq({description: 'Gain 5 steel', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.STEEL, quantity: [5, 5, 5]});
      expect(vesta.metadata.colony).to.deep.eq({description: 'Gain 1 steel', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.STEEL, quantity: 1});
    });

    it('trade income: 0 · 1 · 1 · 1 · 2 · 2 · 3 of ONE of THREE kinds onto any card — the kinds as the ONE list, read through colonyCardResources', () => {
      expect(vesta.metadata.cardResources).to.deep.eq(KINDS);
      expect(vesta.metadata.cardResource, 'a several-kinds tile declares the list, never the one-kind field beside it').is.undefined;
      expect(colonyCardResources(vesta.metadata)).to.deep.eq(KINDS);
      const read = [0, 1, 2, 3, 4, 5, 6].map((position) => tradeBenefitAt(vesta.metadata, position));
      expect(read.map((r) => r.type)).to.deep.eq(Array(7).fill(ColonyBenefit.ADD_RESOURCES_TO_CARD));
      expect(read.map((r) => r.quantity)).to.deep.eq([0, 1, 1, 1, 2, 2, 3]);
      expect(tradeBenefitTypes(vesta.metadata)).to.deep.eq([ColonyBenefit.ADD_RESOURCES_TO_CARD]);
      expect(vesta.metadata.trade.fixed).is.undefined;
      // One kind of income, more of it higher up: the track advances without asking.
      expect(vesta.metadata.shouldIncreaseTrack).to.eq('yes');
    });

    it('is a Turmoil Redux ADDITION in the manifest (no base twin), with its own lore and description', () => {
      expect(getColonyModule(ColonyName.VESTA)).to.eq('turmoilRedux');
      expect(isTurmoilReduxAddition(ColonyName.VESTA)).is.true;
      expect(TURMOIL_REDUX_COLONY_NAMES).to.include(ColonyName.VESTA);
      expect(vesta.metadata.lore).to.match(/^Vesta was initially used as a mining outpost for surrounding asteroids\./);
      expect(COLONY_DESCRIPTIONS[ColonyName.VESTA]).to.eq('Mechs, Asteroids & Fighters');
      expect(vesta.metadata.expansion).is.undefined;
    });
  });

  describe('«Gain 5 steel» · «Gain 1 steel» — the steel bonuses', () => {
    it('every berth pays its builder 5 steel', () => {
      for (const p of [player, player2, player3]) {
        const before = p.steel;
        vesta.addColony(p);
        runAllActions(game);
        expect(p.steel, p.name).to.eq(before + 5);
        expect(p.getWaitingFor()).is.undefined;
      }
      expect(vesta.colonies).to.deep.eq([player.id, player2.id, player3.id]);
      expect(vesta.isFull()).is.true;
    });

    it('a cube owner gains 1 steel when ANOTHER player trades — the manifest names it, nobody is asked', () => {
      vesta.colonies.push(player2.id);
      give(player, new SecurityFleet());
      vesta.trackPosition = 3;
      player2.steel = 0;
      vesta.trade(player);
      runAllActions(game);
      expect(player2.steel).to.eq(1);
      expect(player2.getWaitingFor()).is.undefined;
      expect(player.colonyTradeManifest?.colonyBonus).to.deep.eq({benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 1, resource: Resource.STEEL});
      expect(player.colonyTradeManifest?.bonusRecipients).to.deep.eq([{color: player2.color, cubes: 1}]);
    });
  });

  describe('«Add the indicated number of mech, asteroid, or fighter resources to any card» — every position, every kind', () => {
    const holders: ReadonlyArray<[string, () => ICard, CardResource]> = [
      ['mechs', () => new EvaMechs(), CardResource.MECH],
      ['asteroids', () => new AsteroidHollowing(), CardResource.ASTEROID],
      ['fighters', () => new SecurityFleet(), CardResource.FIGHTER],
    ];
    for (const [label, make, kind] of holders) {
      it(`pays 0 · 1 · 1 · 1 · 2 · 2 · 3 ${label} onto the one holder, position by position — no question for one candidate (Titan's contract)`, () => {
        const holder = give(player, make());
        expect(holder.resourceType).to.eq(kind);
        const expected = [0, 1, 1, 1, 2, 2, 3];
        for (let position = 0; position <= 6; position++) {
          vesta.visitor = undefined;
          vesta.trackPosition = position;
          const before = holder.resourceCount;
          vesta.trade(player);
          runAllActions(game);
          expect(player.getWaitingFor(), `position ${position + 1}: one holder, no pick`).is.undefined;
          expect(holder.resourceCount, `position ${position + 1}`).to.eq(before + expected[position]);
        }
      });
    }

    it('the manifest names the income as the LIST of kinds — never one of them', () => {
      give(player, new EvaMechs());
      vesta.trackPosition = 6;
      vesta.trade(player);
      runAllActions(game);
      expect(player.colonyTradeManifest?.tradeIncome).to.deep.eq({benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 3, cardResources: KINDS});
      expect(player.colonyTradeManifest?.tradeIncome.cardResource).is.undefined;
    });

    it('holders of TWO kinds: ONE pick over both, the marker naming each card\'s own kind — the kind that lands is the CARD\'s, never a second question', () => {
      const mechs = give(player, new EvaMechs());
      const asteroids = give(player, new AsteroidHollowing());
      vesta.trackPosition = 4; // the 5th cell: 2 units
      vesta.trade(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map(toName)).to.have.members([mechs.name, asteroids.name]);
      expect(pick.resourceGainPrompt).to.deep.include({
        amount: 2,
        cardResources: ['mech', 'asteroid', 'fighter'],
        cardResourceByCard: {[mechs.name]: 'mech', [asteroids.name]: 'asteroid'},
      });
      expect(pick.resourceGainPrompt?.cardResource, 'no ONE kind — the pick spans several').is.undefined;
      expect(pick.choiceContext?.source).to.deep.eq(colonySource(ColonyName.VESTA));
      pick.cb([asteroids]);
      runAllActions(game);
      expect(asteroids.resourceCount).to.eq(2);
      expect(mechs.resourceCount).to.eq(0);
      expect(player.getWaitingFor(), 'no second question').is.undefined;
    });

    it('a WARE holder takes the unit as its own wildcard', () => {
      const ware = give(player, new MartianExpress());
      vesta.trackPosition = 2;
      vesta.trade(player);
      runAllActions(game);
      expect(ware.resourceCount).to.eq(1);
      expect(player.getWaitingFor()).is.undefined;
    });
  });

  describe('«only players with a card that can accept mech, asteroid, or fighter resources can trade with it» — the refusal, at EVERY position', () => {
    it('with no holder every position is refused BY NAME — the zero-income 1st included (the rule is about the tile, not a level)', () => {
      for (let position = 0; position <= 6; position++) {
        expect(vesta.tradeIncomeBlockedReason(player, position), `position ${position + 1}`).to.eq(REASON);
      }
      vesta.trackPosition = 0;
      expect(vesta.tradeBlockedReason(player)).to.eq(REASON);
      expect(vesta.tradeTrackPlan(player).blockedReason).to.eq(REASON);
      expect(player.colonies.tradeBlockedReason()).to.eq(REASON);
    });

    it('no marker advance lifts it — every reachable landing refuses alike', () => {
      vesta.trackPosition = 2;
      player.colonies.tradeOffset = 2;
      expect(vesta.tradeTrackPlan(player)).to.deep.eq({current: 2, max: 4, steps: 2, minSteps: 2, ask: false, blockedReason: REASON});
      expect(vesta.tradeBlockedReason(player, 1)).to.eq(REASON);
    });

    it('a holder of ANY ONE kind lifts it — judged over the SAME candidate set the payout reads (the wildcard included)', () => {
      expect(new AddResourcesToCard(player, KINDS, {count: 1}).getCards()).to.deep.eq([]);
      const mechs = give(player, new EvaMechs());
      const asteroids = give(player2, new AsteroidHollowing());
      const fighters = give(player3, new SecurityFleet());
      for (const [p, card] of [[player, mechs], [player2, asteroids], [player3, fighters]] as const) {
        expect(vesta.tradeIncomeBlockedReason(p, 0), card.name).is.undefined;
        expect(vesta.tradeIncomeBlockedReason(p, 6), card.name).is.undefined;
        expect(new AddResourcesToCard(p, KINDS, {count: 1}).getCards()).to.deep.eq([card]);
      }
      const [g, p] = testGame(1, {coloniesExtension: true, turmoilReduxExpansion: true});
      g.colonies = [vesta];
      expect(vesta.tradeIncomeBlockedReason(p, 3)).to.eq(REASON);
      const ware = give(p, new MartianExpress());
      expect(vesta.tradeIncomeBlockedReason(p, 3)).is.undefined;
      expect(new AddResourcesToCard(p, KINDS, {count: 1}).getCards()).to.deep.eq([ware]);
    });

    it('the trade OFFER lists Vesta DISABLED with the reason — never dropped — and the submit is refused', () => {
      game.colonies.push(new Luna());
      player.megaCredits = 20;
      vesta.trackPosition = 2;
      const trade = cast(player.colonies.coloniesTradeAction(), AndOptions);
      const pick = cast(trade.options[1], SelectColony);
      expect(pick.colonies.map(toName)).to.deep.eq([ColonyName.LUNA]);
      expect(pick.disabledColonies.map((d) => ({name: d.colony.name, reason: d.reason})))
        .to.deep.eq([{name: ColonyName.VESTA, reason: REASON}]);
      const howToPay = cast(trade.options[0], OrOptions);
      expect(() => trade.process({type: 'and', responses: [
        {type: 'or', index: howToPay.options.length - 1, response: {type: 'option'}},
        {type: 'colony', colonyName: ColonyName.VESTA},
      ]}, player)).to.throw(/not found/);
      expect(player.megaCredits).to.eq(20);
    });

    it('as the ONLY open colony: canTrade is false, the reason is Vesta\'s own, and the server PUBLISHES it to the seat', () => {
      player.megaCredits = 20;
      vesta.trackPosition = 2;
      expect(ColoniesHandler.openColonies(game).map(toName)).to.deep.eq([ColonyName.VESTA]);
      expect(ColoniesHandler.tradeableColonies(game, player)).to.deep.eq([]);
      expect(player.colonies.tradeBlockedReason()).to.eq(REASON);
      expect(player.colonies.canTrade()).is.false;
      expect(player.colonies.potentialTradeCount()).to.eq(0);
      expect(player.colonies.coloniesTradeAction()).is.undefined;
      expect(Server.getPlayerModel(player).thisPlayer.colonyTradeBlocks).to.deep.eq([{colony: ColonyName.VESTA, reason: REASON}]);

      give(player, new SecurityFleet());
      expect(player.colonies.tradeBlockedReason()).is.undefined;
      expect(player.colonies.potentialTradeCount()).to.eq(1);
      expect(Server.getPlayerModel(player).thisPlayer.colonyTradeBlocks ?? []).to.deep.eq([]);
    });

    it('a bulk trade (Trade Advance) that reaches Vesta is a NAMED skip, never a payout into nothing', () => {
      vesta.trackPosition = 2;
      const before = game.gameLog.length;
      new TradeAdvance().bespokePlay(player);
      runAllActions(game);
      const skipped = game.gameLog.slice(before).find((m) => m.message.startsWith('${0} cannot trade with ${1}: ${2}'));
      expect(skipped, 'the refusal is logged with the colony\'s own reason').is.not.undefined;
      expect(skipped?.data[2].value).to.eq(REASON);
      expect(vesta.trackPosition, 'the marker was neither advanced nor reset by the skipped trade').to.eq(2);
    });

    it('COPY_TRADE (Mercury\'s placement bonus) shows Vesta disabled too', () => {
      const mercury = new Mercury();
      game.colonies.push(mercury);
      vesta.trackPosition = 2;
      mercury.addColony(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectColony);
      expect(pick.colonies.map(toName)).to.deep.eq([ColonyName.MERCURY]);
      expect(pick.disabledColonies.map((d) => ({name: d.colony.name, reason: d.reason}))).to.deep.eq([{name: ColonyName.VESTA, reason: REASON}]);
    });
  });

  describe('the read-only preview carries the list of kinds', () => {
    it('with two holders the card target names the three kinds, no ONE resource, and each candidate\'s own kind', () => {
      const mechs = give(player, new EvaMechs());
      const fleet = give(player, new SecurityFleet());
      vesta.trackPosition = 4;
      const preview = buildColonyTradePreview(player, vesta);
      expect(preview.track).to.deep.eq({current: 4, effective: 4, steps: 0, willAsk: false});
      expect(preview.rewardQuantity).to.eq(2);
      const target = preview.followUps.find((f) => f.kind === 'cardTarget');
      expect(target).to.deep.include({kind: 'cardTarget', role: 'tradeReward', resource: undefined, resources: KINDS, amount: 2, lost: false});
      if (target?.kind !== 'cardTarget') {
        throw new Error('no card target');
      }
      expect(target.pick?.cards.map((c) => c.name)).to.have.members([mechs.name, fleet.name]);
      expect(target.pick?.resourceGainPrompt?.cardResourceByCard).to.deep.eq({[mechs.name]: 'mech', [fleet.name]: 'fighter'});
      expect(target.pick?.resourceGainPrompt?.cardResource).is.undefined;
    });

    it('with one holder it is the AUTO target; with none the income is LOST — and the refusal stands in front of it', () => {
      vesta.trackPosition = 2;
      expect(buildColonyTradePreview(player, vesta).followUps).to.deep.eq([
        {kind: 'cardTarget', role: 'tradeReward', resource: undefined, resources: KINDS, amount: 1, lost: true},
      ]);
      const fleet = give(player, new SecurityFleet());
      expect(buildColonyTradePreview(player, vesta).followUps).to.deep.eq([
        {kind: 'cardTarget', role: 'tradeReward', resource: undefined, resources: KINDS, amount: 1, auto: fleet.name, lost: false},
      ]);
    });
  });

  describe('the ADDITION tile and the dealer', () => {
    const options = {...DEFAULT_GAME_OPTIONS, coloniesExtension: true, turmoilExtension: false, communityCardsOption: false};

    it('is dealt with Turmoil Redux beside the base tiles — with or without Venus Next (it needs nothing else)', () => {
      const withVenus = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, venusNextExtension: true});
      withVenus.drawColonies(4);
      const both = [...withVenus.colonies, ...withVenus.discardedColonies].map(toName);
      expect(both).to.include(ColonyName.VESTA);
      expect(both).to.include(ColonyName.VENUS_REDUX);
      expect(both).to.include(ColonyName.PLUTO_REDUX);
      expect(both).to.have.lengthOf(13);

      const without = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, venusNextExtension: false});
      without.drawColonies(4);
      const vestaOnly = [...without.colonies, ...without.discardedColonies].map(toName);
      expect(vestaOnly).to.include(ColonyName.VESTA);
      expect(vestaOnly).to.not.include(ColonyName.VENUS_REDUX);
      expect(vestaOnly).to.have.lengthOf(12);
    });

    it('is never dealt without the expansion', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: false, venusNextExtension: true, communityCardsOption: true});
      dealer.drawColonies(4);
      expect([...dealer.colonies, ...dealer.discardedColonies].map(toName)).to.not.include(ColonyName.VESTA);
    });

    it('a hand-picked «Vesta» is honoured with the expansion and DROPPED without it (no twin to fall back to)', () => {
      const list = [ColonyName.VESTA, ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS, ColonyName.LUNA];
      const withRedux = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, customColoniesList: list});
      withRedux.drawColonies(1);
      expect(withRedux.colonies.map(toName)).to.include(ColonyName.VESTA);
      const without = new ColonyDealer(new SeededRandom(1), {...options, customColoniesList: list});
      without.drawColonies(1);
      expect(without.colonies.map(toName)).to.have.members([ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS, ColonyName.LUNA]);
    });

    it('a game created with the expansion can seat the tile', () => {
      const [g] = testGame(2, {
        coloniesExtension: true, turmoilReduxExpansion: true,
        customColoniesList: [ColonyName.VESTA, ColonyName.LUNA, ColonyName.IO, ColonyName.CERES, ColonyName.TITAN],
      });
      expect(g.colonies.map(toName)).to.include(ColonyName.VESTA);
    });

    it('MARSBOT: a Redux ADDITION with no Shipping Board area is never dealt to a MarsBot table (Vesta, Venus) — a replacement borrows its twin\'s', () => {
      expect(shippingAreaFor(ColonyName.VESTA)).is.undefined;
      expect(shippingAreaFor(ColonyName.VENUS_REDUX)).is.undefined;
      expect(shippingAreaFor(ColonyName.PLUTO_REDUX)).is.not.undefined;
      const automa = {difficulty: 'normal' as const};

      const dealt = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, venusNextExtension: true, automa});
      dealt.drawColonies(1);
      const pool = [...dealt.colonies, ...dealt.discardedColonies].map(toName);
      expect(pool).to.not.include(ColonyName.VESTA);
      expect(pool).to.not.include(ColonyName.VENUS_REDUX);
      expect(pool).to.include(ColonyName.PLUTO_REDUX);
      expect(pool).to.have.lengthOf(11);

      // …a hand-picked list too: the bot cannot use the tile whoever asked for it.
      const picked = new ColonyDealer(new SeededRandom(1), {
        ...options, turmoilReduxExpansion: true, venusNextExtension: true, automa,
        customColoniesList: [ColonyName.VESTA, ColonyName.VENUS_REDUX, ColonyName.LUNA, ColonyName.IO, ColonyName.CERES, ColonyName.TITAN, ColonyName.CALLISTO],
      });
      picked.drawColonies(1);
      expect([...picked.colonies, ...picked.discardedColonies].map(toName)).to.have.members([ColonyName.LUNA, ColonyName.IO, ColonyName.CERES, ColonyName.TITAN, ColonyName.CALLISTO]);

      // …and the real MarsBot game seats neither.
      const [g] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true});
      const seated = g.colonies.map(toName);
      expect(seated).to.not.include(ColonyName.VESTA);
      expect(seated).to.not.include(ColonyName.VENUS_REDUX);
    });

    it('a table WITHOUT MarsBot is untouched by the gate (the same seed deals the additions)', () => {
      const human = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, venusNextExtension: true, automa: undefined});
      human.drawColonies(1);
      const pool = [...human.colonies, ...human.discardedColonies].map(toName);
      expect(pool).to.include(ColonyName.VESTA);
      expect(pool).to.include(ColonyName.VENUS_REDUX);
    });
  });

  describe('serialization', () => {
    it('round-trips through the deserializer with its state and its rule', () => {
      vesta.colonies = [player.id];
      vesta.trackPosition = 3;
      vesta.visitor = player2.id;
      const [restored] = ColonyDeserializer.deserializeAndFilter([vesta.serialize()]);
      expect(restored).to.be.instanceOf(Vesta);
      expect(restored.name).to.eq(ColonyName.VESTA);
      expect(restored.colonies).to.deep.eq([player.id]);
      expect(restored.trackPosition).to.eq(3);
      expect(restored.visitor).to.eq(player2.id);
      expect(restored.tradeIncomeBlockedReason(player, 0)).to.eq(REASON);
    });

    it('an old save without the tile loads without it; a save holding it loads it', () => {
      const [g] = testGame(2, {coloniesExtension: true});
      const serialized = g.serialize();
      expect(serialized.colonies.map((c) => c.name)).to.not.include(ColonyName.VESTA);
      expect(Game.deserialize(serialized).colonies.map(toName)).to.not.include(ColonyName.VESTA);
      serialized.colonies.push(vesta.serialize());
      const restored = Game.deserialize(serialized);
      expect(restored.colonies.map(toName)).to.include(ColonyName.VESTA);
      expect(restored.colonies).to.have.lengthOf(serialized.colonies.length);
    });
  });
});
