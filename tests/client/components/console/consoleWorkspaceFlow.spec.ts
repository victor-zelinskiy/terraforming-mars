import {expect} from 'chai';
import {
  acceptsInput, backLabelFor, backLabelForVerb, backVerbFor, backVerbWithOwedPrompt, isCommitted,
  isNavigationDestination, isReversible,
  WorkspacePhase, workspaceConclusionFor, workspacePhaseOf,
} from '@/client/console/consoleWorkspaceFlow';
import {buildWorkspaceHeader} from '@/client/console/consoleWorkspaceHeader';

const ALL: ReadonlyArray<WorkspacePhase> =
  ['browse', 'configure', 'executing', 'committed', 'verdict', 'completing'];

describe('consoleWorkspaceFlow — the commit boundary', () => {
  it('splits the phases at the commit: browse/configure are undoable, the rest are not', () => {
    expect(ALL.filter(isReversible)).to.deep.eq(['browse', 'configure']);
    expect(ALL.filter(isCommitted)).to.deep.eq(['executing', 'committed', 'verdict', 'completing']);
  });

  /**
   * THE BUG THIS MODEL EXISTS FOR. B on the purchase stage used to walk back
   * into the «берём карты из колоды…» beat — a machine state with nothing to
   * act on, describing work that had already finished. A beat is not a place.
   */
  it('REGRESSION: an execution beat is NEVER a navigation destination', () => {
    expect(isNavigationDestination('executing')).to.eq(false);
    expect(isNavigationDestination('completing')).to.eq(false);
    expect(ALL.filter(isNavigationDestination)).to.deep.eq(['browse', 'configure']);
  });

  it('B is FOUR different verbs, one per phase — never one branch guessing', () => {
    expect(backVerbFor('browse')).to.eq('close');
    expect(backVerbFor('configure')).to.eq('back');
    // Past the commit the move cannot be unmade, so B stops meaning "undo".
    expect(backVerbFor('committed')).to.eq('collapse');
    // A beat in flight swallows B: nothing to cancel, nothing to come back to.
    expect(backVerbFor('executing')).to.eq('none');
    expect(backVerbFor('completing')).to.eq('none');
  });

  /**
   * THE THIRD BUG. A PROMPT-ROUTED workspace stands on a live `waitingFor`.
   * `close` there strands the prompt with no surface to be answered on — and
   * in the Hydronetwork's card-granted bonus move B did worse than that: it
   * was wired straight to «Пропустить», so the one press that means «step out
   * and look at the board» everywhere else in this console silently DECLINED a
   * card's effect, irreversibly.
   *
   * The rule is one line: an owed prompt turns CLOSE into COLLAPSE, and
   * touches nothing else. B never answers anything.
   */
  describe('B under an OWED prompt', () => {
    it('turns CLOSE into COLLAPSE — the decision stays live, the board becomes readable', () => {
      expect(backVerbWithOwedPrompt('browse', true)).to.eq('collapse');
      expect(backLabelForVerb(backVerbWithOwedPrompt('browse', true))).to.eq('Minimize');
    });

    it('leaves every OTHER phase exactly as it was', () => {
      for (const phase of ALL) {
        if (phase === 'browse') {
          continue;
        }
        expect(backVerbWithOwedPrompt(phase, true), phase).to.eq(backVerbFor(phase));
      }
      // …and a reversible step INSIDE the workspace still folds back, because
      // there is somewhere to fold back TO.
      expect(backVerbWithOwedPrompt('configure', true)).to.eq('back');
    });

    it('changes nothing at all when no prompt is owed', () => {
      for (const phase of ALL) {
        expect(backVerbWithOwedPrompt(phase, false), phase).to.eq(backVerbFor(phase));
      }
    });

    it('never produces a verb that could ANSWER anything', () => {
      // The four verbs are exhaustive and none of them is a game decision.
      for (const phase of ALL) {
        expect(['close', 'back', 'collapse', 'none'], phase)
          .to.include(backVerbWithOwedPrompt(phase, true));
      }
    });
  });

  /**
   * THE OTHER BUG THIS MODEL EXISTS FOR. B on «Действия карт › Поиски жизни ›
   * РЕЗУЛЬТАТ ВСКРЫТИЯ» parked the workspace — and `lastReveal` (server state
   * until the next input) was then picked up by the STANDALONE reveal overlay,
   * so minimizing the verdict put the very same verdict back on screen as a
   * legacy full-bleed modal. A verdict keeps no decision alive, so «свернуть»
   * buys nothing: it is not offered.
   */
  it('REGRESSION: a TERMINAL verdict offers no collapse — «ОК» is the only way out', () => {
    expect(backVerbFor('verdict')).to.eq('none');
    expect(backLabelFor('verdict')).to.eq(undefined);
    // …but it is a stage the player ACTS on: A/X/L3 must still land.
    expect(acceptsInput('verdict')).to.eq(true);
    expect(isCommitted('verdict')).to.eq(true);
    expect(isNavigationDestination('verdict')).to.eq(false);
  });

  it('the LABEL follows the verb, so the bar can never say one thing while B does another', () => {
    expect(backLabelFor('browse')).to.eq('Close');
    expect(backLabelFor('configure')).to.eq('Cancel');
    expect(backLabelFor('committed')).to.eq('Minimize');
    expect(backLabelFor('executing')).to.eq(undefined);
  });

  it('a transient beat absorbs input — a double submit is impossible by construction', () => {
    expect(acceptsInput('executing')).to.eq(false);
    expect(acceptsInput('completing')).to.eq(false);
    expect(acceptsInput('configure')).to.eq(true);
    expect(acceptsInput('committed')).to.eq(true);
  });

  describe('workspacePhaseOf — derived, never assigned', () => {
    const base = {open: false, committed: false, resultUp: false, finishing: false};

    it('walks the real flow: browse → configure → executing → committed → completing', () => {
      expect(workspacePhaseOf(base)).to.eq('browse');
      expect(workspacePhaseOf({...base, open: true})).to.eq('configure');
      // Committed but nothing on stage yet — the machine beat.
      expect(workspacePhaseOf({...base, open: true, committed: true})).to.eq('executing');
      expect(workspacePhaseOf({...base, open: true, committed: true, resultUp: true})).to.eq('committed');
      expect(workspacePhaseOf({...base, open: true, committed: true, resultUp: true, finishing: true}))
        .to.eq('completing');
    });

    it('a result that is the flow\'s LAST word is `verdict`, not `committed`', () => {
      expect(workspacePhaseOf({...base, open: true, committed: true, resultUp: true, terminal: true}))
        .to.eq('verdict');
      // …and `terminal` only ever qualifies a result that is actually on stage:
      // the beat before it stays a beat.
      expect(workspacePhaseOf({...base, open: true, committed: true, terminal: true})).to.eq('executing');
    });

    it('the pending beat is EXECUTING, not committed — so B cannot collapse into an empty stage', () => {
      const phase = workspacePhaseOf({open: true, committed: true, resultUp: false, finishing: false});
      expect(phase).to.eq('executing');
      expect(backVerbFor(phase)).to.eq('none');
    });
  });

  describe('workspaceConclusionFor — a finished flow does not fold back to browse', () => {
    const done = {nested: false, outcomeLive: false, ownsPrompt: false, parked: false};

    /**
     * THE BUG THIS POLICY EXISTS FOR. «Поиск жизни»: confirm → the card is
     * pulled off the deck, turned over, the verdict reads «Условие выполнено»
     * → A → and the player was standing in the ДЕЙСТВИЯ КАРТ list again,
     * looking at the action they had just performed, now greyed «Активирована».
     * A completed operation has nothing to go back to.
     */
    it('REGRESSION: an activation with nothing left owed DISMISSES its workspace', () => {
      expect(workspaceConclusionFor(done)).to.deep.eq({verdict: 'dismiss'});
    });

    it('holds while a STEP is standing inside — an inner frame cannot outlive its host', () => {
      expect(workspaceConclusionFor({...done, nested: true}))
        .to.deep.eq({verdict: 'hold', reason: 'nested-step'});
    });

    /**
     * ONE PRESS, SEVERAL EFFECTS. «Научная колония» draws 2 cards AND builds a
     * colony, and the server sends both in one response. The colony's door waits
     * for the batch to be taken — so at the moment the last card is taken this
     * flow owns no outcome, hosts no step and is asked no prompt, and it used to
     * DISMISS: the workspace left, and the play's second effect then opened as a
     * lateral screen of its own. A step still owed is the same fact as a step
     * standing inside, one beat earlier.
     */
    it('REGRESSION: holds while a step it OWES has not been handed over yet', () => {
      expect(workspaceConclusionFor({...done, owedStep: true}))
        .to.deep.eq({verdict: 'hold', reason: 'owed-step'});
    });

    it('holds while this host still owns its outcome (in the air, or on screen)', () => {
      expect(workspaceConclusionFor({...done, outcomeLive: true}))
        .to.deep.eq({verdict: 'hold', reason: 'live-outcome'});
    });

    /** Pick-then-pay is ONE decision: dismissing between its two halves breaks
     *  the flow open exactly where the player has already said yes. */
    it('holds while a prompt of its own is still being asked', () => {
      expect(workspaceConclusionFor({...done, ownsPrompt: true}))
        .to.deep.eq({verdict: 'hold', reason: 'owned-prompt'});
    });

    /** Concluding a PARKED flow would silently turn «свернуть» into «закрыть». */
    it('never concludes a flow the player set aside', () => {
      expect(workspaceConclusionFor({...done, parked: true}))
        .to.deep.eq({verdict: 'hold', reason: 'parked'});
    });

    it('reports the STRONGEST reason when several hold at once', () => {
      expect(workspaceConclusionFor(
        {nested: true, owedStep: true, outcomeLive: true, ownsPrompt: true, parked: true}))
        .to.deep.eq({verdict: 'hold', reason: 'nested-step'});
      expect(workspaceConclusionFor({...done, owedStep: true, outcomeLive: true, parked: true}))
        .to.deep.eq({verdict: 'hold', reason: 'owed-step'});
      expect(workspaceConclusionFor({...done, outcomeLive: true, ownsPrompt: true, parked: true}))
        .to.deep.eq({verdict: 'hold', reason: 'live-outcome'});
    });
  });
});

