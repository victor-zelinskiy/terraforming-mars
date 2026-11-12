/*
 * PlacementReasonPopover — the floating host of the SHARED reason popover beside an illegal board cell. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). It owns two things: WHEN the popover stands
 * (there are reasons AND a cell to stand by) and WHERE (above the cell, flipped below near the viewport's top, never
 * past a side edge). The reasons themselves are the inner component's subject.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import PlacementReasonPopover from '@/client/components/board/PlacementReasonPopover.vue';

// The shared reason renderer has its own surface; this spec reads what the host HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ReasonStub = defineComponent({
  name: 'HandCardReasonPopover',
  props: ['reasons', 'heading'],
  render: () => h('i', {class: 'reason-stub'}),
});

const REASONS: ReadonlyArray<UnplayableReason> = [{type: 'placement', message: 'Occupied'}];

/** A cell's screen rect, as `getBoundingClientRect()` hands it over. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
    toJSON: () => ({}),
  };
}

// The teleport is stubbed so the host is read where it is rendered (its target is the document's body).
function popover(props: Record<string, unknown>) {
  return mount(PlacementReasonPopover, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {teleport: true, HandCardReasonPopover: ReasonStub}},
  });
}

function hostStyle(w: ReturnType<typeof popover>): CSSStyleDeclaration {
  return (w.find('.placement-reason-host').element as HTMLElement).style;
}

describe('PlacementReasonPopover — the reason popover beside an illegal cell', () => {
  it('stands only with reasons AND a cell to stand by', async () => {
    const w = popover({reasons: REASONS});
    expect(w.find('.placement-reason-host').exists(), 'no anchor — nothing').to.eq(false);

    await w.setProps({anchor: rect(400, 300, 60, 60)});
    expect(w.find('.placement-reason-host').exists()).to.eq(true);

    await w.setProps({reasons: []});
    expect(w.find('.placement-reason-host').exists(), 'no reasons — nothing').to.eq(false);
  });

  it('hands the shared popover the reasons under the placement\'s own heading', () => {
    const w = popover({reasons: REASONS, anchor: rect(400, 300, 60, 60)});
    const inner = w.findComponent(ReasonStub);
    expect(inner.props('reasons')).to.deep.eq(REASONS);
    expect(inner.props('heading')).to.eq('Cannot place here');
  });

  it('stands ABOVE the cell, centred on it — and flips BELOW near the viewport\'s top', async () => {
    const w = popover({reasons: REASONS, anchor: rect(400, 300, 60, 60)});
    expect(hostStyle(w).left).to.eq('430px');
    expect(hostStyle(w).top, '8px over the cell').to.eq('292px');
    expect(hostStyle(w).transform).to.eq('translate(-50%, -100%)');

    await w.setProps({anchor: rect(400, 100, 60, 60)});
    expect(hostStyle(w).left).to.eq('430px');
    expect(hostStyle(w).top, '8px under the cell').to.eq('168px');
    expect(hostStyle(w).transform).to.eq('translate(-50%, 0)');
  });

  it('never spills past a side edge — the centre is clamped by half the popover and a margin', async () => {
    const half = 272 / 2 + 8;
    const w = popover({reasons: REASONS, anchor: rect(0, 300, 20, 20)});
    expect(hostStyle(w).left, 'the left edge').to.eq(`${half}px`);

    await w.setProps({anchor: rect(window.innerWidth - 20, 300, 20, 20)});
    expect(hostStyle(w).left, 'the right edge').to.eq(`${Math.round(window.innerWidth - half)}px`);
  });
});
