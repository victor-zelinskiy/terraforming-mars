import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import BoardSpaceTile from '@/client/components/board/BoardSpaceTile.vue';
import {tileCssClassOf} from '@/client/components/board/boardSpaceTileModel';
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
  // NB the tile div IS the component's root now (the comment that opened the
  // template lives in the script); the classes are still read off it by its
  // `data-test` hook.
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

  // The conversion to `<script setup>` (docs/claude/vapor/RECIPES.md): the template starts with its root, so what a
  // parent lets fall through lands on the tile div in a development build too.
  it('is ONE root — the tile div: an empty cell wears its space type, and a parent\'s attribute falls through onto it', () => {
    const wrapper = shallowMount(BoardSpaceTile, {
      ...globalConfig,
      props: {
        space: spaceModel('91', undefined),
        aresExtension: false,
      },
      attrs: {'data-from-host': 'yes'},
    });
    expect(wrapper.element.tagName).to.eq('DIV');
    expect(wrapper.attributes('data-test')).to.eq('tile');
    expect(wrapper.attributes('data-from-host')).to.eq('yes');
    expect(wrapper.classes()).to.deep.eq(['board-space', 'board-space-type-land']);
    expect(wrapper.attributes('style') ?? '', 'no placement, no pulse — no inline style').to.eq('');
    wrapper.unmount();
  });

  it('wears the art of its tile — the Ares variant where the game has one, the stack\'s top art over the cell\'s own, hidden when asked', async () => {
    const wrapper = shallowMount(BoardSpaceTile, {
      ...globalConfig,
      props: {
        space: spaceModel('92', TileType.CAPITAL),
        aresExtension: false,
      },
    });
    const classes = () => wrapper.find('[data-test="tile"]').classes();
    expect(classes()).to.include.members(['board-space', 'board-space-tile--capital']);
    expect(classes(), 'a tile hides the space type').to.not.include('board-space-type-land');
    expect(classes()).to.not.include('board-hidden-tile');

    await wrapper.setProps({aresExtension: true});
    expect(classes()).to.include('board-space-tile--capital-ares');
    expect(classes()).to.not.include('board-space-tile--capital');

    // A plain city stacked over the Capital: the top's art, never the base's.
    await wrapper.setProps({topArt: TileType.CITY});
    expect(classes()).to.include('board-space-tile--city');
    expect(classes()).to.not.include('board-space-tile--capital-ares');

    await wrapper.setProps({placementCleared: true});
    expect(classes()).to.include('board-space-tile--placement-cleared');

    await wrapper.setProps({tileView: 'hide'});
    expect(classes()).to.include('board-hidden-tile');

    // The placement baseline is module state with no reset of its own: the cell is left EMPTY, as nobody had seen it.
    await wrapper.setProps({space: spaceModel('92', undefined)});
    expect(classes()).to.include('board-space-type-land');
    wrapper.unmount();
  });

  it('`tileCssClassOf` (its sibling module — what the proxy renderers of the tile art import) names the same suffix', () => {
    expect(tileCssClassOf(TileType.CAPITAL, false)).to.eq('capital');
    expect(tileCssClassOf(TileType.CAPITAL, true)).to.eq('capital-ares');
    expect(tileCssClassOf(TileType.GREENERY, true), 'no Ares variant — the plain art').to.eq('greenery');
    expect(tileCssClassOf(TileType.MARS_NOMADS, false), 'a tile that never renders').to.eq('');
  });

  it('a parent\'s ref reaches nothing — the tile exposes no member', () => {
    const Host = defineComponent({
      render: () => h('div', [h(BoardSpaceTile, {ref: 'tile', space: spaceModel('93', undefined), aresExtension: false})]),
    });
    const host = mount(Host, {...globalConfig});
    expect(host.find('[data-test="tile"]').exists()).to.eq(true);
    expect(Object.keys((host.vm.$refs.tile ?? {}) as object), 'the board cell drives it by props alone').to.deep.eq([]);
    host.unmount();
  });
});
