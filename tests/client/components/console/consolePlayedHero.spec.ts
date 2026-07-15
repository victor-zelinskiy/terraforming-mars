import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armPlayedHero,
  detectPlayedHero,
  runPlayedHero,
  endPlayedHero,
  abortPlayedHero,
  skipPlayedHeroResult,
  isPlayedHeroActive,
  playedHeroHolding,
  playedHeroState,
} from '@/client/console/played/consolePlayedHero';
import {panelRewardHold, heldStock, heldProduction} from '@/client/console/resourceTransfer/consoleResourceTransfer';

function viewWithTableau(names: Array<CardName>): PlayerViewModel {
  return {
    thisPlayer: {tableau: names.map((n) => ({name: n}))},
    waitingFor: undefined,
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('consolePlayedHero (the animation transaction)', () => {
  afterEach(async () => {
    abortPlayedHero();
    await settle(5); // the abort lowers 'failed' → 'idle' on nextTick
  });

  it('arm is invisible: active, phase=armed, but NOT yet holding surfaces', () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    expect(isPlayedHeroActive()).to.be.true;
    expect(playedHeroState.phase).to.eq('armed');
    expect(playedHeroHolding()).to.be.false;
    expect(playedHeroState.tableOpen).to.be.false;
  });

  it('detect consumes the arm ONCE and requires the server-proven tableau', () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    const hit = detectPlayedHero(viewWithTableau([CardName.TREES]));
    expect(hit).to.deep.eq({card: CardName.TREES});
    // One-shot per response — a re-detect never double-runs the scene.
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.be.undefined;
  });

  it('a play the server did NOT land aborts with zero visual state', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    const hit = detectPlayedHero(viewWithTableau([])); // card never arrived
    expect(hit).to.be.undefined;
    expect(isPlayedHeroActive()).to.be.false;
    expect(playedHeroState.phase).to.eq('failed'); // one flush for the shell watcher
    await settle(5);
    expect(playedHeroState.phase).to.eq('idle');
    expect(playedHeroState.tableOpen).to.be.false;
    expect(playedHeroState.proxy).to.be.undefined;
  });

  it('the full happy path walks the explicit phase ladder and commits gates in order', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;

    // PRE-COMMIT half: no composer / no stage in this DOM → the graceful
    // no-flight path; the promise resolves (the commit gate NEVER hangs).
    await runPlayedHero(viewWithTableau([CardName.TREES]));
    expect(playedHeroState.phase).to.eq('landing');
    expect(playedHeroState.tableOpen).to.be.true; // the table opened for the scene
    expect(playedHeroState.revealed).to.be.false; // reveal strictly post-commit
    expect(playedHeroHolding()).to.be.true; // follow-up surfaces stay held

    // POST-COMMIT half: reveal → result beat (skippable) → auto-close → idle.
    const end = endPlayedHero();
    await settle(30);
    expect(playedHeroState.revealed).to.be.true;
    expect(playedHeroState.phase).to.eq('showing-result');
    skipPlayedHeroResult(); // a press accelerates — never cancels
    await end;
    expect(playedHeroState.phase).to.eq('idle');
    expect(isPlayedHeroActive()).to.be.false;
    expect(playedHeroState.tableOpen).to.be.false; // the system-opened table closed itself
  });

  it('a manually-open table is NEVER auto-closed by the scene', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: true});
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
    await runPlayedHero(viewWithTableau([CardName.TREES]));
    // play-animation never claimed table ownership — the player's own stays.
    expect(playedHeroState.tableOpen).to.be.false;
    expect(playedHeroState.autoClose).to.be.false;
    const end = endPlayedHero();
    await settle(30);
    skipPlayedHeroResult();
    await end;
    expect(playedHeroState.phase).to.eq('idle');
  });

  it('abort mid-scene frees the commit gate and leaves no lock behind', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
    const gate = runPlayedHero(viewWithTableau([CardName.TREES]));
    abortPlayedHero();
    await gate; // resolves — WaitingFor can always commit
    expect(isPlayedHeroActive()).to.be.false;
    await settle(5);
    expect(playedHeroState.phase).to.eq('idle');
  });

  it('endPlayedHero after an abort is a clean no-op', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    abortPlayedHero();
    await endPlayedHero();
    await settle(5);
    expect(playedHeroState.phase).to.eq('idle');
    expect(playedHeroState.revealed).to.be.false;
  });

  it('the REWARD BEAT: metrics held from the commit gate, released by the transfers, clean end', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, rewards: [
      {channel: 'stock', resource: 'plants', amount: 3},
      {channel: 'production', resource: 'plants', amount: 1},
    ]});
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
    await runPlayedHero(viewWithTableau([CardName.TREES]));
    // The hold seeded exactly as the commit gate opened: the commit will NOT
    // fire the reward chips — each transfer's touchdown releases its metric
    // (stock and production of the same resource held INDEPENDENTLY).
    expect(panelRewardHold.active).to.be.true;
    expect(heldStock('plants')).to.eq(3);
    expect(heldProduction('plants')).to.eq(1);
    // Under JSDOM the transfers degrade (no measurable geometry) and release
    // immediately — the scene still walks to a clean idle with nothing held.
    await endPlayedHero();
    expect(panelRewardHold.active).to.be.false;
    expect(heldStock('plants')).to.eq(0);
    expect(playedHeroState.phase).to.eq('idle');
    expect(isPlayedHeroActive()).to.be.false;
  });

  it('abort mid-scene drops the reward hold with the transaction (no stale hold, ever)', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, rewards: [
      {channel: 'stock', resource: 'megacredits', amount: 5},
    ]});
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
    await runPlayedHero(viewWithTableau([CardName.TREES]));
    expect(heldStock('megacredits')).to.eq(5);
    abortPlayedHero();
    expect(panelRewardHold.active).to.be.false;
    expect(heldStock('megacredits')).to.eq(0);
    await settle(5);
    expect(playedHeroState.phase).to.eq('idle');
  });

  it('a card with NO immediate reward seeds no hold and keeps the plain result beat', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
    await runPlayedHero(viewWithTableau([CardName.TREES]));
    expect(panelRewardHold.active).to.be.false;
    const end = endPlayedHero();
    await settle(30);
    expect(playedHeroState.phase).to.eq('showing-result');
    skipPlayedHeroResult();
    await end;
    expect(playedHeroState.phase).to.eq('idle');
  });
});
