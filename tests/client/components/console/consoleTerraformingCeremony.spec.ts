import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import ConsoleTerraformingCeremony from '@/client/components/console/ConsoleTerraformingCeremony.vue';
import {
  resetTerraformingCelebration,
  terraformingCelebrationState,
} from '@/client/components/gameProgress/terraformingCelebration';

// The first gsap-touching test pays a one-time engine init in JSDOM (~1s+
// cold) — keep the REAL ceremonyFx path covered instead of stubbing it out,
// and give those tests the room for that first tick.
const GSAP_COLD_START_TIMEOUT_MS = 10_000;

describe('ConsoleTerraformingCeremony', () => {
  beforeEach(() => resetTerraformingCelebration());
  afterEach(() => resetTerraformingCelebration());

  it('stays idle until the LIVE celebration nonce fires (reload never replays)', () => {
    const wrapper = mount(ConsoleTerraformingCeremony);
    expect(wrapper.find('.con-terracere').exists()).to.eq(false);
    wrapper.unmount();
  });

  it('plays the ceremony with the honest FINAL-generation claim', async () => {
    const wrapper = mount(ConsoleTerraformingCeremony);
    terraformingCelebrationState.celebrationFinal = true;
    terraformingCelebrationState.celebrationNonce++;
    await nextTick();
    await nextTick();
    const root = wrapper.find('.con-terracere');
    expect(root.exists()).to.eq(true);
    expect(root.classes()).to.contain('con-terracere--final');
    expect(wrapper.text()).to.contain('Mars is terraformed');
    expect(wrapper.text()).to.contain('The current generation will be the last');
    wrapper.unmount();
  }).timeout(GSAP_COLD_START_TIMEOUT_MS);

  it('falls back to the neutral three-parameter line when the last generation cannot be claimed', async () => {
    const wrapper = mount(ConsoleTerraformingCeremony);
    terraformingCelebrationState.celebrationFinal = false;
    terraformingCelebrationState.celebrationNonce++;
    await nextTick();
    await nextTick();
    const root = wrapper.find('.con-terracere');
    expect(root.exists()).to.eq(true);
    expect(root.classes()).to.not.contain('con-terracere--final');
    expect(wrapper.text()).to.contain('Temperature, oxygen and oceans are complete');
    expect(wrapper.text()).to.not.contain('The current generation will be the last');
    wrapper.unmount();
  }).timeout(GSAP_COLD_START_TIMEOUT_MS);
});
