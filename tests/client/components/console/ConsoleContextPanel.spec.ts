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
  // A LEGAL cell — the panel only ever previews a placement the server allows;
  // an illegal one carries `illegalReason` and is covered by the placement-reason
  // popover, not here.
  legal: true,
  costFacts: [hazardPenalty],
  immediateFacts: [],
  recipientFacts: [],
  futureScoringFacts: [],
  warningFacts: [],
  ruleFacts: [],
};

const info: BoardCellInfo = {
  space: '05',
  // An EMPTY land cell carrying a printed bonus — matches the `facts` below
  // (a printed-placement-bonus) and the header this fixture asserts on.
  status: {content: 'empty', header: 'Land with a bonus'},
  facts: [{id: 'f', category: 'printed-placement-bonus', timing: 'immediate', severity: 'positive', recipient: {kind: 'current-player'}, title: 'f'}],
};

function mountPanel(props: Record<string, unknown>) {
  return shallowMount(ConsoleContextPanel, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      // `console-source-dock` is GLOBAL in the real app (it renders the card
      // face, whose import chain zeroes a mochapack spec) — so it is stubbed
      // here rather than resolved. Its own contract lives in
      // `promptSource.spec.ts` + the placement e2e probe.
      stubs: {'console-source-dock': {props: ['view', 'chip'], template: '<div class="con-src con-src--chip" />'}},
    },
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

  /**
   * The panel grew several fact blocks, so everything that did NOT carry its own
   * weight had to go: the confirm CTA already sits at the top, and a permanent
   * "cancelling is not available" note stated a non-event on every placement.
   */
  describe('the panel earns its height', () => {
    it('does not repeat the confirm CTA at the bottom', () => {
      const wrapper = mountPanel({preview, info, selectedLegal: true});
      expect(wrapper.findAll('.con-inspector__placement')).to.have.lengthOf(1);
      expect(wrapper.findAll('.con-context__cmd')).to.have.lengthOf(0);
    });

    it('shows the bottom command row ONLY for a real cancel', () => {
      const wrapper = mountPanel({preview, info, selectedLegal: true, cancellable: true});
      expect(wrapper.findAll('.con-context__cmd')).to.have.lengthOf(1);
    });

    it('never renders a note about cancelling being unavailable', () => {
      const wrapper = mountPanel({preview, info, selectedLegal: true, cancellable: false});
      expect(wrapper.find('.con-context__mandatory-note').exists()).to.be.false;
    });
  });

  /**
   * The panel scrolls with the right stick. On a TV the 3 px rail is invisible,
   * so the overflow has to announce itself — otherwise the player cannot tell
   * whether anything is below the fold.
   */
  describe('scroll affordance', () => {
    it('stays silent while everything fits', () => {
      const wrapper = mountPanel({preview, info});
      expect(wrapper.find('.con-inspector__more').exists()).to.be.false;
      expect(wrapper.classes()).to.not.include('con-inspector--more');
    });

    it('names the control and fades the cut edge once content overflows', async () => {
      const wrapper = mountPanel({preview, info});
      // JSDOM reports every element as zero-height, so drive the measured state
      // directly — the measurement itself is a three-property DOM read.
      await wrapper.setData({moreBelow: true, scrolledDown: true});
      expect(wrapper.find('.con-inspector__more').exists()).to.be.true;
      expect(wrapper.classes()).to.include('con-inspector--more');
      expect(wrapper.classes()).to.include('con-inspector--scrolled');
    });
  });
});
