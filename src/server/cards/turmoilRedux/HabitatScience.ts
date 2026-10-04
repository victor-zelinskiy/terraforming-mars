import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Size} from '../../../common/cards/render/Size';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {PlayerInput} from '../../PlayerInput';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ColoniesHandler} from '../../colonies/ColoniesHandler';
import {allColonyBonusesEffects, allColonyBonusesLedger, gainAllColonyBonuses} from '../../colonies/allColonyBonuses';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** The action's printed price — data spent from THIS card. */
export const HABITAT_SCIENCE_DATA_COST = 2;

/** The action's first blocker: fewer than 2 data on the card («1 of 2 data on this card»). */
export const HABITAT_SCIENCE_SHORT_DATA_REASON = '${0} of 2 data on this card';

/** The action's second blocker: the player has no colony to be paid for. */
export const HABITAT_SCIENCE_NO_COLONIES_REASON = 'You have no colonies';

/**
 * TR23 — HABITAT SCIENCE («Наука обитаемости»), a Turmoil Redux PROJECT card —
 * the set's first CARD ACTION that pays «all your colony bonuses»: every colony
 * of the player's pays its tile's printed bonus, one after another, and the
 * workspace the action was pressed in owns the whole payout (the card names
 * itself on every draw, target and discard the bonuses raise — `via`).
 *
 * SCAN READING — cost 3; two tags in the corner, in this order: the atom
 * (Science), the yellow star on dark (Space). The orange MIN plate beside the
 * cost holds Unity's emblem (three rings): the REQUIREMENT, not a tag. No VP
 * badge. The upper field is the ACTION: two data icons (two icons, not «2×»),
 * the red arrow, and the result printed AS TEXT — «GAIN ALL YOUR COLONY
 * BONUSES» (there is no result icon at all). The lower field is the on-play
 * row: «[data] / [colony in the red «any player» frame]». The grey ▲ at the
 * bottom left is the Colonies symbol (`compatibility: 'colonies'` in the
 * manifest); the purple Turmoil hexagon below it is the module itself (never
 * `compatibility: 'turmoil'`, see TR02). Flavour (printed): «We came a long
 * way from merely understanding Cabin Fewer.» — «Fewer» is the scan's typo;
 * the entry prints «Cabin Fever» (`lore_texts.json` «TR23»).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/HabitatScience.spec.ts):
 *  1. The requirement is Unity's plate (`{party: UNITY}` — the class of TR15):
 *     Unity rules, or 2 of the player's delegates stand on its resolution.
 *  2. ON PLAY: +1 data on THIS card per COLONY IN PLAY, of ANY player. A colony
 *     is a CUBE on a colony tile (two cubes on one tile are 2), every seat's —
 *     MarsBot's included; the engine's own counter (`{colonies, all: true}`).
 *     A city on a colony tile (TR22 Nova City) is not a colony, and a tile with
 *     no cube counts nothing. No colony in play → 0 data and the card is still
 *     playable: a rule, not a loss (no warning, no skip event).
 *  3. THE ACTION: spend 2 data FROM THIS CARD → gain the colony bonus of EVERY
 *     colony of the player's. «A colony bonus» is the tile's third line
 *     (`metadata.colony`) — what a cube's owner receives when somebody ELSE
 *     trades there; never the trade income, never the build bonus.
 *  4. PER CUBE, NEVER MERGED: two of the player's cubes on a tile pay the bonus
 *     twice, each resolved separately and in full (the engine's law for a
 *     trade's owner bonus). Merging repeats is the RESOLUTION's law (RX07).
 *  5. THE ORDER OF PAYMENT is the deferred queue's, and the ledger shows that
 *     very order (`allColonyBonusesLedger`): the gains that simply land and the
 *     plain draws in the table's order, then Pluto's pairs, then the resources
 *     onto cards.
 *  6. THE ACTION IS REFUSED by ONE reason, in order: fewer than 2 data here →
 *     no colony of the player's (the data are never burnt for nothing). With
 *     colonies, a bonus nothing can receive (a floater with no holder) does NOT
 *     block the action: it is NAMED with its size before the press and recorded
 *     after it (the shared step's `recordSkippedEffect`).
 *  7. NO AUTO-SELECT: a «resource onto a card» bonus with ONE holder is still a
 *     step of the composer (`autoSelect: false`, pre-collected) — one per cube.
 *  8. PLUTO'S PAIR («take 1, then discard 1») is one pair per cube: the next
 *     card is not revealed before the previous discard is answered; the
 *     discard is never pre-collected (hidden information) — a pre-collected
 *     target behind it PARKS and lands once the discard is answered.
 *  9. An ordinary blue-card action: once per generation. Data here are ordinary
 *     card resources («data on ANY card» may land here); never a payment unit.
 * 10. REACTIONS are the engine's and nothing of them is programmed here: the
 *     play is a Science tag (TR05 Vector Computations, Olympus Conference, Mars
 *     University) and N data onto a card (TR18 Martian Fiber).
 * 11. THE JOURNAL: the play's data carry their reason («for 5 colonies in
 *     play» — the event's `basis`, the executor's own); the action is a card
 *     action whose bonus rows are sourced by their COLONY.
 * 12. MarsBot never plays the card; its cubes ARE counted on play (rule 2).
 */
