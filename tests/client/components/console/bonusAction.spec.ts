import {expect} from 'chai';
import {
  BONUS_ACTION_TURN_CONTROL_REASON,
  bonusActionGains, bonusActionGranted, bonusActionInStartFlow, bonusActionIndex,
  bonusActionMeta, bonusActionNestedFirstAction, bonusActionOnBoard, bonusActionOwed,
  bonusActionRemaining, bonusActionsDeclaredBy, bonusActionSource, bonusActionsOwed,
  bonusActionTurnControlReason,
} from '@/client/console/bonusAction';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {ACTION_MENU_FIRST_TITLE} from '@/common/inputs/actionMenuTitles';

/**
 * THE BONUS-ACTION MODEL — the two questions a card-granted action outside the
 * turn's own two raises, and the two DIFFERENT server artifacts that answer
 * them.
 *
 *  · the LEDGER (`PublicPlayerModel.bonusActions`) says the WINDOW is open. It
 *    survives every sub-prompt of the action being taken, which is why the
 *    workspace's yield/return and the status chip read it;
 *  · the MARKER (`bonusActionPrompt`) identifies the free ACTION MENU. It is
 *    the only thing that can, because the menu deliberately keeps the ordinary
 *    action-menu title so the task router, the quick wheels and the status
 *    label all keep classifying it as one.
 *
 * The fixtures set the two independently ON PURPOSE — «the ledger owes, no
 * marker» is not a corner case, it is most of a bonus action's life (the
 * payment, the placement and the triggered effect of the card being played).
 */
function view(opts: {
  /** The LEDGER. */
  owed?: number,
  granted?: number,
  source?: CardName,
  /** The MARKER on the current prompt. */
  marker?: {
    source: CardName, remaining: number, granted: number,
    gains?: Array<{resource: 'steel' | 'megacredits', amount: number, index: number}>,
  },
  /** The current prompt is one the start workspace serves itself. */
  startGamePrompt?: {kind: string},
  generation?: number,
} = {}): PlayerViewModel {
  return {
    id: 'p1',
    game: {generation: opts.generation ?? 1, phase: Phase.PRELUDES, passedPlayers: []},
    thisPlayer: {
      color: 'red',
      bonusActions: opts.owed,
      bonusActionsGranted: opts.granted,
      bonusActionSource: opts.source,
    },
    players: [],
    waitingFor: {
      type: 'or',
      title: ACTION_MENU_FIRST_TITLE,
      buttonLabel: 'Take action',
      options: [],
      bonusActionPrompt: opts.marker,
      startGamePrompt: opts.startGamePrompt,
    },
  } as unknown as PlayerViewModel;
}

const HEAD_START = {source: CardName.HEAD_START, remaining: 2, granted: 2};
/** The whole state on the FIRST bonus action: ledger + marker agree. */
const FIRST_BONUS = {owed: 2, granted: 2, source: CardName.HEAD_START, marker: HEAD_START};

