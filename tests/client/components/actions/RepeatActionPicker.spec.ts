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

function factory(candidates: ReadonlyArray<CardName>) {
  return mount(RepeatActionPicker, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {CompactActionCard: CompactActionCardStub},
    },
    props: {
      candidates,
      prompt: 'Perform an action from a played card again',
      playerView: {} as any,
    },
  });
}

describe('RepeatActionPicker', () => {
  it('renders ONE group per candidate card (with its name header)', () => {
    const component = factory([CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE]);
    const groups = component.findAll('.repeat-action-picker__group');
    expect(groups.length).to.eq(2);
    expect(component.find('[data-test="repeat-action-' + CardName.REGOLITH_EATERS + '"]').exists()).is.true;
    expect(component.find('[data-test="repeat-action-' + CardName.SEARCH_FOR_LIFE + '"]').exists()).is.true;
  });

  it('a SPLIT (`or`) action renders its branches as SEPARATELY selectable rows', () => {
    // Regolith Eaters has TWO action branches (add a microbe / spend 2 → oxygen).
    const component = factory([CardName.REGOLITH_EATERS]);
    const rows = component.findAll('[data-test^="repeat-action-' + CardName.REGOLITH_EATERS + '-"]');
    expect(rows.length).to.eq(2);
  });

  it('clicking a branch row emits `change` with the card AND that branch node index', async () => {
    const component = factory([CardName.REGOLITH_EATERS]);
    // Click the SECOND branch (nodeIndex 1).
    await component.find('[data-test="repeat-action-' + CardName.REGOLITH_EATERS + '-1"]').trigger('click');
    const emitted = component.emitted('change');
    expect(emitted).is.not.undefined;
    expect(emitted![0]).deep.eq([{cardName: CardName.REGOLITH_EATERS, nodeIndex: 1}]);
  });

  it('a single-action card renders ONE selectable row (nodeIndex 0)', async () => {
    const component = factory([CardName.SEARCH_FOR_LIFE]);
    const rows = component.findAll('[data-test^="repeat-action-' + CardName.SEARCH_FOR_LIFE + '-"]');
    expect(rows.length).to.eq(1);
    await rows[0].trigger('click');
    expect(component.emitted('change')![0]).deep.eq([{cardName: CardName.SEARCH_FOR_LIFE, nodeIndex: 0}]);
  });
});
