import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {detectFreshPlacements, detectFreshRemovals} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  abortRemotePlacements, isRemotePlacementActive, remotePlacementState, stageRemotePlacements,
} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {
  cellVacatedNonce, clearCellVacated, heldPrevTileOf, isRemoteRevealHeld, markCellVacated,
} from '@/client/console/tilePlacement/remoteRevealHold';
import {boardSceneSettling} from '@/client/console/rewardPayoutQuiet';
import {activeAnimationHoldLabels, isAnimationHoldActive, refreshAnimationHolds} from '@/client/components/presentation/animationHold';
import {placementKicker} from '@/client/console/consoleTaskSummary';
import {voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/**
 * WATER EXPORT (Turmoil Redux, RX33) — THE REMOVAL SCENE and its readings, at the
 * client's seams:
 *  · a tile that LEAVES a cell is a diff of its own (`detectFreshRemovals` —
 *    TILED → EMPTY, never a placement, hazards excluded);
 *  · the shared remote stage STAGES it in the same synchronous block as the
 *    commit: the emptied cell is HELD painting the tile that left (the hold
 *    carries the departing tile), the queue is live, and the scene HOLDS the
 *    presentation (`tile-placement-remote` → `boardSceneSettling`) until the
 *    lift is done — a removal can no longer be a silent pop-out;
 *  · a chooser's pick arms NO landing hero — the kicker names a REMOVAL;
 *  · the vote panel carries the TABLE's part OUTSIDE the seat's reading
 *    (`reading.removal`), and the inspector prints the world block from the
 *    same declaration.
 */
const LAW_ID = 'RDX_REDS_WATER_EXPORT';

function cell(id: string, tileType?: TileType, color?: string): SpaceModel {
  return {id, x: 1, y: 1, spaceType: SpaceType.OCEAN, bonus: [], tileType, color} as unknown as SpaceModel;
}

const law = (): IClientResolution => {
  const resolution = getResolution(LAW_ID);
  if (resolution === undefined) {
    throw new Error(`${LAW_ID} is not in the client manifest`);
  }
  return resolution;
};

describe('Water Export — the removal scene and its readings', () => {
  afterEach(() => {
    abortRemotePlacements();
    clearCellVacated('10');
  });

  it('a tile that LEFT a cell is a REMOVAL diff, never a placement — and a hazard\'s disappearance keeps its own language', () => {
    const prev = [cell('10', TileType.OCEAN), cell('11', TileType.GREENERY, 'red'), cell('12'), cell('13', TileType.DUST_STORM_MILD)];
    const next = [cell('10'), cell('11', TileType.GREENERY, 'red'), cell('12', TileType.CITY, 'blue'), cell('13')];
    expect(detectFreshRemovals(prev, next)).deep.eq([{spaceId: '10', tileType: TileType.OCEAN, color: undefined}]);
    expect(detectFreshPlacements(prev, next).map((p) => p.spaceId), 'the placement diff sees the city, not the removal').deep.eq(['12']);
    expect(detectFreshRemovals(next, prev), 'read backwards, the city\'s landing is the removal and the ocean\'s removal is a landing').deep.eq([{spaceId: '12', tileType: TileType.CITY, color: 'blue'}]);
  });

  it('STAGING a removal holds the emptied cell PAINTING the tile that left, queues the lift and HOLDS the presentation', () => {
    const prev = [cell('10', TileType.OCEAN)];
    const next = [cell('10')];
    expect(isRemotePlacementActive()).is.false;
    expect(consoleReducedMotionActive(), 'the runner is not under reduced motion (the scene stages nothing there, honestly)').is.false;
    expect(detectFreshRemovals(prev, next).map((r) => r.spaceId)).deep.eq(['10']);
    stageRemotePlacements(prev, next, {gamePhase: 'action'});
    expect(isRemoteRevealHeld('10'), 'the committed EMPTY cell is held').is.true;
    expect(heldPrevTileOf('10'), 'the hold carries the tile that LEFT — the cell keeps painting the water').eq(TileType.OCEAN);
    expect(isRemotePlacementActive(), 'the queue is live — a scene owes the lift').is.true;
    expect(boardSceneSettling(), 'the board scene is settling: a yielded stack does not come back under the lift').is.true;
    // The supplier reads the (non-reactive) queue, so the counts re-derive on the
    // product's own sweep (the foreground watchdog's `refreshAnimationHolds`).
    refreshAnimationHolds();
    expect(activeAnimationHoldLabels(), 'the shared remote hold stands, BLOCKING — notifications queue, mandatory surfaces wait').includes('tile-placement-remote[blocking]');
    expect(isAnimationHoldActive()).is.true;
    // The teardown (the safety ceiling's own path): every held cell becomes visible at once.
    abortRemotePlacements();
    expect(isRemoteRevealHeld('10')).is.false;
    expect(isRemotePlacementActive()).is.false;
    expect(remotePlacementState.departingTile).is.undefined;
  });

  it('a removal already staged is not staged twice (a poll / submit double-report of one cell)', () => {
    const prev = [cell('10', TileType.OCEAN)];
    const next = [cell('10')];
    stageRemotePlacements(prev, next, {gamePhase: 'action'});
    stageRemotePlacements(prev, next, {gamePhase: 'action'});
    expect(isRemoteRevealHeld('10')).is.true;
    abortRemotePlacements();
  });

  it('the vacated cell\'s settle is a ONE-SHOT mark the cell clears itself', () => {
    expect(cellVacatedNonce('10')).is.undefined;
    markCellVacated('10');
    const first = cellVacatedNonce('10');
    expect(first).is.a('number');
    markCellVacated('10');
    expect(cellVacatedNonce('10'), 'a second removal on the same cell re-arms the one-shot').not.eq(first);
    clearCellVacated('10');
    expect(cellVacatedNonce('10')).is.undefined;
  });

  it('the chooser\'s pick is named a REMOVAL — never a tile placement, never a marker', () => {
    expect(placementKicker({type: 'space', placementEffect: 'remove'} as never)).eq('Tile removal');
    expect(placementKicker({type: 'space', placementEffect: 'tile'} as never)).eq('Tile placement');
    expect(placementKicker({type: 'space', placementEffect: 'marker'} as never)).eq('Marker placement');
  });

  it('the vote panel carries the TABLE\'s part beside the seat\'s reading — declared, outside «for you», never in the net', () => {
    const resolution = law();
    expect(resolution.tileRemoval).deep.eq({tile: 'ocean', executor: 'first-player'});
    const model = {
      players: [{color: 'blue', participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda: 2, influence: 2, access: [], partyActionUses: {}, resolutionActionUses: 0}],
      slots: [], parties: [], enacted: undefined, generation: 1, lobby: [], neutralSupply: 0,
    } as unknown as ParliamentModel;
    const reading = voteReadingOf(resolution, model, 'blue' as never, []);
    expect(reading.removal, 'the world part rides the reading as a declaration').deep.eq({tile: 'ocean', executor: 'first-player'});
    expect(reading.yields.map((y) => y.effect.id), 'the seat\'s own reading is the M€ alone').deep.eq(['megacredits']);
    expect(reading.tracks).is.undefined;
  });

  it('the inspector prints the world block from the SAME declaration: the sentence, the board\'s numbers, the named edge', () => {
    const rows = (blocks: ReadonlyArray<{key?: string, id?: string, rows?: ReadonlyArray<unknown>}>) =>
      blocks.find((b) => (b as {id?: string}).id === 'group:world' || (b as {key?: string}).key === 'group:world');
    const withRoom = resolutionAnnotations(LAW_ID, [], undefined, {table: undefined, removal: {oceans: 3, removableOceans: 3}});
    const world = rows(withRoom as never);
    expect(world, 'the world block stands').is.not.undefined;
    expect(JSON.stringify(world)).contains('3');
    expect(JSON.stringify(world)).contains('2');
    const atMax = resolutionAnnotations(LAW_ID, [], undefined, {table: undefined, removal: {oceans: 9}});
    expect(JSON.stringify(rows(atMax as never))).contains('oceans at their maximum');
    const reference = resolutionAnnotations(LAW_ID, [], undefined, undefined);
    expect(JSON.stringify(rows(reference as never)), 'no board: the sentence alone').not.contains('→');
  });
});
