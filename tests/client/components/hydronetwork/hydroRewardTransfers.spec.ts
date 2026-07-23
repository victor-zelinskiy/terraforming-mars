import {expect} from 'chai';
import {hydroRewardTransfers} from '../../../../src/client/console/hydroMarker/hydroRewardTransfers';
import {buildRewardView, HydroPlayerSnapshot} from '../../../../src/client/components/hydronetwork/hydroReward';
import {HYDRO_STAGES} from '../../../../src/client/components/hydronetwork/hydroStages';

function snapshot(overrides: Partial<HydroPlayerSnapshot> = {}): HydroPlayerSnapshot {
  return {
    steel: 6, plants: 4, titanium: 1, energy: 2, heat: 1, megacredits: 10,
    prod: {megacredits: 5, steel: 1, titanium: 0, plants: 1, energy: 2, heat: 1},
    plantTags: 3, jovianTags: 1,
    ...overrides,
  };
}
const stage = (pos: number) => HYDRO_STAGES[pos];

describe('hydroRewardTransfers', () => {
  it('pos 3: +2 M€ production → one production spec', () => {
    const specs = hydroRewardTransfers(buildRewardView({stage: stage(3), snapshot: snapshot(), rewardChoice: undefined}));
    expect(specs).deep.eq([{channel: 'production', resource: 'megacredits', amount: 2}]);
  });

  it('pos 4: +1 titanium production → one production spec', () => {
    const specs = hydroRewardTransfers(buildRewardView({stage: stage(4), snapshot: snapshot(), rewardChoice: undefined}));
    expect(specs).deep.eq([{channel: 'production', resource: 'titanium', amount: 1}]);
  });

  it('pos 1: the CHOSEN alternative becomes a stock spec (steel vs plants)', () => {
    const steel = hydroRewardTransfers(buildRewardView({stage: stage(1), snapshot: snapshot(), rewardChoice: 0}));
    expect(steel).deep.eq([{channel: 'stock', resource: 'steel', amount: 2}]);
    const plants = hydroRewardTransfers(buildRewardView({stage: stage(1), snapshot: snapshot(), rewardChoice: 1}));
    expect(plants).deep.eq([{channel: 'stock', resource: 'plants', amount: 2}]);
  });

  it('pos 1: an UNMADE choice grants nothing yet — no specs', () => {
    expect(hydroRewardTransfers(buildRewardView({stage: stage(1), snapshot: snapshot(), rewardChoice: undefined}))).deep.eq([]);
  });

  it('pos 6: plants stock = plant-tag count (the computed amount)', () => {
    const specs = hydroRewardTransfers(buildRewardView({stage: stage(6), snapshot: snapshot({plants: 4, plantTags: 3}), rewardChoice: undefined}));
    expect(specs).deep.eq([{channel: 'stock', resource: 'plants', amount: 3}]);
  });

  it('pos 6: no plant tags → delta 0 → no flying chip', () => {
    expect(hydroRewardTransfers(buildRewardView({stage: stage(6), snapshot: snapshot({plantTags: 0}), rewardChoice: undefined}))).deep.eq([]);
  });

  it('pos 8: a Jovian TAG has no panel metric → no spec', () => {
    expect(hydroRewardTransfers(buildRewardView({stage: stage(8), snapshot: snapshot(), rewardChoice: undefined}))).deep.eq([]);
  });

  it('pos 9: 2 animals land on the pre-selected host card', () => {
    const specs = hydroRewardTransfers(buildRewardView({
      stage: stage(9), snapshot: snapshot(), rewardChoice: undefined,
      animalTargetCurrent: 1, animalTargetCardName: 'Fish',
    }));
    expect(specs).deep.eq([{channel: 'card-resource', resource: 'animal', amount: 2, targetCard: 'Fish'}]);
  });

  it('pos 9: no chosen card → nowhere to land → no spec', () => {
    const specs = hydroRewardTransfers(buildRewardView({
      stage: stage(9), snapshot: snapshot(), rewardChoice: undefined,
      animalTargetCurrent: 1, // current known but the card name absent
    }));
    expect(specs).deep.eq([]);
  });

  it('pos 5 (draw) / 10 / 11 (VP): no flown resources', () => {
    expect(hydroRewardTransfers(buildRewardView({stage: stage(5), snapshot: snapshot(), rewardChoice: undefined}))).deep.eq([]);
    expect(hydroRewardTransfers(buildRewardView({stage: stage(10), snapshot: snapshot(), rewardChoice: undefined}))).deep.eq([]);
    expect(hydroRewardTransfers(buildRewardView({stage: stage(11), snapshot: snapshot(), rewardChoice: undefined}))).deep.eq([]);
  });

  it('no stage → no specs', () => {
    expect(hydroRewardTransfers(buildRewardView({stage: undefined, snapshot: snapshot(), rewardChoice: undefined}))).deep.eq([]);
  });
});
