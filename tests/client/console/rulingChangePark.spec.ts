import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {beginAnimationHold, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {consoleParliamentUi, parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {letRulingChangeParkGo, openRulingChangePark, resetRulingChangeDraw, rulingChangeDrawState, rulingChangeParksReveal} from '@/client/console/parliament/rulingChangeDraw';
import {causeOf} from '@/common/diagnostics/cause';

/**
 * WHOSE THIRTY SECONDS (the owner, 2026-11-19 — «смотри с точки зрения опыта игрока»).
 *
 * A card's answer to a change of power belongs to the sitting's ceremony: the seals change places, then a card leaves
 * the deck inside the sitting. The park that keeps it for that moment was bounded on the WALL — thirty seconds from the
 * server's response — and ended on the player's time: a plate not opened yet, a board being read, cards not taken.
 * The answer then came by the ordinary reveal on the board: the effect before its cause, outside the ceremony.
 *
 * The net counts only the sitting's own time now — its stage on screen, the walk playing by itself, on one page.
 */
describe('rulingChangeDraw — the park waits for the player, and is bounded on the sitting\'s own time', () => {
  const ruling = {type: 'ruling-change', cardName: 'Tharsis Alliance', party: 'mars-first'} as never;
  const key = '4:1';
  let clock: ManualFlowClock;
  const said: Array<string> = [];
  const warn = console.warn;

  beforeEach(() => {
    clock = createManualClock(1_000);
    setFlowClock(clock);
    resetRulingChangeDraw();
    resetAnimationHoldsForTest();
    consoleParliamentUi.stageStanding = false;
    parliamentFlow.sittingPage = 0;
    said.splice(0);
    console.warn = (...args: Array<unknown>) => said.push(args.map(String).join(' '));
  });
  afterEach(() => {
    console.warn = warn;
    resetRulingChangeDraw();
    resetAnimationHoldsForTest();
    consoleParliamentUi.stageStanding = false;
    parliamentFlow.sittingPage = 0;
    setFlowClock(undefined);
  });

  const parked = (): boolean => rulingChangeDrawState.owedKey === key && rulingChangeParksReveal(ruling);

  it('THE PLAYER\'S TIME IS NOT COUNTED: a sitting that is not on screen keeps the card for as long as the player takes', () => {
    openRulingChangePark(key);
    // Five minutes of a plate nobody opened (a board being read, cards not taken, a cup of tea).
    clock.advance(300_000);
    expect(parked(), 'the card still belongs to the ceremony').to.eq(true);
    expect(said, 'and nothing was said').to.deep.eq([]);
  });

  it('…nor a table\'s answer mid-chain: while everything that stands waits for the player, the sitting on screen is theirs too', () => {
    openRulingChangePark(key);
    consoleParliamentUi.stageStanding = true;
    const hold = beginAnimationHold('table-answer', {waitsFor: 'player'});
    // (Past the net's thirty seconds, inside the hold's own life — the registry bounds every hold by itself.)
    clock.advance(33_000);
    expect(parked(), 'thirty-three seconds on stage, all of them the player\'s').to.eq(true);
    expect(said).to.deep.eq([]);
    hold.release();
  });

  it('A WALK THAT MOVES IS NOT A WALK THAT STOPPED: every page turned starts the count again (a slow device walks slowly)', () => {
    openRulingChangePark(key);
    consoleParliamentUi.stageStanding = true;
    for (let page = 1; page <= 6; page++) {
      clock.advance(20_000);
      parliamentFlow.sittingPage = page;
    }
    expect(parked(), 'two minutes on stage, never thirty seconds on one page').to.eq(true);
    expect(said).to.deep.eq([]);
  });

  it('THE NET: a walk that stands still on its own stage for thirty seconds lets the card go the ordinary road — said, counted, never an event', () => {
    openRulingChangePark(key);
    consoleParliamentUi.stageStanding = true;
    clock.advance(29_000);
    expect(parked(), 'not a second earlier').to.eq(true);
    clock.advance(1_500);
    expect(parked(), 'the batch takes the ordinary road').to.eq(false);
    expect(said).to.have.length(1);
    expect(said[0]).to.match(/^\[net-ended\] ruling-change-draw:untold-enactment — the sitting 4:1 never told its enactment — .*\(the walk stood still on its own stage; the sitting stands on screen\)$/);
    const cause = causeOf(said[0], 'warn');
    expect(cause?.cls).to.eq('net-ended/ended/ruling-change-draw:untold-enactment');
    expect(cause?.tier).to.eq('info');
    expect(clock.pending(), 'the clock is gone with the park').to.eq(0);
  });

  /*
   * THE ENACTMENT TOLD WITHOUT ITS TAIL (FREEZE ZERO — the fifth hundred's game 1401): its page cut mid-play
   * («свернуть» landed inside it), a reopening past it, the sitting's close — nothing will deliver the card into the
   * draw stage now. It takes the ordinary road AT ONCE: never the thirty seconds of the net under a results page.
   */
  it('a park whose enactment was told without its tail lets the card go AT ONCE — no net, nothing said', () => {
    openRulingChangePark(key);
    expect(rulingChangeParksReveal(ruling)).to.equal(true);
    letRulingChangeParkGo('9:9');
    expect(rulingChangeDrawState.owedKey, 'another sitting\'s word changes nothing').to.equal(key);
    letRulingChangeParkGo(key);
    expect(rulingChangeDrawState.owedKey).to.equal(undefined);
    expect(rulingChangeParksReveal(ruling), 'the card takes the ordinary road').to.equal(false);
    clock.advance(60_000);
    expect(said.filter((line) => line.includes('untold-enactment')), 'no net ever spoke').to.deep.equal([]);
  });

  it('THE SESSION ENDING UNDER THE PARK lets it go unsaid — nothing of it stands into the next game', () => {
    openRulingChangePark(key);
    resetRulingChangeDraw();
    expect(rulingChangeDrawState.owedKey).to.eq(undefined);
    expect(clock.pending(), 'the clock is gone with the park').to.eq(0);
    expect(said).to.deep.eq([]);
  });
});
