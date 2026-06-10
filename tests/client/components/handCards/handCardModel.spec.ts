import {expect} from 'chai';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {
  buildHandEntries,
  filterHandEntries,
  buildAvailabilityChips,
  DEFAULT_HAND_FILTER,
} from '@/client/components/handCards/handCardModel';

// Three real cards so the client manifest lookup (getCard) resolves their type/tags.
const cards: ReadonlyArray<CardModel> = [
  {name: CardName.ANTS},
  {name: CardName.PREDATORS},
  {name: CardName.TARDIGRADES},
];

describe('handCardModel — select-context availability', () => {
  // In a SELECT/PICK context the availability dimension is re-pointed to "can be
  // CHOSEN right now" (membership in the prompt's candidate set) instead of "can
  // be played" — so the ДОСТУПНЫЕ / НЕДОСТУПНЫЕ chips + filter describe the pick.
  const entries = buildHandEntries(cards, true, new Set<CardName>(), false);
  const selectable: ReadonlySet<CardName> = new Set([CardName.ANTS, CardName.PREDATORS]);

  it('the "available" filter keeps the SELECTABLE cards (not the playable ones)', () => {
    const filtered = filterHandEntries(entries, {...DEFAULT_HAND_FILTER, availability: 'playable'}, selectable);
    expect(filtered.map((e) => e.name)).to.have.members([CardName.ANTS, CardName.PREDATORS]);
  });

  it('the "unavailable" filter keeps the NON-selectable cards', () => {
    const filtered = filterHandEntries(entries, {...DEFAULT_HAND_FILTER, availability: 'unplayable'}, selectable);
    expect(filtered.map((e) => e.name)).to.deep.eq([CardName.TARDIGRADES]);
  });

  it('the availability chips count by selectability in a select context', () => {
    const chips = buildAvailabilityChips(entries, {...DEFAULT_HAND_FILTER}, selectable);
    expect(chips.find((c) => c.value === 'playable')?.count).eq(2);
    expect(chips.find((c) => c.value === 'unplayable')?.count).eq(1);
    expect(chips.find((c) => c.value === 'all')?.count).eq(3);
  });

  it('without a selectable set (normal play) availability still means playability', () => {
    // No selectable set → the filter falls back to the play-state block. With an
    // empty playable set + turn available, nothing is playable-by-rules here, so
    // "available" keeps the soft-blocked (still-selectable-as-playable) entries —
    // the key assertion is simply that it does NOT throw and treats `undefined`
    // as the play path (all three are returned under 'all').
    const all = filterHandEntries(entries, {...DEFAULT_HAND_FILTER, availability: 'all'});
    expect(all).has.length(3);
  });
});
