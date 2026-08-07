import {expect} from 'chai';
import {Factorum} from '../../../src/server/cards/promo/Factorum';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SelectPayment} from '../../../src/server/inputs/SelectPayment';
import {Payment} from '../../../src/common/inputs/Payment';
import {Tag} from '../../../src/common/cards/Tag';
import {Helion} from '../../../src/server/cards/corporation/Helion';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';
import {actionPreview} from '../../../src/server/models/actionPreview';

describe('Factorum', () => {
  let card: Factorum;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Factorum();
    [game, player] = testGame(2);
    player.playedCards.push(card);
  });

  it('Should play', () => {
    cast(card.play(player), undefined);
    expect(player.production.steel).to.eq(1);
    player.megaCredits = 10;

    const orOptions = cast(card.action(player), OrOptions);
    expect(orOptions.options).has.lengthOf(2);
    const drawCardOption = cast(orOptions.options[1], SelectOption);

    drawCardOption.cb(undefined);
    runAllActions(game);
    expect(player.cardsInHand).has.lengthOf(1);
    expect(player.megaCredits).to.eq(7);

    const gainEnergyProductionOption = cast(orOptions.options[0], SelectOption);
    gainEnergyProductionOption.cb(undefined);
    expect(player.production.energy).to.eq(1);
  });

  // The LONE legal option is RESOLVED, not returned. Returning it left a bare
  // `SelectOption` standing as the next prompt — a forced confirm of the only
  // thing that could happen — which the action preview says is not there
  // (`orBranches` gives a lone available branch index -1, so the pre-collected
  // batch submits nothing for it) and which surfaced as a generic confirmation
  // band outside the console's action workspace.
  it('Only offer building card if player has energy — and ask NOTHING extra', () => {
    cast(card.play(player), undefined);
    player.megaCredits = 10;
    player.energy = 1;

    cast(card.action(player), undefined);
    runAllActions(game);
    expect(player.cardsInHand).has.lengthOf(1);
    expect(player.cardsInHand[0].tags).includes(Tag.BUILDING);
    expect(player.megaCredits).to.eq(7);
    expect(player.popWaitingFor(), 'no leftover confirm').is.undefined;
  });

  it('Only offer energy production when the draw is unaffordable', () => {
    cast(card.play(player), undefined);
    player.megaCredits = 0;
    player.energy = 0;

    cast(card.action(player), undefined);
    runAllActions(game);
    expect(player.production.energy).to.eq(1);
    expect(player.popWaitingFor(), 'no leftover confirm').is.undefined;
  });

  it('Factorum + Helion', () => {
    const helion = new Helion();
    helion.play(player);
    player.playedCards.push(helion);

    player.megaCredits = 2;
    player.energy = 5;

    expect(card.canAct(player)).is.false;
    player.heat = 1;
    expect(card.canAct(player)).is.true;

    // Setting a larger amount of heat just to make the test results more interesting
    player.heat = 5;

    cast(card.action(player), undefined);
    runAllActions(game);

    const selectPayment = cast(player.popWaitingFor(), SelectPayment);
    selectPayment.cb({...Payment.EMPTY, megacredits: 1, heat: 2});

    expect(player.cardsInHand).has.lengthOf(1);
    expect(player.megaCredits).to.eq(1);
    expect(player.heat).to.eq(3);
  });

  // The Helion payment above is a real CHOICE, so the preview must PRE-COLLECT
  // it (a payment step) instead of letting it arrive as a follow-up modal after
  // the action was already confirmed.
  it('preview: the draw branch carries a payment step when heat can pay, a flat cost chip otherwise', () => {
    cast(card.play(player), undefined);
    player.megaCredits = 10;
    player.energy = 1;

    const plain = actionPreview(player, card).branches[1];
    expect(plain.steps.some((s) => s.kind === 'input' && s.input.type === 'payment'), 'M€-only pays automatically').is.false;
    expect(plain.effects.some((e) => e.icon === 'megacredits' && e.direction === 'cost')).is.true;

    player.canUseHeatAsMegaCredits = true;
    player.heat = 5;
    const withHeat = actionPreview(player, card).branches[1];
    const pay = withHeat.steps.find((s) => s.kind === 'input' && s.input.type === 'payment');
    expect(pay, 'expected an interactive payment step').is.not.undefined;
    // The widget states the cost — a flat chip beside it would say it twice.
    expect(withHeat.effects.some((e) => e.icon === 'megacredits' && e.direction === 'cost')).is.false;
  });
});
