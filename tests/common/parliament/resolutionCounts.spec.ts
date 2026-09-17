import {expect} from 'chai';
import * as fs from 'fs';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {ClientCard} from '../../../src/common/cards/ClientCard';
import {cardCountVerdict, countCardsToward, CountedCardFacts} from '../../../src/common/parliament/resolutionCounts';
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

/**
 * THE COUNTED TERM's predicate — shared by the server's payout and the
 * Polygon's synthetic tableaus. Every «does not count» names its reason, and
 * the client manifest (what the Polygon counts from) and the server card
 * classes (what the payout counts from) give the SAME verdict for every card
 * of the corpus — the export carries every fact the rule reads.
 */
const ID = 'buildingCardsWithNonNegativeVp' as const;

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
});
