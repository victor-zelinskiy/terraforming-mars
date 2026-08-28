import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {CardName} from '@/common/cards/CardName';
import {
  cancelConsoleRepeatPick, enterConsoleRepeatPick, resolveConsoleRepeatPick, resetConsoleRepeatPick,
} from '@/client/console/consoleRepeatPick';
import {resetConsoleRepeatPickUi} from '@/client/console/consoleRepeatPickUi';
import {
  pushWorkspaceFrame, resetWorkspaceStack, workspaceFrameIndex, workspaceFrameIsOverlay,
  workspaceFrameRenders, workspaceStackState, workspaceStackTop,
} from '@/client/console/consoleWorkspaceStack';
import {consoleCardActionsUi, defaultCardActionsFilter} from '@/client/console/consoleCardActions';
import {resetActionPreviews} from '@/client/console/actionPreviewStore';

/**
 * «ПОВТОР ДЕЙСТВИЯ» IS A STEP OF THE FLOW THAT ASKED FOR IT.
 *
 * The player reaches it from inside a card's own action — «ДЕЙСТВИЯ КАРТ ›
 * ШТОРМОВОЙ БАРЬЕР › ГИДРОСЕТЬ» — and the pick must read as one level deeper
 * in THAT line, never as a screen of its own. As a bare neighbour on a module
 * flag it had none of the contract: it titled itself «ГИДРОСЕТЬ МАРСА › Повтор
 * действия», its host stayed posed mid-handoff, and — the visible defect —
 * the second `ConsoleCardActions` asked the GLOBAL stack «has a step taken my
 * screen?», answered yes (the hydro frame IS nested in card-actions) and
 * dissolved its own body: header, filters and «3 всего / 1 можно выбрать» over
 * an empty band, with the grid it exists for unrendered.
 *
 * These pin the frame contract that replaced it.
 */
const CARD = CardName.REGOLITH_EATERS;
const SECOND = CardName.IRONWORKS;

const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

function playerView(): any {
  return {
    id: '', // '' → the preview fetch is skipped under the test runner
    thisPlayer: {
      color: 'blue', name: 'Me',
      megacredits: 12, steel: 0, titanium: 0, plants: 0, energy: 2, heat: 0,
      tableau: [{name: CARD, resources: 2}, {name: SECOND}],
      actionsThisGeneration: [CARD, SECOND],
    },
    players: [{color: 'blue', name: 'Me'}],
    game: {generation: 3},
    cardsInHand: [],
    waitingFor: {
      type: 'or',
      title: 'Take your next action',
      options: [{
        type: 'card',
        title: 'Perform an action from a played card',
        buttonLabel: 'Take action',
        cards: [{name: CARD}, {name: SECOND}],
        min: 1, max: 1,
      }],
    },
  };
}

/** The REAL chain the bug was reported on: the player activated a card's
 *  action, walked into the Hydronetwork it grants, and asked for the copy. */
function seatCardEntryStack(): void {
  pushWorkspaceFrame({
    kind: 'card-actions', subject: CardName.STORM_SURGE_BARRIER, stage: '',
    phase: 'configure', serves: [], anchor: {type: 'always'},
  });
  pushWorkspaceFrame({
    kind: 'hydro', subject: '', stage: 'Hydronetwork',
    phase: 'configure', serves: [], anchor: {type: 'always'}, overlay: true,
  });
}

function openPick(): void {
  enterConsoleRepeatPick({
    title: 'Use a blue card action that has already been used this generation',
    buttonLabel: 'Take action',
    candidates: [CARD, SECOND],
    disabled: [],
    source: {kicker: 'Mars Hydronetwork', card: CardName.DELTA_PROJECT, label: 'Mars Hydronetwork'},
  }, () => undefined, () => undefined);
}

function factory(repeat: boolean) {
  return mount(ConsoleCardActions, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {playerView: playerView(), repeat},
    attachTo: document.body,
  });
}

async function settle(w: any): Promise<void> {
  await w.vm.$nextTick();
  await w.vm.$nextTick();
}

