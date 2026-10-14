import {expect} from 'chai';
import {EcologyExperts} from '../../../src/server/cards/prelude/EcologyExperts';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, testGame} from '../../TestingUtils';
import {AICentral} from '../../../src/server/cards/base/AICentral';
import {Ants} from '../../../src/server/cards/base/Ants';
import {Livestock} from '../../../src/server/cards/base/Livestock';
import {GuerillaEcologists} from '../../../src/server/cards/underworld/GuerillaEcologists';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {MicroMills} from '../../../src/server/cards/base/MicroMills';
import {Manutech} from '../../../src/server/cards/venusNext/Manutech';
import {cast} from '../../../src/common/utils/utils';
import {GlobalParameter} from '../../../src/common/GlobalParameter';

describe('EcologyExperts', () => {
  let card: EcologyExperts;
  let player: TestPlayer;

  beforeEach(() => {
    card = new EcologyExperts();
    [/* game */, player] = testGame(1);
  });

  it('Waives the global requirements of the card it plays — by KIND, never by a number of steps', () => {
    expect(card.waivesGlobalRequirements(player, GlobalParameter.OXYGEN)).is.false;
    player.lastCardPlayed = card.name;
    expect(card.waivesGlobalRequirements(player, GlobalParameter.OXYGEN)).is.true;
    expect(card.waivesGlobalRequirements(player, GlobalParameter.VENUS)).is.true;
    // No sentinel: the bonus in steps stays zero (TR49 class — «ignore» is a kind).
    expect(card.getGlobalParameterRequirementBonus(player, GlobalParameter.OXYGEN)).to.eq(0);
  });

  it('the canPlay probe names its waiver for the question only', () => {
    const ants = new Ants();
    player.cardsInHand.push(ants);
    player.megaCredits = ants.cost;
    expect(card.canPlay(player)).is.true;
    expect(player.temporaryGlobalRequirementWaiver).is.undefined;
    expect(player.canPlay(ants)).is.false;
  });

  it('Can Play', () => {
    expect(card.canPlay(player)).is.false;
    const microMills = new MicroMills();
    player.cardsInHand.push(microMills);
    expect(card.canPlay(player)).is.false;
    player.megaCredits = microMills.cost;
    expect(card.canPlay(player)).is.true;
  });

  it('Can Play, with global parameter requirements', () => {
    // Ants needs 4% oxygen
    const ants = new Ants();
    player.cardsInHand.push(ants);
    expect(card.canPlay(player)).is.false;
    player.megaCredits = ants.cost;
    expect(card.canPlay(player)).is.true;
  });

  it('Should play', () => {
    // AI Central needs 3 science tags.
    const aiCentral = new AICentral();
    // Ants needs 4% oxygen
    const ants = new Ants();
    player.cardsInHand = [aiCentral, ants];
    player.megaCredits = Math.max(aiCentral.cost, ants.cost);

    expect(player.canPlay(aiCentral)).is.false;
    expect(player.canPlay(ants)).is.false;

    player.playCard(card);
    runAllActions(player.game);
    const selectProjectCardToPlay = cast(player.popWaitingFor(), SelectProjectCardToPlay);
    expect(selectProjectCardToPlay.cards).deep.eq([ants]);

    // Ecology Experts doesn't touch tag requirements.
    expect(player.canPlay(aiCentral)).is.false;
    // But it does touch global requirements.
    expect(player.canPlay(ants)).is.true;
  });

  it('canplay Livestock, which requres global parameter and production', () => {
    // Livestock needs 9% oxygen, and 1 plant production.
    const livestock = new Livestock();
    player.cardsInHand.push(livestock);
    player.megaCredits = livestock.cost;
    expect(card.canPlay(player)).is.true;
  });

  it('canplay Guerilla Ecologists, which requires plants, player has Manutech', () => {
    // Guerilla Ecologists requires 4 plants
    const guerillaEcologists = new GuerillaEcologists();
    player.underworldData.corruption = 1;
    player.plants = 2;
    player.cardsInHand.push(guerillaEcologists);
    player.playedCards.push(new Manutech());
    player.megaCredits = guerillaEcologists.cost;

    expect(card.canPlay(player)).is.false;

    player.plants = 3;

    expect(card.canPlay(player)).is.true;
  });
});
