import {expect} from 'chai';
import {ConsoleTask, TaskKind} from '../../src/client/console/consoleTaskRouter';
import {PromptSurface} from '../../src/client/console/consolePromptAdmission';
import {WorkspaceFrameKind} from '../../src/client/console/consoleWorkspaceStack';
import {ALL_WORKSPACE_KINDS, expectedScreenOwners, hostableStep, OWNER_SURFACES, ScreenOwner} from '../../src/client/console/screenDirector';
import {Ownership, ownerServes, QuestionFacts, servingOwnerOf} from '../../src/client/console/servingOwner';

/*
 * WHO SERVES THE QUESTION — ONE TOTAL FUNCTION (FREEZE ZERO, stage 2 — docs/claude/console/freeze-zero/PLAN.md § 8).
 *
 * The exit of the stage is «an exhaustive spec of the function over the whole product of its inputs». This is that
 * spec: every SHAPE of a question (the compiler refuses a kind missing from `SHAPES`) × every fact that can choose an
 * owner × every hold. What is proven for each point of the product:
 *
 *   · TOTAL — it answers, and the answer is «not asked» or exactly ONE owner with at most ONE hold;
 *   · A REFINEMENT OF THE TABLE — the owner is one the screen shadow's table allows for that shape (the table is
 *     what a whole suite of runs OBSERVED — `screenDirectorEvidence.json`), or a frame that earned the kind, or the
 *     board under the task's own placement: the function never invents an owner;
 *   · ONE ORDER OF HOLDS — aside · the board's branch · a scene · a claim · admission — and a hold never changes WHO
 *     serves, only whether they stand;
 *   · NOBODY IS NEVER THE ANSWER — the two kinds no surface was written for have the task host.
 */

/** Every shape of a question. A `Record` over `TaskKind`: a kind added to the router and missed here fails the build. */
const SHAPES: {[K in TaskKind]: ReadonlyArray<Extract<ConsoleTask, {kind: K}>>} = {
  actionMenu: [{kind: 'actionMenu'}],
  space: [{kind: 'space'}],
  choice: (['generic', 'contextual', 'wgt', 'confirm', 'deltaBonus', 'espionage', 'placementOrder'] as const).map((flavor) => ({kind: 'choice', flavor})),
  awardFunding: [{kind: 'awardFunding'}],
  player: [{kind: 'player'}],
  amount: [{kind: 'amount', flavor: 'generic'}, {kind: 'amount', flavor: 'delta'}],
  resource: [{kind: 'resource'}],
  distribute: [{kind: 'distribute', mode: 'resources'}, {kind: 'distribute', mode: 'production'}],
  payment: [{kind: 'payment'}],
  draftWait: [{kind: 'draftWait'}],
  cardSelect: (['draft', 'buy', 'target', 'distribute'] as const).map((mode) => ({kind: 'cardSelect', mode})),
  deckSelect: [{kind: 'deckSelect'}],
  handSelect: [{kind: 'handSelect'}],
  projectCard: (['playFromHand', 'standardProject', 'generic'] as const).map((mode) => ({kind: 'projectCard', mode})),
  colony: [{kind: 'colony'}],
  colonyBonus: [{kind: 'colonyBonus'}],
  party: [{kind: 'party'}],
  parliamentPhase: [{kind: 'parliamentPhase', stage: 'close'}],
  chairmanQuest: [{kind: 'chairmanQuest'}],
  externalDraw: [{kind: 'externalDraw'}],
  venusBonus: [{kind: 'venusBonus', mode: 'standard'}, {kind: 'venusBonus', mode: 'final'}],
  spendHeat: [{kind: 'spendHeat'}],
  botAttack: [{kind: 'botAttack'}],
  composite: [{kind: 'composite'}],
  initialDraft: [{kind: 'initialDraft'}],
  startSequence: [{kind: 'startSequence', prompt: 'corporationPlay'}, {kind: 'startSequence', prompt: 'preludeSelection'}],
  corpFirstAction: [{kind: 'corpFirstAction'}],
  aresGlobal: [{kind: 'aresGlobal'}],
  unknown: [{kind: 'unknown', inputType: 'somethingNew'}],
};
const ALL_SHAPES: ReadonlyArray<ConsoleTask> = Object.values(SHAPES).flat();

