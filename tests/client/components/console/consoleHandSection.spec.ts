/*
 * ConsoleHandSection — «Карты в руке», the premium hand ALBUM: the surface of the hand workspace. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md). Its flows — the dock ↔ album reveal, the descent into a play,
 * the pick bridges — are its e2e's subject (`hand-album-probe` and the card specs); this spec pins what a unit mount
 * can say about the surface itself:
 *  - it mounts in a minimal honest state with no Vue warning (`globalConfig` turns one into a failure), a slot per card,
 *    the cursor's slot and the verdict rail reading the card under it;
 *  - its header is the SHARED workspace header — `<component :is>` is handed the imported `ConsoleWsHead` itself (R21:
 *    the Options form named it by a string a `<script setup>` component no longer resolves) — and a plain toolbar when
 *    the hand is a step of another workspace;
 *  - the shell's surface registry reaches EXACTLY the seven members its controllers read (R11), and each answers;
 *  - the cursor is anchored to the CARD, the pick bridge's resume is announced from the root's own ref (R12 · R3), and
 *    the outcome zone wears the dual `v-embed-zone` (R17) and is taken back with the surface.
 *
 * The card face is stubbed (its own spec's subject) — this spec reads which slot stands where.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {flushPromises, mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {CardModel} from '@/common/models/CardModel';
import {consoleState} from '@/client/console/consoleRouter';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {embedZoneMounted} from '@/client/console/embedZoneRegistry';
import {claimWorkspaceOutcome, resetWorkspaceOutcome, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import type {AlbumFilterOption} from '@/client/components/console/consoleHandFilter';
import type {HandNavDir} from '@/client/components/console/consoleHandGrid';
import type {ConsoleHandEntry, ConsoleHandStage, HandTransitionTargets} from '@/client/components/console/consoleHandSectionTypes';

const OUTCOME_ZONE = '[data-embed-slot="hand-outcome"]';

/** What the shell's controllers reach through the surface registry (the sheet's MUST EXPOSE list). */
type HandSurface = {
  move(dir: HandNavDir): void,
  turnPage(dir: 1 | -1): void,
  stickScroll(dy: number, dx?: number): void,
  transitionTargets(): HandTransitionTargets,
  packetHomeRects(names: ReadonlyArray<string>, side?: 'left' | 'right'): Map<string, {left: number, top: number, width: number, height: number}>,
  ensureSelectedVisible(): void,
  restoreScroll(px: number): void,
};
const EXPOSED = ['ensureSelectedVisible', 'move', 'packetHomeRects', 'restoreScroll', 'stickScroll', 'transitionTargets', 'turnPage'];

// (A render function, not a template string: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'CardFace',
  props: {
    card: {type: Object as PropType<CardModel>, required: true},
    artTier: {type: String, default: undefined},
    lightweight: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'card-stub', 'data-card': this.card.name});
  },
});

function entry(name: CardName, over: Partial<ConsoleHandEntry> = {}): ConsoleHandEntry {
  return {card: {name}, playable: true, potential: true, robot: false, ...over};
}

const AI = entry(CardName.AI_CENTRAL);
const ANTS = entry(CardName.ANTS, {playable: false});
const BIRDS = entry(CardName.BIRDS, {playable: false, potential: false});
/** The hand the shell hands down — ONE array for as long as the hand does not change (a host that built a new one per
 *  render would wake the identity anchor on every cursor step). */
const THREE: ReadonlyArray<ConsoleHandEntry> = [AI, ANTS, BIRDS];

/** Twelve cards — two pages of the standard 5 × 2 album. */
const TWELVE: ReadonlyArray<ConsoleHandEntry> = [
  CardName.AI_CENTRAL, CardName.ALGAE, CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.FISH,
  CardName.HEATHER, CardName.INSECTS, CardName.LICHEN, CardName.MOSS, CardName.PETS, CardName.TREES,
].map((name) => entry(name));

const STAGE: ConsoleHandStage = {subject: CardName.AI_CENTRAL, name: 'Play', committed: false};

const mountGlobal = {...globalConfig.global, stubs: {Card: CardStub}};

