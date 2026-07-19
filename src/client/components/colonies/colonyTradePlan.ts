/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
/*
 * COLONY TRADE PLAN — the PURE shared brain behind the colony-trade confirm
 * surfaces (the desktop ColonyTradePaymentModal and the console trade
 * composer). It turns the server-authoritative ColonyTradePreviewModel
 * (`/api/game/colony-trade-preview`) + the colony manifest metadata into:
 *
 *   - `tradeSteps`      — the interactive PRE-COLLECT steps, in live prompt
 *                         order (payment → track choice → card targets);
 *   - `tradeNotices`    — display-only lines (auto targets, lost resources,
 *                         "after confirming" notes);
 *   - `buildTradeBatch` — the ONE ordered response array for
 *                         `PlayerInputBatch`, byte-identical to answering the
 *                         live prompts one at a time. The array is truncated
 *                         at the first uncaptured step (graceful fallback —
 *                         the leftover prompt arrives live, nothing breaks).
 *
 * No Vue / DOM / i18n — unit-tested under the server mocha runner
 * (tests/client/components/colonies/colonyTradePlan.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Payment} from '@/common/inputs/Payment';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {SelectCardModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';

// ── Interactive pre-collect steps ────────────────────────────────────────────

export type TradeStep =
  | {kind: 'payment', model: SelectPaymentModel}
  | {kind: 'trackChoice', steps: number}
  | {
      kind: 'cardTarget',
      role: 'tradeReward' | 'colonyBonus',
      resource: string | undefined,
      amount: number,
      pick: SelectCardModel,
    };

/**
 * The interactive steps the confirm surface must collect BEFORE submitting,
 * in live prompt order. `useMegacredits` = the player picked the M€ payment
 * path (the only path whose payment can itself prompt).
 */
export function tradeSteps(preview: ColonyTradePreviewModel | undefined, useMegacredits: boolean): Array<TradeStep> {
  if (preview === undefined) {
    return [];
  }
  const steps: Array<TradeStep> = [];
  if (useMegacredits && preview.megacreditsPayment !== undefined) {
    steps.push({kind: 'payment', model: preview.megacreditsPayment});
  }
  for (const followUp of preview.followUps) {
    if (followUp.kind === 'trackChoice') {
      steps.push({kind: 'trackChoice', steps: followUp.steps});
    } else if (followUp.kind === 'cardTarget' && followUp.pick !== undefined) {
      steps.push({
        kind: 'cardTarget',
        role: followUp.role,
        resource: followUp.resource,
        amount: followUp.amount,
        pick: followUp.pick,
      });
    }
  }
  return steps;
}

// ── Display-only notices ─────────────────────────────────────────────────────

export type TradeNotice =
  | {kind: 'autoTarget', role: 'tradeReward' | 'colonyBonus', resource: string | undefined, amount: number, card: CardName}
  | {kind: 'lostResource', role: 'tradeReward' | 'colonyBonus', resource: string | undefined, amount: number}
  | {kind: 'afterConfirm', note: string};

/** English i18n keys for the "after confirming" note kinds. */
const NOTE_TEXT: Record<string, string> = {
  steal: 'After confirming: choose who to steal from',
  opponentDiscard: 'After confirming: choose a player to discard a card',
  drawAndKeep: 'After confirming: choose which drawn card to keep',
  drawAndBuy: 'After confirming: you may buy the drawn card',
  copyTrade: 'After confirming: choose a colony to copy its trade income',
  placeOcean: 'After confirming: place an ocean tile',
  placeDelegates: 'After confirming: place delegates',
  placeHazard: 'After confirming: place a hazard tile',
  wgt: 'After confirming: place an ocean tile',
};

/**
 * Display-only outcomes of the trade the player can't (or needn't) decide:
 * the explicit single-candidate auto target, the honest "resource is lost"
 * warning, and the "after confirming" follow-ups the modal can't pre-collect.
 */
