/*
 * ConsoleForecastRow — the compact «Сработает» row: what the TABLE answers to a play / an action, in chips alone. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): two props in (the forecast, the caption switch),
 * ONE emit (`open` — a click opens the layer the way R3 does), nothing exposed. Membership, merging and the cap are the
 * pure model's (`compactForecastChips`), so this spec reads what the row DRAWS for each chip form and what it hands
 * the shared chip.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {forecastChipRailRow} from '@/client/console/effectForecastModel';
import ConsoleForecastRow from '@/client/components/console/ConsoleForecastRow.vue';

// The chip is the action family's own subject; this spec reads what the row HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ChipStub = defineComponent({
  name: 'ActionEffectChip',
  props: {effect: {type: Object, required: true}, skipped: {type: Boolean, default: false}},
  render: () => h('i', {class: 'chip-stub'}),
});

const GAIN: ActionEffect = {direction: 'gain', icon: 'megacredits', amount: 2};

const fact = (id: string, over: Partial<EffectForecastFact> = {}): EffectForecastFact => ({
  id,
  source: {kind: 'card', name: 'Meat Industry', owner: 'red', channel: 'card-played'},
  certainty: 'exact',
  recipient: {kind: 'you'},
  timing: 'immediate',
  effects: [GAIN],
  reason: 'r',
  ...over,
});

const forecastOf = (facts: ReadonlyArray<EffectForecastFact>): EffectForecast => ({
  facts,
  discounts: {base: 0, final: 0, items: [], other: 0},
  paymentValues: [],
  coverage: 'complete',
});

function row(props: {forecast?: EffectForecast, caption?: boolean}) {
  return mount(ConsoleForecastRow, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ActionEffectChip: ChipStub, GamepadGlyph: true, PremiumModifierMarks: true, PremiumPartyRequirementGlyph: true}},
  });
}

describe('ConsoleForecastRow — the compact «Сработает» row', () => {
  it('no forecast: the row stands with its caption and no chip; the caption switch strips the words', async () => {
    const w = row({});
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.include('con-forecast');
    expect(w.attributes('data-forecast-row')).to.not.eq(undefined);
    expect(w.attributes('role')).to.eq('note');
    expect(w.attributes('aria-label'), 'the label counts the facts of the row').to.eq(`${$t('Will trigger')}: 0`);
    expect(w.find('.con-forecast__label').text()).to.eq(`${$t('Will trigger')}:`);
    expect(w.classes()).to.not.include('con-forecast--bare');
    expect(w.findAll('[data-forecast-chip]')).to.have.length(0);

    await w.setProps({caption: false});
    expect(w.find('.con-forecast__label').exists(), 'the host names the side itself').to.eq(false);
    expect(w.classes()).to.include('con-forecast--bare');
  });

  it('every chip form in the model\'s order: own on its rail row, an asked gain with «?», another seat\'s loss in its colour, «⚡ ?»', () => {
    const w = row({forecast: forecastOf([
      fact('own'),
      fact('asks', {certainty: 'asks', effects: [{direction: 'gain', icon: 'plants', amount: 1, note: 'production'}]}),
      fact('other', {recipient: {kind: 'bot', color: 'blue'}, effects: [{direction: 'cost', icon: 'megacredits', amount: 4}]}),
      fact('unknown', {certainty: 'unknown', effects: []}),
    ])});
    const chips = w.findAll('[data-forecast-chip]');
    expect(chips.map((chip) => chip.attributes('data-forecast-chip'))).to.deep.eq(['own', 'asks', 'other', 'unknown']);
    expect(w.attributes('aria-label')).to.eq(`${$t('Will trigger')}: 4`);

    // An OWN chip names the rail row its answer is born on — the model's own mapping, read straight off the import.
    const rail = forecastChipRailRow(GAIN, false);
    expect(rail, 'a stock gain of M€ has a rail row').to.be.a('string');
    expect(chips[0].attributes('data-forecast-rail')).to.eq(rail);
    expect(chips[0].classes()).to.include('con-forecast__chip--own');
    expect(chips[1].attributes('data-forecast-rail'), 'only an own chip flies to the rail').to.eq(undefined);

    // The degree and the pool: «?» on an asked gain, the production plate's class on a production step.
    expect(chips[1].find('.con-forecast__ask').text()).to.eq('?');
    expect(chips[1].classes()).to.include('con-forecast__chip--production');
    expect(chips[0].classes()).to.not.include('con-forecast__chip--production');

    // WHOSE: the seat's colour as a bar and a dot; the bot's seat and a LOSS wear their own tone.
    expect(chips[2].find('.con-forecast__owner-bar').classes()).to.include('player_bg_color_blue');
    expect(chips[2].find('.con-forecast__owner-dot').classes()).to.include('player_bg_color_blue');
    expect(chips[2].classes()).to.include.members(['con-forecast__chip--other', 'con-forecast__chip--bot', 'con-forecast__chip--loss']);
    expect(chips[0].find('.con-forecast__owner-bar').exists(), 'mint means «mine» — no bar').to.eq(false);

    // What was not calculated is ONE dashed chip, and it carries no shared chip.
    expect(chips[3].find('.con-forecast__unknown').text()).to.eq('⚡ ?');
    expect(chips[3].find('.chip-stub').exists()).to.eq(false);

    // The shared chip gets the BARE delta, never struck.
    const handed = w.findAllComponents(ChipStub);
    expect(handed).to.have.length(3);
    expect(handed[0].props('effect')).to.deep.eq(GAIN);
    expect(handed.map((chip) => chip.props('skipped'))).to.deep.eq([false, false, false]);
  });

  it('your own SKIPPED gain is the struck chip with «⚠»; past the cap the rest folds into «+N»', () => {
    const skipped = row({forecast: forecastOf([fact('lost', {certainty: 'skipped'})])});
    const chip = skipped.find('[data-forecast-chip="skipped"]');
    expect(chip.find('.con-forecast__skip').text()).to.eq('⚠');
    expect(chip.find('.chip-stub').exists()).to.eq(true);
    expect(skipped.findComponent(ChipStub).props('skipped'), 'the shared chip\'s own skipped face').to.eq(true);
    skipped.unmount();

    const pools = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];
    const many = row({forecast: forecastOf(pools.map((icon) => fact(icon, {effects: [{direction: 'gain', icon, amount: 1}]})))});
    const kinds = many.findAll('[data-forecast-chip]').map((c) => c.attributes('data-forecast-chip'));
    expect(kinds.at(-1), 'the fold closes the row').to.eq('more');
    expect(kinds.slice(0, -1).every((kind) => kind === 'own')).to.eq(true);
    expect(many.find('.con-forecast__more').text()).to.eq(`+${pools.length - (kinds.length - 1)}`);
    expect(many.attributes('aria-label'), 'the fold hides no fact from the count').to.eq(`${$t('Will trigger')}: ${pools.length}`);
  });

  it('a click emits `open` — once per click, with no payload', async () => {
    const w = row({forecast: forecastOf([fact('own')])});
    expect(w.emitted('open')).to.eq(undefined);
    await w.trigger('click');
    await w.trigger('click');
    expect(w.emitted('open')).to.deep.eq([[], []]);
  });
});
