import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import SpecialCellMarker from '@/client/components/board/SpecialCellMarker.vue';
import {boardInfoState, clearBoardCellHover, hoverBoardCell, setBoardCellHoverQuiet} from '@/client/components/board/boardInfoState';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {SpaceId} from '@/common/Types';

/**
 * A cell's «i» marker lights up for a cursor the player SEES — a mouse hover, a console inspection / placement — and
 * never for the console board's idle selection, which seeds on the centre at boot and warms that cell's facts (the
 * owner's 4K frame of 2026-11-02: Amazonis's restricted centre «focused» on a board nobody was inspecting).
 */
describe('SpecialCellMarker', () => {
  const CENTRE = '33' as SpaceId;
  const space = {id: CENTRE, x: 4, y: 4, spaceType: SpaceType.RESTRICTED, bonus: []} as unknown as SpaceModel;

  function marker() {
    return mount(SpecialCellMarker, {...globalConfig, props: {space, boardName: BoardName.AMAZONIS}});
  }

  afterEach(() => {
    clearBoardCellHover(CENTRE);
    setBoardCellHoverQuiet(false);
  });

  it('a visible hover lights the marker', async () => {
    const wrapper = marker();
    hoverBoardCell(CENTRE);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.special-cell-marker').classes()).to.include('special-cell-marker--active');
  });

  it('the idle console selection warms the facts but never lights the marker', async () => {
    const wrapper = marker();
    hoverBoardCell(CENTRE, undefined, {quiet: true});
    await wrapper.vm.$nextTick();
    expect(boardInfoState.spaceId, 'the facts are still warmed for the cell').eq(CENTRE);
    expect(wrapper.find('.special-cell-marker').classes()).to.not.include('special-cell-marker--active');
  });

  it('an inspection opening on the same cell lights it; closing it quiets it again', async () => {
    const wrapper = marker();
    hoverBoardCell(CENTRE, undefined, {quiet: true});
    setBoardCellHoverQuiet(false);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.special-cell-marker').classes()).to.include('special-cell-marker--active');
    setBoardCellHoverQuiet(true);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.special-cell-marker').classes()).to.not.include('special-cell-marker--active');
  });
});
