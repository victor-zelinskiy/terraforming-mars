import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {cancelled} from '../Options';

/** The printed search: «3 cards» … «WITHOUT A PLANT, MICROBE, OR ANIMAL TAG» — in the text's order. */
export const RED_TECH_CONVENTION_DRAW = 3;
export const RED_TECH_CONVENTION_WITHOUT_TAGS: ReadonlyArray<Tag> = [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL];

/**
 * TR32 — RED TECH CONVENTION («Техноконвент Красных»): the Reds' plate again
 * (TR30, TR31) over the set's first draw with a NEGATIVE filter — the deck is
 * searched for cards that carry NONE of three tags. Fully declarative: the
 * filter is the DSL's `drawCard.withoutTags` (a class — `Behavior.DrawCard`),
 * the search is the engine's (`DrawCards` → `Deck.drawByConditionOrThrow`), and
 * ONE descriptor of the search (`deferredActions/drawSearch.ts`) names the rule
 * on the composer's chip, in the structured text, in the reveal's summary and
 * in its discard tray, where every thrown-away card carries the tag that threw
 * it (`CardDrawRevealStep.failedTags`).
 *
 * SCAN READING — cost 5; ONE tag in the corner, Mars (the red planet). The
 * orange MIN plate beside the cost holds the REDS' emblem: the REQUIREMENT
 * («Requires the Reds to be ruling or that you have 2 delegates there»), never a
 * tag. A green card (AUTOMATED) with ONE row: three card backs, then three tags
 * each struck by a red slash — printed ANIMAL (the paw), PLANT (the leaf),
 * MICROBE — while the text names them «PLANT, MICROBE, OR ANIMAL»: the render
 * follows the print, the rule (and every surface that words it) the text. No VP.
 * Only the module's icon at the bottom left (no ▲, no Venus icon): no
 * `compatibility`. Printed lore: «The attempts at circumventing the entry rules
 * are the stuff of legend.» (the photo: German Space Agency).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/RedTechConvention.spec.ts):
 *  1. The requirement is `{party: REDS}` — the Reds rule, or the player has 2
 *     delegates on their resolution; a condition of the PLAY only.
 *  2. The search is the engine's: project-deck cards are turned over one by one
 *     until 3 cards carry NONE of the plant, microbe and animal tags; every
 *     card that fails goes to the discard pile at once, the 3 go to the hand.
 *  3. TAGS are checked, not resources — through the one reader of the positive
 *     filter (`Tags.cardHasTag`): Imported Nitrogen (Earth + Space, it places
 *     microbes and animals) is clean; Ants / Fish / Algae are not; an event
 *     without those tags is clean; a printed WILD tag is none of the three.
 *  4. Exhaustion: the deck and its reshuffled discard turned over to the end
 *     with fewer than 3 clean cards → the player keeps what was found (0–2), no
 *     exception; the journal names it with a key, the reveal carries
 *     `exhausted`. A draw pile emptied mid-search reshuffles the discard pile —
 *     cards thrown away by this very search come back and are thrown away again
 *     (the engine's own guard keeps it finite).
 *  5. Order: the reveals → the discards (the public «Discarded N cards …» line
 *     with names) → the 3 drawn (`DREW_VERBOSE` — the found cards were
 *     REVEALED, so their names are public too) → the owner's reveal with its
 *     `sequence`, `search` and `failedTags`. One answer, no question.
 *  6. The other players see what the rules make public: the discarded names,
 *     the revealed-and-kept names in the journal, «drew 3 cards»; the reveal
 *     with the faces is the owner's model only.
 *  7. No hand-size or limit is touched, nothing is paid beyond the price;
 *     MarsBot never plays the card.
 *  8. Save / load: nothing of its own.
 */
export class RedTechConvention extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.RED_TECH_CONVENTION,
      type: CardType.AUTOMATED,
      tags: [Tag.MARS],
      cost: 5,
      requirements: {party: PartyName.REDS},

      behavior: {
        drawCard: {count: RED_TECH_CONVENTION_DRAW, withoutTags: RED_TECH_CONVENTION_WITHOUT_TAGS},
      },

      metadata: {
        cardNumber: 'TR32',
        renderData: CardRenderer.builder((b) => {
          b.cards(RED_TECH_CONVENTION_DRAW).nbsp
            .tag(Tag.ANIMAL, {cancelled})
            .tag(Tag.PLANT, {cancelled})
            .tag(Tag.MICROBE, {cancelled});
        }),
        description: 'Requires the Reds to be ruling or that you have 2 delegates there. Reveal cards from the project deck until you reveal 3 cards WITHOUT A PLANT, MICROBE, OR ANIMAL TAG. Add them into hand, and discard the rest.',
      },
    });
  }
}
