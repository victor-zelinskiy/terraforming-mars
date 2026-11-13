/*
 * EnergyConversionOverlay — the App-level layer of the energy → heat conversion: the transfer glyph between the two
 * ICONS and the paired «−N / +N» chips over the two CELLS. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, nothing out, nothing exposed — it reads the module's
 * `energyConversionState` and measures the panel's `data-conversion-*` anchors, so the spec is what it renders for
 * that state over those anchors, and when it measures them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import EnergyConversionOverlay from '@/client/components/feedback/EnergyConversionOverlay.vue';
import {energyConversionState, resetEnergyConversion} from '@/client/components/feedback/energyConversionTransition';

// The chip's own look is `DeltaChip`'s subject; this spec reads what the overlay HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ChipStub = defineComponent({
  name: 'DeltaChip',
  props: ['amount', 'variant'],
  render: () => h('i', {class: 'chip-stub'}),
});

type Box = {left: number, top: number, width: number, height: number};

function rect(box: Box): DOMRect {
  return {x: box.left, y: box.top, ...box, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({})};
}

/** The panel's anchors a test stood in the document — taken away after it. */
const anchors: Array<HTMLElement> = [];

/** A panel anchor standing in the document (jsdom lays nothing out — the rect is the stand-in's own). */
function anchor(attribute: 'data-conversion-icon' | 'data-conversion-cell', kind: 'energy' | 'heat', box: Box): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute(attribute, kind);
  el.getBoundingClientRect = () => rect(box);
  document.body.appendChild(el);
  anchors.push(el);
  return el;
}

function overlay() {
  return mount(EnergyConversionOverlay, {global: {config: globalConfig.global.config, stubs: {DeltaChip: ChipStub}}});
}

/** Past the measure the overlay defers (a frame, or a tick where the page lends no frames) and the render after it. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
  await nextTick();
}

describe('EnergyConversionOverlay — the energy → heat conversion\'s layer', () => {
  // Module state is bundle-shared (and `active` is an animation hold) — leave nothing running.
  afterEach(() => {
    resetEnergyConversion();
    anchors.splice(0).forEach((el) => el.remove());
  });

  it('stands only while the conversion plays its visible motion — not idle, not during the handoff\'s lead-in', async () => {
    const w = overlay();
    expect(w.find('.resource-conversion-layer').exists(), 'no conversion').to.eq(false);

    energyConversionState.active = true;
    energyConversionState.leadIn = true;
    await settle();
    expect(w.find('.resource-conversion-layer').exists(), 'the causing surface is still leaving').to.eq(false);

    energyConversionState.leadIn = false;
    await settle();
    expect(w.find('.resource-conversion-layer').attributes('aria-hidden')).to.eq('true');
    // The panel is not on this screen (no anchors): no glyph, no chips — the layer alone.
    expect(w.find('.energy-to-heat-arrow').exists()).to.eq(false);
    expect(w.findAllComponents(ChipStub)).to.have.length(0);

    energyConversionState.active = false;
    await settle();
    expect(w.find('.resource-conversion-layer').exists(), 'the conversion ended').to.eq(false);
  });

  it('the glyph stands in the gap between the two ICONS, turned from energy to heat; the paired chips hang off the two CELLS', async () => {
    anchor('data-conversion-icon', 'energy', {left: 100, top: 100, width: 20, height: 20});
    anchor('data-conversion-icon', 'heat', {left: 100, top: 140, width: 20, height: 20});
    anchor('data-conversion-cell', 'energy', {left: 60, top: 96, width: 100, height: 28});
    anchor('data-conversion-cell', 'heat', {left: 60, top: 136, width: 100, height: 28});
    const w = overlay();
    energyConversionState.amount = 3;
    energyConversionState.showChips = true;
    energyConversionState.active = true;
    await settle();

    // A 20 px gap straight down: 5 px clear of each icon, the glyph 10 px deep at the gap's middle.
    const arrow = w.find('.energy-to-heat-arrow');
    expect(arrow.classes()).to.deep.eq(['energy-to-heat-arrow', 'energy-to-heat-arrow--vertical']);
    const place = (arrow.element as HTMLElement).style;
    expect([place.left, place.top, place.width, place.height]).to.deep.eq(['110px', '130px', '16px', '10px']);
    expect(place.getPropertyValue('--ec-arrow-scale')).to.eq('0.909');
    expect(arrow.find('.energy-to-heat-arrow__inner-pulse').exists()).to.eq(true);

    expect(w.findAllComponents(ChipStub).map((chip) => chip.props())).to.deep.eq([
      {amount: -3, variant: 'resource-stock'},
      {amount: 3, variant: 'resource-stock'},
    ]);
    const source = (w.find('.energy-to-heat-chip--source').element as HTMLElement).style;
    const target = (w.find('.energy-to-heat-chip--target').element as HTMLElement).style;
    expect([source.left, source.top], 'the energy cell\'s top-right').to.deep.eq(['154px', '92px']);
    expect([target.left, target.top], 'the heat cell\'s top-right').to.deep.eq(['154px', '132px']);

    // Reduced motion keeps the glyph and drops its pulse; the chips are gated on their own flag.
    energyConversionState.reducedMotion = true;
    energyConversionState.showChips = false;
    await nextTick();
    expect(w.find('.energy-to-heat-arrow').classes()).to.include('energy-to-heat-arrow--reduced');
    expect(w.find('.energy-to-heat-arrow__inner-pulse').exists()).to.eq(false);
    expect(w.findAllComponents(ChipStub)).to.have.length(0);
  });

  it('measures on entering a running conversion, on a resize and on a new run — and lets the window go when the conversion ends', async () => {
    let reads = 0;
    let heatAt: Box = {left: 100, top: 121, width: 20, height: 20};
    anchor('data-conversion-icon', 'energy', {left: 100, top: 100, width: 20, height: 20});
    anchor('data-conversion-icon', 'heat', heatAt).getBoundingClientRect = () => {
      reads++;
      return rect(heatAt);
    };
    energyConversionState.active = true;
    const w = overlay();
    await settle();
    expect(reads, 'mounted INTO a running conversion').to.eq(1);
    expect(w.find('.energy-to-heat-arrow').exists(), 'icons all but touching — no honest room for a glyph').to.eq(false);

    // The panel moved: the heat icon now stands to the RIGHT of the energy icon, 40 px away.
    heatAt = {left: 160, top: 100, width: 20, height: 20};
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    expect(reads).to.eq(2);
    const arrow = w.find('.energy-to-heat-arrow');
    expect(arrow.classes()).to.deep.eq(['energy-to-heat-arrow', 'energy-to-heat-arrow--horizontal']);
    const place = (arrow.element as HTMLElement).style;
    expect([place.left, place.top, place.width, place.height]).to.deep.eq(['140px', '110px', '16px', '16px']);

    energyConversionState.nonce++;
    await settle();
    expect(reads, 'a fresh run re-measures').to.eq(3);

    energyConversionState.active = false;
    await settle();
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    expect(reads, 'nothing listens once the conversion is over').to.eq(3);

    // …and an overlay that leaves mid-conversion takes its listeners with it.
    energyConversionState.active = true;
    await settle();
    expect(reads).to.eq(4);
    w.unmount();
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    expect(reads, 'unmounted').to.eq(4);
  });
});
