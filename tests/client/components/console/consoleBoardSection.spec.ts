/*
 * ConsoleBoardSection — the console's board STAGE: the real board fitted to the stage's box, and the controller's cell
 * selection over it. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its flows — the framing's
 * convergence, Planet Focus, the placement reticle's poses, the relation layer on a live board — are its e2e's subject
 * (`console-board-framing`, `console-planet-focus`, `console-placement-navigation`, `console-cell-dossier`); this spec
 * pins what a unit mount can say about the surface itself:
 *  - it mounts in a minimal honest state with no Vue warning (`globalConfig` turns one into a failure): the board is
 *    handed the game, the seats and the tile view, the cursor is seeded on the cell nearest the board's centre and that
 *    cell wears the spotlight; a stage with no box fits nothing;
 *  - the shell's surface registry reaches EXACTLY the six members its controllers read (R11), and each answers;
 *  - a placement: the first fit writes the scale for the stage's box, the reticle stands in the board's own px-space
 *    (teleported INTO `.board-cont`), the relation layer follows the focused cell's preview, A clicks the legal cell —
 *    and the measurement cache and the registry of marked cells are the MODULE's (R25: `consoleBoardSectionState.ts`).
 *
 * The board itself and the reticle are stubbed (their own specs' subjects). jsdom lays nothing out, so the stand-in
 * board gives its cells and its track markers the boxes the section's traversal measures.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleState} from '@/client/console/consoleRouter';
import {boardInfoState} from '@/client/components/board/boardInfoState';
import {bonusZoneCache, cellPosCache, relationMarked} from '@/client/components/console/consoleBoardSectionState';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';

/** What the shell's controllers reach through the surface registry (the sheet's MUST EXPOSE list). */
type BoardSurface = {
  move(dir: NavDirection): void,
  seed(preferAvailable: boolean): void,
  activate(): boolean,
  focusSpace(spaceId: string): boolean,
  enterTrackInspect(): boolean,
  stepTrackMarker(step: 1 | -1): void,
};
const EXPOSED = ['activate', 'enterTrackInspect', 'focusSpace', 'move', 'seed', 'stepTrackMarker'];

function box(left: number, top: number, width: number, height: number): DOMRect {
  return {left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({})} as DOMRect;
}

/*
 * THE STAND-IN BOARD — `.board-cont` at the page's origin, unscaled (670 × 600, so a cell's intrinsic board px ARE its
 * screen px), two hex rows offset by half a cell and three track markers round the centre (335, 300):
 *
 *     row A (y 200)      [10]  [11]  [12]        centres x 300 · 350 · 400
 *     row B (y 240)         [16]  [17]           centres x 335 · 385
 */
const CELLS: ReadonlyArray<{id: string, left: number, top: number}> = [
  {id: '10', left: 277, top: 200}, {id: '11', left: 327, top: 200}, {id: '12', left: 377, top: 200},
  {id: '16', left: 312, top: 240}, {id: '17', left: 362, top: 240},
];
/** Twelve, three and nine o'clock — the ring's order by angle. */
const MARKERS: ReadonlyArray<{key: string, cx: number, cy: number}> = [
  {key: 'oxygen-8', cx: 335, cy: 40}, {key: 'temperature-0', cx: 600, cy: 300}, {key: 'venus-16', cx: 70, cy: 300},
];

type BoardStubOptions = {
  /** The cells the board binder would have painted legal. */
  available?: ReadonlyArray<string>,
  markers?: boolean,
  /** The stage's own box (jsdom gives it none — the section then fits nothing, as for a `v-show`n stage). */
  stageBox?: {w: number, h: number},
  /** The cells clicked, in order. */
  clicks?: Array<string>,
  /** The markers whose own hover the section fired, in order. */
  hovers?: Array<string>,
};

