import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {clearRemoteRevealHolds, holdRemoteReveal, releaseRemoteReveal} from '@/client/console/tilePlacement/remoteRevealHold';
import {setPlacementPeek} from '@/client/components/board/placementRenderState';
import {forgetMarkerSilently} from '@/client/components/board/markerPlacementAnimation';
import {armPlacementAnimations} from '@/client/components/board/tilePlacementAnimation';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';

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

  it('a RESTRICTED cell is marked closed by its own class; an ordinary land cell is not', () => {
    const cell = (spaceType: SpaceType) => mount(BoardSpace, {
      ...globalConfig,
      props: {space: {id: '33' as SpaceId, bonus: [], x: 4, y: 4, spaceType}, tileView: 'show'},
    });
    expect(cell(SpaceType.RESTRICTED).classes()).to.include('board-space--restricted');
    expect(cell(SpaceType.LAND).classes()).to.not.include('board-space--restricted');
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

  describe('the SEE-THROUGH — «ПРОСВЕТ» (Turmoil Redux TR47)', () => {
    afterEach(() => {
      setPlacementPeek(undefined);
    });

    function lone(bonus: Array<SpaceBonus>, over: Partial<SpaceModel> = {}) {
      return mount(BoardSpace, {
        ...globalConfig,
        props: {
          space: {id: 'm07', bonus, x: 2, y: 1, spaceType: SpaceType.OCEAN, tileType: TileType.OCEAN, ...over} as SpaceModel,
          tileView: 'show',
        },
      });
    }

    it('nothing peeked: no class, no bonus icons under a standing tile', () => {
      const wrapper = lone([SpaceBonus.PLANT, SpaceBonus.PLANT]);
      expect(wrapper.attributes('data-peek')).to.be.undefined;
      expect(wrapper.findAll('.board-space-bonus')).to.have.length(0);
    });

    it('a lone ocean seen through: the TOP class, the tile still painted (never cleared), the printed bonus PAINTED under it', async () => {
      const wrapper = lone([SpaceBonus.PLANT, SpaceBonus.PLANT]);
      setPlacementPeek({spaceId: 'm07' as SpaceId, piece: 'top'});
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek'), 'the see-through is the root\'s ATTRIBUTE — never a class (the focus ring is written imperatively on this element)').to.eq('top');
      expect(wrapper.find('[data-test="tile"]').classes(), 'the sprite stays — translucent by CSS, never cleared').to.contain('board-space-tile--ocean');
      expect(wrapper.find('[data-test="tile"]').classes()).to.not.contain('board-space-tile--placement-cleared');
      expect(wrapper.findAll('.board-space-bonus'), 'the two plants show through').to.have.length(2);
      setPlacementPeek({spaceId: 'm08' as SpaceId, piece: 'top'});
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek'), 'the peek moved to another cell').to.be.undefined;
      expect(wrapper.findAll('.board-space-bonus')).to.have.length(0);
    });

    it('a lone cell with no printed bonus seen through: the class, and no icons to paint', async () => {
      const wrapper = lone([]);
      setPlacementPeek({spaceId: 'm07' as SpaceId, piece: 'top'});
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek')).to.eq('top');
      expect(wrapper.findAll('.board-space-bonus')).to.have.length(0);
    });

    it('the WATER under a TR44 city seen through: the UNDER class, the water tier marked as the piece, the city keeps its paint, no icons', async () => {
      const wrapper = lone([SpaceBonus.PLANT, SpaceBonus.PLANT], {tileType: TileType.CITY, color: 'blue', under: TileType.OCEAN});
      setPlacementPeek({spaceId: 'm07' as SpaceId, piece: 'under'});
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek')).to.eq('under');
      const tiers = wrapper.findAll('[data-stack-tier]');
      expect(tiers).to.have.length(1);
      expect(tiers[0].attributes('data-stack-piece'), 'the water tier is the piece the CSS dims').to.eq('under');
      expect(tiers[0].classes()).to.contain('board-space-tile--ocean');
      expect(wrapper.find('[data-test="tile"]').classes(), 'the city on top, untouched').to.contain('board-space-tile--city');
      expect(wrapper.findAll('.board-space-bonus'), 'nothing is uncovered — the city stays').to.have.length(0);
    });

    it('the city OFF its water (a city move\'s source): the TOP class, the water tier is not the piece, no icons', async () => {
      const wrapper = lone([SpaceBonus.PLANT], {tileType: TileType.CITY, color: 'blue', under: TileType.OCEAN});
      setPlacementPeek({spaceId: 'm07' as SpaceId, piece: 'top'});
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek')).to.eq('top');
      expect(wrapper.findAll('.board-space-bonus'), 'the ocean stays — nothing uncovered').to.have.length(0);
    });

    it('a stack\'s top tier seen through: no icons (the lower tiers keep the cell)', async () => {
      const wrapper = lone([SpaceBonus.STEEL], {spaceType: SpaceType.LAND, tileType: TileType.CITY, color: 'blue', stackHeight: 2});
      setPlacementPeek({spaceId: 'm07' as SpaceId, piece: 'top'});
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek')).to.eq('top');
      expect(wrapper.findAll('.board-space-bonus')).to.have.length(0);
    });

    it('the peek toggling NEVER rewrites the cell\'s classes — a class the board section wrote imperatively (the focus ring) survives it', async () => {
      // The board section writes `con-cell-sel`, the availability classes and the move's source mark straight onto the
      // element; Vue rewrites `className` wholesale when the `:class` binding changes, so a peek that lived in that
      // binding wiped the focus it stood with (TR39's source level read no focused cell). The peek is an attribute.
      const wrapper = lone([SpaceBonus.PLANT]);
      wrapper.element.classList.add('con-cell-sel', 'board-space--available');
      setPlacementPeek({spaceId: 'm07' as SpaceId, piece: 'top'});
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek')).to.eq('top');
      expect(wrapper.classes(), 'the focus ring written by the section stands').to.contain('con-cell-sel');
      expect(wrapper.classes(), 'the availability class stands').to.contain('board-space--available');
      setPlacementPeek(undefined);
      await wrapper.vm.$nextTick();
      expect(wrapper.attributes('data-peek')).to.be.undefined;
      expect(wrapper.classes()).to.contain('con-cell-sel');
    });

    it('a held cell (the scene owns it) never peeks', async () => {
      const wrapper = lone([SpaceBonus.PLANT]);
      holdRemoteReveal('m07', TileType.OCEAN);
      try {
        setPlacementPeek({spaceId: 'm07' as SpaceId, piece: 'top'});
        await wrapper.vm.$nextTick();
        expect(wrapper.attributes('data-peek')).to.be.undefined;
      } finally {
        clearRemoteRevealHolds();
      }
    });
  });

  /*
   * The cell is a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its surface is its props and
   * its DOM — it emits nothing and exposes nothing — and these pin what the conversion moved inside it: the two
   * members that only handed an import to the template are gone (the import is the template's binding), the three
   * `immediate` watchers run at the end of its setup, and the two landing timers are plain handles of the cell's own
   * flow scope.
   */
  describe('the cell as a `<script setup>` component', () => {
    let clock: ManualFlowClock;

    function cellOf(space: Partial<SpaceModel> & Pick<SpaceModel, 'id'>, tileView: 'show' | 'hide' | 'coords' = 'show') {
      return mount(BoardSpace, {
        ...globalConfig,
        props: {space: {bonus: [], x: 1, y: 1, spaceType: SpaceType.LAND, ...space} as SpaceModel, tileView},
      });
    }

    beforeEach(() => {
      clock = createManualClock(0);
      setFlowClock(clock);
    });
    // Module state is BUNDLE-SHARED: the placement-animation window closes on the kernel's clock (so it is run out
    // before the real clock comes back), and the marker ledger forgets the cells of this block.
    afterEach(() => {
      clock.advance(10_000);
      setFlowClock(undefined);
      forgetMarkerSilently('m22', 'cathedral');
      forgetMarkerSilently('m23', 'nomads');
    });

    it('the coordinates view prints the cell\'s name — its a9 where the board gave it one', () => {
      expect(cellOf({id: 'm35'}, 'coords').find('.board-space-coords').text()).to.eq('Z3');
      expect(cellOf({id: 'm35', a9: 'K9'}, 'coords').find('.board-space-coords').text()).to.eq('K9');
      expect(cellOf({id: 'm35'}).find('.board-space-coords').exists(), 'the ordinary view prints no coordinates').to.be.false;
    });

    it('a cell of the deflection zone wears the zone\'s ground — only its kant once a tile covers it', () => {
      const bare = cellOf({id: 'm41', spaceType: SpaceType.DEFLECTION_ZONE}).find('[data-deflection-zone]');
      expect(bare.classes()).to.deep.eq(['board-space-type-deflection-zone']);
      const covered = cellOf({id: 'm41', spaceType: SpaceType.DEFLECTION_ZONE, tileType: TileType.GREENERY, color: 'red'}).find('[data-deflection-zone]');
      expect(covered.classes()).to.include('board-space-type-deflection-zone--covered');
      expect(cellOf({id: 'm41'}).find('[data-deflection-zone]').exists(), 'an ordinary cell has no zone').to.be.false;
    });

    it('an owner seen while a placement is in play: the cube is held behind its tile\'s entrance, then lands — the cell asked the cube\'s state as it was set up', async () => {
      const resting = cellOf({id: 'm20', tileType: TileType.GREENERY, color: 'red'});
      expect(resting.find('.board-owner-cube').exists(), 'no placement in play — the cube simply stands').to.be.true;

      armPlacementAnimations();
      const landing = cellOf({id: 'm21', tileType: TileType.GREENERY, color: 'red'});
      expect(landing.find('.board-owner-cube').exists(), 'hidden while the tile lands').to.be.false;
      clock.advance(5_000);
      await nextTick();
      expect(landing.find('.board-owner-cube').exists(), 'dropped onto its tile, then at rest').to.be.true;
    });

    it('an overlay marker that LANDS wears the landing for exactly its beat — the cell\'s own timer ends it', async () => {
      const city = {id: 'm22', tileType: TileType.CITY, color: 'blue'} as const;
      const wrapper = cellOf(city);
      expect(wrapper.find('.board-cube--cathedral').exists()).to.be.false;

      // A marker that was simply there when the cell was first seen never lands; one that appears in play does.
      armPlacementAnimations();
      await wrapper.setProps({space: {bonus: [], x: 1, y: 1, spaceType: SpaceType.LAND, ...city, cathedral: true} as SpaceModel});
      const marker = () => wrapper.find('.board-cube--cathedral');
      expect(marker().classes()).to.contain('board-cube--placing');
      const style = marker().attributes('style') ?? '';
      const beat = Number((/--marker-placement-duration:\s*([\d.]+)ms/.exec(style) ?? [])[1]);
      expect(beat, 'the keyframe is handed its duration').to.be.greaterThan(0);
      expect(style).to.match(/--marker-placement-delay:\s*0ms/);

      // The landing stands to the last millisecond of its beat (+ the 40 ms buffer), and leaves with it.
      clock.advance(beat + 39);
      await nextTick();
      expect(marker().classes()).to.contain('board-cube--placing');
      clock.advance(1);
      await nextTick();
      expect(marker().classes()).to.not.contain('board-cube--placing');
      expect(marker().attributes('style') ?? '').to.not.contain('--marker-placement-duration');
    });

    it('the nomads\' first landing is the same beat on its own handle — and a cell that leaves mid-beat takes its timer with it', async () => {
      const wrapper = cellOf({id: 'm23'});
      expect(wrapper.find('.board-nomad').exists()).to.be.false;
      const standing = clock.pending();

      armPlacementAnimations();
      const armed = clock.pending() - standing;
      await wrapper.setProps({space: {id: 'm23', bonus: [], x: 1, y: 1, spaceType: SpaceType.LAND, nomads: true} as SpaceModel});
      expect(wrapper.find('.board-nomad').attributes('style') ?? '').to.match(/--nomad-landing-duration:\s*[\d.]+ms/);
      expect(clock.pending() - standing, 'one timer of the cell beside the window\'s own').to.eq(armed + 1);

      // PACING, not a release: the timer only lowers the cell's own state, so it goes with the cell.
      wrapper.unmount();
      expect(clock.pending() - standing).to.eq(armed);
    });

    it('a parent\'s ref reaches nothing — the board drives a cell by its props alone', () => {
      const Host = defineComponent({
        render: () => h('div', [h(BoardSpace, {ref: 'cell', space: {id: 'm24', bonus: [], x: 1, y: 1, spaceType: SpaceType.LAND}, tileView: 'show'})]),
      });
      const host = mount(Host, {...globalConfig});
      expect(host.find('.board-space-m24').exists()).to.be.true;
      expect(Object.keys((host.vm.$refs.cell ?? {}) as object), 'no `defineExpose`: Board stands no ref on its cells').to.deep.eq([]);
    });
  });
});
