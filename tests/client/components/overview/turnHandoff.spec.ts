import {expect} from 'chai';
import {Color} from '@/common/Color';
import {
  decideTurnTransition,
  noteTurnState,
  registerTurnInput,
  resetTurnHandoff,
  turnHandoffState,
} from '@/client/components/overview/turnHandoffState';

// Color is a string union ('red' | 'blue' | …), not an enum.
const RED: Color = 'red';
const BLUE: Color = 'blue';
const GREEN: Color = 'green';

describe('turnHandoffState', () => {
  beforeEach(() => {
    resetTurnHandoff();
  });

  describe('decideTurnTransition (pure)', () => {
    it('first observation seeds (never bursts on load)', () => {
      expect(decideTurnTransition(undefined, BLUE, false)).to.deep.eq({kind: 'seed'});
      expect(decideTurnTransition(RED, BLUE, false)).to.deep.eq({kind: 'seed'});
    });

    it('same owner is a no-op (continuation / lone player)', () => {
      expect(decideTurnTransition(BLUE, BLUE, true)).to.deep.eq({kind: 'none'});
      expect(decideTurnTransition(undefined, undefined, true)).to.deep.eq({kind: 'none'});
    });

    it('owner change is a hand-off carrying previous→owner', () => {
      expect(decideTurnTransition(RED, BLUE, true))
        .to.deep.eq({kind: 'handoff', owner: BLUE, previous: RED});
      // Leaving ACTION (owner → undefined) is still a hand-off (clears state).
      expect(decideTurnTransition(BLUE, undefined, true))
        .to.deep.eq({kind: 'handoff', owner: undefined, previous: BLUE});
    });
  });

  describe('noteTurnState (controller)', () => {
    it('seeds silently — adopts the owner with NO burst', () => {
      noteTurnState({localColor: RED, owner: BLUE, reducedMotion: true});
      expect(turnHandoffState.seeded).to.eq(true);
      expect(turnHandoffState.currentOwner).to.eq(BLUE);
      expect(turnHandoffState.burstColor).to.eq(undefined);
    });

    it('bursts the new owner on a hand-off (opponent → calm, no local flag)', () => {
      noteTurnState({localColor: RED, owner: BLUE, reducedMotion: true}); // seed
      noteTurnState({localColor: RED, owner: GREEN, reducedMotion: true});
      expect(turnHandoffState.currentOwner).to.eq(GREEN);
      expect(turnHandoffState.previousOwner).to.eq(BLUE);
      expect(turnHandoffState.burstColor).to.eq(GREEN);
      expect(turnHandoffState.burstIsLocal).to.eq(false);
    });

    it('marks the local player burst as local (▶ ВАШ ХОД)', () => {
      noteTurnState({localColor: RED, owner: BLUE, reducedMotion: true}); // seed
      noteTurnState({localColor: RED, owner: RED, reducedMotion: true});
      expect(turnHandoffState.burstColor).to.eq(RED);
      expect(turnHandoffState.burstIsLocal).to.eq(true);
    });

    it('does NOT re-burst when the owner is unchanged (continuation / lone)', () => {
      noteTurnState({localColor: RED, owner: RED, reducedMotion: true}); // seed (own turn)
      expect(turnHandoffState.burstColor).to.eq(undefined);
      noteTurnState({localColor: RED, owner: RED, reducedMotion: true}); // same owner
      expect(turnHandoffState.burstColor).to.eq(undefined);
    });

    it('fires the handoff beam only when not reduced-motion', () => {
      noteTurnState({localColor: RED, owner: BLUE, reducedMotion: false}); // seed
      noteTurnState({localColor: RED, owner: GREEN, reducedMotion: false});
      expect(turnHandoffState.beam).to.not.eq(undefined);
      expect(turnHandoffState.beam?.from).to.eq(BLUE);
      expect(turnHandoffState.beam?.to).to.eq(GREEN);

      resetTurnHandoff();
      noteTurnState({localColor: RED, owner: BLUE, reducedMotion: true}); // seed
      noteTurnState({localColor: RED, owner: GREEN, reducedMotion: true});
      expect(turnHandoffState.beam).to.eq(undefined);
    });
  });

  describe('idle escalation', () => {
    it('registerTurnInput clears the idle hint during the local turn', () => {
      noteTurnState({localColor: RED, owner: BLUE, reducedMotion: true}); // seed
      noteTurnState({localColor: RED, owner: RED, reducedMotion: true});  // local turn
      turnHandoffState.idleHintActive = true; // simulate the escalation having fired
      registerTurnInput();
      expect(turnHandoffState.idleHintActive).to.eq(false);
    });

    it('registerTurnInput is ignored when it is NOT the local player turn', () => {
      noteTurnState({localColor: RED, owner: BLUE, reducedMotion: true}); // seed
      noteTurnState({localColor: RED, owner: GREEN, reducedMotion: true}); // opponent turn
      turnHandoffState.idleHintActive = true;
      registerTurnInput();
      expect(turnHandoffState.idleHintActive).to.eq(true); // not the local turn → untouched
    });
  });
});
