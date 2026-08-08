import {expect} from 'chai';
import {StJosephOfCupertinoMission} from '../../../src/server/cards/promo/StJosephOfCupertinoMission';
import {testGame} from '../../TestGame';
import {addCity, runAllActions} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SelectPayment} from '../../../src/server/inputs/SelectPayment';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {Space} from '../../../src/server/boards/Space';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {CardName} from '../../../src/common/cards/CardName';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {EmptyBoard} from '../../testing/EmptyBoard';

/** Play the action as `builder`, then put the cathedral on `space`. */
function buildCathedralIn(game: IGame, builder: TestPlayer, space: Space): void {
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

/**
 * Rules coverage adopted from upstream 81be2d275f ("Add tests for cards that do not
 * have tests"). The four upstream tests that drive the CITY OWNER's offer are
 * deliberately NOT adopted: they cast `orOptions.options[0]` to `SelectPayment`,
 * while this fork builds that branch as a LEAF `SelectOption` carrying premium
 * result metadata (see `cathedralCardOffer` — a fixed 2 M€ has nothing to dial, so
 * it confirms in one press). That surface is covered by the premium tests above.
 */
describe('StJosephOfCupertinoMission — rules', () => {
  let card: StJosephOfCupertinoMission;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new StJosephOfCupertinoMission();
    [game, player, player2] = testGame(2);
    game.board = EmptyBoard.newInstance();
  });

  for (const run of [
    {cities: 0, cathedrals: 0, expected: false},
    {cities: 1, cathedrals: 0, expected: true},
    {cities: 1, cathedrals: 1, expected: false},
    {cities: 2, cathedrals: 1, expected: true},
  ] as const) {
    it('canAct ' + JSON.stringify(run), () => {
      player.megaCredits = 5;
      const spaces = [];
      for (let i = 0; i < run.cities; i++) {
        spaces.push(addCity(player));
      }
      for (let i = 0; i < run.cathedrals; i++) {
        game.stJosephCathedrals.push(spaces[i].id);
      }

      expect(card.canAct(player)).to.eq(run.expected);
    });
  }

  for (const run of [
    {mc: 4, steel: 0, expected: false},
    {mc: 5, steel: 0, expected: true},
    {mc: 0, steel: 3, expected: true},
    {mc: 2, steel: 1, expected: false},
  ] as const) {
    it('affording canAct ' + JSON.stringify(run), () => {
      addCity(player);
      player.megaCredits = run.mc;
      player.stock.steel = run.steel;
      expect(card.canAct(player)).eq(run.expected);
    });
  }

  it('action lets the player pay using steel', () => {
    const citySpace = addCity(player);
    player.megaCredits = 0;
    player.stock.steel = 3;

    card.action(player);
    runAllActions(game);

    const selectPayment = cast(player.popWaitingFor(), SelectPayment);
    selectPayment.cb(Payment.of({steel: 3}));
    runAllActions(game);

    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    selectSpace.cb(citySpace);

    expect(player.stock.steel).to.eq(0);
    expect(game.stJosephCathedrals).includes(citySpace.id);
  });

  it('action offers only cities without an existing cathedral, and records the new one', () => {
    const eligible = addCity(player);
    const ineligible = addCity(player2);
    game.stJosephCathedrals.push(ineligible.id);

    player.megaCredits = 5;
    card.action(player);
    runAllActions(game);

    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    expect(selectSpace.spaces).deep.eq([eligible]);

    selectSpace.cb(eligible);

    expect(game.stJosephCathedrals).includes(eligible.id);
    expect(player.megaCredits).to.eq(0);
  });

  it('getVictoryPoints counts cathedrals placed by any player', () => {
    game.stJosephCathedrals = ['01', '02', '03'];
    expect(card.getVictoryPoints(player)).to.eq(3);
    expect(card.getVictoryPoints(player2)).to.eq(3);
  });
});
