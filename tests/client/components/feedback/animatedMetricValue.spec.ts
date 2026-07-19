/*
 * Phase-2 guards for the honest old→new metric feedback
 * (docs/REMOUNT_ANIMATION_REWORK_DESIGN.md §3.3).
 *
 * With the no-remount update model the AnimatedMetricValue host persists
 * across server responses, so:
 *   - a genuine MOUNT is a silent baseline (never a chip);
 *   - a WATCH-driven value change fires the chip;
 *   - a seat switch (scopeKey change) re-baselines silently;
 *   - the legacy `tm_remount` rollback flag restores the historical
 *     mount-diff behavior (chips fired from mounted() against the module
 *     baseline, because under that flag the tree remounts per response).
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import {changeFeedbackManager} from '@/client/components/feedback/changeFeedbackManager';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {__resetLegacyRemountForTesting} from '@/client/utils/legacyRemount';
import {__resetMotionTokensForTesting} from '@/client/components/motion/motionTokens';

function mountHost(value: number, scopeKey = 'blue') {
  return mount(AnimatedMetricValue, {
    ...globalConfig,
    props: {
      value,
      scopeKey,
      metricKey: 'megacredits.stock',
      variant: 'resource-stock',
    },
  });
}

describe('AnimatedMetricValue (reactive transitions)', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    __resetLegacyRemountForTesting();
    __resetMotionTokensForTesting();
    changeFeedbackManager.reset();
  });

  afterEach(() => {
    __resetLegacyRemountForTesting();
    __resetMotionTokensForTesting();
    changeFeedbackManager.reset();
    FakeLocalStorage.deregister(localStorage);
  });

  it('a genuine mount is a SILENT baseline even when the manager holds an older value', () => {
    // A previous host observed 10 for this scope+metric…
    changeFeedbackManager.recordScopeObservation('blue', 'megacredits.stock');
    changeFeedbackManager.report('blue', 'megacredits.stock', 10);
    // …a fresh mount sees 15: the value moved while nothing was mounted.
    const wrapper = mountHost(15);
    expect((wrapper.vm as any).displayedDelta).to.eq(0);
    wrapper.unmount();
  });

  it('a watch-driven value change fires the chip with the net delta', async () => {
    const wrapper = mountHost(10);
    await wrapper.setProps({value: 15});
    expect((wrapper.vm as any).displayedDelta).to.eq(5);
    wrapper.unmount();
  });

  it('a seat switch (scopeKey change) suppresses the chip and re-baselines', async () => {
    const wrapper = mountHost(10, 'blue');
    await wrapper.setProps({scopeKey: 'red', value: 99});
    expect((wrapper.vm as any).displayedDelta).to.eq(0);
    // A subsequent REAL change under the new scope animates normally.
    await wrapper.setProps({value: 101});
    expect((wrapper.vm as any).displayedDelta).to.eq(2);
    wrapper.unmount();
  });

  it('the legacy tm_remount flag restores the mount-diff behavior', () => {
    localStorage.setItem('tm_remount', '1');
    __resetLegacyRemountForTesting();

    changeFeedbackManager.recordScopeObservation('blue', 'megacredits.stock');
    changeFeedbackManager.report('blue', 'megacredits.stock', 10);
    const wrapper = mountHost(15);
    // Under the rollback flag the tree remounts per response, so the mount
    // MUST act on the diff vs the module baseline (the historical behavior).
    expect((wrapper.vm as any).displayedDelta).to.eq(5);
    wrapper.unmount();
  });
});
