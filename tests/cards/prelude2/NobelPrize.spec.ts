import {expect} from 'chai';
import {NobelPrize} from '../../../src/server/cards/prelude2/NobelPrize';
import {OlympusConference} from '../../../src/server/cards/base/OlympusConference';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {Tag} from '../../../src/common/cards/Tag';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {hasRequirement} from '../../../src/server/cards/requirements/CardsWithRequirementsRequirement';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {drawSearchSentence} from '../../../src/server/tools/cardInfo/buildCardInformation';

/**
 * P54 — NOBEL PRIZE IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 1 — FULLY DECLARATIVE; ledger FM):
 * the thirty-sixth Prelude 2 card, the set's eleventh prelude. +5 M€; a NAMED search for 2 cards WITH A REQUIREMENT
 * (`requirement` — any requirement of any kind, the one predicate `hasRequirement`; the reveal, the preview chip, the
 * card text and the journal fact name the rule; exhaustion is named); a WILD tag; 2 VP — the first prelude whose play
 * moves the score at the start.
 */
describe('NobelPrize', () => {
  let card: NobelPrize;
  let game: IGame;
  let player: TestPlayer;

  /** The tape: Power Plant (no requirement) · Birds (oxygen) · Asteroid (none) · Fish (temperature). */
  const NO_REQ = CardName.POWER_PLANT;

  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
  function stack(topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.projectDeck.drawPile.push(...spare.map(byName), ...[...topFirst].reverse().map(byName));
  }

  function play(): void {
    player.playCard(card);
    runAllActions(game);
  }

  beforeEach(() => {
    card = new NobelPrize();
    [game, player] = testGame(2);
  });

  it('rule 1 — the play: +5 M€, 2 cards, both with a requirement', () => {
    play();
    expect(player.megaCredits).eq(5);
    expect(player.cardsInHand).has.length(2);
    expect(player.cardsInHand.every((c) => hasRequirement(c)), 'every kept card has a requirement').is.true;
  });

  it('rule 2 — the search is NAMED: cards without a requirement are discarded by name, the first two with one kept', () => {
    stack([NO_REQ, CardName.BIRDS, CardName.ASTEROID, CardName.FISH]);
    play();
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.BIRDS, CardName.FISH]);
    expect(game.projectDeck.discardPile.map((c) => c.name)).deep.eq([NO_REQ, CardName.ASTEROID]);
    const reveal = player.cardDrawReveals[0];
    expect(reveal.search).deep.eq({count: 2, requirement: true});
    expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).deep.eq([[NO_REQ, false], [CardName.BIRDS, true], [CardName.ASTEROID, false], [CardName.FISH, true]]);
    expect(reveal.exhausted === true).is.false;
  });

  it('rule 3 — exhaustion is NAMED: the deck runs out with one such card found — it is drawn and the run-out said', () => {
    // The whole deck is the tape (no spare at the bottom): Asteroid is thrown away, Birds kept, nothing else to turn.
    stack([CardName.ASTEROID, CardName.BIRDS], []);
    play();
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.BIRDS]);
    expect(game.gameLog.map((m) => m.message)).contains('The whole project deck has been searched — no more matching cards.');
    const reveal = player.cardDrawReveals[0];
    expect(reveal.exhausted).eq(true);
    expect(reveal.search).deep.eq({count: 2, requirement: true});
  });

  it('rule 3b — the shared draw gate: a deck that cannot supply 2 cards makes the prelude unplayable (it burns, never half-plays)', () => {
    stack([CardName.BIRDS], []);
    expect(card.canPlay(player)).is.false;
    stack([CardName.ASTEROID, CardName.BIRDS], []);
    expect(card.canPlay(player)).is.true;
  });

  it('rule 4 — the preview: +5 M€ and the NAMED search chip; read-only', () => {
    const before = JSON.stringify(game.serialize());
    const preview = cardPlayPreview(player, card);
    expect(preview.kind).eq('declarative');
    const branch = preview.branches[0];
    expect(branch.effects.find((e) => e.icon === 'megacredits')).deep.include({direction: 'gain', amount: 5});
    expect(branch.effects.find((e) => e.icon === 'cards')).deep.include({direction: 'gain', amount: 2, note: 'draw', search: {count: 2, requirement: true}});
    expect(JSON.stringify(game.serialize()), 'the preview never mutates').eq(before);
  });

  it('rule 5 — the card text names the search (the generator\'s sentence)', () => {
    expect(drawSearchSentence({count: 2, requirement: true}))
      .eq('Reveal cards from the project deck until you reveal 2 cards with a requirement. Take them into your hand and discard the rest.');
  });

  it('rule 6 — the journal fact carries the RULE (an opaque `include` carried none)', () => {
    stack([NO_REQ, CardName.BIRDS, CardName.ASTEROID, CardName.FISH]);
    game.events.beginAction(player, {kind: 'card', card: CardName.NOBEL_PRIZE, owner: player.color}, {category: 'card-play'});
    try {
      play();
    } finally {
      game.events.endScope();
    }
    const search = game.events.events.find((e) => e.type === 'deck-searched');
    expect(search?.impact.deckSearch).deep.eq({revealed: 4, kept: 2, discarded: [NO_REQ, CardName.ASTEROID], rule: {count: 2, requirement: true}});
  });

  it('rule 7 — the WILD tag: counted as a science tag by default, never raw; Olympus Conference does not answer it', () => {
    const olympus = new OlympusConference();
    player.playedCards.push(olympus);
    const scienceBefore = player.tags.count(Tag.SCIENCE, 'default');
    play();
    expect(player.tags.count(Tag.SCIENCE, 'default')).eq(scienceBefore + 1);
    expect(player.tags.count(Tag.SCIENCE, 'raw')).eq(1); // Olympus Conference's own printed tag
    expect(olympus.resourceCount, 'a WILD tag is not a played science tag').eq(0);
    expect(player.getWaitingFor()).is.undefined;
  });

  it('rule 8 — 2 VP on the table', () => {
    play();
    expect(card.getVictoryPoints(player)).eq(2);
  });
});
