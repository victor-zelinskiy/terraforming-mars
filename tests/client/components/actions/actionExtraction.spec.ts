import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  cardHasAction,
  playerActions,
  playerActionGroups,
  playerActionSourceCount,
  allScopeActionCardNames,
  overriddenActionCards,
  flaggedActionCandidates,
} from '@/client/components/actions/actionExtraction';

function model(name: CardName, isDisabled = false): CardModel {
  return {name, isDisabled} as CardModel;
}

describe('actionExtraction', () => {
  it('detects a clean blue-card action with a render node (AI Central)', () => {
    expect(cardHasAction(CardName.AI_CENTRAL)).to.eq(true);
    const entries = playerActions([model(CardName.AI_CENTRAL)]);
    expect(entries.length).to.be.greaterThan(0);
    expect(entries[0].actionNode).to.not.eq(undefined);
    expect(entries[0].isCorporation).to.eq(false);
  });

  it('excludes effect-only / passive blue cards (no action)', () => {
    expect(cardHasAction(CardName.SPACE_STATION)).to.eq(false);
    expect(playerActions([model(CardName.SPACE_STATION)])).to.have.length(0);
  });

  it('detects a corporation action (United Nations Mars Initiative)', () => {
    expect(cardHasAction(CardName.UNITED_NATIONS_MARS_INITIATIVE)).to.eq(true);
    const entries = playerActions([model(CardName.UNITED_NATIONS_MARS_INITIATIVE)]);
    expect(entries.length).to.be.greaterThan(0);
    expect(entries[0].isCorporation).to.eq(true);
    expect(entries[0].actionNode).to.not.eq(undefined);
  });

  it('orders corporation actions before card actions', () => {
    const entries = playerActions([model(CardName.AI_CENTRAL), model(CardName.UNITED_NATIONS_MARS_INITIATIVE)]);
    expect(entries[0].isCorporation).to.eq(true); // corp first
    expect(entries[1].isCorporation).to.eq(false);
  });

  it('groups an `or` action (Aerial Mappers) into ONE source with several nodes', () => {
    const groups = playerActionGroups([model(CardName.AERIAL_MAPPERS)]);
    expect(groups).to.have.length(1);
    expect(groups[0].cardName).to.eq(CardName.AERIAL_MAPPERS);
    expect(groups[0].nodes.length).to.be.greaterThan(1); // two action alternatives, one source
  });

  it('counts action SOURCES (one per card, not per node)', () => {
    expect(playerActionSourceCount([
      model(CardName.UNITED_NATIONS_MARS_INITIATIVE),
      model(CardName.AI_CENTRAL),
      model(CardName.AERIAL_MAPPERS), // multi-node, still ONE source
      model(CardName.SPACE_STATION), // no action — excluded
    ])).to.eq(3);
  });

  it('flags a disabled card so it can be dimmed', () => {
    const groups = playerActionGroups([model(CardName.AI_CENTRAL, true)]);
    expect(groups[0].isDisabled).to.eq(true);
  });

  it('enumerates a substantial set of in-scope action cards for the playground', () => {
    expect(allScopeActionCardNames().length).to.be.greaterThan(30);
  });

  it('AUDIT: every in-scope action card has an extractable action graphic', () => {
    const flagged = flaggedActionCandidates();
    // Log any remaining flagged cards so the playground "flagged" tab matches;
    // an empty list means every in-scope action card renders cleanly (generic
    // scan or override).
    if (flagged.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Flagged action cards (no clean action node):', flagged.join(', '));
    }
    // The two bespoke-render cards (raw text / raw rows) are covered by an
    // override, so nothing falls back to a misleading description.
    expect(flagged).to.have.length(0);
  });

  it('covers the bespoke-render edge cases via overrides', () => {
    const overridden = overriddenActionCards();
    for (const c of [CardName.WEATHER_BALLOONS, CardName.ARCADIAN_COMMUNITIES]) {
      expect(cardHasAction(c), c).to.eq(true);
      expect(overridden, c).to.include(c);
      expect(flaggedActionCandidates(), c).to.not.include(c);
    }
    // Weather Balloons renders its whole renderData (the symbol graphic).
    expect(playerActions([model(CardName.WEATHER_BALLOONS)])[0].renderRoot).to.not.eq(undefined);
    // Arcadian Communities shows a text descriptor.
    expect(playerActions([model(CardName.ARCADIAN_COMMUNITIES)])[0].text).to.not.eq(undefined);
  });
});
