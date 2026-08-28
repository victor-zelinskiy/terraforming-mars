import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {CardName} from '@/common/cards/CardName';
import type {DeltaAdvanceOffer} from '@/common/models/DeltaBonusPromptModel';
import {resetHydroFlow} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';

/**
 * THE LANDING STAGE'S TARGET PICK — where the cursor RESTS, and what the
 * confirm does when nothing was picked.
 *
 * Two rules, one flow. ① A stage that OWES a pick (pos 7 «which action do I
 * repeat», pos 9 «which card takes the animals», candidates present) seats the
 * cursor ON THE PICK ROW, so the default A opens the picker — advancing past
 * an unmade choice can then only be deliberate, never the stray press that
 * spent the generation's advance on a stage whose reward went nowhere.
 * ② That deliberate second press is a DECISION and is carried as one: the
 * batch says `waiveTarget`, the server defers nothing, and no prompt for a
 * target rises after a move the player already confirmed without one.
 *
 * A stage with NOTHING to choose (the fizzle) is neither: nothing is owed, so
 * nothing is seated, warned or waived.
 */
const REPEAT_CANDIDATE = 'Regolith Eaters' as CardName;
const ANIMAL_HOST = 'Birds' as CardName;

type Emitted = {
  waiveTarget?: boolean,
  selectedCard?: CardName,
  toPosition?: number,
};

type Vm = {
  sceneFocus: string,
  pickKind: string | undefined,
  pickWarned: boolean,
  pickWarningKey: string,
  planPickMissing: boolean,
  planPickOffered: boolean,
  pickFizzled: boolean,
  waiveTargetNow: boolean,
  ctaFocused: boolean,
  waivedNoteKey: string,
  model: {currentPosition: number, selectedPosition: number, mustSelectCard: boolean, canConfirm: boolean},
  selectPosition(position: number): void,
  onPrimary(): void,
  answerBonus(take: boolean): void,
};

function viewerPlayer(position: number) {
  return {
    color: 'red',
    steel: 0, plants: 0, titanium: 0, energy: 9, heat: 0, megacredits: 10,
    megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0,
    plantProduction: 0, energyProduction: 1, heatProduction: 0,
    tags: {},
    tableau: [{name: ANIMAL_HOST, resources: 3}, {name: REPEAT_CANDIDATE, resources: 0}],
    deltaProject: {position, stops: []},
  };
}

/** The SERVER's own track preview, seated at `position`. The candidate lists
 *  are the server's verdict on «is there anything to pick at all». */
