/*
 * ConsoleActionConfirm — the quick wheel's confirm: «Пас» with what it leaves unused, a conversion with the server's
 * formula, and the «Сработает» row as the DOOR of the R3 «Эффекты» layer. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): the shell's pad router reaches it through the surface registry, so what a holder of
 * its ref gets is ONLY what it exposes — `openForecastLayer` (R3 on the plate) and `forecastIntent` (the pad while
 * the layer is open). The RX35 reading of its formula stands in `divertedTerraforming.spec.ts`.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {effectForecastOpen, resetEffectForecastUi} from '@/client/console/consoleEffectForecast';
import {resetForecastFocusMotion} from '@/client/console/consoleForecastFocusMotion';
import ConsoleActionConfirm from '@/client/components/console/ConsoleActionConfirm.vue';

/** What the hosted layer was asked, in order. */
const calls: Array<string> = [];

// The plate's children are their own specs' subjects — this one reads what the plate HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const HeadStub = defineComponent({name: 'ConsolePromptHead', props: ['tone', 'kicker', 'title'], render: () => h('header', {class: 'head-stub'})});
const IconStub = defineComponent({name: 'BarButtonIcon', props: ['name'], render: () => h('i', {class: 'icon-stub'})});
const ChipStub = defineComponent({name: 'ActionEffectChip', props: ['effect'], render: () => h('i', {class: 'chip-stub'})});
const RowStub = defineComponent({
  name: 'ConsoleForecastRow',
  props: ['forecast'],
  emits: ['open'],
  render: () => h('i', {'class': 'row-stub', 'data-forecast-row': ''}),
});
/** The layer, reduced to what the plate CALLS on it through its own `ref="forecastLayer"`. */
const LayerStub = defineComponent({
  name: 'ConsoleForecastLayer',
  props: ['host', 'operation', 'forecast', 'cards', 'color', 'players', 'statsByColor'],
  methods: {
    consumeBack(): boolean {
      calls.push('back');
      return false;
    },
    handleIntent(intent: GamepadIntent): void {
      calls.push('intent:' + intent.kind);
    },
  },
  render: () => h('i', {class: 'layer-stub'}),
});

const global = {
  ...globalConfig.global,
  stubs: {ConsolePromptHead: HeadStub, BarButtonIcon: IconStub, ActionEffectChip: ChipStub, ConsoleForecastRow: RowStub, ConsoleForecastLayer: LayerStub},
};

function plate(props: Record<string, unknown>) {
  return mount(ConsoleActionConfirm as any, {...globalConfig, props, global});
}

type ConfirmRef = {openForecastLayer(): void, forecastIntent(intent: GamepadIntent): void};

/** The plate under a HOLDER of its ref — what that ref carries is what the shell's registry hands the pad router. */
function underParent(first: Record<string, unknown>) {
  const held = shallowRef<ConfirmRef | null>(null);
  const props = reactive<Record<string, unknown>>({...first});
  const Parent = defineComponent({
    name: 'ActionConfirmParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleActionConfirm as never, {...props, ref: held})]),
  });
  return {wrapper: mount(Parent, {...globalConfig, global}), held, props};
}

/** A forecast with one fact of the table — something stands behind R3, and the compact row has a chip. */
function forecastOfOne(): EffectForecast {
  const fact = {
    id: 'Meat Industry|card', source: {kind: 'card', name: 'Meat Industry', owner: 'blue', channel: 'resource-added'},
    certainty: 'exact', recipient: {kind: 'you'}, timing: 'immediate',
    effects: [{direction: 'gain', icon: 'megacredits', amount: 2}], reason: 'r',
  } as unknown as EffectForecastFact;
  return {facts: [fact], discounts: {base: 0, final: 0, items: [], other: 0}, paymentValues: [], coverage: 'complete'};
}

const NAV_DOWN: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};
const R3: GamepadIntent = {kind: 'press', button: 'stickR'};

