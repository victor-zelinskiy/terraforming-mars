import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {CardName} from '@/common/cards/CardName';
import type {DeltaAdvanceOffer, DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import {resetHydroFlow} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';

/**
 * A HYDRONETWORK MOVE ENTERED FROM A CARD ACTION (Storm Surge Barrier).
 *
 * The SECOND provenance of the offer the workspace already presents, and these
 * exercise exactly what makes it a different DECISION rather than a different
 * scene: nothing is on the wire, so there is no refusal to offer and B is one
 * logical level back onto the card's variant selector; the confirm carries the
 * SERVER's own price and route; a second press cannot exist; and the screen may
 * never call the player «busy» inside the very workspace their own action sent
 * them to, nor report the generation's own advance as spent over a move that
 * does not spend it.
 */
const CARD_OFFER: DeltaAdvanceOffer = {
  source: CardName.STORM_SURGE_BARRIER,
  steps: 1,
  fromPosition: 2,
  toPosition: 3,
  energyCost: 1,
  waivesTag: false,
};

/** A STANDING server prompt — the other provenance, for the precedence test. */
const PROMPT_OFFER: DeltaBonusPromptMeta = {
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
  offerOrigin: string | undefined,
  advanceOffer: DeltaAdvanceOffer | undefined,
  bonusSkipOffered: boolean,
  bonusSubmitting: boolean,
  bonusAnswerable: boolean,
  bonusCostLine: {before: number, after: number, delta: number} | undefined,
  crumbStage: string,
  backVerb: string,
  backLabel: string | undefined,
  statusKind: string,
  statusLabel: string,
  turnState: string,
  footCommands: ReadonlyArray<{control: string, label: string}>,
  answerBonus(take: boolean): void,
  confirmChoiceStep(): void,
  navBonus(dir: string): void,
  rewardChoice: number | undefined,
  model: {usedThisGeneration: boolean},
};

function viewerPlayer() {
  return {
    color: 'red',
    steel: 1, plants: 2, titanium: 0, energy: 3, heat: 0, megacredits: 10,
    megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0,
    plantProduction: 0, energyProduction: 1, heatProduction: 0,
    tags: {},
    tableau: [{name: 'Birds', resources: 3}],
    deltaProject: {position: 2, stops: []},
  };
}

function mountSection(opts: {
  cardOffer?: DeltaAdvanceOffer,
  bonusOffer?: DeltaBonusPromptMeta,
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
      bonusOffer: opts.bonusOffer,
      cardOffer: opts.cardOffer,
      // The shell's own rule: `ownsPrompt` is the RAW server prompt. A card
      // entry has none — that is the whole point.
      ownsPrompt: opts.bonusOffer !== undefined,
    },
    global: {stubs: {ConsoleWsHead: true, ConsoleCardFaceLite: true, ConsoleSourceDock: true, ConsolePlayedTargetStep: true, GamepadGlyph: true, HydroReward: true}},
  });
}

