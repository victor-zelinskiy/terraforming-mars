import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {intakeSegmentTotal, tradeSegmentsOf} from '../../src/common/models/CardDrawRevealModel';
import {cast} from '../../src/common/utils/utils';
import {EarthOffice} from '../../src/server/cards/base/EarthOffice';
import {MarsUniversity} from '../../src/server/cards/base/MarsUniversity';
import {NaturalPreserve} from '../../src/server/cards/base/NaturalPreserve';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {Research} from '../../src/server/cards/base/Research';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Miranda} from '../../src/server/colonies/Miranda';
import {Pluto} from '../../src/server/colonies/Pluto';
import {gainAllColonyBonuses} from '../../src/server/colonies/allColonyBonuses';
import {DrawCards} from '../../src/server/deferredActions/DrawCards';
import {ExternalDrawIntake} from '../../src/server/deferredActions/ExternalDrawIntake';
import {IGame} from '../../src/server/IGame';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

/**
 * ⭐ «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» — the card-intake law of the fork
 * (2026-10-26, `docs/claude/console/card-intake-one-batch.md`).
 *
 * Every card ONE press drew for its recipient — by any number of effects, at
 * any depth of hooks, from the board and from cards — is ONE batch with ONE
 * take, until a MANDATORY input of that recipient stood between two draws.
 * The merge key is the recipient + the action ROOT (R1); the segments keep
 * the causes in the queue's order (R2); the seal is structural (R3); a search
 * is a segment (R4); a foreign action's intake never merges (R5); nothing is
 * lost on the way (R9 — `Σ segments.count === cards.length`).
 */
