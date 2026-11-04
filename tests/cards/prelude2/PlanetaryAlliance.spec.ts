import {expect} from 'chai';
import {PlanetaryAlliance} from '../../../src/server/cards/prelude2/PlanetaryAlliance';
import {Biolab} from '../../../src/server/cards/prelude/Biolab';
import {OldMiningColony} from '../../../src/server/cards/prelude2/OldMiningColony';
import {Tag} from '../../../src/common/cards/Tag';
import {CardName} from '../../../src/common/cards/CardName';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {buildCardInformation, drawSearchSentence} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {computePreludeOutlooks, preludeProvisions} from '../../../src/server/preludes/preludeOutlook';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';

/**
 * P56 — PLANETARY ALLIANCE IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 1 — DECLARATIVE after the
 * smallest DSL extension; ledger FP): the thirty-eighth Prelude 2 card. +2 TR and TWO NAMED searches in ONE play — a
 * Jovian card, then a Venus card — declared as a LIST of draws (`drawCard: [...]`, read through `drawCardsOf`): the
 * gate sums the counts, the executor draws in the declared order with the card as each draw's source, the preview
 * prints a chip per search, the reveal is ONE batch with TWO segments each carrying its own rule — and a search that
 * finds nothing keeps its tape as an empty, exhausted segment instead of dropping it.
 */
