import {expect} from 'chai';
import {Ecotec} from '@/server/cards/prelude2/Ecotec';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {newCard} from '@/server/createCard';
import {ICard} from '@/server/cards/ICard';
import {IGame} from '@/server/IGame';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectCard} from '@/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {cast} from '@/common/utils/utils';
import {ProtectedGrowth} from '@/server/cards/promo/ProtectedGrowth';
import {Heather} from '@/server/cards/base/Heather';
import {AdvancedEcosystems} from '@/server/cards/base/AdvancedEcosystems';
import {GHGProducingBacteria} from '@/server/cards/base/GHGProducingBacteria';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Payment} from '@/common/inputs/Payment';
import {CardResource} from '@/common/CardResource';
import {Phase} from '@/common/Phase';
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {OrOptionsModel, SelectCardModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {allForecastFacts} from '@/common/models/EffectForecastModel';
import {effectForecastForPlay} from '@/server/models/effectForecast';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {corporationCardsFromJSON} from '@/server/createCard';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('Ecotec', () => {
  let card: Ecotec;
  let player: TestPlayer;
  let game: IGame;
  let tardigrades: Tardigrades;

  beforeEach(() => {
    card = new Ecotec();
    [game, player] = testGame(2);
    tardigrades = new Tardigrades();
  });

  it('play', () => {
    player.playCorporationCard(card);
    expect(player.megaCredits).to.eq(42);
    expect(player.production.plants).to.eq(1);
  });

  for (const run of [
    {cardName: CardName.SF_MEMORIAL, expected: 0}, // no ANIMAL/PLANT/MICROBE tags
    {cardName: CardName.PROTECTED_GROWTH, expected: 1}, // 1 relevant tag (PLANT)
    {cardName: CardName.ECOLOGICAL_ZONE, expected: 2}, // 2 relevant tags (ANIMAL, PLANT)
  ] as const) {
    it('onCardPlayed ' + JSON.stringify(run), () => {
      const playedCard = newCard(run.cardName);
      card.onCardPlayed(player, playedCard);
      expect(player.plants).to.eq(run.expected);
    });
  }

  function setupForMicrobeChoice() {
    player.playedCards.push(tardigrades);

    card.onCardPlayed(player, new ProtectedGrowth());
    runAllActions(game);
  }

  it('offers a choice between a plant and a microbe when a microbe-resource card is in play', () => {
    setupForMicrobeChoice();

    const orOptions = cast(player.popWaitingFor(), OrOptions);
    expect(orOptions.options).has.lengthOf(2);
  });

  it('choosing to gain a plant grants 1 plant', () => {
    setupForMicrobeChoice();

    const orOptions = cast(player.popWaitingFor(), OrOptions);
    orOptions.options[1].cb(); // options[0] is the microbe SelectCard, options[1] is "Gain plant"

    expect(player.plants).to.eq(1);
    expect(tardigrades.resourceCount).to.eq(0);
  });

  it('choosing to add a microbe adds it to the selected card', () => {
    setupForMicrobeChoice();

    const orOptions = cast(player.popWaitingFor(), OrOptions);
    const selectCard = cast(orOptions.options[0], SelectCard<ICard>);
    expect(selectCard.cards).deep.eq([tardigrades]);
    selectCard.cb([tardigrades]);

    expect(tardigrades.resourceCount).to.eq(1);
    expect(player.plants).to.eq(0);
  });

  it('onNonCardTagAdded gains 1 plant for a PLANT tag', () => {
    card.onNonCardTagAdded(player, Tag.PLANT);
    expect(player.plants).to.eq(1);
  });

  it('onNonCardTagAdded ignores tags other than PLANT', () => {
    card.onNonCardTagAdded(player, Tag.SCIENCE);
    expect(player.plants).to.eq(0);
  });
});

/**
 * THE FORK — PC04 Ecotec crosses (`docs/PRELUDE2_ADAPTATION.md`): rules 1–7 of the card file's header, on the real
 * roads (the start through `playCorporationCard`, plays through `playCard`, answers through `player.process`), the
 * question's markers, the forecast twin, the Redux table, a second corporation and the bot's table.
 */
describe('Ecotec — the fork', () => {
  let card: Ecotec;
  let player: TestPlayer;
  let rival: TestPlayer;
  let game: IGame;

  /** Puts a project card in the hand and plays it from there (requirements are not the subject). */
  function playFromHand(p: TestPlayer, played: IProjectCard): IProjectCard {
    p.cardsInHand.push(played);
    p.megaCredits = Math.max(p.megaCredits, played.cost);
    p.playCard(played, {...Payment.EMPTY, megacredits: played.cost});
    runAllActions(p.game);
    return played;
  }

  /** The question standing now — Ecotec's, by its marker (never its title). */
  function question(p: TestPlayer = player): OrOptions {
    const wf = cast(p.getWaitingFor(), OrOptions);
    expect(wf.choiceContext?.source).deep.eq({kind: 'corporation', card: CardName.ECOTEC});
    return wf;
  }

  function answerPlant(p: TestPlayer = player): void {
    question(p);
    // The answer's continuation runs the queue on to the NEXT question (a second drain would overwrite it).
    p.process({type: 'or', index: 1, response: {type: 'option'}});
  }

  function answerMicrobe(target: CardName, p: TestPlayer = player): void {
    question(p);
    p.process({type: 'or', index: 0, response: {type: 'card', cards: [target]}});
  }

  function factsFor(played: ICard, p: TestPlayer = player) {
    return card.cardPlayedForecast(p, p, played);
  }

  beforeEach(() => {
    card = new Ecotec();
    [game, player, rival] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);
  });

  describe('rule 1 — the start, «including these 2»', () => {
    it('42 M€, plant production 1, and the corporation\'s own two bio tags pay 2 plants (nobody holds microbes)', () => {
      expect(player.megaCredits).eq(42);
      expect(player.production.plants).eq(1);
      expect(player.plants).eq(2);
      expect(player.getWaitingFor()).is.undefined;
    });

    it('the start\'s plants are RECORDED under the corporation and its journal line names it', () => {
      const [g, p] = testGame(2);
      const reactions = g.cardReactions.length;
      const log = g.gameLog.length;
      p.playCorporationCard(new Ecotec());
      runAllActions(g);
      const own = g.cardReactions.slice(reactions).filter((r) => r.card === CardName.ECOTEC);
      expect(own).has.length(1);
      expect(own[0]).deep.include({kind: 'corporation', channel: 'card-played', cause: {card: CardName.ECOTEC}});
      expect(own[0].impacts).deep.eq([{kind: 'stock', resource: 'plants', amount: 2, to: p.color}]);
      const line = g.gameLog.slice(log).find((l) => l.data.some((d) => d.value === 'plants') && l.data.some((d) => d.value === CardName.ECOTEC));
      expect(line, 'a journal line naming the corporation beside the plants').is.not.undefined;
    });

    it('keeps its art and lore keyed on PC04 (the number upstream marks «Renumber» stays)', () => {
      expect(card.metadata.cardNumber).eq('PC04');
    });
  });

  describe('rules 2–5 — one answer per printed bio tag', () => {
    it('no holder: Heather (1) and Advanced Ecosystems (3) pay their plants at once, no question', () => {
      playFromHand(player, new Heather());
      expect(player.plants, '2 at the start + Heather’s own 1 + the answer 1').eq(4);
      playFromHand(player, new AdvancedEcosystems());
      expect(player.plants).eq(7);
      expect(player.getWaitingFor()).is.undefined;
    });

    it('three tags with holders: THREE questions in turn, each answered on its own (plant · microbe · microbe)', () => {
      const tardigrades = new Tardigrades();
      const ghg = new GHGProducingBacteria();
      player.playedCards.push(tardigrades, ghg);
      playFromHand(player, new AdvancedEcosystems());
      answerPlant();
      answerMicrobe(CardName.TARDIGRADES);
      answerMicrobe(CardName.GHG_PRODUCING_BACTERIA);
      expect(player.plants).eq(3);
      expect(tardigrades.resourceCount).eq(1);
      expect(ghg.resourceCount).eq(1);
      expect(player.getWaitingFor()).is.undefined;
    });

    it('the answers are independent: three microbes on ONE card', () => {
      const tardigrades = new Tardigrades();
      player.playedCards.push(tardigrades);
      playFromHand(player, new AdvancedEcosystems());
      answerMicrobe(CardName.TARDIGRADES);
      answerMicrobe(CardName.TARDIGRADES);
      answerMicrobe(CardName.TARDIGRADES);
      expect(tardigrades.resourceCount).eq(3);
      expect(player.plants).eq(2);
    });

    it('a SINGLE holder is still asked — nothing lands before the answer', () => {
      const tardigrades = new Tardigrades();
      player.playedCards.push(tardigrades);
      playFromHand(player, new Heather());
      const pick = cast(question().options[0], SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      expect(tardigrades.resourceCount).eq(0);
      expect(player.plants, '2 at the start + Heather’s own 1 — the answer still owed').eq(3);
    });

    it('the played card that holds microbes is a candidate of its own question (Tardigrades, no other holder)', () => {
      const tardigrades = playFromHand(player, new Tardigrades());
      const pick = cast(question().options[0], SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      answerMicrobe(CardName.TARDIGRADES);
      expect(tardigrades.resourceCount).eq(1);
    });

    it('the holders are read AT THE QUESTION, never snapshotted at the play', () => {
      player.playedCards.push(new Tardigrades());
      playFromHand(player, new AdvancedEcosystems());
      expect(cast(question().options[0], SelectCard<ICard>).cards).has.length(1);
      // A holder arrives while the first question stands; the second is built when the first is answered.
      player.playedCards.push(new GHGProducingBacteria());
      player.process({type: 'or', index: 1, response: {type: 'option'}});
      expect(cast(question().options[0], SelectCard<ICard>).cards.map((c) => c.name))
        .deep.eq([CardName.TARDIGRADES, CardName.GHG_PRODUCING_BACTERIA]);
    });

    it('the wild tag is not a bio tag; an event\'s bio tag is', () => {
      // Protected Growth first: its own plants count POWER tags, and the wild tag would be one.
      playFromHand(player, new ProtectedGrowth());
      expect(player.plants).eq(3);
      playFromHand(player, fakeCard({tags: [Tag.WILD], cost: 0}));
      expect(player.plants).eq(3);
    });

    it('a rival\'s bio card is nobody\'s here', () => {
      playFromHand(rival, new AdvancedEcosystems());
      expect(player.plants).eq(2);
      expect(player.getWaitingFor()).is.undefined;
    });

    it('rule 6 — a bare Plant tag with a holder asks one question', () => {
      player.playedCards.push(new Tardigrades());
      card.onNonCardTagAdded(player, Tag.PLANT);
      runAllActions(game);
      answerPlant();
      expect(player.plants).eq(3);
      expect(player.getWaitingFor()).is.undefined;
    });
  });

  describe('the question\'s markers — the shared step\'s pick, the plant\'s chip, the corporation\'s source', () => {
    it('effect-choice of the corporation, the upstream order [pick, plant], the pick marked by the shared step', () => {
      player.playedCards.push(new Tardigrades());
      playFromHand(player, new Heather());
      expect(question().choiceContext).deep.include({source: {kind: 'corporation', card: CardName.ECOTEC}, mode: 'effect-choice'});
      const model = question().toModel(player) as OrOptionsModel;
      const pick = model.options[0] as SelectCardModel;
      expect(pick.type).eq('card');
      expect(pick.resourceGainPrompt).deep.include({amount: 1, cardResource: 'microbe'});
      expect(cast(question().options[0], SelectCard<ICard>).choiceContext?.source).deep.eq({kind: 'corporation', card: CardName.ECOTEC});
      expect((model.options[1] as SelectOptionModel).metadata).deep.include({kind: 'resourceGain'});
    });

    it('a microbe answer is recorded as the corporation\'s landing on the chosen card', () => {
      player.playedCards.push(new Tardigrades());
      const reactions = game.cardReactions.length;
      playFromHand(player, new Heather());
      answerMicrobe(CardName.TARDIGRADES);
      const own = game.cardReactions.slice(reactions).filter((r) => r.card === CardName.ECOTEC);
      expect(own).has.length(1);
      expect(own[0].cause).deep.eq({card: CardName.HEATHER});
      expect(own[0].impacts).deep.eq([{kind: 'card-resource', resource: CardResource.MICROBE, amount: 1, target: CardName.TARDIGRADES, to: player.color}]);
    });
  });

  describe('the series — every question names its place (GS: k of N, never a repeat)', () => {
    it('three tags: the questions carry {index: k, of: 3} in turn; a lone question carries none', () => {
      player.playedCards.push(new Tardigrades());
      playFromHand(player, new AdvancedEcosystems());
      for (let k = 1; k <= 3; k++) {
        expect(question().choiceContext?.series, `question ${k}`).deep.eq({index: k, of: 3});
        answerPlant();
      }
      playFromHand(player, new Heather());
      expect(question().choiceContext?.series).is.undefined;
    });

    it('the pre-collected steps carry the same place (the composer reads the live grammar)', () => {
      player.playedCards.push(new Tardigrades());
      const steps = factsFor(new AdvancedEcosystems()).map((f) => f.preselect);
      expect(steps.map((s) => s?.kind === 'input' ? s.input.choiceContext?.series : undefined))
        .deep.eq([{index: 1, of: 3}, {index: 2, of: 3}, {index: 3, of: 3}]);
    });
  });

  describe('the forecast twin — the same predicate, the same builder', () => {
    it('no holder: one `exact` +N plants on printed effect #0; no bio tag: nothing', () => {
      const facts = factsFor(new AdvancedEcosystems());
      expect(facts.map((f) => f.certainty)).deep.eq(['exact']);
      expect(facts[0].source.printedEffect).eq(0);
      expect(facts[0].effects[0]).deep.include({direction: 'gain', icon: 'plants', amount: 3});
      expect(factsFor(newCard(CardName.SF_MEMORIAL)!)).deep.eq([]);
    });

    it('a holder: one `asks` per tag, distinct ids, each PRE-COLLECTED from the live builder and addressed to Ecotec', () => {
      player.playedCards.push(new Tardigrades());
      const facts = factsFor(new AdvancedEcosystems());
      expect(facts.map((f) => f.certainty)).deep.eq(['asks', 'asks', 'asks']);
      expect(facts.map((f) => f.id.replace(/^.*-(tag-\d)$/, '$1'))).deep.eq(['tag-0', 'tag-1', 'tag-2']);
      for (const fact of facts) {
        expect(fact.effects[0]).deep.include({direction: 'gain', icon: 'microbe', amount: 1});
        expect(fact.alternatives?.[0].label).eq('Gain plant');
        const step = fact.preselect;
        if (step?.kind !== 'input') {
          throw new Error('no preselect');
        }
        expect(step.for).deep.eq({role: 'or', source: {kind: 'corporation', card: CardName.ECOTEC}});
        const pick = (step.input as OrOptionsModel).options[0] as SelectCardModel;
        expect(pick.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      }
    });

    it('the played card that holds microbes makes the forecast ASK, never promise a plant (Tardigrades alone)', () => {
      const facts = factsFor(new Tardigrades());
      expect(facts.map((f) => f.certainty)).deep.eq(['asks']);
      const step = facts[0].preselect;
      if (step?.kind !== 'input') {
        throw new Error('no preselect');
      }
      expect(((step.input as OrOptionsModel).options[0] as SelectCardModel).cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
    });

    it('the composer\'s forecast of a bio card in the hand reads the twin; a rival\'s view carries no pre-select', () => {
      player.playedCards.push(new Tardigrades());
      const heather = new Heather();
      player.cardsInHand.push(heather);
      const facts = allForecastFacts(effectForecastForPlay(player, heather, cardPlayPreview(player, heather)))
        .filter((f) => f.source.name === CardName.ECOTEC);
      expect(facts.map((f) => f.certainty)).deep.eq(['asks']);
      expect(card.cardPlayedForecast(player, rival, heather)[0].preselect).is.undefined;
    });

    it('the corporation\'s own play forecasts its +2 plants', () => {
      const [, p] = testGame(2);
      const ecotec = new Ecotec();
      const facts = ecotec.cardPlayedForecast(p, p, ecotec);
      expect(facts.map((f) => f.certainty)).deep.eq(['exact']);
      expect(facts[0].effects[0]).deep.include({icon: 'plants', amount: 2});
    });
  });

  describe('rule 7 — the Redux table, a second corporation, MarsBot', () => {
    it('on the Redux table a bio card answers as anywhere', () => {
      const [g, p] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      g.phase = Phase.ACTION;
      seatEnacted(g.parliament!, quietResolutionOf(PartyName.UNITY as ReduxParty));
      p.playCorporationCard(new Ecotec());
      runAllActions(g);
      expect(p.plants).eq(2);
      p.playedCards.push(new Tardigrades());
      playFromHand(p, new Heather());
      answerPlant(p);
      expect(p.plants, '2 at the start + Heather’s own 1 + the answer 1').eq(4);
    });

    it('as the SECOND corporation with a holder already on the table: its own two tags ask twice', () => {
      const [g, p] = testGame(2);
      p.playCorporationCard(corporationCardsFromJSON([CardName.TERRALABS_RESEARCH])[0]);
      runAllActions(g);
      const tardigrades = new Tardigrades();
      p.playedCards.push(tardigrades);
      p.playCorporationCard(new Ecotec());
      runAllActions(g);
      answerMicrobe(CardName.TARDIGRADES, p);
      answerPlant(p);
      expect(tardigrades.resourceCount).eq(1);
      expect(p.getWaitingFor()).is.undefined;
    });

    it('the human\'s Ecotec keeps the bot off its twin C40 (the collision key is `original`)', () => {
      expect(marsBotCorpInfo(MarsBotCorpId.C40_ECOTEC).original).eq(CardName.ECOTEC);
      const [botGame, human] = testAutomaGame({
        corporation: MarsBotCorpId.C40_ECOTEC, keepInitialCardSelection: true,
      }, '-ecotec');
      human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
        ...corporationCardsFromJSON([CardName.ECOTEC]));
      human.dealtProjectCards.splice(0, human.dealtProjectCards.length);
      human.process({type: 'initialCards', responses: [
        {type: 'card', cards: [CardName.ECOTEC]},
        {type: 'card', cards: []},
      ]});
      runAllActions(botGame);
      human.process({type: 'card', cards: [CardName.ECOTEC]});
      runAllActions(botGame);
      expect(human.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.ECOTEC]);
      expect(human.plants).eq(2);
      expect(botGame.automa!.corporation).is.not.undefined;
      expect(botGame.automa!.corporation).not.eq(MarsBotCorpId.C40_ECOTEC);
    });
  });
});
