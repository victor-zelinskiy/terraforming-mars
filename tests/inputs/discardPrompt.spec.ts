import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {DiscardCards} from '../../src/server/deferredActions/DiscardCards';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {MarsUniversity} from '../../src/server/cards/base/MarsUniversity';
import {Ants} from '../../src/server/cards/base/Ants';
import {Birds} from '../../src/server/cards/base/Birds';
import {Bushes} from '../../src/server/cards/base/Bushes';
import {ResearchOutpost} from '../../src/server/cards/base/ResearchOutpost';
import {CardName} from '../../src/common/cards/CardName';
import {Server} from '../../src/server/models/ServerModel';

/*
 * THE DISCARD MARKER IS THE CONTRACT. The console serves every "throw cards
 * away" prompt through one flow (surface, copy and the leaving animation), and
 * it may NOT detect a discard from the title or the button label — i18n
 * rewrites `Message.message` in place, so an English match dies after the first
 * render. So every discard prompt must carry `discardPrompt` structurally.
 */
describe('discardPrompt marker', () => {
  it('DiscardCards marks every prompt it builds, with its bounds and source', () => {
    const [game, player] = testGame(2);
    player.cardsInHand.push(new Ants(), new Birds(), new Bushes());

    game.defer(new DiscardCards(player, 2, 2, undefined, {source: {kind: 'colony'}}));
    runAllActions(game);

    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.discardPrompt).deep.eq({
      min: 2,
      max: 2,
      source: {kind: 'colony'},
      exchange: undefined,
      colonyBonus: undefined,
    });
  });

  it('falls back to the anonymous game-rule source rather than nothing', () => {
    const [game, player] = testGame(2);
    player.cardsInHand.push(new Ants(), new Birds());

    game.defer(new DiscardCards(player, 1, 1));
    runAllActions(game);

    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.discardPrompt?.source).deep.eq({kind: 'system'});
  });

  it('the auto-discard shortcut asks nothing — and so marks nothing', () => {
    // `cardsInHand.length <= min` discards without a prompt; there is no pick to
    // present, so the scene must never be armed for it.
    const [game, player] = testGame(2);
    player.cardsInHand.push(new Ants());

    game.defer(new DiscardCards(player, 1, 1));
    runAllActions(game);

    expect(player.popWaitingFor()).is.undefined;
    expect(player.cardsInHand).is.empty;
  });

  it('Mars University marks its nested discard branch AND names what it buys', () => {
    const [game, player] = testGame(2);
    const card = new MarsUniversity();
    player.playedCards.push(card);
    player.cardsInHand.push(new Ants(), new Birds());

    card.onCardPlayed(player, new ResearchOutpost());
    runAllActions(game);

    const options = cast(player.popWaitingFor(), OrOptions);
    const discard = cast(options.options[0], SelectCard);
    expect(discard.discardPrompt).deep.eq({
      min: 1,
      max: 1,
      source: {kind: 'card', card: CardName.MARS_UNIVERSITY},
      exchange: {icon: 'cards', amount: 1, perCard: false},
    });
    // The choice itself stays a CHOICE (the discard is optional) — the marker
    // rides the branch, never the OrOptions.
    expect(options.discardPrompt).is.undefined;
  });

  /*
   * THE MARKER MUST SURVIVE SERIALIZATION AT ANY DEPTH.
   *
   * `ServerModel.getWaitingFor` decorates only the TOP-LEVEL prompt, so a
   * marker copied there alone reaches the client for Pluto (top-level) and is
   * SILENTLY DROPPED for Mars University (nested in an OrOptions) — the console
   * then served it as a plain card pick and the card vanished with no
   * cinematic while the draw played. That is why `discardPrompt` rides
   * `SelectCard.toModel()`, and why this asserts the MODEL, not the input.
   */
  it('survives serialization when the discard is NESTED in an OrOptions', () => {
    const [game, player] = testGame(2);
    const card = new MarsUniversity();
    player.playedCards.push(card);
    player.cardsInHand.push(new Ants(), new Birds());

    card.onCardPlayed(player, new ResearchOutpost());
    runAllActions(game);

    const model = Server.getWaitingFor(player, player.popWaitingFor());
    expect(model?.type).eq('or');
    const options = model?.type === 'or' ? model.options : [];
    const discard = options.find((o) => o.type === 'card');
    expect(discard?.discardPrompt, 'the NESTED branch must carry the marker').deep.eq({
      min: 1,
      max: 1,
      source: {kind: 'card', card: CardName.MARS_UNIVERSITY},
      exchange: {icon: 'cards', amount: 1, perCard: false},
    });
  });

  it('survives serialization for a TOP-LEVEL discard (Pluto / a global event)', () => {
    const [game, player] = testGame(2);
    player.cardsInHand.push(new Ants(), new Birds());

    game.defer(new DiscardCards(player, 1, 1, undefined, {source: {kind: 'colony'}}));
    runAllActions(game);

    const model = Server.getWaitingFor(player, player.popWaitingFor());
    expect(model?.discardPrompt?.source).deep.eq({kind: 'colony'});
  });
});
