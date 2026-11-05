import {expect} from 'chai';
import {Dataminer} from '../../../src/server/milestones/turmoilRedux/Dataminer';
import {Birds} from '../../../src/server/cards/base/Birds';
import {CardResource} from '../../../src/common/CardResource';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {fakeCard} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';

describe('Dataminer', () => {
  let milestone: Dataminer;
  let player: TestPlayer;

  beforeEach(() => {
    milestone = new Dataminer();
    player = TestPlayer.BLUE.newPlayer();
  });

  it('counts data across every card — 7 is the threshold', () => {
    const a = fakeCard({resourceType: CardResource.DATA});
    const b = fakeCard({resourceType: CardResource.DATA});
    player.playedCards.push(a, b);

    player.addResourceTo(a, 4);
    player.addResourceTo(b, 2);
    expect(milestone.getScore(player)).eq(6);
    expect(milestone.canClaim(player)).is.false;

    player.addResourceTo(b, 1);
    expect(milestone.getScore(player)).eq(7);
    expect(milestone.canClaim(player)).is.true;
  });

  it('other card resources do not count', () => {
    const birds = new Birds();
    player.playedCards.push(birds);
    player.addResourceTo(birds, 9);
    expect(milestone.getScore(player)).eq(0);
  });

  it('declares the resource it counts (the «no effect» verdict reads it)', () => {
    expect(milestone.cardResourceCount).deep.eq([CardResource.DATA]);
  });

  it('is a Turmoil Redux milestone in every random pool', () => {
    expect(milestoneManifest.all['Dataminer'].compatibility).eq('turmoilRedux');
    expect(milestoneManifest.all['Dataminer'].random).eq('both');
  });
});
