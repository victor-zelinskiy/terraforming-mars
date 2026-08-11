import {expect} from 'chai';
import {cardsFromJSON} from '../src/server/createCard';
import {CardName} from '../src/common/cards/CardName';
import {finishGeneration} from './TestingUtils';
import {testGame} from './TestGame';
import {cast} from '../src/common/utils/utils';
import {IProjectCard} from '../src/server/cards/IProjectCard';
import {IPlayer} from '../src/server/IPlayer';
import {SelectCard} from '../src/server/inputs/SelectCard';
import {TestPlayer} from './TestPlayer';

/**
 * The DRAFT PROMPT MARKER (`DraftPromptMeta`) — the structural signal the
 * console draft workspace is built on: routing, pass direction, neighbors and
 * the flow rail's pick total all key off it (never off the translatable
 * title). Attached in ONE place — `Draft.askPlayerToDraft` — so every variant
 * (standard / initial / prelude / CEOs) carries it by construction.
 */
describe('draftPromptMeta', () => {
  function draftPromptOf(player: IPlayer) {
    const selectCard = cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    const marker = selectCard.draftPrompt;
    expect(marker, 'the draft pick must carry the draftPrompt marker').is.not.undefined;
    return marker!;
  }

  function pick(player: TestPlayer, cardName: CardName) {
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.process({type: 'card', cards: [cardName]});
  }

  function seedDeck(deck: Array<IProjectCard>, cards: Array<CardName>) {
    deck.unshift(...cardsFromJSON(cards));
  }

  const EIGHT_CARDS = [
    CardName.ACQUIRED_COMPANY,
    CardName.BIOFERTILIZER_FACILITY,
    CardName.CAPITAL,
    CardName.DECOMPOSERS,
    CardName.EARTH_OFFICE,
    CardName.FISH,
    CardName.GENE_REPAIR,
    CardName.HACKERS,
  ];

  it('even generation: direction after, neighbors resolved in seat order', () => {
    const [game, player, otherPlayer] = testGame(2, {skipInitialShuffling: true, draftVariant: true});
    seedDeck(game.projectDeck.drawPile, EIGHT_CARDS);
    game.generation = 1;
    finishGeneration(game); // generation becomes 2 (even) → 'after'

    const marker = draftPromptOf(player);
    expect(marker.draftType).eq('standard');
    expect(marker.direction).eq('after');
    expect(marker.givingTo).eq(otherPlayer.color);
    expect(marker.takingFrom).eq(otherPlayer.color);
    expect(marker.total).eq(4);
  });

  it('odd generation: direction before', () => {
    const [game, player] = testGame(2, {skipInitialShuffling: true, draftVariant: true});
    seedDeck(game.projectDeck.drawPile, EIGHT_CARDS);
    game.generation = 2;
    finishGeneration(game); // generation becomes 3 (odd) → 'before'

    expect(draftPromptOf(player).direction).eq('before');
  });

  it('3 players: givingTo and takingFrom are DIFFERENT neighbors of the circle', () => {
    const [game, p1, p2, p3] = testGame(3, {skipInitialShuffling: true, draftVariant: true});
    seedDeck(game.projectDeck.drawPile, [...EIGHT_CARDS,
      CardName.IMPORTED_GHG, CardName.JOVIAN_EMBASSY, CardName.LAND_CLAIM, CardName.MICRO_MILLS]);
    game.generation = 1;
    finishGeneration(game); // even → 'after': give to +1, take from -1

    const marker = draftPromptOf(p1);
    expect(marker.givingTo).eq(p2.color);
    expect(marker.takingFrom).eq(p3.color);
  });

  it('the total stays invariant across rounds and on the repick prompt', () => {
    const [game, player, otherPlayer] = testGame(2, {skipInitialShuffling: true, draftVariant: true});
    seedDeck(game.projectDeck.drawPile, EIGHT_CARDS);
    game.generation = 1;
    finishGeneration(game);

    expect(draftPromptOf(player).total).eq(4);
    pick(player, CardName.BIOFERTILIZER_FACILITY);

    // The optional repick offer (waiting for the other player) keeps the SAME
    // total: picks so far + the shrunken hand.
    const repick = cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    expect(repick.optional).is.true;
    expect(repick.draftPrompt?.total).eq(4);

    pick(otherPlayer, CardName.GENE_REPAIR);

    // Round 2: 1 drafted + 3 in the received packet.
    expect(player.draftedCards).has.length(1);
    expect(draftPromptOf(player).total).eq(4);
  });

  it('serializes on the model (nesting-safe toModel path)', () => {
    const [game, player] = testGame(2, {skipInitialShuffling: true, draftVariant: true});
    seedDeck(game.projectDeck.drawPile, EIGHT_CARDS);
    game.generation = 1;
    finishGeneration(game);

    const selectCard = cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    const model = selectCard.toModel(player);
    expect(model.draftPrompt).deep.eq(selectCard.draftPrompt);
  });

  it('draft pick cards carry structured unplayable reasons (requirements heads-up)', () => {
    const [game, player] = testGame(2, {skipInitialShuffling: true, draftVariant: true});
    seedDeck(game.projectDeck.drawPile, EIGHT_CARDS);
    game.generation = 1;
    finishGeneration(game);

    const selectCard = cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    const model = selectCard.toModel(player);
    // Decomposers requires 3% oxygen — unmet at game start, so the model
    // carries the canonical structured reason.
    const decomposers = model.cards.find((c) => c.name === CardName.DECOMPOSERS);
    expect(decomposers, 'Decomposers must be in the first packet').is.not.undefined;
    expect(decomposers!.unplayableReasons?.some((r) => r.type === 'globalParameter')).is.true;
  });

  it('the research BUY prompt carries unplayable reasons too', () => {
    const [game, player, otherPlayer] = testGame(2, {skipInitialShuffling: true, draftVariant: true});
    seedDeck(game.projectDeck.drawPile, EIGHT_CARDS);
    game.generation = 1;
    finishGeneration(game);

    // Play the draft out: 3 interactive picks each; the last card auto-passes.
    pick(player, CardName.DECOMPOSERS);
    pick(otherPlayer, CardName.FISH);
    pick(player, CardName.GENE_REPAIR);
    pick(otherPlayer, CardName.CAPITAL);
    pick(player, CardName.ACQUIRED_COMPANY);
    pick(otherPlayer, CardName.EARTH_OFFICE);

    const buy = cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    expect(buy.draftPrompt, 'the buy prompt is not a draft pick').is.undefined;
    const model = buy.toModel(player);
    expect(model.buyMode).is.true;
    expect(model.cards.map((c) => c.name)).contains(CardName.DECOMPOSERS);
    const decomposers = model.cards.find((c) => c.name === CardName.DECOMPOSERS);
    expect(decomposers!.unplayableReasons?.some((r) => r.type === 'globalParameter')).is.true;
  });

  it('the marker never appears on a non-draft SelectCard', () => {
    const selectCard = new SelectCard('pick', 'Select', cardsFromJSON([CardName.FISH]));
    expect(selectCard.draftPrompt).is.undefined;
  });

  it('initial draft picks carry the marker with draftType initial', () => {
    const [, player] = testGame(2, {skipInitialShuffling: true, initialDraftVariant: true});
    const marker = draftPromptOf(player);
    expect(marker.draftType).eq('initial');
    expect(marker.direction).eq('after');
    expect(marker.total).eq(cast(player.getWaitingFor(), SelectCard<IProjectCard>).cards.length);
  });
});
