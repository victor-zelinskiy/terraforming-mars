/*
 * A RIVAL'S TOKEN WAITS FOR THE PLAQUE THAT RECEIVES IT — COUNTED FROM THE PLAQUE'S ENTRY (FLAKE ZERO · class N —
 * `statusIntake.painted`).
 *
 * `openSeatIntake` resolves once the plaque's numbers are PAINTED, bounded by `INTAKE_PAINT_WAIT_MS` (≈ 350 ms under a
 * functional e2e's `?motion=0.5`). That bound was counted from the plaque's MOUNT — and its entry transition starts a
 * frame later, pending on the compositor: on a software renderer the bound ran out first and the token landed on the
 * seat's chip, the plaque appearing beside it a frame later. The bound now starts with the entry; a hard ceiling
 * covers an entry that never starts.
 */
import {expect} from 'chai';
import {nextTick} from 'vue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {INTAKE_PAINT_CEILING_MS, INTAKE_PAINT_WAIT_MS, openSeatIntake, resetStatusIntakes} from '@/client/console/statusIntake';

describe('statusIntake — the plaque\'s paint wait counts from its ENTRY', () => {
  let clock: ManualFlowClock;
  let plaque: HTMLElement;
  let pending: boolean;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    // The strip's plaque, its entry transition still PENDING (the compositor has not resolved its start).
    pending = true;
    plaque = document.createElement('span');
    plaque.setAttribute('data-intake-seat', 'red');
    plaque.className = 'con-status__intake con-intake-enter-active';
    (plaque as unknown as {getAnimations: () => Array<{pending: boolean}>}).getAnimations = () => [{pending}];
    document.body.appendChild(plaque);
  });
  afterEach(() => {
    plaque.remove();
    resetStatusIntakes();
    setFlowClock(undefined);
  });

  async function run(ms: number): Promise<void> {
    for (let t = 0; t < ms; t += 50) {
      clock.advance(50);
      for (let i = 0; i < 6; i++) {
        await Promise.resolve();
      }
    }
  }

  it('the entry still pending past the bound: the token keeps waiting for the plaque', async () => {
    let opened = false;
    void openSeatIntake('red', [{resource: 'steel', amount: 1}]).then(() => {
      opened = true;
    });
    await nextTick();
    await run(INTAKE_PAINT_WAIT_MS + 1000);
    expect(opened, 'the plaque has not started its entry — no token flies to the chip').to.eq(false);
    // The entry starts: the bound runs from HERE.
    pending = false;
    await run(INTAKE_PAINT_WAIT_MS - 200);
    expect(opened).to.eq(false);
    await run(400);
    expect(opened, 'the bound, counted from the entry\'s start').to.eq(true);
  });

  it('an entry that never starts is bounded by the ceiling', async () => {
    let opened = false;
    void openSeatIntake('red', [{resource: 'steel', amount: 1}]).then(() => {
      opened = true;
    });
    await nextTick();
    await run(INTAKE_PAINT_CEILING_MS - 200);
    expect(opened).to.eq(false);
    await run(400);
    expect(opened).to.eq(true);
  });
});
