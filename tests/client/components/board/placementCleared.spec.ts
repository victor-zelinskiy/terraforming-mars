import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import BoardSpace from '@/client/components/BoardSpace.vue';
import Bonus from '@/client/components/Bonus.vue';
import {TileType} from '@/common/TileType';
import {SpaceType} from '@/common/boards/SpaceType';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {
  setPlacementHiddenTiles,
  clearPlacementHiddenTiles,
} from '@/client/components/board/placementRenderState';

function citySpace() {
  return {
    id: '05',
    x: 0,
    y: 0,
    bonus: [SpaceBonus.STEEL],
    tileType: TileType.CITY,
    spaceType: SpaceType.LAND,
  };
}

describe('BoardSpace placement-cleared rendering', () => {
  afterEach(() => clearPlacementHiddenTiles());

  it('keeps an occupied tile visible by default — overlay placement', () => {
    clearPlacementHiddenTiles();
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {space: citySpace(), tileView: 'show'},
    });

    const tile = wrapper.find('[data-test="tile"]');
    // The real city tile graphic stays; it is NOT cleared.
    expect(tile.classes()).to.contain('board-space-tile--city');
    expect(tile.classes()).to.not.contain('board-space-tile--placement-cleared');
    // No bonus shown on top of a visible tile.
    expect(wrapper.findComponent(Bonus).exists()).to.be.false;
  });

  it('hides the doomed tile and shows the bonus for a remove-and-replace target', () => {
    setPlacementHiddenTiles(['05']);
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {space: citySpace(), tileView: 'show'},
    });

    const tile = wrapper.find('[data-test="tile"]');
    // Tile graphic is suppressed (CSS zeroes its background-image)...
    expect(tile.classes()).to.contain('board-space-tile--placement-cleared');
    // ...and the placement bonus is shown so the player sees what they'll gain.
    expect(wrapper.findComponent(Bonus).exists()).to.be.true;
  });

  it('reacts when the placement store changes', async () => {
    clearPlacementHiddenTiles();
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {space: citySpace(), tileView: 'show'},
    });
    expect(wrapper.find('[data-test="tile"]').classes()).to.not.contain('board-space-tile--placement-cleared');

    setPlacementHiddenTiles(['05']);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-test="tile"]').classes()).to.contain('board-space-tile--placement-cleared');
  });
});
