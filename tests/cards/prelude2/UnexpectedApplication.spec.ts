import {expect} from 'chai';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {HousePrinting} from '../../../src/server/cards/prelude/HousePrinting';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {runAllActions, setRulingParty} from '../../TestingUtils';
import {PartyName} from '@/common/turmoil/PartyName';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {UnexpectedApplication} from '../../../src/server/cards/prelude2/UnexpectedApplication';
import {cast} from '../../../src/common/utils/utils';
import {Phase} from '../../../src/common/Phase';
import {Tag} from '../../../src/common/cards/Tag';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {PreselectAddress} from '../../../src/common/inputs/preselectAddress';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';

describe('UnexpectedApplication', () => {
  let card: UnexpectedApplication;
  let game: IGame;
  let player: TestPlayer;
  let tardigrades: IProjectCard;
  let housePrinting: IProjectCard;

  beforeEach(() => {
    card = new UnexpectedApplication();
    [game, player] = testGame(2);
    player.cardsInHand.push(card);
    tardigrades = new Tardigrades();
    housePrinting = new HousePrinting();
  });

  it('can not play', () => {
    expect(card.canPlay(player)).is.false;
  });

  it('Should play', () => {
    player.cardsInHand.push(housePrinting, tardigrades);
    expect(card.canPlay(player)).is.true;

    player.playCard(card);
    const selectCard = cast(game.deferredActions.pop()!.execute(), SelectCard<IProjectCard>);

    expect(selectCard.cards).to.not.include(card);

    selectCard.cb([housePrinting]);
    runAllActions(game); // Draw cards
    expect(player.cardsInHand).does.not.contain(housePrinting);
    expect(game.projectDeck.discardPile).contains(housePrinting);
  });

  it('Does not expect itself to be the discarded card', () => {
    player.cardsInHand.push(card);

    expect(card.canPlay(player)).is.false;

    player.cardsInHand.push(tardigrades);

    expect(card.canPlay(player)).is.true;

    player.playCard(card);
    const selectCard = cast(game.deferredActions.pop()!.execute(), SelectCard<IProjectCard>);

    expect(selectCard.cards).to.not.include(card);

    selectCard.cb([tardigrades]);

    runAllActions(game);

    expect(player.cardsInHand).does.not.contain(tardigrades);
    expect(game.projectDeck.discardPile).contains(tardigrades);
  });

  it('canAct when reds are in power', () => {
    [game, player] = testGame(2, {turmoilExtension: true, venusNextExtension: true});
    setRulingParty(game, PartyName.REDS);
    player.cardsInHand.push(card, tardigrades);
    player.megaCredits = 6;

    expect(player.canPlay(card)).is.false;

    player.megaCredits = 7;

    expect(player.canPlay(card)).is.true;
  });
});

/**
 * P86 — UNEXPECTED APPLICATION IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 1 — declarative): the
 * ONLY `spend.cards` declaration in scope. The discard is the play's PRICE: the executor defers it FIRST (the Venus
 * step runs in its callback), and the preview pre-collects it as the play's FIRST step — built by the SAME function
 * (`spendCardsDiscardPrompt`), so the console asks it in the hand album BEFORE the press and the ONE batch answers it.
 */
