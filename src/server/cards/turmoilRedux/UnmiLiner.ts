import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {JSONValue} from '../../../common/Types';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {FleetDock} from '../../colonies/FleetDock';
import * as actionPreviews from '../actionPreviews';

/**
 * TR26 — UNMI LINER («Лайнер UNMI»), the SECOND FLEET DOCK («карта-причал») of
 * Turmoil Redux — a card that is a DESTINATION of the trade action
 * (`colonies/FleetDock.ts` is the class's contract and carries the reading of
 * the rule with its sources; the sisters are TR06 Water Hauling and TR27
 * Aurora Station). Its reward is the class's plainest: a gain with no surface
 * and no question — +1 TR.
 *
 * SCAN READING — cost 6; the corner holds TWO tags, Earth (the planet) and
 * Space (the yellow star on black), as on TR06. The orange MIN box beside the
 * cost holds Unity's emblem (three linked rings): `{party: PartyName.UNITY}`.
 * No VP badge. The upper block is one EFFECT row — «[trade ▲]* : [TR]»; the
 * lower block is the on-play part — the white arrow (a trade fleet) with
 * «Requires Unity to be ruling or that you have 2 delegates there. Gain an
 * extra trade fleet.» The grey ▲ at the bottom left is the Colonies symbol
 * (`compatibility: 'colonies'` in the manifest); the purple Turmoil hexagon
 * below it is the module itself (never `compatibility: 'turmoil'`, see TR02).
 * The quote is printed: «Please switch your phones to Airplane mode.»
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/UnmiLiner.spec.ts; the
 * CLASS's rules are pinned once, in tests/colonies/FleetDock.spec.ts):
 *  1. The requirement is a condition of the PLAY: Unity rules, or two of the
 *     player's delegates stand on its resolution. Once played the dock works
 *     whoever rules and wherever the delegates went.
 *  2. «Gain an extra trade fleet» is the engine's `increaseFleetSize`
 *     (declarative `addTradeFleet`); at the cap of four the gain is a NAMED
 *     loss, in the preview and in the journal (TR06's rule 10).
 *  3. The card is a destination of the TRADE ACTION in every door (the action
 *     itself, Automated Convoys, Titan Floating Launch-Pad, the Unity action):
 *     the fee is the chosen path's, ONE free fleet goes to the card and counts
 *     as used, once per generation PER CARD, and a trade is possible with no
 *     open colony at all. Only the owner. It IS a trade: the «trade N times»
 *     quest counts it and Venus Trade Hub pays. No colony takes part.
 *  4. The reward is an ordinary +1 TR sourced by THIS card — a TR of the
 *     player's own action phase: the chairman quest on TR counts it, the
 *     ruling Greens pay their 2 M€ on it, `trThisGeneration` grows, the UNMI
 *     corporation's action is live after it, the score breakdown attributes
 *     the point to «UNMI Liner», every `onIncreaseTerraformRatingByAnyPlayer`
 *     hook fires.
 *  5. The reward has NO blocker: the rating has no ceiling and Turmoil Redux
 *     has no Reds tax (the Redux Reds are an action — `PartyEffects.ts`), so
 *     `rewardBlockedReason` is not declared; the dock refuses for exactly one
 *     reason, the class's («the fleet is already on the card»).
 *  6. A free trade is a free TR: the Unity action (its «+1 track step» clause
 *     has no track to act on) and Automated Convoys' mech.
 *  7. Two docks in one tableau (TR06 + TR26) are two places with two stamps:
 *     with two free fleets both are served in one generation — by two trades,
 *     each with its own fee.
 *  8. The card is not an action: it declares none and never stands in the
 *     card-actions list.
 *  9. Save / load keeps `data`; an old save without it is a free dock (class).
 * 10. MarsBot never plays it and trades past every dock; a human at the bot's
 *     table plays it as ever.
 * 11. The journal: the chain roots at «${0} sent a trade fleet to ${1}», under
 *     it the path's fee, «[fleet] −1», «+1 TR» and the Greens' answer as THEIR
 *     effect. The TR is written once — by its typed event, never by a second
 *     log line (the plain-gain convention of `behavior.tr`).
 */
export class UnmiLiner extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.UNMI_LINER,
      type: CardType.ACTIVE,
      tags: [Tag.EARTH, Tag.SPACE],
      cost: 6,
      requirements: {party: PartyName.UNITY},

      behavior: {
        colonies: {addTradeFleet: 1},
      },

      metadata: {
        cardNumber: 'TR26',
        infoText: [
          // The printed rule runs far past the caption clamp in both languages.
          {kind: 'effect-short', text: 'Trade with this card: gain 1 TR'},
          // The printed sentence, word for word («an EXTRA fleet» — the generated «Gain a trade fleet.» drops the word).
          {text: 'Gain an extra trade fleet.', tokens: ['trade_fleet']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('Once per generation, when you trade, you can send the trade fleet to this card to gain 1 TR.', (eb) => {
            eb.trade().asterix().startEffect.tr(1);
          }).br;
          b.tradeFleet();
        }),
        description: 'Requires Unity to be ruling or that you have 2 delegates there. Gain an extra trade fleet.',
      },
    });
  }

  /** The fleet standing on the card — the class's state (`FleetDock.ts`), declared here so a save keeps it. */
  public data: JSONValue = {dockedGeneration: -1};

  /** The dock's own part: the reward (rule 4) and its preview. No blocker (rule 5), no question. */
  public readonly fleetDock: FleetDock = {
    previewEffects: (player) => [actionPreviews.trGain(player, 1)],
    receive: (player) => {
      player.increaseTerraformRating(1);
    },
  };
}
