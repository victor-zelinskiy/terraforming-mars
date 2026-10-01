import {expect} from 'chai';
import {hasPartyRequirement, requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {newProjectCard} from '../../../src/server/createCard';
import {CardName} from '../../../src/common/cards/CardName';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';

function card(name: CardName): IProjectCard {
  const c = newProjectCard(name);
  if (c === undefined) {
    throw new Error(`no card ${name}`);
  }
  return c;
}

/**
 * «A card with a PARTY REQUIREMENT» — the ONE reading shared by High Circles,
 * TR13 Political Think Tank and the future Politologist award: a requirement
 * of the `party` kind, any party; events count; the other political kinds
 * (chairman, party leaders, delegates on resolutions, influence) do not.
 */
describe('partyRequirementCards', () => {
  it('a party requirement of any party is one — automated, active and event cards alike', () => {
    expect(hasPartyRequirement(card(CardName.WILDLIFE_DOME))).is.true; // Greens, automated
    expect(hasPartyRequirement(card(CardName.RED_TOURISM_WAVE))).is.true; // Reds, event
    expect(hasPartyRequirement(card(CardName.PR_OFFICE))).is.true; // Unity
    expect(requiredPartyOf(card(CardName.WILDLIFE_DOME))).eq(PartyName.GREENS);
    expect(requiredPartyOf(card(CardName.RED_TOURISM_WAVE))).eq(PartyName.REDS);
  });

  it('the other political requirements are not party requirements', () => {
    expect(hasPartyRequirement(card(CardName.BANNED_DELEGATE))).is.false; // chairman
    expect(hasPartyRequirement(card(CardName.VOTE_OF_NO_CONFIDENCE))).is.false; // party leaders
    expect(hasPartyRequirement(card(CardName.POLITICAL_SCIENCE))).is.false; // delegates on resolutions
    expect(hasPartyRequirement(card(CardName.MINORITY_REPRESENTATION))).is.false; // influence
    expect(requiredPartyOf(card(CardName.BANNED_DELEGATE))).is.undefined;
  });

  it('a card with no requirement, or a non-political one, is not', () => {
    expect(hasPartyRequirement(card(CardName.ASTEROID))).is.false;
    expect(hasPartyRequirement(card(CardName.SEARCH_FOR_LIFE))).is.false; // oxygen max
  });

  it('the corpus: exactly the cards whose requirements carry a `party` (the predicate is the field)', () => {
    let count = 0;
    for (const manifest of ALL_MODULE_MANIFESTS) {
      for (const [name, factory] of Object.entries(manifest.projectCards)) {
        const c = new factory.Factory();
        const byField = c.requirements.some((r) => r.party !== undefined);
        expect(hasPartyRequirement(c), name).eq(byField);
        if (byField) {
          count++;
        }
      }
    }
    // Anti-vacuous floor: the repository's party-requirement cards (classic Turmoil, Prelude 2, Moon, Pathfinders).
    expect(count).is.greaterThanOrEqual(20);
  });
});