/** The SERVER's own track preview — the shape the plan panel reads. */
function seatPreview(overrides: {usedThisGeneration?: boolean} = {}): void {
  hydroNetworkState.previewColor = 'red' as never;
  hydroNetworkState.preview = {
    currentPosition: 2,
    availableEnergy: 3,
    usedThisGeneration: overrides.usedThisGeneration ?? false,
    atEndOfTrack: false,
    maxLegalSteps: 9,
    maxEnergySteps: 3,
    maxPreviewSteps: 9,
    reuseActionCards: [],
    animalTargetCards: [],
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

/** The ACTION MENU — what the server is really waiting on while the whole
 *  card-entry step is a client draft. */
const ACTION_MENU = {type: 'or', title: 'Take your first action', options: []};

describe('the Hydronetwork card-action entry', () => {
  afterEach(() => {
    resetHydroFlow(); // module state is bundle-shared — never leak the flow
    hydroNetworkState.rewardChoice = undefined;
    hydroNetworkState.selectedPosition = -1;
    hydroNetworkState.selectedCard = undefined;
    hydroNetworkState.preview = undefined;
    hydroNetworkState.previewColor = undefined;
    consoleHydroUi.repeatResult = undefined;
  });

  it('OWNS the working zone, through the same scene a server offer uses', () => {
    const w = mountSection({cardOffer: CARD_OFFER});
    const vm = w.vm as unknown as Vm;
    expect(vm.sceneKey).to.eq('bonus');
    expect(vm.offerOrigin).to.eq('card-entry');
    expect(vm.advanceOffer).to.deep.eq(CARD_OFFER);
    w.unmount();
  });

  it('states the SERVER price as a «сейчас → станет» row, never as arithmetic', () => {
    const w = mountSection({cardOffer: CARD_OFFER});
    expect((w.vm as unknown as Vm).bonusCostLine).to.include({before: 3, after: 2, delta: -1});
    w.unmount();
  });

  it('offers NO refusal — B is the way out of a move nobody demanded', () => {
    const w = mountSection({cardOffer: CARD_OFFER});
    const vm = w.vm as unknown as Vm;
    expect(vm.bonusSkipOffered).is.false;
    expect(w.findAll('.con-hydro__bonus-action')).to.have.length(1);
    expect(w.findAll('.con-hydro__bonus-action--decline')).to.have.length(0);
    // …and a stray press on the button that is not there answers nothing.
    vm.answerBonus(false);
    expect(w.emitted('card-advance')).is.undefined;
    expect(w.emitted('bonus-answer')).is.undefined;
    w.unmount();
  });

  it('never lands the cursor on the refusal that does not exist', () => {
    const w = mountSection({cardOffer: CARD_OFFER});
    const vm = w.vm as unknown as Vm;
    vm.sceneFocus = 'bonus-confirm';
    vm.navBonus('right');
    expect(vm.sceneFocus).to.eq('bonus-confirm');
    vm.navBonus('down');
    expect(vm.sceneFocus).to.eq('bonus-confirm');
    w.unmount();
  });

  it('B is ONE logical level back onto the card variant', () => {
    const w = mountSection({cardOffer: CARD_OFFER, waitingFor: ACTION_MENU});
    const vm = w.vm as unknown as Vm;
    expect(vm.backVerb).to.eq('close'); // the stack pops the frame
    expect(vm.backLabel).to.eq('Back to the action');
    expect(vm.footCommands.find((c) => c.control === 'back')?.label).to.eq('Back to the action');
    w.unmount();
  });

  it('the zone never titles itself — the stage name goes UP to the crumb', () => {
    const w = mountSection({cardOffer: CARD_OFFER});
    // The tail names the SUBDIVISION the player walked into, not the act (the
    // act is what the CTA says): «ДЕЙСТВИЯ КАРТ › <карта> › ГИДРОСЕТЬ».
    expect((w.vm as unknown as Vm).crumbStage).to.eq('Hydronetwork');
    expect(w.text()).to.not.contain('Extra advance');
    w.unmount();
  });

  it('never calls the player busy inside the screen their own action opened', () => {
    seatPreview();
    const w = mountSection({cardOffer: CARD_OFFER, waitingFor: ACTION_MENU});
    const vm = w.vm as unknown as Vm;
    expect(vm.turnState).to.eq('action-menu');
    expect(vm.statusLabel).to.not.eq('Finish your current action first');
    w.unmount();
  });

  it('never reports the generation own advance as spent over a move that does not spend it', () => {
    seatPreview({usedThisGeneration: true});
    const w = mountSection({cardOffer: CARD_OFFER, waitingFor: ACTION_MENU});
    const vm = w.vm as unknown as Vm;
    expect(vm.model.usedThisGeneration).is.true;
    expect(vm.statusKind).to.eq('offer');
    expect(vm.statusLabel).to.eq('Extra advance offered');
    w.unmount();
  });

  it('confirming emits the card move with the SERVER route and price', () => {
    seatPreview();
    const w = mountSection({cardOffer: CARD_OFFER, waitingFor: ACTION_MENU});
    (w.vm as unknown as Vm).answerBonus(true);
    const events = w.emitted('card-advance');
    expect(events, 'the card move must be emitted').is.not.undefined;
    expect(events).to.have.length(1);
    const payload = (events as Array<Array<Record<string, unknown>>>)[0][0];
    expect(payload).to.include({
      steps: 1, fromPosition: 2, toPosition: 3, spend: 1, rewardChoice: undefined,
    });
    // …and never the STANDING-prompt answer, which carries an option index.
    expect(w.emitted('bonus-answer')).is.undefined;
    expect(w.emitted('confirm')).is.undefined;
    w.unmount();
  });

  it('a second press cannot exist', () => {
    seatPreview();
    const w = mountSection({cardOffer: CARD_OFFER, waitingFor: ACTION_MENU});
    const vm = w.vm as unknown as Vm;
    vm.answerBonus(true);
    expect(vm.bonusSubmitting).is.true;
    expect(vm.bonusAnswerable).is.false;
    vm.answerBonus(true);
    expect(w.emitted('card-advance')).to.have.length(1);
    w.unmount();
  });

  it('a landing stage that asks for a reward commits the CARD move from its step', () => {
    seatPreview();
    // Position 0 → 1: the steel-or-plants choice stage.
    const w = mountSection({cardOffer: {...CARD_OFFER, fromPosition: 0, toPosition: 1}, waitingFor: ACTION_MENU});
    const vm = w.vm as unknown as Vm;
    vm.answerBonus(true);
    // The confirm ROUTES INTO the reward step instead of committing.
    expect(w.emitted('card-advance')).is.undefined;
    expect(vm.sceneKey).to.eq('choice');
    hydroNetworkState.rewardChoice = 1;
    vm.confirmChoiceStep();
    const events = w.emitted('card-advance');
    expect(events).to.have.length(1);
    expect((events as Array<Array<Record<string, unknown>>>)[0][0].rewardChoice).to.eq(1);
    w.unmount();
  });

  it('a STANDING server prompt outranks a card draft', () => {
    const w = mountSection({cardOffer: CARD_OFFER, bonusOffer: PROMPT_OFFER});
    const vm = w.vm as unknown as Vm;
    expect(vm.offerOrigin).to.eq('prompt');
    expect(vm.advanceOffer?.source).to.eq(CardName.DYNAMIC_OCEAN_BARRIER);
    expect(vm.bonusSkipOffered).is.true;
    w.unmount();
  });
});
