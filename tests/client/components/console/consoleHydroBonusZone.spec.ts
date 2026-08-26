import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {CardName} from '@/common/cards/CardName';
import type {DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import {resetHydroFlow, beginHydroCommit} from '@/client/console/hydroFlow/consoleHydroFlow';

/**
 * THE BONUS OFFER'S WORKING ZONE — the bottom of the Hydronetwork workspace,
 * given over to ONE decision.
 *
 * These exercise the component's own contract rather than its pixels: which
 * scene owns the zone, where the cursor starts, that a second press cannot
 * exist, that the index submitted is the SERVER's, and that the zone never
 * titles itself (the stage name goes up to the crumb).
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
  footCommands: ReadonlyArray<{control: string, label: string, enabled?: boolean}>,
  answerBonus(take: boolean): void,
};

function mountSection(offer: DeltaBonusPromptMeta | undefined) {
  return mount(ConsoleHydroSection, {
    props: {
      playerView: {thisPlayer: {color: 'red'}, players: [{color: 'red'}], game: {}} as never,
      bonusOffer: offer,
    },
    global: {stubs: {ConsoleWsHead: true, ConsoleCardFaceLite: true, ConsolePlayedTargetStep: true, GamepadGlyph: true, HydroReward: true}},
  });
}

describe('the Hydronetwork bonus zone', () => {
  afterEach(() => {
    resetHydroFlow(); // module state is bundle-shared — never leak the flow
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

  describe('answering', () => {
    it('submits the SERVER\'s own index, for both answers', () => {
      const take = mountSection(OFFER);
      (take.vm as unknown as Vm).answerBonus(true);
      expect(take.emitted('bonus-answer')?.[0]).to.deep.eq([OFFER.advanceIndex]);
      take.unmount();

      const skip = mountSection({...OFFER, advanceIndex: 3, skipIndex: 7});
      (skip.vm as unknown as Vm).answerBonus(false);
      expect(skip.emitted('bonus-answer')?.[0]).to.deep.eq([7]);
      skip.unmount();
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

  describe('the command bar', () => {
    it('advertises exactly the verbs the zone offers', () => {
      const w = mountSection(OFFER);
      const controls = (w.vm as unknown as Vm).footCommands.map((c) => c.control);
      expect(controls).to.have.members(['dpadU', 'confirm', 'secondary', 'back']);
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
    it('disables its verbs while the answer is in flight, never removes them', () => {
      const w = mountSection(OFFER);
      const vm = w.vm as unknown as Vm;
      vm.answerBonus(true);
      const cmds = vm.footCommands;
      expect(cmds.map((c) => c.control)).to.have.members(['dpadU', 'confirm', 'secondary', 'back']);
      for (const control of ['confirm', 'secondary', 'back']) {
        expect(cmds.find((c) => c.control === control)?.enabled, control).is.false;
      }
      w.unmount();
    });
  });
});
