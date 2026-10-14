import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus} from '@/client/components/overview/playerStatusPresenter';

/*
 * THE PLAYER CHIPS DURING THE FINAL GREENERY (PL-302). Everybody passed the last generation, so without the phase's
 * own fact every idle seat read «СПАСОВАЛ» and the seat placing read the generic off-turn «ДЕЙСТВИЕ» — nothing on
 * the strip said who is placing, who has finished and who still waits for their turn (or for another seat's
 * triggered answer while the placer's context stands). The strip is where the owner tracks the finale from any seat.
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

function view(players: ReadonlyArray<PublicPlayerModel>, game: Record<string, unknown>): ViewModel {
  return {players, game: {phase: Phase.PRODUCTION, generation: 9, passedPlayers: players.map((p) => p.color), ...game}} as unknown as ViewModel;
}

describe('final greenery player status', () => {
  const placing = player({color: 'blue', isWaitingForInput: true, waitingForKind: 'finalgreenery'});
  const idle = player({color: 'red'});
  const done = player({color: 'green'});

  it('the seat being asked reads ОЗЕЛЕНЕНИЕ by the server\'s kind — never the phase-derived ДЕЙСТВИЕ', () => {
    const v = view([placing, idle, done], {finalGreenery: {done: ['green']}});
    expect(actionLabelForPlayer(v, placing)).to.eq('finalgreenery');
    const shown = presentPlayerStatus('finalgreenery');
    expect(shown.category).to.eq('active');
    expect(shown.textKey).to.eq('Greenery');
    expect(shown.showCounter, 'no 1/2 — the finale is not an action slot').to.be.false;
  });

  it('a DONE seat reads ЗАВЕРШЕНО (positive), a seat still waiting for its turn reads ОЖИДАЕТ — never СПАСОВАЛ', () => {
    const v = view([placing, idle, done], {finalGreenery: {done: ['green']}});
    expect(actionLabelForPlayer(v, done)).to.eq('finished');
    expect(presentPlayerStatus('finished').category).to.eq('ready');
    expect(presentPlayerStatus('finished').textKey).to.eq('Finished');
    expect(actionLabelForPlayer(v, idle)).to.eq('waiting');
  });

  it('a triggered answer on another seat (Philares) is that seat\'s ACTION; the placer, prompt-less, WAITS', () => {
    const owner = player({color: 'red', isWaitingForInput: true});
    const placer = player({color: 'blue'});
    const v = view([placer, owner], {finalGreenery: {done: []}});
    expect(actionLabelForPlayer(v, owner)).to.eq('forcedaction');
    expect(actionLabelForPlayer(v, placer)).to.eq('waiting');
  });

  it('without the phase fact the old words stand (the production phase before the loop)', () => {
    const v = view([placing, idle], {});
    expect(actionLabelForPlayer(v, idle)).to.eq('passed');
  });
});