const QUIET: Omit<QuestionFacts, 'task'> = {
  startFlow: false, effectDecision: false, draftFrame: false, draftClaims: false, resolutionDraw: false,
  servingFrame: undefined, host: undefined, frames: [], handoff: [], aside: false, lateral: '', boardBranch: false, scene: '', claimHeld: false, blocks: {},
};

const BOOLS = [false, true];
const FRAMES: ReadonlyArray<WorkspaceFrameKind | undefined> = [undefined, 'hand', 'card-actions', 'parliament', 'hydro', 'colonies', 'start'];
const SURFACES: ReadonlyArray<PromptSurface> = ['host', 'scaleBonus', 'section', 'standaloneModal', 'scene', 'placement', 'followUp'];

/** The whole product of the facts (the holds are walked one at a time and all together). */
function* everyFacts(task: ConsoleTask | undefined): Generator<QuestionFacts> {
  for (const startFlow of BOOLS) {
    for (const effectDecision of BOOLS) {
      for (const draftFrame of BOOLS) {
        for (const draftClaims of BOOLS) {
          for (const resolutionDraw of BOOLS) {
            for (const servingFrame of FRAMES) {
              for (const host of FRAMES) {
                for (const aside of BOOLS) {
                  for (const boardBranch of BOOLS) {
                    for (const scene of ['', 'final-greenery']) {
                      for (const claimHeld of BOOLS) {
                        for (const blocked of BOOLS) {
                          const blocks = blocked ? Object.fromEntries(SURFACES.map((s) => [s, 'reveal'])) : {};
                          // (The stack that stands: nothing, or exactly the frames the facts name — both are walked.)
                          for (const standing of BOOLS) {
                            const frames = standing ? [...new Set([servingFrame, host].filter((k): k is WorkspaceFrameKind => k !== undefined))] : [];
                            yield {task, startFlow, effectDecision, draftFrame, draftClaims, resolutionDraw, servingFrame, host, frames, handoff: [], aside, lateral: '', boardBranch, scene, claimHeld, blocks};
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

const EVERY_OWNER: ReadonlySet<string> = new Set<string>([...ALL_WORKSPACE_KINDS, ...Object.keys(OWNER_SURFACES)]);
const shapeOf = (t: ConsoleTask): string => JSON.stringify(t);

describe('servingOwner — who serves the question: one total function', function() {
  // (The product is ≈ 1.6 million points; a budget for the walk, never a timing.)
  // eslint-disable-next-line no-invalid-this
  this.timeout(600_000);

  it('NOT ASKED: nothing asked, and the free action menu — whatever else is true', () => {
    for (const task of [undefined, {kind: 'actionMenu'} as ConsoleTask]) {
      for (const facts of everyFacts(task)) {
        expect(servingOwnerOf(facts)).to.deep.eq({asked: false});
      }
    }
  });

  it('TOTAL: every shape × every fact × every hold names exactly ONE known owner — never nobody, never a set, never a throw', () => {
    let points = 0;
    for (const task of ALL_SHAPES.filter((t) => t.kind !== 'actionMenu')) {
      for (const facts of everyFacts(task)) {
        points++;
        const o = servingOwnerOf(facts);
        if (!o.asked || !EVERY_OWNER.has(o.owner) || (o.hold !== undefined && o.hold.by === '')) {
          expect.fail(`${shapeOf(task)} with ${JSON.stringify({...facts, task: undefined})} → ${JSON.stringify(o)}`);
        }
      }
    }
    expect(points, 'the product was walked').to.be.greaterThan(1_000_000);
  });

  it('A REFINEMENT OF THE TABLE: the owner is one the screen shadow\'s row allows — or a frame that earned the kind, the board\'s branch, the opening', () => {
    for (const task of ALL_SHAPES.filter((t) => t.kind !== 'actionMenu')) {
      const row = expectedScreenOwners(task);
      for (const facts of everyFacts(task)) {
        const o = servingOwnerOf(facts) as Extract<Ownership, {asked: true}>;
        const allowed =
          (typeof row !== 'string' && (row as ReadonlyArray<ScreenOwner>).includes(o.owner)) ||
          (o.basis === 'serves' && o.owner === facts.servingFrame) ||
          (o.basis === 'branch' && o.owner === 'board' && facts.boardBranch) ||
          // The table scopes the opening's own questions OUT (`'start'`) — the function names the start for them.
          (o.basis === 'start' && o.owner === 'start') ||
          // …and the kinds it calls `unknown` have the task host here: nobody is never the answer.
          (o.basis === 'fallback' && o.owner === 'task');
        if (!allowed) {
          expect.fail(`${shapeOf(task)}: «${o.owner}» (${o.basis}) is not in the row ${JSON.stringify(row)} — facts ${JSON.stringify({...facts, task: undefined})}`);
        }
      }
    }
  });

  it('ONE ORDER OF HOLDS: aside · the board\'s branch · a scene · a claim · admission — the first that is true, and only that one', () => {
    for (const task of ALL_SHAPES.filter((t) => t.kind !== 'actionMenu')) {
      for (const facts of everyFacts(task)) {
        const o = servingOwnerOf(facts) as Extract<Ownership, {asked: true}>;
        // (Admission is a door: an owner whose frame already stands is not held at it — the board's branch always enters.)
        const inAlready = !facts.boardBranch && (facts.frames as ReadonlyArray<string>).includes(o.owner);
        const admitted = o.admission === undefined || inAlready || (facts.blocks[o.admission] ?? '') === '';
        // (…and so is «set aside»: the player standing on the surface that answers is not away from it.)
        const onItsSurface = (facts.frames as ReadonlyArray<string>).includes(o.owner);
        const expected =
          facts.aside && (facts.boardBranch || !onItsSurface) ? 'aside' :
            facts.boardBranch ? (admitted ? undefined : 'admission') :
              facts.scene !== '' ? 'scene' :
                facts.claimHeld ? 'claim' :
                  admitted ? undefined : 'admission';
        if (o.hold?.kind !== expected) {
          expect.fail(`${shapeOf(task)}: held by ${JSON.stringify(o.hold)} — expected «${expected}» for ${JSON.stringify({...facts, task: undefined})}`);
        }
        expect(ownerServes(o)).to.eq(expected === undefined);
      }
    }
  });

  it('A HOLD NEVER CHANGES WHO SERVES — only whether they stand (the board\'s branch is an owner, not a hold)', () => {
    for (const task of ALL_SHAPES.filter((t) => t.kind !== 'actionMenu')) {
      for (const startFlow of BOOLS) {
        for (const servingFrame of FRAMES) {
          for (const host of FRAMES) {
            const facts: QuestionFacts = {...QUIET, task, startFlow, servingFrame, host, effectDecision: true, draftFrame: true, draftClaims: true};
            const free = servingOwnerOf(facts) as Extract<Ownership, {asked: true}>;
            for (const held of [{aside: true}, {scene: 'gov-scale-focus'}, {claimHeld: true}, {blocks: {[free.admission ?? 'host']: 'played-hero'}}] as Array<Partial<QuestionFacts>>) {
              const o = servingOwnerOf({...facts, ...held}) as Extract<Ownership, {asked: true}>;
              expect({owner: o.owner, host: o.host, basis: o.basis}, `${shapeOf(task)} held by ${JSON.stringify(held)}`)
                .to.deep.eq({owner: free.owner, host: free.host, basis: free.basis});
            }
            const branch = servingOwnerOf({...facts, boardBranch: true}) as Extract<Ownership, {asked: true}>;
            expect(branch).to.deep.include({owner: 'board', basis: 'branch'});
          }
        }
      }
    }
  });

  it('the fact that CHOOSES is read, one row at a time', () => {
    const owner = (task: ConsoleTask, over: Partial<QuestionFacts> = {}) => {
      const o = servingOwnerOf({...QUIET, task, ...over});
      return o.asked ? `${o.owner}${o.host !== undefined ? `@${o.host}` : ''}` : 'free';
    };
    // A contextual choice is the decision's when a decision can be built for it — else the task host's.
    expect(owner({kind: 'choice', flavor: 'contextual'}, {effectDecision: true})).to.eq('decision');
    expect(owner({kind: 'choice', flavor: 'contextual'})).to.eq('task');
    // The opening's own questions are the start's; the same kinds past it have their own surfaces.
    expect(owner({kind: 'corpFirstAction'}, {startFlow: true})).to.eq('start');
    expect(owner({kind: 'corpFirstAction'})).to.eq('corp-first');
    expect(owner({kind: 'choice', flavor: 'placementOrder'}, {startFlow: true})).to.eq('start');
    expect(owner({kind: 'choice', flavor: 'placementOrder'}, {host: 'hand'}), 'mid-game: the task host, in the chain\'s zone').to.eq('task@hand');
    // The research buy is the draft's while the draft claims it.
    expect(owner({kind: 'cardSelect', mode: 'buy'}, {draftClaims: true})).to.eq('draft');
    expect(owner({kind: 'cardSelect', mode: 'buy'})).to.eq('task');
    expect(owner({kind: 'draftWait'}, {draftFrame: true})).to.eq('draft');
    expect(owner({kind: 'draftWait'})).to.eq('draft-wait');
    // A resolution's draw is the sitting's; any other has its own workspace.
    expect(owner({kind: 'externalDraw'}, {resolutionDraw: true}), 'the same surface, in the stage of the sitting').to.eq('external-draw@parliament');
    expect(owner({kind: 'externalDraw'})).to.eq('external-draw');
    // A colony bonus another seat's trade paid is never a step of somebody's flow.
    expect(owner({kind: 'colonyBonus'}, {host: 'hand'})).to.eq('colonies');
    expect(owner({kind: 'distribute', mode: 'production'})).to.eq('prod-loss');
    // A step of a flow stands in that flow's zone; a frame never hosts itself.
    expect(owner({kind: 'payment'}, {host: 'card-actions'})).to.eq('task@card-actions');
    expect(owner({kind: 'colony'}, {host: 'hand'})).to.eq('colonies@hand');
    expect(owner({kind: 'handSelect'}, {host: 'hand'})).to.eq('hand');
    // A frame that EARNED the kind answers before the kind's own row (the colony resolution's discard).
    expect(owner({kind: 'handSelect'}, {servingFrame: 'colonies'})).to.eq('colonies');
    // ADMISSION IS A DOOR, NOT A PRESENCE: the Parliament already on the stack stands through a scene of its own sitting;
    // one still to enter waits at the door.
    const blocked = {blocks: {section: 'presentation'}};
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, ...blocked, frames: ['parliament']})).to.not.have.property('hold');
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, ...blocked})).to.deep.include({hold: {kind: 'admission', by: 'presentation'}});
    // THE SCREEN BEING HANDED OVER to the owner is a hold of the owner — the leaving surface is what stands.
    expect(servingOwnerOf({...QUIET, task: {kind: 'cardSelect', mode: 'buy'}, draftClaims: true, host: 'parliament', handoff: ['draft']}))
      .to.deep.include({owner: 'draft', hold: {kind: 'scene', by: 'handoff'}});
    // THE PLAYER'S OWN LOOK OVER A LIVE PLACEMENT (the hand opened over the cells): the board is still the owner, and
    // it waits for the player — whatever else would hold it.
    expect(servingOwnerOf({...QUIET, task: {kind: 'space'}, boardBranch: true, lateral: 'hand', blocks: {placement: 'remote-landing'}}))
      .to.deep.include({owner: 'board', basis: 'branch', hold: {kind: 'aside', by: 'lateral:hand'}});
    expect(servingOwnerOf({...QUIET, task: {kind: 'space'}, lateral: 'hand'})).to.deep.include({hold: {kind: 'aside', by: 'lateral:hand'}});
    // SET ASIDE holds an owner the player is AWAY from — never the workspace they stand on.
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, aside: true})).to.deep.include({owner: 'parliament', hold: {kind: 'aside', by: 'the player set it aside'}});
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, aside: true, frames: ['parliament']})).to.not.have.property('hold');
    // A PHASE ROOT is never a step in somebody's zone.
    expect(owner({kind: 'cardSelect', mode: 'buy'}, {draftClaims: true, host: 'parliament'})).to.eq('draft');
    expect(owner({kind: 'cardSelect', mode: 'draft'}, {host: 'hand'})).to.eq('draft');
    // A modal of its own is never a step of somebody's flow.
    expect(owner({kind: 'botAttack'}, {host: 'parliament'})).to.eq('bot-attack');
    expect(owner({kind: 'spendHeat'}, {host: 'card-actions'})).to.eq('lanes');
  });

  it('the hosted owners are the kinds the shadow calls hostable — a host never carries what cannot be a step', () => {
    for (const task of ALL_SHAPES.filter((t) => t.kind !== 'actionMenu')) {
      const o = servingOwnerOf({...QUIET, task, host: 'card-actions'}) as Extract<Ownership, {asked: true}>;
      if (o.host !== undefined) {
        expect(hostableStep(task.kind), `${shapeOf(task)} is hosted as a step`).to.eq(true);
      }
    }
  });
});
