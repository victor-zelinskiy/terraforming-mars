/*
 * CONSOLE PLAY-CARD RESULT — the PURE view-model that guarantees the
 * «РЕЗУЛЬТАТ» block of the play composer is NEVER empty.
 *
 * The immediate on-play effects (resource / production / global-parameter /
 * TR / draw chips) and the branch variants come from the SERVER preview
 * (`/api/card-play-preview`) and are rendered directly from `preview.branches`.
 * This module adds the DERIVED result categories a blue card (or any card with
 * no immediate stock change) still delivers, read from the card's DECLARED
 * manifest metadata (NOT a rules reimplementation, mirroring the effects
 * overlay's 100%-client extraction):
 *   - a NEW ACTIVE ACTION (the card gains a repeatable blue-card action),
 *   - a PERMANENT EFFECT (an ongoing passive rule),
 *   - VICTORY POINTS at game end (fixed / conditional — a «per tags» card
 *     reads the SERVER's projection, `ActionPreview.cardVictoryPoints`:
 *     the number and its formula, never a client count),
 *   - the TAGS the card adds (strategic contribution),
 *   - an honest FALLBACK when nothing computable remains — so a preview gap
 *     reads as "applied after confirming" instead of a broken empty box.
 *
 * The card metadata is INJECTED (`PlayCardResultMeta`) so this stays
 * manifest-free and runs under the server test runner — the component resolves
 * `getCard(name)` / `cardHasAction` / `cardHasPassiveEffect` and passes the bits.
 *
 * No Vue / DOM / i18n. Unit-tested
 * (tests/client/components/console/consolePlayCardResult.spec.ts).
 */

import {Tag} from '@/common/cards/Tag';
import {CountableVictoryPoints} from '@/common/cards/CountableVictoryPoints';
import {CardVictoryPointsDetail} from '@/common/game/VictoryPointsBreakdown';
import {formulaFor, ScoreFormula} from '@/client/console/scoreExplorerModel';

export type PlayResultCategory = 'action' | 'effect' | 'vp' | 'tags' | 'fallback';

export type PlayResultSection = {
  kind: PlayResultCategory;
  /** English i18n key (translated by the component). */
  text: string;
  /** A short suffix detail (e.g. the VP amount `+2`). */
  detail?: string;
  /** A VP whose exact endgame value can't be known in the preview (conditional /
   *  per-resource) — the component shows "depends on conditions" instead of a number. */
  variable?: boolean;
  /** A NEGATIVE fixed VP — shown as a "Penalty: -N VP" line, not "Victory points". */
  penalty?: boolean;
  /** The SERVER's VP projection for a «per tags» card: `detail` is the number
   *  the card scores the moment it lands (a zero included), and this is the
   *  formula behind it — rendered through the score explorer's own formatter. */
  formula?: ScoreFormula;
  /** The printed tags this card adds (for the `tags` section chips). */
  tags?: ReadonlyArray<Tag>;
  /** TRUE for an EVENT card's tags — they only fire "on-tag" triggers at play
   *  time and are NOT kept (the card is discarded face-down). The row reads
   *  differently and carries a `note`. */
  eventTags?: boolean;
  /** A muted one-line clarification under the row (i18n key). */
  note?: string;
};

export type PlayCardResultMeta = {
  tags: ReadonlyArray<Tag>;
  /** The card grants a repeatable blue-card action (`ClientCard.hasAction` / `cardHasAction`). */
  hasAction: boolean;
  /** The card draws at least one passive ongoing effect (`cardHasPassiveEffect`). */
  hasEffect: boolean;
  victoryPoints?: number | 'special' | CountableVictoryPoints;
  /** The play preview's `cardVictoryPoints` (server-built, «per tags» cards
   *  only): the VP the card will score once played, with its mechanics. */
  vpProjection?: CardVictoryPointsDetail;
  /** The card is an EVENT (red). By the rules an event's tags are NOT added to
   *  the persistent tag count — they only fire "on-tag" triggers at play time,
   *  then the card is discarded face-down. So the result must NOT claim the
   *  player permanently gains these tags. */
  isEvent: boolean;
  /** Event tags DO count while this is true (the Odyssey corporation makes an
   *  event's tags count like any other). Defaults to false. */
  eventTagsCounted?: boolean;
};

