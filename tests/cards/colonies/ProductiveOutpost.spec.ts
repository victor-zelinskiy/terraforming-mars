import {expect} from 'chai';
import {ProductiveOutpost} from '../../../src/server/cards/colonies/ProductiveOutpost';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {runAllActions, testGame} from '../../TestingUtils';
import {Titania} from '../../../src/server/cards/community/Titania';
import {Leavitt} from '../../../src/server/cards/community/Leavitt';
import {inplaceShuffle} from '../../../src/server/utils/shuffle';
import {UnseededRandom} from '../../../src/common/utils/Random';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {Titan} from '../../../src/server/colonies/Titan';
import {Miranda} from '../../../src/server/colonies/Miranda';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {CardName} from '../../../src/common/cards/CardName';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {allColonyBonusesLedger} from '../../../src/server/colonies/allColonyBonuses';

describe('ProductiveOutpost', () => {
  it('Should play', () => {
    const card = new ProductiveOutpost();
    const [game, player/* , player2 */] = testGame(2);
    const luna = new Luna();
    const triton = new Triton();

    game.colonies.push(luna, triton);
    game.colonies.forEach((colony) => colony.colonies.push(player.id));

    card.play(player);
    runAllActions(game);
    expect(player.megaCredits).to.eq(2);
    expect(player.titanium).to.eq(1);
  });

  it('order is somewhat deterministic', () => {
    const card = new ProductiveOutpost();
    const [game, player/* , player2 */] = testGame(2);
    const titania = new Titania();
    const luna = new Luna();
    const leavitt = new Leavitt();

    player.megaCredits = 1;
    game.colonies.push(titania, luna, leavitt);
    inplaceShuffle(game.colonies, new UnseededRandom());
    game.colonies.forEach((colony) => colony.colonies.push(player.id));

    card.play(player);
    runAllActions(game);

    expect(player.megaCredits).eq(2);
    cast(player.popWaitingFor(), SelectCard);
  });

  // The payout is the shared one (colonies/allColonyBonuses.ts): what it changed for this card is only
  // what used to be untrue — the cube's ordinal, the single holder shown, the card named on what it raises.
  it('two cubes on a tile pay twice, and Pluto\'s pairs read «1 of 2» / «2 of 2» under THIS card', () => {
    const card = new ProductiveOutpost();
    const [game, player] = testGame(2, {coloniesExtension: true});
    const luna = new Luna();
    const pluto = new Pluto();
    game.colonies = [luna, pluto];
    luna.colonies.push(player.id, player.id);
    pluto.colonies.push(player.id, player.id);
    player.cardsInHand.push(...game.projectDeck.drawN(game, 2) as Array<IProjectCard>);

    card.play(player);
    runAllActions(game);
    expect(player.megaCredits).eq(4);
    const first = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(first.discardPrompt?.source).deep.eq({kind: 'card', card: CardName.PRODUCTIVE_OUTPOST});
    expect(first.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 2});
    expect(first.discardPrompt?.colonyBonus).is.undefined;
    first.cb([first.cards[0]]);
    runAllActions(game);
    const second = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(second.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 2, total: 2});
  });

  it('a single holder is SHOWN (no auto-select), and a draw names the colony and this card', () => {
    const card = new ProductiveOutpost();
    const [game, player] = testGame(2, {coloniesExtension: true});
    const titan = new Titan();
    const miranda = new Miranda();
    game.colonies = [titan, miranda];
    titan.colonies.push(player.id);
    miranda.colonies.push(player.id);
    const dirigibles = new Dirigibles();
    player.playedCards.push(dirigibles);

    card.play(player);
    runAllActions(game);
    expect(player.cardDrawReveals.map((r) => r.source)).deep.eq([{type: 'colony', colonyName: ColonyName.MIRANDA, via: CardName.PRODUCTIVE_OUTPOST}]);
    expect(dirigibles.resourceCount).eq(0);
    const pick = cast(player.popWaitingFor(), SelectCard<ICard>);
    expect(pick.choiceContext?.source).deep.eq({kind: 'colony', name: ColonyName.TITAN, via: CardName.PRODUCTIVE_OUTPOST});
    pick.cb([dirigibles]);
    runAllActions(game);
    expect(dirigibles.resourceCount).eq(1);
  });

  it('the play preview carries the LEDGER behind its sums — the same reading the payout follows', () => {
    const card = new ProductiveOutpost();
    const [game, player] = testGame(2, {coloniesExtension: true});
    const luna = new Luna();
    const titan = new Titan();
    game.colonies = [titan, luna];
    luna.colonies.push(player.id, player.id);
    titan.colonies.push(player.id);
    player.playedCards.push(new Dirigibles());

    const branch = card.cardPlayPreview(player).branches[0];
    expect(branch.colonyBonuses).deep.eq(allColonyBonusesLedger(player, {via: CardName.PRODUCTIVE_OUTPOST}));
    expect(branch.colonyBonuses?.entries.map((e) => [e.colony, e.cubes, e.asks])).deep.eq([
      [ColonyName.LUNA, 2, undefined],
      [ColonyName.TITAN, 1, 'card'],
    ]);
    expect(branch.steps.filter((s) => s.kind === 'input'), 'Titan\'s target is collected before the confirm').has.length(1);
  });
});