describe('ConsoleActionConfirm — the quick wheel\'s confirm', () => {
  // The layer's open flag and the fold's one-shot are module state — neither may leak into the next spec.
  const reset = () => {
    calls.length = 0;
    resetEffectForecastUi();
    resetForecastFocusMotion();
  };
  beforeEach(reset);
  afterEach(reset);

  it('the PASS: its own ask, the consequence in words, what it leaves unused — a reading-width plate', () => {
    const w = plate({kind: 'pass', warnings: ['2 card actions', 'A trade fleet']});
    // The template STARTS WITH ITS ROOT.
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-confirm', 'con-ws']);
    expect(w.attributes('data-motion-surface')).to.eq('confirm');
    expect(w.attributes('data-confirm-kind')).to.eq('pass');
    expect(w.attributes('aria-label')).to.eq($t('Pass until the next generation'));
    const head = w.findComponent(HeadStub);
    expect(head.props('tone')).to.eq('neutral');
    expect(head.props('kicker')).to.eq($t('Basic actions'));
    expect(head.props('title')).to.eq($t('Pass until the next generation'));
    expect(w.find('[data-prompt-panel]').classes(), 'a LIST is reading width').to.include('con-prompt--m');
    expect(w.findComponent(IconStub).props('name')).to.eq('pass');
    expect(w.find('.con-confirm__consequence').text()).to.eq($t('You will take no more actions this generation.'));
    expect(w.find('[data-confirm-formula]').exists(), 'a pass has no formula').to.eq(false);
    expect(w.find('.con-confirm__warns-title').text()).to.eq($t('Still available this generation'));
    expect(w.findAll('.con-confirm__warn-text').map((line) => line.text())).to.deep.eq(['2 card actions', 'A trade fleet']);
    expect(w.find('[data-confirm-quiet]').exists()).to.eq(false);
    expect(w.find('.con-confirm__answer').exists(), 'nothing answers — no «Сработает» row').to.eq(false);
    expect(w.find('[data-embed-slot="confirm-step"]').exists(), 'the «where» zone is always present').to.eq(true);
  });

  it('a CONVERSION: the server\'s formula as chips and its one warning on a compact plate; the «where» step parks the operation', async () => {
    const effects: Array<ActionEffect> = [{direction: 'cost', icon: 'heat', amount: 8}, {direction: 'gain', icon: 'temperature', amount: 1}];
    const w = plate({kind: 'convertHeat', effects, body: 'The temperature is at its maximum', quiet: ''});
    expect(w.attributes('data-confirm-kind')).to.eq('convertHeat');
    expect(w.find('[data-prompt-panel]').classes()).to.include('con-prompt--s');
    expect(w.find('[data-confirm-op]').classes()).to.include('con-confirm__op--convertHeat');
    expect(w.find('.con-confirm__emblem .resource_icon--heat').exists()).to.eq(true);
    expect(w.findAllComponents(ChipStub).map((chip) => chip.props('effect'))).to.deep.eq(effects);
    expect(w.find('.con-confirm__consequence').exists()).to.eq(false);
    expect(w.find('.con-confirm__body').text()).to.contain($t('The temperature is at its maximum'));
    expect(w.find('[data-confirm-warns]').exists()).to.eq(false);
    expect(w.find('.con-confirm__step').classes()).to.not.include('con-confirm__step--up');

    await w.setProps({kind: 'convertPlants', stepUp: true, quiet: 'Only actions with no effect are left'});
    expect(w.findComponent(HeadStub).props('title')).to.eq($t('Place a greenery with plants'));
    expect(w.find('.con-confirm__emblem .resource_icon--plants').exists()).to.eq(true);
    expect(w.find('.con-confirm__step').classes()).to.include('con-confirm__step--up');
    expect(w.find('[data-confirm-quiet]').text()).to.contain('Only actions with no effect are left');
    expect(w.find('[data-prompt-panel]').classes(), 'the quiet line is reading width too').to.include('con-prompt--m');
  });

  it('a HOLDER of its ref sees `openForecastLayer` and `forecastIntent` — and nothing else', () => {
    const {held} = underParent({kind: 'pass'});
    expect(held.value, 'the holder\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the plate exposes').to.deep.eq(['openForecastLayer', 'forecastIntent']);
    const leaked = ['kind', 'forecast', 'forecastPulse', 'forecastCanOpen', 'fxOpen', 'titleKey', 'root', 'forecastLayer']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('R3 opens the «Эффекты» layer only when something stands behind it; the pad then goes to the layer; an emptied forecast folds it', async () => {
    const {wrapper, held, props} = underParent({kind: 'convertHeat'});
    const confirm = held.value!;
    confirm.openForecastLayer();
    expect(effectForecastOpen('confirm'), 'no forecast — nothing behind R3, nothing opens').to.eq(false);
    expect(wrapper.find('.con-confirm__answer').exists()).to.eq(false);

    props.forecast = forecastOfOne();
    await nextTick();
    const row = wrapper.findComponent(RowStub);
    expect(row.exists(), 'the table answers — the «Сработает» row stands').to.eq(true);
    expect(row.classes()).to.not.include('con-forecast--descend');
    confirm.openForecastLayer();
    expect(effectForecastOpen('confirm')).to.eq(true);
    await nextTick();
    expect(row.classes(), 'the door\'s one-shot flare').to.include('con-forecast--descend');

    // While it is open the shell routes the pad here: the layer takes it, R3 closes the layer whole.
    confirm.forecastIntent(NAV_DOWN);
    expect(calls).to.deep.eq(['intent:nav']);
    confirm.forecastIntent(R3);
    expect(effectForecastOpen('confirm')).to.eq(false);

    // A click on the row is the same door; a refreshed option with nothing behind R3 folds the layer.
    row.vm.$emit('open');
    expect(effectForecastOpen('confirm')).to.eq(true);
    props.forecast = undefined;
    await nextTick();
    expect(effectForecastOpen('confirm')).to.eq(false);
  });

  it('the plate leaving takes its layer with it', () => {
    const {wrapper, held} = underParent({kind: 'convertHeat', forecast: forecastOfOne()});
    held.value!.openForecastLayer();
    expect(effectForecastOpen('confirm')).to.eq(true);
    wrapper.unmount();
    expect(effectForecastOpen('confirm')).to.eq(false);
  });
});
