/*
 * ConsoleExpansionsDeck — the creator's EXPANSIONS deck: one toggle plate per in-scope module under the deck meter.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): pure presentation — the rows, the cursor
 * and the shaking row arrive as props, the deck chips are read off the module's composition state (the server's
 * count), and a press / a pointer move goes UP as `activate` / `hover` with the row's index. It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Expansion} from '@/common/cards/GameModule';
import {DeckCompositionModel} from '@/common/models/DeckCompositionModel';
import {ExpansionRow} from '@/client/console/menu/consoleCreateModel';
import {deckCompositionState, resetDeckCompositionState} from '@/client/console/menu/deckCompositionState';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import {expansionIcon} from '@/client/components/create/premium/createGameMeta';
import ConsoleExpansionsDeck from '@/client/components/console/menu/ConsoleExpansionsDeck.vue';

// The meter reads the composition state and flips its numbers — its own subject; here it is a mark that it stands.
// (A render function, not a template string: the runtime compiler is not in this build.)
const MeterStub = defineComponent({
  name: 'ConsoleDeckMeter',
  props: {variant: String},
  render: () => h('i', {class: 'meter-stub'}),
});

const row = (id: Expansion, value: boolean, over: Partial<ExpansionRow> = {}): ExpansionRow => ({
  meta: {id, labelKey: `label of ${id}`, descKey: `what ${id} adds`},
  value,
  conflictKey: undefined,
  requires: [],
  ...over,
});

const composition: DeckCompositionModel = {
  projects: {total: 0, byModule: {}, byType: {automated: 0, active: 0, event: 0}},
  corporations: {total: 0, byModule: {}},
  preludes: {total: 0, byModule: {}},
  extras: {},
  contributions: {
    prelude2: {projects: 21, corporations: 4, preludes: 25, colonies: 0, resolutions: 0},
    ares: {projects: 0, corporations: 0, preludes: 0, colonies: 0, resolutions: 0},
  },
};

function deck(props: {rows: ReadonlyArray<ExpansionRow>, cursor: number, shakeRow?: number}) {
  return mount(ConsoleExpansionsDeck, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ConsoleDeckMeter: MeterStub}},
  });
}

describe('ConsoleExpansionsDeck — the creator\'s expansions as toggle plates', () => {
  afterEach(() => {
    resetDeckCompositionState();
  });

  it('one plate per row under the deck meter — icon, name, ON / OFF, what it adds; the cursor and the shake by index', () => {
    const w = deck({rows: [row('prelude', true), row('venus', false)], cursor: 1, shakeRow: 0});
    expect(w.classes()).to.include.members(['cm-deckbody', 'cm-expdeck']);
    const meter = w.findComponent(MeterStub);
    expect(meter.props('variant')).to.eq('deck');
    expect(meter.classes()).to.include('cm-expdeck__meter');

    const plates = w.findAll('button.cm-exp');
    expect(plates.map((p) => p.attributes('data-exp'))).to.deep.eq(['prelude', 'venus']);
    expect(plates.map((p) => p.classes().includes('cm-exp--cursor'))).to.deep.eq([false, true]);
    expect(plates.map((p) => p.classes().includes('cm-row--shake'))).to.deep.eq([true, false]);
    expect(plates.map((p) => p.classes().includes('cm-exp--on'))).to.deep.eq([true, false]);
    expect(plates.map((p) => p.classes().includes('cm-exp--conflict'))).to.deep.eq([false, false]);
    expect(plates.map((p) => p.find('.cm-exp__icon img').attributes('src'))).to.deep.eq([expansionIcon('prelude'), expansionIcon('venus')]);
    expect(plates.map((p) => p.find('.cm-exp__name').text())).to.deep.eq([$t('label of prelude'), $t('label of venus')]);
    expect(plates.map((p) => p.find('.cm-exp__desc').text())).to.deep.eq([$t('what prelude adds'), $t('what venus adds')]);

    // BOTH words stand in the chip (one grid cell — a toggle never re-flows the title); the other one is the hidden one.
    expect(plates.map((p) => p.find('.cm-exp__state').classes().includes('cm-exp__state--on'))).to.deep.eq([true, false]);
    const hidden = (plate: typeof plates[number]) => plate.findAll('.cm-exp__state-word').map((word) => word.classes().includes('cm-exp__state-word--off'));
    expect(plates[0].findAll('.cm-exp__state-word').map((word) => word.text())).to.deep.eq([$t('On'), $t('Off')]);
    expect(hidden(plates[0]), 'ON: «Off» is the hidden word').to.deep.eq([false, true]);
    expect(hidden(plates[1]), 'OFF: «On» is the hidden word').to.deep.eq([true, false]);

    // No composition yet and nothing required: the plate carries no chip row at all.
    expect(w.find('.cm-exp__chips').exists()).to.eq(false);
  });

  it('a MarsBot conflict states the blocker\'s reason in the description\'s place', () => {
    const w = deck({rows: [row('venus', true, {conflictKey: 'expansion:venus'})], cursor: 0});
    const plate = w.find('button.cm-exp');
    expect(plate.classes()).to.include('cm-exp--conflict');
    expect(plate.find('.cm-exp__issue').text()).to.eq($t(automaBlockerText('expansion:venus')));
    expect(plate.find('.cm-exp__desc').exists()).to.eq(false);
    expect(plate.classes(), 'the default shake row is none').to.not.include('cm-row--shake');
  });

  it('the chips are the SERVER\'s contribution in numbers; a need closes the row — unmet only while the plate is ON without it', () => {
    deckCompositionState.composition = composition;
    const need = {id: 'prelude' as Expansion, labelKey: 'Prelude', met: false};
    const w = deck({
      rows: [row('prelude2', true, {requires: [need]}), row('prelude2', false, {requires: [need]}), row('ares', true)],
      cursor: 0,
    });
    const plates = w.findAll('button.cm-exp');

    const chips = plates[0].findAll('[data-exp-chips="prelude2"] [data-exp-chip]');
    expect(chips.map((chip) => chip.attributes('data-exp-chip')), 'a zero is not printed').to.deep.eq(['projects', 'corporations', 'preludes']);
    expect(chips.map((chip) => chip.attributes('data-exp-chip-amount'))).to.deep.eq(['21', '4', '25']);
    expect(chips.map((chip) => chip.classes().find((c) => c.startsWith('cm-exp__chip--')))).to.deep.eq(
      ['cm-exp__chip--projects', 'cm-exp__chip--corporations', 'cm-exp__chip--preludes']);
    expect(chips.map((chip) => chip.text())).to.deep.eq([
      translateTextWithParams('+${0} projects', ['21']),
      translateTextWithParams('+${0} corporations', ['4']),
      translateTextWithParams('+${0} preludes', ['25']),
    ]);

    const needOf = (plate: typeof plates[number]) => plate.find('[data-exp-needs="prelude"]');
    const requires = translateTextWithParams('Requires ${0}', [translateText('Prelude')]);
    expect(needOf(plates[0]).attributes('data-exp-needs-met')).to.eq('no');
    expect(needOf(plates[0]).classes(), 'ON without what it needs').to.include('cm-exp__needs--unmet');
    expect(needOf(plates[0]).find('.cm-exp__needs-mark').text()).to.eq('!');
    expect(needOf(plates[0]).text()).to.eq('!' + requires);
    expect(needOf(plates[1]).classes(), 'OFF: a quiet statement').to.not.include('cm-exp__needs--unmet');
    expect(needOf(plates[1]).find('.cm-exp__needs-mark').text()).to.eq('•');
    expect(needOf(plates[1]).text()).to.eq('•' + requires);

    // An expansion that adds no cards and needs nothing prints no chip row (never «+0»).
    expect(plates[2].find('.cm-exp__chips').exists()).to.eq(false);
  });

  it('a click ACTIVATES the plate and a pointer move HOVERS it — each says the row\'s index', async () => {
    const w = deck({rows: [row('prelude', true), row('venus', false), row('colonies', false)], cursor: 0});
    const plates = w.findAll('button.cm-exp');
    await plates[2].trigger('click');
    await plates[1].trigger('mousemove');
    await plates[0].trigger('click');
    expect(w.emitted('activate')).to.deep.eq([[2], [0]]);
    expect(w.emitted('hover')).to.deep.eq([[1]]);
  });
});
