import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ColoniesOverlay from '@/client/components/colonies/ColoniesOverlay.vue';
import {CardName} from '@/common/cards/CardName';

// ColoniesOverlay teleports its content to document.body.
function factory(props: Record<string, unknown>) {
  return mount(ColoniesOverlay, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {Card: true, CardZoomModal: true, ColonyTile: true, ColonyDetailView: true},
    },
    props: {colonies: [], players: [], ...props},
  });
}

describe('ColoniesOverlay — start-of-game effect hero', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the start-effect hero when a build pick carries a source', () => {
    factory({mode: 'build', startSource: {kind: 'corporation', card: CardName.POSEIDON}});
    expect(document.body.querySelector('[data-test="colonies-overlay-start-effect"]')).to.not.eq(null);
  });

  it('omits the hero for an ordinary trade / view colony overlay', () => {
    factory({mode: 'trade'});
    expect(document.body.querySelector('[data-test="colonies-overlay-start-effect"]')).to.eq(null);
  });
});
