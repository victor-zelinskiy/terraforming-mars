/*
 * ConsoleVenusBonusStep — the Venus bonus as the composers' INNER step (P89 · ledger EM): the shared wild-resource
 * step on one level, the console's target selector on the level under it («на карту» is a level of its own). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its three hosts (the play sheet, the blue
 * action's setup, the colony trade's stage) stand it under `ref="venusStep"` and drive the nested pick THROUGH THAT
 * REF — so the spec mounts it the way they do, under a host with a string ref, inside a workspace band (the pick
 * measures its room against `[data-ws-band]`), and reads what the ref carries. The two levels' own components are
 * stubbed by name: this wrapper's job is what it HANDS them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel, VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import {$t} from '@/client/directives/i18n';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {PlayedTargetFocus, PlayedTargetModel, PlayedTargetNavDir} from '@/client/console/played/consolePlayedTargetModel';
import {VenusBonusParts, venusStepReading} from '@/client/console/venusBonus/venusBonusPreselect';
import {VenusInnerFocus} from '@/client/console/venusBonus/venusBonusInner';
import {WildChoiceSpec} from '@/client/console/wildChoice/wildChoiceInner';
import ConsoleVenusBonusStep from '@/client/components/console/foundation/ConsoleVenusBonusStep.vue';

/** What a host reads through its ref — the component's whole contract with its parents (`VenusBonusStepApi`). */
type StepReach = {
  pickNav(dir: PlayedTargetNavDir): void,
  pickTurn(delta: number): void,
  pickFocused(): CardName | undefined,
  pickInspect(): void,
};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const WildStub = defineComponent({
  name: 'ConsoleWildChoiceStep',
  props: {
    spec: {type: Object, required: true},
    parts: {type: Object, required: true},
    focus: {type: Object, required: true},
    stock: {type: Object, default: undefined},
    venus: Boolean,
    head: {type: Object, default: undefined},
    orTitle: {type: String, default: ''},
    candidates: {type: Array, default: undefined},
    vpBox: {type: Object, default: undefined},
  },
  render: () => h('i', {class: 'wild-stub'}),
});

/** What the wrapper asked of the mounted selector through its `pickStep` ref. */
let asked: Array<string> = [];
const TargetStub = defineComponent({
  name: 'ConsolePlayedTargetStep',
  props: {
    model: {type: Object, required: true},
    layout: {type: Object, required: true},
    focus: {type: Object, required: true},
    selection: {type: Object, default: undefined},
    bandHeight: {type: Number, default: 0},
    lockedCard: {type: String, default: ''},
    hostStatesAsk: Boolean,
  },
  methods: {
    /** The selector's own page-aware step — the wrapper prefers it to the measured boxes. */
    navigate(focus: PlayedTargetFocus, dir: PlayedTargetNavDir): PlayedTargetFocus | undefined {
      asked.push(`navigate:${dir}`);
      return dir === 'right' ? {ownerId: focus.ownerId, index: focus.index + 1} : undefined;
    },
    turnPage(focus: PlayedTargetFocus, delta: number): PlayedTargetFocus {
      asked.push(`turnPage:${delta}`);
      return {ownerId: focus.ownerId, index: 0};
    },
    cells(): ReadonlyArray<never> {
      return [];
    },
    ensureFocusVisible(): void {
      asked.push('ensureFocusVisible');
    },
  },
  render: () => h('i', {class: 'target-stub'}),
});

const HOLDERS: ReadonlyArray<CardName> = [CardName.DIRIGIBLES, CardName.AERIAL_MAPPERS];
const CARDS: ReadonlyArray<CardModel> = [
  {name: CardName.DIRIGIBLES, resources: 2} as unknown as CardModel,
  {name: CardName.AERIAL_MAPPERS, resources: 0} as unknown as CardModel,
];
const FINAL: VenusBonusPromptMeta = {
  kind: 'final',
  baseCount: 1,
  step: {from: 28, to: 30},
  wildCardTargets: HOLDERS,
  wildCardVp: {[CardName.AERIAL_MAPPERS]: {from: 1, to: 2}},
};

