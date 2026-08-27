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
