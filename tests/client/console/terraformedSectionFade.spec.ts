/*
 * «МАРС ТЕРРАФОРМИРОВАН» — THE FLIP WAITS FOR THE SECTION'S FADE (FLAKE ZERO · class N — `terraformedScene.ts`
 * `sectionFadedOut`).
 *
 * Over a SECTION (the hand, the colonies, the Hydronetwork) the board is flipped back on only once the section is
 * fully transparent — read off its painted opacity, bounded. The bound counted from the call alone: on a software
 * renderer the fade's start was still PENDING on the compositor when it ran out, and the flip came under a section
 * still painted. While the fade is on its way (pending / running) the grace restarts, up to a hard ceiling.
 */
import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  registerTerraformedSceneProbes, resetTerraformedScene, seedTerraformedScene, terraformedSceneState,
} from '@/client/console/terraformedScene/terraformedScene';
import {registerBoardBeatLiveParams, registerBoardWatchableProbe, resetBoardBeatPark} from '@/client/console/boardBeatPark';
import {resetPlanetFocus} from '@/client/console/planetFocus';

function view(over: Partial<GameModel> = {}): PlayerViewModel {
  return {
    game: {
      temperature: 8, oxygenLevel: 14, oceans: 8, venusScaleLevel: 0, isTerraformed: false, generation: 9, lastSoloGeneration: 14,
      scaleBonusClaims: {}, ...over,
    },
    players: [{color: 'red'}, {color: 'blue'}],
  } as unknown as PlayerViewModel;
}

describe('the terraformed scene · the flip waits for the section\'s fade, counted from the fade', () => {
  let clock: ManualFlowClock;
  let main: HTMLElement;
  let section: HTMLElement;
  let fade: {pending: boolean, playState: string};

  beforeEach(() => {
    resetTerraformedScene();
    resetBoardBeatPark();
    resetPlanetFocus();
    clock = createManualClock(0);
    setFlowClock(clock);
    registerTerraformedSceneProbes({quiet: () => true, sectionCovered: () => true, playerOwned: () => false});
    registerBoardWatchableProbe(() => true);
    registerBoardBeatLiveParams(() => ({temperature: 8, oxygenLevel: 14, oceans: 9, venusScaleLevel: 0}));
    // The hand stands where the board stands; its fade's start is still PENDING on the compositor.
    main = document.createElement('div');
    main.className = 'con-main';
    section = document.createElement('div');
    section.className = 'con-hand';
    section.style.opacity = '1';
    fade = {pending: true, playState: 'running'};
    (section as unknown as {getAnimations: () => Array<unknown>}).getAnimations = () => [fade];
    main.appendChild(section);
    document.body.appendChild(main);
  });
  afterEach(() => {
    resetTerraformedScene();
    resetBoardBeatPark();
    resetPlanetFocus();
    registerTerraformedSceneProbes(undefined);
    main.remove();
    setFlowClock(undefined);
  });

  async function run(ms: number): Promise<void> {
    for (let t = 0; t < ms; t += 50) {
      clock.advance(50);
      for (let i = 0; i < 8; i++) {
        await Promise.resolve();
      }
    }
  }

  it('a fade still on its way past the old grace: no flip under the painted section — it flips once the section is gone', async () => {
    seedTerraformedScene(undefined, view());
    expect(seedTerraformedScene(view(), view({oceans: 9, isTerraformed: true}))).to.eq(true);
    await run(2500);
    expect(terraformedSceneState.phase).to.eq('recede');
    expect(terraformedSceneState.stage, 'the board stays off while the section still paints').to.eq('off');
    // The fade ran and the section is transparent: the flip follows on the next frame.
    fade = {pending: false, playState: 'finished'};
    section.style.opacity = '0';
    await run(200);
    expect(terraformedSceneState.stage).to.be.oneOf(['dark', 'lit']);
  });

  it('a fade that never ends is bounded by the ceiling', async () => {
    seedTerraformedScene(undefined, view());
    seedTerraformedScene(view(), view({oceans: 9, isTerraformed: true}));
    await run(4400);
    expect(terraformedSceneState.stage, 'the fade is still on its way').to.eq('off');
    await run(800);
    expect(terraformedSceneState.stage, 'a stuck style flips at the ceiling rather than holding the scene').to.not.eq('off');
  });
});
