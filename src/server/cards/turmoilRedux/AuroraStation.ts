import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {SpaceName} from '../../../common/boards/SpaceName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {JSONValue} from '../../../common/Types';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {FleetDock} from '../../colonies/FleetDock';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import * as actionPreviews from '../actionPreviews';

/**
 * TR27 — AURORA STATION («Станция Аврора»), the THIRD fleet dock («карта-
 * причал») of Turmoil Redux — a card that is a DESTINATION of the trade action
 * (`colonies/FleetDock.ts` is the class's contract and carries the reading of
 * the rule with its sources; the sisters are TR06 Water Hauling and TR26 UNMI
 * Liner). Its reward is the class's first with a QUESTION: two floaters land
 * on a Venus card of the player's choosing, then +1 M€ production.
 *
 * SCAN READING — cost 14, blue (ACTIVE); the corner holds THREE tags, Venus
 * (the yellow-white planet), City and Space (the yellow star on black). The
 * orange MIN plate beside the cost holds Unity's emblem (three linked rings):
 * the REQUIREMENT `{party: PartyName.UNITY}`, not a tag. The upper block is
 * one EFFECT row — «[trade ▲]* : [floater·V] [floater·V] [M€ production 1]»:
 * TWO separate floater icons, each with the Venus corner bubble (the existing
 * `secondaryTag: Tag.VENUS`, as on Stratopolis' action — never «2 [floater]»),
 * and the brown production plate. The lower block is the on-play part — a
 * city hex with an asterisk, «Requires Unity to be ruling or that you have 2
 * delegates there. Place a city tile NEXT TO THE VENUS TRACK.» No trade-fleet
 * arrow: the card gives NO fleet. The VP badge prints «1 / 2 [floater]» on a
 * planet disc (the disc is the badge's background): 1 VP per 2 floaters here
 * (`resourcesHere`, as Floating Habs). Bottom left: the grey ▲ of Colonies and
 * the purple module mark; there is NO Venus Next icon on the scan (TR24 has
 * the blue «V» hexagon there) — and yet the card cannot work without Venus
 * Next (a Venus tag, «the Venus track», «any Venus card»), so the manifest
 * gates it on BOTH (`compatibility: ['colonies', 'venus']`, owner's decision 3;
 * the Redux Venus colony in this fork needs Venus Next too). The quote is
 * printed as two lines of dialogue, «"May I see it?" "No"» (the second
 * without a stop) — kept as one line, «May I see it? — No.», because the face
 * sets the outer quotes itself and the lore guard wants terminal punctuation.
 *
 * THE RULEBOOK: FAQ p.19 (only the player who played the card trades with
 * it — the class's rule) and FAQ p.18 («Do Venus cities count towards Nova
 * City? — Yes. Any city that is not on Mars counts.»).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/AuroraStation.spec.ts; the
 * CLASS's rules are pinned once, in tests/colonies/FleetDock.spec.ts):
 *  1. The requirement is a condition of the PLAY: Unity rules, or two of the
 *     player's delegates stand on its resolution. The dock works without it.
 *  2. The play places a city on its OWN cell next to the Venus track
 *     (`SpaceName.AURORA_STATION` — the fifth cell of the board's Venus flank,
 *     beside the four Venus Next cities; declarative `city: {space}`). A city
 *     off Mars: no placement bonus, no adjacency; counted wherever space
 *     cities are (`getCitiesOffMars`: Nova City's 2 VP, the RX08 quest) and by
 *     every count of cities «anywhere» (Mayor counts every city tile), never
 *     by a reading of MARS (TR15 Martian Census). The «a city is placed»
 *     triggers fire by their own predicates (Immigrant City, Rover
 *     Construction, Pets).
 *  3. The card gives NO fleet: with one fleet the player chooses each
 *     generation — a colony or the dock.
 *  4. The dock is the class's: a destination in every trade door, the chosen
 *     path's fee, once per generation per card, only the owner, it IS a trade
 *     (the chairman quest, Venus Trade Hub), possible with no open colony.
 *  5. The reward in the printed order: 2 floaters onto ONE Venus card (a card
 *     with a Venus tag that holds floaters — one `AddResourcesToCard` with
 *     `count: 2`, as Stratopolis' action), THEN +1 M€ production. The order of
 *     the events is the order of the icons (the class queues the target
 *     first and the rest of the reward behind it — `dockFleet`).
 *  6. The card ITSELF is always a candidate (a Venus tag, a floater holder):
 *     the reward cannot be lost, there is no blocker, `rewardBlockedReason` is
 *     not declared. With two or more holders the player chooses; with one,
 *     the recipient is named on the stage with «n → n + 2» before the press.
 *     No question is asked after the fleet lands in either case.
 *  7. The target is chosen before the confirm and rides the same POST. A tail
 *     parked behind somebody else's question, or a reload mid-way, leaves the
 *     live question THIS card's (its source is the card — the class's
 *     `choiceContext`), answered inside the colony workspace.
 *  8. 1 VP per 2 floaters ON THIS card (rounded down), whoever put them there
 *     (Titan, Floater Technology, Stratopolis' action).
 *  9. The card holds floaters for every reader: Titan, positions 3–5 of the
 *     Redux Venus («a card that can accept floater resources» — the card is
 *     what makes such a trade possible). Nothing spends floaters from it.
 * 10. A free door is a free reward (the Unity action, TR66's mech).
 * 11. Three docks (TR06 + TR26 + TR27) are three places with three stamps:
 *     `potentialTradeCount` = min(colonies + free docks, free fleets).
 * 12. The card is not an action.
 * 13. Save / load keeps the stamp, the floaters and the tile; the cell is laid
 *     into a save made before the card (`restoreExpansionSpaceColonies`).
 * 14. MarsBot never plays it; a human at the bot's table plays it as ever.
 * 15. The journal: the chain roots at «${0} sent a trade fleet to ${1}»; under
 *     it the fee, «[fleet] −1», «+2 [floater] → <card>», «+1 M€ production»,
 *     the table's answers as THEIR effects. No line twice.
 * 16. Without Venus Next the card is not in the deck and its cell is not on
 *     the board.
 */
