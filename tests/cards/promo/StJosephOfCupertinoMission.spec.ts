import {expect} from 'chai';
import {StJosephOfCupertinoMission} from '../../../src/server/cards/promo/StJosephOfCupertinoMission';
import {testGame} from '../../TestGame';
import {addCity, runAllActions} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {Space} from '../../../src/server/boards/Space';
import {IPlayer} from '../../../src/server/IPlayer';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {cast} from '../../../src/common/utils/utils';

/** Play the action as `builder`, then put the cathedral on `space`. */
function buildCathedralIn(game: IGame, builder: IPlayer, space: Space): void {
  const card = new StJosephOfCupertinoMission();
  builder.megaCredits = 5;
  builder.steel = 0;
  card.action(builder);
  // Auto-pays the 5 M€ (no steel to choose), then defers the city SelectSpace.
  runAllActions(game);
  cast(builder.popWaitingFor(), SelectSpace).cb(space);
  runAllActions(game);
}

describe('StJosephOfCupertinoMission', () => {
  it('cathedral placement keeps the city tile visible — overlay, not removal', () => {
    const card = new StJosephOfCupertinoMission();
    const [game, player] = testGame(2);

    const citySpace = addCity(player);
    runAllActions(game);
    player.megaCredits = 5;
    player.steel = 0;

    expect(card.canAct(player)).is.true;

    card.action(player);
    // Auto-pays the 5 M€ (no steel to choose), then defers the city SelectSpace.
    runAllActions(game);

    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    expect(selectSpace.spaces.map((s) => s.id)).to.include(citySpace.id);
    // The cathedral is an OVERLAY marker — the city tile is NOT removed, so it
    // must stay visible during selection. No tile is hidden.
    expect(selectSpace.hiddenTiles).is.undefined;
    expect(selectSpace.toModel().hiddenTiles).is.undefined;
  });

  it('the cathedral is recorded on the city, which keeps its tile', () => {
    const [game, player] = testGame(2);
    const citySpace = addCity(player);
    runAllActions(game);

    buildCathedralIn(game, player, citySpace);

    expect(game.stJosephCathedrals).to.include(citySpace.id);
    // The marker rides ON TOP of the city — the tile itself is untouched.
    expect(citySpace.tile).is.not.undefined;
  });

  it("city owner's offer: ONE leaf option carrying the premium M€/card chips", () => {
    const [game, player, player2] = testGame(2);
    const citySpace = addCity(player2);
    runAllActions(game);
    player2.megaCredits = 10;

    buildCathedralIn(game, player, citySpace);

    const offer = cast(player2.popWaitingFor(), OrOptions);
    // The pay branch is a LEAF SelectOption — deliberately NOT a nested
    // SelectPayment: a fixed 2 M€ has nothing to dial, so the choice confirms
    // in ONE press instead of opening a payment step behind it.
    const pay = cast(offer.options[0], SelectOption);
    expect(pay.metadata?.effects).to.deep.equal([
      {direction: 'cost', icon: 'megacredits', amount: 2, current: 10, resulting: 8},
      {direction: 'gain', icon: 'cards', amount: 1},
    ]);
    // …and the declining branch stays marked as the skip.
    expect(cast(offer.options[1], SelectOption).metadata?.kind).to.eq('skip');
    // The prompt names its source card (premium contextual choice).
    expect(offer.choiceContext?.source).to.deep.include({card: CardName.ST_JOSEPH_OF_CUPERTINO_MISSION});

    pay.cb(undefined);
    runAllActions(game);

    // M€-only payment → SelectPaymentDeferred auto-pays: no second prompt.
    expect(player2.popWaitingFor()).is.undefined;
    expect(player2.megaCredits).to.eq(8);
    expect(player2.cardsInHand).has.length(1);
  });

  it('declining costs nothing and draws nothing', () => {
    const [game, player, player2] = testGame(2);
    const citySpace = addCity(player2);
    runAllActions(game);
    player2.megaCredits = 10;

    buildCathedralIn(game, player, citySpace);

    cast(cast(player2.popWaitingFor(), OrOptions).options[1], SelectOption).cb(undefined);
    runAllActions(game);

    expect(player2.megaCredits).to.eq(10);
    expect(player2.cardsInHand).has.length(0);
  });

  it('the wallet chip is PROMPT-TIME truth (the offer is built lazily)', () => {
    const [game, player, player2] = testGame(2);
    const citySpace = addCity(player2);
    runAllActions(game);
    player2.megaCredits = 10;

    const card = new StJosephOfCupertinoMission();
    player.megaCredits = 5;
    player.steel = 0;
    card.action(player);
    runAllActions(game);
    cast(player.popWaitingFor(), SelectSpace).cb(citySpace);
    // The owner's M€ changed between the placement and the prompt: the chip has
    // to show what they hold NOW, not what they held when the space was picked.
    player2.megaCredits = 4;
    runAllActions(game);

    const offer = cast(player2.popWaitingFor(), OrOptions);
    expect(cast(offer.options[0], SelectOption).metadata?.effects?.[0]).to.deep.eq(
      {direction: 'cost', icon: 'megacredits', amount: 2, current: 4, resulting: 2});
  });

  it('no offer at all when the city owner cannot afford it', () => {
    const [game, player, player2] = testGame(2);
    const citySpace = addCity(player2);
    runAllActions(game);
    player2.megaCredits = 1;

    buildCathedralIn(game, player, citySpace);

    expect(player2.popWaitingFor()).is.undefined;
    expect(player2.cardsInHand).has.length(0);
  });
});
