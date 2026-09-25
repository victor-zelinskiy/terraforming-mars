import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CONSOLE_TAG_ORDER, NO_TAG_CELL, consoleAvailableTags, consoleTagEntries} from '@/client/components/console/consoleTagMatrix';

/** The printed tags a plain base-game deck yields (no wild / clone / expansion planets). */
const BASE_GAME_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY,
];

/** Every cell a DECK can print — i.e. the order minus the two deck-less counters. */
const ALL_PRINTED: ReadonlyArray<Tag> =
  CONSOLE_TAG_ORDER.filter((t): t is Tag => t !== Tag.EVENT && t !== NO_TAG_CELL);

describe('consoleTagMatrix', () => {
  it('base game: shows the base printed tags plus the deck-less counters, nothing else', () => {
    const tags = consoleAvailableTags(BASE_GAME_TAGS);
    expect(tags).to.deep.eq([
      Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
      Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.EVENT, NO_TAG_CELL,
    ]);
    expect(tags).to.not.include(Tag.VENUS);
    expect(tags).to.not.include(Tag.MOON);
    expect(tags).to.not.include(Tag.CLONE);
  });

  it('an expansion tag present in game.tags becomes available (venus / moon / mars / crime)', () => {
    for (const extra of [Tag.VENUS, Tag.MOON, Tag.MARS, Tag.CRIME]) {
      const tags = consoleAvailableTags([...BASE_GAME_TAGS, extra]);
      expect(tags, extra).to.include(extra);
    }
  });

  it('a tag NOT in game.tags never appears, whatever the counts say', () => {
    const entries = consoleTagEntries(BASE_GAME_TAGS, {[Tag.VENUS]: 3} as Partial<Record<Tag, number>>);
    expect(entries.map((e) => e.tag)).to.not.include(Tag.VENUS);
  });

  it('EVENT is always available even though event cards never print the tag', () => {
    expect(consoleAvailableTags(BASE_GAME_TAGS)).to.include(Tag.EVENT);
    expect(consoleAvailableTags(ALL_PRINTED)).to.include(Tag.EVENT);
  });

  it('the no-tags counter is always available — no deck can print the absence of a tag', () => {
    expect(consoleAvailableTags(BASE_GAME_TAGS)).to.include(NO_TAG_CELL);
    expect(consoleAvailableTags(ALL_PRINTED)).to.include(NO_TAG_CELL);
    expect(consoleAvailableTags(undefined)).to.include(NO_TAG_CELL);
  });

  it('the no-tags cell is LAST — the meta counters close the matrix', () => {
    const tags = consoleAvailableTags(ALL_PRINTED);
    expect(tags[tags.length - 1]).to.eq(NO_TAG_CELL);
    expect(tags[tags.length - 2]).to.eq(Tag.EVENT);
  });

  it('order is canonical and independent of the input order', () => {
    const scrambled = [...ALL_PRINTED].reverse();
    expect(consoleAvailableTags(scrambled)).to.deep.eq(CONSOLE_TAG_ORDER);
  });

  it('order is independent of the counts — no resorting by value', () => {
    const zeroed = consoleTagEntries(BASE_GAME_TAGS, {});
    const mixed = consoleTagEntries(BASE_GAME_TAGS, {[Tag.CITY]: 9, [Tag.BUILDING]: 1} as Partial<Record<Tag, number>>, 4);
    expect(mixed.map((e) => e.tag)).to.deep.eq(zeroed.map((e) => e.tag));
  });

  it('zero-count tags are included, count defaulting to 0 on a partial map', () => {
    const entries = consoleTagEntries(BASE_GAME_TAGS, {[Tag.SPACE]: 2} as Partial<Record<Tag, number>>);
    expect(entries).to.have.length(12);
    expect(entries.find((e) => e.tag === Tag.SPACE)?.count).to.eq(2);
    expect(entries.find((e) => e.tag === Tag.BUILDING)?.count).to.eq(0);
  });

  it('the no-tags count comes from its OWN field, never from the tag map', () => {
    const entries = consoleTagEntries(BASE_GAME_TAGS, {[Tag.SPACE]: 2} as Partial<Record<Tag, number>>, 3);
    expect(entries.find((e) => e.tag === NO_TAG_CELL)?.count).to.eq(3);
    // A count map that (impossibly) carried the key must not leak into the cell.
    const spoofed = consoleTagEntries(BASE_GAME_TAGS, {none: 9} as unknown as Partial<Record<Tag, number>>, 1);
    expect(spoofed.find((e) => e.tag === NO_TAG_CELL)?.count).to.eq(1);
  });

  it('tolerates a missing counts map entirely (setup-reveal baseline)', () => {
    const entries = consoleTagEntries(BASE_GAME_TAGS, undefined);
    expect(entries.every((e) => e.count === 0)).to.be.true;
  });

  it('falls back to the base-game set on a save with no game.tags', () => {
    for (const legacy of [undefined, [] as Array<Tag>]) {
      const tags = consoleAvailableTags(legacy);
      expect(tags).to.include(Tag.BUILDING);
      expect(tags).to.include(Tag.EVENT);
      expect(tags).to.include(NO_TAG_CELL);
      expect(tags).to.not.include(Tag.MOON);
      expect(tags).to.not.include(Tag.CLONE);
    }
  });

  it('the full pool yields the full canonical order (max-expansion game)', () => {
    expect(consoleAvailableTags(ALL_PRINTED)).to.deep.eq(CONSOLE_TAG_ORDER);
  });

  describe('the ADDITION a standing law makes', () => {
    const LAW = 'RDX_SCIENTISTS_RD_FUNDING';

    it('rides its own field and never touches the printed count', () => {
      const entries = consoleTagEntries(
        BASE_GAME_TAGS, {[Tag.SCIENCE]: 2} as Partial<Record<Tag, number>>, 0,
        [{tag: Tag.SCIENCE, amount: 3, resolution: LAW}]);
      const science = entries.find((e) => e.tag === Tag.SCIENCE)!;
      expect(science.count, 'the printed count is untouched').to.eq(2);
      expect(science.bonus).to.deep.eq({amount: 3, resolution: LAW});
    });

    it('is absent from every tag the law does not raise, and from the whole matrix without a law', () => {
      const entries = consoleTagEntries(
        BASE_GAME_TAGS, {[Tag.SCIENCE]: 2, [Tag.SPACE]: 1} as Partial<Record<Tag, number>>, 0,
        [{tag: Tag.SCIENCE, amount: 1, resolution: LAW}]);
      expect(entries.find((e) => e.tag === Tag.SPACE)?.bonus).to.be.undefined;
      expect(entries.filter((e) => e.bonus !== undefined)).to.have.length(1);

      for (const none of [undefined, []]) {
        const plain = consoleTagEntries(BASE_GAME_TAGS, {[Tag.SCIENCE]: 2} as Partial<Record<Tag, number>>, 0, none);
        expect(plain.every((e) => e.bonus === undefined), 'no law, no addition').to.be.true;
      }
    });

    it('an entry that adds nothing is no entry at all — a «+0» is never drawn', () => {
      const entries = consoleTagEntries(
        BASE_GAME_TAGS, {} as Partial<Record<Tag, number>>, 0,
        [{tag: Tag.SCIENCE, amount: 0, resolution: LAW}]);
      expect(entries.find((e) => e.tag === Tag.SCIENCE)?.bonus).to.be.undefined;
    });

    it('the no-tag counter can never carry one — it counts the ABSENCE of a tag', () => {
      const entries = consoleTagEntries(
        BASE_GAME_TAGS, {} as Partial<Record<Tag, number>>, 3,
        [{tag: NO_TAG_CELL, amount: 2, resolution: LAW}] as never);
      expect(entries.find((e) => e.tag === NO_TAG_CELL)?.bonus).to.be.undefined;
    });
  });
});
