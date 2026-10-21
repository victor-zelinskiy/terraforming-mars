import {expect} from 'chai';
import {GMOContract} from '../../../src/server/cards/turmoil/GMOContract';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {Lichen} from '../../../src/server/cards/base/Lichen';
import {Research} from '../../../src/server/cards/base/Research';
import {EcologyResearch} from '../../../src/server/cards/colonies/EcologyResearch';
import {Harvest} from '../../../src/server/cards/promo/Harvest';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Priority} from '../../../src/server/deferredActions/Priority';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {GameEvent} from '../../../src/common/events/GameEvent';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('GMOContract', () => {
  it('Should play', () => {
    const card = new GMOContract();
    const [game, player] = testGame(1, {turmoilExtension: true});
    const turmoil = game.turmoil!;

    turmoil.rulingParty = turmoil.getPartyByName(PartyName.REDS);
    expect(card.canPlay(player)).is.not.true;
    const greens = turmoil.getPartyByName(PartyName.GREENS);
    greens.delegates.add(player, 2);
    expect(card.canPlay(player)).is.true;
    card.play(player);
    card.onCardPlayed(player, card);
    game.deferredActions.runNext();
    expect(player.megaCredits).to.eq(2);
  });
});

/**
 * T06 — GMO CONTRACT ON A TURMOIL REDUX TABLE: the second classic Turmoil card
 * adapted IN PLACE and the first one with a live EFFECT
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The hooks did not change: the
 * party requirement already reads the facade (`PartyRequirement` →
 * `game.politics.satisfiesPartyRequirement`), and the gain is Decomposers'
 * count (`cardTagCount` over animal / plant / microbe) at 2 M€ a tag. The work
 * is the forecast TWIN (`cardPlayedForecast`), pinned here against the hook.
 */
