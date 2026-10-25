import {expect} from 'chai';
import {HEAT_PRODUCTION, SponsoredMoholeRedux} from '../../../src/server/cards/turmoilRedux/SponsoredMoholeRedux';
import {SponsoredMohole} from '../../../src/server/cards/turmoil/SponsoredMohole';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {BackroomDeal} from '../../../src/server/cards/turmoilRedux/BackroomDeal';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {newCard} from '../../../src/server/createCard';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Payment} from '../../../src/common/inputs/Payment';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {replacementCardNumber} from '../../../src/common/cards/turmoilReduxReplacements';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {toName} from '../../../src/common/utils/utils';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, testGame} from '../../TestingUtils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

/**
 * TR75 — SPONSORED MOHOLE (Redux replacement of the classic T13). The card file
 * declares everything; every rule reading of its header is pinned here on the
 * real card: the printed card (the Greens' plate, 5 M€, Building, 1 VP — TR75
 * by its registry row, not by the order it was authored in), the requirement's
 * roads and named reasons, the play (+2 heat production), the VP at the
 * scoring, the deal (the replacement on a Redux table, the classic card on a
 * classic one, never both), save / load.
 */
const G = PartyName.GREENS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: SponsoredMoholeRedux};

/** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new SponsoredMoholeRedux();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament: game.parliament!, card};
}

/**
 * Unity rule: their quiet resolution stands enacted. Needed for every «no road» table — while NO resolution is
 * enacted the Greens rule by default (rulebook p.8, `Parliament.rulingParty`), which IS this card's road.
 */
function unityRuling(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.UNITY));
  expect(t.parliament.rulingParty()).eq(PartyName.UNITY);
  return t;
}