/** The 30 % finish as the server asks it: `OrOptions(AndOptions(SelectCard, and), and)` + the marker. */
function finalPrompt(): PlayerInputModel {
  return {
    type: 'or',
    title: 'Venus bonus',
    buttonLabel: 'Save',
    options: [
      {type: 'and', options: [
        {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', cards: CARDS, min: 1, max: 1},
        {type: 'and', options: []},
      ]},
      {type: 'and', options: []},
    ],
    venusBonusPrompt: FINAL,
  } as unknown as PlayerInputModel;
}

/** A standard step: no wild, no card — a top-level `AndOptions`. */
function standardPrompt(meta: VenusBonusPromptMeta): PlayerInputModel {
  return {type: 'and', title: 'Venus bonus', buttonLabel: 'Save', options: [], venusBonusPrompt: meta} as unknown as PlayerInputModel;
}

type StepProps = {
  input: PlayerInputModel,
  parts: VenusBonusParts,
  focus: VenusInnerFocus,
  stock?: Partial<Record<string, number>>,
  viewer?: {name: string, color: string},
};

function mountUnderHost(initial: StepProps) {
  const Host = defineComponent({
    props: {step: {type: Object, required: true}},
    render() {
      // The band the pick measures its room against — the hosts' own workspace band.
      return h('div', {'data-ws-band': ''}, [h(ConsoleVenusBonusStep, {ref: 'venusStep', ...(this.step as StepProps)})]);
    },
  });
  const wrapper = mount(Host, {
    ...globalConfig,
    props: {step: initial},
    global: {...globalConfig.global, stubs: {ConsoleWildChoiceStep: WildStub, ConsolePlayedTargetStep: TargetStub}},
  });
  return {
    wrapper,
    root: () => wrapper.find('.con-venusstep'),
    wild: () => wrapper.findComponent(WildStub),
    target: () => wrapper.findComponent(TargetStub),
    /** Exactly the hosts' read: `venusStep.value ?? undefined`. */
    reach: (): StepReach => {
      const step = (wrapper.vm.$refs.venusStep ?? undefined) as StepReach | undefined;
      if (step === undefined) {
        throw new Error('the host holds no ref to the Venus step');
      }
      return step;
    },
    /** The pick measures in the tick after it is entered, and the selector mounts on what it measured. */
    settle: async () => {
      await nextTick();
      await nextTick();
    },
  };
}

describe('ConsoleVenusBonusStep — the Venus bonus as a composer\'s inner step', () => {
  beforeEach(() => {
    asked = [];
    closeConsoleCardZoom();
  });

  afterEach(() => {
    closeConsoleCardZoom();
  });

  it('the STEP level: states the bonus to the shared wild-resource step — its head, the 30 % finish, the spec, the live candidates', () => {
    const parts: VenusBonusParts = {wild: {wild: 'onCard'}};
    const focus: VenusInnerFocus = {zone: 'card', index: 0};
    const {root, wild, target, wrapper} = mountUnderHost({input: finalPrompt(), parts, focus, stock: {megacredits: 40}});

    expect(root().classes()).to.deep.eq(['con-venusstep']);
    expect(root().attributes('data-venus-level')).to.eq('step');
    expect(wrapper.find('[data-venus-pick]').exists(), 'the pick is a level of its own — not entered').to.eq(false);
    expect(target().exists()).to.eq(false);

    expect(wild().classes()).to.include('con-venusstep__level');
    expect((wild().element as HTMLElement).style.display, 'the step is on stage').to.eq('');
    expect(wild().props('head')).to.deep.eq({title: 'Venus bonus', reading: venusStepReading(FINAL)});
    expect(wild().props('orTitle')).to.eq('Final step · 30 %');
    expect(wild().props('venus')).to.eq(true);
    expect(wild().props('parts')).to.deep.eq(parts);
    expect(wild().props('focus')).to.deep.eq(focus);
    expect(wild().props('stock')).to.deep.eq({megacredits: 40});
    expect(wild().props('candidates'), 'the server\'s own models, verbatim').to.deep.eq(CARDS);
    expect(wild().props('vpBox')).to.deep.eq(FINAL.wildCardVp);
    const spec = wild().props('spec') as WildChoiceSpec;
    expect(spec.holders).to.deep.eq(HOLDERS);
    expect(spec.or, 'the 30 % finish with a holder asks the OR').to.not.eq(undefined);
    expect([spec.lanes, spec.exclusive, spec.nestedPick]).to.deep.eq(['dial', false, true]);
    expect([spec.amount('onCard'), spec.amount('asStandard')], 'the wild joins the spread once declined').to.deep.eq([1, 2]);
  });

  it('a standard step asks no OR and names no card — and a prompt with no marker still draws an empty dial', async () => {
    const meta: VenusBonusPromptMeta = {kind: 'standard', baseCount: 2, step: {from: 16, to: 18}};
    const {wild, wrapper} = mountUnderHost({input: standardPrompt(meta), parts: {}, focus: {zone: 'lane', index: 0}});
    const spec = () => wild().props('spec') as WildChoiceSpec;
    expect(spec().or).to.eq(undefined);
    expect(spec().holders).to.deep.eq([]);
    expect(spec().amount(undefined)).to.eq(2);
    expect(wild().props('head')).to.deep.eq({title: 'Venus bonus', reading: venusStepReading(meta)});
    expect(wild().props('candidates')).to.deep.eq([]);
    expect(wild().props('vpBox')).to.deep.eq({});
    expect(wild().props('stock'), 'no stock handed in — an empty box, never undefined').to.deep.eq({});

    // It FOLLOWS its prompt: the marker gone, the spec is the neutral one.
    await wrapper.setProps({step: {input: {type: 'and', options: []} as unknown as PlayerInputModel, parts: {}, focus: {zone: 'lane', index: 0}}});
    expect(spec().amount(undefined)).to.eq(0);
    expect(spec().holders).to.deep.eq([]);
    expect(wild().props('head')).to.deep.eq({title: 'Venus bonus', reading: ''});
  });

  it('the PICK level: the step steps aside, the head stays, the selector takes the measured column with the cursor seated — and B\'s way back follows the focus', async () => {
    const step: StepProps = {input: finalPrompt(), parts: {wild: {wild: 'onCard'}}, focus: {zone: 'pick', index: 0}, viewer: {name: 'Alice', color: 'blue'}};
    const {root, wild, target, wrapper, settle} = mountUnderHost(step);
    await settle();

    expect(root().attributes('data-venus-level')).to.eq('pick');
    expect((wild().element as HTMLElement).style.display, 'the step releases in place — hidden, never unmounted').to.eq('none');
    const zone = wrapper.find('[data-venus-pick]');
    expect(zone.classes()).to.include.members(['con-venusstep__level', 'con-venusstep__pick']);
    expect(zone.find('.con-wildstep__title').text()).to.eq($t('Venus bonus'));
    expect(zone.find('.con-wildstep__reading').text()).to.eq(venusStepReading(FINAL));
    expect(zone.find('.con-venusstep__pick-ask').text()).to.eq($t('Choose a card for the wild resource'));

    // The selector: the 30 % finish's holders as ONE model, the box the pick measured, the cursor on the first card.
    expect(target().exists(), 'the room was measured against the band').to.eq(true);
    const model = target().props('model') as PlayedTargetModel;
    const names = model.owners.flatMap((owner) => owner.candidates.map((c) => c.cardName));
    expect([...names].sort()).to.deep.eq([...HOLDERS].sort());
    expect(model.owners.map((owner) => owner.name), 'the holders are the viewer\'s').to.deep.eq(['Alice']);
    expect(target().props('focus')).to.deep.eq({ownerId: model.owners[0].id, index: 0});
    expect(target().props('selection')).to.deep.eq({mode: 'single'});
    expect(target().props('bandHeight')).to.be.greaterThan(0);
    expect(target().props('lockedCard'), 'no card chosen yet').to.eq('');
    expect(target().props('hostStatesAsk')).to.eq(true);
    expect(zone.attributes('data-venus-pick-focused')).to.eq(names[0]);

    // Back at the door: the pick leaves, the step is on stage again.
    await wrapper.setProps({step: {...step, focus: {zone: 'card', index: 0}}});
    expect(root().attributes('data-venus-level')).to.eq('step');
    expect(wrapper.find('[data-venus-pick]').exists()).to.eq(false);
    expect((wild().element as HTMLElement).style.display).to.eq('');

    // Entered again with a card already chosen: the cursor is seated ON it, and the selector is told which one.
    const chosen = names[1];
    await wrapper.setProps({step: {...step, parts: {wild: {wild: 'onCard', card: chosen}}, focus: {zone: 'pick', index: 0}}});
    await settle();
    expect(wrapper.find('[data-venus-pick]').attributes('data-venus-pick-focused')).to.eq(chosen);
    expect(target().props('lockedCard')).to.eq(chosen);
  });

  it('a HOST\'s ref sees the four doors of the pick and nothing else; through them the d-pad, the page turn, A\'s answer and X reach the selector', async () => {
    const {reach, target, wrapper, settle} = mountUnderHost({input: finalPrompt(), parts: {wild: {wild: 'onCard'}}, focus: {zone: 'pick', index: 0}});
    await settle();
    const step = reach();
    expect(Object.keys(step).sort(), 'exactly what the step exposes').to.deep.eq(['pickFocused', 'pickInspect', 'pickNav', 'pickTurn']);
    const leaked = ['pickFocusRaw', 'pickW', 'pickH', 'pickModel', 'pickLayout', 'seatPick', 'measurePick', 'armPickMeasure', 'root', 'pickZone', 'pickStep']
      .filter((key) => (step as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    const model = target().props('model') as PlayedTargetModel;
    const names = model.owners.flatMap((owner) => owner.candidates.map((c) => c.cardName));
    const focused = () => wrapper.find('[data-venus-pick]').attributes('data-venus-pick-focused');

    expect(step.pickFocused(), 'A\'s answer is the focused, choosable card').to.eq(names[0]);

    // The d-pad: the selector's own page-aware step moves the cursor and is asked to keep it in view.
    step.pickNav('right');
    await nextTick();
    expect(asked).to.deep.eq(['navigate:right', 'ensureFocusVisible']);
    expect(step.pickFocused()).to.eq(names[1]);
    expect(focused()).to.eq(names[1]);
    expect(target().props('focus')).to.deep.eq({ownerId: model.owners[0].id, index: 1});

    // A wall is a hold: nothing moves, nothing is scrolled.
    step.pickNav('down');
    await nextTick();
    expect(asked).to.deep.eq(['navigate:right', 'ensureFocusVisible', 'navigate:down']);
    expect(step.pickFocused()).to.eq(names[1]);

    // The bumpers: the band's page turn hands back the cursor of the new page.
    asked = [];
    step.pickTurn(1);
    await nextTick();
    expect(asked).to.deep.eq(['turnPage:1', 'ensureFocusVisible']);
    expect(step.pickFocused()).to.eq(names[0]);

    // X: the focused card fullscreen, through the ONE zoom pipeline.
    expect(consoleCardZoom.card).to.eq(undefined);
    step.pickInspect();
    expect(consoleCardZoom.card?.name).to.eq(names[0]);
  });

  it('outside the pick the doors answer «nothing»: no page to turn, and X opens no viewer for a prompt with no holder', async () => {
    const meta: VenusBonusPromptMeta = {kind: 'standard', baseCount: 2};
    const {reach, settle} = mountUnderHost({input: standardPrompt(meta), parts: {}, focus: {zone: 'lane', index: 0}});
    await settle();
    const step = reach();
    expect(step.pickFocused()).to.eq(undefined);
    step.pickNav('right');
    step.pickTurn(1);
    step.pickInspect();
    expect(asked, 'no selector is mounted — nothing was asked of one').to.deep.eq([]);
    expect(consoleCardZoom.card).to.eq(undefined);
  });
});
