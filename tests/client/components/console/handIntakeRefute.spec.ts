import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  intakeSafetyExtends, intakeTargetRefuted, pollTickCost, POLL_TIMER_TICK_FRAMES, refuteWithheldIntake, resetHandDelivery,
  runHandIntake, SAFETY_EXTENSIONS_MAX,
} from '@/client/console/handDock/handDeliveryDirector';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {handDeliveryState, onIntakeTouchdown, releaseInFlight} from '@/client/console/handDock/handDeliveryState';

/**
 * THE WITHHELD-INTAKE REFUTATION — the class of bug it closes:
 *
 * A buy submits at the intake's lift-off, but under Helion (heat as M€) /
 * Luna Trade Federation the server answers with a `payment` prompt and grants
 * the bought cards only after it is paid (`ChooseCards` → `keep()` inside
 * `SelectPaymentDeferred.andThen`). Left alone, each flight polls its dock
 * pose for the full budget — a stale `cardArrival` admission claim GATING the
 * very payment prompt that releases the cards, which the foreground watchdog
 * then had to "cure" with «Экран завис» at the end of every Helion draft.
 *
 * The refutation is STRUCTURAL, never a title: a `payment` question standing
 * while a flown card is absent from `cardsInHand` proves the card is withheld
 * behind it (the server asks one thing at a time).
 */
function view(o: {waitingForType?: string, inHand?: Array<CardName>}): PlayerViewModel {
  return {
    waitingFor: o.waitingForType === undefined ? undefined : {type: o.waitingForType},
    cardsInHand: (o.inHand ?? []).map((name) => ({name})),
  } as unknown as PlayerViewModel;
}

describe('handDeliveryDirector — the withheld-intake refutation', () => {
  afterEach(() => {
    // Module state is bundle-shared in mochapack — restore it for later specs.
    resetHandDelivery();
  });

  it('a payment prompt + a flown card absent from the hand → refuted', () => {
    handDeliveryState.inFlight = [CardName.FISH];
    refuteWithheldIntake(view({waitingForType: 'payment'}));
    expect(intakeTargetRefuted(CardName.FISH)).to.be.true;
  });

  it('a card the server already granted keeps its flight (present in the hand)', () => {
    handDeliveryState.inFlight = [CardName.FISH, CardName.BIRDS];
    refuteWithheldIntake(view({waitingForType: 'payment', inHand: [CardName.FISH]}));
    expect(intakeTargetRefuted(CardName.FISH)).to.be.false;
    expect(intakeTargetRefuted(CardName.BIRDS)).to.be.true;
  });

  it('a non-payment prompt refutes nothing (an ordinary mid-flight response)', () => {
    handDeliveryState.inFlight = [CardName.FISH];
    refuteWithheldIntake(view({waitingForType: 'card'}));
    expect(intakeTargetRefuted(CardName.FISH)).to.be.false;
  });

  it('no prompt refutes nothing (the granting response has no question)', () => {
    handDeliveryState.inFlight = [CardName.FISH];
    refuteWithheldIntake(view({}));
    expect(intakeTargetRefuted(CardName.FISH)).to.be.false;
  });

  it('nothing in flight → nothing to refute (a standalone SelectPayment)', () => {
    refuteWithheldIntake(view({waitingForType: 'payment'}));
    expect(intakeTargetRefuted(CardName.FISH)).to.be.false;
  });

  it('a NEW intake of the same name is a fresh promise (the payment was answered)', async () => {
    handDeliveryState.inFlight = [CardName.FISH];
    refuteWithheldIntake(view({waitingForType: 'payment'}));
    expect(intakeTargetRefuted(CardName.FISH)).to.be.true;
    // No dock in the JSDOM document → the run degrades instantly, but the
    // refutation must already be lifted by the registration step.
    await runHandIntake([{name: CardName.FISH}]);
    expect(intakeTargetRefuted(CardName.FISH)).to.be.false;
  });

  it('resetHandDelivery clears the refutations (game switch / teardown)', () => {
    handDeliveryState.inFlight = [CardName.FISH];
    refuteWithheldIntake(view({waitingForType: 'payment'}));
    resetHandDelivery();
    expect(intakeTargetRefuted(CardName.FISH)).to.be.false;
  });
});

