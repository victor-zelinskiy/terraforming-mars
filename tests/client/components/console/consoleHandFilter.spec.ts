import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CardModel} from '@/common/models/CardModel';
import {
  buildAlbumFilters, buildConsoleTagFilters, cardPayout, filterAlbumEntries, filterHandByTag, cycleTagFilter, ConsoleTagFilterOption,
  hiddenByFilter, paysPresetOffered,
} from '@/client/components/console/consoleHandFilter';

function card(name: string): CardModel {
  return {name} as unknown as CardModel;
}

// Stub printed-tag map keyed by the fake card name (keeps the test off the
// client manifest — the real cardTags() lookup is the only manifest-touching bit).
const TAGS: Record<string, Array<Tag>> = {
  build1: [Tag.BUILDING],
  build2: [Tag.BUILDING, Tag.SPACE],
  sci1: [Tag.SCIENCE],
  space1: [Tag.SPACE],
  none1: [],
};
const tagsOf = (c: CardModel) => TAGS[c.name] ?? [];

describe('consoleHandFilter', () => {
  describe('buildConsoleTagFilters', () => {
    it('puts All first with the total, then present tags in canonical order with counts', () => {
      const cards = [card('build1'), card('build2'), card('sci1'), card('space1'), card('none1')];
      const opts = buildConsoleTagFilters(cards, 'all', tagsOf);
      expect(opts[0]).to.deep.eq({value: 'all', count: 5});
      // canonical FILTERABLE_TAGS order: BUILDING → SPACE → SCIENCE
      expect(opts.map((o) => o.value)).to.deep.eq(['all', Tag.BUILDING, Tag.SPACE, Tag.SCIENCE]);
      expect(opts.find((o) => o.value === Tag.BUILDING)?.count).to.eq(2);
      expect(opts.find((o) => o.value === Tag.SPACE)?.count).to.eq(2); // build2 + space1
      expect(opts.find((o) => o.value === Tag.SCIENCE)?.count).to.eq(1);
    });

    it('omits tags absent from the hand', () => {
      const opts = buildConsoleTagFilters([card('sci1')], 'all', tagsOf);
      expect(opts.map((o) => o.value)).to.deep.eq(['all', Tag.SCIENCE]);
      expect(opts.some((o) => o.value === Tag.ANIMAL)).to.be.false;
    });

    it('keeps the ACTIVE tag even at count 0 (its last matching card left the hand)', () => {
      const opts = buildConsoleTagFilters([card('sci1')], Tag.ANIMAL, tagsOf);
      const animal = opts.find((o) => o.value === Tag.ANIMAL);
      expect(animal).to.not.be.undefined;
      expect(animal?.count).to.eq(0);
    });
  });

  describe('filterHandByTag', () => {
    const entries = [card('build1'), card('build2'), card('sci1')].map((c) => ({card: c}));
    it('returns every entry for All', () => {
      expect(filterHandByTag(entries, 'all', tagsOf)).to.have.length(3);
    });
    it('narrows to cards carrying the tag', () => {
      expect(filterHandByTag(entries, Tag.BUILDING, tagsOf).map((e) => e.card.name)).to.deep.eq(['build1', 'build2']);
      expect(filterHandByTag(entries, Tag.SPACE, tagsOf).map((e) => e.card.name)).to.deep.eq(['build2']);
    });
    it('returns empty when no card carries the tag', () => {
      expect(filterHandByTag(entries, Tag.ANIMAL, tagsOf)).to.have.length(0);
    });
  });

  describe('cycleTagFilter', () => {
    const opts: Array<ConsoleTagFilterOption> = [
      {value: 'all', count: 5},
      {value: Tag.BUILDING, count: 2},
      {value: Tag.SCIENCE, count: 1},
    ];
    it('moves forward and wraps', () => {
      expect(cycleTagFilter(opts, 'all', 1)).to.eq(Tag.BUILDING);
      expect(cycleTagFilter(opts, Tag.SCIENCE, 1)).to.eq('all');
    });
    it('moves backward and wraps', () => {
      expect(cycleTagFilter(opts, 'all', -1)).to.eq(Tag.SCIENCE);
      expect(cycleTagFilter(opts, Tag.BUILDING, -1)).to.eq('all');
    });
    it('starts from All when the active value is absent', () => {
      expect(cycleTagFilter(opts, Tag.ANIMAL, 1)).to.eq(Tag.BUILDING);
    });
    it('is safe with no options', () => {
      expect(cycleTagFilter([], 'all', 1)).to.eq('all');
    });
  });
});

describe('consoleHandFilter · the PICKER’s filter (P50 polish · FD)', () => {
  const T: Record<string, Array<Tag>> = {
    trees: [Tag.PLANT],
    experts: [Tag.PLANT, Tag.MICROBE],
    livestock: [Tag.ANIMAL],
    elevator: [Tag.SPACE, Tag.BUILDING],
    lab: [Tag.SCIENCE],
  };
  const tagsOfT = (c: CardModel) => T[c.name] ?? [];
  const REDS = {icon: 'megacredits', amount: 2, perTag: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]};
  const hand = ['trees', 'experts', 'livestock', 'elevator', 'lab'].map(card);

  it('a card’s payout is the header’s rule card by card — every paying printed tag, a card may pay twice', () => {
    expect(hand.map((c) => cardPayout(c, REDS, tagsOfT))).deep.eq([2, 4, 2, 0, 0]);
    expect(cardPayout(card('trees'), {icon: 'megacredits', amount: 2, perCard: true}, tagsOfT)).eq(2);
    expect(cardPayout(card('trees'), undefined, tagsOfT)).eq(0);
  });

  it('«ПЛАТЯТ» is offered ONLY for a per-tag exchange (read off the marker), second after «ВСЕ», with its count', () => {
    expect(paysPresetOffered(REDS)).is.true;
    expect(paysPresetOffered({icon: 'megacredits', amount: 2, perCard: true}), 'every card pays — nothing to narrow').is.false;
    expect(paysPresetOffered(undefined)).is.false;
    const opts = buildAlbumFilters(hand, 'all', REDS, tagsOfT);
    expect(opts.slice(0, 2)).deep.eq([{value: 'all', count: 5}, {value: 'pays', count: 3}]);
    expect(buildAlbumFilters(hand, 'all', undefined, tagsOfT).some((o) => o.value === 'pays')).is.false;
  });

  it('the picker narrows by its own chip — «pays» keeps the paying cards, a tag its cards', () => {
    const entries = hand.map((c) => ({card: c}));
    expect(filterAlbumEntries(entries, 'pays', REDS, tagsOfT).map((e) => e.card.name)).deep.eq(['trees', 'experts', 'livestock']);
    expect(filterAlbumEntries(entries, Tag.MICROBE, REDS, tagsOfT).map((e) => e.card.name)).deep.eq(['experts']);
    expect(filterAlbumEntries(entries, 'all', REDS, tagsOfT)).has.length(5);
  });

  it('the honesty count names the CANDIDATES a chip hides (never a non-candidate)', () => {
    expect(hiddenByFilter(['trees', 'experts', 'lab'], ['experts'])).eq(2);
    expect(hiddenByFilter(['trees'], ['trees', 'lab'])).eq(0);
  });
});
