/*
 * GamepadFocusRing — THE focus ring: one fixed element that morphs to the focused element's rect. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is MODULE
 * state (the input mode and the focus engine's ring), so the spec is what it renders for that state, that it FOLLOWS
 * it, and the refusal shake: a one-shot that ends by itself (a wait of the flow kernel — the spec drives the kernel's
 * clock). The badge is the real `GamepadGlyph` (a leaf — the badge of the control it is handed).
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import GamepadFocusRing from '@/client/components/gamepad/GamepadFocusRing.vue';
import {focusState, RingVariant} from '@/client/gamepad/focusEngine';
import {InputMode, inputModeState} from '@/client/gamepad/inputModeState';
import {activeGlyphSet} from '@/client/gamepad/glyphSets';
import {motionMs} from '@/client/components/motion/motionTokens';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

function ring() {
  return mount(GamepadFocusRing, {global: {config: globalConfig.global.config}});
}

function style(el: Element): {transform: string, width: string, height: string} {
  const {transform, width, height} = (el as HTMLElement).style;
  return {transform, width, height};
}

describe('GamepadFocusRing — the one focus ring', () => {
  // Module state is bundle-shared: what the spec moves is put back for every later spec (the denied epoch is a
  // counter that only ever grows — nothing reads its value, so it is left where the spec took it).
  let before: {mode: InputMode, visible: boolean, left: number, top: number, width: number, height: number, variant: RingVariant};
  let clock: ManualFlowClock;

  beforeEach(() => {
    const {visible, left, top, width, height, variant} = focusState.ring;
    before = {mode: inputModeState.mode, visible, left, top, width, height, variant};
    inputModeState.mode = 'gamepad';
    Object.assign(focusState.ring, {visible: true, left: 100, top: 40, width: 200, height: 60, variant: 'default'});
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
    const {mode, ...rect} = before;
    inputModeState.mode = mode;
    Object.assign(focusState.ring, rect);
  });

  it('is not there with the pointer in charge, nor while nothing is focused', async () => {
    inputModeState.mode = 'pointer';
    const w = ring();
    expect(w.find('.gp-ring').exists()).to.eq(false);

    inputModeState.mode = 'gamepad';
    await nextTick();
    expect(w.find('.gp-ring').exists()).to.eq(true);

    focusState.ring.visible = false;
    await nextTick();
    expect(w.find('.gp-ring').exists()).to.eq(false);
  });

  it('stands round the focused rect — four ticks, the confirm badge — and FOLLOWS the focus engine', async () => {
    const w = ring();
    expect(w.classes()).to.deep.eq(['gp-ring', 'gp-ring--default']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(style(w.element), 'the rect, a 4 px margin on every side').to.deep.eq({transform: 'translate3d(96px, 36px, 0)', width: '208px', height: '68px'});
    expect(w.findAll('.gp-ring > .gp-ring__tick').map((tick) => tick.classes()[1]))
      .to.deep.eq(['gp-ring__tick--tl', 'gp-ring__tick--tr', 'gp-ring__tick--bl', 'gp-ring__tick--br']);
    const badge = w.find('.gp-ring > .gp-ring__badge');
    expect(badge.classes(), 'the badge is the glyph itself').to.include('gp-glyph');
    expect(badge.text()).to.eq(activeGlyphSet().confirm.label);

    Object.assign(focusState.ring, {left: 10, top: 20, width: 30, height: 40});
    await nextTick();
    expect(style(w.element)).to.deep.eq({transform: 'translate3d(6px, 16px, 0)', width: '38px', height: '48px'});

    // An illegal target offers no A: the variant is on the ring, the badge is gone.
    focusState.ring.variant = 'illegal';
    await nextTick();
    expect(w.classes()).to.deep.eq(['gp-ring', 'gp-ring--illegal']);
    expect(w.find('.gp-ring__badge').exists()).to.eq(false);
    expect(w.findAll('.gp-ring__tick')).to.have.length(4);
  });

  it('a refused action shakes the ring once — the shake ends on its own, and a second refusal re-arms it', async () => {
    const w = ring();
    expect(w.classes()).to.not.include('gp-ring--denied');

    focusState.ring.deniedEpoch++;
    await flushPromises();
    expect(w.classes(), 'shaking').to.include('gp-ring--denied');

    // Refused again mid-shake: the first shake's end is taken back, the new one runs its whole length.
    clock.advance(motionMs(260) - 20);
    focusState.ring.deniedEpoch++;
    await flushPromises();
    expect(w.classes(), 're-armed').to.include('gp-ring--denied');
    clock.advance(40);
    await flushPromises();
    expect(w.classes(), 'the first shake\'s end no longer applies').to.include('gp-ring--denied');

    clock.advance(motionMs(260));
    await flushPromises();
    expect(w.classes(), 'settled').to.deep.eq(['gp-ring', 'gp-ring--default']);
  });
});
