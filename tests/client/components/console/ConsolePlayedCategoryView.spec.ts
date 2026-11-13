import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsolePlayedCategoryView from '@/client/components/console/played/ConsolePlayedCategoryView.vue';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {playedCategoryState, resetPlayedCategoryView} from '@/client/console/played/playedCategoryView';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {getCards, byType} from '@/client/cards/ClientCardManifest';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';

/**
 * THE CATEGORY VIEW'S PAGED ALBUM (the owner, 2026-10-19): a zone too big for one readable screen is an album of strict
 * pages — at least two rows a page, LB / RB turn them (inside a category the seat is never switched), the d-pad crosses
 * a page's edge onto the next, and the page count is STATED (the spine: «N / M», a dot per page, the range). Under
 * JSDOM the view plans against its fallback box (1280 × 560), where 24 cards cannot stand on one readable screen.
 */

const ACTIVE: Array<CardModel> = getCards(byType(CardType.ACTIVE)).slice(0, 24).map((c) => ({name: c.name}) as CardModel);

function press(button: SemanticButton): GamepadIntent {
  return {kind: 'press', button};
}

/** The category stands OPEN on these cards (a restore — no flight to play). */
function seat(cards: Array<CardModel>): void {
  playedCategoryState.category = 'active';
  playedCategoryState.names = cards.map((c) => c.name);
  playedCategoryState.focusIndex = 0;
  playedCategoryState.flights = [];
  playedCategoryState.holdCards = false;
  playedCategoryState.frameOn = true;
  playedCategoryState.phase = 'open';
}

function make(cards: Array<CardModel>) {
  seat(cards);
  return mount(ConsolePlayedCategoryView, {
    props: {cards},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {ConsolePlayedCardLite: true, GamepadGlyph: true},
    },
  });
}

describe('ConsolePlayedCategoryView — the paged album', () => {
  afterEach(() => {
    resetPlayedCategoryView();
    resetConsolePlayedUi();
  });

  it('a zone too big for one readable screen is an ALBUM: pages of ≥ 2 rows, the page count stated, no scroll', async () => {
    const wrapper = make(ACTIVE);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.layout.kind).to.eq('album');
    const box = wrapper.find('.con-played-cat__albumbox');
    expect(box.exists()).to.be.true;
    expect(wrapper.find('.con-played-cat__grid').exists(), 'never the scrolling grid').to.be.false;
    expect(wrapper.vm.album.rows).to.be.at.least(2);
    const pages = wrapper.vm.album.pageCount;
    expect(pages).to.be.greaterThan(1);
    expect(box.attributes('data-cat-pages')).to.eq(String(pages));
    // The spine states it: «1 / N», a dot per page (the first lit), the range of the zone the page shows.
    const spine = wrapper.find('[data-cat-spine]');
    expect(spine.find('.con-played-cat__spine-page').text().replace(/\s+/g, ' ')).to.eq(`1 / ${pages}`);
    expect(spine.findAll('.con-played-cat__spine-dot').length).to.eq(pages);
    expect(spine.findAll('.con-played-cat__spine-dot--on').length).to.eq(1);
    expect(spine.find('.con-played-cat__spine-range').text()).to.match(new RegExp(`^1–${wrapper.vm.album.perPage}`));
    // The bar's mirror.
    expect(consolePlayedUi.pageCount).to.eq(pages);
    expect(consolePlayedUi.page).to.eq(0);
    // Only the page on screen and its neighbour mount slots.
    expect(wrapper.findAll('[data-cat-page-index]').map((w) => w.attributes('data-cat-page-index'))).to.deep.eq(['0', '1']);
    wrapper.unmount();
  });

  it('LB / RB turn the pages (the focus keeps its slot) — the seat is never switched inside a category', async () => {
    const wrapper = make(ACTIVE);
    await wrapper.vm.$nextTick();
    const per = wrapper.vm.album.perPage;
    playedCategoryState.focusIndex = 2;
    wrapper.vm.handleIntent(press('bumperR'));
    await wrapper.vm.$nextTick();
    expect(playedCategoryState.focusIndex).to.eq(per + 2);
    expect(wrapper.vm.activePage).to.eq(1);
    expect(consolePlayedUi.page).to.eq(1);
    expect(wrapper.find('.con-played-cat__spine-page b').text()).to.eq('2');
    wrapper.vm.handleIntent(press('bumperL'));
    wrapper.vm.handleIntent(press('bumperL'));
    expect(playedCategoryState.focusIndex, 'the first page is the edge').to.eq(2);
    // Nothing here closes or emits a seat change.
    expect(wrapper.emitted()).to.not.have.property('settled-closed');
    wrapper.unmount();
  });

  it('▶ off the page\'s last column continues onto the next page, keeping the row', async () => {
    const wrapper = make(ACTIVE);
    await wrapper.vm.$nextTick();
    const cols = wrapper.vm.album.cols;
    const per = wrapper.vm.album.perPage;
    playedCategoryState.focusIndex = cols - 1;
    wrapper.vm.handleIntent({kind: 'nav', dir: 'right'});
    expect(playedCategoryState.focusIndex).to.eq(per);
    expect(wrapper.vm.activePage).to.eq(1);
    wrapper.unmount();
  });

  it('a zone that stands on one screen is the grid — no spine, no page mirror', async () => {
    const wrapper = make(ACTIVE.slice(0, 4));
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.layout.kind).to.eq('grid');
    expect(wrapper.find('[data-cat-spine]').exists()).to.be.false;
    expect(consolePlayedUi.pageCount).to.eq(1);
    wrapper.unmount();
  });
});

