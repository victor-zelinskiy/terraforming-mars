import {expect} from 'chai';
import {
  isInterruptiveMandatoryTask,
  mandatoryBeatFor,
  isMandatoryBeatHeld,
  acknowledgeMandatoryBeat,
  resetMandatoryGate,
  setMandatoryGateHeld,
  isMandatoryGateHeld,
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
});
