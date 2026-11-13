/*
 * ConsoleCardAlbum — the host-agnostic card album (P87). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). What a HOST does with it is the host's subject (`consoleCarryoverPicker.spec`, the
 * campaign's e2e); this spec pins what the album itself owes any host:
 *  - it mounts in a minimal honest state with no Vue warning (`globalConfig` turns one into a failure): a slot per
 *    entry, the host's states drawn on the slots (the cursor · chosen + its band · refused + its reason · withheld),
 *    a click answering `pick` with the FLAT index;
 *  - the page is DERIVED from `index` and told to the host at once and on every change (`position`); a fresh open
 *    lands ON its page, a later turn slides and lets its `--turning` class go by itself (a wait of the flow kernel —
 *    the spec drives the kernel's clock);
 *  - a host's ref reaches EXACTLY the five members the sheet lists (R11), and each answers.
 *
 * The card face is stubbed (its own spec's subject). The unit box has no layout, so the album plans from its fallback
 * box — the standard 5 × 2 page, which is all this spec reads of the planner (`consoleHandAlbum.spec` is its spec).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {albumLayoutState} from '@/client/console/consoleAlbumLayout';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsoleCardAlbum from '@/client/components/console/foundation/ConsoleCardAlbum.vue';

/** One card of the album as a host hands it down (the component's `CardAlbumEntry` — a `.ts` file cannot import a
 *  named export of a `.vue`, so the spec spells the shape). */
type CardAlbumEntry = {name: string, card: CardModel, picked?: boolean, band?: string, disabled?: boolean, reason?: string};

/** What a host reaches through its ref (the sheet's MUST EXPOSE list). */
type AlbumReach = {
  step(from: number, dir: 'left' | 'right' | 'up' | 'down'): number,
  jumpPage(from: number, dir: 1 | -1): number,
  slotEl(name: string): HTMLElement | null,
  faceEl(name: string): HTMLElement | null,
  activePageNames(): Array<string>,
};
const EXPOSED = ['activePageNames', 'faceEl', 'jumpPage', 'slotEl', 'step'];

// (A render function, not a template string: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'CardFace',
  props: {
    card: {type: Object as PropType<CardModel>, required: true},
    artTier: {type: String, default: undefined},
    lightweight: {type: Boolean, default: false},
    inert: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'card-stub pcard', 'data-card': this.card.name});
  },
});

function entry(name: CardName, over: Partial<CardAlbumEntry> = {}): CardAlbumEntry {
  return {name, card: {name} as CardModel, ...over};
}

const THREE: ReadonlyArray<CardAlbumEntry> = [
  entry(CardName.ALGAE),
  entry(CardName.ANTS, {picked: true, band: 'Kept · 1'}),
  entry(CardName.BIRDS, {disabled: true, reason: 'Not this mission'}),
];

/** Fourteen cards — two pages of the standard 5 × 2 album. */
const FOURTEEN_NAMES: ReadonlyArray<CardName> = [
  CardName.ALGAE, CardName.ANTS, CardName.BIRDS, CardName.CARTEL, CardName.FISH, CardName.PETS, CardName.LICHEN,
  CardName.MANGROVE, CardName.SOLAR_WIND_POWER, CardName.TREES, CardName.HEATHER, CardName.KELP_FARMING,
  CardName.ADAPTED_LICHEN, CardName.ASTEROID,
];
const FOURTEEN: ReadonlyArray<CardAlbumEntry> = FOURTEEN_NAMES.map((name) => entry(name));

const mountGlobal = {...globalConfig.global, stubs: {Card: CardStub}};

function mountAlbum(props: {entries: ReadonlyArray<CardAlbumEntry>, index: number, heldNames?: ReadonlyArray<string>}) {
  return mount(ConsoleCardAlbum, {global: mountGlobal, props});
}

