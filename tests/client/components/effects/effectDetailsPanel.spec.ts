/*
 * EffectDetailsPanel — the per-effect detail panel the «сработал эффект» modal (EffectDetailOverlay) hosts. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): seven props in, one emit (`open`, raised by the
 * template's `$emit` only), nothing exposed. It brings its own `$t`, `v-i18n` and the dual `v-strip-effect-prefix`
 * (R17 — re-pointed from the Options-form object of hooks), so no mount below hands it a translator or a directive —
 * and a Vue warning fails the test. The summary's numbers are `effectSummary`'s (specs of its own); this one is the
 * panel: what it renders for its props, that it follows them, what it emits.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {EffectEntry, playerEffects} from '@/client/components/effects/effectExtraction';
import {emptyEffectOverlayStat} from '@/client/components/effects/effectSummary';
import EffectDetailsPanel from '@/client/components/effects/EffectDetailsPanel.vue';

// The heavy children are read for what the panel HANDS them (render functions: the runtime compiler is not in this build).
const CardStub = defineComponent({
  name: 'CardFace',
  props: {card: {type: Object, default: undefined}},
  render: () => h('i', {class: 'card-stub'}),
});
const EffectBoxStub = defineComponent({
  name: 'CardRenderEffectBoxComponent',
  props: {effectData: {type: Object, default: undefined}},
  render: () => h('i', {class: 'effect-box-stub'}),
});
const RenderDataStub = defineComponent({
  name: 'CardRenderData',
  props: {renderData: {type: Object, default: undefined}},
  render: () => h('i', {class: 'render-data-stub'}),
});

type PanelProps = {
  entry?: EffectEntry,
  effectCount?: number,
  siblingIcons?: ReadonlyArray<string>,
  stat?: EffectOverlayStat,
  card?: CardModel,
  loading?: boolean,
  measuring?: boolean,
};

const stubs = {Card: CardStub, CardRenderEffectBoxComponent: EffectBoxStub, CardRenderData: RenderDataStub};

function panel(props: PanelProps = {}) {
  return mount(EffectDetailsPanel, {
    props,
    global: {stubs, config: globalConfig.global.config},
  });
}

/** The (first) passive effect of a card standing in a tableau — the entry the overlay hands the panel. */
function effectOf(card: CardModel): EffectEntry {
  const [entry] = playerEffects([card]);
  expect(entry, `${card.name} has a passive effect`).to.not.eq(undefined);
  return entry;
}

