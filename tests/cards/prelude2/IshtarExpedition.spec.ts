import {expect} from 'chai';
import {IshtarExpedition} from '@/server/cards/prelude2/IshtarExpedition';
import {Tag} from '@/common/cards/Tag';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions, setVenusScaleLevel} from '../../TestingUtils';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {newProjectCard} from '@/server/createCard';
import {MorningStarInc} from '@/server/cards/venusNext/MorningStarInc';
import {TitanHoldings} from '@/server/cards/turmoilRedux/TitanHoldings';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {effectForecastForPlay} from '@/server/models/effectForecast';
import {unplayableReasons} from '@/server/models/unplayableReasons';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Phase} from '@/common/Phase';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('IshtarExpedition', () => {
  let card: IshtarExpedition;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new IshtarExpedition();
    [game, player] = testGame(2, {venusNextExtension: true});
  });

  it('canPlay', () => {
    setVenusScaleLevel(game, 8);
    expect(card.canPlay(player)).is.false;

    setVenusScaleLevel(game, 10);
    expect(card.canPlay(player)).is.true;
  });

  it('Should play', () => {
    setVenusScaleLevel(game, 10);
    card.play(player);

    expect(player.stock.titanium).to.eq(3);
    expect(player.cardsInHand).has.lengthOf(2);
    expect(player.cardsInHand[0].tags).includes(Tag.VENUS);
    expect(player.cardsInHand[1].tags).includes(Tag.VENUS);
  });
});

/**
 * P76 — ISHTAR EXPEDITION IN THE PREMIUM SCOPE: the FIRST Prelude 2 card adapted IN PLACE
 * (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 1 — declarative). The card file did not change: a Venus 10 %
 * requirement, `stock.titanium: 3` and `drawCard: {count: 2, tag: VENUS}` — the SEARCH BY TAG (the deck is
 * turned over until two Venus cards show; the rest is discarded). Every rule of the reading is pinned here.
 */
