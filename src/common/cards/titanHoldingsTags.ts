import {Tag} from './Tag';

/**
 * TR84 Titan Holdings' PLANET TAGS — the five the scan's ringed-planet disc stands for: «a Mars, Earth, Venus, Jovian,
 * or Moon tag». ONE list for the human card (`server/cards/turmoilRedux/TitanHoldings.ts`, its match predicate and
 * forecast twin) and its MarsBot version (CF10, `server/automa/corps/MarsBotTitanHoldings.ts`) — the bot's card reads
 * the human card's own reading of the print, never a second copy (the C21 law). Common, because the bot's corporation
 * registry loads before the card classes.
 */
export const TITAN_TAGS: ReadonlyArray<Tag> = [Tag.MARS, Tag.EARTH, Tag.VENUS, Tag.JOVIAN, Tag.MOON];
