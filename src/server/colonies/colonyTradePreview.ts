import {CardName} from '../../common/cards/CardName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {buildBenefitAt, tradeBenefitAt, colonyCardResources} from '../../common/colonies/ColonyMetadata';
import {GlobalParameter} from '../../common/GlobalParameter';
import {Tag} from '../../common/cards/Tag';
import {CardResource} from '../../common/CardResource';
import {
  ColonyTradeFollowUpModel,
  ColonyTradeFollowUpRole,
  ColonyTradeNoteKind,
  ColonyTradePreviewModel,
  FleetDockPreviewModel,
  TradePaymentPreviewModel,
} from '../../common/models/ColonyTradePreviewModel';
import {FleetDockCard, fleetDockBlockedReason} from './FleetDock';
import {tradeFlatBonuses} from './tradePerformed';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {SelectPaymentDeferred} from '../deferredActions/SelectPaymentDeferred';
import {StealResources} from '../deferredActions/StealResources';
import {TradeWithEnergy, TradeWithMegacredits} from '../player/Colonies';
import {DeltaWorks} from '../cards/delta/DeltaWorks';
import {IPlayer} from '../IPlayer';
import {IColony} from './IColony';
import {message} from '../logs/MessageBuilder';

/**
 * READ-ONLY preview of trading with `colony` for `player` — the shared brain
 * behind the desktop trade modal and the console trade composer. It NEVER
 * mutates game state and NEVER re-implements rules: the track math mirrors
 * `Colony.trade`, the card-target candidates come from the REAL
 * `AddResourcesToCard` deferred (`getCards`/`previewSelectCard`), the M€
 * payment prompt from the REAL `SelectPaymentDeferred.previewPaymentModel`,
 * and the steal prompt predicate from `StealResources.previewOptions`.
 *
 * `followUps` lists the trading player's OWN post-submit prompts in live
 * deferred-queue order (guarded by tests/colonies/colonyTradePreview.spec.ts):
 *   [M€ payment — separate field] → trackChoice → own colony bonuses → trade reward.
 * (`GiveColonyBonus` defers at Priority.DEFAULT, the reward's
 * `AddResourcesToCard` at GAIN_RESOURCE_OR_PRODUCTION — so a player's own
 * colony-bonus pick prompts BEFORE the trade-reward pick.)
 */
export function buildColonyTradePreview(player: IPlayer, colony: IColony, pathOffset = 0): ColonyTradePreviewModel {
  const metadata = colony.metadata;

  // ── Track advance — THE SAME PLAN Colony.trade() executes (its reach, its
  //    refusals, its ask decision), read here without moving anything. The
  //    default preview = the farthest legal step, judged with the cheapest M€
  //    fee any usable path takes (the Redux Venus's «extra 4 M€» is over the
  //    fee). `pathOffset` is the CHOSEN payment path's own reach (the Unity
  //    action's «advance 1 step first» — `OptionMetadata.tradeOffset`): the
  //    stage re-asks with it, so the marker, the reward and the track-choice
  //    step it pre-collects all describe the trade that path will make. ─────
  const plan = colony.tradeTrackPlan(player, {feeMegacredits: player.colonies.bestTradeTerms().feeMegacredits, bonusTradeOffset: pathOffset});
  const steps = plan.steps;
  const effective = plan.current + steps;
  const willAsk = plan.ask;

  const followUps: Array<ColonyTradeFollowUpModel> = [];
  if (willAsk) {
    followUps.push({kind: 'trackChoice', steps, minSteps: plan.minSteps});
  }

  // ── The player's OWN colony bonuses on this tile (GiveColonyBonus prompts
  //    the trading player once per own colony, BEFORE the reward pick). A
  //    Each cube is its own step — the rules resolve them one at a time. ─────
  const ownColonies = colony.colonies.filter((id) => id === player.id).length;
  for (let i = 0; i < ownColonies; i++) {
    const followUp = benefitFollowUp(player, colony, 'colonyBonus', metadata.colony.type, metadata.colony.quantity ?? 1);
    if (followUp !== undefined) {
      followUps.push(followUp);
    }
  }

  // ── The trade reward itself, read at the effective track position — kind,
  //    amount and resource resolved together (the Redux Pluto's data → cards). ─
  const reward = tradeBenefitAt(metadata, effective);
  const rewardQuantity = reward.quantity;
  const rewardFollowUp = benefitFollowUp(player, colony, 'tradeReward', reward.type, rewardQuantity);
  if (rewardFollowUp !== undefined) {
    followUps.push(rewardFollowUp);
  }

  // ── What the FEE will ask (the M€ path's payment prompt, the energy path's
  //    Delta Works mix) — the part every destination of a trade shares. ──────
  const payment = tradePaymentPreview(player);

  // ── Flat every-trade card modifiers — the very list the trade pays
  //    (`tradePerformed.ts`). ─────────────────────────────────────────────────
  const flatBonuses = flatBonusModels(player);

  // ── What BUILDING here would ask this player (the NEXT free slot's
  //    placement bonus). Same shape as a trade follow-up, so the console
  //    pre-collects it with the SAME step and answers it in the SAME batch —
  //    a Titan build stops dropping «выберите карту» after the cube landed.
  const buildFollowUps = buildBonusFollowUps(player, colony);

  return {
    colonyName: colony.name,
    track: {current: colony.trackPosition, effective, steps, willAsk},
    rewardQuantity,
    ...payment,
    followUps,
    ...(buildFollowUps.length > 0 ? {buildFollowUps} : {}),
    ...(flatBonuses.length > 0 ? {flatBonuses} : {}),
  };
}

