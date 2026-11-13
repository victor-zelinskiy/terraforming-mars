/*
 * BotReviewEdgeNotice — the turn-navigation boundary toast of the bot's review. A VAPOR component (the Vue 3.6
 * pilot — docs/claude/vapor/ROADMAP.md §3.6): a `<Transition>` over a keyed `v-if` driven by a module's reactive
 * state, mounted under a virtual-DOM host as it is in the product (`ConsoleBotTurnReview`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import BotReviewEdgeNotice from '@/client/components/marsbot/BotReviewEdgeNotice.vue';
import {botTurnReviewState, flashBotReviewEdge} from '@/client/components/marsbot/botTurnReviewState';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {lendFrames} from '../../vapor/lendFrames';

function mountNotice(large: boolean) {
  const Host = defineComponent({render: () => h('div', [h(BotReviewEdgeNotice, {large})])});
  // (the REAL transition: the spec reads its classes and lends it frames — the default stub is opted out of)
  return mount(Host, {global: {...globalConfig.global, stubs: {transition: false}}, attachTo: document.body});
}

describe('BotReviewEdgeNotice (a Vapor leaf)', () => {
  // A Vapor `<Transition>` is the real one in a spec and needs a frame source there (`tests/client/vapor/lendFrames.ts`).
  let giveBack: () => Promise<void>;
  beforeEach(() => {
    giveBack = lendFrames();
    setFlowClock(createManualClock(0)); // the notice's own 2.4 s life is a wait of the kernel
    botTurnReviewState.edge = '';
  });
  afterEach(async () => {
    botTurnReviewState.edge = '';
    setFlowClock(undefined);
    await giveBack();
  });

  it('renders nothing at rest; an edge shows its side, its glyph and its sentence; the same edge again replays the node', async () => {
    const wrapper = mountNotice(true);
    expect(wrapper.find('.mbr-edge').exists(), 'at rest').to.equal(false);

    flashBotReviewEdge('no-prev');
    await nextTick();
    const first = wrapper.find('.mbr-edge');
    expect(first.exists()).to.equal(true);
    expect(first.classes()).to.include.members(['mbr-edge--no-prev', 'mbr-edge--large']);
    expect(first.attributes('role')).to.equal('status');
    expect(first.find('.mbr-edge__glyph').text()).to.equal('⟨');
    expect(first.find('.mbr-edge__text').text()).to.equal('Previous turn unavailable');

    flashBotReviewEdge('no-prev'); // the same boundary pressed again — the nonce re-keys the node, the pop replays
    await nextTick();
    const nodes = wrapper.findAll('.mbr-edge').map((w) => w.element);
    expect(nodes.some((node) => node !== first.element), 'a NEW node stands for the second press').to.equal(true);

    flashBotReviewEdge('no-next');
    await nextTick();
    const last = wrapper.findAll('.mbr-edge').at(-1)!;
    expect(last.classes()).to.include('mbr-edge--no-next');
    expect(last.find('.mbr-edge__glyph').text()).to.equal('⟩');
    expect(last.find('.mbr-edge__text').text()).to.equal('The next turn has not been played yet');
  });

  it('the compact review omits the large modifier', async () => {
    const wrapper = mountNotice(false);
    flashBotReviewEdge('no-next');
    await nextTick();
    expect(wrapper.find('.mbr-edge').classes()).to.not.include('mbr-edge--large');
  });
});
