import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';

/**
 * TR01 — SUPREME EXPERTISE («Высшая экспертиза»), the fifth Turmoil Redux PROJECT card.
 *
 * A green (AUTOMATED) card: «Add 4 data to ANY card», 4 flat VP. The first card
 * of the set to print the «N tags of any one type» requirement
 * (`tagsOfOneType` — `TagsOfOneTypeRequirement`), and with TR02 Political
 * Science (the scope's one data holder) it closes the loop «data → a draw».
 *
 * SCAN READING — the «10 [?]» in the orange MIN box beside the cost is the
 * REQUIREMENT («Requires that you have at least 10 OF ANY ONE TYPE OF TAG»),
 * the «?» disc being the asset the DIVERSE_TAG item draws; the corner holds the
 * one tag, Science. The effect row prints FOUR data icons and an asterisk
 * (four icons, not a digit). The Mars planet under the 4 is the VP badge's
 * backdrop. The purple Turmoil symbol at the bottom left means «needs the
 * political engine» — for a card of THIS manifest that is the module itself
 * (`compatibility: 'turmoil'` is the upstream-adaptation marker and would
 * demand `politics: 'redux'`). No resource lives on the card.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/SupremeExpertise.spec.ts):
 *  1. The count is the MAXIMUM over the tag types, each type counted exactly as
 *     the printed requirement «N tags of X» counts it (`tagRequirementScore`,
 *     the `'default'` mode): a wild tag joins every type (never summed across
 *     them); the Scientists' wild tag and R&D Funding's science tags count —
 *     playing a card is an action; Habitat Marte / Earth Embassy as printed.
 *  2. The types are Curator's (`Tags.tagTypesInPlay`): every tag but the wild
 *     and the clone tag; the event tag only under Odyssey (played events are
 *     face down otherwise). Tags of different types never add up: 5 building +
 *     5 science tags are 5.
 *  3. The card's own science tag does not count — the requirement is checked
 *     before the card is played.
 *  4. «ANY card» = one of YOUR cards that holds data (the upstream reading of
 *     «add to ANY card»: resources go onto your own cards, `AddResourcesToCard`
 *     over your tableau). The card itself holds nothing.
 *  5. One holder → the pick is still SHOWN (a confirmation, «Add resources to
 *     this card»); two → a choice. No holder → the card is still playable (no
 *     `mustHaveCard`) and the play preview warns, naming the lost «4 data».
 *  6. Flat 4 VP — `victoryPoints: 4`, the shared `Card.getVictoryPoints`.
 */
export class SupremeExpertise extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.SUPREME_EXPERTISE,
      type: CardType.AUTOMATED,
      tags: [Tag.SCIENCE],
      cost: 12,
      requirements: {tagsOfOneType: 10},
      victoryPoints: 4,

      behavior: {
        addResourcesToAnyCard: {type: CardResource.DATA, count: 4},
      },

      metadata: {
        cardNumber: 'TR01',
        renderData: CardRenderer.builder((b) => {
          b.resource(CardResource.DATA, 4).asterix();
        }),
        description: 'Requires that you have at least 10 of any one type of tag. Add 4 data to ANY card.',
      },
    });
  }
}