function mountHand(props: Record<string, unknown>) {
  return mount(ConsoleHandSection, {global: mountGlobal, props: {entries: THREE, index: 0, ...props}});
}

function slotNames(wrapper: ReturnType<typeof mountHand>): Array<string | undefined> {
  return wrapper.findAll('.con-hand__slot').map((slot) => slot.attributes('data-zoom-slot'));
}

describe('ConsoleHandSection — «Карты в руке», the hand album', () => {
  // Module state is BUNDLE-SHARED: the section writes the router's cursor and stamps the album's art tier.
  let handIndex = 0;
  let filterFocus = -1;
  let artTier: typeof handRevealState.artTier = 'full';
  beforeEach(() => {
    handIndex = consoleState.handIndex;
    filterFocus = consoleState.filterFocus;
    artTier = handRevealState.artTier;
    consoleState.handIndex = 0;
    consoleState.filterFocus = -1;
  });
  afterEach(() => {
    resetWorkspaceOutcome();
    consoleState.handIndex = handIndex;
    consoleState.filterFocus = filterFocus;
    handRevealState.artTier = artTier;
  });

  it('mounts the browse hand: the workspace root, the shared header with its counts, a slot per card and the rail reading the cursor\'s card', () => {
    const wrapper = mountHand({});

    expect(wrapper.classes()).to.include.members(['con-hand', 'con-hand--album', 'con-ws']);
    expect(wrapper.classes()).to.not.include('con-hand--embedded');
    expect(wrapper.attributes('data-flow')).to.eq('browse');

    // R21 — the header is the COMPONENT, not an unknown element named after it.
    const head = wrapper.find('.con-hand__frame > header.con-wshead.con-hand__head');
    expect(head.exists(), 'the shared workspace header carries the hand\'s head class').to.eq(true);
    expect(wrapper.find('consolewshead').exists(), 'never the string rendered as a tag').to.eq(false);
    expect(head.find('.con-wshead__root').text()).to.eq('Cards in hand');
    expect(head.find('.con-wshead__layer--browse .con-hand__head-left .con-hand__count').text(), 'the plain total — no chips to carry it').to.eq('3');
    expect(head.find('.con-hand__playable').text(), 'POTENTIAL, the wheel\'s own number').to.eq('Playable now: 2');
    expect(wrapper.find('.con-hand__toolbar').exists()).to.eq(false);
    expect(wrapper.find('.con-hand__filters').exists(), 'no chip beyond «All» — no filter row').to.eq(false);

    expect(slotNames(wrapper)).to.deep.eq([CardName.AI_CENTRAL, CardName.ANTS, CardName.BIRDS]);
    const slots = wrapper.findAll('.con-hand__slot');
    expect(slots.map((s) => s.find('.card-stub').attributes('data-card')), 'each slot hosts its own face').to.deep.eq([CardName.AI_CENTRAL, CardName.ANTS, CardName.BIRDS]);
    expect(slots.map((s) => s.classes().includes('con-hand__slot--selected')), 'the cursor').to.deep.eq([true, false, false]);
    expect(slots.map((s) => s.classes().includes('con-hand__slot--playable'))).to.deep.eq([true, false, false]);
    expect(slots.map((s) => s.classes().includes('con-hand__slot--notnow')), 'rules-OK, not this moment').to.deep.eq([false, true, false]);
    expect(slots.map((s) => s.classes().includes('con-hand__slot--unplayable')), 'only what the rules refuse is dimmed').to.deep.eq([false, false, true]);

    expect(wrapper.find('.con-hand__verdictbar .con-cards__verdict-name').text()).to.eq(CardName.AI_CENTRAL);
    expect(wrapper.find('.con-hand__verdictbar--ok .con-cards__verdict--ok').text()).to.contain('Playable now');
    expect(wrapper.findAll('.con-hand__pgedge').map((e) => e.classes().includes('con-hand__pgedge--off')), 'one page — neither edge leads anywhere').to.deep.eq([true, true]);
    expect(wrapper.find('.con-hand__empty').exists()).to.eq(false);
    expect(wrapper.find('.con-hand__stage').exists(), 'no descent — no stage zone').to.eq(false);
    expect(wrapper.find('.con-hand__outcome').exists(), 'no claim — no outcome zone').to.eq(false);
  });

  it('a hand that is a STEP of another workspace drops the shared header for its own toolbar — held past the descent', async () => {
    const wrapper = mountHand({embedded: true});

    expect(wrapper.classes()).to.include('con-hand--embedded');
    expect(wrapper.classes(), 'the host carries the workspace marker').to.not.include('con-ws');
    expect(wrapper.find('.con-wshead').exists(), 'the host\'s header carries the crumb').to.eq(false);
    const toolbar = wrapper.find('.con-hand__frame > div.con-hand__toolbar');
    expect(toolbar.exists()).to.eq(true);
    expect(toolbar.classes()).to.not.include('con-hand__toolbar--held');
    expect(toolbar.find('.con-hand__head-left .con-hand__count').text(), 'the toolbar is the hand\'s own — it stays').to.eq('3');

    await wrapper.setProps({stage: STAGE});

    expect(wrapper.attributes('data-flow')).to.eq('configure');
    expect(wrapper.find('.con-hand__toolbar').classes(), 'browse-layer chrome hides past the descent').to.include('con-hand__toolbar--held');
    expect(wrapper.find('.con-hand__browse').classes()).to.include('con-hand__browse--parked');
    expect(wrapper.find('.con-hand__stage[data-unfold-surface][data-embed-slot="hand-play"]').exists(), 'the composer\'s teleport target').to.eq(true);
    expect(slotNames(wrapper), 'the browse layer is parked, never unmounted').to.deep.eq([CardName.AI_CENTRAL, CardName.ANTS, CardName.BIRDS]);
  });

  it('the filter row is a focusable line: ▲ from the top row enters it on the active chip, ◀▶ walk it, ▼ hands the cursor back', async () => {
    const tagFilters: ReadonlyArray<AlbumFilterOption> = [{value: 'all', count: 3}, {value: Tag.SCIENCE, count: 1}, {value: Tag.MICROBE, count: 1}];
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleHandSection, {ref: 'hand', entries: THREE, index: consoleState.handIndex, tagFilters, activeTag: Tag.SCIENCE})]),
    });
    const host = mount(Host, {global: mountGlobal});
    const hand = host.vm.$refs.hand as HandSurface;

    const chips = () => host.findAll('.con-hand__filters > .con-hand__filter');
    expect(chips().map((c) => c.attributes('data-hand-filter'))).to.deep.eq(['all', 'science', 'microbe']);
    expect(chips()[0].find('.con-hand__filter-label').text(), 'the «All» chip is translated in place (v-i18n)').to.eq('All');
    expect(chips().map((c) => c.classes().includes('con-hand__filter--active'))).to.deep.eq([false, true, false]);
    expect(host.find('.con-hand__count').exists(), 'the «All» chip carries the total').to.eq(false);
    expect(host.find('[data-hand-filters]').attributes('data-hand-filters-focused')).to.eq(undefined);

    hand.move('up');
    await nextTick();
    expect(consoleState.filterFocus, 'entered on the ACTIVE chip').to.eq(1);
    expect(consoleState.handIndex, 'the card cursor stands').to.eq(0);
    expect(host.find('[data-hand-filters]').attributes('data-hand-filters-focused')).to.eq('');
    expect(chips().map((c) => c.classes().includes('con-hand__filter--focused'))).to.deep.eq([false, true, false]);

    hand.move('right');
    hand.move('right');
    await nextTick();
    expect(consoleState.filterFocus, 'no wrap past the last chip').to.eq(2);
    expect(consoleState.handIndex).to.eq(0);

    hand.move('down');
    await nextTick();
    expect(consoleState.filterFocus).to.eq(-1);
    hand.move('right');
    expect(consoleState.handIndex, 'the d-pad walks the cards again').to.eq(1);
  });

  it('the surface registry reaches exactly the seven members the shell\'s controllers read — and each answers', async () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleHandSection, {ref: 'hand', entries: TWELVE, index: consoleState.handIndex, packetExtras: [CardName.WORMS]})]),
    });
    const host = mount(Host, {global: mountGlobal});
    const hand = host.vm.$refs.hand as HandSurface;
    expect(Object.keys(hand as object).sort(), 'defineExpose is the sheet\'s MUST EXPOSE list').to.deep.eq(EXPOSED);

    const pages = host.findAll('.con-hand__page');
    expect(pages.map((p) => p.findAll('.con-hand__slot').length), 'the standard album page is 5 × 2; the neighbour page stays mounted').to.deep.eq([10, 2]);
    const edgeOff = () => host.findAll('.con-hand__pgedge').map((e) => e.classes().includes('con-hand__pgedge--off'));
    expect(edgeOff(), 'page 1 of 2').to.deep.eq([true, false]);

    // move — the d-pad step is the router's cursor.
    hand.move('right');
    expect(consoleState.handIndex).to.eq(1);
    await nextTick();
    expect(host.findAll('.con-hand__slot').map((s) => s.classes().includes('con-hand__slot--selected')).indexOf(true)).to.eq(1);

    // turnPage — the same relative slot on the neighbouring page; the pressed edge answers.
    hand.turnPage(1);
    expect(consoleState.handIndex, 'slot 1 of page 2').to.eq(11);
    await nextTick();
    expect(edgeOff(), 'page 2 of 2').to.deep.eq([false, true]);
    expect(host.find('.con-hand__pgedge--right').classes(), 'the edge\'s one-shot impulse').to.include('con-hand__pgedge--pulse');
    hand.turnPage(1);
    expect(consoleState.handIndex, 'nothing wraps past the last page').to.eq(11);

    // stickScroll — a firm push turns one page; a weak one and a repeat inside the cadence turn nothing.
    hand.stickScroll(-0.2);
    expect(consoleState.handIndex, 'under the flick threshold').to.eq(11);
    hand.stickScroll(-1);
    expect(consoleState.handIndex).to.eq(1);
    await nextTick();
    hand.stickScroll(1);
    expect(consoleState.handIndex, 'a held stick pages at its cadence, never per frame').to.eq(1);

    // transitionTargets — every card's album home: the active page's slots, the other page's packet, the filtered-out extras.
    // (`CSS.escape` is the browser's: jsdom carries it on its window, the bundle's global scope does not — lent for
    // this one read and taken back.)
    const scope = globalThis as {CSS?: unknown};
    const hadCss = 'CSS' in scope;
    scope.CSS = window.CSS;
    let targets: HandTransitionTargets;
    try {
      targets = hand.transitionTargets();
    } finally {
      if (!hadCss) {
        delete scope.CSS;
      }
    }
    expect(targets.pairs.map((p) => p.name)).to.deep.eq([...TWELVE.map((e) => e.card.name), CardName.WORMS]);
    expect(targets.pairs.map((p) => p.visible), 'page 1 stands on stage; page 2 and the extras ride the packets').to.deep.eq([...Array(10).fill(true), false, false, false]);
    expect(targets.pairs[10].clip, 'a packet-bound card wipes behind the right edge').to.have.property('right');
    expect(targets.scrollTop).to.eq(0);
    expect(targets.stage, 'the album\'s x-range').to.deep.eq({left: 0, right: 0});

    // packetHomeRects — the filter episode's anchors, one per name.
    const homes = hand.packetHomeRects([CardName.ANTS, CardName.BIRDS]);
    expect([...homes.keys()]).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    expect(homes.get(CardName.ANTS)).to.have.all.keys('left', 'top', 'width', 'height');

    // The two hooks kept for the director's shape: the page derives from the focus, nothing scrolls.
    expect(hand.ensureSelectedVisible()).to.eq(undefined);
    expect(hand.restoreScroll(40)).to.eq(undefined);
    expect(consoleState.handIndex).to.eq(1);
  });

  it('a click on a page edge is the same page turn', async () => {
    const wrapper = mount(ConsoleHandSection, {global: mountGlobal, props: {entries: TWELVE, index: 3}});

    await wrapper.find('.con-hand__pgedge--right').trigger('click');
    expect(consoleState.handIndex, 'slot 3 of page 2, clamped to the last card').to.eq(11);

    await wrapper.setProps({index: 11, transitHold: true});
    await wrapper.find('.con-hand__pgedge--left').trigger('click');
    expect(consoleState.handIndex, 'the reveal episode pins the strip').to.eq(11);
  });

  it('the cursor is anchored to the CARD: a re-sort moves the index after it, a card that left falls back to the nearest slot', async () => {
    consoleState.handIndex = 1;
    const wrapper = mountHand({index: 1});
    await nextTick();

    // ANTS sank to the end of the playable-first order — the cursor follows the card.
    await wrapper.setProps({entries: [AI, BIRDS, ANTS]});
    expect(consoleState.handIndex).to.eq(2);
    await wrapper.setProps({index: 2});
    expect(wrapper.find('.con-hand__slot--selected').attributes('data-zoom-slot')).to.eq(CardName.ANTS);
    expect(wrapper.find('.con-cards__verdict-name').text()).to.eq(CardName.ANTS);

    // ANTS was played — the same slot, clamped; never a jump to the first page.
    await wrapper.setProps({entries: [AI, BIRDS]});
    expect(consoleState.handIndex).to.eq(1);
    await wrapper.setProps({index: 1});
    expect(wrapper.find('.con-hand__slot--selected').attributes('data-zoom-slot')).to.eq(CardName.BIRDS);

    // …and BIRDS is the anchor now: a re-sort is followed again.
    await wrapper.setProps({entries: [BIRDS, AI]});
    expect(consoleState.handIndex).to.eq(0);

    await wrapper.setProps({entries: [], index: 0});
    expect(consoleState.handIndex).to.eq(0);
    expect(wrapper.find('.con-hand__empty .con-hand__empty-text').text()).to.eq('No cards in hand');
    expect(wrapper.find('.con-hand__verdictbar').exists(), 'no card under the cursor — no rail').to.eq(false);
  });

  it('the pick bridge hands the shelf back: every closed pick announces its resume, once', async () => {
    const wrapper = mountHand({stage: STAGE, stagePaused: true, handPickOpen: true});
    expect(wrapper.attributes('data-flow'), 'the stage is claimed, a pick has borrowed the shelf').to.eq('picking');
    expect(wrapper.classes()).to.include.members(['con-hand--staged', 'con-hand--stagepaused']);
    expect(wrapper.emitted('pick-resumed'), 'a pick already out at mount is no edge').to.eq(undefined);

    // The pick was answered, the stage stands: the resume phrase runs on the ROOT (no geometry under jsdom — done at once).
    await wrapper.setProps({stagePaused: false, handPickOpen: false});
    await flushPromises();
    expect(wrapper.emitted('pick-resumed')?.length).to.eq(1);

    // A second pick goes out (the pause announces nothing)…
    await wrapper.setProps({stagePaused: true, handPickOpen: true});
    await flushPromises();
    expect(wrapper.emitted('pick-resumed')?.length).to.eq(1);

    // …and the stage CLOSED under it: nothing to resume, the shelf is released at once.
    await wrapper.setProps({stage: undefined, stagePaused: false, handPickOpen: false});
    await flushPromises();
    expect(wrapper.emitted('pick-resumed')?.length).to.eq(2);
    expect(wrapper.attributes('data-flow')).to.eq('browse');
  });

  it('holds the outcome zone of the play it stands in — registered and published while claimed, taken back with the surface', async () => {
    claimWorkspaceOutcome('hand', CardName.AI_CENTRAL, ['draw']);
    const wrapper = mount(ConsoleHandSection, {global: mountGlobal, attachTo: document.body, props: {entries: THREE, index: 0}});
    await flushPromises();

    expect(wrapper.find('.con-hand__stagewrap > .con-hand__outcome[data-outcome-zone]').attributes('data-embed-slot')).to.eq('hand-outcome');
    expect(workspaceOutcomeState.embedSlot, 'the zone is published for the claimed artifact').to.eq(OUTCOME_ZONE);
    expect(embedZoneMounted(OUTCOME_ZONE), 'v-embed-zone registered the node').to.eq(true);

    wrapper.unmount();

    expect(embedZoneMounted(OUTCOME_ZONE), 'the node left the registry').to.eq(false);
    expect(workspaceOutcomeState.embedSlot, 'a slot describes a NODE — it never outlives it').to.eq('');
    expect(workspaceOutcomeState.host, 'a claim never outlives its flow').to.eq(undefined);
  });
});
