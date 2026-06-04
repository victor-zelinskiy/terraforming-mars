import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import ModernAmountSelector from '@/client/components/modalInputs/ModernAmountSelector.vue';
import ModernResourcePicker from '@/client/components/modalInputs/ModernResourcePicker.vue';
import ModernResourcesPicker from '@/client/components/modalInputs/ModernResourcesPicker.vue';
import ModernProductionToLose from '@/client/components/modalInputs/ModernProductionToLose.vue';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Units} from '@/common/Units';

function mountInput(component: any, playerinput: any, onsave: (out: InputResponse) => void) {
  return mount(component, {...globalConfig, props: {playerView: {}, playerinput, onsave}});
}

describe('Modern modal inputs', () => {
  describe('ModernAmountSelector', () => {
    it('starts at min, steps within range, and submits the amount', async () => {
      let saved: InputResponse | undefined;
      const c = mountInput(ModernAmountSelector,
        {type: 'amount', title: 't', buttonLabel: '', min: 1, max: 3, maxByDefault: false},
        (out) => {
          saved = out;
        });
      expect(c.find('[data-test="modern-amount-value"]').text()).to.eq('1');
      await c.find('[data-test="modern-amount-inc"]').trigger('click');
      expect(c.find('[data-test="modern-amount-value"]').text()).to.eq('2');
      await c.find('[data-test="modern-amount-confirm"]').trigger('click');
      expect(saved).to.deep.eq({type: 'amount', amount: 2});
    });

    it('honours maxByDefault', () => {
      const c = mountInput(ModernAmountSelector,
        {type: 'amount', title: 't', buttonLabel: '', min: 1, max: 7, maxByDefault: true},
        () => {});
      expect(c.find('[data-test="modern-amount-value"]').text()).to.eq('7');
    });
  });

  describe('ModernResourcePicker', () => {
    it('requires a selection then submits the chosen resource', async () => {
      let saved: InputResponse | undefined;
      const c = mountInput(ModernResourcePicker,
        {type: 'resource', title: 't', buttonLabel: '', include: ['steel', 'titanium']},
        (out) => {
          saved = out;
        });
      const confirm = c.find('[data-test="modern-resource-confirm"]');
      expect(confirm.attributes('disabled')).to.not.eq(undefined);
      await c.find('[data-test="modern-resource-steel"]').trigger('click');
      await confirm.trigger('click');
      expect(saved).to.deep.eq({type: 'resource', resource: 'steel'});
    });
  });

  describe('ModernResourcesPicker', () => {
    it('locks confirm until exactly count units are allocated', async () => {
      let saved: InputResponse | undefined;
      const c = mountInput(ModernResourcesPicker,
        {type: 'resources', title: 't', buttonLabel: '', count: 2},
        (out) => {
          saved = out;
        });
      const confirm = c.find('[data-test="modern-resources-confirm"]');
      expect(confirm.attributes('disabled')).to.not.eq(undefined);
      await c.find('[data-test="modern-resources-inc-megacredits"]').trigger('click');
      await c.find('[data-test="modern-resources-inc-titanium"]').trigger('click');
      expect(confirm.attributes('disabled')).to.eq(undefined);
      await confirm.trigger('click');
      expect(saved).to.deep.eq({type: 'resources', units: {...Units.EMPTY, megacredits: 1, titanium: 1}});
    });
  });

  describe('ModernProductionToLose', () => {
    it('shows only deductible resources and submits when total equals cost', async () => {
      let saved: InputResponse | undefined;
      const c = mountInput(ModernProductionToLose,
        {
          type: 'productionToLose',
          title: 't',
          buttonLabel: '',
          payProduction: {cost: 1, units: {megacredits: 0, steel: 2, titanium: 0, plants: 0, energy: 0, heat: 0}},
        },
        (out) => {
          saved = out;
        });
      // megacredits (floor -5 → maxFor 5) and steel (2) are deductible; the
      // zero-production resources are hidden.
      expect(c.find('[data-test="modern-ptl-inc-steel"]').exists()).to.be.true;
      expect(c.find('[data-test="modern-ptl-inc-plants"]').exists()).to.be.false;
      const confirm = c.find('[data-test="modern-ptl-confirm"]');
      expect(confirm.attributes('disabled')).to.not.eq(undefined);
      await c.find('[data-test="modern-ptl-inc-steel"]').trigger('click');
      await confirm.trigger('click');
      expect(saved).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, steel: 1}});
    });
  });
});
