import {expect} from 'chai';
import * as taskHostLogic from '@/client/components/console/consoleTaskHostLogic';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';

/*
 * K20 (P58 · FT) — THE TASK HOST'S RESET EPOCH IS THE SERVER'S QUESTION, never its words. A chain of `OrOptions` with
 * one title («Select one option» — Project Eden's four questions upstream) shared ONE `type|title` key, so the
 * previous answer's armed selection and cursor outlived it: the next band opened «decided» (the other options receded
 * to nothing under the «ИЛИ» seam — the «before» frames 03 / 05 of P58) and a single A committed the focus, skipping
 * the select → confirm guard. The epoch now carries the server's serial (`promptId`): a new question is a new epoch,
 * the same question (a minimize → restore, a re-sent view) keeps it; a CLIENT prompt keeps its own key.
 *
 * …and the host's «ОЧЕРЁДНОСТЬ» body (P58 · FS, the hand's chain / the fallback band): its rows off the marker, the
 * cursor's row the FOCUSED OPTION's (sealed rows are no options), one press.
 *
 * The host's members live in `consoleTaskHostLogic.ts` (the component delegates to them over its port); they run here
 * against a stub of that port.
 */
type Members = Record<string, (self: unknown) => unknown>;
const host = taskHostLogic as unknown as Members;

const option = (title: string, metadata?: unknown) => ({type: 'option', title, buttonLabel: 'Confirm', metadata});
const or = (promptId: number | undefined, options: Array<unknown>, extra: Record<string, unknown> = {}) =>
  ({type: 'or', title: 'Select one option', buttonLabel: 'Confirm', promptId, options, ...extra} as unknown as PlayerInputModel);

function ctx(wf: PlayerInputModel, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const self: Record<string, unknown> = {
    task: {kind: 'choice', flavor: 'generic'},
    playerView: {cardsInHand: [], thisPlayer: {color: 'blue'}, players: [], waitingFor: wf} as unknown as PlayerViewModel,
    promptOverride: undefined,
    nested: undefined,
    ...extra,
  };
  const lazy = (name: string) => Object.defineProperty(self, name, {get: () => host[name](self), configurable: true});
  for (const name of ['parentWf', 'wf', 'activeTask', 'baseKey', 'taskKey', 'choiceOnePress', 'placementOrderVariant']) {
    if (!(name in extra)) {
      lazy(name);
    }
  }
  return self;
}

describe('ConsoleTaskHost — the reset epoch is the server\'s question (K20)', () => {
  it('two chained questions with ONE title are two epochs — the second never inherits the first\'s armed choice', () => {
    const first = ctx(or(41, [option('Place a city'), option('Place a greenery'), option('Discard 3 cards')]));
    const second = ctx(or(42, [option('Place a greenery'), option('Discard 3 cards')]));
    expect(first.baseKey).not.to.eq(second.baseKey);
    expect(first.taskKey).not.to.eq(second.taskKey);
  });

  it('the SAME question keeps its epoch (a re-sent view, a minimize → restore)', () => {
    const a = ctx(or(41, [option('a'), option('b')]));
    const b = ctx(or(41, [option('a'), option('b')]));
    expect(a.baseKey).to.eq(b.baseKey);
  });

  it('a CLIENT prompt (no server serial) keeps its own key', () => {
    const client = {type: 'payment', title: 'Pay', buttonLabel: 'Pay'} as unknown as PlayerInputModel;
    const self = ctx(or(41, []), {promptOverride: client});
    expect(self.baseKey).to.eq('client|payment|Pay');
  });
});

describe('ConsoleTaskHost — the «ОЧЕРЁДНОСТЬ» body (P58 · FS)', () => {
  const marked = or(7, [
    option('Город', {kind: 'placement', tileType: TileType.CITY}),
    option('Океан', {kind: 'placement', tileType: TileType.OCEAN}),
  ], {
    choiceContext: {source: {kind: 'card', card: CardName.PROJECT_EDEN}, mode: 'effect-choice'},
    placementOrderPrompt: {source: CardName.PROJECT_EDEN, done: [TileType.GREENERY], remaining: [TileType.OCEAN, TileType.CITY], index: 2, of: 3},
  });

  it('reads the step off the marker — one press, rows in the printed order, the placed greenery sealed', () => {
    const self = ctx(marked, {task: {kind: 'choice', flavor: 'placementOrder'}});
    expect(self.choiceOnePress).to.eq(true);
    const variant = self.placementOrderVariant as {rows: Array<{tileType: TileType, sealed?: boolean, branchIndex: number}>};
    expect(variant.rows.map((r) => r.tileType)).to.deep.eq([TileType.OCEAN, TileType.CITY, TileType.GREENERY]);
    expect(variant.rows[2].sealed).to.eq(true);
    expect(variant.rows.map((r) => r.branchIndex)).to.deep.eq([1, 0, -1]);
  });

  it('the cursor\'s row is the focused OPTION\'s — sealed rows are no options', () => {
    const self = ctx(marked, {task: {kind: 'choice', flavor: 'placementOrder'}, focusIdx: 0,
      choiceEntries: [{index: 0}, {index: 1}]});
    expect(host.placementOrderFocusRow(self)).to.eq(1); // option 0 is the CITY — the second row
    self.focusIdx = 1;
    expect(host.placementOrderFocusRow(self)).to.eq(0);
  });

  it('a plain choice has no order body', () => {
    expect(ctx(or(8, [option('a'), option('b')])).placementOrderVariant).to.eq(undefined);
  });
});
