import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {ActivePreludeCard} from '../prelude2/ActivePreludeCard';
import {CardRenderer} from '../render/CardRenderer';

/** The printed «[4 M€]» — the play's whole gain. */
export const CORRIDORS_OF_POWER_MEGACREDITS = 4;
/** The printed footnote «*» — a resolution counts with AT LEAST this many of the player's own delegates on it. */
export const CORRIDORS_OF_POWER_DELEGATES = 2;

/**
 * TRP0 — CORRIDORS OF POWER («Коридоры власти»), the Turmoil Redux REPLACEMENT of the classic Prelude 2 P47 — the
 * set's ONE replacement PRELUDE (rulebook p.1 «9 new Prelude cards (and 1 replacement prelude)»; the registry row
 * `common/cards/turmoilReduxReplacements.ts`, kind `prelude`). Registered as `Corridors of Power:redux` (the plain name
 * stays the classic card's); the Redux manifest's `cardsToRemove` keeps the classic out of every Redux deck and the
 * registry keeps it out of the premium scope. The classic «each time you become party leader, draw 1 card» hook
 * (classic `Party.ts`) is NOT carried over: it became an ACTION.
 *
 * SCAN READING — the magenta PRELUDE plate; ONE tag in the corner, EARTH. The art is the classic card's palace
 * corridor. ONE action frame: «→ [card] / [delegate][delegate]*», the star the printed footnote «at least 2»; the
 * parenthesised rule: «(Action: Draw 1 card for each RESOLUTION you have at least 2 delegates on.)». The number box
 * prints «TRP0» — the preludes' own family (TRP1…TRP9 are the set's new preludes), never a TR7x. At the bottom
 * «[4 M€] (Gain 4 M€.)»; the lore in italics: «Controlling the flow of information and funds.» — keyed under the
 * classic number `P47` together with the P47 art and borrowed through `reimplements`. The purple diamond at the left
 * edge is the module; a Prelude is dealt only beside the Prelude expansion (`compatibility: 'prelude'`, TRP1's
 * precedent). Gone from the classic: the +1 TR and the party-leader effect.
 *
 * NOTHING NEW IS BUILT FOR THE CARD — the action is ONE declaration over the Parliament's counted term
 * (`drawCard: {count: {delegates: {resolutionsWithAtLeast: 2}}}`, `behavior/Countable.ts` → `PoliticalOps.
 * resolutionsWithDelegates`); the preview's basis names the resolutions (`ActionEffectBasis.resolutions`), the
 * verdict of an empty count is the term's own words, the draw is the ordinary one (one batch).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/CorridorsOfPowerRedux.spec.ts):
 *  1. Printed: a PRELUDE (`ActivePreludeCard`), Earth, no cost / VP, `cardNumber: 'TRP0'`, `reimplements` P47,
 *     `compatibility: 'prelude'`; the classic is never dealt under Redux (`cardsToRemove`), intact under classic Turmoil.
 *  2. The play: +4 M€, nothing asked, no gate — it never «burns». Proteus reads its Earth tag like any prelude's.
 *  3. The action draws N cards, N = the slots of the VOTING AREA holding ≥ 2 of the player's OWN delegates — neutral
 *     cubes, the lobby, the chairman's seat and the reserve never count; an enacted resolution's slot is gone. One
 *     draw — one batch. N = 0: the action stays AVAILABLE (free, nothing is spent) and carries the verdict «No
 *     resolution with 2 of your delegates» (`zero-yield`) — information, never a block.
 *  4. The preview IS the execution (`declarative`): «+N [card]» with the Parliament basis — every slot named, its own /
 *     all delegates, counted or not; read-only.
 *  5. Nothing to serialize beyond the card on the table and the generation's action flag; MarsBot is never dealt one.
 */
export class CorridorsOfPowerRedux extends ActivePreludeCard {
  constructor() {
    super({
      name: CardName.CORRIDORS_OF_POWER_REDUX,
      tags: [Tag.EARTH],

      // Rule 2.
      behavior: {
        stock: {megacredits: CORRIDORS_OF_POWER_MEGACREDITS},
      },

      // Rule 3.
      action: {
        drawCard: {count: {delegates: {resolutionsWithAtLeast: CORRIDORS_OF_POWER_DELEGATES}}},
      },

      metadata: {
        cardNumber: 'TRP0',
        // The classic P47's art and lore — the same illustration and the same printed quote.
        reimplements: CardName.CORRIDORS_OF_POWER,
        infoText: [
          // The printed rule runs past the caption clamp.
          {kind: 'action-short', text: 'Draw 1 card per resolution with 2+ of your delegates', tokens: ['cards']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Draw 1 card for each resolution you have at least 2 delegates on.', (eb) => {
            eb.empty().startAction.cards(1).slash().delegates(CORRIDORS_OF_POWER_DELEGATES).asterix();
          }).br;
          b.megacredits(CORRIDORS_OF_POWER_MEGACREDITS);
        }),
        description: 'Gain 4 M€.',
      },
    });
  }
}
