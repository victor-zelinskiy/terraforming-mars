import {expect} from 'chai';
import {
  isInterruptiveMandatoryTask,
  mandatoryBeatFor,
  isMandatoryBeatHeld,
  acknowledgeMandatoryBeat,
  resetMandatoryGate,
} from '@/client/console/consoleMandatoryGate';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';

describe('consoleMandatoryGate (the mandatory announcement gate)', () => {
  beforeEach(() => resetMandatoryGate());
  afterEach(() => resetMandatoryGate());

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

  describe('mandatoryBeatFor — beat derivation + reveal priority', () => {
    it('a drawn reveal OUTRANKS a pending task (the Pluto sequence)', () => {
      // Pluto: the reveal batch AND the discard handSelect arrive together.
      const beat = mandatoryBeatFor({
        revealDrawnBatchId: 7,
        task: {kind: 'handSelect'},
        taskKey: 'card|Select a card to discard',
        forcedReaction: false,
      });
      expect(beat).to.deep.eq({kind: 'reveal', key: 'reveal:7'});
    });

    it('falls to the task beat once the reveal has cleared', () => {
      const beat = mandatoryBeatFor({
        revealDrawnBatchId: undefined,
        task: {kind: 'handSelect'},
        taskKey: 'card|Select a card to discard',
        forcedReaction: false,
      });
      expect(beat).to.deep.eq({kind: 'task', key: 'task:card|Select a card to discard', taskKind: 'handSelect'});
    });

    it('is undefined for a non-interruptive task (own turn)', () => {
      expect(mandatoryBeatFor({
        revealDrawnBatchId: undefined,
        task: {kind: 'player'},
        taskKey: 'player|Select player',
        forcedReaction: false,
      })).to.eq(undefined);
    });
  });

  describe('held / acknowledge lifecycle', () => {
    it('a beat is held until its exact key is acknowledged', () => {
      const reveal = {kind: 'reveal', key: 'reveal:7'} as const;
      const discard = {kind: 'task', key: 'task:card|discard', taskKind: 'handSelect'} as const;
      expect(isMandatoryBeatHeld(reveal)).to.be.true;
      acknowledgeMandatoryBeat(reveal.key);
      expect(isMandatoryBeatHeld(reveal)).to.be.false; // reveal opened
      // The NEXT beat (the discard) is a different key → still held.
      expect(isMandatoryBeatHeld(discard)).to.be.true;
      acknowledgeMandatoryBeat(discard.key);
      expect(isMandatoryBeatHeld(discard)).to.be.false;
      expect(isMandatoryBeatHeld(undefined)).to.be.false;
    });

    it('reset clears the acknowledgment', () => {
      acknowledgeMandatoryBeat('reveal:7');
      resetMandatoryGate();
      expect(isMandatoryBeatHeld({kind: 'reveal', key: 'reveal:7'})).to.be.true;
    });
  });
});
