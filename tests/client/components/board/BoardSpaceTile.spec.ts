import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import BoardSpaceTile from '@/client/components/board/BoardSpaceTile.vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {HAZARD_INTENSIFY_MS, resetHazardIntensify} from '@/client/components/board/hazardIntensifyState';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function spaceModel(id: string, tileType: TileType | undefined) {
  return {
    id,
    x: 0,
    y: 0,
    bonus: [],
    color: undefined,
    tileType,
    spaceType: SpaceType.LAND,
    highlight: undefined,
  };
}

describe('BoardSpaceTile', () => {
  afterEach(() => {
    // Module state is BUNDLE-SHARED in mochapack — leave nothing behind.
    resetHazardIntensify();
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(BoardSpaceTile, {
      ...globalConfig,
      props: {
        space: spaceModel('01', undefined),
        aresExtension: false,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  // REGRESSION (Steam Deck perf iteration 1): the intensify pulse is a
  // ONE-SHOT and its class must LEAVE the DOM when the pulse ends. The old
  // cached computed froze its first elapsed forever, so `--intensifying`
  // stayed on the tile for the rest of the game — and because the console
  // board section is `v-show`n, every workspace close (display:none → '')
  // RESTARTED the CSS animation: stationary hazard tiles visibly jumped.
  // NB the component is MULTI-ROOT (a leading template comment), so classes
  // are read off the tile div, never off the wrapper root.
  it('the hazard-intensify class expires after the pulse window', async () => {
    const wrapper = shallowMount(BoardSpaceTile, {
      ...globalConfig,
      props: {
        space: spaceModel('77', TileType.DUST_STORM_MILD),
        aresExtension: true,
      },
    });
    const tile = () => wrapper.find('[data-test="tile"]');
    expect(tile().classes().some((c) => c.includes('intensifying'))).to.be.false;

    // The strengthening (mild → severe) starts the pulse…
    await wrapper.setProps({space: spaceModel('77', TileType.DUST_STORM_SEVERE)});
    expect(tile().classes()).to.include('board-space-tile--intensifying');
    expect((tile().attributes('style') ?? '')).to.include('--hazard-intensify-delay');

    // …and the class is GONE once the window ends (1400 ms + the 40 ms buffer).
    await wait(HAZARD_INTENSIFY_MS + 150);
    expect(tile().classes()).to.not.include('board-space-tile--intensifying');
    wrapper.unmount();
  });

  it('a first sighting (appearance) never pulses — only a real strengthening', async () => {
    const wrapper = shallowMount(BoardSpaceTile, {
      ...globalConfig,
      props: {
        space: spaceModel('78', undefined),
        aresExtension: true,
      },
    });
    await wrapper.setProps({space: spaceModel('78', TileType.EROSION_SEVERE)});
    expect(wrapper.find('[data-test="tile"]').classes()).to.not.include('board-space-tile--intensifying');
    wrapper.unmount();
  });
});