export class AuroraStation extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.AURORA_STATION,
      type: CardType.ACTIVE,
      tags: [Tag.VENUS, Tag.CITY, Tag.SPACE],
      cost: 14,
      requirements: {party: PartyName.UNITY},
      resourceType: CardResource.FLOATER,
      victoryPoints: {resourcesHere: {}, per: 2},

      behavior: {
        city: {space: SpaceName.AURORA_STATION},
      },

      metadata: {
        cardNumber: 'TR27',
        infoText: [
          // The printed rule runs far past the caption clamp in both languages.
          {kind: 'effect-short', text: 'Trade here: 2 floaters to a Venus card, +1 M€ prod.'},
          // The printed place, word for word — the derived «on the reserved area» names no place at all.
          {text: 'Place a city tile next to the Venus track.', tokens: ['city']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('Once per generation, when you trade, you can send the trade fleet to this card to add 2 floaters to ANY VENUS CARD and increase your M€ production 1 step.', (eb) => {
            eb.trade().asterix().startEffect
              .resource(CardResource.FLOATER, {secondaryTag: Tag.VENUS})
              .resource(CardResource.FLOATER, {secondaryTag: Tag.VENUS})
              .production((pb) => pb.megacredits(1));
          }).br;
          b.city().asterix();
          b.vpText('1 VP for every 2nd Floater on this card.');
        }),
        description: 'Requires Unity to be ruling or that you have 2 delegates there. Place a city tile NEXT TO THE VENUS TRACK.',
      },
    });
  }

  /** The fleet standing on the card — the class's state (`FleetDock.ts`), declared here so a save keeps it. */
  public data: JSONValue = {dockedGeneration: -1};

  /**
   * The dock's own part (rules 5–6): the reward's QUESTION as the real step —
   * two floaters onto one Venus card — and the rest of the reward, +1 M€
   * production, paid once that question is answered. No blocker: the card is
   * always its own candidate.
   */
  public readonly fleetDock: FleetDock = {
    previewEffects: (player) => [
      actionPreviews.cardResourceGain(CardResource.FLOATER, 2),
      actionPreviews.productionChange(player, Resource.MEGACREDITS, 1),
    ],
    rewardTarget: (player) => new AddResourcesToCard(player, CardResource.FLOATER, {count: 2, restrictedTag: Tag.VENUS}),
    receive: (player) => {
      player.production.add(Resource.MEGACREDITS, 1, {log: true});
    },
  };
}
