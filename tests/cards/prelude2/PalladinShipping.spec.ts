import {expect} from 'chai';
import {PalladinShipping} from '@/server/cards/prelude2/PalladinShipping';
import {CardName} from '@/common/cards/CardName';
import {newCard} from '@/server/createCard';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions, setRulingParty, setTemperature} from '../../TestingUtils';
import {PartyName} from '@/common/turmoil/PartyName';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Payment} from '@/common/inputs/Payment';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {MAX_TEMPERATURE} from '@/common/constants';
import {allForecastFacts} from '@/common/models/EffectForecastModel';
import {effectForecastForPlay} from '@/server/models/effectForecast';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {actionPreview} from '@/server/models/actionPreview';
import {actionFutility} from '@/server/models/actionFutility';
import {actionUnavailableReasons} from '@/server/models/actionUnavailableReasons';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {cast} from '@/common/utils/utils';
import {ReduxParty, resolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {DIVERTED_RESEARCH_ID} from '@/server/parliament/resolutions/reds/DivertedResearch';
import {UNMI_VETO_ID} from '@/server/parliament/resolutions/reds/UnmiVeto';
import {Supercomputer} from '@/server/cards/turmoilRedux/Supercomputer';
import {PreservationProgram} from '@/server/cards/prelude2/PreservationProgram';
import {quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {corporationCardsFromJSON} from '@/server/createCard';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('PalladinShipping', () => {
  let card: PalladinShipping;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new PalladinShipping();
    [game, player] = testGame(2);
  });

  it('play', () => {
    player.playCorporationCard(card);
    expect(player.megaCredits).to.eq(36);
    expect(player.stock.titanium).to.eq(5);
  });

  it('canAct', () => {
    player.stock.titanium = 1;
    expect(card.canAct(player)).is.false;

    player.stock.titanium = 2;
    expect(card.canAct(player)).is.true;
  });

  it('canAct when reds are in power', () => {
    [game, player] = testGame(2, {turmoilExtension: true});
    setRulingParty(game, PartyName.REDS);
    player.stock.titanium = 2;
    player.megaCredits = 2;

    expect(card.canAct(player)).is.false;

    player.megaCredits = 3;

    expect(card.canAct(player)).is.true;
  });

  it('action', () => {
    player.stock.titanium = 2;
    setTemperature(game, 4);

    card.action(player);
    runAllActions(game);

    expect(player.stock.titanium).to.eq(0);
    expect(game.getTemperature()).to.eq(6);
  });

  for (const run of [
    {cardName: CardName.ASTEROID, expected: 1}, // EVENT with the SPACE tag
    {cardName: CardName.MINING_COLONY, expected: 0}, // SPACE-tagged, but not an EVENT
    {cardName: CardName.PUBLIC_PLANS, expected: 0}, // EVENT, but no SPACE tag
    {cardName: CardName.SF_MEMORIAL, expected: 0}, // neither EVENT nor SPACE-tagged
  ] as const) {
    it('onCardPlayed ' + JSON.stringify(run), () => {
      const playedCard = newCard(run.cardName);
      card.onCardPlayed(player, playedCard);
      expect(player.stock.titanium).to.eq(run.expected);
    });
  }
});

/**
 * PC02 — the fork's readings (the card's RULE READINGS 1–8, `PalladinShipping.ts`). The upstream `it`s above stay as
 * they are; everything below walks the REAL roads — `playCard` from the hand with a titanium payment, the declarative
 * action through the engine's own preview / reason / futility readers, the Redux doors, the bot's table.
 */
