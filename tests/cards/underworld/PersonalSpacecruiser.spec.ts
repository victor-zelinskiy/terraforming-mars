import {expect} from 'chai';
import {PersonalSpacecruiser} from '../../../src/server/cards/underworld/PersonalSpacecruiser';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';

describe('PersonalSpacecruiser', () => {
  it('play', () => {
    const card = new PersonalSpacecruiser();
    const [game, player] = testGame(2);
    const securityFleet = new SecurityFleet();
    player.playedCards.push(securityFleet);

    cast(card.play(player), undefined);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.cb([securityFleet]);

    expect(securityFleet.resourceCount).eq(1);
    expect(player.underworldData.corruption).to.eq(1);
  });

  it('canAct', () => {
    const card = new PersonalSpacecruiser();
    const [/* game */, player] = testGame(2);
    expect(card.canAct(player)).is.false;

    player.energy = 1;

    expect(card.canAct(player)).is.true;
  });

  for (const run of [
    {corruption: 1, expected: 2},
    {corruption: 4, expected: 8},
  ] as const) {
    it('action ' + JSON.stringify(run), () => {
      const card = new PersonalSpacecruiser();
      const [/* game */, player] = testGame(2);
      player.energy = 1;
      player.underworldData.corruption = run.corruption;
      card.action(player);

      expect(player.megaCredits).eq(run.expected);
    });
  }
});
