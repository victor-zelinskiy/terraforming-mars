import {expect} from 'chai';
import * as fs from 'fs';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {ClientCard} from '../../../src/common/cards/ClientCard';
import {
  cardCountUnits, cardCountVerdict, countCardsToward, CountedCardFacts, countSpacesToward, resolutionCountKind, RESOLUTION_COUNT_IDS,
  spaceCountVerdict,
} from '../../../src/common/parliament/resolutionCounts';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {TileType} from '../../../src/common/TileType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {CardManifest} from '../../../src/server/cards/ModuleManifest';
import {ICard} from '../../../src/server/cards/ICard';
import {fakeCard} from '../../TestingUtils';
import {ArtificialLake} from '../../../src/server/cards/base/ArtificialLake';
import {Mine} from '../../../src/server/cards/base/Mine';
import {BiomassCombustors} from '../../../src/server/cards/base/BiomassCombustors';
import {TundraFarming} from '../../../src/server/cards/base/TundraFarming';
import {PhysicsComplex} from '../../../src/server/cards/base/PhysicsComplex';
import {UndergroundShelters} from '../../../src/server/cards/underworld/UndergroundShelters';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {SolarPower} from '../../../src/server/cards/base/SolarPower';
import {EnergyTapping} from '../../../src/server/cards/base/EnergyTapping';
import {ArtificialPhotosynthesis} from '../../../src/server/cards/base/ArtificialPhotosynthesis';
import {HE3FusionPlant} from '../../../src/server/cards/moon/HE3FusionPlant';
import {NobelPrize} from '../../../src/server/cards/prelude2/NobelPrize';

/**
 * THE COUNTED TERM's predicate — shared by the server's payout and the
 * Polygon's synthetic tableaus. Every «does not count» names its reason, and
 * the client manifest (what the Polygon counts from) and the server card
 * classes (what the payout counts from) give the SAME verdict for every card
 * of the corpus — the export carries every fact the rule reads.
 */
const ID = 'buildingCardsWithNonNegativeVp' as const;
/** Central Power Grid's term: the printed POWER TAGS, where one card can be worth several. */
const TAGS = 'powerTags' as const;

/** Every server card class of the corpus by name (projects, corporations, preludes, CEOs, standard projects and actions). */
function serverCards(): Map<CardName, ICard> {
  const out = new Map<CardName, ICard>();
  for (const manifest of ALL_MODULE_MANIFESTS) {
    const factories: CardManifest<ICard> = {
      ...manifest.projectCards, ...manifest.corporationCards, ...manifest.preludeCards, ...manifest.ceoCards,
      ...manifest.standardProjects, ...manifest.standardActions,
    };
    for (const factory of CardManifest.values(factories)) {
      const card = new factory.Factory();
      out.set(card.name, card);
    }
  }
  return out;
}

const FACE_DOWN = {eventTagsInPlay: false};

