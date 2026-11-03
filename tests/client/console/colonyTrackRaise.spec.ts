import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {SelectColonyModel} from '@/common/models/PlayerInputModel';
import {
  clearColonyTrackRaise, colonyTrackRaiseFlow, colonyTrackRaiseLive, colonyTrackRaiseOf, colonyTrackRaiseTold,
  playOwedColonyTrackRaise, seedColonyTrackRaise,
} from '@/client/console/colonyTrade/colonyTrackRaise';
import {
  colonyTrackWaveState, finishColonyTrackWave, heldColonyTrackPosition, isColonyTradeInputLocked, releaseColonyTracks,
} from '@/client/console/colonyTrade/consoleColonyTrade';

/**
 * THE RAISE A PLAY ALREADY MADE (Prelude 2 P48 Early Colonization): read off the prompt's `trackRaise` marker, the
 * tiles HELD at `before` from the seed, the ONE track wave played over them, the pick locked until the last landing,
 * and a raise told once per session — a reload mid-step never replays it.
 */
const PROMPT = {
  type: 'colony', title: 'Select where to build a colony', buttonLabel: 'Build', promptId: 41,
  coloniesModel: [{name: ColonyName.LUNA}, {name: ColonyName.CALLISTO}],
  trackRaise: [
    {colony: ColonyName.LUNA, before: 1, after: 3},
    {colony: ColonyName.CALLISTO, before: 6, after: 6},
  ],
} as unknown as SelectColonyModel;

/** jsdom here exposes no Web Storage — a minimal session store for the latch (removed after the suite). */
class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  clear(): void {
    this.items.clear();
  }
}

describe('colonyTrackRaise — the raise a play already made, told before its pick', () => {
  const g = globalThis as unknown as {sessionStorage?: MemoryStorage};
  const hadStorage = g.sessionStorage !== undefined;
  before(() => {
    if (!hadStorage) {
      g.sessionStorage = new MemoryStorage();
    }
  });
  after(() => {
    if (!hadStorage) {
      delete g.sessionStorage;
    }
    finishColonyTrackWave('spec');
    releaseColonyTracks();
  });
  beforeEach(() => {
    g.sessionStorage?.clear();
    colonyTrackRaiseFlow.lastTold = '';
    clearColonyTrackRaise();
    finishColonyTrackWave('spec');
    releaseColonyTracks();
  });

  it('reads the raise off the prompt marker — never a diff, nothing for a plain colony pick', () => {
    const raise = colonyTrackRaiseOf(PROMPT, 'p1');
    expect(raise?.key).eq('p1#41');
    expect(raise?.moves.map((m) => m.colony)).deep.eq([ColonyName.LUNA, ColonyName.CALLISTO]);
    expect(colonyTrackRaiseOf({...PROMPT, trackRaise: undefined} as unknown as SelectColonyModel, 'p1')).is.undefined;
    expect(colonyTrackRaiseOf(undefined, 'p1')).is.undefined;
  });

  it('the seed holds every tile at BEFORE and locks the pick', () => {
    expect(seedColonyTrackRaise(colonyTrackRaiseOf(PROMPT, 'p1'))).is.true;
    expect(heldColonyTrackPosition(ColonyName.LUNA)).eq(1);
    // A track at its top is held where it stands — the wave charges it and settles back.
    expect(heldColonyTrackPosition(ColonyName.CALLISTO)).eq(6);
    expect(colonyTrackRaiseLive()).is.true;
    expect(isColonyTradeInputLocked()).is.true;
    // Seeding the same raise again is a no-op.
    expect(seedColonyTrackRaise(colonyTrackRaiseOf(PROMPT, 'p1'))).is.false;
  });

  it('the wave plays the marker\'s moves on the tiles, and the pick opens after it', async () => {
    seedColonyTrackRaise(colonyTrackRaiseOf(PROMPT, 'p1'));
    const played = playOwedColonyTrackRaise();
    await Promise.resolve();
    await Promise.resolve();
    expect(colonyTrackWaveState.active).is.true;
    expect(colonyTrackWaveState.anchors).eq('tile');
    expect(colonyTrackWaveState.rhythm).eq('wave');
    expect(colonyTrackWaveState.moves).deep.eq([
      {colony: ColonyName.LUNA, before: 1, after: 3},
      {colony: ColonyName.CALLISTO, before: 6, after: 6},
    ]);
    finishColonyTrackWave('landed');
    expect(await played).is.true;
    expect(colonyTrackRaiseLive()).is.false;
    expect(isColonyTradeInputLocked()).is.false;
    expect(heldColonyTrackPosition(ColonyName.LUNA)).is.undefined;
  });

  it('a raise is told ONCE per session — a reload mid-step seeds nothing', async () => {
    const raise = colonyTrackRaiseOf(PROMPT, 'p1');
    seedColonyTrackRaise(raise);
    const played = playOwedColonyTrackRaise();
    await Promise.resolve();
    await Promise.resolve();
    finishColonyTrackWave('landed');
    await played;
    expect(colonyTrackRaiseTold('p1#41')).is.true;
    // The module forgets (a reload) — the session does not.
    colonyTrackRaiseFlow.lastTold = '';
    expect(seedColonyTrackRaise(raise)).is.false;
    expect(heldColonyTrackPosition(ColonyName.LUNA)).is.undefined;
  });

  it('another wave on stage is waited for, never finished from here', async () => {
    // A trade's glide (or TR07) stands: its holds are not ours.
    colonyTrackWaveState.active = true;
    seedColonyTrackRaise(colonyTrackRaiseOf(PROMPT, 'p1'));
    const played = playOwedColonyTrackRaise();
    await new Promise((done) => setTimeout(done, 20));
    expect(colonyTrackWaveState.lastFinish).not.eq('re-request');
    expect(colonyTrackWaveState.moves).deep.eq([]);
    colonyTrackWaveState.active = false;
    await new Promise((done) => setTimeout(done, 150));
    expect(colonyTrackWaveState.active).is.true;
    expect(colonyTrackWaveState.moves.map((m) => m.colony)).deep.eq([ColonyName.LUNA, ColonyName.CALLISTO]);
    finishColonyTrackWave('landed');
    expect(await played).is.true;
  });

  it('clear releases the holds of an owed raise (the prompt went away)', () => {
    seedColonyTrackRaise(colonyTrackRaiseOf(PROMPT, 'p1'));
    clearColonyTrackRaise();
    expect(colonyTrackRaiseLive()).is.false;
    expect(heldColonyTrackPosition(ColonyName.LUNA)).is.undefined;
  });
});
