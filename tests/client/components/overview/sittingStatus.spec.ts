import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus} from '@/client/components/overview/playerStatusPresenter';

/*
 * THE PLAYER CHIPS AROUND AN OPEN SITTING (the soft gates). The next generation already runs on the server while a
 * seat still reads its Parliament sitting (its confirmation «Закрыть заседание» stands), so the phase-derived label
 * said «ПОКУПКА КАРТ» of a seat that was still in the Parliament (measured on the TV storyboard). The server's own
 * kind names it.
 */
function player(overrides: Partial<PublicPlayerModel>): PublicPlayerModel {
  return {color: 'blue', name: 'Human', isActive: false, isWaitingForInput: false, actionsTakenThisRound: 0, ...overrides} as PublicPlayerModel;
}

function view(players: ReadonlyArray<PublicPlayerModel>): ViewModel {
  return {players, game: {phase: Phase.RESEARCH, generation: 2, passedPlayers: []}} as unknown as ViewModel;
}

describe('player status while a seat still reads its sitting', () => {
  it('the seat holding its confirmation reads ЗАСЕДАНИЕ; the seat that closed it reads ПОКУПКА КАРТ', () => {
    const reading = player({color: 'red', isWaitingForInput: true, waitingForKind: 'sitting'});
    const buying = player({color: 'blue', isWaitingForInput: true});
    const v = view([reading, buying]);
    expect(actionLabelForPlayer(v, reading)).to.eq('sitting');
    expect(actionLabelForPlayer(v, buying)).to.eq('researching');
    const shown = presentPlayerStatus('sitting');
    expect(shown.category).to.eq('active');
    expect(shown.textKey).to.eq('Sitting');
    expect(shown.showCounter).to.be.false;
  });
});
