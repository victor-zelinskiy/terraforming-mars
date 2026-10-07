import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {DrawCards} from '../../src/server/deferredActions/DrawCards';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../src/server/createCard';
import {fakeCard, runAllActions} from '../TestingUtils';
import {Server} from '../../src/server/models/ServerModel';
import {CardType} from '../../src/common/cards/CardType';
import {CardResource} from '../../src/common/CardResource';
import {drawSearchOf, forbiddenTagsOn} from '../../src/server/deferredActions/drawSearch';

/**
 * The reveal SEQUENCE the console draw cinematic replays: which card the deck
 * turned over, in what order, and whether it was kept. The client never
 * re-derives this — the server is the only source of the order.
 */
function card(name: CardName): IProjectCard {
  return newProjectCard(name)!;
}

/**
 * Stack the draw pile so the LAST array element is drawn first (the top of
 * the deck is the tail — `draw()` pops).
 *
 * `spare` cards sit at the bottom: emptying the draw pile makes `draw()`
 * shuffle the discard pile straight back in, which would undo the very
 * discards a search test wants to observe.
 */
function stackDeck(game: IGame, topLast: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = []): void {
  game.projectDeck.drawPile.length = 0;
  game.projectDeck.discardPile.length = 0;
  game.projectDeck.drawPile.push(...spare.map(card), ...topLast.map(card));
}

