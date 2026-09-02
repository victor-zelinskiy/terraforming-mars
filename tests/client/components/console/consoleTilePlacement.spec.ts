import {expect} from 'chai';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {OceanAdjacencyBonusModel} from '@/common/models/OceanAdjacencyBonusModel';
import {TileType} from '@/common/TileType';
import {
  armTilePlacement,
  detectTilePlacement,
  runTilePlacement,
  endTilePlacement,
  abortTilePlacement,
  isTilePlacementActive,
  tilePlacementHolding,
  tilePlacementRewardsSettling,
  tilePlacementState,
  seedTilePlacementRewardHold,
  tileRewardTransferPace,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {panelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {TRANSFER_CONCURRENT_PACE} from '@/client/console/resourceTransfer/resourceTransferModel';
import {armBoardCardBonus, resetBoardCardBonus} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {AresAdjacencyGrantModel} from '@/common/models/AresAdjacencyGrantModel';
import {Resource} from '@/common/Resource';
import {resetAresGrantClaims} from '@/client/console/tilePlacement/aresAdjacencyFlights';
import {placementRenderState} from '@/client/components/board/placementRenderState';
import {cubePhase} from '@/client/components/board/cubeDropState';

/**
 * A measurable board cell — JSDOM reports every rect as 0x0, so the scene's
 * geometry guards degrade unless the rects are stubbed. Returns a teardown.
 * The printed icons are mounted from the start: on the real board they appear
 * the frame the cell is blanked, and what this fixture exercises is that the
 * departure captures them AFTER opening that window, never before.
 */
function boardCell(id: string, opts: {bonusIcons?: number} = {}): () => void {
  const cell = document.createElement('div');
  cell.className = 'board-space';
  cell.setAttribute('data_space_id', id);
  cell.getBoundingClientRect = () => ({
    x: 400, y: 300, left: 400, top: 300, right: 446, bottom: 351, width: 46, height: 51, toJSON: () => ({}),
  } as DOMRect);
  const bonuses = document.createElement('div');
  bonuses.className = 'board-space-bonuses';
  for (let i = 0; i < (opts.bonusIcons ?? 0); i++) {
    const icon = document.createElement('i');
    icon.className = 'board-space-bonus';
    icon.getBoundingClientRect = () => ({
      x: 410 + i * 12, y: 320, left: 410 + i * 12, top: 320,
      right: 420 + i * 12, bottom: 330, width: 10, height: 10, toJSON: () => ({}),
    } as DOMRect);
    bonuses.appendChild(icon);
  }
  cell.appendChild(bonuses);
  document.body.appendChild(cell);
  return () => cell.remove();
}

function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('consoleTilePlacement (the animation transaction)', () => {
  afterEach(async () => {
    abortTilePlacement();
    resetAresGrantClaims(); // the consumption ledger is bundle-shared
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

  it('the Ares adjacency manifest seeds the VIEWER\'s own chips and releases at the beat', async () => {
    armTilePlacement({spaceId: '05'});
    const prev = [space('05'), space('08', {tileType: TileType.LAVA_FLOWS, color: 'blue'})];
    const next = [
      space('05', {tileType: TileType.GREENERY, color: 'red'}),
      space('08', {tileType: TileType.LAVA_FLOWS, color: 'blue'}),
    ];
    const grant: AresAdjacencyGrantModel = {
      seq: 501,
      spaceId: '05' as SpaceId,
      placerColor: 'red',
      grants: [
        {sourceSpaceId: '08' as SpaceId, bonus: SpaceBonus.HEAT, delivery: 'stock', resource: Resource.HEAT},
        {sourceSpaceId: '08' as SpaceId, bonus: SpaceBonus.HEAT, delivery: 'stock', resource: Resource.HEAT},
      ],
      ownerPayouts: [{sourceSpaceId: '08' as SpaceId, ownerColor: 'blue', megacredits: 1}],
    };
    expect(detectTilePlacement(prev, next, {aresGrants: [grant], viewerColor: 'red'}))
      .to.deep.eq({spaceId: '05'});
    await runTilePlacement(prev, next);
    seedTilePlacementRewardHold();
    // The placer's own units are held; the OTHER owner's M€ is not theirs to hold.
    expect(heldStock('heat')).to.eq(2);
    expect(heldStock('megacredits')).to.eq(0);
    // The beat degrades under JSDOM (no board anchors) and releases everything.
    await endTilePlacement();
    expect(panelRewardHold.active).to.be.false;
    expect(isTilePlacementActive()).to.be.false;
  });

  it('a grant is consumed ONCE — a second placement on the same cell flies nothing', async () => {
    const grant: AresAdjacencyGrantModel = {
      seq: 502,
      spaceId: '05' as SpaceId,
      placerColor: 'red',
      grants: [{sourceSpaceId: '08' as SpaceId, bonus: SpaceBonus.HEAT, delivery: 'stock', resource: Resource.HEAT}],
      ownerPayouts: [],
    };
    armTilePlacement({spaceId: '05'});
    const prev = [space('05')];
    const next = [space('05', {tileType: TileType.OCEAN})];
    expect(detectTilePlacement(prev, next, {aresGrants: [grant], viewerColor: 'red'})).to.not.be.undefined;
    await runTilePlacement(prev, next);
    seedTilePlacementRewardHold();
    expect(heldStock('heat')).to.eq(1);
    await endTilePlacement();
    await settle(5);

    // The SAME grant rides every later response — it must never re-fly.
    armTilePlacement({spaceId: '05'});
    const prev2 = [space('05', {tileType: TileType.OCEAN})];
    const next2 = [space('05', {tileType: TileType.OCEAN_CITY, color: 'red'})];
    expect(detectTilePlacement(prev2, next2, {aresGrants: [grant], viewerColor: 'red'})).to.not.be.undefined;
    await runTilePlacement(prev2, next2);
    seedTilePlacementRewardHold();
    expect(heldStock('heat')).to.eq(0);
    await endTilePlacement();
  });

  it('an OCEAN COVER lands with the water remembered and flies NO printed bonuses', async () => {
    armTilePlacement({spaceId: '09'});
    const prev = [space('09', {bonus: [SpaceBonus.PLANT, SpaceBonus.PLANT], tileType: TileType.OCEAN})];
    const next = [space('09', {bonus: [SpaceBonus.PLANT, SpaceBonus.PLANT], tileType: TileType.OCEAN_CITY, color: 'red'})];
    expect(detectTilePlacement(prev, next)).to.deep.eq({spaceId: '09'});
    expect(tilePlacementState.coveredTile).to.eq(TileType.OCEAN);
    await runTilePlacement(prev, next);
    // The real cover tile painted silently under the proxy.
    expect(prev[0].tileType).to.eq(TileType.OCEAN_CITY);
    // The server granted no printed bonuses (`coveringExistingTile`) — a
    // held plant here would be a lie about money.
    seedTilePlacementRewardHold();
    expect(panelRewardHold.active).to.be.false;
    await endTilePlacement();
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

  describe('ocean adjacency (the water pays, coin by coin)', () => {
    const oceanBonus = (spaceId: string, oceans: Array<string>, perOcean = 2): OceanAdjacencyBonusModel => ({
      spaceId: spaceId as SpaceId,
      oceanSpaceIds: oceans as Array<SpaceId>,
      perOcean,
      megacredits: oceans.length * perOcean,
    });

    it('holds the WHOLE payout as ONE M€ entry — the delta chip is aggregated', async () => {
      armTilePlacement({spaceId: '05'});
      const prev = [space('05')];
      const next = [space('05', {tileType: TileType.CITY, color: 'red'})];
      expect(detectTilePlacement(prev, next, {oceanBonus: oceanBonus('05', ['32', '33', '41'])})).to.not.be.undefined;
      await runTilePlacement(prev, next);
      seedTilePlacementRewardHold();
      // 3 oceans × 2 M€ — one hold, so ONE release → one «+6 M€» chip, never
      // three «+2 M€» ones. (The three COINS tell the per-ocean story.)
      expect(heldStock('megacredits')).to.eq(6);
      await endTilePlacement();
      expect(panelRewardHold.active).to.be.false;
      expect(heldStock('megacredits')).to.eq(0);
      expect(isTilePlacementActive()).to.be.false;
    });

    it('composes with a printed M€ bonus on the same cell', async () => {
      armTilePlacement({spaceId: '05'});
      const prev = [space('05', {bonus: [SpaceBonus.MEGACREDITS, SpaceBonus.PLANT]})];
      const next = [space('05', {bonus: [SpaceBonus.MEGACREDITS, SpaceBonus.PLANT], tileType: TileType.CITY})];
      expect(detectTilePlacement(prev, next, {oceanBonus: oceanBonus('05', ['32'])})).to.not.be.undefined;
      await runTilePlacement(prev, next);
      seedTilePlacementRewardHold();
      expect(heldStock('megacredits')).to.eq(3); // 1 printed + 1 ocean × 2
      expect(heldStock('plants')).to.eq(1);
      await endTilePlacement();
      expect(heldStock('megacredits')).to.eq(0);
    });

    it('honours a raised per-ocean rate (Lakefront Resorts)', async () => {
      armTilePlacement({spaceId: '05'});
      const prev = [space('05')];
      const next = [space('05', {tileType: TileType.GREENERY})];
      detectTilePlacement(prev, next, {oceanBonus: oceanBonus('05', ['32', '33'], 3)});
      await runTilePlacement(prev, next);
      seedTilePlacementRewardHold();
      expect(heldStock('megacredits')).to.eq(6);
      await endTilePlacement();
    });

    it('IGNORES a snapshot that names another space (stale / a second tile)', async () => {
      armTilePlacement({spaceId: '05'});
      const prev = [space('05')];
      const next = [space('05', {tileType: TileType.CITY})];
      // The armed space is '05'; the server's snapshot is about '09'.
      detectTilePlacement(prev, next, {oceanBonus: oceanBonus('09', ['32', '33'])});
      await runTilePlacement(prev, next);
      seedTilePlacementRewardHold();
      expect(panelRewardHold.active).to.be.false; // nothing mis-attributed
      await endTilePlacement();
      expect(isTilePlacementActive()).to.be.false;
    });

    it('no adjacent oceans → no beat, no hold, not one extra frame', async () => {
      armTilePlacement({spaceId: '05'});
      const prev = [space('05')];
      const next = [space('05', {tileType: TileType.CITY})];
      detectTilePlacement(prev, next, {oceanBonus: undefined});
      await runTilePlacement(prev, next);
      seedTilePlacementRewardHold();
      expect(panelRewardHold.active).to.be.false;
      const before = Date.now();
      await endTilePlacement();
      expect(Date.now() - before).to.be.lessThan(120);
    });

    it('an abort between the commit and the beat drops the ocean hold too', async () => {
      armTilePlacement({spaceId: '05'});
      const prev = [space('05')];
      const next = [space('05', {tileType: TileType.CITY})];
      detectTilePlacement(prev, next, {oceanBonus: oceanBonus('05', ['32'])});
      await runTilePlacement(prev, next);
      seedTilePlacementRewardHold();
      expect(heldStock('megacredits')).to.eq(2);
      abortTilePlacement();
      expect(panelRewardHold.active).to.be.false;
      await endTilePlacement(); // clean no-op
      expect(isTilePlacementActive()).to.be.false;
    });
  });

  /*
   * REMOVE-AND-REPLACE (Kaguya Tech: "remove one of your greeneries and place
   * a city there"). The scene opens with a REMOVAL: the doomed tile's proxy
   * takes it over, the cell is blanked to a bare hex - which is the frame its
   * printed bonus first exists - the tile rises away, and only then does the
   * ordinary flight bring the replacement in.
   */
  describe('the removal beat (a declared remove-and-replace)', () => {
    let teardown: (() => void) | undefined;

    afterEach(() => {
      teardown?.();
      teardown = undefined;
    });

    const greeneryToCity = (bonus: Array<SpaceBonus> = []) => ({
      prev: [space('05', {bonus, tileType: TileType.GREENERY, color: 'red'})],
      next: [space('05', {bonus, tileType: TileType.CITY, color: 'red'})],
    });

    it('an arm that declares the removal STAGES what leaves', () => {
      teardown = boardCell('05');
      armTilePlacement({spaceId: '05', replacing: true});
      const {prev, next} = greeneryToCity();
      expect(detectTilePlacement(prev, next)).to.deep.eq({spaceId: '05'});
      expect(tilePlacementState.tileType).to.eq(TileType.CITY);
      expect(tilePlacementState.departingTile).to.eq(TileType.GREENERY);
      // ...including the owner marker, which leaves ON the tile it was marking.
      expect(tilePlacementState.departingCube?.color).to.eq('red');
    });

    it('an UNDECLARED tile-to-tile diff still aborts - the marker is the licence', async () => {
      teardown = boardCell('05');
      armTilePlacement({spaceId: '05'});
      const {prev, next} = greeneryToCity();
      expect(detectTilePlacement(prev, next)).to.be.undefined;
      expect(isTilePlacementActive()).to.be.false;
      expect(placementRenderState.hiddenTiles.size).to.eq(0);
      await settle(5);
    });

    it('the printed bonuses are captured AFTER the removal uncovers them, and paid as usual', async () => {
      teardown = boardCell('05', {bonusIcons: 2});
      armTilePlacement({spaceId: '05', replacing: true});
      const {prev, next} = greeneryToCity([SpaceBonus.STEEL, SpaceBonus.PLANT]);
      detectTilePlacement(prev, next);
      // At detect the doomed tile is still standing on them - nothing to
      // capture yet (an ordinary landing captures here; this one cannot).
      expect(tilePlacementState.bonusProxies).to.have.length(0);

      await runTilePlacement(prev, next);
      // ...the departure opened the window, and the icons were measured in it.
      expect(tilePlacementState.bonusProxies.map((b) => b.icon)).to.deep.eq(['steel', 'plant']);
      // The cell was EMPTIED before the placement, so the bonuses are granted
      // exactly as for a bare hex - never suppressed like an ocean cover.
      seedTilePlacementRewardHold();
      expect(heldStock('steel')).to.eq(1);
      expect(heldStock('plants')).to.eq(1);
      await endTilePlacement();
      expect(isTilePlacementActive()).to.be.false;
    });

    it('the removal window is CLOSED again by the time the replacement paints', async () => {
      teardown = boardCell('05', {bonusIcons: 1});
      armTilePlacement({spaceId: '05', replacing: true});
      const {prev, next} = greeneryToCity([SpaceBonus.STEEL]);
      detectTilePlacement(prev, next);
      await runTilePlacement(prev, next);
      // The real tile is painted on the displayed spaces...
      expect(prev[0].tileType).to.eq(TileType.CITY);
      // ...so the cell may no longer render as emptied, or the city it has
      // just received would be blanked along with the greenery that left.
      expect(placementRenderState.hiddenTiles.size).to.eq(0);
      await endTilePlacement();
    });

    it('an abort mid-removal puts the doomed tile back - the server may have refused', async () => {
      teardown = boardCell('05', {bonusIcons: 1});
      armTilePlacement({spaceId: '05', replacing: true});
      const {prev, next} = greeneryToCity([SpaceBonus.STEEL]);
      detectTilePlacement(prev, next);
      abortTilePlacement();
      expect(placementRenderState.hiddenTiles.size).to.eq(0);
      // ...and the owner marker can never be stranded invisible.
      expect(cubePhase('05' as SpaceId)).to.not.eq('hidden');
      await settle(5);
    });

    it('the staging does not leak into the NEXT, ordinary placement', async () => {
      teardown = boardCell('05');
      armTilePlacement({spaceId: '05', replacing: true});
      const {prev, next} = greeneryToCity();
      detectTilePlacement(prev, next);
      await runTilePlacement(prev, next);
      await endTilePlacement();
      await settle(5);

      armTilePlacement({spaceId: '06'});
      const p2 = [space('06')];
      const n2 = [space('06', {tileType: TileType.CITY, color: 'red'})];
      expect(detectTilePlacement(p2, n2)).to.deep.eq({spaceId: '06'});
      expect(tilePlacementState.departingTile).to.be.undefined;
      expect(tilePlacementState.departingCube).to.be.undefined;
      await runTilePlacement(p2, n2);
      await endTilePlacement();
    });
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

/**
 * The CONCURRENT-PAYOUT contract with the board card-bonus scene: one
 * placement that pays a card AND resources runs both animations in parallel
 * — the chips slightly quicker, the card calmer — and the card's covering
 * surfaces wait for the payout. These are the tile scene's two halves of it.
 */
describe('consoleTilePlacement × board card-bonus (concurrent payout)', () => {
  afterEach(async () => {
    resetBoardCardBonus();
    abortTilePlacement();
    resetAresGrantClaims();
    await settle(5);
  });

  it('the wave tempo quickens ONLY while the card cover is also in flight', () => {
    expect(tileRewardTransferPace()).to.eq(1);
    armBoardCardBonus({kind: 'board-cell', spaceId: '05'});
    expect(tileRewardTransferPace()).to.eq(TRANSFER_CONCURRENT_PACE);
    resetBoardCardBonus();
    expect(tileRewardTransferPace()).to.eq(1);
  });

  it('rewards settle from detect (owed) through the beat, and a card-only cell never settles', async () => {
    expect(tilePlacementRewardsSettling()).to.be.false;
    armTilePlacement({spaceId: '05'});
    expect(tilePlacementRewardsSettling()).to.be.false; // nothing owed yet
    const prev = [space('05', {bonus: [SpaceBonus.STEEL]})];
    const next = [space('05', {bonus: [SpaceBonus.STEEL], tileType: TileType.CITY, color: 'red'})];
    detectTilePlacement(prev, next);
    // The printed steel is OWED — captured at detect, not yet flown: a
    // single-card cover launching NOW must take the calmer concurrent road.
    expect(tilePlacementRewardsSettling()).to.be.true;
    await runTilePlacement(prev, next);
    seedTilePlacementRewardHold();
    expect(tilePlacementRewardsSettling()).to.be.true;
    await endTilePlacement(); // degrades under JSDOM — releases everything
    expect(tilePlacementRewardsSettling()).to.be.false;
    await settle(5);

    // A card-only cell (DRAW_CARD prints no resource chip) never reads as a
    // concurrent resource payout — the lone cover keeps the standard tempo.
    armTilePlacement({spaceId: '06'});
    const p2 = [space('06', {bonus: [SpaceBonus.DRAW_CARD]})];
    const n2 = [space('06', {bonus: [SpaceBonus.DRAW_CARD], tileType: TileType.GREENERY, color: 'red'})];
    detectTilePlacement(p2, n2);
    expect(tilePlacementRewardsSettling()).to.be.false;
    await runTilePlacement(p2, n2);
    await endTilePlacement();
  });
});