/**
 * READ-ONLY preview of a trade whose destination is a fleet-dock CARD
 * (`FleetDock.ts`) — the dock twin of `buildColonyTradePreview`: the same
 * payment part (one builder), the dock's own verdict, and the reward exactly
 * as the card's co-located contract states it (`previewEffects` /
 * `previewFollowUps`). Nothing here re-states a rule and nothing mutates.
 */
export function buildFleetDockPreview(player: IPlayer, card: FleetDockCard): FleetDockPreviewModel {
  const reason = fleetDockBlockedReason(player, card);
  const flatBonuses = flatBonusModels(player);
  return {
    card: card.name,
    available: reason === undefined,
    ...(reason !== undefined ? {reason} : {}),
    ...tradePaymentPreview(player),
    effects: card.fleetDock.previewEffects(player),
    followUps: card.fleetDock.previewFollowUps?.(player) ?? [],
    ...(flatBonuses.length > 0 ? {flatBonuses} : {}),
  };
}

/**
 * WHAT THE FEE OF A TRADE WILL ASK — destination-independent (a path takes the
 * same fee whatever it trades with), so the colony preview and the dock
 * preview both read it here and cannot drift:
 *  · the M€ path's payment prompt (`undefined` = M€ auto-pays), from the REAL
 *    `SelectPaymentDeferred.previewPaymentModel`;
 *  · the ENERGY path's source mix (Delta Works: 1 steel = 1 energy) — mirrors
 *    `TradeWithEnergy.trade` exactly: min = the energy deficit, max =
 *    min(stock, cost); min < max is when the server will ASK.
 */
export function tradePaymentPreview(player: IPlayer): TradePaymentPreviewModel {
  const mcTrader = new TradeWithMegacredits(player);
  const megacreditsPayment = mcTrader.canUse() ?
    new SelectPaymentDeferred(player, mcTrader.cost,
      {title: message('Select how to pay ${0} for colony trade', (b) => b.number(mcTrader.cost))})
      .previewPaymentModel() :
    undefined;

  const steelSubstitute = DeltaWorks.steelSubstituteAvailable(player);
  const energyTrader = new TradeWithEnergy(player);
  const energyMix = steelSubstitute > 0 ? {
    cost: energyTrader.cost,
    energyAvailable: player.energy,
    steelAvailable: steelSubstitute,
    minSteel: Math.max(0, energyTrader.cost - player.energy),
    maxSteel: Math.min(steelSubstitute, energyTrader.cost),
    card: CardName.DELTA_WORKS,
  } : undefined;

  return {
    ...(megacreditsPayment !== undefined ? {megacreditsPayment} : {}),
    ...(energyMix !== undefined ? {energyMix} : {}),
  };
}

/** The flat every-trade bonuses in the previews' wire form (the resource as its icon key). */
function flatBonusModels(player: IPlayer): Array<{card: CardName, resource: string, amount: number}> {
  return tradeFlatBonuses(player).map((bonus) => ({card: bonus.card, resource: bonus.resource, amount: bonus.amount}));
}

/**
 * The follow-ups a NEW SETTLEMENT here would raise for this player — read at
 * the berth the cube would take, through the ONE reading `Colony.addColony`
 * pays by (`buildBenefitAt(metadata, colonies.length)`).
 *
 * WHO may build is the DOOR's question (`Colonies.buildBlockedReason`), never
 * this preview's: a tile at its printed limit still answers what the NEXT
 * cube would ask, because a door may lift that limit (Turmoil Redux TR25
 * Exclusive Colony) and its stage pre-collects the bonus's target from here.
 * Empty only where NO door builds — the track has no cell left for a cube —
 * and for every bonus that resolves without asking. It does NOT include the
 * trade's own follow-ups: building is not trading, and mixing the two lists
 * is how a build would answer a prompt the server never raised.
 */
function buildBonusFollowUps(player: IPlayer, colony: IColony): Array<ColonyTradeFollowUpModel> {
  if (!colony.hasFreeTrackCell()) {
    return [];
  }
  const build = buildBenefitAt(colony.metadata, colony.colonies.length);
  const followUp = benefitFollowUp(player, colony, 'buildBonus', build.type, build.quantity);
  return followUp !== undefined ? [followUp] : [];
}

