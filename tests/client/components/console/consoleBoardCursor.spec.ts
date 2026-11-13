/*
 * ConsoleBoardCursor — the placement reticle, the console's physical board cursor. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — its box on the cell in board px, the pose
 * of each phase and legality, the projected tile with its owner cube and its quiet-zone mask — and the one thing it
 * keeps of its own: the airborne pose of a step, raised by a move of the cell and lowered by an owned wait of the
 * flow kernel (the spec drives the kernel's clock). It emits nothing and exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {PlacementFlowPhase} from '@/client/console/tilePlacement/placementFlow';
import ConsoleBoardCursor from '@/client/components/console/ConsoleBoardCursor.vue';

type Props = {
  x: number,
  y: number,
  legal: boolean,
  phase: PlacementFlowPhase,
  tileArtClass?: string,
  cubeColor?: string,
  bonusZone?: {cx: number, cy: number, w: number, h: number},
  pickup?: boolean,
  afloat?: boolean,
  marker?: boolean,
};

function reticleOf(props: Partial<Props> = {}) {
  const all: Props = {x: 100, y: 200, legal: true, phase: 'navigate', ...props};
  return mount(ConsoleBoardCursor, {...globalConfig, props: all});
}

/** The pose modifiers the root wears, without the block's own class. */
function posesOf(wrapper: ReturnType<typeof reticleOf>): Array<string> {
  return wrapper.classes().filter((c) => c !== 'con-bcur').map((c) => c.replace('con-bcur--', '')).sort();
}

/** The glide's base duration and the settle slack past it, as the component keeps them. */
const TRAVEL_MS = 120;
const SETTLE_SLACK_MS = 45;

describe('ConsoleBoardCursor — the placement reticle', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('stands on its cell in board px, a ring with no projection while the host passes no art', () => {
    const w = reticleOf();
    const root = w.element as HTMLElement;
    expect(root.tagName).to.eq('DIV');
    expect(w.classes()).to.include('con-bcur');
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(root.style.width).to.eq('46px');
    expect(root.style.height).to.eq('51px');
    expect(root.style.transform).to.eq('translate(100px, 200px)');
    expect(root.style.getPropertyValue('--bcur-mask-x'), 'no bonus cluster, no mask').to.eq('');

    expect(Array.from(root.children).map((child) => child.className)).to.deep.eq(['con-bcur__shadow', 'con-bcur__ring', 'con-bcur__lockring']);
    expect(w.find('.con-bcur__ghost').exists()).to.eq(false);
  });

  it('wears the pose of the phase and of the cell\'s legality', () => {
    expect(posesOf(reticleOf())).to.deep.eq(['legal']);
    expect(posesOf(reticleOf({legal: false})), 'nothing can land').to.deep.eq(['blocked']);
    expect(posesOf(reticleOf({phase: 'locked'}))).to.deep.eq(['locked']);
    expect(posesOf(reticleOf({phase: 'committing'}))).to.deep.eq(['committing']);
    expect(posesOf(reticleOf({phase: 'locked', legal: false})), 'a blocked cell is never locked').to.deep.eq(['blocked']);

    expect(posesOf(reticleOf({pickup: true}))).to.deep.eq(['legal', 'pickup']);
    expect(posesOf(reticleOf({pickup: true, phase: 'locked'})), 'the pickup is an aiming pose').to.deep.eq(['locked']);
    expect(posesOf(reticleOf({pickup: true, legal: false}))).to.deep.eq(['blocked']);

    expect(posesOf(reticleOf({afloat: true})), 'afloat needs a projection').to.deep.eq(['legal']);
    expect(posesOf(reticleOf({afloat: true, tileArtClass: 'board-space-tile--city', phase: 'committing'}))).to.deep.eq(['afloat', 'committing']);
    expect(posesOf(reticleOf({marker: true, phase: 'committing'}))).to.deep.eq(['committing', 'marker']);
  });

  it('projects the tile: its art, the owner\'s cube, the mask under the cell\'s bonus cluster', () => {
    const plain = reticleOf({tileArtClass: 'board-space-tile--ocean'});
    const ghost = plain.find('.con-bcur__ghost');
    expect(ghost.classes()).to.deep.eq(['con-bcur__ghost']);
    expect(ghost.find('.con-bcur__art').classes()).to.deep.eq(['con-bcur__art', 'board-space-tile--ocean']);
    expect(ghost.find('.con-bcur__cube').exists(), 'an ocean seats no cube').to.eq(false);
    expect(Array.from((plain.element as Element).children).map((child) => child.className), 'the ghost lies between the shadow and the rings')
      .to.deep.eq(['con-bcur__shadow', 'con-bcur__ghost', 'con-bcur__ring', 'con-bcur__lockring']);

    const owned = reticleOf({tileArtClass: 'board-space-tile--city', cubeColor: 'blue', bonusZone: {cx: 23, cy: 12.5, w: 20, h: 10}});
    expect(owned.find('.con-bcur__ghost').classes()).to.deep.eq(['con-bcur__ghost', 'con-bcur__ghost--masked']);
    expect(owned.find('.con-bcur__cube').classes()).to.deep.eq(['con-bcur__cube', 'player_bg_color_blue']);
    const style = (owned.element as HTMLElement).style;
    expect(style.getPropertyValue('--bcur-mask-x')).to.eq('23.0px');
    expect(style.getPropertyValue('--bcur-mask-y')).to.eq('12.5px');
    expect(style.getPropertyValue('--bcur-mask-rx'), 'half the cluster and its shoulder').to.eq('15.0px');
    expect(style.getPropertyValue('--bcur-mask-ry')).to.eq('9.0px');
    expect(style.transform, 'the mask never moves the box').to.eq('translate(100px, 200px)');
  });

  it('a step lifts the reticle into its travel pose; a run of steps lands ONCE, after the last glide and its slack', async () => {
    const w = reticleOf();
    const settle = consoleMotionMs(TRAVEL_MS) + SETTLE_SLACK_MS;
    expect(posesOf(w), 'mounted at rest').to.deep.eq(['legal']);

    await w.setProps({x: 146});
    expect((w.element as HTMLElement).style.transform).to.eq('translate(146px, 200px)');
    expect(posesOf(w)).to.deep.eq(['legal', 'travel']);

    // The next hop arrives before the first one settled: the pose stays up, and the wait starts again from this hop.
    clock.advance(settle - 1);
    await w.setProps({x: 169, y: 251});
    expect(posesOf(w), 'one diagonal hop, still airborne').to.deep.eq(['legal', 'travel']);
    clock.advance(settle - 1);
    await w.vm.$nextTick();
    expect(posesOf(w), 'the first hop\'s wait was cancelled').to.deep.eq(['legal', 'travel']);

    clock.advance(1);
    await w.vm.$nextTick();
    expect(posesOf(w), 'landed').to.deep.eq(['legal']);

    // A lock mid-glide freezes the reticle on its cell: the pose is a NAVIGATE-only one.
    await w.setProps({x: 192});
    expect(posesOf(w)).to.deep.eq(['legal', 'travel']);
    await w.setProps({phase: 'locked'});
    expect(posesOf(w)).to.deep.eq(['locked']);

    // A change that moves no cell arms nothing.
    clock.advance(settle);
    await w.setProps({phase: 'navigate', tileArtClass: 'board-space-tile--city'});
    expect(posesOf(w)).to.deep.eq(['legal']);
  });
});
