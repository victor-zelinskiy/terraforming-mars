import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Influencer} from '../../../src/server/awards/turmoilRedux/Influencer';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {awardManifest} from '../../../src/server/awards/Awards';
import {randomExclusionGroup} from '../../../src/server/ma/MilestoneAwardExclusions';
import {Phase} from '../../../src/common/Phase';

describe('Influencer', () => {
  let award: Influencer;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    award = new Influencer();
    [game, player, player2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
  });

  it('scores the Agenda marker\'s position — 0 at the start', () => {
    expect(award.getScore(player)).eq(0);
    game.parliament!.agenda.set(player.id, 5);
    expect(award.getScore(player)).eq(5);
    expect(award.getScore(player2)).eq(0);
  });

  it('reads the marker the track\'s ONE walk moves — the furthest wins', () => {
    const parliament = game.parliament!;
    ChairmanSeat.walkAgenda(player, parliament, 2, {reason: 'quest'});
    ChairmanSeat.walkAgenda(player2, parliament, 4, {reason: 'quest'});
    expect(award.getScore(player)).eq(2);
    expect(award.getScore(player2)).eq(4);
  });

  it('a game with no Parliament reads 0, never throws', () => {
    const [, plain] = testGame(2);
    expect(award.getScore(plain)).eq(0);
  });

  it('is a Turmoil Redux award in every random pool, never beside Activist', () => {
    expect(awardManifest.all['Influencer'].compatibility).eq('turmoilRedux');
    expect(awardManifest.all['Influencer'].random).eq('both');
    expect(randomExclusionGroup('Influencer')).eq('agenda-track');
    expect(randomExclusionGroup('Activist')).eq('agenda-track');
  });
});
