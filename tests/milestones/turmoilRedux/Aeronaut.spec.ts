import {expect} from 'chai';
import {Aeronaut} from '../../../src/server/milestones/turmoilRedux/Aeronaut';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {Birds} from '../../../src/server/cards/base/Birds';
import {CardResource} from '../../../src/common/CardResource';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {TestPlayer} from '../../TestPlayer';

describe('Aeronaut', () => {
  let milestone: Aeronaut;
  let player: TestPlayer;

  beforeEach(() => {
    milestone = new Aeronaut();
    player = TestPlayer.BLUE.newPlayer();
  });

  it('counts fighters and mechs together — 4 is the threshold', () => {
    const fleet = new SecurityFleet();
    const mechs = new EvaMechs();
    player.playedCards.push(fleet, mechs);

    player.addResourceTo(fleet, 2);
    player.addResourceTo(mechs, 1);
    expect(milestone.getScore(player)).eq(3);
    expect(milestone.canClaim(player)).is.false;

    player.addResourceTo(mechs, 1);
    expect(milestone.getScore(player)).eq(4);
    expect(milestone.canClaim(player)).is.true;
  });

  it('either kind alone reaches it', () => {
    const fleet = new SecurityFleet();
    player.playedCards.push(fleet);
    player.addResourceTo(fleet, 4);
    expect(milestone.canClaim(player)).is.true;
  });

  it('other card resources do not count', () => {
    const birds = new Birds();
    player.playedCards.push(birds);
    player.addResourceTo(birds, 6);
    expect(milestone.getScore(player)).eq(0);
    expect(milestone.canClaim(player)).is.false;
  });

  it('declares the resources it counts (the «no effect» verdict reads it)', () => {
    expect(milestone.cardResourceCount).deep.eq([CardResource.FIGHTER, CardResource.MECH]);
  });

  it('is a Turmoil Redux milestone in every random pool', () => {
    expect(milestoneManifest.all['Aeronaut'].compatibility).eq('turmoilRedux');
    expect(milestoneManifest.all['Aeronaut'].random).eq('both');
  });
});
