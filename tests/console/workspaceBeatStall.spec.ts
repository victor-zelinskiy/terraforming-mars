import {expect} from 'chai';
import {
  BeatStallSample,
  BeatStallState,
  initialBeatStallState,
  isTransientBeat,
  observeBeatStall,
  reportSurfaceBeat,
  resetBeatStall,
  tickBeatStall,
  transientSurfaceBeats,
  WORKSPACE_BEAT_STALL_MS,
} from '@/client/console/workspaceBeatStall';

/**
 * THE BEAT STALL GUARD — a machine beat with nothing in flight is a stall, whatever its cause (the owner's R&D Funding
 * freeze of 2026-10-31: a deck-check claimed into the draw-only pending beat stood «executing» until a reload).
 */
describe('workspaceBeatStall', () => {
  afterEach(() => resetBeatStall());

  /** Run the samples through the rule, returning every verdict. */
  function walk(samples: ReadonlyArray<BeatStallSample>) {
    let state: BeatStallState = initialBeatStallState();
    return samples.map((sample) => {
      const r = observeBeatStall(state, sample);
      state = r.state;
      return r.verdict;
    });
  }
  const sample = (now: number, over: Partial<BeatStallSample> = {}): BeatStallSample =>
    ({now, beat: 'card-actions:executing', inFlight: [], promptKey: 'or:actionMenu#7', ...over});
  /** One sample a second, from 0 to `seconds` inclusive. */
  const seconds = (n: number, over: (t: number) => Partial<BeatStallSample> = () => ({})) =>
    Array.from({length: n + 1}, (_, i) => sample(i * 1000, over(i * 1000)));

  it('only the TRANSIENT phases are judged — a verdict or a committed stage is the player\'s to read', () => {
    expect(isTransientBeat('executing')).is.true;
    expect(isTransientBeat('completing')).is.true;
    for (const phase of ['browse', 'configure', 'committed', 'verdict'] as const) {
      expect(isTransientBeat(phase), phase).is.false;
    }
    expect(isTransientBeat(undefined)).is.false;
  });

  it('a beat standing with NOTHING in flight is a stall at the window — reported once, with what it was', () => {
    const verdicts = walk(seconds(WORKSPACE_BEAT_STALL_MS / 1000));
    expect(verdicts.slice(0, -1).every((v) => !v.stalled)).is.true;
    const last = verdicts[verdicts.length - 1];
    expect(last).to.deep.include({stalled: true, beat: 'card-actions:executing'});
    // …and the window restarts: the next tick says nothing.
    let state = initialBeatStallState();
    for (const s of seconds(WORKSPACE_BEAT_STALL_MS / 1000)) {
      state = observeBeatStall(state, s).state;
    }
    expect(observeBeatStall(state, sample(WORKSPACE_BEAT_STALL_MS + 1000)).verdict.stalled).is.false;
  });

  it('something IN FLIGHT keeps the beat honest — the window counts from the LAST moment anything moved', () => {
    // A blocking hold stands for 20 s (a long cinematic), then lets go: the stall comes a full window AFTER it.
    const hold = (t: number) => ({inFlight: t <= 20_000 ? ['deck-draw[blocking]'] : []});
    const verdicts = walk(seconds(20 + WORKSPACE_BEAT_STALL_MS / 1000, hold));
    const firstStall = verdicts.findIndex((v) => v.stalled);
    expect(firstStall * 1000).to.equal(20_000 + WORKSPACE_BEAT_STALL_MS);
    const v = verdicts[firstStall];
    expect(v.stalled && v.lastInFlight).to.deep.equal(['deck-draw[blocking]']);
  });

  it('the transport in flight, the prompt moving and a NEW beat all restart the window', () => {
    expect(walk(seconds(30, () => ({inFlight: ['transport']}))).some((v) => v.stalled)).is.false;
    expect(walk(seconds(30, (t) => ({promptKey: `p#${Math.floor(t / 5000)}`}))).some((v) => v.stalled)).is.false;
    expect(walk(seconds(30, (t) => ({beat: t % 10_000 < 5000 ? 'hand:executing' : 'card-actions:executing'}))).some((v) => v.stalled)).is.false;
  });

  it('no beat → nothing is judged and nothing carries over', () => {
    expect(walk(seconds(30, () => ({beat: undefined}))).some((v) => v.stalled)).is.false;
    // A beat that ENDS just before the window, then returns, starts from zero.
    const gap = (t: number) => ({beat: t >= 10_000 && t <= 11_000 ? undefined : 'card-actions:executing'});
    const verdicts = walk(seconds(26, gap));
    expect(verdicts.findIndex((v) => v.stalled) * 1000).to.equal(12_000 + WORKSPACE_BEAT_STALL_MS);
  });

  it('a surface reports its derived phase; only the transient ones are listed, and the report leaves with it', () => {
    reportSurfaceBeat('card-actions', 'committed');
    expect(transientSurfaceBeats()).to.deep.equal([]);
    reportSurfaceBeat('card-actions', 'executing');
    expect(transientSurfaceBeats()).to.deep.equal([['card-actions', 'executing']]);
    reportSurfaceBeat('card-actions', undefined);
    expect(transientSurfaceBeats()).to.deep.equal([]);
  });

  it('the shell sampler keeps its state between ticks and resets with the shell', () => {
    for (let t = 0; t < WORKSPACE_BEAT_STALL_MS; t += 1000) {
      expect(tickBeatStall(sample(t)).stalled).is.false;
    }
    expect(tickBeatStall(sample(WORKSPACE_BEAT_STALL_MS)).stalled).is.true;
    resetBeatStall();
    expect(tickBeatStall(sample(WORKSPACE_BEAT_STALL_MS + 1000)).stalled).is.false;
  });
});
