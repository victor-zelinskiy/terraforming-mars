import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import ModernAmountSelector from '@/client/components/modalInputs/ModernAmountSelector.vue';
import ModernResourcePicker from '@/client/components/modalInputs/ModernResourcePicker.vue';
import ModernResourcesPicker from '@/client/components/modalInputs/ModernResourcesPicker.vue';
import ModernProductionToLose from '@/client/components/modalInputs/ModernProductionToLose.vue';
import ModernConfirm from '@/client/components/modalInputs/ModernConfirm.vue';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Units} from '@/common/Units';

function mountInput(component: any, playerinput: any, onsave: (out: InputResponse) => void) {
  return mount(component, {...globalConfig, props: {playerView: {}, playerinput, onsave}});
}

// Mount in CONTROLLED mode (hosted inside an action/play confirm modal): the
// inner confirm is hidden and the value is emitted live via `@change`.
function mountControlled(component: any, playerinput: any, playerView: any = {}) {
  return mount(component, {...globalConfig, props: {playerView, playerinput, onsave: () => {}, controlled: true}});
}

function lastChange(c: any): InputResponse | undefined {
  const events = c.emitted('change');
  return events === undefined ? undefined : events[events.length - 1][0];
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

  // CONTROLLED mode — embedded inside an action/play confirm modal. The inner
  // confirm button must DISAPPEAR (the modal's own confirm commits) and the value
  // must be emitted live via `@change` so the modal captures it immediately.
  describe('controlled mode (embedded in a confirm modal)', () => {
    it('ModernAmountSelector: hides the inner confirm and emits the amount on mount + every step', async () => {
      const c = mountControlled(ModernAmountSelector,
        {type: 'amount', title: 't', buttonLabel: '', min: 1, max: 3, maxByDefault: false});
      // No inner OK button — the modal owns the confirm.
      expect(c.find('[data-test="modern-amount-confirm"]').exists()).to.be.false;
      // Seeded with the default (min) on mount, so the modal can confirm without
      // the player touching the stepper.
      expect(lastChange(c)).to.deep.eq({type: 'amount', amount: 1});
      await c.find('[data-test="modern-amount-inc"]').trigger('click');
      expect(lastChange(c)).to.deep.eq({type: 'amount', amount: 2});
    });

    it('ModernConfirm: hides the inner confirm and seeds the option on mount', () => {
      const c = mountControlled(ModernConfirm, {type: 'option', title: 't', buttonLabel: ''});
      expect(c.find('[data-test="modern-confirm"]').exists()).to.be.false;
      expect(lastChange(c)).to.deep.eq({type: 'option'});
    });

    it('ModernResourcePicker: hides the inner confirm; emits undefined until a pick, then the resource', async () => {
      const c = mountControlled(ModernResourcePicker,
        {type: 'resource', title: 't', buttonLabel: '', include: ['steel', 'titanium']});
      expect(c.find('[data-test="modern-resource-confirm"]').exists()).to.be.false;
      await c.find('[data-test="modern-resource-steel"]').trigger('click');
      expect(lastChange(c)).to.deep.eq({type: 'resource', resource: 'steel'});
    });

    it('ModernResourcesPicker: emits undefined until exactly count is allocated, then the distribution', async () => {
      const c = mountControlled(ModernResourcesPicker,
        {type: 'resources', title: 't', buttonLabel: '', count: 2});
      expect(c.find('[data-test="modern-resources-confirm"]').exists()).to.be.false;
      await c.find('[data-test="modern-resources-inc-megacredits"]').trigger('click');
      expect(lastChange(c)).to.eq(undefined); // 1 / 2 — incomplete
      await c.find('[data-test="modern-resources-inc-titanium"]').trigger('click');
      expect(lastChange(c)).to.deep.eq({type: 'resources', units: {...Units.EMPTY, megacredits: 1, titanium: 1}});
    });
  });

  // Premium indicators — the player sees the practical change live.
  describe('ModernAmountSelector indicators', () => {
    it('renders a spend → result composition that scales with the amount (amountResult hint)', async () => {
      const c = mount(ModernAmountSelector, {
        ...globalConfig,
        props: {
          playerView: {thisPlayer: {energy: 10}},
          controlled: true,
          onsave: () => {},
          playerinput: {
            type: 'amount', title: 't', buttonLabel: '', min: 1, max: 5, maxByDefault: false,
            icon: 'energy', amountResult: {icon: 'cards', perUnit: 1, label: 'Cards drawn'},
          },
        },
      });
      const result = c.find('[data-test="modern-amount-result"]');
      expect(result.exists()).to.be.true;
      // Default amount = min = 1: spend −1 energy (10 → 9), draw +1 card.
      expect(result.text()).to.contain('−1');
      expect(result.text()).to.contain('+1');
      expect(result.text()).to.contain('10');
      expect(result.text()).to.contain('9');
      await c.find('[data-test="modern-amount-inc"]').trigger('click');
      await c.find('[data-test="modern-amount-inc"]').trigger('click');
      // Amount = 3: spend −3 (10 → 7), draw +3.
      expect(result.text()).to.contain('−3');
      expect(result.text()).to.contain('+3');
      expect(result.text()).to.contain('7');
    });

    it('shows a stock availability line for a bare resource amount (no result hint)', () => {
      const c = mount(ModernAmountSelector, {
        ...globalConfig,
        props: {
          playerView: {thisPlayer: {heat: 8}},
          onsave: () => {},
          playerinput: {type: 'amount', title: 't', buttonLabel: '', min: 1, max: 8, maxByDefault: false, icon: 'heat'},
        },
      });
      const avail = c.find('[data-test="modern-amount-avail"]');
      expect(avail.exists()).to.be.true;
      expect(avail.text()).to.contain('8');
    });
  });
});