/** The same table with three QUIET real resolutions up for the vote (the Greens · Mars First · the Scientists), Unity ruling. */
function parliamentTable(): Table {
  const t = table();
  ([G, PartyName.MARS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
  return unityRuling(t);
}

/** The Greens rule: their quiet resolution stands enacted. */
function greensRuling(): Table {
  const t = parliamentTable();
  seatEnacted(t.parliament, quietResolutionOf(G));
  expect(t.parliament.rulingParty()).eq(G);
  return t;
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('SponsoredMoholeRedux', () => {
  it('rule 1 — the printed card: green, 5, a Building tag, 1 VP, the Greens\' plate; TR75, reimplementing T13', () => {
    const c = new SponsoredMoholeRedux();
    expect(c.name).eq(CardName.SPONSORED_MOHOLE_REDUX);
    expect(c.name, 'the classic name with the `:redux` suffix').eq('Sponsored Mohole:redux');
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(5);
    expect(c.tags).deep.eq([Tag.BUILDING]);
    expect(c.victoryPoints, 'the printed badge — the classic card had none').eq(1);
    expect(new SponsoredMohole().victoryPoints).is.undefined;
    expect(requiredPartyOf(c), 'the PRINTED Greens').eq(G);
    expect(c.behavior).deep.eq({production: {heat: HEAT_PRODUCTION}});
    expect(c.metadata.cardNumber, 'the FIFTH registry row — TR73 / TR74 are still to come').eq('TR75');
    expect(replacementCardNumber(CardName.SPONSORED_MOHOLE)).eq('TR75');
    expect(c.metadata.reimplements, 'the art and the lore are the classic T13\'s').eq(CardName.SPONSORED_MOHOLE);
    expect(new SponsoredMohole().metadata.cardNumber).eq('T13');
    expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.SPONSORED_MOHOLE_REDUX]?.compatibility).is.undefined;
    expect(newCard(CardName.SPONSORED_MOHOLE_REDUX)).to.be.instanceOf(SponsoredMoholeRedux);
    expect(newCard(CardName.SPONSORED_MOHOLE), 'the plain name stays the classic card').to.be.instanceOf(SponsoredMohole);
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

    it('the Greens\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.MARS, PartyName.SCIENTISTS, PartyName.REDS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      unityRuling(t);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('no resolution enacted yet: the Greens rule by default (rulebook p.8) — the road is open from the first generation', () => {
      const t = table();
      ([G, PartyName.MARS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.parliament.enacted).is.undefined;
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the Greens rule: playable', () => {
      const t = greensRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('another party ruling is not a road — the Scientists rule, the plate is the Greens\'', () => {
      const t = parliamentTable();
      seatEnacted(t.parliament, quietResolutionOf(PartyName.SCIENTISTS));
      expect(t.parliament.rulingParty()).eq(PartyName.SCIENTISTS);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G});
    });

    it('a card-granted Greens EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, G, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, G)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('TR70 Backroom Deal waives it for the next card', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      const deal = new BackroomDeal();
      t.p1.cardsInHand.push(deal);
      t.p1.playCard(deal, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rules 2–4 — +2 heat production; 1 VP at the scoring; the Building tag', () => {
    it('the play: +2 heat PRODUCTION at once, never stock; no prompt', () => {
      const t = greensRuling();
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.production.heat).eq(HEAT_PRODUCTION);
      expect(t.p1.heat, 'production, never stock').eq(0);
      expect(t.p1.popWaitingFor()).is.undefined;
    });

    it('the VP is the card\'s, counted at the scoring — never a TR at the play', () => {
      const t = greensRuling();
      const tr = t.p1.terraformRating;
      const before = t.p1.getVictoryPoints().victoryPoints;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.terraformRating).eq(tr);
      expect(t.card.getVictoryPoints(t.p1)).eq(1);
      expect(t.p1.getVictoryPoints().victoryPoints - before).eq(1);
    });

    it('the Building tag counts', () => {
      const t = greensRuling();
      const before = t.p1.tags.count(Tag.BUILDING, 'raw');
      t.p1.playCard(t.card);
      expect(t.p1.tags.count(Tag.BUILDING, 'raw')).eq(before + 1);
    });

    it('rule 5 — the play preview states the production, read-only', () => {
      const t = greensRuling();
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.some((e) => e.direction === 'gain' && e.icon === 'heat'), JSON.stringify(effects)).is.true;
      expect(t.p1.production.heat, 'the preview never mutates').eq(0);
    });
  });

  describe('the deal: the replacement on a Redux table, the classic card on a classic one, never both', () => {
    const REDUX = {turmoilReduxExpansion: true, turmoilExtension: false, coloniesExtension: true};
    const CLASSIC = {turmoilReduxExpansion: false, turmoilExtension: true, coloniesExtension: true};

    it('Redux: TR75 is dealt, the classic T13 is removed by the manifest\'s `cardsToRemove`', () => {
      const names = new GameCards(options(REDUX)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.SPONSORED_MOHOLE_REDUX);
      expect(names).to.not.contain(CardName.SPONSORED_MOHOLE);
      expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.SPONSORED_MOHOLE)).is.true;
    });

    it('classic Turmoil: the classic card is dealt, the replacement is not', () => {
      const names = new GameCards(options(CLASSIC)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.SPONSORED_MOHOLE);
      expect(names).to.not.contain(CardName.SPONSORED_MOHOLE_REDUX);
    });

    it('the premium scope covers the replacement and never the replaced classic card', () => {
      expect(inPremiumScope({module: 'turmoilRedux', name: CardName.SPONSORED_MOHOLE_REDUX})).is.true;
      expect(inPremiumScope({module: 'turmoil', name: CardName.SPONSORED_MOHOLE})).is.false;
    });
  });

  it('rule 7 — save / reload: the played card stays in the tableau, its production and its VP with it', () => {
    const t = greensRuling();
    t.p1.playCard(t.card);
    runAllActions(t.game);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const again = owner.playedCards.get(CardName.SPONSORED_MOHOLE_REDUX);
    expect(again).to.be.instanceOf(SponsoredMoholeRedux);
    expect(again!.getVictoryPoints(owner)).eq(1);
    expect(owner.production.heat).eq(HEAT_PRODUCTION);
  });
});
