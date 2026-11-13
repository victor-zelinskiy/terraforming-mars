/*
 * ConsoleCardRulesPanel — the stable right-hand rules surface of the console card viewer. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md). WHICH blocks a card states is the pure model's
 * (`consoleCardRulesSuppress.spec.ts`); this spec is the component's own contract: what it renders for its props and
 * its slot, the reading tier and its measured half (an overflow steps the reading denser), the card's order measured
 * on the landed card — through the panel's root ref and an owned wait of the flow kernel (the spec drives the kernel's
 * clock) — and what its parents reach through a ref (the shell's viewer controller through the surface registry, the
 * menu's zoom host, the resolution aside): `scrollBody` and nothing else. So the panel is mounted the way they hold
 * it: under a host with a ref. It emits nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef, VNode} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {actionRuleText} from '@/client/components/actions/actionDescription';
import {CardAnnotation, CardAnnotationKind} from '@/client/components/cardAnnotations/annotationModel';
import {cardRuleAnnotations, RulesLengthTier} from '@/client/components/console/consoleCardRules';
import {CardName} from '@/common/cards/CardName';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';

/** What every parent reads through its ref — the panel's whole contract with them. */
type PanelReach = {scrollBody(delta: number): boolean};

type PanelProps = {
  cardName?: CardName,
  annotationsOverride?: ReadonlyArray<CardAnnotation>,
  nonce?: number,
  closing?: boolean,
  embedded?: boolean,
  suppressIds?: ReadonlyArray<string>,
  keepOrder?: boolean,
  tier?: RulesLengthTier,
};

/** What the panel asked of its scroll area through `ref="scroll"`. */
const scrolled: Array<number> = [];

// The scroll primitive measures layout — its own specs' subject. Here it is the box the body stands in, the source of
// the `overflow-change` verdict, and — through the panel's ref — `scrollByPx` (one of the five functions the real one
// exposes; like the real one it exposes no `overflowing`).
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  props: {axis: String},
  emits: ['overflow-change'],
  methods: {
    scrollByPx(dy: number): void {
      scrolled.push(dy);
    },
  },
  render() {
    return h('div', {'class': 'scroll-stub', 'data-axis': this.axis}, this.$slots.default?.());
  },
});

function block(kind: CardAnnotationKind, order: number, texts: ReadonlyArray<string>, over: Partial<CardAnnotation> = {}): CardAnnotation {
  return {
    id: `group:${kind}`,
    kind,
    labelKey: {'requirement': 'Requirement', 'immediate': 'On play', 'effect': 'Effect', 'action': 'Action', 'victory-points': 'Victory points', 'note': 'Special rule'}[kind],
    rows: texts.map((text, i) => ({id: `${kind}:${i}`, text, special: false, anyPlayer: false})),
    special: false,
    anyPlayer: false,
    graphicId: `g-${kind}`,
    order,
    ...over,
  };
}

/** Three short blocks, given in an order that is NOT the card's: a note, an effect, a requirement. */
function threeBlocks(): Array<CardAnnotation> {
  return [
    block('note', 0, ['Counts as a city.'], {special: true}),
    block('effect', 1, ['Gain 1 plant.']),
    block('requirement', 2, ['Requires 2 oceans.']),
  ];
}

function mountUnderHost(first: PanelProps, slot?: (scope: {group: CardAnnotation, tier: RulesLengthTier}) => VNode) {
  const props = shallowRef(first);
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleCardRulesPanel, {ref: 'rules', ...props.value}, slot === undefined ? undefined : {'group-extra': slot})]),
  });
  const wrapper = mount(Host, {
    ...globalConfig,
    attachTo: document.body,
    global: {...globalConfig.global, stubs: {ConsoleScrollArea: ScrollStub}},
  });
  return {
    wrapper,
    props,
    reach: (): PanelReach => {
      const panel = (wrapper.vm.$refs.rules ?? undefined) as PanelReach | undefined;
      if (panel === undefined) {
        throw new Error('the host holds no ref to the panel');
      }
      return panel;
    },
    scroll: () => wrapper.findComponent(ScrollStub),
    /** The groups in the order they read, by their stable ids. */
    order: () => wrapper.findAll('.con-zoom-rules__group').map((group) => group.attributes('data-rules-group')),
    /** The reading tier the panel wears. */
    tier: () => wrapper.find('.con-zoom-rules').classes().filter((c) => c.startsWith('con-zoom-rules--')).map((c) => c.replace('con-zoom-rules--', '')),
  };
}

