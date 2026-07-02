/*
 * Phase-3 guards for the identity-preserving snapshot application
 * (viewSnapshotShare.ts — REMOUNT_ANIMATION_REWORK_DESIGN.md).
 *
 * Contract: `shareViewSnapshot(prev, next)` returns a tree CONTENT-IDENTICAL
 * to `next`, in which every branch deep-equal to the matching `prev` branch
 * is the `prev` REFERENCE (so downstream props stay shallow-equal and child
 * components skip re-rendering). It never mutates either argument.
 */
import {expect} from 'chai';
import {FakeLocalStorage} from './FakeLocalStorage';
import {
  __resetViewPatchForTesting,
  nextViewSnapshot,
  shareViewSnapshot,
  viewPatchEnabled,
} from '@/client/utils/viewSnapshotShare';
import {__resetLegacyRemountForTesting} from '@/client/utils/legacyRemount';

function fakeView() {
  return {
    id: 'p123',
    runId: 'r1',
    game: {
      gameAge: 10,
      undoCount: 0,
      temperature: -24,
      spaces: [
        {id: '01', x: 0, y: 0, bonus: [1, 2]},
        {id: '02', x: 1, y: 0, bonus: []},
        {id: '03', x: 2, y: 0, bonus: [3]},
      ],
    },
    players: [
      {color: 'blue', megacredits: 20, tableau: [{name: 'Ants', resources: 2}]},
      {color: 'red', megacredits: 15, tableau: []},
    ],
    thisPlayer: {color: 'blue', megacredits: 20},
    waitingFor: {type: 'or', title: 'Take your first action', options: []},
  };
}

describe('viewSnapshotShare', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    __resetViewPatchForTesting();
    __resetLegacyRemountForTesting();
  });

  afterEach(() => {
    __resetViewPatchForTesting();
    __resetLegacyRemountForTesting();
    FakeLocalStorage.deregister(localStorage);
  });

  it('an identical snapshot shares the WHOLE tree (prev reference returned)', () => {
    const prev = fakeView();
    const next = fakeView();
    expect(shareViewSnapshot(prev, next)).to.eq(prev);
  });

  it('a leaf change replaces only the branches on its path — siblings stay shared', () => {
    const prev = fakeView();
    const next = fakeView();
    next.game.spaces[1] = {...next.game.spaces[1], tileType: 0} as any;

    const out = shareViewSnapshot(prev, next) as ReturnType<typeof fakeView>;
    expect(out).to.not.eq(prev);                       // root changed
    expect(out.game).to.not.eq(prev.game);             // path to the change
    expect(out.game.spaces).to.not.eq(prev.game.spaces);
    // The changed space is new content…
    expect((out.game.spaces[1] as any).tileType).to.eq(0);
    expect(out.game.spaces[1]).to.not.eq(prev.game.spaces[1]);
    // …its SIBLINGS keep their previous references (render-skip contract).
    expect(out.game.spaces[0]).to.eq(prev.game.spaces[0]);
    expect(out.game.spaces[2]).to.eq(prev.game.spaces[2]);
    // Untouched subtrees off the path are shared wholesale.
    expect(out.players).to.eq(prev.players);
    expect(out.thisPlayer).to.eq(prev.thisPlayer);
    expect(out.waitingFor).to.eq(prev.waitingFor);
  });

  it('the result is content-identical to next (never resurrects prev data)', () => {
    const prev = fakeView();
    const next = fakeView();
    next.players[0].megacredits = 32;
    (next.players[0].tableau[0] as any).resources = 5;

    const out = shareViewSnapshot(prev, next) as ReturnType<typeof fakeView>;
    expect(JSON.stringify(out)).to.eq(JSON.stringify(next));
    expect(out.players[1]).to.eq(prev.players[1]); // untouched player shared
  });

  it('a transient optional field CLEARING un-shares its owner object', () => {
    const prev = fakeView() as any;
    prev.lastReveal = {cardName: 'Ants'};
    const next = fakeView(); // no lastReveal

    const out = shareViewSnapshot(prev, next) as any;
    expect(out).to.not.eq(prev);
    expect('lastReveal' in out).to.be.false;
    expect(out.game).to.eq(prev.game); // subtrees still share
  });

  it('an array length change keeps the matching prefix shared', () => {
    const prev = fakeView();
    const next = fakeView();
    next.players[0].tableau.push({name: 'Birds', resources: 0} as any);

    const out = shareViewSnapshot(prev, next) as ReturnType<typeof fakeView>;
    expect(out.players[0].tableau).to.not.eq(prev.players[0].tableau);
    expect(out.players[0].tableau[0]).to.eq(prev.players[0].tableau[0]);
    expect(out.players[1]).to.eq(prev.players[1]);
  });

  it('does not mutate prev or next', () => {
    const prev = fakeView();
    const next = fakeView();
    next.game.temperature = -22;
    const prevJson = JSON.stringify(prev);
    const nextJson = JSON.stringify(next);
    shareViewSnapshot(prev, next);
    expect(JSON.stringify(prev)).to.eq(prevJson);
    expect(JSON.stringify(next)).to.eq(nextJson);
  });

  it('nextViewSnapshot: shares for the same participant, replaces otherwise', () => {
    const prev = fakeView();
    const same = fakeView();
    expect(nextViewSnapshot(prev as any, same as any)).to.eq(prev);

    const other = {...fakeView(), id: 'p999'};
    expect(nextViewSnapshot(prev as any, other as any)).to.eq(other);
    expect(nextViewSnapshot(undefined, same as any)).to.eq(same);
  });

  it('nextViewSnapshot honours the tm_patch kill-switch', () => {
    localStorage.setItem('tm_patch', '0');
    __resetViewPatchForTesting();
    expect(viewPatchEnabled()).to.be.false;
    const prev = fakeView();
    const same = fakeView();
    expect(nextViewSnapshot(prev as any, same as any)).to.eq(same);
  });

  it('nextViewSnapshot is inert under the legacy tm_remount flag', () => {
    localStorage.setItem('tm_remount', '1');
    __resetLegacyRemountForTesting();
    const prev = fakeView();
    const same = fakeView();
    expect(nextViewSnapshot(prev as any, same as any)).to.eq(same);
  });
});
