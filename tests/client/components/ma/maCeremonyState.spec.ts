import {expect} from 'chai';
import {armMaCeremony, maCeremonyState, observeMaCeremony, resetMaCeremony, wasRecentlyCelebrated} from '@/client/components/ma/maCeremonyState';
import type {Color} from '@/common/Color';

/**
 * Post-confirm ceremony lifecycle: armed at submit, fired ONLY when the
 * fresh playerView proves the viewer actually got the slot. A lost race /
 * server rejection never celebrates; reload never replays (the arm is
 * session-memory only).
 */
describe('maCeremonyState', () => {
  const me: Color = 'red';
  const rival: Color = 'blue';

  const view = (over: {
    milestones?: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
    awards?: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
  } = {}) => ({
    thisPlayer: {color: me},
    game: {
      milestones: over.milestones ?? [{name: 'Mayor'}],
      awards: over.awards ?? [{name: 'Banker'}],
    },
  });

  beforeEach(() => resetMaCeremony());

  it('fires only when the fresh view shows the viewer took the slot', () => {
    armMaCeremony({kind: 'milestone', name: 'Mayor', color: me, cost: 8, free: false}, 1000);
    // Not resolved yet — the arm stays pending.
    expect(observeMaCeremony(view(), 1100)).to.eq(false);
    expect(maCeremonyState.pending).to.not.eq(undefined);
    // Resolved in MY colour → fire once.
    expect(observeMaCeremony(view({milestones: [{name: 'Mayor', playerName: 'Me', color: me}]}), 1200)).to.eq(true);
    expect(maCeremonyState.nonce).to.eq(1);
    expect(maCeremonyState.current?.name).to.eq('Mayor');
    expect(maCeremonyState.pending).to.eq(undefined);
    // A later identical view never re-fires.
    expect(observeMaCeremony(view({milestones: [{name: 'Mayor', playerName: 'Me', color: me}]}), 1300)).to.eq(false);
    expect(maCeremonyState.nonce).to.eq(1);
  });

  it('a lost race drops the arm silently', () => {
    const nonce0 = maCeremonyState.nonce; // monotonic — reset never rewinds it
    armMaCeremony({kind: 'award', name: 'Banker', color: me, cost: 8, free: false}, 1000);
    expect(observeMaCeremony(view({awards: [{name: 'Banker', playerName: 'Riv', color: rival}]}), 1100)).to.eq(false);
    expect(maCeremonyState.nonce).to.eq(nonce0);
    expect(maCeremonyState.pending).to.eq(undefined);
  });

  it('a stale arm expires after the TTL', () => {
    armMaCeremony({kind: 'milestone', name: 'Mayor', color: me, cost: 8, free: false}, 1000);
    expect(observeMaCeremony(view(), 1000 + 91_000)).to.eq(false);
    expect(maCeremonyState.pending).to.eq(undefined);
  });

  it('wasRecentlyCelebrated suppresses within the window only', () => {
    armMaCeremony({kind: 'award', name: 'Banker', color: me, cost: 14, free: false}, 1000);
    observeMaCeremony(view({awards: [{name: 'Banker', playerName: 'Me', color: me}]}), 2000);
    expect(wasRecentlyCelebrated('Banker', 2000 + 10_000)).to.eq(true);
    expect(wasRecentlyCelebrated('Banker', 2000 + 31_000)).to.eq(false);
    expect(wasRecentlyCelebrated('Mayor', 2000 + 10_000)).to.eq(false);
  });

  it('carries the free flag + cost through to the fired event', () => {
    armMaCeremony({kind: 'award', name: 'Banker', color: me, cost: 0, free: true}, 1000);
    observeMaCeremony(view({awards: [{name: 'Banker', playerName: 'Me', color: me}]}), 1100);
    expect(maCeremonyState.current).to.deep.eq({kind: 'award', name: 'Banker', color: me, cost: 0, free: true});
  });
});
