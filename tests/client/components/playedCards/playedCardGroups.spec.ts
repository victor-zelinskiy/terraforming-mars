import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Tag} from '@/common/cards/Tag';
import {
  buildPlayedGroups,
  buildPlayedTagChips,
  buildPlayedTypeChips,
  filterPlayedGroups,
  playedCardTags,
} from '@/client/components/playedCards/playedCardGroups';

function model(name: CardName): CardModel {
  return {name} as CardModel;
}

// A small mixed tableau: a corporation + two active cards with distinct tags.
// SPACE_STATION carries a Space tag, ANTS carries a Microbe tag — the test
// asserts those preconditions so it stays self-validating if a card changes.
const POSEIDON = model(CardName.POSEIDON); // corporation
const SPACE_STATION = model(CardName.SPACE_STATION); // active, Space
const ANTS = model(CardName.ANTS); // active, Microbe
const TABLEAU = [POSEIDON, SPACE_STATION, ANTS];

describe('playedCardGroups — grouping', () => {
  it('groups cards by type into the stable group set', () => {
    const groups = buildPlayedGroups(TABLEAU);
    const corp = groups.find((g) => g.key === 'corporation');
    const active = groups.find((g) => g.key === 'active');
    expect(corp?.cards.map((c) => c.name)).to.deep.equal([CardName.POSEIDON]);
    expect(active?.cards.map((c) => c.name)).to.deep.equal([CardName.SPACE_STATION, CardName.ANTS]);
  });

  it('precondition: the fixture tags are what the test relies on', () => {
    expect(playedCardTags(SPACE_STATION)).to.include(Tag.SPACE);
    expect(playedCardTags(ANTS)).to.include(Tag.MICROBE);
    expect(playedCardTags(ANTS)).to.not.include(Tag.SPACE);
  });
});

describe('playedCardGroups — filtering', () => {
  const nonEmpty = buildPlayedGroups(TABLEAU).filter((g) => g.cards.length > 0);

  it('drops hidden type groups wholesale', () => {
    const visible = filterPlayedGroups(nonEmpty, {hiddenGroups: ['corporation'], activeTags: []});
    expect(visible.map((g) => g.key)).to.deep.equal(['active']);
  });

  it('narrows cards by the tag filter and drops emptied groups', () => {
    const visible = filterPlayedGroups(nonEmpty, {hiddenGroups: [], activeTags: [Tag.SPACE]});
    // The corporation has no Space tag → dropped; active keeps only Space Station.
    expect(visible.map((g) => g.key)).to.deep.equal(['active']);
    expect(visible[0].cards.map((c) => c.name)).to.deep.equal([CardName.SPACE_STATION]);
  });

  it('combines type + tag dimensions (AND)', () => {
    const visible = filterPlayedGroups(nonEmpty, {hiddenGroups: ['active'], activeTags: [Tag.SPACE]});
    // Active hidden AND only-Space → nothing left.
    expect(visible).to.have.length(0);
  });
});

describe('playedCardGroups — faceted chips', () => {
  const nonEmpty = buildPlayedGroups(TABLEAU).filter((g) => g.cards.length > 0);

  it('type chips count cards faceted by the tag filter', () => {
    const noFilter = buildPlayedTypeChips(nonEmpty, {hiddenGroups: [], activeTags: []});
    expect(noFilter.find((c) => c.key === 'active')?.count).to.equal(2);
    expect(noFilter.find((c) => c.key === 'active')?.enabled).to.equal(true);

    const spaceOnly = buildPlayedTypeChips(nonEmpty, {hiddenGroups: [], activeTags: [Tag.SPACE]});
    // Only Space Station carries Space → active count drops to 1.
    expect(spaceOnly.find((c) => c.key === 'active')?.count).to.equal(1);
  });

  it('type chip reflects hidden (disabled) state', () => {
    const chips = buildPlayedTypeChips(nonEmpty, {hiddenGroups: ['corporation'], activeTags: []});
    expect(chips.find((c) => c.key === 'corporation')?.enabled).to.equal(false);
    expect(chips.find((c) => c.key === 'active')?.enabled).to.equal(true);
  });

  it('tag chips appear for present tags with faceted counts', () => {
    const chips = buildPlayedTagChips(nonEmpty, {hiddenGroups: [], activeTags: []});
    const space = chips.find((c) => c.tag === Tag.SPACE);
    const microbe = chips.find((c) => c.tag === Tag.MICROBE);
    expect(space?.count).to.equal(1);
    expect(microbe?.count).to.equal(1);
    expect(space?.muted).to.equal(false);
  });

  it('a tag chip goes muted when its type group is hidden away', () => {
    // Hide the active group → the Microbe tag (only on Ants) has 0 visible cards.
    const chips = buildPlayedTagChips(nonEmpty, {hiddenGroups: ['active'], activeTags: []});
    const microbe = chips.find((c) => c.tag === Tag.MICROBE);
    expect(microbe?.count).to.equal(0);
    expect(microbe?.muted).to.equal(true);
  });
});
