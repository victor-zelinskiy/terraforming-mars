import {expect} from 'chai';
import {
  firstActionActionable, firstActionAsk, firstActionBranch, firstActionDrawExpected,
  firstActionOwed, firstActionPreviewable, firstActionStageCorp, startFlowOtherPromptStands,
  startWaitMate,
} from '@/client/console/startFirstAction';
import {ACTION_MENU_FIRST_TITLE} from '@/common/inputs/actionMenuTitles';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
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
  /**
   * THE SEQUENCE LAW — «the previous stage has not finished» in its general
   * form, and the bug it was written for.
   *
   * «Эпатажный спонсор» plays «Деловые контакты», whose look-4-keep-2 raises a
   * deck PICK. That prompt is none of the shapes the stage's enumerated
   * blockers name, so the «ПЕРВОЕ ДЕЙСТВИЕ» stage stood up on top of the four
   * cards the player was choosing between — in its «wait for your turn» pose,
   * with no way back to them. The server asks ONE thing at a time, so «a prompt
   * is up and it is not this stage's own move» is the honest general answer.
   */
  describe('the sequence law: another prompt means the stage before this one is still live', () => {
    const otherPrompt = (title: string | undefined = 'Select 2 card(s) to keep') =>
      ({waitingFor: {type: 'card', title, cards: []}} as unknown as PlayerViewModel);

    it('nothing on the wire is quiet at BOTH edges (the turn-wait pose)', () => {
      expect(startFlowOtherPromptStands(view({pending: ['Valley Trust']}))).to.be.false;
      expect(startFlowOtherPromptStands(view({pending: ['Valley Trust']}), {allowActionMenu: true})).to.be.false;
    });

    it('the OWN marked prompt of the stage is quiet at both edges', () => {
      const live = view({pending: ['Valley Trust'], prompt: true});
      expect(startFlowOtherPromptStands(live)).to.be.false;
      expect(startFlowOtherPromptStands(live, {allowActionMenu: true})).to.be.false;
    });

    it('ANY other prompt blocks — a deck pick the previous stage raised included', () => {
      expect(startFlowOtherPromptStands(otherPrompt())).to.be.true;
      expect(startFlowOtherPromptStands(otherPrompt(), {allowActionMenu: true})).to.be.true;
    });

    it('the ACTION MENU ends the LEAVE edge and never opens the ENTRY one', () => {
      const menu = otherPrompt(ACTION_MENU_FIRST_TITLE);
      // ENTRY: the start is still running — a menu there is a bonus window the
      // workspace serves through a stage of its own.
      expect(startFlowOtherPromptStands(menu), 'entry waits for it').to.be.true;
      // LEAVE: the game proper has begun; holding the stage for it would leave
      // the workspace standing for the rest of the game.
      expect(startFlowOtherPromptStands(menu, {allowActionMenu: true}), 'the stage may go').to.be.false;
    });
  });

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
    const mate = startWaitMate(mp);
    expect(mate?.name).to.eq('Бот');
    expect(mate?.isMarsBot).to.be.true;
    // Nobody else active (the prompt is about to be ours) → undefined.
    const solo = view({pending: ['Valley Trust'], players: [{color: 'red', name: 'me', waiting: true, isActive: true}]});
    expect(startWaitMate(solo)).to.eq(undefined);
  });

  /**
   * «Ожидаем других игроков» is a CLAIM ABOUT OTHER PLAYERS. A solo game
   * against MarsBot that is NOT mid-bot-turn is waiting for nobody, and the
   * deployment's status rail printed that line anyway whenever it had no
   * focused card — the reported «мы его тут точно не ждём».
   */
  it('a bot that is NOT taking its turn is not somebody we are waiting for', () => {
    const idleBot = view({
      pending: ['Valley Trust'],
      players: [
        {color: 'red', name: 'me', waiting: true, isActive: true},
        {color: 'green', name: 'Бот', waiting: false, isActive: false, isMarsBot: true},
      ],
    });
    expect(startWaitMate(idleBot), 'nobody to name → the surface must stay silent').to.eq(undefined);
  });

  /**
   * ASK ONLY WHAT THE SERVER CAN ANSWER.
   *
   * The briefing re-fetches the first-action preview on every game-state move,
   * and it keeps standing while the action it submitted resolves — but the
   * corporation left `pendingInitialActions` at the SUBMIT (the option's own
   * `andThen`), inside the same response that raises whatever the action
   * produced. Aridor's colony catalog made that window long and visible: one
   * declined preview request per state move, each logged on the server and
   * printed as a 404 in the client console.
   *
   * The predicate reads the SAME ledger the route resolves against — the live
   * prompt is deliberately NOT a second door, because the prompt is exactly
   * what still names a corporation whose ledger entry is already gone.
   */
  describe('firstActionPreviewable: the route’s own precondition', () => {
    it('true while the corporation still owes its first action', () => {
      expect(firstActionPreviewable(view({pending: ['Aridor']}), 'Aridor' as CardName)).to.be.true;
    });

    it('false once the ledger has drained — the submit, not the resolution', () => {
      const submitted = view({pending: [], prompt: true, corps: [{name: 'Aridor', label: 'Add a colony tile'}]});
      expect(firstActionPreviewable(submitted, 'Aridor' as CardName)).to.be.false;
    });

    it('false for no corporation at all, and on a model with no ledger field', () => {
      expect(firstActionPreviewable(view({pending: ['Aridor']}), undefined)).to.be.false;
      expect(firstActionPreviewable({} as unknown as PlayerViewModel, 'Aridor' as CardName)).to.be.false;
    });
  });
});