describe('bonusAction (the card-granted action model)', () => {
  it('an ordinary turn owes nothing — the action-menu title alone never implies a bonus', () => {
    const v = view();
    expect(bonusActionMeta(v)).to.eq(undefined);
    expect(bonusActionsOwed(v)).to.eq(0);
    expect(bonusActionOwed(v)).to.be.false;
    expect(bonusActionOnBoard(v)).to.be.false;
    expect(bonusActionIndex(v)).to.eq(0);
  });

  it('THE LEDGER is what opens the window — not the marker', () => {
    // Mid card-play: the player answered the bonus menu and is now on a
    // payment / placement / triggered effect. No marker stands anywhere, and
    // the window is very much still open.
    const midAction = view({owed: 1, granted: 2, source: CardName.HEAD_START});
    expect(bonusActionMeta(midAction), 'no marker on a sub-prompt').to.eq(undefined);
    expect(bonusActionOwed(midAction), 'the window is open').to.be.true;
    expect(bonusActionOnBoard(midAction), 'the board is still serving it').to.be.true;
    // …and the readout keeps counting from the ledger.
    expect(bonusActionGranted(midAction)).to.eq(2);
    expect(bonusActionIndex(midAction)).to.eq(2);
    expect(bonusActionSource(midAction)).to.eq(CardName.HEAD_START);
  });

  it('a spent ledger closes the window even if a stale marker were still around', () => {
    expect(bonusActionOwed(view({marker: HEAD_START}))).to.be.false;
  });

  it('the marker identifies the MENU, and carries its own readout', () => {
    const v = view(FIRST_BONUS);
    expect(bonusActionMeta(v)).to.deep.eq(HEAD_START);
    expect(bonusActionRemaining(v)).to.eq(2);
    expect(bonusActionGranted(v)).to.eq(2);
    expect(bonusActionSource(v)).to.eq(CardName.HEAD_START);
  });

  it('the readout walks 1/2 → 2/2', () => {
    expect(bonusActionIndex(view(FIRST_BONUS))).to.eq(1);
    expect(bonusActionIndex(view({...FIRST_BONUS, owed: 1, marker: {...HEAD_START, remaining: 1}}))).to.eq(2);
  });

  it('a batch extended mid-window never prints past its own total', () => {
    const v = view({owed: 3, granted: 2, source: CardName.HEAD_START});
    expect(bonusActionIndex(v)).to.be.at.least(1);
    expect(bonusActionIndex(v)).to.be.at.most(bonusActionGranted(v));
  });

  /*
   * OWED ≠ ON THE BOARD. A corporation's mandatory first action IS the
   * player's first action, so the server offers it in place of a bonus menu
   * and spends a bonus on it — but the START WORKSPACE serves that prompt
   * itself, with its own stage. Sending the player to the board for it would
   * hand the screen away from the very surface showing it.
   */
  it('a bonus spent on a workspace-served prompt owes, but needs no board trip', () => {
    const v = view({...FIRST_BONUS, startGamePrompt: {kind: 'corporationInitialAction'}});
    expect(bonusActionOwed(v), 'the bonus is outstanding').to.be.true;
    expect(bonusActionOnBoard(v), '…but the workspace is serving it').to.be.false;
  });

  it('a generation-1 bonus belongs to the start workspace', () => {
    expect(bonusActionInStartFlow(view(FIRST_BONUS))).to.be.true;
  });

  it('…a later-generation one belongs to the board alone — no workspace to return to', () => {
    expect(bonusActionInStartFlow(view({...FIRST_BONUS, generation: 4}))).to.be.false;
  });

  /*
   * THE ORDERING CHOICE — the official text's «you may take one or both
   * actions before gaining the M€ and/or steel». The server exposes the
   * unclaimed gains as real options of the window's prompts; the client only
   * ever reads the marker rows.
   */
  it('the claimable gains are the marker rows, empty everywhere else', () => {
    const gains = [
      {resource: 'steel' as const, amount: 2, index: 7},
      {resource: 'megacredits' as const, amount: 4, index: 8},
    ];
    expect(bonusActionGains(view({...FIRST_BONUS, marker: {...HEAD_START, gains}}))).to.deep.eq(gains);
    // Mid-sub-prompt (no marker) there is nothing claimable to render.
    expect(bonusActionGains(view({owed: 1, granted: 2}))).to.deep.eq([]);
    expect(bonusActionGains(view())).to.deep.eq([]);
  });

  /*
   * THE NESTED FIRST ACTION — both markers on one prompt is the structural
   * signature: the corp's mandatory move is being spent AS bonus action #1,
   * so the stage frames itself as the window's item instead of a chapter.
   */
  it('both markers on one prompt = the nested first action', () => {
    expect(bonusActionNestedFirstAction(view({
      ...FIRST_BONUS, startGamePrompt: {kind: 'corporationInitialAction'},
    }))).to.be.true;
    // A bare bonus menu is not nested…
    expect(bonusActionNestedFirstAction(view(FIRST_BONUS))).to.be.false;
    // …and a standalone corp prompt (no window) is not either.
    expect(bonusActionNestedFirstAction(view({
      startGamePrompt: {kind: 'corporationInitialAction'},
    }))).to.be.false;
  });

  /*
   * THE DECLARED CHAPTER — «Фора» among the picked preludes WILL be played,
   * so the journey rail shows the bonus chapter from the first frame.
   */
  it('a picked granting prelude declares the chapter; ordinary cards do not', () => {
    expect(bonusActionsDeclaredBy([CardName.HEAD_START, CardName.LOAN])).to.eq(CardName.HEAD_START);
    expect(bonusActionsDeclaredBy([CardName.LOAN, CardName.DONATION])).to.eq(undefined);
    expect(bonusActionsDeclaredBy([])).to.eq(undefined);
  });

  it('the turn-control verbs get ONE concrete reason, and only while the window is open', () => {
    expect(bonusActionTurnControlReason(view())).to.eq('');
    expect(bonusActionTurnControlReason(view(FIRST_BONUS))).to.eq(BONUS_ACTION_TURN_CONTROL_REASON);
    // …and it names the rule, not the arithmetic («сейчас недоступно» over a
    // live menu is what this replaces).
    expect(BONUS_ACTION_TURN_CONTROL_REASON).to.match(/pass or end your turn/i);
  });
});