describe('the repeat-action pick is a nested workspace FRAME', () => {
  beforeEach(() => {
    resetWorkspaceStack();
    resetConsoleRepeatPick();
    resetConsoleRepeatPickUi();
    resetActionPreviews();
    consoleCardActionsUi.filter = defaultCardActionsFilter();
  });
  // Module state is BUNDLE-SHARED under mochapack — leave neither the bridge
  // nor the stack standing for the next spec.
  afterEach(() => {
    resetConsoleRepeatPick();
    resetConsoleRepeatPickUi();
    resetWorkspaceStack();
  });

  describe('the stack', () => {
    it('opening pushes an OVERLAY frame on top of the flow that asked', () => {
      seatCardEntryStack();
      openPick();

      expect(workspaceStackTop()?.kind).to.eq('repeat-pick');
      expect(workspaceFrameIndex('repeat-pick')).to.eq(2);
      // It needs the whole band and has no zone to wait for — the sanctioned
      // overlay case, so it must not be held off screen.
      expect(workspaceFrameIsOverlay('repeat-pick')).is.true;
      expect(workspaceFrameRenders('repeat-pick')).is.true;
      // …and the flow it belongs to is untouched underneath.
      expect(workspaceStackState.frames[0].kind).to.eq('card-actions');
      expect(workspaceStackState.frames[1].kind).to.eq('hydro');
    });

    it('B pops exactly ONE level — the flow is standing where it was', () => {
      seatCardEntryStack();
      openPick();

      cancelConsoleRepeatPick();

      expect(workspaceFrameIndex('repeat-pick')).to.eq(-1);
      expect(workspaceStackTop()?.kind).to.eq('hydro');
      expect(workspaceStackState.frames).to.have.length(2);
    });

    it('answering pops it too — one exit shape, both endings', () => {
      seatCardEntryStack();
      openPick();

      resolveConsoleRepeatPick({
        chosenCard: CARD, nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      });

      expect(workspaceFrameIndex('repeat-pick')).to.eq(-1);
      expect(workspaceStackTop()?.kind).to.eq('hydro');
    });

    it('a HARD reset never takes a frame belonging to somebody else', () => {
      seatCardEntryStack();
      openPick();
      // Something else pushed over the pick (the stack moved on without it).
      pushWorkspaceFrame({
        kind: 'hand', subject: '', stage: '', phase: 'browse',
        serves: [], anchor: {type: 'always'},
      });

      resetConsoleRepeatPick();

      expect(workspaceStackTop()?.kind, 'the foreign top frame survives').to.eq('hand');
    });

    it('with NOTHING below it the pick still stands (a producer with no workspace)', () => {
      openPick();
      expect(workspaceFrameIndex('repeat-pick')).to.eq(0);
      expect(workspaceFrameRenders('repeat-pick')).is.true;
      cancelConsoleRepeatPick();
      expect(workspaceStackState.frames).to.have.length(0);
    });
  });

  describe('the surface', () => {
    it('RENDERS ITS BODY inside a flow that is itself a nested step', async () => {
      // THE REPORTED BUG. `yieldedToStep` is a question about the stack with a
      // per-instance answer: the pick IS the step, so the nesting that makes
      // the action centre yield is the nesting that makes the pick visible.
      seatCardEntryStack();
      openPick();
      const w = factory(true);
      await settle(w);

      expect((w.vm as any).yieldedToStep, 'a step cannot be the surface that yielded').is.false;
      expect(w.find('.con-cardactions--yielded').exists()).is.false;
      // …and the grid it exists for is actually on screen.
      expect(w.find('.con-cardactions__group').exists(), 'the tile grid must render').is.true;
      expect(w.find('.con-cardactions__detail').exists(), 'the dossier must render').is.true;
      w.unmount();
    });

    it('the ORDINARY action centre still yields to its hydro step', async () => {
      seatCardEntryStack();
      const w = factory(false);
      await settle(w);

      expect((w.vm as any).yieldedToStep).is.true;
      w.unmount();
    });

    it('the crumb is the STACK\'S — root and carried card never restart', async () => {
      seatCardEntryStack();
      openPick();
      const w = factory(true);
      await settle(w);

      const vm = w.vm as any;
      // «ДЕЙСТВИЯ КАРТ › ШТОРМОВОЙ БАРЬЕР › ПОВТОР ДЕЙСТВИЯ»: the flow's own
      // root and the card it is about, with the pick as the tail.
      expect(vm.repeatCrumbRoot).to.eq('Card actions');
      expect(vm.repeatCrumbContext).to.eq(CardName.STORM_SURGE_BARRIER);
      expect(vm.repeatCrumb?.stage).to.eq('Repeat action');
      w.unmount();
    });

    it('with no host it falls back to the request\'s own source label', async () => {
      openPick(); // no flow underneath — the pick is the root
      const w = factory(true);
      await settle(w);

      expect((w.vm as any).repeatCrumbRoot).to.eq('Mars Hydronetwork');
      w.unmount();
    });
  });
});
