import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CONSOLE_TAG_ORDER, consoleAvailableTags, consoleTagEntries} from '@/client/components/console/consoleTagMatrix';

/** The printed tags a plain base-game deck yields (no wild / clone / expansion planets). */
const BASE_GAME_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY,
];

const ALL_PRINTED: ReadonlyArray<Tag> = CONSOLE_TAG_ORDER.filter((t) => t !== Tag.EVENT);

describe('consoleTagMatrix', () => {
  it('base game: shows the base printed tags plus the events counter, nothing else', () => {
    const tags = consoleAvailableTags(BASE_GAME_TAGS);
    expect(tags).to.deep.eq([
      Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
      Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.EVENT,
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

  it('order is canonical and independent of the input order', () => {
    const scrambled = [...ALL_PRINTED].reverse();
    expect(consoleAvailableTags(scrambled)).to.deep.eq(CONSOLE_TAG_ORDER);
  });

  it('order is independent of the counts — no resorting by value', () => {
    const zeroed = consoleTagEntries(BASE_GAME_TAGS, {});
    const mixed = consoleTagEntries(BASE_GAME_TAGS, {[Tag.CITY]: 9, [Tag.BUILDING]: 1} as Partial<Record<Tag, number>>);
    expect(mixed.map((e) => e.tag)).to.deep.eq(zeroed.map((e) => e.tag));
  });

  it('zero-count tags are included, count defaulting to 0 on a partial map', () => {
    const entries = consoleTagEntries(BASE_GAME_TAGS, {[Tag.SPACE]: 2} as Partial<Record<Tag, number>>);
    expect(entries).to.have.length(11);
    expect(entries.find((e) => e.tag === Tag.SPACE)?.count).to.eq(2);
    expect(entries.find((e) => e.tag === Tag.BUILDING)?.count).to.eq(0);
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
      expect(tags).to.not.include(Tag.MOON);
      expect(tags).to.not.include(Tag.CLONE);
    }
  });

  it('the full pool yields the full canonical order (max-expansion game)', () => {
    expect(consoleAvailableTags(ALL_PRINTED)).to.deep.eq(CONSOLE_TAG_ORDER);
  });
});
