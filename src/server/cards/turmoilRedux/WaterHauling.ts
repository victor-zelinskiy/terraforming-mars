import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {JSONValue} from '../../../common/Types';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {FleetDock} from '../../colonies/FleetDock';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {committedPlacement} from '../../inputs/placementContext';
import {cardSource} from '../../inputs/choiceContext';
import * as actionPreviews from '../actionPreviews';

/** The reward's one blocker — the wording the Parliament's ocean rewards already use. */
export const WATER_HAULING_NO_OCEAN_REASON = 'No ocean tile is left';
/** Why the ocean's placement cannot be taken back: the fleet has already left for the card. */
export const WATER_HAULING_PLACEMENT_REASON = 'The trade fleet has been sent';

/**
 * TR06 — WATER HAULING («Перевозка воды»), the ninth Turmoil Redux PROJECT
 * card and the FIRST FLEET DOCK («карта-причал») — a card that is a
 * DESTINATION of the trade action (`colonies/FleetDock.ts` is the class's
 * contract; its sisters TR26 UNMI Liner and TR27 Aurora Station print the
 * same sentence with another reward).
 *
 * SCAN READING — cost 12; the corner holds TWO tags, Earth (the planet) and
 * Space (the yellow star on black). The orange MIN box beside the cost is
 * EMPTY: no requirement. No VP badge. The upper block is one EFFECT row —
 * «[trade ▲]* : [ocean tile]»; the lower block is the on-play part — the
 * white arrow (a trade fleet) with «Gain an extra trade fleet». The grey ▲ at
 * the bottom left is the Colonies symbol (`compatibility: 'colonies'` in the
 * manifest); the purple Turmoil hexagon below it means «needs the political
 * engine» — for a card of THIS manifest that is the module itself (never
 * `compatibility: 'turmoil'`, see TR02).
 *
 * THE READING OF THE RULE — «Once per generation, when you trade, you can send
 * the trade fleet to this card to place an ocean tile»: the card is ONE MORE
 * DESTINATION of the trade action beside the colony tiles (confirmed by the
 * owner 2026-10-01). Its sources:
 *  · FAQ, p.19: «If I played "Water Hauling", "UNMI Liner", or "Aurora
 *    Station", can other players send their trade fleets to it? — No. Only
 *    the player that played those cards is allowed to TRADE WITH THEM.»
 *  · The Unity action, p.3: «…an action that you can use once per generation
 *    to trade for free. IF YOU USE THIS TO TRADE WITH A COLONY TRACK, you may
 *    advance it 1 step before the trade.» — a clause that only means something
 *    if a trade can go somewhere that is not a colony track.
 *  · The card's own text: «send THE trade fleet» — the fleet of this trade,
 *    not an extra one (Aurora Station prints the same sentence and gives no
 *    fleet at all).
 *  · DERIVED, not printed: the trade is PAID like any trade («when you trade»
 *    = the trade action) — the ordinary fee of the chosen path; free only
 *    through a free path (the Unity action, Automated Convoys' mech).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/WaterHauling.spec.ts):
 *  1. The dock is a destination of the TRADE ACTION: in every door of the
 *     trade (the action itself, Automated Convoys, Titan Floating Launch-Pad,
 *     the Unity action) the player picks ONE destination — an open colony OR
 *     a free dock of their own.
 *  2. The fee is the chosen path's, as for any trade: 3 energy / 3 titanium /
 *     9 M€ with every discount, or a free path. The track offset (Trading
 *     Colony, the Unity +1) does not apply — there is no track.
 *  3. ONE free trade fleet is needed; it goes to the card and counts as used
 *     (`usedTradeFleets`), returning with the others.
 *  4. Once per generation PER CARD = «the berth is taken»: while the fleet is
 *     on the card it is not a destination; next generation it is free again.
 *  5. A trade is possible with NO open colony when a dock is free.
 *  6. The reward is an ordinary ocean: `PlaceOceanTile` (ocean spaces, +1 TR,
 *     the cell's bonus, adjacency, every trigger), sourced by THIS card. Its
 *     TR is a TR of the player's own action phase — the chairman quests count
 *     it and the ruling Greens' effect pays on it.
 *  7. No ocean tile left (`!game.canAddOcean()`) → the dock is UNAVAILABLE
 *     with its reason, refused BEFORE the fee: neither the fleet nor the fee
 *     goes into nothing (`PlaceOceanTile` itself is silent there).
 *  8. It IS a trade: the «trade N times» quest counts it and Venus Trade Hub
 *     pays its +3 M€. No colony takes part — no income, no colony bonuses, no
 *     track reset.
 *  9. Only the owner (FAQ p.19). MarsBot trades past the docks and never
 *     plays a project card.
 * 10. «Gain an extra trade fleet» is the engine's `increaseFleetSize`
 *     (declarative `addTradeFleet`); at the cap of four the gain is a NAMED
 *     loss, in the preview and in the journal. The fleet's point, by the
 *     rules: to reach both a colony and the card in one generation — by two
 *     trades, each with its own fee.
 */
export class WaterHauling extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.WATER_HAULING,
      type: CardType.ACTIVE,
      tags: [Tag.EARTH, Tag.SPACE],
      cost: 12,

      behavior: {
        colonies: {addTradeFleet: 1},
      },

      metadata: {
        cardNumber: 'TR06',
        infoText: [
          // The printed rule runs far past the caption clamp in both languages.
          {kind: 'effect-short', text: 'Trade with this card: place an ocean'},
          // The printed sentence, word for word («an EXTRA fleet» — the generated «Gain a trade fleet.» drops the word).
          {text: 'Gain an extra trade fleet.', tokens: ['trade_fleet']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('Once per generation, when you trade, you can send the trade fleet to this card to place an ocean tile.', (eb) => {
            eb.trade().asterix().startEffect.oceans(1);
          }).br;
          b.tradeFleet();
        }),
        description: 'Gain an extra trade fleet.',
      },
    });
  }

  /** The fleet standing on the card — the class's state (`FleetDock.ts`), declared here so a save keeps it. */
  public data: JSONValue = {dockedGeneration: -1};

  /** The dock's own part: the reward (rule 6), its one blocker (rule 7), its preview. */
  public readonly fleetDock: FleetDock = {
    rewardBlockedReason: (player) => player.game.canAddOcean() ? undefined : WATER_HAULING_NO_OCEAN_REASON,
    // The ocean and its TR as two chips: the effect forecast reads the ruling
    // Greens' «+2 M€» off the TR chip, never off the tile.
    // The TR chip beside the ocean is the ocean's OWN step made visible (the stage reads «[океан] 3 → 4 · [РТ] 20 → 21»);
    // for the forecast's grants it is IMPLIED by the ocean — the Greens are paid once (PL-066).
    previewEffects: (player) => [actionPreviews.oceanGain(player, 1), {...actionPreviews.trGain(player, 1), implied: true}],
    previewFollowUps: () => [{kind: 'note', role: 'tradeReward', note: 'placeOcean'}],
    receive: (player) => {
      player.game.defer(new PlaceOceanTile(player, {
        sourceCard: this.name,
        placementContext: committedPlacement(WATER_HAULING_PLACEMENT_REASON, cardSource(this)),
      }));
    },
  };
}
