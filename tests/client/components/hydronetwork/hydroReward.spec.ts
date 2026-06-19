import {expect} from 'chai';
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

describe('buildRewardView', () => {
  it('pos 3: +2 M€ production as current → new', () => {
    const v = buildRewardView({stage: stage(3), snapshot: snapshot(), rewardChoice: undefined});
    expect(v.lines.length).eq(1);
    expect(v.lines[0]).deep.include({production: true, labelKey: 'M€ production', before: 5, after: 7, delta: 2});
  });

  it('pos 4: +1 titanium production', () => {
    const v = buildRewardView({stage: stage(4), snapshot: snapshot(), rewardChoice: undefined});
    expect(v.lines[0]).deep.include({production: true, before: 0, after: 1, delta: 1});
  });

  it('pos 6: plants = current + plant-tag count (the computed amount)', () => {
    const v = buildRewardView({stage: stage(6), snapshot: snapshot({plants: 4, plantTags: 3}), rewardChoice: undefined});
    expect(v.lines[0]).deep.include({labelKey: 'Plants', before: 4, after: 7, delta: 3, noteKey: 'Plant tags', noteValue: 3});
  });

  it('pos 8: +1 Jovian tag', () => {
    const v = buildRewardView({stage: stage(8), snapshot: snapshot({jovianTags: 1}), rewardChoice: undefined});
    expect(v.lines[0]).deep.include({special: 'jovian-tag', labelKey: 'Jovian tags', before: 1, after: 2, delta: 1});
  });

  it('pos 1: a choice must be made before a delta shows', () => {
    expect(buildRewardView({stage: stage(1), snapshot: snapshot(), rewardChoice: undefined}).needsChoiceFirst).eq(true);
    const steel = buildRewardView({stage: stage(1), snapshot: snapshot({steel: 6}), rewardChoice: 0});
    expect(steel.lines[0]).deep.include({labelKey: 'Steel', before: 6, after: 8, delta: 2});
    const plants = buildRewardView({stage: stage(1), snapshot: snapshot({plants: 4}), rewardChoice: 1});
    expect(plants.lines[0]).deep.include({labelKey: 'Plants', before: 4, after: 6, delta: 2});
  });

  it('pos 2: energy vs heat production by chosen option', () => {
    expect(buildRewardView({stage: stage(2), snapshot: snapshot(), rewardChoice: 0}).lines[0]).deep.include({production: true, before: 2, after: 3});
    expect(buildRewardView({stage: stage(2), snapshot: snapshot(), rewardChoice: 1}).lines[0]).deep.include({production: true, before: 1, after: 2});
  });

  it('pos 9: animals delta only once a target card is picked', () => {
    const before = buildRewardView({stage: stage(9), snapshot: snapshot(), rewardChoice: undefined});
    expect(before.lines.length).eq(0);
    expect(before.rawChips.length).eq(1);
    const after = buildRewardView({stage: stage(9), snapshot: snapshot(), rewardChoice: undefined, animalTargetCurrent: 1, animalTargetCardName: 'Birds'});
    expect(after.lines[0]).deep.include({special: 'animals', labelKey: 'Animals on card', before: 1, after: 3, delta: 2, cardName: 'Birds'});
  });

  it('pos 5 / 7: a flow-resolved reward shows a chip + follow-up hint, no delta', () => {
    const draw = buildRewardView({stage: stage(5), snapshot: snapshot(), rewardChoice: undefined});
    expect(draw.lines.length).eq(0);
    expect(draw.followUpKey).is.not.undefined;
    const reuse = buildRewardView({stage: stage(7), snapshot: snapshot(), rewardChoice: undefined});
    expect(reuse.followUpKey).is.not.undefined;
  });

  it('pos 10 / 11: VP finish', () => {
    expect(buildRewardView({stage: stage(10), snapshot: snapshot(), rewardChoice: undefined}).vp).eq(2);
    expect(buildRewardView({stage: stage(11), snapshot: snapshot(), rewardChoice: undefined}).vp).eq(5);
  });
});