/**
 * THE VIEW AS A `<script setup>` COMPONENT (step A of docs/claude/vapor/RECIPES.md): the table reaches it through its
 * ref, and that ref carries `handleIntent` only. Its template starts with its root, so what the view asks of its own
 * element — the slot a card is lifted out of, where the floor folds back to — is asked of the ELEMENT in a unit mount
 * too (under a development build the Options form's `$el` was the anchor of the comment that opened the template, and
 * both answered «nothing»).
 */
describe('ConsolePlayedCategoryView — its surface as a `<script setup>` component', () => {
  const stubs = {ConsolePlayedCardLite: true, GamepadGlyph: true};
  let reducedWas = false;

  beforeEach(() => {
    reducedWas = reduceMotionOverrideState.enabled;
    reduceMotionOverrideState.enabled = false;
  });

  afterEach(() => {
    reduceMotionOverrideState.enabled = reducedWas;
    closeConsoleCardZoom();
    resetPlayedCategoryView();
    resetConsolePlayedUi();
  });

  it('exposes exactly `handleIntent` — the table turns its pages through the ref; it mounts without a warning', async () => {
    seat(ACTIVE);
    const Host = defineComponent({render: () => h('div', [h(ConsolePlayedCategoryView, {ref: 'view', cards: ACTIVE})])});
    // `globalConfig`'s handler promotes every Vue warning to a failure.
    const host = mount(Host, {global: {config: globalConfig.global.config, stubs}});
    const view = host.vm.$refs.view as {handleIntent: (intent: GamepadIntent) => void};
    expect(Object.keys(view)).to.deep.eq(['handleIntent']);
    view.handleIntent(press('bumperR'));
    await nextTick();
    expect(host.find('.con-played-cat__albumbox').attributes('data-cat-page')).to.eq('1');
    expect(consolePlayedUi.page).to.eq(1);
  });

  it('X lifts the focused card out of ITS slot — read off the view\'s root, and «no slot» once the view has left', async () => {
    const cards = ACTIVE.slice(0, 4);
    const wrapper = make(cards);
    await nextTick();
    playedCategoryState.focusIndex = 1;
    wrapper.vm.handleIntent(press('secondary'));
    expect(consoleCardZoom.card?.name).to.eq(cards[1].name);
    expect(consoleCardZoom.cards.map((c) => c.name)).to.deep.eq(cards.map((c) => c.name));
    expect(consoleCardZoom.origin.kind).to.eq('physical');
    const slots = wrapper.findAll('[data-zoom-slot]');
    expect(slots.map((slot) => slot.attributes('data-zoom-slot'))).to.deep.eq(cards.map((c) => c.name));
    expect(consoleCardZoom.origin.resolve?.(1)).to.eq(slots[1].element);
    // Browsing in the viewer keeps the grid's cursor in lockstep — the close returns the card to the slot looked at last.
    consoleCardZoom.origin.onBrowse?.(3);
    expect(playedCategoryState.focusIndex).to.eq(3);
    expect(consoleCardZoom.origin.resolve?.(3)).to.eq(slots[3].element);
    // The viewer outlives the view: no element is «no slot» (the textual close) — never a throw.
    wrapper.unmount();
    expect(consoleCardZoom.origin.resolve?.(1)).to.eq(null);
  });

  it('B folds the floor back INTO its stack — its own centre line when no stack stands — and the view settles closed', async () => {
    const wrapper = make(ACTIVE.slice(0, 4));
    await nextTick();
    const root = wrapper.element as HTMLElement;
    expect(root.classList.contains('con-played-cat'), 'the template starts with its root').to.be.true;
    expect(root.classList.contains('con-played-cat--unfolded'), 'a view that mounts open stands unfolded').to.be.true;
    expect(root.style.getPropertyValue('--con-cat-from-t')).to.eq('');
    wrapper.vm.handleIntent(press('back'));
    expect(playedCategoryState.phase).to.eq('closing');
    await nextTick();
    expect(root.classList.contains('con-played-cat--unfolded'), 'the floor folds').to.be.false;
    expect(['--con-cat-from-t', '--con-cat-from-b', '--con-cat-from-l', '--con-cat-from-r'].map((v) => root.style.getPropertyValue(v)))
      .to.deep.eq(['50%', '50%', '0px', '0px']);
    // Nothing is measurable under JSDOM, so no card flies: the episode settles at once and the table drops the mount.
    await nextTick();
    expect(wrapper.emitted('settled-closed')).to.have.length(1);
    expect(playedCategoryState.phase).to.eq('closed');
  });
});
