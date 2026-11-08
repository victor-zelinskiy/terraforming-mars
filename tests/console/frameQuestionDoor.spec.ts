import {expect} from 'chai';
import {openFrameQuestionDoor, registerFrameQuestionDoor, resetFrameQuestionDoors} from '@/client/console/frameQuestionDoor';

/*
 * THE QUESTION DOOR (ledger HC — the chairman quest riding the vote's answer, 2026-11-07): a conclusion HELD for the
 * frame's own question is a hand-over, never a dead end. The frame that owns the question registers ONE door; the
 * shell opens it on the hold; a frame with no door is named, never waited on in silence.
 */
describe('frameQuestionDoor', () => {
  afterEach(resetFrameQuestionDoors);

  it('a frame with no door answers `no-door` — the shell names the hold', () => {
    expect(openFrameQuestionDoor('parliament')).eq('no-door');
  });

  it('the door says whether its surface serves the question now', () => {
    let serves = true;
    let opened = 0;
    registerFrameQuestionDoor('parliament', () => {
      opened++;
      return serves;
    });
    expect(openFrameQuestionDoor('parliament')).eq('served');
    serves = false;
    expect(openFrameQuestionDoor('parliament')).eq('refused');
    expect(opened).eq(2);
    expect(openFrameQuestionDoor('hand'), 'a door belongs to ONE kind').eq('no-door');
  });

  it('a retract takes only ITS door — a remount that registered first is never dropped by the old instance leaving', () => {
    const stopOld = registerFrameQuestionDoor('parliament', () => false);
    const stopNew = registerFrameQuestionDoor('parliament', () => true);
    stopOld();
    expect(openFrameQuestionDoor('parliament'), 'the new instance keeps its door').eq('served');
    stopNew();
    expect(openFrameQuestionDoor('parliament')).eq('no-door');
  });
});
