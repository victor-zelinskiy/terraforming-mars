import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {CardName} from '@/common/cards/CardName';
import type {DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import {resetHydroFlow, beginHydroCommit, hydroFlowState} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';

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
  bonusCostLine: {before: number, after: number, delta: number} | undefined,
  bonusGainPresent: boolean,
  bonusShowsFacts: boolean,
  bonusRewardOptions: ReadonlyArray<unknown>,
  bonusRewardView: {lines: ReadonlyArray<{delta: number}>},
  bonusNeedsCard: boolean,
  bonusPickMissing: boolean,
  pickKind: string | undefined,
  pickFizzled: boolean,
  planPickOffered: boolean,
  pickVerbKey: string,
  summaryPresent: boolean,
  pickWarned: boolean,
  pickWarningKey: string,
  model: {selectedCard: string | undefined, needsCardSelect: string | undefined, mustSelectCard: boolean},
  openBonusPick(): void,
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
    // A real animal host, so the pos-9 target step has something to offer —
    // the step builds its owners from the TABLEAU, not from the eligibility
    // list alone (a name with no card on the table is dropped, never invented).
    tableau: [{name: 'Birds', resources: 3}],
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
/** Position 7 — «Микробная рекультивация»: repeat a used blue action. */
const REPEAT_OFFER: DeltaBonusPromptMeta = {...OFFER, fromPosition: 6, toPosition: 7};
/** Position 9 — «Ареалы видов»: 2 animals onto a card of your choice. */
const ANIMAL_OFFER: DeltaBonusPromptMeta = {...OFFER, fromPosition: 8, toPosition: 9};

/** The SERVER's eligibility lists live on the track preview — the same shape
 *  the plan panel reads, so seating one is what makes the offer's landing stage
 *  answerable by the very machinery the ordinary advance uses. */
function seatPreview(opts: {reuse?: ReadonlyArray<string>, animals?: ReadonlyArray<string>}): void {
  hydroNetworkState.previewColor = 'red' as never;
  hydroNetworkState.preview = {
    currentPosition: 2,
    availableEnergy: 9,
    usedThisGeneration: false,
    atEndOfTrack: false,
    maxLegalSteps: 9,
    maxEnergySteps: 9,
    maxPreviewSteps: 9,
    reuseActionCards: opts.reuse ?? [],
    animalTargetCards: opts.animals ?? [],
    destinations: Array.from({length: 9}, (_, i) => ({
      steps: i + 1,
      position: i + 3,
      legal: true,
      affordable: true,
      energyDeficit: 0,
      occupied: false,
      jumpedOverVp2: false,
      requiredTags: [],
      wildCoveredTags: [],
      missingTags: [],
    })),
  } as never;
}

/** A prompt that is NOT this workspace's — the wheel-entry case. */
const FOREIGN_PROMPT = {type: 'card', title: 'Discard a card'};

describe('the Hydronetwork bonus zone', () => {
  afterEach(() => {
    resetHydroFlow(); // module state is bundle-shared — never leak the flow
    hydroNetworkState.rewardChoice = undefined;
    hydroNetworkState.selectedPosition = -1;
    hydroNetworkState.selectedCard = undefined;
    hydroNetworkState.preview = undefined;
    hydroNetworkState.previewColor = undefined;
    consoleHydroUi.repeatResult = undefined;
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

  /**
   * ══ THE MOVE IS READ THE WAY AN ORDINARY ADVANCE IS ══════════════════
   *
   * The plan panel states an advance as «сейчас → станет» per pool. The bonus
   * zone used to state its price as a bare «−1 ⚡» chip and its reward not at
   * all — the player had to do arithmetic against their own rail.
   */
  describe('the facts', () => {
    it('states the PRICE as a before → after line against the live stock', () => {
      const w = mountSection({...OFFER, energyCost: 1, waivesTag: true});
      const vm = w.vm as unknown as Vm;
      // The viewer holds 3 energy (see `viewerPlayer`).
      expect(vm.bonusCostLine).to.include({before: 3, after: 2, delta: -1});
      expect(vm.bonusShowsFacts).is.true;
      w.unmount();
    });

    it('a FREE step has no price line at all — never a «−0»', () => {
      const w = mountSection(OFFER);
      expect((w.vm as unknown as Vm).bonusCostLine).is.undefined;
      w.unmount();
    });

    it('states what the landing stage PAYS, in the same delta grammar', () => {
      // Position 3 pays +2 M€ production.
      const w = mountSection({...OFFER, fromPosition: 2, toPosition: 3});
      const vm = w.vm as unknown as Vm;
      expect(vm.bonusGainPresent).is.true;
      expect(vm.bonusRewardView.lines).to.have.length(1);
      expect(vm.bonusRewardView.lines[0].delta).to.eq(2);
      w.unmount();
    });

    it('a stage that ASKS which reward offers both alternatives instead', () => {
      const w = mountSection(CHOICE_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.bonusNeedsReward).is.true;
      expect(vm.bonusRewardOptions).to.have.length(2);
      expect(vm.bonusGainPresent).is.true;
      w.unmount();
    });
  });

  /**
   * ══ THE LANDED STAGE'S PICK IS MADE **HERE** ════════════════════════
   *
   * Positions 7 and 9 defer a SelectCard. Reached through a card's offer the
   * workspace used to pre-collect nothing, so the pick arrived AFTER the commit
   * as the generic card browser — a standalone legacy surface over the very
   * workspace that had just asked the question.
   *
   * The fix is not a second implementation: an offer SEATS the plan on its own
   * destination, so `model.needsCardSelect`, the eligibility list, the repeat
   * browser bridge and the embedded target step all describe the landing stage
   * exactly as they do for the player's own advance.
   */
  describe('the landed stage\'s pre-select', () => {
    it('SEATS the plan on the offer\'s destination, so the landing stage is what is configured', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      expect(hydroNetworkState.selectedPosition, 'the plan follows the offer').to.eq(7);
      expect((w.vm as unknown as Vm).model.needsCardSelect).to.eq('reuse-action');
      w.unmount();
    });

    it('pos 7 asks for the action, and A on the row opens the SAME repeat bridge', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.bonusNeedsCard).is.true;
      expect(vm.bonusPickMissing).is.true;
      vm.openBonusPick();
      // `pick` is the shell's `openHydroRepeatPick` — the ordinary advance's
      // own door, not a bonus-only one.
      expect(w.emitted('pick')).to.have.length(1);
      w.unmount();
    });

    it('pos 9 asks for the target card, and A on the row opens the SAME step', () => {
      seatPreview({animals: ['Birds']});
      const w = mountSection(ANIMAL_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.bonusNeedsCard).is.true;
      expect(vm.model.needsCardSelect).to.eq('animal-target');
      vm.openBonusPick();
      expect(hydroFlowState.step, 'the embedded target step').to.eq('target');
      expect(vm.sceneKey).to.eq('target');
      w.unmount();
    });

    it('a stage with NO candidates asks nothing — the reward simply fizzles', () => {
      seatPreview({reuse: []});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.bonusNeedsCard).is.false;
      expect(vm.bonusPickMissing).is.false;
      w.unmount();
    });

    /** THE WHOLE POINT: the pick rides the SAME batch, so the server never asks
     *  again — no post-commit browser. */
    it('carries the pick in the answer, so nothing is asked after the commit', async () => {
      seatPreview({animals: ['Birds']});
      const w = mountSection(ANIMAL_OFFER);
      const vm = w.vm as unknown as Vm;
      // The pick is made from INSIDE the standing workspace — which is also why
      // a fresh mount is free to drop a stale plan draft (`resetHydroPlan`)
      // without ever touching a choice the player just made here.
      hydroNetworkState.selectedCard = 'Birds' as never;
      await w.vm.$nextTick();
      expect(vm.bonusPickMissing).is.false;
      vm.answerBonus(true);
      const p = w.emitted('bonus-answer')?.[0][0] as {selectedCard?: string};
      expect(p.selectedCard).to.eq('Birds');
      w.unmount();
    });
  });

  /**
   * ══ THE CURSOR STARTS ON THE ACT, AND THE BAR NAMES IT ════════════════
   *
   * The pre-select is the thing the player must do first, so seating them on
   * the confirm made their first press a warning and the affordance they needed
   * a hunt — while the ONE command bar went on advertising «Продвинуться» over
   * a cursor that was standing somewhere else entirely.
   */
  describe('the cursor and the bar follow the act', () => {
    it('starts ON the pick row while the question stands', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      expect((w.vm as unknown as Vm).sceneFocus).to.eq('bonus-pick');
      w.unmount();
    });

    /**
     * THE SEAT IS OWED, NOT DECIDED AT SETUP.
     *
     * «Does this stage owe a pick?» is answered by the track PREVIEW, which is
     * fetched in `mounted()` — so at setup the answer is always «no». Decided
     * there, the cursor parked on «Продвинуться» (which cannot fire) beside a
     * pre-select row nobody was pointed at, and never moved again.
     */
    it('REGRESSION: places the seat when the PREVIEW lands, not at setup', async () => {
      // Mount with NO preview — exactly the real open, where the fetch is still
      // in flight and the model cannot yet answer.
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.pickKind, 'nothing can be known yet').to.eq(undefined);

      seatPreview({reuse: ['Ironworks']});
      await w.vm.$nextTick();
      expect(vm.pickKind).to.eq('reuse-action');
      expect(vm.sceneFocus, 'the owed seat is placed by the frame that can answer').to.eq('bonus-pick');

      // …and the SCREEN agrees, which is the whole report: the confirm wore the
      // focus ring AND an «A» beside the row's own, so two buttons claimed one
      // press over a pre-select nobody was pointed at.
      const confirm = w.findAll('.con-hydro__bonus-action')[0];
      expect(confirm.classes(), 'the confirm is not focused').to.not.contain('con-hydro__bonus-action--focused');
      expect(confirm.classes(), 'nor the primary CTA').to.not.contain('con-hydro__bonus-action--primary');
      const glyphs = w.findAllComponents({name: 'GamepadGlyph'})
        .filter((g) => g.props('control') === 'confirm').length;
      expect(glyphs, 'exactly one «A» on screen').to.eq(1);
      w.unmount();
    });

    /** …and it is a ONE-SHOT: a seat placed once never fights the player. */
    it('never re-seats after the player has moved', async () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      vm.sceneFocus = 'bonus-skip';
      seatPreview({reuse: ['Ironworks', 'Viron']});
      await w.vm.$nextTick();
      expect(vm.sceneFocus).to.eq('bonus-skip');
      w.unmount();
    });

    it('starts on the CONFIRM when nothing is owed', () => {
      const w = mountSection(OFFER);
      expect((w.vm as unknown as Vm).sceneFocus).to.eq('bonus-confirm');
      w.unmount();
    });

    it('…and on the CONFIRM when there is physically nothing to choose', () => {
      seatPreview({reuse: []});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.pickFizzled).is.true;
      expect(vm.sceneFocus).to.eq('bonus-confirm');
      w.unmount();
    });

    it('HANDS THE CURSOR ON to the confirm once the pick is made', async () => {
      seatPreview({animals: ['Birds']});
      const w = mountSection(ANIMAL_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.sceneFocus).to.eq('bonus-pick');
      hydroNetworkState.selectedCard = 'Birds' as never;
      await w.vm.$nextTick();
      expect(vm.sceneFocus).to.eq('bonus-confirm');
      w.unmount();
    });

    it('the bar names the ROW\'s verb while the cursor is on it', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      const labelOf = () => vm.footCommands.find((c) => c.control === 'confirm')?.label;
      expect(vm.sceneFocus).to.eq('bonus-pick');
      expect(labelOf(), 'never «Продвинуться» over the pre-select').to.eq('Choose an action');
      vm.sceneFocus = 'bonus-confirm';
      expect(labelOf()).to.eq('Advance');
      vm.sceneFocus = 'bonus-source';
      expect(labelOf()).to.eq('Inspect');
      w.unmount();
    });

    it('…and says CHANGE once something is chosen', async () => {
      seatPreview({animals: ['Birds']});
      const w = mountSection(ANIMAL_OFFER);
      const vm = w.vm as unknown as Vm;
      hydroNetworkState.selectedCard = 'Birds' as never;
      await w.vm.$nextTick();
      vm.sceneFocus = 'bonus-pick';
      expect(vm.footCommands.find((c) => c.control === 'confirm')?.label).to.eq('Change the card');
      w.unmount();
    });
  });

  /**
   * ══ NO MOVE, NO PRE-SELECT ════════════════════════════════
   *
   * On the PLAN layer a stage is only worth configuring if the player can reach
   * it. Offering «Выберите действие» for a stage whose path tag is missing
   * invites a decision that can never be used.
   */
  describe('a plan the rules refuse', () => {
    /** The viewer stands at 2 with NO tags at all — position 7 is unreachable. */
    function blockedPreview(): void {
      seatPreview({reuse: ['Ironworks']});
      const p = hydroNetworkState.preview as unknown as {destinations: Array<Record<string, unknown>>};
      for (const d of p.destinations) {
        d.legal = false;
        d.missingTags = ['microbe'];
      }
    }

    it('offers no pre-select for a stage the rules refuse', async () => {
      const w = mountSection(undefined, {ownsPrompt: false});
      blockedPreview();
      hydroNetworkState.selectedPosition = 7;
      await w.vm.$nextTick();
      const vm = w.vm as unknown as Vm;
      expect(vm.pickKind, 'the stage still ASKS for a pick').to.eq('reuse-action');
      expect(vm.planPickOffered, 'but there is no move to configure').is.false;
      expect(w.find('.con-hydro__pickrow').exists(), 'so the row is not there').is.false;
      // …and nothing nags about a choice that cannot matter.
      expect(vm.pickWarned).is.false;
      w.unmount();
    });

    it('…and offers it again the moment the stage is reachable', async () => {
      const w = mountSection(undefined, {ownsPrompt: false});
      seatPreview({reuse: ['Ironworks']});
      hydroNetworkState.selectedPosition = 7;
      await w.vm.$nextTick();
      const vm = w.vm as unknown as Vm;
      expect(vm.planPickOffered).is.true;
      expect(w.find('.con-hydro__pickrow').exists()).is.true;
      w.unmount();
    });
  });

  /**
   * ══ ONE ACT, ONE CTA, ONE «A» ════════════════════════════════
   *
   * While the landed stage's pick is owed, «Продвинуться» cannot fire — so it
   * must not wear the primary tint, and it must not claim the press. Both the
   * row and the confirm drew an «A», so two buttons advertised the same button.
   */
  describe('the confirm while a pick is owed', () => {
    it('is NOT the primary CTA', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const confirm = w.findAll('.con-hydro__bonus-action')[0];
      expect(confirm.classes(), 'no primary tint over a confirm that cannot fire')
        .to.not.contain('con-hydro__bonus-action--primary');
      expect(confirm.classes()).to.contain('con-hydro__bonus-action--pending');
      w.unmount();
    });

    it('…and IS the primary CTA once the pick is made', async () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      hydroNetworkState.selectedCard = 'Ironworks' as never;
      await w.vm.$nextTick();
      const confirm = w.findAll('.con-hydro__bonus-action')[0];
      expect(confirm.classes()).to.contain('con-hydro__bonus-action--primary');
      expect(confirm.classes()).to.not.contain('con-hydro__bonus-action--pending');
      w.unmount();
    });

    /** THE ONE «A» ON SCREEN follows the cursor — the quick wheel's own rule. */
    it('exactly ONE affordance wears the confirm glyph', async () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      const glyphs = () => w.findAllComponents({name: 'GamepadGlyph'})
        .filter((g) => g.props('control') === 'confirm').length;
      expect(vm.sceneFocus).to.eq('bonus-pick');
      expect(glyphs(), 'on the row, and nowhere else').to.eq(1);

      vm.sceneFocus = 'bonus-confirm';
      await w.vm.$nextTick();
      expect(glyphs(), 'on the confirm, and nowhere else').to.eq(1);
      w.unmount();
    });
  });

  /**
   * ══ A DEAD END IS NOT AN INSTRUCTION ═══════════════════════════
   *
   * With no candidate the reward simply fizzles. Telling the player to «выберите
   * действие» there is an instruction they cannot follow.
   */
  describe('a stage with nothing to choose', () => {
    it('states the fizzle instead of a press, and never warns', () => {
      seatPreview({reuse: []});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      expect(vm.pickKind, 'the stage still ASKS — it just has no candidate').to.eq('reuse-action');
      expect(vm.pickFizzled).is.true;
      expect(vm.bonusNeedsCard, 'nothing is owed').is.false;
      expect(vm.bonusPickMissing).is.false;
      // The confirm goes straight through — no gate, no warning.
      vm.answerBonus(true);
      expect(w.emitted('bonus-answer')).to.have.length(1);
      expect(vm.pickWarned).is.false;
      w.unmount();
    });

    it('the row says so in words the player can act on', () => {
      seatPreview({animals: []});
      const w = mountSection(ANIMAL_OFFER);
      const row = w.find('.con-hydro__pickrow');
      expect(row.exists()).is.true;
      expect(row.classes()).to.contain('con-hydro__pickrow--fizzled');
      expect(row.text()).to.not.match(/Сначала|first/i);
      w.unmount();
    });
  });

  /**
   * ══ THE OMISSION IS NAMED, AND COSTS AN EXPLICIT SECOND PRESS ══════════
   *
   * The pos 7/9 pick is MANDATORY (`hydroNetworkModel`: the reward cannot be
   * skipped), so a confirm that ignores it forfeits nothing — it only postpones
   * the question into a surface nobody chose. The gate is therefore a warning,
   * never a bypass.
   */
  describe('the missing-pick gate', () => {
    it('the first confirm WARNS and submits nothing', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      expect(w.emitted('bonus-answer'), 'nothing was submitted').is.undefined;
      expect(vm.pickWarned).is.true;
      // …and it NAMES what is missing, never a bare «нельзя».
      expect(vm.pickWarningKey).to.match(/action to repeat/i);
      // …and it points the cursor AT the thing to do next.
      expect(vm.sceneFocus).to.eq('bonus-pick');
      w.unmount();
    });

    it('the SECOND press goes and answers it', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      vm.handleIntent({kind: 'press', button: 'confirm'});
      expect(w.emitted('pick'), 'the second press opens the pre-select').to.have.length(1);
      w.unmount();
    });

    it('names the ANIMAL target when that is what is missing', () => {
      seatPreview({animals: ['Birds']});
      const w = mountSection(ANIMAL_OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      expect(vm.pickWarningKey).to.match(/animals/i);
      w.unmount();
    });

    /** The warning describes a STATE, so it dies with the state it named. */
    it('clears itself the moment the pick is made', async () => {
      seatPreview({animals: ['Birds']});
      const w = mountSection(ANIMAL_OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      expect(vm.pickWarned).is.true;
      hydroNetworkState.selectedCard = 'Birds' as never;
      await w.vm.$nextTick();
      expect(vm.pickWarned).is.false;
      expect(vm.bonusPickMissing).is.false;
      w.unmount();
    });

    /**
     * THE WARNING'S SLOT IS ALWAYS IN LAYOUT.
     *
     * The gate fires on the press the player aimed AT the confirm, so a warning
     * that grew the column would move that very button out from under their
     * thumb. The line is therefore always rendered and only its CONTENT
     * changes — the reserved-line idiom this workspace already uses for the
     * route notes.
     */
    it('reserves its line: arming changes CONTENT, never the node count', async () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      const vm = w.vm as unknown as Vm;
      const slot = () => w.findAll('.con-hydro__pickwarn');
      const before = slot().length;
      expect(before, 'the slot exists before there is anything to say').to.be.greaterThan(0);
      expect(slot()[0].text(), 'and it says nothing yet').to.eq('');

      vm.answerBonus(true);
      await w.vm.$nextTick();
      expect(slot().length, 'the same number of nodes').to.eq(before);
      expect(slot()[0].classes()).to.contain('con-hydro__pickwarn--on');
      expect(slot()[0].text(), 'now it names the omission').to.not.eq('');
      w.unmount();
    });

    /** A SKIP is a whole answer — it is not missing anything. */
    it('never gates the refusal', () => {
      seatPreview({reuse: ['Ironworks']});
      const w = mountSection(REPEAT_OFFER);
      (w.vm as unknown as Vm).answerBonus(false);
      expect(w.emitted('bonus-answer')?.[0][0]).to.include({take: false});
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
      expect(labelOf()).to.eq('Advance');
      vm.sceneFocus = 'bonus-skip';
      expect(labelOf()).to.eq('Skip');
      w.unmount();
    });

    /**
     * THE BAR CARRIES A VERB, NOT A PRICE. «Потратить 1 энергию и
     * продвинуться» pushed «X Осмотреть» and «B Свернуть» off the bar and
     * still truncated. The cost is a workspace fact (see the facts row).
     */
    it('REGRESSION: the paid offer does NOT put its price on the CTA', () => {
      const w = mountSection({...OFFER, energyCost: 1, waivesTag: true});
      const label = (w.vm as unknown as Vm).footCommands.find((c) => c.control === 'confirm')?.label;
      expect(label).to.eq('Advance');
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
