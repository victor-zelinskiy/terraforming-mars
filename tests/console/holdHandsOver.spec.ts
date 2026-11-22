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

  /*
   * THE CHAIN's OWN HOLD stands above the chain's own bounded waits, and says when it is the player's
   * (`animation-hold/ceiling/card-reaction` under a green `console-atmospheric-enhancers` E — the default 35 s ceiling
   * ended, as «a leaked hold?», a chain that was waiting out the rating's story on a stage the player kept covered,
   * and its `expire` aborted it: the table's answer never told).
   */
  it('the reaction\'s hold keeps its ceiling above every wait it stands through, and names the player\'s time', () => {
    const director = read('console/cardReaction/cardReactionDirector.ts');
    const num = (name: string): number => Number((new RegExp(`const ${name} = ([0-9_]+);`).exec(director) ?? [])[1]?.replace(/_/g, ''));
    const blocking = num('BLOCKING_QUIET_MAX_MS');
    const sitting = num('SITTING_QUIET_MAX_MS');
    const decision = num('DECISION_WAIT_MAX_MS');
    const stageDue = Number((/export const SCALE_STEP_STAGE_DUE_MS = ([0-9_]+);/.exec(read('console/scaleStepReward/scaleStepRewardModel.ts')) ?? [])[1]?.replace(/_/g, ''));
    const defaultMax = Number((/export const DEFAULT_MAX_HOLD_MS = ([0-9_]+);/.exec(read('components/presentation/animationHold.ts')) ?? [])[1]?.replace(/_/g, ''));
    expect([blocking, sitting, decision, stageDue, defaultMax].every((n) => Number.isFinite(n) && n > 0), 'the bounds are read').is.true;
    // The ceiling is written as the sum of the waits' bounds with the default above it — never a bare number.
    expect(director).to.contain('const CARD_REACTION_HOLD_MAX_MS = 4 * BLOCKING_QUIET_MAX_MS + SITTING_QUIET_MAX_MS + SCALE_STEP_STAGE_DUE_MS + BLOCKING_QUIET_MAX_MS +');
    expect(director).to.match(/registerAnimationHoldSupplier\('card-reaction'[\s\S]{0,200}maxHoldMs: CARD_REACTION_HOLD_MAX_MS,/);
    // The longest single wait it stands through (the rating's story on a covered stage) is below the hold's ceiling.
    expect(stageDue + blocking, 'the covered rating\'s wait').to.be.lessThan(4 * blocking + sitting + stageDue + blocking + decision + defaultMax);
    expect(stageDue + blocking, '…which the DEFAULT ceiling did not clear — the class').to.be.greaterThan(defaultMax);
    // …and the hold says whose time a wait on the player is.
    expect(director).to.match(/heldForPlayer: \(\) => \(cardReactionState\.phase === 'waiting' && cardReactionState\.waitingOnPlayer !== ''/);
    expect(director).to.contain('cardReactionState.waitingOnPlayer = covered ? ');
    expect(director).to.contain('cardReactionState.waitingOnPlayer = \'the decision at the centre\';');
  });

  /*
   * A TRAVERSAL PARKED ON A STOP IS THE PLAYER'S TIME (`wait-graph/ceiling/card-reaction:hydro-story-quiet` under green
   * `console-hydro-copied-colony` and `console-hydro-stage-bound-repeat`): the chain's wait for «the Hydronetwork's
   * story» stood through the player's own thinking at an interactive stop and ended on its bound as a defect.
   */
  it('the chain\'s wait for the Hydronetwork names the PLAYER while the traversal is parked on a stop', () => {
    const director = read('console/cardReaction/cardReactionDirector.ts');
    const body = director.slice(director.indexOf('async function waitHydroStoryQuiet('), director.indexOf('async function waitRatingStoryQuiet('));
    expect(body).to.contain('const parked = (): boolean => hydroTraversalPaused() && !isHydroMarkerActive();');
    expect(body).to.match(/id: 'card-reaction:hydro-stop-answered'[\s\S]{0,260}target: 'player', planned: /);
    // …and the story's own motion keeps its bound as a defect's: the motion node carries no `planned`.
    expect(body).to.match(/beginCeilingWait\(\{id: 'card-reaction:hydro-story-quiet', owner: 'cardReactionDirector', what: 'the hydronetwork story quiet', maxMs: BLOCKING_QUIET_MAX_MS\}\)/);
    // At the bound the node that stands is the one that ends on it — never the motion's ceiling over a parked stop.
    expect(body).to.match(/if \(players\) \{\s+wait\?\.end\(\);\s+withPlayer\?\.ceiling\(\);/);
  });

  it('the card reaction\'s chain waits out the scenes that PLAY — never a bare count of blocking holds', () => {
    const director = read('console/cardReaction/cardReactionDirector.ts');
    expect(director).to.match(/async function waitBlockingQuiet[\s\S]{0,400}blockingHoldsPlaying\(\)\.length > 0/);
    expect(director, 'the bare count would wait for a scene that waits for the chain').to.not.match(/blockingAnimationHoldCount\(/);
  });
});
