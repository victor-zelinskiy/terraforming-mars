import {expect} from 'chai';
import {SagittaFrontierServices} from '../../../src/server/cards/prelude2/SagittaFrontierServices';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {Units} from '../../../src/common/Units';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {Tag} from '../../../src/common/cards/Tag';
import {CardType} from '../../../src/common/cards/CardType';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {newProjectCard, corporationCardsFromJSON} from '../../../src/server/createCard';
import {hasNoPrintedTags, tagsBarringNoTagsSearch} from '../../../src/server/cards/noTagsCards';
import {drawSearchSentence} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {Payment} from '../../../src/common/inputs/Payment';
import {allForecastFacts} from '../../../src/common/models/EffectForecastModel';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {MarsBotCorpId} from '../../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../../src/common/automa/MarsBotCorpData';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('SagittaFrontierServices', () => {
  let card: SagittaFrontierServices;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new SagittaFrontierServices();
    [game, player] = testGame(1);
  });

  it('play', () => {
    player.playCorporationCard(card);
    runAllActions(game);
    expect(player.production.asUnits()).deep.eq(Units.of({energy: 1, megacredits: 2}));
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 35})); // +4 for playing this card.
    expect(player.cardsInHand).has.lengthOf(1);
    expect(player.cardsInHand[0].tags).has.length(0);
  });

  it('Zero tags, gain 4 M€', () => {
    player.playedCards.push(card);
    card.onCardPlayed(player, fakeCard({tags: []}));
    runAllActions(game);
    expect(player.megaCredits).eq(4);
  });

  it('One tag, gain 1 M€', () => {
    player.playedCards.push(card);
    card.onCardPlayed(player, fakeCard({tags: [Tag.SCIENCE]}));
    runAllActions(game);
    expect(player.megaCredits).eq(1);
  });

  it('Event tag is a tag', () => {
    player.playedCards.push(card);
    card.onCardPlayed(player, fakeCard({type: CardType.EVENT, tags: []}));
    runAllActions(game);
    expect(player.megaCredits).eq(1);
  });

  it('Wild tag is not a tag', () => {
    player.playedCards.push(card);
    card.onCardPlayed(player, fakeCard({tags: [Tag.WILD]}));
    runAllActions(game);
    expect(player.megaCredits).eq(4);
  });
});

/**
 * PC03 — SAGITTA FRONTIER SERVICES IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1 forms 1 · 4 · 6; ledger
 * GT): the fifty-third Prelude 2 card and the fourth corporation to cross. The draw is the FIFTH named search («no
 * tags» — `DrawCard.noTags`, the one predicate `hasNoPrintedTags`); the hook speaks the Hartlan grammar with its
 * forecast twin (`tagsCounted` — one expression); the two readings of «no tags» are named apart.
 */
