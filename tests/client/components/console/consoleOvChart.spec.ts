/*
 * ConsoleOvChart — the one chart engine of the endgame overview. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it draws for its props inside the box its ROOT measures at mount (the template
 * ref the script reads), the d-pad cursor it is handed, and the one-shot line draw — latched at mount, started two
 * frames later, absent under reduced motion. No parent stands a ref on it: it exposes nothing.
 *
 * jsdom lays nothing out (every `clientWidth` is 0) and has no frames: a test LENDS the root a box, and the one test
 * of the line draw lends the page a frame source and drives the flow kernel's clock.
 */
import {expect} from 'chai';
import {nextTick} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {OvChartSeries} from '@/client/console/endgame/consoleOverviewModel';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';
import ConsoleOvChart from '@/client/components/console/ConsoleOvChart.vue';

/** The focused series (full ink) and a context one (same axis, quiet) over three generations. */
const SERIES: ReadonlyArray<OvChartSeries> = [
  {key: 'red', hex: '#ff0000', data: [0, 6, 12], emphasis: true},
  {key: 'blue', hex: '#0000ff', data: [12, 6, 0], dim: true},
];

/*
 * The geometry of a 400 × 200 box whose cascade says 1rem = 20px (the chart reads its root's computed font size —
 * every pad and radius rides it; the root is handed that size through a fall-through `style`):
 *   x: padL 48 … width − padR 382 (three columns: 48 · 215 · 382);   y: padT 10 … height − padB 173;
 *   maxY 10 rounds up to a tidy 12, so the ticks are 0 · 6 · 12 at y 173 · 91.5 · 10.
 */
const BOX = {width: 400, height: 200};
const REM = 'font-size: 20px';

let returnBox: () => void = () => {};

/** Lend every element a layout box until the test ends. */
function lendBox(width: number, height: number): void {
  const sizes: Record<string, number> = {clientWidth: width, clientHeight: height};
  for (const [key, value] of Object.entries(sizes)) {
    Object.defineProperty(HTMLElement.prototype, key, {configurable: true, get: () => value});
  }
  returnBox = () => {
    for (const key of Object.keys(sizes)) {
      Reflect.deleteProperty(HTMLElement.prototype, key);
    }
    returnBox = () => {};
  };
}

function chart(props: Record<string, unknown> = {}) {
  return mount(ConsoleOvChart, {
    global: globalConfig.global,
    props: {series: SERIES, points: 3, maxY: 10, ...props},
    attrs: {style: REM},
  });
}

const numbers = (values: ReadonlyArray<string | undefined>): Array<number> => values.map((value) => Number(value));
const styleOf = (element: Element): CSSStyleDeclaration => (element as SVGElement).style;

