import {expect} from 'chai';
import {
  consoleRepeatPickState,
  enterConsoleRepeatPick,
  resolveConsoleRepeatPick,
  cancelConsoleRepeatPick,
  resetConsoleRepeatPick,
  isConsoleRepeatPickActive,
  ConsoleRepeatPickRequest,
  ConsoleRepeatPickResult,
} from '@/client/console/consoleRepeatPick';
import {repeatActionResponses} from '@/client/console/consoleActionComposer';
import {CardName} from '@/common/cards/CardName';

const request: ConsoleRepeatPickRequest = {
  title: 'Perform an action from a played card again',
  buttonLabel: 'Take action',
  candidates: [CardName.SEARCH_FOR_LIFE, CardName.PETS],
  disabled: [],
  source: {kicker: 'Play card', card: CardName.PROJECT_INSPECTION},
};

const result: ConsoleRepeatPickResult = {
  chosenCard: CardName.SEARCH_FOR_LIFE,
  nodeIndex: 0,
  composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
};

describe('consoleRepeatPick bridge', () => {
  afterEach(() => resetConsoleRepeatPick());

  it('enter flips the state + stores the request; resolve fires the callback ONCE and clears', () => {
    let got: ConsoleRepeatPickResult | undefined;
    enterConsoleRepeatPick(request, (r) => {
      got = r;
    });
    expect(isConsoleRepeatPickActive()).to.be.true;
    expect(consoleRepeatPickState.request?.candidates).to.deep.equal([CardName.SEARCH_FOR_LIFE, CardName.PETS]);

    resolveConsoleRepeatPick(result);
    expect(got).to.deep.equal(result);
    expect(isConsoleRepeatPickActive()).to.be.false;
    expect(consoleRepeatPickState.request).to.be.undefined;

    // A second resolve is a no-op (no longer active).
    got = undefined;
    resolveConsoleRepeatPick(result);
    expect(got).to.be.undefined;
  });

  it('cancel fires the cancel callback (never resolve) and clears', () => {
    let resolved = false;
    let cancelled = false;
    enterConsoleRepeatPick(request, () => {
      resolved = true;
    }, () => {
      cancelled = true;
    });
    cancelConsoleRepeatPick();
    expect(cancelled).to.be.true;
    expect(resolved).to.be.false;
    expect(isConsoleRepeatPickActive()).to.be.false;
  });

  it('reset clears the state WITHOUT firing any callback', () => {
    let fired = false;
    enterConsoleRepeatPick(request, () => {
      fired = true;
    }, () => {
      fired = true;
    });
    resetConsoleRepeatPick();
    expect(isConsoleRepeatPickActive()).to.be.false;
    expect(fired).to.be.false;
  });
});

/**
 * The repeat tail must be BYTE-IDENTICAL to the desktop `submitRepeatActionBatch`
 * tail: `[{card:chosen}, ...chosen action's composed responses]` — the source
 * (ProjectInspection play / Viron activate) is prepended by the caller.
 */
describe('repeatActionResponses (batch tail)', () => {
  it('a bare no-decision action → just the card pick', () => {
    const tail = repeatActionResponses(CardName.PETS,
      {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []});
    expect(tail).to.deep.equal([{type: 'card', cards: [CardName.PETS]}]);
  });

  it('a with-decision action → card pick + OR branch slot + steps', () => {
    const stepResp = {type: 'player', player: 'red'};
    const tail = repeatActionResponses(CardName.SEARCH_FOR_LIFE, {
      branchIndex: 2, preResponses: [{type: 'and'}], optionResponse: undefined, stepResponses: [stepResp],
    });
    expect(tail).to.deep.equal([
      {type: 'card', cards: [CardName.SEARCH_FOR_LIFE]},
      {type: 'and'},
      {type: 'or', index: 2, response: {type: 'option'}},
      stepResp,
    ]);
  });

  it('a lone auto-resolved branch (index<0) with a direct optionResponse → bare, no OR wrap', () => {
    const optionResponse = {type: 'amount', amount: 3};
    const tail = repeatActionResponses(CardName.PETS,
      {branchIndex: -1, preResponses: [], optionResponse, stepResponses: []});
    expect(tail).to.deep.equal([
      {type: 'card', cards: [CardName.PETS]},
      optionResponse,
    ]);
  });
});
