import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus, statusCounterText} from '@/client/components/overview/playerStatusPresenter';

/**
 * THE PLAYER CHIP during a card-granted BONUS action (Head Start's «immediately
 * take 2 actions»).
 *
 * Two things must be true on EVERY seat, not just the acting player's:
 *
 *  1. the label names what is happening. `game.phase` is still PRELUDES while
 *     the bonuses are taken, so the phase-derived «ФАЗА ПРОЛОГОВ» would
 *     describe the wrong thing to an opponent watching the board change;
 *  2. the counter counts the BONUSES. During the prelude phase
 *     `actionsTakenThisRound` is counting PRELUDES PLAYED, so the ordinary
 *     derivation would print «2/2» on the player's FIRST bonus action.
 */
function player(overrides: Partial<PublicPlayerModel>): PublicPlayerModel {
  return {
    color: 'blue',
    name: 'Human',
    isActive: false,
    isWaitingForInput: false,
    actionsTakenThisRound: 0,
    ...overrides,
  } as PublicPlayerModel;
}

function view(players: ReadonlyArray<PublicPlayerModel>, phase: Phase = Phase.PRELUDES): ViewModel {
  return {players, game: {phase, generation: 1, passedPlayers: []}} as unknown as ViewModel;
}

describe('bonus-action player status', () => {
  it('the server marker outranks the phase — «ФАЗА ПРОЛОГОВ» would be the wrong story', () => {
    const acting = player({
      isActive: true, isWaitingForInput: true, waitingForKind: 'bonusaction',
      // …and it has already played a prelude, which is why the phase label
      // would otherwise win.
      actionsTakenThisRound: 1, bonusActions: 2, bonusActionsGranted: 2,
    });
    expect(actionLabelForPlayer(view([acting]), acting)).to.eq('bonusaction');
  });

  it('without the marker the prelude phase still reads as the prelude phase', () => {
    const p = player({isWaitingForInput: true, actionsTakenThisRound: 1});
    expect(actionLabelForPlayer(view([p]), p)).to.eq('preludes');
  });

  it('an OPPONENT sees it too — the marker is on the public model', () => {
    // The chip row derives every seat's label from the same function, so an
    // opponent acting on the board reads as «БОНУСНОЕ ДЕЙСТВИЕ», never as an
    // unexplained board change during someone else\'s prelude phase.
    const me = player({color: 'red'});
    const them = player({
      color: 'green', isActive: true, isWaitingForInput: true,
      waitingForKind: 'bonusaction', bonusActions: 1, bonusActionsGranted: 2,
    });
    expect(actionLabelForPlayer(view([me, them]), them)).to.eq('bonusaction');
  });

  it('presents as a real active turn, WITH its own counter', () => {
    const p = presentPlayerStatus('bonusaction');
    expect(p.category, 'the player IS acting on the board').to.eq('active');
    expect(p.glyph).to.eq('dot');
    expect(p.textKey).to.eq('Bonus action');
    expect(p.showCounter).to.be.true;
  });

  it('the counter counts the BONUSES, not the preludes already played', () => {
    const first = player({actionsTakenThisRound: 1, bonusActions: 2, bonusActionsGranted: 2});
    expect(statusCounterText(first, 'bonusaction'), 'first of two').to.eq('1/2');

    const second = player({actionsTakenThisRound: 1, bonusActions: 1, bonusActionsGranted: 2});
    expect(statusCounterText(second, 'bonusaction'), 'second of two').to.eq('2/2');
  });

  it('a normal turn counter is untouched (incl. the all-others-passed run-on)', () => {
    expect(statusCounterText(player({actionsTakenThisRound: 0}), 'turn')).to.eq('1/2');
    expect(statusCounterText(player({actionsTakenThisRound: 1}), 'turn')).to.eq('2/2');
    // The server stops resetting the counter once everyone else has passed;
    // the modulo restores the visible 1/2 ↔ 2/2 alternation.
    expect(statusCounterText(player({actionsTakenThisRound: 4}), 'turn')).to.eq('1/2');
  });

  it('a bonus label with no numbers degrades to the turn counter, never to NaN', () => {
    expect(statusCounterText(player({actionsTakenThisRound: 0}), 'bonusaction')).to.eq('1/2');
  });
});