describe('ConsoleCardRulesPanel — the card viewer\'s rules surface', () => {
  let clock: ManualFlowClock;
  let stage: HTMLElement | undefined;

  /** The landed card, as the viewer stands it: `.con-zoom .card-zoom-stage` with one graphic row per `[id, y]`. */
  function landCard(rows: ReadonlyArray<[string, number]>): void {
    stage = document.createElement('div');
    stage.className = 'con-zoom';
    const inner = document.createElement('div');
    inner.className = 'card-zoom-stage';
    for (const [id, top] of rows) {
      const row = document.createElement('div');
      row.setAttribute('data-graphic-id', id);
      row.getBoundingClientRect = () => ({top, height: 20, left: 0, width: 100, right: 100, bottom: top + 20, x: 0, y: top, toJSON: () => ({})});
      inner.appendChild(row);
    }
    stage.appendChild(inner);
    document.body.appendChild(stage);
  }

  /** Two frames of the kernel's clock: the landed card's layout commits before the rules measure. */
  function settleMeasure(): Promise<void> {
    clock.advance(48);
    return nextTick();
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    scrolled.length = 0;
  });
  afterEach(() => {
    setFlowClock(undefined);
    stage?.remove();
    stage = undefined;
  });

  it('renders the blocks it was given in the CARD\'s order: a head, a group per block with its kind chip, the rows read as sentences', () => {
    const {wrapper, scroll, order, tier} = mountUnderHost({annotationsOverride: threeBlocks()});
    const root = wrapper.find('.con-zoom-rules-host');
    expect((wrapper.element as Element).firstElementChild, 'the panel is one element').to.eq(root.element);
    expect(root.classes()).to.deep.eq(['con-zoom-rules-host']);
    expect(root.find('aside.con-zoom-rules').attributes('aria-label')).to.eq('Rules');
    expect(root.find('.con-zoom-rules__head .con-zoom-rules__title').text()).to.eq($t('Rules'));
    expect(scroll().classes()).to.include('con-zoom-rules__scroll');
    expect(scroll().attributes('data-axis')).to.eq('y');

    // No measurable anchors (no landed card): the canonical card order — requirement → effect → … → note.
    expect(order()).to.deep.eq(['group:requirement', 'group:effect', 'group:note']);
    const groups = root.findAll('.con-zoom-rules__group');
    expect(groups.map((group) => group.classes().filter((c) => c !== 'con-zoom-rules__group')))
      .to.deep.eq([['con-zoom-rules__group--requirement'], ['con-zoom-rules__group--effect'], ['con-zoom-rules__group--note']]);
    expect(groups.map((group) => group.find('.con-zoom-rules__kind').text().replace(/\s+/g, ' ')))
      .to.deep.eq([$t('Requirement'), $t('Effect'), `✱ ${$t('Special rule')}`]);
    expect(groups.map((group) => group.find('.con-zoom-rules__spark').exists()), 'the «*» footnote marks its chip').to.deep.eq([false, false, true]);
    expect(groups.map((group) => group.findAll('.con-zoom-rules__text').map((row) => row.text())))
      .to.deep.eq([[actionRuleText('Requires 2 oceans.')], [actionRuleText('Gain 1 plant.')], [actionRuleText('Counts as a city.')]]);
    expect(tier(), 'a short reading reads roomier').to.deep.eq(['brief']);
  });

  it('follows its props: `embedded` drops the head, `closing` hides the host, `keepOrder` reads as given, a host\'s `tier` wins, a parameterised row interpolates', async () => {
    const {wrapper, props, order, tier} = mountUnderHost({annotationsOverride: threeBlocks(), embedded: true, closing: true, keepOrder: true, tier: 'dense'});
    const root = wrapper.find('.con-zoom-rules-host');
    expect(root.classes()).to.include.members(['con-zoom-rules-host--closing', 'con-zoom-rules-host--embedded']);
    expect(root.find('.con-zoom-rules__head').exists(), 'the dossier\'s tab bar replaces it').to.eq(false);
    expect(order(), 'the order given IS the meaning').to.deep.eq(['group:note', 'group:effect', 'group:requirement']);
    expect(tier(), 'one type size for a scene of several panels').to.deep.eq(['dense']);

    const row = {id: 'effect:0', text: 'Gain ${0} plants.', params: ['3'], special: false, anyPlayer: false};
    props.value = {annotationsOverride: [block('effect', 0, [], {rows: [row]})]};
    await nextTick();
    expect(root.classes()).to.deep.eq(['con-zoom-rules-host']);
    expect(root.find('.con-zoom-rules__head').exists()).to.eq(true);
    expect(root.findAll('.con-zoom-rules__text').map((p) => p.text())).to.deep.eq([actionRuleText('Gain ${0} plants.', ['3'])]);
    expect(root.find('.con-zoom-rules__text').text()).to.include('3');
  });

  it('reads a manifest card\'s own blocks — minus what the availability panel beside it already states', async () => {
    const all = cardRuleAnnotations(CardName.LIVESTOCK);
    const {props, order} = mountUnderHost({cardName: CardName.LIVESTOCK});
    expect(order().slice().sort()).to.deep.eq(all.map((a) => a.id).sort());
    expect(all.map((a) => a.kind)).to.include('requirement');

    props.value = {cardName: CardName.LIVESTOCK, suppressIds: ['req:O2']};
    await nextTick();
    expect(order().slice().sort(), 'the requirement is never printed twice').to.deep.eq(all.filter((a) => a.kind !== 'requirement').map((a) => a.id).sort());

    props.value = {};
    await nextTick();
    expect(order(), 'no card, no blocks').to.deep.eq([]);
  });

  it('a host\'s LIVE reading stands inside its group, handed the group and the tier', () => {
    const {wrapper} = mountUnderHost({annotationsOverride: threeBlocks()}, ({group, tier}) => h('i', {class: 'extra'}, `${group.id}@${tier}`));
    expect(wrapper.findAll('.con-zoom-rules__group').map((group) => group.find('.extra').text()))
      .to.deep.eq(['group:requirement@brief', 'group:effect@brief', 'group:note@brief']);
  });

  it('a PARENT\'s ref sees `scrollBody` and nothing else', () => {
    const panel = mountUnderHost({annotationsOverride: threeBlocks()}).reach();
    expect(Object.keys(panel), 'exactly what the panel exposes').to.deep.eq(['scrollBody']);
    expect(panel.scrollBody).to.be.a('function');
    const leaked = ['overflowing', 'fitSteps', 'measuredOrder', 'lengthTier', 'measure', 'scheduleMeasure', 'fitDenser', 'onOverflow']
      .filter((key) => (panel as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('an overflow first steps the reading DENSER, one rung per verdict and never past `packed`; `scrollBody` pages only a body that overflows', async () => {
    const {reach, scroll, tier} = mountUnderHost({annotationsOverride: threeBlocks()});
    expect(reach().scrollBody(40), 'nothing to scroll — the caller keeps the stick').to.eq(false);
    expect(scrolled).to.deep.eq([]);

    scroll().vm.$emit('overflow-change', true);
    await nextTick();
    expect(tier()).to.deep.eq(['regular']);
    expect(reach().scrollBody(40)).to.eq(true);
    expect(scrolled, 'through the panel\'s ref on its scroll area').to.deep.eq([40]);

    scroll().vm.$emit('overflow-change', true);
    scroll().vm.$emit('overflow-change', true);
    scroll().vm.$emit('overflow-change', true);
    await nextTick();
    expect(tier(), 'the reading floor is a floor').to.deep.eq(['packed']);

    scroll().vm.$emit('overflow-change', false);
    await nextTick();
    expect(tier(), 'never back up — a denser rung only fits better').to.deep.eq(['packed']);
    expect(reach().scrollBody(-40)).to.eq(false);
    expect(scrolled).to.deep.eq([40]);
  });

  it('a NEW reading starts from its own length tier again — the fit steps were measured for the old one', async () => {
    const {props, scroll, tier} = mountUnderHost({annotationsOverride: threeBlocks()});
    scroll().vm.$emit('overflow-change', true);
    scroll().vm.$emit('overflow-change', true);
    await nextTick();
    expect(tier()).to.deep.eq(['dense']);

    props.value = {annotationsOverride: [block('effect', 0, ['Gain 1 plant.'])]};
    await nextTick();
    expect(tier()).to.deep.eq(['brief']);
  });

  it('once the card has LANDED the blocks read top-to-bottom like the card; a browse step drops the stale order; a closing panel measures nothing', async () => {
    const {props, order} = mountUnderHost({annotationsOverride: threeBlocks(), nonce: 0});
    await settleMeasure();
    expect(order(), 'no landed card to measure — the canonical order stands').to.deep.eq(['group:requirement', 'group:effect', 'group:note']);

    // The card lands with the note's row on top, the effect under it, the requirement at the bottom.
    landCard([['g-note', 10], ['g-effect', 100], ['g-requirement', 200]]);
    props.value = {annotationsOverride: props.value.annotationsOverride, nonce: 1};
    await nextTick();
    expect(order(), 'the settle signal only SCHEDULES the measure').to.deep.eq(['group:requirement', 'group:effect', 'group:note']);
    await settleMeasure();
    expect(order()).to.deep.eq(['group:note', 'group:effect', 'group:requirement']);

    // A browse step re-points the panel before the slide settles: the stale order goes at once.
    props.value = {annotationsOverride: props.value.annotationsOverride, nonce: 1, cardName: CardName.BIRDS};
    await nextTick();
    expect(order()).to.deep.eq(['group:requirement', 'group:effect', 'group:note']);

    // The close flight began: the panel never lags the departing card — the next settle measures nothing.
    props.value = {annotationsOverride: props.value.annotationsOverride, nonce: 2, cardName: CardName.BIRDS, closing: true};
    await nextTick();
    await settleMeasure();
    expect(order()).to.deep.eq(['group:requirement', 'group:effect', 'group:note']);
  });
});
