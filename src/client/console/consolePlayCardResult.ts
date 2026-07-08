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
 *   - VICTORY POINTS at game end (fixed / conditional),
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

export type PlayResultCategory = 'action' | 'effect' | 'vp' | 'tags' | 'fallback';

export type PlayResultSection = {
  kind: PlayResultCategory;
  /** English i18n key (translated by the component). */
  text: string;
  /** A short suffix detail (e.g. the VP amount `+2`). */
  detail?: string;
  /** The printed tags this card adds (for the `tags` section chips). */
  tags?: ReadonlyArray<Tag>;
};

export type PlayCardResultMeta = {
  tags: ReadonlyArray<Tag>;
  /** The card grants a repeatable blue-card action (`ClientCard.hasAction` / `cardHasAction`). */
  hasAction: boolean;
  /** The card draws at least one passive ongoing effect (`cardHasPassiveEffect`). */
  hasEffect: boolean;
  victoryPoints?: number | 'special' | CountableVictoryPoints;
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

  if (meta.hasAction) {
    out.push({kind: 'action', text: 'Grants a new action'});
  }
  if (meta.hasEffect) {
    out.push({kind: 'effect', text: 'Adds a permanent effect'});
  }
  const vp = victoryPointSection(meta.victoryPoints);
  if (vp !== undefined) {
    out.push(vp);
  }
  if (meta.tags.length > 0) {
    out.push({kind: 'tags', text: 'Adds tags', tags: meta.tags});
  }

  // Never leave the block blank: if there is no immediate effect, no honest
  // follow-up, and nothing derived above, show an explicit fallback line.
  if (out.length === 0 && !ctx.hasImmediate && !ctx.hasFollowUp) {
    out.push({kind: 'fallback', text: 'The card effect will be applied after confirming'});
  }
  return out;
}

function victoryPointSection(vp: PlayCardResultMeta['victoryPoints']): PlayResultSection | undefined {
  if (vp === undefined) {
    return undefined;
  }
  if (typeof vp === 'number') {
    if (vp === 0) {
      return undefined;
    }
    return {kind: 'vp', text: 'Victory points at game end', detail: vp > 0 ? `+${vp}` : `${vp}`};
  }
  // 'special' or a CountableVictoryPoints (per-resource / per-tag / conditional)
  // — the exact endgame value can't be known now, so state it honestly.
  return {kind: 'vp', text: 'May grant victory points at game end'};
}

/**
 * A dev signal: TRUE when the whole result would be empty (no immediate, no
 * follow-up, and only the fallback derived). The component `console.warn`s this
 * so a genuine preview gap can be found and closed, per the audit contract.
 */
export function isFallbackOnlyResult(sections: ReadonlyArray<PlayResultSection>, ctx: PlayResultContext): boolean {
  return !ctx.hasImmediate && !ctx.hasFollowUp && sections.every((s) => s.kind === 'fallback');
}
