import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import TabbedRemovalPicker from '@/client/components/handCards/TabbedRemovalPicker.vue';

// Stub ActionTargetCard (its rendering is tested elsewhere) so we can focus on the
// tab switching + the OrOptions response wrapping.
const ActionTargetCardStub = {
  name: 'ActionTargetCard',
  props: ['input', 'playerView', 'amount', 'autoSelect', 'selectedName'],
  template: '<div class="atc-stub"></div>',
};

const MODEL = {
  kind: 'tabbedTargets',
  animal: {label: 'Animals', icon: 'animal', amount: 2, branchIndex: 0,
    input: {type: 'card', cards: [{name: 'Birds'}], min: 1, max: 1}},
  plant: {label: 'Plants', icon: 'plants', amount: 5, targets: [
    {color: 'red', name: 'Red', current: 8, resulting: 3, optionIndex: 1},
    {color: 'blue', name: 'Blue', current: 6, resulting: 1, optionIndex: 2},
  ]},
};

function factory(model: any = MODEL, selected: any = undefined) {
  return mount(TabbedRemovalPicker, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {ActionTargetCard: ActionTargetCardStub}},
    props: {model, playerView: {players: [], thisPlayer: {}}, selected},
  });
}

describe('TabbedRemovalPicker', () => {
  it('renders a tab per category (animals + plants)', () => {
    const c = factory();
    expect(c.findAll('.virus-tabs__tab').length).to.eq(2);
  });

  it('opens on the animals tab and hosts the card picker', () => {
    const c = factory();
    expect(c.find('.atc-stub').exists()).is.true;
    expect(c.find('.virus-plant').exists()).is.false;
  });

  it('selecting a plant emits the OrOptions response for that option index', async () => {
    const c = factory();
    await c.findAll('.virus-tabs__tab')[1].trigger('click'); // → plants tab
    const rows = c.findAll('.virus-plant');
    expect(rows.length).to.eq(2);
    await rows[1].trigger('click'); // the second target (optionIndex 2)
    const emitted = c.emitted('select');
    expect(emitted, 'a select event').is.not.undefined;
    expect(emitted![0][0]).to.deep.equal({type: 'or', index: 2, response: {type: 'option'}});
  });

  it('wraps an animal card pick as the animal OrOptions branch', () => {
    const c = factory();
    (c.vm as any).onAnimalChange({type: 'card', cards: ['Birds']});
    const emitted = c.emitted('select');
    expect(emitted![0][0]).to.deep.equal({type: 'or', index: 0, response: {type: 'card', cards: ['Birds']}});
  });

  it('highlights the selected target parsed from the `selected` prop', () => {
    const plant = factory(MODEL, {type: 'or', index: 1, response: {type: 'option'}});
    expect((plant.vm as any).selectedPlantIndex).to.eq(1);
    expect((plant.vm as any).selectedAnimalName).is.undefined;

    const animal = factory(MODEL, {type: 'or', index: 0, response: {type: 'card', cards: ['Birds']}});
    expect((animal.vm as any).selectedAnimalName).to.eq('Birds');
  });

  it('shows only the plants tab when there are no animal targets', () => {
    const plantOnly = {kind: 'tabbedTargets', plant: MODEL.plant};
    const c = factory(plantOnly);
    expect(c.findAll('.virus-tabs__tab').length).to.eq(1);
    expect(c.find('.virus-plant').exists()).is.true; // opens straight on plants
  });

  it('renders a protected (disabled) target as a greyed, non-selectable row with its reason', async () => {
    const withProtected = {kind: 'tabbedTargets', plant: {label: 'Plants', icon: 'plants', amount: 5, targets: [
      {color: 'red', name: 'Red', current: 8, resulting: 3, optionIndex: 1},
      {color: 'blue', name: 'Blue', current: 6, resulting: 6, optionIndex: -1, disabled: true, reason: 'Plants are protected'},
    ]}};
    const c = factory(withProtected);
    expect(c.findAll('.virus-plant').length).to.eq(2);
    const disabledRow = c.find('.virus-plant--disabled');
    expect(disabledRow.exists(), 'a disabled row is rendered').is.true;
    expect(disabledRow.attributes('disabled'), 'the row is a disabled button').is.not.undefined;
    expect(c.find('.virus-plant__reason').text()).to.contain('Plants are protected');
    // The disabled row never emits a selection.
    await disabledRow.trigger('click');
    expect(c.emitted('select'), 'no select from a disabled row').is.undefined;
  });
});
