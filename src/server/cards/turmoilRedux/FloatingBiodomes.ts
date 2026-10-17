import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/** The play's own block — «Add 2 floater resources to this card». */
export const FLOATERS_ON_PLAY = 2;
/** Variant A — 1 plant buys 1 floater onto ANY Venus card. */
export const PLANTS_PER_FLOATER = 1;
/** Variant B — 3 floaters off here buy a greenery tile (and with it the oxygen step the tile raises itself). */
export const FLOATERS_PER_GREENERY = 3;
/** The requirement — the Venus scale at 10 % or more. */
export const VENUS_REQUIRED = 10;
/** The two variants' prompt titles (the `OrOptions` options when both are live). */
export const FLOATING_BIODOMES_FLOATER_TITLE = 'Pay 1 plant to add a floater to ANY Venus card';
export const FLOATING_BIODOMES_GREENERY_TITLE = 'Spend 3 floaters from here to place a greenery tile';

/**
 * TR69 — FLOATING BIODOMES («Парящие биокуполы»), a Turmoil Redux PROJECT
 * card: the set's second FLOATER holder after TR27 Aurora Station, and the
 * first `or`-action of the Local Shading class whose B pays a TILE. The whole
 * action is ONE DECLARATION — `action: {or: {behaviors: [A, B], autoSelect:
 * true}}` — so nothing of the action lives in this file: no `canAct`, no
 * `action()`, no reason, no `actionPreview` hook. B's greenery is STAGED from
 * the composer by the declarative action builder itself (D5 —
 * `actionPreview.ts`, a declared action tile is the action's last reversible
 * step: the cell is picked before the batch posts, ONE POST).
 *
 * «Action: Pay 1 plant to add a floater resource to ANY Venus card, OR spend 3
 * floaters from here to place a greenery tile and increase oxygen 1 step.» —
 * «Requires Venus 10%. Add 2 floater resources to this card.» Cost 10, blue,
 * Plant + Venus, no VP.
 *
 * SCAN READING — cost 10, blue (ACTIVE); two tags in the corner: the leaf on
 * green (Plant) and the «V» on blue (Venus). The orange MIN box beside the cost
 * holds «10 %» and the Venus scale's gauge — a REQUIREMENT (`{venus: 10}`),
 * never a tag. Two action rows: «[plant] → [floater with the Venus bubble]*
 * OR» (the star — ANY Venus card) and «3 [floater] → [greenery with its red
 * oxygen dot]». The bottom block: two floater icons and «(Requires Venus 10%.
 * Add 2 floater resources to this card.)». No VP badge. At the bottom left the
 * Venus module's «V» above the Redux diamond → `compatibility: 'venus'` (the
 * TR24 Venusian Census precedent). Printed lore: «Not quite a "Pie in the
 * Sky." Though you could probably grow the ingredients?» (`lore_texts.json`
 * «TR69»; the art credit: TVF International).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/FloatingBiodomes.spec.ts):
 *  1. The REQUIREMENT is the Venus scale at 10 % or more, checked at the PLAY
 *     only (Morning Star Inc. and the generic requirement bonuses bend it as
 *     they bend every global requirement); the action works at any Venus.
 *  2. The PLAY puts 2 floaters on THIS card (`behavior: {addResources: 2}` —
 *     a fixed self-target, the auto-select exemption) and nothing else. Being
 *     a Venus card, Dirigibles' floaters pay for it; being a Plant card, its
 *     tag reads as a plant tag everywhere (Decomposers, Ecological Zone, …).
 *  3. ONE action, two variants in the printed order. Both live → an
 *     `OrOptions` marked `effect-choice` with this card as its giver; ONE live
 *     → it IS the action, no question asked (`autoSelect` — the
 *     `OrOptions.reduce()` exemption of invariant 3); both dead → `canAct` is
 *     false and the card-level reasons come in the declared order.
 *  4. A — 1 plant → 1 floater onto ANY Venus card (`addResourcesToAnyCard`
 *     with `tag: Tag.VENUS` — Stratopolis' filter: a floater holder with a
 *     Venus tag, or a Wild-tag holder). THIS CARD IS A CANDIDATE (a Venus
 *     floater holder); the target is ALWAYS asked, even for one candidate
 *     (`autoSelect: false` on every «to any card» declaration). No plants →
 *     «Not enough plants».
 *  5. B — 3 floaters off here → a greenery tile (`greenery: {}`). The tile
 *     raises the oxygen ITSELF (`Game.addGreenery`) — no `global: {oxygen: 1}`
 *     beside it, that would be a second step. At the oxygen maximum the tile
 *     is still placed and nothing rises (the action is NOT futile: a
 *     greenery's tile is a yield at any oxygen). No legal cell → the PLACEMENT
 *     reason «No space available for the tile»; fewer than 3 floaters here →
 *     «N of 3 floaters on this card» (PL-197). The Reds' tax on the rating the
 *     oxygen step brings is the engine's.
 *  6. The greenery is STAGED (D5): the composer picks the cell before the
 *     action posts, and the answer is ONE POST `[…, {type: 'space'}]`; the
 *     staged payload mirrors the live `PlaceGreeneryTile` prompt byte for byte
 *     (`stagedPlacementParity` § ACTION).
 *  7. The holder's ROLE: B buys a TILE (`ActionGood {kind: 'tile', tile:
 *     'greenery'}`) — the satellite's chip and the target step say what three
 *     floaters here are for.
 *  8. The two printed rows are each a branch's own row — the console prints
 *     each whole on its outcome tile.
 *  9. The table's answers: a greenery wakes the greenery / oxygen hooks (Arctic
 *     Algae no — that is an ocean; Herbivores, the Greens' TR …) through the
 *     server's forecast; the card's own tags wake its neighbours at the play.
 * 10. MarsBot never plays the card; save / load keeps the floaters and the
 *     used-action flag.
 */
