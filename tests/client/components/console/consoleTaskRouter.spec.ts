import {expect} from 'chai';
import {taskFor, taskServedByHost, isNativelyHandled, NATIVE_KINDS, ConsoleTask, TaskKind} from '@/client/console/consoleTaskRouter';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/* Synthetic playerViews — only the fields the router reads. */
function view(wf: any, hand: Array<string> = []): PlayerViewModel {
  return {
    waitingFor: wf,
    cardsInHand: hand.map((name) => ({name})),
    thisPlayer: {selfReplicatingRobotsCards: []},
  } as unknown as PlayerViewModel;
}

function kindOf(wf: any, hand: Array<string> = []): ConsoleTask | undefined {
  return taskFor(view(wf, hand));
}

/**
 * THE CTS-2 COVERAGE TABLE (CONSOLE_MODE_CONCEPT.md) as fixtures. Every
 * user-input case the server can send maps to a TaskKind here; the RED
 * LIST printed at the bottom is the CTS work queue — when a phase lands a
 * kind natively, add it to NATIVE_KINDS and update EXPECTED_RED below
 * (the shrinking list is the progress metric).
 */
const FIXTURES: Array<{row: string, wf: any, hand?: Array<string>, expect: Partial<ConsoleTask>}> = [
  {row: '1 action menu', wf: {type: 'or', title: 'Take your first action', options: []}, expect: {kind: 'actionMenu'}},
  {row: '1b action menu (next)', wf: {type: 'or', title: 'Take your next action', options: []}, expect: {kind: 'actionMenu'}},
  {row: '2 card-driven or (contextual)', wf: {type: 'or', title: 'Select how to use your science tag', options: [], choiceContext: {source: {kind: 'card'}}}, expect: {kind: 'choice', flavor: 'contextual'}},
  {row: '2b generic or', wf: {type: 'or', title: 'Choose an option', options: []}, expect: {kind: 'choice', flavor: 'generic'}},
  {row: '2c WGT or', wf: {type: 'or', title: 'Select action for World Government Terraforming', options: []}, expect: {kind: 'choice', flavor: 'wgt'}},
  {row: '3 option confirm', wf: {type: 'option', title: 'Confirm'}, expect: {kind: 'choice', flavor: 'confirm'}},
  {row: '4 player target', wf: {type: 'player', title: 'Select player'}, expect: {kind: 'player'}},
  {row: '5 amount', wf: {type: 'amount', title: 'Select amount'}, expect: {kind: 'amount', flavor: 'generic'}},
  {row: '5b hydro delta amount', wf: {type: 'deltaProject', title: 'Spend energy'}, expect: {kind: 'amount', flavor: 'delta'}},
  {row: '6 resource', wf: {type: 'resource', title: 'Select resource'}, expect: {kind: 'resource'}},
  {row: '6b resources', wf: {type: 'resources', title: 'Distribute'}, expect: {kind: 'distribute', mode: 'resources'}},
  {row: '6c productionToLose', wf: {type: 'productionToLose', title: 'Lose production'}, expect: {kind: 'distribute', mode: 'production'}},
  {row: '7 payment', wf: {type: 'payment', title: 'Pay'}, expect: {kind: 'payment'}},
  {row: '10 draft pick', wf: {type: 'card', title: 'Select a card to keep', buttonLabel: 'Keep', cards: [{name: 'Birds'}]}, expect: {kind: 'cardSelect', mode: 'draft'}},
  {row: '11 research buy', wf: {type: 'card', title: 'Select cards to buy or none to skip', buttonLabel: 'Buy', cards: [{name: 'Birds'}]}, expect: {kind: 'cardSelect', mode: 'buy'}},
  {row: '12 hand select (discard)', wf: {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}]}, hand: ['Birds', 'Zeppelins'], expect: {kind: 'cardSelect', mode: 'select'}},
  {row: '13 nested target pick', wf: {type: 'card', title: 'Select card to add microbe', buttonLabel: 'Add', cards: [{name: 'Tardigrades'}]}, expect: {kind: 'cardSelect', mode: 'target'}},
  {row: '16 play-from-hand prompt', wf: {type: 'projectCard', title: 'Play a card from hand', cards: [{name: 'Birds'}]}, hand: ['Birds'], expect: {kind: 'projectCard', mode: 'playFromHand'}},
  {row: '17 std-project prompt', wf: {type: 'projectCard', title: 'Play a standard project', cards: [{name: 'Power Plant:SP'}]}, expect: {kind: 'projectCard', mode: 'standardProject'}},
  {row: '18 colony build/select', wf: {type: 'colony', title: 'Select colony', coloniesModel: []}, expect: {kind: 'colony'}},
  {row: '20 free award funding', wf: {type: 'or', title: 'Fund an award', options: [], awardFundingPrompt: {free: true}}, expect: {kind: 'choice', flavor: 'awardFunding'}},
  {row: '21 initial draft', wf: {type: 'initialCards', title: 'Select initial cards'}, expect: {kind: 'initialDraft'}},
  {row: '22 start: corp initial action', wf: {type: 'or', title: 'Take first action of X corporation', options: [], startGamePrompt: {kind: 'corporationInitialAction'}}, expect: {kind: 'startSequence', prompt: 'corporationInitialAction'}},
  {row: '22b start: prelude selection', wf: {type: 'card', title: 'Select prelude card to play', cards: [], startGamePrompt: {kind: 'preludeSelection', preludeMode: 'hand'}}, expect: {kind: 'startSequence', prompt: 'preludeSelection'}},
  {row: '22c start: merger corp selection', wf: {type: 'card', title: 'Select corporation', cards: [], startGamePrompt: {kind: 'corporationSelection'}}, expect: {kind: 'startSequence', prompt: 'corporationSelection'}},
  {row: '23 and composite', wf: {type: 'and', title: 'Choose both', options: []}, expect: {kind: 'composite'}},
  {row: '24 ares global', wf: {type: 'aresGlobalParameters', title: 'Shift'}, expect: {kind: 'aresGlobal'}},
  {row: 'native placement', wf: {type: 'space', title: 'Select space', spaces: []}, expect: {kind: 'space'}},
  {row: '30 out-of-scope: delegate', wf: {type: 'delegate', title: 'Select delegate'}, expect: {kind: 'unknown', inputType: 'delegate'}},
  {row: '30b out-of-scope: party', wf: {type: 'party', title: 'Select party'}, expect: {kind: 'unknown', inputType: 'party'}},
  {row: '30c out-of-scope: globalEvent', wf: {type: 'globalEvent', title: 'Select event'}, expect: {kind: 'unknown', inputType: 'globalEvent'}},
  {row: '30d out-of-scope: underworld token', wf: {type: 'claimedUndergroundToken', title: 'Select token'}, expect: {kind: 'unknown', inputType: 'claimedUndergroundToken'}},
];

