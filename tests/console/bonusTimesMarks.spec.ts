import {expect} from 'chai';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceId} from '@/common/Types';
import {
  bonusTimesAt, bonusTimesMarks, placementRenderState, setPlacementBonusTimes,
} from '@/client/components/board/placementRenderState';

/**
 * THE CELL'S REWARD, ON THE CELL (P74 Frontier Town): a MULTIPLIED placement marks «×N» on every legal candidate that
 * prints a bonus. N is the SERVER's whole count (`SelectSpaceModel.printedBonusTimes`) — the client never multiplies.
 */
describe('bonusTimesMarks — the board\'s «×N» on a multiplied placement\'s candidates', () => {
  const bonuses: Record<string, ReadonlyArray<SpaceBonus>> = {
    '10': [SpaceBonus.PLANT, SpaceBonus.PLANT],
    '11': [],
    '12': [SpaceBonus._RESTRICTED],
    '13': [SpaceBonus.STEEL],
  };
  const bonusOf = (id: SpaceId) => bonuses[id];
  const legal = ['10', '11', '12', '13'] as Array<SpaceId>;

  afterEach(() => setPlacementBonusTimes(undefined));

  it('marks only the legal cells that print a bonus, with the server\'s number as it is', () => {
    const marks = bonusTimesMarks(6, legal, bonusOf);
    expect(marks?.times).eq(6);
    expect([...marks!.spaces].sort()).deep.eq(['10', '13']);
  });

  it('an ordinary placement (no count, or 1) marks nothing; a legal set with no printed bonus marks nothing', () => {
    expect(bonusTimesMarks(undefined, legal, bonusOf)).is.undefined;
    expect(bonusTimesMarks(1, legal, bonusOf)).is.undefined;
    expect(bonusTimesMarks(3, ['11', '12'] as Array<SpaceId>, bonusOf)).is.undefined;
  });

  it('the one write and its reader: set with the grid, cleared with it; an equal write changes nothing', () => {
    setPlacementBonusTimes(bonusTimesMarks(3, legal, bonusOf));
    expect(bonusTimesAt('10' as SpaceId)).eq(3);
    expect(bonusTimesAt('11' as SpaceId)).is.undefined;
    const before = placementRenderState.bonusTimes;
    setPlacementBonusTimes(bonusTimesMarks(3, legal, bonusOf));
    expect(placementRenderState.bonusTimes, 'the same marks keep their identity (no re-render)').eq(before);
    setPlacementBonusTimes(undefined);
    expect(bonusTimesAt('10' as SpaceId)).is.undefined;
  });
});
