import {ChoiceContextSource, DeckPickPromptMeta} from '../../common/models/PlayerInputModel';

/**
 * The {@link DeckPickPromptMeta} builder — attached to every "these cards were
 * just turned over for you to choose from" `SelectCard`
 * (see `BasePlayerInput.markDeckPickPrompt`).
 *
 * The console serves that whole family through ONE flow — the deck the cards
 * physically come out of, the temporary row they stand in, the picks that fly
 * to the hand dock, and the short beat where the rest goes away. It may not
 * detect the family from the prompt's title or button label: i18n rewrites
 * `Message.message` in place, so an English match dies after the first render.
 *
 * The marker is attached in ONE place — `ChooseCards.execute()`, which every
 * producer in the game funnels through — so a card that starts drawing
 * tomorrow is covered by construction. What each CALL SITE contributes is the
 * `promptSource` (which card / colony asked, built with the existing
 * `inputs/choiceContext.ts` factories — this family coins none of its own) and,
 * when it is not the project deck, the `origin`. Both live in the rule that
 * builds the draw, so when upstream changes that rule the attribution is in the
 * same diff.
 *
 * Everything is backward compatible: an UNMARKED `SelectCard` over drawn cards
 * still renders as the plain card browser — it just gets no deck, no source
 * anchor and no receive animation.
 */
export function deckPickPrompt(o: {
  /** The candidate count — how many cards were turned over. */
  revealed: number,
  /**
   * The bounds the input will ACTUALLY enforce. Copied off the real `SelectCard`
   * config by the caller, never re-derived: the paying branch narrows `max` by
   * affordability, and a marker that disagreed with the input it rides would be
   * worse than no marker at all.
   */
  min: number,
  max: number,
  /** Defaults to the project deck. `'discard'` = a pile-digging effect. */
  origin?: 'deck' | 'discard',
  mode: 'keep' | 'buy',
  source?: ChoiceContextSource,
}): DeckPickPromptMeta {
  return {
    revealed: o.revealed,
    min: o.min,
    max: o.max,
    origin: o.origin ?? 'deck',
    mode: o.mode,
    source: o.source,
  };
}
