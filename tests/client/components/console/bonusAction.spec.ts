import {expect} from 'chai';
import {
  BONUS_ACTION_TURN_CONTROL_REASON,
  bonusActionGranted, bonusActionInStartFlow, bonusActionIndex, bonusActionMeta,
  bonusActionOnBoard, bonusActionOwed, bonusActionRemaining, bonusActionSource,
  bonusActionTurnControlReason,
} from '@/client/console/bonusAction';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {ACTION_MENU_FIRST_TITLE} from '@/common/inputs/actionMenuTitles';

/**
 * THE BONUS-ACTION MODEL — pure derivations over the ONE server artifact that
 * identifies a card-granted action outside the turn's own two: the
 * `bonusActionPrompt` marker on the action menu.
 *
 * The specs deliberately build a menu that is INDISTINGUISHABLE from a normal
 * one except for the marker — same type, same title — because that is exactly
 * what the server sends, and it is why no title or phase check could ever
 * answer this question.
 */
function view(opts: {
  marker?: {source: CardName, remaining: number, granted: number},
  startGamePrompt?: {kind: string},
  generation?: number,
} = {}): PlayerViewModel {
  return {
    id: 'p1',
    game: {generation: opts.generation ?? 1, phase: Phase.PRELUDES, passedPlayers: []},
    thisPlayer: {color: 'red'},
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

describe('bonusAction (the card-granted action model)', () => {
  it('an ordinary action menu owes nothing — the title alone never implies a bonus', () => {
    const v = view();
    expect(bonusActionMeta(v)).to.eq(undefined);
    expect(bonusActionOwed(v)).to.be.false;
    expect(bonusActionSource(v)).to.eq(undefined);
    expect(bonusActionRemaining(v)).to.eq(0);
    expect(bonusActionGranted(v)).to.eq(0);
    expect(bonusActionIndex(v)).to.eq(0);
  });

  it('no prompt at all owes nothing', () => {
    const v = {waitingFor: undefined} as unknown as PlayerViewModel;
    expect(bonusActionOwed(v)).to.be.false;
    expect(bonusActionIndex(v)).to.eq(0);
  });

  it('the marker — and only the marker — makes it a bonus action', () => {
    const v = view({marker: HEAD_START});
    expect(bonusActionOwed(v)).to.be.true;
    expect(bonusActionSource(v)).to.eq(CardName.HEAD_START);
    expect(bonusActionRemaining(v)).to.eq(2);
    expect(bonusActionGranted(v)).to.eq(2);
  });

  it('the readout counts the BONUSES, walking 1/2 → 2/2', () => {
    expect(bonusActionIndex(view({marker: {...HEAD_START, remaining: 2}}))).to.eq(1);
    expect(bonusActionIndex(view({marker: {...HEAD_START, remaining: 1}}))).to.eq(2);
  });

  it('a batch extended mid-window never prints past its own total', () => {
    // A second grant inside one window adds to both numbers; the index must
    // stay inside the batch rather than reading «3 / 2» for a frame.
    const v = view({marker: {source: CardName.HEAD_START, remaining: 3, granted: 2}});
    expect(bonusActionIndex(v)).to.be.at.least(1);
    expect(bonusActionIndex(v)).to.be.at.most(bonusActionGranted(v));
  });

  /*
   * OWED ≠ ON THE BOARD. A corporation's mandatory first action IS the
   * player's first action, so the server offers it in place of a bonus menu
   * and spends a bonus on it — but the START WORKSPACE serves that prompt
   * itself, with its own stage. Announcing a board trip for it would hand the
   * screen away from the very surface showing it, and (once the excursion had
   * latched on the previous bonus) would keep the workspace hidden behind a
   * board with nothing to do on it.
   */
  it('a bonus spent on a workspace-served prompt owes, but needs no board trip', () => {
    const v = view({marker: HEAD_START, startGamePrompt: {kind: 'corporationInitialAction'}});
    expect(bonusActionOwed(v), 'the bonus is outstanding').to.be.true;
    expect(bonusActionOnBoard(v), '…but the workspace is serving it').to.be.false;
  });

  it('a bare marked action menu DOES need the board', () => {
    expect(bonusActionOnBoard(view({marker: HEAD_START}))).to.be.true;
  });

  it('no bonus at all needs no board trip', () => {
    expect(bonusActionOnBoard(view())).to.be.false;
  });

  /*
   * THE WORKSPACE IS THE BONUS'S HOME, and it must know that from the DOMAIN —
   * after a reload there is no lifetime hold and no client latch left, only
   * the server's marker. Generation 1 IS the start of the game (the same
   * discriminator the corporation's first action uses).
   */
  it('a generation-1 bonus belongs to the start workspace', () => {
    expect(bonusActionInStartFlow(view({marker: HEAD_START}))).to.be.true;
  });

  it('…a later-generation one belongs to the board alone — no workspace to return to', () => {
    expect(bonusActionInStartFlow(view({marker: HEAD_START, generation: 4}))).to.be.false;
  });

  it('…and a bonus the workspace is already serving needs no hand-off term either', () => {
    expect(bonusActionInStartFlow(
      view({marker: HEAD_START, startGamePrompt: {kind: 'corporationInitialAction'}}))).to.be.false;
  });

  it('the turn-control verbs get ONE concrete reason, and only while a bonus stands', () => {
    expect(bonusActionTurnControlReason(view())).to.eq('');
    expect(bonusActionTurnControlReason(view({marker: HEAD_START})))
      .to.eq(BONUS_ACTION_TURN_CONTROL_REASON);
    // …and it names the rule, not the arithmetic («сейчас недоступно» over a
    // live menu is what this replaces).
    expect(BONUS_ACTION_TURN_CONTROL_REASON).to.match(/pass or end your turn/i);
  });
});
