import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {FORESTRY_MECHS_ADD_TITLE} from './ForestryMechs';

/** The play's own block — «Add 1 mech resource to this card». */
export const EXPEDITION_MECHS_ON_PLAY = 1;
/** Variant A — 1 energy buys 1 mech here (the TR09 / TR11 / TR17 / TR34 / TR40 row, word for word). */
export const EXPEDITION_ENERGY_PER_MECH = 1;
/** Variant B — 1 mech off here buys one card off the deck. */
export const EXPEDITION_MECHS_PER_CARD = 1;
/** The two variants' prompt titles (the `OrOptions` options when both are live) — A is TR40's key, reused verbatim. */
export const EXPEDITION_MECHS_ADD_TITLE = FORESTRY_MECHS_ADD_TITLE;
export const EXPEDITION_MECHS_DRAW_TITLE = 'Spend 1 mech from here to draw a card';

/**
 * TR50 — EXPEDITION MECHS («Экспедиционные мехи»), a Turmoil Redux PROJECT
 * card: a plate of the SCIENTISTS (TR05, TR46, TR48 …) and the set's SEVENTH
 * mech holder — TR40 Forestry Mechs with another B. Variant A is the mech row
 * of TR09 / TR11 / TR17 / TR34 / TR40 word for word (1 energy → a mech on this
 * card); variant B is Aerial Mappers' / TR02 Political Science's draw in mechs
 * (a stored resource off this card → one card off the deck). The whole action
 * is ONE DECLARATION of the Local Shading class — `action: {or: {behaviors:
 * [A, B], autoSelect: true}}` — so nothing of the action lives in this file: no
 * `canAct`, no `action()`, no reason, no role of its own (the console reads «1
 * mech → 1 card» off the declaration — `cards/holderActionGood.ts`).
 *
 * «Requires the Scientists to be ruling or that you have 2 delegates there.
 * Add 1 mech resource to this card. Action: Pay 1 energy to add a mech resource
 * to this card, OR spend 1 mech from here to draw a card.» Cost 5, blue,
 * Science + Building, no VP.
 *
 * SCAN READING — cost 5, blue (ACTIVE); two tags in the corner, in this order:
 * the atom on white (Science) and the roof on brown (Building). The orange MIN
 * box beside the cost holds the SCIENTISTS' emblem (the flask) — a REQUIREMENT
 * (`{party: SCIENTISTS}`), never a tag. Two action rows: «[energy] → [mech]»
 * and «OR [mech] → [a card back]» (the back of a card = a draw); the text:
 * «(Action: Pay 1 energy to add a mech resource to this card, OR spend 1 mech
 * from here to draw a card.)». The bottom block: a mech icon and «(Requires
 * the Scientists to be ruling or that you have 2 delegates there. Add 1 mech
 * resource to this card.)». No VP badge. Only the module's icon at the bottom
 * left (no ▲, no Venus icon): no `compatibility`. Printed lore: «They just
 * kept increasing the size of their spacesuits and never stopped.»
 * (`lore_texts.json` «TR50»; the art credit — Elise Amendola / Associated
 * Press — is the scan's caption, not part of the face).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ExpeditionMechs.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate — the Scientists rule, or 2 of
 *     the player's OWN delegates stand on their resolution — checked at the
 *     PLAY only (the TR15 class); the action works whoever rules later. TR36
 *     Council Seat lowers the EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PLAY puts 1 mech on THIS card (`behavior: {addResources: 1}` — a
 *     fixed self-target, the auto-select exemption) and nothing else. The
 *     Science tag wakes the engine's science reactors (TR05 Vector
 *     Computations, Olympus Conference, Mars University …); the play is paid
 *     in M€, steel (Building), Construction Mechs' mechs (Building — the
 *     `constructionMechs` unit) and Supercomputer's data (Science — the
 *     `supercomputerData` unit) — never EVA's mechs (no Space tag).
 *  3. ONE action, two variants in the printed order: A — 1 energy → +1 mech
 *     here; B — 1 mech off here → draw 1 card. Both live → an `OrOptions`
 *     marked `effect-choice` with this card as its giver; ONE live → it IS the
 *     action, no question asked (`autoSelect` — the `OrOptions.reduce()`
 *     exemption of invariant 3); both dead → `canAct` is false and the
 *     card-level reasons come in the declared order, so the FIRST is the
 *     energy — the one blocker the player can act on.
 *  4. The reasons are the automatic ones of the declaration: A — «Not enough
 *     energy» (`spend.energy`); B — «Not enough resources on this card» with
 *     the count (`spend.resourcesHere`). A refused variant is SHOWN beside the
 *     live one, never hidden.
 *  5. B's card is the engine's ordinary draw (`player.drawCard`): an empty draw
 *     pile reshuffles the discard pile first; with NO card anywhere B is DEAD
 *     with the engine's named reason «The deck is empty» (`Executor.canExecute`
 *     refuses `drawCard` before the mech is spent — never a mech for nothing).
 *  6. The mechs here are NOT money, NOT VP, NOT delegates, NOT a trade: the
 *     `mechs` / `constructionMechs` units read EVA Mechs / Construction Mechs
 *     only. A mech Vesta or TR29's B puts HERE is fuel for B (this card is a
 *     legal target of every generic «mech to any card»).
 *  7. The journal: A — the energy leaves, then the mech arrives; B — the mech
 *     leaves (the price's own line), then the draw («drew 1 card» — the card
 *     itself is shown to its owner only). All under the card's source.
 *  8. Once per generation, as any blue card's action.
 *  9. Save / load: the mech count and the used-action flag survive.
 * 10. MarsBot never plays the card; the bot's science tag touches nothing here.
 */
export class ExpeditionMechs extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.EXPEDITION_MECHS,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.BUILDING],
      cost: 5,
      requirements: {party: PartyName.SCIENTISTS},
      resourceType: CardResource.MECH,

      behavior: {
        addResources: EXPEDITION_MECHS_ON_PLAY,
      },

      action: {
        or: {
          behaviors: [
            {
              spend: {energy: EXPEDITION_ENERGY_PER_MECH},
              addResources: 1,
              title: EXPEDITION_MECHS_ADD_TITLE,
            },
            {
              spend: {resourcesHere: EXPEDITION_MECHS_PER_CARD},
              drawCard: 1,
              title: EXPEDITION_MECHS_DRAW_TITLE,
            },
          ],
          autoSelect: true,
        },
      },

      metadata: {
        cardNumber: 'TR50',
        renderData: CardRenderer.builder((b) => {
          // The two action rows as the scan prints them — «[energy] → [mech] / OR / [mech] → [a card]» (each row
          // describes itself — the TFLP / DP11 contract); then the play's own block, a mech, under the art.
          b.action('Pay 1 energy to add a mech resource to this card.', (eb) => {
            eb.energy(EXPEDITION_ENERGY_PER_MECH).startAction.resource(CardResource.MECH);
          }).br;
          b.or().br;
          b.action('Spend 1 mech from here to draw a card.', (eb) => {
            eb.resource(CardResource.MECH, EXPEDITION_MECHS_PER_CARD).startAction.cards(1);
          }).br;
          b.resource(CardResource.MECH, EXPEDITION_MECHS_ON_PLAY);
        }),
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Add 1 mech resource to this card.',
      },
    });
  }
}