describe('PalladinShipping — the fork', () => {
  let card: PalladinShipping;
  let player: TestPlayer;
  let rival: TestPlayer;
  let game: IGame;

  /** Puts a project card in the hand and plays it from there, paying with what the arguments name. */
  function playFromHand(p: TestPlayer, name: CardName, payment: Partial<Payment>): IProjectCard {
    const played = newCard(name) as IProjectCard;
    p.cardsInHand.push(played);
    p.playCard(played, {...Payment.EMPTY, ...payment});
    runAllActions(p.game);
    return played;
  }

  beforeEach(() => {
    card = new PalladinShipping();
    [game, player, rival] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);
  });

  describe('rule 1 — the start', () => {
    it('36 M€ and 5 titanium, the Space tag counted as the corporation\'s own; the corporation wakes no effect of its own', () => {
      expect(player.megaCredits).eq(36);
      expect(player.stock.titanium).eq(5);
      expect(player.tags.count(Tag.SPACE, 'raw')).eq(1);
      expect(PalladinShipping.answersTo(card), 'a corporation is not an event').is.false;
    });

    it('keeps its art and lore keyed on PC02 (the number upstream marks «Renumber» stays)', () => {
      expect(card.metadata.cardNumber).eq('PC02');
    });
  });

  describe('rules 2–4 — the space event, played from the hand', () => {
    it('Imported GHG paid with titanium: the price leaves first, the effect\'s titanium comes after it', () => {
      player.megaCredits = 0;
      // 7 M€ at a titanium value of 3: 3 titanium (9 M€) of the five held.
      playFromHand(player, CardName.IMPORTED_GHG, {titanium: 3});
      expect(player.stock.titanium, '5 − 3 paid + 1 answered').eq(3);
      expect(player.production.heat).eq(1);
      expect(player.heat).eq(3);
    });

    it('the titanium cannot pay for the event that produced it: with 2 titanium and 0 M€ a 7 M€ event is not payable', () => {
      player.stock.titanium = 2;
      player.megaCredits = 0;
      const event = newCard(CardName.IMPORTED_GHG) as IProjectCard;
      player.cardsInHand.push(event);
      expect(player.canPlay(event), 'the answer does not count toward its own price').is.false;
    });

    it('the reaction is RECORDED under the corporation, caused by the event; the journal line names the corporation', () => {
      player.megaCredits = 20;
      const reactions = game.cardReactions.length;
      const log = game.gameLog.length;
      playFromHand(player, CardName.IMPORTED_GHG, {megacredits: 7});
      const own = game.cardReactions.slice(reactions).filter((r) => r.card === CardName.PALLADIN_SHIPPING);
      expect(own).has.length(1);
      expect(own[0]).deep.include({kind: 'corporation', channel: 'card-played', cause: {card: CardName.IMPORTED_GHG}});
      expect(own[0].impacts).deep.eq([{kind: 'stock', resource: 'titanium', amount: 1, to: player.color}]);
      const line = game.gameLog.slice(log).find((l) => l.data.some((d) => d.value === 'titanium'));
      expect(line?.data.map((d) => d.value)).contains(CardName.PALLADIN_SHIPPING);
    });

    it('ONE titanium per card, whatever its tags (Imported GHG prints Earth AND Space)', () => {
      player.megaCredits = 20;
      playFromHand(player, CardName.IMPORTED_GHG, {megacredits: 7});
      expect(player.stock.titanium).eq(6);
    });

    it('the two «almost» cases answer nothing: a space card that is not an event, an event without the Space tag', () => {
      player.megaCredits = 50;
      playFromHand(player, CardName.MINING_COLONY, {megacredits: 20});
      expect(player.stock.titanium).eq(5);
      playFromHand(player, CardName.PUBLIC_PLANS, {megacredits: 7});
      expect(player.stock.titanium).eq(5);
    });

    it('a rival\'s space event is nobody\'s here', () => {
      rival.megaCredits = 20;
      playFromHand(rival, CardName.IMPORTED_GHG, {megacredits: 7});
      expect(player.stock.titanium).eq(5);
    });
  });

  describe('the forecast twin — the same predicate, Optimal Aerobraking\'s reason keys', () => {
    function factsFor(name: CardName) {
      return card.cardPlayedForecast(player, player, newCard(name)!);
    }

    it('a space event: one `exact` +1 titanium on printed effect #0, reason «You play a space event»', () => {
      const facts = factsFor(CardName.ASTEROID);
      expect(facts).has.length(1);
      expect(facts[0]).deep.include({certainty: 'exact', reason: 'You play a space event'});
      expect(facts[0].source.printedEffect).eq(0);
      expect(facts[0].effects.map((e) => [e.icon, e.amount])).deep.eq([['titanium', 1]]);
    });

    it('the two «almost»: `no` with the twin\'s keys; an unrelated card forecasts nothing', () => {
      expect(factsFor(CardName.MINING_COLONY).map((f) => [f.certainty, f.reason])).deep.eq([['no', 'The card is not an event']]);
      expect(factsFor(CardName.PUBLIC_PLANS).map((f) => [f.certainty, f.reason])).deep.eq([['no', 'The event has no space tag']]);
      expect(factsFor(CardName.SF_MEMORIAL)).is.empty;
    });

    it('the composer\'s forecast of a space event in the hand says +1 titanium (the engine reads the twin)', () => {
      const event = newCard(CardName.IMPORTED_GHG) as IProjectCard;
      player.cardsInHand.push(event);
      const facts = allForecastFacts(effectForecastForPlay(player, event, cardPlayPreview(player, event)))
        .filter((f) => f.source.name === CardName.PALLADIN_SHIPPING);
      expect(facts.map((f) => f.certainty)).deep.eq(['exact']);
    });
  });

  describe('rule 5 — the action is a declaration', () => {
    it('the preview: the price «2 titanium», the temperature step, its implied rating', () => {
      player.stock.titanium = 4;
      setTemperature(game, -10);
      const branch = actionPreview(player, card).branches[0];
      expect(branch.available).is.true;
      expect(branch.effects.find((e) => e.direction === 'cost')).deep.include({icon: 'titanium', amount: 2, current: 4, resulting: 2});
      expect(branch.effects.find((e) => e.icon === 'temperature')).deep.include({current: -10, resulting: -8});
      expect(branch.effects.find((e) => e.icon === 'tr')).deep.include({amount: 1, implied: true});
    });

    it('below 2 titanium the action is SHOWN refused with the engine\'s own reason', () => {
      player.stock.titanium = 1;
      expect(card.canAct(player)).is.false;
      expect(actionUnavailableReasons(player, card)).is.not.empty;
    });

    it('the price is two UNITS: a titanium value of 4 (Advanced Alloys) still spends 2', () => {
      player.increaseTitaniumValue();
      player.stock.titanium = 2;
      setTemperature(game, -10);
      card.action(player);
      runAllActions(game);
      expect(player.stock.titanium).eq(0);
      expect(game.getTemperature()).eq(-8);
    });

    it('once per generation, as every card action', () => {
      player.stock.titanium = 4;
      expect(player.getPlayableActionCards().map((c) => c.name)).contains(CardName.PALLADIN_SHIPPING);
      player.actionsThisGeneration.add(card.name);
      expect(player.getPlayableActionCards().map((c) => c.name)).not.contains(CardName.PALLADIN_SHIPPING);
    });

    it('the step pays the rating: TR +1', () => {
      player.stock.titanium = 2;
      setTemperature(game, -10);
      const tr = player.terraformRating;
      card.action(player);
      runAllActions(game);
      expect(player.terraformRating).eq(tr + 1);
    });

    it('the −26 → −24 °C step pays the track\'s heat production', () => {
      player.stock.titanium = 2;
      setTemperature(game, -26);
      card.action(player);
      runAllActions(game);
      expect(game.getTemperature()).eq(-24);
      expect(player.production.heat).eq(1);
    });

    it('the −2 → 0 °C step asks the player\'s OWN ocean placement', () => {
      player.stock.titanium = 2;
      setTemperature(game, -2);
      card.action(player);
      runAllActions(game);
      expect(game.getTemperature()).eq(0);
      cast(player.popWaitingFor(), SelectSpace);
    });
  });

  describe('rule 6 — at the temperature maximum', () => {
    it('legal, gives nothing, NAMED futile («the parameter is at its maximum»)', () => {
      player.stock.titanium = 2;
      setTemperature(game, MAX_TEMPERATURE);
      expect(card.canAct(player)).is.true;
      expect(actionFutility(player, card)?.verdict).deep.include({kind: 'parameter-maxed'});
      expect(actionPreview(player, card).branches[0].effects.find((e) => e.icon === 'temperature'))
        .deep.include({current: MAX_TEMPERATURE, resulting: MAX_TEMPERATURE});
    });
  });

  describe('rule 7 — the Redux doors of the step', () => {
    function redux(): [IGame, TestPlayer, TestPlayer, PalladinShipping] {
      const [g, p, r] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      g.phase = Phase.ACTION;
      seatEnacted(g.parliament!, quietResolutionOf(PartyName.UNITY as ReduxParty));
      const c = new PalladinShipping();
      p.playCorporationCard(c);
      runAllActions(g);
      p.stock.titanium = 2;
      setTemperature(g, -10);
      return [g, p, r, c];
    }

    it('Diverted Research (RX35): the step is replaced by 1 data — the chip struck, the action of value with a holder', () => {
      const [g, p, , c] = redux();
      g.parliament!.enacted = resolutionInstanceId(DIVERTED_RESEARCH_ID, 0);
      p.playedCards.push(new Supercomputer());
      expect(actionPreview(p, c).branches[0].effects.find((e) => e.icon === 'temperature')?.diverted?.data).eq(1);
      expect(actionFutility(p, c)).is.undefined;
      c.action(p);
      runAllActions(g);
      expect(g.getTemperature(), 'the step became data').eq(-10);
      expect(p.stock.titanium).eq(0);
    });

    it('the UNMI veto (RX42): the step is made, the rating refused — and the preview strikes it', () => {
      const [g, p, r, c] = redux();
      g.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
      p.terraformRating = 30;
      r.terraformRating = 20;
      expect(actionPreview(p, c).branches[0].effects.find((e) => e.icon === 'tr')?.vetoed).is.not.undefined;
      c.action(p);
      runAllActions(g);
      expect(g.getTemperature()).eq(-8);
      expect(p.terraformRating).eq(30);
    });

    it('Preservation Program (P57) armed: the step is made, its rating is the one eaten', () => {
      const [g, p, , c] = redux();
      p.playedCards.push(new PreservationProgram());
      p.preservationProgram = true;
      const tr = p.terraformRating;
      c.action(p);
      runAllActions(g);
      expect(g.getTemperature()).eq(-8);
      expect(p.terraformRating).eq(tr);
    });

    it('a space event on the Redux table answers as anywhere', () => {
      const [g, p] = redux();
      p.megaCredits = 20;
      playFromHand(p, CardName.IMPORTED_GHG, {megacredits: 7});
      expect(p.stock.titanium).eq(3);
      expect(g.getTemperature()).eq(-10);
    });
  });

  describe('rule 8 — a second corporation (Merger) and MarsBot', () => {
    it('as the SECOND corporation: the effect and the action from the moment it is played', () => {
      const [g, p] = testGame(2);
      p.playCorporationCard(corporationCardsFromJSON([CardName.TERRALABS_RESEARCH])[0]);
      runAllActions(g);
      p.playCorporationCard(new PalladinShipping());
      runAllActions(g);
      expect(p.playedCards.corporations().map((c) => c.name)).contains(CardName.PALLADIN_SHIPPING);
      const titanium = p.stock.titanium;
      p.megaCredits = 20;
      playFromHand(p, CardName.IMPORTED_GHG, {megacredits: 7});
      expect(p.stock.titanium).eq(titanium + 1);
      expect(p.getPlayableActionCards().map((c) => c.name)).contains(CardName.PALLADIN_SHIPPING);
    });

    it('the human\'s Palladin keeps the bot off its twin C43 (the collision key is `original`)', () => {
      expect(marsBotCorpInfo(MarsBotCorpId.C43_PALLADIN_SHIPPING).original).eq(CardName.PALLADIN_SHIPPING);
      const [botGame, human] = testAutomaGame({
        corporation: MarsBotCorpId.C43_PALLADIN_SHIPPING, keepInitialCardSelection: true,
      }, '-palladin');
      human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
        ...corporationCardsFromJSON([CardName.PALLADIN_SHIPPING]));
      human.dealtProjectCards.splice(0, human.dealtProjectCards.length);
      human.process({type: 'initialCards', responses: [
        {type: 'card', cards: [CardName.PALLADIN_SHIPPING]},
        {type: 'card', cards: []},
      ]});
      runAllActions(botGame);
      human.process({type: 'card', cards: [CardName.PALLADIN_SHIPPING]});
      runAllActions(botGame);
      expect(human.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.PALLADIN_SHIPPING]);
      expect(human.stock.titanium).eq(5);
      expect(botGame.automa!.corporation).is.not.undefined;
      expect(botGame.automa!.corporation).not.eq(MarsBotCorpId.C43_PALLADIN_SHIPPING);
    });
  });
});