describe('ConsoleCardAlbum — the host-agnostic card album', () => {
  // Module state is BUNDLE-SHARED: the album plans from the layout profile and the album preference.
  let profile = consoleLayoutState.profile;
  let layout = albumLayoutState.layout;
  let clock: ManualFlowClock;
  beforeEach(() => {
    profile = consoleLayoutState.profile;
    layout = albumLayoutState.layout;
    consoleLayoutState.profile = 'standard';
    albumLayoutState.layout = 'adaptive';
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
    consoleLayoutState.profile = profile;
    albumLayoutState.layout = layout;
  });

  it('mounts a slot per entry with the host\'s states on it, tells its position at once, and a click answers `pick` with the flat index', async () => {
    const wrapper = mountAlbum({entries: THREE, index: 1, heldNames: [CardName.ALGAE]});

    expect(wrapper.classes()).to.deep.eq(['con-album']);
    expect(wrapper.attributes('style'), 'the standard card of the plan').to.contain('--con-hand-zoom');
    expect(wrapper.findAll('.con-album__page')).to.have.length(1);
    const slots = wrapper.findAll('.con-album__slot');
    expect(slots.map((s) => s.attributes('data-album-slot'))).to.deep.eq([CardName.ALGAE, CardName.ANTS, CardName.BIRDS]);
    expect(slots.map((s) => s.attributes('data-zoom-slot')), 'the zoom\'s physical origin').to.deep.eq([CardName.ALGAE, CardName.ANTS, CardName.BIRDS]);
    expect(slots.map((s) => s.find('.card-stub').attributes('data-card')), 'each slot hosts its own face').to.deep.eq([CardName.ALGAE, CardName.ANTS, CardName.BIRDS]);

    expect(slots.map((s) => s.classes().includes('con-album__slot--selected')), 'the cursor').to.deep.eq([false, true, false]);
    expect(slots.map((s) => s.classes().includes('con-album__slot--picked'))).to.deep.eq([false, true, false]);
    expect(slots.map((s) => s.attributes('data-album-picked'))).to.deep.eq([undefined, 'true', undefined]);
    expect(slots.map((s) => s.classes().includes('con-album__slot--disabled'))).to.deep.eq([false, false, true]);
    expect(slots.map((s) => s.classes().includes('con-album__slot--held')), 'a flight owns that card').to.deep.eq([true, false, false]);
    expect(slots[1].find('.con-album__band[data-album-band]').text(), 'a chosen card wears the host\'s band').to.eq('Kept · 1');
    expect(slots[2].find('.con-album__chip').text(), 'a refused card names why').to.eq('Not this mission');
    expect(slots[0].find('.con-album__band').exists() || slots[0].find('.con-album__chip').exists()).to.eq(false);

    // The position reaches the host in the frame the album is created (the immediate watcher), not a tick later.
    expect(wrapper.emitted('position')).to.deep.eq([[{page: 1, pages: 1, canPrev: false, canNext: false}]]);

    await slots[2].trigger('click');
    expect(wrapper.emitted('pick'), 'the FLAT index — the host owns what a pick means').to.deep.eq([[2]]);
  });

  it('the page is DERIVED from `index`: a fresh open lands on its page, a later turn slides and its `--turning` class ends by itself', async () => {
    const wrapper = mountAlbum({entries: FOURTEEN, index: 0});
    const strip = () => wrapper.find('.con-album__strip');

    expect(wrapper.emitted('position')).to.deep.eq([[{page: 1, pages: 2, canPrev: false, canNext: true}]]);
    expect(wrapper.findAll('.con-album__page').map((p) => p.findAll('.con-album__slot').length), 'the active page ± 1 stays mounted')
      .to.deep.eq([10, 4]);
    expect(strip().attributes('style')).to.contain('translateX(0px)');
    expect(strip().classes(), 'the slide is not armed before the first paint settled').to.deep.eq(['con-album__strip']);

    // The slide arms a tick and a frame after the mount.
    await nextTick();
    clock.advance(16);
    await nextTick();
    expect(strip().classes()).to.deep.eq(['con-album__strip', 'con-album__strip--live']);

    await wrapper.setProps({index: 11});
    expect(wrapper.emitted('position')?.[1]).to.deep.eq([{page: 2, pages: 2, canPrev: true, canNext: false}]);
    expect(strip().attributes('style'), 'one stride to the left').to.match(/translateX\(-\d+(\.\d+)?px\)/);
    expect(strip().classes()).to.include('con-album__strip--turning');
    expect(wrapper.findAll('.con-album__slot').map((s) => s.classes().includes('con-album__slot--selected')).indexOf(true)).to.eq(11);

    // No `transitionend` in the unit box: the safety release lets the class go.
    clock.advance(420);
    await nextTick();
    expect(strip().classes()).to.deep.eq(['con-album__strip', 'con-album__strip--live']);

    // …and the strip's own `transitionend` does the same without waiting for the safety.
    await wrapper.setProps({index: 0});
    expect(strip().classes()).to.include('con-album__strip--turning');
    await strip().trigger('transitionend', {propertyName: 'opacity'});
    expect(strip().classes(), 'another property settling is not the turn').to.include('con-album__strip--turning');
    await strip().trigger('transitionend', {propertyName: 'transform'});
    expect(strip().classes()).to.not.include('con-album__strip--turning');
  });

  it('a host\'s ref reaches exactly the five members the sheet lists — and each answers', async () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleCardAlbum, {ref: 'album', entries: FOURTEEN, index: 0})]),
    });
    const host = mount(Host, {global: mountGlobal});
    const album = host.vm.$refs.album as AlbumReach;
    expect(Object.keys(album as object).sort(), 'defineExpose is the sheet\'s MUST EXPOSE list').to.deep.eq(EXPOSED);

    // step — the hand's own walk: ±1 in order (across the page edge IS the page turn), rows within a page.
    expect(album.step(0, 'right')).to.eq(1);
    expect(album.step(0, 'left'), 'clamped at the first card').to.eq(0);
    expect(album.step(9, 'right'), 'across the page edge').to.eq(10);
    expect(album.step(0, 'down'), 'the second row of a 5 × 2 page').to.eq(5);
    expect(album.step(5, 'up')).to.eq(0);
    expect(album.step(13, 'right'), 'clamped at the last card').to.eq(13);

    // jumpPage — the same relative slot on the neighbouring page.
    expect(album.jumpPage(1, 1)).to.eq(11);
    expect(album.jumpPage(11, -1)).to.eq(1);

    // activePageNames — what an entry deal lands into.
    expect(album.activePageNames()).to.deep.eq(FOURTEEN_NAMES.slice(0, 10));

    // slotEl / faceEl — the live slot a card visually lives in, and the face inside it.
    const slot = album.slotEl(CardName.FISH);
    expect(slot, 'the mounted slot').to.eq(host.find(`[data-album-slot="${CardName.FISH}"]`).element);
    expect(album.faceEl(CardName.FISH), 'the face a clone flight copies').to.eq(slot?.querySelector('.pcard'));
    expect(album.slotEl('No such card')).to.eq(null);
    expect(album.faceEl('No such card')).to.eq(null);

    host.unmount();
    expect(album.slotEl(CardName.FISH), 'no album on screen — no slot').to.eq(null);
  });

  it('an empty album mounts no page and still tells its position', () => {
    const wrapper = mountAlbum({entries: [], index: 0});
    expect(wrapper.findAll('.con-album__page')).to.have.length(0);
    expect(wrapper.emitted('position')).to.deep.eq([[{page: 1, pages: 1, canPrev: false, canNext: false}]]);
  });
});
