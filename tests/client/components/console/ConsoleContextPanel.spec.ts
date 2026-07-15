import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import BoardPlacementPreviewContent from '@/client/components/board/BoardPlacementPreviewContent.vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import {BoardCellInfo, BoardFact, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';

const hazardPenalty: BoardFact = {
  id: 'cost-production',
  category: 'placement-penalty',
  timing: 'cost',
  severity: 'danger',
  recipient: {kind: 'current-player'},
  title: 'Reduce production by ${0}',
  params: ['1'],
};

const preview: BoardPlacementPreview = {
  space: '05',
  kind: 'greenery',
  costFacts: [hazardPenalty],
  immediateFacts: [],
  recipientFacts: [],
  futureScoringFacts: [],
  warningFacts: [],
  ruleFacts: [],
};

const info: BoardCellInfo = {
  space: '05',
  status: {header: 'Land with a bonus'},
  facts: [{id: 'f', category: 'printed-placement-bonus', timing: 'immediate', severity: 'positive', recipient: {kind: 'current-player'}, title: 'f'}],
};

function mountPanel(props: Record<string, unknown>) {
  return shallowMount(ConsoleContextPanel, {
    ...globalConfig,
    props: {mode: 'placement', viewerColor: 'red', players: [], ...props},
  });
}

describe('ConsoleContextPanel', () => {
  // The console panel used to render ONLY the hover facts (`boardCellInfo`),
  // which never carry the CONSEQUENCES of placing — so the Ares
  // hazard-adjacency "reduce a production" penalty was invisible on console.
  it('placement mode renders the placement preview, not just the hover facts', () => {
    const wrapper = mountPanel({preview, info});
    expect(wrapper.findComponent(BoardPlacementPreviewContent).exists()).to.be.true;
    expect(wrapper.findComponent(BoardPlacementPreviewContent).props('preview')).to.deep.eq(preview);
    // The two never stack — the preview supersedes the hover facts.
    expect(wrapper.findComponent(BoardFactGroups).exists()).to.be.false;
  });

  it('falls back to the hover facts when there is no preview (illegal cell)', () => {
    const wrapper = mountPanel({info});
    expect(wrapper.findComponent(BoardPlacementPreviewContent).exists()).to.be.false;
    expect(wrapper.findComponent(BoardFactGroups).exists()).to.be.true;
  });

  it('inspection mode keeps the hover facts (a preview is placement-only)', () => {
    const wrapper = mountPanel({mode: 'cell', info, preview});
    expect(wrapper.findComponent(BoardPlacementPreviewContent).exists()).to.be.false;
    expect(wrapper.findComponent(BoardFactGroups).exists()).to.be.true;
  });
});