/** Every PlayerInputModel discriminator — exhaustiveness anchor. */
const ALL_INPUT_TYPES = [
  'amount', 'and', 'aresGlobalParameters', 'card', 'claimedUndergroundToken',
  'colony', 'delegate', 'deltaProject', 'globalEvent', 'initialCards',
  'option', 'or', 'party', 'payment', 'player', 'productionToLose',
  'projectCard', 'resource', 'resources', 'space',
];

/** The CURRENT red list — shrink it phase by phase (CTS-6). */
const EXPECTED_RED: ReadonlyArray<TaskKind> = [
  // T1 landed: choice / player / amount / resource / distribute are native.
  'payment', 'cardSelect', 'projectCard', 'colony', 'composite',
  'initialDraft', 'startSequence', 'aresGlobal', 'unknown',
];

describe('consoleTaskRouter (CTS-2 coverage)', () => {
  it('no prompt → no task; client flows are shell-owned', () => {
    expect(taskFor(view(undefined))).to.eq(undefined);
  });

  for (const f of FIXTURES) {
    it(`row ${f.row}`, () => {
      const task = kindOf(f.wf, f.hand ?? []);
      expect(task, f.row).to.not.eq(undefined);
      for (const [k, v] of Object.entries(f.expect)) {
        expect((task as Record<string, unknown>)[k], `${f.row} · ${k}`).to.eq(v);
      }
    });
  }

  it('EXHAUSTIVE: every input type maps to a task (never a silent undefined)', () => {
    for (const type of ALL_INPUT_TYPES) {
      const task = kindOf({type, title: 'x', options: [], cards: [], coloniesModel: [], spaces: []});
      expect(task, `type "${type}" must map`).to.not.eq(undefined);
    }
  });

  it('taskServedByHost: primitives served; nested non-leaf choice honestly deferred to the modal', () => {
    // Leaf options + space options → served natively.
    const leafOr = view({type: 'or', title: 'Pick', options: [
      {type: 'option', title: 'a'}, {type: 'space', title: 'ocean', spaces: []},
    ]});
    expect(taskServedByHost(leafOr)?.kind).to.eq('choice');
    // An option nesting a PAYMENT is NOT served until T3 → desktop modal stays.
    const nested = view({type: 'or', title: 'Pick', options: [
      {type: 'option', title: 'a'}, {type: 'payment', title: 'pay'},
    ]});
    expect(taskServedByHost(nested)).to.eq(undefined);
    // Bare confirm + the stepper/distribute family → served.
    expect(taskServedByHost(view({type: 'option', title: 'ok'}))?.kind).to.eq('choice');
    expect(taskServedByHost(view({type: 'player', title: 'p', players: []}))?.kind).to.eq('player');
    expect(taskServedByHost(view({type: 'amount', title: 'n', min: 0, max: 5}))?.kind).to.eq('amount');
    expect(taskServedByHost(view({type: 'resource', title: 'r', include: []}))?.kind).to.eq('resource');
    expect(taskServedByHost(view({type: 'resources', title: 'd', count: 2}))?.kind).to.eq('distribute');
    // Kinds outside T1 are not host-served.
    expect(taskServedByHost(view({type: 'payment', title: 'pay'}))).to.eq(undefined);
    expect(taskServedByHost(view({type: 'card', title: 'keep', buttonLabel: 'Keep', cards: []}))).to.eq(undefined);
  });

  it('a start-game MARKER outranks the raw input type (structural rule)', () => {
    const marked = kindOf({type: 'card', title: 'anything', cards: [], startGamePrompt: {kind: 'preludeSelection'}});
    expect(marked?.kind).to.eq('startSequence');
  });

  it('RED LIST (the CTS work queue) matches the declared phase state', () => {
    const red = new Set<TaskKind>();
    for (const f of FIXTURES) {
      const task = kindOf(f.wf, f.hand ?? []);
      if (task !== undefined && !isNativelyHandled(task)) {
        red.add(task.kind);
      }
    }
    // Print the work queue — the shrinking-list progress metric.
    console.log('    CTS red list (kinds without a native console task yet):');
    for (const kind of red) {
      console.log(`      - ${kind}`);
    }
    expect([...red].sort()).to.deep.eq([...EXPECTED_RED].sort(),
      'NATIVE_KINDS / EXPECTED_RED are out of sync — a phase landed (or regressed); update both deliberately');
    // Sanity: the natively-handled set really is disjoint from the red list.
    for (const kind of NATIVE_KINDS) {
      expect(red.has(kind), `native kind "${kind}" must not be red`).to.eq(false);
    }
  });
});
