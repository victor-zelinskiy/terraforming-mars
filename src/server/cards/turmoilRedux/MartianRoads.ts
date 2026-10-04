import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';

/**
 * TR20 — MARTIAN ROADS («Марсианские дороги»), the twentieth Turmoil Redux
 * PROJECT card — and the set's first card with NO EFFECT GRAPHIC at all: its
 * whole value is the victory points it scores «for tags». No new mechanic —
 * the declaration is the standard `victoryPoints: {tag, per}`; what the card
 * exposed was a gap in the shared layer (the play composer said «по условию»
 * for a number it could compute), closed by the play preview's VP projection
 * (`calculateVictoryPoints.cardVictoryPointsAtPlay` → `ActionPreview
 * .cardVictoryPoints`) — nothing of it lives here.
 *
 * SCAN READING — cost 8, green (AUTOMATED); two tags in the corner, in this
 * order: Mars (the red planet), Building (the brown roof) — the order of the
 * sisters TR16 / TR18. The orange MIN plate beside the cost holds the MARS
 * FIRST emblem: the REQUIREMENT («Requires Mars First to be ruling or that you
 * have 2 delegates there»), never a tag. The VP badge on a Mars disc prints
 * «1/3 [Building tag]». The card's field carries ONLY the text — no effect
 * row (the grey «TR20» label in its corner is the card number). The purple
 * Turmoil symbol at the bottom left is the module itself (no
 * `compatibility`). Flavour: «♪ Country roaaaaads, take me hoooooome... ♪»
 * (`lore_texts.json` «TR20», word for word — the stretched vowels and the
 * notes are the scan's joke).
 *
 * THE FACE has no `renderData`, on purpose (Interstellar Colony Ship's
 * shape): the premium face drops prose, so a `b.vpText(...)` would be a
 * second, textual source of the rule the VP badge already states. The face is
 * the requirement plate + the tags + the art + the badge; the mechanics panel
 * is empty by right (`NO_MECHANICS_ACCEPTED`). The structured text
 * (`metadata.information`) is the requirement block + the VP line.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MartianRoads.spec.ts):
 *  1. The requirement is `{party: MARS}` — the TR15 class (the emblem in the
 *     MIN plate, the named reason «N of 2», the hand's compact counter).
 *     Checked at the play only.
 *  2. VP = `floor(Building tags / 3)` — the standard `{tag, per}` count.
 *  3. The card's OWN Building tag counts: once played it is in the tableau;
 *     before the play the `Counter` adds the tags of a not-yet-played card
 *     (`Counter.cardIsUnplayed`), so the projection the composer reads is the
 *     number the card scores the moment it lands.
 *  4. The VP count is RAW (`Counter.count(…, 'vps')` → `tags.count(tag,
 *     'raw')`): a WILD tag does not count; a played EVENT's tags do not count
 *     (unless the engine keeps events face up — Odyssey — its rule, not
 *     ours); the R&D Funding (RX26) bonus is a `default`-mode term and never
 *     enters a VP count.
 *  5. The VP icon is a NON-NEGATIVE VARIABLE one (`victoryPointsIconOf` →
 *     `{kind: 'variable', sign: 'nonNegative'}`), so with nothing programmed
 *     here: with TR16 Administration District in the tableau this play draws
 *     a card (forecast == execution), and Architecture Award (RX02) counts the
 *     card.
 *  6. A card with a party requirement: TR13 Political Think Tank's check has
 *     one more target in the deck (`partyRequirementCardsInGame` derives it).
 *  7. «Roads» is flavour only — no tile is placed (not the Moon's roads).
 *  8. MarsBot never plays the card.
 */
export class MartianRoads extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.MARTIAN_ROADS,
      type: CardType.AUTOMATED,
      tags: [Tag.MARS, Tag.BUILDING],
      cost: 8,
      requirements: {party: PartyName.MARS},
      victoryPoints: {tag: Tag.BUILDING, per: 3},

      metadata: {
        cardNumber: 'TR20',
        // The structured text's VP line (no `vpText` on a face with no `renderData` to carry it): the information
        // reads «requirement · victory points», and the printed prose seeds no phantom «on play» block.
        infoText: [{kind: 'victory-points', text: '1 VP for every 3 Building tags you have.'}],
        description: 'Requires Mars First to be ruling or that you have 2 delegates there. 1 VP for every 3 Building tags you have.',
      },
    });
  }
}
