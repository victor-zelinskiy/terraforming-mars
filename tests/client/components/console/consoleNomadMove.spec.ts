import {expect} from 'chai';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType} from '@/common/TileType';
import {
  abortNomadMove,
  abortRemoteNomadMoves,
  armNomadMove,
  detectNomadMove,
  endNomadMove,
  isNomadMoveActive,
  isRemoteNomadMoveActive,
  nomadCellHidden,
  nomadGhostAt,
  nomadMoveHolding,
  nomadMoveState,
  runNomadMove,
  seedNomadMoveRewardHold,
  stageRemoteNomadMove,
} from '@/client/console/nomads/consoleNomadMove';
import {panelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {observeMarkerPlacement} from '@/client/components/board/markerPlacementAnimation';
import {OceanAdjacencyBonusModel} from '@/common/models/OceanAdjacencyBonusModel';

function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('consoleNomadMove (the animation transaction)', () => {
  afterEach(async () => {
    abortNomadMove();
    abortRemoteNomadMoves();
    await settle(5); // the abort lowers 'failed' → 'idle' on nextTick
  });

  it('arm is invisible: active, phase=armed, but NOT yet holding surfaces', () => {
    armNomadMove({toSpaceId: '06'});
    expect(isNomadMoveActive()).to.be.true;
    expect(nomadMoveState.phase).to.eq('armed');
    expect(nomadMoveHolding()).to.be.false;
  });

  it('detect consumes the arm ONCE and requires the server-proven from→to pair', () => {
    armNomadMove({toSpaceId: '06'});
    const prev = [space('05', {nomads: true}), space('06', {bonus: [SpaceBonus.STEEL]})];
    const next = [space('05'), space('06', {bonus: [SpaceBonus.STEEL], nomads: true})];
    const hit = detectNomadMove(prev, next);
    expect(hit).to.deep.eq({fromId: '05', toId: '06'});
    expect(nomadMoveState.fromId).to.eq('05');
    // One-shot per response — a re-detect never double-runs the scene.
    expect(detectNomadMove(prev, next)).to.be.undefined;
  });

  it('a FIRST placement is NEVER this scene\'s: a bare appearance aborts the arm with zero trace', async () => {
    // Flow A / Flow B are told apart by the server's own diff — a response
    // that merely SEATS the camp (no departure cell) must not fly, must not
    // collect, must not seed a single held metric.
    armNomadMove({toSpaceId: '06'});
    const prev = [space('05'), space('06', {bonus: [SpaceBonus.PLANT]})];
    const next = [space('05'), space('06', {bonus: [SpaceBonus.PLANT], nomads: true})];
    expect(detectNomadMove(prev, next)).to.be.undefined;
    expect(isNomadMoveActive()).to.be.false;
    seedNomadMoveRewardHold();
    expect(panelRewardHold.active).to.be.false;
    await settle(5);
    expect(nomadMoveState.phase).to.eq('idle');
  });

  it('a move the server refused aborts with zero visual state', async () => {
    armNomadMove({toSpaceId: '06'});
    const prev = [space('05', {nomads: true}), space('06')];
    expect(detectNomadMove(prev, prev)).to.be.undefined; // nothing moved
    expect(isNomadMoveActive()).to.be.false;
    await settle(5);
    expect(nomadMoveState.phase).to.eq('idle');
  });

  it('the full happy path: hop gate → silent flip under the proxy → held bonuses → reward beat → idle', async () => {
    armNomadMove({toSpaceId: '06'});
    const prev = [
      space('05', {nomads: true}),
      space('06', {bonus: [SpaceBonus.STEEL, SpaceBonus.PLANT]}),
    ];
    const next = [
      space('05'),
      space('06', {bonus: [SpaceBonus.STEEL, SpaceBonus.PLANT], nomads: true}),
    ];
    expect(detectNomadMove(prev, next)).to.not.be.undefined;

    // PRE-COMMIT half: no measurable board under JSDOM → the graceful
    // no-flight path; the promise resolves (the commit gate NEVER hangs)
    // and the displayed view already shows the camp on its new cell.
    await runNomadMove(prev, next);
    expect(prev[0].nomads).to.be.undefined;
    expect(prev[1].nomads).to.be.true;
    expect(nomadMoveState.phase).to.eq('landed');
    expect(nomadMoveHolding()).to.be.true; // follow-up surfaces stay held
    // The flip was pre-adopted in the marker baseline: the framework sees a
    // silent adoption, never a fresh landing to animate.
    expect(observeMarkerPlacement(next[1], 'nomads')).to.be.null;

    // NOTHING is held until the commit path seeds it (the phantom-chip rule).
    expect(panelRewardHold.active).to.be.false;
    seedNomadMoveRewardHold();
    expect(panelRewardHold.active).to.be.true;
    expect(heldStock('steel')).to.eq(1);
    expect(heldStock('plants')).to.eq(1);
    seedNomadMoveRewardHold(); // idempotent — never a double hold
    expect(heldStock('steel')).to.eq(1);

    // POST-COMMIT reward + restore beats: transfers degrade under JSDOM (no
    // panel anchors) and release; the restore has no live container → 0ms.
    await endNomadMove();
    expect(panelRewardHold.active).to.be.false;
    expect(heldStock('steel')).to.eq(0);
    expect(isNomadMoveActive()).to.be.false;
    await settle(5);
    expect(nomadMoveState.phase).to.eq('idle');
  });

  it('a bonus-less destination seeds NO hold and ends without a reward beat', async () => {
    armNomadMove({toSpaceId: '06'});
    const prev = [space('05', {nomads: true}), space('06')];
    const next = [space('05'), space('06', {nomads: true})];
    expect(detectNomadMove(prev, next)).to.not.be.undefined;
    await runNomadMove(prev, next);
    seedNomadMoveRewardHold();
    expect(panelRewardHold.active).to.be.false;
    const before = Date.now();
    await endNomadMove();
    expect(Date.now() - before).to.be.lessThan(120);
    expect(isNomadMoveActive()).to.be.false;
  });

  it('a HAZARD destination flies the camp but collects NOTHING (the published ruling)', async () => {
    armNomadMove({toSpaceId: '06'});
    const prev = [
      space('05', {nomads: true}),
      space('06', {bonus: [SpaceBonus.STEEL], tileType: TileType.EROSION_MILD}),
    ];
    const next = [
      space('05'),
      space('06', {bonus: [SpaceBonus.STEEL], tileType: TileType.EROSION_MILD, nomads: true}),
    ];
    expect(detectNomadMove(prev, next)).to.not.be.undefined;
    await runNomadMove(prev, next);
    seedNomadMoveRewardHold();
    expect(panelRewardHold.active).to.be.false; // the bonus is honestly absent
    await endNomadMove();
    expect(isNomadMoveActive()).to.be.false;
  });

  describe('the OCEAN ADJACENCY payout (the same water pays a camp as pays a build)', () => {
    const prev = [space('05', {nomads: true}), space('06')];
    const next = [space('05'), space('06', {nomads: true})];
    const oceanBonus: OceanAdjacencyBonusModel = {
      spaceId: '06', oceanSpaceIds: ['07', '08'], perOcean: 2, megacredits: 4,
    };

    it('holds the M€ the server granted for moving next to water, then releases it', async () => {
      armNomadMove({toSpaceId: '06'});
      expect(detectNomadMove(prev, next, {oceanBonus})).to.not.be.undefined;
      await runNomadMove(prev, next);
      seedNomadMoveRewardHold();
      // The whole payout is ONE aggregated hold entry — the counter announces
      // «+4 M€» once, when the last coin has physically landed.
      expect(panelRewardHold.active).to.be.true;
      expect(heldStock('megacredits')).to.eq(4);
      await endNomadMove();
      expect(heldStock('megacredits')).to.eq(0);
      expect(panelRewardHold.active).to.be.false;
      expect(isNomadMoveActive()).to.be.false;
    });

    it('composes with the destination\'s own printed M€ (the hold map is additive)', async () => {
      const cellPrev = [space('05', {nomads: true}), space('06', {bonus: [SpaceBonus.MEGACREDITS]})];
      const cellNext = [space('05'), space('06', {bonus: [SpaceBonus.MEGACREDITS], nomads: true})];
      armNomadMove({toSpaceId: '06'});
      detectNomadMove(cellPrev, cellNext, {oceanBonus});
      await runNomadMove(cellPrev, cellNext);
      seedNomadMoveRewardHold();
      expect(heldStock('megacredits')).to.eq(5); // 1 printed + 4 from the water
      await endNomadMove();
      expect(heldStock('megacredits')).to.eq(0);
    });

    it('IGNORES a manifest that names a different space (never mis-attributes a payout)', async () => {
      armNomadMove({toSpaceId: '06'});
      detectNomadMove(prev, next, {oceanBonus: {...oceanBonus, spaceId: '19'}});
      await runNomadMove(prev, next);
      seedNomadMoveRewardHold();
      expect(panelRewardHold.active).to.be.false;
      await endNomadMove();
    });

    it('a hop that pays nothing at all still ends immediately', async () => {
      armNomadMove({toSpaceId: '06'});
      detectNomadMove(prev, next); // no printed bonus, no ocean manifest
      await runNomadMove(prev, next);
      seedNomadMoveRewardHold();
      expect(panelRewardHold.active).to.be.false;
      const before = Date.now();
      await endNomadMove();
      expect(Date.now() - before).to.be.lessThan(120);
    });
  });

  it('abort mid-transaction frees the gate and releases every held metric', async () => {
    armNomadMove({toSpaceId: '06'});
    const prev = [space('05', {nomads: true}), space('06', {bonus: [SpaceBonus.STEEL]})];
    const next = [space('05'), space('06', {bonus: [SpaceBonus.STEEL], nomads: true})];
    detectNomadMove(prev, next);
    await runNomadMove(prev, next);
    seedNomadMoveRewardHold();
    expect(panelRewardHold.active).to.be.true;
    abortNomadMove();
    expect(panelRewardHold.active).to.be.false;
    expect(isNomadMoveActive()).to.be.false;
    expect(nomadMoveHolding()).to.be.false;
    await settle(5);
    expect(nomadMoveState.phase).to.eq('idle');
  });

  describe('the REMOTE leg (another player\'s move / an undo walking back)', () => {
    it('stages a from→to pair: source keeps a ghost, destination commits hidden', async () => {
      const prev = [space('11', {nomads: true}), space('12')];
      const next = [space('11'), space('12', {nomads: true})];
      stageRemoteNomadMove(prev, next);
      // Synchronously after staging: object permanence on the source, a
      // reveal-hold on the destination — the commit may proceed at once.
      expect(nomadGhostAt('11')).to.be.true;
      expect(nomadCellHidden('12')).to.be.true;
      expect(isRemoteNomadMoveActive()).to.be.true;
      // Under JSDOM the hop degrades (no measurable hexes) and the truth
      // reveals — nothing may stay hidden.
      await settle(60);
      expect(nomadGhostAt('11')).to.be.false;
      expect(nomadCellHidden('12')).to.be.false;
    });

    it('a first placement stages NOTHING here (the marker landing owns it)', () => {
      stageRemoteNomadMove([space('11'), space('12')], [space('11'), space('12', {nomads: true})]);
      expect(nomadCellHidden('12')).to.be.false;
      expect(isRemoteNomadMoveActive()).to.be.false;
    });

    it('a double report of the same move stages once', () => {
      const prev = [space('11', {nomads: true}), space('12')];
      const next = [space('11'), space('12', {nomads: true})];
      stageRemoteNomadMove(prev, next);
      stageRemoteNomadMove(prev, next);
      expect(nomadCellHidden('12')).to.be.true;
      abortRemoteNomadMoves();
    });

    it('the viewer\'s own armed move is never double-staged as remote', () => {
      armNomadMove({toSpaceId: '12'});
      const prev = [space('11', {nomads: true}), space('12')];
      const next = [space('11'), space('12', {nomads: true})];
      stageRemoteNomadMove(prev, next);
      expect(nomadCellHidden('12')).to.be.false;
      expect(isRemoteNomadMoveActive()).to.be.false;
    });

    it('abort reveals every held cell at once (nothing may stay hidden)', () => {
      const prev = [space('11', {nomads: true}), space('12')];
      const next = [space('11'), space('12', {nomads: true})];
      stageRemoteNomadMove(prev, next);
      abortRemoteNomadMoves();
      expect(nomadGhostAt('11')).to.be.false;
      expect(nomadCellHidden('12')).to.be.false;
      expect(isRemoteNomadMoveActive()).to.be.false;
    });
  });
});
