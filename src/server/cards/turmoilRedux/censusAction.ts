import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ICard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {effectChoice} from '../../inputs/choiceContext';
import {PlaceDelegatesOnResolution} from '../../parliament/PlaceDelegatesOnResolution';
import {POLITICAL_DONATION_NO_DELEGATE_REASON, POLITICAL_DONATION_NO_RESOLUTION_REASON} from './PoliticalDonation';
import * as actionPreviews from '../actionPreviews';
import * as reason from '../actionReasons';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {digit} from '../Options';

type Builder = Parameters<Parameters<typeof CardRenderer.builder>[0]>[0];

/**
 * THE CENSUS ACTION — one blue-card action of two variants, printed on FOUR
 * cards of the Turmoil Redux set with the same grammar and different nouns:
 *
 *   TR15 Martian Census («Марсианская перепись») · TR24 Venusian Census
 *     «Action: Add 1 data resource here, OR spend 3 data from here to add a
 *     delegate to a resolution.»
 *   TR34 Mars Army Mechs («Мехи армии Марса»)
 *     «Action: Pay 1 energy to add a mech resource to this card, OR spend 1
 *     mech from here to add a delegate to a resolution.»
 *   TR35 Mars Army Ships («Корабли армии Марса») — the same with titanium
 *     and fighters.
 *
 * ONE implementation, parameterised by a {@link CensusSpec}: each card's own
 * file states only what differs — its resource, whether A has a stock price,
 * B's price in that resource, and the four printed strings (the i18n keys are
 * per resource on purpose: «N of 3 data» and «N of 1 mech» are different
 * sentences in Russian, never one template with a noun substituted) — and
 * calls these functions with itself and its spec. Nothing here names a card.
 *
 *  A. +`add.amount` of the resource on THIS card — for `add.price` off the
 *     player's stock (TR34: 1 energy, the TR09 / TR11 action word for word) or
 *     free (TR15 / TR24: always available).
 *  B. `votePrice` of the resource off THIS card → 1 delegate onto a resolution
 *     of the VOTING AREA — by the grant's law: from the RESERVE, free, the
 *     lobby's cube untouched (the shared step `PlaceDelegatesOnResolution`, no
 *     `support`). The resources are its PRICE (`price`): they leave the card
 *     inside the step's answer, after the reserve is re-read and right before
 *     the cube lands — so «paid and placed nothing» is impossible by
 *     construction, and no card file holds a `SelectParty` or a `placeVote`.
 *
 * B is refused by ONE reason, judged in this order: fewer than `votePrice` on
 * the card («2 of 3 data on this card», «0 of 1 mech on this card») → no
 * resolution up for a vote → no delegate in the reserve (the TR03 keys). A
 * refused variant is SHOWN disabled with its reason, never hidden; one live
 * variant is the whole action (no prompt); both dead → `canAct` is false and
 * the action names the one blocker the player can act on (the TR66 rule:
 * with nothing on the card the vote was never on the table, so A's price is
 * what is missing; with the price in hand, what closed the vote).
 */

/** A's stock price — the two the set prints (energy for mechs, titanium for fighters); each has a named reason and a printed icon. */
export type CensusStockPrice = {resource: Resource.ENERGY | Resource.TITANIUM, amount: number};

/** What one census card declares — everything the shared action needs beyond the card itself. */
export type CensusSpec = {
  /** The card resource the census stores — the delegate's price. */
  resource: CardResource;
  /** Variant A: +`amount` here, for `price` off the stock (TR34 / TR35) or free (TR15 / TR24). */
  add: {amount: number, price?: CensusStockPrice};
  /** Variant B: how many of `resource` leave THIS card for ONE delegate. */
  votePrice: number;
  /** The option titles, in the printed row order (A, then B) — the same order `censusActionPreview` declares. */
  addTitle: string;
  voteTitle: string;
  /** B's own blocker — the one condition the card adds over the grant's; `${0}` is the count on the card now. */
  shortReason: string;
  /** The two printed ACTION ROWS' texts (A, then B) — each row describes itself (the TFLP / DP11 contract). */
  rows: {add: string, vote: string};
};