export class HabitatScience extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.HABITAT_SCIENCE,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.SPACE],
      cost: 3,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.UNITY},

      // Rule 2 — the engine's own counter: every cube on every colony tile, of every seat.
      behavior: {
        addResources: {colonies: {colonies: {}}, all: true},
      },

      metadata: {
        cardNumber: 'TR23',
        infoText: [
          // The full rule is 55 (RU ≈ 80) — over the action browser's caption budget.
          {kind: 'action-short', text: 'Spend 2 data for all your colony bonuses'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 2 data from here to gain all your Colony Bonuses.', (eb) => {
            eb.resource(CardResource.DATA, 2).startAction.text('Gain all your colony bonuses', Size.SMALL, true);
          }).br;
          b.resource(CardResource.DATA).slash().colonies(1, {all});
        }),
        description: 'Requires Unity to be ruling or that you have 2 delegates there. Add 1 data resource to this card for each colony in play, owned by ANY player.',
      },
    });
  }

  /** Rule 6 — ONE reason, in order: the card's data, then the player's colonies. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.resourceCount < HABITAT_SCIENCE_DATA_COST) {
      return {type: 'count', message: HABITAT_SCIENCE_SHORT_DATA_REASON, params: [String(this.resourceCount)], current: this.resourceCount};
    }
    // THE ONE reading of «each colony you have» (one entry per cube) — never a walk of the table here.
    if (ColoniesHandler.coloniesOf(player.game, player).length === 0) {
      return actionReason.ruleReason(HABITAT_SCIENCE_NO_COLONIES_REASON);
    }
    return undefined;
  }

  public canAct(player: IPlayer): boolean {
    return this.actionUnavailableReason(player) === undefined;
  }

  public action(player: IPlayer): PlayerInput | undefined {
    // The cost, by the path a declarative `spend.resourcesHere` takes (the spend event, the capsule's counter).
    player.removeResourceFrom(this, HABITAT_SCIENCE_DATA_COST);
    // The ONE payout of «all your colony bonuses»: per cube, this card named on everything it raises.
    gainAllColonyBonuses(player, {via: this.name});
    return undefined;
  }

  /**
   * One branch: the data leaving the card, the SUMS of the bonuses as ordinary
   * chips, the card target of every «resource onto a card» bonus as a step in
   * the order the engine asks, and the LEDGER behind the sums — a row per
   * colony, in the order it is paid.
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const options = {via: this.name};
    const {effects, steps} = allColonyBonusesEffects(player, options);
    return actionPreviews.singleBranch(
      this,
      player,
      steps.filter((step) => step !== undefined),
      [actionPreviews.cardCost(this, HABITAT_SCIENCE_DATA_COST), ...effects],
      {colonyBonuses: allColonyBonusesLedger(player, options)},
    );
  }
}