export function tradeNotices(preview: ColonyTradePreviewModel | undefined): Array<TradeNotice> {
  if (preview === undefined) {
    return [];
  }
  const notices: Array<TradeNotice> = [];
  for (const followUp of preview.followUps) {
    if (followUp.kind === 'cardTarget') {
      if (followUp.lost) {
        notices.push({kind: 'lostResource', role: followUp.role, resource: followUp.resource, amount: followUp.amount});
      } else if (followUp.auto !== undefined) {
        notices.push({kind: 'autoTarget', role: followUp.role, resource: followUp.resource, amount: followUp.amount, card: followUp.auto});
      }
    } else if (followUp.kind === 'note') {
      notices.push({kind: 'afterConfirm', note: NOTE_TEXT[followUp.note] ?? NOTE_TEXT.steal});
    }
  }
  return notices;
}

// ── Batch responses ──────────────────────────────────────────────────────────

/** The response answering one collected TradeStep. */
export function stepResponse(step: TradeStep, capture: unknown): InputResponse | undefined {
  switch (step.kind) {
  case 'payment':
    return capture === undefined ? undefined : {type: 'payment', payment: capture as Payment};
  case 'trackChoice':
    return capture === undefined ? undefined : trackChoiceResponse(step.steps, capture as number);
  case 'cardTarget':
    return capture === undefined ? undefined : {type: 'card', cards: [capture as CardName]};
  default:
    return undefined;
  }
}

/**
 * The IncreaseColonyTrack OrOptions lists its options as
 * [steps, steps-1, …, 1, "Don't increase"] — chosen advance N maps to index
 * `steps - N`, and 0 ("don't") to the last index (`steps`).
 */
export function trackChoiceResponse(steps: number, chosen: number): InputResponse {
  const index = chosen > 0 ? steps - chosen : steps;
  return {type: 'or', index, response: {type: 'option'}};
}

export type TradeBatchArgs = {
  /** OR indices from the action-menu root to the trade AndOptions. */
  tradePath: ReadonlyArray<number>;
  /** The chosen index within the inner "Pay trade fee" OrOptions. */
  paymentIndex: number;
  colonyName: ColonyName;
  /** The interactive steps, in `tradeSteps` order. */
  steps: ReadonlyArray<TradeStep>;
  /** Captured values by step index (payment: Payment, trackChoice: number, cardTarget: CardName). */
  captures: Readonly<Record<number, unknown>>;
};

/**
 * The ONE ordered response array for PlayerInputBatch: the wrapped trade
 * AndOptions response, then each collected step's response in live prompt
 * order. Truncates at the first uncaptured step — the pre-collected answers
 * BEFORE the gap still apply; everything after it arrives as live prompts
 * (never out of order, never guessed).
 */
export function buildTradeBatch(args: TradeBatchArgs): Array<InputResponse> {
  let trade: InputResponse = {
    type: 'and',
    responses: [
      {type: 'or', index: args.paymentIndex, response: {type: 'option'}},
      {type: 'colony', colonyName: args.colonyName},
    ],
  };
  for (let i = args.tradePath.length - 1; i >= 0; i--) {
    trade = {type: 'or', index: args.tradePath[i], response: trade};
  }
  const responses: Array<InputResponse> = [trade];
  for (let i = 0; i < args.steps.length; i++) {
    const response = stepResponse(args.steps[i], args.captures[i]);
    if (response === undefined) {
      break;
    }
    responses.push(response);
  }
  return responses;
}

/** True when every interactive step has a captured answer. */
export function allStepsCaptured(steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>): boolean {
  return steps.every((_, i) => captures[i] !== undefined);
}

// ── Shared read helpers (tiles / panels / inspect) ───────────────────────────

export type TradeRewardAt = {
  type: ColonyMetadata['trade']['type'];
  quantity: number;
  /** The standard resource granted (single or per-position array resolved). */
  resource: string | undefined;
  /** The card resource added (Enceladus microbes, Titan floaters, …). */
  cardResource: string | undefined;
};

/** The trade reward at one track position, straight from the manifest. */
export function rewardAtPosition(metadata: ColonyMetadata, position: number): TradeRewardAt {
  const pos = Math.min(Math.max(position, 0), metadata.trade.quantity.length - 1);
  const raw = metadata.trade.resource;
  const resource = Array.isArray(raw) ? raw[pos] : raw;
  return {
    type: metadata.trade.type,
    quantity: metadata.trade.quantity[pos] ?? 0,
    resource: typeof resource === 'string' ? resource : undefined,
    cardResource: metadata.cardResource,
  };
}

/**
 * The track position a trade would read its reward at RIGHT NOW for a player
 * with `tradeOffset` — mirrors `Colony.trade`'s auto-advance (an `ask` colony
 * previews at max advance, matching the server preview's default).
 */