export type PlayResultContext = {
  /** The preview shows at least one immediate on-play effect chip (or a reveal). */
  hasImmediate: boolean;
  /** The play has at least one honest post-confirm follow-up (placement / note). */
  hasFollowUp: boolean;
};

/**
 * The DERIVED result categories, appended below the immediate/variant chips.
 * Always returns a non-empty list when the immediate + follow-up context is
 * empty (so the whole «РЕЗУЛЬТАТ» block is never blank): tags cover almost every
 * card, and the fallback covers the degenerate "nothing computable" case.
 */
export function derivePlayResultSections(meta: PlayCardResultMeta, ctx: PlayResultContext): Array<PlayResultSection> {
  const out: Array<PlayResultSection> = [];

  // The wording is DELIBERATELY nominal, not a sentence: the block is already
  // titled «РЕЗУЛЬТАТ», so «Даёт новое действие» spends its first word
  // restating that heading. One noun phrase per unit reads as a list of what
  // the card delivers, which is what this block is.
  if (meta.hasAction) {
    out.push({kind: 'action', text: 'New action'});
  }
  if (meta.hasEffect) {
    out.push({kind: 'effect', text: 'Permanent effect'});
  }
  const vp = victoryPointSection(meta.victoryPoints, meta.vpProjection);
  if (vp !== undefined) {
    out.push(vp);
  }
  if (meta.tags.length > 0) {
    // Non-event cards stay face-up: their tags are permanently added to the
    // tableau (counted for milestones / awards / requirements / scoring).
    // An event's tags are NOT kept — they only fire "on-tag" triggers at play
    // time, so the row must read differently (unless Odyssey keeps them).
    const tagsKept = !meta.isEvent || meta.eventTagsCounted === true;
    out.push(tagsKept ?
      {kind: 'tags', text: 'Tags', tags: meta.tags} :
      {kind: 'tags', text: 'Event tags', tags: meta.tags, eventTags: true, note: 'Trigger on-tag effects only — not counted afterward'});
  }

  // Never leave the block blank: if there is no immediate effect, no honest
  // follow-up, and nothing derived above, show an explicit fallback line.
  if (out.length === 0 && !ctx.hasImmediate && !ctx.hasFollowUp) {
    out.push({kind: 'fallback', text: 'The card effect will be applied after confirming'});
  }
  return out;
}

function victoryPointSection(vp: PlayCardResultMeta['victoryPoints'], projection: CardVictoryPointsDetail | undefined): PlayResultSection | undefined {
  if (vp === undefined) {
    return undefined;
  }
  // Compact label — the player knows card VP are scored at game end, so the row
  // reads "Victory points: +1" (the "at game end" detail lives in fullscreen).
  // A NEGATIVE fixed VP is a downside — shown as "Penalty: -N VP", not "Victory points".
  if (typeof vp === 'number') {
    if (vp === 0) {
      return undefined;
    }
    if (vp < 0) {
      return {kind: 'vp', text: 'Penalty', detail: `${vp}`, penalty: true};
    }
    return {kind: 'vp', text: 'Victory points', detail: `+${vp}`};
  }
  // THE SERVER'S PROJECTION — a «per tags» card: the number it scores the
  // moment it lands (its own tags counted by the engine) and the formula
  // behind it, in the score explorer's own form. A ZERO is an answer, never a
  // reason to hide the row: for a card whose whole value is its VP,
  // «0 · [метка] 1 / 3 · ещё 2 до следующего ПО» IS the reading.
  if (projection?.mechanics?.shape === 'per') {
    const n = projection.victoryPoint;
    return {kind: 'vp', text: 'Victory points', detail: n > 0 ? `+${n}` : `${n}`, formula: formulaFor(projection)};
  }
  // 'special' or a CountableVictoryPoints the play may still move (resources,
  // cities, adjacency, colonies) — the exact endgame value can't be known now,
  // so state it honestly.
  return {kind: 'vp', text: 'Victory points', variable: true};
}

/**
 * A dev signal: TRUE when the whole result would be empty (no immediate, no
 * follow-up, and only the fallback derived). The component `console.warn`s this
 * so a genuine preview gap can be found and closed, per the audit contract.
 */
export function isFallbackOnlyResult(sections: ReadonlyArray<PlayResultSection>, ctx: PlayResultContext): boolean {
  return !ctx.hasImmediate && !ctx.hasFollowUp && sections.every((s) => s.kind === 'fallback');
}