// (A render function, not a template string: the runtime compiler is not in this build.)
function boardStub(opts: BoardStubOptions = {}) {
  return defineComponent({
    name: 'GameBoardView',
    props: {
      game: {type: Object as PropType<GameModel>, required: true},
      players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
      tileView: {type: String, required: true},
    },
    emits: ['toggleTileView'],
    // A child's `mounted` runs before its parent's: the boxes stand when the section first measures.
    mounted() {
      const cont = this.$el as HTMLElement;
      cont.getBoundingClientRect = () => box(0, 0, 670, 600);
      for (const cell of CELLS) {
        const el = cont.querySelector<HTMLElement>(`[data_space_id="${cell.id}"]`);
        if (el !== null) {
          el.getBoundingClientRect = () => box(cell.left, cell.top, 46, 51);
        }
      }
      for (const marker of MARKERS) {
        const el = cont.querySelector<HTMLElement>(`[data-arc-marker="${marker.key}"]`);
        if (el !== null) {
          el.getBoundingClientRect = () => box(marker.cx - 17, marker.cy - 17, 34, 34);
        }
      }
      const stage = cont.parentElement;
      const stageBox = opts.stageBox;
      if (stage !== null && stageBox !== undefined) {
        stage.getBoundingClientRect = () => box(0, 0, stageBox.w, stageBox.h);
      }
    },
    render() {
      const cells = CELLS.map((cell) => h('div', {
        class: ['board-space', {'board-space--available': opts.available?.includes(cell.id) === true}],
        data_space_id: cell.id,
        onClick: () => opts.clicks?.push(cell.id),
      }));
      const markers = opts.markers === true ?
        MARKERS.map((marker) => h('span', {'class': 'arc-marker', 'data-arc-marker': marker.key, 'onMouseenter': () => opts.hovers?.push(marker.key)})) :
        [];
      return h('div', {'class': 'board-cont', 'data-tile-view': this.tileView}, [...cells, ...markers]);
    },
  });
}

const CursorStub = defineComponent({
  name: 'ConsoleBoardCursor',
  props: {
    x: {type: Number, required: true},
    y: {type: Number, required: true},
    legal: {type: Boolean, required: true},
    phase: {type: String, required: true},
    tileArtClass: {type: String, default: ''},
    cubeColor: {type: String, default: undefined},
    bonusZone: {type: Object, default: undefined},
    pickup: {type: Boolean, default: false},
    afloat: {type: Boolean, default: false},
    marker: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'cursor-stub', 'data-x': this.x, 'data-y': this.y, 'data-legal': String(this.legal), 'data-phase': this.phase});
  },
});

const THIS_PLAYER = {color: 'red'} as unknown as PublicPlayerModel;
// No cell of the board carries geometry here (`spaces: []`), so a placement's cursor opens by the section's own
// on-screen fallback: the legal cell nearest the board's centre.
const PLAYER_VIEW = {
  id: 'p-player-id',
  thisPlayer: THIS_PLAYER,
  players: [THIS_PLAYER],
  game: {gameOptions: {boardName: 'tharsis', expansions: {}}, spaces: []},
} as unknown as PlayerViewModel;

/** The focused cell's preview: ONE spatial fact — the ocean on «12» pays this placement. */
const PREVIEW = {
  space: '17',
  kind: 'ocean',
  legal: true,
  costFacts: [],
  immediateFacts: [{category: 'ocean-adjacency-bonus', spaces: ['12']}],
  recipientFacts: [],
  warningFacts: [],
  futureScoringFacts: [],
  ruleFacts: [],
} as unknown as BoardPlacementPreview;

function globalWith(board: ReturnType<typeof boardStub>) {
  return {...globalConfig.global, stubs: {GameBoardView: board, ConsoleBoardCursor: CursorStub}};
}

/** A board cell's selector — the board's own id attribute. */
function cellSelector(id: string): string {
  return `[data_space_id="${id}"]`;
}