export function effectiveTradePosition(colony: ColonyModel, metadata: ColonyMetadata, tradeOffset: number): number {
  const max = metadata.trade.quantity.length - 1;
  const target = Math.min(colony.trackPosition + Math.max(0, tradeOffset), max);
  if (metadata.shouldIncreaseTrack === 'no') {
    return Math.min(colony.trackPosition, max);
  }
  return target;
}

/** Free trade fleets = the player's fleet size minus the fleets already out. */
export function freeTradeFleets(player: {fleetSize: number, tradesThisGeneration: number}): number {
  return Math.max(0, player.fleetSize - player.tradesThisGeneration);
}

// ── The trade outcome ("Итог торговли") ──────────────────────────────────────

/**
 * One outcome line — shape-compatible with `ActionEffect` where an icon
 * exists (`ActionEffectChip` renders it); `label` lines cover the benefits
 * with no sprite (VP / influence / card discount / science tag).
 */
export type TradeOutcomeChip = {
  direction: 'cost' | 'gain';
  icon?: string;
  label?: string;
  amount: number;
  current?: number;
  resulting?: number;
  /** The gain is production, not stock (drawn in a production frame). */
  production?: boolean;
  /** English i18n note under the value ('to a card', 'stolen', …). */
  note?: string;
};

export type TradeOutcomeArgs = {
  metadata: ColonyMetadata;
  /** The reward track position the trade will read (track choice applied). */
  rewardPosition: number;
  /** The chosen payment's resource summary (undefined = a card-based trader). */
  payment: {icon: string, amount: number} | undefined;
  /** The viewer's own colonies on this tile (each yields the colony bonus). */
  ownColonyCount: number;
  /** The viewer's live stocks, for `current → resulting` on standard gains. */
  stocks: Readonly<Partial<Record<string, number>>>;
  /** The viewer's live production, for production gains. */
  production: Readonly<Partial<Record<string, number>>>;
  /** Flat every-trade card modifiers (Venus Trade Hub +3 M€) from the preview. */
  flatBonuses?: ReadonlyArray<{card: string, resource: string, amount: number}>;
};

/**
 * The standard (auto-resolving) money/resource lines of the trade — the
 * payment, the trade reward and the viewer's own colony bonuses — as
 * `current → resulting` chips computed in SEQUENCE (payment first, then
 * gains), so paying 3 energy into a 4-energy reward reads honestly
 * (3 → 0, then 0 → 4). Card-target rewards are rendered by the composer's
 * own target rows (they carry the per-card before → after) — here they only
 * appear as icon+note chips when NO explicit target row will show.
 */
