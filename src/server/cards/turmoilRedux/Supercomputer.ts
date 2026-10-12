import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {SUPERCOMPUTER_DATA_VALUE} from '../../../common/constants';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/** The action's printed «→ [data] [data]*» — data on ANY card per activation. */
export const SUPERCOMPUTER_DATA_PER_ACTION = 2;

/**
 * TR48 — SUPERCOMPUTER («Суперкомпьютер»), a Turmoil Redux PROJECT card: the
 * set's THIRD card-bound payment unit (after TR09's `mechs` and TR17's
 * `constructionMechs`) and the SECOND data unit of the game (after Aurorai's
 * `auroraiData`, which pays for standard projects at 3): the data stored HERE
 * pay 2 M€ each toward a card with a Science tag.
 *
 * The effect is a PAYMENT UNIT, not a trigger — `supercomputerData` in
 * `common/inputs/Spendable.ts` (one unit names exactly one card, so
 * `Player.pay()` always knows which card a data leaves — the TR09 contract,
 * docs/TURMOIL_REDUX_EVA_MECHS.md §3 / §6 / §7). No `onCardPlayed`, no
 * forecast twin; the whole card is a declaration.
 *
 * SCAN READING — cost 10, blue (ACTIVE). ONE tag in the corner: the atom
 * (Science). The orange MIN plate beside the cost holds the SCIENTISTS' emblem
 * (the flask, the vertical «MIN»): the REQUIREMENT (`{party: SCIENTISTS}`),
 * never a tag. The upper field holds TWO rows: the ACTION «→ [data] [data]*»
 * (an arrow with no cost on its left, TWO data icons, the asterisk = «to ANY
 * card») and the EFFECT «[Science tag] : [data] = [2 M€]». The lower field is
 * the brown production plate «− [energy]». No VP badge. Only the module's
 * symbol at the bottom left (the purple diamond with the arrow): no
 * `compatibility`. Printed lore, quotation marks included: «"The answer is...
 * 42!"» (`lore_texts.json` «TR48»). Art credit: Oak Ridge National Laboratory.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/Supercomputer.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate (the TR15 class): the
 *     Scientists rule or 2 of the player's OWN delegates stand on their
 *     resolution — checked at the play only; TR36 lowers an EFFECT's
 *     threshold, never a requirement's; the Scientists' wild tag does not help.
 *  2. ON PLAY: −1 energy production. With no energy production the card is
 *     UNPLAYABLE (the engine's rule for lowering one's own production — the
 *     hand names it). The Science tag wakes the engine's science reactors
 *     (TR05 Vector Computations, Olympus Conference, Mars University …).
 *  3. THE ACTION: +2 data on ANY OF THE PLAYER'S OWN data holders (their
 *     tableau + the SRR rule of `AddResourcesToCard`, never a rival's),
 *     THIS card included. The target is never chosen for the player, even
 *     with one holder (invariant 3 — `addResourcesToAnyCard` asks). This card
 *     holds data, so there is always a target: the action is available once
 *     per generation.
 *  4. THE EFFECT: when PLAYING a card with a PRINTED Science tag (a project or
 *     an event), the data ON THIS CARD pay 2 M€ each (flat — no steel value,
 *     no Metal Research). Data on any other card are not money; a wild tag
 *     does not make a card a Science card; a standard project, a resolution's
 *     bill, a colony fee and a card's action are no «playing a Science card»,
 *     so none of them offers the lane.
 *  5. OVERPAY — the upstream semantic (`payingAmount >= cost`, no change): 2
 *     data for a 3 M€ remainder are legal and both leave; the console says
 *     «Переплата +1» and the player may lower the lane.
 *  6. THE JOURNAL: the payment line names the data off this card
 *     (`recordResourceAsPayment` — the effects overlay's «Spent as payment»);
 *     the action reads «added 2 data to X»; Martian Fiber's M€ is its own line.
 *  7. A RIVAL sees the action's target as «+2 [data] → <card>» and the payment
 *     as the card play's payment line (the TR09 class).
 *  8. THE TABLE'S ANSWERS to the action: Martian Fiber pays +1 M€ per data
 *     added to ANY card of its owner — +2 M€ whatever the target, this card
 *     included; the target's role never changes the answer.
 *  9. MarsBot never plays the card. Save / load: the data are an ordinary card
 *     resource; the unit lives only in the inputs (`Payment`, the prompts'
 *     models) — no serialized game state carries a `Payment`.
 * 10. FORECAST: the play's preview is the engine's («−1 energy production» +
 *     the table's answers to the Science tag); the action's preview is the
 *     engine's target step (every holder, its role and what the +2 does there
 *     — the client's K-T1 reading) + Martian Fiber; the effect forecast's
 *     «Скидки и оплата» group gains the unit's row by itself
 *     (`paymentValuesOf` walks every unit).
 */
export class Supercomputer extends ActionCard implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.SUPERCOMPUTER,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE],
      cost: 10,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.SCIENTISTS},

      // Rule 2.
      behavior: {
        production: {energy: -1},
      },

      // Rule 3 — the target is a step, never automatic.
      action: {
        addResourcesToAnyCard: {type: CardResource.DATA, count: SUPERCOMPUTER_DATA_PER_ACTION},
      },

      metadata: {
        cardNumber: 'TR48',
        // The printed effect runs past the browser's caption budget of 52 in both languages.
        infoText: [{kind: 'effect-short', text: 'Science tag: data here pay 2 M€ each'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Add 2 data resources to ANY card.', (eb) => {
            eb.empty().startAction.resource(CardResource.DATA, SUPERCOMPUTER_DATA_PER_ACTION).asterix();
          }).br;
          // `.equals().megacredits(N)` is LOAD-BEARING (effectExtraction: valueAsPayment) — see EvaMechs.ts.
          b.effect('When playing Science cards, data resources here may be used as payment, and are worth 2 M€ each.', (eb) => {
            eb.tag(Tag.SCIENCE).startEffect.resource(CardResource.DATA).equals().megacredits(SUPERCOMPUTER_DATA_VALUE);
          }).br;
          b.production((pb) => pb.minus().energy(1));
        }),
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Decrease your energy production 1 step.',
      },
    });
  }
}
