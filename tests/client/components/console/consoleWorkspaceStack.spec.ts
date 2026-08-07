import {expect} from 'chai';
import {
  FrameAnchor,
  WORKSPACE_FRAME_KINDS,
  WORKSPACE_STACK_SCHEMA,
  collapseWorkspaceStack,
  frameServing,
  hydrateWorkspaceStack,
  popWorkspaceFrame,
  descendWorkspaceFrame,
  enterWorkspace,
  goBoardHome,
  leaveWorkspace,
  probeWorkspacePresence,
  pushWorkspaceFrame,
  reconcileWorkspaceStack,
  resetWorkspaceStack,
  restoreWorkspaceStack,
  serializeWorkspaceStack,
  setWorkspaceFramePhase,
  setWorkspaceFrameSlot,
  setWorkspaceFrameStage,
  stackServes,
  truncateWorkspaceStack,
  workspaceFrameIndex,
  workspaceFrameMounted,
  workspaceFrameRoot,
  workspaceFrameSelector,
  workspaceFrameTarget,
  workspacePresentDepth,
  workspaceStackAcceptsInput,
  workspaceStackBack,
  workspaceStackBackVerb,
  workspaceStackCollapsed,
  workspaceStackCrumb,
  workspaceStackDepth,
  workspaceStackSection,
  workspaceStackSheet,
  workspaceStackState,
  workspaceStackTop,
} from '@/client/console/consoleWorkspaceStack';
import {buildWorkspaceHeader} from '@/client/console/consoleWorkspaceHeader';

const ALWAYS: FrameAnchor = {type: 'always'};

/** The hand, with the player descended into the card they are playing. */
function openHandPlayingTradingColony(): void {
  pushWorkspaceFrame({
    kind: 'hand', subject: '', stage: '', phase: 'browse',
    serves: ['projectCard'], anchor: ALWAYS,
  });
  descendWorkspaceFrame('hand', 'Trading Colony', 'Playing',
    {type: 'cardInHand', card: 'Trading Colony'});
}

/** The card is played and now owes a colony — the step the bug lived in. */
function addColonyStep(): void {
  setWorkspaceFramePhase('hand', 'committed');
  pushWorkspaceFrame({
    kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
    serves: ['colony'], anchor: {type: 'prompt', promptType: 'colony'},
  });
}

