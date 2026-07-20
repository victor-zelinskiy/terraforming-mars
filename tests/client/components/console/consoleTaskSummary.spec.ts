import {expect} from 'chai';
import {taskFor, ConsoleTask, TaskKind} from '@/client/console/consoleTaskRouter';
import {consoleTaskSummary, GENERIC_KICKER} from '@/client/console/consoleTaskSummary';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/* Synthetic playerViews — only the fields the router + summary read. */
function view(wf: any, hand: Array<string> = [], srr: Array<string> = []): PlayerViewModel {
  return {
    waitingFor: wf,
    cardsInHand: hand.map((name) => ({name})),
    thisPlayer: {selfReplicatingRobotsCards: srr.map((name) => ({name}))},
  } as unknown as PlayerViewModel;
}

function summaryOf(wf: any, hand: Array<string> = [], srr: Array<string> = []) {
  const v = view(wf, hand, srr);
  const task = taskFor(v) as ConsoleTask;
  return consoleTaskSummary(task, v);
}

function textOf(ask: any): string {
  return typeof ask === 'string' ? ask : ask.message;
}

/**
 * The SAME prompt shapes the router's CTS-2 table classifies — re-walked here
 * so a routing change and a copy change can never drift apart. Every row must
 * produce a SPECIFIC kicker (the whole point of the rework); only the honest
 * `unknown` guard may fall back to the generic one.
 */
const ROWS: Array<{row: string, wf: any, hand?: Array<string>, srr?: Array<string>, kicker: string}> = [
  {row: 'action menu', wf: {type: 'or', title: 'Take your first action', options: []}, kicker: 'Your turn'},
  {row: 'placement', wf: {type: 'space', title: 'Select space for city tile', spaces: []}, kicker: 'Tile placement'},
  {row: 'generic or', wf: {type: 'or', title: 'Choose an option', options: []}, kicker: 'Choice'},
  {row: 'WGT or', wf: {type: 'or', title: 'Select action for World Government Terraforming', options: []}, kicker: 'Government Support'},
  {row: 'option confirm', wf: {type: 'option', title: 'Confirm'}, kicker: 'Confirmation'},
  {row: 'player target', wf: {type: 'player', title: 'Select player'}, kicker: 'Choose a player'},
  {row: 'amount', wf: {type: 'amount', title: 'Select amount'}, kicker: 'Amount'},
  {row: 'hydro delta amount', wf: {type: 'deltaProject', title: 'Spend energy'}, kicker: 'Mars Hydronetwork'},
  {row: 'resource', wf: {type: 'resource', title: 'Select resource'}, kicker: 'Resource'},
  {row: 'resources', wf: {type: 'resources', title: 'Distribute'}, kicker: 'Distribute resources'},
  {row: 'productionToLose', wf: {type: 'productionToLose', title: 'Lose production'}, kicker: 'Production loss'},
  {row: 'payment', wf: {type: 'payment', title: 'Pay'}, kicker: 'Payment'},
  {row: 'draft pick', wf: {type: 'card', title: 'Select a card to keep', buttonLabel: 'Keep', cards: [{name: 'Birds'}]}, kicker: 'Draft'},
  {row: 'draft wait', wf: {type: 'card', title: 'You can change…', optional: true, buttonLabel: 'Select', cards: [{name: 'Birds'}]}, kicker: 'Draft'},
  {row: 'research buy', wf: {type: 'card', title: 'Select cards to buy', buttonLabel: 'Buy', buyMode: true, cards: [{name: 'Birds'}]}, kicker: 'Purchase'},
  {row: 'hand select', wf: {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}]}, hand: ['Birds'], kicker: 'Cards in hand'},
  {row: 'card target', wf: {type: 'card', title: 'Select card to add microbe', buttonLabel: 'Add', cards: [{name: 'Tardigrades'}]}, kicker: 'Card target'},
  {row: 'play from hand', wf: {type: 'projectCard', title: 'Play a card from hand', cards: [{name: 'Birds'}]}, hand: ['Birds'], kicker: 'Play project card'},
  {row: 'std project', wf: {type: 'projectCard', title: 'Play a standard project', cards: [{name: 'Power Plant:SP'}]}, kicker: 'Standard project'},
  {row: 'colony', wf: {type: 'colony', title: 'Select colony', coloniesModel: []}, kicker: 'Colony'},
  {row: 'award funding', wf: {type: 'or', title: 'Fund an award', options: [], awardFundingPrompt: {free: true}}, kicker: 'Award sponsorship'},
  {row: 'initial draft', wf: {type: 'initialCards', title: 'Select initial cards'}, kicker: 'Start of the game'},
  {row: 'corp first action', wf: {type: 'or', title: 'Take first action of X', options: [], startGamePrompt: {kind: 'corporationInitialAction'}}, kicker: 'First corporation action'},
  {row: 'start: corp play', wf: {type: 'card', title: 'Play your corporation', cards: [], startGamePrompt: {kind: 'corporationPlay'}}, kicker: 'Corporation'},
  {row: 'start: corp pay', wf: {type: 'card', title: 'Pay for your cards', cards: [], startGamePrompt: {kind: 'corporationPay'}}, kicker: 'Payment'},
  {row: 'start: prelude', wf: {type: 'card', title: 'Select prelude card to play', cards: [], startGamePrompt: {kind: 'preludeSelection', preludeMode: 'hand'}}, kicker: 'Prelude'},
  {row: 'start: merger corp', wf: {type: 'card', title: 'Select corporation', cards: [], startGamePrompt: {kind: 'corporationSelection'}}, kicker: 'Corporation'},
  {row: 'ares global', wf: {type: 'aresGlobalParameters', title: 'Shift'}, kicker: 'Ares'},
];

