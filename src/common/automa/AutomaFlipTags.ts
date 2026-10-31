import {Tag} from '../cards/Tag';

/**
 * HOME RULE — A TAG WITH NO TRACK RESOLVES AS A RANDOM ORDINARY TAG (the owner, 2026-10-31).
 *
 * The Automa rulebook knows the base tags (one track each), Wild (the least advanced track) and the icon of an
 * expansion that is not in use (ignored). Turmoil Redux, Pathfinders, The Moon and Underworld print tags no MarsBot
 * board has a track for — 4 % of all tags in the pool today, 10–15 % of a table with several of them — and the
 * bot ignored them: a card whose EVERY tag is one of these (10 Mars-only cards in a Redux deck) was a turn with no
 * step and not even a Failed Action's 5 M€.
 *
 * Under this rule each such tag of a resolved card flips the top card of the project deck and advances the track
 * of ONE RANDOM tracked tag of it (the game's seeded RNG); the flipped card is discarded; a flipped card with no
 * tracked tag is discarded and the next one flipped (at most {@link AUTOMA_FLIP_MAX_CARDS}). The other tags of the
 * resolved card resolve as before, left to right. Why random and not the flipped card's FIRST tag: the first tag
 * over-weights power (14 % of flips against its 11 % of the deck's tags — the track with the early «+3 TR» cell)
 * and halves event (an event tag is printed last); a random one stays within 2 points of the deck's own mix. So a
 * tag with no track is worth exactly what an ordinary tag of the same deck is worth — whatever expansions are in.
 *
 * Venus without Venus Next keeps the rulebook's reading (an unused expansion's icon — ignored). The chairman quest
 * and the corporation's «when MarsBot resolves a <tag>» clause still see the PRINTED tag. HIDDEN from every surface
 * but the bot-turn review (the owner: «инфа видна только в обзоре хода бота»): no journal line, no notification.
 */
export const AUTOMA_FLIP_TAGS: ReadonlySet<Tag> = new Set([Tag.MARS, Tag.MOON, Tag.CRIME, Tag.CLONE]);

/** The most project cards one tag may flip looking for a tracked tag (a pool of only untracked tags never loops). */
export const AUTOMA_FLIP_MAX_CARDS = 10;
