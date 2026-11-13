/*
 * ConsolePreludeVariantStep — the prelude's «ВАРИАНТ» step: ONE host-agnostic surface that asks «which variant / which
 * resource / which tile next» before the press. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * what it hands the ONE choice grammar (`ConsoleVariantChoice`) for its props, what it draws in each row's body and
 * beside the rows, and the one event it emits (`pick`, with the row's index). It exposes nothing — the pad is the
 * host's. WHICH rows a play has is the pure model's (`preludeVariantModel.ts`, spec'd on its own): the variants here
 * are written by hand, and the spec asserts what the step makes of them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, PropType} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {printedVariantRows, VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {PreludeVariant, PreludeVariantRow, variantRowReaction} from '@/client/console/preludeVariant/preludeVariantModel';
import ConsolePreludeVariantStep from '@/client/components/console/foundation/ConsolePreludeVariantStep.vue';

// The choice grammar is its own subject (`ConsoleVariantChoice`): the stub keeps what the step HANDS it and draws the
// step's `body` slot once per option, as the real one does.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const ChoiceStub = defineComponent({
  name: 'ConsoleVariantChoice',
  props: {
    options: {type: Array as PropType<ReadonlyArray<VariantChoiceOption>>, required: true},
    layout: {type: String, default: undefined},
    exclusive: {type: Boolean, default: undefined},
    label: {type: String, default: undefined},
  },
  emits: ['pick'],
  setup(props, {slots}) {
    return () => h('div', {class: 'choice-stub'}, props.options.map((option, index) => {
      return h('div', {'class': 'choice-stub__row', 'data-row': String(index)}, slots.body?.({option, index}));
    }));
  },
});

const ChipStub = defineComponent({
  name: 'ActionEffectChip',
  props: ['effect'],
  render: () => h('i', {class: 'chip-stub'}),
});

const ReactionsStub = defineComponent({
  name: 'ConsoleForecastReactions',
  props: ['reaction'],
  render: () => h('i', {class: 'reactions-stub'}),
});

const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: ['control'],
  render: () => h('i', {class: 'glyph-stub'}),
});

const MC: ActionEffect = {direction: 'gain', icon: 'megacredits', amount: 3};
const STEEL: ActionEffect = {direction: 'gain', icon: 'steel', amount: 2};
const CARDS: ActionEffect = {direction: 'gain', icon: 'cards', amount: 2};

function row(position: number, over: Partial<PreludeVariantRow> = {}): PreludeVariantRow {
  return {key: 'r' + position, position, choice: position, branchIndex: position, title: 'Row ' + position, chips: [], available: true, ...over};
}

type StepProps = {variant: PreludeVariant, focus?: number, sealed?: boolean, embedded?: boolean};

function step(props: StepProps) {
  // No i18n plugin on purpose: the component imports its own `$t` — the global one is not there to lean on.
  return mount(ConsolePreludeVariantStep, {
    props,
    global: {
      config: globalConfig.global.config,
      stubs: {ConsoleVariantChoice: ChoiceStub, ActionEffectChip: ChipStub, ConsoleForecastReactions: ReactionsStub, GamepadGlyph: GlyphStub},
    },
  });
}

describe('ConsolePreludeVariantStep — the choice made before the press', () => {
  it('a RESOURCE pre-step: one worded row per lane in one column, the cursor\'s A on its row, each row\'s chips, what every row shares read once', () => {
    const variant: PreludeVariant = {
      card: CardName.FOCUSED_ORGANIZATION,
      kind: 'resource',
      rows: [row(0, {title: 'Megacredits', chips: [MC]}), row(1, {title: 'Steel', chips: [STEEL]}), row(2, {title: 'Titanium'}), row(3, {title: 'Plants'})],
      shared: [CARDS],
    };
    const w = step({variant, focus: 1});

    expect(w.classes(), 'hosted by default — no frame of its own').to.deep.eq(['con-pvariant', 'con-pvariant--embedded']);
    expect(w.attributes('data-prelude-variant')).to.eq('');
    expect(w.attributes('data-prelude-variant-card')).to.eq(CardName.FOCUSED_ORGANIZATION);
    expect(w.attributes('data-prelude-variant-kind')).to.eq('resource');

    const choice = w.findComponent(ChoiceStub);
    expect(choice.classes()).to.include('con-pvariant__choices');
    expect(choice.props('layout')).to.eq('column');
    expect(choice.props('exclusive'), 'four lanes are a palette of rows, not an «or» of three').to.eq(false);
    expect(choice.props('label')).to.eq($t('Resource'));
    const options = choice.props('options');
    expect(options.map((option) => option.key)).to.deep.eq(['r0', 'r1', 'r2', 'r3']);
    expect(options.map((option) => option.title), 'no print to cut — the lanes speak in words').to.deep.eq(['Megacredits', 'Steel', 'Titanium', 'Plants']);
    expect(options.map((option) => option.state)).to.deep.eq([
      {focused: false, selected: false, off: false}, {focused: true, selected: false, off: false},
      {focused: false, selected: false, off: false}, {focused: false, selected: false, off: false},
    ]);
    expect(options.map((option) => option.attrs)).to.deep.eq([0, 1, 2, 3].map((i) => {
      return {'data-prelude-variant-row': String(i), 'data-prelude-variant-branch': String(i)};
    }));
    expect(options.some((option) => 'printed' in option || 'quiet' in option || 'reason' in option)).to.eq(false);

    // The body of each row: the A badge on the cursor's row alone, the row's own chips with the table's answer beside them.
    const bodies = w.findAll('.choice-stub__row');
    expect(bodies.map((body) => body.find('.glyph-stub.con-pvariant__a').exists())).to.deep.eq([false, true, false, false]);
    expect(w.findComponent(GlyphStub).props('control')).to.eq('confirm');
    expect(bodies.map((body) => body.find('.con-pvariant__chips[data-prelude-variant-chips]').exists()), 'a row with nothing of its own draws no line')
      .to.deep.eq([true, true, false, false]);
    expect(bodies.map((body) => body.findAll('.con-pvariant__chips > .chip-stub').length)).to.deep.eq([1, 1, 0, 0]);
    const reactions = w.findAllComponents(ReactionsStub);
    expect(reactions.map((reaction) => reaction.attributes('data-prelude-variant-reaction'))).to.deep.eq(['0', '1']);
    expect(reactions.map((reaction) => reaction.props('reaction'))).to.deep.eq([0, 1].map((i) => variantRowReaction(variant, variant.rows[i], undefined)));

    // What EVERY row brings — once, under the rows.
    const shared = w.find('.con-pvariant > .con-pvariant__shared[data-prelude-variant-shared]');
    expect(shared.find('.con-pvariant__shared-label').text()).to.eq($t('With any resource'));
    expect(shared.findAll('.chip-stub')).to.have.length(1);
    const chips = w.findAllComponents(ChipStub);
    expect(chips.map((chip) => chip.props('effect'))).to.deep.eq([MC, STEEL, CARDS]);
  });

  it('a VARIANT of a real card: the rows are the card\'s PRINTED rows (no words), a maxed row is quiet, a refused row says why', () => {
    const printed = printedVariantRows(getCard(CardName.ATMOSPHERIC_ENHANCERS)?.metadata.renderData, 3);
    expect(printed, 'Atmospheric Enhancers prints its three variants').to.not.eq(undefined);
    const variant: PreludeVariant = {
      card: CardName.ATMOSPHERIC_ENHANCERS,
      kind: 'variant',
      rows: [
        row(0, {title: 'Raise temperature 2 steps'}),
        row(1, {title: 'Raise oxygen 2 steps', notice: 'At its maximum · changes nothing'}),
        row(2, {title: 'Raise Venus 2 steps', available: false, branchIndex: -1, reason: 'Needs ${0}', reasonParams: ['Venus']}),
      ],
      shared: [],
    };
    const w = step({variant, focus: 2});

    expect(w.attributes('data-prelude-variant-kind')).to.eq('variant');
    const choice = w.findComponent(ChoiceStub);
    expect(choice.props('exclusive'), 'three variants are an «or»').to.eq(true);
    expect(choice.props('label')).to.eq($t('Variant'));
    const options = choice.props('options');
    expect(options.map((option) => option.title), 'the print speaks — the words stay out').to.deep.eq(['', '', '']);
    expect(options.map((option) => option.printed)).to.deep.eq([...(printed ?? [])]);
    expect(options.map((option) => option.quiet)).to.deep.eq([undefined, $t('At its maximum · changes nothing'), undefined]);
    expect(options.map((option) => option.reason)).to.deep.eq([undefined, undefined, translateTextWithParams('Needs ${0}', ['Venus'])]);
    expect(options[2].state, 'refused, and SHOWN').to.deep.eq({focused: true, selected: false, off: true});
    expect(options[2].attrs).to.deep.eq({'data-prelude-variant-row': '2', 'data-prelude-variant-branch': '-1'});

    expect(w.findComponent(GlyphStub).exists(), 'the cursor stands on a refused row — nothing to confirm').to.eq(false);
    expect(w.find('.con-pvariant__chips').exists()).to.eq(false);
    expect(w.find('.con-pvariant__shared').exists(), 'nothing is shared — no line').to.eq(false);
  });

  it('a PLACEMENT ORDER: one row per tile with its word, its tile named on the row, a placed tile sealed in place', () => {
    const variant: PreludeVariant = {
      card: CardName.ATMOSPHERIC_ENHANCERS,
      kind: 'placement-order',
      rows: [
        row(0, {title: 'Ocean', tileType: TileType.OCEAN, sealed: true, available: false}),
        row(1, {title: 'City', tileType: TileType.CITY}),
      ],
      shared: [CARDS],
    };
    const w = step({variant});

    expect(w.classes()).to.deep.eq(['con-pvariant', 'con-pvariant--embedded', 'con-pvariant--order']);
    expect(w.attributes('data-prelude-variant-kind')).to.eq('placement-order');
    const choice = w.findComponent(ChoiceStub);
    expect(choice.props('exclusive'), 'an order is not an «or»').to.eq(false);
    expect(choice.props('label')).to.eq($t('Placement'));
    const options = choice.props('options');
    expect(options.map((option) => option.title), 'a tile keeps its WORD').to.deep.eq(['Ocean', 'City']);
    expect(options.map((option) => option.attrs)).to.deep.eq([
      {'data-prelude-variant-row': '0', 'data-prelude-variant-branch': '0', 'data-prelude-variant-tile': 'ocean', 'data-prelude-variant-sealed': ''},
      {'data-prelude-variant-row': '1', 'data-prelude-variant-branch': '1', 'data-prelude-variant-tile': 'city'},
    ]);
    expect(options.map((option) => option.state.off)).to.deep.eq([true, false]);
    expect(w.find('.glyph-stub').exists(), 'the cursor\'s row (the first) is placed already').to.eq(false);
    expect(w.find('.con-pvariant__shared-label').text()).to.eq($t('With any variant'));
  });

  it('the pad is the HOST\'s: the cursor and the seal follow the props, a pick is handed up with its row', async () => {
    const variant: PreludeVariant = {
      card: CardName.FOCUSED_ORGANIZATION,
      kind: 'resource',
      rows: [row(0), row(1), row(2)],
      shared: [],
    };
    const w = step({variant, focus: 0, embedded: false});
    expect(w.classes(), 'standing on its own').to.deep.eq(['con-pvariant']);
    const choice = w.findComponent(ChoiceStub);
    expect(choice.props('options').map((option) => option.state.focused)).to.deep.eq([true, false, false]);
    expect(w.findAll('.choice-stub__row').map((body) => body.find('.glyph-stub').exists())).to.deep.eq([true, false, false]);

    await w.setProps({focus: 2});
    expect(choice.props('options').map((option) => option.state.focused)).to.deep.eq([false, false, true]);
    expect(w.findAll('.choice-stub__row').map((body) => body.find('.glyph-stub').exists())).to.deep.eq([false, false, true]);

    choice.vm.$emit('pick', 2);
    expect(w.emitted('pick')).to.deep.eq([[2]]);

    // The answer is on its way: the seal stands on the cursor's row, and no row offers a press.
    await w.setProps({sealed: true});
    expect(choice.props('options').map((option) => option.state.selected)).to.deep.eq([false, false, true]);
    expect(w.find('.glyph-stub').exists()).to.eq(false);
  });
});
