import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';

describe('BoardSpace', () => {
  it('has visible tile', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: 'm01',
          bonus: [],
          x: 0,
          y: 0,
          spaceType: SpaceType.LAND,
        },
        tileView: 'show',
      },
    });

    expect(wrapper.find('[data-test="tile"]').classes()).to.not.contain('board-hidden-tile');
  });

  it('has hidden tile if hidden props is passed', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: 'm01',
          bonus: [],
          x: 0,
          y: 0,
          spaceType: SpaceType.LAND,
        },
        tileView: 'hide',
      },
    });

    expect(wrapper.find('[data-test="tile"]').classes()).to.contain('board-hidden-tile');
  });

  describe('the city stack (Turmoil Redux — Skyscrapers)', () => {
    function cell(stackHeight: number | undefined, tileView: 'show' | 'hide' = 'show') {
      return mount(BoardSpace, {
        ...globalConfig,
        props: {
          space: {id: 'm05', bonus: [], x: 2, y: 3, spaceType: SpaceType.LAND, tileType: TileType.CITY, color: 'blue', stackHeight},
          tileView,
        },
      });
    }

    it('an ordinary city draws no tier and no counter, and carries no stack class', () => {
      const wrapper = cell(undefined);
      expect(wrapper.findAll('[data-stack-tier]')).to.have.length(0);
      expect(wrapper.find('[data-stack-count]').exists()).to.be.false;
      expect(wrapper.classes()).to.not.contain('board-space--stack');
      expect(wrapper.attributes('data-stack-height')).to.be.undefined;
    });

    it('a stack of 2 draws ONE lower tier in the city art under the top tile and names the height «×2»', () => {
      const wrapper = cell(2);
      expect(wrapper.classes()).to.contain('board-space--stack');
      expect(wrapper.attributes('data-stack-height')).to.eq('2');
      expect(wrapper.attributes('style')).to.contain('--stack-n: 2');
      const tiers = wrapper.findAll('[data-stack-tier]');
      expect(tiers).to.have.length(1);
      expect(tiers[0].classes()).to.include.members(['board-stack__tier', 'board-space-tile--city']);
      expect(tiers[0].attributes('style')).to.contain('--stack-k: 1');
      // The tier paints BEFORE the top tile in DOM order — under it.
      const children = wrapper.element.children;
      expect(children[0].hasAttribute('data-stack-tier')).to.be.true;
      expect(children[1].getAttribute('data-test')).to.eq('tile');
      expect(wrapper.find('[data-stack-count]').text()).to.eq('×2');
    });

    it('a stack of 3 draws TWO lower tiers (nearest first) and «×3»; a taller stack draws no more tiers, only the number', () => {
      const three = cell(3);
      expect(three.findAll('[data-stack-tier]').map((t) => t.attributes('style'))).to.deep.eq(['--stack-k: 1;', '--stack-k: 2;']);
      expect(three.find('[data-stack-count]').text()).to.eq('×3');
      const five = cell(5);
      expect(five.findAll('[data-stack-tier]')).to.have.length(2);
      expect(five.find('[data-stack-count]').text()).to.eq('×5');
      expect(five.attributes('style'), 'the drawn height is capped — the counter is the truth').to.contain('--stack-n: 3');
    });

    it('a hidden tile view draws no tier and no counter (the stack is a tile)', () => {
      const wrapper = cell(2, 'hide');
      expect(wrapper.findAll('[data-stack-tier]')).to.have.length(0);
      expect(wrapper.find('[data-stack-count]').exists()).to.be.false;
    });
  });
});
