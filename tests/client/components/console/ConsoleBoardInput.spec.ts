import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleBoardInput from '@/client/components/console/ConsoleBoardInput.vue';
import PlacementReasonPopover from '@/client/components/board/PlacementReasonPopover.vue';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {SelectSpaceResponse} from '@/common/inputs/InputResponse';
import {SpaceId} from '@/common/Types';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {consoleState} from '@/client/console/consoleRouter';
import {placementRenderState} from '@/client/components/board/placementRenderState';
import {
  __advancePlacementDwellForTest, __resetPlacementFlowForTest, beginPlacementCommit, LOCK_COMMIT_DWELL_MS, placementFlowState,
  rollbackPlacementCommit,
} from '@/client/console/tilePlacement/placementFlow';

/*
 * The console board-input binder (the successor of the upstream
 * SelectSpace.vue). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). Its real work is DOM wiring on the
 * always-mounted board, which the placement e2e suites cover end to end
 * (console-placement-dossier / -navigation / auto-tile-landing); this spec
 * pins the mount contract on an empty board and, on a board of its own, what
 * the binder keeps in its script: the availability / illegal marks with their
 * mirror and their surgical teardown, the wave's owned wait (the spec drives
 * the kernel's clock), the two-phase confirm's last gate and the ONE commit
 * funnel with its re-arm hook, the confirm dialog it reaches through its one
 * template ref, the two prompt watchers and the delegated hover. It emits
 * nothing (the answer leaves through the `onsave` prop) and exposes nothing —
 * no parent stands a ref on it.
 */

/** The wave's base duration, as the component keeps it. */
const WAVE_MS = 560;

/** A prompt whose pick arms no hero (`marker` — a plain landing): the funnel's own steps are what the spec reads. */
function promptOf(over: Partial<SelectSpaceModel>): SelectSpaceModel {
  return {title: 'Select a space', buttonLabel: 'Save', type: 'space', spaces: [], placementEffect: 'marker', ...over};
}

