/*
 * CARD INFORMATION MODEL — structured, per-graphic-block card text.
 *
 * Replaces the monolithic `metadata.description` as the SOURCE the future
 * fullscreen information panel reads: every self-contained graphic block of
 * a card (a requirement, an immediate mechanic row, a passive effect, an
 * active action, a special VP formula) gets its own text block with a
 * STABLE semantic id and an explicit link to its graphic block.
 *
 * The model is GENERATED AT BUILD TIME (make:cards → cardInformation
 * generator) from the CANONICAL structured sources — requirement
 * descriptors, the executable `behavior`, the render-DSL effect/action
 * nodes' co-located descriptions, the CountableVictoryPoints shape — plus a
 * curated registry for bespoke cards. There is NO runtime text parsing:
 * the client receives explicit blocks via `ClientCard.metadata.information`.
 *
 * Deliberately NOT represented (self-explanatory metadata per the task):
 * cost, tags, expansion, plain numeric VP, the live resource counter.
 *
 * `text` is an English i18n key (project convention: the English text IS
 * the key); `data` carries substitution params for `${n}` templates.
 * Russian translations live in src/locales/ru/card_info.json (generated
 * template strings) and the existing ru/cards.json (DSL-embedded strings).
 */

export type CardInfoBlockKind =
  | 'requirement'      // one play-requirement (linked to the requirements bar)
  | 'immediate'        // an on-play mechanic (green / red / prelude)
  | 'effect'           // a passive/ongoing effect (blue cards)
  | 'action'           // an activatable action (blue cards)
  | 'action-cost'      // the spend part of an action (linked to the cause sub-block)
  | 'action-result'    // the result part of an action
  | 'victory-points'   // a special VP rule (never plain numeric VP)
  | 'note';            // genuinely irreducible clarification (the printed fine print)

export type CardInfoBlock = {
  /** Stable semantic id, unique within the card (content-derived, never a bare index). */
  id: string;
  kind: CardInfoBlockKind;
  /** English text / i18n key. */
  text: string;
  /** Substitution params for `${n}` placeholders in `text`. */
  data?: ReadonlyArray<string>;
  /**
   * The graphic block this text describes: a stable content-derived id
   * produced by `cardGraphicIds()` over the card's renderData root rows
   * (requirements use `req:*` ids mirrored by the requirements bar).
   * Undefined = the mechanic has no dedicated graphic (audited).
   */
  graphicId?: string;
};

export type CardInfoGroupKind =
  | 'requirements'
  | 'immediate'
  | 'effect'
  | 'action'
  | 'victory-points';

export type CardInfoGroup = {
  kind: CardInfoGroupKind;
  /** Group id — for effect/action groups, matches the graphic node's id. */
  id: string;
  blocks: ReadonlyArray<CardInfoBlock>;
};

export type CardInformation = {
  /** Ordered groups: requirements → immediate → effects → actions → VP. */
  groups: ReadonlyArray<CardInfoGroup>;
};
