import {expect} from 'chai';
import {testGame} from '../TestGame';
import {resourceVictoryPoints} from '../../src/server/models/actionPreview';
import {Birds} from '../../src/server/cards/base/Birds';
import {Ants} from '../../src/server/cards/base/Ants';
import {PhysicsComplex} from '../../src/server/cards/base/PhysicsComplex';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {Mine} from '../../src/server/cards/base/Mine';
import * as actionPreviews from '../../src/server/cards/actionPreviews';

/**
 * VICTORY POINTS ARE A RULE, SO THE SERVER ANSWERS.
 *
 * «Добавьте ресурс на любую карту» is not only a resource change: on a card
 * that scores per resource it also moves VP, and that is usually what makes one
 * target better than another. The client cannot work it out — the rule lives in
 * each card's own `victoryPoints` descriptor — so it is evaluated here,
 * read-only, and shipped per candidate.
 */
describe('resourceVictoryPoints — the authoritative before → after', () => {
  it('reads a PER-RESOURCE card (Birds: 1 VP per animal)', () => {
    const [/* game */, player] = testGame(2);
    const card = new Birds();
    player.playedCards.push(card);
    card.resourceCount = 0;
    expect(resourceVictoryPoints(player, card, 1)).to.deep.eq({from: 0, to: 1});
    card.resourceCount = 3;
    expect(resourceVictoryPoints(player, card, 2)).to.deep.eq({from: 3, to: 5});
  });

  /**
   * THE `per` ARITHMETIC — exactly why this may not be guessed client side.
   * Ants score 1 VP per TWO microbes, so 2 → 3 is NOT a VP change, and saying
   * otherwise would be a claim the player could act on.
   */
  it('honours `per`, so a resource that crosses no threshold reports no move', () => {
    const [/* game */, player] = testGame(2);
    const card = new Ants();
    player.playedCards.push(card);
    card.resourceCount = 2;
    expect(resourceVictoryPoints(player, card, 1)).to.deep.eq({from: 1, to: 1});
    card.resourceCount = 3;
    expect(resourceVictoryPoints(player, card, 1)).to.deep.eq({from: 1, to: 2});
  });

  /** …and `each`, the multiplier form (Physics Complex: 2 VP per resource). */
  it('honours `each`', () => {
    const [/* game */, player] = testGame(2);
    const card = new PhysicsComplex();
    player.playedCards.push(card);
    card.resourceCount = 1;
    expect(resourceVictoryPoints(player, card, 1)).to.deep.eq({from: 2, to: 4});
  });

  /** A removal reads the same way, and never goes below zero resources. */
  it('reads a REMOVAL, floored at zero resources', () => {
    const [/* game */, player] = testGame(2);
    const card = new Birds();
    player.playedCards.push(card);
    card.resourceCount = 1;
    expect(resourceVictoryPoints(player, card, -1)).to.deep.eq({from: 1, to: 0});
    card.resourceCount = 0;
    expect(resourceVictoryPoints(player, card, -5)).to.deep.eq({from: 0, to: 0});
  });

  /**
   * NO HONEST ANSWER = NO ANSWER, in both of its forms.
   *
   * A fixed-VP card cannot be moved by a resource at all; a `'special'` card
   * overrides `getVictoryPoints` with bespoke logic this evaluator does not
   * see, and guessing there would be worse than silence. Same contract
   * `copiedProductionUnits` keeps for a bespoke `produce()`.
   */
  it('declines a fixed-VP card and a bespoke «special» one alike', () => {
    const [/* game */, player] = testGame(2);
    const mine = new Mine();
    const search = new SearchForLife();
    player.playedCards.push(mine, search);
    expect(resourceVictoryPoints(player, mine, 1), 'fixed VP').to.eq(undefined);
    expect(resourceVictoryPoints(player, search, 1), 'bespoke getVictoryPoints').to.eq(undefined);
  });

  /** PURITY: a read-only builder may not move the game. The naive way to get
   *  the «after» value is to set the count, read and restore — this evaluates
   *  the descriptor instead, and the count is never touched. */
  it('never mutates the card it reads', () => {
    const [/* game */, player] = testGame(2);
    const card = new Birds();
    player.playedCards.push(card);
    card.resourceCount = 2;
    resourceVictoryPoints(player, card, 5);
    expect(card.resourceCount).to.eq(2);
  });
});

/**
 * …and the WIRING: every card-target step that moves a resource gets the
 * reading automatically, with no per-card opt-in anyone can forget.
 */
describe('targetVictoryPoints — automatic on every resource step', () => {
  it('is attached to a selectCardStep that carries an amount', () => {
    const [/* game */, player] = testGame(2);
    const birds = new Birds();
    player.playedCards.push(birds);
    birds.resourceCount = 0;

    const step = actionPreviews.selectCardStep(player, 'Add an animal', 'Add', [birds], {amount: 1});
    expect(step.kind).to.eq('input');
    expect(step.kind === 'input' && step.vpBox?.[birds.name]).to.deep.eq({from: 0, to: 1});
  });

  /** A step with no delta says nothing, and neither does a set whose cards do
   *  not score on resources — the field stays ABSENT rather than shipping an
   *  empty map on every card pick in the game. */
  it('is absent with no delta, and absent when nothing scores on resources', () => {
    const [/* game */, player] = testGame(2);
    const birds = new Birds();
    const mine = new Mine();
    player.playedCards.push(birds, mine);
    const noDelta = actionPreviews.selectCardStep(player, 't', 'l', [birds]);
    expect(noDelta.kind === 'input' && noDelta.vpBox).to.eq(undefined);
    const noScorers = actionPreviews.selectCardStep(player, 't', 'l', [mine], {amount: 1});
    expect(noScorers.kind === 'input' && noScorers.vpBox).to.eq(undefined);
  });

  /**
   * A candidate whose points RESPOND to the resource is reported EVEN when the
   * value does not move — this reverses the first cut, deliberately.
   *
   * «Птицы дают 1 ПО за каждое животное» versus «Мелкие животные — за каждые
   * два, и там сейчас чётное число» is exactly the comparison a player makes
   * when choosing what to take and from whom. Dropping the second as noise made
   * it read identically to a card that scores nothing at all, which is the
   * opposite answer. Only a card with no resource term at all stays absent.
   * (Ants at 2 microbes with +1 still reads 1 → 1.)
   */
  it('reports a candidate whose VP responds but does not move', () => {
    const [/* game */, player] = testGame(2);
    const ants = new Ants();
    const birds = new Birds();
    const mine = new Mine();
    player.playedCards.push(ants, birds, mine);
    ants.resourceCount = 2;
    birds.resourceCount = 0;
    const box = actionPreviews.targetVictoryPoints(player, [ants, birds, mine], 1);
    expect(box?.[birds.name]).to.deep.eq({from: 0, to: 1});
    expect(box?.[ants.name], 'a static reading is still a reading').to.deep.eq({from: 1, to: 1});
    expect(box?.[mine.name], 'but a card with no resource term says nothing').to.eq(undefined);
  });
});