describe('ConsoleBoardSection — the console\'s board stage', () => {
  // Module state is BUNDLE-SHARED: the section writes the router's board cursor and the hover pipeline, and fills
  // its own module's caches.
  let saved: {boardSpaceId: string | undefined, trackMarker: string | undefined, freeRoam: boolean};
  let hover: {spaceId: typeof boardInfoState.spaceId, info: typeof boardInfoState.info, loading: boolean, quiet: boolean, participantId: string | undefined};
  // `CSS.escape` is the browser's (jsdom carries it on its window; the node global has none): the track-marker lookup
  // escapes its key with it, so the suite lends the page's for its own length.
  let lentCss = false;

  before(() => {
    const scope = globalThis as {CSS?: unknown};
    if (scope.CSS === undefined) {
      scope.CSS = (window as unknown as {CSS: unknown}).CSS;
      lentCss = true;
    }
  });
  after(() => {
    if (lentCss) {
      delete (globalThis as {CSS?: unknown}).CSS;
    }
  });

  beforeEach(() => {
    saved = {boardSpaceId: consoleState.boardSpaceId, trackMarker: consoleState.trackMarker, freeRoam: consoleState.freeRoam};
    hover = {
      spaceId: boardInfoState.spaceId,
      info: boardInfoState.info,
      loading: boardInfoState.loading,
      quiet: boardInfoState.quiet,
      participantId: boardInfoState.cfg.participantId,
    };
    consoleState.boardSpaceId = undefined;
    consoleState.trackMarker = undefined;
    consoleState.freeRoam = false;
    boardInfoState.spaceId = undefined;
    boardInfoState.info = undefined;
    boardInfoState.loading = false;
    boardInfoState.quiet = false;
    // Unconfigured, the hover pipeline builds no URL: the cell's facts are asked of nobody.
    boardInfoState.cfg.participantId = undefined;
    // The page's `--board-scale` is ONE variable (the section takes it back at its unmount): each test starts with none.
    document.documentElement.style.removeProperty('--board-scale');
  });
  afterEach(() => {
    consoleState.boardSpaceId = saved.boardSpaceId;
    consoleState.trackMarker = saved.trackMarker;
    consoleState.freeRoam = saved.freeRoam;
    boardInfoState.spaceId = hover.spaceId;
    boardInfoState.info = hover.info;
    boardInfoState.loading = hover.loading;
    boardInfoState.quiet = hover.quiet;
    boardInfoState.cfg.participantId = hover.participantId;
    cellPosCache.clear();
    bonusZoneCache.clear();
    relationMarked.clear();
  });

  it('mounts the calm board home: the board gets the game, the seats and the tile view; the cursor is seeded on the centre cell and spotlit; a stage with no box fits nothing', async () => {
    const board = boardStub();
    const wrapper = mount(ConsoleBoardSection, {global: globalWith(board), props: {playerView: PLAYER_VIEW, placementActive: false}});

    expect(wrapper.classes()).to.include('con-board');
    expect(wrapper.classes().filter((c) => c.startsWith('con-board--')), 'no live cursor, no camera, no fit yet').to.deep.eq([]);
    expect(wrapper.attributes('data-framing'), 'the framing e2e\'s signal: nothing has been fitted').to.eq('busy');
    expect(document.documentElement.style.getPropertyValue('--board-scale'), 'a stage with no box keeps the last scale').to.eq('');

    const view = wrapper.findComponent(board);
    expect(wrapper.find('.con-board__stage > .board-cont').exists(), 'the real board stands in the stage').to.eq(true);
    expect(view.props('game'), 'the park holds nothing — the board displays the view\'s own game').to.deep.eq(PLAYER_VIEW.game);
    expect(view.props('players')).to.deep.eq(PLAYER_VIEW.players);
    expect(view.props('tileView')).to.eq('show');

    // The cursor nobody sees yet: seeded on the cell nearest the board's centre, its facts warmed QUIETLY.
    expect(consoleState.boardSpaceId).to.eq('16');
    expect(boardInfoState.spaceId).to.eq(undefined);
    await nextTick();
    expect(boardInfoState.spaceId, 'the hover pipeline is asked for the seeded cell').to.eq('16');
    expect(boardInfoState.quiet, 'no inspection, no placement — the cell\'s marker stays dark').to.eq(true);
    expect(CELLS.filter((c) => wrapper.find(cellSelector(c.id)).classes().includes('con-cell-sel')).map((c) => c.id), 'the spotlight').to.deep.eq(['16']);
    expect(wrapper.find('.cursor-stub').exists(), 'the reticle is a placement\'s').to.eq(false);

    // The board's own toggle cycles the tile view it is handed.
    view.vm.$emit('toggleTileView');
    await nextTick();
    expect(view.props('tileView')).to.eq('hide');
    expect(wrapper.find('.board-cont').attributes('data-tile-view')).to.eq('hide');

    // An inspection makes the cursor one the player SEES.
    await wrapper.setProps({inspecting: true});
    expect(wrapper.classes()).to.include.members(['con-board--live', 'con-board--inspecting']);
    expect(wrapper.classes()).to.not.include('con-board--placing');
    expect(boardInfoState.quiet).to.eq(false);
  });

  it('the shell\'s surface registry reaches EXACTLY the six members its controllers read — and each answers', async () => {
    const hovers: Array<string> = [];
    const board = boardStub({markers: true, hovers});
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleBoardSection, {ref: 'board', playerView: PLAYER_VIEW, placementActive: false, inspecting: true})]),
    });
    const host = mount(Host, {global: globalWith(board)});
    const surface = host.vm.$refs.board as BoardSurface;
    expect(Object.keys(surface as object).sort(), 'defineExpose is the sheet\'s MUST EXPOSE list').to.deep.eq(EXPOSED);
    const spotlit = () => CELLS.filter((c) => host.find(cellSelector(c.id)).classes().includes('con-cell-sel')).map((c) => c.id);
    const ringed = () => MARKERS.filter((m) => host.find(`[data-arc-marker="${m.key}"]`).classes().includes('con-marker-sel')).map((m) => m.key);

    // move — STRICT hex traversal in an inspection: left / right stay in the row, up / down keep the column anchor.
    expect(consoleState.boardSpaceId, 'the mount\'s own seed').to.eq('16');
    surface.move('right');
    expect(consoleState.boardSpaceId).to.eq('17');
    surface.move('up');
    expect(consoleState.boardSpaceId, 'the row above, the cell nearest the column the run started in').to.eq('12');
    surface.move('left');
    expect(consoleState.boardSpaceId).to.eq('11');

    // focusSpace — a landing: the cursor moves and the column anchor follows it.
    expect(surface.focusSpace('99'), 'not a cell of this board').to.eq(false);
    expect(consoleState.boardSpaceId).to.eq('11');
    expect(surface.focusSpace('10')).to.eq(true);
    expect(consoleState.boardSpaceId).to.eq('10');
    surface.move('down');
    expect(consoleState.boardSpaceId, 'the anchor is the landed cell\'s column').to.eq('16');

    // activate — A places only during a placement.
    expect(surface.activate()).to.eq(false);

    // seed — back onto the cell nearest the board's centre.
    surface.focusSpace('12');
    surface.seed(false);
    expect(consoleState.boardSpaceId).to.eq('16');
    await nextTick();
    expect(spotlit()).to.deep.eq(['16']);

    // enterTrackInspect / stepTrackMarker — the scale ring: in at twelve o'clock, then round it, wrapping.
    expect(surface.enterTrackInspect()).to.eq(true);
    expect(consoleState.trackMarker).to.eq('oxygen-8');
    await nextTick();
    expect(ringed()).to.deep.eq(['oxygen-8']);
    expect(hovers, 'the marker\'s own hover is what shows its tooltip').to.deep.eq(['oxygen-8']);
    expect(spotlit(), 'one focus at a time').to.deep.eq([]);
    surface.stepTrackMarker(1);
    expect(consoleState.trackMarker).to.eq('temperature-0');
    await nextTick();
    expect(ringed()).to.deep.eq(['temperature-0']);
    surface.stepTrackMarker(-1);
    surface.stepTrackMarker(-1);
    expect(consoleState.trackMarker, 'counter-clockwise past twelve — «по кругу»').to.eq('venus-16');

    // A cell landing leaves the ring: the marker lets go, the cell's spotlight is back.
    surface.focusSpace('11');
    expect(consoleState.trackMarker).to.eq(undefined);
    await nextTick();
    expect(ringed()).to.deep.eq([]);
    expect(spotlit()).to.deep.eq(['11']);
  });

  it('a placement: the first fit scales the stage, the reticle stands on the legal cell in board px, the preview lights its relations, A clicks the cell', async () => {
    const clicks: Array<string> = [];
    // A stage of exactly twice the seeded natural box (644 × 556) plus its pads.
    const board = boardStub({available: ['11', '17'], stageBox: {w: 1296, h: 1116}, clicks});
    const wrapper = mount(ConsoleBoardSection, {
      global: globalWith(board),
      props: {playerView: PLAYER_VIEW, placementActive: true, legalSpaces: ['11', '17']},
    });
    const surface = wrapper.vm as unknown as BoardSurface;
    // (Inside `.board-cont`, under test-utils' stand-in for the reticle's leave transition.)
    const reticle = () => wrapper.find('.con-board__stage > .board-cont .cursor-stub');

    // THE STAGE — the first fit lands at mount, and the instrument bleed follows the scale.
    expect(document.documentElement.style.getPropertyValue('--board-scale')).to.eq('2.0000');
    expect((wrapper.find('.con-board__stage').element as HTMLElement).style.getPropertyValue('--con-arc-bleed')).to.eq('64.0px');
    expect(surface.enterTrackInspect(), 'a board with no track markers has no ring to enter').to.eq(false);

    // THE CURSOR — constrained to the legal cells, opening on the one nearest the centre.
    expect(consoleState.boardSpaceId).to.eq('17');
    await nextTick();
    expect(wrapper.classes()).to.include.members(['con-board--live', 'con-board--placing', 'con-board--fitted']);
    expect(wrapper.classes()).to.not.include('con-board--locked');
    expect(reticle().exists(), 'teleported INTO the board — it rides the planet\'s transform').to.eq(true);
    expect(reticle().attributes()).to.include({'data-x': '362', 'data-y': '240', 'data-legal': 'true', 'data-phase': 'navigate'});
    expect(cellPosCache.get('tharsis|17'), 'measured once per (map, cell) — the module\'s cache').to.deep.eq({x: 362, y: 240});

    // THE RELATION LAYER follows the focused cell's preview: the paying ocean answers on its facing side.
    await wrapper.setProps({cellPreview: PREVIEW});
    const ocean = wrapper.find(cellSelector('12'));
    expect(ocean.classes()).to.include.members(['con-rel', 'con-rel--ocean']);
    expect(ocean.classes()).to.not.include('con-rel--far');
    expect((ocean.element as HTMLElement).style.getPropertyValue('--rel-x')).to.eq('42.3%');
    expect((ocean.element as HTMLElement).style.getPropertyValue('--rel-y')).to.eq('70.6%');
    expect([...relationMarked.entries()], 'the registry remembers exactly what was applied').to.deep.eq([[ocean.element, 'con-rel--ocean']]);

    // A — the cell's own click, the binder's submission contract.
    expect(surface.activate()).to.eq(true);
    expect(clicks).to.deep.eq(['17']);

    // Off the legal set (the shell's own landing): the reticle reads blocked, the stale preview marks nothing, A refuses.
    expect(surface.focusSpace('10')).to.eq(true);
    await nextTick();
    expect(reticle().attributes()).to.include({'data-x': '277', 'data-y': '200', 'data-legal': 'false'});
    expect(ocean.classes()).to.not.include('con-rel');
    expect(relationMarked.size).to.eq(0);
    expect(surface.activate()).to.eq(false);
    expect(clicks, 'nothing is clicked on an illegal cell').to.deep.eq(['17']);

    // The placement ends: the reticle goes with it. The unmount takes the scale back.
    await wrapper.setProps({placementActive: false});
    expect(reticle().exists()).to.eq(false);
    expect(wrapper.classes()).to.not.include('con-board--placing');
    wrapper.unmount();
    expect(document.documentElement.style.getPropertyValue('--board-scale'), 'the page keeps no scale of a stage that is gone').to.eq('');
  });
});
