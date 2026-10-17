import {expect} from 'chai';
import {ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {
  TERRAFORMED_ARMED_WAIT_MAX_MS,
  endTerraformedScene, registerTerraformedSceneProbes, resetTerraformedScene, seedTerraformedScene, skipTerraformedScene,
  terraformedSceneState, terraformedSceneUp,
} from '@/client/console/terraformedScene/terraformedScene';
import {
  boardBeatParkState, drainBoardBeatsIfDue, holdBoardScaleForScene, registerBoardBeatLiveParams, registerBoardWatchableProbe,
  releaseBoardScaleForScene, resetBoardBeatPark, boardBeatDisplayParams, boardBeatParkPending,
} from '@/client/console/boardBeatPark';
import {planetFocusState, resetPlanetFocus} from '@/client/console/planetFocus';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';

/**
 * «МАРС ТЕРРАФОРМИРОВАН» — THE PLANET SHOWS (TR70): the scene's PURE half. The trigger is the SERVER's word
 * (`isTerraformed` flipping between two applied views — never the three parameters, never a title), a reload seeds
 * silently, the scales' last step is HELD until the scene's stage releases it, the scene waits for a quiet world,
 * the hold covers every visible tact and never the armed wait, a press after the camera skips, and every end lets
 * go of everything it held. The DOM half (the recede, the camera's fit, the breath, the title) is the e2e's.
 */
function game(over: Partial<GameModel> = {}): GameModel {
  return {
    temperature: 8, oxygenLevel: 14, oceans: 8, venusScaleLevel: 0, isTerraformed: false, generation: 9, lastSoloGeneration: 14,
    scaleBonusClaims: {},
    ...over,
  } as unknown as GameModel;
}

function view(over: Partial<GameModel> = {}, players = 2): PlayerViewModel {
  return {game: game(over), players: Array.from({length: players}, (_, i) => ({color: i === 0 ? 'red' : 'blue'}))} as unknown as PlayerViewModel;
}

const BEFORE = view({oceans: 8});
const AFTER = view({oceans: 9, isTerraformed: true});

const tick = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('the terraformed scene — the pure half (TR70)', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(10_000);
  let quiet = true;
  let covered = false;
  // REACTIVE on purpose: the hold registry's live count is a computed over the supplier's predicate — a plain variable would
  // never invalidate it (the non-reactive-supplier trap of presentation-flow ROUND 4); the shell's probe reads a computed.
  const owned = ref(false);

  beforeEach(() => {
    resetTerraformedScene();
    resetBoardBeatPark();
    resetPlanetFocus();
    quiet = true;
    covered = false;
    owned.value = false;
    registerTerraformedSceneProbes({quiet: () => quiet, sectionCovered: () => covered, playerOwned: () => owned.value});
    registerBoardWatchableProbe(() => true);
    registerBoardBeatLiveParams(() => ({temperature: 8, oxygenLevel: 14, oceans: 9, venusScaleLevel: 0}));
  });

  afterEach(() => {
    resetTerraformedScene();
    resetBoardBeatPark();
    resetPlanetFocus();
    registerTerraformedSceneProbes(undefined);
  });

  it('the first observation seeds silently — a reload into a finished planet plays nothing', () => {
    expect(seedTerraformedScene(undefined, AFTER)).is.false;
    expect(terraformedSceneState.phase).eq('idle');
    expect(seedTerraformedScene(AFTER, AFTER), 'already terraformed when seeded — no transition').is.false;
    expect(terraformedSceneState.phase).eq('idle');
  });

  it('the SERVER\'s word arms it: isTerraformed false → true between two applied views, exactly once', () => {
    expect(seedTerraformedScene(undefined, BEFORE)).is.false;
    quiet = false; // keep it armed
    expect(seedTerraformedScene(BEFORE, AFTER)).is.true;
    expect(terraformedSceneState.phase).eq('armed');
    expect(terraformedSceneState.nonce).eq(1);
    expect(terraformedSceneState.final, 'multiplayer: the server\'s isTerraformed IS the last-generation claim').is.true;
    expect(terraformedSceneState.generation).eq(9);
    expect(seedTerraformedScene(AFTER, AFTER), 'the same view again — no second scene').is.false;
    expect(terraformedSceneState.nonce).eq(1);
  });

  it('the three parameters alone never arm it (a Venus-required variant waits for the server), and the solo claim is generation-based', () => {
    seedTerraformedScene(undefined, BEFORE);
    quiet = false;
    expect(seedTerraformedScene(BEFORE, view({oceans: 9, isTerraformed: false}))).is.false;
    expect(terraformedSceneState.phase).eq('idle');
    // Solo: terraformed mid-run — the scene plays, without the last-generation claim.
    resetTerraformedScene();
    seedTerraformedScene(undefined, view({oceans: 8}, 1));
    expect(seedTerraformedScene(view({oceans: 8}, 1), view({oceans: 9, isTerraformed: true, generation: 7}, 1))).is.true;
    expect(terraformedSceneState.final).is.false;
  });

  it('the scales\' last step is HELD at the arm, on a watchable board too — the drain stands aside, the scene releases', () => {
    seedTerraformedScene(undefined, BEFORE);
    quiet = false;
    seedTerraformedScene(BEFORE, AFTER);
    expect(boardBeatParkState.heldParams).deep.eq({oceans: 8});
    expect(boardBeatParkState.sceneHeld).is.true;
    expect(boardBeatDisplayParams({temperature: 8, oxygenLevel: 14, oceans: 9, venusScaleLevel: 0}).oceans, 'the HUD and the arcs keep the number the player saw').eq(8);
    drainBoardBeatsIfDue();
    expect(boardBeatParkState.heldParams, 'the ordinary drain never releases a scene\'s hold').deep.eq({oceans: 8});
    const windowMs = releaseBoardScaleForScene();
    expect(windowMs).is.greaterThan(0);
    expect(boardBeatParkState.heldParams).is.undefined;
    expect(boardBeatParkState.sceneHeld).is.false;
    expect(boardBeatParkState.scaleStory, 'the glide\'s blocking window stands').is.true;
    expect(boardBeatParkPending()).is.false;
  });

  it('a hold with nothing changed holds nothing (a reload mid-park, a Venus-only end)', () => {
    expect(holdBoardScaleForScene(game({oceans: 9}), game({oceans: 9}))).is.false;
    expect(boardBeatParkState.sceneHeld).is.false;
    expect(releaseBoardScaleForScene()).eq(0);
  });

  it('ARMED waits for a quiet world; it HOLDS the foreground while the wait is on cinematics and holds NOTHING while a surface the player owns stands', async () => {
    seedTerraformedScene(undefined, BEFORE);
    quiet = false;
    seedTerraformedScene(BEFORE, AFTER);
    expect(terraformedSceneUp(), 'armed on a cinematic wait — the scene owns the foreground (the announce waits for the planet)').is.true;
    expect(isAnimationHoldActive()).is.true;
    owned.value = true;
    expect(terraformedSceneUp(), 'a reveal the player must take stands — the scene holds nothing over it').is.false;
    expect(isAnimationHoldActive()).is.false;
    owned.value = false;
    await tick(120);
    expect(terraformedSceneState.phase, 'still armed while the world is busy').eq('armed');
    quiet = true;
    await tick(120);
    expect(terraformedSceneState.phase).eq('recede');
    expect(terraformedSceneState.receded).is.true;
    expect(terraformedSceneUp()).is.true;
    expect(isAnimationHoldActive()).is.true;
    expect(TERRAFORMED_ARMED_WAIT_MAX_MS).is.greaterThan(5_000);
  });

  it('the phrase: recede → focus (the ceremony camera) → show (the scales let go, the show nonce) → return → idle; the hold falls on the landing', async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(20_000);
    seedTerraformedScene(undefined, BEFORE);
    seedTerraformedScene(BEFORE, AFTER);
    await tick(80);
    expect(terraformedSceneState.phase).eq('recede');
    // The recede's fade (500 ms on the animation clock) …
    await tick(600);
    expect(terraformedSceneState.phase).eq('focus');
    expect(planetFocusState.phase, 'the camera comes in').is.oneOf(['entering', 'active']);
    expect(planetFocusState.mode).eq('ceremony');
    expect(boardBeatParkState.heldParams, 'the scales still held through the camera\'s travel').deep.eq({oceans: 8});
    // … the camera's enter (680 + 60) …
    await tick(800);
    expect(terraformedSceneState.phase).eq('show');
    expect(terraformedSceneState.showNonce).eq(1);
    expect(boardBeatParkState.heldParams, 'tact 3: the stage releases the scales').is.undefined;
    // … the show (1700) …
    await tick(1800);
    expect(terraformedSceneState.phase).eq('return');
    expect(planetFocusState.phase, 'the camera exits').is.oneOf(['exit-prep', 'exiting', 'idle']);
    // … the exit (760 + 60), the surfaces' return (400 + the arcs' 260) …
    await tick(1700);
    expect(terraformedSceneState.phase).eq('idle');
    expect(terraformedSceneState.receded).is.false;
    expect(terraformedSceneState.returning).is.false;
    expect(terraformedSceneState.lastEnd).eq('concluded');
    expect(isAnimationHoldActive()).is.false;
    expect(planetFocusState.phase).eq('idle');
  });

  it('a press SKIPS only after the camera is in: absorbed during the recede, a finish from focus / show on', async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(20_000);
    seedTerraformedScene(undefined, BEFORE);
    seedTerraformedScene(BEFORE, AFTER);
    await tick(80);
    expect(terraformedSceneState.phase).eq('recede');
    expect(skipTerraformedScene(), 'absorbed, not a skip').is.true;
    expect(terraformedSceneState.skipped).is.false;
    await tick(1500);
    expect(terraformedSceneState.phase).eq('show');
    expect(skipTerraformedScene()).is.true;
    expect(terraformedSceneState.skipped).is.true;
    await tick(80);
    expect(terraformedSceneState.phase, 'the show cut short — the return at once').eq('return');
    expect(boardBeatParkState.heldParams, 'the scales were let go — never skipped past').is.undefined;
    await tick(1700);
    expect(terraformedSceneState.phase).eq('idle');
    expect(terraformedSceneState.lastEnd).eq('concluded');
  });

  it('a SECTION on the board\'s slot: the board stands in — dark on the flip\'s frame, lit after, dark again before the flip back', async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(20_000);
    covered = true;
    seedTerraformedScene(undefined, BEFORE);
    seedTerraformedScene(BEFORE, AFTER);
    await tick(80);
    expect(terraformedSceneState.stage).eq('off');
    await tick(560);
    expect(terraformedSceneState.stage).is.oneOf(['dark', 'lit']);
    await tick(200);
    expect(terraformedSceneState.stage).eq('lit');
    await tick(600);
    expect(terraformedSceneState.phase).eq('focus');
    skipTerraformedScene();
    await tick(2200);
    expect(terraformedSceneState.stage).eq('off');
    expect(terraformedSceneState.phase).eq('idle');
  });

  it('END on any road lets go of everything: the held scales, the ceremony camera, the flags, the hold', async () => {
    seedTerraformedScene(undefined, BEFORE);
    seedTerraformedScene(BEFORE, AFTER);
    await tick(700);
    expect(terraformedSceneState.phase).eq('focus');
    endTerraformedScene('expired');
    expect(terraformedSceneState.phase).eq('idle');
    expect(terraformedSceneState.lastEnd).eq('expired');
    expect(boardBeatParkState.heldParams).is.undefined;
    expect(boardBeatParkState.sceneHeld).is.false;
    expect(planetFocusState.phase, 'the camera is sent home').is.oneOf(['exit-prep', 'exiting', 'idle']);
    expect(terraformedSceneUp(), 'the scene\'s own hold is gone at once').is.false;
    expect(terraformedSceneState.receded).is.false;
    // The camera's own exit hold is the focus module's and falls on its landing.
    await tick(1300);
    expect(planetFocusState.phase).eq('idle');
    expect(isAnimationHoldActive()).is.false;
  });

  it('a reset re-arms the seed: a different game opened in-session seeds afresh', () => {
    seedTerraformedScene(undefined, BEFORE);
    quiet = false;
    seedTerraformedScene(BEFORE, AFTER);
    resetTerraformedScene();
    expect(terraformedSceneState.phase).eq('idle');
    expect(seedTerraformedScene(AFTER, AFTER), 'the first view of the next game seeds, never plays').is.false;
  });
});
