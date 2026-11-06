import {Tag} from '../../../common/cards/Tag';
import {TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * THE PRESSURE MODEL — a deterministic forecast of how fast a mat's tracks move under a game's project deck (the
 * prompt's § Генератор, п. 6). No randomness: the expected tag flow of a generation (`CARDS_PER_GENERATION` cards of
 * the deck's own tag mix) pushes each track; an «advance» cell landed on adds its free step on the spot (the chain).
 * The answer is the expected GENERATION each cell is first reached — what the generator weighs a threshold cell and a
 * milestone / award cell by, against the window the static boards span (docs/AUTOMA_DATA_AUDIT.md §22.4).
 *
 * The bench convention is the model's: 3 project cards a generation (the official research phase), the same unit the
 * band was taken in. It forecasts the bench, not a real game — which is all a comparison with the band needs.
 */
export const PRESSURE_CARDS_PER_GENERATION = 3;

/** Printed tag occurrences per card of the deck (the bot reads every printed tag; an event adds its red arrow). */
export type DeckTagMix = Partial<Record<Tag, number>>;

/** The generation (fractional, 1-based like the bench's) each cell of a track is first reached; Infinity = never. */
export function cellArrivals(track: TrackDefinition, mix: DeckTagMix, horizon = 30): Array<number> {
  const rate = track.tags.reduce((sum, tag) => sum + (mix[tag] ?? 0), 0) * PRESSURE_CARDS_PER_GENERATION;
  const max = track.maxPosition ?? 18;
  const arrivals = new Array<number>(max + 1).fill(Number.POSITIVE_INFINITY);
  arrivals[0] = 0;
  if (rate <= 0) {
    return arrivals;
  }
  // Walk the track step by step: each paid step takes 1 / rate generations; an «advance» cell chains the next one free.
  let generation = 0;
  let position = 0;
  while (position < max && generation <= horizon) {
    generation += 1 / rate;
    position++;
    arrivals[position] = generation;
    while (position < max && track.layout[position] === 'advance') {
      position++;
      arrivals[position] = generation;
    }
  }
  // The bench's generation 1 starts at 0 cards: shift to its 1-based reading.
  return arrivals.map((g) => (Number.isFinite(g) && g > 0 ? g + 1 : g));
}
