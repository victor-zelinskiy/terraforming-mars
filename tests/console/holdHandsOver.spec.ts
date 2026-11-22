import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A DOOR HELD SHUT IS NOT A SCENE PLAYING — the wiring (`AnimationHoldOptions.handsOver`, `blockingHoldsPlaying`).
 *
 * The generation scene keeps its blocking hold through the screen's handoff (`rise`): what the screen still owes the
 * player finishes UNDER it. The card reaction's chain is such a story — and it waited for every blocking hold, the
 * scene's included, while the scene waited for the chain's own hold: a mutual wait ended only by the chain's 12 s
 * ceiling (`wait-graph/ceiling/card-reaction:blocking-quiet`, `console-terraforming-deal` (D) on CI, 2026-11-22).
 * The pure half is `tests/client/components/presentation/animationHold.spec.ts`; this reads the two ends.
 */
describe('a hold that hands the screen over is not waited out (the wiring)', () => {
  const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '../../src/client', file), 'utf8');

  it('the generation scene says when it only holds the door: its `rise` is the handoff', () => {
    const scene = read('console/generationScene/generationScene.ts');
    expect(scene).to.match(/registerAnimationHoldSupplier\('generation-scene'[\s\S]{0,600}handsOver: \(\) => generationSceneState\.phase === 'rise'/);
    // …and `rise` is exactly the wait for the handoff: set before it, left only by the scene's end.
    expect(scene).to.match(/generationSceneState\.phase = 'rise';[\s\S]{0,900}await riseHandoff\('generation-rise', into\)/);
  });

  it('the card reaction\'s chain waits out the scenes that PLAY — never a bare count of blocking holds', () => {
    const director = read('console/cardReaction/cardReactionDirector.ts');
    expect(director).to.match(/async function waitBlockingQuiet[\s\S]{0,400}blockingHoldsPlaying\(\)\.length > 0/);
    expect(director, 'the bare count would wait for a scene that waits for the chain').to.not.match(/blockingAnimationHoldCount\(/);
  });
});
