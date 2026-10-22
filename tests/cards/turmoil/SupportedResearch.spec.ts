import {expect} from 'chai';
import {SupportedResearch} from '../../../src/server/cards/turmoil/SupportedResearch';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {countedPlayEffects} from '../../../src/server/models/actionPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';

describe('SupportedResearch', () => {
  it('Should play', () => {
    const card = new SupportedResearch();
    const [game, player] = testGame(2, {turmoilExtension: true});
    expect(card.canPlay(player)).is.not.true;

    const scientists = game.turmoil!.getPartyByName(PartyName.SCIENTISTS);
    scientists.delegates.add(player, 2);
    expect(card.canPlay(player)).is.true;

    card.play(player);
    expect(player.cardsInHand).has.lengthOf(2);
  });
});

/**
 * T14 — SUPPORTED RESEARCH ON A TURMOIL REDUX TABLE: the sixth classic Turmoil
 * card adapted IN PLACE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The card
 * file did not change its rules: the party requirement already reads the
 * facade (`PartyRequirement` → `game.politics.satisfiesPartyRequirement`), and
 * the draw is the declarative `drawCard: 2` — the Executor's draw off the
 * project deck, attributed to the card (the console presents it as the play's
 * embedded «ДОБОР КАРТ» stage). Every rule of the reading is pinned here.
 */
describe('SupportedResearch — on a Turmoil Redux table', () => {
  const S = PartyName.SCIENTISTS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: SupportedResearch};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new SupportedResearch();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /** The same table with three QUIET real resolutions up for the vote (the Scientists · Unity · the Greens). */
  function parliamentTable(): Table {
    const t = table();
    ([S, PartyName.UNITY, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    return t;
  }

  /** The Scientists rule: their quiet resolution stands enacted. */
  function scientistsRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(S));
    expect(t.parliament.rulingParty()).eq(S);
    return t;
  }

  /** The second road: two of p1's delegates on the Scientists' resolution (slot 0). */
  function twoDelegates(t: Table): Table {
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
    return t;
  }

  /** Play the card for real (past the requirement gate) and resolve whatever the play queues. */
  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  it('rule 1 — the printed card: green, 3, a Science tag, no VP, the Scientists\' plate; the printed number is T14', () => {
    const c = new SupportedResearch();
    expect(c.name).eq(CardName.SUPPORTED_RESEARCH);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(3);
    expect(c.tags).deep.eq([Tag.SCIENCE]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(S);
    expect(c.metadata.cardNumber).eq('T14');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.SUPPORTED_RESEARCH]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, current: 1});
    });

    it('the Scientists\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.UNITY, PartyName.GREENS, PartyName.MARS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Scientists rule: playable', () => {
      const t = scientistsRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Scientists EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, S, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, S)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — draw 2 cards', () => {
    it('the hand gains 2 (the card itself leaves it), the deck loses 2, the card lands on the tableau', () => {
      const t = scientistsRuling();
      const hand = t.p1.cardsInHand.length;
      const deck = t.game.projectDeck.drawPile.length;
      play(t);
      expect(t.p1.cardsInHand.length - hand, 'the card left, two arrived').eq(1);
      expect(t.p1.cardsInHand.map((c) => c.name)).not.include(CardName.SUPPORTED_RESEARCH);
      expect(deck - t.game.projectDeck.drawPile.length).eq(2);
      expect(t.p1.tableau.has(CardName.SUPPORTED_RESEARCH)).is.true;
    });

    it('the draw is the card\'s: ONE reveal batch sourced by the card (the console\'s embedded «ДОБОР КАРТ») and the journal\'s `cards-drawn` 2', () => {
      const t = twoDelegates(parliamentTable());
      const from = t.game.events.events.length;
      play(t);
      expect(t.p1.cardDrawReveals.at(-1)?.source).deep.eq({type: 'card', cardName: CardName.SUPPORTED_RESEARCH});
      expect(t.p1.cardDrawReveals.at(-1)?.cards).length(2);
      const drawn = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color && e.type === 'cards-drawn');
      expect(drawn.map((e) => e.impact.cardsDrawn), JSON.stringify(drawn)).deep.eq([2]);
      expect(drawn[0].source, JSON.stringify(drawn[0])).deep.include({card: CardName.SUPPORTED_RESEARCH});
    });

    it('a play under the second road keeps the delegates where they stand (the requirement reads, it never spends)', () => {
      const t = twoDelegates(parliamentTable());
      const before = JSON.stringify(t.parliament.slots[0]);
      play(t);
      expect(JSON.stringify(t.parliament.slots[0])).eq(before);
    });
  });

  describe('rule 3 — the forecast before the press: «+2 cards», read-only', () => {
    it('the play preview states the draw chip, and nothing else, without touching the game', () => {
      const t = scientistsRuling();
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      const draw = effects.find((e) => e.direction === 'gain' && e.icon === 'cards');
      expect(draw, JSON.stringify(effects)).deep.include({amount: 2});
      expect(effects.filter((e) => e.direction === 'gain' && e.icon !== 'cards'), 'nothing but the draw').deep.eq([]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('nothing is counted off the table — the hand carries no counted plate', () => {
      const t = scientistsRuling();
      expect(countedPlayEffects(t.p1, t.card)).deep.eq([]);
    });
  });

  it('rule 2 with MarsBot at the table: the human\'s two cards', () => {
    const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([S, PartyName.UNITY, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(S));
    const c = new SupportedResearch();
    human.cardsInHand.push(c);
    human.megaCredits = 20;
    const hand = human.cardsInHand.length;
    expect(human.canPlay(c)).is.true;
    human.playCard(c);
    runAllActions(game);
    expect(human.cardsInHand.length - hand).eq(1);
  });

  it('rule 3 — save / reload: the played card stays in the tableau with its tag, the drawn cards in the hand', () => {
    const t = scientistsRuling();
    play(t);
    const hand = t.p1.cardsInHand.map((c) => c.name);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.get(CardName.SUPPORTED_RESEARCH)).is.not.undefined;
    expect(owner.tags.count(Tag.SCIENCE, 'raw')).eq(1);
    expect(owner.cardsInHand.map((c) => c.name)).deep.eq(hand);
  });
});
