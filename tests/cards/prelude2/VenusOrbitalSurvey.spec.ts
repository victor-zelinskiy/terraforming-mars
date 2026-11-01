import {expect} from 'chai';
import {churn, fakeCard, runAllActions} from '../../TestingUtils';
import {VENUS_ORBITAL_SURVEY_CHECK_LABEL, VENUS_ORBITAL_SURVEY_DECK_REASON, VenusOrbitalSurvey} from '../../../src/server/cards/prelude2/VenusOrbitalSurvey';
import {IGame} from '../../../src/server/IGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {Tag} from '../../../src/common/cards/Tag';
import {cast, toName} from '../../../src/common/utils/utils';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {CardName} from '../../../src/common/cards/CardName';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {SelectPaymentDeferred} from '../../../src/server/deferredActions/SelectPaymentDeferred';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {PreselectAddress} from '../../../src/common/inputs/preselectAddress';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';

describe('VenusOrbitalSurvey', () => {
  let card: VenusOrbitalSurvey;
  const emptyCard = () => fakeCard();
  const wildCard = () => fakeCard({tags: [Tag.WILD]});
  const venusCard = () => fakeCard({tags: [Tag.VENUS]});
  const earthCard = () => fakeCard({tags: [Tag.EARTH]});
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new VenusOrbitalSurvey();
    [game, player] = testGame(2);
  });

  it('Should play', () => {
    cast(card.play(player), undefined);
  });

  it('Should act if bought 0 of 2', () => {
    player.megaCredits = 6;
    const selectCard = cast(churn(card.action(player), player), SelectCard);
    selectCard.cb([]);

    expect(game.projectDeck.discardPile).has.lengthOf(2);
    expect(player.megaCredits).to.eq(6);
  });

  it('Should act if bought 1 of 2', () => {
    player.megaCredits = 3;
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    selectCard.cb([selectCard.cards[0]]);
    game.deferredActions.runNext();

    expect(player.cardsInHand).has.lengthOf(1);
    expect(game.projectDeck.discardPile).has.lengthOf(1);
    expect(player.megaCredits).to.eq(0);
  });

  it('Should act if bought 2 of 2', () => {
    player.megaCredits = 6;
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    selectCard.cb([selectCard.cards[0], selectCard. cards[1]]);
    game.deferredActions.runNext();

    expect(player.cardsInHand).has.lengthOf(2);
    expect(game.projectDeck.discardPile).has.lengthOf(0);
    expect(player.megaCredits).to.eq(0);
  });

  it('Should not offer if none to buy', () => {
    player.megaCredits = 6;
    game.projectDeck.drawPile.push(venusCard(), venusCard());
    cast(churn(card.action(player), player), undefined);

    expect(player.cardsInHand).has.lengthOf(2);
    expect(game.projectDeck.discardPile).has.lengthOf(0);
    expect(player.megaCredits).to.eq(6);
  });

  it('Should act if bought 0 of 1', () => {
    player.megaCredits = 6;
    game.projectDeck.drawPile.push(venusCard(), wildCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    selectCard.cb([]);
    game.deferredActions.runNext();

    expect(player.cardsInHand).has.lengthOf(1);
    expect(game.projectDeck.discardPile).has.lengthOf(1);
    expect(player.megaCredits).to.eq(6);
  });

  it('Should act if bought 1 of 1', () => {
    player.megaCredits = 6;
    game.projectDeck.drawPile.push(earthCard(), venusCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    selectCard.cb([selectCard.cards[0]]);
    game.deferredActions.runNext();

    expect(player.cardsInHand).has.lengthOf(2);
    expect(game.projectDeck.discardPile).has.lengthOf(0);
    expect(player.megaCredits).to.eq(3);
  });

  it('Cannot buy from 2 offered if cannot pay', () => {
    player.megaCredits = 2;
    game.projectDeck.drawPile.push(earthCard(), emptyCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    expect(selectCard.config.max).to.eq(0);
    selectCard.cb([]);

    expect(game.deferredActions).has.lengthOf(0);

    expect(player.cardsInHand).has.lengthOf(0);
    expect(game.projectDeck.discardPile).has.lengthOf(2);
    expect(player.megaCredits).to.eq(2);
  });

  it('Cannot buy from 1 offered if cannot pay', () => {
    player.megaCredits = 2;
    game.projectDeck.drawPile.push(venusCard(), emptyCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    expect(selectCard.config.max).to.eq(0);
    selectCard.cb([]);

    expect(game.deferredActions).has.lengthOf(0);

    expect(player.cardsInHand).has.lengthOf(1);
    expect(game.projectDeck.discardPile).has.lengthOf(1);
    expect(player.megaCredits).to.eq(2);
  });

  it('Cannot buy 2 offered if can pay for 1', () => {
    player.megaCredits = 5;
    game.projectDeck.drawPile.push(wildCard(), emptyCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    expect(selectCard.config.max).to.eq(1);
    selectCard.cb([selectCard.cards[1]]);

    game.deferredActions.runNext();

    expect(player.cardsInHand).has.lengthOf(1);
    expect(game.projectDeck.discardPile).has.lengthOf(1);
    expect(player.megaCredits).to.eq(2);
  });

  it('Logs venus cards taken and bought cards publicly by name', () => {
    player.megaCredits = 6;
    const venus = venusCard();
    const earth = earthCard();
    game.projectDeck.drawPile.push(earth, venus);
    game.gameLog = [];

    const selectCard = cast(churn(card.action(player), player), SelectCard);
    selectCard.cb([selectCard.cards[0]]);
    runAllActions(game);

    const publicMessages = game.gameLog.filter((entry) => entry.playerId === undefined);

    const drew = publicMessages.find((msg) => msg.message === '${0} drew ${1}')!;
    expect(drew.data[1].type).eq(LogMessageDataType.CARDS);
    expect(drew.data[1].value).to.have.members([venus].map(toName));

    const bought = publicMessages.find((msg) => msg.message === '${0} bought ${1}')!;
    expect(bought.data[1].type).eq(LogMessageDataType.CARDS);
    expect(bought.data[1].value).to.have.members([earth].map(toName));
  });
});

/*
 * ── PREMIUM (P88 adaptation, 2026-11-01) — the upstream block above stays byte for byte. ──
 * ONE reveal — ONE question: the buy prompt offers only the non-Venus cards, its marker carries
 * the Venus cards as COMPANIONS in reveal order, and they join the hand WITH the answer.
 */
describe('VenusOrbitalSurvey · premium', () => {
  let card: VenusOrbitalSurvey;
  let player: TestPlayer;
  let game: IGame;
  const venusCard = () => fakeCard({name: 'venus' as CardName, tags: [Tag.VENUS]});
  const earthCard = () => fakeCard({name: 'earth' as CardName, tags: [Tag.EARTH]});
  const spaceCard = () => fakeCard({name: 'space' as CardName, tags: [Tag.SPACE]});

  beforeEach(() => {
    card = new VenusOrbitalSurvey();
    [game, player] = testGame(2);
  });

  it('the marker carries the WHOLE reveal: companions in deck order, revealed = 2, the cards offered unchanged', () => {
    player.megaCredits = 6;
    const venus = venusCard();
    const earth = earthCard();
    // The deck deals from the END: `venus` comes up first, `earth` second.
    game.projectDeck.drawPile.push(earth, venus);
    const selectCard = cast(churn(card.action(player), player), SelectCard);

    expect(selectCard.cards.map(toName)).deep.eq([earth.name]);
    const meta = selectCard.deckPickPrompt!;
    expect(meta.mode).eq('buy');
    expect(meta.revealed).eq(2);
    expect(meta.max).eq(1);
    expect(meta.source).deep.include({kind: 'card', card: CardName.VENUS_ORBITAL_SURVEY});
    expect(meta.companions?.cards.map((c) => c.name)).deep.eq([venus.name]);
    expect(meta.companions?.check).deep.eq({tag: Tag.VENUS, label: VENUS_ORBITAL_SURVEY_CHECK_LABEL});
    expect(meta.companions?.destination).eq('hand');
    expect(meta.order).deep.eq([venus.name, earth.name]);
    // The model carries it too (nesting-safe — on the input's own toModel).
    expect((selectCard.toModel(player) as SelectCardModel).deckPickPrompt?.companions?.cards).has.length(1);
  });

  it('a companion is NOT in the hand before the answer — and is after, on every answer', () => {
    for (const answer of ['buy', 'skip'] as const) {
      [game, player] = testGame(2);
      player.megaCredits = 6;
      const venus = venusCard();
      const earth = earthCard();
      game.projectDeck.drawPile.push(earth, venus);
      const selectCard = cast(churn(card.action(player), player), SelectCard);
      expect(player.cardsInHand, `${answer}: nothing in the hand before the answer`).is.empty;

      selectCard.cb(answer === 'buy' ? [earth] : []);
      // Synchronous with the answer (before any payment is deferred).
      expect(player.cardsInHand.map(toName), `${answer}: the companion joins with the answer`).contains(venus.name);
      runAllActions(game);
      expect(player.cardsInHand.map(toName)).to.have.members(answer === 'buy' ? [venus.name, earth.name] : [venus.name]);
      expect(game.projectDeck.discardPile.map(toName)).to.have.members(answer === 'buy' ? [] : [earth.name]);
    }
  });

  it('max 0 (cannot afford) still asks, with the companion on the marker — «Ok» discards the rest', () => {
    player.megaCredits = 2;
    const venus = venusCard();
    const earth = earthCard();
    game.projectDeck.drawPile.push(earth, venus);
    const selectCard = cast(churn(card.action(player), player), SelectCard);
    expect(selectCard.config.max).eq(0);
    expect(selectCard.deckPickPrompt?.mode).eq('buy');
    expect(selectCard.deckPickPrompt?.max).eq(0);
    expect(selectCard.deckPickPrompt?.companions?.cards.map((c) => c.name)).deep.eq([venus.name]);
    expect(player.cardsInHand).is.empty;
    selectCard.cb([]);
    expect(player.cardsInHand.map(toName)).deep.eq([venus.name]);
    expect(game.projectDeck.discardPile.map(toName)).deep.eq([earth.name]);
  });

  it('two non-Venus cards: no companions on the marker (an ordinary buy)', () => {
    player.megaCredits = 6;
    game.projectDeck.drawPile.push(earthCard(), spaceCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);
    expect(selectCard.deckPickPrompt?.revealed).eq(2);
    expect(selectCard.deckPickPrompt?.companions).is.undefined;
    expect(selectCard.deckPickPrompt?.order).is.undefined;
  });

  it('both Venus: no question — ONE drawn batch named by this card, nothing twice', () => {
    player.megaCredits = 6;
    const a = venusCard();
    const b = fakeCard({name: 'venus2' as CardName, tags: [Tag.VENUS]});
    game.projectDeck.drawPile.push(a, b);
    cast(churn(card.action(player), player), undefined);
    expect(player.cardsInHand.map(toName)).to.have.members([a.name, b.name]);
    expect(player.cardsInHand).has.length(2);
    expect(player.cardDrawReveals).has.length(1);
    expect(player.cardDrawReveals[0].source).deep.eq({type: 'card', cardName: CardName.VENUS_ORBITAL_SURVEY});
    expect(player.cardDrawReveals[0].cards.map(toName)).to.have.members([a.name, b.name]);
  });

  it('a prompt path opens NO drawn batch (the companions ride the prompt, never a second intake)', () => {
    player.megaCredits = 6;
    game.projectDeck.drawPile.push(earthCard(), venusCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);
    selectCard.cb([selectCard.cards[0]]);
    runAllActions(game);
    expect(player.cardDrawReveals).is.empty;
    expect(player.cardsInHand).has.length(2);
  });

  it('the reveal is public and a fact: the log line carries the reveal marker, the event is recorded', () => {
    player.megaCredits = 6;
    game.projectDeck.drawPile.push(earthCard(), venusCard());
    game.gameLog = [];
    churn(card.action(player), player);
    const line = game.gameLog.find((m) => m.message === '${0} revealed ${1} and ${2}');
    expect(line?.playerId).is.undefined;
    expect(line?.reveal).deep.eq({origin: 'deck', result: 'revealed', source: CardName.VENUS_ORBITAL_SURVEY});
    const reveal = game.events.events.find((e) => e.type === 'card-revealed');
    expect(reveal?.impact.reveal).deep.eq({origin: 'deck', result: 'revealed', count: 2, found: true});
    expect(reveal?.source).deep.include({card: CardName.VENUS_ORBITAL_SURVEY});
  });

  it('the payment of a bought card names this card (cause)', () => {
    player.megaCredits = 6;
    game.projectDeck.drawPile.push(earthCard(), venusCard());
    const selectCard = cast(churn(card.action(player), player), SelectCard);
    selectCard.cb([selectCard.cards[0]]);
    const payment = game.deferredActions.peek() as SelectPaymentDeferred | undefined;
    expect(payment).instanceOf(SelectPaymentDeferred);
    expect(payment?.options.cause).deep.include({kind: 'card', card: CardName.VENUS_ORBITAL_SURVEY});
  });

  it('blocked with ONE named reason when the deck cannot deal 2 (draw pile + discard pile)', () => {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.projectDeck.drawPile.push(venusCard());
    expect(card.canAct(player)).is.false;
    expect(card.actionUnavailableReason(player)).deep.eq({type: 'rule', message: VENUS_ORBITAL_SURVEY_DECK_REASON});
    // One card on top + one in the discard pile: the deck CAN deal 2 (reshuffle) — no reason.
    game.projectDeck.discardPile.push(earthCard());
    expect(card.canAct(player)).is.true;
    expect(card.actionUnavailableReason(player)).is.undefined;
  });

  it('the preview: one branch, a split reveal (count, check, price, affordability, open deck size) — read-only', () => {
    player.megaCredits = 7;
    const before = JSON.stringify(game.serialize());
    const preview = actionPreview(player, card);
    expect(JSON.stringify(game.serialize()), 'the preview never mutates').eq(before);
    expect(preview.branches).has.length(1);
    const branch = preview.branches[0];
    expect(branch.available).is.true;
    expect(branch.reveal, 'never a single-card deck check').is.undefined;
    expect(branch.effects).is.empty;
    expect(branch.revealSplit).deep.eq({
      deck: 'project',
      count: 2,
      check: {tag: Tag.VENUS, label: VENUS_ORBITAL_SURVEY_CHECK_LABEL},
      match: {destination: 'hand', free: true},
      miss: {kind: 'buy', cardCost: 3, affordable: 2},
      deckSize: game.projectDeck.size(),
    });
  });

  it('the same question on every read of the model: the companions never move, nothing reaches the hand twice', () => {
    player.megaCredits = 6;
    const venus = venusCard();
    game.projectDeck.drawPile.push(earthCard(), venus);
    const selectCard = cast(churn(card.action(player), player), SelectCard);
    const model = selectCard.toModel(player) as SelectCardModel;
    const again = selectCard.toModel(player) as SelectCardModel;
    expect(again.deckPickPrompt).deep.eq(model.deckPickPrompt);
    selectCard.cb([]);
    runAllActions(game);
    expect(player.cardsInHand.filter((c) => c.name === venus.name)).has.length(1);
  });
  it('PICK-THEN-PAY IS ONE DECISION: the marker carries the payment the purchase WILL ask (Helion), none for M€ only', () => {
    player.megaCredits = 10;
    game.projectDeck.drawPile.push(earthCard(), venusCard());
    const plain = cast(churn(card.action(player), player), SelectCard);
    expect(plain.deckPickPrompt?.payment, 'M€ only: paid automatically, nothing asked').is.undefined;

    [game, player] = testGame(2);
    player.megaCredits = 10;
    player.canUseHeatAsMegaCredits = true;
    player.heat = 5;
    game.projectDeck.drawPile.push(earthCard(), venusCard());
    const helion = cast(churn(card.action(player), player), SelectCard);
    const payment = helion.deckPickPrompt?.payment;
    expect(payment?.type).eq('payment');
    expect(payment?.amount, 'priced for ONE card').eq(player.cardCost);
    expect(payment?.paymentOptions.heat).is.true;
  });

  it('ONE batch answers the purchase AND its payment (Helion pays 3 heat): +2 in the hand, nothing left asked', () => {
    player.megaCredits = 10;
    player.canUseHeatAsMegaCredits = true;
    player.heat = 5;
    const venus = venusCard();
    const earth = earthCard();
    game.projectDeck.drawPile.push(earth, venus);
    card.action(player);
    runAllActions(game);
    const select = cast(player.getWaitingFor(), SelectCard);
    const payFor = {source: {kind: 'card', card: CardName.VENUS_ORBITAL_SURVEY}, role: 'payment'} as PreselectAddress;
    replayBatch(player, [
      {type: 'card', cards: [select.cards[0].name]},
      {type: 'payment', payment: Payment.of({heat: 3}), for: payFor} as InputResponse,
    ]);
    runAllActions(game);
    expect(player.getWaitingFor(), 'the payment was answered by the batch').is.undefined;
    expect(parkedBatchTailLength(player)).eq(0);
    expect(player.cardsInHand.map(toName)).to.have.members([venus.name, earth.name]);
    expect(player.heat).eq(2);
    expect(player.megaCredits).eq(10);
  });
});