describe('UnexpectedApplication — premium', () => {
  type Table = {game: IGame, p1: TestPlayer, card: UnexpectedApplication};

  function table(others: ReadonlyArray<IProjectCard> = [new Tardigrades(), new HousePrinting()]): Table {
    const [game, p1] = testGame(2, {venusNextExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new UnexpectedApplication();
    p1.cardsInHand.push(card, ...others);
    p1.megaCredits = 10;
    return {game, p1, card};
  }

  function discardStep(t: Table): ActionPreviewStep | undefined {
    const preview = cardPlayPreview(t.p1, t.card);
    return preview.branches.flatMap((b) => b.steps).find((s) => s.kind === 'input');
  }

  function inputOf(step: ActionPreviewStep | undefined): SelectCardModel {
    return (step as {input: SelectCardModel}).input;
  }

  it('rule 1 — the printed card: an event, 4 M€, Venus, P86, dealt with Venus, not political', () => {
    const c = new UnexpectedApplication();
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(4);
    expect(c.tags).deep.eq([Tag.VENUS]);
    expect(c.metadata.cardNumber).eq('P86');
    expect(c.behavior?.spend).deep.eq({cards: 1});
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.UNEXPECTED_APPLICATION];
    expect(spec?.compatibility).eq('venus');
    expect(spec?.politics, 'not a political card').is.undefined;
  });

  describe('rule 2 — the discard is the FIRST pre-collected step of the play, the twin of the live prompt', () => {
    it('the preview: ONE card step, the hand without this card, the discard marker + its address, read-only', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const step = discardStep(t);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
      expect(step, 'the discard is pre-collected').is.not.undefined;
      const input = inputOf(step);
      expect(input.type).eq('card');
      expect(input.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES, CardName.HOUSE_PRINTING]);
      expect(input.discardPrompt).deep.include({min: 1, max: 1, source: {kind: 'card', card: CardName.UNEXPECTED_APPLICATION}});
      expect((step as {for?: unknown}).for).deep.eq({role: 'discard', source: {kind: 'card', card: CardName.UNEXPECTED_APPLICATION}});
    });

    it('byte parity: the model of the step IS the model of the live prompt (title, cards, bounds, marker)', () => {
      const t = table();
      const step = discardStep(t);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const live = cast(t.p1.getWaitingFor(), SelectCard<IProjectCard>);
      expect(JSON.stringify(inputOf(step))).eq(JSON.stringify(live.toModel(t.p1)));
    });

    it('ONE other card: the step is still declared — the question is ASKED (T14: the composer seeds it, nothing is applied)', () => {
      const t = table([new Tardigrades()]);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(inputOf(discardStep(t)).cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(cast(t.p1.getWaitingFor(), SelectCard<IProjectCard>).cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
    });

    it('NO other card: not playable, with ONE named reason', () => {
      const t = table([]);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card).map((r) => r.message)).include('Requires another card in hand to discard');
    });
  });

  describe('rule 3 — the price before the result, through the ONE discard path', () => {
    it('the addressed batch answer lands on the discard: nothing parked, no prompt left, the card on the pile, Venus +1 step, TR +1', () => {
      const t = table();
      const step = discardStep(t);
      const venus = t.game.getVenusScaleLevel();
      const tr = t.p1.terraformRating;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.game.getVenusScaleLevel(), 'the Venus step waits for the price').eq(venus);
      const answer = {type: 'card', cards: [CardName.HOUSE_PRINTING], for: (step as {for?: PreselectAddress}).for};
      replayBatch(t.p1, [answer as InputResponse]);
      runAllActions(t.game);
      expect(parkedBatchTailLength(t.p1)).eq(0);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      expect(t.game.projectDeck.discardPile.map((c) => c.name)).include(CardName.HOUSE_PRINTING);
      expect(t.game.getVenusScaleLevel()).eq(venus + 2);
      expect(t.p1.terraformRating).eq(tr + 1);
    });

    it('the discard is journaled («… discarded …» naming the card) and the Venus step is recorded after the answer', () => {
      const t = table();
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const logFrom = t.game.gameLog.length;
      const eventsFrom = t.game.events.events.length;
      expect(t.game.events.events.filter((e) => e.type === 'global-parameter-changed'), 'nothing moved before the price').has.length(0);
      cast(t.p1.popWaitingFor(), SelectCard<IProjectCard>).cb([t.p1.cardsInHand.find((c) => c.name === CardName.TARDIGRADES)!]);
      runAllActions(t.game);
      const discarded = t.game.gameLog.slice(logFrom).find((l) => l.message === '${0} discarded ${1}');
      expect(discarded, 'the discard has its journal line').is.not.undefined;
      expect(discarded?.data.map((d) => d.value)).include(CardName.TARDIGRADES);
      expect(t.game.events.events.slice(eventsFrom).some((e) => e.type === 'global-parameter-changed')).is.true;
    });
  });

  describe('rule 4 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Venus; absent without either', () => {
      expect(dealt({prelude2Expansion: true, venusNextExtension: true})).include(CardName.UNEXPECTED_APPLICATION);
      expect(dealt({prelude2Expansion: false, venusNextExtension: true})).not.include(CardName.UNEXPECTED_APPLICATION);
      expect(dealt({prelude2Expansion: true, venusNextExtension: false})).not.include(CardName.UNEXPECTED_APPLICATION);
    });

    it('save / reload: the event on the played pile, the discard on the pile, the rest of the hand kept', () => {
      const t = table();
      t.p1.playCard(t.card);
      runAllActions(t.game);
      cast(t.p1.popWaitingFor(), SelectCard<IProjectCard>).cb([t.p1.cardsInHand.find((c) => c.name === CardName.TARDIGRADES)!]);
      runAllActions(t.game);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.playedCards.get(CardName.UNEXPECTED_APPLICATION)).is.not.undefined;
      expect(owner.cardsInHand.map((c) => c.name)).deep.eq([CardName.HOUSE_PRINTING]);
      expect(reloaded.projectDeck.discardPile.map((c) => c.name)).include(CardName.TARDIGRADES);
    });

    it('a MarsBot table refuses Prelude 2 today (§5 of the adaptation)', () => {
      expect(() => testAutomaGame({venusNextExtension: true, prelude2Expansion: true})).to.throw(/does not support Prelude 2/);
    });
  });
});
