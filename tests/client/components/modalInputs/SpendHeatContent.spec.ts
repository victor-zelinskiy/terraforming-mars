import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import SpendHeatContent from '@/client/components/modalInputs/SpendHeatContent.vue';
import {AndOptionsModel} from '@/common/models/PlayerInputModel';

// target=8 heat, the player has 6 stock heat and 10 floaters available.
function model(opts: {target?: number, maxHeat?: number, maxFloaters?: number} = {}): AndOptionsModel {
  const target = opts.target ?? 8;
  return {
    type: 'and',
    title: 'Select how to spend 8 heat',
    buttonLabel: 'Confirm',
    spendHeatPrompt: {amount: target},
    options: [
      {type: 'amount', title: 'Heat', buttonLabel: 'Spend heat', min: 0, max: opts.maxHeat ?? 6, maxByDefault: false},
      {type: 'amount', title: 'Floaters', buttonLabel: 'Spend floaters', min: 0, max: opts.maxFloaters ?? 10, maxByDefault: false},
    ],
  } as AndOptionsModel;
}

describe('SpendHeatContent', () => {
  const playerView = {thisPlayer: {}} as any;

  it('defaults to the fewest floaters (stock heat first) and is immediately valid', () => {
    let saved: any;
    const wrapper = mount(SpendHeatContent, {
      ...globalConfig,
      props: {playerView, playerinput: model(), onsave: (r: any) => {
        saved = r;
      }},
    });
    // target 8, maxHeat 6 → minFloaters = ceil((8-6)/2) = 1.
    expect(wrapper.find('[data-test=spend-heat-floaters-value]').text()).to.eq('1');
    expect((wrapper.find('[data-test=spend-heat-confirm]').element as HTMLButtonElement).disabled).to.be.false;

    wrapper.find('[data-test=spend-heat-confirm]').trigger('click');
    // Order matches the AndOptions: option 0 = heat (6), option 1 = floaters (1).
    expect(saved).to.deep.eq({type: 'and', responses: [{type: 'amount', amount: 6}, {type: 'amount', amount: 1}]});
  });

  it('raising floaters lowers the auto stock heat, staying valid (no overspend)', async () => {
    let saved: any;
    const wrapper = mount(SpendHeatContent, {
      ...globalConfig,
      props: {playerView, playerinput: model(), onsave: (r: any) => {
        saved = r;
      }},
    });
    await wrapper.find('[data-test=spend-heat-floaters-inc]').trigger('click'); // 1 → 2 floaters
    expect(wrapper.find('[data-test=spend-heat-floaters-value]').text()).to.eq('2');
    await wrapper.find('[data-test=spend-heat-confirm]').trigger('click');
    // 2 floaters = 4 heat, + 4 stock heat = 8 covered.
    expect(saved).to.deep.eq({type: 'and', responses: [{type: 'amount', amount: 4}, {type: 'amount', amount: 2}]});
  });

  it('clamps floaters to the [minFloaters, maxFloaters] range', async () => {
    const wrapper = mount(SpendHeatContent, {
      ...globalConfig,
      props: {playerView, playerinput: model(), onsave: () => {}},
    });
    // Can't drop below minFloaters (1) — the decrement is disabled at the floor.
    expect((wrapper.find('[data-test=spend-heat-floaters-dec]').element as HTMLButtonElement).disabled).to.be.true;
    // maxFloaters = min(10, ceil(8/2)) = 4 — three increments reaches it.
    const inc = wrapper.find('[data-test=spend-heat-floaters-inc]');
    await inc.trigger('click'); await inc.trigger('click'); await inc.trigger('click'); // 1 → 4
    expect(wrapper.find('[data-test=spend-heat-floaters-value]').text()).to.eq('4');
    expect((inc.element as HTMLButtonElement).disabled).to.be.true;
  });

  it('controlled mode emits the default response on mount and hides its own confirm button', () => {
    const emitted: Array<any> = [];
    const wrapper = mount(SpendHeatContent, {
      ...globalConfig,
      props: {playerView, playerinput: model(), controlled: true, onsave: (r: any) => {
        emitted.push(r);
      }},
    });
    // No own confirm button — the host modal's single CTA commits.
    expect(wrapper.find('[data-test=spend-heat-confirm]').exists()).to.be.false;
    // Emitted the default (minFloaters 1 = 2 heat + 6 stock heat) on mount.
    expect(emitted.length).to.be.greaterThan(0);
    expect(emitted[emitted.length - 1]).to.deep.eq({type: 'and', responses: [{type: 'amount', amount: 6}, {type: 'amount', amount: 1}]});
  });

  it('controlled mode re-emits when the floater allocation changes', async () => {
    const emitted: Array<any> = [];
    const wrapper = mount(SpendHeatContent, {
      ...globalConfig,
      props: {playerView, playerinput: model(), controlled: true, onsave: (r: any) => {
        emitted.push(r);
      }},
    });
    await wrapper.find('[data-test=spend-heat-floaters-inc]').trigger('click'); // 1 → 2
    expect(emitted[emitted.length - 1]).to.deep.eq({type: 'and', responses: [{type: 'amount', amount: 4}, {type: 'amount', amount: 2}]});
  });

  it('with enough stock heat, no floaters are forced (minFloaters 0)', () => {
    let saved: any;
    const wrapper = mount(SpendHeatContent, {
      ...globalConfig,
      props: {playerView, playerinput: model({target: 5, maxHeat: 10, maxFloaters: 10}), onsave: (r: any) => {
        saved = r;
      }},
    });
    expect(wrapper.find('[data-test=spend-heat-floaters-value]').text()).to.eq('0');
    wrapper.find('[data-test=spend-heat-confirm]').trigger('click');
    expect(saved).to.deep.eq({type: 'and', responses: [{type: 'amount', amount: 5}, {type: 'amount', amount: 0}]});
  });
});
