import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import BoardPlacementPreviewContent from '@/client/components/board/BoardPlacementPreviewContent.vue';
import BoardFactRow from '@/client/components/board/BoardFactRow.vue';
import {BoardFact, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';

/**
 * The placement panel's presentation contract. It now carries card-driven facts
 * and milestone progress on top of the cell facts, so three things are load
 * bearing: a gain must NAME its source card, a production change must not read as
 * a one-off gain, and RISK must not be pushed below the reward blocks.
 */
describe('BoardPlacementPreviewContent', () => {
  function fact(over: Partial<BoardFact> = {}): BoardFact {
    return {
      id: 'f1',
      category: 'card-trigger',
      timing: 'immediate',
      severity: 'positive',
      recipient: {kind: 'current-player'},
      title: 'A fact',
      ...over,
    };
  }

  function preview(over: Partial<BoardPlacementPreview> = {}): BoardPlacementPreview {
    return {
      space: '03' as BoardPlacementPreview['space'],
      kind: 'land',
      legal: true,
      costFacts: [],
      immediateFacts: [],
      recipientFacts: [],
      warningFacts: [],
      futureScoringFacts: [],
      ruleFacts: [],
      progressFacts: [],
      ...over,
    };
  }

  function render(p: BoardPlacementPreview) {
    return mount(BoardPlacementPreviewContent, {...globalConfig, props: {preview: p}});
  }

  it('renders the milestone/award block from progressFacts', () => {
    const wrapper = render(preview({
      progressFacts: [fact({
        id: 'milestone-Gardener',
        category: 'milestone-progress',
        title: 'Gardener',
        progress: {from: 2, to: 3, target: 3},
      })],
    }));
    const section = wrapper.find('.board-preview__section--progress');
    expect(section.exists()).to.be.true;
    expect(section.text()).to.include('Gardener');
    // `from → to / target`, the honest reading of "this placement completes it".
    expect(section.text()).to.include('2');
    expect(section.text()).to.include('3');
  });

  it('shows RISK above the reward blocks so a danger never falls below the fold', () => {
    const wrapper = render(preview({
      warningFacts: [fact({id: 'w', severity: 'danger', title: 'Cannot afford'})],
      immediateFacts: [fact({id: 'g', title: 'A gain'})],
    }));
    const order = wrapper.findAll('.board-preview__section')
      .map((w) => w.classes().find((c) => c.startsWith('board-preview__section--')));
    expect(order.indexOf('board-preview__section--risk'))
      .to.be.lessThan(order.indexOf('board-preview__section--gain'));
  });

  it('is empty only when every group is empty', () => {
    expect(render(preview()).find('.board-preview__empty').exists()).to.be.true;
    expect(render(preview({progressFacts: [fact()]})).find('.board-preview__empty').exists()).to.be.false;
  });

  it('survives a payload with no progressFacts (older server build)', () => {
    const legacy = preview();
    delete (legacy as {progressFacts?: unknown}).progressFacts;
    const wrapper = render(legacy);
    expect(wrapper.find('.board-preview__section--progress').exists()).to.be.false;
    expect(wrapper.find('.board-preview__empty').exists()).to.be.true;
  });

  describe('BoardFactRow', () => {
    function row(f: BoardFact) {
      return mount(BoardFactRow, {...globalConfig, props: {fact: f}});
    }

    it('names the source CARD so a gain is never anonymous', () => {
      const wrapper = row(fact({source: {type: 'card', id: 'Solar Farm', label: 'Solar Farm'}}));
      expect(wrapper.find('.board-fact__source').text()).to.eq('Solar Farm');
    });

    it('hides the source tag when it only repeats the section heading', () => {
      const wrapper = row(fact({source: {type: 'board-cell', label: 'Cell bonus'}}));
      expect(wrapper.find('.board-fact__source').exists()).to.be.false;
    });

    it('marks a PRODUCTION delta as production, not a one-off gain', () => {
      const wrapper = row(fact({delta: {icon: 'energy', amount: 2, direction: 'gain', production: true}}));
      expect(wrapper.findComponent({name: 'ActionEffectChip'}).props('effect').note).to.eq('production');
    });

    it('leaves a stock delta without the production note', () => {
      const wrapper = row(fact({delta: {icon: 'plants', amount: 2, direction: 'gain'}}));
      expect(wrapper.findComponent({name: 'ActionEffectChip'}).props('effect').note).to.be.undefined;
    });

    it('lights the progress badge only when the target is reached', () => {
      expect(row(fact({progress: {from: 2, to: 3, target: 3}})).find('.board-fact__progress--reached').exists()).to.be.true;
      expect(row(fact({progress: {from: 1, to: 2, target: 3}})).find('.board-fact__progress--reached').exists()).to.be.false;
    });
  });
});
