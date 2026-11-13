import {mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleRevealOverlay from '@/client/components/console/ConsoleRevealOverlay.vue';
import type {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import ConsoleRevealVerdict from '@/client/components/console/foundation/ConsoleRevealVerdict.vue';
import {currentRevealEvent, drawnCardsState, reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import {REVEAL_HANDOFF_DEGRADED_ATTR} from '@/client/console/revealHandoff';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {CardName} from '@/common/cards/CardName';
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

/**
 * WHAT THE SHELL REACHES THROUGH ITS REF. The overlay is a `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md — R11): the pad router hands it every intent through the surface registry
 * (`handedTo(overlay, 'revealOverlay', intent)` → `overlay.handleIntent(intent)`), and that one function is the whole
 * of what it exposes. Asserted the way a parent reads it — under a host that holds a ref on it — never through
 * `wrapper.vm`, which sees the whole setup state and would stay green with `defineExpose` gone.
 */
type RevealOverlayReach = {handleIntent(intent: GamepadIntent): void};

const PRESS_A: GamepadIntent = {kind: 'press', button: 'confirm'};
const PRESS_B: GamepadIntent = {kind: 'press', button: 'back'};
const NAV_RIGHT: GamepadIntent = {kind: 'nav', dir: 'right', repeat: false};

/** A drawn batch needs no prompt and no board: the view only has to be a player's. */
function drawnView(): any {
  return {id: 'p1', players: [], game: {generation: 3, spaces: []}, waitingFor: undefined};
}

function mountUnderHost(mode: ConsoleRevealMode, playerView: any) {
  const heard: Array<string> = [];
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleRevealOverlay, {
      ref: 'overlay',
      playerView,
      mode,
      onDismissResult: () => heard.push('dismiss-result'),
      onDiscardPick: () => heard.push('discard-pick'),
      onDrawnComplete: () => heard.push('drawn-complete'),
      onResultDetached: () => heard.push('result-detached'),
    })]),
  });
  const host = mount(Host, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {Card: STUB, ConsoleCardFaceLite: STUB, GamepadGlyph: STUB, ActionEffectChip: STUB},
    },
  });
  return {
    host,
    heard,
    /** Exactly the shell's read: the surface the registry holds, or nothing. */
    reach: () => (host.vm.$refs.overlay ?? undefined) as RevealOverlayReach | undefined,
    overlay: () => host.findComponent(ConsoleRevealOverlay) as VueWrapper<any>,
  };
}

describe('ConsoleRevealOverlay — what the shell\'s ref reaches', () => {
  afterEach(() => {
    // Module state is BUNDLE-SHARED: a leaked batch keeps every later spec's reveal alive, and the hand-off's
    // degrade mark (no layout in this runner) stands on the document.
    drawnCardsState.events = [];
    drawnCardsState.fullscreen = null;
    document.documentElement.removeAttribute(REVEAL_HANDOFF_DEGRADED_ATTR);
  });

  it('sees exactly `handleIntent` — nothing else of the script', () => {
    const {reach} = mountUnderHost('result', resultView(true));
    const overlay = reach();
    expect(overlay, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(overlay ?? {}), 'the exposed list is the contract').to.deep.eq(['handleIntent']);
    for (const inner of ['beginResultFlight', 'resultStage', 'resultFlightOn', 'focusIdx', 'takeFocused', 'takeState', 'flow', 'rootEl']) {
      expect((overlay as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
  });

  it('RESULT: B is no way out of a verdict, and A hands the revealed card over ONCE — `dismiss-result`', async () => {
    const {host, heard, reach, overlay} = mountUnderHost('result', resultView(true));
    await host.vm.$nextTick();
    await settle(overlay());
    expect(overlay().vm.resultStage).to.eq('settled');

    // A verdict is terminal: nothing is chosen after it, so the bar offers no B and the press moves nothing.
    reach()?.handleIntent(PRESS_B);
    expect(heard, 'B does not dismiss a verdict').to.deep.eq([]);

    // «ОК»: the card leaves its slot (no layout here — the hand-off takes its end pose) and the flow is dismissed.
    reach()?.handleIntent(PRESS_A);
    expect(heard).to.deep.eq(['dismiss-result']);

    // One press only: a second A while the card is being handed over is not a second dismissal.
    reach()?.handleIntent(PRESS_A);
    expect(heard, 'the hand-off is one transaction').to.deep.eq(['dismiss-result']);
  });

  it('DRAWN: the batch stands as the scene, the d-pad moves the cursor and A takes the card UNDER it', async () => {
    drawnCardsState.events = [];
    reconcileDrawnCards([{id: 1, cards: [{name: CardName.ANTS}, {name: CardName.BIRDS}]} as never]);
    const {host, heard, reach, overlay} = mountUnderHost('drawn', drawnView());
    await host.vm.$nextTick();

    const root = host.find('.con-reveal');
    expect(root.classes(), 'no workspace owns the batch — the plateless scene').to.contain('con-reveal--scene');
    expect(root.attributes('data-take'), 'a take press would land').to.eq('ready');
    const slotKeys = () => host.findAll('.con-reveal__strip .con-cards__slot').map((slot) => slot.attributes('data-zoom-slot'));
    const focusedKeys = () => host.findAll('.con-reveal__strip .con-cards__slot--focused').map((slot) => slot.attributes('data-zoom-slot'));
    expect(slotKeys()).to.deep.eq([`${CardName.ANTS}#0`, `${CardName.BIRDS}#1`]);
    expect(focusedKeys(), 'the cursor starts on the first card').to.deep.eq([`${CardName.ANTS}#0`]);

    reach()?.handleIntent(NAV_RIGHT);
    await host.vm.$nextTick();
    await host.vm.$nextTick();
    expect(focusedKeys(), 'the cursor moved, and only the cursor').to.deep.eq([`${CardName.BIRDS}#1`]);
    // The slot that CARRIES the key (`:ref="… ? 'focusedCardSlot' : undefined"` inside `v-for` — RECIPES R11) is what
    // the scroll-follow reads: the row under the cursor, in the array a keyed row arrives in.
    const carried = overlay().vm.focusedCardSlot as HTMLElement | Array<HTMLElement> | null;
    const carriedSlots = Array.isArray(carried) ? carried : carried === null ? [] : [carried];
    expect(carriedSlots.map((slot) => slot.getAttribute('data-zoom-slot')), 'the template ref follows the cursor')
      .to.deep.eq([`${CardName.BIRDS}#1`]);

    // No hand dock in this runner: the intake commits with no flight (the degrade path a hidden dock takes).
    reach()?.handleIntent(PRESS_A);
    const batch = currentRevealEvent();
    expect(batch?.takenIndices.has(1), 'the card under the cursor is the one taken').to.eq(true);
    expect(batch?.takenIndices.has(0), 'its neighbour stays to be taken').to.eq(false);
    await host.vm.$nextTick();
    await host.vm.$nextTick();

    expect(slotKeys(), 'the taken card left the row').to.deep.eq([`${CardName.ANTS}#0`]);
    expect(focusedKeys(), 'the cursor fell back onto the card that is left').to.deep.eq([`${CardName.ANTS}#0`]);
    expect(root.attributes('data-take'), 'the take is over — the next press would land').to.eq('ready');
    expect(heard, 'a card is still owed: the batch is not complete').to.deep.eq([]);
  });
});
