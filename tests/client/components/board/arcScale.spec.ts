/*
 * ArcScale — the GENERIC band of a global-parameter scale (oxygen / temperature / Venus, and the oceans' through its
 * wrapper). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props (the
 * themed band, one upright digit per value with its visited / current state, the identity badge, what it hands the
 * moving indicator), how the progress fill follows the value — starting from the scale's PREVIOUS value after a
 * remount (module state: `arcScaleState.arcFillBaseline`) — and the hover tooltips it asks the shared scale tooltip
 * for, which it does not while the console shell owns the screen. The indicator has its own surface and its own spec
 * (`AnimatedScaleMarker.spec.ts`, which mounts it through this band) — stubbed here.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ArcScale from '@/client/components/board/ArcScale.vue';
import {arcFillBaseline} from '@/client/components/board/arcScaleState';
import {ARC_SCALE_THEMES, ArcScaleName} from '@/client/components/board/arcScaleTheme';
import {OXYGEN_ARC, TEMPERATURE_ARC, VENUS_ARC} from '@/client/components/board/arcScaleConfigs';
import {scaleTooltipState} from '@/client/components/board/scaleTooltipState';
import {consoleState} from '@/client/console/consoleRouter';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

// (A render function, not a template string: the runtime compiler is not in this build.)
const MarkerStub = defineComponent({
  name: 'AnimatedScaleMarker',
  props: ['accent', 'value'],
  render: () => h('i', {class: 'marker-stub'}),
});

function scale(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(ArcScale, {
    ...globalConfig,
    props: {theme: ARC_SCALE_THEMES.oxygen, config: OXYGEN_ARC, value: 5, ...props},
    attrs,
    global: {...globalConfig.global, stubs: {AnimatedScaleMarker: MarkerStub}},
  });
}

function forgetBaselines(): void {
  for (const name of Object.keys(arcFillBaseline) as Array<ArcScaleName>) {
    delete arcFillBaseline[name];
  }
}

describe('ArcScale — the band of a global-parameter scale', () => {
  let clock: ManualFlowClock;
  let shellMountedBefore: boolean;

  beforeEach(() => {
    forgetBaselines();
    shellMountedBefore = consoleState.shellMounted;
    consoleState.shellMounted = false;
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  // Module state is BUNDLE-SHARED: the baselines, the shell flag, the tooltip store and the kernel's clock are put
  // back for every later spec.
  afterEach(() => {
    clock.advance(1000);
    scaleTooltipState.visible = false;
    scaleTooltipState.anchor = null;
    scaleTooltipState.content = null;
    setFlowClock(undefined);
    consoleState.shellMounted = shellMountedBefore;
    forgetBaselines();
  });

  it('renders the themed band, a digit per value with its state, the identity badge — and hands the indicator its accent and value', () => {
    const w = scale({}, {'data-from-host': 'yes'});
    const root = w.element as HTMLElement;
    expect(root.tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.deep.eq(['arc-scale', 'arc-scale--oxygen']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.attributes('data-from-host'), 'what the host lets fall through lands on the root').to.eq('yes');
    expect(root.style.getPropertyValue('--arc-band-width')).to.eq(`${OXYGEN_ARC.bandWidth}px`);
    expect(root.style.getPropertyValue('--arc-accent')).to.eq(ARC_SCALE_THEMES.oxygen.vars['--arc-accent']);

    // The canvas reaches 60 px past the dials' 600 × 600 square on every side.
    const svg = w.find('svg.arc-scale__svg');
    expect(svg.attributes('viewBox')).to.eq('-60 -60 720 720');
    expect(svg.attributes('width')).to.eq('720');
    expect(svg.attributes('height')).to.eq('720');
    expect(w.find('linearGradient').attributes('id')).to.eq('arcFill-oxygen');
    expect(w.findAll('stop')).to.have.length(ARC_SCALE_THEMES.oxygen.gradient.length);
    expect(w.findAll('.arc-scale__divider')).to.have.length(OXYGEN_ARC.digits.length - 1);
    expect(w.find('.arc-scale__fill').exists(), 'the value is past the scale\'s start').to.be.true;

    const digits = w.findAll('.arc-scale__digit');
    expect(digits.map((digit) => digit.text())).to.deep.eq(OXYGEN_ARC.digits.map((digit) => String(digit.value)));
    for (const digit of digits) {
      const value = Number(digit.text());
      expect(digit.classes()).to.include.members(['global-numbers-value', `val-${value}`]);
      expect(digit.classes().includes('arc-scale__digit--visited'), `visited ${value}`).to.eq(value < 5);
      expect(digit.classes().includes('arc-scale__digit--current'), `current ${value}`).to.eq(value === 5);
    }

    expect(w.findComponent(MarkerStub).props()).to.deep.eq({accent: 'oxygen', value: 5});
    const identity = w.find('.arc-scale__identity');
    expect(identity.attributes('role')).to.eq('img');
    expect(identity.attributes('aria-label')).to.eq('Oxygen: 5%');
    expect(identity.find('.arc-scale__identity-glyph').classes()).to.contain('oxygen-tile');
  });

  it('the temperature prints its positive values with a «+»; the identity badge stands inside for Venus unless told otherwise', () => {
    const temperature = scale({theme: ARC_SCALE_THEMES.temperature, config: TEMPERATURE_ARC, value: 0});
    expect(temperature.findAll('.arc-scale__digit').map((digit) => digit.text()))
      .to.deep.eq(TEMPERATURE_ARC.digits.map((digit) => (digit.value > 0 ? '+' + digit.value : String(digit.value))));
    expect(temperature.find('.arc-scale__identity').attributes('aria-label')).to.eq('Temperature: 0°C');

    const place = (props: Record<string, unknown>): string => {
      const badge = scale({theme: ARC_SCALE_THEMES.venus, config: VENUS_ARC, value: 0, ...props}).find('.arc-scale__identity').element as HTMLElement;
      expect(badge.style.width).to.eq('22px');
      expect(badge.style.height).to.eq('22px');
      return `${badge.style.left} ${badge.style.top}`;
    };
    const inside = place({});
    const outside = place({identityOutside: true});
    const middle = place({identityMiddle: true});
    expect(new Set([inside, outside, middle]).size, 'three different places').to.eq(3);
  });

  it('follows the value — and after a remount the fill starts from the scale\'s PREVIOUS value, then moves to the current one', async () => {
    const first = scale({value: 0});
    expect(first.find('.arc-scale__fill').exists(), 'nothing is filled at the scale\'s start').to.be.false;
    expect(arcFillBaseline.oxygen).to.eq(0);

    await first.setProps({value: 7});
    expect(first.find('.arc-scale__fill').exists()).to.be.true;
    expect(first.find('.arc-scale__digit--current').text()).to.eq('7');
    expect(first.findAll('.arc-scale__digit--visited')).to.have.length(7);
    expect(first.findComponent(MarkerStub).props('value')).to.eq(7);
    expect(first.find('.arc-scale__identity').attributes('aria-label')).to.eq('Oxygen: 7%');
    expect(arcFillBaseline.oxygen, 'the baseline every later mount of this scale starts from').to.eq(7);

    await first.setProps({value: 0});
    expect(first.find('.arc-scale__fill').exists()).to.be.false;
    first.unmount();

    // The same scale mounts again at another value: the first frame draws the fill where it stood (empty), a tick
    // later it stands at the value — so the band is seen moving instead of appearing moved.
    const second = scale({value: 9});
    expect(second.find('.arc-scale__digit--current').text(), 'the digits read the value at once').to.eq('9');
    expect(second.find('.arc-scale__fill').exists(), 'the first frame is the previous value').to.be.false;
    expect(arcFillBaseline.oxygen).to.eq(9);
    await nextTick();
    await nextTick();
    expect(second.find('.arc-scale__fill').exists()).to.be.true;

    // Another scale has a baseline of its own: nothing to start from, so it is drawn at its value at once.
    const venus = scale({theme: ARC_SCALE_THEMES.venus, config: VENUS_ARC, value: 8});
    expect(venus.find('.arc-scale__fill').exists()).to.be.true;
    expect(arcFillBaseline).to.deep.eq({oxygen: 9, venus: 8});
  });

  it('asks the shared scale tooltip on a hover — the overview on the badge and the band, the value on a digit — hides it on leave and on unmount, and asks for nothing under the console shell', async () => {
    const w = scale();
    const overview = {
      accent: 'oxygen',
      kicker: 'Oxygen scale',
      rows: [{text: 'Oxygen: 5%', tone: 'value'}, {text: 'Shows the atmospheric oxygen level.', tone: 'desc'}],
    };

    await w.find('.arc-scale__identity').trigger('mouseenter');
    expect(scaleTooltipState.visible, 'the show delay').to.be.false;
    clock.advance(200);
    expect(scaleTooltipState.visible).to.be.true;
    expect(scaleTooltipState.content).to.deep.eq(overview);

    // Already visible: the next surface swaps the content at once.
    await w.find('.arc-scale__digit--current').trigger('mouseenter');
    expect(scaleTooltipState.content).to.deep.eq({accent: 'oxygen', kicker: 'Current', rows: [{text: 'Oxygen: 5%', tone: 'value'}]});
    await w.find('.arc-scale__hit').trigger('mousemove', {clientX: 40, clientY: 50});
    expect(scaleTooltipState.content).to.deep.eq(overview);

    await w.find('.arc-scale__hit').trigger('mouseleave');
    clock.advance(200);
    expect(scaleTooltipState.visible).to.be.false;

    // Leaving the page under a tooltip takes it down.
    await w.find('.arc-scale__identity').trigger('mouseenter');
    clock.advance(200);
    expect(scaleTooltipState.visible).to.be.true;
    w.unmount();
    clock.advance(200);
    expect(scaleTooltipState.visible).to.be.false;

    // While the console shell owns the screen the mouse is not the input: no handler asks for a tooltip.
    consoleState.shellMounted = true;
    const quiet = scale();
    await quiet.find('.arc-scale__identity').trigger('mouseenter');
    await quiet.find('.arc-scale__digit--current').trigger('mouseenter');
    await quiet.find('.arc-scale__hit').trigger('mouseenter', {clientX: 40, clientY: 50});
    clock.advance(500);
    expect(scaleTooltipState.visible).to.be.false;
    expect(scaleTooltipState.content).to.be.null;
  });
});
