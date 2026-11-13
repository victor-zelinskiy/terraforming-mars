/*
 * EffectBlock — one SOURCE group of passive effects: the source named once (with its live resource badge), each effect
 * it grants a separately selectable block. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): three
 * props in (`group`, the live `card`, `selectedKey`), two emits (`namehover`, `open`), nothing exposed. Mounted WITHOUT
 * the i18n plugin on purpose: the component imports `$t`, `v-i18n` and `v-strip-effect-prefix` itself, and a Vue
 * warning (an unresolved directive or component) fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import EffectBlock from '@/client/components/effects/EffectBlock.vue';
import {EffectGroup, playerEffectGroups} from '@/client/components/effects/effectExtraction';

// The effect's drawing is the card renderer's own subject; this spec reads which renderer a block takes and what it
// is handed. (Render functions, not template strings: the runtime compiler is not in this build.)
const BoxStub = defineComponent({
  name: 'CardRenderEffectBoxComponent',
  props: ['effectData'],
  render: () => h('i', {class: 'box-stub'}),
});
const DataStub = defineComponent({
  name: 'CardRenderData',
  props: ['renderData'],
  render: () => h('i', {class: 'data-stub'}),
});

function block(props: {group: EffectGroup, card?: CardModel, selectedKey?: string}) {
  return mount(EffectBlock, {
    props,
    global: {config: globalConfig.global.config, stubs: {CardRenderEffectBoxComponent: BoxStub, CardRenderData: DataStub}},
  });
}

/** The real group of a card in play. */
function groupOf(name: CardName): EffectGroup {
  const groups = playerEffectGroups([{name} as CardModel]);
  expect(groups, `${name} grants a passive effect`).to.have.length(1);
  return groups[0];
}

describe('EffectBlock — one source and its passive effects', () => {
  it('names the source ONCE and draws one block per effect — a card, a corporation, a disabled one', () => {
    const nano = groupOf(CardName.CARBON_NANOSYSTEMS);
    const w = block({group: nano});
    expect(w.classes()).to.deep.eq(['effect-group']);
    expect(w.attributes('data-test')).to.eq('effect-block-' + nano.key);
    expect(w.findAll('.effect-group__source').map((s) => s.text()), 'two effects, one name').to.deep.eq([CardName.CARBON_NANOSYSTEMS]);
    expect(w.find('.effect-group__type').text()).to.eq('Card');
    const items = w.findAll('.effect-group__items > .effect-item');
    expect(items.map((item) => item.attributes('data-test'))).to.deep.eq(nano.effects.map((e) => 'effect-item-' + e.key));
    expect(items).to.have.length(2);
    expect(items.every((item) => item.attributes('role') === 'button' && item.attributes('tabindex') === '0')).to.eq(true);

    const corp = block({group: {...groupOf(CardName.THARSIS_REPUBLIC), isDisabled: true}});
    expect(corp.classes()).to.deep.eq(['effect-group', 'effect-group--corp', 'effect-group--disabled']);
    expect(corp.find('.effect-group__type').text()).to.eq('Corporation');
  });

  it('a block takes the renderer of what its effect carries — the effect node, the whole render root, or plain text without its «Effect:» label', () => {
    const real = groupOf(CardName.DECOMPOSERS).effects[0];
    expect(real.effectNode, 'a declarative effect carries its node').to.not.eq(undefined);
    const root = {rows: []};
    const group: EffectGroup = {
      key: 'probe',
      cardName: CardName.DECOMPOSERS,
      isCorporation: false,
      isDisabled: false,
      effects: [
        real,
        {key: 'probe#1', effectIndex: 1, effectNode: undefined, renderRoot: root as unknown as EffectGroup['effects'][number]['renderRoot'], text: undefined, description: undefined},
        {key: 'probe#2', effectIndex: 2, effectNode: undefined, renderRoot: undefined, text: 'Effect: when it rains, gain 1 plant.', description: undefined},
      ],
    };
    const w = block({group});
    const items = w.findAll('.effect-item');
    expect(items.map((item) => item.find('.effect-item__render.card-container').exists())).to.deep.eq([true, true, false]);
    expect(items.map((item) => item.find('.box-stub').exists())).to.deep.eq([true, false, false]);
    expect(items.map((item) => item.find('.data-stub').exists())).to.deep.eq([false, true, false]);
    expect(w.findComponent(BoxStub).props('effectData')).to.deep.eq(real.effectNode);
    expect(w.findComponent(DataStub).props('renderData')).to.deep.eq(root);
    expect(items[2].find('.effect-item__text').text(), 'the label is dropped, the next letter raised').to.eq('When it rains, gain 1 plant.');
  });

  it('the resource badge stands only for a source that HOLDS a resource and has a live model; the selected effect is marked', async () => {
    const decomposers = groupOf(CardName.DECOMPOSERS);
    const resource = getCard(CardName.DECOMPOSERS)?.resourceType;
    expect(resource, 'Decomposers hold a resource').to.not.eq(undefined);

    const w = block({group: decomposers});
    expect(w.find('.effect-group__res').exists(), 'no live model — no badge').to.eq(false);

    await w.setProps({card: {name: CardName.DECOMPOSERS, resources: 3} as CardModel});
    const badge = w.find('.effect-group__res');
    expect(badge.exists()).to.eq(true);
    expect(badge.find('.effect-group__res-count').text()).to.eq('3');
    expect(badge.find('.effect-group__res-icon').classes().join(' ')).to.eq(('effect-group__res-icon ' + iconClassFor(String(resource))).trim());

    // A source that holds nothing shows no badge, model or not.
    const algae = block({group: groupOf(CardName.ARCTIC_ALGAE), card: {name: CardName.ARCTIC_ALGAE, resources: 0} as CardModel});
    expect(algae.find('.effect-group__res').exists()).to.eq(false);

    const nano = groupOf(CardName.CARBON_NANOSYSTEMS);
    const picked = block({group: nano, selectedKey: nano.effects[1].key});
    const items = picked.findAll('.effect-item');
    expect(items.map((item) => item.classes('effect-item--selected'))).to.deep.eq([false, true]);
    expect(items.map((item) => item.attributes('aria-pressed'))).to.deep.eq(['false', 'true']);
  });

  it('emits «namehover» with the effect\'s key on enter / focus and with null on leave / blur, «open» on click and Enter', async () => {
    const nano = groupOf(CardName.CARBON_NANOSYSTEMS);
    const [first, second] = nano.effects.map((e) => e.key);
    const w = block({group: nano});
    const items = w.findAll('.effect-item');

    await items[0].trigger('mouseenter');
    await items[0].trigger('mouseleave');
    await items[1].trigger('focus');
    await items[1].trigger('blur');
    expect(w.emitted('namehover')).to.deep.eq([[first], [null], [second], [null]]);
    expect(w.emitted('open'), 'pointing opens nothing').to.eq(undefined);

    await items[1].trigger('click');
    await items[0].trigger('keydown', {key: 'Enter'});
    await items[0].trigger('keydown', {key: 'a'});
    expect(w.emitted('open')).to.deep.eq([[second], [first]]);
  });
});
