import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armPatentSale,
  detectPatentSale,
  runPatentSale,
  endPatentSale,
  abortPatentSale,
  isPatentSaleActive,
  patentSaleHolding,
  patentSaleState,
} from '@/client/console/patentSale/consolePatentSale';
import {SELL_PATENTS_RATE} from '@/client/components/handCards/sellPatentsState';

function viewWithHand(names: Array<CardName>): PlayerViewModel {
  return {
    cardsInHand: names.map((n) => ({name: n})),
    waitingFor: undefined,
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('consolePatentSale (the animation transaction)', () => {
  afterEach(async () => {
    abortPatentSale();
    await settle(5); // the abort lowers 'failed' → 'idle' on nextTick
  });

  it('arm closes the input gate at once and starts the client leg', async () => {
    armPatentSale({cards: [CardName.TREES, CardName.FISH]});
    expect(isPatentSaleActive()).to.be.true;
    // No live hand slots in this DOM → the client leg degrades and may have
    // already advanced past 'gathering' synchronously; the ladder order holds.
    expect(['gathering', 'inserting', 'processing']).to.include(patentSaleState.phase);
    expect(patentSaleState.cards).to.deep.eq([CardName.TREES, CardName.FISH]);
    expect(patentSaleState.payout).to.eq(2 * SELL_PATENTS_RATE);
    expect(patentSaleHolding()).to.be.true;
    // No live hand slots in this DOM → the degraded ladder still walks the
    // SAME phases (inserting → processing) so the shell watcher stays in step.
    await settle(15);
    expect(patentSaleState.phase).to.eq('processing');
  });

  it('detect consumes the arm ONCE and requires the server-proven removal', async () => {
    armPatentSale({cards: [CardName.TREES]});
    await settle(15);
    const hit = detectPatentSale(viewWithHand([CardName.FISH])); // Trees is gone
    expect(hit).to.deep.eq({payout: SELL_PATENTS_RATE});
    // One-shot per response — a re-detect never double-runs the payout.
    expect(detectPatentSale(viewWithHand([CardName.FISH]))).to.be.undefined;
  });

  it('a sale the server did NOT process aborts with zero visual state', async () => {
    armPatentSale({cards: [CardName.TREES]});
    await settle(15);
    const hit = detectPatentSale(viewWithHand([CardName.TREES])); // still in hand
    expect(hit).to.be.undefined;
    expect(isPatentSaleActive()).to.be.false;
    expect(patentSaleState.phase).to.eq('failed'); // one flush for the shell watcher
    await settle(5);
    expect(patentSaleState.phase).to.eq('idle');
    expect(patentSaleState.flights).to.deep.eq([]);
  });

  it('the full happy path walks the phase ladder and the commit gate resolves', async () => {
    armPatentSale({cards: [CardName.TREES, CardName.FISH, CardName.BIRDS]});
    await settle(15);
    expect(detectPatentSale(viewWithHand([]))).to.deep.eq({payout: 3 * SELL_PATENTS_RATE});

    // The payout leg: no stage / no M€ anchor in this DOM → the graceful
    // degraded beat; the promise resolves (the commit gate NEVER hangs).
    await runPatentSale();
    expect(patentSaleState.phase).to.eq('paying');
    expect(patentSaleHolding()).to.be.true; // the follow-up prompt stays held

    // POST-COMMIT settle → idle, transaction fully released.
    await endPatentSale();
    expect(patentSaleState.phase).to.eq('idle');
    expect(isPatentSaleActive()).to.be.false;
    expect(patentSaleState.cards).to.deep.eq([]);
    expect(patentSaleState.payout).to.eq(0);
  });

  it('abort mid-run frees the commit gate and leaves no lock behind', async () => {
    armPatentSale({cards: [CardName.TREES]});
    await settle(15);
    expect(detectPatentSale(viewWithHand([]))).to.not.be.undefined;
    const gate = runPatentSale();
    abortPatentSale();
    await gate; // resolves — WaitingFor can always commit
    expect(isPatentSaleActive()).to.be.false;
    await settle(5);
    expect(patentSaleState.phase).to.eq('idle');
  });

  it('endPatentSale after an abort is a clean no-op', async () => {
    armPatentSale({cards: [CardName.TREES]});
    abortPatentSale();
    await endPatentSale();
    await settle(5);
    expect(patentSaleState.phase).to.eq('idle');
  });

  it('a second arm re-keys the transaction (nonce bumps, claim resets)', async () => {
    armPatentSale({cards: [CardName.TREES]});
    const firstNonce = patentSaleState.nonce;
    await settle(15);
    expect(detectPatentSale(viewWithHand([]))).to.not.be.undefined;
    await runPatentSale();
    await endPatentSale();
    armPatentSale({cards: [CardName.FISH]});
    expect(patentSaleState.nonce).to.eq(firstNonce + 1);
    await settle(15);
    // The fresh arm is detectable again (the one-shot claim was reset).
    expect(detectPatentSale(viewWithHand([]))).to.deep.eq({payout: SELL_PATENTS_RATE});
  });
});
