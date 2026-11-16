import {expect} from 'chai';
import {flushPromises} from '@vue/test-utils';
import {REWARD_QUIET_MAX_WAIT_MS, boardStoryProgress, waitConsoleQuiet} from '@/client/console/rewardPayoutQuiet';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * A QUIET-WAIT OVER A STORY COUNTS FROM THE STORY'S LAST PROGRESS (FLAKE ZERO Ф4, class N). The city payout waits for
 * the scales' story, the board-beat drain for the field's cinematics — each with a cap counted from the call. On CI (a
 * 4K frame of ~300 ms) a story still moving outlasted it and the follower played INTO it (the city answering mid-story,
 * the scales draining over a tile still in the air). With `progress` the cap restarts on every change of what the story
 * is doing; the ceiling bounds one that keeps moving; a story that stands still ends on the cap as before.
 */
describe('waitConsoleQuiet — the cap counts from the story\'s last progress', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });
  const step = async (ms: number) => {
    for (let left = ms; left > 0; left -= 50) {
      clock.advance(Math.min(50, left));
      await flushPromises();
    }
  };

  it('a story that keeps moving is waited for past the cap — and followed the moment it is quiet', async () => {
    let phase = 'landing';
    let settling = true;
    let quiet = false;
    void waitConsoleQuiet(() => settling, {maxMs: 6_000, ceilingMs: 15_000, progress: () => phase, who: 'spec'}).then(() => quiet = true);
    await step(4_000);
    phase = 'focus-exit';
    await step(4_000);
    phase = 'scales-drain';
    await step(3_000);
    expect(quiet, 'the story is still being told — nobody plays into it').to.eq(false);
    settling = false;
    await step(100);
    expect(quiet).to.eq(true);
  });

  it('a story that stands still ends on the cap, as before', async () => {
    let quiet = false;
    void waitConsoleQuiet(() => true, {maxMs: 6_000, ceilingMs: 15_000, progress: () => 'stuck', who: 'spec'}).then(() => quiet = true);
    await step(5_900);
    expect(quiet).to.eq(false);
    await step(200);
    expect(quiet).to.eq(true);
  });

  it('a story that keeps moving for ever is bounded by the ceiling', async () => {
    let tick = 0;
    let quiet = false;
    void waitConsoleQuiet(() => true, {maxMs: 6_000, ceilingMs: 15_000, progress: () => String(Math.floor(tick++ / 20)), who: 'spec'})
      .then(() => quiet = true);
    await step(14_900);
    expect(quiet).to.eq(false);
    await step(200);
    expect(quiet).to.eq(true);
  });

  it('with no `progress` the cap counts from the call, unchanged', async () => {
    let quiet = false;
    void waitConsoleQuiet(() => true, {who: 'spec'}).then(() => quiet = true);
    await step(REWARD_QUIET_MAX_WAIT_MS - 100);
    expect(quiet).to.eq(false);
    await step(200);
    expect(quiet).to.eq(true);
  });

  it('the board story\'s reading is a stable string at rest', () => {
    expect(boardStoryProgress()).to.eq(boardStoryProgress());
    expect(boardStoryProgress()).to.match(/^[01]{9}\|/);
  });
});
