import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick} from 'vue';
import RealtimeLayer from '@/client/components/realtime/RealtimeLayer.vue';
import {realtimeService, realtimeState} from '@/client/components/realtime/realtimeService';

/*
 * THE APP-LEVEL REALTIME LAYER: one prop in (the participant), nothing emitted, nothing exposed. Its two jobs are the
 * spec — it starts / stops the singleton service with the game screen, and it prints the dev-only status chip off
 * `realtimeState`. The service itself is not under test: its two doors are replaced for each test, so no socket is
 * ever opened here — and every test unmounts its own layer, so the stop it makes is the replaced one too.
 */
describe('RealtimeLayer', () => {
  const realStart = realtimeService.start;
  const realStop = realtimeService.stop;
  const stateBefore = {...realtimeState};
  let started: Array<string> = [];
  let stops = 0;

  beforeEach(() => {
    started = [];
    stops = 0;
    realtimeService.start = (options: {participantId: string}): void => {
      started.push(options.participantId);
    };
    realtimeService.stop = (): void => {
      stops++;
    };
  });

  afterEach(() => {
    // Module state is bundle-shared: the service's doors and the state the chip reads are put back for every later spec.
    realtimeService.start = realStart;
    realtimeService.stop = realStop;
    Object.assign(realtimeState, stateBefore);
  });

  it('starts the service for its participant when it mounts, and stops it when the game screen leaves', () => {
    const wrapper = mount(RealtimeLayer, {props: {participantId: 'p-one'}});
    expect(started).to.deep.eq(['p-one']);
    expect(stops).to.eq(0);

    wrapper.unmount();
    expect(stops).to.eq(1);
    expect(started, 'leaving starts nothing').to.deep.eq(['p-one']);
  });

  it('an empty participant starts nothing — the id that arrives later does, and a change re-points the service', async () => {
    const wrapper = mount(RealtimeLayer, {props: {participantId: ''}});
    expect(started).to.deep.eq([]);

    await wrapper.setProps({participantId: 'p-one'});
    expect(started).to.deep.eq(['p-one']);

    await wrapper.setProps({participantId: 'p-two'});
    expect(started).to.deep.eq(['p-one', 'p-two']);

    await wrapper.setProps({participantId: ''});
    expect(started, 'an id withdrawn starts nothing').to.deep.eq(['p-one', 'p-two']);
    expect(stops, 'only leaving stops the service').to.eq(0);
    wrapper.unmount();
  });

  it('prints the dev status chip off the service\'s state — nothing while disabled, the status with its marks once it lives', async () => {
    realtimeState.status = 'disabled';
    const wrapper = mount(RealtimeLayer, {props: {participantId: 'p-one'}});
    expect(wrapper.find('.realtime-indicator').exists()).to.eq(false);

    realtimeState.status = 'connected';
    realtimeState.helloAcked = true;
    realtimeState.subscribed = true;
    realtimeState.invalidationsReceived = 2;
    realtimeState.resumeAttempts = 0;
    await nextTick();
    // The chip is the debug build's (`isRealtimeDebug` — the test bundle is a development build).
    const chip = wrapper.find('.realtime-indicator');
    expect(chip.exists(), 'the debug chip').to.eq(true);
    expect(chip.classes()).to.include('realtime-indicator--connected');
    expect(chip.attributes('aria-hidden')).to.eq('true');
    expect(chip.find('.realtime-indicator__dot').exists()).to.eq(true);
    expect(chip.find('.realtime-indicator__label').text()).to.eq('RT: connected ✓ · sub · inv:2');

    realtimeState.status = 'reconnecting';
    realtimeState.helloAcked = false;
    realtimeState.subscribed = false;
    realtimeState.resumeAttempts = 1;
    await nextTick();
    expect(wrapper.find('.realtime-indicator').classes()).to.include('realtime-indicator--reconnecting');
    expect(wrapper.find('.realtime-indicator').classes()).to.not.include('realtime-indicator--connected');
    expect(wrapper.find('.realtime-indicator__label').text()).to.eq('RT: reconnecting · inv:2 · res:1');

    realtimeState.status = 'disabled';
    await nextTick();
    expect(wrapper.find('.realtime-indicator').exists()).to.eq(false);
    wrapper.unmount();
  });
});