describe('DrawCards reveal sequence', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
  });

  it('a conditional search records EVERY reveal in real deck order with its verdict', () => {
    // Drawn top-first: Ants (no space tag) → Comet (space) → Birds (no) → Asteroid (space).
    stackDeck(game, [CardName.ASTEROID, CardName.BIRDS, CardName.COMET, CardName.ANTS], [CardName.TARDIGRADES]);

    player.drawCard(2, {tag: Tag.SPACE});
    runAllActions(game);

    const reveal = player.cardDrawReveals[0];
    expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).to.deep.eq([
      [CardName.ANTS, false],
      [CardName.COMET, true],
      [CardName.BIRDS, false],
      [CardName.ASTEROID, true],
    ]);
    // The kept cards stay exactly what they always were.
    expect(reveal.cards.map((c) => c.name)).to.deep.eq([CardName.COMET, CardName.ASTEROID]);
    // The discarded ones really are in the discard pile (the tray shows truth).
    expect(game.projectDeck.discardPile.map((c) => c.name)).to.have.members([CardName.ANTS, CardName.BIRDS]);
  });

  it('a PLAIN draw carries no sequence — nothing was discarded, so there is no search to replay', () => {
    stackDeck(game, [CardName.ASTEROID, CardName.BIRDS, CardName.ANTS]);

    player.drawCard(2);
    runAllActions(game);

    expect(player.cardDrawReveals[0].sequence).is.undefined;
    expect(player.cardDrawReveals[0].cards).has.length(2);
  });

  it('a search whose every reveal matched carries no sequence (the plain-draw visual fallback)', () => {
    stackDeck(game, [CardName.ASTEROID, CardName.COMET]);

    player.drawCard(2, {tag: Tag.SPACE});
    runAllActions(game);

    expect(player.cardDrawReveals[0].sequence).is.undefined;
    expect(player.cardDrawReveals[0].cards.map((c) => c.name)).to.deep.eq([CardName.COMET, CardName.ASTEROID]);
  });

  it('the sequence is exposed to the drawing player, discarded cards and all', () => {
    stackDeck(game, [CardName.ASTEROID, CardName.BIRDS, CardName.COMET, CardName.ANTS]);
    player.drawCard(2, {tag: Tag.SPACE});
    runAllActions(game);

    const model = Server.getPlayerModel(player).cardDrawReveals[0];
    expect(model.sequence?.map((s) => [s.card.name, s.matched])).to.deep.eq([
      [CardName.ANTS, false],
      [CardName.COMET, true],
      [CardName.BIRDS, false],
      [CardName.ASTEROID, true],
    ]);
    // Serialized like any hand card, so a discarded card renders identically.
    expect(model.sequence?.[0].card.calculatedCost).is.not.undefined;
  });

  it('the sequence never leaks onto another player\'s view', () => {
    const [game2, p1, p2] = testGame(2);
    stackDeck(game2, [CardName.ASTEROID, CardName.ANTS, CardName.COMET]);
    p1.drawCard(2, {tag: Tag.SPACE});
    runAllActions(game2);

    expect(p1.cardDrawReveals).has.length(1);
    // cardDrawReveals is self-only: p2's own view carries none of p1's.
    expect(Server.getPlayerModel(p2).cardDrawReveals).has.length(0);
  });

  it('execute() re-populates the sequence per run (a reused action never accumulates)', () => {
    stackDeck(game, [CardName.ASTEROID, CardName.ANTS]);
    const action = new DrawCards(player, 1, {tag: Tag.SPACE});
    action.execute();
    expect(action.revealSequence).has.length(2);

    stackDeck(game, [CardName.COMET]);
    action.execute();
    expect(action.revealSequence.map((s) => [s.card.name, s.matched])).to.deep.eq([[CardName.COMET, true]]);
  });

  describe('the NEGATIVE filter (`withoutTags`) and the search\'s rule — a class (TR32)', () => {
    const BIO = [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL] as const;

    it('discards every card carrying ANY of the tags and names, on each, the tag that threw it away', () => {
      // Top-first: Algae (plant) → Research (clean) → Ants (microbe) → Fish (animal) → Mining Area (clean) → Comet (clean).
      stackDeck(game, [CardName.COMET, CardName.MINING_AREA, CardName.FISH, CardName.ANTS, CardName.RESEARCH, CardName.ALGAE], [CardName.TARDIGRADES]);
      player.drawCard(3, {withoutTags: BIO});
      runAllActions(game);

      const reveal = player.cardDrawReveals[0];
      expect(reveal.sequence?.map((s) => [s.card.name, s.matched, s.failedTags])).deep.eq([
        [CardName.ALGAE, false, [Tag.PLANT]],
        [CardName.RESEARCH, true, undefined],
        [CardName.ANTS, false, [Tag.MICROBE]],
        [CardName.FISH, false, [Tag.ANIMAL]],
        [CardName.MINING_AREA, true, undefined],
        [CardName.COMET, true, undefined],
      ]);
      expect(reveal.cards.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.MINING_AREA, CardName.COMET]);
      expect(game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.ALGAE, CardName.ANTS, CardName.FISH]);
      expect(reveal.search).deep.eq({count: 3, withoutTags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]});
      expect(reveal.exhausted).is.undefined;
      // The model carries it all to the owner.
      const model = Server.getPlayerModel(player).cardDrawReveals[0];
      expect(model.search).deep.eq({count: 3, withoutTags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]});
      expect(model.sequence?.map((s) => s.failedTags)).deep.eq([[Tag.PLANT], undefined, [Tag.MICROBE], [Tag.ANIMAL], undefined, undefined]);
    });

    it('a card with TWO forbidden tags names both, in the rule\'s order', () => {
      const both = fakeCard({name: 'two bio tags' as CardName, tags: [Tag.ANIMAL, Tag.PLANT]});
      stackDeck(game, [CardName.COMET, CardName.MINING_AREA, CardName.RESEARCH], [CardName.TARDIGRADES]);
      game.projectDeck.drawPile.push(both);
      player.drawCard(3, {withoutTags: BIO});
      runAllActions(game);
      expect(player.cardDrawReveals[0].sequence?.[0].failedTags).deep.eq([Tag.PLANT, Tag.ANIMAL]);
    });

    it('the rule rides the batch even when nothing was discarded — the summary of three clean cards on top still names it', () => {
      stackDeck(game, [CardName.COMET, CardName.MINING_AREA, CardName.RESEARCH]);
      player.drawCard(3, {withoutTags: BIO});
      runAllActions(game);
      const reveal = player.cardDrawReveals[0];
      expect(reveal.sequence, 'no discard → no tray, the plain-draw visuals').is.undefined;
      expect(reveal.search).deep.eq({count: 3, withoutTags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]});
    });

    it('a POSITIVE filter carries its rule too; its discards name no tag (the rule already says what was missing)', () => {
      stackDeck(game, [CardName.COMET, CardName.ANTS], [CardName.TARDIGRADES]);
      player.drawCard(1, {tag: Tag.SPACE});
      runAllActions(game);
      const reveal = player.cardDrawReveals[0];
      expect(reveal.search).deep.eq({count: 1, tag: Tag.SPACE});
      expect(reveal.sequence?.map((s) => s.failedTags)).deep.eq([undefined, undefined]);
    });

    it('a plain draw and an opaque `include` carry no rule', () => {
      stackDeck(game, [CardName.COMET, CardName.ANTS], [CardName.TARDIGRADES]);
      player.drawCard(1);
      runAllActions(game);
      expect(player.cardDrawReveals[0].search).is.undefined;
      stackDeck(game, [CardName.COMET, CardName.ANTS], [CardName.TARDIGRADES]);
      player.drawCard(1, {include: (c) => c.name === CardName.COMET});
      runAllActions(game);
      expect(player.cardDrawReveals[1].search).is.undefined;
    });

    it('ONE reader: `withoutTags` asks `Tags.cardHasTag` like `tag` — an event\'s own tag counts, a printed WILD tag is none of them', () => {
      const wild = fakeCard({name: 'wild' as CardName, tags: [Tag.WILD]});
      expect(forbiddenTagsOn(player, wild, BIO)).deep.eq([]);
      const event = fakeCard({name: 'event' as CardName, type: CardType.EVENT, tags: [Tag.SPACE]});
      expect(forbiddenTagsOn(player, event, [Tag.EVENT])).deep.eq([Tag.EVENT]);
      expect(forbiddenTagsOn(player, event, BIO)).deep.eq([]);
    });

    it('the descriptor: `undefined` without a filter, every filter in its own field', () => {
      expect(drawSearchOf(2, undefined)).is.undefined;
      expect(drawSearchOf(2, {})).is.undefined;
      expect(drawSearchOf(2, {withoutTags: []})).is.undefined;
      expect(drawSearchOf(2, {tag: Tag.SPACE, type: CardType.EVENT})).deep.eq({count: 2, tag: Tag.SPACE, type: CardType.EVENT});
      expect(drawSearchOf(1, {resource: CardResource.FLOATER})).deep.eq({count: 1, resource: CardResource.FLOATER});
    });
  });

  describe('exhaustion — NAMED, never silent, never an exception, never a loop', () => {
    const BIO = [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL] as const;

    it('the whole deck turned over with ONE clean card: one card kept, the journal says so with a KEY, the reveal is `exhausted`', () => {
      stackDeck(game, [CardName.ALGAE, CardName.RESEARCH, CardName.ANTS, CardName.FISH]);
      game.gameLog.length = 0;
      player.drawCard(3, {withoutTags: BIO});
      runAllActions(game);
      expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH]);
      const reveal = player.cardDrawReveals[0];
      expect(reveal.exhausted).is.true;
      expect(reveal.cards.map((c) => c.name)).deep.eq([CardName.RESEARCH]);
      const lines = game.gameLog.map((m) => m.message);
      expect(lines).to.include('The whole project deck has been searched — no more matching cards.');
      expect(lines.some((l) => l.startsWith('discarded every')), 'the untranslatable template is gone').is.false;
      expect(Server.getPlayerModel(player).cardDrawReveals[0].exhausted).is.true;
    });

    it('the draw pile runs dry MID-search: the discard pile is reshuffled (named), this search\'s own discards come back and are thrown away again — and it ends', () => {
      // Two cards left on the draw pile, the discard pile holding two bio cards and one clean one.
      stackDeck(game, [CardName.RESEARCH, CardName.ALGAE]);
      game.projectDeck.discardPile.push(card(CardName.ANTS), card(CardName.FISH), card(CardName.COMET));
      game.gameLog.length = 0;
      player.drawCard(3, {withoutTags: BIO});
      runAllActions(game);
      const kept = player.cardsInHand.map((c) => c.name);
      expect(kept).to.have.members([CardName.RESEARCH, CardName.COMET]);
      expect(kept).has.length(2);
      expect(player.cardDrawReveals[0].exhausted).is.true;
      const lines = game.gameLog.map((m) => m.message);
      expect(lines).to.include('The project discard pile has been shuffled to form a new deck.');
      expect(lines).to.include('The whole project deck has been searched — no more matching cards.');
    });

    it('nothing at all to turn over: no card, no reveal, the empty deck named — no exception', () => {
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      game.gameLog.length = 0;
      expect(() => {
        player.drawCard(3, {withoutTags: BIO});
        runAllActions(game);
      }).not.to.throw();
      expect(player.cardsInHand).has.length(0);
      expect(player.cardDrawReveals).has.length(0);
      expect(game.gameLog.map((m) => m.message)).to.include('The project deck is empty — no card to reveal.');
    });

    it('a PLAIN draw that runs short is not a search: no `exhausted` on its batch', () => {
      stackDeck(game, [CardName.RESEARCH]);
      player.drawCard(2);
      runAllActions(game);
      expect(player.cardDrawReveals[0].cards).has.length(1);
      expect(player.cardDrawReveals[0].exhausted).is.undefined;
    });
  });
});
