import {expect} from 'chai';
import {
  firstActionActionable, firstActionAsk, firstActionBranch, firstActionDrawExpected,
  firstActionOwed, firstActionStageCorp, firstActionWaitMate,
} from '@/client/console/startFirstAction';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Phase} from '@/common/Phase';

/**
 * The FIRST-ACTION STAGE model — pure derivations over the server's own
 * artifacts: the `corporationInitialAction` OrOptions marker,
 * `pendingInitialActions` (the domain ledger) and the first-action preview.
 * Never a corporation-name table, never re-derived rules.
 */
const corpOption = (corp: string, buttonLabel: string) => ({
  type: 'option',
  title: {message: 'Take first action of ${0} corporation', data: [{type: LogMessageDataType.CARD, value: corp}]},
  buttonLabel,
  warnings: [],
});
const passOption = () => ({type: 'option', title: 'Pass', buttonLabel: 'Pass', warnings: ['pass']});

function view(opts: {
  pending?: ReadonlyArray<string>,
  prompt?: boolean,
  corps?: ReadonlyArray<{name: string, label: string}>,
  players?: ReadonlyArray<{color: string, name: string, waiting: boolean, isActive?: boolean, isMarsBot?: boolean}>,
} = {}): PlayerViewModel {
  const corps = opts.corps ?? [{name: 'Valley Trust', label: 'Draw 3 Prelude cards, and play one of them'}];
  return {
    id: 'p1',
    game: {generation: 1, phase: Phase.ACTION, passedPlayers: []},
    thisPlayer: {color: 'red', actionsTakenThisGame: 0},
    players: (opts.players ?? []).map((p) => ({
      color: p.color, name: p.name, isActive: p.isActive === true,
      isWaitingForInput: p.waiting, isMarsBot: p.isMarsBot === true,
    })),
    pendingInitialActions: opts.pending ?? [],
    waitingFor: opts.prompt === true ? {
      type: 'or',
      title: '',
      options: [...corps.map((c) => corpOption(c.name, c.label)), passOption()],
      startGamePrompt: {kind: 'corporationInitialAction'},
    } : undefined,
  } as unknown as PlayerViewModel;
}

describe('startFirstAction (the first-action stage model)', () => {
  it('OWED is the domain ledger plus the live marked prompt — never a client latch', () => {
    expect(firstActionOwed(view())).to.be.false;
    expect(firstActionOwed(view({pending: ['Valley Trust']})), 'the ledger alone (waiting for the turn)').to.be.true;
    expect(firstActionOwed(view({prompt: true})), 'the live prompt alone (the ledger drains inside the answer)').to.be.true;
  });

  it('the stage corp: the READY one leads; several owed resolve one at a time', () => {
    expect(firstActionStageCorp(view())).to.eq(undefined);
    expect(firstActionStageCorp(view({pending: ['Valley Trust']}))).to.eq('Valley Trust');
    // Merger: two owed, the prompt currently offering only the second —
    // the seat goes to the corp whose option is LIVE.
    const merged = view({
      pending: ['Point Luna', 'Valley Trust'],
      prompt: true,
      corps: [{name: 'Valley Trust', label: 'Draw 3 Prelude cards, and play one of them'}],
    });
    expect(firstActionStageCorp(merged)).to.eq('Valley Trust');
  });

  it('ACTIONABLE only when the marked prompt carries the seated corp\'s option', () => {
    const waiting = view({pending: ['Valley Trust']});
    expect(firstActionActionable(waiting, 'Valley Trust' as never), 'no prompt → the waiting state').to.be.false;
    const live = view({pending: ['Valley Trust'], prompt: true});
    expect(firstActionActionable(live, 'Valley Trust' as never)).to.be.true;
    expect(firstActionActionable(live, 'Point Luna' as never), 'a corp with no live option is not actionable').to.be.false;
    expect(firstActionActionable(live, undefined)).to.be.false;
  });

  it('the ASK is the live option\'s buttonLabel (the server\'s initialActionText), structural', () => {
    expect(firstActionAsk(view({pending: ['Valley Trust']}), 'Valley Trust' as never), 'no prompt → no ask (the generic speaks)').to.eq(undefined);
    expect(firstActionAsk(view({prompt: true}), 'Valley Trust' as never))
      .to.eq('Draw 3 Prelude cards, and play one of them');
  });

  it('drawExpected reads the branch\'s `cards` gains — the claim contract of a drawing action', () => {
    const preview = (effects: Array<{direction: string, icon: string, amount: number}>): ActionPreview => ({
      kind: 'declarative',
      card: 'Inventrix',
      branches: [{available: true, effects, steps: []}],
    } as unknown as ActionPreview);
    expect(firstActionDrawExpected(undefined)).to.eq(0);
    expect(firstActionDrawExpected(preview([{direction: 'gain', icon: 'cards', amount: 3}]))).to.eq(3);
    // Valley Trust's bespoke preview deliberately carries NO '+cards' chip
    // (its preludes arrive as a marked PICK prompt, not a hand draw) → 0.
    expect(firstActionDrawExpected(preview([{direction: 'gain', icon: 'megacredits', amount: 5}]))).to.eq(0);
    expect(firstActionBranch(preview([]))?.available).to.be.true;
  });

  it('the WAIT MATE is the shared status brain\'s ACTIVE player — never the viewer', () => {
    const mp = view({
      pending: ['Valley Trust'],
      players: [
        {color: 'red', name: 'me', waiting: false},
        {color: 'green', name: 'Бот', waiting: true, isActive: true, isMarsBot: true},
      ],
    });
    const mate = firstActionWaitMate(mp);
    expect(mate?.name).to.eq('Бот');
    expect(mate?.isMarsBot).to.be.true;
    // Nobody else active (the prompt is about to be ours) → undefined.
    const solo = view({pending: ['Valley Trust'], players: [{color: 'red', name: 'me', waiting: true, isActive: true}]});
    expect(firstActionWaitMate(solo)).to.eq(undefined);
  });
});
