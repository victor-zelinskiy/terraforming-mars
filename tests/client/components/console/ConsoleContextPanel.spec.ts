import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import ConsolePlacementFactRow from '@/client/components/console/ConsolePlacementFactRow.vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {BoardCellInfo, BoardFact, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {TileType} from '@/common/TileType';

const hazardPenalty: BoardFact = {
  id: 'cost-production',
  category: 'placement-penalty',
  timing: 'cost',
  severity: 'danger',
  recipient: {kind: 'current-player'},
  title: 'Reduce production by ${0}',
  params: ['1'],
};

const oxygenGain: BoardFact = {
  id: 'effect-oxygen',
  category: 'placement-effect',
  timing: 'immediate',
  severity: 'positive',
  recipient: {kind: 'current-player'},
  title: 'Raises oxygen',
  delta: {icon: 'oxygen', amount: 1, direction: 'gain', unit: '%', current: 2, resulting: 3},
};

const preview: BoardPlacementPreview = {
  space: '05',
  kind: 'greenery',
  // A LEGAL cell — the panel only ever previews a placement the server allows;
  // an illegal one carries `illegalReason` and falls back to the hover facts.
  legal: true,
  costFacts: [hazardPenalty],
  immediateFacts: [oxygenGain],
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
  it('placement mode renders the dossier sections from the preview', () => {
    const wrapper = mountPanel({preview, info, selectedLegal: true});
    const rows = wrapper.findAllComponents(ConsolePlacementFactRow);
    expect(rows.map((r) => (r.props('fact') as BoardFact).id))
      .to.deep.eq(['cost-production', 'effect-oxygen']);
    // The cell's own toll is the FIRST section; the reused desktop groups
    // never render in placement mode.
    const heads = wrapper.findAll('.con-context__sec');
    expect(heads[0].classes()).to.include('con-context__sec--effect');
    expect(heads[1].classes()).to.include('con-context__sec--gain');
    expect(wrapper.findComponent(BoardFactGroups).exists()).to.be.false;
  });

  it('falls back to the hover facts when there is no preview (illegal cell)', () => {
    const wrapper = mountPanel({info});
    const rows = wrapper.findAllComponents(ConsolePlacementFactRow);
    expect(rows).to.have.lengthOf(1);
    expect((rows[0].props('fact') as BoardFact).id).to.eq('f');
    expect(wrapper.find('.con-context__sec--cellinfo').exists()).to.be.true;
  });

  it('inspection mode keeps the hover facts (a preview is placement-only)', () => {
    const wrapper = mountPanel({mode: 'cell', info, preview});
    expect(wrapper.findAllComponents(ConsolePlacementFactRow)).to.have.lengthOf(0);
    expect(wrapper.findComponent(BoardFactGroups).exists()).to.be.true;
  });

  /**
   * The IDENTITY block: the big title is the OBJECT (from the tile), the
   * server sentence is demoted, and the conversion formula replaces it when
   * the exchange is structurally known.
   */
  describe('identity', () => {
    it('titles the object from the tile, not from the server sentence', () => {
      const wrapper = mountPanel({
        preview, info, selectedLegal: true,
        placementTitle: 'Select space for greenery tile',
        placementShape: {tileType: TileType.GREENERY, placementType: 'greenery'},
      });
      expect(wrapper.find('.con-context__title').text()).to.eq('Greenery');
      // The generic sentence is redundant — no action line renders.
      expect(wrapper.find('.con-context__action-line').exists()).to.be.false;
      // The identity swatch draws the REAL board tile art.
      expect(wrapper.find('.con-context__tile-art').classes().join(' '))
        .to.contain('board-space-tile--greenery');
    });

    it('keeps a constraint sentence as the quiet action line', () => {
      const wrapper = mountPanel({
        preview, info, selectedLegal: true,
        placementTitle: 'Select a space adjacent to one of your tiles',
        placementShape: {tileType: TileType.CITY},
      });
      expect(wrapper.find('.con-context__action-line').text())
        .to.eq('Select a space adjacent to one of your tiles');
    });

    it('renders the conversion formula instead of the sentence', () => {
      const wrapper = mountPanel({
        preview, info, selectedLegal: true,
        placementTitle: 'Convert 8 plants into greenery',
        placementShape: {tileType: TileType.GREENERY, placementType: 'greenery'},
        conversion: {amount: 8, icon: 'plants'},
      });
      const formula = wrapper.find('.con-context__formula');
      expect(formula.exists()).to.be.true;
      expect(formula.text()).to.contain('8');
      expect(wrapper.find('.con-context__action-line').exists()).to.be.false;
    });
  });

  /**
   * The panel grew several fact blocks, so everything that did NOT carry its
   * own weight had to go — and with the dossier rework the panel now renders
   * ZERO controller prompts: the confirm CTA, the L3 source hint and the
   * cancel legend all live in the ONE bottom command bar and only there.
   */
  describe('the panel renders no controller prompts', () => {
    it('carries no confirm CTA and no L3 hint', () => {
      const wrapper = mountPanel({preview, info, sourceView: {kindKey: 'Card', card: 'Solar Farm', inspectable: true}, selectedLegal: true});
      expect(wrapper.findAll('.con-inspector__placement')).to.have.lengthOf(0);
      expect(wrapper.findAll('.con-context__source-hint')).to.have.lengthOf(0);
      // NO BUTTON GLYPH AT ALL while nothing overflows — the panel's only
      // remaining glyph is the overflow affordance (`stickR Прокрутка`), which
      // renders solely when content is cut. (A text match cannot state this:
      // «Нельзя разместить здесь» legitimately lives in the always-mounted
      // reason well — that is what keeps legal ↔ illegal shift-free.)
      expect(wrapper.findAllComponents(GamepadGlyph)).to.have.lengthOf(0);
    });

    it('renders NO command rows — every verb lives in the command bar', () => {
      const wrapper = mountPanel({preview, info, selectedLegal: true});
      expect(wrapper.findAll('.con-context__cmd')).to.have.lengthOf(0);
      expect(wrapper.findAll('.con-context__commands')).to.have.lengthOf(0);
      expect(wrapper.text()).to.not.match(/Cancel placement/i);
    });
  });

  /**
   * Legal ↔ illegal is a PAINT change plus the reason well — the cell bar is
   * always mounted (fixed line), so the flip never reflows the identity.
   */
  describe('cell state', () => {
    it('a legal cell reads calm; the reason well stays closed', () => {
      const wrapper = mountPanel({preview, info, selectedLegal: true});
      expect(wrapper.find('.con-context__cellbar').classes()).to.include('con-context__cellbar--ok');
      expect(wrapper.find('.con-context__reason-well').classes())
        .to.not.include('con-context__reason-well--open');
    });

    it('an illegal cell flips the bar and opens the reason well', () => {
      const wrapper = mountPanel({info, selectedLegal: false, illegalReason: 'Occupied'});
      expect(wrapper.find('.con-context__cellbar').classes()).to.include('con-context__cellbar--no');
      const well = wrapper.find('.con-context__reason-well');
      expect(well.classes()).to.include('con-context__reason-well--open');
      expect(well.text()).to.contain('Occupied');
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
