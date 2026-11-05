import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Activist} from '../../../src/server/milestones/turmoilRedux/Activist';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {influenceAtAgenda} from '../../../src/common/parliament/ParliamentTypes';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {Phase} from '../../../src/common/Phase';

describe('Activist', () => {
  let milestone: Activist;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    milestone = new Activist();
    [game, player, player2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
  });

  it('every marker starts off the track: nothing walked, nothing claimable', () => {
    expect(milestone.getScore(player)).eq(0);
    expect(milestone.canClaim(player)).is.false;
  });

  it('claimable at 3 steps — the step that gives 2 influence', () => {
    const parliament = game.parliament!;
    parliament.agenda.set(player.id, 2);
    expect(milestone.getScore(player)).eq(2);
    expect(milestone.canClaim(player)).is.false;

    parliament.agenda.set(player.id, 3);
    expect(milestone.canClaim(player)).is.true;
    expect(influenceAtAgenda(3), 'the printed parenthesis: the 2-influence step').eq(2);
    expect(influenceAtAgenda(2)).eq(1);

    // Further along still counts — «at least 3 steps».
    parliament.agenda.set(player.id, 7);
    expect(milestone.getScore(player)).eq(7);
    expect(milestone.canClaim(player)).is.true;
  });

  it('reads the marker the track\'s ONE walk moves — per seat', () => {
    const parliament = game.parliament!;
    ChairmanSeat.walkAgenda(player, parliament, 3, {reason: 'quest'});
    expect(parliament.agendaOf(player)).eq(3);
    expect(milestone.canClaim(player)).is.true;
    expect(milestone.getScore(player2)).eq(0);
    expect(milestone.canClaim(player2)).is.false;
  });

  it('a game with no Parliament reads 0, never throws', () => {
    const [, plain] = testGame(2);
    expect(milestone.getScore(plain)).eq(0);
    expect(milestone.canClaim(plain)).is.false;
  });

  it('is a Turmoil Redux milestone in every random pool', () => {
    expect(milestoneManifest.all['Activist'].compatibility).eq('turmoilRedux');
    expect(milestoneManifest.all['Activist'].random).eq('both');
    expect(milestoneManifest.createOrThrow('Activist').name).eq('Activist');
  });
});
