import {expect} from 'chai';
import {MEGACREDITS_PER_DATA, MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {SupremeExpertise} from '../../../src/server/cards/turmoilRedux/SupremeExpertise';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ImmigrantCity} from '../../../src/server/cards/base/ImmigrantCity';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Resource} from '../../../src/common/Resource';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForAction, effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addCity, fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR18 — MARTIAN FIBER: Meat Industry's twin for DATA (+1 M€ per data added
 * to any of your cards), a free «+1 data here» action that the effect answers
 * at once, 1 VP per 2 data here, and Mars First's plate (the TR15 class).
 * Every rule reading of the card file's header is pinned here.
 */
const M = PartyName.MARS;

/** The facts the forecast attributes to THIS card. */
function fiberFacts(facts: ReadonlyArray<EffectForecastFact>): Array<EffectForecastFact> {
  return facts.filter((f) => f.source.name === CardName.MARTIAN_FIBER);
}

/** The M€ a fact promises. */
function megacreditsOf(fact: EffectForecastFact): number {
  return fact.effects.filter((e) => e.icon === Resource.MEGACREDITS && e.direction === 'gain').reduce((sum, e) => sum + e.amount, 0);
}

describe('MartianFiber', () => {
  let card: MartianFiber;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let parliament: Parliament;

  beforeEach(() => {
    card = new MartianFiber();
    [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    parliament = game.parliament!;
    player.playedCards.push(card);
  });

  it('registers with source-backed metadata (the scan: 12 · Mars, Building · blue · Mars First · data · 1 VP / 2 data)', () => {
    expect(card.name).eq(CardName.MARTIAN_FIBER);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(12);
    expect(card.tags).deep.eq([Tag.MARS, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR18');
    expect(card.resourceType).eq(CardResource.DATA);
    expect(card.requirements).has.lengthOf(1);
    expect(card.requirements[0], 'the MIN plate holds the Mars First emblem — a requirement, not a tag').to.include({party: M});
    expect(card.victoryPoints).deep.eq({resourcesHere: {}, per: 2});
    expect(MEGACREDITS_PER_DATA).eq(1);
    // The graphic in the scan's reading order: the effect («data* : 1 M€») · the action («→ data») · the VP text.
    type Node = {is?: string, type?: string, amount?: number, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    const [effect, action] = rows.map((row) => row[0]);
    const cause = (box: Node) => (box.rows?.[0] ?? []) as Array<Node>;
    const result = (box: Node) => (box.rows?.[2] ?? []) as Array<Node | string>;
    expect(effect.is).eq('effect');
    expect(cause(effect)[0]).deep.include({type: CardRenderItemType.RESOURCE});
    expect(cause(effect)[1]).deep.include({is: 'symbol', type: '*'});
    expect(result(effect)[0]).deep.include({type: CardRenderItemType.MEGACREDITS, amount: 1});
    expect(result(effect)).deep.include('Effect: Whenever you add a data resource to ANY card, also gain 1 M€.');
    expect(cause(action)[0], 'nothing to pay: the empty symbol before the arrow').deep.include({is: 'symbol'});
    expect(result(action)[0]).deep.include({type: CardRenderItemType.RESOURCE});
    expect(result(action)).deep.include('Action: Add 1 data resource to this card.');
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    beforeEach(() => {
      ([PartyName.GREENS, M, PartyName.INDUSTRIALISTS] as const)
        .forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      player.playedCards.remove(card);
      player.cardsInHand.push(card);
      player.megaCredits = 20;
    });

    it('neither road: unplayable, and the reason is the NAMED party requirement «0 of 2»', () => {
      expect(player.canPlay(card)).is.false;
      expect(unplayableReasons(player, card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('two delegates on its resolution: playable', () => {
      parliament.placeVote(player, parliament.slots[1], 'reserve');
      parliament.placeVote(player, parliament.slots[1], 'lobby');
      expect(player.canPlay(card)).is.true;
      expect(unplayableReasons(player, card)).deep.eq([]);
    });

    it('Mars First rules: playable with no delegate anywhere', () => {
      seatEnacted(parliament, quietResolutionOf(M));
      expect(parliament.rulingParty()).eq(M);
      expect(player.canPlay(card)).is.true;
    });

    it('checked at the PLAY only: once on the table, the action and the effect work whoever rules', () => {
      player.cardsInHand = [];
      player.playedCards.push(card);
      expect(parliament.rulingParty()).not.eq(M);
      player.megaCredits = 0;
      card.action(player);
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(player.megaCredits).eq(1);
    });
  });

  describe('rule 4 — the action: +1 data here, and the effect answers it with +1 M€', () => {
    it('is free and always open: no M€, no data, no reason', () => {
      player.megaCredits = 0;
      expect(card.canAct(player)).is.true;
      expect(actionUnavailableReasons(player, card)).deep.eq([]);
    });

    it('adds exactly 1 data ON THIS CARD and pays 1 M€ — nothing is asked', () => {
      player.megaCredits = 5;
      card.action(player);
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      expect(card.resourceCount).eq(1);
      expect(player.megaCredits).eq(6);
    });

    it('the preview is DECLARATIVE: a +1 data gain chip «on this card», no cost', () => {
      card.resourceCount = 2;
      const branch = actionPreview(player, card).branches[0];
      expect(branch.available).is.true;
      const gain = branch.effects.find((e) => e.icon === 'data');
      expect(gain).deep.include({direction: 'gain', amount: 1, current: 2, resulting: 3});
      expect(branch.effects.some((e) => e.direction === 'cost')).is.false;
    });

    it('the action forecast states the card\'s own +1 M€ — exact, and the commit pays exactly that', () => {
      player.megaCredits = 7;
      const facts = fiberFacts(effectForecastForAction(player, card, actionPreview(player, card)).facts);
      expect(facts).has.lengthOf(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].recipient).deep.eq({kind: 'you'});
      expect(facts[0].source).deep.include({kind: 'card', channel: 'resource-added'});
      expect(megacreditsOf(facts[0])).eq(1);
      card.action(player);
      runAllActions(game);
      expect(player.megaCredits - 7, 'forecast == execution').eq(megacreditsOf(facts[0]));
    });
  });

  describe('rules 2–3 — +1 M€ per data added to ANY card of yours', () => {
    it('data on another own holder (Political Science): +1 M€ per data', () => {
      const science = new PoliticalScience();
      player.playedCards.push(science);
      player.addResourceTo(science, {qty: 3, log: true});
      expect(player.megaCredits).eq(3);
    });

    it('TR01 Supreme Expertise «4 data to ANY card» picked onto this card: +4 M€ — the play forecast promised the same', () => {
      for (let i = 0; i < 10; i++) {
        player.playedCards.push(fakeCard({tags: [Tag.SCIENCE]}));
      }
      const expertise = new SupremeExpertise();
      player.cardsInHand.push(expertise);
      player.megaCredits = 20;
      expect(player.canPlay(expertise)).is.true;
      const facts = fiberFacts(effectForecastForPlay(player, expertise, cardPlayPreview(player, expertise)).facts);
      expect(facts).has.lengthOf(1);
      expect(megacreditsOf(facts[0])).eq(4);

      player.playCard(expertise);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name), 'this card is a candidate holder').deep.eq([CardName.MARTIAN_FIBER]);
      const before = player.megaCredits;
      pick.cb([card]);
      expect(card.resourceCount).eq(4);
      expect(player.megaCredits - before, 'forecast == execution').eq(megacreditsOf(facts[0]));
    });

    it('data an effect puts on your card in ANOTHER player\'s turn (TR15: their city on Mars) pay you', () => {
      const census = new MartianCensus();
      player.playedCards.push(census);
      addCity(opponent);
      runAllActions(game);
      expect(census.resourceCount).eq(1);
      expect(player.megaCredits).eq(1);
      expect(opponent.megaCredits).eq(0);
    });

    it('the opponent\'s Mars city play forecasts that cascade: a deferred +1 M€ for the owner of this card', () => {
      player.playedCards.push(new MartianCensus());
      opponent.production.override({energy: 1});
      opponent.megaCredits = 40;
      const city = new ImmigrantCity();
      opponent.cardsInHand.push(city);
      const facts = fiberFacts(effectForecastForPlay(opponent, city, cardPlayPreview(opponent, city)).facts);
      expect(facts).has.lengthOf(1);
      expect(facts[0].certainty).eq('deferred');
      expect(facts[0].recipient).deep.eq({kind: 'player', color: player.color});
      expect(megacreditsOf(facts[0])).eq(1);
    });

    it('an animal or a microbe added: nothing', () => {
      const animals = fakeCard({name: 'Animal holder' as CardName, resourceType: CardResource.ANIMAL});
      const microbes = fakeCard({name: 'Microbe holder' as CardName, resourceType: CardResource.MICROBE});
      player.playedCards.push(animals, microbes);
      player.addResourceTo(animals, 2);
      player.addResourceTo(microbes, 3);
      expect(player.megaCredits).eq(0);
    });

    it('data SPENT or removed: nothing (Political Science\'s action spends 3)', () => {
      const science = new PoliticalScience();
      player.playedCards.push(science);
      science.resourceCount = 4;
      science.action(player);
      runAllActions(game);
      expect(science.resourceCount).eq(1);
      card.resourceCount = 2;
      player.removeResourceFrom(card, 1);
      expect(card.resourceCount).eq(1);
      expect(player.megaCredits).eq(0);
    });

    it('an OPPONENT adding data to their own card pays this card\'s owner nothing', () => {
      const theirs = new PoliticalScience();
      opponent.playedCards.push(theirs);
      opponent.addResourceTo(theirs, {qty: 2, log: true});
      expect(theirs.resourceCount).eq(2);
      expect(player.megaCredits).eq(0);
      expect(opponent.megaCredits).eq(0);
    });
  });

  it('rule 6 — the M€ name THIS card: the effect scope, the event source, the log line', () => {
    card.action(player);
    runAllActions(game);
    const events = game.events.events;
    const triggers = events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.MARTIAN_FIBER);
    expect(triggers.map((e) => e.trigger)).deep.eq(['resource-added']);
    const paid = events.filter((e) => e.type === 'resource-changed' && e.source?.kind === 'card' && e.source.card === CardName.MARTIAN_FIBER);
    expect(paid.map((e) => e.impact.stock?.[Resource.MEGACREDITS])).deep.eq([1]);
    const lines = game.gameLog.map((m) => formatMessage(m));
    expect(lines.some((l) => /gained 1 .*because of Martian Fiber/i.test(l)), lines.slice(-6).join('\n')).is.true;
  });

  it('rule 5 — 1 VP per 2 data here: 0 / 1 / 2 / 3 / 4 data → 0 / 0 / 1 / 1 / 2', () => {
    const vp = [0, 1, 2, 3, 4].map((n) => {
      card.resourceCount = n;
      return card.getVictoryPoints(player);
    });
    expect(vp).deep.eq([0, 0, 1, 1, 2]);
  });

  describe('save / reload', () => {
    it('the stored data survive serialization, and the reloaded card still pays', () => {
      card.resourceCount = 3;
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const owner = reloaded.getPlayerById(player.id);
      const again = owner.playedCards.get(CardName.MARTIAN_FIBER) as IProjectCard | undefined;
      expect(again?.resourceCount).eq(3);
      const before = owner.megaCredits;
      owner.addResourceTo(again!, 1);
      expect(owner.megaCredits - before).eq(1);
      expect(again?.getVictoryPoints(owner)).eq(2);
    });
  });
});
