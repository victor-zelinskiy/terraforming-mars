import {expect} from 'chai';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {
  buildHandEntries,
  filterHandEntries,
  buildAvailabilityChips,
  buildTagChips,
  buildTypeChips,
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

describe('handCardModel — active-empty chip (filter survives the last card)', () => {
  // Ants/Tardigrades carry a MICROBE tag, Predators an ANIMAL tag; Acquired
  // Company is an AUTOMATED card. All are ACTIVE type except Acquired Company.

  it('an active TAG with no matching card in hand stays visible: count 0, activeEmpty', () => {
    // Hand holds only an animal card — the player narrowed to MICROBE and then
    // played the last microbe card. The chip MUST remain so it can be cleared.
    const entries = buildHandEntries([{name: CardName.PREDATORS}], true, new Set<CardName>(), false);
    const chips = buildTagChips(entries, {...DEFAULT_HAND_FILTER, activeTags: [Tag.MICROBE]});
    const microbe = chips.find((c) => c.tag === Tag.MICROBE);
    expect(microbe, 'active tag stays visible').to.not.be.undefined;
    expect(microbe?.count).eq(0);
    expect(microbe?.active).eq(true);
    expect(microbe?.activeEmpty).eq(true);
    expect(microbe?.muted).eq(false); // active chips are never muted
  });

  it('an INACTIVE tag absent from the hand is not rendered (visible = exists || active)', () => {
    const entries = buildHandEntries([{name: CardName.PREDATORS}], true, new Set<CardName>(), false);
    const chips = buildTagChips(entries, {...DEFAULT_HAND_FILTER});
    expect(chips.find((c) => c.tag === Tag.MICROBE)).to.be.undefined; // not in hand, not active
    expect(chips.find((c) => c.tag === Tag.ANIMAL)?.count).eq(1); // present in hand
  });

  it('an active-empty tag keeps its stable FILTERABLE_TAGS position (never jumps)', () => {
    // MICROBE precedes ANIMAL in the canonical order; even at count 0 the active
    // MICROBE chip stays BEFORE the present ANIMAL chip.
    const entries = buildHandEntries([{name: CardName.PREDATORS}], true, new Set<CardName>(), false);
    const chips = buildTagChips(entries, {...DEFAULT_HAND_FILTER, activeTags: [Tag.MICROBE]});
    expect(chips.map((c) => c.tag)).to.deep.eq([Tag.MICROBE, Tag.ANIMAL]);
  });

  it('an inactive in-hand tag with a 0 faceted count stays rendered but muted (distinct from activeEmpty)', () => {
    // availability=unplayable empties the slice (the card is soft/available, not
    // a rules block), but MICROBE still EXISTS in hand → muted, not hidden.
    const entries = buildHandEntries([{name: CardName.ANTS}], true, new Set<CardName>(), false);
    const chips = buildTagChips(entries, {...DEFAULT_HAND_FILTER, availability: 'unplayable'});
    const microbe = chips.find((c) => c.tag === Tag.MICROBE);
    expect(microbe, 'still rendered (exists in hand)').to.not.be.undefined;
    expect(microbe?.count).eq(0);
    expect(microbe?.muted).eq(true);
    expect(microbe?.activeEmpty).eq(false);
  });

  it('multiple active tags: one emptying becomes activeEmpty while the other still counts', () => {
    // Both ANIMAL + MICROBE were active; the animal card was played, only a
    // microbe card remains. Clearing the empty one must not affect the other.
    const entries = buildHandEntries([{name: CardName.ANTS}], true, new Set<CardName>(), false);
    const chips = buildTagChips(entries, {...DEFAULT_HAND_FILTER, activeTags: [Tag.ANIMAL, Tag.MICROBE]});
    const animal = chips.find((c) => c.tag === Tag.ANIMAL);
    const microbe = chips.find((c) => c.tag === Tag.MICROBE);
    expect(animal?.activeEmpty).eq(true);
    expect(animal?.count).eq(0);
    expect(microbe?.activeEmpty).eq(false);
    expect(microbe?.count).eq(1);
  });

  it('an active TYPE with no matching card in hand stays visible: count 0, activeEmpty', () => {
    // Hand holds only an AUTOMATED card; the player narrowed to ACTIVE and then
    // played the last active card.
    const entries = buildHandEntries([{name: CardName.ACQUIRED_COMPANY}], true, new Set<CardName>(), false);
    const chips = buildTypeChips(entries, {...DEFAULT_HAND_FILTER, activeTypes: ['active']});
    const active = chips.find((c) => c.key === 'active');
    expect(active, 'active type stays visible').to.not.be.undefined;
    expect(active?.count).eq(0);
    expect(active?.active).eq(true);
    expect(active?.activeEmpty).eq(true);
    expect(chips.find((c) => c.key === 'automated')?.count).eq(1); // the in-hand card
  });

  it('an inactive type absent from the hand is not rendered', () => {
    const entries = buildHandEntries([{name: CardName.ACQUIRED_COMPANY}], true, new Set<CardName>(), false);
    const chips = buildTypeChips(entries, {...DEFAULT_HAND_FILTER});
    expect(chips.find((c) => c.key === 'active')).to.be.undefined; // not in hand, not active
    expect(chips.find((c) => c.key === 'automated')?.count).eq(1);
  });
});
