/*
 * «РАЗЫГРАНО»'S FLOOR: THE HELD LIFT WAITS FOR THE FLOOR'S REAL START (FLAKE ZERO · class N —
 * `ConsolePlayedCategoryView.whenFloorStarts`).
 *
 * The open episode is built HELD and played on the floor's fade `ready` (animations.md law 7). Its backstop was 600 ms
 * of the WALL clock from the class write — and a fresh panel's raster on a software renderer outlasted it: the held
 * lift went while the floor's start was still PENDING and the cards landed on a floor at opacity 0. A pending start is
 * waited for; only a start that never resolves is cut, at a multi-second ceiling.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import ConsolePlayedCategoryView from '@/client/components/console/played/ConsolePlayedCategoryView.vue';
import {resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {playedCategoryState, resetPlayedCategoryView} from '@/client/console/played/playedCategoryView';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {getCards, byType} from '@/client/cards/ClientCardManifest';

const CARDS: Array<CardModel> = getCards(byType(CardType.ACTIVE)).slice(0, 4).map((c) => ({name: c.name}) as CardModel);

describe('ConsolePlayedCategoryView — the held lift waits for the floor\'s REAL start', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    resetPlayedCategoryView();
    resetConsolePlayedUi();
    setFlowClock(undefined);
  });

  function make() {
    playedCategoryState.category = 'active';
    playedCategoryState.names = CARDS.map((c) => c.name);
    playedCategoryState.focusIndex = 0;
    playedCategoryState.flights = [];
    playedCategoryState.holdCards = false;
    playedCategoryState.frameOn = true;
    playedCategoryState.phase = 'open';
    return mount(ConsolePlayedCategoryView, {
      props: {cards: CARDS},
      global: {mocks: {$t: (s: string) => s}, stubs: {ConsolePlayedCardLite: true, GamepadGlyph: true}},
    });
  }

  /** The floor's opacity transition, its start still PENDING on the compositor (a promise that has not resolved). */
  function pendingFade(wrapper: ReturnType<typeof make>): {start: () => void} {
    const panel = (wrapper.element as HTMLElement).querySelector<HTMLElement>('.con-played-cat__panel');
    expect(panel, 'the floor').to.not.eq(null);
    let start: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      start = resolve;
    });
    (panel as unknown as {getAnimations: () => Array<unknown>}).getAnimations =
      () => [{transitionProperty: 'opacity', pending: true, ready}];
    return {start};
  }

  it('a start still PENDING past the old 600 ms is waited for — the lift goes on the floor\'s own start', async () => {
    const wrapper = make();
    await nextTick();
    const fade = pendingFade(wrapper);
    let started = 0;
    wrapper.vm.whenFloorStarts(() => started++);
    clock.advance(2000);
    expect(started, 'the floor has not started — the cards stay held').to.eq(0);
    fade.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).to.eq(1);
    wrapper.unmount();
  });

  it('a start that NEVER resolves is cut at the ceiling — the lift is never held for ever', () => {
    const wrapper = make();
    pendingFade(wrapper);
    let started = 0;
    wrapper.vm.whenFloorStarts(() => started++);
    clock.advance(4000);
    expect(started).to.eq(1);
    wrapper.unmount();
  });
});
