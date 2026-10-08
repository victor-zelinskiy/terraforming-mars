import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {PlayerInput} from '../../PlayerInput';
import {
  CensusSpec, censusAction, censusActionPreview, censusActionRows, censusCanAct, censusUnavailableReason,
} from './censusAction';

/**
 * THE MECH CENSUS — this card's whole declaration of the shared census action
 * (`censusAction.ts`): mechs, A for 1 energy, B for 1 mech. The sister TR35
 * Mars Army Ships is the same declaration with `{FIGHTER, 1 titanium, 1}`.
 * The i18n keys are this resource's own (the RU noun declines): A's row is
 * TR09 / TR11's key word for word, B's row and the reason are new.
 */
export const MARS_ARMY_MECHS_CENSUS: CensusSpec = {
  resource: CardResource.MECH,
  add: {amount: 1, price: {resource: Resource.ENERGY, amount: 1}},
  votePrice: 1,
  addTitle: 'Pay 1 energy to add a mech resource to this card',
  voteTitle: 'Spend 1 mech from here to add a delegate to a resolution',
  shortReason: '${0} of 1 mech on this card',
  rows: {
    add: 'Pay 1 energy to add a mech resource to this card.',
    vote: 'Spend 1 mech from here to add a delegate to a resolution.',
  },
};

/**
 * TR34 — MARS ARMY MECHS («Мехи армии Марса»): the Reds' plate again (TR30–
 * TR33) over the CENSUS action (TR15 / TR24) — with a PAID variant A. Two
 * shipped cards glued together: A is TR09 EVA Mechs' / TR11 Mech Sports'
 * action word for word (1 energy → a mech on this card), B is the census's
 * (a resource off this card → a delegate on a resolution) at the price of ONE
 * mech instead of three data. Nothing of the action lives here: the module is
 * parameterised by {@link MARS_ARMY_MECHS_CENSUS}, and TR35 Mars Army Ships
 * (1 titanium → a fighter, OR 1 fighter → a delegate) is the same declaration
 * with other constants.
 *
 * SCAN READING — cost 7; two tags in the corner, Mars (the red planet) and
 * Building (the brown disc). The orange MIN plate beside the cost holds the
 * REDS' emblem (the red flag): the REQUIREMENT («Requires the Reds to be
 * ruling or that you have 2 delegates there»), never a tag. A blue card
 * (ACTIVE) with TWO action rows: «[energy] → [mech]» and «OR [mech] →
 * [delegate]» — «(Action: Pay 1 energy to add a mech resource to this card,
 * OR spend 1 mech from here to add a delegate to a resolution.)». The bottom
 * block: a mech icon and «(Requires the Reds to be ruling or that you have 2
 * delegates there. Add 1 mech resource to this card.)». No VP badge. Only the
 * module's icon at the bottom left (no ▲, no Venus icon): no `compatibility`.
 * The card holds mechs (`CardResource.MECH`). Printed lore: «"A weapon to
 * surpass Metal Gear?"» (`lore_texts.json` «TR34»; the art: Ken Le Bras).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MarsArmyMechs.spec.ts):
 *  1. The requirement is `{party: REDS}`: the Reds RULE, or the player has 2
 *     delegates on their resolution in the Voting Area — checked at the PLAY
 *     only; the action works whatever rules later (the TR15 class: the emblem
 *     in the MIN plate, the named reason «N of 2», the hand's counter).
 *  2. The play: +1 mech on THIS card (`behavior: {addResources: 1}` — a fixed
 *     self-target, the auto-select exemption), and nothing else.
 *  3. ONE action, two variants, in the printed row order: A — 1 energy →
 *     +1 mech here; B — 1 mech off here → 1 delegate FROM THE RESERVE onto a
 *     resolution of the voting area, by the grant's law (free, the lobby's
 *     cube untouched, no support).
 *  4. Availability: A ⇔ energy ≥ 1 (the automatic «Not enough energy»); B ⇔
 *     a mech here ∧ a resolution up for a vote ∧ a delegate in the reserve —
 *     ONE reason in that order («0 of 1 mech on this card» → no resolution →
 *     no delegate). One live variant is the whole action (no `OrOptions`);
 *     two → `OrOptions` with the card as its giver (`effectChoice`). Both
 *     dead → `canAct` is false and the reason is the one blocker the player
 *     can act on (the TR66 rule: no mech → the energy; a mech → what closed
 *     the vote).
 *  5. B's price leaves IN the step's answer — after the reserve is re-read,
 *     right before the cube lands (CHECK → PAY → PLACE in one handler): a
 *     mech gone between the ask and the answer means no cube and no charge;
 *     «paid and placed nothing» is impossible by construction. No
 *     `SelectParty`, no `placeVote`, no removal of the mech in this file.
 *  6. The delegate is an ORDINARY delegate: the vote count, the party effect
 *     at two, any card's party requirement, a «send N delegates» chairman
 *     quest, TR02's «3 delegates on resolutions».
 *  7. The mechs here are NOT money and NOT VP: the `mechs` /
 *     `constructionMechs` payment units read EVA Mechs / Construction Mechs
 *     only, TR66's trade door reads its own card only; a mech Vesta or TR29
 *     puts HERE is fuel for B.
 *  8. Order of events: A — the energy leaves, then the mech arrives; B — the
 *     mech leaves (the price's own journal line), then `delegates-placed`.
 *     All under the card's source.
 *  9. Once per generation, as any blue card's action.
 * 10. Save / load: the mech count and the used-action flag survive.
 * 11. MarsBot never plays the card.
 */
export class MarsArmyMechs extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.MARS_ARMY_MECHS,
      type: CardType.ACTIVE,
      tags: [Tag.MARS, Tag.BUILDING],
      cost: 7,
      resourceType: CardResource.MECH,
      requirements: {party: PartyName.REDS},
      behavior: {addResources: 1},

      metadata: {
        cardNumber: 'TR34',
        // B's full rule is 58 (RU ≈ 78) — over the browser's caption budget; A (TR09's row) reads short as printed.
        infoText: [{kind: 'action-short', text: 'Spend 1 mech for a delegate on a resolution', tokens: ['delegates']}],
        renderData: CardRenderer.builder((b) => {
          // The two action rows, the module's: «[energy] → [mech] / OR / [mech] → [delegate]» (each row describes
          // itself — the TFLP / DP11 contract); then the play's own block, a mech, as the scan prints it under the art.
          censusActionRows(b, MARS_ARMY_MECHS_CENSUS);
          b.br;
          b.resource(CardResource.MECH);
        }),
        description: 'Requires the Reds to be ruling or that you have 2 delegates there. Add 1 mech resource to this card.',
      },
    });
  }

  /** Rule 4 — at least one variant is live. */
  public canAct(player: IPlayer): boolean {
    return censusCanAct(player, this, MARS_ARMY_MECHS_CENSUS);
  }

  /** Rule 4 — both dead: the one blocker the player can act on. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    return censusUnavailableReason(player, this, MARS_ARMY_MECHS_CENSUS);
  }

  public action(player: IPlayer): PlayerInput | undefined {
    return censusAction(player, this, MARS_ARMY_MECHS_CENSUS);
  }

  public actionPreview(player: IPlayer): ActionPreview {
    return censusActionPreview(player, this, MARS_ARMY_MECHS_CENSUS);
  }
}
