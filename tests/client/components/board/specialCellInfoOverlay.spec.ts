/*
 * SpecialCellInfoOverlay — the lore panel of a named cell, drawn beside its marker with a leader between the two. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its
 * whole input is MODULE state (`specialCellHoverState`: which cell is active, and its marker's element), so the spec
 * is what it renders for that state, where it stands relative to the marker, and that it re-measures when the page
 * scrolls or resizes — one coalesced frame of its own flow scope (the spec drives the kernel's clock).
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import SpecialCellInfoOverlay from '@/client/components/board/SpecialCellInfoOverlay.vue';
import {clearActiveSpecialCell, setActiveSpecialCell, specialCellHoverState} from '@/client/components/board/specialCellHoverState';
import {getSpecialCellInfoById, SpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {translateText} from '@/client/directives/i18n';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

// The overlay's own numbers (its positioning math): the panel's width and its gap to the marker.
const PANEL_WIDTH = 320;
const PANEL_OFFSET = 32;
// The viewport the spec stands in — wide enough that nothing below is clamped to its margin.
const VIEWPORT = {innerWidth: 1280, innerHeight: 800};
const MARKER = 20;

// The teleport is stubbed so the overlay is read where it is rendered (its target is the document's body).
function overlay() {
  return mount(SpecialCellInfoOverlay, {global: {config: globalConfig.global.config, stubs: {teleport: true}}});
}

function cell(id: string): SpecialCellInfo {
  const info = getSpecialCellInfoById(id);
  if (info === undefined) {
    throw new Error(`no special cell «${id}»`);
  }
  return info;
}

/** A marker badge whose viewport rect the spec decides (jsdom lays nothing out) — and may move. */
function marker(pose: {left: number, top: number}): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = (): DOMRect => {
    const {left, top} = pose;
    return {x: left, y: top, left, top, width: MARKER, height: MARKER, right: left + MARKER, bottom: top + MARKER, toJSON: () => ({})};
  };
  return el;
}

function activate(info: SpecialCellInfo, pose: {left: number, top: number}): void {
  setActiveSpecialCell(info.id, info.spaceId, marker(pose));
}

