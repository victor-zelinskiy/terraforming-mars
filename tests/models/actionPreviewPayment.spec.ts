import {expect} from 'chai';
import {testGame} from '../TestGame';
import {actionPreview} from '../../src/server/models/actionPreview';
import {SelectPaymentDeferred} from '../../src/server/deferredActions/SelectPaymentDeferred';
import {WaterImportFromEuropa} from '../../src/server/cards/base/WaterImportFromEuropa';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {RotatorImpacts} from '../../src/server/cards/venusNext/RotatorImpacts';

/*
 * The action-preview payment STEP: an action that defers a SelectPaymentDeferred
 * with an alternative resource (titanium / steel / …) embeds the payment choice
 * as an interactive step INSIDE the confirm modal — the player dials it in there
 * and it's committed by the single batch submit, instead of a separate follow-up
 * SelectPayment modal. When the player can ONLY pay in M€ the live path auto-pays,
 * so NO step is shown (a flat M€ cost chip is shown instead).
 */
describe('actionPreview payment step', () => {
  it('SelectPaymentDeferred.previewPaymentModel: alt resource available → a payment model; M€-only → undefined', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 100;

    // No titanium → can only pay in M€ → no choice → undefined (live auto-pays).
    player.titanium = 0;
    expect(new SelectPaymentDeferred(player, 12, {canUseTitanium: true}).previewPaymentModel()).is.undefined;

    // With titanium → a real choice → a SelectPayment model the modal can host.
    player.titanium = 3;
    const model = new SelectPaymentDeferred(player, 12, {canUseTitanium: true}).previewPaymentModel();
    expect(model, 'expected a payment model when titanium is usable').is.not.undefined;
    expect(model?.type).eq('payment');
    expect(model?.amount).eq(12);
    expect(model?.paymentOptions.titanium).is.true;

    // Amount 0 → nothing to pay → undefined.
    expect(new SelectPaymentDeferred(player, 0, {canUseTitanium: true}).previewPaymentModel()).is.undefined;
  });

  it('WaterImportFromEuropa: with titanium the preview carries a payment step + a board-placement note (no flat cost chip)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 100;
    player.titanium = 3;

    const preview = actionPreview(player, new WaterImportFromEuropa());
    const branch = preview.branches[0];
    expect(branch.available).is.true;

    const paymentStep = branch.steps.find((s) => s.kind === 'input' && s.input.type === 'payment');
    expect(paymentStep, 'expected an interactive payment step').is.not.undefined;
    expect(branch.steps.some((s) => s.kind === 'boardPlacement'), 'expected a board-placement note').is.true;
    // The payment is interactive, so there's NO flat M€ cost effect chip.
    expect(branch.effects.some((e) => e.icon === 'megacredits'), 'flat M€ cost should be replaced by the widget').is.false;
  });

  it('WaterImportFromEuropa: without titanium the preview falls back to a flat M€ cost chip + the placement note (no payment step)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 100;
    player.titanium = 0;

    const preview = actionPreview(player, new WaterImportFromEuropa());
    const branch = preview.branches[0];

    expect(branch.steps.some((s) => s.kind === 'input' && s.input.type === 'payment'), 'no payment step when M€-only').is.false;
    expect(branch.steps.some((s) => s.kind === 'boardPlacement')).is.true;
    const cost = branch.effects.find((e) => e.icon === 'megacredits');
    expect(cost, 'expected a flat M€ cost chip').is.not.undefined;
    expect(cost?.amount).eq(12);
  });

  it('AquiferPumping: with steel the preview carries a steel-enabled payment step', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 100;
    player.steel = 4;

    const preview = actionPreview(player, new AquiferPumping());
    const branch = preview.branches[0];
    const paymentStep = branch.steps.find((s) => s.kind === 'input' && s.input.type === 'payment');
    expect(paymentStep, 'expected a payment step').is.not.undefined;
    if (paymentStep?.kind === 'input' && paymentStep.input.type === 'payment') {
      expect(paymentStep.input.amount).eq(8);
      expect(paymentStep.input.paymentOptions.steel).is.true;
    }
  });

  it('RotatorImpacts (multi-branch): the add-asteroid branch carries a titanium payment step', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 100;
    player.titanium = 3;
    const card = new RotatorImpacts();
    card.resourceCount = 0; // no asteroid → only the "add" branch is available

    const preview = actionPreview(player, card);
    const addBranch = preview.branches.find((b) => b.available);
    expect(addBranch, 'the add-asteroid branch should be available').is.not.undefined;
    const payStep = addBranch?.steps.find((s) => s.kind === 'input' && s.input.type === 'payment');
    expect(payStep, 'expected a payment step on the add branch').is.not.undefined;
    // With the interactive payment, the flat M€ cost chip is dropped (the gain chip stays).
    expect(addBranch?.effects.some((e) => e.icon === 'megacredits'), 'flat M€ cost replaced by the widget').is.false;
  });
});
