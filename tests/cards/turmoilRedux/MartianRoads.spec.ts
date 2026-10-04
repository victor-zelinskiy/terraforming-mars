import {expect} from 'chai';
import {MartianRoads} from '../../../src/server/cards/turmoilRedux/MartianRoads';
import {AdministrationDistrict} from '../../../src/server/cards/turmoilRedux/AdministrationDistrict';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {Mine} from '../../../src/server/cards/base/Mine';
import {Steelworks} from '../../../src/server/cards/base/Steelworks';
import {Ironworks} from '../../../src/server/cards/base/Ironworks';
import {CarbonateProcessing} from '../../../src/server/cards/base/CarbonateProcessing';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {hasPartyRequirement, requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {resolutionCountUnitsOf} from '../../../src/server/parliament/resolutions/ResolutionCounts';
import {victoryPointsIconOf} from '../../../src/common/cards/victoryPointsIcon';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR20 — MARTIAN ROADS: a card whose whole value is its VP «for tags» — Mars
 * First's requirement, Mars + Building tags, «1 VP for every 3 Building tags
 * you have». Every rule reading of the card file's header is pinned here; the
 * play composer's VP projection has its corpus guard
 * (tests/models/cardVictoryPointsAtPlay.spec.ts).
 */
const M = PartyName.MARS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: MartianRoads};

