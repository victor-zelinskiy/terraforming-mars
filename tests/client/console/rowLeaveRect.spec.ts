import {expect} from 'chai';
import {nextTick, reactive} from 'vue';
import {holdRowRects, installRowLeaveRects, leavingRectOf, resetRowLeaveRects} from '@/client/console/surfaceMotion/rowLeaveRect';

/*
 * THE RECT A ROW MEMBER HAD WHEN ITS LEAVE WAS DECIDED (surfaceMotion/rowLeaveRect.ts).
 *
 * A section frozen for its dissolve is pinned to where the player last SAW it. Its leave hook cannot measure that:
 * under Vapor the board's `v-show` (an earlier sibling's render effect) has already re-flowed the row by the hook's
 * turn (the capability table's row «`v-show` is applied in the template's order»). So the row is measured in the
 * assignment that decides the leave, and the hook asks for that rect.
 */
describe('rowLeaveRect — a leaving row member is frozen where it stood when the leave was decided', () => {
  /** A row whose members answer the rect the test gives them (jsdom lays nothing out). */
  function row(rects: Record<string, [number, number]>): {el: HTMLElement, member: (id: string) => HTMLElement, lay: (id: string, left: number, width: number) => void} {
    const el = document.createElement('div');
    const live: Record<string, [number, number]> = {...rects};
    for (const id of Object.keys(rects)) {
      const child = document.createElement('div');
      child.id = id;
      child.getBoundingClientRect = () => ({left: live[id][0], top: 100, width: live[id][1], height: live[id][1] === 0 ? 0 : 900, right: live[id][0] + live[id][1], bottom: 1000, x: live[id][0], y: 100, toJSON: () => ({})});
      el.appendChild(child);
    }
    return {
      el,
      member: (id) => el.querySelector<HTMLElement>(`#${id}`)!,
      lay: (id, left, width) => {
        live[id] = [left, width];
      },
    };
  }
  const span = (r: DOMRect): string => `${r.left}+${r.width}`;

  afterEach(() => resetRowLeaveRects());

  it('with no hold a leaving member answers its LIVE rect', () => {
    const r = row({hand: [480, 3360]});
    expect(span(leavingRectOf(r.member('hand')))).to.eq('480+3360');
    r.lay('hand', 2400, 1440);
    expect(span(leavingRectOf(r.member('hand')))).to.eq('2400+1440');
  });

  it('a hold keeps the rect of the frame on screen through the flush that re-flows the row — and lets go after it', async () => {
    const r = row({rail: [0, 470], board: [0, 0], hand: [480, 3360]});
    holdRowRects(r.el);
    // The flush: the board is back in the row, the hand is what is left of it.
    r.lay('board', 480, 2880);
    r.lay('hand', 2400, 1440);
    expect(span(leavingRectOf(r.member('hand'))), 'the hook of that flush gets the rect the player saw').to.eq('480+3360');
    expect(span(leavingRectOf(r.member('board'))), 'a member that was not laid out is not held: its live rect').to.eq('480+2880');
    await nextTick();
    expect(span(leavingRectOf(r.member('hand'))), 'the hold ends with the flush').to.eq('2400+1440');
  });

  it('the FIRST decision of a tick is the frame on screen: a second one in the same tick does not re-measure', async () => {
    const r = row({hand: [480, 3360]});
    holdRowRects(r.el);
    r.lay('hand', 2400, 1440);
    holdRowRects(r.el);
    expect(span(leavingRectOf(r.member('hand')))).to.eq('480+3360');
    await nextTick();
    holdRowRects(r.el);
    expect(span(leavingRectOf(r.member('hand'))), 'a new tick measures again').to.eq('2400+1440');
  });

  it('the wiring measures IN THE ASSIGNMENT that changes the row\'s composition — before any reaction of that mutation', async () => {
    const r = row({hand: [480, 3360]});
    const state = reactive({section: 'hand', frames: ['hand']});
    const off = installRowLeaveRects(() => r.el, () => `${state.section}|${state.frames.join(',')}`);
    expect(span(leavingRectOf(r.member('hand')))).to.eq('480+3360');

    state.frames.pop(); // the hand's frame ends…
    // …and whatever the flush does next (the board's `v-show` first, as a Vapor render effect does):
    r.lay('hand', 2400, 1440);
    state.section = 'board';
    expect(span(leavingRectOf(r.member('hand'))), 'held at the assignment').to.eq('480+3360');
    await nextTick();
    expect(span(leavingRectOf(r.member('hand')))).to.eq('2400+1440');

    off();
    r.lay('hand', 480, 3360);
    state.section = 'hand';
    r.lay('hand', 1, 2);
    expect(span(leavingRectOf(r.member('hand'))), 'disposed: nothing is held any more').to.eq('1+2');
  });

  it('an absent row holds nothing (the shell is not mounted yet)', () => {
    holdRowRects(null);
    holdRowRects(undefined);
    const r = row({hand: [480, 3360]});
    expect(span(leavingRectOf(r.member('hand')))).to.eq('480+3360');
  });
});
