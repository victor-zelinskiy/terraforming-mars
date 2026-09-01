import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import type {DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import type {DeltaMovementBonusProjection} from '@/common/models/DeltaTrackPreviewModel';
import {resetHydroFlow} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';

/**
 * «ДОПОЛНИТЕЛЬНО» — the movement's PASSIVE half, beside «Вы получите».
 *
 * The card under test is Social Heating: it pays its owner heat for every real
 * step ANY player takes on the track, so a player planning their OWN advance
 * must see that heat BEFORE they confirm, in the same result language as the
 * stage reward and with the source named.
 *
 * Everything asserted here is SERVER-AUTHORED: the amounts arrive on the
 * preview's destinations (and on a card's offer), computed by the very hooks
 * the commit pays out. These specs therefore also pin the one thing the client
 * must never start doing — deriving the amount itself: change the server number
 * and every reading below moves with it, because there is no second source.
 */

const heatBonus = (amount: number, before: number): DeltaMovementBonusProjection =>
  ({card: CardName.SOCIAL_HEATING, resource: Resource.HEAT, amount, before, after: before + amount});

type Vm = {
  sceneKey: string,
  movementBonuses: ReadonlyArray<DeltaMovementBonusProjection>,
  bonusGainPresent: boolean,
  model: {mode: string, selectedSpend: number},
  emitConfirm(): void,
};

function viewerPlayer() {
  return {
    color: 'red',
    steel: 1, plants: 2, titanium: 0, energy: 9, heat: 4, megacredits: 10,
    megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0,
    plantProduction: 0, energyProduction: 1, heatProduction: 0,
    tags: {},
    tableau: [],
    deltaProject: {position: 2, stops: []},
  };
}

/**
 * The SERVER's planning preview, with a passive movement bonus on EVERY
 * destination — one heat per step, threaded off the viewer's live heat, which
 * is exactly what `DeltaProjectExpansion.projectedMovementBonuses` produces
 * for a table holding Social Heating.
 */
function seatPreview(opts: {bonuses?: boolean} = {}): void {
  hydroNetworkState.previewColor = 'red' as never;
  hydroNetworkState.preview = {
    currentPosition: 2,
    availableEnergy: 9,
    availableSteelSubstitute: 0,
    usedThisGeneration: false,
    atEndOfTrack: false,
    maxLegalSteps: 9,
    maxEnergySteps: 9,
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
      ...(opts.bonuses === false ? {} : {movementBonuses: [heatBonus(i + 1, 4)]}),
    })),
  } as never;
}

function mountSection(opts: {offer?: DeltaBonusPromptMeta, actionAvailable?: boolean} = {}) {
  return mount(ConsoleHydroSection, {
    props: {
      playerView: {
        thisPlayer: viewerPlayer(),
        players: [viewerPlayer()],
        game: {},
        waitingFor: undefined,
      } as never,
      bonusOffer: opts.offer,
      actionAvailable: opts.actionAvailable ?? true,
      ownsPrompt: opts.offer !== undefined,
    },
    global: {stubs: {ConsoleWsHead: true, ConsoleCardFaceLite: true, ConsoleSourceDock: true, ConsolePlayedTargetStep: true, GamepadGlyph: true, HydroReward: true, ConsolePaymentPanel: true}},
  });
}

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