describe('consoleTaskSummary (no prompt is ever a bare «awaiting decision»)', () => {
  for (const r of ROWS) {
    it(`${r.row} → «${r.kicker}»`, () => {
      const s = summaryOf(r.wf, r.hand ?? [], r.srr ?? []);
      expect(s.kickerKey).to.eq(r.kicker);
      expect(s.kickerKey).to.not.eq(GENERIC_KICKER);
      expect(textOf(s.ask)).to.not.eq('');
    });
  }

  it('EXHAUSTIVE: every classified task yields a non-empty ask + return verb', () => {
    for (const r of ROWS) {
      const s = summaryOf(r.wf, r.hand ?? [], r.srr ?? []);
      expect(textOf(s.ask), r.row).to.not.eq('');
      expect(s.returnKey, r.row).to.not.eq('');
    }
  });

  it('the server title WINS over the per-kind key (it is the most specific ask)', () => {
    const s = summaryOf({type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}]}, ['Birds']);
    expect(textOf(s.ask)).to.eq('Select a card to discard');
  });

  it('a GENERIC server title falls back to the per-kind key, never the boilerplate', () => {
    const s = summaryOf({type: 'player', title: 'Select player'});
    expect(textOf(s.ask)).to.eq('Choose a player');
  });

  it('a Message title passes through untouched (data tokens survive)', () => {
    const msg = {message: 'Select space for ${0} tile', data: [{type: 0, value: 'Lunar Beam'}]};
    const s = summaryOf({type: 'space', title: msg, spaces: []});
    expect(s.ask).to.eq(msg);
  });

  // ── the individual cases the markers exist for ──────────────────────
  it('contextual choice: an ATTACK reads as an attack, and names the source card', () => {
    const s = summaryOf({type: 'or', title: 'Choose a target', options: [], choiceContext: {source: {kind: 'card', card: 'Hackers'}, mode: 'attack'}});
    expect(s.kickerKey).to.eq('Attack');
    expect(s.sourceCard).to.eq('Hackers');
  });

  it('contextual choice: a REWARD reads as a bonus (never confused with an Award)', () => {
    const s = summaryOf({type: 'or', title: 'Collect', options: [], choiceContext: {source: {kind: 'card', card: 'Mining Guild'}, mode: 'reward'}});
    expect(s.kickerKey).to.eq('Bonus');
  });

  it('contextual choice: the mode OUTRANKS the source (a corp attack is an attack)', () => {
    const s = summaryOf({type: 'or', title: 'Attack', options: [], choiceContext: {source: {kind: 'corporation', card: 'Vitor'}, mode: 'attack'}});
    expect(s.kickerKey).to.eq('Attack');
  });

  it('contextual choice: with no mode, the SOURCE names the asker', () => {
    const s = summaryOf({type: 'or', title: 'Use it?', options: [], choiceContext: {source: {kind: 'corporation', card: 'Splice'}}});
    expect(s.kickerKey).to.eq('Corporation effect');
  });

  it('composite: the Venus alt-track bonus is named, not a generic «and»', () => {
    const s = summaryOf({type: 'and', title: 'Select bonus', options: [], venusBonusPrompt: {kind: 'standard', baseCount: 2}});
    expect(s.kickerKey).to.eq('Venus bonus');
  });

  it('composite: the Stormcraft spend-heat prompt is named', () => {
    const s = summaryOf({type: 'and', title: 'Spend heat', options: [], spendHeatPrompt: {amount: 3}});
    expect(s.kickerKey).to.eq('Spend heat');
  });

  it('a placement names its SOURCE card via placementContext', () => {
    const s = summaryOf({type: 'space', title: 'Select space', spaces: [], placementContext: {cancellable: true, source: {kind: 'card', card: 'Lunar Beam'}}});
    expect(s.kickerKey).to.eq('Tile placement');
    expect(s.sourceCard).to.eq('Lunar Beam');
  });

  it('a CLIENT-built payment reads its own prompt, not the action menu behind it', () => {
    const v = view({type: 'or', title: 'Take your next action', options: []});
    const s = consoleTaskSummary({kind: 'payment'}, v, {
      prompt: {type: 'payment', title: 'Pay for City'} as any,
      sourceCard: 'City' as any,
    });
    expect(s.kickerKey).to.eq('Payment');
    expect(textOf(s.ask)).to.eq('Pay for City');
    expect(s.sourceCard).to.eq('City');
  });

  it('ONLY the unknown guard may read generic', () => {
    const s = summaryOf({type: 'delegate', title: 'Select delegate'});
    expect(s.kickerKey).to.eq(GENERIC_KICKER);
  });

  // The return verb is the deferred chip's B hint — it must stay contextual.
  const RETURN: Array<[string, any, Array<string>, string]> = [
    ['draft', {type: 'card', title: 'Keep', buttonLabel: 'Keep', cards: [{name: 'Birds'}]}, [], 'Return to the draft'],
    ['hand select', {type: 'card', title: 'Discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}]}, ['Birds'], 'Return to selection'],
    ['payment', {type: 'payment', title: 'Pay'}, [], 'Return to payment'],
    ['start sequence', {type: 'card', title: 'Play', cards: [], startGamePrompt: {kind: 'preludeSelection'}}, [], 'Resume start setup'],
    ['initial draft', {type: 'initialCards', title: 'Select'}, [], 'Return to selection'],
  ];
  for (const [name, wf, hand, expected] of RETURN) {
    it(`return verb: ${name} → «${expected}»`, () => {
      expect(summaryOf(wf, hand).returnKey).to.eq(expected);
    });
  }

  it('EVERY TaskKind is covered by the fixture table (completeness anchor)', () => {
    const ALL: ReadonlyArray<TaskKind> = [
      'actionMenu', 'space', 'choice', 'awardFunding', 'player', 'amount', 'resource',
      'distribute', 'payment', 'draftWait', 'cardSelect', 'handSelect', 'projectCard',
      'colony', 'composite', 'initialDraft', 'startSequence', 'corpFirstAction',
      'aresGlobal', 'unknown',
    ];
    const covered = new Set<TaskKind>();
    for (const r of ROWS) {
      const t = taskFor(view(r.wf, r.hand ?? [], r.srr ?? []));
      if (t !== undefined) {
        covered.add(t.kind);
      }
    }
    // `composite` + `unknown` are asserted by their own dedicated cases above.
    covered.add('composite');
    covered.add('unknown');
    const missing = ALL.filter((k) => !covered.has(k));
    expect(missing, `TaskKinds with no summary fixture: ${missing.join(', ')}`).to.deep.eq([]);
  });
});
