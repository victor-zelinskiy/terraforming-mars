import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {clearRemoteRevealHolds, holdRemoteReveal, releaseRemoteReveal} from '@/client/console/tilePlacement/remoteRevealHold';

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

    describe('a stack over a SPECIAL city — the pile is drawn as the pieces lie', () => {
      function capital(stackHeight: number | undefined, tileView: 'show' | 'hide' = 'show') {
        return mount(BoardSpace, {
          ...globalConfig,
          props: {
            space: {id: 'm05', bonus: [], x: 2, y: 3, spaceType: SpaceType.LAND, tileType: TileType.CAPITAL, color: 'blue', stackHeight},
            tileView,
          },
        });
      }
      const topOf = (wrapper: ReturnType<typeof capital>) => wrapper.find('[data-test="tile"]').classes();
      const tiersOf = (wrapper: ReturnType<typeof capital>) => wrapper.findAll('[data-stack-tier]').map((t) =>
        t.classes().find((c) => c.startsWith('board-space-tile--')));

      it('a single Capital wears its own art and carries no mark', () => {
        const wrapper = capital(undefined);
        expect(topOf(wrapper)).to.contain('board-space-tile--capital');
        expect(wrapper.find('[data-stack-under]').exists()).to.be.false;
      });

      it('a tier on the Capital: the TOP is a plain city, the base tier wears the Capital, a miniature marks what lies under', () => {
        const wrapper = capital(2);
        expect(topOf(wrapper), 'the tile on top is the plain city Skyscrapers put there').to.contain('board-space-tile--city');
        expect(topOf(wrapper), 'never a second Capital').to.not.contain('board-space-tile--capital');
        expect(tiersOf(wrapper), 'the Capital is the base of the pile').to.deep.eq(['board-space-tile--capital']);
        const mark = wrapper.find('[data-stack-under]');
        expect(mark.exists(), 'the buried tile is marked').to.be.true;
        expect(mark.find('.board-stack__under-art').classes()).to.contain('board-space-tile--capital');
        expect(wrapper.find('[data-stack-count]').text()).to.eq('×2');
      });

      it('three tiers: a plain city on top, a plain city between, the Capital at the base', () => {
        const wrapper = capital(3);
        expect(topOf(wrapper)).to.contain('board-space-tile--city');
        expect(tiersOf(wrapper), 'nearest first — the lowest drawn tier is the base').to.deep.eq(['board-space-tile--city', 'board-space-tile--capital']);
        expect(wrapper.find('[data-stack-under]').exists()).to.be.true;
      });

      it('a pile of plain cities carries no mark — nothing special lies under it', () => {
        const wrapper = cell(3);
        expect(wrapper.findAll('[data-stack-tier]').every((t) => t.classes().includes('board-space-tile--city'))).to.be.true;
        expect(wrapper.find('[data-stack-under]').exists()).to.be.false;
      });

      it('a hidden tile view draws no mark either', () => {
        expect(capital(2, 'hide').find('[data-stack-under]').exists()).to.be.false;
      });

      it('the counter\'s offset is a fact of the cell\'s OWN tile — it does not move when the mark appears or goes', () => {
        expect(capital(undefined).classes(), 'a single Capital already stands in the special pose').to.contain('board-space--stack-special');
        expect(capital(2).classes()).to.contain('board-space--stack-special');
        expect(cell(2).classes(), 'a pile of plain cities keeps the ordinary counter').to.not.contain('board-space--stack-special');
        expect(cell(undefined).classes()).to.not.contain('board-space--stack-special');
      });
    });

    /**
     * TWO TILES ON ONE CELL (Turmoil Redux TR44 Aquatic Research Station — an ordinary city ON TOP OF an ocean): the
     * pile is drawn as the pieces lie — the WATER is the base, the city the tier over it, the water's miniature marks
     * what lies under; the counter is the city stack's and a single city carries none. An Ocean City is ONE tile and
     * draws none of it. The server publishes `under` from its one reading; the picture reads nothing else.
     */
    describe('a city OVER AN OCEAN (TR44) — two pieces, the water the base', () => {
      function afloat(stackHeight: number | undefined, tileView: 'show' | 'hide' = 'show') {
        return mount(BoardSpace, {
          ...globalConfig,
          props: {
            space: {id: 'm33', bonus: [], x: 3, y: 3, spaceType: SpaceType.OCEAN, tileType: TileType.CITY, color: 'blue', under: TileType.OCEAN, stackHeight},
            tileView,
          },
        });
      }
      const topOf = (wrapper: ReturnType<typeof afloat>) => wrapper.find('[data-test="tile"]').classes();
      const tiersOf = (wrapper: ReturnType<typeof afloat>) => wrapper.findAll('[data-stack-tier]').map((t) =>
        t.classes().find((c) => c.startsWith('board-space-tile--')));

      it('a single city on the water: the city on top, ONE lower tier in the OCEAN art, the water marked, no counter', () => {
        const wrapper = afloat(undefined);
        expect(topOf(wrapper)).to.contain('board-space-tile--city');
        expect(tiersOf(wrapper), 'the water is the base of the pile').to.deep.eq(['board-space-tile--ocean']);
        expect(wrapper.classes(), 'the pile lifts the city like a stack').to.contain('board-space--stack');
        expect(wrapper.classes()).to.contain('board-space--afloat');
        expect(wrapper.attributes('style')).to.contain('--stack-n: 2');
        const mark = wrapper.find('[data-stack-under]');
        expect(mark.exists(), 'the buried water is marked').to.be.true;
        expect(mark.attributes('data-stack-under-tile')).to.eq('board-space-tile--ocean');
        expect(wrapper.find('[data-stack-count]').exists(), 'the counter counts CITY tiers — a single city carries none').to.be.false;
        expect(wrapper.classes(), 'the counter stands clear of the mark, as on a special city').to.contain('board-space--stack-special');
      });

      it('a Skyscrapers tier on it: a plain city on top, the base city under it, the water at the foot, «×2»', () => {
        const wrapper = afloat(2);
        expect(topOf(wrapper)).to.contain('board-space-tile--city');
        expect(tiersOf(wrapper), 'nearest first — the base city, then the water').to.deep.eq(['board-space-tile--city', 'board-space-tile--ocean']);
        expect(wrapper.attributes('style')).to.contain('--stack-n: 3');
        expect(wrapper.find('[data-stack-count]').text()).to.eq('×2');
        expect(wrapper.find('[data-stack-under]').attributes('data-stack-under-tile'), 'the water stays the mark').to.eq('board-space-tile--ocean');
      });

      it('three city tiers over the water: two city tiers drawn, the water no longer drawn but still marked, «×3»', () => {
        const wrapper = afloat(3);
        expect(tiersOf(wrapper)).to.deep.eq(['board-space-tile--city', 'board-space-tile--city']);
        expect(wrapper.find('[data-stack-count]').text()).to.eq('×3');
        expect(wrapper.find('[data-stack-under]').attributes('data-stack-under-tile')).to.eq('board-space-tile--ocean');
      });

      it('an Ocean City is ONE tile: no tier, no mark, no counter, its own art', () => {
        const wrapper = mount(BoardSpace, {
          ...globalConfig,
          props: {
            space: {id: 'm34', bonus: [], x: 4, y: 3, spaceType: SpaceType.OCEAN, tileType: TileType.OCEAN_CITY, color: 'red'},
            tileView: 'show',
          },
        });
        expect(topOf(wrapper)).to.contain('board-space-tile--ocean-city');
        expect(wrapper.findAll('[data-stack-tier]')).to.have.length(0);
        expect(wrapper.find('[data-stack-under]').exists()).to.be.false;
        expect(wrapper.find('[data-stack-count]').exists()).to.be.false;
        expect(wrapper.classes()).to.not.contain('board-space--stack');
        expect(wrapper.classes()).to.not.contain('board-space--afloat');
      });

      it('a hidden tile view draws neither the water tier nor the mark', () => {
        const wrapper = afloat(undefined, 'hide');
        expect(wrapper.findAll('[data-stack-tier]')).to.have.length(0);
        expect(wrapper.find('[data-stack-under]').exists()).to.be.false;
      });

      it('a cell HELD by a remote scene at «a city over its water» keeps painting the whole pile — never a bare city, never a bare hex', async () => {
        // The model already says what the server committed (the water left from under the city); the hold says what STOOD there.
        holdRemoteReveal('m33', TileType.CITY, 'blue', TileType.OCEAN);
        try {
          const wrapper = mount(BoardSpace, {
            ...globalConfig,
            props: {
              space: {id: 'm33', bonus: [], x: 3, y: 3, spaceType: SpaceType.OCEAN, tileType: TileType.CITY, color: 'blue'},
              tileView: 'show',
            },
          });
          expect(topOf(wrapper)).to.contain('board-space-tile--city');
          expect(tiersOf(wrapper), 'the held water is the base').to.deep.eq(['board-space-tile--ocean']);
          expect(wrapper.find('[data-stack-under]').attributes('data-stack-under-tile')).to.eq('board-space-tile--ocean');
          expect(wrapper.classes()).to.contain('board-space--afloat');
          releaseRemoteReveal('m33');
          await wrapper.vm.$nextTick();
          expect(tiersOf(wrapper), 'released: the committed cell — a city on dry ground').to.deep.eq([]);
          expect(wrapper.find('[data-stack-under]').exists()).to.be.false;
        } finally {
          clearRemoteRevealHolds();
        }
      });
    });
  });
});
