import {expect} from 'chai';
import {advanceMaCeremony, armMaCeremony, maCeremonyState, observeMaCeremony, resetMaCeremony} from '@/client/components/ma/maCeremonyState';
import type {Color} from '@/common/Color';

/**
 * The MA ceremony lifecycle — the ONE announcement channel for claims /
 * fundings, for every player: seed-then-diff over the public game model
 * (reload never replays), the viewer's own armed submit gets the full beat
 * with the exact cost, everyone else's actions play as remote beats naming
 * the actor, and multiple events queue FIFO.
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

  // Seed with everything still open, so the diff sees later takes.
  const seed = () => observeMaCeremony(view(), 500);

  beforeEach(() => resetMaCeremony());

  it('first observation seeds silently — an already-taken slot never replays', () => {
    const taken = view({milestones: [{name: 'Mayor', playerName: 'Riv', color: rival}]});
    expect(observeMaCeremony(taken, 1000)).to.eq(false);
    expect(maCeremonyState.current).to.eq(undefined);
    // The same taken slot on a later observation stays silent.
    expect(observeMaCeremony(taken, 2000)).to.eq(false);
  });

  it("the viewer's own armed claim fires the OWN beat with the exact cost", () => {
    seed();
    armMaCeremony({kind: 'milestone', name: 'Mayor', cost: 8, free: false}, 1000);
    // Not resolved yet — nothing plays, the arm stays pending.
    expect(observeMaCeremony(view(), 1100)).to.eq(false);
    expect(maCeremonyState.pending).to.not.eq(undefined);
    // Resolved in MY colour → the full own beat.
    expect(observeMaCeremony(view({milestones: [{name: 'Mayor', playerName: 'Me', color: me}]}), 1200)).to.eq(true);
    expect(maCeremonyState.current).to.deep.include({name: 'Mayor', own: true, cost: 8, color: me, actorName: 'Me'});
    expect(maCeremonyState.pending).to.eq(undefined);
    // The same view never re-fires.
    expect(observeMaCeremony(view({milestones: [{name: 'Mayor', playerName: 'Me', color: me}]}), 1300)).to.eq(false);
  });

  it("another player's funding fires a REMOTE beat naming the actor", () => {
    seed();
    expect(observeMaCeremony(view({awards: [{name: 'Banker', playerName: 'Riv', color: rival}]}), 1000)).to.eq(true);
    expect(maCeremonyState.current).to.deep.include({kind: 'award', name: 'Banker', own: false, actorName: 'Riv', color: rival});
    expect(maCeremonyState.current?.cost).to.eq(undefined); // a rival's price is not invented
  });

  it('a lost race drops the arm AND plays the rival beat instead', () => {
    seed();
    armMaCeremony({kind: 'award', name: 'Banker', cost: 8, free: false}, 1000);
    expect(observeMaCeremony(view({awards: [{name: 'Banker', playerName: 'Riv', color: rival}]}), 1100)).to.eq(true);
    expect(maCeremonyState.pending).to.eq(undefined);
    expect(maCeremonyState.current).to.deep.include({own: false, actorName: 'Riv'});
  });

  it('two events on one observation queue FIFO; advance hands over the stage', () => {
    seed();
    observeMaCeremony(view({
      milestones: [{name: 'Mayor', playerName: 'Riv', color: rival}],
      awards: [{name: 'Banker', playerName: 'Me', color: me}],
    }), 1000);
    expect(maCeremonyState.current?.name).to.eq('Mayor');
    expect(maCeremonyState.queue.length).to.eq(1);
    advanceMaCeremony(1200);
    expect(maCeremonyState.current?.name).to.eq('Banker');
    expect(maCeremonyState.current?.own).to.eq(true);
    advanceMaCeremony(1400);
    expect(maCeremonyState.current).to.eq(undefined);
  });

  it('a stale queued beat is dropped, never replayed late', () => {
    seed();
    observeMaCeremony(view({
      milestones: [{name: 'Mayor', playerName: 'Riv', color: rival}],
      awards: [{name: 'Banker', playerName: 'Riv', color: rival}],
    }), 1000);
    // The shell was away for a minute — the queued second beat expired.
    advanceMaCeremony(1000 + 60_000);
    expect(maCeremonyState.current).to.eq(undefined);
  });

  it('a stale arm expires after the TTL (a later own take plays without the cost)', () => {
    seed();
    armMaCeremony({kind: 'milestone', name: 'Mayor', cost: 8, free: false}, 1000);
    expect(observeMaCeremony(view(), 1000 + 91_000)).to.eq(false);
    expect(maCeremonyState.pending).to.eq(undefined);
  });

  it('carries the free flag through to the own beat', () => {
    seed();
    armMaCeremony({kind: 'award', name: 'Banker', cost: 0, free: true}, 1000);
    observeMaCeremony(view({awards: [{name: 'Banker', playerName: 'Me', color: me}]}), 1100);
    expect(maCeremonyState.current).to.deep.include({free: true, cost: 0, own: true});
  });
});
