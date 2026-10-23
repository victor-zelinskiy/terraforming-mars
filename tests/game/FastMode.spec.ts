import {expect} from 'chai';
import {testGame} from '../TestGame';
import {fakeCard, forceGenerationEnd, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SellPatentsStandardProject} from '../../src/server/cards/base/standardProjects/SellPatentsStandardProject';
import {standardProjectUnavailableReasons} from '../../src/server/models/standardProjectReasons';
import {SELL_PATENTS_EXHAUSTED_REASON} from '../../src/common/game/fastMode';
import {Player} from '../../src/server/Player';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {SerializedPlayer} from '../../src/server/SerializedPlayer';
import {CardName} from '../../src/common/cards/CardName';
import {TestPlayer} from '../TestPlayer';

/**
 * FAST MODE (`gameOptions.fastModeOption`): upstream's «a turn cannot end after
 * one action» plus the fork's extension — the «Продажа патентов» standard
 * project is limited to ONE sale per generation per player
 * (`src/common/game/fastMode.ts`).
 */
describe('Fast mode', () => {
  function sellPatentsOption(player: TestPlayer): SelectCard<IProjectCard> | undefined {
    player.takeAction();
    const menu = cast(player.popWaitingFor(), OrOptions);
    // Structural, never the title: the sale is the ONE card pick carrying the `patentSale` marker.
    return menu.options.find((o): o is SelectCard<IProjectCard> => o instanceof SelectCard && o.toModel(player).patentSale !== undefined);
  }

  function sell(player: TestPlayer, cards: ReadonlyArray<IProjectCard>) {
    const option = sellPatentsOption(player);
    expect(option, 'the sale must be offered').is.not.undefined;
    option!.process({type: 'card', cards: cards.map((c) => c.name)});
    runAllActions(player.game);
  }

  it('withholds «End Turn» — a turn cannot end after one action', () => {
    const [/* game */, player] = testGame(2, {fastModeOption: true});
    player.actionsTakenThisRound = 1;
    player.takeAction();
    const menu = cast(player.popWaitingFor(), OrOptions);
    expect(menu.options.some((o) => o.title === 'End Turn'), 'no End Turn in fast mode').is.false;
    expect(menu.options.some((o) => o.title === 'Pass for this generation'), 'passing stays open').is.true;
  });

  it('offers «End Turn» after the first action when fast mode is off', () => {
    const [/* game */, player] = testGame(2, {fastModeOption: false});
    player.actionsTakenThisRound = 1;
    player.takeAction();
    const menu = cast(player.popWaitingFor(), OrOptions);
    expect(menu.options.some((o) => o.title === 'End Turn')).is.true;
  });

  it('limits the patent sale to ONE per generation per player, with a structured reason', () => {
    const [game, player, other] = testGame(2, {fastModeOption: true});
    const a = fakeCard({name: 'A' as CardName});
    const b = fakeCard({name: 'B' as CardName});
    player.cardsInHand = [a, b];
    other.cardsInHand = [fakeCard({name: 'C' as CardName})];
    const project = new SellPatentsStandardProject();
    expect(project.canAct(player)).is.true;

    sell(player, [a]);
    expect(player.megaCredits).eq(1);
    expect(player.patentSalesThisGeneration).eq(1);
    // A card is still in hand — only the generation's one sale is spent.
    expect(player.cardsInHand).deep.eq([b]);
    expect(project.canAct(player)).is.false;
    expect(sellPatentsOption(player), 'the server withholds the prompt').is.undefined;
    expect(standardProjectUnavailableReasons(player, project)[0]).deep.eq({type: 'rule', message: SELL_PATENTS_EXHAUSTED_REASON});

    // Per PLAYER: the rival's sale is untouched.
    expect(project.canAct(other)).is.true;
    expect(other.patentSalesThisGeneration).eq(0);

    // The cap resets with the generation.
    forceGenerationEnd(game);
    expect(player.patentSalesThisGeneration).eq(0);
    expect(project.canAct(player)).is.true;
  });

  it('counts sales, never cards — a one-card sale spends the generation like a big one', () => {
    const [/* game */, player] = testGame(2, {fastModeOption: true});
    const cards = [1, 2, 3].map((n) => fakeCard({name: `N${n}` as CardName}));
    player.cardsInHand = [...cards];
    sell(player, cards);
    expect(player.megaCredits).eq(3);
    expect(player.patentSalesThisGeneration).eq(1);
  });

  it('counts in every game but gates only in fast mode (the reason stays the empty hand)', () => {
    const [/* game */, player] = testGame(2, {fastModeOption: false});
    const a = fakeCard({name: 'A' as CardName});
    const b = fakeCard({name: 'B' as CardName});
    player.cardsInHand = [a, b];
    const project = new SellPatentsStandardProject();
    sell(player, [a]);
    expect(player.patentSalesThisGeneration).eq(1);
    expect(project.canAct(player), 'no cap without fast mode').is.true;
    player.cardsInHand = [];
    expect(standardProjectUnavailableReasons(player, project)[0].message).eq('No cards in hand');
  });

  it('serializes the sale count and degrades an older save to zero', () => {
    const [/* game */, player] = testGame(2, {fastModeOption: true});
    player.patentSalesThisGeneration = 1;
    const json = player.serialize();
    expect(json.patentSalesThisGeneration).eq(1);
    expect(Player.deserialize(json).patentSalesThisGeneration).eq(1);

    const legacy: SerializedPlayer = {...json};
    delete legacy.patentSalesThisGeneration;
    expect(Player.deserialize(legacy).patentSalesThisGeneration).eq(0);
  });
});
