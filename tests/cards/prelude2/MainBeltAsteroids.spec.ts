import {expect} from 'chai';
import {MainBeltAsteroids} from '../../../src/server/cards/prelude2/MainBeltAsteroids';
import {CometAiming} from '../../../src/server/cards/promo/CometAiming';
import {CEOsFavoriteProject} from '../../../src/server/cards/base/CEOsFavoriteProject';
import {testGame} from '../../TestGame';
import {churn, runAllActions, runNextAction} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';
import {MAIN_BELT_ASTEROIDS_PRICE} from '../../../src/server/cards/prelude2/MainBeltAsteroids';
import {SelectPayment} from '../../../src/server/inputs/SelectPayment';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {effectForecastForAction} from '../../../src/server/models/effectForecast';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {RotatorImpacts} from '../../../src/server/cards/venusNext/RotatorImpacts';
import {CardName} from '../../../src/common/cards/CardName';
import {AddResourcesToCard} from '../../../src/server/deferredActions/AddResourcesToCard';
import {CardResource} from '../../../src/common/CardResource';

describe('MainBeltAsteroids', () => {
  let card: MainBeltAsteroids;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new MainBeltAsteroids();
    [game, player] = testGame(2, {prelude2Expansion: true});
  });

  it('Cannot play', () => {
    player.megaCredits = 4;
    expect(card.canPlay(player)).is.false;
  });

  it('Should play', () => {
    player.megaCredits = 5;
    expect(card.canPlay(player)).is.true;

    player.playCard(card);
    // SelectPaymentDeferred
    runNextAction(game);

    expect(player.megaCredits).to.eq(0);

    player.addResourceTo(card, 5);
    expect(card.resourceCount).to.eq(5);
    expect(player.titanium).to.eq(5);

    expect(card.getVictoryPoints(player)).to.eq(2);
  });

  it('Should act automatically to itself', () => {
    player.megaCredits = 5;

    player.playCard(card);
    // SelectPaymentDeferred
    runNextAction(game);

    expect(card.canAct(player)).is.true;
    expect(card.action(player)).is.undefined;

    // Adding an asteroid to a card now always asks where (single candidate = card).
    cast(runNextAction(game), SelectCard).cb([card]);

    expect(game.deferredActions).has.lengthOf(0);
    expect(card.resourceCount).to.eq(1);
    expect(player.titanium).to.eq(1);

    expect(card.getVictoryPoints(player)).to.eq(0);
  });

  it('Should effect from other sources', () => {
    player.megaCredits = 5;

    player.playCard(card);
    // SelectPaymentDeferred
    runNextAction(game);

    const cometAiming = new CometAiming();
    player.playCard(cometAiming);

    player.titanium = 1;
    const cometChoice = cast(cometAiming.action(player), SelectCard<ICard>);
    cometChoice.cb([card]);

    expect(card.resourceCount).to.eq(1);
    expect(player.titanium).to.eq(1);

    const ceosFavoriteProject = new CEOsFavoriteProject();

    expect(ceosFavoriteProject.canPlay(player));
    player.playCard(ceosFavoriteProject);
    // CEO's Favorite Project doubles the asteroid on a card the player now picks
    // explicitly (single candidate = card).
    cast(runNextAction(game), SelectCard).cb([card]);

    expect(player.megaCredits).to.eq(0);
    expect(card.resourceCount).to.eq(2);
    expect(player.titanium).to.eq(2);

    expect(card.getVictoryPoints(player)).to.eq(1);
  });

  it('Should act to other cards', () => {
    player.megaCredits = 5;

    player.playCard(card);
    // SelectPaymentDeferred
    runNextAction(game);

    const cometAiming = new CometAiming();
    player.playCard(cometAiming);

    const choice = cast(churn(card.action(player), player), SelectCard);
    choice.cb([cometAiming]);

    expect(card.resourceCount).to.eq(0);
    expect(player.titanium).to.eq(0);
    expect(cometAiming.resourceCount).to.eq(1);
  });
  // ── P53 adaptation: the price, the reserve, the honest twin, the per-candidate tail ──

  function seat(c: ICard = card) {
    player.playedCards.push(c);
  }

  function cardStep(steps: ReadonlyArray<ActionPreviewStep>): SelectCardModel {
    const step = steps.find((s) => s.kind === 'input' && s.input.type === 'card');
    expect(step, 'the pick is pre-collected').not.undefined;
    return (step as {input: SelectCardModel}).input;
  }

  it('preview — the price chip (the start’s price gesture flies off it), read-only', () => {
    player.megaCredits = 40;
    const before = JSON.stringify(game.serialize());
    const effects = cardPlayPreview(player, card).branches[0].effects;
    expect(effects.find((e) => e.direction === 'cost')).deep.include({icon: 'megacredits', amount: MAIN_BELT_ASTEROIDS_PRICE, current: 40, resulting: 35});
    expect(JSON.stringify(game.serialize()), 'the preview never mutates').eq(before);
  });

  it('preview — Helion with heat: the payment step is pre-collected, addressed by its cause', () => {
    player.canUseHeatAsMegaCredits = true;
    player.megaCredits = 3;
    player.heat = 3;
    const step = cardPlayPreview(player, card).branches[0].steps.find((s) => s.kind === 'input');
    expect(step, 'the bill is asked').not.undefined;
    expect((step as {input: {amount: number}}).input.amount).eq(MAIN_BELT_ASTEROIDS_PRICE);
  });

  it('the live bill names its asker (`cause`) — Helion', () => {
    player.canUseHeatAsMegaCredits = true;
    player.megaCredits = 3;
    player.heat = 3;
    card.play(player);
    runAllActions(game);
    const pay = cast(player.popWaitingFor(), SelectPayment);
    expect(pay.choiceContext?.source).deep.eq({kind: 'card', card: CardName.MAIN_BELT_ASTEROIDS});
  });

  it('a price held back BEFORE the play (P45’s 12 M€) is honoured — `canAffordOptions.cost`', () => {
    player.megaCredits = 15;
    expect(card.canPlay(player)).is.true;
    expect(card.canPlay(player, {cost: 12}), '12 + 5 > 15').is.false;
    player.megaCredits = 17;
    expect(card.canPlay(player, {cost: 12})).is.true;
  });

  it('a shortfall is NAMED with its amount', () => {
    player.megaCredits = 2;
    expect(card.unplayableReason(player)).deep.eq({type: 'megacredits', message: 'Need ${0} more M€', params: ['3']});
    player.megaCredits = 5;
    expect(card.unplayableReason(player)).undefined;
  });

  it('twin — its own action, itself the only holder: EXACT +1 titanium (the pick is asked, its answer decided)', () => {
    seat();
    const preview = actionPreview(player, card);
    const facts = effectForecastForAction(player, card, preview).facts.filter((f) => f.source.name === card.name);
    expect(facts.map((f) => f.certainty)).deep.eq(['exact']);
    expect(facts[0].effects[0]).deep.include({icon: 'titanium', amount: 1});
    // …and the sole candidate carries the same tail as its tag.
    const pick = cardStep(preview.branches[0].steps);
    expect(pick.cards.map((c) => c.name)).deep.eq([card.name]);
    expect(pick.resourceGainPrompt?.extraByCard?.[card.name]?.map((e) => [e.icon, e.amount])).deep.eq([['titanium', 1]]);
    // VP box: 0 → 1 asteroid keeps 0 VP.
    expect(pick.resourceGainPrompt?.vpBox?.[card.name]).deep.include({from: 0, to: 0});
  });

  it('twin — its own action with ANOTHER holder: SILENT (the pick may go elsewhere); the tail rides the P53 candidate only', () => {
    seat();
    const comet = new CometAiming();
    seat(comet);
    const preview = actionPreview(player, card);
    const facts = effectForecastForAction(player, card, preview).facts.filter((f) => f.source.name === card.name);
    expect(facts, 'never a false exact, never an unknown').deep.eq([]);
    const pick = cardStep(preview.branches[0].steps);
    expect(pick.cards.map((c) => c.name).sort()).deep.eq([card.name, comet.name].sort());
    const extra = pick.resourceGainPrompt?.extraByCard ?? {};
    expect(extra[card.name]?.map((e) => [e.icon, e.amount])).deep.eq([['titanium', 1]]);
    expect(extra[comet.name], 'Comet Aiming answers nothing').undefined;
  });

  it('twin — the second asteroid moves the VP box 0 → 1', () => {
    seat();
    card.resourceCount = 1;
    const pick = cardStep(actionPreview(player, card).branches[0].steps);
    expect(pick.resourceGainPrompt?.vpBox?.[card.name]).deep.include({from: 0, to: 1});
  });

  it('the shared step any other card adds through (Directed Impactors, CEO’s Favorite Project) tags the P53 candidate too', () => {
    seat();
    seat(new CometAiming());
    seat(new RotatorImpacts());
    const pick = new AddResourcesToCard(player, CardResource.ASTEROID, {count: 1, autoSelect: false}).previewSelectCard();
    expect(pick?.resourceGainPrompt?.extraByCard?.[card.name]?.map((e) => [e.icon, e.amount])).deep.eq([['titanium', 1]]);
    expect(Object.keys(pick?.resourceGainPrompt?.extraByCard ?? {}), 'only the candidate that answers a landing on itself').deep.eq([card.name]);
  });

  it('a twin that answers ANY card (Martian Fiber-like) never becomes a per-candidate tag', () => {
    // The guard of `landingAnswerOf`: an answer to «any card» is the operation's, not one candidate's.
    seat();
    const twinAny = card.grantForecast(player, player, {kind: 'cardResource', resource: card.resourceType!, amount: 1, target: 'any'}, {operation: 'action', tiles: []});
    expect(twinAny, 'P53 says nothing about an addition to just any card').deep.eq([]);
  });
});
