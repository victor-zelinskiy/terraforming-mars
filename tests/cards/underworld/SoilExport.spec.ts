import {expect} from 'chai';
import {SoilExport} from '../../../src/server/cards/underworld/SoilExport';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {assertIsExcavationAction} from '../../underworld/underworldAssertions';
import {JupiterFloatingStation} from '../../../src/server/cards/colonies/JupiterFloatingStation';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';

describe('SoilExport', () => {
  it('Should play', () => {
    const card = new SoilExport();
    const [game, player] = testGame(2, {underworldExpansion: true});
    const jupiterFloatingStation = new JupiterFloatingStation();
    player.playedCards.push(jupiterFloatingStation);

    cast(card.play(player), undefined);
    runAllActions(game);

    // The card-target pick prompts FIRST (PLAY_CARD_RESOURCE_CHOICE elevates it
    // ahead of the excavation) — the order the play preview promises, so the
    // premium modal's pre-collected pick lands and the excavation rides the
    // board banner instead of the pick re-surfacing after it.
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.cb([jupiterFloatingStation]);

    expect(jupiterFloatingStation.resourceCount).eq(3);

    runAllActions(game);

    assertIsExcavationAction(player, player.popWaitingFor());
  });
});
