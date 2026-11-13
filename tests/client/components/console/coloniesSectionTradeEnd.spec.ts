import {expect} from 'chai';
import {flushPromises, mount, VueWrapper} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {closeColonyFocus, colonyFocusState, openColonyFocus, resetColonyFocus} from '@/client/console/consoleColoniesModel';
import {colonyTradeState} from '@/client/console/colonyTrade/consoleColonyTrade';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsoleColoniesSection from '@/client/components/console/ConsoleColoniesSection.vue';

/*
 * WAIT GRAPH R7 — the colonies stage's ending after a TRADE. The trade's falling edge stands the completion down while
 * the trade fleet is still active (the fleet owns that window), so the fleet's OWN fall must re-ask it — otherwise the
 * stage stands with nothing owed until an unrelated edge happens by.
 *
 * The section is `<script setup>` (step A of docs/claude/vapor/RECIPES.md): its watchers are no longer an option a
 * spec can call on a stand-in `this`, so the two edges are driven where the product drives them — the module flags
 * the watchers read (`colonyTradeState.active`, `tradeFleetState.active`) on a MOUNTED section with an empty table
 * (no tile, no stage: mounting the whole surface is an e2e's job) — and everything is read by its EFFECT: after the
 * dwell (a wait of the flow kernel — the spec drives the kernel's clock) the stage is folded (`colonyFocusState`) and
 * the shell is told `flow-complete`.
 *
 * THE OWE ITSELF IS NEVER READ. It is a private latch of the section (nothing exposes it, and a Vapor component has
 * no `vm` to read it off), so the spec reads what an owe DOES — the fleet's fall folds the stage that stands — and
 * what its absence does: the fleet's fall folds nothing.
 */

/** Past the completion dwell (`COMPLETION_SETTLE_MS` — 300 ms of the motion clock). */
const PAST_THE_DWELL_MS = 1000;

describe('ConsoleColoniesSection — the trade ending is re-asked when the fleet ends (wait graph R7)', () => {
  let clock: ManualFlowClock;
  let section: VueWrapper<any>;

  function lowerTheFlags(): void {
    colonyTradeState.active = false;
    tradeFleetState.active = false;
    colonyBuildState.active = false;
    resetColonyFocus();
  }

  /** How many times the completion ran to its end: the stage folded and the shell told. */
  function completed(): number {
    clock.advance(PAST_THE_DWELL_MS);
    return section.emitted('flow-complete')?.length ?? 0;
  }

  /** The section with its stage open (or already folded), then the facts of the case — each a reactive edge of its own. */
  async function stand(facts: {fleet?: boolean, trade?: boolean, stageOpen?: boolean} = {}): Promise<void> {
    section = mount(ConsoleColoniesSection, {
      global: {...globalConfig.global, stubs: {ConsoleWsHead: true, ConsoleColonyFleetBar: true}},
      props: {colonies: [], index: 0, tradeable: []},
    });
    if (facts.stageOpen !== false) {
      openColonyFocus(ColonyName.LUNA, 'trade');
    }
    tradeFleetState.active = facts.fleet === true;
    colonyTradeState.active = facts.trade === true;
    await nextTick();
  }

  async function trade(active: boolean): Promise<void> {
    colonyTradeState.active = active;
    await nextTick();
  }

  async function fleet(active: boolean): Promise<void> {
    tradeFleetState.active = active;
    await nextTick();
  }

  async function openStage(): Promise<void> {
    openColonyFocus(ColonyName.LUNA, 'trade');
    await nextTick();
  }

  /**
   * A stage stands with no trade live, and a fleet rises and falls over it — the ONE edge that pays an owed ending.
   * With nothing owed it folds nothing: the witness that no owe was left behind.
   */
  async function aLaterFleetFallsOverAStage(): Promise<void> {
    await openStage();
    await fleet(true);
    await fleet(false);
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    lowerTheFlags();
  });

  afterEach(async () => {
    lowerTheFlags();
    // The dwell is the section's own flow scope's: it goes with it, on the clock it was armed on.
    section.unmount();
    await flushPromises();
    setFlowClock(undefined);
  });

  it('the trade falling with no fleet completes at once (unchanged)', async () => {
    await stand({trade: true});
    await trade(false);
    expect(completed()).eq(1);
    expect(colonyFocusState.open, 'the stage folded').eq(false);
    // …and it owed nothing to a fleet: a later fleet's fall finds a stage and folds nothing.
    await aLaterFleetFallsOverAStage();
    expect(completed(), 'nothing was left owed').eq(1);
    expect(colonyFocusState.open).eq(true);
  });

  it('the trade falling while the fleet flies OWES the ending, and the fleet’s fall pays it', async () => {
    await stand({fleet: true, trade: true});
    await trade(false);
    expect(completed(), 'the fleet owns the window').eq(0);
    expect(colonyFocusState.open).eq(true);
    // The ending was OWED: the fleet's own fall — and nothing else — re-asks it.
    await fleet(false);
    expect(completed(), 'the fleet’s own fall re-asks the ending').eq(1);
    expect(colonyFocusState.open).eq(false);
    // …and it is paid ONCE: the next fleet's fall over a standing stage folds nothing.
    await aLaterFleetFallsOverAStage();
    expect(completed(), 'the owe was consumed by its payment').eq(1);
    expect(colonyFocusState.open).eq(true);
  });

  it('a fleet falling with no owed trade ending completes nothing (the normal dock, mid-trade)', async () => {
    await stand({fleet: true, trade: true});
    await fleet(false);
    expect(completed()).eq(0);
    expect(colonyFocusState.open).eq(true);
  });

  it('a new trade armed before the fleet fell forgets the old owe', async () => {
    await stand({fleet: true, trade: true});
    await trade(false);
    await trade(true);
    await fleet(false);
    expect(completed()).eq(0);
    expect(colonyFocusState.open).eq(true);
    // (While the new trade is live the fleet's fall folds nothing either way; that the owe was FORGOTTEN — not merely
    // unpaid — is read by its effect in the next case.)
  });

  it('…forgotten, not kept: the new trade ends off stage, a stage stands again, the fleet falls — and nothing folds', async () => {
    await stand({fleet: true, trade: true});
    await trade(false);
    await trade(true);
    // The new trade ends with the stage folded (that edge owes nothing — the last case), so the only owe that could
    // still stand is the OLD one; a stale owe would fold the stage that stands when the fleet finally falls.
    closeColonyFocus();
    await trade(false);
    await openStage();
    await fleet(false);
    expect(completed(), 'no stale owe folds the standing stage').eq(0);
    expect(colonyFocusState.open).eq(true);
  });

  it('a stage already folded owes nothing', async () => {
    await stand({fleet: true, trade: true, stageOpen: false});
    await trade(false);
    // A stage opened afterwards is not the trade's: the fleet's fall finds it and folds nothing.
    await openStage();
    await fleet(false);
    expect(completed()).eq(0);
    expect(colonyFocusState.open).eq(true);
  });
});
