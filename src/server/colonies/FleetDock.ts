import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {ColonyTradeFollowUpModel} from '../../common/models/ColonyTradePreviewModel';
import {FleetDockOfferModel} from '../../common/models/PlayerInputModel';
import {FLEET_DOCK_BUSY_REASON} from '../../common/colonies/fleetDock';
import {ICard} from '../cards/ICard';
import {IPlayer} from '../IPlayer';
import type {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';

/**
 * A FLEET DOCK — a CARD that is a destination of the trade action («карта-причал»).
 *
 * Three cards of Turmoil Redux print one sentence: «Once per generation, when
 * you trade, you can send the trade fleet to this card to …» — TR06 Water
 * Hauling (place an ocean), TR26 UNMI Liner (+1 TR), TR27 Aurora Station
 * (2 floaters to any Venus card + 1 M€ production). The reading, confirmed by
 * the owner against the set's own sources (FAQ p.19: «only the player that
 * played those cards is allowed to TRADE WITH THEM»; the Unity action, p.3:
 * «if you use this to trade with a COLONY TRACK…» — a clause that only means
 * something if a trade can go elsewhere): the card is ONE MORE DESTINATION of
 * the trade action beside the colony tiles. The player pays the ordinary fee
 * of the path they chose, the fleet of THAT trade goes to the card instead of
 * a colony, and the reward is the card's. No colony takes part: no income, no
 * colony bonuses, no track.
 *
 * THE CONTRACT IS CO-LOCATED: a dock card declares `ICard.fleetDock` in its own
 * file (invariant 8 — a hook lives where upstream would conflict with it) and
 * states only what is ITS OWN: the reward, the reward's one blocker, the
 * reward's preview. Everything the class shares lives here, once:
 *
 *  · THE STATE «the fleet is on the card» — `card.data = {dockedGeneration}`
 *    (serialized by `cardSerialization` as any card data). Busy ⇔
 *    `dockedGeneration === game.generation`, so nothing has to reset it: the
 *    next generation the dock is free by arithmetic, exactly when
 *    `returnTradeFleets` brings the fleet home.
 *  · THE OFFER — `fleetDockOffers(player)`: every dock of the player's tableau
 *    with the server's verdict and ONE reason (the fleet is already here this
 *    generation → the reward's own blocker). The trade's destination pick
 *    carries it as its marker (`SelectColonyModel.fleetDocks`).
 *  · THE LANDING and THE DESTINATION — `dockFleet` and `FleetDockDestination`
 *    (`FleetDockDestination.ts`: the stamp, the fleet spent, the typed
 *    `fleet-docked` event, then the card's reward; what a payment path trades
 *    with — no path knows it is not a colony). They live NEXT DOOR, not here,
 *    for a load-order reason: the landing reports the trade to the Parliament,
 *    and this module is read by the model builders that load before any card
 *    class exists (`ModelUtils`) — it must import nothing but types.
 *
 * ONLY THE OWNER trades with their docks (FAQ p.19): the offers are read off
 * the player's own tableau, so another seat's dock is never a destination.
 * MarsBot trades past all of this (`AutomaColonies.botTrade`) and never plays
 * a project card.
 *
 * A REWARD WITH A QUESTION IS ONE OBJECT FOR BOTH ENDS (TR27 Aurora Station:
 * «2 floaters to ANY Venus card»). The card names WHAT is due — a built,
 * never-queued `AddResourcesToCard` (`rewardTarget`) — and the module asks
 * that one object twice: the preview reads its candidates (0 / 1 / ≥ 2 →
 * `lost` / `auto` / `pick`, `colonyTradePreview.cardTargetFollowUpOf` — the
 * reading a colony's card target goes through), and the landing queues it
 * (`dockFleet`). Who the candidates are, how many, and whether the server
 * will ask cannot read apart, because there is nothing to read apart: one
 * construction, one `getCards()`, one `autoSelect`. The module stamps the
 * question's SOURCE (`choiceContext` = the dock card) — the structural mark a
 * re-asked or parked question is recognised by, never its title.
 */
export type FleetDock = {
  /**
   * Why the REWARD cannot be paid right now (Water Hauling: no ocean tile is
   * left) — ONE reason, an English i18n key. The dock is then NOT a
   * destination: the refusal comes before the fee, never a fleet and a fee
   * sent into nothing. The shared blocker (the fleet already on the card) is
   * the module's, not the card's.
   */
  rewardBlockedReason?(player: IPlayer): string | undefined;
  /** What a trade with this card pays — `current → resulting` chips. READ-ONLY, never mutates. */
  previewEffects(player: IPlayer): ReadonlyArray<ActionEffect>;
  /**
   * What the reward will ASK after the confirm, in live order — the same
   * follow-up shape a colony trade's preview carries, so a reward with a
   * question (TR27: which Venus card takes the floaters) is pre-collected by
   * the same step. Absent = the reward asks nothing. READ-ONLY.
   */
  previewFollowUps?(player: IPlayer): ReadonlyArray<ColonyTradeFollowUpModel>;
  /**
   * THE REWARD'S CARD TARGET — «add N <resource> to a card» as the REAL step,
   * built and never queued (TR27: `new AddResourcesToCard(player, FLOATER,
   * {count: 2, restrictedTag: VENUS})`). Read through `fleetDockRewardTarget`
   * only: the preview derives its follow-up from it and the landing queues it,
   * BEFORE `receive` — the printed order of a row whose first icons land on a
   * card. Absent = the reward points at no card. A fresh object per call.
   */
  rewardTarget?(player: IPlayer): AddResourcesToCard;
  /**
   * THE REWARD: queue the card's own deferred work. Called AFTER the fleet has
   * landed — and, for a dock with a `rewardTarget`, after that target has been
   * answered (or auto-applied): nothing the card pays here comes before the
   * question its row prints first.
   */
  receive(player: IPlayer): void;
};

/** A card that IS a fleet dock. */
export type FleetDockCard = ICard & {fleetDock: FleetDock};

/** The shared blocker: one fleet per generation stands on the card (`common/colonies/fleetDock.ts` — the client reads the public state in the same words). */
export {FLEET_DOCK_BUSY_REASON};

/** One dock with the server's verdict — the trade's destination pick carries these. */
export type FleetDockOffer = {
  card: FleetDockCard;
  available: boolean;
  /** The ONE blocker when unavailable. */
  reason?: string;
  effects: ReadonlyArray<ActionEffect>;
};

export function isFleetDockCard(card: ICard): card is FleetDockCard {
  return card.fleetDock !== undefined;
}

/** The generation the fleet last landed on `card`, or `undefined` when it never did (or an old save carries no data). */
function dockedGeneration(card: ICard): number | undefined {
  const data = card.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return undefined;
  }
  const generation = (data as {dockedGeneration?: unknown}).dockedGeneration;
  return typeof generation === 'number' ? generation : undefined;
}

