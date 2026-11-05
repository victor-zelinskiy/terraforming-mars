import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {ClockAnimation, followLeaderClock} from '@/client/console/stepEntryClock';

/*
 * A HANDOVER OF TWO ENTRIES RUNS ON ONE CLOCK (CI 2026-11-05, `console-martian-census` § gaps — the release ran out a
 * frame before the Parliament's entry started: an empty stage). The follower is paused until the leader's start time
 * is resolved and then takes it — never a second, earlier start of its own.
 */
class FakeAnimation implements ClockAnimation {
  playState: Animation['playState'] = 'running';
  startTime: Animation['startTime'] = null;
  readonly log: Array<string> = [];
  private settle: ((v: unknown) => void) | undefined;
  private fail: ((e: unknown) => void) | undefined;
  readonly ready = new Promise<unknown>((resolve, reject) => {
    this.settle = resolve;
    this.fail = reject;
  });
  pause(): void {
    this.log.push('pause');
  }
  play(): void {
    this.log.push('play');
  }
  finish(): void {
    this.log.push('finish');
  }
  start(at: number | null): void {
    this.startTime = at;
    this.settle?.(this);
  }
  cancel(): void {
    this.fail?.(new Error('AbortError'));
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('stepEntryClock — the release takes the step entry\'s start time', () => {
  it('a pending leader: the follower is PAUSED at once and takes the leader\'s start time when it resolves', async () => {
    const leader = new FakeAnimation();
    const follower = new FakeAnimation();
    followLeaderClock([follower], leader, () => true);
    expect(follower.log, 'held at its first frame until the leader starts').to.deep.eq(['pause']);
    leader.start(1234);
    await flush();
    expect(follower.startTime, 'one clock').to.eq(1234);
  });

  it('a leader that already finished finishes the follower — never a release played under a standing step', () => {
    const leader = new FakeAnimation();
    leader.playState = 'finished';
    const follower = new FakeAnimation();
    followLeaderClock([follower], leader, () => true);
    expect(follower.log).to.deep.eq(['finish']);
  });

  it('no leader (a step with no entry of its own) leaves the follower on its own clock', () => {
    const follower = new FakeAnimation();
    followLeaderClock([follower], undefined, () => true);
    expect(follower.log).to.deep.eq([]);
  });

  it('a superseded handover touches nothing; a cancelled leader lets a live follower run', async () => {
    const leader = new FakeAnimation();
    const follower = new FakeAnimation();
    let alive = true;
    followLeaderClock([follower], leader, () => alive);
    alive = false;
    leader.start(50);
    await flush();
    expect(follower.startTime, 'superseded — untouched').to.eq(null);

    const leader2 = new FakeAnimation();
    const follower2 = new FakeAnimation();
    followLeaderClock([follower2], leader2, () => true);
    leader2.cancel();
    await flush();
    expect(follower2.log).to.deep.eq(['pause', 'play']);
  });

  it('the composer binds its setup release to the step\'s entry', () => {
    const composer = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'client', 'components', 'console', 'ConsoleActionComposer.vue'), 'utf8');
    const release = composer.slice(composer.indexOf('releaseSetupForParliament(): void {'));
    expect(release.slice(0, release.indexOf('\n    },\n'))).to.include('syncReleaseToStepEntry({');
  });
});