/** B's printed price on the two data censuses — data spent from THIS card. */
export const CENSUS_DATA_COST = 3;

/** The data censuses' two options, in the printed row order (A, then B). */
export const CENSUS_ADD_TITLE = 'Add 1 data resource to this card';
export const CENSUS_VOTE_TITLE = 'Spend 3 data from here to add a delegate to a resolution';

/** The data censuses' own blocker of B. */
export const CENSUS_SHORT_DATA_REASON = '${0} of 3 data on this card';

/**
 * THE DATA CENSUS (TR15 Martian Census, TR24 Venusian Census): «→ [data] / OR / 3 [data] → [delegate]» —
 * A free, B three data. Both cards print it word for word and call the module with this one spec.
 */
export const DATA_CENSUS: CensusSpec = {
  resource: CardResource.DATA,
  add: {amount: 1},
  votePrice: CENSUS_DATA_COST,
  addTitle: CENSUS_ADD_TITLE,
  voteTitle: CENSUS_VOTE_TITLE,
  shortReason: CENSUS_SHORT_DATA_REASON,
  rows: {
    add: 'Add 1 data resource here.',
    vote: 'Spend 3 data from here to add a delegate to a resolution.',
  },
};

/** A's price as the player's stock sees it — the automatic reason of a `spend.energy` / `spend.titanium` action, by resource. */
const STOCK_PRICE_REASON: Readonly<Record<CensusStockPrice['resource'], () => UnplayableReason>> = {
  [Resource.ENERGY]: reason.notEnoughEnergy,
  [Resource.TITANIUM]: reason.notEnoughTitanium,
};

/**
 * THE TWO PRINTED ACTION ROWS — «[price] → [resource] / OR / N [resource] →
 * [delegate]» (the scans split the row with a vertical rule after the card's
 * own effect; the DSL has no vertical divider, so an effect stands on its own
 * row above this pair). A card's face draws its effect, then calls this.
 */
export function censusActionRows(b: Builder, spec: CensusSpec): void {
  b.action(spec.rows.add, (eb) => {
    const price = spec.add.price;
    const cause = price === undefined ? eb.empty() :
      price.resource === Resource.ENERGY ? eb.energy(price.amount) : eb.titanium(price.amount);
    cause.startAction.resource(spec.resource, spec.add.amount === 1 ? undefined : {amount: spec.add.amount});
  }).br;
  b.or().br;
  b.action(spec.rows.vote, (eb) => {
    // A price of 1 is ONE icon (TR66's «[mech] → trade»); more prints the digit beside one icon (TR15's «3 [data]»).
    const cost = spec.votePrice === 1 ? eb.resource(spec.resource) : eb.resource(spec.resource, {amount: spec.votePrice, digit});
    cost.startAction.delegates(1);
  });
}

/** THE grant B places — built once, asked by the preview's door and queued by the action. */
export function censusGrant(player: IPlayer, card: ICard, spec: CensusSpec): PlaceDelegatesOnResolution {
  return new PlaceDelegatesOnResolution(player, 1, {kind: 'card', card: card.name}, {price: {card, count: spec.votePrice}});
}

/** Why A cannot be taken now — its stock price, when it has one (a free A is always open). */
export function censusAddReason(player: IPlayer, spec: CensusSpec): UnplayableReason | undefined {
  const price = spec.add.price;
  if (price === undefined || player.stock.get(price.resource) >= price.amount) {
    return undefined;
  }
  return STOCK_PRICE_REASON[price.resource]();
}

/** Why B cannot be taken now — ONE reason, in check order (the card's resource, the voting area, the reserve). */
export function censusVoteReason(player: IPlayer, card: ICard, spec: CensusSpec): UnplayableReason | undefined {
  if (card.resourceCount < spec.votePrice) {
    return {type: 'count', message: spec.shortReason, params: [String(card.resourceCount)], current: card.resourceCount};
  }
  const parliament = player.game.parliament;
  if (parliament === undefined || parliament.partiesInVotingArea().length === 0) {
    return {type: 'party', message: POLITICAL_DONATION_NO_RESOLUTION_REASON};
  }
  if (parliament.reserve(player) < 1) {
    return {type: 'party', message: POLITICAL_DONATION_NO_DELEGATE_REASON, current: 0};
  }
  return undefined;
}

