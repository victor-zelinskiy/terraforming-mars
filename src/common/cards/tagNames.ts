import {Tag} from './Tag';

/**
 * THE DISPLAY NAME OF A TAG — as an EXISTING English i18n key.
 *
 * A rule that refuses a move because of a missing tag has to NAME it: «не
 * хватает обязательной метки» tells the player that something is wrong and
 * nothing about what to do, and the two surfaces that say it (a card's
 * disabled action variant, the Hydronetwork plan panel) were each one
 * hand-written sentence away from naming a different thing.
 *
 * Every key here is one the iconography help already ships (`Card Tags`), so
 * this coins nothing and cannot drift from the legend the player reads
 * elsewhere. `undefined` for a tag with no printed name of its own.
 *
 * Shared `src/common` module: the SERVER picks the key when it builds an
 * unplayable reason, the CLIENT translates it — the name is never interpolated
 * as raw text on the wire (a translated param would freeze the sentence to the
 * server's own language).
 */
const TAG_NAME_KEY: Partial<Record<Tag, string>> = {
  [Tag.BUILDING]: 'Building',
  [Tag.SPACE]: 'Space',
  [Tag.SCIENCE]: 'Science',
  [Tag.POWER]: 'Power',
  [Tag.EARTH]: 'Earth',
  [Tag.JOVIAN]: 'Jovian',
  [Tag.VENUS]: 'Venus',
  [Tag.PLANT]: 'Plant',
  [Tag.MICROBE]: 'Microbe',
  [Tag.ANIMAL]: 'Animal',
  [Tag.CITY]: 'City',
  [Tag.MOON]: 'Moon',
  [Tag.MARS]: 'Mars',
  [Tag.EVENT]: 'Event',
  [Tag.WILD]: 'Wild',
  [Tag.CLONE]: 'Clone',
};

export function tagNameKey(tag: Tag): string | undefined {
  return TAG_NAME_KEY[tag];
}

/**
 * THE TAGS OF ONE KIND A PLAYER HAS, as the subject of a count — «your Mars
 * tags» — the noun a «VP per tag» formula ends with (the score explorer's row
 * and its preview column: «4 × 1 ПО = 4 ПО · ваши метки Марса»). Before it the
 * formula said «matching tags» for every kind, which names nothing in the
 * preview column, where no medallion stands beside it (PL-095).
 *
 * These keys ARE coined (console.json), and they are the SAME WORD as the
 * name above, declined: the guard `tests/cards/tagNames.spec.ts` fails when a
 * count's RU noun stops agreeing with its tag's RU name — the class «two words
 * for one tag» (PL-031) cannot re-enter the console's own vocabulary. Only the
 * kinds a card can score by; the meta tags (wild, clone, event) have none and
 * keep the generic noun.
 */
const TAG_COUNT_KEY: Partial<Record<Tag, string>> = {
  [Tag.BUILDING]: 'your Building tags',
  [Tag.SPACE]: 'your Space tags',
  [Tag.SCIENCE]: 'your Science tags',
  [Tag.POWER]: 'your Power tags',
  [Tag.EARTH]: 'your Earth tags',
  [Tag.JOVIAN]: 'your Jovian tags',
  [Tag.VENUS]: 'your Venus tags',
  [Tag.PLANT]: 'your Plant tags',
  [Tag.MICROBE]: 'your Microbe tags',
  [Tag.ANIMAL]: 'your Animal tags',
  [Tag.CITY]: 'your City tags',
  [Tag.MOON]: 'your Moon tags',
  [Tag.MARS]: 'your Mars tags',
};

export function tagCountKey(tag: Tag): string | undefined {
  return TAG_COUNT_KEY[tag];
}

/** Every tag with a count noun — the guard's corpus. */
export function tagsWithCountKey(): ReadonlyArray<Tag> {
  return Object.keys(TAG_COUNT_KEY) as Array<Tag>;
}
