import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import ArcScaleMarkerChip from '@/client/components/board/ArcScaleMarkerChip.vue';
import {resetScaleBonusClaimsSeen} from '@/client/components/board/scaleBonusClaimState';

/**
 * HYDRATION IS NOT A GAME EVENT (the scale-bonus «ignition» contract).
 *
 * A chip that MOUNTS already claimed is the board being adopted — entering an
 * existing game / F5 — and must render the static claimed state with no
 * capture animation (this shipped inverted: every already-claimed bonus
 * ignited on entry). A claim the player actually WITNESSES — the state prop
 * changing under a mounted chip (the no-remount update model) — is the one
 * moment the capture plays, exactly once.
 */
describe('ArcScaleMarkerChip', () => {
  beforeEach(() => {
    resetScaleBonusClaimsSeen();
  });
  afterEach(() => {
    resetScaleBonusClaimsSeen();
  });

  // NOTE: the SFC template opens with a comment node, so in the dev build the
  // component is multi-root and `wrapper.classes()` reads the COMMENT — every
  // class read goes through the rendered chip element instead.
  function chip(state: string, claimColor = '') {
    const wrapper = mount(ArcScaleMarkerChip, {
      ...globalConfig,
      props: {
        icon: 'bonus-zone-icon--heat',
        state,
        claimColor,
        claimKey: 'temperature-2',
      },
    });
    return {wrapper, el: () => wrapper.find('.arc-marker')};
  }

  it('mounting already CLAIMED (hydration of an existing game) does not ignite', () => {
    const {el} = chip('claimed', 'red');
    expect(el().classes()).to.contain('bonus-zone--claimed');
    expect(el().classes()).to.not.contain('bonus-zone--just-claimed');
  });

  it('a live claim transition ignites exactly once', async () => {
    const {wrapper, el} = chip('available');
    expect(el().classes()).to.not.contain('bonus-zone--just-claimed');
    await wrapper.setProps({state: 'claimed', claimColor: 'red'});
    expect(el().classes()).to.contain('bonus-zone--just-claimed');
  });

  it('a claim seeded at mount cannot replay from a later identical transition', async () => {
    const first = chip('claimed', 'red');
    expect(first.el().classes()).to.not.contain('bonus-zone--just-claimed');
    first.wrapper.unmount();
    // The same claim observed again (a chip recreation) — already in the
    // module ledger, so it stays silent.
    const second = chip('available');
    await second.wrapper.setProps({state: 'claimed', claimColor: 'red'});
    expect(second.el().classes()).to.not.contain('bonus-zone--just-claimed');
  });

  it('a government take is its own witnessed transition', async () => {
    const {wrapper, el} = chip('available');
    await wrapper.setProps({state: 'government'});
    expect(el().classes()).to.contain('bonus-zone--just-claimed');
  });
});
