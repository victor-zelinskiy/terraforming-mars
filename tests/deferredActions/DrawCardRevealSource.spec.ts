import {expect} from 'chai';
import {testGame} from '../TestGame';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';

/**
 * The "you drew cards" reveal modal must ALWAYS name where the draw came from
 * when it's known. A caller that doesn't pass an explicit `source` now inherits
 * the ACTIVE analytics scope (the card / corporation / colony whose action or
 * effect is running) — so every card-action / on-play draw is attributed with no
 * per-call-site change.
 */
describe('Card-draw reveal source', () => {
  it('inherits the active card scope when no explicit source is passed', () => {
    const [game, player] = testGame(2);
    game.events.beginAction(player, {kind: 'card', card: CardName.MARS_UNIVERSITY, owner: player.color}, {category: 'card-action'});
    player.drawCard(1);
    game.events.endScope();

    const reveal = player.cardDrawReveals.at(-1);
    expect(reveal, 'a reveal was enqueued').to.not.be.undefined;
    expect(reveal!.source).to.deep.eq({type: 'card', cardName: CardName.MARS_UNIVERSITY});
  });

  it('inherits the active corporation scope', () => {
    const [game, player] = testGame(2);
    game.events.beginAction(player, {kind: 'corporation', card: CardName.FACTORUM, owner: player.color}, {category: 'corporation-action'});
    player.drawCard(1);
    game.events.endScope();

    expect(player.cardDrawReveals.at(-1)!.source).to.deep.eq({type: 'card', cardName: CardName.FACTORUM});
  });

  it('maps a colony scope to a colony source', () => {
    const [game, player] = testGame(2);
    game.events.beginAction(player, {kind: 'colony', name: ColonyName.MIRANDA}, {category: 'colony'});
    player.drawCard(1);
    game.events.endScope();

    expect(player.cardDrawReveals.at(-1)!.source).to.deep.eq({type: 'colony', colonyName: ColonyName.MIRANDA});
  });

  it('an explicit source wins over the scope', () => {
    const [game, player] = testGame(2);
    game.events.beginAction(player, {kind: 'card', card: CardName.MARS_UNIVERSITY, owner: player.color}, {category: 'card-action'});
    player.drawCard(1, {source: {type: 'tile'}});
    game.events.endScope();

    expect(player.cardDrawReveals.at(-1)!.source).to.deep.eq({type: 'tile'});
  });

  it('no scope → no source (generic text)', () => {
    const [, player] = testGame(2);
    player.drawCard(1);
    expect(player.cardDrawReveals.at(-1)!.source).to.be.undefined;
  });
});
