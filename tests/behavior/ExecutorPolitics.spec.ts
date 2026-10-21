import {expect} from 'chai';
import {Executor} from '../../src/server/behavior/Executor';
import {Behavior} from '../../src/server/behavior/Behavior';
import {IGame} from '../../src/server/IGame';
import {IDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {SendDelegateToArea} from '../../src/server/deferredActions/SendDelegateToArea';
import {PlaceDelegatesOnResolution} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {CardName} from '../../src/common/cards/CardName';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {quietResolutionOf, seatResolution} from '../parliament/parliamentArrange';

/**
 * `behavior.turmoil` THROUGH THE FACADE (T04 — the general fix the first classic
 * Turmoil card's adaptation carries for the cards that read it: Event Analysts,
 * Martian Media Center, the prelude2 / Pathfinders / Moon envoys). The Executor
 * reads `game.politics` only — never `Turmoil.getTurmoil`: on a Redux table the
 * same declaration reads the Mars Parliament, on a classic table it keeps
 * upstream's steps byte for byte.
 */
const CARD = 'politics probe' as CardName;

function drain(game: IGame): Array<IDeferredAction> {
  const out: Array<IDeferredAction> = [];
  while (game.deferredActions.length > 0) {
    out.push(game.deferredActions.pop()!);
  }
  return out;
}

describe('Executor · behavior.turmoil through game.politics', () => {
  let executor: Executor;

  beforeEach(() => {
    executor = new Executor();
  });

  it('the Executor source never reads the classic engine', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/server/behavior/Executor.ts', 'utf8');
    expect(source).not.match(/Turmoil\.getTurmoil|SendDelegateToArea/);
  });

  describe('on a classic Turmoil table — upstream\'s steps, unchanged', () => {
    let game: IGame;
    let player: TestPlayer;

    beforeEach(() => {
      [game, player] = testGame(2, {turmoilExtension: true});
    });

    it('influence +1 lands on the classic engine', () => {
      const before = game.turmoil!.getInfluence(player);
      executor.execute({turmoil: {influenceBonus: 1}}, player, fakeCard({name: CARD}));
      expect(game.turmoil!.getInfluence(player)).eq(before + 1);
    });

    it('«send 2 delegates» (one party) defers ONE SendDelegateToArea for 2, with upstream\'s title', () => {
      executor.execute({turmoil: {sendDelegates: {count: 2}}}, player, fakeCard({name: CARD}));
      const steps = drain(game);
      expect(steps).has.length(1);
      const step = cast(steps[0], SendDelegateToArea);
      expect(step.title).eq('Select where to send 2 delegates');
      expect(step.options).deep.eq({count: 2});
    });

    it('«many parties» defers one step per delegate', () => {
      executor.execute({turmoil: {sendDelegates: {count: 3, manyParties: true}}}, player, fakeCard({name: CARD}));
      const steps = drain(game);
      expect(steps.map((s) => cast(s, SendDelegateToArea).title)).deep.eq(Array(3).fill('Select where to send delegate'));
    });

    it('availability is the reserve, read through the facade', () => {
      const reserve = game.politics!.delegatesInReserve(player);
      expect(reserve).eq(game.turmoil!.getAvailableDelegateCount(player));
      const fake = fakeCard({name: CARD});
      expect(executor.canExecute({turmoil: {sendDelegates: {count: reserve}}}, player, fake)).is.true;
      expect(executor.canExecute({turmoil: {sendDelegates: {count: reserve + 1}}}, player, fake)).is.false;
    });
  });

  describe('on a Turmoil Redux table — the Mars Parliament', () => {
    let game: IGame;
    let player: TestPlayer;

    beforeEach(() => {
      [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.REDS, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    });

    it('influence +1 is a bonus of the Parliament, NAMED by its card', () => {
      const parliament = game.parliament!;
      const before = parliament.influence(player);
      executor.execute({turmoil: {influenceBonus: 1}}, player, fakeCard({name: CARD}));
      expect(parliament.influence(player)).eq(before + 1);
      expect(parliament.influenceSourcesOf(player)).deep.include({amount: 1, source: CARD});
    });

    it('«send 2 delegates» (one party) is ONE grant of 2 onto ONE resolution, the card named', () => {
      executor.execute({turmoil: {sendDelegates: {count: 2}}}, player, fakeCard({name: CARD}));
      const steps = drain(game);
      expect(steps).has.length(1);
      const step = cast(steps[0], PlaceDelegatesOnResolution);
      expect(step.quantity).eq(2);
      expect(step.cause).deep.eq({kind: 'card', card: CARD});
    });

    it('«many parties» is one grant of 1 per delegate', () => {
      executor.execute({turmoil: {sendDelegates: {count: 2, manyParties: true}}}, player, fakeCard({name: CARD}));
      const steps = drain(game);
      expect(steps.map((s) => cast(s, PlaceDelegatesOnResolution).quantity)).deep.eq([1, 1]);
    });

    it('played through: both delegates land on the chosen resolution, from the reserve', () => {
      const parliament = game.parliament!;
      const reserve = parliament.reserve(player);
      executor.execute({turmoil: {sendDelegates: {count: 2}}}, player, fakeCard({name: CARD}));
      runAllActions(game);
      const prompt = cast(player.popWaitingFor(), SelectParty);
      expect(prompt.parties).to.include(PartyName.MARS);
      prompt.process({type: 'party', partyName: PartyName.MARS}, player);
      runAllActions(game);
      expect(parliament.votesOf(player, parliament.slots[1])).eq(2);
      expect(parliament.reserve(player)).eq(reserve - 2);
    });

    it('availability is the Parliament\'s reserve, read through the facade', () => {
      const reserve = game.parliament!.reserve(player);
      expect(game.politics!.delegatesInReserve(player)).eq(reserve);
      const fake = fakeCard({name: CARD});
      const behavior = (count: number): Behavior => ({turmoil: {sendDelegates: {count}}});
      expect(executor.canExecute(behavior(reserve), player, fake)).is.true;
      expect(executor.canExecute(behavior(reserve + 1), player, fake)).is.false;
    });
  });

  it('a game without a political engine: a delegate grant cannot execute, an execution throws by name', () => {
    const [, player] = testGame(2);
    const fake = fakeCard({name: CARD});
    expect(executor.canExecute({turmoil: {sendDelegates: {count: 1}}}, player, fake)).is.false;
    expect(() => executor.execute({turmoil: {influenceBonus: 1}}, player, fake)).to.throw(/politics probe/);
  });
});