describe('cardIntakeMerge — one action, one batch', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2, {coloniesExtension: true});
  });

  /** The whole batch is honest: every card is accounted for by exactly one segment. */
  function expectHonest(batch: {cards: ReadonlyArray<unknown>, segments: ReadonlyArray<{count: number}>}): void {
    expect(intakeSegmentTotal(batch.segments), 'Σ segments.count === cards.length').eq(batch.cards.length);
  }

  /**
   * Ф-А «розыгрыш + стол»: Research (draw 2) at Mars University (discard → draw) and Olympus Conference holding
   * one science (remove it → draw) — the owner's own example. Three draws, three sources, ONE root: one batch.
   * The answers land the way the composer's pre-collected batch lands them — `player.process` inside the prompt's
   * own scope, no live route and therefore no seal.
   */
  it('Ф-А · Research + Olympus Conference + Mars University = ONE batch of three segments', () => {
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    const marsU = new MarsUniversity();
    player.playedCards.push(olympus, marsU);
    player.cardsInHand = [new EarthOffice()];

    player.playCard(new Research());
    runAllActions(game);

    // The Research's own draw is already queued; the hooks ask one after another.
    let olympusAnswered = false;
    let marsUAnswered = 0;
    for (let guard = 0; guard < 8 && player.getWaitingFor() !== undefined; guard++) {
      const waiting = cast(player.getWaitingFor(), OrOptions);
      if (waiting.choiceContext?.source.card === CardName.OLYMPUS_CONFERENCE) {
        // Science tag 1 asks (one resource stored): remove it → draw. Tag 2 then adds silently.
        player.process({type: 'or', index: 0, response: {type: 'option'}});
        olympusAnswered = true;
      } else {
        expect(waiting.choiceContext?.source.card).eq(CardName.MARS_UNIVERSITY);
        const discard = cast(waiting.options[0], SelectCard<IProjectCard>);
        if (marsUAnswered === 0) {
          player.process({type: 'or', index: 0, response: {type: 'card', cards: [discard.cards[0].name]}});
        } else {
          player.process({type: 'or', index: 1, response: {type: 'option'}});
        }
        marsUAnswered++;
      }
      // `process` resumes the deferred queue itself (the prompt's continuation) — exactly like the live server.
    }
    expect(olympusAnswered, 'Olympus asked').is.true;
    expect(marsUAnswered, 'Mars University asked for each science tag').eq(2);

    expect(player.cardDrawReveals, 'ONE batch for the whole press').has.lengthOf(1);
    const batch = player.cardDrawReveals[0];
    expect(batch.actionId, 'the batch knows its action root').is.a('number');
    expect(batch.cards).has.lengthOf(4);
    expect(batch.segments.map((s) => ({source: s.source, count: s.count}))).deep.eq([
      {source: {type: 'card', cardName: CardName.RESEARCH}, count: 2},
      {source: {type: 'card', cardName: CardName.OLYMPUS_CONFERENCE}, count: 1},
      {source: {type: 'card', cardName: CardName.MARS_UNIVERSITY}, count: 1},
    ]);
    expect(batch.source, 'the root cause is the first segment\'s').deep.eq({type: 'card', cardName: CardName.RESEARCH});
    expect(batch.sealed, 'no live input stood between the draws').is.not.true;
    expect(batch.pendingAnswer, 'nothing is owed once the last draw merged in').is.undefined;
    expectHonest(batch);
  });

  /**
   * R3 — THE SEAL IS STRUCTURAL: the recipient's own LIVE answer (the input routes) stands between the draws. The
   * batch on screen closes and NAMES what it waited on (R6); the draw after the answer opens a new batch under the
   * SAME root — the console glues it to the sealed place.
   */
  it('R3/R6 · a live answer between two draws seals the batch and names the question; the next draw opens a new one', () => {
    const marsU = new MarsUniversity();
    player.playedCards.push(marsU);
    player.cardsInHand = [new EarthOffice()];

    player.playCard(new Research());
    runAllActions(game);

    expect(player.cardDrawReveals).has.lengthOf(1);
    const first = player.cardDrawReveals[0];
    expect(first.cards).has.lengthOf(2);
    // The question was raised with the batch still open: it is announced on the batch (read off the prompt's
    // structural marker — never its title).
    expect(first.pendingAnswer).deep.eq({kind: 'question', card: CardName.MARS_UNIVERSITY});

    // The LIVE route: the player answers from their screen.
    player.sealCardDrawReveals();
    const waiting = cast(player.getWaitingFor(), OrOptions);
    const discard = cast(waiting.options[0], SelectCard<IProjectCard>);
    player.process({type: 'or', index: 0, response: {type: 'card', cards: [discard.cards[0].name]}});
    runAllActions(game);

    expect(player.cardDrawReveals, 'the exchange\'s card opens a NEW batch').has.lengthOf(2);
    const second = player.cardDrawReveals[1];
    expect(first.sealed).is.true;
    expect(first.cards, 'the sealed batch did not grow').has.lengthOf(2);
    expect(second.actionId, 'the same action root — the client glues it to the sealed place').eq(first.actionId);
    expect(second.segments.map((s) => s.source)).deep.eq([{type: 'card', cardName: CardName.MARS_UNIVERSITY}]);
    expectHonest(first);
    expectHonest(second);
  });

  /**
   * Ф-Б «поле + карта»: a tile landing on a cell with a printed card bonus, and a table hook drawing after it,
   * in the same play — one batch `tile ×1 · card ×1`, the cell's run first (the queue's order).
   */
  it('Ф-Б · a tile\'s cell bonus and a table hook of the same play = ONE batch, tile segment first', () => {
    player.playedCards.push(new MarsUniversity());
    player.cardsInHand = [new EarthOffice()];

    player.playCard(new NaturalPreserve());
    runAllActions(game);

    const selectSpace = cast(player.getWaitingFor(), SelectSpace);
    const cell = selectSpace.spaces.find((s) => s.bonus.includes(SpaceBonus.DRAW_CARD));
    expect(cell, 'a free land cell with a printed card bonus').is.not.undefined;
    player.process({type: 'space', spaceId: cell!.id});

    // The cell paid its card; Mars University asks (pre-collected — answered without a seal).
    const waiting = cast(player.getWaitingFor(), OrOptions);
    const discard = cast(waiting.options[0], SelectCard<IProjectCard>);
    player.process({type: 'or', index: 0, response: {type: 'card', cards: [discard.cards[0].name]}});

    expect(player.cardDrawReveals).has.lengthOf(1);
    const batch = player.cardDrawReveals[0];
    expect(batch.segments.map((s) => ({type: s.source?.type, count: s.count}))).deep.eq([
      {type: 'tile', count: 1},
      {type: 'card', count: 1},
    ]);
    expect(batch.segments[0].source).deep.eq({type: 'tile', spaceId: cell!.id});
    expectHonest(batch);
  });

  /**
   * Ф-Г «все бонусы колоний × k» from a CARD: two cubes on Miranda paid by Habitat Science are ONE run of two —
   * the same cause kept dealing (the module's old «never merged» is gone: two cubes are two cards of one press).
   */
  it('Ф-Г · two cubes on Miranda paid by one card = ONE batch, ONE run «colony:Miranda via:card ×2»', () => {
    const miranda = new Miranda();
    game.colonies = [miranda];
    miranda.colonies.push(player.id, player.id);

    game.events.beginAction(player, {kind: 'card', card: CardName.HABITAT_SCIENCE, owner: player.color}, {category: 'card-action'});
    gainAllColonyBonuses(player, {via: CardName.HABITAT_SCIENCE});
    game.events.endScope();
    runAllActions(game);

    expect(player.cardDrawReveals).has.lengthOf(1);
    const batch = player.cardDrawReveals[0];
    expect(batch.cards).has.lengthOf(2);
    expect(batch.segments).deep.eq([{source: {type: 'colony', colonyName: miranda.name, via: CardName.HABITAT_SCIENCE}, count: 2}]);
    expect(tradeSegmentsOf(batch.segments), 'not a trade').is.undefined;
    expectHonest(batch);
  });

  /**
   * …and A LEDGER ROW IS A SEAL BOUNDARY: the ledger pays row by row, so Miranda's card and Pluto's pair — one root,
   * two tiles — are two batches (Pluto's pair re-defers behind the other rows; merged, its card stood in Miranda's
   * take — `console-habitat-science`, 2026-10-26).
   */
  it('Ф-Г · a Miranda cube and a Pluto cube paid by one card: two tiles, two batches (the ledger pays row by row)', () => {
    const miranda = new Miranda();
    const pluto = new Pluto();
    game.colonies = [miranda, pluto];
    miranda.colonies.push(player.id);
    pluto.colonies.push(player.id);
    player.cardsInHand = [new EarthOffice()];

    game.events.beginAction(player, {kind: 'card', card: CardName.HABITAT_SCIENCE, owner: player.color}, {category: 'card-action'});
    gainAllColonyBonuses(player, {via: CardName.HABITAT_SCIENCE});
    game.events.endScope();
    runAllActions(game);

    expect(player.cardDrawReveals.map((b) => b.segments.map((s) => s.source?.type === 'colony' ? `${s.source.colonyName}×${s.count}` : '?'))).deep.eq([
      [`${miranda.name}×1`], [`${pluto.name}×1`],
    ]);
    expect(player.cardDrawReveals[0].actionId).eq(player.cardDrawReveals[1].actionId);
    expect(player.cardDrawReveals[1].pendingAnswer?.colony).eq(pluto.name);
  });

  /**
   * …and Pluto's pairs stay apart by the rule itself: «draw 1, then discard 1» per cube — the seal names the pair.
   */
  it('Ф-Г · Pluto pairs from a card: each pair its own batch, sealed and naming its discard (ordinal + card)', () => {
    const pluto = new Pluto();
    game.colonies = [pluto];
    pluto.colonies.push(player.id, player.id);
    player.cardsInHand = [new EarthOffice()];

    game.events.beginAction(player, {kind: 'card', card: CardName.HABITAT_SCIENCE, owner: player.color}, {category: 'card-action'});
    gainAllColonyBonuses(player, {via: CardName.HABITAT_SCIENCE});
    game.events.endScope();
    runAllActions(game);

    expect(player.cardDrawReveals).has.lengthOf(1);
    const first = player.cardDrawReveals[0];
    expect(first.sealed).is.true;
    expect(first.pendingAnswer).deep.eq({kind: 'discard', colony: pluto.name, ordinal: {index: 1, total: 2}, card: CardName.HABITAT_SCIENCE});

    const discard = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    discard.cb([discard.cards[0]]);
    runAllActions(game);

    expect(player.cardDrawReveals, 'the second pair opens its own batch').has.lengthOf(2);
    expect(player.cardDrawReveals[1].actionId).eq(first.actionId);
    expect(player.cardDrawReveals[1].pendingAnswer?.ordinal).deep.eq({index: 2, total: 2});
    expect(first.cards, 'the sealed first pair did not grow').has.lengthOf(1);
  });

  /**
   * R4 — a filtered SEARCH beside a plain draw of the same action is a SEGMENT carrying its own tape; the
   * batch-level tape (what the one-tape scene replays) covers every card of the batch in dealing order.
   */
  it('R4 · a search merges as a segment with its own tape; the batch-level tape covers the whole batch', () => {
    const deck = game.projectDeck;
    // Stack the top of the deck: a plain draw takes the top two, the search then turns over a non-space card
    // (discarded) before it finds a space card.
    const spaceCard = deck.drawPile.find((c) => c.tags.includes(Tag.SPACE))!;
    const plainCard = deck.drawPile.find((c) => !c.tags.includes(Tag.SPACE) && c !== spaceCard)!;
    deck.drawPile = deck.drawPile.filter((c) => c !== spaceCard && c !== plainCard);
    const [top1, top2] = deck.drawPile.splice(deck.drawPile.length - 2, 2);
    deck.drawPile.push(spaceCard, plainCard, top1, top2);

    game.events.beginAction(player, {kind: 'card', card: CardName.RESEARCH, owner: player.color}, {category: 'card-play'});
    player.drawCard(2, {source: {type: 'card', cardName: CardName.RESEARCH}});
    DrawCards.keepAll(player, 1, {tag: Tag.SPACE, source: {type: 'card', cardName: CardName.ACQUIRED_SPACE_AGENCY}}).execute();
    game.events.endScope();

    expect(player.cardDrawReveals).has.lengthOf(1);
    const batch = player.cardDrawReveals[0];
    expect(batch.cards).has.lengthOf(3);
    expect(batch.segments).has.lengthOf(2);
    expect(batch.segments[0].search).is.undefined;
    expect(batch.segments[1].search).deep.eq({count: 1, tag: Tag.SPACE});
    expect(batch.segments[1].sequence?.map((s) => s.matched)).deep.eq([false, true]);
    expect(batch.sequence?.map((s) => s.matched), 'the batch tape: the plain two matched, then the search').deep.eq([true, true, false, true]);
    expect(batch.sequence?.filter((s) => s.matched).map((s) => s.card)).deep.eq([...batch.cards]);
    expectHonest(batch);
  });

  /** R5 — an intake another player's action fired for me is its own channel; it never joins my action's batch. */
  it('R5 · an external intake granted inside my action never merges with my batch', () => {
    game.events.beginAction(player, {kind: 'card', card: CardName.RESEARCH, owner: player.color}, {category: 'card-play'});
    player.drawCard(2, {source: {type: 'card', cardName: CardName.RESEARCH}});
    ExternalDrawIntake.grant(player, 1, {effectCard: new EarthOffice(), effectCardOwner: 'initiator', initiator: player2});
    game.events.endScope();

    expect(player.cardDrawReveals).has.lengthOf(1);
    expect(player.cardDrawReveals[0].cards).has.lengthOf(2);
    expect(player.pendingCardIntakes).has.lengthOf(1);
  });

  /** R1 — two different roots never merge, even back to back. */
  it('R1 · two actions = two batches; a draw outside any action merges with nothing', () => {
    game.events.beginAction(player, {kind: 'card', card: CardName.RESEARCH, owner: player.color}, {category: 'card-play'});
    player.drawCard(1, {source: {type: 'card', cardName: CardName.RESEARCH}});
    game.events.endScope();
    game.events.beginAction(player, {kind: 'card', card: CardName.EARTH_OFFICE, owner: player.color}, {category: 'card-play'});
    player.drawCard(1, {source: {type: 'card', cardName: CardName.EARTH_OFFICE}});
    game.events.endScope();
    player.drawCard(1);
    player.drawCard(1);

    expect(player.cardDrawReveals).has.lengthOf(4);
    expect(player.cardDrawReveals[2].actionId).is.undefined;
    expect(player.cardDrawReveals[3].actionId).is.undefined;
  });
});
