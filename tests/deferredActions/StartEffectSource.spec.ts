import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';

describe('start-of-game effect source threading', () => {
  it('propagates game.startEffectSource → deferred action → produced input', () => {
    const [game, player] = testGame(1);

    // Simulate the synchronous window around a corp/prelude start effect.
    game.startEffectSource = {kind: 'prelude', card: CardName.AQUIFER_TURBINES};
    game.defer(new SimpleDeferredAction(player, () => new SelectOption('pick something')));
    game.startEffectSource = undefined;

    runAllActions(game);

    const input = player.getWaitingFor();
    expect(input?.source).to.deep.eq({kind: 'prelude', card: CardName.AQUIFER_TURBINES});
  });

  it('does NOT tag actions deferred outside the start-effect window', () => {
    const [game, player] = testGame(1);
    // No startEffectSource set.
    game.defer(new SimpleDeferredAction(player, () => new SelectOption('pick something')));
    runAllActions(game);
    expect(player.getWaitingFor()?.source).to.eq(undefined);
  });

  it('keeps an explicit input source over the deferred-action tag', () => {
    const [game, player] = testGame(1);
    const corp = {name: CardName.VITOR, type: 8 /* CORPORATION */} as any;
    game.startEffectSource = {kind: 'prelude', card: CardName.AQUIFER_TURBINES};
    game.defer(new SimpleDeferredAction(player, () => new SelectOption('x').withSource(corp)));
    game.startEffectSource = undefined;
    runAllActions(game);
    // withSource (corporation/Vitor) wins over the queue tag (prelude/Aquifer).
    expect(player.getWaitingFor()?.source).to.deep.eq({kind: 'corporation', card: CardName.VITOR});
  });
});
