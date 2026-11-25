import {expect} from 'chai';
import {BOARD_OFF_SCREEN_TERM, GAME_ONLY_TAIL_MS, PLAYER_COVER_TERMS, SELF_BOUNDED_COVERS, boardWaitClock, watchBoardCover} from '@/client/console/boardCoverWitness';
import {SITTING_RISE_NET_MS} from '@/client/console/parliament/sittingRise';

/*
 * WHO KEPT THE BOARD COVERED (the tier audit of 2026-11-18, row 3). A wait for «a board the player can see» ends on
 * its ceiling by design when the VIEWER keeps it covered — and only then: a planned verdict is proof over the wait,
 * never a declaration.
 */
describe('boardCoverWitness — whose time a covered board was', () => {
  it('the viewer sat in a workspace for the whole wait — their own time', () => {
    const witness = watchBoardCover();
    for (let t = 0; t <= 20_000; t += 140) {
      witness.look(['workspace'], t);
    }
    const verdict = witness.verdict(20_000);
    expect(verdict.planned).to.eq('the viewer kept the board covered by workspace');
  });

  it('a wave that never ends kept another seat\'s tile off the board — a defect that names it', () => {
    const witness = watchBoardCover();
    for (let t = 0; t <= 20_000; t += 140) {
      witness.look(['transfer'], t);
    }
    const verdict = witness.verdict(20_000);
    expect(verdict.planned, 'nobody was waited for').to.eq(undefined);
    expect(verdict.detail).to.eq('held by the game\'s own scenes for the last 20 s: transfer');
  });

  it('the game\'s scene BEHIND the player\'s own cover is not this wait\'s to name', () => {
    const witness = watchBoardCover();
    for (let t = 0; t <= 20_000; t += 140) {
      witness.look(['workspace', 'transfer', 'hand-delivery'], t);
    }
    expect(witness.verdict(20_000).planned).to.eq('the viewer kept the board covered by workspace');
  });

  it('the viewer\'s own story first, then their workspace to the ceiling — their time', () => {
    const witness = watchBoardCover();
    let t = 0;
    // The seats go in turn: the viewer's own placement tells its story for eight seconds…
    for (; t < 8_000; t += 140) {
      witness.look(['own-placement', 'transfer'], t);
    }
    // …then they open a workspace and stay.
    for (; t <= 20_000; t += 140) {
      witness.look(['reveal'], t);
    }
    expect(witness.verdict(t).planned).to.eq('the viewer kept the board covered by reveal');
  });

  it('the viewer left, and the game\'s own scenes alone held the board past the tail — a defect; a hand-off of a moment is not', () => {
    const stuck = watchBoardCover();
    let t = 0;
    for (; t < 12_000; t += 140) {
      stuck.look(['workspace'], t);
    }
    const leftAt = t;
    for (; t < leftAt + GAME_ONLY_TAIL_MS + 280; t += 140) {
      stuck.look(['played-hero', 'deck-draw'], t);
    }
    const verdict = stuck.verdict(t);
    expect(verdict.planned).to.eq(undefined);
    expect(verdict.detail).to.contain('played-hero + deck-draw');

    const handoff = watchBoardCover();
    for (t = 0; t < 19_000; t += 140) {
      handoff.look(['workspace'], t);
    }
    for (; t <= 20_000; t += 140) {
      handoff.look(['transfer'], t);
    }
    expect(handoff.verdict(t).planned, 'a second of the game\'s own after nineteen of the viewer\'s').to.eq('the viewer kept the board covered by workspace');
  });
  /*
   * A COVER THAT ENDS AT ITS OWN BOUND (the box's whole games in a real browser, 2026-11-24 — game 181): a sitting on
   * its way up, waiting behind its plate, kept the board for the last thirteen seconds of a foreign tile's wait — and
   * gives it back at fifteen by its own net. Inside that bound nothing leaks; beside another scene, or past it, the
   * tail is the game's own as before.
   */
  it('a sitting on its way up, alone and inside its own net — the designed end; beside a wave, or past the net, a defect', () => {
    expect(SELF_BOUNDED_COVERS.get('sitting-rise'), 'the witness knows the rise by its own net').to.eq(SITTING_RISE_NET_MS);
    const rise = watchBoardCover();
    for (let t = 0; t <= 7_000; t += 140) {
      rise.look(['workspace'], t);
    }
    for (let t = 7_140; t <= 20_000; t += 140) {
      rise.look(['sitting-rise'], t);
    }
    const inside = rise.verdict(20_000);
    expect(inside.planned).to.eq('sitting-rise kept the board inside its own bound of 15 s');
    expect(inside.detail).to.contain('sitting-rise');

    const beside = watchBoardCover();
    for (let t = 0; t <= 20_000; t += 140) {
      beside.look(t > 10_000 ? ['sitting-rise', 'transfer'] : ['workspace'], t);
    }
    expect(beside.verdict(20_000).planned, 'a wave beside it is not the rise').to.eq(undefined);

    const past = watchBoardCover();
    for (let t = 0; t <= 20_000; t += 140) {
      past.look(['sitting-rise'], t);
    }
    expect(past.verdict(20_000).planned, 'a rise that outlived its own net is a leak').to.eq(undefined);
  });
});

/*
 * THE CLOCK OF A WAIT FOR THE BOARD (the landing law, 2026-11-25). A tile of another seat waited twenty seconds of
 * the WALL for a board the player can see, and was then «revealed without its flight» — fifteen such lines in
 * thirty-eight whole games, each of them under a hand the player was reading. The clock runs only while the board
 * could have shown the landing.
 */
describe('boardWaitClock — the wait ages only while the board could show the thing', () => {
  it('five minutes behind the screen of the player: the wait has not aged', () => {
    const clock = boardWaitClock(0);
    let stood = 0;
    for (let t = 0; t <= 300_000; t += 100) {
      stood = clock.look(true, t);
    }
    expect(stood).to.eq(0);
    expect(clock.behindMs(), 'all of it was the time of the player').to.eq(300_000);
  });

  it('the time in view adds up across the screens between: eight seconds, a minute in the hand, thirteen more — past the twenty', () => {
    const clock = boardWaitClock(1_000);
    expect(clock.look(false, 1_000)).to.eq(0);
    expect(clock.look(true, 9_000), 'eight seconds under a scene of the game').to.eq(8_000);
    expect(clock.look(true, 39_000), 'in the hand').to.eq(8_000);
    expect(clock.look(false, 69_000), 'the hand closed at this look — the span before it was still its own').to.eq(8_000);
    expect(clock.look(false, 82_000)).to.eq(21_000);
    expect(clock.behindMs()).to.eq(60_000);
  });

  it('the screen that takes the board away is the workspace of the player — the band of a reveal leaves it in view', () => {
    expect(BOARD_OFF_SCREEN_TERM).to.eq('workspace');
    expect(PLAYER_COVER_TERMS.has(BOARD_OFF_SCREEN_TERM), 'and it is one of the covers of the player').to.eq(true);
  });
});
