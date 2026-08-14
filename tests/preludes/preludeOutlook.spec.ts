import {expect} from 'chai';
import {computePreludeOutlooks, preludeProvisions} from '../../src/server/preludes/preludeOutlook';
import {CardName} from '../../src/common/cards/CardName';
import {PreludeOutlook} from '../../src/common/cards/PreludeOutlook';
import {DoubleDown} from '../../src/server/cards/promo/DoubleDown';
import {EccentricSponsor} from '../../src/server/cards/prelude/EccentricSponsor';
import {EcologyExperts} from '../../src/server/cards/prelude/EcologyExperts';
import {MartianIndustries} from '../../src/server/cards/prelude/MartianIndustries';
import {AlliedBanks} from '../../src/server/cards/prelude/AlliedBanks';
import {Biolab} from '../../src/server/cards/prelude/Biolab';
import {IPreludeCard} from '../../src/server/cards/prelude/IPreludeCard';
import {testGame} from '../TestGame';
import {Pets} from '../../src/server/cards/base/Pets';

/**
 * THE ORDER-AWARE VERDICT — «can this prelude's effect resolve now, and if not,
 * can the ORDER still fix it?»
 *
 * The defect this replaces: one bit (`preludeFizzle`) could not tell «Удвоение
 * played first has nothing to copy YET» from «this can no longer work», so the
 * UI advertised the order fix over a button that discarded the card. Every
 * assertion here keeps those two apart — and keeps the engine from promising a
 * fix it cannot actually see.
 */

function deferred(outlook: PreludeOutlook | undefined) {
  expect(outlook?.state, JSON.stringify(outlook)).to.eq('deferred');
  return outlook as Extract<PreludeOutlook, {state: 'deferred'}>;
}

