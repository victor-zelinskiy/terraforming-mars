import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleRevealOverlay from '@/client/components/console/ConsoleRevealOverlay.vue';

// The overlay is about the reveal FLOW, not the card faces / glyph chips — stub
// the heavy leaf renderers so the mount is fast and layout-free (JSDOM).
const STUB = {template: '<div class="stub" />'};

function resultView(conditionMet: boolean): any {
  return {
    id: 'p1',
    players: [],
    game: {generation: 3},
    lastReveal: {
      action: 'Search For Life',
      revealed: {name: 'Tardigrades'},
      conditionMet,
      reward: conditionMet ? {direction: 'gain', icon: 'science', amount: 1} : undefined,
      vp: conditionMet ? {from: 0, to: 3} : undefined,
    },
  };
}

function factory(conditionMet = true) {
  return mount(ConsoleRevealOverlay, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {Card: STUB, ConsoleCardFaceLite: STUB, GamepadGlyph: STUB, ActionEffectChip: STUB},
    },
    props: {playerView: resultView(conditionMet), mode: 'result'},
  });
}

describe('ConsoleRevealOverlay — result reveal flight', () => {
  it('arms the deck→slot flight on mount and shows the «revealing» status (verdict withheld until the face turns up)', async () => {
    const w = factory(true);
    await w.vm.$nextTick();
    expect((w.vm as any).resultFlightOn).to.eq(true);
    expect((w.vm as any).resultStage).to.eq('pending');
    expect(w.find('.con-reveal__revealstatus').exists()).to.eq(true);
    expect(w.find('.con-reveal__outcome').exists()).to.eq(false);
    w.unmount();
  });

  it('degrades cleanly when the stage cannot be measured (JSDOM has no layout): the flip SETTLES, never hangs — the real card + MET verdict show', async () => {
    const w = factory(true);
    await w.vm.$nextTick();
    // Run the flight directly (skip the frame-settle timer). With no measurable
    // rect the director takes the unmeasurable path and settles at once.
    (w.vm as any).beginResultFlight();
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    expect((w.vm as any).resultStage).to.eq('settled');
    expect((w.vm as any).resultFlightOn).to.eq(false);
    const outcome = w.find('.con-reveal__outcome');
    expect(outcome.exists()).to.eq(true);
    expect(outcome.classes()).to.contain('con-reveal__outcome--met');
    w.unmount();
  });

  it('a MISS settles to the not-met verdict', async () => {
    const w = factory(false);
    await w.vm.$nextTick();
    (w.vm as any).beginResultFlight();
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    expect((w.vm as any).resultStage).to.eq('settled');
    expect(w.find('.con-reveal__outcome--miss').exists()).to.eq(true);
    w.unmount();
  });
});
