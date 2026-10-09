import {expect} from 'chai';
import {watch} from 'vue';
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
  playedHeroLandingPrewarm,
  playedHeroLandingUp,
  playedHeroIncomingCard,
  playedHeroCardTargets,
  playedHeroState,
  provideReceivingEffectHooks,
  seedPlayedHeroRewardHold,
} from '@/client/console/played/consolePlayedHero';
import {panelRewardHold, heldStock, heldProduction} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {stagePlayedCardReturns, resetPlayedCardReturns} from '@/client/console/played/playedCardReturn';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';

function viewWithTableau(names: Array<CardName>): PlayerViewModel {
  return {
    thisPlayer: {tableau: names.map((n) => ({name: n}))},
    waitingFor: undefined,
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a FACT, with a bounded budget — never a fixed sleep sized to «how
 * long this usually takes».
 *
 * The result beat is skippable but the transfers before it are real timers, and
 * a flat `settle(700)` is a bet on the machine: it held locally and lost under a
 * loaded CI runner, where the hooks simply had not fired yet. Polling the
 * condition costs nothing when it is already true and only spends the budget
 * when the machine genuinely needs it.
 */
async function until(what: () => boolean, budgetMs = 5000): Promise<void> {
  const deadline = Date.now() + budgetMs;
  while (!what() && Date.now() < deadline) {
    await settle(10);
  }
}

describe('consolePlayedHero (the animation transaction)', function() {
  // THE SUBJECT IS A REAL TRANSACTION, so its timers ARE the contract and
  // nothing is faked here — `runPlayedHero` walks the whole lift → flight →
  // handoff chain on the wall clock. Measured in isolation the heaviest cases
  // take ~1.0-1.5 s, i.e. most of mocha's 2 s default, and under the FULL
  // client suite (one process, thousands of specs) they cross it: the run
  // reports «Timeout of 2000ms exceeded» about a transaction that completed
  // perfectly (isolated re-run: 26/26). Same treatment, same reason, as
  // `boardBeatPark.spec.ts` — raise the harness ceiling, never the assertion.
  // eslint-disable-next-line no-invalid-this
  this.timeout(15_000);

  afterEach(async () => {
    abortPlayedHero();
    resetPlayedCardReturns(); // module state — never leak a beat into the next spec
    handDeliveryState.held = [];
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

  it('a play that sent cards BACK to hand closes through the return beat', async () => {
    // Astra Mechanica: the played card lands, then the events it returned
    // leave the table for the dock — and only then does the scene finish.
    const before = viewWithTableau([CardName.ASTEROID]);
    const after = viewWithTableau([CardName.ASTRA_MECHANICA]);
    (after as unknown as {cardsInHand: Array<{name: CardName}>}).cardsInHand = [{name: CardName.ASTEROID}];

    armPlayedHero(CardName.ASTRA_MECHANICA, false, {manualTableOpen: false});
    expect(detectPlayedHero(after)).to.not.be.undefined;
    stagePlayedCardReturns(before, after);
    // Withheld from the commit on: the pack must not show the card before it
    // has physically flown there.
    expect(handDeliveryState.held).to.deep.eq([CardName.ASTEROID]);

    await runPlayedHero(after);
    // Every transition (sync flush — the beat can be sub-frame in JSDOM,
    // where the intake degrades instantly with no dock to fly to).
    const phases: Array<string> = [];
    const stop = watch(() => playedHeroState.phase, (p) => phases.push(p), {flush: 'sync'});
    const end = endPlayedHero();
    await settle(30);
    skipPlayedHeroResult();
    await end;
    stop();

    expect(phases, 'the beat is a phase of the scene, before the close').to.include('returning');
    expect(phases.indexOf('returning')).to.be.lessThan(phases.indexOf('closing'));
    expect(playedHeroState.phase).to.eq('idle');
    // The cards are in the pack the moment the transaction is over.
    expect(handDeliveryState.held).to.be.empty;
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

  /**
   * A DEAD EPISODE MAY NOT DRIVE THE NEXT ONE.
   *
   * The abort frees the commit gate IMMEDIATELY (WaitingFor must never wait on
   * an animation), so `executeFlight` routinely outlives the transaction that
   * started it — suspended on the source-rect poll, which in JSDOM never
   * succeeds and therefore runs its full ~26 frames. `active` is not a lifetime:
   * the next `armPlayedHero()` raises it again, and the stale continuation then
   * woke up inside SOMEBODY ELSE'S play and published `phase = 'lifting'` — the
   * phase the shell watches to tear `pendingPlayCard` down.
   *
   * This shipped as a CI-only failure of the neighbouring spec («expected
   * 'lifting' to equal 'idle'»), i.e. it was found by luck of scheduling. Here it
   * is pinned on purpose: arm a second play while the first is still suspended,
   * and let the abandoned poll run past its whole budget.
   */
  it('an aborted flight never drives the NEXT play (its continuation is episode-scoped)', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
    expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
    const gate = runPlayedHero(viewWithTableau([CardName.TREES]));
    abortPlayedHero();
    await gate; // frees at once, with the flight still suspended mid-poll

    // A NEW transaction, while the old continuation is still pending.
    armPlayedHero(CardName.ASTEROID, false, {manualTableOpen: false});
    const phases: Array<string> = [];
    const stop = watch(() => playedHeroState.phase, (p) => phases.push(p), {flush: 'sync'});
    // Longer than the abandoned poll's remaining budget (26 × 16ms), so a
    // continuation that still believed it owned the scene would have spoken.
    await settle(520);
    stop();

    expect(phases, `the dead episode published ${JSON.stringify(phases)}`).to.be.empty;
    expect(playedHeroState.phase, 'the new play is untouched, still merely armed').to.eq('armed');
    expect(playedHeroState.card).to.eq(CardName.ASTEROID);
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
    // NOTHING is held until the commit path seeds it — the panel renders
    // `committed − held`, so a hold living through the flight would dip the
    // PRE-commit value and fire a phantom −N chip.
    expect(panelRewardHold.active).to.be.false;
    // The commit path seeds it in the SAME synchronous block as the commit.
    seedPlayedHeroRewardHold();
    // The commit will NOT fire the reward chips — each transfer's touchdown
    // releases its metric (stock and production of the same resource held
    // INDEPENDENTLY).
    expect(panelRewardHold.active).to.be.true;
    expect(heldStock('plants')).to.eq(3);
    expect(heldProduction('plants')).to.eq(1);
    // Idempotent: a second seed can never double-hold (which would leave the
    // metric stuck low after the single release).
    seedPlayedHeroRewardHold();
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
    seedPlayedHeroRewardHold(); // the commit path's seed
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
    seedPlayedHeroRewardHold(); // no rewards → nothing to hold
    expect(panelRewardHold.active).to.be.false;
    const end = endPlayedHero();
    await settle(30);
    expect(playedHeroState.phase).to.eq('showing-result');
    skipPlayedHeroResult();
    await end;
    expect(playedHeroState.phase).to.eq('idle');
  });

  // ── THE SHIPMENT BEAT (PL-107 — the rail-spend law at the play door) ─────
  describe('the shipment beat — the price a play takes OFF THE RAIL leaves before the lift', () => {
    const shipment = () => ({
      cause: [
        {channel: 'stock', resource: 'plants', amount: 3, direction: 'loss'},
        {channel: 'stock', resource: 'steel', amount: 3, direction: 'loss'},
      ] as Array<ResourceTransferSpec>,
      reactions: [],
      known: {'stock:megacredits': -17},
    });
    const seat = (plants: number, steel: number, megacredits: number, tableau: Array<CardName>): PlayerViewModel => ({
      id: 'p-blue',
      thisPlayer: {plants, steel, megacredits, tableau: tableau.map((n) => ({name: n}))},
      waitingFor: undefined,
    } as unknown as PlayerViewModel);
    /**
     * A STANDING CARD in the composer — the beat's source. JSDOM measures every box at zero, so the card's own
     * rect is stubbed (the lift's source poll reads the same box); the rail rows are not in this DOM, so each
     * token DEGRADES (`no-destination`) — and a loss releases at its launch either way, which is the contract
     * under test: the departure hold, not the geometry.
     */
    let standing: HTMLElement | undefined;
    const mountStandingCard = () => {
      standing = document.createElement('div');
      standing.className = 'con-composer con-composer--play';
      standing.innerHTML = '<div data-zoom-handoff="play-card"><div class="pcard"><div class="pcard__mech"></div></div></div>';
      document.body.appendChild(standing);
      const pcard = standing.querySelector<HTMLElement>('.pcard')!;
      pcard.getBoundingClientRect = () => ({x: 100, y: 100, width: 200, height: 300, left: 100, top: 100, right: 300, bottom: 400, toJSON: () => ({})}) as DOMRect;
    };
    afterEach(() => {
      standing?.remove();
      standing = undefined;
    });

    it('the rows tick on the DEPARTURE (a departure hold against the not-yet-applied view), the commit releases it without a transition', async () => {
      mountStandingCard();
      armPlayedHero(CardName.SHIPMENT_TO_EARTH, true, {manualTableOpen: false, spends: shipment()});
      const before = seat(5, 4, 30, []);
      const after = seat(2, 1, 13, [CardName.SHIPMENT_TO_EARTH]);
      expect(detectPlayedHero(after)).to.not.be.undefined;
      expect(panelRewardHold.active, 'nothing held at the arm').to.be.false;
      // A LOSS releases at its launch: the departure holds are seeded inside the run — the rows read
      // `committed − amount` from the moment the tokens leave, long before the commit.
      const run = runPlayedHero(after, before);
      await until(() => heldStock('plants') === 3 && heldStock('steel') === 3);
      expect(heldStock('plants'), 'the plants row ticked at the departure — 5 → 2 on the pre-commit view').to.eq(3);
      expect(heldStock('steel')).to.eq(3);
      expect(['shipping', 'preparing', 'lifting', 'landing']).to.include(playedHeroState.phase);
      await run;
      expect(playedHeroState.shipment, 'the beat names itself: it flew (degraded tokens still count as flown here)').to.match(/^(flown|degraded)/);
      expect(heldStock('plants'), 'still held through the flight — the commit has not happened').to.eq(3);
      // THE COMMIT'S BLOCK: the applied view already carries the shipment, so the release is no transition.
      seedPlayedHeroRewardHold(before, after);
      expect(heldStock('plants')).to.eq(0);
      expect(heldStock('steel')).to.eq(0);
      expect(panelRewardHold.active).to.be.false;
      await endPlayedHero();
      expect(playedHeroState.phase).to.eq('idle');
    });

    it('a mismatch (the answer did not take what was promised) ships nothing and names itself — the rows tick with the commit', async () => {
      mountStandingCard();
      armPlayedHero(CardName.SHIPMENT_TO_EARTH, true, {manualTableOpen: false, spends: shipment()});
      const before = seat(5, 4, 30, []);
      const after = seat(5, 4, 13, [CardName.SHIPMENT_TO_EARTH]); // the plants and the steel never left
      expect(detectPlayedHero(after)).to.not.be.undefined;
      await runPlayedHero(after, before);
      expect(playedHeroState.shipment).to.match(/^mismatch:/);
      expect(panelRewardHold.active, 'no departure hold on a promise the answer broke').to.be.false;
      seedPlayedHeroRewardHold(before, after);
      await endPlayedHero();
      expect(playedHeroState.phase).to.eq('idle');
    });

    it('without the two views (a staged ceremony, a caller that has none) nothing ships', async () => {
      armPlayedHero(CardName.SHIPMENT_TO_EARTH, true, {manualTableOpen: false, spends: shipment()});
      expect(detectPlayedHero(viewWithTableau([CardName.SHIPMENT_TO_EARTH]))).to.not.be.undefined;
      await runPlayedHero(viewWithTableau([CardName.SHIPMENT_TO_EARTH]));
      expect(playedHeroState.shipment).to.match(/^mismatch:/);
      expect(panelRewardHold.active).to.be.false;
      await endPlayedHero();
    });

    it('an abort before the commit refunds the departure — the rows return to the truth, nothing stays held', async () => {
      mountStandingCard();
      armPlayedHero(CardName.SHIPMENT_TO_EARTH, true, {manualTableOpen: false, spends: shipment()});
      const before = seat(5, 4, 30, []);
      const after = seat(2, 1, 13, [CardName.SHIPMENT_TO_EARTH]);
      expect(detectPlayedHero(after)).to.not.be.undefined;
      const run = runPlayedHero(after, before);
      await until(() => heldStock('plants') === 3);
      expect(heldStock('plants'), 'the departure was held').to.eq(3);
      abortPlayedHero();
      await run;
      expect(panelRewardHold.active).to.be.false;
      expect(heldStock('plants')).to.eq(0);
      expect(heldStock('steel')).to.eq(0);
      await settle(5);
      expect(playedHeroState.phase).to.eq('idle');
    });

    it('a play that takes nothing off the rail has no beat and no name', async () => {
      armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
      expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
      await runPlayedHero(viewWithTableau([CardName.TREES]), viewWithTableau([]));
      expect(playedHeroState.shipment).to.eq('');
      expect(panelRewardHold.active).to.be.false;
      await endPlayedHero();
    });

    it('a standing card nobody can measure ships nothing and says so (`no-source`)', async () => {
      armPlayedHero(CardName.SHIPMENT_TO_EARTH, true, {manualTableOpen: false, spends: shipment()});
      const before = seat(5, 4, 30, []);
      const after = seat(2, 1, 13, [CardName.SHIPMENT_TO_EARTH]);
      expect(detectPlayedHero(after)).to.not.be.undefined;
      await runPlayedHero(after, before);
      expect(playedHeroState.shipment).to.eq('no-source');
      expect(panelRewardHold.active).to.be.false;
      seedPlayedHeroRewardHold(before, after);
      await endPlayedHero();
    });

    it('the shipment phase is BEFORE the landing stage: the workspace stage stays in prewarm, nothing incoming yet', async () => {
      mountStandingCard();
      armPlayedHero(CardName.SHIPMENT_TO_EARTH, true, {manualTableOpen: false, host: 'workspace', spends: shipment()});
      const before = seat(5, 4, 30, []);
      const after = seat(2, 1, 13, [CardName.SHIPMENT_TO_EARTH]);
      expect(detectPlayedHero(after)).to.not.be.undefined;
      let sawShipping = false;
      let stageUpWhileShipping = false;
      let incomingWhileShipping: unknown = undefined;
      const stop = watch(() => playedHeroState.phase, (p) => {
        if (p === 'shipping') {
          sawShipping = true;
          stageUpWhileShipping = playedHeroLandingUp();
          incomingWhileShipping = playedHeroIncomingCard();
          expect(playedHeroLandingPrewarm(), 'the stage stays MOUNTED (prewarm) while the price leaves').to.be.true;
          expect(playedHeroHolding(), 'the beat holds the foreground').to.be.true;
        }
      }, {flush: 'sync'});
      try {
        await runPlayedHero(after, before);
      } finally {
        stop();
      }
      expect(sawShipping, 'the beat published its phase').to.be.true;
      expect(stageUpWhileShipping, 'the landing stage is NOT up while the card still stands').to.be.false;
      expect(incomingWhileShipping, 'the tableau reserves no slot yet').to.be.undefined;
      seedPlayedHeroRewardHold(before, after);
      await endPlayedHero();
    });
  });

  // ── the WORKSPACE host (the Card Play Workspace landing stage) ──────────
  describe('the workspace host', () => {
    it('NEVER opens the standalone table — the workspace stage owns the scene', async () => {
      armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
      expect(playedHeroState.host).to.eq('workspace');
      // The prewarm window: the embedded tableau mounts hidden during the
      // submit round trip; nothing presents yet.
      expect(playedHeroLandingPrewarm()).to.be.true;
      expect(playedHeroLandingUp()).to.be.false;
      expect(detectPlayedHero(viewWithTableau([CardName.TREES]))).to.not.be.undefined;
      await runPlayedHero(viewWithTableau([CardName.TREES]));
      // The external overlay NEVER opens for a workspace play — that is the
      // whole migration.
      expect(playedHeroState.tableOpen).to.be.false;
      expect(playedHeroLandingUp()).to.be.true;
      expect(playedHeroLandingPrewarm()).to.be.false;
      expect(playedHeroHolding()).to.be.true; // follow-up surfaces stay held
      const end = endPlayedHero();
      await settle(30);
      expect(playedHeroState.phase).to.eq('showing-result');
      skipPlayedHeroResult();
      await end;
      expect(playedHeroState.tableOpen).to.be.false; // never, at any phase
      expect(playedHeroState.phase).to.eq('idle');
      expect(playedHeroState.host).to.eq('overlay'); // reset for the next arm
      expect(playedHeroLandingUp()).to.be.false;
    });

    it('the default host is the overlay — every existing arm is untouched', () => {
      armPlayedHero(CardName.TREES, false, {manualTableOpen: false});
      expect(playedHeroState.host).to.eq('overlay');
      expect(playedHeroLandingPrewarm()).to.be.false;
    });

    it('a play the server refused resets the host with the failure', async () => {
      armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
      expect(detectPlayedHero(viewWithTableau([]))).to.be.undefined; // refused
      expect(playedHeroLandingUp()).to.be.false; // the stage retracts at once
      await settle(5);
      expect(playedHeroState.host).to.eq('overlay');
      expect(playedHeroState.phase).to.eq('idle');
    });

    it('EFFECT RESOLUTION: a card target emerges → receives → settles, strictly after the dock', async () => {
      const calls: Array<string> = [];
      const unregister = provideReceivingEffectHooks({
        emergeTarget: async (c) => {
          calls.push(`emerge:${c}`);
        },
        settleTarget: async (c) => {
          calls.push(`settle:${c}`);
        },
      });
      try {
        armPlayedHero(CardName.LOCAL_HEAT_TRAPPING, true, {manualTableOpen: false, host: 'workspace', rewards: [
          {channel: 'card-resource', resource: 'animal', amount: 2, targetCard: CardName.BIRDS},
          {channel: 'stock', resource: 'heat', amount: 1},
        ]});
        expect(playedHeroCardTargets()).to.deep.eq([CardName.BIRDS]); // prewarm data
        expect(detectPlayedHero(viewWithTableau([CardName.LOCAL_HEAT_TRAPPING]))).to.not.be.undefined;
        await runPlayedHero(viewWithTableau([CardName.LOCAL_HEAT_TRAPPING]));
        expect(calls, 'nothing delivers before the dock').to.be.empty;
        const end = endPlayedHero();
        // The READ beat + the degraded (geometry-less) transfers — waited for by
        // their own observable, the second hook call.
        await until(() => calls.length >= 2);
        skipPlayedHeroResult();
        await end;
        expect(calls).to.deep.eq([`emerge:${CardName.BIRDS}`, `settle:${CardName.BIRDS}`]);
        expect(playedHeroState.phase).to.eq('idle');
      } finally {
        unregister();
      }
    });

    it('the OVERLAY host never drives the hooks — its classic single wave stays', async () => {
      const calls: Array<string> = [];
      const unregister = provideReceivingEffectHooks({
        emergeTarget: async (c) => {
          calls.push(`emerge:${c}`);
        },
        settleTarget: async (c) => {
          calls.push(`settle:${c}`);
        },
      });
      try {
        armPlayedHero(CardName.LOCAL_HEAT_TRAPPING, true, {manualTableOpen: false, rewards: [
          {channel: 'card-resource', resource: 'animal', amount: 2, targetCard: CardName.BIRDS},
        ]});
        expect(detectPlayedHero(viewWithTableau([CardName.LOCAL_HEAT_TRAPPING]))).to.not.be.undefined;
        await runPlayedHero(viewWithTableau([CardName.LOCAL_HEAT_TRAPPING]));
        const end = endPlayedHero();
        await settle(700);
        skipPlayedHeroResult();
        await end;
        expect(calls).to.be.empty;
      } finally {
        unregister();
      }
    });
  });
});
