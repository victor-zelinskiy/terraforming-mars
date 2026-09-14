import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {LunarObservationPost} from '../../src/server/cards/moon/LunarObservationPost';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {PlayerInput} from '../../src/server/PlayerInput';
import {ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {Board} from '../../src/server/boards/Board';
import {Space} from '../../src/server/boards/Space';
import {Trees} from '../../src/server/cards/base/Trees';
import {Fish} from '../../src/server/cards/base/Fish';
import {SpaceElevator} from '../../src/server/cards/base/SpaceElevator';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** The party-action option(s) of the action menu, by party marker. */
function partyAction(player: TestPlayer, party: PartyName): PlayerInput | undefined {
  return ParliamentHandler.partyActionOptions(player).find((option) => (option as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === party);
}

describe('Party effects', () => {
  describe('Greens', () => {
    it('pay 2 M€ per TR step gained and 1 M€ production per plant / heat production step, attributed to the party', () => {
      const [game, p1, , parliament] = reduxGame();
      expect(parliament.hasPartyEffect(p1, PartyName.GREENS)).is.true;
      p1.megaCredits = 0;
      p1.increaseTerraformRating(2);
      expect(p1.megaCredits).eq(4);
      p1.production.add(Resource.PLANTS, 2);
      expect(p1.production.megacredits).eq(2);
      p1.production.add(Resource.HEAT, 1);
      expect(p1.production.megacredits).eq(3);
      p1.production.add(Resource.STEEL, 1);
      expect(p1.production.megacredits).eq(3);
      p1.production.add(Resource.PLANTS, -1);
      expect(p1.production.megacredits, 'a decrease pays nothing').eq(3);
      const partyEvents = game.events.events.filter((e) => e.source?.kind === 'party' && e.source.name === PartyName.GREENS);
      expect(partyEvents.length).greaterThan(0);
      expect(partyEvents.every((e) => e.source?.kind === 'party' && e.source.owner === p1.color)).is.true;
    });

    it('stop paying once the access is gone', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.enacted = parliament.slots[0].instance; // some other party rules now (unless it is the Greens)
      const ruling = parliament.rulingParty();
      if (ruling === PartyName.GREENS) {
        parliament.enacted = parliament.slots[1].instance;
      }
      parliament.slots = parliament.slots.filter((slot) => slot.instance !== parliament.enacted);
      expect(parliament.hasPartyEffect(p1, PartyName.GREENS)).is.false;
      p1.megaCredits = 0;
      p1.increaseTerraformRating(1);
      expect(p1.megaCredits).eq(0);
    });
  });

  describe('Mars First', () => {
    it('gives 1 steel per tile placed on Mars and a card for a city', () => {
      const [game, p1, , parliament] = reduxGame();
      parliament.grantPartyEffect(p1, PartyName.MARS, 'test');
      p1.steel = 0;
      const hand = p1.cardsInHand.length;
      // Bonus-free spaces, so the only steel and the only card come from the party.
      const plain = (spaces: ReadonlyArray<Space>) => spaces.filter((s) => s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => Board.isOceanSpace(a)));
      game.addCity(p1, plain(game.board.getAvailableSpacesOnLand(p1))[0]);
      runAllActions(game);
      expect(p1.steel).eq(1);
      expect(p1.cardsInHand.length).eq(hand + 1);
      game.addGreenery(p1, plain(game.board.getAvailableSpacesForGreenery(p1))[0]);
      runAllActions(game);
      expect(p1.steel).eq(2);
      expect(p1.cardsInHand.length, 'a greenery draws nothing').eq(hand + 1);
    });
  });

  describe('Scientists', () => {
    it('grant one extra wild tag in the action-phase counts and none for awards', () => {
      const [, p1, , parliament] = reduxGame();
      expect(p1.tags.count(Tag.SCIENCE)).eq(0);
      parliament.grantPartyEffect(p1, PartyName.SCIENTISTS, 'test');
      expect(p1.tags.count(Tag.SCIENCE)).eq(1);
      expect(p1.tags.count(Tag.SCIENCE, 'raw')).eq(0);
      expect(p1.tags.count(Tag.SCIENCE, 'award')).eq(0);
      expect(p1.tags.multipleCount([Tag.SCIENCE, Tag.EARTH])).eq(1);
    });

    it('offer the action only with a card that can hold data or microbes; one prompt, mutation on its answer, one use', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.grantPartyEffect(p1, PartyName.SCIENTISTS, 'test');
      expect(partyAction(p1, PartyName.SCIENTISTS), 'no target card yet').is.undefined;
      const tardigrades = new Tardigrades();
      const observatory = new LunarObservationPost();
      p1.playedCards.push(tardigrades, observatory);
      const options = cast(partyAction(p1, PartyName.SCIENTISTS), OrOptions);
      expect(options.partyActionPrompt).deep.eq({party: PartyName.SCIENTISTS, actionId: 'scientists-lab', stage: 'choose', usesLeft: 1, usesPerGeneration: 1});
      expect(options.options).has.length(2);
      const dataPick = cast(options.options[0], SelectCard);
      const microbePick = cast(options.options[1], SelectCard);
      expect(dataPick.cards.map((c) => c.name)).deep.eq([observatory.name]);
      expect(microbePick.cards.map((c) => c.name)).deep.eq([tardigrades.name]);
      expect(dataPick.resourceGainPrompt?.amount).eq(2);
      // Nothing happened yet.
      expect(tardigrades.resourceCount).eq(0);
      expect(parliament.partyActionUsesLeft(p1, PartyName.SCIENTISTS)).eq(1);
      options.process({type: 'or', index: 1, response: {type: 'card', cards: [tardigrades.name]}}, p1);
      expect(tardigrades.resourceCount).eq(2);
      expect(observatory.resourceCount).eq(0);
      expect(parliament.partyActionUsesLeft(p1, PartyName.SCIENTISTS)).eq(0);
      expect(partyAction(p1, PartyName.SCIENTISTS), 'used this generation').is.undefined;
    });
  });

  describe('Industrialists', () => {
    it('shift production in ONE prompt: −1 of a decreasable production, +2 M€ or energy — the same resource is allowed', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.grantPartyEffect(p1, PartyName.INDUSTRIALISTS, 'test');
      p1.production.add(Resource.PLANTS, 1);
      const mcBefore = p1.production.megacredits;
      const shift = cast(partyAction(p1, PartyName.INDUSTRIALISTS), AndOptions);
      expect(shift.partyActionPrompt?.actionId).eq('industrialists-shift');
      const decrease = cast(shift.options[0], OrOptions);
      const increase = cast(shift.options[1], OrOptions);
      // Only decreasable productions are offered (steel / titanium / energy / heat are at 0).
      const decreasable = decrease.options.map((o) => (o as SelectOption).metadata?.icon);
      expect(decreasable).has.members([Resource.MEGACREDITS, Resource.PLANTS]);
      expect(decreasable).not.includes(Resource.STEEL);
      expect(increase.options.map((o) => (o as SelectOption).metadata?.icon)).deep.eq([Resource.MEGACREDITS, Resource.ENERGY]);
      const plantsIndex = decreasable.indexOf(Resource.PLANTS);
      shift.process({type: 'and', responses: [
        {type: 'or', index: plantsIndex, response: {type: 'option'}},
        {type: 'or', index: 1, response: {type: 'option'}},
      ]}, p1);
      expect(p1.production.plants).eq(0);
      expect(p1.production.energy).eq(2);
      expect(p1.production.megacredits).eq(mcBefore);
      expect(parliament.partyActionUsesLeft(p1, PartyName.INDUSTRIALISTS)).eq(0);

      // Next generation: M€ → M€ nets +1.
      parliament.resetGenerationUses();
      const again = cast(partyAction(p1, PartyName.INDUSTRIALISTS), AndOptions);
      const mcIndex = cast(again.options[0], OrOptions).options.findIndex((o) => (o as SelectOption).metadata?.icon === Resource.MEGACREDITS);
      again.process({type: 'and', responses: [
        {type: 'or', index: mcIndex, response: {type: 'option'}},
        {type: 'or', index: 0, response: {type: 'option'}},
      ]}, p1);
      expect(p1.production.megacredits).eq(mcBefore + 1);
    });

    it('is unavailable when nothing can be decreased', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.grantPartyEffect(p1, PartyName.INDUSTRIALISTS, 'test');
      p1.production.add(Resource.MEGACREDITS, -5);
      expect(p1.production.megacredits).eq(-5);
      expect(partyAction(p1, PartyName.INDUSTRIALISTS)).is.undefined;
    });
  });

  describe('Reds', () => {
    it('commit on confirm (draw 2), then a mandatory discard of 2 paying 2 M€ per plant / microbe / animal tag; a reload keeps the unfinished action', () => {
      const [game, p1, , parliament] = reduxGame();
      // A generation-1 reload without corporations re-enters the initial research; the action is a generation-2 matter here.
      game.generation = 2;
      parliament.grantPartyEffect(p1, PartyName.REDS, 'test');
      const trees = new Trees(); // plant tag
      const tardigrades = new Tardigrades(); // microbe tag
      const fish = new Fish(); // animal tag
      p1.cardsInHand = [trees, tardigrades, fish, new SpaceElevator()];
      p1.megaCredits = 0;
      const confirm = cast(partyAction(p1, PartyName.REDS), SelectOption);
      expect(confirm.partyActionPrompt?.stage).eq('confirm');
      const deck = game.projectDeck.drawPile.length;
      confirm.cb(undefined);
      // COMMITTED: two cards drawn, the use spent, the discard owed.
      expect(p1.cardsInHand).has.length(6);
      expect(game.projectDeck.drawPile.length).eq(deck - 2);
      expect(parliament.partyActionUsesLeft(p1, PartyName.REDS)).eq(0);
      expect(parliament.pendingActions).deep.eq([{kind: 'reds-recycle', player: p1.id, countAction: false}]);
      runAllActions(game);
      const discard = cast(p1.getWaitingFor(), SelectCard<IProjectCard>);
      expect(discard.config.min).eq(2);
      expect(discard.config.max).eq(2);
      expect(discard.partyActionPrompt?.stage).eq('discard');
      expect(discard.discardPrompt?.source).deep.eq({kind: 'party', party: PartyName.REDS});

      // RELOAD before answering: nothing is drawn again and the discard is still owed.
      const restored = Game.deserialize(structuredClone(game.serialize()));
      const one = restored.getPlayerById(p1.id);
      expect(one.cardsInHand).has.length(6);
      expect(restored.projectDeck.drawPile.length).eq(deck - 2);
      const rebuilt = cast(one.getWaitingFor(), SelectCard<IProjectCard>);
      expect(rebuilt.partyActionPrompt?.stage).eq('discard');
      const actionsBefore = one.actionsTakenThisRound;
      rebuilt.process({type: 'card', cards: [trees.name, fish.name]});
      runAllActions(restored);
      expect(one.cardsInHand).has.length(4);
      expect(one.megaCredits, 'a plant tag and an animal tag × 2 M€').eq(4);
      expect(restored.parliament!.pendingActions).deep.eq([]);
      expect(one.actionsTakenThisRound, 'the reload lost the turn accounting — the action is counted on completion').eq(actionsBefore + 1);
      expect(restored.parliament!.partyActionUsesLeft(one, PartyName.REDS)).eq(0);
    });
  });

  describe('Unity', () => {
    it('adds a free trade payment path to the colony trade action, once per generation, still spending a trade fleet', () => {
      const [game, p1, , parliament] = reduxGame();
      parliament.grantPartyEffect(p1, PartyName.UNITY, 'test');
      p1.megaCredits = 9;
      const trade = cast(p1.colonies.coloniesTradeAction(), AndOptions);
      const howToPay = cast(trade.options[0], OrOptions);
      const unity = howToPay.options.findIndex((o) => (o as SelectOption).metadata?.description?.toString().includes('Unity'));
      expect(unity, 'the Unity path is offered').greaterThan(-1);
      const colony = ColoniesHandler.tradeableColonies(game)[0];
      trade.process({type: 'and', responses: [
        {type: 'or', index: unity, response: {type: 'option'}},
        {type: 'colony', colonyName: colony.name},
      ]}, p1);
      runAllActions(game);
      // The optional "+1 track step" question may have been asked — answer it if so.
      const ask = p1.getWaitingFor();
      if (ask !== undefined) {
        cast(ask, OrOptions).options[0].cb(undefined);
        runAllActions(game);
      }
      expect(p1.megaCredits, 'no fee').greaterThanOrEqual(9);
      expect(p1.colonies.usedTradeFleets).eq(1);
      expect(colony.visitor).eq(p1.id);
      expect(parliament.partyActionUsesLeft(p1, PartyName.UNITY)).eq(0);
      // A second trade this generation must pay.
      p1.colonies.usedTradeFleets = 0;
      const second = p1.colonies.coloniesTradeAction();
      if (second !== undefined) {
        const pay = cast(cast(second, AndOptions).options[0], OrOptions);
        expect(pay.options.some((o) => (o as SelectOption).metadata?.description?.toString().includes('Unity'))).is.false;
        expect(pay.disabledOptions.some((d) => d.reason.toString().includes('Unity'))).is.true;
      }
    });
  });
});