/** True while this generation's fleet stands on the card. */
export function isFleetDocked(card: ICard, generation: number): boolean {
  return dockedGeneration(card) === generation;
}

/**
 * Why `player` cannot send the trade fleet to `card` right now — ONE blocker,
 * or `undefined` when they can. The dock's OWN gate only: the embargo, the
 * free fleet and the fee are the trade action's (`Colonies.tradeBlockedReason`
 * / the payment paths).
 */
export function fleetDockBlockedReason(player: IPlayer, card: FleetDockCard): string | undefined {
  if (isFleetDocked(card, player.game.generation)) {
    return FLEET_DOCK_BUSY_REASON;
  }
  return card.fleetDock.rewardBlockedReason?.(player);
}

/**
 * THE REWARD'S QUESTION of `card` for `player` — the card's own built step
 * with the class's mark stamped on it: the question's SOURCE is the dock card
 * (`choiceContext`, mode `reward`), so the client knows a re-asked or parked
 * target as THIS card's question by structure. `undefined` = no target. The
 * ONE reading the preview and the landing go through (see the module header).
 */
export function fleetDockRewardTarget(player: IPlayer, card: FleetDockCard): AddResourcesToCard | undefined {
  const step = card.fleetDock.rewardTarget?.(player);
  if (step !== undefined) {
    step.options.cause = {kind: 'card', card: card.name};
  }
  return step;
}

/** Every fleet dock in the player's tableau, tableau order, with the verdict. READ-ONLY. */
export function fleetDockOffers(player: IPlayer): Array<FleetDockOffer> {
  const offers: Array<FleetDockOffer> = [];
  for (const card of player.tableau) {
    if (!isFleetDockCard(card)) {
      continue;
    }
    const reason = fleetDockBlockedReason(player, card);
    offers.push({
      card,
      available: reason === undefined,
      ...(reason !== undefined ? {reason} : {}),
      effects: card.fleetDock.previewEffects(player),
    });
  }
  return offers;
}

/** The docks the player could send a fleet to right now. */
export function availableFleetDocks(player: IPlayer): Array<FleetDockCard> {
  return fleetDockOffers(player).filter((offer) => offer.available).map((offer) => offer.card);
}

/** The wire form of the offers (`SelectColonyModel.fleetDocks`). */
export function fleetDockOfferModels(offers: ReadonlyArray<FleetDockOffer>): ReadonlyArray<FleetDockOfferModel> {
  return offers.map((offer) => ({
    card: offer.card.name,
    available: offer.available,
    ...(offer.reason !== undefined ? {reason: offer.reason} : {}),
    effects: offer.effects,
  }));
}
