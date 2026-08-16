import {BonusCardId} from '../automa/AutomaTypes';
import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Color} from '../Color';

/**
 * THE MARSBOT ATTACK CONTEXT — the structured, translation-proof description of
 * a MANDATORY choice a MarsBot effect forces on a human player.
 *
 * WHY IT EXISTS. MarsBot's hostile effects used to reach the client as nothing
 * but a `SelectCard` whose (raw English) title happened to end in the source
 * card's name in brackets — «Select the highest-scoring animal/microbe card to
 * remove 1 resource from (Invasive Species)». Everything the player needed was
 * either missing or buried in that one string: that they were ATTACKED, by
 * WHOM, which card of the bot's did it, what leaves, and what it costs them.
 * The console could not recover any of it without parsing English text, which
 * cross-cutting invariant 1 forbids outright (i18n rewrites `Message.message`
 * in place, so a text match stops matching after the first render).
 *
 * THE SHAPE IS THE FAMILY, NOT THE CARD. Nothing here mentions Invasive
 * Species: a future bot effect that makes its victim point at one of their own
 * objects fills in the same fields (`source`, `effect`, `amount`, `targets`)
 * and reuses the whole presentation. `effect` is the extension point — a new
 * kind is a value here plus a preview shape, never a second marker.
 *
 * PREVIEW DATA IS AUTHORITATIVE. The per-target `resources` / `victoryPoints` /
 * `score` readings are computed SERVER-side, through the same scoring sources
 * the real rules use (`resourceVictoryPoints` → the card's own `Counter`), so
 * the client never approximates a card with a non-linear VP formula. Nothing is
 * mutated to produce them.
 *
 * Serialized on the input's OWN `toModel` (nesting-safe, like `discardPrompt`
 * and `deckPickPrompt`) — never centrally, where a nested prompt would arrive
 * stripped of its context.
 */

/** WHICH MarsBot object produced the attack — the face the modal renders. */
export type BotAttackSource =
  /** A bonus card of the bot's own deck (`BonusCardFace` draws it). */
  | {kind: 'bonusCard', bonusCard: BonusCardId}
  /** A project card the bot played / resolved (the premium card face draws it). */
  | {kind: 'projectCard', card: CardName};

/**
 * WHAT the attack does to the chosen object. One value today; the union is the
 * extension point that keeps a future effect from growing a second marker.
 *  - `removeCardResource` — N resource cubes leave a card the victim chooses.
 */
export type BotAttackEffect = 'removeCardResource';

/**
 * ONE candidate, with the exact consequence of choosing it. Every figure is a
 * `before → after` pair because this fork never lets a player confirm a target
 * without seeing what it costs (no-blind-target).
 */
export type BotAttackTargetPreview = {
  card: CardName;
  /** The card's own resource type — candidates may legitimately differ. */
  resource: CardResource;
  /** Resource cubes stored on the card. */
  resources: {before: number, after: number};
  /**
   * The CARD's own victory points. ABSENT when the card scores nothing from
   * this resource at all (a flat-VP or VP-less card) — a `0 → 0` row there
   * would be noise. PRESENT but equal when the card DOES score per resource and
   * this particular removal happens to land inside the same bracket («1 ПО за
   * каждые две фишки»): that is a real, decision-relevant reading, and silence
   * would make it look like a card the resource never touches.
   */
  victoryPoints?: {before: number, after: number};
  /**
   * The victim's TOTAL score. Present only when it actually moves — it is a
   * DIFFERENT figure from `victoryPoints` (the whole tableau vs this one card),
   * never the same number under a second label.
   */
  score?: {before: number, after: number};
};

export type BotAttackPromptMeta = {
  /** The seat that attacks — always a MarsBot today, modelled as a colour so a
   *  future hostile source needs no new field. */
  attacker: Color;
  /** WHOSE decision this is (the victim) — the chip that must signal it. */
  victim: Color;
  source: BotAttackSource;
  effect: BotAttackEffect;
  /**
   * The resource leaving each card, when every candidate holds the same one.
   * ABSENT when the candidate set mixes types (animals AND microbes) — read the
   * per-target `resource` then, never a guess.
   */
  cardResource?: CardResource;
  /** How many cubes leave the chosen card. */
  amount: number;
  /**
   * The RULE that narrowed the candidate set, as an English i18n key (the text
   * IS the key). It is what lets the modal explain «why only these cards» in
   * one short sentence instead of restating the card's whole printed rule.
   */
  restrictionKey?: string;
  /** One entry per SELECTABLE candidate, in the prompt's own order. */
  targets: ReadonlyArray<BotAttackTargetPreview>;
};
