/*
 * ConsolePlayedTargetStep — the embedded step «point at a card that is already on the table», hosted by both
 * composers, the MarsBot attack, the Hydronetwork, the trade's target stage and the Venus bonus. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md).
 *
 * Its layout, its navigation and its copy are pure modules with specs of their own (`consolePlayedTargetModel`), and
 * its surfaces are walked by e2e. This spec is the COMPONENT: it mounts warning-free in a minimal honest state, a
 * host's ref reaches exactly the seven functions the hosts call (and each answers), the contract's payload is both
 * the computed the template reads and the element behind the ref of the same key, the self-target proxy is published
 * to the composer and taken back with the step, and the size it solves from the host's band is what pages the set.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {playedTargetSelfState, resetPlayedTargetSelf} from '@/client/console/played/consolePlayedTargetSelf';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir, PlayedTargetPayload,
  buildPlayedTargetModel, planPlayedTargetSizing,
} from '@/client/console/played/consolePlayedTargetModel';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';

/** What every host reads off the ref it stands on the step. */
type StepReach = {
  cells: () => ReadonlyArray<PlayedTargetCell>,
  ensureFocusVisible: () => void,
  payloadEl: () => HTMLElement | undefined,
  rootEl: HTMLElement | null,
  scrollBy: (dy: number) => void,
  navigate: (focus: PlayedTargetFocus, dir: PlayedTargetNavDir) => PlayedTargetFocus | undefined,
  turnPage: (focus: PlayedTargetFocus, delta: number) => PlayedTargetFocus | undefined,
};

const NAMES = [
  CardName.TARDIGRADES, CardName.ANTS, CardName.DECOMPOSERS, CardName.PREDATORS,
  CardName.FISH, CardName.BIRDS, CardName.LIVESTOCK, CardName.PETS,
];
const card = (name: CardName): CardModel => ({name} as CardModel);

/** The viewer's own table (red), every card of one family — so a band's render order is the candidates' own. */
function modelOf(count: number, opts: {source?: CardName, payload?: PlayedTargetPayload} = {}): PlayedTargetModel {
  return buildPlayedTargetModel({
    candidates: NAMES.slice(0, count).map(card),
    players: [{name: 'victor', color: 'red', tableau: NAMES.map((name) => ({name}))}],
    viewerColor: 'red',
    ask: '',
    typeOf: () => CardType.ACTIVE,
    preview: () => [],
    sourceCardName: opts.source,
    payload: opts.payload,
  });
}

const LAYOUT: PlayedTargetLayout = {mode: 'tabs', perRow: 4};
const at = (index: number): PlayedTargetFocus => ({ownerId: 'red', index});

// The children are their own subjects; this spec reads what the step HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: {type: String, default: ''}, card: {type: Object, default: undefined}},
  render: () => h('i', {class: 'face-stub'}),
});
const SpineStub = defineComponent({
  name: 'ConsoleAlbumSpine',
  props: {album: {type: Object, default: undefined}, variant: {type: String, default: ''}, held: {type: Boolean, default: false}},
  render: () => h('i', {class: 'spine-stub'}),
});
/** What the step asked of its candidate viewport — the one scroller it owns. */
const viewportCalls = {ensured: [] as Array<Element | null | undefined>, scrolled: [] as Array<number>};
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  setup(_props, {slots, expose}) {
    expose({
      ensureVisible: (el: Element | null | undefined) => viewportCalls.ensured.push(el),
      scrollByPx: (dy: number) => viewportCalls.scrolled.push(dy),
    });
    return () => h('div', {class: 'scroll-stub'}, slots.default?.());
  },
});

const stubs = {
  ConsoleCardFaceLite: FaceStub, ConsoleAlbumSpine: SpineStub, ConsoleScrollArea: ScrollStub,
  GamepadGlyph: true, ConsoleDeclinePlate: true, ConsolePlayedTargetTag: true, PremiumMechNode: true, ConsoleCardResourceChip: true,
};

function step(props: Record<string, unknown>) {
  return mount(ConsolePlayedTargetStep, {global: {...globalConfig.global, stubs}, props: {layout: LAYOUT, focus: at(0), ...props}});
}

/** Stand every rendered cell on one row, by its own index — the boxes the navigation reads. */
function placeCells(root: Element): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-ptsel-cell]'))) {
    const left = Number(el.dataset.index) * 220;
    el.getBoundingClientRect = () => ({left, top: 0, width: 200, height: 290, right: left + 200, bottom: 290, x: left, y: 0, toJSON: () => ({})}) as DOMRect;
  }
}

/** The candidates on screen, by their index in the owner's list (the focus vocabulary). */
const indicesOf = (wrapper: ReturnType<typeof step>) =>
  wrapper.findAll('[data-ptsel-cell]').map((cell) => cell.attributes('data-index'));

