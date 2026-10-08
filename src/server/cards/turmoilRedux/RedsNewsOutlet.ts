import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';

/**
 * TR33 — REDS NEWS OUTLET («Новостной канал Красных»): the Reds' plate again
 * (TR30–TR32) over the TR20 class — a card whose whole value is the victory
 * points it scores «for tags», here the set's own MARS tag, one for one. No
 * new mechanic and nothing of it lives here: the declaration is the standard
 * `victoryPoints: {tag, per}`, and every surface that shows the number (the
 * play composer's projection `cardVictoryPointsAtPlay`, the face's badge, the
 * score explorer's row, the final score) reads the one `Counter` count.
 *
 * SCAN READING — cost 7, green (AUTOMATED); ONE tag in the corner, Mars (the
 * red planet). The orange MIN plate beside the cost holds the REDS' emblem:
 * the REQUIREMENT («Requires the Reds to be ruling or that you have 2
 * delegates there»), never a tag. The VP badge on a Mars disc prints «1/[Mars
 * tag]» — a per-one relation (the disc behind it is the badge's background,
 * the medallion after the slash is the tag). The card's field carries ONLY
 * the text — no effect row (the grey «TR33» label in its corner is the card
 * number). Only the module's icon at the bottom left (no ▲, no Venus icon): no
 * `compatibility`. Flavour: «The bane of Martian youth the world over.»
 * (`lore_texts.json` «TR33», word for word; the photo: tomazl / istockphoto).
 *
 * THE FACE has no `renderData`, on purpose (TR20's shape): the premium face
 * drops prose, so a `b.vpText(...)` would be a second, textual source of the
 * rule the VP badge already states. The face is the requirement plate + the
 * tag + the art + the badge; the mechanics panel is empty by right
 * (`NO_MECHANICS_ACCEPTED`). The structured text (`metadata.information`) is
 * the requirement block + the VP line.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/RedsNewsOutlet.spec.ts):
 *  1. The requirement is `{party: REDS}` — the TR15 class (the emblem in the
 *     MIN plate, the named reason «N of 2», the hand's compact counter).
 *     Checked at the play only.
 *  2. VP = the Mars tags the player has (`per: 1`) — the standard `{tag, per}`
 *     count; another player's Mars tags are not «you have».
 *  3. The card's OWN Mars tag counts: once played it is in the tableau; before
 *     the play the `Counter` adds the tags of a not-yet-played card
 *     (`Counter.cardIsUnplayed`), so the projection the composer reads is the
 *     number the card scores the moment it lands — never below 1.
 *  4. The VP count is RAW (`Counter.count(…, 'vps')` → `tags.count(tag,
 *     'raw')`; the FAQ, p. 17: a wild tag counts only «when performing an
 *     action»): a printed WILD tag does not count; the Scientists' wild tag
 *     (they rule, or 2 delegates on their resolution) does not count; a played
 *     EVENT's Mars tag does not count (unless the engine keeps events face up —
 *     Odyssey — its rule, not ours). R&D Funding (RX26) raises SCIENCE tags
 *     only, in `default` mode only — it never touches a Mars count. Habitat
 *     Marte reads Mars tags AS science tags, not the other way round: the Mars
 *     count is the same with it.
 *  5. The VP icon is a NON-NEGATIVE VARIABLE one (`victoryPointsIconOf` →
 *     `{kind: 'variable', sign: 'nonNegative'}`). TR16 Administration District
 *     draws only for a BUILDING card with such an icon, and Architecture Award
 *     (RX02) counts only BUILDING cards — this one has no Building tag, so
 *     neither takes it.
 *  6. A card with a party requirement: TR13 Political Think Tank's check has
 *     one more target in the deck (`partyRequirementCardsInGame` derives it).
 *  7. The play does nothing but lay the card down; it asks nothing. MarsBot
 *     never plays the card.
 */
export class RedsNewsOutlet extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.REDS_NEWS_OUTLET,
      type: CardType.AUTOMATED,
      tags: [Tag.MARS],
      cost: 7,
      requirements: {party: PartyName.REDS},
      victoryPoints: {tag: Tag.MARS, per: 1},

      metadata: {
        cardNumber: 'TR33',
        // The structured text's VP line (no `vpText` on a face with no `renderData` to carry it): the information
        // reads «requirement · victory points», and the printed prose seeds no phantom «on play» block.
        infoText: [{kind: 'victory-points', text: '1 VP per Mars tag you have.'}],
        description: 'Requires the Reds to be ruling or that you have 2 delegates there. 1 VP per Mars tag you have.',
      },
    });
  }
}
