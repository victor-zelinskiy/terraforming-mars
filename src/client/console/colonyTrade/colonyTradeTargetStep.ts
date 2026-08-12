/*
 * THE COLONY-TRADE TARGET STEP — the pure glue between a trade preview's
 * `cardTarget` follow-up and the SHARED played-card target selector
 * (`ConsolePlayedTargetStep` + `consolePlayedTargetModel`).
 *
 * WHY GLUE AND NOT A NEW SURFACE. «Куда положить награду торговли» is the same
 * decision as «куда положить ресурс синего действия»: point at a physical card
 * already on the table. The console already owns ONE selector for that — the
 * embedded played-target step both composers descend into — so the colony
 * workspace reuses it verbatim and this module only translates the trade's own
 * shapes (a `TradeStep` off the server preview) into the selector's model.
 * A parallel colony-only picker is exactly the drift this fork forbids.
 *
 * Deliberate differences from the composer hosts, both structural:
 *  · NO `sourceCardName` — the hero of the colony stage is the PLANET, not a
 *    card; even a card-door trade (Летающая платформа) has no card standing on
 *    this stage, so every candidate renders as its own physical face and the
 *    «ЭТА КАРТА» proxy never appears here.
 *  · the preview sections are built from the TRADE step's own numbers (the
 *    server's candidate list carries live per-card counts) — the composers'
 *    `ActionPreviewStep` never existed for a colony trade.
 *
 * PURE: no DOM, no Vue, no i18n (labels are keys); unit-tested under the
 * server runner.
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {TradeNotice, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {
  BuildPlayedTargetInput, PlayedTargetModel, PlayedTargetPreviewSection,
  buildPlayedTargetModel,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {ColonyTradeTargets} from '@/client/console/colonyTrade/colonyTradeModel';

type CardTargetStep = Extract<TradeStep, {kind: 'cardTarget'}>;

/** The icon key of what this step ADDS to a candidate. A step that names its
 *  resource (Titan's floaters) answers for every card; the Venus «any
 *  resource» step answers per candidate, from the card's OWN resource type. */
export function colonyTradeTargetIcon(
  step: {resource: string | undefined},
  resourceOf: (name: CardName) => string | undefined,
  card: CardName,
): string | undefined {
  const named = step.resource?.toString().toLowerCase().replace(/ /g, '-');
  return named ?? resourceOf(card)?.toString().toLowerCase().replace(/ /g, '-');
}

export type BuildColonyTradeTargetInput = {
  step: CardTargetStep;
  /** The prompt's ask, already translated by the caller (the server title). */
  ask: string;
  /** Every player, for owner resolution (`PlayedTargetPlayerRef` shape). */
  players: BuildPlayedTargetInput['players'];
  viewerColor: string;
  /** `ClientCardManifest.getCard(...)?.type`, injected for purity. */
  typeOf: (name: CardName) => CardType | undefined;
  /** `ClientCardManifest.getCard(...)?.resourceType`, injected for purity. */
  resourceOf: (name: CardName) => string | undefined;
};

/**
 * The selector model of ONE trade card-target step. Candidates are the
 * server's own `SelectCardModel.cards` — eligibility verbatim, never
 * re-derived — and every candidate carries the honest `current → resulting`
 * reading plus the resource badge (zero included: an empty legal target must
 * still answer «сколько там сейчас»).
 */
export function buildColonyTradeTargetModel(input: BuildColonyTradeTargetInput): PlayedTargetModel {
  const {step} = input;
  const preview = (name: CardName): ReadonlyArray<PlayedTargetPreviewSection> => {
    const model = step.pick.cards.find((c) => c.name === name);
    if (model === undefined || step.amount === 0) {
      return [];
    }
    const from = model.resources ?? 0;
    return [{
      key: 'res',
      title: 'Target card',
      entity: 'target',
      impacts: [{
        label: 'Resources on this card',
        icon: colonyTradeTargetIcon(step, input.resourceOf, name),
        from,
        to: Math.max(0, from + step.amount),
      }],
    }];
  };
  return buildPlayedTargetModel({
    candidates: step.pick.cards,
    players: input.players,
    viewerColor: input.viewerColor,
    ask: input.ask,
    typeOf: input.typeOf,
    preview,
    resourceContext: (name, model) =>
      playedTargetResourceFor(step.amount, colonyTradeTargetIcon(step, input.resourceOf, name), model),
  });
}

// ── the card-resource DESTINATIONS of a confirmed trade ─────────────────────

/**
 * One card that will physically receive a trade reward — the resolution
 * scene's presentation row and the transfer framework's flight target.
 */