describe('resolutionCounts', () => {
  it('names why a card does or does not count — the first failed condition', () => {
    expect(cardCountVerdict(ID, new ArtificialLake(), FACE_DOWN)).deep.eq({counts: true});
    expect(cardCountVerdict(ID, new PhysicsComplex(), FACE_DOWN), 'a variable icon at 0 VP').deep.eq({counts: true});
    expect(cardCountVerdict(ID, new UndergroundShelters(), FACE_DOWN), 'a bespoke icon declared non-negative').deep.eq({counts: true});
    expect(cardCountVerdict(ID, new Mine(), FACE_DOWN)).deep.eq({counts: false, reason: 'No VP icon'});
    expect(cardCountVerdict(ID, new BiomassCombustors(), FACE_DOWN)).deep.eq({counts: false, reason: 'Negative VP icon'});
    expect(cardCountVerdict(ID, new TundraFarming(), FACE_DOWN)).deep.eq({counts: false, reason: 'No building tag'});
    const either = fakeCard({name: 'Either Works' as CardName, type: CardType.AUTOMATED, tags: [Tag.BUILDING], victoryPoints: 'special', victoryPointsSign: 'either'});
    expect(cardCountVerdict(ID, either, FACE_DOWN)).deep.eq({counts: false, reason: 'The VP icon can be negative'});
    const event = fakeCard({name: 'Monument Event' as CardName, type: CardType.EVENT, tags: [Tag.BUILDING, Tag.EVENT], victoryPoints: 1});
    expect(cardCountVerdict(ID, event, FACE_DOWN)).deep.eq({counts: false, reason: 'A played event is face down'});
    expect(cardCountVerdict(ID, event, {eventTagsInPlay: true})).deep.eq({counts: true});
  });

  it('counts each card once, in play order, with the cards named', () => {
    const cards: Array<CountedCardFacts> = [new Mine(), new ArtificialLake(), new BiomassCombustors(), new PhysicsComplex()];
    expect(countCardsToward(ID, cards, FACE_DOWN)).deep.eq({id: ID, count: 2, cards: [CardName.ARTIFICIAL_LAKE, CardName.PHYSICS_COMPLEX]});
  });

  it('PARITY: the client manifest and the server card classes give the same verdict for every card of the corpus', () => {
    const clientCards = JSON.parse(fs.readFileSync('src/genfiles/cards.json', 'utf8')) as Array<ClientCard>;
    expect(clientCards.length, 'the generated client manifest was read').greaterThan(500);
    const servers = serverCards();
    const mismatches: Array<string> = [];
    let counted = 0;
    for (const client of clientCards) {
      const server = servers.get(client.name);
      if (client.type === CardType.PROXY || server === undefined) {
        continue;
      }
      for (const ctx of [FACE_DOWN, {eventTagsInPlay: true}]) {
        const a = cardCountVerdict(ID, client, ctx);
        const b = cardCountVerdict(ID, server, ctx);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          mismatches.push(`${client.name}: client ${JSON.stringify(a)} ≠ server ${JSON.stringify(b)}`);
        }
      }
      if (cardCountVerdict(ID, server, FACE_DOWN).counts) {
        counted++;
      }
    }
    expect(mismatches).deep.eq([]);
    expect(counted, 'the corpus has Building cards with a non-negative VP icon').greaterThan(20);
  });

  describe('a TAG count (powerTags)', () => {
    it('counts every printed occurrence: one card with two power tags is two units', () => {
      expect(resolutionCountKind(TAGS)).deep.eq({kind: 'tags', tags: [Tag.POWER]});
      expect(cardCountUnits(TAGS, new PowerPlant(), FACE_DOWN)).eq(1);
      expect(cardCountUnits(TAGS, new HE3FusionPlant(), FACE_DOWN), 'two printed power tags').eq(2);
      // …while a CARD count is one unit whatever the card prints.
      expect(resolutionCountKind(ID)).deep.eq({kind: 'cards'});
      expect(cardCountUnits(ID, new ArtificialLake(), FACE_DOWN)).eq(1);
    });

    it('the VP icon, the energy resource and energy production play no part; a wild tag is not a power tag', () => {
      expect(cardCountVerdict(TAGS, new PowerPlant(), FACE_DOWN), 'no VP icon at all').deep.eq({counts: true});
      expect(cardCountVerdict(TAGS, new EnergyTapping(), FACE_DOWN), 'a negative VP icon').deep.eq({counts: true});
      expect(cardCountVerdict(TAGS, new SolarPower(), FACE_DOWN)).deep.eq({counts: true});
      // Raises energy production 2 steps, prints a science tag.
      expect(cardCountVerdict(TAGS, new ArtificialPhotosynthesis(), FACE_DOWN)).deep.eq({counts: false, reason: 'No power tag'});
      expect(cardCountVerdict(TAGS, new NobelPrize(), FACE_DOWN), 'a wild tag').deep.eq({counts: false, reason: 'No power tag'});
      const event = fakeCard({name: 'Grid Surge' as CardName, type: CardType.EVENT, tags: [Tag.POWER, Tag.EVENT]});
      expect(cardCountVerdict(TAGS, event, FACE_DOWN)).deep.eq({counts: false, reason: 'A played event is face down'});
      expect(cardCountVerdict(TAGS, event, {eventTagsInPlay: true})).deep.eq({counts: true});
    });

    it('the model carries the per-card contribution so the number can be explained', () => {
      const cards: Array<CountedCardFacts> = [new ArtificialPhotosynthesis(), new HE3FusionPlant(), new PowerPlant()];
      expect(countCardsToward(TAGS, cards, FACE_DOWN)).deep.eq({
        id: TAGS, count: 3, cards: [CardName.HE3_FUSION_PLANT, CardName.POWER_PLANT], units: [2, 1],
      });
      // The card count carries no such column — every entry there is worth 1.
      expect(countCardsToward(ID, cards, FACE_DOWN).units).is.undefined;
    });

    it('PARITY over the corpus: the client manifest and the server classes agree on every count id', () => {
      const clientCards = JSON.parse(fs.readFileSync('src/genfiles/cards.json', 'utf8')) as Array<ClientCard>;
      const servers = serverCards();
      const mismatches: Array<string> = [];
      let tagUnits = 0;
      let multiTagCards = 0;
      for (const client of clientCards) {
        const server = servers.get(client.name);
        if (client.type === CardType.PROXY || server === undefined) {
          continue;
        }
        for (const id of RESOLUTION_COUNT_IDS) {
          for (const ctx of [FACE_DOWN, {eventTagsInPlay: true}]) {
            const a = cardCountUnits(id, client, ctx);
            const b = cardCountUnits(id, server, ctx);
            if (a !== b) {
              mismatches.push(`${client.name} (${id}): client ${a} ≠ server ${b}`);
            }
          }
        }
        const units = cardCountUnits(TAGS, server, {eventTagsInPlay: true});
        tagUnits += units;
        if (units > 1) {
          multiTagCards++;
        }
      }
      expect(mismatches).deep.eq([]);
      expect(tagUnits, 'the corpus prints power tags').greaterThan(50);
      expect(multiTagCards, 'and at least one card prints two of them').greaterThan(0);
    });
  });

  describe('a BOARD count (spaceCities)', () => {
    const BOARD = 'spaceCities' as const;
    const ganymede = {id: '01' as const, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}};
    const phobos = {id: '02' as const, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}};
    const emptyArea = {id: '69' as const, spaceType: SpaceType.COLONY};
    const marsCity = {id: '35' as const, spaceType: SpaceType.LAND, tile: {tileType: TileType.CITY}};
    const marsCapital = {id: '36' as const, spaceType: SpaceType.LAND, tile: {tileType: TileType.CAPITAL}};
    const oceanCity = {id: '70' as const, spaceType: SpaceType.COLONY, tile: {tileType: TileType.OCEAN_CITY}};
    const greenery = {id: '37' as const, spaceType: SpaceType.LAND, tile: {tileType: TileType.GREENERY}};

    it('is a count over the BOARD, and the cells answer it — each «does not count» names its reason', () => {
      expect(resolutionCountKind(BOARD)).deep.eq({kind: 'board', tiles: 'spaceCity', measure: 'cells'});
      expect(spaceCountVerdict(BOARD, ganymede)).deep.eq({counts: true});
      expect(spaceCountVerdict(BOARD, oceanCity), 'every city tile kind counts, as the engine\'s own city predicate reads it').deep.eq({counts: true});
      expect(spaceCountVerdict(BOARD, emptyArea)).deep.eq({counts: false, reason: 'No city tile here'});
      expect(spaceCountVerdict(BOARD, marsCity)).deep.eq({counts: false, reason: 'On Mars — not a space city'});
      expect(spaceCountVerdict(BOARD, marsCapital)).deep.eq({counts: false, reason: 'On Mars — not a space city'});
      expect(spaceCountVerdict(BOARD, greenery)).deep.eq({counts: false, reason: 'On Mars — not a space city'});
      // A card or tag count asked about a cell: never.
      expect(spaceCountVerdict(ID, ganymede)).deep.eq({counts: false, reason: 'Counted among cards, not on the board'});
      expect(spaceCountVerdict(TAGS, ganymede)).deep.eq({counts: false, reason: 'Counted among cards, not on the board'});
    });

    it('the model explains the number with CELLS and carries no card at all', () => {
      expect(countSpacesToward(BOARD, [marsCity, ganymede, emptyArea, phobos, greenery])).deep.eq({id: BOARD, count: 2, cards: [], spaces: ['01', '02']});
      expect(countSpacesToward(BOARD, [])).deep.eq({id: BOARD, count: 0, cards: [], spaces: []});
    });

    it('no card ever counts toward it — the card predicate says so, and a tableau walk gives zero without a per-card column', () => {
      expect(cardCountVerdict(BOARD, new ArtificialLake(), FACE_DOWN)).deep.eq({counts: false, reason: 'Counted on the board, not among cards'});
      expect(cardCountUnits(BOARD, new PowerPlant(), {eventTagsInPlay: true})).eq(0);
      expect(countCardsToward(BOARD, [new ArtificialLake(), new HE3FusionPlant()], FACE_DOWN)).deep.eq({id: BOARD, count: 0, cards: []});
    });

    /*
     * THE TWIN over the OTHER half of the board (Skyscrapers, RX20): a city
     * tile of the player's on a cell that is NOT a reserved area — the
     * DESTINATIONS of a granted tier. A cell counts once whatever its stack;
     * every city tile kind counts (the engine's own city predicate); a
     * greenery, an empty area and a space city each name why not.
     */
    it('marsCities — the destinations of a granted tier: a city on Mars, a cell once whatever its stack; a space city is off Mars', () => {
      const MARS = 'marsCities' as const;
      expect(resolutionCountKind(MARS)).deep.eq({kind: 'board', tiles: 'marsCity', measure: 'cells'});
      expect(spaceCountVerdict(MARS, marsCity)).deep.eq({counts: true});
      expect(spaceCountVerdict(MARS, marsCapital), 'every city tile kind counts').deep.eq({counts: true});
      expect(spaceCountVerdict(MARS, {...marsCity, stackHeight: 3} as typeof marsCity), 'a stack is ONE destination').deep.eq({counts: true});
      expect(spaceCountVerdict(MARS, ganymede)).deep.eq({counts: false, reason: 'Off Mars — a space city'});
      expect(spaceCountVerdict(MARS, oceanCity)).deep.eq({counts: false, reason: 'Off Mars — a space city'});
      expect(spaceCountVerdict(MARS, emptyArea)).deep.eq({counts: false, reason: 'Off Mars — a space city'});
      expect(spaceCountVerdict(MARS, greenery)).deep.eq({counts: false, reason: 'No city tile here'});
      expect(countSpacesToward(MARS, [marsCity, ganymede, emptyArea, marsCapital, greenery, phobos])).deep.eq({id: MARS, count: 2, cards: [], spaces: ['35', '36']});
      expect(cardCountVerdict(MARS, new ArtificialLake(), FACE_DOWN)).deep.eq({counts: false, reason: 'Counted on the board, not among cards'});
      expect(countCardsToward(MARS, [new ArtificialLake(), new HE3FusionPlant()], FACE_DOWN)).deep.eq({id: MARS, count: 0, cards: []});
    });

    /*
     * THE SAME TILE AS A QUANTITY (Migration Funding, RX21): the `tiers`
     * MEASURE — the cells are the destinations' cells, the verdicts are the
     * same, and only the WEIGHT differs: a stack of 3 is 3, and the model keeps
     * each cell's height beside it. Without a stack the two counts agree —
     * which is why the declaration, not the id, says which one it is.
     */
    it('marsCityTiers — the quantity of cities on Mars: the same cells and verdicts as the destinations, weighed by the stack; the two counts part by exactly the stacks', () => {
      const TIERS = 'marsCityTiers' as const;
      expect(resolutionCountKind(TIERS)).deep.eq({kind: 'board', tiles: 'marsCity', measure: 'tiers'});
      expect(resolutionCountKind('marsCities')).deep.eq({kind: 'board', tiles: 'marsCity', measure: 'cells'});
      const stacked = {...marsCity, stackHeight: 3};
      expect(spaceCountVerdict(TIERS, stacked)).deep.eq({counts: true});
      expect(spaceCountVerdict(TIERS, marsCapital), 'every city tile kind counts').deep.eq({counts: true});
      expect(spaceCountVerdict(TIERS, ganymede)).deep.eq({counts: false, reason: 'Off Mars — a space city'});
      expect(spaceCountVerdict(TIERS, greenery)).deep.eq({counts: false, reason: 'No city tile here'});
      const cells = [stacked, ganymede, emptyArea, marsCapital, greenery, phobos];
      expect(countSpacesToward(TIERS, cells)).deep.eq({id: TIERS, count: 4, cards: [], spaces: ['35', '36'], tiers: [3, 1]});
      expect(countSpacesToward('marsCities', cells), 'the destinations: a cell once, no heights').deep.eq({id: 'marsCities', count: 2, cards: [], spaces: ['35', '36']});
      expect(countSpacesToward(TIERS, [marsCity, marsCapital]), 'without a stack the two agree').deep.eq({id: TIERS, count: 2, cards: [], spaces: ['35', '36'], tiers: [1, 1]});
      expect(countSpacesToward(TIERS, [])).deep.eq({id: TIERS, count: 0, cards: [], spaces: [], tiers: []});
      expect(cardCountVerdict(TIERS, new ArtificialLake(), FACE_DOWN)).deep.eq({counts: false, reason: 'Counted on the board, not among cards'});
      expect(countCardsToward(TIERS, [new ArtificialLake(), new HE3FusionPlant()], FACE_DOWN)).deep.eq({id: TIERS, count: 0, cards: []});
      // `spaceCities` is the `cells` measure: a space city can carry no stack, and a height there is ignored.
      expect(countSpacesToward(BOARD, [{...ganymede, stackHeight: 2}])).deep.eq({id: BOARD, count: 1, cards: [], spaces: ['01']});
    });
  });
});