describe('IshtarExpedition — premium', () => {
  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
  function stack(game: IGame, topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.projectDeck.drawPile.push(...spare.map(byName), ...[...topFirst].reverse().map(byName));
  }

  /** Not Venus → Venus → not Venus → Venus: the tape the e2e stand seeds too. */
  const TAPE = [CardName.ANTS, CardName.VENUSIAN_INSECTS, CardName.BIRDS, CardName.AERIAL_MAPPERS];

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: IshtarExpedition};

  /** A two-seat Venus table in the action phase, Venus at `venus` %, the card in p1's hand, 20 M€. */
  function table(venus = 10): Table {
    const [game, p1, p2] = testGame(2, {venusNextExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    setVenusScaleLevel(game, venus);
    const card = new IshtarExpedition();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, card};
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  it('rule 1 — the printed card: an event, 6 M€, a Venus tag, no VP, P76, dealt only with Venus, not political', () => {
    const c = new IshtarExpedition();
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(6);
    expect(c.tags).deep.eq([Tag.VENUS]);
    expect(c.victoryPoints).is.undefined;
    expect(c.metadata.cardNumber).eq('P76');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.ISHTAR_EXPEDITION];
    expect(spec?.compatibility).eq('venus');
    expect(spec?.politics, 'not a political card').is.undefined;
  });

  describe('rule 1 — the requirement: Venus 10 %', () => {
    it('at 8 %: unplayable, the reason NAMES the parameter and both numbers (now 8, needs 10)', () => {
      const t = table(8);
      expect(t.p1.canPlay(t.card)).is.false;
      const reasons = unplayableReasons(t.p1, t.card);
      expect(reasons).has.length(1);
      expect(reasons[0]).deep.include({
        type: 'globalParameter', globalParameter: 'venus', message: 'Requires Venus ${0}%', params: ['10'], current: 8, requirement: true,
      });
      expect(reasons[0].effectiveCount, 'no modifier — the printed bound').is.undefined;
    });

    it('at 10 %: playable, no reason', () => {
      const t = table(10);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('Morning Star Inc. (±2 on a Venus requirement): playable at 8 % — the server reads the modifier', () => {
      const t = table(8);
      t.p1.playedCards.push(new MorningStarInc());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('paid in M€: neither titanium nor steel (no Space, no Building tag); floaters may (a Venus tag)', () => {
      const t = table();
      const options = t.p1.paymentOptionsForCard(t.card);
      expect(options.titanium).is.false;
      expect(options.steel).is.false;
      expect(options.floaters).is.true;
    });
  });

  describe('rule 2 — +3 titanium, then the search for 2 Venus cards', () => {
    it('the hand gains the two Venus cards in reveal order, the others go to the discard pile BY NAME in reveal order', () => {
      const t = table();
      stack(t.game, TAPE);
      play(t);
      expect(t.p1.titanium).eq(3);
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.VENUSIAN_INSECTS, CardName.AERIAL_MAPPERS]);
      expect(t.game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.ANTS, CardName.BIRDS]);
      expect(t.p1.playedCards.get(CardName.ISHTAR_EXPEDITION), 'the event lands on the played pile').is.not.undefined;
    });

    it('ONE reveal batch sourced by the card: the rule (`search`), the tape with its verdicts, Σ count === cards', () => {
      const t = table();
      stack(t.game, TAPE);
      play(t);
      expect(t.p1.cardDrawReveals).has.length(1);
      const reveal = t.p1.cardDrawReveals[0];
      expect(reveal.source).deep.eq({type: 'card', cardName: CardName.ISHTAR_EXPEDITION});
      expect(reveal.search).deep.eq({count: 2, tag: Tag.VENUS});
      expect(reveal.exhausted).is.undefined;
      expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).deep.eq([
        [CardName.ANTS, false], [CardName.VENUSIAN_INSECTS, true], [CardName.BIRDS, false], [CardName.AERIAL_MAPPERS, true],
      ]);
      expect(reveal.segments.reduce((sum, s) => sum + s.count, 0)).eq(reveal.cards.length);
      expect(reveal.cards.map((c) => c.name)).deep.eq([CardName.VENUSIAN_INSECTS, CardName.AERIAL_MAPPERS]);
    });

    it('the journal: `cards-drawn` 2 and ONE `deck-searched` fact under the play\'s root, the titanium an event of the card', () => {
      const t = table();
      stack(t.game, TAPE);
      const from = t.game.events.events.length;
      play(t);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color);
      const drawn = mine.filter((e) => e.type === 'cards-drawn');
      expect(drawn.map((e) => e.impact.cardsDrawn), JSON.stringify(drawn)).deep.eq([2]);
      expect(drawn[0].source).deep.include({card: CardName.ISHTAR_EXPEDITION});
      const searches = mine.filter((e) => e.type === 'deck-searched');
      expect(searches).has.length(1);
      expect(searches[0].impact.deckSearch).deep.eq({
        rule: {count: 2, tag: Tag.VENUS}, revealed: 4, kept: 2, discarded: [CardName.ANTS, CardName.BIRDS],
      });
      expect(searches[0].correlationId).eq(drawn[0].correlationId);
      const titanium = mine.filter((e) => e.source?.kind === 'card' && e.source.card === CardName.ISHTAR_EXPEDITION &&
        JSON.stringify(e.impact).includes('titanium'));
      expect(titanium.length, 'the titanium goes through the recorder, not a field write').greaterThan(0);
    });

    it('the forecast before the press: «+3 titanium» and «+2 cards · with a Venus tag», read-only', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.find((e) => e.icon === 'titanium')).deep.include({direction: 'gain', amount: 3});
      expect(effects.find((e) => e.icon === 'cards')).deep.include({direction: 'gain', amount: 2, note: 'draw', search: {count: 2, tag: Tag.VENUS}});
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });
  });

  describe('rule 3 — the honest end: the deck runs out', () => {
    it('one Venus card in the whole deck: ONE kept, the batch and the fact say `exhausted`', () => {
      const t = table();
      stack(t.game, [CardName.ANTS, CardName.VENUSIAN_INSECTS, CardName.BIRDS], []);
      play(t);
      expect(t.p1.titanium).eq(3);
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.VENUSIAN_INSECTS]);
      const reveal = t.p1.cardDrawReveals[0];
      expect(reveal.exhausted).is.true;
      expect(reveal.cards).has.length(1);
      const search = t.game.events.events.find((e) => e.type === 'deck-searched');
      expect(search?.impact.deckSearch).deep.include({kept: 1, exhausted: true});
    });

    it('no Venus card at all: nothing kept, NO empty reveal queued, the fact still names the search', () => {
      const t = table();
      stack(t.game, [CardName.ANTS, CardName.BIRDS], []);
      play(t);
      expect(t.p1.titanium).eq(3);
      expect(t.p1.cardsInHand).deep.eq([]);
      expect(t.p1.cardDrawReveals).deep.eq([]);
      const search = t.game.events.events.find((e) => e.type === 'deck-searched');
      expect(search?.impact.deckSearch).deep.include({kept: 0, exhausted: true});
    });
  });

  it('rule 4 — an event: its Venus tag does not count after the play', () => {
    const t = table();
    stack(t.game, TAPE);
    expect(t.p1.tags.count(Tag.VENUS)).eq(0);
    play(t);
    expect(t.p1.tags.count(Tag.VENUS)).eq(0);
  });

  it('rule 4 — the in-scope reactor on a Venus tag (TR84 Titan Holdings): +1 leverage at the play, forecast = performed', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, prelude2Expansion: true});
    const titan = new TitanHoldings();
    p1.playCorporationCard(titan);
    runAllActions(game);
    game.phase = Phase.ACTION;
    setVenusScaleLevel(game, 10);
    const card = new IshtarExpedition();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    const facts = effectForecastForPlay(p1, card, cardPlayPreview(p1, card)).facts.filter((f) => f.source.name === CardName.TITAN_HOLDINGS);
    expect(facts.map((f) => f.reasonTag)).deep.eq([Tag.VENUS]);
    const before = titan.resourceCount;
    stack(game, TAPE);
    p1.playCard(card);
    runAllActions(game);
    expect(titan.resourceCount - before).eq(1);
  });

  describe('rule 5 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Venus; absent without Prelude 2, absent without Venus', () => {
      expect(dealt({prelude2Expansion: true, venusNextExtension: true})).include(CardName.ISHTAR_EXPEDITION);
      expect(dealt({prelude2Expansion: false, venusNextExtension: true})).not.include(CardName.ISHTAR_EXPEDITION);
      expect(dealt({prelude2Expansion: true, venusNextExtension: false})).not.include(CardName.ISHTAR_EXPEDITION);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.ISHTAR_EXPEDITION)).is.false;
    });

    it('save / reload: the event on the played pile, the found cards in the hand, the titanium kept', () => {
      const t = table();
      stack(t.game, TAPE);
      play(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.playedCards.get(CardName.ISHTAR_EXPEDITION)).is.not.undefined;
      expect(owner.cardsInHand.map((c) => c.name)).deep.eq([CardName.VENUSIAN_INSECTS, CardName.AERIAL_MAPPERS]);
      expect(owner.titanium).eq(3);
    });

    it('a MarsBot table refuses Prelude 2 today (the conflict is §5 of the adaptation — the owner\'s decision after the last card)', () => {
      expect(() => testAutomaGame({venusNextExtension: true, prelude2Expansion: true})).to.throw(/does not support Prelude 2/);
    });

    it('MarsBot at the table (the card brought in by hand): the human\'s play is the human\'s — 3 titanium, 2 Venus cards; the bot takes nothing', () => {
      const [game, human, bot] = testAutomaGame({venusNextExtension: true});
      game.phase = Phase.ACTION;
      setVenusScaleLevel(game, 10);
      const c = new IshtarExpedition();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      const botState = () => JSON.stringify({mc: bot.megaCredits, ti: bot.titanium, hand: bot.cardsInHand.length});
      const botBefore = botState();
      stack(game, TAPE);
      expect(human.canPlay(c)).is.true;
      human.playCard(c);
      runAllActions(game);
      expect(human.titanium).eq(3);
      expect(human.cardsInHand.map((x) => x.name)).deep.eq([CardName.VENUSIAN_INSECTS, CardName.AERIAL_MAPPERS]);
      expect(botState()).eq(botBefore);
    });
  });
});
