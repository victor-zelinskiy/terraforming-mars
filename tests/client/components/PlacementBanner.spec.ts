import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlacementBanner from '@/client/components/PlacementBanner.vue';
import {CardName} from '@/common/cards/CardName';

// PlacementBanner teleports both its pill and details modal to document.body,
// so we assert against the document rather than the wrapper subtree.
function factory(props: Record<string, unknown>) {
  return mount(PlacementBanner, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {Card: true, CardZoomModal: true}},
    props: {title: 'Select space for city', cancellable: false, ...props},
  });
}

describe('PlacementBanner — start-of-game effect source', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('names the corporation in a compact pill chip', () => {
    factory({source: {kind: 'corporation', card: CardName.THARSIS_REPUBLIC}});
    const chip = document.body.querySelector('[data-test="placement-banner-source"]');
    expect(chip, 'chip should render').to.not.eq(null);
    expect(chip?.textContent ?? '').to.include('Tharsis');
    expect(chip?.className ?? '').to.include('placement-banner__source--corporation');
  });

  it('uses the prelude accent for a prelude source', () => {
    factory({source: {kind: 'prelude', card: CardName.AQUIFER_TURBINES}});
    const chip = document.body.querySelector('[data-test="placement-banner-source"]');
    expect(chip?.className ?? '').to.include('placement-banner__source--prelude');
  });

  it('omits the chip entirely when there is no source', () => {
    factory({});
    expect(document.body.querySelector('[data-test="placement-banner-source"]')).to.eq(null);
  });

  it('renders the start-effect hero inside the details modal', async () => {
    const w = factory({source: {kind: 'corporation', card: CardName.THARSIS_REPUBLIC}});
    // The hero only appears once the details modal is open.
    expect(document.body.querySelector('[data-test="start-effect-card"]')).to.eq(null);
    (w.vm as unknown as {showDetails: boolean}).showDetails = true;
    await w.vm.$nextTick();
    expect(document.body.querySelector('[data-test="start-effect-card"]')).to.not.eq(null);
  });
});
