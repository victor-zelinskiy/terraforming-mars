import {expect} from 'chai';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {TileMoveRecordModel} from '@/common/boards/TileMove';
import {
  verifyPlacement, verifyMove, applyVacatePreview, applySpacePreview,
  movePlan, moveLiftPose, moveCarryPose, moveLandPose, moveShadowAt, moveSourceRect, moveSceneMs,
  MOVE_LIFT_MS, MOVE_CARRY_MS, MOVE_LAND_MS, MOVE_LIFT_PX, MOVE_CARRY_SCALE, MOVE_VACATED_T, MOVE_ARC_RISE, MOVE_DESCENT_T,
  stackLandingRect, STACK_SCALE, BONUS_PRELIFT_START_T,
  TILE_FLIGHT_MS, TILE_SETTLE_MS, TILE_DEPART_MS, TILE_DEPART_BREATH_MS,
  TIER_APPROACH_MS, TIER_HOVER_MS, TIER_DESCENT_MS, TIER_CONTACT_MS, TIER_SETTLE_MS,
  TileRect,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  claimTileMove, pairTileMoves, resetTileMoveClaims, tileMoveClaimed, tileMoveRecordFor,
} from '@/client/console/tilePlacement/tileMoveRecords';
import {
  armTilePlacement, detectTilePlacement, runTilePlacement, endTilePlacement, abortTilePlacement,
  isTilePlacementActive, seedTilePlacementRewardHold, tilePlacementState,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {
  abortRemotePlacements, isRemotePlacementActive, remotePlacementState, stageRemotePlacements,
} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {
  heldPrevColorOf, heldPrevTileOf, heldStackHeightOf, holdRemoteReveal, holdStackHeight, isRemoteRevealHeld,
  clearRemoteRevealHolds, releaseRemoteReveal,
} from '@/client/console/tilePlacement/remoteRevealHold';
import {
  clearStackRelease, clearStackScene, stackRelease, stackReleasedAt, stackSceneState, stackUnloadingAt,
} from '@/client/console/tilePlacement/cityStackScene';
import {heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cubePhase} from '@/client/components/board/cubeDropState';

/**
 * TR14 RE-SETTLEMENT — THE MOVE SCENE: the fourth legal case of the placement
 * hero, and its twin on the remote stage.
 *
 *  · the proof is the DECLARED PAIR and nothing looser (`verifyMove`): the
 *    city left A, a city of the same owner stands on B — a single tile whole,
 *    a stack's top tier as a plain city;
 *  · the scene's numbers are pinned here, beside a pin of the landing's, the
 *    removal's and the tier's own — a move may not retime its neighbours;
 *  · ONE object: lifted straight up, carried on a low arc, lowered to exactly
 *    scale 1 — three poses that meet without a seam;
 *  · the hero owns BOTH cells (the remote stage skips them, and the server's
 *    record is claimed), pays B exactly as a landing does, and leaves nothing
 *    behind on abort or degrade;
 *  · an opponent's move is ONE queued event by the server's record — and with
 *    no record the two changes keep their separate beats: no pair is guessed.
 */
function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

/** A measurable board cell (JSDOM reports every rect 0×0). Returns a teardown. */
function boardCell(id: string, at: {x: number, y: number}, bonusIcons = 0): () => void {
  const cell = document.createElement('div');
  cell.className = 'board-space';
  cell.setAttribute('data_space_id', id);
  cell.getBoundingClientRect = () => ({
    x: at.x, y: at.y, left: at.x, top: at.y, right: at.x + 46, bottom: at.y + 51, width: 46, height: 51, toJSON: () => ({}),
  } as DOMRect);
  const bonuses = document.createElement('div');
  bonuses.className = 'board-space-bonuses';
  for (let i = 0; i < bonusIcons; i++) {
    const icon = document.createElement('i');
    icon.className = 'board-space-bonus';
    icon.getBoundingClientRect = () => ({
      x: at.x + 10 + i * 12, y: at.y + 20, left: at.x + 10 + i * 12, top: at.y + 20,
      right: at.x + 20 + i * 12, bottom: at.y + 30, width: 10, height: 10, toJSON: () => ({}),
    } as DOMRect);
    bonuses.appendChild(icon);
  }
  cell.appendChild(bonuses);
  document.body.appendChild(cell);
  return () => cell.remove();
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const A = '10';
const B = '11';

/** A plain city of red's leaves `10` for `11`; `12` is a bystander. */
function singleMove(bonus: {a?: Array<SpaceBonus>, b?: Array<SpaceBonus>} = {}) {
  return {
    prev: [space(A, {bonus: bonus.a ?? [], tileType: TileType.CITY, color: 'red'}), space(B, {bonus: bonus.b ?? []}), space('12')],
    next: [space(A, {bonus: bonus.a ?? []}), space(B, {bonus: bonus.b ?? [], tileType: TileType.CITY, color: 'red'}), space('12')],
  };
}

/** The top tier of red's two-tier stack on `10` leaves for `11`. */
function stackMove(height = 2) {
  const after = height - 1;
  return {
    prev: [space(A, {tileType: TileType.CITY, color: 'red', stackHeight: height}), space(B)],
    next: [space(A, {tileType: TileType.CITY, color: 'red', ...(after > 1 ? {stackHeight: after} : {})}), space(B, {tileType: TileType.CITY, color: 'red'})],
  };
}

const record = (seq: number, from = A, to = B): TileMoveRecordModel => ({seq, from: from as SpaceId, to: to as SpaceId, tileType: TileType.CITY, color: 'red'});

describe('TR14 Re-settlement — the MOVE scene', () => {
  describe('verifyPlacement with a DECLARED move (the fourth case)', () => {
    it('reads exactly the declared pair: the city left A whole, the same tile of the same owner stands on B', () => {
      const {prev, next} = singleMove();
      expect(verifyPlacement(prev, next, B, {movedFrom: A})).deep.eq({
        tileType: TileType.CITY, color: 'red', moves: {from: A, tileType: TileType.CITY, color: 'red'},
      });
    });

    it('a Capital travels as the Capital — the tile left whole, so it is the SAME tile', () => {
      const prev = [space(A, {tileType: TileType.CAPITAL, color: 'red'}), space(B)];
      const next = [space(A), space(B, {tileType: TileType.CAPITAL, color: 'red'})];
      expect(verifyMove(prev, next, A, B)?.moves?.tileType).eq(TileType.CAPITAL);
      // …and a Capital that «arrived» as a plain city is not a whole tile that moved.
      const wrong = [space(A), space(B, {tileType: TileType.CITY, color: 'red'})];
      expect(verifyMove(prev, wrong, A, B)).is.undefined;
    });

    it('a STACK: only the top tier leaves — A is the same city one tier lower, B a plain city', () => {
      const two = stackMove(2);
      expect(verifyMove(two.prev, two.next, A, B)?.moves).deep.eq({from: A, tileType: TileType.CITY, color: 'red', stack: {from: 2, to: 1}});
      const three = stackMove(3);
      expect(verifyMove(three.prev, three.next, A, B)?.moves?.stack).deep.eq({from: 3, to: 2});
      // A Capital under a tier keeps the cell. What TRAVELS is the tier — the plain city that lay on top — so the
      // proxy wears a plain city from the first frame to the last: no piece changes its kind on the way.
      const prev = [space(A, {tileType: TileType.CAPITAL, color: 'red', stackHeight: 2}), space(B)];
      const next = [space(A, {tileType: TileType.CAPITAL, color: 'red'}), space(B, {tileType: TileType.CITY, color: 'red'})];
      expect(verifyMove(prev, next, A, B)).deep.eq({
        tileType: TileType.CITY, color: 'red', moves: {from: A, tileType: TileType.CITY, color: 'red', stack: {from: 2, to: 1}},
      });
      // …and a Capital that would «arrive» off its own stack is not this move: the base never leaves.
      const swapped = [space(A, {tileType: TileType.CITY, color: 'red'}), space(B, {tileType: TileType.CAPITAL, color: 'red'})];
      expect(verifyMove(prev, swapped, A, B)).is.undefined;
    });

    it('a declared move the response does NOT show is refused — never read as a plain landing', () => {
      const {prev, next} = singleMove();
      const stayed = [space(A, {tileType: TileType.CITY, color: 'red'}), next[1], next[2]];
      expect(verifyPlacement(prev, stayed, B, {movedFrom: A}), 'the source did not change').is.undefined;
      expect(verifyPlacement(prev, prev, B, {movedFrom: A}), 'nothing landed').is.undefined;
      expect(verifyPlacement(prev, next, B, {movedFrom: '12'}), 'the named source held no city').is.undefined;
      expect(verifyPlacement(prev, next, B, {movedFrom: B}), 'a cell cannot move onto itself').is.undefined;
    });

    it('nothing looser than the pair: an occupied destination, another owner, a hazard, a stack that lost two tiers', () => {
      const {prev, next} = singleMove();
      const occupied = [prev[0], space(B, {tileType: TileType.GREENERY, color: 'red'}), prev[2]];
      expect(verifyMove(occupied, next, A, B), 'B was not empty').is.undefined;
      const stolen = [next[0], space(B, {tileType: TileType.CITY, color: 'blue'}), next[2]];
      expect(verifyMove(prev, stolen, A, B), 'another owner stands on B').is.undefined;
      const hazard = [prev[0], space(B, {tileType: TileType.EROSION_MILD}), prev[2]];
      expect(verifyMove(hazard, next, A, B), 'a hazard built over keeps its own sequence').is.undefined;
      const greenery = [next[0], space(B, {tileType: TileType.GREENERY, color: 'red'}), next[2]];
      expect(verifyMove(prev, greenery, A, B), 'what landed is not a city').is.undefined;
      const three = stackMove(3);
      const collapsed = [space(A, {tileType: TileType.CITY, color: 'red'}), three.next[1]];
      expect(verifyMove(three.prev, collapsed, A, B), 'a stack loses exactly ONE tier to a move').is.undefined;
    });

    it('WITHOUT the declaration the landing on B is an ordinary landing — it claims no move', () => {
      const {prev, next} = singleMove();
      expect(verifyPlacement(prev, next, B)).deep.eq({tileType: TileType.CITY, color: 'red'});
    });
  });

  describe('the numbers (pinned) — and the neighbours they may not retime', () => {
    it('LIFT 0 → 200 · CARRY 200 → 620 · LANDING 620 → 770', () => {
      expect([MOVE_LIFT_MS, MOVE_CARRY_MS, MOVE_LAND_MS]).deep.eq([200, 420, 150]);
      expect(moveSceneMs()).eq(770);
      expect(MOVE_LIFT_PX).eq(10);
      expect(MOVE_CARRY_SCALE).eq(1.08);
      expect(MOVE_VACATED_T).eq(0.35);
      expect(BONUS_PRELIFT_START_T, 'the destination\'s icons pre-lift at the landing\'s own fraction — past the middle of the carry').within(0.5, 0.6);
      expect(MOVE_DESCENT_T).within(0.5, 0.7);
    });

    it('the landing, the removal and the tier keep their own timings', () => {
      expect([TILE_FLIGHT_MS, TILE_SETTLE_MS]).deep.eq([520, 150]);
      expect([TILE_DEPART_MS, TILE_DEPART_BREATH_MS]).deep.eq([380, 130]);
      expect([TIER_APPROACH_MS, TIER_HOVER_MS, TIER_DESCENT_MS, TIER_CONTACT_MS, TIER_SETTLE_MS]).deep.eq([380, 130, 360, 160, 220]);
    });
  });

  describe('ONE object from A to B (the geometry)', () => {
    const hexA: TileRect = {x: 400, y: 300, w: 46, h: 51};
    const hexB: TileRect = {x: 446, y: 300, w: 46, h: 51};
    const plan = movePlan(hexA, hexB);

    it('the proxy is the destination\'s box: over an equal hex it is born at scale 1, centre on centre', () => {
      expect(plan.sourceScale).eq(1);
      expect(plan.from).deep.eq({x: 423, y: 325.5});
      expect(plan.to).deep.eq({x: 469, y: 325.5});
      expect(plan.liftPx, '10 board px on the authored 51 px cell').eq(10);
      expect(movePlan(hexA, {x: 0, y: 0, w: 92, h: 102}).liftPx, 'the lift rides the live hex — never fixed px').eq(20);
      expect(plan.arcPx).closeTo(51 * MOVE_ARC_RISE, 1e-9);
    });

    it('LIFT is strictly vertical: x fixed, y monotone, the scale growing to the carried size', () => {
      let lastY = Infinity;
      let lastScale = 0;
      for (let i = 0; i <= 10; i++) {
        const p = moveLiftPose(plan, i / 10);
        expect(p.x).eq(plan.from.x);
        expect(p.y).at.most(lastY);
        expect(p.scale).at.least(lastScale);
        lastY = p.y;
        lastScale = p.scale;
      }
      expect(moveLiftPose(plan, 0)).deep.eq({x: 423, y: 325.5, scale: 1});
      expect(moveLiftPose(plan, 1).y).eq(315.5);
      expect(moveLiftPose(plan, 1).scale).closeTo(MOVE_CARRY_SCALE, 1e-9);
    });

    it('CARRY travels the chord monotonically on a LOW arc — never higher than lift + arc', () => {
      let lastX = -Infinity;
      for (let i = 0; i <= 20; i++) {
        const p = moveCarryPose(plan, i / 20);
        expect(p.x).at.least(lastX);
        expect(p.y, 'never below the lifted height, never above the apex').within(325.5 - plan.liftPx - plan.arcPx - 1e-9, 325.5 - plan.liftPx + 1e-9);
        expect(p.scale).closeTo(MOVE_CARRY_SCALE, 1e-9);
        lastX = p.x;
      }
      expect(moveCarryPose(plan, 0.5).y, 'the apex stands over the shared edge').closeTo(325.5 - plan.liftPx - plan.arcPx, 1e-9);
    });

    it('LANDING comes straight down and is EXACTLY the destination hex at contact', () => {
      expect(moveLandPose(plan, 1)).deep.eq({x: 469, y: 325.5, scale: 1});
      let lastY = -Infinity;
      for (let i = 0; i <= 10; i++) {
        const p = moveLandPose(plan, i / 10);
        expect(p.x).eq(plan.to.x);
        expect(p.y).at.least(lastY);
        lastY = p.y;
      }
    });

    it('the three poses MEET: no seam between the lift, the carry and the landing', () => {
      const liftEnd = moveLiftPose(plan, 1);
      const carryStart = moveCarryPose(plan, 0);
      const carryEnd = moveCarryPose(plan, 1);
      const landStart = moveLandPose(plan, 0);
      expect(carryStart.x).closeTo(liftEnd.x, 1e-9);
      expect(carryStart.y).closeTo(liftEnd.y, 1e-9);
      expect(carryStart.scale).closeTo(liftEnd.scale, 1e-9);
      expect(landStart.x).closeTo(carryEnd.x, 1e-9);
      expect(landStart.y).closeTo(carryEnd.y, 1e-9);
      expect(landStart.scale).closeTo(carryEnd.scale, 1e-9);
    });

    it('a STACK source is the top tier in its LIFTED rect — the stack\'s own geometry, grown to the full hex on the way', () => {
      expect(moveSourceRect(hexA, 1)).eq(hexA);
      expect(moveSourceRect(hexA, 2)).deep.eq(stackLandingRect(hexA, 2));
      const tier = movePlan(moveSourceRect(hexA, 2), hexB);
      expect(tier.sourceScale).closeTo(STACK_SCALE, 1e-9);
      expect(tier.from.y, 'one tier step above the hex centre').below(325.5);
      // The crane, reversed: the lift off a stack is as vertical as the tier's descent was.
      expect(moveLiftPose(tier, 0.5).x).eq(tier.from.x);
      expect(moveCarryPose(tier, 1).scale, 'by the end of the carry it is a full-size city').closeTo(MOVE_CARRY_SCALE, 1e-9);
    });

    it('the ground shadow separates and softens with the lift, and tightens back to contact', () => {
      const seated = moveShadowAt(0);
      const lifted = moveShadowAt(1);
      expect(lifted.scale).above(seated.scale);
      expect(lifted.alpha).below(seated.alpha);
    });
  });

  describe('the vacated cell\'s silent paint (applyVacatePreview)', () => {
    it('a single city leaves WHOLE: tile, owner and cathedral go — the printed bonus and every other cell stay', () => {
      const prev = [space(A, {bonus: [SpaceBonus.STEEL], tileType: TileType.CITY, color: 'red', cathedral: true}), space(B)];
      const next = [space(A, {bonus: [SpaceBonus.STEEL]}), space(B, {tileType: TileType.CITY, color: 'red', cathedral: true})];
      applyVacatePreview(prev, next, A);
      expect(prev[0]).deep.eq(space(A, {bonus: [SpaceBonus.STEEL]}));
      expect(prev[1].tileType, 'the destination is the landing\'s to paint').is.undefined;
      // …and the landing's own paint brings the cathedral with the tile.
      applySpacePreview(prev, next, B);
      expect(prev[1].cathedral).is.true;
    });

    it('a stack drops ONE tier: the city and its owner stay, the height key leaves at 1', () => {
      const two = stackMove(2);
      applyVacatePreview(two.prev, two.next, A);
      expect(two.prev[0].tileType).eq(TileType.CITY);
      expect(two.prev[0].color).eq('red');
      expect('stackHeight' in two.prev[0]).is.false;
      const three = stackMove(3);
      applyVacatePreview(three.prev, three.next, A);
      expect(three.prev[0].stackHeight).eq(2);
    });
  });

  describe('the server\'s record — the only authority that two changes are ONE move', () => {
    afterEach(() => resetTileMoveClaims());

    it('a record AND a diff that bears it out → one pair', () => {
      const {prev, next} = singleMove();
      const pairs = pairTileMoves(prev, next, [record(1201)]);
      expect(pairs).has.length(1);
      expect(pairs[0].record.seq).eq(1201);
      expect(pairs[0].landed.moves.from).eq(A);
    });

    it('a diff with NO record is not a move — nothing is paired by geometry', () => {
      const {prev, next} = singleMove();
      expect(pairTileMoves(prev, next, undefined)).deep.eq([]);
      expect(pairTileMoves(prev, next, [])).deep.eq([]);
      expect(pairTileMoves(prev, next, [record(7, '12', B)]), 'a record naming other cells proves nothing about these').deep.eq([]);
    });

    it('a record this diff does not show is left alone — and unclaimed', () => {
      const {prev} = singleMove();
      expect(pairTileMoves(prev, prev, [record(9)])).deep.eq([]);
      expect(tileMoveClaimed(9)).is.false;
    });

    it('a record is consumed ONCE per client', () => {
      const {prev, next} = singleMove();
      expect(claimTileMove(1201)).is.true;
      expect(claimTileMove(1201)).is.false;
      expect(pairTileMoves(prev, next, [record(1201)])).deep.eq([]);
    });

    it('the newest record names a pair (a city can travel the same edge twice)', () => {
      expect(tileMoveRecordFor([record(100), record(300), record(200), record(400, B, A)], A, B)?.seq).eq(300);
      expect(tileMoveRecordFor(undefined, A, B)).is.undefined;
    });
  });

  describe('the hero transaction', () => {
    let teardowns: Array<() => void> = [];

    afterEach(async () => {
      abortTilePlacement();
      abortRemotePlacements();
      resetTileMoveClaims();
      clearStackScene();
      clearStackRelease(A as SpaceId);
      teardowns.forEach((t) => t());
      teardowns = [];
      await settle(5); // the abort lowers 'failed' → 'idle' on nextTick
    });

    const cells = (bonusOnB = 0) => {
      teardowns.push(boardCell(A, {x: 400, y: 300}), boardCell(B, {x: 446, y: 300}, bonusOnB));
    };

    it('an arm that declares the move STAGES the travelling city and claims the server\'s record', () => {
      cells(1);
      armTilePlacement({spaceId: B, movedFrom: A});
      const {prev, next} = singleMove({b: [SpaceBonus.STEEL]});
      expect(detectTilePlacement(prev, next, {tileMoves: [record(1201)]})).deep.eq({spaceId: B});
      expect(tilePlacementState.move).deep.eq({from: A, stack: undefined});
      expect(tilePlacementState.tileType).eq(TileType.CITY);
      expect(tilePlacementState.departingTile, 'the proxy wears what stood on A').eq(TileType.CITY);
      expect(tilePlacementState.departingCube?.color, 'the owner cube rides the tile').eq('red');
      expect(tilePlacementState.bonusProxies, 'B\'s printed icon is captured while B is still bare').has.length(1);
      expect(tileMoveClaimed(1201), 'the hero plays this record — the remote stage never will').is.true;
    });

    it('a declared move the server did not make aborts with zero state', async () => {
      cells();
      armTilePlacement({spaceId: B, movedFrom: A});
      const {prev} = singleMove();
      // A plain landing on B is NOT the declared move: the city on A never left.
      const landedOnly = [prev[0], space(B, {tileType: TileType.CITY, color: 'red'}), prev[2]];
      expect(detectTilePlacement(prev, landedOnly)).is.undefined;
      expect(isTilePlacementActive()).is.false;
      expect(tilePlacementState.move).is.undefined;
      await settle(5);
    });

    it('with no stage to fly on BOTH cells take their final poses in ONE turn — and the degrade names itself', async () => {
      cells();
      armTilePlacement({spaceId: B, movedFrom: A});
      const {prev, next} = singleMove();
      detectTilePlacement(prev, next);
      await runTilePlacement(prev, next);
      expect(prev[0].tileType, 'A is vacated').is.undefined;
      expect(prev[0].color).is.undefined;
      expect(prev[1].tileType, 'B carries the city').eq(TileType.CITY);
      expect(prev[1].color).eq('red');
      expect(tilePlacementState.phase).eq('landed');
      expect(tilePlacementState.moveDegraded, 'no stage is mounted under the unit runner').is.true;
      expect(cubePhase(B as SpaceId), 'the cube rode the tile — it is simply there, never thrown').not.eq('dropping');
      await endTilePlacement();
      expect(isTilePlacementActive()).is.false;
      expect(tilePlacementState.move).is.undefined;
      expect(tilePlacementState.moveDegraded).is.false;
    });

    it('B pays exactly what a landing pays; A\'s printed bonus is nobody\'s', async () => {
      cells(1);
      armTilePlacement({spaceId: B, movedFrom: A});
      const {prev, next} = singleMove({a: [SpaceBonus.TITANIUM], b: [SpaceBonus.STEEL]});
      detectTilePlacement(prev, next);
      await runTilePlacement(prev, next);
      seedTilePlacementRewardHold();
      expect(heldStock('steel')).eq(1);
      expect(heldStock('titanium'), 'the cell the city LEFT pays nothing').eq(0);
      await endTilePlacement();
      expect(heldStock('steel')).eq(0);
    });

    it('a STACK source: the height drops in the handoff turn and the cell answers «released» until the scene ends', async () => {
      cells();
      armTilePlacement({spaceId: B, movedFrom: A});
      const {prev, next} = stackMove(2);
      detectTilePlacement(prev, next);
      expect(tilePlacementState.move?.stack).deep.eq({from: 2, to: 1});
      expect(stackSceneState.released, 'nothing ticks before the scene owns the move').is.undefined;
      await runTilePlacement(prev, next);
      expect('stackHeight' in prev[0]).is.false;
      expect(prev[0].tileType, 'the base stays').eq(TileType.CITY);
      expect(stackReleasedAt(A as SpaceId), 'the counter ticks down in the turn the tier stops painting').is.true;
      expect(stackUnloadingAt(A as SpaceId)).is.true;
      await endTilePlacement();
      expect(stackSceneState.released, 'released with the scene — the tick never replays').is.undefined;
      expect(stackSceneState.unloading).is.undefined;
    });

    it('the remote stage skips BOTH of the hero\'s cells — no foreign lift follows the scene', () => {
      cells();
      armTilePlacement({spaceId: B, movedFrom: A});
      const {prev, next} = singleMove();
      detectTilePlacement(prev, next);
      // The same response is offered to the remote stage (it runs on every commit path).
      stageRemotePlacements(prev, next, {gamePhase: 'action'});
      expect(isRemoteRevealHeld(A), 'the cell the city left is the hero\'s').is.false;
      expect(isRemoteRevealHeld(B)).is.false;
      expect(isRemotePlacementActive()).is.false;
      // …with the record too: it is the hero's by claim and by cell.
      stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record(1201)]});
      expect(isRemotePlacementActive()).is.false;
    });

    it('an abort mid-scene leaves nothing of the move behind', async () => {
      cells();
      armTilePlacement({spaceId: B, movedFrom: A});
      const {prev, next} = stackMove(2);
      detectTilePlacement(prev, next);
      stackRelease(A as SpaceId); // as the handoff would
      abortTilePlacement();
      expect(tilePlacementState.move).is.undefined;
      expect(tilePlacementState.moveDegraded).is.false;
      expect(stackSceneState.released).is.undefined;
      expect(stackSceneState.unloading).is.undefined;
      await settle(5);
    });

    it('the declaration does not leak into the NEXT, ordinary placement', async () => {
      cells();
      armTilePlacement({spaceId: B, movedFrom: A});
      const first = singleMove();
      detectTilePlacement(first.prev, first.next);
      await runTilePlacement(first.prev, first.next);
      await endTilePlacement();
      await settle(5);
      armTilePlacement({spaceId: '12'});
      const prev = [space('12')];
      const next = [space('12', {tileType: TileType.CITY, color: 'red'})];
      expect(detectTilePlacement(prev, next), 'an ordinary landing is verified as one').deep.eq({spaceId: '12'});
      expect(tilePlacementState.move).is.undefined;
      expect(tilePlacementState.departingTile).is.undefined;
      await runTilePlacement(prev, next);
      await endTilePlacement();
    });
  });

  describe('the remote stage — ONE move by the server\'s record', () => {
    afterEach(() => {
      abortRemotePlacements();
      abortTilePlacement();
      clearRemoteRevealHolds();
      resetTileMoveClaims();
      clearStackRelease(A as SpaceId);
    });

    it('record + diff → the city keeps standing on A (tile AND owner) and B stays hidden — one event, the record claimed', () => {
      const {prev, next} = singleMove();
      stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record(1201)]});
      expect(isRemoteRevealHeld(A)).is.true;
      expect(heldPrevTileOf(A), 'the committed bare hex keeps painting the city that left').eq(TileType.CITY);
      expect(heldPrevColorOf(A), '…with its owner cube — the mark of a MOVE, never of a removal').eq('red');
      expect(isRemoteRevealHeld(B), 'the committed city is hidden until the touchdown').is.true;
      expect(heldPrevTileOf(B)).is.undefined;
      expect(cubePhase(B as SpaceId), 'its cube rides the proxy').eq('hidden');
      expect(isRemotePlacementActive()).is.true;
      expect(tileMoveClaimed(1201)).is.true;
    });

    it('a STACK source keeps painting its former height until the proxy takes the top tier', () => {
      const {prev, next} = stackMove(2);
      stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record(1202)]});
      expect(heldStackHeightOf(A)).eq(2);
      expect(isRemoteRevealHeld(A), 'the base is not hidden — it never left').is.false;
      expect(isRemoteRevealHeld(B)).is.true;
      abortRemotePlacements();
      expect(heldStackHeightOf(A), 'the teardown shows the committed height at once').is.undefined;
    });

    it('NO record → the two changes keep their separate beats: a removal and a landing', () => {
      const {prev, next} = singleMove();
      stageRemotePlacements(prev, next, {gamePhase: 'action'});
      expect(heldPrevTileOf(A), 'a removal: the cell paints the tile that left…').eq(TileType.CITY);
      expect(heldPrevColorOf(A), '…and no owner — the lift\'s own language').is.undefined;
      expect(isRemoteRevealHeld(B)).is.true;
    });

    it('a record already played is not a move again — and a double report stages once', () => {
      const {prev, next} = singleMove();
      claimTileMove(1201);
      stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record(1201)]});
      expect(heldPrevColorOf(A), 'claimed elsewhere → separate beats').is.undefined;
      abortRemotePlacements();
      resetTileMoveClaims();
      stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record(1203)]});
      stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record(1203)]});
      expect(heldPrevColorOf(A)).eq('red');
      expect(isRemoteRevealHeld(B)).is.true;
    });

    it('the teardown shows both committed cells at once and leaves no move on the stage', () => {
      const {prev, next} = singleMove();
      stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record(1204)]});
      abortRemotePlacements();
      expect(isRemoteRevealHeld(A)).is.false;
      expect(heldPrevColorOf(A)).is.undefined;
      expect(isRemoteRevealHeld(B)).is.false;
      expect(cubePhase(B as SpaceId)).not.eq('hidden');
      expect(remotePlacementState.move).is.false;
      expect(remotePlacementState.departingCube).is.undefined;
      expect(remotePlacementState.moveDegraded).is.false;
      expect(isRemotePlacementActive()).is.false;
    });

    it('the reveal hold\'s owner and height are released with it', () => {
      holdRemoteReveal(A, TileType.CITY, 'red');
      holdStackHeight(A, 3);
      expect(heldPrevColorOf(A)).eq('red');
      releaseRemoteReveal(A);
      expect(heldPrevColorOf(A)).is.undefined;
      expect(heldStackHeightOf(A), 'the height is its own hold').eq(3);
      clearRemoteRevealHolds();
      expect(heldStackHeightOf(A)).is.undefined;
    });
  });
});
