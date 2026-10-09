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
 * THE FIGHTER CENSUS — this card's whole declaration of the shared census
 * action (`censusAction.ts`): fighters, A for 1 titanium, B for 1 fighter. The
 * constants are the ones `MarsArmyMechs.spec` pinned on a fake card before
 * this card existed. The i18n keys are this resource's own (the RU noun
 * declines): A's row is new — Security Fleet prints another sentence for the
 * same exchange («Spend 1 titanium to add 1 fighter resource…»), and its key
 * is the base game's, not ours.
 */
export const MARS_ARMY_SHIPS_CENSUS: CensusSpec = {
  resource: CardResource.FIGHTER,
  add: {amount: 1, price: {resource: Resource.TITANIUM, amount: 1}},
  votePrice: 1,
  addTitle: 'Pay 1 titanium to add a fighter resource to this card',
  voteTitle: 'Spend 1 fighter from here to add a delegate to a resolution',
  shortReason: '${0} of 1 fighter on this card',
  rows: {
    add: 'Pay 1 titanium to add a fighter resource to this card.',
    vote: 'Spend 1 fighter from here to add a delegate to a resolution.',
  },
};

/**
 * TR35 — MARS ARMY SHIPS («Корабли армии Марса»): TR34 Mars Army Mechs'
 * sister to the letter — the Reds' plate (TR30–TR34) over the CENSUS action
 * with a PAID variant A, the resource FIGHTERS, A's price TITANIUM. Nothing of
 * the action lives here: the module is parameterised by
 * {@link MARS_ARMY_SHIPS_CENSUS}, and the card calls it four times.
 *
 * SCAN READING — cost 6; two tags in the corner, Mars (the red planet) and
 * Space (the yellow star on black). The orange MIN plate beside the cost
 * holds the REDS' emblem (the red flag): the REQUIREMENT («Requires the Reds
 * to be ruling or that you have 2 delegates there»), never a tag. A blue card
 * (ACTIVE) with TWO action rows: «[titanium] → [fighter]» and «OR [fighter] →
 * [delegate]» — «(Action: Pay 1 titanium to add a fighter resource to this
 * card, OR spend 1 fighter from here to add a delegate to a resolution.)». The
 * bottom block: a fighter icon and «(Requires the Reds to be ruling or that
 * you have 2 delegates there. Add 1 fighter resource to this card.)». No VP
 * badge. Only the module's icon at the bottom left (no ▲, no Venus icon): no
 * `compatibility`. The card holds fighters (`CardResource.FIGHTER`). Printed
 * lore: «The locals call them "redshirts" due to their chances.»
 * (`lore_texts.json` «TR35»; the art: Károly Gőgös).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MarsArmyShips.spec.ts) —
 * TR34's, the fighter's deltas named where they differ:
 *  1. The requirement is `{party: REDS}`, checked at the PLAY only (the TR15
 *     class: the emblem in the MIN plate, the named reason «N of 2»).
 *  2. The play: +1 fighter on THIS card (`behavior: {addResources: 1}` — a
 *     fixed self-target), and nothing else.
 *  3. ONE action, two variants, in the printed row order: A — 1 titanium off
 *     the stock → +1 fighter here; B — 1 fighter off here → 1 delegate FROM THE
 *     RESERVE onto a resolution of the voting area, by the grant's law.
 *  4. Availability: A ⇔ titanium ≥ 1 (the automatic «Not enough titanium» —
 *     titanium the player OWNS: its M€ value never enters, it is not a
 *     payment); B ⇔ a fighter here ∧ a resolution up for a vote ∧ a delegate
 *     in the reserve — ONE reason in that order («0 of 1 fighter on this card»
 *     → no resolution → no delegate). Both dead → the TR66 rule (no fighter →
 *     the titanium; a fighter → what closed the vote).
 *  5. B's price leaves IN the step's answer (CHECK → PAY → PLACE): a fighter
 *     gone between the ask and the answer means no cube and no charge.
 *  6. The delegate is an ORDINARY delegate (the vote count, the party effect
 *     at two, a party requirement, a «send N delegates» quest, TR02).
 *  7. The fighters here are DELEGATES, not VP and not TR: Security Fleet and
 *     TR08 Formula Zero score their OWN fighters, TR28 Earth Army Contract
 *     turns only its own into TR. But they are FIGHTERS on the player's table,
 *     so TR29 Spaceship Recycling («spend 1 fighter from ANY of your cards»)
 *     may legally spend one from here — B then loses its fuel. TR29 never PUTS
 *     one here (its B adds a MECH); Vesta's trade («mechs, asteroids or
 *     fighters» to any card) may, and a Vesta fighter here is fuel for B.
 *  8. Order of events: A — the titanium leaves, then the fighter arrives; B —
 *     the fighter leaves (the price's own journal line), then
 *     `delegates-placed`. All under the card's source.
 *  9. Once per generation, as any blue card's action.
 * 10. Save / load: the fighter count and the used-action flag survive.
 * 11. MarsBot never plays the card.
 * 12. The SPACE tag: the play is payable with EVA Mechs' mechs (the `mechs`
 *     lane, 5 M€ a mech for a Space card) and with titanium; TR05 Vector
 *     Computations can draw it; Construction Mechs (Building / City) cannot pay.
 */
export class MarsArmyShips extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.MARS_ARMY_SHIPS,
      type: CardType.ACTIVE,
      tags: [Tag.MARS, Tag.SPACE],
      cost: 6,
      resourceType: CardResource.FIGHTER,
      requirements: {party: PartyName.REDS},
      behavior: {addResources: 1},

      metadata: {
        cardNumber: 'TR35',
        // Both rules are over the browser's caption budget (A 54, B 61; RU ≈ 70 / 80) — each row its own caption.
        infoText: [
          {kind: 'action-short', text: 'Pay 1 titanium for a fighter here', tokens: ['titanium']},
          {kind: 'action-short', text: 'Spend 1 fighter for a delegate on a resolution', tokens: ['delegates']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The two action rows, the module's: «[titanium] → [fighter] / OR / [fighter] → [delegate]» (each row
          // describes itself — the TFLP / DP11 contract); then the play's own block, a fighter, under the art.
          censusActionRows(b, MARS_ARMY_SHIPS_CENSUS);
          b.br;
          b.resource(CardResource.FIGHTER);
        }),
        description: 'Requires the Reds to be ruling or that you have 2 delegates there. Add 1 fighter resource to this card.',
      },
    });
  }

  /** The fighters here buy DELEGATES (`common/cards/holderRole.ts` — the satellite's split, the target step's value line). */
  public readonly resourceRole = {kind: 'delegate'} as const;

  /** Rule 4 — at least one variant is live. */
  public canAct(player: IPlayer): boolean {
    return censusCanAct(player, this, MARS_ARMY_SHIPS_CENSUS);
  }

  /** Rule 4 — both dead: the one blocker the player can act on. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    return censusUnavailableReason(player, this, MARS_ARMY_SHIPS_CENSUS);
  }

  public action(player: IPlayer): PlayerInput | undefined {
    return censusAction(player, this, MARS_ARMY_SHIPS_CENSUS);
  }

  public actionPreview(player: IPlayer): ActionPreview {
    return censusActionPreview(player, this, MARS_ARMY_SHIPS_CENSUS);
  }
}
