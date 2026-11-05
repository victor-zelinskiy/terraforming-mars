import {expect} from 'chai';
import {Spire} from '@/server/cards/prelude2/Spire';
import {CardName} from '@/common/cards/CardName';
import {newCard} from '@/server/createCard';
import {ICard} from '@/server/cards/ICard';
import {IGame} from '@/server/IGame';
import {SelectCard} from '@/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {cast} from '@/common/utils/utils';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {newProjectCard, corporationCardsFromJSON} from '@/server/createCard';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectStandardProjectToPlay} from '@/server/inputs/SelectStandardProjectToPlay';
import {AsteroidStandardProject} from '@/server/cards/base/standardProjects/AsteroidStandardProject';
import {Payment} from '@/common/inputs/Payment';
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {Phase} from '@/common/Phase';
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {allForecastFacts} from '@/common/models/EffectForecastModel';
import {effectForecastForPlay} from '@/server/models/effectForecast';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {corpFirstActionPreview} from '@/server/models/corpFirstActionPreview';
import {buildCardInformation} from '@/server/tools/cardInfo/buildCardInformation';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('Spire', () => {
  let card: Spire;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Spire();
    [game, player] = testGame(2);
  });

  it('play', () => {
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(50);
    // Spire has 2 tags (CITY, EARTH), so it triggers its own onCardPlayed effect.
    expect(card.resourceCount).to.eq(1);
  });

  it('initialAction', () => {
    const selectCard = cast(card.initialAction(player), SelectCard<ICard>);
    expect(player.cardsInHand).has.lengthOf(4);
    expect(player.cardsInHand).deep.eq(selectCard.cards);

    const kept = selectCard.cards[2];
    const discarded = selectCard.cards.filter((c) => c !== kept);
    selectCard.cb(discarded);

    expect(player.cardsInHand).deep.eq([kept]);
    expect(game.projectDeck.discardPile).deep.eq(discarded);
  });

  for (const run of [
    {cardName: CardName.TESLARACT, expected: 1}, // 2 tags, not an EVENT
    {cardName: CardName.SF_MEMORIAL, expected: 0}, // 1 tag, not an EVENT
    {cardName: CardName.ISHTAR_EXPEDITION, expected: 1}, // EVENT with 1 tag; EVENT counts as +1
  ] as const) {
    it('onCardPlayed ' + JSON.stringify(run), () => {
      const playedCard = newCard(run.cardName);
      card.onCardPlayed(player, playedCard);
      expect(card.resourceCount).to.eq(run.expected);
    });
  }
});