describe('preludeOutlook (order-aware prelude verdict)', () => {
  it('a prelude that can resolve right now is simply playable', () => {
    const [/* game */, player] = testGame(2);
    const industries = new MartianIndustries();
    expect(computePreludeOutlooks(player, [industries], [industries]).get(CardName.MARTIAN_INDUSTRIES))
      .to.deep.eq({state: 'playable'});
  });

  /**
   * SCENARIO 1 — the copy prelude. Played first it has nothing to copy, and ANY
   * other prelude fixes that outright by being played. That is the one case the
   * engine may call `guaranteed`.
   */
  it('a copy prelude with nothing played yet is DEFERRED · guaranteed, naming EVERY enabler', () => {
    const [/* game */, player] = testGame(2);
    const doubleDown = new DoubleDown();
    const industries = new MartianIndustries();
    const banks = new AlliedBanks();
    player.preludeCardsInHand.push(doubleDown, industries, banks);

    const d = deferred(computePreludeOutlooks(player, [doubleDown], player.preludeCardsInHand)
      .get(CardName.DOUBLE_DOWN));
    expect(d.certainty, 'playing a prelude IS what creates a played prelude').to.eq('guaranteed');
    expect(d.need).to.eq('playedPrelude');
    // EVERY enabler, never an arbitrary pick — the UI must not choose for the player.
    expect([...d.enablers].sort()).to.deep.eq([CardName.ALLIED_BANK, CardName.MARTIAN_INDUSTRIES].sort());
  });

  it('…and becomes plain playable the moment a prelude is in play — no card-specific code', () => {
    const [/* game */, player] = testGame(2);
    const doubleDown = new DoubleDown();
    player.playedCards.push(new MartianIndustries());
    player.preludeCardsInHand.push(doubleDown);

    expect(computePreludeOutlooks(player, [doubleDown], player.preludeCardsInHand).get(CardName.DOUBLE_DOWN))
      .to.deep.eq({state: 'playable'});
  });

  it('a copy prelude ALONE in hand with nothing played has no order left — noEffect', () => {
    const [/* game */, player] = testGame(2);
    const doubleDown = new DoubleDown();
    player.preludeCardsInHand.push(doubleDown);

    const outlook = computePreludeOutlooks(player, [doubleDown], player.preludeCardsInHand)
      .get(CardName.DOUBLE_DOWN);
    expect(outlook?.state, 'nothing remaining can create a played prelude').to.eq('noEffect');
  });

  /**
   * SCENARIO 2 — the prelude whose target is a card in hand. A draw MAY open a
   * target; nothing can promise it. The engine must say `possible`, and the UI
   * must therefore never claim the draw solves anything.
   */
  it('a target-in-hand prelude with an empty hand is DEFERRED but only POSSIBLE', () => {
    const [/* game */, player] = testGame(2);
    const sponsor = new EccentricSponsor();
    const biolab = new Biolab(); // draws 3
    player.cardsInHand.length = 0;
    player.preludeCardsInHand.push(sponsor, biolab);

    const d = deferred(computePreludeOutlooks(player, [sponsor], player.preludeCardsInHand)
      .get(CardName.ECCENTRIC_SPONSOR));
    expect(d.certainty, 'an unseen draw is never a guarantee').to.eq('possible');
    expect(d.need).to.eq('playableCard');
    expect(d.enablers).to.deep.eq([CardName.BIOLAB]);
  });

  it('…and is a final noEffect when nothing remaining could open a target', () => {
    const [/* game */, player] = testGame(2);
    const sponsor = new EccentricSponsor();
    const experts = new EcologyExperts(); // needs a playable card itself, and supplies none
    player.cardsInHand.length = 0;
    player.preludeCardsInHand.push(sponsor, experts);

    expect(computePreludeOutlooks(player, [sponsor], player.preludeCardsInHand)
      .get(CardName.ECCENTRIC_SPONSOR)?.state,
    'an enabler that cannot be played itself is a second dead end, not advice').to.eq('noEffect');
  });

  it('a card that never declared an order dependency gets no false hope — noEffect', () => {
    const [/* game */, player] = testGame(2);
    const biolab = new Biolab();
    // Stand in for any ordinary unplayable prelude: unplayable, and silent
    // about whether the order could save it.
    const silent = {
      name: CardName.SUPPLIER,
      preludeNeeds: undefined,
      canPlay: () => false,
      behavior: undefined,
    } as unknown as IPreludeCard;

    expect(computePreludeOutlooks(player, [silent], [silent, biolab]).get(CardName.SUPPLIER))
      .to.deep.eq({state: 'noEffect'});
  });

  /** The engine asks the card's REAL canPlay — it never re-implements a rule. */
  it('a hand with a playable project makes the target-in-hand prelude playable', () => {
    const [/* game */, player] = testGame(2);
    const sponsor = new EccentricSponsor();
    player.cardsInHand.length = 0;
    player.cardsInHand.push(new Pets());
    player.megaCredits = 100;
    player.preludeCardsInHand.push(sponsor);

    expect(computePreludeOutlooks(player, [sponsor], player.preludeCardsInHand).get(CardName.ECCENTRIC_SPONSOR))
      .to.deep.eq({state: 'playable'});
  });

  /** READ-ONLY: the verdict may never move the game an inch. */
  it('computing a verdict mutates nothing', () => {
    const [/* game */, player] = testGame(2);
    const doubleDown = new DoubleDown();
    const biolab = new Biolab();
    player.cardsInHand.length = 0;
    player.preludeCardsInHand.push(doubleDown, biolab);
    const before = JSON.stringify({
      mc: player.megaCredits,
      hand: player.cardsInHand.map((c) => c.name),
      played: player.playedCards.asArray().map((c) => c.name),
      preludes: player.preludeCardsInHand.map((c) => c.name),
      plants: player.production.plants,
    });

    computePreludeOutlooks(player, player.preludeCardsInHand, player.preludeCardsInHand);

    expect(JSON.stringify({
      mc: player.megaCredits,
      hand: player.cardsInHand.map((c) => c.name),
      played: player.playedCards.asArray().map((c) => c.name),
      preludes: player.preludeCardsInHand.map((c) => c.name),
      plants: player.production.plants,
    })).to.eq(before);
  });

  /** The provisions side, read off DECLARED behaviour — this keeps the engine free of card names. */
  describe('preludeProvisions', () => {
    it('every prelude creates a played prelude simply by being played', () => {
      expect(preludeProvisions(new MartianIndustries()).has('playedPrelude')).to.be.true;
      expect(preludeProvisions(new EcologyExperts()).has('playedPrelude')).to.be.true;
    });

    it('a declarative draw or M€ gain is what MAY open a card target', () => {
      expect(preludeProvisions(new Biolab()).has('playableCard'), 'draws 3').to.be.true;
      expect(preludeProvisions(new AlliedBanks()).has('playableCard'), 'grants M€').to.be.true;
      expect(preludeProvisions(new EcologyExperts()).has('playableCard'),
        'plant production opens no card target').to.be.false;
    });
  });
});
