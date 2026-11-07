import {mount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import ConsoleTenderBidding from '@/client/components/console/campaign/ConsoleTenderBidding.vue';
import ConsoleTenderCard from '@/client/components/console/campaign/ConsoleTenderCard.vue';
import {BiddingModel} from '@/common/campaign/CampaignModel';
import {CampaignSeat} from '@/common/campaign/CampaignTypes';
import {resetBiddingRevealsForTesting, tenderBiddingUi} from '@/client/console/campaign/tenderBiddingUi';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

const SEATS: Array<CampaignSeat> = [
  {seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0},
  {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0},
  {seat: 2, kind: 'bot', name: 'MarsBot', color: 'green', trBoost: 0},
];

function bidding(overrides: Partial<BiddingModel> = {}): BiddingModel {
  return {
    sourceSlot: 0,
    offer: [{instance: 't0-0', id: 'gamble'}, {instance: 't0-1', id: 'restructuring'}],
    order: [1, 0, 2],
    lots: [{seats: [1, 0], order: [1, 0]}],
    pointer: 0,
    done: false,
    yourTurn: false,
    ...overrides,
  };
}

function mountScene(props: Partial<InstanceType<typeof ConsoleTenderBidding>['$props']> = {}): VueWrapper {
  return mount(ConsoleTenderBidding, {
    ...globalConfig,
    props: {
      bidding: bidding(),
      seats: SEATS,
      youSeat: 1,
      missionLabel: 'Миссия 1',
      revealKey: 'ctest:0',
      ...props,
    },
  });
}

const press = (button: string): GamepadIntent => ({kind: 'press', button} as GamepadIntent);
const nav = (dir: 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

describe('ConsoleTenderBidding', () => {
  beforeEach(() => {
    resetBiddingRevealsForTesting();
  });

  it('renders the table, the pick order with its lot tag and the last seat «without a tender»', () => {
    const wrapper = mountScene();
    expect(wrapper.findAll('[data-bidding-card]')).has.length(2);
    expect(wrapper.findAllComponents(ConsoleTenderCard)).has.length(2);
    const seats = wrapper.findAll('[data-bidding-seat]');
    expect(seats.map((s) => s.attributes('data-bidding-seat'))).deep.eq(['1', '0', '2']);
    expect(seats[0].attributes('data-bidding-lot')).eq('yes');
    expect(seats[0].classes()).includes('con-bidding__seat--turn');
    expect(seats[2].classes()).includes('con-bidding__seat--none');
    expect(wrapper.attributes('data-bidding-turn')).eq('1');
  });

  it('the first mount plays the REVEAL once (the pad absorbed, the verbs a disabled status); a second mount lands settled', async () => {
    const first = mountScene();
    expect(tenderBiddingUi.revealing).is.true;
    expect(first.findAll('.con-bidding__slot--reveal')).has.length(2);
    expect(tenderBiddingUi.commands.every((c) => c.enabled === false)).is.true;
    // A press during the reveal lands on nothing.
    (first.vm as any).handleIntent(press('confirm'));
    expect(first.emitted('bid')).is.undefined;
    // The last lot's turn ends the reveal (the owner's own end).
    (first.vm as any).endReveal();
    await first.vm.$nextTick();
    expect(tenderBiddingUi.revealing).is.false;
    first.unmount();
    const second = mountScene();
    expect(tenderBiddingUi.revealing).is.false;
    expect(second.findAll('.con-bidding__slot--reveal')).has.length(0);
  });

  it('on the viewer\'s turn A on an open lot emits the bid; X opens the reader; B closes it, then leaves', async () => {
    const wrapper = mountScene({bidding: bidding({yourTurn: true})});
    (wrapper.vm as any).endReveal();
    await wrapper.vm.$nextTick();
    expect(tenderBiddingUi.commands.some((c) => c.control === 'confirm' && c.enabled !== false)).is.true;
    (wrapper.vm as any).handleIntent(nav('right'));
    (wrapper.vm as any).handleIntent(press('confirm'));
    expect(wrapper.emitted('bid')?.[0]).deep.eq(['t0-1']);
    (wrapper.vm as any).handleIntent(press('secondary'));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-bidding-reader]').exists()).is.true;
    (wrapper.vm as any).handleIntent(press('back'));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-bidding-reader]').exists()).is.false;
    expect(wrapper.emitted('back')).is.undefined;
    (wrapper.vm as any).handleIntent(press('back'));
    expect(wrapper.emitted('back')).has.length(1);
  });

  it('out of turn A emits nothing and the bar offers no confirm; a pick that arrives is PRESENTED (the stamp lands)', async () => {
    // Alice (seat 0) watches: the order's first is Bruno (seat 1).
    const wrapper = mountScene({youSeat: 0});
    (wrapper.vm as any).endReveal();
    await wrapper.vm.$nextTick();
    expect(tenderBiddingUi.commands.some((c) => c.control === 'confirm')).is.false;
    (wrapper.vm as any).handleIntent(press('confirm'));
    expect(wrapper.emitted('bid')).is.undefined;
    expect(wrapper.find('[data-bidding-status]').text()).contains('Bruno');
    // Bruno's pick arrives by the push.
    await wrapper.setProps({bidding: bidding({offer: [{instance: 't0-0', id: 'gamble', takenBy: 1}, {instance: 't0-1', id: 'restructuring'}], pointer: 1, yourTurn: false})});
    await wrapper.vm.$nextTick();
    const slot = wrapper.find('[data-bidding-card="t0-0"]');
    expect(slot.classes()).includes('con-bidding__slot--taking');
    // The taking's own end lands the stamp.
    (wrapper.vm as any).onSlotAnimationEnd({animationName: 'con-tender-taking'}, {instance: 't0-0', id: 'gamble', takenBy: 1}, 0);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-bidding-card="t0-0"]').classes()).includes('con-bidding__slot--taken');
    expect(wrapper.find('[data-bidding-card="t0-0"] .con-tender__stamp--owner').exists()).is.true;
  });

  it('a settled mount shows every past pick stamped and a done bidding says so', () => {
    const wrapper = mountScene({bidding: bidding({
      offer: [{instance: 't0-0', id: 'gamble', takenBy: 1}, {instance: 't0-1', id: 'restructuring', takenBy: 0}],
      pointer: 2, done: true,
    })});
    expect(wrapper.findAll('.con-bidding__slot--taken')).has.length(2);
    expect(wrapper.attributes('data-bidding-done')).eq('yes');
    expect(wrapper.find('[data-bidding-status]').text()).not.empty;
  });
});
