import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import RepeatActionPicker from '@/client/components/actions/RepeatActionPicker.vue';
import {CardName} from '@/common/cards/CardName';

// Stub the (heavy) action-graphic renderer — this spec is about the tile /
// selection behavior, not the graphic itself.
const CompactActionCardStub = {
  name: 'CompactActionCard',
  props: ['node', 'title', 'status', 'interactive'],
  template: '<div class="compact-action-stub"></div>',
};

function factory(candidates: ReadonlyArray<CardName>, selectedName?: CardName) {
  return mount(RepeatActionPicker, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {CompactActionCard: CompactActionCardStub},
    },
    props: {
      candidates,
      selectedName,
      prompt: 'Perform an action from a played card again',
      playerView: {} as any,
    },
  });
}

describe('RepeatActionPicker', () => {
  it('renders ONE premium tile per candidate action', () => {
    const component = factory([CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE]);
    const tiles = component.findAll('.repeat-action-picker__tile');
    expect(tiles.length).to.eq(2);
    // The card NAME header is shown so the player knows the source.
    expect(component.find('[data-test="repeat-action-' + CardName.REGOLITH_EATERS + '"]').exists()).is.true;
    expect(component.find('[data-test="repeat-action-' + CardName.SEARCH_FOR_LIFE + '"]').exists()).is.true;
  });

  it('clicking a tile emits `change` with that card name (single-select, no submit)', async () => {
    const component = factory([CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE]);
    await component.find('[data-test="repeat-action-' + CardName.SEARCH_FOR_LIFE + '"]').trigger('click');
    const emitted = component.emitted('change');
    expect(emitted).is.not.undefined;
    expect(emitted![0]).deep.eq([CardName.SEARCH_FOR_LIFE]);
  });

  it('marks the selected tile', () => {
    const component = factory([CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE], CardName.REGOLITH_EATERS);
    const selected = component.find('[data-test="repeat-action-' + CardName.REGOLITH_EATERS + '"]');
    expect(selected.classes()).to.include('repeat-action-picker__tile--selected');
  });
});
