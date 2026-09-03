import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  intakeTargetRefuted, refuteWithheldIntake, resetHandDelivery, runHandIntake,
} from '@/client/console/handDock/handDeliveryDirector';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';

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
