/*
 * THE ONE READING OF A SEAT'S INFLUENCE (Turmoil Redux, T05 Event Analysts).
 *
 * A seat's influence is the SERVER's number (`ParliamentPlayerModel.influence`
 * — `Parliament.influence`: the Career's level + every bonus beyond it). The
 * Career track draws LEVELS (each influence cell's reward), and until a card
 * gave influence beyond the track the two were the same number — so half the
 * surfaces printed the level and called it the influence. With a bonus they
 * part: a seat at step 3 (level 2) holding Event Analysts votes with 3.
 *
 * The law every surface reads through this module:
 *   · the number in an influence disc is the FINAL influence (`total`);
 *   · the modifier «+N» beside it is what stands BEYOND the Career (`bonus`) —
 *     shown only when N > 0, never re-colouring the number;
 *   · the sources name the givers (`sources` — the server's ledger);
 *   · «level N» is printed ONLY as the reward of a cell of the track.
 *
 * Nothing here adds influence up: `total` is the server's, `track` is the
 * printed level at the seat's step, and `bonus` is the difference the server
 * already made. The one projection (`influenceAtStep` — «what the seat will
 * vote with once its marker reaches step N») is the forecast's own shape
 * (`influenceYieldModel`: the level of the step + the bonus the seat keeps).
 *
 * Pure: no Vue, no DOM, no i18n.
 */
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';

/** WHERE a seat's influence comes from — the track, and everything on top of it by name. */
export type InfluenceReading = {
  /** The seat's FINAL influence — the server's number, the one every law applies. */
  total: number;
  /** The Career track's own level at the seat's step (a cell's reward). */
  track: number;
  /** Everything above the track (0 = the track alone — the modifier is not drawn). */
  bonus: number;
  /** …itemised, when the server knows the givers. `source` is a card name / an i18n key. */
  sources: ReadonlyArray<{amount: number, source?: string}>;
};

/** The fields of a seat the reading needs (`ParliamentPlayerModel` carries them). */
export type InfluenceSeat = {
  influence: number;
  agenda: number;
  influenceSources?: ReadonlyArray<{amount: number, source?: string}>;
};

export const NO_INFLUENCE: InfluenceReading = {total: 0, track: 0, bonus: 0, sources: []};

/**
 * The seat's reading. A seat the Parliament does not count reads 0 from the
 * server — its bonus is not applied, so none is shown (never a negative).
 */
export function influenceReadingOf(seat: InfluenceSeat | undefined): InfluenceReading {
  if (seat === undefined) {
    return NO_INFLUENCE;
  }
  const track = influenceAtAgenda(seat.agenda);
  return {
    total: seat.influence,
    track,
    bonus: Math.max(0, seat.influence - track),
    sources: seat.influenceSources ?? [],
  };
}

/**
 * The influence the seat will hold once its marker stands on `step` — the
 * level that step sets plus the bonus the seat keeps (a bonus is not a step of
 * the Career and survives every walk). For an announce of a walk and a «next
 * reward» chip; the CURRENT influence is always `reading.total`.
 */
export function influenceAtStep(reading: InfluenceReading, step: number): number {
  return influenceAtAgenda(step) + reading.bonus;
}

/**
 * The seat's reading ON a step of the Career — for an announce of a walk («шаг 7 · уровень 3 · влияние 4 +1»): the
 * step's level, the total the seat will vote with there, the same bonus and givers. `undefined` when the seat holds
 * nothing beyond the track — the step's level IS its influence then, and the chip says it once.
 */
export function influenceReadingAtStep(seat: InfluenceSeat | undefined, step: number): InfluenceReading | undefined {
  const reading = influenceReadingOf(seat);
  if (reading.bonus <= 0) {
    return undefined;
  }
  return {...reading, track: influenceAtAgenda(step), total: influenceAtStep(reading, step)};
}