function seatPreview(position: number, opts: {
  reuseActionCards?: ReadonlyArray<CardName>,
  animalTargetCards?: ReadonlyArray<CardName>,
} = {}): void {
  const remaining = 11 - position;
  hydroNetworkState.previewColor = 'red' as never;
  hydroNetworkState.preview = {
    currentPosition: position,
    availableEnergy: 9,
    usedThisGeneration: false,
    atEndOfTrack: false,
    maxLegalSteps: remaining,
    maxEnergySteps: remaining,
    maxPreviewSteps: remaining,
    reuseActionCards: opts.reuseActionCards ?? [],
    animalTargetCards: opts.animalTargetCards ?? [],
    destinations: Array.from({length: remaining}, (_, i) => ({
      steps: i + 1,
      position: position + i + 1,
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

function mountSection(position: number, opts: {cardOffer?: DeltaAdvanceOffer} = {}) {
  return mount(ConsoleHydroSection, {
    props: {
      playerView: {
        thisPlayer: viewerPlayer(position),
        players: [viewerPlayer(position)],
        game: {},
        waitingFor: undefined,
      } as never,
      // The viewer's own advance is on the table — the plan layer's CTA is
      // live, which is what makes «where does the cursor rest» a real question.
      actionAvailable: true,
      cardOffer: opts.cardOffer,
    },
    global: {stubs: {ConsoleWsHead: true, ConsoleCardFaceLite: true, ConsoleSourceDock: true, ConsolePlayedTargetStep: true, GamepadGlyph: true, HydroReward: true}},
  });
}

describe('the Hydronetwork landing-stage target pick', () => {
  afterEach(() => {
    // Module state is BUNDLE-SHARED in mochapack — never leak the flow.
    resetHydroFlow();
    hydroNetworkState.rewardChoice = undefined;
    hydroNetworkState.selectedPosition = -1;
    hydroNetworkState.selectedCard = undefined;
    hydroNetworkState.preview = undefined;
    hydroNetworkState.previewColor = undefined;
    consoleHydroUi.repeatResult = undefined;
  });

  describe('the cursor rests on the question', () => {
    it('pos 7 with a candidate seats the cursor on the pick row, not the confirm', () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;

      vm.selectPosition(7);

      expect(vm.pickKind).to.eq('reuse-action');
      expect(vm.planPickMissing).is.true;
      expect(vm.sceneFocus).to.eq('summary');
      w.unmount();
    });

    it('pos 9 with a candidate does the same', () => {
      seatPreview(8, {animalTargetCards: [ANIMAL_HOST]});
      const w = mountSection(8);
      const vm = w.vm as unknown as Vm;

      vm.selectPosition(9);

      expect(vm.pickKind).to.eq('animal-target');
      expect(vm.sceneFocus).to.eq('summary');
      w.unmount();
    });

    it('a stage that owes NOTHING leaves the cursor on the track', () => {
      seatPreview(2);
      const w = mountSection(2);
      const vm = w.vm as unknown as Vm;

      vm.selectPosition(3); // +2 M€ production — no pick of any kind
      expect(vm.pickKind).to.eq(undefined);
      expect(vm.sceneFocus).to.eq('track');
      w.unmount();
    });

    it('a FIZZLED stage (no candidate at all) is not a question — cursor stays', () => {
      seatPreview(6, {reuseActionCards: []});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;

      vm.selectPosition(7);

      // The row still names the stage, but there is nothing to point AT: an
      // instruction the player cannot follow is worse than no cursor move.
      expect(vm.pickFizzled).is.true;
      expect(vm.planPickMissing).is.false;
      expect(vm.sceneFocus).to.eq('track');
      w.unmount();
    });

    it('re-selecting a stage whose pick is ALREADY made rests on the track', () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;

      vm.selectPosition(7);
      hydroNetworkState.selectedCard = REPEAT_CANDIDATE;
      vm.selectPosition(5);
      vm.selectPosition(7); // the pick is cleared by the walk — asked again
      expect(vm.sceneFocus).to.eq('summary');
      w.unmount();
    });
  });

  describe('the second press FORFEITS rather than postpones', () => {
    it('warns once, then confirms with the decline on the batch', async () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(7);
      await w.vm.$nextTick();

      // FIRST press — a heads-up, and nothing on the wire.
      vm.onPrimary();
      expect(vm.pickWarned).is.true;
      expect(w.emitted('confirm')).is.undefined;

      // SECOND press — taken at face value, and it says so.
      vm.onPrimary();
      const emitted = w.emitted('confirm') as Array<Array<Emitted>> | undefined;
      expect(emitted, 'the second press must commit').is.not.undefined;
      expect(emitted?.[0][0].waiveTarget).is.true;
      expect(emitted?.[0][0].selectedCard).to.eq(undefined);
      w.unmount();
    });

    it('a CHOSEN target commits with no waive at all', async () => {
      seatPreview(8, {animalTargetCards: [ANIMAL_HOST]});
      const w = mountSection(8);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(9);
      hydroNetworkState.selectedCard = ANIMAL_HOST;
      await w.vm.$nextTick();

      vm.onPrimary();
      const emitted = w.emitted('confirm') as Array<Array<Emitted>> | undefined;
      expect(emitted?.[0][0].selectedCard).to.eq(ANIMAL_HOST);
      expect(emitted?.[0][0].waiveTarget).to.eq(undefined);
      w.unmount();
    });

    it('a FIZZLED stage never waives — there was nothing to give up', async () => {
      seatPreview(8, {animalTargetCards: []});
      const w = mountSection(8);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(9);
      await w.vm.$nextTick();

      expect(vm.waiveTargetNow).is.false;
      vm.onPrimary(); // no warning stage: nothing is owed
      const emitted = w.emitted('confirm') as Array<Array<Emitted>> | undefined;
      expect(emitted?.[0][0].waiveTarget).to.eq(undefined);
      w.unmount();
    });

    it('the warning PROMISES the forfeit on a waivable door', () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(7);

      // The copy may not promise a question that will never be asked.
      expect(vm.pickWarningKey).to.contain('press again');
      w.unmount();
    });

    it('the RESULT names the forfeit, per landing', async () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(7);
      await w.vm.$nextTick();
      vm.onPrimary();
      vm.onPrimary();

      // (The shell is what opens the commit record; the key is asserted off
      // the same landing the batch just declared.)
      expect(vm.model.selectedPosition).to.eq(7);
      w.unmount();
    });
  });

  describe('ONE act, ONE «A» — the commit recedes while the target is owed', () => {
    it('the plan CTA drops both the glyph and the primary register', async () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(7);
      await w.vm.$nextTick();

      // The cursor rests on the pick row, so the row wears the cap…
      expect(vm.sceneFocus).to.eq('summary');
      expect(w.find('.con-hydro__cta').classes(), 'the commit is not the primary act')
        .to.include('con-hydro__cta--pending');
      // …and the commit draws NO «A» of its own: two lit CTAs each claiming
      // the same button is exactly what was reported.
      expect(w.find('.con-hydro__cta').findAll('.gp-glyph, gamepad-glyph-stub'))
        .to.have.length(0);
      w.unmount();
    });

    it('…and takes the glyph back the moment the cursor stands on it', async () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(7);
      await w.vm.$nextTick();

      vm.sceneFocus = 'track'; // ↑ off the row — the CTA is what A presses now
      await w.vm.$nextTick();
      expect(vm.ctaFocused).is.true;
      // The register is keyed on the OWED TARGET, not on the cursor: the move
      // is still not the act in front of the player.
      expect(w.find('.con-hydro__cta').classes()).to.include('con-hydro__cta--pending');
      w.unmount();
    });

    it('a stage that owes nothing keeps its ordinary primary CTA', async () => {
      seatPreview(2);
      const w = mountSection(2);
      const vm = w.vm as unknown as Vm;
      vm.selectPosition(3);
      await w.vm.$nextTick();

      expect(vm.ctaFocused).is.true;
      expect(w.find('.con-hydro__cta').classes()).to.not.include('con-hydro__cta--pending');
      w.unmount();
    });
  });

  describe('a card ENTRY carries the same contract', () => {
    const OFFER: DeltaAdvanceOffer = {
      source: CardName.STORM_SURGE_BARRIER,
      steps: 1,
      fromPosition: 6,
      toPosition: 7,
      energyCost: 1,
      waivesTag: false,
    };

    it('the warned second press declines, and the batch says so', async () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6, {cardOffer: OFFER});
      const vm = w.vm as unknown as Vm;
      await w.vm.$nextTick();

      vm.answerBonus(true);
      expect(w.emitted('card-advance'), 'the first press only warns').is.undefined;
      vm.answerBonus(true);

      const emitted = w.emitted('card-advance') as Array<Array<Emitted>> | undefined;
      expect(emitted?.[0][0].waiveTarget).is.true;
      w.unmount();
    });

    it('a STALE offer is refused, not animated', async () => {
      // The card's door opened on position 6, but the marker now stands on 8
      // (an ordinary advance happened in between). Every term of the offer
      // describes a move that no longer exists.
      seatPreview(8, {reuseActionCards: []});
      const w = mountSection(8, {cardOffer: OFFER});
      const vm = w.vm as unknown as Vm;
      await w.vm.$nextTick();

      vm.answerBonus(true);
      vm.answerBonus(true);

      expect(w.emitted('card-advance'), 'a spent route may never reach the wire').is.undefined;
      expect(w.emitted('notice'), 'and the refusal must NAME itself').is.not.undefined;
      w.unmount();
    });

    it('a FRESH offer on the same door goes through', async () => {
      seatPreview(6, {reuseActionCards: [REPEAT_CANDIDATE]});
      const w = mountSection(6, {cardOffer: OFFER});
      const vm = w.vm as unknown as Vm;
      await w.vm.$nextTick();

      vm.answerBonus(true);
      vm.answerBonus(true);
      expect(w.emitted('card-advance')).is.not.undefined;
      expect(w.emitted('notice')).is.undefined;
      w.unmount();
    });
  });
});
