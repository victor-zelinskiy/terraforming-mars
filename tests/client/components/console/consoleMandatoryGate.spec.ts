import {expect} from 'chai';
import {
  isInterruptiveMandatoryTask,
  mandatoryBeatFor,
  isMandatoryBeatHeld,
  isMandatoryBeatPresented,
  acknowledgeMandatoryBeat,
  markMandatoryBeatPresented,
  noteMandatoryBeatIdentity,
  resetMandatoryGate,
  setMandatoryGateHeld,
  isMandatoryGateHeld,
  MandatoryFlowBeat,
} from '@/client/console/consoleMandatoryGate';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';

describe('consoleMandatoryGate (the mandatory announcement gate)', () => {
  // `held` is a shell-owned mirror that resetMandatoryGate deliberately does NOT
  // touch — clear it here for test isolation (the shell does this on unmount).
  beforeEach(() => {
    resetMandatoryGate();
    setMandatoryGateHeld(false);
  });
  afterEach(() => {
    resetMandatoryGate();
    setMandatoryGateHeld(false);
  });

  describe('isInterruptiveMandatoryTask (Option A scope)', () => {
    it('corp first action + forced hand pick are ALWAYS interruptive', () => {
      expect(isInterruptiveMandatoryTask({kind: 'corpFirstAction'}, false)).to.be.true;
      expect(isInterruptiveMandatoryTask({kind: 'handSelect'}, false)).to.be.true;
    });

    it('a colony-bonus DELIVERY is always interruptive (it is never our own doing)', () => {
      // It only ever arises from SOMEBODY ELSE's trade — the trader's own cube
      // resolves inline with no prompt at all — so the announcement is the
      // door whatever the viewer's status happens to say.
      expect(isInterruptiveMandatoryTask({kind: 'colonyBonus'}, true)).to.be.true;
      expect(isInterruptiveMandatoryTask({kind: 'colonyBonus'}, false)).to.be.true;
      // A MARSBOT ATTACK is raised during the BOT's turn on a player who did
      // not ask for it — interruptive whatever the viewer's own status says,
      // so it is ANNOUNCED and never opened over whatever they were doing.
      expect(isInterruptiveMandatoryTask({kind: 'botAttack'}, true)).to.be.true;
      expect(isInterruptiveMandatoryTask({kind: 'botAttack'}, false)).to.be.true;
    });

    it('triggered sub-prompts are gated ONLY off the viewer\'s own turn', () => {
      const player: ConsoleTask = {kind: 'player'};
      expect(isInterruptiveMandatoryTask(player, true)).to.be.true; // forced reaction
      expect(isInterruptiveMandatoryTask(player, false)).to.be.false; // own turn continuation
      // A spread of host sub-prompt kinds behaves the same.
      for (const kind of ['choice', 'amount', 'resource', 'distribute', 'payment', 'colony', 'composite'] as const) {
        expect(isInterruptiveMandatoryTask({kind} as ConsoleTask, true), kind).to.be.true;
        expect(isInterruptiveMandatoryTask({kind} as ConsoleTask, false), kind).to.be.false;
      }
    });

    it('the player\'s OWN turn surfaces are NEVER gated', () => {
      for (const kind of ['actionMenu', 'space', 'draftWait', 'initialDraft', 'awardFunding', 'aresGlobal'] as const) {
        expect(isInterruptiveMandatoryTask({kind} as ConsoleTask, true), kind).to.be.false;
      }
      expect(isInterruptiveMandatoryTask({kind: 'cardSelect', mode: 'draft'}, true)).to.be.false;
      expect(isInterruptiveMandatoryTask(undefined, true)).to.be.false;
    });
  });

  describe('mandatoryBeatFor — decision-beat derivation', () => {
    it('a drawn-cards reveal is NEVER a beat — only the discard decision is (Pluto)', () => {
      // Pluto: the reveal + the discard arrive together, but the reveal flows
      // straight through its draw cinematic. The DISCARD (a distinct surface,
      // reached after the reveal settles) is the only gated beat.
      const beat = mandatoryBeatFor({
        task: {kind: 'handSelect'},
        taskKey: 'card|Select a card to discard',
        forcedReaction: false,
      });
      expect(beat).to.deep.eq({key: 'task:card|Select a card to discard', taskKind: 'handSelect'});
    });

    it('is undefined for a non-interruptive task (own turn)', () => {
      expect(mandatoryBeatFor({
        task: {kind: 'player'},
        taskKey: 'player|Select player',
        forcedReaction: false,
      })).to.eq(undefined);
    });

    it('a FLOW beat presents when no task beat outranks it (deterministic order)', () => {
      const draft: MandatoryFlowBeat = {key: 'draft:gen3', taskKind: 'cardSelect', flow: 'draft'};
      // The draft prompt itself is not an interruptive TASK (cardSelect on the
      // player's own simultaneous phase) — the FLOW beat is what represents it.
      expect(mandatoryBeatFor({
        task: {kind: 'cardSelect', mode: 'draft'},
        taskKey: 'card|Select a card to keep',
        forcedReaction: false,
        flows: [draft],
      })).to.deep.eq({key: 'draft:gen3', taskKind: 'cardSelect', flow: 'draft'});
      // A task beat (the server's immediate demand) ALWAYS outranks a flow.
      const beat = mandatoryBeatFor({
        task: {kind: 'handSelect'},
        taskKey: 'card|Discard a card',
        forcedReaction: false,
        flows: [draft],
      });
      expect(beat?.key).to.eq('task:card|Discard a card');
      expect(beat?.flow).to.eq(undefined);
      // Among flows, the array order decides — the FIRST is the one presented
      // (one plate at a time, never a visual stack).
      const second: MandatoryFlowBeat = {key: 'other:1', taskKind: 'cardSelect', flow: 'draft'};
      expect(mandatoryBeatFor({
        task: undefined, taskKey: '', forcedReaction: false,
        flows: [draft, second],
      })?.key).to.eq('draft:gen3');
    });
  });

  describe('held / acknowledge lifecycle', () => {
    it('a beat is held until its exact key is acknowledged', () => {
      const first = {key: 'task:or|corp', taskKind: 'corpFirstAction'} as const;
      const discard = {key: 'task:card|discard', taskKind: 'handSelect'} as const;
      expect(isMandatoryBeatHeld(first)).to.be.true;
      acknowledgeMandatoryBeat(first.key);
      expect(isMandatoryBeatHeld(first)).to.be.false; // opened
      // The NEXT beat (the discard) is a different key → still held.
      expect(isMandatoryBeatHeld(discard)).to.be.true;
      acknowledgeMandatoryBeat(discard.key);
      expect(isMandatoryBeatHeld(discard)).to.be.false;
      expect(isMandatoryBeatHeld(undefined)).to.be.false;
    });

    it('reset clears the acknowledgment', () => {
      acknowledgeMandatoryBeat('task:or|corp');
      resetMandatoryGate();
      expect(isMandatoryBeatHeld({key: 'task:or|corp', taskKind: 'corpFirstAction'})).to.be.true;
    });

    // Regression: resetMandatoryGate() (called in the shell's mounted() AFTER the
    // immediate mirror watcher already set `held`) must NOT clobber the `held`
    // mirror — else it desyncs (watcher won't re-fire on an unchanged computed)
    // and the leak detector false-positives a held corp-first-action as stranded
    // the moment the player leaves the board home.
    it('reset does NOT clear the held mirror (owned by the shell watcher)', () => {
      setMandatoryGateHeld(true);
      resetMandatoryGate();
      expect(isMandatoryGateHeld(), 'the held mirror survives a gate reset').to.be.true;
    });
  });

  describe('the presented latch (the asymmetric first-presentation boundary)', () => {
    const draft = {key: 'draft:gen2', taskKind: 'cardSelect', flow: 'draft'} as const;
    const discard = {key: 'task:card|discard', taskKind: 'handSelect'} as const;

    it('a beat starts un-presented; marking it latches by exact key', () => {
      expect(isMandatoryBeatPresented(draft)).to.be.false;
      markMandatoryBeatPresented(draft.key);
      expect(isMandatoryBeatPresented(draft)).to.be.true;
      // Marking is idempotent — equivalent server updates re-derive the same
      // key and change nothing (no plate re-mount, no replayed entrance).
      markMandatoryBeatPresented(draft.key);
      expect(isMandatoryBeatPresented(draft)).to.be.true;
      // A DIFFERENT beat is its own presentation cycle.
      expect(isMandatoryBeatPresented(discard)).to.be.false;
      expect(isMandatoryBeatPresented(undefined)).to.be.false;
    });

    it('reset clears the presented latch', () => {
      markMandatoryBeatPresented(draft.key);
      resetMandatoryGate();
      expect(isMandatoryBeatPresented(draft)).to.be.false;
    });
  });

  describe('noteMandatoryBeatIdentity — latches die with their beat', () => {
    const draft = {key: 'draft:gen2', taskKind: 'cardSelect', flow: 'draft'} as const;

    it('a completed/invalidated beat retires both latches', () => {
      markMandatoryBeatPresented(draft.key);
      acknowledgeMandatoryBeat(draft.key);
      // The flow ended (or stopped being relevant): no current beat.
      noteMandatoryBeatIdentity(undefined);
      // The SAME key arising again later (an admin rollback replaying the same
      // generation) is a NEW pending action: held again, un-presented again —
      // never silently pre-acknowledged into a surface nobody opens.
      expect(isMandatoryBeatHeld(draft)).to.be.true;
      expect(isMandatoryBeatPresented(draft)).to.be.false;
    });

    it('a SUPERSEDING beat retires the old latches, not its own', () => {
      markMandatoryBeatPresented(draft.key);
      acknowledgeMandatoryBeat(draft.key);
      noteMandatoryBeatIdentity('task:card|discard');
      expect(isMandatoryBeatHeld({key: 'task:card|discard', taskKind: 'handSelect'})).to.be.true;
      // …and the new beat's own latches, once set, survive its own note.
      markMandatoryBeatPresented('task:card|discard');
      noteMandatoryBeatIdentity('task:card|discard');
      expect(isMandatoryBeatPresented({key: 'task:card|discard', taskKind: 'handSelect'})).to.be.true;
    });

    it('the current beat\'s latches are never touched', () => {
      markMandatoryBeatPresented(draft.key);
      noteMandatoryBeatIdentity(draft.key);
      expect(isMandatoryBeatPresented(draft)).to.be.true;
    });
  });
});