describe('the Hydronetwork movement bonus row', () => {
  afterEach(() => {
    resetHydroFlow();
    hydroNetworkState.rewardChoice = undefined;
    hydroNetworkState.selectedPosition = -1;
    hydroNetworkState.selectedCard = undefined;
    hydroNetworkState.preview = undefined;
    hydroNetworkState.previewColor = undefined;
    consoleHydroUi.repeatResult = undefined;
  });

  describe('planning the player’s own advance', () => {
    it('reads the SERVER’s amount for the selected destination', () => {
      seatPreview();
      const w = mountSection();
      hydroNetworkState.selectedPosition = 5; // 2 → 5 = three steps
      const vm = w.vm as unknown as Vm;
      expect(vm.model.selectedSpend).to.eq(3);
      expect(vm.movementBonuses).to.deep.eq([heatBonus(3, 4)]);
      w.unmount();
    });

    it('follows the plan — a different destination is a different promise', () => {
      seatPreview();
      const w = mountSection();
      const vm = w.vm as unknown as Vm;
      hydroNetworkState.selectedPosition = 3;
      expect(vm.movementBonuses).to.deep.eq([heatBonus(1, 4)]);
      hydroNetworkState.selectedPosition = 7;
      expect(vm.movementBonuses).to.deep.eq([heatBonus(5, 4)]);
      w.unmount();
    });

    it('renders beside «Вы получите» — source named, before → after, +N', async () => {
      seatPreview();
      const w = mountSection();
      hydroNetworkState.selectedPosition = 5;
      await w.vm.$nextTick();
      const extra = w.find('.con-hydro__gains-extra');
      expect(extra.exists(), 'the ДОПОЛНИТЕЛЬНО group must render').is.true;
      expect(extra.find('.con-hydro__extra-src').text()).to.eq(CardName.SOCIAL_HEATING);
      expect(extra.find('.con-hydro__beforeafter').text().replace(/\s+/g, ' ')).to.eq('4 → 7');
      expect(extra.find('.con-hydro__plus').text()).to.eq('+3');
      // …and it is INSIDE the one outcome block, not a panel of its own.
      expect(w.find('.con-hydro__gains .con-hydro__gains-extra').exists()).is.true;
      w.unmount();
    });

    it('is absent when the table owes nothing — the historical panel is untouched', async () => {
      seatPreview({bonuses: false});
      const w = mountSection();
      hydroNetworkState.selectedPosition = 5;
      await w.vm.$nextTick();
      expect((w.vm as unknown as Vm).movementBonuses).to.deep.eq([]);
      expect(w.find('.con-hydro__gains-extra').exists()).is.false;
      w.unmount();
    });

    it('is absent while BROWSING a passed stage — nothing is being moved', () => {
      seatPreview();
      const w = mountSection();
      hydroNetworkState.selectedPosition = 1; // behind the marker → details mode
      const vm = w.vm as unknown as Vm;
      expect(vm.model.mode).to.eq('details');
      expect(vm.movementBonuses).to.deep.eq([]);
      w.unmount();
    });

    it('rides the confirm payload, frozen with the rest of the result', () => {
      seatPreview();
      const w = mountSection();
      hydroNetworkState.selectedPosition = 4; // two steps
      const vm = w.vm as unknown as Vm;
      vm.emitConfirm();
      const payload = w.emitted('confirm')?.[0]?.[0] as {movementBonuses?: unknown};
      expect(payload.movementBonuses).to.deep.eq([heatBonus(2, 4)]);
      w.unmount();
    });
  });

  describe('a card-granted bonus move', () => {
    it('describes the OFFER’s own move, not whatever the stepper sat on', async () => {
      seatPreview();
      const w = mountSection({offer: {...OFFER, movementBonuses: [heatBonus(1, 4)]}});
      await w.vm.$nextTick();
      const vm = w.vm as unknown as Vm;
      expect(vm.sceneKey).to.eq('bonus');
      expect(vm.movementBonuses).to.deep.eq([heatBonus(1, 4)]);
      expect(w.find('.con-hydro__gains-extra').exists()).is.true;
      w.unmount();
    });

    it('an offer that owes nothing shows no row', async () => {
      seatPreview({bonuses: false});
      const w = mountSection({offer: OFFER});
      await w.vm.$nextTick();
      expect((w.vm as unknown as Vm).movementBonuses).to.deep.eq([]);
      expect(w.find('.con-hydro__gains-extra').exists()).is.false;
      w.unmount();
    });

    it('the outcome block appears for a bonus whose landing pays nothing else', () => {
      seatPreview({bonuses: false});
      // Position 10 is a VP terminal: no stage reward lines at all …
      const w = mountSection({offer: {...OFFER, fromPosition: 9, toPosition: 10, movementBonuses: [heatBonus(1, 4)]}});
      const vm = w.vm as unknown as Vm;
      // … yet the move itself pays, so the block must still be present.
      expect(vm.bonusGainPresent).is.true;
      w.unmount();
    });
  });
});
