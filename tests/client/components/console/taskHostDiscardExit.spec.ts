import {flushPromises, mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {clearPanelCommands} from '@/client/console/consolePanelUi';
import {resetPromptSequence} from '@/client/console/promptSequence';
import {cardExitBusy, DISCARD_EXIT_ATTR} from '@/client/console/cardDeal/cardExitDirector';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

/*
 * THE REJECTED CANDIDATES' TUMBLE SURVIVES THE COMMIT'S OWN RE-RENDER (FLAKE ZERO, 2026-11-16). A single-card pick
 * (`commitSingleCard`) marks every OTHER slot of the strip for the discard's exit (`applyDiscardExit`) and, in the
 * same task, commits `picks = [name]` — which turns `cardDimUnpicked` on and re-renders every unpicked slot's bound
 * classes. On a NON-ROOT element a Vapor class binding that changes writes `className` WHOLE: the old
 * `con-exit-reject` CLASS was wiped there before any frame, the tumble never played, no `animationend` came and the
 * run held `cardExitBusy` (the hand's barrier) to its ~1.7 s safety. The mark is the attribute `data-exit-reject`.
 */

const A: GamepadIntent = {kind: 'press', button: 'confirm'};

// (A render function, not a template string: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object, required: true}, lightweight: Boolean},
  render() {
    return h('i', {'class': 'card-stub', 'data-name': (this.card as {name: string}).name});
  },
});

const NAMES = [CardName.ALGAE, CardName.ANTS, CardName.BIRDS];

function cardPick(promptId: number): PlayerInputModel {
  return {
    type: 'card', title: 'Select a card', buttonLabel: 'Select', promptId,
    cards: NAMES.map((name) => ({name, calculatedCost: 0})),
    min: 1, max: 1, showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
  } as unknown as PlayerInputModel;
}

function viewOf(waitingFor: PlayerInputModel): PlayerViewModel {
  const thisPlayer = fakePublicPlayerModel({megacredits: 12});
  return fakePlayerViewModel({thisPlayer, players: [thisPlayer], waitingFor} as Partial<PlayerViewModel>);
}

const TARGET: ConsoleTask = {kind: 'cardSelect', mode: 'target'};

/** Is a slot marked for the discard's exit? (The ONE reader — the mark is the product's attribute.) */
const rejectMarked = (el: Element): boolean => el.hasAttribute(DISCARD_EXIT_ATTR);

describe('ConsoleTaskHost — the rejected candidates leave the discard\'s way', () => {
  let clock: ManualFlowClock;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    clock = createManualClock();
    setFlowClock(clock);
  });

  afterEach(async () => {
    wrapper?.unmount();
    wrapper = undefined;
    // Whatever net a run left standing runs out here; the bundle-shared state is put back.
    clock.advance(60_000);
    await flushPromises();
    setFlowClock(undefined);
    clearPanelCommands('taskHost');
    resetPromptSequence();
  });

  it('the reject mark stands through the commit\'s own re-render of the slots — an attribute, never a class', async () => {
    wrapper = mount(ConsoleTaskHost, {
      ...globalConfig,
      props: {playerView: viewOf(cardPick(11)), task: TARGET},
      global: {...globalConfig.global, stubs: {Card: CardStub}},
    });
    // The deal settles on the kernel's clock (the frame's settle, then a frame) — no layout in the unit box, so it hands
    // the real cards over at once.
    for (let i = 0; i < 10; i++) {
      clock.advance(100);
      await flushPromises();
    }
    const slots = () => wrapper!.findAll('.con-cards__slot').map((s) => s.element as HTMLElement);
    expect(slots().map((s) => s.getAttribute('data-zoom-slot'))).to.deep.eq(NAMES);
    expect(slots().some((s) => s.classList.contains('con-deal-hold')), 'the candidates stand on the table').to.eq(false);
    slots().forEach((s) => s.classList.add('probe-imperative-class'));

    // A on the focused (first) card: the rejects are marked and the pick commits in the same stretch.
    (wrapper.vm as unknown as {handleIntent(intent: GamepadIntent): void}).handleIntent(A);
    await flushPromises();
    expect(wrapper.emitted('submit'), 'the pick is answered').to.deep.eq([[{type: 'card', cards: [CardName.ALGAE]}]]);
    const [chosen, ...rejects] = slots();
    expect(rejects.map((s) => s.classList.contains('con-cards__slot--dim')), 'the commit re-rendered the unpicked slots').to.deep.eq([true, true]);
    expect(rejects.map(rejectMarked), 'the tumble stands through that re-render').to.deep.eq([true, true]);
    expect(rejects.map((s) => s.getAttribute(DISCARD_EXIT_ATTR))).to.deep.eq(['tumble', 'tumble']);
    expect(rejects.map((s) => s.classList.contains('probe-imperative-class')), 'a CLASS written there is wiped — why the mark is not one')
      .to.deep.eq([false, false]);
    expect(rejectMarked(chosen), 'the chosen card is the hero, never a reject').to.eq(false);
    expect(cardExitBusy(), 'the exit is in flight').to.eq(true);

    // The tumble's own end releases the barrier — never the safety net.
    rejects.forEach((s) => s.dispatchEvent(new window.Event('animationend')));
    await flushPromises();
    expect(cardExitBusy(), 'the last animationend ends the run').to.eq(false);
  });
});
