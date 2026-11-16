import {expect} from 'chai';
import {SpaceId} from '@/common/Types';
import {
  cubePhase, HERO_CUBE_HOLD_KEPT_MAX_MS, HERO_CUBE_HOLD_SAFETY_MS, holdCubeForHeroPlacement, restCubeForHeroPlacement,
} from '@/client/components/board/cubeDropState';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * A HELD CUBE WAITS FOR ITS TILE, not for a clock started at the hold (FLAKE ZERO Ф4, class N): the scene that holds it
 * says whether the tile is still OWED (`keptWhile` — the remote stage's queue) and the safety counts on while it is,
 * bounded by a hard ceiling; a hold with no owner's word keeps the old 10 s safety.
 */
describe('cubeDropState — a held cube\'s safety waits while its scene still owes the tile (FLAKE ZERO Ф4)', () => {
  const id = '42' as SpaceId;
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });

  afterEach(() => {
    restCubeForHeroPlacement(id);
    setFlowClock(undefined);
  });

  it('no owner\'s word: the cube drops at the safety, as before', () => {
    holdCubeForHeroPlacement(id);
    clock.advance(HERO_CUBE_HOLD_SAFETY_MS - 1);
    expect(cubePhase(id)).eq('hidden');
    clock.advance(1);
    expect(cubePhase(id)).eq('dropping');
  });

  it('the tile still OWED: the cube stays hidden past the safety and drops once the owner lets go', () => {
    let owed = true;
    holdCubeForHeroPlacement(id, {keptWhile: () => owed});
    clock.advance(HERO_CUBE_HOLD_SAFETY_MS * 3);
    expect(cubePhase(id), 'the landing is still queued').eq('hidden');
    owed = false;
    clock.advance(HERO_CUBE_HOLD_SAFETY_MS);
    expect(cubePhase(id), 'nothing owed any more: the safety drops it').eq('dropping');
  });

  it('…bounded by the hard ceiling', () => {
    holdCubeForHeroPlacement(id, {keptWhile: () => true});
    clock.advance(HERO_CUBE_HOLD_KEPT_MAX_MS - HERO_CUBE_HOLD_SAFETY_MS);
    expect(cubePhase(id)).eq('hidden');
    clock.advance(HERO_CUBE_HOLD_SAFETY_MS * 2);
    expect(cubePhase(id), 'past the ceiling the cube lands whatever the owner says').not.eq('hidden');
  });
});
