import {CardName} from './CardName';

/**
 * WHAT A PRELUDE'S EFFECT IS WAITING FOR — the one vocabulary shared by the
 * card that declares its own order dependency and the engine that reasons
 * about it (`server/preludes/preludeOutlook.ts`).
 *
 * Deliberately TINY and about the TABLE, never about a card: a member may only
 * be added when it names a condition some OTHER prelude can be seen to create
 * from its own declared behaviour. Anything a card could only answer about
 * itself belongs in that card's `canPlay`, not here.
 *
 *  · `playedPrelude`  — the effect reads the player's ALREADY-PLAYED preludes
 *    (a copy effect has nothing to copy until one exists). Every prelude
 *    creates this simply by being played, which is what makes the order fix
 *    GUARANTEED.
 *  · `playableCard`   — the effect needs a legally playable project in hand
 *    (a discounted play, an ignore-requirements play). A draw or a windfall
 *    MAY create one; nothing can promise it, which is what makes the order fix
 *    a POSSIBILITY and never a guarantee.
 *  · `cash`           — the effect carries a PRICE in M€ the player cannot pay
 *    yet (P52 Industrial Complex's 18 M€). A prelude that GRANTS M€ (Loan's
 *    +30) can cover it; whether it covers ALL of it is not read here, so the
 *    order fix is a POSSIBILITY, never claimed as a guarantee.
 */
export type PreludeNeed = 'playedPrelude' | 'playableCard' | 'cash';

/**
 * THE ORDER-AWARE VERDICT for one prelude the player is being asked to play.
 * Structured on purpose: the badge, the risk copy, the confirmation gate and
 * the specs all read the SAME value, so «the warning says one thing and the
 * button does another» stops being expressible.
 *
 *  · `playable`  — the effect can resolve in full right now.
 *  · `deferred`  — it cannot, but a prelude the player has NOT played yet can
 *    change that. `certainty` separates «playing that one WILL create the
 *    condition» (`guaranteed`) from «it MAY open a target» (`possible` — an
 *    unknown draw, a windfall that may or may not cross a requirement). Never
 *    claim `guaranteed` for something only a simulation could know.
 *  · `noEffect`  — it cannot resolve and no remaining prelude is known to fix
 *    it. Still a legal play; just a deliberate loss of the effect.
 *
 * SERVER-AUTHORITATIVE: computed from the real rule sources (`canPlay`, the
 * cards' own declared behaviour) and shipped on `CardModel.preludeOutlook`.
 * The client renders it and never re-derives a rule.
 */
export type PreludeOutlook =
  | {state: 'playable'}
  | {
    state: 'deferred',
    certainty: 'guaranteed' | 'possible',
    /** The unplayed preludes that could create the condition — every one of
     *  them, so a UI can never single one out arbitrarily. */
    enablers: ReadonlyArray<CardName>,
    need: PreludeNeed,
  }
  | {state: 'noEffect', need?: PreludeNeed};
