import {shallowMount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import Board from '@/client/components/Board.vue';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {boardInfoState, clearBoardCellHover} from '@/client/components/board/boardInfoState';
import {placementRenderState, setPlacementHighlightActive} from '@/client/components/board/placementRenderState';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceName} from '@/common/boards/SpaceName';

/*
 * Board is a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — the
 * cells the game laid, the layout family on its root — and the one behaviour of its own: the hex-wide hover delegate,
 * which listens on the component's ROOT (a template ref since the conversion — it was `this.$el`) and feeds the
 * BoardInformation hover store. It emits nothing and exposes nothing.
 */
const spaces: SpaceModel[] = [
  {
    id: 'c01',
    x: 1,
    y: 1,
    bonus: [],
    spaceType: SpaceType.COLONY,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
  {
    id: 'c02',
    x: 2,
    y: 1,
    bonus: [],
    spaceType: SpaceType.COLONY,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
  {
    id: 'c69',
    x: 3,
    y: 1,
    bonus: [],
    spaceType: SpaceType.COLONY,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
  {
    id: '04',
    x: 3,
    y: 1,
    bonus: [],
    spaceType: SpaceType.OCEAN,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
];

/** The one Mars cell of the list above — the cell the hover tests point at. */
const OCEAN = spaces[3].id;

/** A cell as the delegate sees it: the element that carries `data_space_id`, with a child of its own inside. */
const CellStub = defineComponent({
  name: 'BoardSpace',
  props: {
    space: {type: Object as () => SpaceModel, required: true},
    tileView: {type: String, default: 'show'},
    aresExtension: {type: Boolean, default: false},
  },
  render() {
    return h('div', {'class': 'cell-stub', 'data_space_id': this.space.id}, [h('i', {'class': 'cell-stub__inner'})]);
  },
});

/** A pointer move as the browser reports it: `mouseover` / `mouseout` bubble, and name where the pointer came from / went to. */
function move(type: 'mouseover' | 'mouseout', target: Element, relatedTarget: Element): void {
  target.dispatchEvent(new window.MouseEvent(type, {bubbles: true, relatedTarget}));
}

describe('Board', () => {
  // Module state is BUNDLE-SHARED: every mount tells the BoardInformation layer its board, and the delegate writes the
  // hover store.
  let saved: {
    spaceId: typeof boardInfoState.spaceId,
    info: typeof boardInfoState.info,
    loading: boolean,
    cellRect: typeof boardInfoState.cellRect,
    quiet: boolean,
    participantId: string | undefined,
    boardName: BoardName | undefined,
    highlightActive: boolean,
  };

  beforeEach(() => {
    saved = {
      spaceId: boardInfoState.spaceId,
      info: boardInfoState.info,
      loading: boardInfoState.loading,
      cellRect: boardInfoState.cellRect,
      quiet: boardInfoState.quiet,
      participantId: boardInfoState.cfg.participantId,
      boardName: boardInfoState.cfg.boardName,
      highlightActive: placementRenderState.highlightActive,
    };
    boardInfoState.spaceId = undefined;
    // Unconfigured, the hover pipeline builds no URL: the cell's facts are asked of nobody.
    boardInfoState.cfg.participantId = undefined;
    setPlacementHighlightActive(false);
  });
  afterEach(() => {
    boardInfoState.spaceId = saved.spaceId;
    boardInfoState.info = saved.info;
    boardInfoState.loading = saved.loading;
    boardInfoState.cellRect = saved.cellRect;
    boardInfoState.quiet = saved.quiet;
    boardInfoState.cfg.participantId = saved.participantId;
    boardInfoState.cfg.boardName = saved.boardName;
    setPlacementHighlightActive(saved.highlightActive);
  });

  it('has visible tiles on the board', () => {
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, tileView: 'hide', venusScaleLevel: 0, boardName: BoardName.THARSIS},
    });

    const boardSpacesWrappers = wrapper.findAllComponents(BoardSpace).filter((wrapper) => {
      return wrapper.attributes('data-test') === 'board-space';
    });

    expect(
      boardSpacesWrappers.every((wrapper) => wrapper.props('tileView') === 'hide'),
    ).to.be.true;
  });

  it('has hidden tiles on the board', () => {
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, tileView: 'show', venusScaleLevel: 0, boardName: BoardName.THARSIS},
    });

    const boardSpacesWrappers = wrapper.findAllComponents(BoardSpace).filter((wrapper) => {
      return wrapper.attributes('data-test') === 'board-space';
    });

    expect(
      boardSpacesWrappers.every((wrapper) => wrapper.props('tileView') === 'show'),
    ).to.be.true;
  });

  // Turmoil Redux TR27 — Aurora Station's cell is the fifth of the Venus flank: drawn where the game laid it, never otherwise.
  it('draws the Aurora Station cell only where the game laid it', () => {
    const aurora: SpaceModel = {...spaces[0], id: SpaceName.AURORA_STATION, x: -1, y: -1};
    const drawn = (list: SpaceModel[]) => shallowMount(Board, {
      ...globalConfig,
      props: {spaces: list, expansions: DEFAULT_EXPANSIONS, tileView: 'show', venusScaleLevel: 0, boardName: BoardName.THARSIS},
    }).findAllComponents(BoardSpace).some((wrapper) => (wrapper.props('space') as SpaceModel).id === SpaceName.AURORA_STATION);

    expect(drawn([...spaces, aurora])).is.true;
    expect(drawn(spaces)).is.false;
  });

  it('wears its layout family on the root, takes what its parent lets fall through there, and tells the BoardInformation layer which board it is', () => {
    const classic = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, venusScaleLevel: 0, boardName: BoardName.THARSIS},
      attrs: {id: 'shortkey-board'},
    });
    expect(classic.classes()).to.deep.eq(['board-cont', 'board-with-venus']);
    expect(classic.attributes('id'), 'the hotkey anchor of GameBoardView lands on the root').to.eq('shortkey-board');
    expect(boardInfoState.cfg.boardName).to.eq(BoardName.THARSIS);

    const large = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, venusScaleLevel: 0, boardName: BoardName.AMAZONIS_PLANITIA},
    });
    expect(large.classes(), 'the eleven-row field scopes its own positions').to.deep.eq(['board-cont', 'board-with-venus', 'board-cont--large']);
    expect(boardInfoState.cfg.boardName).to.eq(BoardName.AMAZONIS_PLANITIA);
  });

  describe('the hex-wide hover delegate, on the root', () => {
    function board() {
      const wrapper = shallowMount(Board, {
        global: {...globalConfig.global, stubs: {BoardSpace: CellStub}},
        props: {spaces, expansions: DEFAULT_EXPANSIONS, venusScaleLevel: 0, boardName: BoardName.THARSIS},
      });
      const cell = wrapper.find(`[data_space_id="${OCEAN}"]`);
      return {wrapper, root: wrapper.element, cell: cell.element, inner: cell.find('.cell-stub__inner').element};
    }

    it('a cell entered anywhere under the root is hovered and leaving it clears the hover; a move inside one cell is neither', () => {
      const {root, cell, inner} = board();

      move('mouseover', inner, cell);
      expect(boardInfoState.spaceId, 'from the cell\'s own body onto its child — no entry').to.eq(undefined);

      move('mouseover', inner, root);
      expect(boardInfoState.spaceId).to.eq(OCEAN);
      expect(boardInfoState.cellRect, 'the rect the delegate already holds goes with the hover').to.not.eq(undefined);

      move('mouseout', inner, cell);
      expect(boardInfoState.spaceId, 'from the child back onto the cell\'s own body — no leave').to.eq(OCEAN);

      move('mouseout', cell, root);
      expect(boardInfoState.spaceId).to.eq(undefined);
    });

    it('is silent while a placement lights the board — the cell\'s reason popover owns the hover then', () => {
      const {root, inner} = board();

      setPlacementHighlightActive(true);
      move('mouseover', inner, root);
      expect(boardInfoState.spaceId).to.eq(undefined);

      setPlacementHighlightActive(false);
      move('mouseover', inner, root);
      expect(boardInfoState.spaceId).to.eq(OCEAN);
    });

    it('leaves with the board: an unmounted board hears nothing', () => {
      const {wrapper, root, inner} = board();

      move('mouseover', inner, root);
      expect(boardInfoState.spaceId).to.eq(OCEAN);
      clearBoardCellHover(OCEAN);

      wrapper.unmount();
      move('mouseover', inner, root);
      expect(boardInfoState.spaceId, 'the listeners left the root before it was taken down').to.eq(undefined);
    });
  });
});
