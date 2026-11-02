import {expect} from 'chai';
import {BOARD_OF_DIRECTORS_DECK_REASON, BoardOfDirectors} from '../../../src/server/cards/prelude2/BoardOfDirectors';
import {testGame} from '../../TestGame';
import {Units} from '../../../src/common/Units';
import {runAllActions} from '../../TestingUtils';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {Loan} from '../../../src/server/cards/prelude/Loan';
import {HugeAsteroid} from '../../../src/server/cards/prelude/HugeAsteroid';
import {cast, toName} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardResource} from '../../../src/common/CardResource';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {PreselectAddress} from '../../../src/common/inputs/preselectAddress';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';

/** The log lines' rendered skeleton (the template + every card named in it), newest last. */
function logLines(game: IGame): Array<string> {
  return game.gameLog.map((m) => m.message + ' | ' + m.data.filter((d) => d.type === LogMessageDataType.CARD).map((d) => d.value).join(','));
}

describe('BoardOfDirectors', () => {
  it('play', () => {
    const card = new BoardOfDirectors();
    const [game, player] = testGame(1, {prelude2Expansion: true});

    card.play(player);
    runAllActions(game);
    expect(card.resourceCount).eq(4);
  });

  const canActRuns = [
    {preludeDeck: 0, resources: 0, expected: false},
    {preludeDeck: 1, resources: 0, expected: false},
    {preludeDeck: 0, resources: 1, expected: false},
    {preludeDeck: 1, resources: 1, expected: true},
  ] as const;
  for (const run of canActRuns) {
    it('canAct: ' + JSON.stringify(run), () => {
      const card = new BoardOfDirectors();
      const [game, player] = testGame(1, {preludeExtension: true});

      game.preludeDeck.drawPile.length = run.preludeDeck;
      card.resourceCount = run.resources;

      expect(card.canAct(player)).eq(run.expected);
    });
  }

  it('action, can afford', () => {
    const card = new BoardOfDirectors();
    const [game, player] = testGame(1, {preludeExtension: true});

    const loan = new Loan();
    game.preludeDeck.drawPile.push(loan);
    card.resourceCount = 1;
    expect(card.canAct(player)).eq(true);

    player.megaCredits = 15;
    const selectCard = cast(card.action(player), SelectCard);
    const prelude = selectCard.cards[0];

    expect(prelude).eq(loan);

    selectCard.cb([prelude]);
    runAllActions(game);

    expect(player.playedCards.get(loan.name)).deep.eq(loan);
    expect(card.resourceCount).eq(0);
    expect(player.megaCredits).eq(33);
    expect(player.production.megacredits).eq(-2);
  });

  it('action, can afford, fizzle', () => {
    const card = new BoardOfDirectors();
    const [game, player] = testGame(1, {preludeExtension: true});

    const loan = new Loan();
    game.preludeDeck.drawPile.push(loan);
    card.resourceCount = 1;
    expect(card.canAct(player)).eq(true);

    player.megaCredits = 15;
    player.production.adjust(Units.of({megacredits: -4}));
    const selectCard = cast(card.action(player), SelectCard);
    const prelude = selectCard.cards[0];

    expect(prelude).eq(loan);

    selectCard.cb([prelude]);
    runAllActions(game);

    expect(player.playedCards).does.not.contain(loan);
    expect(game.preludeDeck.discardPile).contains(loan);
    expect(card.resourceCount).eq(0);
    expect(player.megaCredits).eq(18);
    expect(player.production.megacredits).eq(-4);
  });

  // FORK (rule 2): upstream drew and discarded SILENTLY without the 12 M€ (`action()` → undefined). The fork shows the
  // drawn prelude — the prompt is asked with `max 0`, its only answer the discard, given by the player.
  it('action, cannot afford: the prelude is SHOWN (max 0), the answer [] discards it', () => {
    const card = new BoardOfDirectors();
    const [game, player] = testGame(1, {preludeExtension: true});

    const loan = new Loan();
    game.preludeDeck.drawPile.push(loan);
    card.resourceCount = 1;
    expect(card.canAct(player), 'money is not a gate: the deck turns').eq(true);

    player.megaCredits = 11;
    const selectCard = cast(card.action(player), SelectCard);
    expect(selectCard.cards).deep.eq([loan]);
    expect(selectCard.config.min).eq(0);
    expect(selectCard.config.max).eq(0);
    expect(selectCard.deckPickPrompt?.price).deep.eq({
      megacredits: 12,
      resourcesHere: {card: CardName.BOARD_OF_DIRECTORS, resource: CardResource.DIRECTOR, count: 1, have: 1},
      affordable: false,
      deficit: 1,
    });
    expect(() => selectCard.process({type: 'card', cards: [loan.name]})).to.throw();

    selectCard.cb([]);
    runAllActions(game);

    expect(player.playedCards).does.not.contain(loan);
    expect(game.preludeDeck.discardPile).contains(loan);
    expect(card.resourceCount).eq(1);
    expect(player.megaCredits).eq(11);
    expect(player.production.megacredits).eq(0);
  });

  it('action, can afford, decline', () => {
    const card = new BoardOfDirectors();
    const [game, player] = testGame(1, {preludeExtension: true});

    card.resourceCount = 1;
    expect(card.canAct(player)).eq(true);

    player.megaCredits = 15;
    const selectCard = cast(card.action(player), SelectCard);
    const prelude = selectCard.cards[0];
    selectCard.cb([]);
    runAllActions(game);

    expect(player.playedCards).does.not.contain(prelude);
    expect(game.preludeDeck.discardPile).contains(prelude);
    expect(card.resourceCount).eq(1);
    expect(player.megaCredits).eq(15);
  });

  describe('fork adaptation', () => {
    let card: BoardOfDirectors;
    let game: IGame;
    let player: TestPlayer;

    beforeEach(() => {
      card = new BoardOfDirectors();
      [game, player] = testGame(2, {preludeExtension: true, prelude2Expansion: true});
      player.playedCards.push(card);
      card.resourceCount = 4;
    });

    it('the verdict is the mid-game deck pick in `play` mode with the price', () => {
      const loan = new Loan();
      game.preludeDeck.drawPile.push(loan);
      player.megaCredits = 40;
      const selectCard = cast(card.action(player), SelectCard);
      expect(selectCard.config.min).eq(0);
      expect(selectCard.config.max).eq(1);
      const marker = selectCard.deckPickPrompt;
      expect(marker?.mode).eq('play');
      expect(marker?.origin).eq('prelude');
      expect(marker?.min).eq(0);
      expect(marker?.max).eq(1);
      expect(marker?.source).deep.eq({kind: 'card', card: CardName.BOARD_OF_DIRECTORS});
      expect(marker?.price).deep.eq({
        megacredits: 12,
        resourcesHere: {card: CardName.BOARD_OF_DIRECTORS, resource: CardResource.DIRECTOR, count: 1, have: 4},
        affordable: true,
      });
      expect(marker?.payment, 'M€ only: the payment is automatic').is.undefined;
      expect(selectCard.startGamePrompt).is.undefined;
    });

    it('the draw is PUBLIC and named; the outcomes log in the present tense', () => {
      const loan = new Loan();
      game.preludeDeck.drawPile.push(loan);
      player.megaCredits = 40;
      const selectCard = cast(card.action(player), SelectCard);
      const draw = game.gameLog.find((m) => m.message === '${0} draws a prelude from ${1}: ${2}');
      expect(draw, 'the draw line').is.not.undefined;
      expect(draw?.playerId, 'public — never reserved for the drawer').is.undefined;
      expect(draw?.reveal).deep.eq({origin: 'prelude', result: 'revealed', source: CardName.BOARD_OF_DIRECTORS});
      selectCard.cb([loan]);
      runAllActions(game);
      expect(logLines(game)).to.include('${0} pays 12 M€ and 1 director to play ${1} | ' + CardName.LOAN);
    });

    it('the discard names the card', () => {
      const loan = new Loan();
      game.preludeDeck.drawPile.push(loan);
      player.megaCredits = 40;
      const selectCard = cast(card.action(player), SelectCard);
      selectCard.cb([]);
      runAllActions(game);
      expect(logLines(game)).to.include('${0} discards ${1} to the prelude discard pile | ' + CardName.LOAN);
    });

    it('the fizzle verdict holds the 12 M€ back: Huge Asteroid (pay 5 M€) at 15 M€ burns', () => {
      const asteroid = new HugeAsteroid();
      game.preludeDeck.drawPile.push(asteroid);
      player.megaCredits = 15;
      expect(asteroid.canPlay(player), 'on its own it is playable').eq(true);
      player.defer(card.action(player));
      runAllActions(game);
      const model = cast(player.getWaitingFor(), SelectCard).toModel(player) as SelectCardModel;
      expect(model.cards[0].preludeOutlook?.state).eq('noEffect');
      expect(asteroid.warnings.has('preludeFizzle')).eq(true);
    });

    it('ONE batch answers the pick AND its payment (Helion pays with heat)', () => {
      const loan = new Loan();
      game.preludeDeck.drawPile.push(loan);
      player.megaCredits = 5;
      player.canUseHeatAsMegaCredits = true;
      player.heat = 20;
      player.defer(card.action(player));
      runAllActions(game);
      const select = cast(player.getWaitingFor(), SelectCard);
      expect(select.deckPickPrompt?.payment?.amount, 'the payment rides the marker').eq(12);
      const payFor = {source: {kind: 'card', card: CardName.BOARD_OF_DIRECTORS}, role: 'payment'} as PreselectAddress;
      replayBatch(player, [
        {type: 'card', cards: [loan.name]},
        {type: 'payment', payment: Payment.of({megacredits: 5, heat: 7}), for: payFor} as InputResponse,
      ]);
      runAllActions(game);
      expect(player.getWaitingFor(), 'the payment was answered by the batch').is.undefined;
      expect(parkedBatchTailLength(player)).eq(0);
      expect(player.playedCards.asArray().map(toName)).to.include(CardName.LOAN);
      expect(player.heat).eq(13);
      expect(player.megaCredits).eq(30);
      expect(card.resourceCount).eq(3);
    });

    it('a burn pays the price and gets 15 M€ from the burned card', () => {
      const loan = new Loan();
      game.preludeDeck.drawPile.push(loan);
      player.megaCredits = 40;
      player.production.adjust(Units.of({megacredits: -4}));
      const selectCard = cast(card.action(player), SelectCard);
      selectCard.cb([loan]);
      runAllActions(game);
      expect(player.megaCredits).eq(43);
      expect(card.resourceCount).eq(3);
      expect(game.preludeDeck.discardPile).contains(loan);
    });

    it('the fourth use takes the last director: the action is blocked and NAMED', () => {
      // At the −5 floor every Loan burns — and a burn spends the director too.
      player.production.adjust(Units.of({megacredits: -5}));
      for (let i = 0; i < 4; i++) {
        game.preludeDeck.drawPile.push(new Loan());
        player.megaCredits = 40;
        const select = cast(card.action(player), SelectCard);
        select.cb([select.cards[0]]);
        runAllActions(game);
      }
      expect(card.resourceCount).eq(0);
      expect(card.canAct(player)).eq(false);
      expect(card.actionUnavailableReason(player)).deep.eq({type: 'count', message: '${0} of ${1} {director|directors} on this card', params: ['0', '1'], current: 0});
    });

    it('an empty prelude deck AND discard pile: blocked by the deck', () => {
      game.preludeDeck.drawPile.length = 0;
      game.preludeDeck.discardPile.length = 0;
      expect(card.canAct(player)).eq(false);
      expect(card.actionUnavailableReason(player)).deep.eq({type: 'rule', message: BOARD_OF_DIRECTORS_DECK_REASON});
    });

    it('PREVIEW — one branch, `revealVerdict`, nothing counted', () => {
      player.megaCredits = 7;
      const preview = actionPreview(player, card);
      expect(preview.branches).has.length(1);
      const branch = preview.branches[0];
      expect(branch.available).eq(true);
      expect(branch.effects).deep.eq([]);
      expect(branch.revealVerdict).deep.eq({
        deck: 'prelude',
        count: 1,
        deckSize: game.preludeDeck.drawPile.length,
        discardSize: game.preludeDeck.discardPile.length,
        play: {
          megacredits: 12,
          resourcesHere: {card: CardName.BOARD_OF_DIRECTORS, resource: CardResource.DIRECTOR, count: 1, have: 4},
          affordable: false,
          deficit: 5,
        },
        miss: {kind: 'discard'},
      });
    });
  });
});
