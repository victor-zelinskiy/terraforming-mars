import {expect} from 'chai';
import {
  detectEnergyConversion,
  endEnergyConversion,
  energyConversionState,
  isEnergyConversionActive,
  resetEnergyConversion,
  runEnergyConversion,
} from '@/client/components/feedback/energyConversionTransition';
import {readConversionEvent} from '@/client/components/feedback/energyConversionModel';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';

/* Synthetic views — only the fields the detector reads. */
function view(conv?: {amount: number, energyBefore: number, heatBefore: number, generation: number}): ViewModel {
  return {
    runId: 'r1',
    thisPlayer: {color: 'red'},
    energyHeatConversion: conv,
  } as unknown as PlayerViewModel;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('energyConversionTransition (gate + commit handoff)', () => {
  // Module state is bundle-shared in mochapack — leave nothing running.
  afterEach(() => resetEnergyConversion());

  it('claims the dedupe key once — a poll replay of the same view never re-fires', () => {
    const prev = view();
    const next = view({amount: 2, energyBefore: 2, heatBefore: 1, generation: 3});
    expect(detectEnergyConversion(prev, next)).to.not.be.undefined;
    expect(detectEnergyConversion(prev, next)).to.be.undefined;
  });

  it('a fresh load (no prev view) claims but never replays a finished conversion', () => {
    const next = view({amount: 2, energyBefore: 2, heatBefore: 1, generation: 3});
    expect(detectEnergyConversion(undefined, next)).to.be.undefined;
    // …and the key is spent: a later poll with a prev view stays silent too.
    expect(detectEnergyConversion(view(), next)).to.be.undefined;
  });

  it('runs with NO lead-in by default: gate closed synchronously, motion armed at once', async () => {
    const event = readConversionEvent(view({amount: 1, energyBefore: 1, heatBefore: 3, generation: 4}))!;
    const done = runEnergyConversion(event);
    expect(isEnergyConversionActive()).to.be.true;
    expect(energyConversionState.leadIn).to.be.false;
    expect(energyConversionState.showChips).to.be.true;
    await done;
    expect(energyConversionState.displayEnergy).to.eq(0);
    expect(energyConversionState.displayHeat).to.eq(4);
    endEnergyConversion();
    expect(isEnergyConversionActive()).to.be.false;
    expect(energyConversionState.leadIn).to.be.false;
  });

  it('leadInMs: the gate closes at once but the visible motion waits out the handoff window', async () => {
    const event = readConversionEvent(view({amount: 1, energyBefore: 1, heatBefore: 3, generation: 5}))!;
    const done = runEnergyConversion(event, {leadInMs: 90});
    // Synchronously: re-entrancy guard closed, motion NOT started — the prompt
    // surface leaves during this window and nothing may play under it.
    expect(isEnergyConversionActive()).to.be.true;
    expect(energyConversionState.leadIn).to.be.true;
    expect(energyConversionState.showChips).to.be.false;
    // Counters hold the PRE-conversion values through the lead-in.
    expect(energyConversionState.displayEnergy).to.eq(1);
    expect(energyConversionState.displayHeat).to.eq(3);
    await sleep(140);
    expect(energyConversionState.leadIn).to.be.false;
    expect(energyConversionState.showChips).to.be.true;
    // The gate still resolves (safety-covered) and lands the counters exactly.
    await done;
    expect(energyConversionState.displayEnergy).to.eq(0);
    expect(energyConversionState.displayHeat).to.eq(4);
  });
});
