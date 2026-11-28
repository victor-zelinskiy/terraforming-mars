import {expect} from 'chai';
import {ConsoleTask, TaskKind} from '../../src/client/console/consoleTaskRouter';
import {PromptSurface} from '../../src/client/console/consolePromptAdmission';
import {WorkspaceFrameKind} from '../../src/client/console/consoleWorkspaceStack';
import {ALL_WORKSPACE_KINDS, expectedScreenOwners, hostableStep, OWNER_SURFACES, ScreenOwner} from '../../src/client/console/screenDirector';
import {bandRungOf, Ownership, ownerServes, QuestionFacts, questionFactsDigest, servingOwnerOf} from '../../src/client/console/servingOwner';

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
  client: false, startYielded: false, startFlow: false, effectDecision: false, draftFrame: false, draftClaims: false, resolutionDraw: false,
  servingFrame: undefined, host: undefined, frames: [], handoff: [], aside: false, lateral: '', boardBranch: false, scene: '', claimHeld: false, blocks: {},
};

const BOOLS = [false, true];
const FRAMES: ReadonlyArray<WorkspaceFrameKind | undefined> = [undefined, 'hand', 'card-actions', 'parliament', 'hydro', 'colonies', 'start'];
const SURFACES: ReadonlyArray<PromptSurface> = ['host', 'scaleBonus', 'section', 'standaloneModal', 'scene', 'placement', 'followUp'];

/** The two facts that stand apart from the rest of the product: the client's own question · the opening's yielded scene. */
const APART: ReadonlyArray<{client: boolean, startYielded: boolean}> = [
  {client: false, startYielded: false}, {client: true, startYielded: false}, {client: false, startYielded: true},
];

/** The whole product of the facts (the holds are walked one at a time and all together). */
function* everyFacts(task: ConsoleTask | undefined): Generator<QuestionFacts> {
  for (const apart of APART) {
    yield* everyFactsOf(task, apart);
  }
}