/**
 * THE SAFETY NET CUTS A STALL, NEVER A SLOW FLIGHT. The run's budget is wall
 * clock, and a starved main thread stretches a GSAP timeline past it — measured
 * once under parallel 4K load: a taken card removed at ~80 % of its arc,
 * appearing in the hand without landing. A run still animating is extended
 * (bounded); a run with nothing moving is cut as it always was.
 */
describe('handDeliveryDirector — the safety net', () => {
  it('a run whose proxies are still moving is extended, not cut', () => {
    expect(intakeSafetyExtends(true, 0)).to.be.true;
    expect(intakeSafetyExtends(true, SAFETY_EXTENSIONS_MAX - 1)).to.be.true;
  });

  it('a run with nothing animating is stuck — cut on the first expiry', () => {
    expect(intakeSafetyExtends(false, 0)).to.be.false;
  });

  it('the extensions are BOUNDED — a proxy that animates forever cannot pin the run', () => {
    expect(intakeSafetyExtends(true, SAFETY_EXTENSIONS_MAX)).to.be.false;
    expect(SAFETY_EXTENSIONS_MAX).to.be.greaterThan(0);
  });
});

/**
 * THE POLL BUDGET IS TIME ON A QUIET SCREEN, NOT TICKS. `probeTick` falls back
 * to a timer when no frame comes, and the ~1.8 s landing poll counted such a
 * tick as ONE frame — ×3 in wall time (5.5 s) for a flight whose card never
 * arrives, long enough for the foreground watchdog to expire its hold.
 */
describe('handDeliveryDirector — the landing poll budget', () => {
  it('a painted frame spends one frame of the budget', () => {
    expect(pollTickCost('frame')).to.eq(1);
    expect(pollTickCost(undefined)).to.eq(1);
  });

  it('an idle timer tick spends the frames its interval spans (≈ 3 at 60 fps)', () => {
    expect(pollTickCost('timer')).to.eq(POLL_TIMER_TICK_FRAMES);
    expect(POLL_TIMER_TICK_FRAMES).to.eq(Math.round(PROBE_TICK_FALLBACK_MS / (1000 / 60)));
    expect(POLL_TIMER_TICK_FRAMES).to.be.greaterThan(1);
  });
});

/**
 * THE TOUCHDOWN BUS — «the card has landed in the dock» as a signal somebody
 * else may wait on (the Parliament's card step, TR37): fired by the very
 * release that materializes the dock card and ticks the counter, for every
 * intake path alike; a listener that throws never breaks the landing.
 */
describe('handDeliveryState — the touchdown bus', () => {
  afterEach(() => {
    resetHandDelivery();
  });

  it('every touchdown names its card; unsubscribing is idempotent; a throwing listener does not stop the release', () => {
    const landed: Array<string> = [];
    const off = onIntakeTouchdown((name) => landed.push(name));
    const offThrowing = onIntakeTouchdown(() => {
      throw new Error('a listener that misbehaves');
    });
    // The warn is captured, never printed: formatting the Error's stack resolves it through the WHOLE suite
    // bundle's source map — seconds on the first trace, past this test's timeout in the full client run.
    const warned: Array<unknown> = [];
    const originalWarn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(args[0]);
    };
    try {
      handDeliveryState.inFlight = [CardName.FISH, CardName.BIRDS];
      releaseInFlight(CardName.FISH);
      expect(handDeliveryState.inFlight, 'the in-flight copy is released').to.deep.eq([CardName.BIRDS]);
      expect(landed).to.deep.eq([CardName.FISH]);
      // A touchdown of a card that was never held in flight (a degraded run) still tells.
      releaseInFlight(CardName.BIRDS);
      releaseInFlight(CardName.BIRDS);
      expect(landed).to.deep.eq([CardName.FISH, CardName.BIRDS, CardName.BIRDS]);
      expect(warned, 'the misbehaving listener is named on every touchdown it threw on').to.have.lengthOf(3);
      off();
      off();
      offThrowing();
      releaseInFlight(CardName.FISH);
    } finally {
      console.warn = originalWarn;
    }
    expect(landed, 'unsubscribed — nothing more').to.have.lengthOf(3);
    expect(warned, 'unsubscribed — the thrower is not asked again').to.have.lengthOf(3);
  });
});
