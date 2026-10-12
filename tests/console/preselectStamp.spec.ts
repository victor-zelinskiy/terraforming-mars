import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Payment} from '../../src/common/inputs/Payment';
import {PreselectAddress} from '../../src/common/inputs/preselectAddress';
import {ActionPreview, ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {PlayerInputModel, SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {buildPlayCardBatch} from '../../src/client/console/consolePlayCardComposer';
import {buildActionBatch, orderedPreResponses, orderedStepResponses, repeatActionResponses} from '../../src/client/console/consoleActionComposer';
import {stepResponse} from '../../src/client/components/colonies/colonyTradePlan';
import {armPostCommitWitness, checkPostCommitChoice, checkPreselectReask, notePreselectBatch, POST_COMMIT_CHOICE, resetPostCommitWitness, resetPreselectWitness} from '../../src/client/console/preselectWitness';
import {ACTION_MENU_NEXT_TITLE} from '../../src/common/inputs/actionMenuTitles';

/**
 * THE CLIENT HALF OF THE PRE-SELECT LAW — every batch builder stamps every
 * answer after the head with the address the preview gave its step
 * (`addressed(response, step.for)`), and the «re-asked» witness reports a
 * question of the last batch standing again. Pure builders, the server runner.
 */
const GRANT: PreselectAddress = {role: 'card', source: {kind: 'card', card: CardName.ICHTIOLOGY_GRANT}};
const CHOICE: PreselectAddress = {role: 'or', source: {kind: 'card', card: CardName.ICHTIOLOGY_GRANT}};
const CARD_MODEL = {type: 'card', title: 'x', buttonLabel: 'x', cards: [], min: 1, max: 1} as unknown as SelectCardModel;

function branchWith(steps: ActionPreviewBranch['steps'], extra: Partial<ActionPreviewBranch> = {}): ActionPreviewBranch {
  return {index: 1, title: 't', available: true, renderKeys: [], effects: [], steps, for: CHOICE, ...extra};
}

describe('pre-select stamping (the client batch builders)', () => {
  it('orderedStepResponses stamps each input answer with ITS step\'s address; an unaddressed step stays bare', () => {
    const branch = branchWith([
      {kind: 'input', input: CARD_MODEL, for: GRANT},
      {kind: 'note', noteKind: 'generic'},
      {kind: 'input', input: CARD_MODEL},
    ]);
    const out = orderedStepResponses(branch, {0: {type: 'card', cards: [CardName.PETS]}, 2: {type: 'card', cards: [CardName.BIRDS]}});
    expect(out).deep.eq([
      {type: 'card', cards: [CardName.PETS], for: GRANT},
      {type: 'card', cards: [CardName.BIRDS]},
    ]);
  });

  it('orderedPreResponses stamps a pre-step\'s answer', () => {
    const preview = {card: CardName.ICHTIOLOGY_GRANT, isCorporation: false, kind: 'declarative', branches: [],
      preSteps: [{kind: 'input', input: CARD_MODEL, for: GRANT}]} as unknown as ActionPreview;
    expect(orderedPreResponses(preview, {0: {type: 'card', cards: [CardName.PETS]}})).deep.eq([{type: 'card', cards: [CardName.PETS], for: GRANT}]);
  });

  it('buildPlayCardBatch: the head bare, the branch pick and the steps addressed — `[play, {or, for}, {card, for}]`', () => {
    const batch = buildPlayCardBatch({
      playPath: [3], cardName: CardName.ICHTIOLOGY_GRANT, payment: Payment.of({megacredits: 10}),
      branchIndex: 1, branchFor: CHOICE, preResponses: [], optionResponse: undefined,
      stepResponses: [{type: 'card', cards: [CardName.TARDIGRADES], for: GRANT}],
    });
    expect(batch[0]).not.to.have.property('for');
    expect(batch[1]).deep.eq({type: 'or', index: 1, response: {type: 'option'}, for: CHOICE});
    expect(batch[2]).deep.eq({type: 'card', cards: [CardName.TARDIGRADES], for: GRANT});
  });

  it('…a lone branch\'s bare optionInput answer carries the branch\'s address', () => {
    const batch = buildPlayCardBatch({
      playPath: [], cardName: CardName.ICHTIOLOGY_GRANT, payment: Payment.of({megacredits: 10}),
      branchIndex: -1, branchFor: GRANT, preResponses: [], optionResponse: {type: 'card', cards: [CardName.PETS]}, stepResponses: [],
    });
    expect(batch[1]).deep.eq({type: 'card', cards: [CardName.PETS], for: GRANT});
  });

  it('buildActionBatch and the repeat tail stamp the same way', () => {
    const batch = buildActionBatch({
      performPath: [2], cardName: CardName.VERMIN, branchIndex: 0, branchFor: CHOICE,
      preResponses: [], optionResponse: undefined, stepResponses: [],
    });
    expect(batch[1]).deep.eq({type: 'or', index: 0, response: {type: 'option'}, for: CHOICE});
    const tail = repeatActionResponses(CardName.VERMIN, {branchIndex: 0, branchFor: CHOICE, preResponses: [], optionResponse: undefined, stepResponses: []});
    expect(tail[0], 'the repeat\'s own card pick is the head of the copied action').deep.eq({type: 'card', cards: [CardName.VERMIN]});
    expect(tail[1]).deep.eq({type: 'or', index: 0, response: {type: 'option'}, for: CHOICE});
  });

  it('the trade composer\'s reward target is addressed to the colony\'s own pick', () => {
    const venus: PreselectAddress = {role: 'card', source: {kind: 'colony', name: ColonyName.VENUS_REDUX}};
    const response = stepResponse({kind: 'cardTarget', role: 'tradeReward', resource: 'floater', amount: 1, pick: CARD_MODEL, for: venus}, CardName.DIRIGIBLES);
    expect(response).deep.eq({type: 'card', cards: [CardName.DIRIGIBLES], for: venus});
  });
});

describe('the «re-asked» witness', () => {
  const discardOfAcademies = {type: 'card', title: 'x', buttonLabel: 'x', cards: [], min: 1, max: 1,
    discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: CardName.SPONSORED_ACADEMIES}}} as unknown as PlayerInputModel;
  const academiesDiscard: PreselectAddress = {role: 'discard', source: {kind: 'card', card: CardName.SPONSORED_ACADEMIES}};
  let warns: Array<string>;
  let original: typeof console.warn;

  beforeEach(() => {
    resetPreselectWitness();
    warns = [];
    original = console.warn;
    console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
  });
  afterEach(() => {
    console.warn = original;
    resetPreselectWitness();
  });

  it('the discard the batch answered, standing again → ONE report (and one warn the e2e harness reads)', () => {
    notePreselectBatch([{type: 'or', index: 0, response: {}}, {type: 'card', cards: [CardName.ANTS], for: academiesDiscard}]);
    expect(checkPreselectReask(discardOfAcademies)).has.length(1);
    expect(warns).has.length(1);
    expect(warns[0]).to.include('RE-ASKED PRE-SELECT');
    expect(checkPreselectReask(discardOfAcademies), 'the same view applied again does not warn twice').deep.eq([]);
  });

  it('a STAGED tail is not judged — its own re-ask is by design, and a multi-tile card\'s second placement shares its address', () => {
    notePreselectBatch([{type: 'or'}, {type: 'space', spaceId: '05', stagedFor: CardName.ICE_ASTEROID}]);
    const secondOcean = {type: 'space', title: 'x', buttonLabel: 'x', spaces: [], sourceCard: CardName.ICE_ASTEROID} as unknown as PlayerInputModel;
    expect(checkPreselectReask(secondOcean)).deep.eq([]);
    expect(warns).is.empty;
  });

  it('a question nested in an `or` is found too', () => {
    notePreselectBatch([{type: 'or'}, {type: 'card', cards: [CardName.ANTS], for: academiesDiscard}]);
    expect(checkPreselectReask({type: 'or', title: 'x', buttonLabel: 'x', options: [discardOfAcademies]} as unknown as PlayerInputModel)).has.length(1);
  });

  it('an interloper (another asker) is no report — and the memory survives it until the action menu', () => {
    notePreselectBatch([{type: 'or'}, {type: 'card', cards: [CardName.ANTS], for: academiesDiscard}]);
    const olympus = {type: 'or', title: 'x', buttonLabel: 'x', options: [{type: 'option'}, {type: 'option'}],
      choiceContext: {source: {kind: 'card', card: CardName.OLYMPUS_CONFERENCE}}} as unknown as PlayerInputModel;
    expect(checkPreselectReask(olympus)).deep.eq([]);
    expect(checkPreselectReask({type: 'or', title: ACTION_MENU_NEXT_TITLE, buttonLabel: 'x', options: []} as unknown as PlayerInputModel)).deep.eq([]);
    expect(checkPreselectReask(discardOfAcademies), 'the action is over — a later discard is a new question').deep.eq([]);
    expect(warns).is.empty;
  });
});

