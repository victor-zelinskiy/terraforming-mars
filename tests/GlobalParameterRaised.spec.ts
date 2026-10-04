import {expect} from 'chai';
import {testGame} from './TestGame';
import {TestPlayer} from './TestPlayer';
import {testAutomaGame} from './automa/AutomaTestGame';
import {fakeCard, setOxygenLevel, setTemperature, setVenusScaleLevel} from './TestingUtils';
import {IGame} from '../src/server/IGame';
import {IPlayer} from '../src/server/IPlayer';
import {IProjectCard} from '../src/server/cards/IProjectCard';
import {GlobalParameterRaise} from '../src/server/cards/GlobalParameterRaise';
import {GlobalParameter} from '../src/common/GlobalParameter';
import {Phase} from '../src/common/Phase';
import {CardName} from '../src/common/cards/CardName';
import {Resource} from '../src/common/Resource';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../src/common/constants';

/**
 * THE ONE DISPATCHER of «a global parameter scale went up»
 * (`ICard.onGlobalParameterRaised` ← `Game.globalParameterRaised`, Turmoil
 * Redux TR24 Venusian Census; docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md): the three
 * scales call it at Aphrodite's position — OUTSIDE the reward gate — with the
 * steps actually made, the credited raiser and the levels; never a lowering,
 * never zero steps; every seat's tableau in generation order.
 */
type Call = {owner: string, parameter: GlobalParameter, steps: number, by: string | undefined, before: number, after: number};

function listener(calls: Array<Call>, name: string): IProjectCard {
  return fakeCard({
    name: name as CardName,
    onGlobalParameterRaised(cardOwner: IPlayer, raise: GlobalParameterRaise) {
      calls.push({owner: cardOwner.color, parameter: raise.parameter, steps: raise.steps, by: raise.by?.color, before: raise.before, after: raise.after});
    },
  } as Partial<IProjectCard>);
}

function table(): {game: IGame, p1: TestPlayer, p2: TestPlayer, calls: Array<Call>} {
  const [game, p1, p2] = testGame(2, {venusNextExtension: true});
  game.phase = Phase.ACTION;
  const calls: Array<Call> = [];
  p1.playedCards.push(listener(calls, 'Listener One'));
  return {game, p1, p2, calls};
}

describe('Game.globalParameterRaised — the one dispatcher', () => {
  it('Venus: an opponent\'s raise reaches the owner, with the steps, the raiser and the levels', () => {
    const {game, p1, p2, calls} = table();
    setVenusScaleLevel(game, 8);
    game.increaseVenusScaleLevel(p2, 2);
    expect(calls).deep.eq([{owner: p1.color, parameter: GlobalParameter.VENUS, steps: 2, by: p2.color, before: 8, after: 12}]);
  });

  it('temperature (a step is 2 °C) and oxygen (1 %) dispatch too — the hook is the class\'s, not Venus\'s', () => {
    const {game, p1, calls} = table();
    setTemperature(game, -20);
    setOxygenLevel(game, 3);
    game.increaseTemperature(p1, 2);
    game.increaseOxygenLevel(p1, 1);
    expect(calls).deep.eq([
      {owner: p1.color, parameter: GlobalParameter.TEMPERATURE, steps: 2, by: p1.color, before: -20, after: -16},
      {owner: p1.color, parameter: GlobalParameter.OXYGEN, steps: 1, by: p1.color, before: 3, after: 4},
    ]);
  });

  it('oxygen\'s 8 % bonus step: the oxygen raise dispatches FIRST, then the temperature step it pays', () => {
    const {game, p1, calls} = table();
    setOxygenLevel(game, 7);
    setTemperature(game, -20);
    game.increaseOxygenLevel(p1, 1);
    expect(calls.map((c) => c.parameter)).deep.eq([GlobalParameter.OXYGEN, GlobalParameter.TEMPERATURE]);
  });

  it('the ceiling cuts the steps; at the maximum nothing is dispatched', () => {
    const {game, p1, calls} = table();
    setVenusScaleLevel(game, 28);
    game.increaseVenusScaleLevel(p1, 2);
    setVenusScaleLevel(game, 30);
    game.increaseVenusScaleLevel(p1, 1);
    setTemperature(game, MAX_TEMPERATURE);
    game.increaseTemperature(p1, 1);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    game.increaseOxygenLevel(p1, 1);
    expect(calls).deep.eq([{owner: p1.color, parameter: GlobalParameter.VENUS, steps: 1, by: p1.color, before: 28, after: 30}]);
  });

  it('a LOWERING is never dispatched (the Reds\' P3, Gas Export\'s oxygen)', () => {
    const {game, p1, calls} = table();
    setVenusScaleLevel(game, 10);
    setTemperature(game, 0);
    setOxygenLevel(game, 5);
    game.increaseVenusScaleLevel(p1, -1);
    game.increaseTemperature(p1, -1);
    game.increaseOxygenLevel(p1, -1);
    expect(calls).deep.eq([]);
  });

  it('a raise credited to NOBODY is dispatched with no author: the Solar Phase and an unrewarded world move', () => {
    const {game, p2, calls} = table();
    game.increaseVenusScaleLevel(p2, 1, {unrewarded: true});
    game.phase = Phase.SOLAR;
    game.increaseVenusScaleLevel(p2, 1);
    expect(calls.map((c) => c.by)).deep.eq([undefined, undefined]);
    expect(calls.map((c) => c.steps)).deep.eq([1, 1]);
  });

  it('MarsBot\'s raise reaches a human owner, credited to the bot', () => {
    const [game, human, bot] = testAutomaGame({venusNextExtension: true});
    const calls: Array<Call> = [];
    human.playedCards.push(listener(calls, 'Listener Bot'));
    game.increaseVenusScaleLevel(bot, 1);
    expect(calls).deep.eq([{owner: human.color, parameter: GlobalParameter.VENUS, steps: 1, by: bot.color, before: 0, after: 2}]);
  });

  it('every seat in generation order — corporations are part of a tableau', () => {
    const {game, p1, p2, calls} = table();
    p2.playedCards.push(listener(calls, 'Listener Two'));
    game.increaseVenusScaleLevel(p2, 1);
    expect(calls.map((c) => c.owner)).deep.eq(game.playersInGenerationOrder.map((p) => p.color));
    expect(calls.map((c) => c.owner)).deep.eq([p1.color, p2.color]);
  });

  it('the reactor\'s owner, not the raiser, is the scope: every call is wrapped `withEffect(owner, card, \'global-parameter\')`', () => {
    const {game, p1, p2} = table();
    const owner = fakeCard({
      name: 'Paying Listener' as CardName,
      onGlobalParameterRaised(cardOwner: IPlayer) {
        cardOwner.stock.add(Resource.MEGACREDITS, 1, {log: false});
      },
    } as Partial<IProjectCard>);
    p1.playedCards.push(owner);
    game.increaseVenusScaleLevel(p2, 1);
    const markers = game.events.events.filter((e) => e.type === 'effect-triggered' && e.source !== undefined && 'card' in e.source && e.source.card === ('Paying Listener' as CardName));
    expect(markers.map((e) => [e.player, e.trigger])).deep.eq([[p1.color, 'global-parameter']]);
  });
});
