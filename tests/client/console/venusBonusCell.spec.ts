import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {
  armVenusBonusCell, resetVenusBonusCell, seedVenusBonusCellHold, venusBonusAnswerApplied, venusBonusCellPlan, venusBonusCells, venusBonusCellState,
} from '@/client/console/scaleStepReward/venusBonusCellBeat';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resetPresentationLedger} from '@/client/console/presentationLedger';
import {resetBoardBeatPark} from '@/client/console/boardBeatPark';

/*
 * «БОНУС ВЕНЕРЫ ПРИХОДИТ С ЯЧЕЙКИ» (P89 · ledger EE, PL-1436): the chosen resource is born on the bonus cell the step
 * reached and lands on its row — the pure plan, and the seed: the rows are held only on the response that ANSWERED the
 * bonus, only for what the surface sent and the views prove.
 */
function view(stock: {steel?: number, plants?: number, megacredits?: number}, asking: boolean): PlayerViewModel {
  return {
    id: 'p-blue',
    game: {phase: 'action', venusScaleLevel: 18},
    thisPlayer: {color: 'blue', megacredits: stock.megacredits ?? 10, steel: stock.steel ?? 0, titanium: 0, plants: stock.plants ?? 0,
      energy: 0, heat: 0, tableau: []},
    players: [],
    waitingFor: asking ? {type: 'and', venusBonusPrompt: {kind: 'standard', baseCount: 1, step: {from: 16, to: 18}}} : undefined,
  } as unknown as PlayerViewModel;
}

describe('venusBonusCellBeat — the bonus is born on its cell', () => {
  afterEach(() => {
    resetVenusBonusCell();
    clearPanelRewardHold();
    resetPresentationLedger();
    resetBoardBeatPark();
  });

  it('the cells a raise reached, in the scale’s order; the 30 % finish is the gold cube', () => {
    expect(venusBonusCells({from: 16, to: 18})).deep.eq(['venus-18']);
    expect(venusBonusCells({from: 14, to: 18})).deep.eq(['venus-18']);
    expect(venusBonusCells({from: 16, to: 22})).deep.eq(['venus-18', 'venus-20', 'venus-22']);
    expect(venusBonusCells({from: 28, to: 30})).deep.eq(['venus-30']);
    expect(venusBonusCells(undefined)).deep.eq([]);
    // Amazonis Planitia's 33 % track: the same seven cells, starting later (24 … 33).
    expect(venusBonusCells({from: 20, to: 26}, 33)).deep.eq(['venus-24', 'venus-26']);
    expect(venusBonusCells({from: 30, to: 33}, 33)).deep.eq(['venus-31', 'venus-32', 'venus-33']);
  });

  it('one token per unit, in the rail’s order, each on its cell (more tokens than cells ride the last); the card last', () => {
    const plan = venusBonusCellPlan({
      units: {plants: 1, steel: 1}, card: {name: CardName.DIRIGIBLES, resource: 'floater'}, step: {from: 26, to: 30},
    });
    expect(plan.map((p) => [p.spec.resource, p.cell])).deep.eq([['steel', 'venus-28'], ['plants', 'venus-30'], ['floater', 'venus-30']]);
    expect(plan[2].spec).deep.include({channel: 'card-resource', targetCard: CardName.DIRIGIBLES});
  });

  it('seeds on the ANSWER only: the arm’s rows are held when the views prove them; nothing without an arm', () => {
    seedVenusBonusCellHold(view({}, true), view({steel: 1}, false));
    expect(heldStock('steel'), 'no arm — nothing held').eq(0);
    armVenusBonusCell({units: {steel: 1}, step: {from: 16, to: 18}});
    seedVenusBonusCellHold(view({}, true), view({steel: 1}, true));
    expect(heldStock('steel'), 'the bonus is still asked — not the answer').eq(0);
    seedVenusBonusCellHold(view({}, true), view({steel: 1}, false));
    expect(heldStock('steel'), 'the answer: the row waits for its token').eq(1);
    expect(venusBonusCellState.phase).not.eq('idle');
  });

  it('a promise the views did not keep is not held (the row ticks, the beat names its degrade)', () => {
    armVenusBonusCell({units: {plants: 1}, step: {from: 16, to: 18}});
    seedVenusBonusCellHold(view({}, true), view({steel: 1}, false));
    expect(heldStock('plants')).eq(0);
    expect(venusBonusCellState.degraded).is.true;
  });

  it('a PRE-SELECTED answer (P89 · EL) is applied by the response in which Venus REACHED the cell — no bonus prompt ever stood', () => {
    const arm = {units: {steel: 1}, step: {from: 16, to: 18}, preselected: true as const};
    const at = (level: number, asking = false) => ({...view({}, asking), game: {phase: 'action', venusScaleLevel: level}} as unknown as PlayerViewModel);
    expect(venusBonusAnswerApplied(arm, at(16), at(18)), 'the commit\'s response: the step and the answer together').is.true;
    expect(venusBonusAnswerApplied(arm, at(16), at(16)), 'a view ahead of the answer (the price only)').is.false;
    expect(venusBonusAnswerApplied(arm, at(16), at(18, true)), 'refused — the bonus asked live (the surface re-arms)').is.false;
    expect(venusBonusAnswerApplied(arm, at(18), at(18)), 'already past the cell — not this response').is.false;
    const live = {units: {steel: 1}, step: {from: 16, to: 18}};
    expect(venusBonusAnswerApplied(live, at(18, true), at(18)), 'the live surface\'s answer: asked before, not after').is.true;
    expect(venusBonusAnswerApplied(live, at(16), at(18)), 'a live arm never guesses from the scale').is.false;
  });
});
