/*
 * HazardCleanupOverlay — the App-level layer of «a tile built over a hazard»: one cleanup FX per cleared cell, pinned
 * over the board hex and fed the sequence's frame-accurate intensities. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, nothing out, nothing exposed — it reads the module's `hazardCleanupState`
 * and measures the board's cells, so the spec is what it renders for that state over those cells, and when it
 * measures them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import HazardCleanupOverlay from '@/client/components/feedback/HazardCleanupOverlay.vue';
import {hazardCleanupState, resetHazardCleanup} from '@/client/components/feedback/hazardCleanupTransition';
import {HazardCleanupEvent, hazardFxAt} from '@/client/components/feedback/hazardCleanupModel';
import {TileType} from '@/common/TileType';

type Box = {left: number, top: number, width: number, height: number};

function rect(box: Box): DOMRect {
  return {x: box.left, y: box.top, ...box, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({})};
}

/** The board cells a test stood in the document — taken away after it. */
const cells: Array<HTMLElement> = [];

/** A board cell standing in the document (jsdom lays nothing out — the rect is the stand-in's own). */
function cell(spaceId: string, box: Box): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data_space_id', spaceId);
  el.getBoundingClientRect = () => rect(box);
  document.body.appendChild(el);
  cells.push(el);
  return el;
}

/** A mild dust storm on `spaceId`, cleared by a city of `color`. */
function cleanup(spaceId: string, color: string, over: Partial<HazardCleanupEvent> = {}): HazardCleanupEvent {
  return {
    spaceId,
    hazardTileType: TileType.DUST_STORM_MILD,
    kind: 'dust-storm',
    severity: 'mild',
    newTileType: TileType.CITY,
    color,
    cost: 8,
    trReward: 1,
    dedupeKey: `cleanup-${spaceId}`,
    ...over,
  };
}

// The teleport is stubbed so the layer is read where it is rendered (its target is the document's body).
function overlay() {
  return mount(HazardCleanupOverlay, {global: {config: globalConfig.global.config, stubs: {teleport: true}}});
}

/** Past the measure the overlay defers (a frame, or a tick where the page lends no frames) and the render after it. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
  await nextTick();
}

/** The custom properties the stylesheet renders the sequence from. */
function intensities(style: CSSStyleDeclaration): Array<string> {
  return ['--hc-warning', '--hc-dissolve', '--hc-hazard-opacity', '--hc-materialize'].map((name) => style.getPropertyValue(name));
}

