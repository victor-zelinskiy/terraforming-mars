/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A REFUSED RATING HAS TWO SOURCES AND ONE GRAMMAR (`ActionEffect.vetoed` — `VetoedRatingMark`):
 *  · a LAW's veto (Turmoil Redux RX42 UNMI Veto — the seat is first by rating; the whole event refused);
 *  · a CARD's standing skip (P57 Preservation Program — the first TR gained in a generation's action phase).
 * The chip is the same struck chip, the slot note and the hint name the SOURCE. Every surface that says «this rating
 * will not come» asks here — never its own sentence, never `resolution !== undefined` at a call site.
 */
import {ActionEffect, VetoedRatingMark} from '@/common/models/ActionPreviewModel';

export type RatingRefusalSource = 'law' | 'card';

/** Who refuses the rating a mark stands for: a card when the mark names one, else the law. */
export function ratingRefusalSourceOf(mark: Pick<VetoedRatingMark, 'card'> | undefined): RatingRefusalSource {
  return mark?.card !== undefined ? 'card' : 'law';
}

/** The source of the first struck chip of a list — undefined when nothing is struck. */
export function ratingRefusalOfEffects(effects: ReadonlyArray<ActionEffect>): RatingRefusalSource | undefined {
  const struck = effects.find((e) => e.vetoed !== undefined);
  return struck === undefined ? undefined : ratingRefusalSourceOf(struck.vetoed);
}

/** The slot / row NOTE before the press, by source — an i18n key («РТ под вето» · «Первый РТ пропускается»). */
export const RATING_REFUSAL_NOTE: Readonly<Record<RatingRefusalSource, string>> = {
  law: 'TR under the veto',
  card: 'First TR is skipped',
};

export function ratingRefusalNote(source: RatingRefusalSource): string {
  return RATING_REFUSAL_NOTE[source];
}

/** A CARD's struck chip hint — `${0}` the card's (translated) name, `${1}` the steps. */
export const CARD_SKIP_CHIP_HINT = '${0}: ${1} TR not counted — the first raise in this generation';