export type ColonyTradePresentedTarget = {
  card: CardName;
  role: 'tradeReward' | 'colonyBonus';
  /** Resource icon key ('' when even the card's own type is unknown). */
  icon: string;
  amount: number;
  /** The count BEFORE the trade — the honest baseline the counter is frozen
   *  at until the chip physically lands. */
  before: number;
};

export type ColonyTradeDestinationsInput = {
  /** The interactive steps (the stage's `tradeSteps` output). */
  steps: ReadonlyArray<TradeStep>;
  /** The stage's capture keys, index-aligned with `steps`. */
  stepKeys: ReadonlyArray<string>;
  captures: Readonly<Record<string, unknown>>;
  /** The display-only notices (`tradeNotices`) — the AUTO single-candidate
   *  targets live here, and they are destinations too: the server applies
   *  them without a prompt, but the chip must still land on the real card. */
  notices: ReadonlyArray<TradeNotice>;
  resourceOf: (name: CardName) => string | undefined;
  /** The live count on a card the pick list does not carry (an auto target
   *  never had a pick) — the viewer's tableau lookup. */
  beforeOf: (name: CardName) => number;
};

/**
 * Every card-resource destination of this confirm — the PICKED targets first
 * (in step order), then the AUTO ones (in notice order) — as both the
 * transfer-framework targets and the presentation rows.
 *
 * The two are built TOGETHER on purpose: the card the chip flies onto and the
 * card the scene presents must be the same list read once, or a divergence
 * (a pick the flight knows and the scene does not) becomes a chip landing on
 * an invisible card.
 *
 * Presented rows are MERGED per card: an income and a bonus aimed at the same
 * host are one physical card receiving two chips — one presented face whose
 * counter ticks per touchdown, never two copies of one object.
 */
export function colonyTradeCardDestinations(input: ColonyTradeDestinationsInput): {
  targets: ColonyTradeTargets;
  presented: ReadonlyArray<ColonyTradePresentedTarget>;
} {
  const presented: Array<ColonyTradePresentedTarget> = [];
  const targets: ColonyTradeTargets = {};
  const bonus: Array<CardName> = [];

  const present = (row: ColonyTradePresentedTarget): void => {
    const prior = presented.find((p) => p.card === row.card);
    if (prior !== undefined) {
      // Same physical card — one face, the amounts accumulate. The first
      // row's `before` stays: it is the pre-trade truth for the whole trade.
      presented[presented.indexOf(prior)] = {
        ...prior,
        amount: prior.amount + row.amount,
        icon: prior.icon !== '' ? prior.icon : row.icon,
      };
      return;
    }
    presented.push(row);
  };

  input.steps.forEach((step, i) => {
    if (step.kind !== 'cardTarget') {
      return;
    }
    const captured = input.captures[input.stepKeys[i]];
    if (typeof captured !== 'string') {
      return;
    }
    const card = captured as CardName;
    const model = step.pick.cards.find((c) => c.name === card);
    present({
      card,
      role: step.role,
      icon: colonyTradeTargetIcon(step, input.resourceOf, card) ?? '',
      amount: step.amount,
      before: model?.resources ?? input.beforeOf(card),
    });
    if (step.role === 'tradeReward') {
      targets.incomeTargetCard = card;
    } else {
      bonus.push(card);
    }
  });

  for (const notice of input.notices) {
    if (notice.kind !== 'autoTarget') {
      continue;
    }
    present({
      card: notice.card,
      role: notice.role,
      icon: colonyTradeTargetIcon(notice, input.resourceOf, notice.card) ?? '',
      amount: notice.amount,
      before: input.beforeOf(notice.card),
    });
    if (notice.role === 'tradeReward') {
      targets.incomeTargetCard = targets.incomeTargetCard ?? notice.card;
    } else {
      bonus.push(notice.card);
    }
  }

  if (bonus.length > 0) {
    targets.bonusTargetCards = bonus;
  }
  return {targets, presented};
}

/**
 * A presented target's card model for the resolution scene: the live model
 * with its counter FROZEN at the pre-trade value, ticking UP by exactly what
 * has physically landed (`landedCount` — the transaction's per-card touchdown
 * tally). Snapshotted, so the server commit updating the tableau underneath
 * can never tick the visible counter early — and a multi-chip payout (two
 * bonus cubes onto one card) ticks once per contact, not once at the end.
 */
export function presentedTargetModel(
  target: ColonyTradePresentedTarget,
  live: CardModel | undefined,
  landedCount: number,
): CardModel {
  const base: CardModel = live !== undefined ? {...live} : ({name: target.card} as CardModel);
  const shown = target.before + Math.min(Math.max(0, landedCount), target.amount);
  return {...base, resources: Math.max(0, shown)};
}