describe('the «post-commit choice» witness (TR51 — strictly pre-select)', () => {
  const orOf = (card: string, kind: 'card' | 'corporation' = 'card'): PlayerInputModel => ({
    type: 'or', title: 'x', buttonLabel: 'x', options: [{type: 'option', title: 'a', buttonLabel: 'a'}],
    choiceContext: {source: {kind, card}, mode: 'effect-choice'},
  } as unknown as PlayerInputModel);
  afterEach(() => resetPostCommitWitness());

  it('a choice of a table card the forecast named as asking, raised after the commit, is reported — once', () => {
    armPostCommitWitness(CardName.INFLUENTIAL_DISCOVERY, [CardName.OLYMPUS_CONFERENCE], []);
    const reports = checkPostCommitChoice(orOf(CardName.OLYMPUS_CONFERENCE));
    expect(reports).has.length(1);
    expect(reports[0]).to.contain(POST_COMMIT_CHOICE);
    expect(checkPostCommitChoice(orOf(CardName.OLYMPUS_CONFERENCE)), 'one report per commit').deep.eq([]);
  });

  it('a question the composer HANDED ON with its reason is not reported; nor a card nobody named; nor a deck pick', () => {
    armPostCommitWitness(CardName.INFLUENTIAL_DISCOVERY, [CardName.MARS_UNIVERSITY], [{card: CardName.MARS_UNIVERSITY, role: '*'}]);
    expect(checkPostCommitChoice(orOf(CardName.MARS_UNIVERSITY))).deep.eq([]);
    expect(checkPostCommitChoice(orOf(CardName.POINT_LUNA, 'corporation')), 'not an asker of this commit').deep.eq([]);
    const deckPick = {type: 'card', title: 'x', buttonLabel: 'x', cards: [], min: 1, max: 1,
      deckPickPrompt: {source: {kind: 'card', card: CardName.INFLUENTIAL_DISCOVERY}}} as unknown as PlayerInputModel;
    expect(checkPostCommitChoice(deckPick), 'cards revealed only now are never a pre-select').deep.eq([]);
  });

  it('the committed card\'s OWN choice after the press is reported unless it was handed on by its role', () => {
    armPostCommitWitness(CardName.INFLUENTIAL_DISCOVERY, [], [{card: CardName.INFLUENTIAL_DISCOVERY, role: 'card'}]);
    expect(checkPostCommitChoice(orOf(CardName.INFLUENTIAL_DISCOVERY))).has.length(1);
  });

  it('the watch ends with the action — the next action menu', () => {
    armPostCommitWitness(CardName.INFLUENTIAL_DISCOVERY, [CardName.OLYMPUS_CONFERENCE], []);
    expect(checkPostCommitChoice({type: 'or', title: ACTION_MENU_NEXT_TITLE, buttonLabel: 'x', options: []} as unknown as PlayerInputModel)).deep.eq([]);
    expect(checkPostCommitChoice(orOf(CardName.OLYMPUS_CONFERENCE))).deep.eq([]);
  });
});
