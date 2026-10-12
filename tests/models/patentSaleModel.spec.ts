import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SellPatentsStandardProject} from '../../src/server/cards/base/standardProjects/SellPatentsStandardProject';
import {SELL_PATENTS_MEGACREDITS_PER_CARD} from '../../src/server/cards/base/standardProjects/patentSale';
import {StandardTechnology} from '../../src/server/cards/base/StandardTechnology';
import {MartianFiber} from '../../src/server/cards/turmoilRedux/MartianFiber';
import {patentSaleModel} from '../../src/server/models/patentSaleModel';
import {cardGain} from '../../src/server/cards/actionPreviews';
import * as forecast from '../../src/server/cards/effectForecastPreviews';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {Resource} from '../../src/common/Resource';
import {Phase} from '../../src/common/Phase';
import {PatentSaleModel} from '../../src/common/models/PatentSaleModel';
import {SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {fakeCard, runAllActions} from '../TestingUtils';

/**
 * THE PATENT SALE'S RATE (`SelectCardModel.patentSale`) — the fork hook
 * `ICard.onPatentsSold` (its one writer: the standard project) and the rate the
 * sale prompt carries to the console. The PARITY law: «rate × N» is what a
 * sale of N cards actually pays — the project's M€, each reactor's answer and
 * what answers it (Martian Fiber for data) — for N = 1, 3, 5, with and without
 * a second-order reactor. Pinned off a test reactor here (the shared layer);
 * TR46 Research Startups pins its own reading in its card spec.
 */

/** A data holder that answers the sale with `perCard` data here — the hook and its twin by one rate. */
function listener(perCard: number, opts: {twin?: boolean} = {}): IProjectCard {
  const card: IProjectCard = fakeCard({
    name: 'Patent Listener' as CardName,
    resourceType: CardResource.DATA,
    onPatentsSold: (player, sold) => player.addResourceTo(card, {qty: sold.length * perCard, log: true}),
  });
  if (opts.twin !== false) {
    card.patentsSoldForecast = (owner, count) => [forecast.exact(forecast.sourceOf(card, owner, 'standard-project'),
      [cardGain(card, count * perCard)], 'You sell patents')];
  }
  return card;
}

/** The sale prompt as the action menu builds it. */
function salePrompt(player: TestPlayer): SelectCard<IProjectCard> {
  return new SellPatentsStandardProject().action(player);
}

function modelOf(player: TestPlayer): PatentSaleModel {
  const model = salePrompt(player).toModel(player);
  expect(model.patentSale, 'the sale prompt carries its rate').is.not.undefined;
  return model.patentSale!;
}

/** «rate × N» on the seller's M€ (the project + every M€ answer of the seller) and on one card's pool. */
function promised(model: PatentSaleModel, count: number, host?: ICard): {megacredits: number, onCard: number} {
  let megacredits = model.megacreditsPerCard * count;
  let onCard = 0;
  for (const fact of model.answers ?? []) {
    expect(fact.recipient.kind, 'the seller is the only recipient in scope').eq('you');
    for (const effect of fact.effects) {
      expect(effect.current, 'a per-card chip carries no pool').is.undefined;
      expect(effect.resulting).is.undefined;
      if (effect.direction !== 'gain') {
        continue;
      }
      if (effect.icon === Resource.MEGACREDITS) {
        megacredits += effect.amount * count;
      } else if (host !== undefined && effect.host === host.name) {
        onCard += effect.amount * count;
      }
    }
  }
  return {megacredits, onCard};
}

describe('patentSaleModel — the patent sale\'s rate on the sale prompt', () => {
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  function deal(n: number): void {
    player.cardsInHand = game.projectDeck.drawN(game, n);
  }

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
  });

  it('a bare table: the project\'s own rate and no answers', () => {
    deal(3);
    expect(modelOf(player)).deep.eq({megacreditsPerCard: SELL_PATENTS_MEGACREDITS_PER_CARD});
    expect(SELL_PATENTS_MEGACREDITS_PER_CARD).eq(1);
  });

  it('the marker survives nesting: the action menu\'s «Sell patents» option carries it', () => {
    deal(2);
    const menu = player.getActions() as OrOptions;
    const sale = menu.options.find((o) => o instanceof SelectCard && o.toModel(player).patentSale !== undefined);
    expect(sale, 'the menu holds the marked sale').is.not.undefined;
    const model = menu.toModel(player) as unknown as {options: Array<SelectCardModel>};
    expect(model.options.filter((o) => o.patentSale !== undefined)).has.lengthOf(1);
  });

  for (const fiber of [false, true]) {
    for (const count of [1, 3, 5]) {
      it(`PARITY — ${count} card(s) sold${fiber ? ', Martian Fiber on the table' : ''}: the executed sale is «rate × N»`, () => {
        const holder = listener(1);
        player.playedCards.push(holder);
        if (fiber) {
          player.playedCards.push(new MartianFiber());
        }
        deal(6);
        const model = modelOf(player);
        expect(model.answers?.map((f) => f.source.name)).deep.eq(fiber ?
          ['Patent Listener', CardName.MARTIAN_FIBER] : ['Patent Listener']);
        const want = promised(model, count, holder);
        const before = {megacredits: player.megaCredits, onCard: holder.resourceCount};
        salePrompt(player).cb(player.cardsInHand.slice(0, count));
        runAllActions(game);
        expect(player.megaCredits - before.megacredits, 'M€').eq(want.megacredits);
        expect(holder.resourceCount - before.onCard, 'data on the listener').eq(want.onCard);
        expect(want.onCard).eq(count);
        expect(want.megacredits).eq(count * (fiber ? 2 : 1));
      });
    }
  }

  it('the hook gets the very cards sold, once per sale, after the sale\'s own journal line', () => {
    const seen: Array<ReadonlyArray<CardName>> = [];
    let soldLogged = false;
    player.playedCards.push(fakeCard({
      onPatentsSold: (_p, sold) => {
        soldLogged = game.gameLog.some((m) => m.message === '${0} sold ${1} patents');
        seen.push(sold.map((c) => c.name));
      },
    }));
    deal(4);
    const picked = player.cardsInHand.slice(1, 3);
    salePrompt(player).cb(picked);
    expect(seen).deep.eq([picked.map((c) => c.name)]);
    expect(soldLogged, 'the cause before its answer').is.true;
  });

  it('the SELLER\'s table only: a rival\'s reactor and a card in the hand answer nothing', () => {
    const rivals = listener(1);
    opponent.playedCards.push(rivals);
    const inHand = listener(1);
    deal(3);
    player.cardsInHand.push(inHand);
    expect(modelOf(player).answers).is.undefined;
    salePrompt(player).cb(player.cardsInHand.slice(0, 2));
    runAllActions(game);
    expect(rivals.resourceCount).eq(0);
    expect(inHand.resourceCount).eq(0);
  });

  it('a reactor with the live hook and no twin is an honest UNKNOWN, never silence', () => {
    player.playedCards.push(listener(1, {twin: false}));
    deal(2);
    const answers = modelOf(player).answers ?? [];
    expect(answers.map((f) => [f.source.name, f.certainty])).deep.eq([['Patent Listener', 'unknown']]);
  });

  it('the rate is read per serialization: a reactor played after the menu was built is in the next model', () => {
    deal(2);
    const prompt = salePrompt(player);
    expect(prompt.toModel(player).patentSale?.answers).is.undefined;
    player.playedCards.push(listener(1));
    expect(prompt.toModel(player).patentSale?.answers).has.lengthOf(1);
  });

  it('REGRESSION — Standard Technology still ignores the sale (its own `onStandardProject` exclusion)', () => {
    player.playedCards.push(new StandardTechnology());
    deal(2);
    expect(modelOf(player).answers).is.undefined;
    const before = player.megaCredits;
    salePrompt(player).cb(player.cardsInHand.slice(0, 2));
    runAllActions(game);
    expect(player.megaCredits - before).eq(2);
  });

  it('read-only: building the model mutates nothing', () => {
    player.playedCards.push(listener(1), new MartianFiber());
    deal(3);
    const before = JSON.stringify(game.serialize());
    patentSaleModel(player, new SellPatentsStandardProject());
    expect(JSON.stringify(game.serialize())).eq(before);
  });
});