/**
 * Map one colony benefit to the follow-up prompt it raises for the trading
 * player — or undefined when it resolves automatically (plain gains, VP, TR,
 * production, …). Mirrors `Colony.giveBonusImpl`'s interactive branches.
 */
function benefitFollowUp(
  player: IPlayer,
  colony: IColony,
  role: ColonyTradeFollowUpRole,
  type: ColonyBenefit,
  quantity: number,
): ColonyTradeFollowUpModel | undefined {
  const game = player.game;
  switch (type) {
  case ColonyBenefit.ADD_RESOURCES_TO_CARD:
    return cardTargetFollowUp(player, role, colonyCardResources(colony.metadata), quantity);

  case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD:
    return cardTargetFollowUp(player, role, undefined, quantity, Tag.VENUS);

  case ColonyBenefit.STEAL_RESOURCES: {
    const resource = colony.metadata.trade.resource;
    if (resource === undefined || Array.isArray(resource)) {
      return note(role, 'steal');
    }
    // The live prompt only appears when a steal target exists (solo auto-gains).
    const preview = new StealResources(player, resource, quantity).previewOptions();
    return preview !== undefined ? note(role, 'steal') : undefined;
  }

  case ColonyBenefit.OPPONENT_DISCARD:
    if (game.isSoloMode() || !game.players.some((p) => p.cardsInHand.length > 0)) {
      return undefined;
    }
    return note(role, 'opponentDiscard');

  case ColonyBenefit.DRAW_CARDS_AND_KEEP_ONE:
    return note(role, 'drawAndKeep');

  case ColonyBenefit.DRAW_CARDS_AND_BUY_ONE:
    return note(role, 'drawAndBuy');

  case ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE:
    return note(role, 'drawAndKeep');

  case ColonyBenefit.COPY_TRADE:
    return note(role, 'copyTrade');

  case ColonyBenefit.PLACE_OCEAN_TILE:
    return note(role, 'placeOcean');

  case ColonyBenefit.PLACE_DELEGATES:
    return note(role, 'placeDelegates');

  case ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION:
    // Turmoil Redux: the Parliament's own step opens after the confirm (the
    // vote, hosted inside the colony workspace) — never pre-collected.
    return note(role, 'placeDelegatesOnResolution');

  case ColonyBenefit.PLACE_HAZARD_TILE:
    return note(role, 'placeHazard');

  case ColonyBenefit.WGT_RAISE_GLOBAL_PARAMETER:
    // Only the oceans branch prompts (a SelectSpace); temperature/oxygen apply directly.
    return [GlobalParameter.TEMPERATURE, GlobalParameter.OXYGEN, GlobalParameter.OCEANS][quantity] === GlobalParameter.OCEANS ?
      note(role, 'wgt') :
      undefined;

  default:
    return undefined;
  }
}

function note(role: ColonyTradeFollowUpRole, kind: ColonyTradeNoteKind): ColonyTradeFollowUpModel {
  return {kind: 'note', role, note: kind};
}

/**
 * The card-target follow-up for an "add N resources to a card" benefit —
 * built from the REAL `AddResourcesToCard` deferred so the candidate set (and
 * the ≥2-candidates → live-SelectCard rule) can never drift from the live path.
 */
function cardTargetFollowUp(
  player: IPlayer,
  role: ColonyTradeFollowUpRole,
  /** The kinds the benefit adds — the tile's list (`colonyCardResources`), or undefined for «any resource». */
  kinds: ReadonlyArray<CardResource> | undefined,
  amount: number,
  restrictedTag?: Tag,
): ColonyTradeFollowUpModel {
  // The deferred takes the ONE kind for a list of one (the ordinary pick,
  // byte-identical for every one-kind tile), the list for several (the
  // holders of ANY — the Redux Vesta), `undefined` for any resource.
  const arg = kinds === undefined || kinds.length === 0 ? undefined : (kinds.length === 1 ? kinds[0] : kinds);
  const action = new AddResourcesToCard(player, arg, {
    count: amount,
    ...(restrictedTag !== undefined ? {
      restrictedTag,
      title: message('Select Venus card to add ${0} resource(s)', (b) => b.number(amount)),
    } : {}),
  });
  const resource = action.resourceType;
  const several = kinds !== undefined && kinds.length > 1 ? {resources: kinds} : {};
  const cards = action.getCards();
  if (cards.length === 0) {
    return {kind: 'cardTarget', role, resource, ...several, amount, lost: true};
  }
  if (cards.length === 1) {
    return {kind: 'cardTarget', role, resource, ...several, amount, auto: cards[0].name, lost: false};
  }
  return {kind: 'cardTarget', role, resource, ...several, amount, pick: action.previewSelectCard(), lost: false};
}