function* everyFactsOf(task: ConsoleTask | undefined, apart: {client: boolean, startYielded: boolean}): Generator<QuestionFacts> {
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
                            yield {task, ...apart, startFlow, effectDecision, draftFrame, draftClaims, resolutionDraw, servingFrame, host, frames, handoff: [], aside, lateral: '', boardBranch, scene, claimHeld, blocks};
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
  // (The product is ≈ 4.7 million points; a budget for the walk, never a timing.)
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
          (o.basis === 'fallback' && o.owner === 'task') ||
          // THE CLIENT's OWN QUESTION is the task host's (or a frame's that hosts it), whatever shape it borrows.
          (facts.client && o.owner === 'task');
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
        const admitted = o.admission === undefined || inAlready ||
          ((facts.blocks[o.admission] ?? '') === '' && (o.door === undefined || (facts.blocks[o.door] ?? '') === ''));
        // (…the board under the question's own placement is an owner of its own, with the board's door.)
        if (facts.client && o.owner !== 'board') {
          expect(o.admission, 'nothing admits the client\'s own question').to.eq(undefined);
        }
        const yielded = facts.startYielded && o.owner === 'start';
        // (…and so is «set aside»: the player standing on the surface that answers is not away from it.)
        const onItsSurface = (facts.frames as ReadonlyArray<string>).includes(o.owner);
        // (…and the sitting's draw, hosted in the Parliament's stage, while another frame still covers it — the claim of
        // that frame: issue #110, the sitting's colony step on top.)
        const top = facts.frames[facts.frames.length - 1];
        const coveredDraw = task.kind === 'externalDraw' && facts.resolutionDraw && o.host === 'parliament' && top !== undefined &&
          top !== 'parliament' && top !== o.owner && (facts.frames as ReadonlyArray<string>).includes('parliament');
        const expected =
          facts.aside && (facts.boardBranch || !onItsSurface) ? 'aside' :
            facts.boardBranch ? (admitted ? undefined : 'admission') :
              facts.scene !== '' || yielded ? 'scene' :
                facts.claimHeld || coveredDraw ? 'claim' :
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
    // …but a kind a PROMPT SURFACE draws is drawn by that surface, hosted by the frame that earned it — a phase root too.
    expect(owner({kind: 'payment'}, {servingFrame: 'draft', draftFrame: true, frames: ['draft']}), 'the draft\'s post-buy payment').to.eq('task@draft');
    expect(owner({kind: 'deckSelect'}, {servingFrame: 'hydro', host: 'card-actions'}), 'the Hydronetwork\'s bonus pick').to.eq('deck-pick@hydro');
    expect(owner({kind: 'cardSelect', mode: 'target'}, {servingFrame: 'hydro'})).to.eq('task@hydro');
    // (A modal of its own is never a step, whoever earned its kind.)
    expect(owner({kind: 'botAttack'}, {servingFrame: 'parliament'})).to.eq('bot-attack');
    // ADMISSION IS A DOOR, NOT A PRESENCE: the Parliament already on the stack stands through a scene of its own sitting;
    // one still to enter waits at the door.
    const blocked = {blocks: {section: 'presentation'}};
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, ...blocked, frames: ['parliament']})).to.not.have.property('hold');
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, ...blocked})).to.deep.include({hold: {kind: 'admission', by: 'presentation'}});
    // THE ENERGY's TURN INTO HEAT holds what is still to enter, never a workspace standing (CI's bottle game 281, #138).
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, scene: 'energy-conversion', frames: ['parliament']}),
      'the sitting standing keeps its screen through the conversion').to.not.have.property('hold');
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, scene: 'energy-conversion'}),
      'a sitting still to enter waits for it').to.deep.include({hold: {kind: 'scene', by: 'energy-conversion'}});
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, scene: 'final-greenery', frames: ['parliament']}),
      'a scene that takes the screen whole holds the standing one too').to.deep.include({hold: {kind: 'scene', by: 'final-greenery'}});
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
    // THE ROUTER's DOOR: a workspace the router opens enters through the arrival chain's admission too — and a
    // workspace that already stands is past both.
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, blocks: {followUp: 'card-arrival'}}))
      .to.deep.include({owner: 'parliament', hold: {kind: 'admission', by: 'card-arrival'}});
    expect(servingOwnerOf({...QUIET, task: {kind: 'parliamentPhase', stage: 'close'}, blocks: {followUp: 'card-arrival'}, frames: ['parliament']})).to.not.have.property('hold');
    expect(servingOwnerOf({...QUIET, task: {kind: 'colony'}, blocks: {section: 'reveal', followUp: 'card-arrival'}}))
      .to.deep.include({hold: {kind: 'admission', by: 'reveal'}});
    // …AND A SURFACE THAT STANDS BY ITS OWN LIFETIME OUTSIDE THE STACK IS PAST THE DOOR TOO (`standing`): a
    // resolution's draw embedded in the sitting's stage has no frame — its cards arriving raise the door's block
    // behind it and it keeps the screen (the band's last FALLBACK of the suite: «held: admission > externalDraw»).
    const sittingDraw = {...QUIET, task: {kind: 'externalDraw'} as const, resolutionDraw: true, frames: ['parliament'] as const, blocks: {followUp: 'card-arrival'}};
    expect(servingOwnerOf(sittingDraw), 'still to enter: held at the door').to.deep.include({owner: 'external-draw', host: 'parliament', hold: {kind: 'admission', by: 'card-arrival'}});
    expect(servingOwnerOf({...sittingDraw, standing: ['external-draw']}), 'standing in the stage: let in').to.deep.include({owner: 'external-draw', host: 'parliament'}).and.not.have.property('hold');
    // (It answers the ADMISSION step only: a question set aside is aside, whatever stands outside the stack.)
    expect(servingOwnerOf({...sittingDraw, standing: ['external-draw'], aside: true})).to.deep.include({hold: {kind: 'aside', by: 'the player set it aside'}});
    // (…and only for the owner it names.)
    expect(servingOwnerOf({...QUIET, task: {kind: 'colony'}, blocks: {section: 'reveal'}, standing: ['external-draw']})).to.deep.include({hold: {kind: 'admission', by: 'reveal'}});
    expect(questionFactsDigest({...sittingDraw, standing: ['external-draw']}), 'the fact is in the evidence a disagreement is read by').to.contain('standing [external-draw]');
    // …AND BEFORE THE STAGE's ZONE IS PUBLISHED THE DRAW IS HELD BY ITS HOST's CLAIM (the embed contract, rule 4 — it
    // renders nowhere; the sitting walks its beats and the press is the sitting's). The shell's fact is `claimHeld`
    // (`routerController.questionFacts` — a resolution's draw with no embed target yet). Without it the function said
    // «the draw serves» for the whole walk: thirty-three presses of one whole game under `own:externalDraw` on the
    // Parliament's rung (the autopilot's passes, bottle and browser alike, 2026-11-24).
    // …AND THE SITTING's OWN TILE waits behind its door to the board («К полю» — `parliamentPlacementDoorClosed`, the
    // placement's second hold): the shell names it as the placement's block, and the board is held as said — whatever
    // screen of the player's own stands over the sitting.
    const behindTheDoor = servingOwnerOf({...QUIET, task: {kind: 'space'}, frames: ['parliament', 'colonies'], blocks: {placement: 'sitting-door'}});
    expect(behindTheDoor).to.deep.include({owner: 'board', hold: {kind: 'admission', by: 'sitting-door'}});
    expect(bandRungOf(behindTheDoor), 'the press is the player\'s, where they stand').to.eq('held:admission');
    const walking = {...QUIET, task: {kind: 'externalDraw'} as const, resolutionDraw: true, frames: ['parliament'] as const, claimHeld: true};
    expect(servingOwnerOf(walking)).to.deep.include({owner: 'external-draw', host: 'parliament', hold: {kind: 'claim', by: 'parliament'}});
    expect(bandRungOf(servingOwnerOf(walking)), 'the press is the player\'s — the sitting\'s section takes it').to.eq('held:claim');
    expect(bandRungOf(servingOwnerOf({...walking, claimHeld: false, standing: ['external-draw']})), 'the zone stands: the draw\'s own rung').to.eq('own:externalDraw');
    // THE DRAFT's WAITING BANNER (no draft frame) is a surface of the host's family: under the announce's gate it waits.
    expect(servingOwnerOf({...QUIET, task: {kind: 'draftWait'}})).to.deep.include({owner: 'draft-wait'}).and.not.have.property('hold');
    expect(servingOwnerOf({...QUIET, task: {kind: 'draftWait'}, blocks: {host: 'announce-gate'}})).to.deep.include({owner: 'draft-wait', hold: {kind: 'admission', by: 'announce-gate'}});
    // THE PLAYER'S OWN LOOK OVER THE OPENING: the start is still the owner, and it waits for the player.
    expect(servingOwnerOf({...QUIET, task: ALL_SHAPES.find((t) => t.kind === 'startSequence'), startFlow: true, frames: ['start', 'colonies'], lateral: 'colonies'}))
      .to.deep.include({owner: 'start', hold: {kind: 'aside', by: 'lateral:colonies'}});
    // THE CLIENT's OWN QUESTION: the task host's, in the flow's zone, with no door — and the player may still set it aside.
    expect(servingOwnerOf({...QUIET, task: {kind: 'payment'}, client: true, blocks: {host: 'card-arrival'}})).to.deep.eq({asked: true, owner: 'task', basis: 'row'});
    expect(servingOwnerOf({...QUIET, task: {kind: 'payment'}, client: true, host: 'standard-projects', frames: ['standard-projects']}))
      .to.deep.eq({asked: true, owner: 'task', basis: 'row', host: 'standard-projects'});
    expect(servingOwnerOf({...QUIET, task: {kind: 'cardSelect', mode: 'target'}, client: true, aside: true})).to.deep.include({hold: {kind: 'aside', by: 'the player set it aside'}});
    // THE OPENING THAT YIELDED ITS SCENE still owns its question, and waits; nobody else is touched by it.
    expect(servingOwnerOf({...QUIET, task: ALL_SHAPES.find((t) => t.kind === 'startSequence'), startFlow: true, startYielded: true, frames: ['start']}))
      .to.deep.include({owner: 'start', hold: {kind: 'scene', by: 'start-yielded'}});
    expect(servingOwnerOf({...QUIET, task: {kind: 'payment'}, startFlow: true, startYielded: true, host: 'start', frames: ['start']})).to.not.have.property('hold');
    // THE OPENING THAT HAS NOT COME BACK YET — a bonus-action window ended on an answer that carries the acting
    // workspace's outcome and the opening's next question («Фора» → «Поиск жизни»: the verdict stands, the second
    // prelude is already asked — game 906 of the third hundred): the start owns it and waits behind that outcome.
    expect(servingOwnerOf({...QUIET, task: ALL_SHAPES.find((t) => t.kind === 'startSequence'), startBehind: 'card-actions', host: 'card-actions', frames: ['card-actions']}))
      .to.deep.include({owner: 'start', hold: {kind: 'scene', by: 'outcome:card-actions'}});
    expect(servingOwnerOf({...QUIET, task: {kind: 'payment'}, startBehind: 'card-actions', host: 'card-actions', frames: ['card-actions']})).to.not.have.property('hold');
    // A STEP WHOSE OWN FRAME STANDS WITH NO ZONE YET (game 1013 — the colony step of a law, pushed under a card the
    // player was reading, the sitting's stage still to publish its field): the question is the frame's, and it waits.
    expect(servingOwnerOf({...QUIET, task: {kind: 'colony'}, servingFrame: 'colonies', host: 'colonies', frames: ['parliament', 'colonies'], zoneAwaited: 'colonies'}))
      .to.deep.include({owner: 'colonies', hold: {kind: 'claim', by: 'zone of colonies'}});
    expect(servingOwnerOf({...QUIET, task: {kind: 'colony'}, servingFrame: 'colonies', host: 'colonies', frames: ['parliament', 'colonies']})).to.not.have.property('hold');
    // A PHASE WORKSPACE STILL TELLING ITS CONCLUSION (CI #153 · #154 — the draft's closing beat over the next generation's
    // first questions): another owner's question waits for it to leave; its own step is its own.
    const receipt = {...QUIET, draftFrame: true, frames: ['draft'] as Array<WorkspaceFrameKind>, concluding: 'draft'};
    expect(servingOwnerOf({...receipt, task: {kind: 'corpFirstAction'}})).to.deep.include({owner: 'corp-first', hold: {kind: 'scene', by: 'concluding:draft'}});
    expect(bandRungOf(servingOwnerOf({...receipt, task: {kind: 'corpFirstAction'}})), 'the pad goes to the screen that stands').to.eq('held:scene');
    expect(servingOwnerOf({...receipt, task: {kind: 'colony'}})).to.deep.include({owner: 'colonies', hold: {kind: 'scene', by: 'concluding:draft'}});
    expect(servingOwnerOf({...receipt, task: {kind: 'cardSelect', mode: 'buy'}, draftClaims: true}), 'the draft\'s own question').to.not.have.property('hold');
    expect(questionFactsDigest({...receipt, task: {kind: 'colony'}})).to.contain('concluding draft');
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
