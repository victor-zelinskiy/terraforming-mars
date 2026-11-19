import {expect} from 'chai';
import {GAME_ONLY_TAIL_MS, watchBoardCover} from '@/client/console/boardCoverWitness';

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
});
