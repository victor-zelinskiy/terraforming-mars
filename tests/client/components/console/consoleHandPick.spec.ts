import {expect} from 'chai';
import {
  consoleHandPickState,
  enterConsoleHandPick,
  resolveConsoleHandPick,
  cancelConsoleHandPick,
  resetConsoleHandPick,
  isConsoleHandPickActive,
  isHandCardSelection,
  ConsoleHandPickRequest,
} from '@/client/console/consoleHandPick';
import {CardName} from '@/common/cards/CardName';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

function request(over: Partial<ConsoleHandPickRequest> = {}): ConsoleHandPickRequest {
  return {
    title: 'Select 1 card to discard',
    buttonLabel: 'Discard',
    selectable: [CardName.ANTS, CardName.BIRDS],
    reasons: {},
    min: 1,
    max: 1,
    selected: [],
    ...over,
  };
}

function cardModel(names: ReadonlyArray<string>, over: Partial<SelectCardModel> = {}): SelectCardModel {
  return {
    type: 'card',
    title: 't',
    buttonLabel: 'b',
    cards: names.map((name) => ({name})),
    min: 1,
    max: 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: false,
    showOwner: false,
    showSelectAll: false,
    ...over,
  } as SelectCardModel;
}

describe('consoleHandPick (the composer → hand-section bridge)', () => {
  afterEach(() => {
    resetConsoleHandPick();
  });

  it('enter arms the state, resets the filter and drops stale pre-selections', () => {
    enterConsoleHandPick(request({
      min: 0, max: 3,
      // BIRDS survives; DECOMPOSERS is no longer a candidate → dropped.
      selected: [CardName.BIRDS, CardName.DECOMPOSERS],
    }), () => {});
    expect(isConsoleHandPickActive()).to.be.true;
    expect(consoleHandPickState.selected).to.deep.equal([CardName.BIRDS]);
    expect(consoleHandPickState.suitableOnly).to.be.true;
    expect(consoleHandPickState.request?.buttonLabel).to.equal('Discard');
  });

  it('resolve fires the composer callback with the picked cards and resets', () => {
    let got: ReadonlyArray<CardName> | undefined;
    enterConsoleHandPick(request(), (cards) => {
      got = cards;
    });
    resolveConsoleHandPick([CardName.ANTS]);
    expect(got).to.deep.equal([CardName.ANTS]);
    expect(isConsoleHandPickActive()).to.be.false;
    expect(consoleHandPickState.request).to.be.undefined;
  });

  it('an EMPTY multi answer is delivered (Public Plans min 0 — a conscious choice)', () => {
    let got: ReadonlyArray<CardName> | undefined;
    enterConsoleHandPick(request({min: 0, max: 5}), (cards) => {
      got = cards;
    });
    resolveConsoleHandPick([]);
    expect(got).to.deep.equal([]);
  });

  it('cancel fires the cancel callback (old capture kept by the composer) and resets', () => {
    let resolved = false;
    let cancelled = false;
    enterConsoleHandPick(request(), () => {
      resolved = true;
    }, () => {
      cancelled = true;
    });
    cancelConsoleHandPick();
    expect(resolved).to.be.false;
    expect(cancelled).to.be.true;
    expect(isConsoleHandPickActive()).to.be.false;
  });

  it('resolve / cancel are idempotent no-ops when inactive', () => {
    let calls = 0;
    enterConsoleHandPick(request(), () => {
      calls++;
    });
    resolveConsoleHandPick([CardName.ANTS]);
    resolveConsoleHandPick([CardName.BIRDS]);
    cancelConsoleHandPick();
    expect(calls).to.equal(1);
  });

  it('a re-enter preserves the passed selection (multi «Изменить»)', () => {
    enterConsoleHandPick(request({min: 0, max: 3, selected: [CardName.ANTS, CardName.BIRDS]}), () => {});
    expect(consoleHandPickState.selected).to.deep.equal([CardName.ANTS, CardName.BIRDS]);
  });

  describe('isHandCardSelection', () => {
    const hand = new Set<string>([CardName.ANTS, CardName.BIRDS, CardName.DECOMPOSERS]);

    it('every candidate in hand → hand pick', () => {
      expect(isHandCardSelection(cardModel([CardName.ANTS, CardName.BIRDS]), hand)).to.be.true;
    });

    it('disabled candidates count toward the hand check', () => {
      const inHand = cardModel([CardName.ANTS], {disabledCards: [{name: CardName.BIRDS}]} as Partial<SelectCardModel>);
      expect(isHandCardSelection(inHand, hand)).to.be.true;
      const offHand = cardModel([CardName.ANTS], {disabledCards: [{name: CardName.PETS}]} as Partial<SelectCardModel>);
      expect(isHandCardSelection(offHand, hand)).to.be.false;
    });

    it('a tableau candidate breaks it; an empty selectable set is never a hand pick', () => {
      expect(isHandCardSelection(cardModel([CardName.PETS]), hand)).to.be.false;
      expect(isHandCardSelection(cardModel([]), hand)).to.be.false;
    });
  });
});