describe('Spire — the fork', () => {
  let game: IGame;
  let player: TestPlayer;
  let rival: TestPlayer;

  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Puts a project card in the hand and plays it from there for exactly its price (requirements are not the subject). */
  function playFromHand(p: TestPlayer, played: IProjectCard): void {
    p.cardsInHand.push(played);
    p.megaCredits = played.cost;
    p.playCard(played, {...Payment.EMPTY, megacredits: played.cost});
    runAllActions(p.game);
  }

  /** Spire played by `player`, the action phase. */
  function owned(): Spire {
    const spire = new Spire();
    player.playCorporationCard(spire);
    runAllActions(game);
    game.phase = Phase.ACTION;
    return spire;
  }

  /** Take the owed first action through the marked prompt, stopping at its discard. */
  function firstActionToDiscard(): SelectCard<IProjectCard> {
    player.takeAction();
    const prompt = cast(player.getWaitingFor(), OrOptions);
    expect(prompt.startGamePrompt?.kind).eq('corporationInitialAction');
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    runAllActions(game);
    return cast(player.getWaitingFor(), SelectCard<IProjectCard>);
  }

  beforeEach(() => {
    [game, player, rival] = testGame(2);
  });

  it('keeps its art and lore keyed on PC05 (the number upstream marks «Renumber» stays)', () => {
    expect(new Spire().metadata.cardNumber).eq('PC05');
  });

  it('the start rule is the card\'s description (the generator reads it), the effect text carries its comma', () => {
    const spire = new Spire();
    expect(spire.metadata.description).eq('You start with 50 M€. As your first action, draw 4 cards, then discard 3 cards from your hand.');
    const info = buildCardInformation(spire, 'prelude2');
    const texts = (info?.groups.flatMap((g) => g.blocks) ?? []).map((b) => b.text);
    expect(texts).to.include('Effect: When you play a card with at least 2 tags, including this, add 1 science resource here.');
    expect(texts.some((t) => t.includes('tags. including')), 'the upstream typo is gone').is.false;
  });

  describe('rule 2 — the first action: draw 4, then discard 3 from the WHOLE hand', () => {
    it('the play owes the first action', () => {
      owned();
      expect(player.pendingInitialActions.map((c) => c.name)).deep.eq([CardName.SPIRE]);
    });

    it('the draw is ONE batch, sealed by the discard it waits on (the Pluto pair\'s grammar)', () => {
      owned();
      firstActionToDiscard();
      const batch = player.cardDrawReveals[player.cardDrawReveals.length - 1];
      expect(batch.cards).has.length(4);
      expect(batch.sealed).is.true;
      expect(batch.pendingAnswer).deep.eq({kind: 'discard', card: CardName.SPIRE});
    });

    it('the discard is asked from the whole hand — the bought cards and the drawn ones — exactly three, marked, the card named', () => {
      owned();
      const bought = [byName(CardName.MINE), byName(CardName.TARDIGRADES), byName(CardName.LICHEN)];
      player.cardsInHand.push(...bought);
      const select = firstActionToDiscard();
      expect(player.cardsInHand).has.length(7);
      expect(select.cards).deep.eq(player.cardsInHand);
      expect(select.config.min).eq(3);
      expect(select.config.max).eq(3);
      expect(select.discardPrompt?.source?.card).eq(CardName.SPIRE);
    });

    it('any three may go — the bought ones too — in the order of the answer; the first action is spent', () => {
      owned();
      const bought = [byName(CardName.MINE), byName(CardName.TARDIGRADES), byName(CardName.LICHEN)];
      player.cardsInHand.push(...bought);
      const select = firstActionToDiscard();
      const drawn = select.cards.filter((c) => !bought.includes(c));
      const discarded = [bought[2], drawn[1], bought[0]];
      const pile = game.projectDeck.discardPile.length;
      player.process({type: 'card', cards: discarded.map((c) => c.name)});
      runAllActions(game);
      expect(game.projectDeck.discardPile.slice(pile)).deep.eq(discarded);
      expect(player.cardsInHand).has.length(4);
      expect(player.cardsInHand).to.have.members([bought[1], drawn[0], drawn[2], drawn[3]]);
      expect(player.pendingInitialActions).deep.eq([]);
    });

    it('two cards are refused (exactly three)', () => {
      owned();
      const select = firstActionToDiscard();
      expect(() => player.process({type: 'card', cards: select.cards.slice(0, 2).map((c) => c.name)})).to.throw();
    });

    it('the briefing names both steps: the draw chip +4 and the discard step (never pre-collected)', () => {
      const preview = corpFirstActionPreview(player, new Spire());
      const branch = preview.branches[0];
      expect(branch.effects.find((e) => e.icon === 'cards')).deep.include({direction: 'gain', amount: 4});
      expect(branch.steps.map((s) => s.kind)).deep.eq(['note']);
    });
  });

  describe('rules 1 · 3 — «at least 2 tags» (the wild tag COUNTED, an event\'s own added)', () => {
    it('the count table (`tagsCounted`)', () => {
      const rows: Array<[ICard, number]> = [
        [fakeCard({tags: [Tag.SCIENCE]}), 1],
        [fakeCard({tags: [Tag.SCIENCE, Tag.BUILDING]}), 2],
        [fakeCard({type: CardType.EVENT, tags: [Tag.SPACE]}), 2],
        [fakeCard({type: CardType.EVENT, tags: []}), 1],
        [fakeCard({tags: [Tag.WILD]}), 1],
        [fakeCard({tags: [Tag.SCIENCE, Tag.WILD]}), 2],
      ];
      for (const [counted, count] of rows) {
        expect(Spire.tagsCounted(counted), JSON.stringify(counted.tags)).eq(count);
      }
    });

    it('the start: 50 M€ and 1 science on the card («including this» — CITY · EARTH)', () => {
      const spire = owned();
      expect(player.megaCredits).eq(50);
      expect(spire.resourceCount).eq(1);
    });

    it('real plays from the hand: two tags +1 · one tag 0 · an event with one tag +1 · an event with none 0', () => {
      const spire = owned();
      const runs: Array<[CardName, number]> = [
        [CardName.DEVELOPMENT_CENTER, 1],
        [CardName.MINE, 0],
        [CardName.ASTEROID, 1],
        [CardName.INDENTURED_WORKERS, 0],
      ];
      for (const [name, gain] of runs) {
        const before = spire.resourceCount;
        playFromHand(player, byName(name));
        expect(spire.resourceCount - before, name).eq(gain);
      }
    });

    it('a rival\'s play is nobody\'s here', () => {
      const spire = owned();
      playFromHand(rival, byName(CardName.DEVELOPMENT_CENTER));
      expect(spire.resourceCount).eq(1);
    });
  });

  describe('the forecast twin — the same count', () => {
    function facts(played: ICard) {
      return new Spire().cardPlayedForecast(player, player, played);
    }

    it('two tags or more: `exact` +1 science on printed effect #0; fewer: nothing', () => {
      const two = facts(byName(CardName.DEVELOPMENT_CENTER));
      expect(two.map((f) => f.certainty)).deep.eq(['exact']);
      expect(two[0].source.printedEffect).eq(0);
      expect(two[0].effects[0]).deep.include({direction: 'gain', amount: 1});
      expect(facts(byName(CardName.ASTEROID)).map((f) => f.certainty)).deep.eq(['exact']);
      expect(facts(byName(CardName.MINE))).deep.eq([]);
      expect(facts(byName(CardName.INDENTURED_WORKERS))).deep.eq([]);
    });

    it('the forecast of a card in the hand reads the twin (the composer\'s «Сработает»), and the play pays what it promised', () => {
      const spire = owned();
      const center = byName(CardName.DEVELOPMENT_CENTER);
      player.cardsInHand.push(center);
      const all = allForecastFacts(effectForecastForPlay(player, center, cardPlayPreview(player, center)))
        .filter((f) => f.source.name === CardName.SPIRE);
      expect(all.map((f) => f.certainty)).deep.eq(['exact']);
      player.cardsInHand.splice(player.cardsInHand.indexOf(center), 1);
      playFromHand(player, center);
      expect(spire.resourceCount).eq(2);
    });

    it('the corporation\'s own play forecasts its +1 science', () => {
      const spire = new Spire();
      expect(spire.cardPlayedForecast(player, player, spire).map((f) => f.certainty)).deep.eq(['exact']);
    });
  });

  describe('rule 4 — science pays a STANDARD PROJECT, 2 M€ each', () => {
    function menu(): SelectStandardProjectToPlay {
      return new SelectStandardProjectToPlay(player, [new AsteroidStandardProject()]);
    }

    it('in science alone, mixed with M€, and overpaid (no change given)', () => {
      const spire = owned();
      spire.resourceCount = 7;
      player.megaCredits = 20;
      menu().process({type: 'projectCard', card: CardName.ASTEROID_STANDARD_PROJECT, payment: {...Payment.EMPTY, spireScience: 7}});
      expect(spire.resourceCount).eq(0);
      expect(player.megaCredits).eq(20);

      spire.resourceCount = 3;
      menu().process({type: 'projectCard', card: CardName.ASTEROID_STANDARD_PROJECT, payment: {...Payment.EMPTY, megacredits: 8, spireScience: 3}});
      expect(spire.resourceCount).eq(0);
      expect(player.megaCredits).eq(12);

      spire.resourceCount = 2;
      player.megaCredits = 12;
      menu().process({type: 'projectCard', card: CardName.ASTEROID_STANDARD_PROJECT, payment: {...Payment.EMPTY, megacredits: 12, spireScience: 2}});
      expect(spire.resourceCount, 'the overpaid science is spent').eq(0);
      expect(player.megaCredits).eq(0);
    });

    it('too little is refused', () => {
      const spire = owned();
      spire.resourceCount = 2;
      player.megaCredits = 12;
      expect(() => menu().process({type: 'projectCard', card: CardName.ASTEROID_STANDARD_PROJECT, payment: {...Payment.EMPTY, megacredits: 9, spireScience: 2}}))
        .to.throw(/Did not spend enough/);
    });

    it('a card from the hand takes no science; a seat without Spire has none to spend', () => {
      owned();
      expect(player.paymentOptionsForCard(byName(CardName.DEVELOPMENT_CENTER)).spireScience).is.false;
      expect(player.paymentOptionsForCard(new AsteroidStandardProject()).spireScience).is.true;
      rival.megaCredits = 14;
      expect(rival.canSpend({...Payment.EMPTY, spireScience: 1})).is.false;
    });

    it('a Spire with no science offers nothing to spend', () => {
      const spire = owned();
      spire.resourceCount = 0;
      expect(player.getSpendable('spireScience')).eq(0);
      expect(player.canSpend({...Payment.EMPTY, spireScience: 1})).is.false;
    });
  });

  describe('rule 5 — the Redux table, a second corporation, MarsBot', () => {
    it('on the Redux table the start, the first action and a play answer as anywhere', () => {
      const [g, p] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      g.phase = Phase.ACTION;
      seatEnacted(g.parliament!, quietResolutionOf(PartyName.UNITY as ReduxParty));
      const spire = new Spire();
      p.playCorporationCard(spire);
      runAllActions(g);
      expect(p.megaCredits).eq(50);
      expect(spire.resourceCount).eq(1);
      expect(p.pendingInitialActions.map((c) => c.name)).deep.eq([CardName.SPIRE]);
      playFromHand(p, byName(CardName.DEVELOPMENT_CENTER));
      expect(spire.resourceCount).eq(2);
    });

    it('as the SECOND corporation (Merger): its own play adds its science and the first action is owed', () => {
      player.playCorporationCard(corporationCardsFromJSON([CardName.TERRALABS_RESEARCH])[0]);
      runAllActions(game);
      const spire = new Spire();
      player.playCorporationCard(spire);
      runAllActions(game);
      expect(spire.resourceCount).eq(1);
      expect(player.pendingInitialActions.map((c) => c.name)).to.include(CardName.SPIRE);
    });

    it('the human\'s Spire keeps the bot off its twin C45 (the collision key is `original`)', () => {
      expect(marsBotCorpInfo(MarsBotCorpId.C45_SPIRE).original).eq(CardName.SPIRE);
      const [botGame, human] = testAutomaGame({
        corporation: MarsBotCorpId.C45_SPIRE, keepInitialCardSelection: true,
      }, '-spire');
      human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
        ...corporationCardsFromJSON([CardName.SPIRE]));
      human.dealtProjectCards.splice(0, human.dealtProjectCards.length);
      human.process({type: 'initialCards', responses: [
        {type: 'card', cards: [CardName.SPIRE]},
        {type: 'card', cards: []},
      ]});
      runAllActions(botGame);
      human.process({type: 'card', cards: [CardName.SPIRE]});
      runAllActions(botGame);
      expect(human.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.SPIRE]);
      expect(human.megaCredits).eq(50);
      expect(botGame.automa!.corporation).is.not.undefined;
      expect(botGame.automa!.corporation).not.eq(MarsBotCorpId.C45_SPIRE);
    });
  });
});
