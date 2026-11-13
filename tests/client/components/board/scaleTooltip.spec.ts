/*
 * ScaleTooltip — the ONE teleported renderer of the scale HUD's tooltip. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is MODULE state
 * (`scaleTooltipState`, written by every hover surface of the scales), so the spec is what it renders for that state,
 * that it FOLLOWS it, and that it places itself against the anchor once its own element can be measured.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import ScaleTooltip from '@/client/components/board/ScaleTooltip.vue';
import {clampScaleTooltipPosition, ScaleTooltipContent, scaleTooltipState} from '@/client/components/board/scaleTooltipState';

// The teleport is stubbed so the tooltip is read where it is rendered (its target is the document's body); the
// transition is test-utils' default stub.
function tooltip() {
  return mount(ScaleTooltip, {global: {config: globalConfig.global.config, stubs: {teleport: true}}});
}

/** The hovered surface's bounding rect, in viewport coordinates. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})};
}

const OXYGEN: ScaleTooltipContent = {
  accent: 'oxygen',
  kicker: 'OXYGEN',
  rows: [
    {text: '8 %', tone: 'value'},
    {text: 'Raise the temperature', tone: 'reward'},
    {text: 'Claimed', tone: 'claim', dot: 'rgb(200, 30, 30)'},
  ],
};

const VENUS: ScaleTooltipContent = {
  accent: 'venus',
  kicker: 'VENUS',
  rows: [{text: '16 %', tone: 'value'}],
};

function show(content: ScaleTooltipContent, anchor: DOMRect): void {
  scaleTooltipState.anchor = anchor;
  scaleTooltipState.content = content;
  scaleTooltipState.visible = true;
}

/** A layout box for every element — jsdom lays nothing out, so `offsetWidth` / `offsetHeight` read 0 there. */
function lendLayout(width: number, height: number): () => void {
  const saved = (['offsetWidth', 'offsetHeight'] as const).map((key) => {
    return {key, descriptor: Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)};
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, get: () => width});
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {configurable: true, get: () => height});
  return () => {
    for (const {key, descriptor} of saved) {
      if (descriptor !== undefined) {
        Object.defineProperty(HTMLElement.prototype, key, descriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, key);
      }
    }
  };
}

describe('ScaleTooltip — the scale HUD\'s one tooltip', () => {
  // Module state is bundle-shared: the store is put back to rest for every later spec.
  afterEach(() => {
    scaleTooltipState.visible = false;
    scaleTooltipState.anchor = null;
    scaleTooltipState.content = null;
  });

  it('renders nothing until the store shows a tooltip; shown, it is a tooltip bound for the body: the kicker and a row per content row', async () => {
    const w = tooltip();
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.scale-tooltip').exists(), 'hidden at rest').to.eq(false);

    show(OXYGEN, rect(400, 300, 40, 20));
    await nextTick();
    const tip = w.find('.scale-tooltip');
    expect(tip.attributes('role')).to.eq('tooltip');
    expect(tip.classes()).to.include('scale-tooltip--oxygen');
    expect(tip.find('.scale-tooltip__kicker').text()).to.eq('OXYGEN');
    const rows = tip.findAll('.scale-tooltip__rows > .scale-tooltip__row');
    expect(rows.map((row) => row.text())).to.deep.eq(['8 %', 'Raise the temperature', 'Claimed']);
    expect(rows.map((row) => row.classes().filter((c) => c.startsWith('scale-tooltip__row--'))))
      .to.deep.eq([['scale-tooltip__row--value'], ['scale-tooltip__row--reward'], ['scale-tooltip__row--claim']]);
    // Only a row that carries a dot draws one, in the colour it was handed.
    expect(tip.findAll('.scale-tooltip__dot')).to.have.length(1);
    expect((rows[2].find('.scale-tooltip__dot').element as HTMLElement).style.background).to.eq('rgb(200, 30, 30)');

    scaleTooltipState.visible = false;
    await nextTick();
    expect(w.find('.scale-tooltip').exists()).to.eq(false);
  });

  it('follows the store — a swap re-tints the frame and re-writes the rows; visible with no content is still nothing', async () => {
    const w = tooltip();
    show(OXYGEN, rect(400, 300, 40, 20));
    await nextTick();
    expect(w.find('.scale-tooltip').classes()).to.include('scale-tooltip--oxygen');

    scaleTooltipState.content = VENUS;
    await nextTick();
    const tip = w.find('.scale-tooltip');
    expect(tip.classes()).to.include('scale-tooltip--venus');
    expect(tip.classes()).to.not.include('scale-tooltip--oxygen');
    expect(tip.find('.scale-tooltip__kicker').text()).to.eq('VENUS');
    expect(tip.findAll('.scale-tooltip__row')).to.have.length(1);

    scaleTooltipState.content = null;
    await nextTick();
    expect(w.find('.scale-tooltip').exists(), 'visible, but nothing to say').to.eq(false);
  });

  it('places itself against the anchor once its element is measurable — and stays put while it is not', async () => {
    const w = tooltip();
    const place = () => {
      const {left, top} = (w.find('.scale-tooltip').element as HTMLElement).style;
      return {left, top};
    };

    // jsdom lays nothing out: the element reads 0 × 0, so the position is left where it was.
    const anchor = rect(400, 300, 40, 20);
    show(OXYGEN, anchor);
    await flushPromises();
    expect(place()).to.deep.eq({left: '0px', top: '0px'});

    // With a box of its own it is clamped against the anchor inside the safe zones (no `.player_home` on the page —
    // the zones are the fallbacks: a 36 px bottom bar, a 62 px right sidebar, no left panel).
    const restore = lendLayout(200, 40);
    try {
      const moved = rect(500, 360, 40, 20);
      scaleTooltipState.anchor = moved;
      await flushPromises();
      const zones = {top: 12, bottom: window.innerHeight - (36 + 16), left: 8, right: window.innerWidth - 62 - 8};
      const expected = clampScaleTooltipPosition(moved, 200, 40, zones);
      expect(place()).to.deep.eq({left: `${expected.left}px`, top: `${expected.top}px`});
      expect(expected, 'a real position, not the resting one').to.not.deep.eq({left: 0, top: 0});
    } finally {
      restore();
    }
  });
});