/** `canAct` ⇔ at least one variant is live (a free A keeps it always true — the data censuses). */
export function censusCanAct(player: IPlayer, card: ICard, spec: CensusSpec): boolean {
  return censusAddReason(player, spec) === undefined || censusVoteReason(player, card, spec) === undefined;
}

/**
 * Both variants dead → the one blocker the player can act on (the TR66 rule).
 * With nothing on the card the vote was never on the table, so A's price is
 * what is missing; with the price in hand the player HAS the means, and what
 * matters is what closed the vote. `undefined` while the action is live.
 */
export function censusUnavailableReason(player: IPlayer, card: ICard, spec: CensusSpec): UnplayableReason | undefined {
  if (censusCanAct(player, card, spec)) {
    return undefined;
  }
  if (card.resourceCount < spec.votePrice) {
    return censusAddReason(player, spec);
  }
  return censusVoteReason(player, card, spec);
}

/**
 * The action itself (the card's `action()`): A when its price is covered (or
 * free), B when its reason is clear. One live option is the whole action — its
 * callback runs at once (the batch replay folds it, `reconcileBatchResponse`);
 * two are an `OrOptions` marked with the card as its giver; none — nothing
 * (`canAct` already said so).
 */
export function censusAction(player: IPlayer, card: ICard, spec: CensusSpec): PlayerInput | undefined {
  const options: Array<SelectOption> = [];
  if (censusAddReason(player, spec) === undefined) {
    options.push(new SelectOption(spec.addTitle, 'Add resource').andThen(() => {
      // The price leaves first, the resource arrives after — both on the event recorder, under the card's source.
      const price = spec.add.price;
      if (price !== undefined) {
        player.stock.deduct(price.resource, price.amount, {log: true, from: {card: card.name}});
      }
      player.addResourceTo(card, {qty: spec.add.amount, log: true});
      return undefined;
    }));
  }
  if (censusVoteReason(player, card, spec) === undefined) {
    options.push(new SelectOption(spec.voteTitle, 'Spend').andThen(() => {
      // The resources are NOT spent here: they are the grant's price, paid in its answer with the cube.
      player.game.defer(censusGrant(player, card, spec));
      return undefined;
    }));
  }
  if (options.length === 0) {
    return undefined;
  }
  if (options.length === 1) {
    return options[0].cb(undefined);
  }
  return new OrOptions(...options).markChoiceContext(effectChoice(card));
}

/**
 * The action's read-only preview: two branches in the order `censusAction`
 * pushes its options. A carries its stock price (when it has one) and the
 * gain on the card; B carries the price leaving the card, the delegate
 * leaving the reserve and the DOOR — the resolution is chosen in the
 * Parliament (`delegateGrantStep` asks the very grant the action defers), so
 * the console stages the vote and A in the vote mode is the action's one POST.
 */
export function censusActionPreview(player: IPlayer, card: ICard, spec: CensusSpec): ActionPreview {
  const addReason = censusAddReason(player, spec);
  const voteReason = censusVoteReason(player, card, spec);
  const price = spec.add.price;
  return actionPreviews.orBranches(card, [
    {
      available: addReason === undefined,
      title: spec.addTitle,
      effects: [
        ...(price === undefined ? [] : [actionPreviews.stockCost(player, price.resource, price.amount)]),
        actionPreviews.cardGain(card, spec.add.amount),
      ],
      unavailableReason: addReason,
    },
    {
      available: voteReason === undefined,
      title: spec.voteTitle,
      effects: [actionPreviews.cardCost(card, spec.votePrice), actionPreviews.delegateFromReserve(player, 1)],
      steps: voteReason === undefined ? [actionPreviews.delegateGrantStep(card, censusGrant(player, card, spec))] : [],
      unavailableReason: voteReason,
    },
  ]);
}
