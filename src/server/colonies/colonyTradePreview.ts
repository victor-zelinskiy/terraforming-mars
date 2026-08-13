import {MAX_COLONIES_PER_TILE, MAX_COLONY_TRACK_POSITION} from '../../common/constants';
import {CardName} from '../../common/cards/CardName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {GlobalParameter} from '../../common/GlobalParameter';
import {Tag} from '../../common/cards/Tag';
import {CardResource} from '../../common/CardResource';
import {
  ColonyTradeFollowUpModel,
  ColonyTradeFollowUpRole,
  ColonyTradeNoteKind,
  ColonyTradePreviewModel,
} from '../../common/models/ColonyTradePreviewModel';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {SelectPaymentDeferred} from '../deferredActions/SelectPaymentDeferred';
import {StealResources} from '../deferredActions/StealResources';
import {TradeWithMegacredits} from '../player/Colonies';
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
export function buildColonyTradePreview(player: IPlayer, colony: IColony): ColonyTradePreviewModel {
  const metadata = colony.metadata;

  // ── Track advance — mirrors Colony.trade() exactly. ───────────────────────
  const tradeOffset = player.colonies.tradeOffset;
  const maxPossibleTrackPosition = Math.min(colony.trackPosition + tradeOffset, MAX_COLONY_TRACK_POSITION);
  const steps = maxPossibleTrackPosition - colony.trackPosition;

  let effective = colony.trackPosition;
  let willAsk = false;
  if (steps === 0 || metadata.shouldIncreaseTrack === 'no') {
    // No advance — the reward is read at the current position.
  } else if (metadata.shouldIncreaseTrack === 'yes' ||
      (metadata.trade.resource !== undefined &&
        metadata.trade.resource[colony.trackPosition] === metadata.trade.resource[maxPossibleTrackPosition])) {
    effective = maxPossibleTrackPosition;
  } else {
    // The server will ASK (IncreaseColonyTrack); default preview = max steps.
    willAsk = true;
    effective = maxPossibleTrackPosition;
  }

  const followUps: Array<ColonyTradeFollowUpModel> = [];
  if (willAsk) {
    followUps.push({kind: 'trackChoice', steps});
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

  // ── The trade reward itself, read at the effective track position. ────────
  const rewardQuantity = metadata.trade.quantity[effective] ?? 0;
  const rewardFollowUp = benefitFollowUp(player, colony, 'tradeReward', metadata.trade.type, rewardQuantity);
  if (rewardFollowUp !== undefined) {
    followUps.push(rewardFollowUp);
  }

  // ── The M€ path's payment prompt (undefined = M€ auto-pays). ──────────────
  const mcTrader = new TradeWithMegacredits(player);
  const megacreditsPayment = mcTrader.canUse() ?
    new SelectPaymentDeferred(player, mcTrader.cost,
      {title: message('Select how to pay ${0} for colony trade', (b) => b.number(mcTrader.cost))})
      .previewPaymentModel() :
    undefined;

  // ── Flat every-trade card modifiers (mirrors Colony.handleTrade). ─────────
  const flatBonuses: Array<{card: CardName, resource: string, amount: number}> = [];
  if (player.tableau.has(CardName.VENUS_TRADE_HUB)) {
    flatBonuses.push({card: CardName.VENUS_TRADE_HUB, resource: 'megacredits', amount: 3});
  }

  // ── What BUILDING here would ask this player (the NEXT free slot's
  //    placement bonus). Same shape as a trade follow-up, so the console
  //    pre-collects it with the SAME step and answers it in the SAME batch —
  //    a Titan build stops dropping «выберите карту» after the cube landed.
  const buildFollowUps = buildBonusFollowUps(player, colony);

  return {
    colonyName: colony.name,
    track: {current: colony.trackPosition, effective, steps, willAsk},
    rewardQuantity,
    ...(megacreditsPayment !== undefined ? {megacreditsPayment} : {}),
    followUps,
    ...(buildFollowUps.length > 0 ? {buildFollowUps} : {}),
    ...(flatBonuses.length > 0 ? {flatBonuses} : {}),
  };
}

/**
 * The follow-ups a NEW SETTLEMENT here would raise for this player — read at
 * the slot the cube would take (`Colony.addColony` → `giveBonus(build.type,
 * build.quantity[colonies.length])`, mirrored exactly).
 *
 * Empty for a full colony (nothing can be built) and for every bonus that
 * resolves without asking. It does NOT include the trade's own follow-ups:
 * building is not trading, and mixing the two lists is how a build would
 * answer a prompt the server never raised.
 */
function buildBonusFollowUps(player: IPlayer, colony: IColony): Array<ColonyTradeFollowUpModel> {
  const slot = colony.colonies.length;
  if (slot >= MAX_COLONIES_PER_TILE) {
    return [];
  }
  const build = colony.metadata.build;
  const followUp = benefitFollowUp(player, colony, 'buildBonus', build.type, build.quantity[slot] ?? 0);
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
    return cardTargetFollowUp(player, role, colony.metadata.cardResource, quantity);

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
  resource: CardResource | undefined,
  amount: number,
  restrictedTag?: Tag,
): ColonyTradeFollowUpModel {
  const action = new AddResourcesToCard(player, resource, {
    count: amount,
    ...(restrictedTag !== undefined ? {
      restrictedTag,
      title: message('Select Venus card to add ${0} resource(s)', (b) => b.number(amount)),
    } : {}),
  });
  const cards = action.getCards();
  if (cards.length === 0) {
    return {kind: 'cardTarget', role, resource, amount, lost: true};
  }
  if (cards.length === 1) {
    return {kind: 'cardTarget', role, resource, amount, auto: cards[0].name, lost: false};
  }
  return {kind: 'cardTarget', role, resource, amount, pick: action.previewSelectCard(), lost: false};
}
