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
  closeWorkspaceRoot,
  closeWorkspaceSheet,
  workspaceFrameHasNested,
  workspaceFrameHost,
  workspaceFrameIndex,
  workspaceFrameIsOverlay,
  workspaceFrameMounted,
  workspaceFrameRenders,
  workspaceHostForStep,
  workspaceSurfacesFor,
  workspaceFrameRoot,
  workspaceFrameSelector,
  workspaceFrameTarget,
  workspacePresentDepth,
  workspaceStackAcceptsInput,
  workspaceStackBack,
  workspaceStackBackVerb,
  discardWorkspacePark,
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
    expect(workspaceStackState.parked, 'the frames are set aside, not torn down').to.have.length(2);
    expect(workspaceStackDepth(), 'and the LIVE stack is free to go anywhere').to.eq(0);
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

  /*
   * THE PARK IS A SEPARATE STACK, and this is the whole reason why: the player
   * parks precisely so they can go and open other screens. While it was a FLAG
   * on the live stack, the first lateral move wiped the parked frames — walking
   * from the minimized sponsor step to the colonies and back left A returning
   * the player to the deployment instead of their own unfinished card play, and
   * «свернуть» had silently become «закрыть».
   */
  it('a parked flow survives everything the player does while it waits', () => {
    openHandPlayingTradingColony();
    collapseWorkspaceStack();

    enterWorkspace('colonies');
    expect(workspaceStackCollapsed(), 'still parked while browsing').to.eq(true);
    expect(workspaceFrameMounted('colonies'), 'and the browse screen is live').to.eq(true);
    leaveWorkspace();
    goBoardHome();
    expect(workspaceStackCollapsed(), 'going home ends THAT flow, not the parked one').to.eq(true);

    restoreWorkspaceStack();
    expect(workspaceStackTop()?.subject, 'the same card, still being played').to.eq('Trading Colony');
    expect(workspaceStackCollapsed()).to.eq(false);
  });

  /*
   * …and it is dropped exactly once: when the SERVER moves on. Restoring a flow
   * whose prompt no longer exists would put the player inside a decision that
   * is gone.
   */
  it('a parked flow is discarded when the prompt it belongs to is over', () => {
    openHandPlayingTradingColony();
    collapseWorkspaceStack();
    discardWorkspacePark();
    expect(workspaceStackCollapsed()).to.eq(false);
    restoreWorkspaceStack();
    expect(workspaceStackDepth(), 'nothing came back — there was nothing to').to.eq(0);
  });

  it('a collapsed stack still SERVES — a deferred decision is never stranded', () => {
    pushWorkspaceFrame({
      kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed',
      serves: ['colony'], anchor: {type: 'prompt', promptType: 'colony'},
    });
    expect(stackServes('colony')).to.eq(true);
    collapseWorkspaceStack();
    expect(stackServes('colony'), 'set aside \u2260 stranded').to.eq(true);
    expect(frameServing('colony')?.kind, 'and the parked frame is still its host').to.eq('colonies');
    expect(stackServes('payment')).to.eq(false);
  });

  it('parking an empty stack is nothing, and restoring nothing is nothing', () => {
    collapseWorkspaceStack();
    expect(workspaceStackCollapsed(), 'there was nothing to set aside').to.eq(false);
    restoreWorkspaceStack();
    expect(workspaceStackDepth()).to.eq(0);
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
    expect(workspaceStackCollapsed(), 'parked: there is something to come back to').to.eq(true);
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

  /*
   * …and it does NOT touch a parked one. Walking somewhere else is the whole
   * point of parking; un-parking here is what turned «свернуть» into «закрыть».
   */
  it('entering a DIFFERENT workspace leaves a parked one exactly where it is', () => {
    enterWorkspace('hand');
    collapseWorkspaceStack();
    enterWorkspace('colonies');
    expect(workspaceStackCollapsed(), 'still waiting for the player').to.eq(true);
    expect(workspaceStackSection(), 'and the new screen is what they see').to.eq('colonies');
    // …and «what they see» means SEEN. The park is a separate stack, so
    // presence alone already hides the parked frames — a surface that ALSO
    // hid itself on the global «is anything parked» flag rendered live and
    // invisible: opening ДЕЙСТВИЯ КАРТ with the start selection minimized
    // gave the right command bar over a blank screen.
    expect(workspaceFrameRenders('colonies'), 'the new workspace is visible').to.eq(true);
    expect(workspaceFrameRenders('hand'), 'the parked one is not').to.eq(false);
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
        ['anchor', 'kind', 'overlay', 'phase', 'serves', 'stage', 'subject']);
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
    expect(data.parked, 'a parked flow is what gets stored').to.have.length(1);
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
  // -- STAGE B: what the shell now leans on ---------------------------------

  /*
   * THE ONE FORM OF the-chain-is-not-over-yet. The shell carried FIVE
   * hand-written copies of this question, each spelling out a different subset
   * of latch + prompt + transaction flags; the soft-lock was one of them
   * disagreeing with another, and the sixth copy was simply never written.
   */
  it('a host knows when something is standing inside it - one predicate, not five', () => {
    openHandPlayingTradingColony();
    expect(workspaceFrameHasNested('hand'), 'nothing inside it yet').to.eq(false);
    addColonyStep();
    expect(workspaceFrameHasNested('hand')).to.eq(true);
    expect(workspaceFrameHasNested('colonies'), 'the top frame hosts nothing').to.eq(false);
    leaveWorkspace();
    expect(workspaceFrameHasNested('hand'), 'the chain is over now').to.eq(false);
  });

  /*
   * INVARIANT 1, as the surfaces actually ask it. A nested frame renders NOWHERE
   * until its host zone genuinely stands (embed rule 4) - never in its own band
   * first, which is the modal-then-embed flash the architecture removes.
   */
  it('a surface renders only when its host zone is really standing', () => {
    openHandPlayingTradingColony();
    expect(workspaceFrameRenders('hand'), 'the root stands in its own band').to.eq(true);
    addColonyStep();
    expect(workspaceFrameRenders('colonies'), 'claimed, zone not up: nowhere').to.eq(false);
    setWorkspaceFrameSlot('hand', '[data-embed-slot="hand-play"]');
    expect(workspaceFrameRenders('colonies')).to.eq(true);
    collapseWorkspaceStack();
    expect(workspaceFrameRenders('hand'), 'a parked stack shows nothing').to.eq(false);
    expect(workspaceFrameRenders('colonies')).to.eq(false);
  });

  /*
   * THE PICK BRIDGE. A composer asks the real hand for a card: the hand takes
   * the screen and the composer waits UNDERNEATH with its captures intact. It
   * is still a frame relationship - both projections are exactly what the old
   * two-axis juggling produced - but there is no zone to wait for, so the
   * overlay must not be held off screen.
   */
  it('an OVERLAY frame stands over its host instead of inside it', () => {
    pushWorkspaceFrame({
      kind: 'card-actions', subject: '', stage: '', phase: 'configure',
      serves: [], anchor: ALWAYS,
    });
    pushWorkspaceFrame({
      kind: 'hand', subject: '', stage: '', phase: 'browse',
      serves: ['projectCard'], anchor: ALWAYS, overlay: true,
    });
    expect(workspaceFrameIsOverlay('hand')).to.eq(true);
    expect(workspaceFrameTarget('hand'), 'never teleported').to.eq(undefined);
    expect(workspaceFrameRenders('hand'), 'and never held off screen').to.eq(true);
    expect(workspaceStackSection(), 'the player sees the hand').to.eq('hand');
    expect(workspaceStackSheet(), 'the composer is still open under it').to.eq('cardActions');
    leaveWorkspace();
    expect(workspaceFrameMounted('card-actions'), 'the origin was never left').to.eq(true);
  });

  /*
   * THE CONTINUATION RULE, stated once. Inside the start's play-from-hand
   * prelude a played card's SelectColony belongs to the CARD-PLAY step, not to
   * the start - so the colonies land one level deeper in the SAME chain.
   * Getting this wrong used to overwrite the sponsor claim and show the start
   * screen with the project effect still unresolved.
   */
  it('a follow-up belongs to the NEAREST live step, never the outermost root', () => {
    expect(workspaceHostForStep(), 'nothing open: it is a screen of its own').to.eq(undefined);
    pushWorkspaceFrame({
      kind: 'start', subject: 'Eccentric Sponsor', stage: '', phase: 'browse',
      serves: ['startSequence'], anchor: {type: 'phase', phase: 'preludes'},
    });
    expect(workspaceHostForStep(), 'the start hosts always').to.eq('start');
    pushWorkspaceFrame({
      kind: 'hand', subject: '', stage: '', phase: 'browse',
      serves: ['projectCard'], anchor: ALWAYS,
    });
    // …and NOT the start any more: a step teleports into the zone of the frame
    // IMMEDIATELY below it, so naming a deeper ancestor would hand it a zone it
    // can never reach — it would render nowhere, forever.
    expect(workspaceHostForStep(), 'a BROWSE hand hosts nothing, and hides the start').to.eq(undefined);
    descendWorkspaceFrame('hand', 'Trading Colony', 'Playing');
    expect(workspaceHostForStep(), 'now the card-play step owns the follow-up').to.eq('hand');
  });

  /*
   * A PHASE-anchored root is not part of any flow - it IS the game phase, so a
   * step inside it can never finish it. Unwinding it on a placement mid
   * deployment is what would read as "the start screen is gone" with the
   * deployment still owed.
   */
  it('going home unwinds every flow but yields to a phase-anchored root', () => {
    pushWorkspaceFrame({
      kind: 'start', subject: '', stage: '', phase: 'browse',
      serves: ['startSequence'], anchor: {type: 'phase', phase: 'preludes'},
    });
    pushWorkspaceFrame({
      kind: 'hand', subject: '', stage: '', phase: 'browse',
      serves: ['projectCard'], anchor: ALWAYS,
    });
    goBoardHome();
    expect(workspaceStackDepth(), 'the opening survives its own step').to.eq(1);
    expect(workspaceFrameIndex('start')).to.eq(0);
    // ...and a lateral move does not end it either.
    enterWorkspace('colonies');
    expect(workspaceFrameIndex('start')).to.eq(0);
    expect(workspaceFrameHost('colonies')).to.eq('start');
    resetWorkspaceStack();
    enterWorkspace('hand');
    goBoardHome();
    expect(workspaceStackDepth(), 'an ordinary flow goes all the way home').to.eq(0);
  });

  /*
   * …but its OWN lifecycle owner must still be able to end it. Protecting a
   * phase root from `goBoardHome` AND from the watcher that owns it means the
   * frame can never be dropped at all — the start scene stays mounted over the
   * rest of the game, which is a far louder bug than the one being prevented.
   */
  it('a phase-anchored root still ends when its OWN anchor dies', () => {
    pushWorkspaceFrame({
      kind: 'start', subject: '', stage: '', phase: 'browse',
      serves: ['startSequence'], anchor: {type: 'phase', phase: 'preludes'},
    });
    pushWorkspaceFrame({
      kind: 'hand', subject: '', stage: '', phase: 'browse',
      serves: ['projectCard'], anchor: ALWAYS,
    });
    closeWorkspaceRoot('start');
    expect(workspaceStackDepth(), 'it takes its whole chain with it').to.eq(0);
    // Idempotent: a kind that is not in the stack is simply nothing to close.
    closeWorkspaceRoot('start');
    expect(workspaceStackDepth()).to.eq(0);
  });

  /*
   * closeConsoleLayers()'s sheet half - registry-driven, which is why the hydro
   * pick needs no stayInSection special case any more.
   */
  it('closing the sheets uncovers the screen beneath them', () => {
    enterWorkspace('hydro');
    pushWorkspaceFrame({
      kind: 'hydro-pick', subject: '', stage: '', phase: 'configure',
      serves: [], anchor: ALWAYS, overlay: true,
    });
    expect(workspaceStackSheet()).to.eq('hydroPick');
    closeWorkspaceSheet();
    expect(workspaceStackSheet()).to.eq(undefined);
    expect(workspaceStackSection(), 'the track it was opened from').to.eq('hydro');
    closeWorkspaceSheet();
    expect(workspaceStackSection(), 'a section frame is not a sheet').to.eq('hydro');
  });

  /*
   * Un-parking a stack that was never parked must not clear the slots: the
   * hosts are already mounted and would never re-publish, so a live teleport
   * would lose its target for good.
   */
  it('restore is idempotent - it never clears a live slot', () => {
    openHandPlayingTradingColony();
    addColonyStep();
    setWorkspaceFrameSlot('hand', '[data-embed-slot="hand-play"]');
    restoreWorkspaceStack();
    expect(workspaceFrameTarget('colonies')).to.eq('[data-embed-slot="hand-play"]');
    collapseWorkspaceStack();
    restoreWorkspaceStack();
    expect(workspaceFrameTarget('colonies'), 'a real un-park re-asks for the zone').to.eq(undefined);
  });

  /*
   * The leak detector per-kind probe comes from the registry: adding a
   * workspace must not also mean adding a row to a list the compiler cannot
   * see, which fails only at runtime as an amber guard over a working screen.
   */
  it('the detector probes are derived from the registry, not re-listed', () => {
    expect(workspaceSurfacesFor('colony')).to.deep.eq([workspaceFrameSelector('colonies')]);
    expect(workspaceSurfacesFor('handSelect')).to.deep.eq([workspaceFrameSelector('hand')]);
    expect(workspaceSurfacesFor('projectCard')).to.have.members(
      [workspaceFrameSelector('hand'), workspaceFrameSelector('standard-projects')]);
    expect(workspaceSurfacesFor('awardFunding')).to.deep.eq([workspaceFrameSelector('awards')]);
    expect(workspaceSurfacesFor('payment'), 'no workspace claims it').to.deep.eq([]);
  });
});