describe('PlanetaryAlliance', () => {
  let card: PlanetaryAlliance;
  let game: IGame;
  let player: TestPlayer;

  const JOVIAN = {count: 1, tag: Tag.JOVIAN};
  const VENUS = {count: 1, tag: Tag.VENUS};

  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
  function stack(topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.projectDeck.drawPile.push(...spare.map(byName), ...[...topFirst].reverse().map(byName));
  }

  /** Play the prelude under ONE action root — the merge key of the reveal batch. */
  function play(): void {
    game.events.beginAction(player, {kind: 'card', card: CardName.PLANETARY_ALLIANCE, owner: player.color}, {category: 'card-play'});
    try {
      player.playCard(card);
      runAllActions(game);
    } finally {
      game.events.endScope();
    }
  }

  /**
   * The tape: Power Plant (neither tag) · Io Mining Industries (Jovian) · Ganymede Colony (Jovian ONLY — the lie
   * detector: the Venus search throws it away) · Aerial Mappers (Venus).
   */
  const TAPE = [CardName.POWER_PLANT, CardName.IO_MINING_INDUSTRIES, CardName.GANYMEDE_COLONY, CardName.AERIAL_MAPPERS];

  beforeEach(() => {
    card = new PlanetaryAlliance();
    [game, player] = testGame(2, {venusNextExtension: true});
  });

  it('rule 1 — the play: +2 TR, a Jovian card and a Venus card', () => {
    play();
    expect(player.terraformRating).eq(22);
    expect(player.cardsInHand).has.length(2);
    expect(player.cardsInHand.some((c) => c.tags.includes(Tag.JOVIAN)), 'a Jovian card').is.true;
    expect(player.cardsInHand.some((c) => c.tags.includes(Tag.VENUS)), 'a Venus card').is.true;
  });

  it('rule 2 — the searches run in the DECLARED order, each throwing away what does not match ITS rule', () => {
    stack(TAPE);
    play();
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.IO_MINING_INDUSTRIES, CardName.AERIAL_MAPPERS]);
    expect(game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.POWER_PLANT, CardName.GANYMEDE_COLONY]);
  });

  it('rule 3 — ONE batch, TWO segments, each with its own rule and tape; the card is the source of both', () => {
    stack(TAPE);
    play();
    expect(player.cardDrawReveals, 'one action — one batch').has.length(1);
    const reveal = player.cardDrawReveals[0];
    expect(reveal.segments.map((s) => s.count)).deep.eq([1, 1]);
    expect(reveal.segments.map((s) => s.search)).deep.eq([JOVIAN, VENUS]);
    expect(reveal.segments.map((s) => s.source)).deep.eq([
      {type: 'card', cardName: CardName.PLANETARY_ALLIANCE},
      {type: 'card', cardName: CardName.PLANETARY_ALLIANCE},
    ]);
    expect(reveal.segments.map((s) => s.sequence?.map((step) => [step.card.name, step.matched]))).deep.eq([
      [[CardName.POWER_PLANT, false], [CardName.IO_MINING_INDUSTRIES, true]],
      [[CardName.GANYMEDE_COLONY, false], [CardName.AERIAL_MAPPERS, true]],
    ]);
    // The batch-level tape is the two in turn — what the one-tape scene replays (R4).
    expect(reveal.sequence?.map((s) => s.card.name)).deep.eq(TAPE);
    expect(reveal.exhausted === true).is.false;
  });

  it('rule 4 — the Venus search runs the deck out: its segment says so, the Jovian card is still drawn', () => {
    // The whole deck: Power Plant · Io Mining · Ganymede Colony — no Venus card anywhere.
    stack([CardName.POWER_PLANT, CardName.IO_MINING_INDUSTRIES, CardName.GANYMEDE_COLONY], []);
    play();
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.IO_MINING_INDUSTRIES]);
    const reveal = player.cardDrawReveals[0];
    expect(reveal.segments.map((s) => [s.count, s.search, s.exhausted === true])).deep.eq([[1, JOVIAN, false], [0, VENUS, true]]);
    expect(reveal.segments[1].sequence?.every((step) => !step.matched), 'the Venus tape is all discards').is.true;
    expect(reveal.exhausted).eq(true);
    expect(game.gameLog.map((m) => m.message)).contains('The whole project deck has been searched — no more matching cards.');
  });

  it('rule 5 — a search that finds NOTHING keeps its tape: an empty, exhausted segment opens the batch the next search fills', () => {
    // No Jovian card anywhere: the Jovian search turns the whole deck over; the Venus search then finds Aerial Mappers.
    stack([CardName.POWER_PLANT, CardName.AERIAL_MAPPERS], []);
    play();
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.AERIAL_MAPPERS]);
    expect(player.cardDrawReveals).has.length(1);
    const reveal = player.cardDrawReveals[0];
    expect(reveal.segments.map((s) => [s.count, s.search, s.exhausted === true])).deep.eq([[0, JOVIAN, true], [1, VENUS, false]]);
    expect(reveal.segments[0].sequence?.map((step) => [step.card.name, step.matched])).deep.eq([[CardName.POWER_PLANT, false], [CardName.AERIAL_MAPPERS, false]]);
    expect(reveal.segments.reduce((n, s) => n + s.count, 0), 'Σ count === cards.length').eq(reveal.cards.length);
    expect(reveal.sequence?.slice(0, 2).map((s) => s.card.name)).deep.eq([CardName.POWER_PLANT, CardName.AERIAL_MAPPERS]);
    expect(reveal.exhausted).eq(true);
  });

  it('rule 6 — the shared draw gate on the SUM: a deck that cannot supply 2 cards makes the prelude unplayable', () => {
    stack([CardName.IO_MINING_INDUSTRIES], []);
    expect(card.canPlay(player)).is.false;
    stack([CardName.IO_MINING_INDUSTRIES, CardName.AERIAL_MAPPERS], []);
    expect(card.canPlay(player)).is.true;
  });

  it('rule 7 — the preview: +2 TR and a NAMED chip per search, in order; read-only', () => {
    const before = JSON.stringify(game.serialize());
    const preview = cardPlayPreview(player, card);
    expect(preview.kind).eq('declarative');
    const effects = preview.branches[0].effects;
    expect(effects.find((e) => e.icon === 'tr')).deep.include({direction: 'gain', amount: 2});
    expect(effects.filter((e) => e.icon === 'cards').map((e) => [e.amount, e.note, e.search])).deep.eq([[1, 'draw', JOVIAN], [1, 'draw', VENUS]]);
    expect(JSON.stringify(game.serialize()), 'the preview never mutates').eq(before);
  });

  it('rule 8 — the card text: one sentence per search, in order, under its own block id', () => {
    const jovian = 'Reveal cards from the project deck until you reveal a card with a jovian tag. Take it into your hand and discard the rest.';
    const venus = 'Reveal cards from the project deck until you reveal a card with a venus tag. Take it into your hand and discard the rest.';
    expect(drawSearchSentence(JOVIAN)).eq(jovian);
    expect(drawSearchSentence(VENUS)).eq(venus);
    const blocks = (buildCardInformation(card, 'prelude2')?.groups ?? []).flatMap((g) => g.blocks);
    const draws = blocks.filter((b) => b.id.startsWith('mech:drawCard'));
    expect(draws.map((b) => [b.id, b.text])).deep.eq([['mech:drawCard:0', jovian], ['mech:drawCard:1', venus]]);
  });

  it('rule 9 — the journal: one `deck-searched` fact per search, each with its rule', () => {
    stack(TAPE);
    play();
    const searches = game.events.events.filter((e) => e.type === 'deck-searched').map((e) => e.impact.deckSearch);
    expect(searches).deep.eq([
      {revealed: 2, kept: 1, discarded: [CardName.POWER_PLANT], rule: JOVIAN},
      {revealed: 2, kept: 1, discarded: [CardName.GANYMEDE_COLONY], rule: VENUS},
    ]);
  });

  it('rule 10 — the outlook: a declarative draw provides a card in hand — Old Mining Colony names it a guaranteed enabler', () => {
    const provisions = preludeProvisions(card);
    expect(provisions.has('cardInHand')).is.true;
    expect(provisions.has('playableCard')).is.true;
    const colony = new OldMiningColony();
    player.cardsInHand.length = 0;
    player.preludeCardsInHand.push(colony, card);
    expect(computePreludeOutlooks(player, [colony], player.preludeCardsInHand).get(CardName.OLD_MINING_COLONY))
      .deep.eq({state: 'deferred', certainty: 'guaranteed', enablers: [CardName.PLANETARY_ALLIANCE], need: 'cardInHand'});
    // Biolab beside it: both are named, in hand order.
    const biolab = new Biolab();
    player.preludeCardsInHand.push(biolab);
    expect(computePreludeOutlooks(player, [colony], player.preludeCardsInHand).get(CardName.OLD_MINING_COLONY))
      .deep.include({enablers: [CardName.PLANETARY_ALLIANCE, CardName.BIOLAB]});
  });

  it('rule 11 — the card is out of the hold-back list', () => {
    expect(PRELUDE2_CARDS_HELD_BACK).not.include(CardName.PLANETARY_ALLIANCE);
  });
});