describe('ConsoleBoardInput', () => {
  let localStorage: FakeLocalStorage;
  let clock: ManualFlowClock;
  let board: HTMLElement | undefined;
  let boardSpaceIdBefore: string | undefined;

  /** The always-mounted board the binder wires: `#main_board` with one selectable cell per id. */
  function standBoard(ids: ReadonlyArray<SpaceId>): void {
    board = document.createElement('div');
    board.id = 'main_board';
    for (const id of ids) {
      const cell = document.createElement('div');
      cell.className = 'board-space-selectable';
      cell.setAttribute('data_space_id', id);
      board.appendChild(cell);
    }
    document.body.appendChild(board);
  }

  function cell(id: SpaceId): HTMLElement {
    return board?.querySelector(`[data_space_id="${id}"]`) as HTMLElement;
  }

  /** What the binder wrote on a cell: its classes past the board's own, the illegal marker, whether a click hangs on it. */
  function wiringOf(id: SpaceId): {marks: Array<string>, illegal: string | null, click: boolean} {
    const el = cell(id);
    return {
      marks: Array.from(el.classList).filter((c) => c !== 'board-space-selectable').sort(),
      illegal: el.getAttribute('data-placement-illegal'),
      click: el.onclick !== null,
    };
  }

  const UNTOUCHED = {marks: [], illegal: null, click: false};

  function binderOf(playerinput: SelectSpaceModel, saved: Array<SelectSpaceResponse> = []) {
    return shallowMount(ConsoleBoardInput, {
      ...globalConfig,
      props: {playerView: {} as PlayerViewModel, playerinput, onsave: (out: SelectSpaceResponse) => saved.push(out)},
    });
  }

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    clock = createManualClock(0);
    setFlowClock(clock);
    boardSpaceIdBefore = consoleState.boardSpaceId;
  });

  afterEach(() => {
    // Module state is BUNDLE-SHARED: the placement flow (its commit safety is a wait of the session's scope), the
    // board cursor and the preferences go back the way the next spec expects them.
    __resetPlacementFlowForTest();
    consoleState.boardSpaceId = boardSpaceIdBefore;
    setFlowClock(undefined);
    board?.remove();
    board = undefined;
    FakeLocalStorage.deregister(localStorage);
    PreferencesManager.resetForTest();
  });

  it('mounts without errors (headless: no title, no warning strip)', () => {
    const wrapper = shallowMount(ConsoleBoardInput, {
      ...globalConfig,
      props: {
        playerView: {} as PlayerViewModel,
        playerinput: {
          title: 'Select a space',
          buttonLabel: 'Save',
          type: 'space',
          spaces: [],
        },
        onsave: () => {},
      },
    });
    expect(wrapper.exists()).to.be.true;
    expect(wrapper.find('.con-board-input').exists()).to.be.true;
  });

  it('lights the legal cells, marks the off-limits ones, hangs a click on each legal cell — and takes all of it back when it leaves', () => {
    standBoard(['03', '04', '05', '06']);
    const wrapper = binderOf(promptOf({spaces: ['03', '04'], illegalSpaces: [{spaceId: '05', reason: 'occupied'}]}));

    expect(wiringOf('03')).to.deep.eq({marks: ['board-space--available', 'con-avail-in'], illegal: null, click: true});
    expect(wiringOf('04')).to.deep.eq({marks: ['board-space--available', 'con-avail-in'], illegal: null, click: true});
    expect(wiringOf('05'), 'a cell the server reported off-limits').to.deep.eq({marks: ['board-space--illegal'], illegal: '1', click: false});
    expect(wiringOf('06'), 'a cell the prompt says nothing about').to.deep.eq(UNTOUCHED);
    expect(placementRenderState.highlightActive, 'BRD-3: the mirror of «the available set exists»').to.eq(true);

    // The availability wave is one shot: its classes come off the cells at its end (an owned wait of the binder's scope).
    expect(cell('03').style.getPropertyValue('--con-wave-d')).to.not.eq('');
    clock.advance(consoleMotionMs(WAVE_MS));
    expect(wiringOf('03').marks).to.deep.eq(['board-space--available']);
    expect(cell('03').style.getPropertyValue('--con-wave-d')).to.eq('');

    wrapper.unmount();
    for (const id of ['03', '04', '05', '06'] as const) {
      expect(wiringOf(id), `cell ${id} after the binder left`).to.deep.eq(UNTOUCHED);
    }
    expect(placementRenderState.highlightActive).to.eq(false);
  });

  it('a binder that leaves mid-wave takes the wave\'s classes with it (the release is guaranteed, not paced)', () => {
    standBoard(['03']);
    const wrapper = binderOf(promptOf({spaces: ['03']}));
    expect(wiringOf('03').marks).to.include('con-avail-in');

    wrapper.unmount();
    expect(wiringOf('03')).to.deep.eq(UNTOUCHED);
    expect(cell('03').style.getPropertyValue('--con-wave-d')).to.eq('');
  });

  it('two-phase confirm: a click LOCKS, the click on the locked cell past the dwell commits through the one funnel — and a refusal re-arms the wiring', () => {
    standBoard(['03', '04']);
    const saved: Array<SelectSpaceResponse> = [];
    const wrapper = binderOf(promptOf({spaces: ['03', '04']}), saved);
    clock.advance(consoleMotionMs(WAVE_MS)); // the entry wave has played — what stands on the cells is the grid
    expect(placementFlowState.twoStep, 'the console default').to.eq(true);

    cell('03').click();
    expect([placementFlowState.phase, placementFlowState.lockedSpaceId]).to.deep.eq(['locked', '03']);
    expect(consoleState.boardSpaceId, 'the board cursor follows a mouse lock').to.eq('03');
    cell('04').click();
    expect([placementFlowState.phase, placementFlowState.lockedSpaceId], 'a click on another legal cell moves the lock').to.deep.eq(['locked', '04']);
    cell('04').click();
    expect(saved, 'inside the dwell the second press is not a commit — the binder is the last gate').to.deep.eq([]);
    expect(placementFlowState.phase).to.eq('locked');

    __advancePlacementDwellForTest(LOCK_COMMIT_DWELL_MS);
    cell('04').click();
    expect(saved).to.deep.eq([{type: 'space', spaceId: '04'}]);
    expect(placementFlowState.phase, 'the point of no return').to.eq('committing');
    expect([wiringOf('03'), wiringOf('04')], 'the funnel tore the grid and the per-cell clicks down before posting').to.deep.eq([UNTOUCHED, UNTOUCHED]);

    // The server said no: the flow returns to the locked cell and the hook the binder registered re-hangs the wiring.
    rollbackPlacementCommit();
    expect([placementFlowState.phase, placementFlowState.lockedSpaceId]).to.deep.eq(['locked', '04']);
    expect([wiringOf('03'), wiringOf('04')].map((w) => [w.marks.includes('board-space--available'), w.click])).to.deep.eq([[true, true], [true, true]]);

    // …and the hook leaves with the binder: a later refusal re-arms nothing on a board nobody binds.
    wrapper.unmount();
    beginPlacementCommit('03');
    rollbackPlacementCommit();
    expect([wiringOf('03'), wiringOf('04')]).to.deep.eq([UNTOUCHED, UNTOUCHED]);
  });

  it('single-press with the confirmation ON: the click opens the dialog through the binder\'s ref, «No» re-lights the grid, «Yes» commits', async () => {
    placementFlowState.twoStep = false;
    PreferencesManager.INSTANCE.set('hide_tile_confirmation', false);
    standBoard(['03', '04']);
    const saved: Array<SelectSpaceResponse> = [];
    // The real dialog (the member the binder calls is the one it exposes); the popovers are not this test's subject.
    const wrapper = mount(ConsoleBoardInput, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {PlacementReasonPopover: true, BoardPlacementPreviewPopover: true, BoardPlacementPreviewContent: true}},
      props: {playerView: {} as PlayerViewModel, playerinput: promptOf({spaces: ['03', '04']}), onsave: (out: SelectSpaceResponse) => saved.push(out)},
    });
    let opened = 0;
    (wrapper.find('dialog').element as HTMLDialogElement).showModal = () => {
      opened++;
    };
    const [yes, no] = wrapper.findAll('menu.dialog-menu > button');
    clock.advance(consoleMotionMs(WAVE_MS)); // the entry wave has played — what stands on the cells is the grid

    cell('03').click();
    expect(opened, '`confirmation.value?.show()` reached the dialog').to.eq(1);
    expect(saved).to.deep.eq([]);
    expect([wiringOf('03').marks, wiringOf('04').marks], 'the grid goes dark while the dialog asks').to.deep.eq([[], []]);

    await no.trigger('click');
    expect(saved).to.deep.eq([]);
    expect([wiringOf('03').marks, wiringOf('04').marks].map((marks) => marks.includes('board-space--available'))).to.deep.eq([true, true]);

    cell('04').click();
    expect(opened).to.eq(2);
    await yes.trigger('click');
    expect(saved).to.deep.eq([{type: 'space', spaceId: '04'}]);
    expect(placementFlowState.phase).to.eq('committing');
  });

  it('single-press with the confirmation OFF (the fork\'s default): the click commits straight through', () => {
    placementFlowState.twoStep = false;
    standBoard(['03']);
    const saved: Array<SelectSpaceResponse> = [];
    binderOf(promptOf({spaces: ['03']}), saved);

    cell('03').click();
    expect(saved).to.deep.eq([{type: 'space', spaceId: '03'}]);
    expect(placementFlowState.phase).to.eq('committing');
  });

  it('re-hangs the wiring when the legal set changes under it (a move prompt\'s level), and the reasons follow the prompt', async () => {
    standBoard(['03', '04', '05']);
    const wrapper = binderOf(promptOf({spaces: ['03']}));
    clock.advance(consoleMotionMs(WAVE_MS));
    expect(wiringOf('03')).to.deep.eq({marks: ['board-space--available'], illegal: null, click: true});

    await wrapper.setProps({playerinput: promptOf({spaces: ['04', '05']})});
    expect(wiringOf('03'), 'the old set\'s click is detached first').to.deep.eq(UNTOUCHED);
    expect(wiringOf('04'), 'the new level plays its own wave').to.deep.eq({marks: ['board-space--available', 'con-avail-in'], illegal: null, click: true});
    expect(wiringOf('05').click).to.eq(true);

    // The SAME set under a new array is no change: nothing is re-hung (a mark taken off by hand stays off).
    cell('04').classList.remove('board-space--available');
    await wrapper.setProps({playerinput: promptOf({spaces: ['05', '04']})});
    expect(wiringOf('04').marks).to.not.include('board-space--available');

    // The per-cell reasons follow the prompt on their own watcher.
    await wrapper.setProps({playerinput: promptOf({spaces: ['05', '04'], illegalSpaces: [{spaceId: '03', reason: 'occupied'}]})});
    expect(wiringOf('03')).to.deep.eq({marks: ['board-space--illegal'], illegal: '1', click: false});
    await wrapper.setProps({playerinput: promptOf({spaces: ['05', '04']})});
    expect(wiringOf('03')).to.deep.eq(UNTOUCHED);
  });

  it('the delegated hover hands an off-limits cell\'s reason to the premium popover, and lets go off the board and on unmount', async () => {
    standBoard(['03', '05']);
    const wrapper = binderOf(promptOf({spaces: ['03'], illegalSpaces: [{spaceId: '05', reason: 'occupied'}]}));
    const popover = wrapper.findComponent(PlacementReasonPopover);
    expect([popover.props('reasons'), popover.props('anchor')]).to.deep.eq([[], undefined]);

    cell('05').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    await wrapper.vm.$nextTick();
    expect(popover.props('reasons'), 'one structured reason — never a native `title`').to.have.length(1);
    expect(popover.props('anchor')).to.not.eq(undefined);
    expect(cell('05').hasAttribute('title')).to.eq(false);

    document.body.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    await wrapper.vm.$nextTick();
    expect([popover.props('reasons'), popover.props('anchor')]).to.deep.eq([[], undefined]);

    // After the binder left, the document listener is gone: a hover reaches nothing (and throws nothing).
    wrapper.unmount();
    cell('05').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
  });
});