describe('SagittaFrontierServices — the fork', () => {
  let game: IGame;
  let player: TestPlayer;
  let rival: TestPlayer;

  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
  function stack(g: IGame, topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
    g.projectDeck.drawPile.length = 0;
    g.projectDeck.discardPile.length = 0;
    g.projectDeck.drawPile.push(...spare.map(byName), ...[...topFirst].reverse().map(byName));
  }

  /** The tape of stand A: one tag · an event with no printed tag · a lone wild tag · the first card with no tag. */
  const TAPE = [CardName.MINE, CardName.INDENTURED_WORKERS, CardName.QUANTUM_RESEARCH, CardName.MICRO_MILLS];

  /** Puts a project card in the hand and plays it from there for exactly its price (requirements are not the subject). */
  function playFromHand(p: TestPlayer, played: IProjectCard): void {
    p.cardsInHand.push(played);
    p.megaCredits = played.cost;
    p.playCard(played, {...Payment.EMPTY, megacredits: played.cost});
    runAllActions(p.game);
  }

  beforeEach(() => {
    [game, player, rival] = testGame(2);
  });

  it('keeps its art and lore keyed on PC03 (the number upstream marks «Renumber» stays)', () => {
    expect(new SagittaFrontierServices().metadata.cardNumber).eq('PC03');
  });

  describe('rule 2 — the draw is a NAMED search («no tags»)', () => {
    it('the tape: one tag, an event and a lone wild tag are thrown away with THEIR tags; the first card with no tag is kept', () => {
      stack(game, TAPE);
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.MICRO_MILLS]);
      expect(game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.MINE, CardName.INDENTURED_WORKERS, CardName.QUANTUM_RESEARCH]);
      const reveal = player.cardDrawReveals[0];
      expect(reveal.search).deep.eq({count: 1, noTags: true});
      expect(reveal.sequence?.map((s) => [s.card.name, s.matched, s.failedTags])).deep.eq([
        [CardName.MINE, false, [Tag.BUILDING]],
        [CardName.INDENTURED_WORKERS, false, [Tag.EVENT]],
        [CardName.QUANTUM_RESEARCH, false, [Tag.WILD]],
        [CardName.MICRO_MILLS, true, undefined],
      ]);
    });

    it('the predicate: no printed tag and not an event; the discard reasons come from the same reading', () => {
      expect(hasNoPrintedTags(byName(CardName.MICRO_MILLS))).is.true;
      expect(hasNoPrintedTags(byName(CardName.QUANTUM_RESEARCH)), 'a wild tag is a printed tag here').is.false;
      expect(hasNoPrintedTags(byName(CardName.INDENTURED_WORKERS)), 'an event is never a card with no tag').is.false;
      expect(tagsBarringNoTagsSearch(byName(CardName.ASTEROID))).deep.eq([Tag.EVENT, Tag.SPACE]);
    });

    it('exhaustion is NAMED: a deck with no such card is searched to the end — no card, the run-out said in the log and the journal fact', () => {
      stack(game, [CardName.MINE, CardName.ASTEROID], []);
      game.events.beginAction(player, {kind: 'corporation', card: CardName.SAGITTA_FRONTIER_SERVICES, owner: player.color}, {category: 'card-play'});
      try {
        player.playCorporationCard(new SagittaFrontierServices());
        runAllActions(game);
      } finally {
        game.events.endScope();
      }
      expect(player.cardsInHand).is.empty;
      expect(game.gameLog.map((m) => m.message)).contains('The whole project deck has been searched — no more matching cards.');
      // A search that found NOTHING with no other draw of the action to ride on queues no reveal (PL-1642's remainder —
      // an empty modal is never shown); the journal's `deck-searched` row is where it is named.
      const search = game.events.events.find((e) => e.type === 'deck-searched');
      expect(search?.impact.deckSearch).deep.include({revealed: 2, kept: 0, exhausted: true, rule: {count: 1, noTags: true}});
    });

    it('the card text names the search (the generator\'s sentence)', () => {
      expect(drawSearchSentence({count: 1, noTags: true}))
        .eq('Reveal cards from the project deck until you reveal a card with no tags. Take it into your hand and discard the rest.');
    });

    it('the journal fact carries the RULE', () => {
      stack(game, TAPE);
      game.events.beginAction(player, {kind: 'corporation', card: CardName.SAGITTA_FRONTIER_SERVICES, owner: player.color}, {category: 'card-play'});
      try {
        player.playCorporationCard(new SagittaFrontierServices());
        runAllActions(game);
      } finally {
        game.events.endScope();
      }
      const search = game.events.events.find((e) => e.type === 'deck-searched');
      expect(search?.impact.deckSearch).deep.eq({
        revealed: 4, kept: 1, discarded: [CardName.MINE, CardName.INDENTURED_WORKERS, CardName.QUANTUM_RESEARCH], rule: {count: 1, noTags: true},
      });
    });
  });

  describe('rules 3 · 5 · 6 — the effect: 4 for no tags, 1 for exactly one, nothing beyond', () => {
    it('the count table (`tagsCounted` — the wild tag is not a tag, an event\'s own is)', () => {
      const runs: Array<[Partial<IProjectCard>, number]> = [
        [{tags: []}, 0],
        [{tags: [Tag.SCIENCE]}, 1],
        [{tags: [Tag.SCIENCE, Tag.BUILDING]}, 2],
        [{type: CardType.EVENT, tags: []}, 1],
        [{type: CardType.EVENT, tags: [Tag.SPACE]}, 2],
        [{tags: [Tag.WILD]}, 0],
        [{tags: [Tag.SCIENCE, Tag.WILD]}, 1],
      ];
      for (const [shape, counted] of runs) {
        expect(SagittaFrontierServices.tagsCounted(fakeCard(shape)), JSON.stringify(shape)).eq(counted);
      }
    });

    it('the start: 31 M€ printed + 4 for its own play («including this») = 35; the record names the corporation', () => {
      const reactions = game.cardReactions.length;
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      expect(player.megaCredits).eq(35);
      const own = game.cardReactions.slice(reactions).filter((r) => r.card === CardName.SAGITTA_FRONTIER_SERVICES);
      expect(own).has.length(1);
      expect(own[0]).deep.include({kind: 'corporation', channel: 'card-played', cause: {card: CardName.SAGITTA_FRONTIER_SERVICES}});
      expect(own[0].impacts).deep.eq([{kind: 'stock', resource: 'megacredits', amount: 4, to: player.color}]);
    });

    it('real plays from the hand, the price paid first: no tag +4 · one tag +1 · an event with no tag +1 · two tags 0 · a lone wild +4', () => {
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      const runs: Array<[CardName, number]> = [
        [CardName.MICRO_MILLS, 4],
        [CardName.MINE, 1],
        [CardName.INDENTURED_WORKERS, 1],
        [CardName.DEVELOPMENT_CENTER, 0],
        [CardName.ASTEROID, 0],
        [CardName.QUANTUM_RESEARCH, 4],
      ];
      for (const [name, gain] of runs) {
        playFromHand(player, byName(name));
        expect(player.megaCredits, name).eq(gain);
      }
    });

    it('a rival\'s play is nobody\'s here', () => {
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      const before = player.megaCredits;
      playFromHand(rival, byName(CardName.MICRO_MILLS));
      expect(player.megaCredits).eq(before);
    });

    it('the payout is the standard line under the corporation\'s scope — no hand-written line beside it', () => {
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      const log = game.gameLog.length;
      playFromHand(player, byName(CardName.MINE));
      const lines = game.gameLog.slice(log).map((l) => l.message);
      expect(lines.some((m) => m.includes('which has exactly 1 tag')), 'the old bespoke line is gone').is.false;
    });
  });

  describe('the forecast twin — the same count', () => {
    function facts(card: ICard) {
      return new SagittaFrontierServices().cardPlayedForecast(player, player, card);
    }

    it('no tags: `exact` +4 M€ on printed effect #0; exactly one: `exact` +1 M€ on #1 naming the tag; two or more: nothing', () => {
      const none = facts(byName(CardName.MICRO_MILLS));
      expect(none.map((f) => f.certainty)).deep.eq(['exact']);
      expect(none[0].source.printedEffect).eq(0);
      expect(none[0].effects[0]).deep.include({direction: 'gain', icon: 'megacredits', amount: 4});
      const one = facts(byName(CardName.MINE));
      expect(one[0].source.printedEffect).eq(1);
      expect(one[0].effects[0]).deep.include({direction: 'gain', icon: 'megacredits', amount: 1});
      expect(one[0].reasonTag).eq(Tag.BUILDING);
      expect(facts(byName(CardName.INDENTURED_WORKERS))[0].reasonTag, 'an event with no printed tag names the event tag').eq(Tag.EVENT);
      expect(facts(byName(CardName.DEVELOPMENT_CENTER))).deep.eq([]);
      expect(facts(byName(CardName.ASTEROID))).deep.eq([]);
    });

    it('the forecast of a card in the hand reads the twin (the composer\'s «Сработает»)', () => {
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      const mills = byName(CardName.MICRO_MILLS);
      player.cardsInHand.push(mills);
      const all = allForecastFacts(effectForecastForPlay(player, mills, cardPlayPreview(player, mills)))
        .filter((f) => f.source.name === CardName.SAGITTA_FRONTIER_SERVICES);
      expect(all.map((f) => f.certainty)).deep.eq(['exact']);
    });

    it('the corporation\'s own play forecasts its +4', () => {
      const sagitta = new SagittaFrontierServices();
      const own = sagitta.cardPlayedForecast(player, player, sagitta);
      expect(own.map((f) => f.certainty)).deep.eq(['exact']);
      expect(own[0].effects[0]).deep.include({icon: 'megacredits', amount: 4});
    });
  });

  describe('rule 4 — the rail\'s «no tags» count (the other reading)', () => {
    it('Sagitta on the table is itself a card with no tags', () => {
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      expect(player.tags.numberOfCardsWithNoTags()).eq(1);
    });
  });

  describe('rule 7 — the Redux table, a second corporation, MarsBot', () => {
    it('on the Redux table the start and a play answer as anywhere', () => {
      const [g, p] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      g.phase = Phase.ACTION;
      seatEnacted(g.parliament!, quietResolutionOf(PartyName.UNITY as ReduxParty));
      p.playCorporationCard(new SagittaFrontierServices());
      runAllActions(g);
      expect(p.megaCredits).eq(35);
      expect(p.cardsInHand.every((c) => hasNoPrintedTags(c))).is.true;
      playFromHand(p, byName(CardName.MICRO_MILLS));
      expect(p.megaCredits).eq(4);
    });

    it('as the SECOND corporation: its own play pays +4 and searches', () => {
      player.playCorporationCard(corporationCardsFromJSON([CardName.TERRALABS_RESEARCH])[0]);
      runAllActions(game);
      stack(game, TAPE);
      const before = player.megaCredits;
      const hand = player.cardsInHand.length;
      player.playCorporationCard(new SagittaFrontierServices());
      runAllActions(game);
      expect(player.megaCredits - before, '31 printed + 4 for its own play').eq(35);
      expect(player.cardsInHand.length - hand).eq(1);
      expect(player.cardsInHand[player.cardsInHand.length - 1].name).eq(CardName.MICRO_MILLS);
    });

    it('the human\'s Sagitta keeps the bot off its twin C44 (the collision key is `original`)', () => {
      expect(marsBotCorpInfo(MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES).original).eq(CardName.SAGITTA_FRONTIER_SERVICES);
      const [botGame, human] = testAutomaGame({
        corporation: MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES, keepInitialCardSelection: true,
      }, '-sagitta');
      human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
        ...corporationCardsFromJSON([CardName.SAGITTA_FRONTIER_SERVICES]));
      human.dealtProjectCards.splice(0, human.dealtProjectCards.length);
      human.process({type: 'initialCards', responses: [
        {type: 'card', cards: [CardName.SAGITTA_FRONTIER_SERVICES]},
        {type: 'card', cards: []},
      ]});
      runAllActions(botGame);
      human.process({type: 'card', cards: [CardName.SAGITTA_FRONTIER_SERVICES]});
      runAllActions(botGame);
      expect(human.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.SAGITTA_FRONTIER_SERVICES]);
      expect(human.megaCredits).eq(35);
      expect(botGame.automa!.corporation).is.not.undefined;
      expect(botGame.automa!.corporation).not.eq(MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES);
    });
  });
});