describe('ConsolePlayedTargetStep — the embedded played-card target step', () => {
  afterEach(() => {
    // The self link is module state, shared by the whole bundle; the viewport's record is this spec's.
    resetPlayedTargetSelf();
    playedTargetSelfState.geometry = 0;
    viewportCalls.ensured.length = 0;
    viewportCalls.scrolled.length = 0;
  });

  it('mounts in a minimal honest state: the contract line, one cell per candidate, the rail reading the card under the cursor', async () => {
    const model = modelOf(2);
    const wrapper = step({model});
    // The template STARTS WITH ITS ROOT.
    const root = wrapper.element as HTMLElement;
    expect(root.tagName).to.eq('DIV');
    expect(wrapper.classes()).to.deep.eq(['con-ptsel']);
    expect(wrapper.attributes('data-mode')).to.eq('tabs');
    expect(wrapper.attributes('data-owners')).to.eq('1');
    expect(wrapper.attributes('data-direction')).to.eq('add');
    expect(wrapper.attributes('data-flow'), 'not measured yet (no band): the default sizing').to.eq('rows');
    expect(wrapper.attributes('data-ptsel-geom')).to.eq(`h0 z${(0.58 / conUiScale()).toFixed(3)} r1 p0`);
    expect(root.style.getPropertyValue('--con-ptsel-zoom')).to.eq('0.580');
    expect(root.style.getPropertyValue('--con-ptsel-max-h'), 'no budget — no cap').to.eq('');

    expect(wrapper.find('.con-ptsel__contract-title').text()).to.eq($t('Choose a card on the table'));
    expect(wrapper.find('.con-ptsel__scope-count').text()).to.eq(translateTextWithParams('${0} available targets', ['2']));
    expect(wrapper.find('[data-ptsel-payload]').exists(), 'no payload in the contract — the plain ask').to.eq(false);

    const cells = wrapper.findAll('[data-ptsel-cell]');
    expect(cells.map((cell) => cell.attributes('data-owner'))).to.deep.eq(['red', 'red']);
    expect(indicesOf(wrapper)).to.deep.eq(['0', '1']);
    expect(cells.map((cell) => cell.attributes('data-focused'))).to.deep.eq(['1', undefined]);
    expect(cells.map((cell) => cell.find('.con-ptsel__slot').attributes('data-zoom-slot'))).to.deep.eq([NAMES[0], NAMES[1]]);
    const faces = wrapper.findAllComponents(FaceStub);
    expect(faces.map((face) => face.props('name'))).to.deep.eq([NAMES[0], NAMES[1]]);
    expect(faces[0].props('card'), 'the LIVE model — the face prints the real count').to.deep.eq(model.owners[0].candidates[0].model);
    expect(wrapper.find('.con-ptsel__railcard').text(), 'the rail names the card under the cursor').to.eq($t(NAMES[0]));

    await wrapper.setProps({focus: at(1)});
    expect(wrapper.findAll('[data-ptsel-cell]').map((cell) => cell.attributes('data-focused'))).to.deep.eq([undefined, '1']);
    expect(wrapper.find('.con-ptsel__railcard').text()).to.eq($t(NAMES[1]));

    // A host that states the ask itself: no second instruction, no bar for a lone owner.
    expect(wrapper.find('.con-ptsel__contract').exists()).to.eq(true);
    expect(wrapper.find('.con-ptsel__ownerbar').exists()).to.eq(true);
    await wrapper.setProps({hostStatesAsk: true});
    expect(wrapper.find('.con-ptsel__contract').exists()).to.eq(false);
    expect(wrapper.find('.con-ptsel__ownerbar').exists()).to.eq(false);
  });

  it('a host\'s ref reaches exactly the seven functions the hosts call — and each answers', async () => {
    const model = modelOf(2);
    const Host = defineComponent({
      render: () => h('div', [h(ConsolePlayedTargetStep, {ref: 'step', model, layout: LAYOUT, focus: at(0)})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs}});
    const reach = host.vm.$refs.step as StepReach;
    expect(Object.keys(reach)).to.deep.eq(['cells', 'ensureFocusVisible', 'payloadEl', 'rootEl', 'scrollBy', 'navigate', 'turnPage']);

    const root = host.find('.con-ptsel').element as HTMLElement;
    expect(reach.rootEl, 'the step\'s root element').to.eq(root);
    expect(reach.payloadEl(), 'no payload on the contract line').to.eq(undefined);

    // THE GEOMETRY PULL: the cells' real boxes, measured once and cached until the layout changes.
    placeCells(root);
    const cells = reach.cells();
    expect(cells).to.deep.eq([
      {ownerId: 'red', index: 0, left: 0, top: 0, width: 200, height: 290},
      {ownerId: 'red', index: 1, left: 220, top: 0, width: 200, height: 290},
    ]);
    expect(reach.cells(), 'cached — never re-measured per press').to.eq(cells);

    // THE CURSOR'S STEP by where the cards are; an edge with no page beyond it HOLDS.
    expect(reach.navigate(at(0), 'right')).to.deep.eq(at(1));
    expect(reach.navigate(at(1), 'left')).to.deep.eq(at(0));
    expect(reach.navigate(at(1), 'right')).to.eq(undefined);
    expect(reach.navigate(at(0), 'down')).to.eq(undefined);
    expect(reach.turnPage(at(0), 1), 'one page — the bumpers keep their job').to.eq(undefined);

    // The candidate viewport is the step's own scroller: both scroll verbs go to it and nowhere else.
    reach.scrollBy(40);
    expect(viewportCalls.scrolled).to.deep.eq([40]);
    reach.ensureFocusVisible();
    expect(viewportCalls.ensured, 'after the patch the move belongs to').to.deep.eq([]);
    await nextTick();
    expect(viewportCalls.ensured).to.have.length(1);
    expect(viewportCalls.ensured[0], 'the cursored cell').to.eq(root.querySelector('[data-ptsel-cell][data-focused]')).and.to.not.eq(null);
  });

  it('the payload: the contract names WHAT lands (the computed the template reads) and hands the host its element (the ref of the same key)', async () => {
    const model = shallowRef(modelOf(2, {payload: {amount: 2, icon: 'floater'}}));
    const Host = defineComponent({
      setup: () => () => h('div', [h(ConsolePlayedTargetStep, {ref: 'step', model: model.value, layout: LAYOUT, focus: at(0)})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs}});
    const reach = () => host.vm.$refs.step as StepReach;

    expect(host.find('[data-ptsel-where]').text()).to.eq(`${$t('Where to')}:`);
    const payload = host.find('[data-ptsel-payload]');
    expect(payload.attributes('data-ptsel-payload-icon')).to.eq('floater');
    expect(payload.attributes('data-motion-anchor'), 'the host FLIPs it in from the variant tile').to.eq('payload');
    expect(payload.find('.con-ptsel__payload-num').text()).to.eq('2');
    const sprite = iconClassFor('floater').split(' ').filter((c) => c !== '');
    expect(sprite, 'the premise: the shared resolver knows the floater').to.not.deep.eq([]);
    expect(payload.find('.con-ptsel__payload-icon').classes()).to.include.members(sprite);
    expect(host.find('.con-ptsel__contract-title:not(.con-ptsel__contract-title--where)').exists(), 'the payload replaces the generic ask').to.eq(false);
    expect(reach().payloadEl(), 'the carried print\'s own element').to.eq(payload.element);

    // A pick with no known payload keeps the plain ask — and there is no element to carry.
    model.value = modelOf(2);
    await nextTick();
    expect(host.find('[data-ptsel-payload]').exists()).to.eq(false);
    expect(host.find('.con-ptsel__contract-title').text()).to.eq($t('Choose a card on the table'));
    expect(reach().payloadEl()).to.eq(undefined);
  });

  it('the self-target is a PROXY, never a second copy — published to the composer at once, and taken back with the step', async () => {
    const model = modelOf(2, {source: NAMES[1]});
    const proxyAt = model.owners[0].candidates.findIndex((c) => c.relation === 'source-card');
    expect(proxyAt, '«ЭТА КАРТА» leads its owner\'s candidates').to.eq(0);
    const wrapper = step({model, focus: at(proxyAt)});
    // Immediate: the very first frame of the step already shows the link.
    expect({...playedTargetSelfState, geometry: 0}).to.deep.eq({present: true, focused: true, locked: false, pulse: 1, geometry: 0});

    const proxy = wrapper.find('[data-ptsel-self]');
    expect(proxy.exists()).to.eq(true);
    expect(proxy.classes()).to.include('con-ptsel__self--focused').and.to.not.include('con-ptsel__self--locked');
    expect(proxy.find('.con-ptsel__self-kicker').text()).to.eq($t('This card'));
    expect(proxy.find('.con-ptsel__self-name').text()).to.eq($t(NAMES[1]));
    expect(proxy.attributes('data-zoom-slot'), 'X lifts the REAL card, never the proxy').to.eq(undefined);
    expect(wrapper.findAllComponents(FaceStub).map((face) => face.props('name')), 'the source card is not drawn twice').to.deep.eq([NAMES[0]]);

    // The cursor leaves the proxy; the source card is then confirmed as the target.
    await wrapper.setProps({focus: at(1)});
    expect(playedTargetSelfState.focused).to.eq(false);
    await wrapper.setProps({lockedCard: NAMES[1]});
    expect(playedTargetSelfState.locked).to.eq(true);
    expect(wrapper.find('[data-ptsel-self]').classes()).to.include('con-ptsel__self--locked');
    expect(wrapper.find('.con-ptsel__self-check').text()).to.eq('✓');

    // The hero must never keep a ring that belongs to a selector that is gone.
    wrapper.unmount();
    expect({...playedTargetSelfState, geometry: 0}).to.deep.eq({present: false, focused: false, locked: false, pulse: 0, geometry: 0});
  });

  it('the size is SOLVED from the host\'s band and published; a set the band cannot hold is PAGED — the d-pad across the edge and the bumpers turn it', async () => {
    const model = modelOf(8);
    const wrapper = step({model});
    expect(indicesOf(wrapper), 'unmeasured: the whole set').to.have.length(8);

    // The band: 900 px of zone, 400 px of height from the host (the step's own chrome measures 0 here).
    Object.defineProperty(wrapper.find('.con-ptsel__zone').element, 'clientWidth', {value: 900, configurable: true});
    const geometryBefore = playedTargetSelfState.geometry;
    await wrapper.setProps({bandHeight: 400});
    await nextTick();

    const ui = conUiScale();
    const availH = 400 - 2 * 11 * ui;
    const plan = planPlayedTargetSizing({
      owners: model.owners, mode: 'tabs', availW: 900, availH, ui, handheld: consoleLayoutState.profile === 'handheld',
      tags: false, tagLines: 1, tagOneLineW: undefined, ownerBar: true,
    });
    expect(plan.pageSize, 'the premise: eight cards do not stand in this band at a readable size').to.eq(4);
    const root = wrapper.element as HTMLElement;
    expect(wrapper.attributes('data-ptsel-geom')).to.eq(`h${Math.round(availH)} z${(plan.cardZoom / ui).toFixed(3)} r${plan.rows} p4`);
    expect(root.style.getPropertyValue('--con-ptsel-zoom')).to.eq(plan.cardZoom.toFixed(3));
    expect(root.style.getPropertyValue('--con-ptsel-max-h'), 'the cap is the host\'s budget').to.eq('400px');
    expect(playedTargetSelfState.geometry, 'a re-solved size expires every measured box').to.be.greaterThan(geometryBefore);

    // THE PAGE: the band shows its first four, says where it stands and where to turn.
    expect(indicesOf(wrapper)).to.deep.eq(['0', '1', '2', '3']);
    const pages = wrapper.find('[data-ptsel-pages]');
    expect([pages.attributes('data-ptsel-page'), pages.attributes('data-ptsel-page-count')]).to.deep.eq(['1', '2']);
    expect(pages.find('.con-ptsel__pages-range').text()).to.eq(translateTextWithParams('${0}–${1} of ${2}', ['1', '4', '8']));
    expect(wrapper.findComponent(SpineStub).props('album')).to.deep.eq({page: 1, pages: 2, canPrev: false, canNext: true});
    expect(wrapper.findComponent(SpineStub).props('held'), 'one band: the bumpers turn its page').to.eq(false);
    expect(wrapper.find('[data-ptsel-turn="prev"]').classes()).to.include('con-ptsel__turn--off');
    expect(wrapper.find('[data-ptsel-turn="next"]').classes()).to.not.include('con-ptsel__turn--off');

    // LB / RB keep the cursor's place in the page; the d-pad across the page's edge lands on the near edge of the next.
    const reach = wrapper.vm as unknown as StepReach;
    expect(reach.turnPage(at(1), 1)).to.deep.eq(at(5));
    expect(reach.turnPage(at(1), -1), 'no page that way').to.eq(undefined);
    placeCells(root);
    expect(reach.navigate(at(2), 'right')).to.deep.eq(at(3));
    expect(reach.navigate(at(3), 'right')).to.deep.eq(at(4));
    expect(reach.navigate(at(0), 'left'), 'the first page\'s edge holds').to.eq(undefined);

    // The host moves the cursor onto the next page: the band follows it, and the cached boxes expire.
    const measured = reach.cells();
    await wrapper.setProps({focus: at(5)});
    expect(indicesOf(wrapper)).to.deep.eq(['4', '5', '6', '7']);
    const turned = wrapper.find('[data-ptsel-pages]');
    expect([turned.attributes('data-ptsel-page'), turned.attributes('data-ptsel-page-count')]).to.deep.eq(['2', '2']);
    expect(turned.find('.con-ptsel__pages-range').text()).to.eq(translateTextWithParams('${0}–${1} of ${2}', ['5', '8', '8']));
    expect(wrapper.find('[data-ptsel-turn="next"]').classes()).to.include('con-ptsel__turn--off');
    expect(reach.cells(), 'a page turn moves every cell').to.not.eq(measured);
    expect(reach.cells().map((cell) => cell.index)).to.deep.eq([4, 5, 6, 7]);
  });
});
