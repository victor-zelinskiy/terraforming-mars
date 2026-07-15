import {expect} from 'chai';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType} from '@/common/TileType';
import {
  armTilePlacement,
  detectTilePlacement,
  runTilePlacement,
  endTilePlacement,
  abortTilePlacement,
  isTilePlacementActive,
  tilePlacementHolding,
  tilePlacementState,
  seedTilePlacementRewardHold,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {panelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';

function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('consoleTilePlacement (the animation transaction)', () => {
  afterEach(async () => {
    abortTilePlacement();
    await settle(5); // the abort lowers 'failed' → 'idle' on nextTick
  });

  it('arm is invisible: active, phase=armed, but NOT yet holding surfaces', () => {
    armTilePlacement({spaceId: '05'});
    expect(isTilePlacementActive()).to.be.true;
    expect(tilePlacementState.phase).to.eq('armed');
    expect(tilePlacementHolding()).to.be.false;
  });

  it('detect consumes the arm ONCE and requires the server-proven tile', () => {
    armTilePlacement({spaceId: '05'});
    const prev = [space('05', {bonus: [SpaceBonus.STEEL, SpaceBonus.STEEL]})];
    const next = [space('05', {bonus: [SpaceBonus.STEEL, SpaceBonus.STEEL], tileType: TileType.CITY, color: 'red'})];
    const hit = detectTilePlacement(prev, next);
    expect(hit).to.deep.eq({spaceId: '05'});
    expect(tilePlacementState.tileType).to.eq(TileType.CITY);
    // One-shot per response — a re-detect never double-runs the scene.
    expect(detectTilePlacement(prev, next)).to.be.undefined;
  });

  it('a placement the server refused aborts with zero visual state', async () => {
    armTilePlacement({spaceId: '05'});
    const prev = [space('05')];
    const hit = detectTilePlacement(prev, [space('05')]); // no tile arrived
    expect(hit).to.be.undefined;
    expect(isTilePlacementActive()).to.be.false;
    expect(tilePlacementState.phase).to.eq('failed'); // one flush for watchers
    await settle(5);
    expect(tilePlacementState.phase).to.eq('idle');
  });

  it('a HAZARD materializing is NOT ours — its own entrance owns it', async () => {
    armTilePlacement({spaceId: '05'});
    const hit = detectTilePlacement(
      [space('05')],
      [space('05', {tileType: TileType.EROSION_MILD})]);
    expect(hit).to.be.undefined;
    expect(isTilePlacementActive()).to.be.false;
    await settle(5);
  });

  it('the full happy path: flight gate → silent under-proxy paint → held bonuses → reward beat → idle', async () => {
    armTilePlacement({spaceId: '05'});
    const prev = [space('05', {bonus: [SpaceBonus.STEEL, SpaceBonus.PLANT]}), space('06')];
    const next = [
      space('05', {bonus: [SpaceBonus.STEEL, SpaceBonus.PLANT], tileType: TileType.GREENERY, color: 'green'}),
      space('06'),
    ];
    expect(detectTilePlacement(prev, next)).to.not.be.undefined;

    // PRE-COMMIT half: no measurable board under JSDOM → the graceful
    // no-flight path; the promise resolves (the commit gate NEVER hangs)
    // and the REAL tile is already painted on the displayed spaces.
    await runTilePlacement(prev, next);
    expect(prev[0].tileType).to.eq(TileType.GREENERY);
    expect(prev[0].color).to.eq('green');
    expect(tilePlacementState.phase).to.eq('landed');
    expect(tilePlacementHolding()).to.be.true; // follow-up surfaces stay held
    // NOTHING is held until the commit path seeds it: the panel renders
    // `committed − held`, so a hold living through the flight would dip the
    // PRE-commit value and fire a phantom −N chip.
    expect(panelRewardHold.active).to.be.false;
    // The commit path seeds it in the SAME synchronous block as the commit —
    // the commit then will NOT fire the printed bonuses' delta chips.
    seedTilePlacementRewardHold();
    expect(panelRewardHold.active).to.be.true;
    expect(heldStock('steel')).to.eq(1);
    expect(heldStock('plants')).to.eq(1);
    seedTilePlacementRewardHold(); // idempotent — never a double hold
    expect(heldStock('steel')).to.eq(1);

    // POST-COMMIT reward beat: transfers degrade under JSDOM (no panel
    // anchors) and release immediately — nothing held, clean idle.
    await endTilePlacement();
    expect(panelRewardHold.active).to.be.false;
    expect(heldStock('steel')).to.eq(0);
    expect(isTilePlacementActive()).to.be.false;
    await settle(5);
    expect(tilePlacementState.phase).to.eq('idle');
  });

  it('a bonus-less cell seeds NO hold and finishes without a reward beat', async () => {
    armTilePlacement({spaceId: '07'});
    const prev = [space('07')];
    const next = [space('07', {tileType: TileType.OCEAN})];
    expect(detectTilePlacement(prev, next)).to.not.be.undefined;
    await runTilePlacement(prev, next);
    seedTilePlacementRewardHold(); // a bare cell → nothing to hold
    expect(panelRewardHold.active).to.be.false;
    const before = Date.now();
    await endTilePlacement();
    // Not one artificial pause: the end is effectively instant.
    expect(Date.now() - before).to.be.lessThan(120);
    expect(isTilePlacementActive()).to.be.false;
  });

  it('non-stock printed bonuses (card / ocean) are never held nor transferred', async () => {
    armTilePlacement({spaceId: '08'});
    const prev = [space('08', {bonus: [SpaceBonus.DRAW_CARD, SpaceBonus.OCEAN]})];
    const next = [space('08', {bonus: [SpaceBonus.DRAW_CARD, SpaceBonus.OCEAN], tileType: TileType.CITY})];
    expect(detectTilePlacement(prev, next)).to.not.be.undefined;
    await runTilePlacement(prev, next);
    seedTilePlacementRewardHold(); // card / ocean bonuses are not ours
    expect(panelRewardHold.active).to.be.false;
    await endTilePlacement();
    expect(isTilePlacementActive()).to.be.false;
  });

  it('abort mid-run frees the commit gate and drops the seeded hold', async () => {
    armTilePlacement({spaceId: '05'});
    const prev = [space('05', {bonus: [SpaceBonus.TITANIUM]})];
    const next = [space('05', {bonus: [SpaceBonus.TITANIUM], tileType: TileType.CITY})];
    expect(detectTilePlacement(prev, next)).to.not.be.undefined;
    const gate = runTilePlacement(prev, next);
    seedTilePlacementRewardHold();
    abortTilePlacement();
    await gate; // resolves — WaitingFor can always commit
    expect(isTilePlacementActive()).to.be.false;
    expect(panelRewardHold.active).to.be.false;
    await settle(5);
    expect(tilePlacementState.phase).to.eq('idle');
  });

  it('endTilePlacement after an abort is a clean no-op', async () => {
    armTilePlacement({spaceId: '05'});
    abortTilePlacement();
    await endTilePlacement();
    await settle(5);
    expect(tilePlacementState.phase).to.eq('idle');
  });

  it('sequential placements stay separate transactions (fresh arm re-keys)', async () => {
    armTilePlacement({spaceId: '05'});
    const firstNonce = tilePlacementState.nonce;
    let prev = [space('05')];
    let next = [space('05', {tileType: TileType.CITY})];
    expect(detectTilePlacement(prev, next)).to.not.be.undefined;
    await runTilePlacement(prev, next);
    await endTilePlacement();

    armTilePlacement({spaceId: '06'});
    expect(tilePlacementState.nonce).to.eq(firstNonce + 1);
    prev = [space('06', {bonus: [SpaceBonus.HEAT]})];
    next = [space('06', {bonus: [SpaceBonus.HEAT], tileType: TileType.GREENERY})];
    // The fresh arm is detectable again (the one-shot claim was reset) and
    // carries ITS OWN cell's bonuses — never the previous tile's.
    expect(detectTilePlacement(prev, next)).to.deep.eq({spaceId: '06'});
    await runTilePlacement(prev, next);
    seedTilePlacementRewardHold();
    expect(heldStock('heat')).to.eq(1);
    expect(heldStock('steel')).to.eq(0);
    await endTilePlacement();
    expect(isTilePlacementActive()).to.be.false;
  });
});