describe('HazardCleanupOverlay — the cleanup FX over a cleared hazard cell', () => {
  // Module state is bundle-shared (and `active` is an animation hold) — leave nothing running.
  afterEach(() => {
    resetHazardCleanup();
    cells.splice(0).forEach((el) => el.remove());
  });

  it('is bound for the body and empty while no cleanup runs; a running one stands ONE fx per cleared cell it can measure, padded past the hex', async () => {
    cell('05', {left: 200, top: 120, width: 60, height: 68});
    cell('07', {left: 320, top: 120, width: 60, height: 68});
    const w = overlay();
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.hazard-cleanup-layer').exists(), 'no cleanup').to.eq(false);

    // Three cells cleared at once; `31` is not on this screen (no cell to measure) and gets no fx.
    hazardCleanupState.events = [
      cleanup('05', 'red'),
      cleanup('31', 'red'),
      cleanup('07', '', {kind: 'erosion', severity: 'severe', hazardTileType: TileType.EROSION_SEVERE}),
    ];
    hazardCleanupState.active = true;
    await settle();

    expect(w.find('.hazard-cleanup-layer').attributes('aria-hidden')).to.eq('true');
    const fx = w.findAll('.hazard-cleanup-fx');
    expect(fx.map((one) => one.classes())).to.deep.eq([
      ['hazard-cleanup-fx', 'hazard-cleanup-fx--kind-dust-storm', 'hazard-cleanup-fx--mild'],
      ['hazard-cleanup-fx', 'hazard-cleanup-fx--kind-erosion', 'hazard-cleanup-fx--severe'],
    ]);
    const [first, second] = fx.map((one) => (one.element as HTMLElement).style);
    expect([first.left, first.top, first.width, first.height], '6 px of bloom on every side').to.deep.eq(['194px', '114px', '72px', '80px']);
    expect([second.left, second.top, second.width, second.height]).to.deep.eq(['314px', '114px', '72px', '80px']);
    expect(first.getPropertyValue('--hc-player'), 'the placer\'s colour').to.eq('rgb(204, 56, 34)');
    expect(second.getPropertyValue('--hc-player'), 'a placer nobody knows — the neutral tone').to.eq('rgba(120, 200, 255, 0.9)');
    expect(Array.from((fx[0].element as Element).children).map((part) => part.className)).to.deep.eq([
      'hazard-cleanup-fx__backshade',
      'hazard-cleanup-fx__warning',
      'hazard-cleanup-fx__dissolve',
      'hazard-cleanup-fx__wave',
      'hazard-cleanup-fx__materialize',
    ]);

    hazardCleanupState.active = false;
    await settle();
    expect(w.find('.hazard-cleanup-layer').exists(), 'the cleanup ended').to.eq(false);
  });

  it('feeds every fx the sequence\'s intensities as its progress moves; reduced motion is a class', async () => {
    cell('05', {left: 200, top: 120, width: 60, height: 68});
    const w = overlay();
    hazardCleanupState.events = [cleanup('05', 'blue')];
    hazardCleanupState.active = true;
    await settle();

    const expected = (progress: number): Array<string> => {
      const at = hazardFxAt(progress);
      return [at.warning, at.dissolve, at.hazardOpacity, at.materialize].map((value) => value.toFixed(3));
    };
    const style = () => (w.find('.hazard-cleanup-fx').element as HTMLElement).style;
    expect(intensities(style()), 'the first frame').to.deep.eq(expected(0));
    expect(intensities(style()), 'nothing dissolved, nothing materialised yet').to.deep.eq(['0.000', '0.000', '1.000', '0.000']);

    for (const progress of [0.3, 0.6, 1]) {
      hazardCleanupState.progress = progress;
      await nextTick();
      expect(intensities(style()), `progress ${progress}`).to.deep.eq(expected(progress));
    }
    expect(intensities(style()), 'the last frame: the hazard gone, the tile whole').to.deep.eq(['0.000', '1.000', '0.000', '1.000']);

    expect(w.find('.hazard-cleanup-fx').classes()).to.not.include('hazard-cleanup-fx--reduced');
    hazardCleanupState.reducedMotion = true;
    await nextTick();
    expect(w.find('.hazard-cleanup-fx').classes()).to.include('hazard-cleanup-fx--reduced');
  });

  it('measures on entering a running cleanup, on a scroll, a resize and a new run — and lets the window go when the cleanup ends', async () => {
    let reads = 0;
    let at: Box = {left: 200, top: 120, width: 60, height: 68};
    cell('05', at).getBoundingClientRect = () => {
      reads++;
      return rect(at);
    };
    hazardCleanupState.events = [cleanup('05', 'green')];
    hazardCleanupState.active = true;
    const w = overlay();
    await settle();
    expect(reads, 'mounted INTO a running cleanup').to.eq(1);
    const place = () => (w.find('.hazard-cleanup-fx').element as HTMLElement).style;
    expect([place().left, place().top]).to.deep.eq(['194px', '114px']);

    // The board scrolled under the layer: the fx follows its cell.
    at = {left: 200, top: 40, width: 60, height: 68};
    window.dispatchEvent(new window.Event('scroll'));
    await settle();
    expect(reads).to.eq(2);
    expect([place().left, place().top]).to.deep.eq(['194px', '34px']);

    at = {left: 120, top: 40, width: 60, height: 68};
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    expect(reads).to.eq(3);
    expect([place().left, place().top]).to.deep.eq(['114px', '34px']);

    hazardCleanupState.nonce++;
    await settle();
    expect(reads, 'a fresh run re-measures').to.eq(4);

    hazardCleanupState.active = false;
    await settle();
    window.dispatchEvent(new window.Event('resize'));
    window.dispatchEvent(new window.Event('scroll'));
    await settle();
    expect(reads, 'nothing listens once the cleanup is over').to.eq(4);

    // …and an overlay that leaves mid-cleanup takes its listeners with it.
    hazardCleanupState.active = true;
    await settle();
    expect(reads).to.eq(5);
    w.unmount();
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    expect(reads, 'unmounted').to.eq(5);
  });
});
