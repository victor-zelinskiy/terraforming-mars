import {expect} from 'chai';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/*
 * THE TASK HOST'S OPTIONAL CHOICE — the decline is a BUTTON (the owner's decisions, 2026-10-13). A choice the effect
 * decision cannot serve (an unmarked `or`, a target off the table) lands here, and its skip-marked refusal used to be
 * one more option row (`data-choice-skip`). Now it leaves the rows for RT and a plate in the question line; a choice
 * whose ONE answer is a wizard step opens ON that step (B there is the decision's own minimize); a YES / NO keeps its
 * two rows. The computeds are exercised against a stub `this` — the point is WHAT they decide.
 */

type Computeds = Record<string, (this: unknown) => unknown>;
const host = (ConsoleTaskHost as unknown as {computed: Computeds}).computed;

const VIEW = {
  cardsInHand: [{name: 'Algae'}],
  thisPlayer: {color: 'blue', selfReplicatingRobotsCards: []},
  players: [],
} as unknown as PlayerViewModel;

const leaf = (title: string, metadata?: unknown) => ({type: 'option', title, buttonLabel: 'Confirm', metadata});
const skip = (title = 'Do not remove') => leaf(title, {kind: 'skip'});
const tableCards = {type: 'card', title: 'Select card to remove 2 animals', buttonLabel: 'Remove', cards: [{name: 'Fish'}], min: 1, max: 1};
const or = (options: Array<unknown>) => ({type: 'or', title: 'Remove animals', buttonLabel: 'Confirm', options} as unknown as PlayerInputModel);

/** A stub `this` that resolves the computeds the decline reads, lazily — in dependency order. */
function ctx(wf: PlayerInputModel, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const self: Record<string, unknown> = {
    task: {kind: 'choice', flavor: 'generic'},
    playerView: {...VIEW, waitingFor: wf},
    promptOverride: undefined,
    nested: undefined,
    singlePick: true,
    isSpreadMode: false,
    canInspectDrafted: false,
    ...extra,
  };
  const lazy = (name: string) => Object.defineProperty(self, name, {get: () => host[name].call(self), configurable: true});
  for (const name of ['parentWf', 'handNames', 'taskDecline', 'directNested', 'nestedIsDirect', 'activeTask', 'declineOnRt']) {
    if (!(name in extra)) {
      lazy(name);
    }
  }
  return self;
}

describe('ConsoleTaskHost — an OPTIONAL choice declines with a button', () => {
  it('reads the decline off the skip MARKER, and a YES / NO keeps its refusal as a row', () => {
    const targets = ctx(or([leaf('Remove from red', {player: {color: 'red'}}), skip(), leaf('Remove from green', {player: {color: 'green'}})]));
    expect(targets.taskDecline).to.deep.eq({index: 1, label: 'Do not remove', forgone: []});

    const yesNo = ctx(or([leaf('Gain 3 TR'), skip('Do nothing')]));
    expect(yesNo.taskDecline, 'a YES / NO declines on its own row').to.eq(undefined);

    const unmarked = ctx(or([leaf('a'), leaf('Do nothing')]));
    expect(unmarked.taskDecline, 'never by the title').to.eq(undefined);
  });

  it('the decline leaves the rows — every target stays one', () => {
    const self = ctx(or([leaf('Remove from red', {player: {color: 'red'}}), skip(), leaf('Remove from green', {player: {color: 'green'}})]));
    self.allChoiceEntries = [0, 1, 2].map((index) => ({index, isSkip: index === 1}));
    const entries = host.choiceEntries.call(self) as Array<{index: number}>;
    expect(entries.map((e) => e.index)).to.deep.eq([0, 2]);
  });

  it('RT is the decline wherever RT has no other job — never over a multi pick, which commits on it', () => {
    const wf = or([tableCards, skip()]);
    expect(ctx(wf).declineOnRt, 'the choice level').to.eq(true);
    expect(ctx(wf, {nested: {index: 0, input: tableCards}, singlePick: true}).declineOnRt, 'a single pick inside it').to.eq(true);
    expect(ctx(wf, {nested: {index: 0, input: tableCards}, singlePick: false}).declineOnRt, 'a multi pick: RT is its commit').to.eq(false);
  });

  it('the bar names the decline on RT, just before the way back', () => {
    const self = ctx(or([leaf('Remove from red', {player: {color: 'red'}}), skip(), leaf('Remove from green', {player: {color: 'green'}})]));
    self.baseFootCommands = [{control: 'dpad', label: 'Navigate'}, {control: 'confirm', label: 'Select'}, {control: 'back', label: 'Minimize'}];
    const run = host.footCommands.call(self) as Array<{control: string, label: string}>;
    expect(run.map((c) => c.control)).to.deep.eq(['dpad', 'confirm', 'triggerR', 'back']);
    expect(run[2].label).to.eq('Do not remove');
  });

  it('a choice whose ONE answer is a wizard step OPENS on it — and a pick from the HAND never does (the album does)', () => {
    const self = ctx(or([tableCards, skip()]));
    expect(self.directNested).to.deep.eq({index: 0, input: tableCards});

    const fromHand = {...tableCards, cards: [{name: 'Algae'}]};
    expect(ctx(or([fromHand, skip()])).directNested, 'a hand pick rides the album').to.eq(undefined);
    expect(ctx(or([tableCards, leaf('Remove from red'), skip()])).directNested, 'two answers keep the list').to.eq(undefined);
    expect(ctx(or([tableCards, leaf('Remove from red')])).directNested, 'no decline, no shortcut').to.eq(undefined);
  });
});