describe('consoleWorkspaceHeader — stable context before mutable stage', () => {
  it('emits root → subject → stage, in READ order', () => {
    const h = buildWorkspaceHeader({root: 'Card actions', subject: {text: 'Inventors Guild'}, stage: 'Buying'});
    expect(h.segments.map((s) => s.role)).to.deep.eq(['root', 'subject', 'stage']);
    expect(h.segments.map((s) => s.text)).to.deep.eq(['Card actions', 'Inventors Guild', 'Buying']);
  });

  /**
   * The whole point of the grammar: across a phase change ONLY the tail moves.
   * The old order (root › stage › subject) re-flowed the line every phase and
   * read as arriving somewhere else.
   */
  it('a phase change alters ONLY the stage segment — root and subject are identical', () => {
    const setup = buildWorkspaceHeader({root: 'Card actions', subject: {text: 'Inventors Guild'}, stage: 'Action setup'});
    const buying = buildWorkspaceHeader({root: 'Card actions', subject: {text: 'Inventors Guild'}, stage: 'Buying'});
    expect(buying.segments[0]).to.deep.eq(setup.segments[0]);
    expect(buying.segments[1]).to.deep.eq(setup.segments[1]);
    expect(buying.segments[2].text).to.not.eq(setup.segments[2].text);
    // The stage key is what the transition is keyed on — nothing else re-animates.
    expect(buying.stageKey).to.eq('Buying');
    expect(setup.stageKey).to.eq('Action setup');
  });

  it('the crumb only ever GAINS a tail — the browse layer is just the root', () => {
    expect(buildWorkspaceHeader({root: 'Card actions'}).segments.map((s) => s.role)).to.deep.eq(['root']);
    expect(buildWorkspaceHeader({root: 'Card actions', subject: {text: 'X'}}).segments.map((s) => s.role))
      .to.deep.eq(['root', 'subject']);
  });

  it('an empty subject/stage is omitted rather than rendered blank', () => {
    const h = buildWorkspaceHeader({root: 'Card actions', subject: {text: ''}, stage: ''});
    expect(h.segments.map((s) => s.role)).to.deep.eq(['root']);
  });

  it('carries the committed flag so the stage can read as a statement, not an invitation', () => {
    expect(buildWorkspaceHeader({root: 'R', stage: 'Buying', committed: true}).committed).to.eq(true);
    expect(buildWorkspaceHeader({root: 'R', stage: 'Action setup'}).committed).to.eq(false);
  });
});