describe('SpecialCellInfoOverlay — a named cell\'s lore panel beside its marker', () => {
  const NOCTIS = cell('noctis_city'); // prefers the side BELOW its marker
  const THOLUS = cell('tharsis_tholus'); // prefers the side to the RIGHT of it
  let clock: ManualFlowClock;
  let viewport: Array<{key: 'innerWidth' | 'innerHeight', descriptor: PropertyDescriptor | undefined}>;

  beforeEach(() => {
    viewport = (['innerWidth', 'innerHeight'] as const).map((key) => {
      return {key, descriptor: Object.getOwnPropertyDescriptor(window, key)};
    });
    Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: VIEWPORT.innerWidth});
    Object.defineProperty(window, 'innerHeight', {configurable: true, writable: true, value: VIEWPORT.innerHeight});
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  // Module state is bundle-shared: the hover store, the viewport and the kernel's clock are put back for every
  // later spec (the store's own watcher takes its class off the body on the next tick).
  afterEach(async () => {
    setFlowClock(undefined);
    specialCellHoverState.activeId = undefined;
    specialCellHoverState.activeSpaceId = undefined;
    specialCellHoverState.markerEl = undefined;
    for (const {key, descriptor} of viewport) {
      if (descriptor !== undefined) {
        Object.defineProperty(window, key, descriptor);
      }
    }
    await nextTick();
  });

  it('renders nothing until a special cell is active; active, it is the cell\'s title and description on a panel bound for the body', async () => {
    expect(NOCTIS.placement).to.eq('bottom');
    const w = overlay();
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.special-cell-info-overlay').exists(), 'nothing hovered').to.eq(false);

    activate(NOCTIS, {left: 400, top: 300});
    await flushPromises();
    const root = w.find('.special-cell-info-overlay');
    expect(root.classes()).to.include('special-cell-info-overlay--bottom');
    expect(root.find('.special-cell-info-overlay__title').text()).to.eq(translateText(NOCTIS.title));
    expect(root.find('.special-cell-info-overlay__body').text()).to.eq(translateText(NOCTIS.description));
    expect(root.findAll('.special-cell-info-overlay__panel > .special-cell-info-overlay__corner')).to.have.length(4);
    // Below the marker: centred under it, one gap under its bottom edge, at the panel's fixed width.
    const panel = (root.find('.special-cell-info-overlay__panel').element as HTMLElement).style;
    expect(panel.width).to.eq(`${PANEL_WIDTH}px`);
    expect(panel.left).to.eq(`${400 + MARKER / 2 - PANEL_WIDTH / 2}px`);
    expect(panel.top).to.eq(`${300 + MARKER + PANEL_OFFSET}px`);

    clearActiveSpecialCell(NOCTIS.id);
    await flushPromises();
    expect(w.find('.special-cell-info-overlay').exists(), 'the hover left').to.eq(false);
  });

  it('the leader runs from the marker\'s centre to the panel\'s near edge; the panel takes the cell\'s side, or the opposite one when that has no room', async () => {
    expect(THOLUS.placement).to.eq('right');
    const w = overlay();
    const points = (part: string) => w.find(`.special-cell-info-overlay__connector-${part}`).attributes('points');
    const panelLeft = () => (w.find('.special-cell-info-overlay__panel').element as HTMLElement).style.left;

    activate(NOCTIS, {left: 400, top: 300});
    await flushPromises();
    // One svg over the whole viewport, drawn in its coordinates.
    const svg = w.find('svg.special-cell-info-overlay__connector');
    expect(svg.attributes('width')).to.eq(String(VIEWPORT.innerWidth));
    expect(svg.attributes('height')).to.eq(String(VIEWPORT.innerHeight));
    // Marker centre (410, 310) → the elbow half-way down → the centre of the panel's top edge (410, 352).
    expect(points('line')).to.eq('410,310 410,331 410,352');
    const dot = w.find('.special-cell-info-overlay__connector-dot');
    expect([dot.attributes('cx'), dot.attributes('cy')]).to.deep.eq(['410', '310']);
    expect(points('end'), 'the port opens down, into the panel').to.eq('405,357 410,352 415,357');

    // A cell that prefers the right: the panel one gap right of the marker, the port turned to face it.
    activate(THOLUS, {left: 400, top: 300});
    await flushPromises();
    expect(w.find('.special-cell-info-overlay').classes()).to.include('special-cell-info-overlay--right');
    expect(panelLeft()).to.eq(`${400 + MARKER + PANEL_OFFSET}px`);
    expect(points('end')).to.eq('447,305 452,310 447,315');

    // The same cell at the viewport's right edge: no room on the right — the panel stands on the left.
    clearActiveSpecialCell(THOLUS.id);
    await flushPromises();
    const left = VIEWPORT.innerWidth - 60;
    activate(THOLUS, {left, top: 300});
    await flushPromises();
    expect(w.find('.special-cell-info-overlay').classes()).to.include('special-cell-info-overlay--left');
    expect(panelLeft()).to.eq(`${left - PANEL_OFFSET - PANEL_WIDTH}px`);
  });

  it('re-measures the marker when the page scrolls or resizes — one coalesced frame of its own scope, none once it is gone', async () => {
    const w = overlay();
    const panelLeft = () => (w.find('.special-cell-info-overlay__panel').element as HTMLElement).style.left;
    const pose = {left: 400, top: 300};
    setActiveSpecialCell(NOCTIS.id, NOCTIS.spaceId, marker(pose));
    await flushPromises();
    expect(panelLeft()).to.eq('250px');
    expect(clock.pending(), 'nothing owed at rest').to.eq(0);

    // The board scrolled under the pointer: the marker moved, and a burst of scroll events owes ONE frame.
    pose.left = 500;
    window.dispatchEvent(new window.Event('scroll'));
    window.dispatchEvent(new window.Event('scroll'));
    expect(clock.pending()).to.eq(1);
    await flushPromises();
    expect(panelLeft(), 'not before the frame').to.eq('250px');
    clock.advance(16);
    await flushPromises();
    expect(panelLeft(), 'the panel followed its marker').to.eq('350px');
    expect(clock.pending()).to.eq(0);

    // A resize: the viewport's size follows at once (the leader's svg), the re-measure a frame later.
    Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1000});
    pose.left = 300;
    window.dispatchEvent(new window.Event('resize'));
    await flushPromises();
    expect(w.find('svg.special-cell-info-overlay__connector').attributes('width')).to.eq('1000');
    expect(panelLeft()).to.eq('350px');
    clock.advance(16);
    await flushPromises();
    expect(panelLeft()).to.eq('150px');

    // Unmounted, it listens to nothing.
    w.unmount();
    window.dispatchEvent(new window.Event('scroll'));
    window.dispatchEvent(new window.Event('resize'));
    expect(clock.pending()).to.eq(0);
  });
});
