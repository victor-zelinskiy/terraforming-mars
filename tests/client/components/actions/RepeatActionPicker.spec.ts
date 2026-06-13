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

  it('an UNAVAILABLE branch is shown DISABLED + its reason, and never hands off', async () => {
    const component = factory([CardName.REGOLITH_EATERS]);
    // Inject a preview where the "remove 2 microbes → oxygen" branch is unavailable.
    // (behavior order: branch 0 = remove-2, branch 1 = add-1 — matched to the render
    // nodes by token overlap, so render node 1 = "remove 2" maps to branch 0.)
    await component.setData({
      previews: {
        [CardName.REGOLITH_EATERS]: {
          card: CardName.REGOLITH_EATERS,
          isCorporation: false,
          kind: 'declarative',
          branches: [
            {index: -1, title: 'Remove 2 microbes to raise oxygen level 1 step', available: false,
              unavailableReason: 'Not enough microbes', renderKeys: ['0'], effects: [], steps: []},
            {index: 0, title: 'Add 1 microbe to this card', available: true,
              renderKeys: ['1'], effects: [], steps: []},
          ],
        },
      },
    });
    // The "remove 2" row (render node 1) is disabled + shows the reason.
    const removeRow = component.find('[data-test="repeat-action-' + CardName.REGOLITH_EATERS + '-1"]');
    expect(removeRow.classes()).to.include('repeat-action-picker__row--disabled');
    expect(removeRow.text()).to.include('Not enough microbes');
    // Clicking it does NOT hand off.
    await removeRow.trigger('click');
    expect(component.emitted('change')).to.eq(undefined);
    // The "add 1" row (render node 0) stays available + clickable.
    const addRow = component.find('[data-test="repeat-action-' + CardName.REGOLITH_EATERS + '-0"]');
    expect(addRow.classes()).to.not.include('repeat-action-picker__row--disabled');
    await addRow.trigger('click');
    expect(component.emitted('change')![0]).deep.eq([{cardName: CardName.REGOLITH_EATERS, nodeIndex: 0}]);
  });
});