describe('consoleWorkspaceStack — the ONE depth model of a workspace', () => {
  // Module state is bundle-shared under mochapack: never leave a stack behind.
  afterEach(() => resetWorkspaceStack());

  it('starts empty — no frame, no crumb, no opinion about B', () => {
    expect(workspaceStackDepth()).to.eq(0);
    expect(workspaceStackTop()).to.eq(undefined);
    expect(workspaceStackCrumb()).to.eq(undefined);
    expect(workspaceStackBackVerb()).to.eq(undefined);
    expect(workspaceStackBack()).to.eq(undefined);
    expect(workspaceStackAcceptsInput()).to.eq(true);
  });

  /*
   * INVARIANT 1 — PRESENCE IS DERIVED FROM THE STACK.
   *
   * This is the regression fence for the soft-lock that cost a turn: playing
   * «Торговая колония» from the hand, B on the embedded colonies closed the hand
   * section while a guard kept the stage CLAIM alive, so the flow owned a zone
   * whose host was gone — colonies rendered nowhere, the stranded self-heal
   * could not fire, nothing was deferred. Here that state is not expressible:
   * a nested frame IMPLIES its parent is mounted, because both facts are the
   * same fact.
   */
  it('a nested frame implies its parent is mounted — the two truths are one', () => {
    pushWorkspaceFrame({
      kind: 'hand', subject: 'Trading Colony', stage: 'Playing', phase: 'committed',
      serves: ['projectCard'], anchor: ALWAYS,
    });
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: {type: 'prompt', promptType: 'colony'},
    });
    expect(workspaceFrameMounted('colonies'), 'the child is mounted').to.eq(true);
    expect(workspaceFrameMounted('hand'), 'so its host must be too').to.eq(true);
    // …and the only way to unmount the host is to drop the child with it.
    popWorkspaceFrame();
    expect(workspaceFrameMounted('colonies')).to.eq(false);
    expect(workspaceFrameMounted('hand')).to.eq(true);
  });

  it('the teleport target is the zone published by the frame BELOW', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    // Ownership ≠ readiness (embed rule 4): claimed, but the zone is not up.
    expect(workspaceFrameTarget('colonies')).to.eq(undefined);
    setWorkspaceFrameSlot('hand', '[data-embed-slot="hand-play"]');
    expect(workspaceFrameTarget('colonies')).to.eq('[data-embed-slot="hand-play"]');
    // The ROOT frame stands in its own band — it teleports nowhere.
    expect(workspaceFrameTarget('hand')).to.eq(undefined);
  });

  it('re-entering a kind already in the stack truncates to it instead of nesting', () => {
    openHandPlayingTradingColony();
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: ALWAYS,
    });
    expect(workspaceStackDepth()).to.eq(2);
    pushWorkspaceFrame({
      kind: 'hand', subject: '', stage: '', phase: 'browse',
      serves: ['projectCard'], anchor: ALWAYS,
    });
    expect(workspaceStackDepth(), 'you cannot be inside the same workspace twice').to.eq(1);
    expect(workspaceFrameIndex('colonies')).to.eq(-1);
  });

  // ── B ─────────────────────────────────────────────────────────────────────

  it('B is derived from the top frame phase — never hand-rolled', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: '', stage: '', phase: 'browse',
      serves: [], anchor: ALWAYS,
    });
    expect(workspaceStackBackVerb()).to.eq('close');
    setWorkspaceFramePhase('card-actions', 'configure');
    expect(workspaceStackBackVerb()).to.eq('back');
    setWorkspaceFramePhase('card-actions', 'executing');
    expect(workspaceStackBackVerb()).to.eq('none');
    setWorkspaceFramePhase('card-actions', 'committed');
    expect(workspaceStackBackVerb()).to.eq('collapse');
  });

  /*
   * ONE logical level per press — and the level below a descent is the screen's
   * own browse layer, not "no screen". Popping the frame there would throw away
   * the workspace the player is still standing in.
   */
  it('B folds a descent to its browse layer, and only then leaves the frame', () => {
    openHandPlayingTradingColony();
    expect(workspaceStackDepth()).to.eq(1);
    expect(workspaceStackBack()).to.eq('back');
    expect(workspaceStackDepth(), 'still in the hand').to.eq(1);
    expect(workspaceStackTop()?.phase).to.eq('browse');
    expect(workspaceStackTop()?.subject, 'the carried card is put down').to.eq('');
    expect(workspaceStackBack()).to.eq('close');
    expect(workspaceStackDepth()).to.eq(0);
  });

  it('B on a nested step leaves the step, not the whole flow', () => {
    openHandPlayingTradingColony();
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'browse',
      serves: ['colony'], anchor: ALWAYS,
    });
    expect(workspaceStackBack()).to.eq('close');
    expect(workspaceStackDepth(), 'back inside the hand').to.eq(1);
    expect(workspaceStackTop()?.subject, 'the carried card survived').to.eq('Trading Colony');
  });

  it('a beat in flight ABSORBS B — a double submit is impossible by construction', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: 'AI Central', stage: 'Drawing', phase: 'executing',
      serves: [], anchor: ALWAYS,
    });
    expect(workspaceStackAcceptsInput()).to.eq(false);
    expect(workspaceStackBack(), 'consumed, so it cannot reach the board').to.eq('none');
    expect(workspaceStackDepth(), 'but nothing was undone').to.eq(1);
  });

  // ── collapse ──────────────────────────────────────────────────────────────

  /*
   * THE SOFT-LOCK'S REPLACEMENT. B on the embedded colonies used to close the
   * hand section underneath them; here the move past the commit boundary cannot
   * unmake anything, so B parks the whole chain and the board becomes readable
   * with the decision still live at full depth.
   */
  it('collapse parks the WHOLE stack at its depth; restore lands on the same decision', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    setWorkspaceFrameSlot('hand', '[data-embed-slot="hand-play"]');
    expect(workspaceStackBack()).to.eq('collapse');

    expect(workspaceStackCollapsed()).to.eq(true);
    expect(workspaceStackDepth(), 'the frames are parked, not torn down').to.eq(2);
    expect(workspaceFrameMounted('hand'), 'nothing renders while parked').to.eq(false);
    expect(workspaceFrameMounted('colonies')).to.eq(false);
    expect(workspaceStackBackVerb(), 'a parked stack has no B of its own').to.eq(undefined);

    restoreWorkspaceStack();
    expect(workspaceStackCollapsed()).to.eq(false);
    expect(workspaceStackDepth()).to.eq(2);
    expect(workspaceFrameMounted('colonies'), 'the same step comes back').to.eq(true);
    expect(workspaceStackCrumb()?.subject?.text).to.eq('Trading Colony');
    expect(workspaceStackState.frames[0].slot, 'hosts re-publish on re-mount').to.eq('');
  });

  it('a collapsed stack still SERVES — a deferred decision is never stranded', () => {
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: {type: 'prompt', promptType: 'colony'},
    });
    expect(stackServes('colony')).to.eq(true);
    collapseWorkspaceStack();
    expect(stackServes('colony'), 'set aside ≠ stranded').to.eq(true);
    expect(frameServing('colony')?.kind).to.eq('colonies');
    expect(stackServes('payment')).to.eq(false);
  });

  it('emptying the stack clears the collapsed flag with it', () => {
    pushWorkspaceFrame({
      kind: 'hand', subject: '', stage: '', phase: 'committed',
      serves: [], anchor: ALWAYS,
    });
    collapseWorkspaceStack();
    popWorkspaceFrame();
    expect(workspaceStackCollapsed(), 'nothing left to restore').to.eq(false);
  });

  // ── the crumb ─────────────────────────────────────────────────────────────

  it('the crumb is root + DEEPEST subject + top stage — one line, three levels', () => {
    openHandPlayingTradingColony();
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: ALWAYS,
    });
    const crumb = workspaceStackCrumb();
    expect(crumb?.root).to.eq('Cards in hand');
    // The colonies carry nothing of their own, so the card that OWES the step
    // keeps naming it — that is what makes three levels read as one flow.
    expect(crumb?.subject?.text).to.eq('Trading Colony');
    expect(crumb?.stage).to.eq('Colonies');
    expect(crumb?.committed).to.eq(true);

    const header = buildWorkspaceHeader(crumb!);
    expect(header.segments.map((s) => s.role)).to.deep.eq(['root', 'subject', 'stage']);
    expect(header.segments.map((s) => s.text)).to.deep.eq(['Cards in hand', 'Trading Colony', 'Colonies']);
  });

  it('the crumb only ever gains a tail — the browse layer is just the root', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: '', stage: '', phase: 'browse',
      serves: [], anchor: ALWAYS,
    });
    expect(buildWorkspaceHeader(workspaceStackCrumb()!).segments.map((s) => s.role)).to.deep.eq(['root']);
    setWorkspaceFrameStage('card-actions', 'Setup');
    expect(buildWorkspaceHeader(workspaceStackCrumb()!).segments.map((s) => s.role)).to.deep.eq(['root', 'stage']);
  });

  // ── the navigation verbs ──────────────────────────────────────────────────

  /*
   * `section = 'board'` meant three different things, and every reader had to
   * re-guess which. These are those intents, named — and the difference between
   * them is exactly the difference between «the decision waits for you» and
   * «the decision is gone».
   */
  it('park KEEPS the decision, go-home THROWS IT AWAY — the lost distinction', () => {
    openHandPlayingTradingColony();
    addColonyStep();

    collapseWorkspaceStack();
    expect(workspaceStackSection()).to.eq('board');
    expect(workspaceStackDepth(), 'parked: there is something to come back to').to.eq(2);
    expect(stackServes('colony'), 'and it still serves').to.eq(true);

    restoreWorkspaceStack();
    goBoardHome();
    expect(workspaceStackSection()).to.eq('board');
    expect(workspaceStackDepth(), 'finished: nothing to come back to').to.eq(0);
    expect(stackServes('colony')).to.eq(false);
  });

  /*
   * The truncation is UNCONDITIONAL. The old section watcher did the same thing
   * by hand and GUARDED it («…unless a colony follow-up is live inside the
   * hand»), which is precisely how a step came to outlive its host.
   */
  it('entering a workspace unwinds whatever stood on top of it — no exceptions', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    enterWorkspace('hand');
    expect(workspaceStackDepth()).to.eq(1);
    expect(workspaceFrameIndex('colonies')).to.eq(-1);
    expect(workspaceStackTop()?.phase, 'and it lands on its browse layer').to.eq('browse');
  });

  it('entering a DIFFERENT workspace from a parked one un-parks it', () => {
    enterWorkspace('hand');
    collapseWorkspaceStack();
    enterWorkspace('colonies');
    expect(workspaceStackCollapsed()).to.eq(false);
    expect(workspaceStackSection()).to.eq('colonies');
  });

  it('a fresh frame starts from its registered serves', () => {
    enterWorkspace('colonies');
    expect(stackServes('colony')).to.eq(true);
    expect(workspaceStackDepth()).to.eq(1);
  });

  /*
   * A LATERAL move is not a descent. Walking from the colonies to the hydro
   * track does not make the colonies the hydro's host — only a FLOW nests, and
   * a flow nests with `pushWorkspaceFrame`. Conflating the two is how «go
   * there» quietly builds a chain nobody meant.
   */
  it('a lateral move REPLACES the screen — it never nests under the old one', () => {
    enterWorkspace('colonies');
    enterWorkspace('hydro');
    expect(workspaceStackDepth()).to.eq(1);
    expect(workspaceStackSection()).to.eq('hydro');
    expect(stackServes('colony'), 'the colonies are gone, not underneath').to.eq(false);
  });

  it('leaveWorkspace is one screen back, not a reset', () => {
    enterWorkspace('hand');
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: ALWAYS,
    });
    leaveWorkspace();
    expect(workspaceStackSection()).to.eq('hand');
    expect(workspaceStackDepth()).to.eq(1);
  });

  // ── the registry, and the two legacy axes it projects onto ────────────────

  /*
   * ADDING A WORKSPACE IS A ROW. This spec is the worklist that says so: a new
   * kind fails the compile until `WORKSPACE_KINDS` has an entry, and fails here
   * until that entry actually names a crumb root and a DOM root the leak
   * detector can probe for.
   */
  it('every registered workspace declares a crumb root and a DOM root', () => {
    expect(WORKSPACE_FRAME_KINDS.length).to.be.greaterThan(0);
    for (const kind of WORKSPACE_FRAME_KINDS) {
      expect(workspaceFrameRoot(kind), `${kind} has no crumb root`).to.not.eq('');
      expect(workspaceFrameSelector(kind), `${kind} has no DOM root`).to.match(/^\./);
    }
  });

  /*
   * The DEEPEST projecting frame wins, not the root. Standing on colonies hosted
   * inside a card play the player IS on the colonies — and today's
   * `handEmbedded` / `coloniesEmbedded` flags exist only because `section` used
   * to say otherwise.
   */
  it('section projects the DEEPEST frame — the player drives what they SEE', () => {
    openHandPlayingTradingColony();
    expect(workspaceStackSection()).to.eq('hand');
    addColonyStep();
    expect(workspaceStackSection(), 'the colonies are what is on screen').to.eq('colonies');
    popWorkspaceFrame();
    expect(workspaceStackSection()).to.eq('hand');
  });

  it('a full-bleed workspace projects onto neither axis', () => {
    pushWorkspaceFrame({
      kind: 'start', subject: '', stage: '', phase: 'browse',
      serves: ['startSequence'], anchor: {type: 'phase', phase: 'preludes'},
    });
    expect(workspaceStackSection()).to.eq('board');
    expect(workspaceStackSheet()).to.eq(undefined);
  });

  /*
   * THE HALF-COLLAPSE FENCE. A park that left `sheet` set is the documented
   * bug where the restore card never appeared (it keys off `sheet` being clear)
   * while input still routed into an invisible workspace. Both axes clear, or
   * the class comes back.
   */
  it('a parked stack projects to the board home with NO sheet', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: 'AI Central', stage: 'Purchase', phase: 'committed',
      serves: ['cardSelect'], anchor: ALWAYS,
    });
    expect(workspaceStackSheet()).to.eq('cardActions');
    collapseWorkspaceStack();
    expect(workspaceStackSection()).to.eq('board');
    expect(workspaceStackSheet(), 'a half-collapse is what shipped the lock').to.eq(undefined);
    restoreWorkspaceStack();
    expect(workspaceStackSheet()).to.eq('cardActions');
  });

  it('section and sheet are independent axes of one stack', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: '', stage: '', phase: 'committed',
      serves: [], anchor: ALWAYS,
    });
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: ALWAYS,
    });
    expect(workspaceStackSheet()).to.eq('cardActions');
    expect(workspaceStackSection()).to.eq('colonies');
  });

  // ── invariant 2: anchors ──────────────────────────────────────────────────

  /*
   * A frame's meaning depends on its ancestors, so the walk goes OUTWARDS and
   * TRUNCATES. Dropping only the dead frame would leave a step hanging under a
   * parent that no longer exists — the exact shape of the bug this file is for.
   */
  it('reconcile truncates at the first dead anchor, taking everything above it', () => {
    // The sponsor chain, three deep: start ⊃ hand ⊃ colonies.
    pushWorkspaceFrame({
      kind: 'start', subject: '', stage: '', phase: 'browse',
      serves: ['startSequence'], anchor: {type: 'phase', phase: 'preludes'},
    });
    openHandPlayingTradingColony();
    addColonyStep();
    expect(workspaceStackDepth()).to.eq(3);

    // The card left the hand — the stage under the colonies loses its anchor.
    const depth = reconcileWorkspaceStack((a) => a.type !== 'cardInHand');
    expect(depth).to.eq(1);
    expect(workspaceStackDepth()).to.eq(1);
    expect(workspaceFrameIndex('colonies'), 'a step cannot outlive its host').to.eq(-1);
    expect(workspaceFrameIndex('start'), 'but the ancestor that still holds stays').to.eq(0);
  });

  it('reconcile keeps a fully-justified stack untouched', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    expect(reconcileWorkspaceStack(() => true)).to.eq(2);
    expect(workspaceStackDepth()).to.eq(2);
  });

  it('truncate is clamped at both ends', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    truncateWorkspaceStack(99);
    expect(workspaceStackDepth()).to.eq(2);
    truncateWorkspaceStack(-1);
    expect(workspaceStackDepth()).to.eq(0);
  });

  /*
   * THE CLASS GUARD. The shell used to approximate this invariant with five
   * hand-copied «the chain is not over yet» conditions, and the soft-lock was
   * one of them disagreeing with another. Here it is a property of the module:
   * drive every exported mutator in every order and assert, after each call,
   * that no frame is left standing over a host that is gone.
   */
  it('NO mutator can orphan a frame — every frame keeps a host beneath it', () => {
    const kinds = ['start', 'hand', 'colonies', 'card-actions'] as const;
    const mutate: ReadonlyArray<() => void> = [
      () => pushWorkspaceFrame({
        kind: 'hand', subject: '', stage: '', phase: 'browse', serves: ['projectCard'], anchor: ALWAYS,
      }),
      () => pushWorkspaceFrame({
        kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
        serves: ['colony'], anchor: {type: 'prompt', promptType: 'colony'},
      }),
      () => pushWorkspaceFrame({
        kind: 'start', subject: '', stage: '', phase: 'browse',
        serves: ['startSequence'], anchor: {type: 'phase', phase: 'preludes'},
      }),
      () => descendWorkspaceFrame('hand', 'Trading Colony', 'Playing'),
      () => workspaceStackBack(),
      () => popWorkspaceFrame(),
      () => collapseWorkspaceStack(),
      () => restoreWorkspaceStack(),
      () => truncateWorkspaceStack(1),
      () => reconcileWorkspaceStack((a) => a.type !== 'prompt'),
      () => setWorkspaceFramePhase('hand', 'committed'),
      () => setWorkspaceFrameSlot('hand', '[data-embed-slot="hand-play"]'),
    ];
    // A deterministic walk over every ordered pair-of-pairs — no Math.random,
    // so a failure is reproducible from the printed step.
    for (let a = 0; a < mutate.length; a++) {
      for (let b = 0; b < mutate.length; b++) {
        for (let c = 0; c < mutate.length; c++) {
          resetWorkspaceStack();
          for (const step of [a, b, c]) {
            mutate[step]();
            const frames = workspaceStackState.frames;
            for (let i = 1; i < frames.length; i++) {
              expect(frames[i - 1], `orphan at depth ${i} after steps ${a},${b},${c}`).to.not.eq(undefined);
            }
            // Kind uniqueness is what makes `workspaceFrameMounted` a straight
            // answer — two frames of one kind would make "is it on screen?"
            // ambiguous, which is where the old model's two truths came from.
            const seen = frames.map((f) => f.kind);
            expect(new Set(seen).size, `duplicate kind after steps ${a},${b},${c}`).to.eq(seen.length);
            // A child may only ever teleport into a host that is really there.
            for (const kind of kinds) {
              if (workspaceFrameTarget(kind) !== undefined) {
                expect(workspaceFrameMounted(kind), `${kind} targets a zone while unmounted`).to.eq(true);
              }
            }
          }
        }
      }
    }
  });

  /*
   * The probe is the runtime half of invariant 1, and it is written against the
   * EXACT state that shipped the soft-lock: the stack says the hand hosts the
   * colonies, the hand's DOM root is gone. Before, that state was silent —
   * `colonyPromptStranded` could not see it, because the claim still named a
   * host. Here it is a named, truncatable fault.
   */
  it('the presence probe names a frame the stack believes in and the DOM does not', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    const present = new Set(['.con-hand', '.con-colonies']);
    expect(probeWorkspacePresence((s) => present.has(s))).to.deep.eq([]);
    expect(workspacePresentDepth((s) => present.has(s))).to.eq(2);

    // The hand section unmounted underneath its own step — the old soft-lock.
    present.delete('.con-hand');
    expect(probeWorkspacePresence((s) => present.has(s))).to.deep.eq(['hand']);
    expect(workspacePresentDepth((s) => present.has(s)),
      'a step cannot be on screen without its host').to.eq(0);
  });

  it('a parked stack is not supposed to be on screen, so it never probes as missing', () => {
    openHandPlayingTradingColony();
    collapseWorkspaceStack();
    expect(probeWorkspacePresence(() => false)).to.deep.eq([]);
  });

  // ── persistence ───────────────────────────────────────────────────────────

  /*
   * RUNTIME STATE MUST NOT TRAVEL. `slot` names an element that only exists
   * while a host is mounted; a restored stack that believed in it would
   * teleport into a detached node. Fields are listed explicitly in
   * `serializeWorkspaceStack` precisely so this stays true when a field is added.
   */
  it('serialization carries the STRUCTURE and never the runtime slot', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    setWorkspaceFrameSlot('hand', '[data-embed-slot="hand-play"]');
    const data = serializeWorkspaceStack();
    expect(data.v).to.eq(WORKSPACE_STACK_SCHEMA);
    expect(data.frames).to.have.length(2);
    for (const frame of data.frames) {
      expect(Object.keys(frame).sort()).to.deep.eq(
        ['anchor', 'kind', 'phase', 'serves', 'stage', 'subject']);
    }
  });

  it('a round trip restores the same depth, subject and crumb', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    const data = serializeWorkspaceStack();
    resetWorkspaceStack();
    expect(hydrateWorkspaceStack(data, () => true)).to.eq(2);
    expect(workspaceStackDepth()).to.eq(2);
    expect(workspaceStackCrumb()?.subject?.text).to.eq('Trading Colony');
    expect(workspaceStackState.frames[1].slot, 'cold: nothing is mounted yet').to.eq('');
  });

  /*
   * A beat and a completion are things that were HAPPENING. After a reload
   * nothing is in flight, and a frame parked in a transient phase would swallow
   * every press (`acceptsInput` is false there) waiting for a signal whose
   * sender no longer exists.
   */
  it('a transient phase is re-seated at committed on a cold restore', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: 'AI Central', stage: 'Drawing', phase: 'executing',
      serves: [], anchor: ALWAYS,
    });
    const data = serializeWorkspaceStack();
    resetWorkspaceStack();
    hydrateWorkspaceStack(data, () => true);
    expect(workspaceStackTop()?.phase).to.eq('committed');
    expect(workspaceStackAcceptsInput(), 'the pad must be live again').to.eq(true);
    expect(workspaceStackBackVerb()).to.eq('collapse');
  });

  /*
   * After a server restart the nested input is genuinely gone (`Game.deserialize`
   * re-derives a top-level prompt from the phase), so the stack must degrade to
   * what still holds rather than stand a step over nothing.
   */
  it('hydration truncates by anchor, exactly like the in-session reconciler', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: '', stage: '', phase: 'browse',
      serves: [], anchor: ALWAYS,
    });
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: {type: 'prompt', promptType: 'colony'},
    });
    const data = serializeWorkspaceStack();
    resetWorkspaceStack();
    expect(hydrateWorkspaceStack(data, (a) => a.type === 'always')).to.eq(1);
    expect(workspaceStackDepth()).to.eq(1);
    expect(workspaceFrameIndex('card-actions')).to.eq(0);
  });

  it('a stack that survives nothing does not come back collapsed', () => {
    openHandPlayingTradingColony();
    collapseWorkspaceStack();
    const data = serializeWorkspaceStack();
    expect(data.collapsed).to.eq(true);
    resetWorkspaceStack();
    expect(hydrateWorkspaceStack(data, () => false)).to.eq(0);
    expect(workspaceStackCollapsed(), 'nothing to restore ⇒ no restore card').to.eq(false);
  });

  it('a stored stack from another schema is DROPPED, never migrated', () => {
    openHandPlayingTradingColony();
    const data = {...serializeWorkspaceStack(), v: WORKSPACE_STACK_SCHEMA + 1};
    resetWorkspaceStack();
    expect(hydrateWorkspaceStack(data, () => true)).to.eq(0);
    expect(hydrateWorkspaceStack(undefined, () => true)).to.eq(0);
  });
});