describe('EffectDetailsPanel — the detail of one passive effect', () => {
  const PETS = {name: CardName.PETS, resources: 3} as CardModel;

  it('with no effect selected it is the placeholder, and nothing else', () => {
    const w = panel();

    expect(w.element.nodeType, 'the template starts with its root').to.eq(1);
    expect(w.classes()).to.deep.eq(['effect-detail', 'effect-detail--empty']);
    expect(w.find('.effect-detail__placeholder-text').text()).to.eq('Select an effect to see details');
    expect(w.find('.effect-detail__scroll').exists()).to.eq(false);
    expect(w.findComponent(CardStub).exists()).to.eq(false);
  });

  it('frames the selected effect: its card, its graphic, its own description without the label, the card\'s live resource', () => {
    const entry = effectOf(PETS);
    const w = panel({entry, card: PETS});

    expect(w.classes()).to.deep.eq(['effect-detail']);
    expect(w.find('.effect-detail__type').text()).to.eq('Card');
    expect(w.find('.effect-detail__ord').exists(), 'a single-effect card carries no ordinal').to.eq(false);
    expect(w.find('.effect-detail__name').text()).to.eq('Pets');
    expect(w.find('.effect-detail__zoom').attributes('aria-label')).to.eq('Open fullscreen');

    // The card holds animals: the chip reads the LIVE count off the tableau model.
    expect(w.find('.effect-detail__res').exists()).to.eq(true);
    expect(w.find('.effect-detail__res-count').text()).to.eq('3');

    // The effect's own graphic — the render node, handed to the effect box.
    expect(entry.effectNode, 'Pets draws its effect as an effect() box').to.not.eq(undefined);
    expect(w.findComponent(EffectBoxStub).props('effectData'), 'test-utils hands props over as a reactive view — by value').to.deep.eq(entry.effectNode);
    expect(w.findComponent(RenderDataStub).exists()).to.eq(false);

    // The description is the effect's own, shown without the DSL's «Effect: » label (the imported dual directive).
    expect(entry.description, 'the DSL bakes the label in').to.match(/^Effect: /);
    const shown = w.find('.effect-detail__desc').text();
    expect(shown.startsWith('Effect:'), shown).to.eq(false);
    const rest = (entry.description ?? '').slice('Effect: '.length);
    expect(shown).to.eq(rest.charAt(0).toUpperCase() + rest.slice(1));

    // The source card is the live tableau model.
    expect(w.findComponent(CardStub).props('card')).to.deep.eq(PETS);
  });

  it('follows its props: the summary of this game, the loading skeleton, the measuring spacer, the ordinal of a multi-effect card', async () => {
    const entry = effectOf(PETS);
    const w = panel({entry, loading: true});

    // Loading with nothing yet: the skeleton, never a dead panel — and with no tableau model the source falls back to the name.
    expect(w.find('.effect-detail__skeleton').exists()).to.eq(true);
    expect(w.findComponent(CardStub).props('card')).to.deep.eq({name: CardName.PETS});
    expect(w.find('.effect-detail__res-count').text(), 'no live model — no resources to count').to.eq('0');

    // The aggregate arrived: the summary of this game takes the skeleton's place.
    const stat: EffectOverlayStat = {...emptyEffectOverlayStat(CardName.PETS, 'card'), triggerCount: 4};
    await w.setProps({stat, card: PETS, loading: false});
    expect(w.find('.effect-detail__skeleton').exists()).to.eq(false);
    expect(w.find('.effect-detail__metric-label').text()).to.eq('Times triggered');
    expect(w.find('.effect-detail__metric-value').text(), 'the stat\'s own count').to.eq('4');
    expect(w.find('.effect-detail__res-count').text()).to.eq('3');

    // The hidden height probe renders a spacer instead of the heavy card.
    await w.setProps({measuring: true});
    expect(w.find('.effect-detail__source-spacer').exists()).to.eq(true);
    expect(w.findComponent(CardStub).exists()).to.eq(false);

    // One effect of several: the head says which.
    await w.setProps({measuring: false, effectCount: 3});
    expect(w.find('.effect-detail__ord').text()).to.eq(`${entry.effectIndex + 1}/3`);

    // …and back to no selection.
    await w.setProps({entry: undefined});
    expect(w.classes()).to.include('effect-detail--empty');
  });

  it('a corporation\'s effect wears its own accent and type', () => {
    const [entry] = playerEffects([{name: CardName.THARSIS_REPUBLIC} as CardModel]);
    expect(entry?.isCorporation, 'Tharsis Republic\'s standing effect').to.eq(true);
    const w = panel({entry});

    expect(w.classes()).to.deep.eq(['effect-detail', 'effect-detail--corp']);
    expect(w.find('.effect-detail__type').text()).to.eq('Corporation');
    expect(w.find('.effect-detail__res').exists(), 'no resource on this card — no chip').to.eq(false);
  });

  it('emits «open» with the card from the ⤢ button and from the source card — and exposes nothing to a parent', async () => {
    const entry = effectOf(PETS);
    const Host = defineComponent({
      render() {
        return h('div', [h(EffectDetailsPanel, {ref: 'panel', entry})]);
      },
    });
    const host = mount(Host, {global: {stubs, config: globalConfig.global.config}});
    const w = host.findComponent(EffectDetailsPanel);

    await w.find('.effect-detail__zoom').trigger('click');
    await w.find('.effect-detail__source-card').trigger('click');
    expect(w.emitted('open')).to.deep.eq([[CardName.PETS], [CardName.PETS]]);

    expect(Object.keys(host.vm.$refs.panel as object), 'no defineExpose: no parent stands a ref on it').to.deep.eq([]);
  });
});
