import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {CardName} from '@/common/cards/CardName';
import type {DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import {resetHydroFlow, beginHydroCommit, hydroFlowState} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';

/**
 * THE BONUS OFFER'S WORKING ZONE — the bottom of the Hydronetwork workspace,
 * given over to ONE decision.
 *
 * These exercise the component's own contract rather than its pixels: which
 * scene owns the zone, where the cursor starts, that a second press cannot
 * exist, that the index submitted is the SERVER's, that the zone never titles
 * itself (the stage name goes up to the crumb) — and the three things a
 * card-granted move must NEVER do: answer itself on B, call the player «busy»
 * inside the screen its own prompt opened, or hand the shell an answer with no
 * move to present.
 */
const OFFER: DeltaBonusPromptMeta = {
  source: CardName.DYNAMIC_OCEAN_BARRIER,
  steps: 1,
  fromPosition: 2,
  toPosition: 3,
  energyCost: 0,
  waivesTag: false,
  advanceIndex: 0,
  skipIndex: 1,
};

type Vm = {
  sceneKey: string,
  sceneFocus: string,
  bonusSubmitting: boolean,
  crumbStage: string,
  bonusAnswerable: boolean,
  bonusNeedsReward: boolean,
  rewardChoice: number | undefined,
  backVerb: string,
  backLabel: string | undefined,
  turnState: string,
  statusKind: string,
  statusLabel: string,
  reasons: ReadonlyArray<{kind: string}>,
  footCommands: ReadonlyArray<{control: string, label: string, enabled?: boolean}>,
  answerBonus(take: boolean): void,
  confirmChoiceStep(): void,
  handleIntent(intent: unknown): void,
};

/** A minimal but HONEST viewer: the reward view is real arithmetic over a real
 *  stock, so a stub without one would only prove the test's own shape. */
function viewerPlayer() {
  return {
    color: 'red',
    steel: 1, plants: 2, titanium: 0, energy: 3, heat: 0, megacredits: 10,
    megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0,
    plantProduction: 0, energyProduction: 1, heatProduction: 0,
    tags: {},
    tableau: [],
    deltaProject: {position: 2, stops: []},
  };
}

function mountSection(offer: DeltaBonusPromptMeta | undefined, opts: {
  ownsPrompt?: boolean,
  waitingFor?: unknown,
} = {}) {
  return mount(ConsoleHydroSection, {
    props: {
      playerView: {
        thisPlayer: viewerPlayer(),
        players: [viewerPlayer()],
        game: {},
        waitingFor: opts.waitingFor,
      } as never,
      bonusOffer: offer,
      // The default mirrors the shell: the RAW offer is what «this workspace is
      // owed a prompt» means, and every mount with an offer has one.
      ownsPrompt: opts.ownsPrompt ?? offer !== undefined,
    },
    global: {stubs: {ConsoleWsHead: true, ConsoleCardFaceLite: true, ConsoleSourceDock: true, ConsolePlayedTargetStep: true, GamepadGlyph: true, HydroReward: true}},
  });
}

const CHOICE_OFFER: DeltaBonusPromptMeta = {...OFFER, fromPosition: 0, toPosition: 1};

/** A prompt that is NOT this workspace's — the wheel-entry case. */
const FOREIGN_PROMPT = {type: 'card', title: 'Discard a card'};

describe('the Hydronetwork bonus zone', () => {
  afterEach(() => {
    resetHydroFlow(); // module state is bundle-shared — never leak the flow
    hydroNetworkState.rewardChoice = undefined;
  });

  it('an offer OWNS the working zone; without one the zone is not the offer', () => {
    const withOffer = mountSection(OFFER);
    expect((withOffer.vm as unknown as Vm).sceneKey).to.eq('bonus');
    withOffer.unmount();

    const without = mountSection(undefined);
    expect((without.vm as unknown as Vm).sceneKey).to.not.eq('bonus');
    without.unmount();
  });

  // What is already RUNNING outranks what is merely offered — a second ocean's
  // offer can never paint over the move already in flight.
  it('a commit in flight outranks a fresh offer', () => {
    const w = mountSection(OFFER);
    beginHydroCommit({
      fromPosition: 2, toPosition: 3, spend: 1, stageNameKey: '', kind: 'plain',
      rewards: [], resultLines: [], vp: undefined,
    } as never);
    expect((w.vm as unknown as Vm).sceneKey).to.eq('commit');
    w.unmount();
  });

  it('seats the cursor on the CONFIRM, so A answers the question asked', () => {
    const w = mountSection(OFFER);
    expect((w.vm as unknown as Vm).sceneFocus).to.eq('bonus-confirm');
    w.unmount();
  });

  it('hands its stage name UP to the crumb — it never titles itself', () => {
    const w = mountSection(OFFER);
    expect((w.vm as unknown as Vm).crumbStage).to.eq('BONUS STEP');
    w.unmount();
  });

  /**
   * ══ B IS «СВЕРНУТЬ», NEVER AN ANSWER ═════════════════════════════════════
   *
   * B used to submit the SKIP. That put the refusal on the one button which
   * everywhere else in this console means «step out and look at the board», so
   * a player reaching for the board silently declined a card's effect — and an
   * effect declined that way cannot be got back. The refusal lives where every
   * other refusal in this console lives: an option, focused and confirmed
   * with A.
   */
  describe('B', () => {
    it('COLLAPSES the workspace and answers nothing', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.backVerb).to.eq('collapse');
      vm.handleIntent({kind: 'press', button: 'back'});
      expect(w.emitted('collapse'), 'B must collapse').to.have.length(1);
      expect(w.emitted('bonus-answer'), 'B must not answer the prompt').is.undefined;
      expect(w.emitted('close'), 'B must not close out of an owed prompt').is.undefined;
      expect(vm.bonusSubmitting, 'nothing was submitted').is.false;
      w.unmount();
    });

    it('is LABELLED «свернуть» in the bar, and never beside the skip', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      const back = vm.footCommands.find((c) => c.control === 'back');
      expect(back?.label).to.eq('Minimize');
      expect(back?.label).to.not.eq('Skip');
      w.unmount();
    });

    /** Without an owed prompt the browse layer is an ordinary screen again. */
    it('closes the workspace when nothing is owed', () => {
      const w = mountSection(undefined, {ownsPrompt: false});
      const vm = w.vm as unknown as Vm;
      expect(vm.backVerb).to.eq('close');
      vm.handleIntent({kind: 'press', button: 'back'});
      expect(w.emitted('close')).to.have.length(1);
      expect(w.emitted('collapse')).is.undefined;
      w.unmount();
    });

    /**
     * THE ADMISSION WINDOW. The offer is on the wire but the door is still
     * holding it (the placement's drawn cards are being taken), so there is no
     * offer PROP yet — and the browse layer standing there is still standing
     * over a live decision. Keying B on the painted scene instead of on the
     * owed prompt is what would let this one frame close the workspace out of
     * an unanswered prompt.
     */
    it('collapses on the browse layer too while the offer is merely admitted-pending', () => {
      const w = mountSection(undefined, {ownsPrompt: true});
      const vm = w.vm as unknown as Vm;
      expect(vm.backVerb).to.eq('collapse');
      vm.handleIntent({kind: 'press', button: 'back'});
      expect(w.emitted('collapse')).to.have.length(1);
      expect(w.emitted('close')).is.undefined;
      w.unmount();
    });
  });

  /**
   * ══ «СНАЧАЛА ЗАВЕРШИТЕ ТЕКУЩЕЕ ДЕЙСТВИЕ» ════════════════════════════════
   *
   * …is a true sentence in exactly one of these four situations. It used to be
   * printed in three, because the state was derived from `waitingFor !== …`
   * alone — which says a prompt exists, and nothing whatever about whose
   * surface is on screen.
   */
  describe('the turn state', () => {
    it('is OWN-PROMPT inside the workspace the prompt itself opened', () => {
      const w = mountSection(OFFER, {waitingFor: {type: 'or', title: 'x'}, ownsPrompt: true});
      const vm = w.vm as unknown as Vm;
      expect(vm.turnState).to.eq('own-prompt');
      expect(vm.statusKind).to.eq('offer');
      expect(vm.statusLabel).to.eq('Bonus step offered');
      expect(vm.reasons.some((r) => r.kind === 'finish-current-action'),
        'no false «finish your current action»').is.false;
      w.unmount();
    });

    /** Re-entered through the board-home mandatory card: the same place, so the
     *  same answer — the route the player took is not a state. */
    it('is OWN-PROMPT after a re-entry through the mandatory card', () => {
      const w = mountSection(OFFER, {waitingFor: {type: 'or', title: 'x'}, ownsPrompt: true});
      expect((w.vm as unknown as Vm).statusKind).to.eq('offer');
      w.unmount();
    });

    /** The player walked in from the wheel while something ELSE is owed: the
     *  advance really is out of reach, and saying so is the truth. */
    it('is BUSY when the standing prompt belongs to another surface', () => {
      const w = mountSection(undefined, {waitingFor: FOREIGN_PROMPT, ownsPrompt: false});
      const vm = w.vm as unknown as Vm;
      expect(vm.turnState).to.eq('busy');
      expect(vm.statusLabel).to.eq('Finish your current action first');
      w.unmount();
    });

    it('is NOT-YOUR-TURN with no prompt at all', () => {
      const w = mountSection(undefined, {ownsPrompt: false});
      expect((w.vm as unknown as Vm).turnState).to.eq('not-your-turn');
      w.unmount();
    });
  });

  describe('answering', () => {
    it('submits the SERVER\'s own index, for both answers', () => {
      const take = mountSection(OFFER);
      (take.vm as unknown as Vm).answerBonus(true);
      const taken = take.emitted('bonus-answer')?.[0][0] as {take: boolean, index: number};
      expect(taken.take).is.true;
      expect(taken.index).to.eq(OFFER.advanceIndex);
      take.unmount();

      const skip = mountSection({...OFFER, advanceIndex: 3, skipIndex: 7});
      (skip.vm as unknown as Vm).answerBonus(false);
      expect(skip.emitted('bonus-answer')?.[0])
        .to.deep.eq([{take: false, index: 7, rewardChoice: undefined}]);
      skip.unmount();
    });

    /**
     * THE PAYLOAD IS THE STANDARD ADVANCE'S. Without it the shell had nothing
     * to open a presentation with — no route, no transfers, no result lines —
     * so the answer went straight onto the wire and the workspace closed on the
     * spot. The marker never moved and the reward never flew.
     */
    it('carries the whole move to present: route, price, transfers, result lines', () => {
      const w = mountSection({...OFFER, fromPosition: 2, toPosition: 3});
      (w.vm as unknown as Vm).answerBonus(true);
      const p = w.emitted('bonus-answer')?.[0][0] as {
        fromPosition: number, toPosition: number, spend: number,
        rewards: ReadonlyArray<{channel: string, amount: number}>,
        resultLines: ReadonlyArray<{delta: number}>, stageNameKey: string,
      };
      expect(p.fromPosition).to.eq(2);
      expect(p.toPosition).to.eq(3);
      expect(p.spend, 'a free bonus step costs nothing').to.eq(0);
      expect(p.stageNameKey, 'the landed stage names itself').to.not.eq('');
      // Position 3 pays +2 M€ PRODUCTION — one transfer, one honest line.
      expect(p.rewards).to.have.length(1);
      expect(p.rewards[0].channel).to.eq('production');
      expect(p.rewards[0].amount).to.eq(2);
      expect(p.resultLines).to.have.length(1);
      expect(p.resultLines[0].delta).to.eq(2);
      w.unmount();
    });

    it('states the WAIVER\'s price on the payload, not a guess', () => {
      const w = mountSection({...OFFER, energyCost: 1, waivesTag: true});
      (w.vm as unknown as Vm).answerBonus(true);
      expect((w.emitted('bonus-answer')?.[0][0] as {spend: number}).spend).to.eq(1);
      w.unmount();
    });

    /** A refusal presents nothing — there is no move. */
    it('a SKIP carries no presentation payload', () => {
      const w = mountSection(OFFER);
      (w.vm as unknown as Vm).answerBonus(false);
      const p = w.emitted('bonus-answer')?.[0][0] as Record<string, unknown>;
      expect(p.take).is.false;
      expect(p.rewards).is.undefined;
      expect(p.toPosition).is.undefined;
      w.unmount();
    });

    // A double press is impossible BY STATE, not by a guard at one call site.
    it('a second press cannot exist while the answer is in flight', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      vm.answerBonus(true);
      vm.answerBonus(false);
      expect(w.emitted('bonus-answer')).to.have.length(1);
      expect(vm.bonusSubmitting).is.true;
      expect(vm.bonusAnswerable).is.false;
      w.unmount();
    });
  });

  /**
   * THE REWARD IS ASKED IN THE WORKSPACE, NEVER BY A SECOND MODAL.
   *
   * Landing on a choice stage (1 = steel or plants, 2 = energy or heat) used to
   * answer the offer first and then raise the generic contextual-choice modal
   * for the reward — a second surface over the workspace that owns the track.
   * The offer's confirm now opens the workspace's OWN reward step and both
   * halves submit as ONE batch.
   */
  describe('a landing that asks for a reward', () => {
    it('knows the stage asks, and takes the player to the reward STEP', () => {
      const w = mountSection(CHOICE_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.bonusNeedsReward).is.true;
      vm.answerBonus(true);
      // Nothing submitted yet — the question is still open, inside the workspace.
      expect(w.emitted('bonus-answer')).is.undefined;
      expect(hydroFlowState.step).to.eq('reward');
      expect(vm.sceneKey).to.eq('choice');
      w.unmount();
    });

    it('submits the offer AND the reward as one batch, with the CHOSEN reward\'s transfers', () => {
      const w = mountSection(CHOICE_OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      hydroNetworkState.rewardChoice = 1; // 2 plants (index 1 of position 1)
      vm.confirmChoiceStep();
      const p = w.emitted('bonus-answer')?.[0][0] as {
        take: boolean, index: number, rewardChoice: number,
        rewards: ReadonlyArray<{channel: string, resource: string, amount: number}>,
      };
      expect(p.take).is.true;
      expect(p.index).to.eq(CHOICE_OFFER.advanceIndex);
      expect(p.rewardChoice).to.eq(1);
      // The transfers follow the PICK, not the first option.
      expect(p.rewards).to.have.length(1);
      expect(p.rewards[0].channel).to.eq('stock');
      expect(p.rewards[0].amount).to.eq(2);
      w.unmount();
    });

    it('a stage with ONE reward submits straight away', () => {
      // Position 3 pays +2 M€ production — nothing to choose.
      const w = mountSection({...OFFER, fromPosition: 2, toPosition: 3});
      const vm = w.vm as unknown as Vm;
      expect(vm.bonusNeedsReward).is.false;
      vm.answerBonus(true);
      const p = w.emitted('bonus-answer')?.[0][0] as {index: number, rewardChoice: number | undefined};
      expect(p.index).to.eq(0);
      expect(p.rewardChoice).is.undefined;
      w.unmount();
    });
  });

  /**
   * THE CURSOR WALKS THE LAYOUT IT SEES — a horizontal pair of answers with the
   * source card beside them. An edge HOLDS: a decision's cursor that wraps
   * turns «Пропустить» into whatever is one press past «Продвинуться».
   */
  describe('the cursor', () => {
    it('steps between the two answers on BOTH axes', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.sceneFocus).to.eq('bonus-confirm');
      vm.handleIntent({kind: 'nav', dir: 'right'});
      expect(vm.sceneFocus).to.eq('bonus-skip');
      vm.handleIntent({kind: 'nav', dir: 'left'});
      expect(vm.sceneFocus).to.eq('bonus-confirm');
      vm.handleIntent({kind: 'nav', dir: 'down'});
      expect(vm.sceneFocus).to.eq('bonus-skip');
      vm.handleIntent({kind: 'nav', dir: 'up'});
      expect(vm.sceneFocus).to.eq('bonus-confirm');
      w.unmount();
    });

    it('reaches the SOURCE and comes back', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      vm.handleIntent({kind: 'nav', dir: 'up'});
      expect(vm.sceneFocus).to.eq('bonus-source');
      vm.handleIntent({kind: 'nav', dir: 'down'});
      expect(vm.sceneFocus).to.eq('bonus-confirm');
      w.unmount();
    });

    it('HOLDS at the far edge — never wraps onto the other answer', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      vm.handleIntent({kind: 'nav', dir: 'right'});
      expect(vm.sceneFocus).to.eq('bonus-skip');
      vm.handleIntent({kind: 'nav', dir: 'right'});
      vm.handleIntent({kind: 'nav', dir: 'down'});
      expect(vm.sceneFocus, 'the refusal is the last stop').to.eq('bonus-skip');
      w.unmount();
    });
  });

  describe('the command bar', () => {
    it('advertises exactly the verbs the zone offers', () => {
      const w = mountSection(OFFER);
      const controls = (w.vm as unknown as Vm).footCommands.map((c) => c.control);
      expect(controls).to.have.members(['dpad', 'confirm', 'secondary', 'back']);
      w.unmount();
    });

    it('the confirm label FOLLOWS the cursor — never a stale hint', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      const labelOf = () => vm.footCommands.find((c) => c.control === 'confirm')?.label;
      expect(labelOf()).to.eq('Advance for free');
      vm.sceneFocus = 'bonus-skip';
      expect(labelOf()).to.eq('Skip');
      w.unmount();
    });

    it('the paid offer states its price on the CTA', () => {
      const w = mountSection({...OFFER, energyCost: 1, waivesTag: true});
      expect((w.vm as unknown as Vm).footCommands.find((c) => c.control === 'confirm')?.label)
        .to.eq('Spend 1 energy and advance');
      w.unmount();
    });

    // A bar that EMPTIES mid-press reads as the surface having gone away.
    it('disables its ANSWERS while one is in flight, never removes them', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      const cmds = vm.footCommands;
      expect(cmds.map((c) => c.control)).to.have.members(['dpad', 'confirm', 'secondary', 'back']);
      for (const control of ['confirm', 'secondary']) {
        expect(cmds.find((c) => c.control === control)?.enabled, control).is.false;
      }
      // …and COLLAPSE survives it: parking a submitted answer is harmless, and
      // the flow comes back to its own result.
      expect(cmds.find((c) => c.control === 'back')?.enabled, 'back').to.not.eq(false);
      w.unmount();
    });
  });
});