export function tradeOutcome(args: TradeOutcomeArgs): {cost: Array<TradeOutcomeChip>, gains: Array<TradeOutcomeChip>} {
  const cost: Array<TradeOutcomeChip> = [];
  const gains: Array<TradeOutcomeChip> = [];
  // Track the viewer's stocks through the sequence (payment → gains).
  const running: Partial<Record<string, number>> = {...args.stocks};

  if (args.payment !== undefined) {
    const current = running[args.payment.icon];
    const resulting = current !== undefined ? Math.max(0, current - args.payment.amount) : undefined;
    cost.push({direction: 'cost', icon: args.payment.icon, amount: args.payment.amount, current, resulting});
    if (resulting !== undefined) {
      running[args.payment.icon] = resulting;
    }
  }

  const pushBenefit = (type: ColonyBenefit, quantity: number, resource: string | undefined, note?: string) => {
    if (quantity <= 0 && type !== ColonyBenefit.GAIN_CARD_DISCOUNT) {
      return;
    }
    switch (type) {
    case ColonyBenefit.GAIN_RESOURCES: {
      if (resource === undefined) {
        return;
      }
      const current = running[resource];
      const resulting = current !== undefined ? current + quantity : undefined;
      gains.push({direction: 'gain', icon: resource, amount: quantity, current, resulting, note});
      if (resulting !== undefined) {
        running[resource] = resulting;
      }
      return;
    }
    case ColonyBenefit.GAIN_PRODUCTION: {
      if (resource === undefined) {
        return;
      }
      const current = args.production[resource];
      gains.push({
        direction: 'gain', icon: resource, amount: quantity, production: true,
        current, resulting: current !== undefined ? current + quantity : undefined, note,
      });
      return;
    }
    case ColonyBenefit.LOSE_RESOURCES: {
      if (resource === undefined) {
        return;
      }
      const current = running[resource];
      const lost = current !== undefined ? Math.min(current, quantity) : quantity;
      cost.push({
        direction: 'cost', icon: resource, amount: lost,
        current, resulting: current !== undefined ? Math.max(0, current - lost) : undefined, note,
      });
      if (current !== undefined) {
        running[resource] = Math.max(0, current - lost);
      }
      return;
    }
    case ColonyBenefit.ADD_RESOURCES_TO_CARD:
      gains.push({direction: 'gain', icon: args.metadata.cardResource?.toString().toLowerCase().replace(/ /g, '-'), amount: quantity, note: note ?? 'to a card'});
      return;
    case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD:
      gains.push({direction: 'gain', label: 'Resources to a Venus card', amount: quantity, note});
      return;
    case ColonyBenefit.STEAL_RESOURCES:
      if (resource !== undefined) {
        gains.push({direction: 'gain', icon: resource, amount: quantity, note: 'stolen'});
      }
      return;
    case ColonyBenefit.DRAW_CARDS:
    case ColonyBenefit.DRAW_CARDS_AND_KEEP_ONE:
    case ColonyBenefit.DRAW_CARDS_AND_BUY_ONE:
    case ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE:
    case ColonyBenefit.DRAW_EARTH_CARD:
      gains.push({direction: 'gain', icon: 'cards', amount: quantity, note});
      return;
    case ColonyBenefit.GAIN_TR:
      gains.push({direction: 'gain', icon: 'tr', amount: quantity, note});
      return;
    case ColonyBenefit.INCREASE_VENUS_SCALE:
      gains.push({direction: 'gain', icon: 'venus', amount: quantity, note});
      return;
    case ColonyBenefit.GAIN_VP:
      gains.push({direction: 'gain', label: 'VP', amount: quantity, note});
      return;
    case ColonyBenefit.GAIN_INFLUENCE:
      gains.push({direction: 'gain', label: 'Influence', amount: Math.max(1, quantity), note});
      return;
    case ColonyBenefit.GAIN_CARD_DISCOUNT:
      gains.push({direction: 'gain', label: 'Card discount this generation', amount: 1, note});
      return;
    case ColonyBenefit.GAIN_SCIENCE_TAG:
    case ColonyBenefit.GAIN_SCIENCE_TAGS_AND_CLONE_TAG:
      gains.push({direction: 'gain', label: 'Science tag', amount: type === ColonyBenefit.GAIN_SCIENCE_TAGS_AND_CLONE_TAG ? 2 : 1, note});
      return;
    default:
      // Board / turmoil follow-ups (ocean, delegates, hazards, WGT) surface
      // as "after confirming" notices — no chip here.
      return;
    }
  };

  const reward = rewardAtPosition(args.metadata, args.rewardPosition);
  pushBenefit(reward.type, reward.quantity, reward.resource);

  const colonyBonus = args.metadata.colony;
  const bonusResource = Array.isArray(colonyBonus.resource) ? colonyBonus.resource[0] : colonyBonus.resource;
  for (let i = 0; i < args.ownColonyCount; i++) {
    pushBenefit(colonyBonus.type, colonyBonus.quantity ?? 1, typeof bonusResource === 'string' ? bonusResource : undefined, 'colony bonus');
  }

  // Flat every-trade card modifiers (Venus Trade Hub) — named by their card.
  for (const bonus of args.flatBonuses ?? []) {
    const current = running[bonus.resource];
    const resulting = current !== undefined ? current + bonus.amount : undefined;
    gains.push({direction: 'gain', icon: bonus.resource, amount: bonus.amount, current, resulting, note: bonus.card});
    if (resulting !== undefined) {
      running[bonus.resource] = resulting;
    }
  }

  return {cost, gains};
}

/** Colony owners grouped by colour (×N for multiple colonies). */
export function colonyOwnerCounts(colony: Pick<ColonyModel, 'colonies'>): Array<{color: Color, count: number}> {
  const counts = new Map<Color, number>();
  for (const color of colony.colonies) {
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts.entries()].map(([color, count]) => ({color, count}));
}
