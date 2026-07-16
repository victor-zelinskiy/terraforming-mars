import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {DrawCards} from '../../src/server/deferredActions/DrawCards';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../src/server/createCard';
import {runAllActions} from '../TestingUtils';
import {Server} from '../../src/server/models/ServerModel';

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
});
