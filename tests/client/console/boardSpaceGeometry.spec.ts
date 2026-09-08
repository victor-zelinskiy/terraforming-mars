/*
 * BOARD-SPACE GEOMETRY (src/client/console/boardSpaceGeometry.ts) — the
 * coordinate-space version behind the live-anchor flight contract
 * (presentation-reconciliation, mechanism D).
 */
import {expect} from 'chai';
import {
  boardGeometryStable, boardSpaceEpoch, bumpBoardSpaceEpoch,
  registerBoardGeometryProbe, resetBoardSpaceGeometry, waitBoardGeometryStable,
} from '@/client/console/boardSpaceGeometry';

describe('boardSpaceGeometry', () => {
  afterEach(() => {
    resetBoardSpaceGeometry();
  });

  it('degrades to ALWAYS STABLE with no probe (desktop / tests / dead shell)', () => {
    expect(boardGeometryStable()).to.equal(true);
  });

  it('answers the registered probe; unregister restores the degrade', () => {
    let calm = false;
    const off = registerBoardGeometryProbe(() => calm);
    expect(boardGeometryStable()).to.equal(false);
    calm = true;
    expect(boardGeometryStable()).to.equal(true);
    off();
    calm = false;
    expect(boardGeometryStable()).to.equal(true);
  });

  it('the epoch versions every bump', () => {
    const before = boardSpaceEpoch();
    bumpBoardSpaceEpoch();
    bumpBoardSpaceEpoch();
    expect(boardSpaceEpoch()).to.equal(before + 2);
  });

  it('waitBoardGeometryStable resolves on the stability edge', async () => {
    let calm = false;
    registerBoardGeometryProbe(() => calm);
    let resolved = false;
    const wait = waitBoardGeometryStable({maxMs: 2000}).then(() => {
      resolved = true;
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(resolved).to.equal(false);
    calm = true;
    await wait;
    expect(resolved).to.equal(true);
  });

  it('waitBoardGeometryStable is BOUNDED and honours alive()', async () => {
    registerBoardGeometryProbe(() => false);
    // The cap: resolves without stability.
    await waitBoardGeometryStable({maxMs: 80});
    // alive() false → resolves at once.
    const started = Date.now();
    await waitBoardGeometryStable({maxMs: 5000, alive: () => false});
    expect(Date.now() - started).to.be.lessThan(1000);
  });
});
