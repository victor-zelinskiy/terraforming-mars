import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleRevealOverlay from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsoleRevealVerdict from '@/client/components/console/foundation/ConsoleRevealVerdict.vue';
import {Tag} from '@/common/cards/Tag';

/*
 * THE DECK-CHECK RESULT STAGE — the deck→slot flight and the verdict it hands over to.
 *
 * Two contracts are pinned here, both of which shipped as bugs before:
 *
 * 1. THE VERDICT IS WITHHELD UNTIL THE FACE TURNS UP. While the proxy flies, the
 *    slot shows the «Вскрываем карту» status and the real card keeps its layout
 *    but stays invisible — so the proxy lands on its exact rect and the swap is
 *    invisible. Announcing the outcome early makes the flight decorative.
 *
 * 2. THE VERDICT IS THE SHARED PANEL (`ConsoleRevealVerdict`), not a local pill.
 *    CONSOLE_BLUE_ACTION_PARITY it. 26: the embedded workspace stage used to say
 *    «✕ Условие не выполнено» while the legacy modal stated what was checked,
 *    whether it was found, and that the reward was NOT received. An embedded
 *    stage may never say LESS than the surface it replaces, and a shared CLASS
 *    is not enough — every past divergence in this family was a MARKUP
 *    divergence. Hence `findComponent`, not a class probe.
 *
 * The flight itself degrades by design when the stage cannot be measured
 * (JSDOM has no layout): `runActionRevealFlight` takes its `!usable` path and
 * settles on `notifyPayload()`, so the result is reachable here without faking
 * rects — the same path a torn-down DOM takes in the product.
 */

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
      check: {tag: Tag.MICROBE, label: 'Microbe tag'},
      reward: conditionMet ? {direction: 'gain', icon: 'science', amount: 1} : undefined,
      vp: conditionMet ? {from: 0, to: 3} : undefined,
    },
  };
}

function factory(conditionMet = true): VueWrapper<any> {
  return mount(ConsoleRevealOverlay, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      // The overlay is about the reveal FLOW, not the card faces / glyph chips —
      // stub the heavy leaf renderers so the mount is fast and layout-free.
      // `ConsoleRevealVerdict` is deliberately NOT stubbed: it is the subject.
      stubs: {Card: STUB, ConsoleCardFaceLite: STUB, GamepadGlyph: STUB, ActionEffectChip: STUB},
    },
    props: {playerView: resultView(conditionMet), mode: 'result'},
  });
}

/** Drive the flight to its settle (see the header: JSDOM takes the degrade path). */
async function settle(w: VueWrapper<any>): Promise<void> {
  w.vm.beginResultFlight();
  await w.vm.$nextTick();
  await w.vm.$nextTick();
}

describe('ConsoleRevealOverlay — result reveal flight', () => {
  it('arms the deck→slot flight on mount and withholds the verdict behind the «revealing» status', async () => {
    const w = factory(true);
    await w.vm.$nextTick();

    expect(w.vm.resultFlightOn, 'the flight proxy is mounted').to.eq(true);
    expect(w.vm.resultStage).to.eq('pending');

    // The status stands where the verdict will be…
    expect(w.find('.con-reveal__verdict--pending').exists()).to.eq(true);
    // …and the verdict itself does not exist yet — in EITHER host's markup.
    expect(w.findComponent(ConsoleRevealVerdict).exists()).to.eq(false);

    // The real card holds its layout (the flight's landing rect) but is invisible.
    const landing = w.find('.con-reveal__revealed');
    expect(landing.exists()).to.eq(true);
    expect(landing.attributes('data-zoom-slot')).to.eq('revealed:Tardigrades');
    expect(landing.find('.stub').attributes('style') ?? '').to.contain('visibility: hidden');
    expect(landing.classes()).to.not.contain('con-reveal__revealed--met');

    w.unmount();
  });

  it('settles to the MET verdict, and the SHARED panel states the check, the reward and the VP', async () => {
    const w = factory(true);
    await w.vm.$nextTick();
    await settle(w);

    expect(w.vm.resultStage).to.eq('settled');
    expect(w.vm.resultFlightOn, 'the proxy is gone in the same flush the card shows').to.eq(false);
    expect(w.find('.con-reveal__revealed').classes()).to.contain('con-reveal__revealed--met');
    expect(w.find('.con-reveal__verdict--pending').exists()).to.eq(false);

    const verdict = w.findComponent(ConsoleRevealVerdict);
    expect(verdict.exists(), 'the verdict is the shared component, not a local pill').to.eq(true);
    expect(verdict.find('.con-verdict').classes()).to.contain('con-verdict--met');
    expect(verdict.find('.con-verdict__badge').text()).to.eq('✓');
    // What was checked, and that it was found.
    expect(verdict.find('.con-verdict__row').exists()).to.eq(true);
    expect(verdict.find('.con-verdict__found').classes()).to.contain('con-verdict__found--yes');
    // The reward was RECEIVED (a chip, not the «not received» line)…
    expect(verdict.find('.con-verdict__none').exists()).to.eq(false);
    // …and the source card's VP delta is stated.
    expect(verdict.find('.con-verdict__vp').text()).to.contain('+3');

    w.unmount();
  });

  it('settles to the MISS verdict, which NAMES the reward it did not grant (no silent loss)', async () => {
    const w = factory(false);
    await w.vm.$nextTick();
    await settle(w);

    expect(w.vm.resultStage).to.eq('settled');
    expect(w.find('.con-reveal__revealed').classes()).to.contain('con-reveal__revealed--miss');

    const verdict = w.findComponent(ConsoleRevealVerdict);
    expect(verdict.exists()).to.eq(true);
    expect(verdict.find('.con-verdict').classes()).to.contain('con-verdict--miss');
    expect(verdict.find('.con-verdict__badge').text()).to.eq('✕');
    expect(verdict.find('.con-verdict__found').classes()).to.contain('con-verdict__found--no');
    // Cross-cutting invariant 4: a skipped effect names itself.
    expect(verdict.find('.con-verdict__none').exists(), 'the miss states the reward was not received').to.eq(true);
    // No VP row — «+0 ПО» is noise, and the reward row already said what happened.
    expect(verdict.find('.con-verdict__vp').exists()).to.eq(false);

    w.unmount();
  });
});