export class FloatingBiodomes extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.FLOATING_BIODOMES,
      type: CardType.ACTIVE,
      tags: [Tag.PLANT, Tag.VENUS],
      cost: 10,
      requirements: {venus: VENUS_REQUIRED},
      resourceType: CardResource.FLOATER,

      behavior: {
        addResources: FLOATERS_ON_PLAY,
      },

      action: {
        or: {
          behaviors: [
            {
              spend: {plants: PLANTS_PER_FLOATER},
              addResourcesToAnyCard: {type: CardResource.FLOATER, count: 1, tag: Tag.VENUS},
              title: FLOATING_BIODOMES_FLOATER_TITLE,
            },
            {
              spend: {resourcesHere: FLOATERS_PER_GREENERY},
              greenery: {},
              title: FLOATING_BIODOMES_GREENERY_TITLE,
            },
          ],
          autoSelect: true,
        },
      },

      metadata: {
        cardNumber: 'TR69',
        // Both full rules are over the browser's caption budget (52): A 56, B 79 — curated shorts, each on its own row.
        infoText: [
          {kind: 'action-short', text: 'Pay 1 plant for a floater on a Venus card', tokens: ['plants']},
          {kind: 'action-short', text: 'Spend 3 floaters for a greenery', tokens: ['greenery']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The two action rows as the scan prints them — «[plant] → [floater ⓥ]* / OR / 3 [floater] → [greenery •O₂]»
          // (each row describes itself); then the play's own block, two floaters, under the art.
          b.action('Pay 1 plant to add a floater resource to ANY Venus card.', (eb) => {
            eb.plants(PLANTS_PER_FLOATER).startAction.resource(CardResource.FLOATER, {secondaryTag: Tag.VENUS}).asterix();
          }).br;
          b.or().br;
          b.action('Spend 3 floaters from here to place a greenery tile and increase oxygen 1 step.', (eb) => {
            eb.resource(CardResource.FLOATER, {amount: FLOATERS_PER_GREENERY, digit: true}).startAction.greenery();
          }).br;
          b.resource(CardResource.FLOATER, FLOATERS_ON_PLAY);
        }),
        description: 'Requires Venus 10%. Add 2 floater resources to this card.',
      },
    });
  }
}