describe('ConsoleOvChart — the endgame overview\'s line chart', () => {
  let reducedWas = false;

  beforeEach(() => {
    reducedWas = reduceMotionOverrideState.enabled;
    reduceMotionOverrideState.enabled = false;
  });
  afterEach(() => {
    returnBox();
    reduceMotionOverrideState.enabled = reducedWas;
  });

  it('draws nothing until its root has a box — and then a chart exactly that size', async () => {
    const unmeasured = chart();
    await nextTick();
    // The template starts with its root: the wrapper IS the chart.
    expect(unmeasured.classes()).to.include('con-ovchart');
    expect(unmeasured.find('svg').exists(), 'no box (jsdom\'s 0 × 0) — no chart').to.eq(false);

    lendBox(BOX.width, BOX.height);
    const w = chart();
    expect(w.find('svg').exists(), 'the box is read at mount — the chart is on the next render').to.eq(false);
    await nextTick();
    const svg = w.find('svg.con-ovchart__svg');
    expect([svg.attributes('width'), svg.attributes('height'), svg.attributes('viewBox')]).to.deep.eq(['400', '200', '0 0 400 200']);
    expect(w.classes(), 'no line draw asked for — the chart lands settled').to.include('con-ovchart--drawn');
  });

  it('three clean y-ticks with the unit, a tick per generation, the context series UNDER the emphasised one', async () => {
    lendBox(BOX.width, BOX.height);
    const w = chart({unit: '%', fill: true});
    await nextTick();

    expect(w.findAll('.con-ovchart__ytick').map((t) => t.text())).to.deep.eq(['0%', '6%', '12%']);
    const grid = w.findAll('.con-ovchart__grid');
    expect(numbers(grid.map((g) => g.attributes('y1')))).to.deep.eq([173, 91.5, 10]);
    expect(numbers(grid.map((g) => g.attributes('x1'))), 'the grid starts at the left pad').to.deep.eq([48, 48, 48]);
    expect(numbers(grid.map((g) => g.attributes('x2'))), '…and ends at the right one').to.deep.eq([382, 382, 382]);
    expect(grid.map((g) => g.classes().includes('con-ovchart__grid--axis')), 'the zero line is the axis').to.deep.eq([true, false, false]);
    const xTicks = w.findAll('.con-ovchart__xtick');
    expect(xTicks.map((t) => t.text()), 'generations are counted from 1').to.deep.eq(['1', '2', '3']);
    expect(numbers(xTicks.map((t) => t.attributes('x')))).to.deep.eq([48, 215, 382]);

    // Paint order: the dim context first, the emphasised series on top.
    const series = w.findAll('.con-ovchart__series');
    expect(series.map((s) => [s.classes().includes('con-ovchart__series--dim'), s.classes().includes('con-ovchart__series--emph')]))
      .to.deep.eq([[true, false], [false, true]]);
    expect(series.map((s) => s.find('.con-ovchart__line').attributes('d')))
      .to.deep.eq(['M48.0 10.0 L215.0 91.5 L382.0 173.0', 'M48.0 173.0 L215.0 91.5 L382.0 10.0']);
    expect(styleOf(series[0].find('.con-ovchart__line').element).stroke).to.not.eq(styleOf(series[1].find('.con-ovchart__line').element).stroke);
    expect(styleOf(series[1].find('.con-ovchart__line').element).strokeDasharray ?? '', 'no line draw — no dash').to.eq('');
    // The area wash (`fill`) and the endpoint marker belong to the emphasised series alone.
    expect(series.map((s) => s.find('.con-ovchart__area').exists())).to.deep.eq([false, true]);
    expect(series[1].find('.con-ovchart__area').attributes('d')).to.eq('M48.0 173.0 L48.0 173.0 L215.0 91.5 L382.0 10.0 L382.0 173.0 Z');
    expect(series.map((s) => s.find('.con-ovchart__end').exists())).to.deep.eq([false, true]);
    const end = series[1].find('.con-ovchart__end');
    expect(numbers([end.attributes('cx'), end.attributes('cy'), end.attributes('r')])).to.deep.eq([382, 10, 4]);

    // Without `fill` there is no area at all; the chart follows its props.
    await w.setProps({fill: false, maxY: 100, unit: ''});
    expect(w.find('.con-ovchart__area').exists()).to.eq(false);
    expect(w.findAll('.con-ovchart__ytick').map((t) => t.text()), 'the headroom is a tidy step of the new maximum').to.deep.eq(['0', '50', '100']);
  });

  it('the cursor is a PROP: a guide on its generation, a ringed marker per series in full ink, its tick lit — none without it', async () => {
    lendBox(BOX.width, BOX.height);
    const w = chart();
    await nextTick();
    expect(w.find('.con-ovchart__guide').exists(), 'no cursor handed — no guide').to.eq(false);
    expect(w.findAll('.con-ovchart__xtick--hot')).to.have.length(0);

    await w.setProps({cursor: 1});
    const guide = w.find('.con-ovchart__guide');
    expect(numbers([guide.attributes('x1'), guide.attributes('x2'), guide.attributes('y1'), guide.attributes('y2')]))
      .to.deep.eq([215, 215, 10, 173]);
    const dots = w.findAll('.con-ovchart__dot');
    expect(dots, 'the dim context series carries no marker').to.have.length(1);
    expect(numbers([dots[0].attributes('cx'), dots[0].attributes('cy')])).to.deep.eq([215, 91.5]);
    expect(Number(dots[0].attributes('r')), 'the marker\'s radius plus its ring').to.be.closeTo(5.2, 1e-9);
    expect(w.findAll('.con-ovchart__xtick').map((t) => t.classes().includes('con-ovchart__xtick--hot'))).to.deep.eq([false, true, false]);

    // A cursor outside the generations is no cursor.
    await w.setProps({cursor: 3});
    expect(w.find('.con-ovchart__guide').exists()).to.eq(false);
    await w.setProps({cursor: -1});
    expect(w.find('.con-ovchart__guide').exists()).to.eq(false);
  });

  it('`reveal` is LATCHED at mount: the line waits undrawn, is released two frames later — and the prop\'s later flip changes nothing', async () => {
    lendBox(BOX.width, BOX.height);
    const clock = createManualClock(0);
    setFlowClock(clock);
    // The chart asks for frames only on a page that HAS them (feature detection) — lend the name; the frames
    // themselves are the kernel clock's.
    const page = globalThis as {requestAnimationFrame?: unknown};
    page.requestAnimationFrame = (): number => 0;
    try {
      const w = chart({reveal: true});
      await nextTick();
      const line = () => styleOf(w.find('.con-ovchart__series--emph .con-ovchart__line').element);
      // The emphasised line's length: two segments of hypot(167, 81.5) ≈ 185.83, rounded up, plus 4.
      expect(w.classes()).to.not.include('con-ovchart--drawn');
      expect([line().strokeDasharray, line().strokeDashoffset], 'the whole line is one dash, held back by its length').to.deep.eq(['376 376', '376']);

      clock.advance(16);
      await nextTick();
      expect(w.classes(), 'one frame is not enough').to.not.include('con-ovchart--drawn');
      clock.advance(16);
      await nextTick();
      expect(w.classes()).to.include('con-ovchart--drawn');
      expect([line().strokeDasharray, line().strokeDashoffset], 'the dash is released').to.deep.eq(['376 376', '0']);

      // The host's once-per-load memory flips the prop right after the mount: the running draw is not snapped.
      await w.setProps({reveal: false});
      expect(line().strokeDasharray).to.eq('376 376');
      expect(clock.pending(), 'nothing of the chart still waits').to.eq(0);
    } finally {
      delete page.requestAnimationFrame;
      setFlowClock(undefined);
    }
  });

  it('reduced motion lands settled: a `reveal` draws no dash and waits for no frame', async () => {
    lendBox(BOX.width, BOX.height);
    reduceMotionOverrideState.enabled = true;
    const w = chart({reveal: true});
    await nextTick();
    expect(w.classes()).to.include('con-ovchart--drawn');
    expect(styleOf(w.find('.con-ovchart__series--emph .con-ovchart__line').element).strokeDasharray ?? '').to.eq('');
  });
});