describe('GMOContract — on a Turmoil Redux table', () => {
  const G = PartyName.GREENS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: GMOContract};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 30 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new GMOContract();
    p1.cardsInHand.push(card);
    p1.megaCredits = 30;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /**
   * The same table with three QUIET real resolutions up for the vote (the Greens · Mars First · the Reds) and
   * Mars First's enacted — a fresh Redux table starts under the GREENS (no law yet), which would open the road.
   */
  function parliamentTable(): Table {
    const t = table();
    ([G, PartyName.MARS, PartyName.REDS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    seatEnacted(t.parliament, quietResolutionOf(PartyName.MARS));
    expect(t.parliament.rulingParty()).eq(PartyName.MARS);
    return t;
  }

  /** The Greens rule: their quiet resolution stands enacted. */
  function greensRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(G));
    expect(t.parliament.rulingParty()).eq(G);
    return t;
  }

  /** The Greens rule and GMO Contract is already on p1's table. */
  function contractInPlay(): Table {
    const t = greensRuling();
    t.p1.cardsInHand.splice(t.p1.cardsInHand.indexOf(t.card), 1);
    t.p1.playedCards.push(t.card);
    return t;
  }

  /** Play `card` for real (past any requirement gate) and resolve whatever the play queues; the M€ delta. */
  function playFor(player: TestPlayer, card: IProjectCard): number {
    const before = player.megaCredits;
    player.playCard(card);
    runAllActions(player.game);
    return player.megaCredits - before;
  }

  function triggers(game: IGame): Array<GameEvent> {
    return game.events.events.filter((e) =>
      e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.GMO_CONTRACT);
  }

  function forecastOf(player: TestPlayer, card: IProjectCard): Array<EffectForecastFact> {
    return effectForecastForPlay(player, card, cardPlayPreview(player, card)).facts
      .filter((f) => f.source.name === CardName.GMO_CONTRACT);
  }

  it('rule 1 — the printed card: blue, 3, Microbe + Science, no VP, the Greens\' plate; the printed number is T06', () => {
    const c = new GMOContract();
    expect(c.name).eq(CardName.GMO_CONTRACT);
    expect(c.type).eq(CardType.ACTIVE);
    expect(c.cost).eq(3);
    expect(c.tags).deep.eq([Tag.MICROBE, Tag.SCIENCE]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(G);
    expect(c.metadata.cardNumber).eq('T06');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.GMO_CONTRACT]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: the Greens rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, current: 1});
    });

    it('two delegates on their resolution: playable', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Greens rule: playable', () => {
      const t = greensRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });
  });

  describe('rule 2 — 2 M€ for EACH plant / animal / microbe tag of a card YOU play', () => {
    it('Lichen (one plant tag): +2 M€, one firing on the `card-played` channel', () => {
      const t = contractInPlay();
      expect(playFor(t.p1, new Lichen())).eq(2);
      expect(triggers(t.game).map((e) => e.trigger)).deep.eq(['card-played']);
    });

    it('Ecology Research (plant + animal + microbe, and science): +6 M€ — every matching tag counts, the science tag does not', () => {
      const t = contractInPlay();
      const research = new EcologyResearch();
      expect(research.tags).deep.eq([Tag.SCIENCE, Tag.PLANT, Tag.ANIMAL, Tag.MICROBE]);
      expect(playFor(t.p1, research)).eq(6);
      expect(triggers(t.game)).length(1);
    });

    it('an EVENT with a plant tag is a play too (Harvest): +2 M€ beside the event\'s own 12', () => {
      const t = contractInPlay();
      const harvest = new Harvest();
      expect(harvest.type).eq(CardType.EVENT);
      expect(playFor(t.p1, harvest)).eq(12 + 2);
      expect(triggers(t.game)).length(1);
    });

    it('a card without a matching tag: nothing, no firing', () => {
      const t = contractInPlay();
      expect(playFor(t.p1, new Research())).eq(0);
      expect(triggers(t.game)).deep.eq([]);
    });

    it('an OPPONENT\'s Lichen pays the owner nothing — only your own plays count', () => {
      const t = contractInPlay();
      const before = t.p1.megaCredits;
      playFor(t.p2, new Lichen());
      expect(t.p1.megaCredits).eq(before);
      expect(triggers(t.game)).deep.eq([]);
    });
  });

  describe('rule 3 — «including this»: the card pays for its own microbe tag, once', () => {
    it('the engine\'s own walk: playing GMO Contract itself gives +2 M€, ONE firing', () => {
      const t = greensRuling();
      expect(playFor(t.p1, t.card)).eq(2);
      expect(t.p1.tableau.has(CardName.GMO_CONTRACT)).is.true;
      expect(triggers(t.game)).length(1);
    });

    it('the composer of GMO Contract forecasts the same +2 M€ of «this card»', () => {
      const t = greensRuling();
      const facts = forecastOf(t.p1, t.card);
      expect(facts).length(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].effects[0]).deep.include({icon: Resource.MEGACREDITS, amount: 2});
    });
  });

  it('rule 4 — a plant tag gained OUTSIDE a card (`triggerOnNonCardTagAdded`): +2 M€; any other tag: nothing', () => {
    const t = contractInPlay();
    const before = t.p1.megaCredits;
    t.p1.triggerOnNonCardTagAdded(Tag.SCIENCE);
    runAllActions(t.game);
    expect(t.p1.megaCredits).eq(before);
    t.p1.triggerOnNonCardTagAdded(Tag.PLANT);
    runAllActions(t.game);
    expect(t.p1.megaCredits).eq(before + 2);
    expect(triggers(t.game).map((e) => e.trigger)).deep.eq(['tag-added']);
  });

  describe('rule 5 — the TWIN is the hook: the number, the timing, the opponent\'s play', () => {
    it('the forecast of each play equals what the play pays (Lichen 2 · Ecology Research 6 · Research 0)', () => {
      for (const [make, expected] of [[() => new Lichen(), 2], [() => new EcologyResearch(), 6], [() => new Research(), 0]] as const) {
        const t = contractInPlay();
        const card = make();
        t.p1.cardsInHand.push(card);
        const forecast = forecastOf(t.p1, card);
        const forecastAmount = forecast.flatMap((f) => f.effects).reduce((sum, e) => sum + (e.amount ?? 0), 0);
        expect(forecastAmount, card.name).eq(expected);
        expect(playFor(t.p1, card), card.name).eq(expected);
      }
    });

    it('the gain lands AFTER the card\'s own choices — `player.defer` at `Priority.DEFAULT` (`AFTER_CARD`)', () => {
      const t = contractInPlay();
      const lichen = new Lichen();
      t.p1.cardsInHand.push(lichen);
      const [fact] = forecastOf(t.p1, lichen);
      expect(fact.sequence).eq(Priority.DEFAULT);
      expect(fact.timing).eq('after-card');
    });

    it('ONE fact per matching printed tag, each naming its tag — the play scene births each answer on the tag that woke it', () => {
      const t = contractInPlay();
      const research = new EcologyResearch();
      t.p1.cardsInHand.push(research);
      const facts = forecastOf(t.p1, research);
      expect(facts.map((f) => f.reasonTag)).deep.eq([Tag.PLANT, Tag.ANIMAL, Tag.MICROBE]);
      expect(facts.map((f) => f.effects[0].amount)).deep.eq([2, 2, 2]);
    });

    it('an opponent\'s play is never forecast for the owner', () => {
      const t = contractInPlay();
      const lichen = new Lichen();
      t.p2.cardsInHand.push(lichen);
      expect(forecastOf(t.p2, lichen)).deep.eq([]);
    });

    it('the forecast is read-only', () => {
      const t = contractInPlay();
      const lichen = new Lichen();
      t.p1.cardsInHand.push(lichen);
      const before = JSON.stringify(t.game.serialize());
      forecastOf(t.p1, lichen);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  it('rule 7 — the journal: the +2 M€ is attributed to GMO Contract, not to the played card', () => {
    const t = contractInPlay();
    playFor(t.p1, new Lichen());
    const [fired] = triggers(t.game);
    const gains = t.game.events.events.filter((e) => e.type === 'resource-changed' && e.player === t.p1.color &&
      e.parentId === fired.id);
    expect(gains, JSON.stringify(t.game.events.events.slice(-6))).length(1);
    expect(gains[0].source).deep.include({kind: 'card', card: CardName.GMO_CONTRACT});
  });

  it('save / reload: the contract stays in the tableau and keeps paying', () => {
    const t = contractInPlay();
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id) as TestPlayer;
    expect(owner.playedCards.get(CardName.GMO_CONTRACT)).is.not.undefined;
    expect(playFor(owner, new Lichen())).eq(2);
  });
});
