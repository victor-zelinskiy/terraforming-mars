import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  handSelectState,
  handCardSelectionPrompt,
  handSelectSignature,
  enterHandSelect,
  exitHandSelect,
  toggleHandSelectSelection,
  isSelectedForHandSelect,
  isHandSelectable,
} from '@/client/components/handCards/handSelectState';
import {handFilterState} from '@/client/components/handCards/handFilterState';

const A = CardName.ANTS;
const B = CardName.BACTOVIRAL_RESEARCH;
const C = CardName.COMET_AIMING;
const X = CardName.DIRIGIBLES;
const Y = CardName.EARTH_OFFICE;
const Z = CardName.ADAPTATION_TECHNOLOGY;

function view(waitingFor: any, hand: Array<CardName>): any {
  return {
    waitingFor,
    cardsInHand: hand.map((name) => ({name})),
  };
}

function cardPrompt(names: Array<CardName>, min: number, max: number): any {
  return {
    type: 'card',
    title: 'Select a card to discard',
    buttonLabel: 'Discard',
    cards: names.map((name) => ({name})),
    min,
    max,
  };
}

describe('handSelectState', () => {
  afterEach(() => exitHandSelect());

  describe('handCardSelectionPrompt', () => {
    it('matches a top-level SelectCard whose candidates are all in hand', () => {
      const wf = cardPrompt([A, B], 2, 2);
      expect(handCardSelectionPrompt(view(wf, [A, B, C]))).to.eq(wf);
    });

    it('ignores a SelectCard whose candidates are NOT in hand (draft / research)', () => {
      const wf = cardPrompt([X, Y], 1, 1);
      expect(handCardSelectionPrompt(view(wf, [A, B]))).to.eq(undefined);
    });

    it('ignores non-card and empty prompts', () => {
      expect(handCardSelectionPrompt(view({type: 'or', options: []}, [A]))).to.eq(undefined);
      expect(handCardSelectionPrompt(view(cardPrompt([], 0, 0), [A]))).to.eq(undefined);
      expect(handCardSelectionPrompt(view(undefined, [A]))).to.eq(undefined);
    });
  });

  describe('selection state', () => {
    it('enters with the prompt bounds + candidate set and a stable signature', () => {
      const wf = cardPrompt([A, B, C], 1, 2);
      enterHandSelect(wf);
      expect(handSelectState.active).to.be.true;
      expect(handSelectState.min).to.eq(1);
      expect(handSelectState.max).to.eq(2);
      expect(handSelectState.selected).to.deep.eq([]);
      expect(handSelectSignature(wf)).to.eq(handSelectState.signature);
      expect(isHandSelectable(A)).to.be.true;
      expect(isHandSelectable(Z)).to.be.false;
    });

    it('toggles selection, respecting max and the selectable set', () => {
      enterHandSelect(cardPrompt([A, B, C], 1, 2));
      toggleHandSelectSelection(A);
      toggleHandSelectSelection(B);
      expect(handSelectState.selected).to.deep.eq([A, B]);
      // Max reached → a third pick is ignored.
      toggleHandSelectSelection(C);
      expect(handSelectState.selected).to.deep.eq([A, B]);
      // Non-selectable name is ignored.
      toggleHandSelectSelection(Z);
      expect(isSelectedForHandSelect(Z)).to.be.false;
      // Deselect frees a slot.
      toggleHandSelectSelection(A);
      expect(handSelectState.selected).to.deep.eq([B]);
      toggleHandSelectSelection(C);
      expect(handSelectState.selected).to.deep.eq([B, C]);
    });

    it('exit clears everything', () => {
      enterHandSelect(cardPrompt([A], 1, 1));
      toggleHandSelectSelection(A);
      exitHandSelect();
      expect(handSelectState.active).to.be.false;
      expect(handSelectState.selected).to.deep.eq([]);
      expect(handSelectState.selectable).to.deep.eq([]);
    });
  });

  // The select mode BORROWS the availability filter (snaps it to "Available" so
  // the player sees the selectable cards), but the mode-forced value must NOT
  // persist for the user — only filters the player chose themselves in the UI do.
  describe('availability filter is borrowed, not persisted', () => {
    afterEach(() => {
      handFilterState.availability = 'all';
    });

    it('forces "playable" on enter and RESTORES the user filter on exit', () => {
      handFilterState.availability = 'all'; // the user's own choice
      enterHandSelect(cardPrompt([A, B], 1, 1));
      expect(handFilterState.availability).to.eq('playable'); // borrowed for the mode
      exitHandSelect();
      expect(handFilterState.availability).to.eq('all'); // user's choice restored
    });

    it('restores a NON-default user filter too', () => {
      handFilterState.availability = 'unplayable';
      enterHandSelect(cardPrompt([A], 1, 1));
      expect(handFilterState.availability).to.eq('playable');
      exitHandSelect();
      expect(handFilterState.availability).to.eq('unplayable');
    });

    it('a re-enter (signature change while active) does NOT corrupt the saved value', () => {
      handFilterState.availability = 'all';
      enterHandSelect(cardPrompt([A], 1, 1));
      // A new prompt arrives while still in select mode — availability is already
      // the mode-forced 'playable'; re-saving it here would be the bug.
      enterHandSelect(cardPrompt([A, B], 1, 1));
      expect(handFilterState.availability).to.eq('playable');
      exitHandSelect();
      expect(handFilterState.availability).to.eq('all'); // still the original
    });
  });
});
