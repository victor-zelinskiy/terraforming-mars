import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ModernProductionToLose from '@/client/components/modalInputs/ModernProductionToLose.vue';
import {SelectProductionToLoseModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';

function model(cost: number, prod: Partial<Units>): SelectProductionToLoseModel {
  return {
    title: `Choose ${cost} unit(s) of production to lose`,
    buttonLabel: 'Save',
    type: 'productionToLose',
    payProduction: {cost, units: {...Units.EMPTY, ...prod}},
  };
}

function mountWith(playerinput: SelectProductionToLoseModel, onsave: (out: unknown) => void = () => {}) {
  return mount(ModernProductionToLose, {
    ...globalConfig,
    props: {playerView: {} as PlayerViewModel, playerinput, onsave, controlled: false},
  });
}

describe('ModernProductionToLose', () => {
  it('cost === 1 with several options: SINGLE-PICK tiles, no steppers', async () => {
    let saved: any;
    const w = mountWith(model(1, {megacredits: 5, steel: 2}), (o) => {
      saved = o;
    });
    // No steppers in single-pick mode.
    expect(w.find('[data-test="modern-ptl-inc-steel"]').exists()).to.be.false;
    // Selectable tiles instead.
    expect(w.find('[data-test="modern-ptl-pick-steel"]').exists()).to.be.true;
    expect(w.find('[data-test="modern-ptl-pick-megacredits"]').exists()).to.be.true;

    await w.find('[data-test="modern-ptl-pick-steel"]').trigger('click');
    await w.find('[data-test="modern-ptl-confirm"]').trigger('click');
    expect(saved).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, steel: 1}});
  });

  it('cost === 1 with a single option: pre-selected, confirm ready immediately', async () => {
    let saved: any;
    const w = mountWith(model(1, {megacredits: -5, steel: 1}), (o) => {
      saved = o;
    });
    // megacredits is at the −5 floor → not deductible; only steel.
    expect(w.find('[data-test="modern-ptl-pick-megacredits"]').exists()).to.be.false;
    await w.vm.$nextTick(); // flush the mounted() pre-select
    const confirm = w.find('[data-test="modern-ptl-confirm"]');
    expect((confirm.element as HTMLButtonElement).disabled).to.be.false; // pre-selected
    await confirm.trigger('click');
    expect(saved).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, steel: 1}});
  });

  it('cost > 1: keeps the per-resource steppers + the "N of M" counter', async () => {
    let saved: any;
    const w = mountWith(model(2, {steel: 3, plants: 2}), (o) => {
      saved = o;
    });
    expect(w.find('[data-test="modern-ptl-pick-steel"]').exists()).to.be.false; // not single-pick
    expect(w.find('[data-test="modern-ptl-inc-steel"]').exists()).to.be.true;
    await w.find('[data-test="modern-ptl-inc-steel"]').trigger('click');
    await w.find('[data-test="modern-ptl-inc-steel"]').trigger('click');
    await w.find('[data-test="modern-ptl-confirm"]').trigger('click');
    expect(saved).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, steel: 2}});
  });

  it('builds a clean diegetic title from cost (bypasses the baked server title)', () => {
    expect((mountWith(model(1, {steel: 1})).vm as any).titleText).to.eq('Reduce a production');
    expect((mountWith(model(3, {steel: 3})).vm as any).titleText).to.eq('Reduce production by 3');
  });
});
