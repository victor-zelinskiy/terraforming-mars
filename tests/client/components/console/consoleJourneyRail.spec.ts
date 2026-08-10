import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleJourneyRail from '@/client/components/console/foundation/ConsoleJourneyRail.vue';

const selection = {
  id: 'selection',
  ordinal: '01',
  label: 'Selection',
  state: 'current',
  mode: 'tabs',
  items: [
    {id: 'corp', label: 'Corporation', state: 'completed'},
    {id: 'prelude', label: 'Preludes', state: 'current'},
    {id: 'projects', label: 'Projects', state: 'available'},
    {id: 'summary', label: 'Summary', state: 'locked'},
  ],
} as const;

const deployment = {
  id: 'deployment',
  ordinal: '02',
  label: 'Playing',
  state: 'locked',
  mode: 'progress',
  items: [
    {id: 'corp', label: 'Corporation', state: 'locked'},
    {id: 'pay', label: 'Projects', state: 'locked'},
    {id: 'preludes', label: 'Preludes', state: 'locked'},
    {id: 'ready', label: 'Ready', state: 'locked'},
  ],
} as const;

function rail(presentation: 'expanded' | 'compact' | 'complete' = 'expanded') {
  return mount(ConsoleJourneyRail as any, {
    ...globalConfig,
    props: {
      phases: [selection, deployment],
      presentation,
      compactContext: {ordinal: '02', phaseLabel: 'Playing', itemLabel: 'Preludes'},
    },
  });
}

describe('ConsoleJourneyRail — one persistent workspace flow object', () => {
  it('keeps expanded, compact and terminal presentations mounted together', async () => {
    const wrapper = rail();
    const root = wrapper.element;
    expect(wrapper.findAll('.con-jrail__view')).to.have.lengthOf(3);
    expect(wrapper.findAll('.con-jrail__phase')).to.have.lengthOf(2);

    await wrapper.setProps({presentation: 'compact'});
    expect(wrapper.element).to.equal(root);
    expect(wrapper.find('.con-jrail').attributes('data-presentation')).to.eq('compact');
    expect(wrapper.find('.con-jrail__view--compact').text()).to.contain('02');
    expect(wrapper.find('.con-jrail__view--compact').text()).to.contain('Playing');
    expect(wrapper.find('.con-jrail__view--compact').text()).to.contain('Preludes');

    await wrapper.setProps({presentation: 'complete'});
    expect(wrapper.element).to.equal(root);
    expect(wrapper.find('.con-jrail__view--terminal').text()).to.contain('Ready');
  });

  it('keeps irreversible progress inert and never introduces focus targets', () => {
    const wrapper = rail();
    const deploymentPhase = wrapper.find('[data-phase="deployment"]');
    expect(deploymentPhase.findAll('[role="listitem"]')).to.have.lengthOf(4);
    expect(wrapper.findAll('button')).to.have.lengthOf(0);
    expect(wrapper.findAll('[tabindex]')).to.have.lengthOf(0);
  });

  it('expands only the current chapter while future chapter details stay in the same hidden body', () => {
    const wrapper = rail();
    const current = wrapper.find('[data-phase="selection"]');
    const future = wrapper.find('[data-phase="deployment"]');
    expect(current.classes()).to.contain('con-jrail__phase--open');
    expect(current.find('.con-jrail__phase-body').attributes('aria-hidden')).to.eq(undefined);
    expect(future.classes()).to.not.contain('con-jrail__phase--open');
    expect(future.find('.con-jrail__phase-body').attributes('aria-hidden')).to.eq('true');
    expect(future.find('.con-jrail__phase-head').text()).to.contain('02');
    expect(future.find('.con-jrail__phase-head').text()).to.contain('Playing');
    expect(wrapper.find('.con-jrail__phase-preview').exists()).to.eq(false);
  });

  it('exchanges the open chapter without remounting either phase', async () => {
    const wrapper = rail();
    const selectionNode = wrapper.find('[data-phase="selection"]').element;
    const deploymentNode = wrapper.find('[data-phase="deployment"]').element;
    await wrapper.setProps({
      phases: [
        {...selection, state: 'completed'},
        {...deployment, state: 'current', items: deployment.items.map((item, i) => ({
          ...item,
          state: i === 0 ? 'current' : 'locked',
        }))},
      ],
    });
    expect(wrapper.find('[data-phase="selection"]').element).to.equal(selectionNode);
    expect(wrapper.find('[data-phase="deployment"]').element).to.equal(deploymentNode);
    expect(wrapper.find('[data-phase="selection"]').classes()).to.contain('con-jrail__phase--completed');
    expect(wrapper.find('[data-phase="deployment"]').classes()).to.contain('con-jrail__phase--open');
  });

  it('leaves labels and the active item stable during directional anticipation', () => {
    const wrapper = mount(ConsoleJourneyRail as any, {
      ...globalConfig,
      props: {
        phases: [selection, deployment],
        compactContext: {ordinal: '01', phaseLabel: 'Selection', itemLabel: 'Preludes'},
        pendingItemId: 'projects',
        pulseKey: 1,
        pulseDir: 1,
      },
    });
    expect(wrapper.find('.con-jrail__item--current').text()).to.contain('Preludes');
    expect(wrapper.find('.con-jrail__item--anticipate').text()).to.contain('Projects');
  });
});