/** A two-seat Redux table (Colonies on, as the set is played) in the action phase. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return {game, p1, p2, card: new MartianRoads()};
}

/** The same table with three QUIET real resolutions (Greens · Mars First · Industrialists) and 40 M€. */
function parliamentTable(): Table {
  const t = table();
  const parliament = t.game.parliament!;
  ([PartyName.GREENS, M, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  t.p1.megaCredits = 40;
  t.p1.cardsInHand.push(t.card);
  return t;
}

/** `n` more played cards of `player`'s, each printing one Building tag (and nothing else). */
let buildingSerial = 0;
function playBuildingCards(player: TestPlayer, n: number): void {
  for (let i = 0; i < n; i++) {
    player.playedCards.push(fakeCard({name: `building ${buildingSerial++}` as CardName, tags: [Tag.BUILDING]}));
  }
}

/** Play the card for real (past the requirement gate) and resolve whatever the play queues. */
function play(t: Table): void {
  t.p1.playCard(t.card);
  runAllActions(t.game);
}

describe('MartianRoads', () => {
  it('registers with source-backed metadata (the scan: 8 · Mars, Building · green · Mars First · 1/3 Building)', () => {
    const card = new MartianRoads();
    expect(card.name).eq(CardName.MARTIAN_ROADS);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(8);
    expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.MARS, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR20');
    expect(requiredPartyOf(card), 'the MIN plate holds the Mars First emblem').eq(M);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'the VP badge on the Mars disc: «1/3 [Building tag]»').deep.eq({tag: Tag.BUILDING, per: 3});
    expect(card.behavior).is.undefined;
    expect(card.resourceType).is.undefined;
    // No effect row on the scan — no `renderData`, and no prose `vpText` standing in for the badge.
    expect(card.metadata.renderData).is.undefined;
    expect(card.metadata.infoText).deep.eq([{kind: 'victory-points', text: '1 VP for every 3 Building tags you have.'}]);
    // The purple Turmoil symbol only: the module is the gate, no `compatibility`.
    expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.MARTIAN_ROADS]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with the TR15 class\'s NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on its resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      const parliament = t.game.parliament!;
      parliament.placeVote(t.p1, parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: M, current: 1});
    });

    it('two delegates on its resolution: playable', () => {
      const t = parliamentTable();
      const parliament = t.game.parliament!;
      parliament.placeVote(t.p1, parliament.slots[1], 'reserve');
      parliament.placeVote(t.p1, parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('Mars First rules: playable', () => {
      const t = parliamentTable();
      seatEnacted(t.game.parliament!, quietResolutionOf(M));
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });
  });

  describe('rules 2–4 — 1 VP for every 3 Building tags, the card\'s own included, counted RAW', () => {
    it('2 other Building tags + its own = 3 → 1 VP; 5 + its own = 6 → 2 VP', () => {
      const t = table();
      playBuildingCards(t.p1, 2);
      play(t);
      expect(t.card.getVictoryPoints(t.p1)).eq(1);
      playBuildingCards(t.p2, 4); // another player's tags are not «you have»
      expect(t.card.getVictoryPoints(t.p1)).eq(1);
      playBuildingCards(t.p1, 3);
      expect(t.p1.tags.count(Tag.BUILDING, 'raw')).eq(6);
      expect(t.card.getVictoryPoints(t.p1)).eq(2);
    });

    it('rule 3 — its own tag counts BEFORE the play too: the number the card scores the moment it lands', () => {
      const t = table();
      playBuildingCards(t.p1, 2);
      t.p1.cardsInHand.push(t.card);
      expect(t.card.getVictoryPoints(t.p1), 'in hand: the Counter adds the unplayed card\'s own tag').eq(1);
      play(t);
      expect(t.card.getVictoryPoints(t.p1), 'in the tableau').eq(1);
    });

    it('rule 4 — a WILD tag does not count (it would in an action\'s count)', () => {
      const t = table();
      playBuildingCards(t.p1, 1);
      t.p1.playedCards.push(fakeCard({name: 'wild' as CardName, tags: [Tag.WILD]}));
      play(t);
      expect(t.p1.tags.count(Tag.BUILDING, 'default'), 'the action-time count sees 3').eq(3);
      expect(t.card.getVictoryPoints(t.p1), 'the VP count sees 2').eq(0);
    });

    it('rule 4 — a played EVENT\'s Building tag does not count (face down)', () => {
      const t = table();
      playBuildingCards(t.p1, 1);
      t.p1.playedCards.push(fakeCard({name: 'event' as CardName, type: CardType.EVENT, tags: [Tag.BUILDING]}));
      play(t);
      expect(t.card.getVictoryPoints(t.p1)).eq(0);
      playBuildingCards(t.p1, 1);
      expect(t.card.getVictoryPoints(t.p1)).eq(1);
    });
  });

  describe('rule 5 — a NON-NEGATIVE variable VP icon: nothing programmed, the readers see it', () => {
    it('the icon is variable and non-negative', () => {
      expect(victoryPointsIconOf(new MartianRoads())).deep.eq({kind: 'variable', sign: 'nonNegative'});
    });

    it('with TR16 in the tableau the play draws a card, and the forecast says so first', () => {
      const t = table();
      t.p1.playedCards.push(new AdministrationDistrict());
      t.p1.cardsInHand.push(t.card);
      const facts = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)).facts
        .filter((f) => f.source.name === CardName.ADMINISTRATION_DISTRICT);
      expect(facts).has.length(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].effects).deep.eq([{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}]);
      const before = t.p1.cardsInHand.length;
      play(t);
      expect(t.p1.cardsInHand.length - (before - 1), 'exactly the forecast\'s card').eq(1);
      expect(t.p1.cardDrawReveals.at(-1)?.source).deep.eq({type: 'card', cardName: CardName.ADMINISTRATION_DISTRICT});
    });

    it('Architecture Award (RX02) counts the played card', () => {
      const t = table();
      play(t);
      expect(resolutionCountUnitsOf(t.p1, 'buildingCardsWithNonNegativeVp', t.card)).eq(1);
    });
  });

  it('rule 6 — a card with a party requirement (one more target of TR13\'s check)', () => {
    expect(hasPartyRequirement(new MartianRoads())).is.true;
  });

  it('rule 7 — «roads» is flavour: the play places nothing and asks nothing', () => {
    const t = table();
    const tiles = t.game.board.spaces.filter((s) => s.tile !== undefined).length;
    play(t);
    expect(t.p1.getWaitingFor()).is.undefined;
    expect(t.game.board.spaces.filter((s) => s.tile !== undefined).length).eq(tiles);
    expect(t.p1.tableau.has(CardName.MARTIAN_ROADS)).is.true;
  });

  it('save / reload: the reloaded card scores the same', () => {
    const t = table();
    // Real manifest cards (a fake one does not survive `Game.deserialize`): 5 Building tags + its own = 2 VP.
    t.p1.playedCards.push(new Mine(), new Steelworks(), new Ironworks(), new CarbonateProcessing(), new PowerPlant());
    play(t);
    expect(t.card.getVictoryPoints(t.p1)).eq(2);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const again = owner.playedCards.get(CardName.MARTIAN_ROADS);
    expect(again).is.not.undefined;
    expect(again!.getVictoryPoints(owner)).eq(2);
  });
});
