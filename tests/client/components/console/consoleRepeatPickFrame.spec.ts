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
import {actionPreviewStore, resetActionPreviews} from '@/client/console/actionPreviewStore';
import {resetWorkspaceOutcome, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {resetConsoleActionRevealClaim} from '@/client/console/consoleActionComposerUi';

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
  // nor the stack (nor an armed outcome claim) standing for the next spec.
  afterEach(() => {
    resetConsoleRepeatPick();
    resetConsoleRepeatPickUi();
    resetWorkspaceStack();
    resetWorkspaceOutcome();
    resetConsoleActionRevealClaim();
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
      expect(vm.repeatStepCrumb?.subject).to.eq(CardName.STORM_SURGE_BARRIER);
      expect(vm.repeatStepCrumb?.stage).to.eq('Repeat action');
      w.unmount();
    });

    it('a HOSTED pick keeps the host\'s IDENT — the header may not change height', async () => {
      // ⚠️ The ident owns the header's height: it never wraps and never
      // shrinks, so a word added there narrows the aux zone beside it and the
      // filter groups break to a second tier — a taller header, and the crumb
      // line lands ~36 px below the host's. Walking one level deeper then
      // MOVES the one line whose job is to prove the flow never broke. The
      // path goes in the DEEP layer, which is an absolute overlay and costs
      // exactly nothing.
      seatCardEntryStack();
      openPick();
      const w = factory(true);
      await settle(w);

      expect((w.vm as any).repeatCrumbContext, 'the ident carries the root ALONE').to.eq('');
      w.unmount();
    });

    it('with no host it keeps its own ident — a root pick is not a step', async () => {
      openPick(); // no flow underneath — the pick is the root
      const w = factory(true);
      await settle(w);

      const vm = w.vm as any;
      expect(vm.repeatCrumbRoot).to.eq('Mars Hydronetwork');
      expect(vm.repeatCrumbContext).to.eq('Repeat action');
      expect(vm.repeatStepCrumb, 'no host ⇒ no deep crumb, so the filters stay').to.eq(undefined);
      w.unmount();
    });
  });

  /**
   * THE FINAL VIRON SUBMIT CLAIMS THE CHOSEN ACTION'S OUTCOME.
   *
   * The reported hole (2026-09-05): Viron copies «Центр ИИ» and the drawn pair
   * opened as the standalone full-bleed modal over the open workspace — the
   * direct-path claim block is gated `payload.repeat === undefined`, so the
   * repeat submit armed NOTHING, and the adoption net deliberately excludes
   * the `card-actions` host. The claim must come from the CHOSEN card's own
   * branch preview (the source's promises nothing card-shaped) with scope
   * 'chain' — the server attributes the copied effects to the card that RAN.
   */
  describe('the source\'s final submit (Viron)', () => {
    function seedDrawPreview(card: CardName, cards: number): void {
      actionPreviewStore.previews[card] = {
        card, isCorporation: false, kind: 'declarative',
        branches: [{
          index: -1, title: 'Draw cards', available: true, renderKeys: [],
          effects: [{direction: 'gain', icon: 'cards', amount: cards}],
        }],
      } as any;
    }

    function confirmWithRepeat(vm: any, reveal = false): void {
      vm.composer = {cardName: SECOND, nodeIndex: 0}; // the copying source's own composer
      vm.onComposerConfirm({
        branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: [],
        repeat: {
          chosenCard: CARD, nodeIndex: 0, reveal,
          composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
        },
      });
    }

    it('a DRAWING copy arms a chain-scoped card-actions claim + the pending stage', async () => {
      const w = factory(false);
      await settle(w);
      seedDrawPreview(CARD, 2);

      confirmWithRepeat(w.vm as any);

      expect(workspaceOutcomeState.host).to.eq('card-actions');
      expect(workspaceOutcomeState.sourceCard, 'keyed on the card that RAN, never the source').to.eq(CARD);
      expect(workspaceOutcomeState.scope).to.eq('chain');
      expect([...workspaceOutcomeState.kinds]).to.deep.eq(['draw', 'pick']);
      expect(workspaceOutcomeState.expectedCards).to.eq(2);
      // The PENDING stage opens at submit — it is what puts the teleport
      // target in the DOM before the batch can land.
      expect((w.vm as any).outcomeFlow?.kind).to.eq('pending');
      w.unmount();
    });

    it('a copy promising nothing card-shaped claims nothing', async () => {
      const w = factory(false);
      await settle(w);
      actionPreviewStore.previews[CARD] = {
        card: CARD, isCorporation: false, kind: 'declarative',
        branches: [{index: -1, title: 'Gain', available: true, renderKeys: [], effects: []}],
      } as any;

      confirmWithRepeat(w.vm as any);

      expect(workspaceOutcomeState.sourceCard).to.eq('');
      expect((w.vm as any).outcomeFlow).to.eq(undefined);
      w.unmount();
    });

    it('a REVEAL copy keeps the in-frame deck-check route (beginRepeatReveal)', async () => {
      const w = factory(false);
      await settle(w);
      seedDrawPreview(CARD, 1);

      confirmWithRepeat(w.vm as any, true);

      // The reveal path re-points the stage at the chosen card and claims the
      // deck-check — never the standalone overlay.
      expect(workspaceOutcomeState.sourceCard).to.eq(CARD);
      expect(workspaceOutcomeState.kinds).to.include('deck-check');
      expect((w.vm as any).outcomeFlow?.kind).to.eq('deck-check');
      expect((w.vm as any).composer?.cardName).to.eq(CARD);
      w.unmount();
    });
  });
});
