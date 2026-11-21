import {expect} from 'chai';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';

/*
 * A SEAT THAT IS DONE STILL GETS WHAT IT IS OWED (`Game.playerIsFinishedWithResearchPhase` → `drainResearchedSeats`).
 *
 * The research phase drains the deferred queue PER SEAT. A reaction raised for a seat that already left the phase —
 * by another seat's answer — had nobody to run it: it stood queued until the action phase began, and a reload lost
 * it. The engine fuzz, FREEZE ZERO stage 5 — seed 50072 (Pharmacy Union, owed a disease by another seat's Recyclon).
 */
describe('the research barrier — a seat that is done still gets what it is owed', () => {
  let game: IGame;
  let first: TestPlayer;
  let second: TestPlayer;
  let third: TestPlayer;

  beforeEach(() => {
    [game, first, second, third] = testGame(3);
    game.phase = Phase.RESEARCH;
    for (const seat of [first, second, third]) {
      seat.popWaitingFor();
    }
  });

  it('a reaction queued for a seat that already left is run by the NEXT seat\'s way out — not at the action phase', () => {
    game.playerIsFinishedWithResearchPhase(first);
    expect(game.phase).eq(Phase.RESEARCH);

    // (What another seat's answer sets off for the seat that is done.)
    let ran = 0;
    game.defer(new SimpleDeferredAction(first, () => {
      ran++;
      return undefined;
    }));

    game.playerIsFinishedWithResearchPhase(second);
    expect(ran, 'run on the spot').eq(1);
    expect(game.deferredActions.length).eq(0);
    expect(game.phase, 'the third seat is still researching').eq(Phase.RESEARCH);

    game.playerIsFinishedWithResearchPhase(third);
    expect(game.phase).eq(Phase.ACTION);
    expect(ran).eq(1);
  });

  it('a reaction that ASKS its seat is answered BEFORE the first action — the phase turns on the answer', () => {
    game.playerIsFinishedWithResearchPhase(first);
    let answered = 0;
    game.defer(new SimpleDeferredAction(first, () => new SelectOption('A reaction asks its seat').andThen(() => {
      answered++;
      return undefined;
    })));

    game.playerIsFinishedWithResearchPhase(second);
    const asked = cast(first.getWaitingFor(), SelectOption);
    expect(game.phase).eq(Phase.RESEARCH);

    // Every seat is done — and one way out is still running: the phase waits for the answer.
    game.playerIsFinishedWithResearchPhase(third);
    expect(game.phase, 'the question still stands').eq(Phase.RESEARCH);
    expect(first.getWaitingFor()).eq(asked);

    first.process({type: 'option'});
    expect(answered).eq(1);
    expect(game.phase).eq(Phase.ACTION);
  });

  it('a seat still IN the phase keeps its own queue for its own way out (the seats answer side by side)', () => {
    let ran = 0;
    game.defer(new SimpleDeferredAction(third, () => {
      ran++;
      return undefined;
    }));

    game.playerIsFinishedWithResearchPhase(first);
    game.playerIsFinishedWithResearchPhase(second);
    expect(ran, 'not another seat\'s to run').eq(0);

    game.playerIsFinishedWithResearchPhase(third);
    expect(ran).eq(1);
    expect(game.phase).eq(Phase.ACTION);
  });

  it('with nothing owed the barrier turns exactly as before — on the last seat', () => {
    game.playerIsFinishedWithResearchPhase(second);
    game.playerIsFinishedWithResearchPhase(third);
    expect(game.phase).eq(Phase.RESEARCH);
    game.playerIsFinishedWithResearchPhase(first);
    expect(game.phase).eq(Phase.ACTION);
    expect(game.players.filter((seat) => seat.getWaitingFor() !== undefined), 'the first action is asked of one seat').to.have.length(1);
  });
});
