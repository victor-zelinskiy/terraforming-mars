/*
 * THE EXTRAS EXPLORER MODEL — pure view-models for the Information
 * workspace's «Доп. ресурсы» screen (the extras route).
 *
 * WHY THIS COMPUTES NO SCORING RULE OF ITS OWN. Every VP figure comes from
 * the ONE console scoring system: the server's `VictoryPointsBreakdown`
 * (`detailsCards[].mechanics` — the formula + the live operand captured at
 * the same moment the score was computed, `floor(counted × each / per) ===
 * victoryPoint` by construction) — the same rows the score explorer and the
 * endgame ceremony read. This module only ARRANGES those facts around the
 * player's resource-holding cards; per-card flooring is therefore inherited
 * from the engine, never re-implemented (two cards at 1 resource each under
 * a «2 → 1 VP» rule read 0 + 0, not 1).
 *
 * The TYPE LIST is `additionalResourceGroups` — the SAME first-appearance
 * derivation the rail satellite renders, so the board column, the summary
 * and this screen can never disagree on order or membership (holders with 0
 * resources INCLUDED — the memo lives client-side; the groups are passed IN
 * so this module stays pure).
 *
 * HIDDEN SCORE: an opponent under the hidden-VP rule ships a ZEROED
 * breakdown (empty detailsCards). The printed RULE is public (it is on the
 * card face); the current VALUES are score information — so with
 * `vpVisible === false` the model keeps the rule (from the injected
 * manifest lookup) and withholds every computed number (`vpNow` /
 * `toNext` / the type sums are undefined).
 *
 * PURE: no Vue / DOM / i18n / manifest — unit-tested under the server
 * runner. Labels are English i18n KEYS (card names ARE keys).
 */
import type {CardVictoryPointsDetail} from '@/common/game/VictoryPointsBreakdown';
import type {AdditionalResourceGroup} from '@/client/components/additionalResources/additionalResources';
import type {MarsBotExtraGroup} from '@/client/components/console/marsBotRailModel';
import type {RailMcBadge} from '@/client/console/railValueModel';
import type {RailProtectionMark} from '@/client/console/railProtectionModel';
import type {CardResource} from '@/common/CardResource';
import type {ExtrasZone} from '@/client/console/consoleExtrasExplorer';

// ── per-card facts ─────────────────────────────────────────────────────────

/**
 * How the stored resources score, when they do.
 *  · 'per'     — the linear printed rule («per» resources give «each» VP);
 *  · 'special' — a bespoke clause (Search For Life): the current value is
 *                server truth, and NO universal «N more to the next VP»
 *                exists — the model deliberately cannot express one.
 * `vpNow` is the SERVER's own per-card result; undefined = hidden score.
 */
export type ExtrasScoringVm = {
  kind: 'per' | 'special';
  /** VP granted per `per` units (printed rate; 'per' kind only, else 0). */
  each: number;
  per: number;
  vpNow: number | undefined;
  /** Resources still short of the NEXT VP step — only for a linear rule
   *  with per > 1 (a per-1 rule's «1 more» is the rule chip itself). */
  toNext: number | undefined;
};

export type ExtrasCardVm = {
  /** The card name IS the i18n key. */
  name: string;
  amount: number;
  isCorporation: boolean;
  /** Resource-driven scoring (the breakdown's kind === 'resource'). */
  scoring?: ExtrasScoringVm;
  /** The SAME card's non-resource VP (a printed number, a tag counter…) —
   *  named separately so it can never inflate «VP from resources». */
  otherVp?: {vpNow: number | undefined, conditional: boolean};
  /** The card has an activatable action (its resources likely feed it). */
  hasAction: boolean;
  /** This card is the ENABLING card of a payment grant — one unit of its
   *  stock pays `payRate` M€ (railValueModel's own fact, display only). */
  payRate?: string;
};

// ── per-type aggregation ───────────────────────────────────────────────────

export type ExtrasTypeVm = {
  /** Stable key (the normalized resource key — doubles as the satellite
   *  cell address `data-exr-type`). */
  key: string;
  /** The card resource, when this is a card-resource group (human seats;
   *  the bot's standard-resource storage pools have none). */
  resource: CardResource | undefined;
  /** Ready-to-render icon classes. */
  iconClass: string;
  /** i18n key of the type name. */
  label: string;
  total: number;
  /** Holder cards in TABLEAU (play) order — stable, zeros included. */
  cards: ReadonlyArray<ExtrasCardVm>;
  /** The bot's storage split (colony-tile names are i18n keys); [] for
   *  human seats and the bot's one-pool floater stock. */
  holders: ReadonlyArray<{name: string, amount: number}>;
  /** The bot pool's KIND (picks the honest rule note); absent for humans. */
  botOrigin?: 'pool' | 'storage' | 'corp';
  /** Σ linear resource VP over this type's cards (server rows). Undefined
   *  while the score is hidden. */
  vpFromResources: number | undefined;
  /** Σ special-clause VP tied to these resources (named separately —
   *  «условные», never folded into the linear sum). */
  vpConditional: number | undefined;
  /** How many holders score from these resources at all. */
  scoringCards: number;
  actionCards: number;
  protection?: RailProtectionMark;
  payment?: RailMcBadge;
};

/** What the model needs to know about a card beyond the public model. */
export type ExtrasCardLookup = (name: string) => {
  isCorporation: boolean,
  hasAction: boolean,
  /** The manifest's printed resource rule («resourcesHere» → per/each),
   *  'special' for a bespoke clause on a storing card, undefined when the
   *  resources print no rule. The HIDDEN-score fallback only. */
  printedRule?: {per: number, each: number} | 'special',
} | undefined;

export type ExtrasModelInput = {
  /** The canonical type groups (additionalResourceGroups — passed in so
   *  the model stays pure). */
  groups: ReadonlyArray<AdditionalResourceGroup>;
  /** The server's per-card VP rows (empty for a hidden opponent). */
  detailsCards: ReadonlyArray<CardVictoryPointsDetail>;
  vpVisible: boolean;
  lookup: ExtrasCardLookup;
  /** Ready-to-render icon classes for a card resource (cardResourceCSS —
   *  injected so the model stays manifest-free). */
  iconFor?: (resource: CardResource) => string;
  protections?: ReadonlyMap<CardResource, RailProtectionMark>;
  payments?: ReadonlyMap<CardResource, RailMcBadge>;
};

/** Normalize a CardResource to its satellite/anchor key
 *  («Venusian Habitat» → «venusian-habitat» — mirrors resourceTransfer). */
export function extrasTypeKey(resource: string): string {
  return resource.toLowerCase().replace(/ /g, '-');
}

/** Resources short of the next VP step under a linear rule. A full step
 *  (counted % per === 0) honestly needs the WHOLE next batch. */
export function resourcesToNextVp(counted: number, per: number): number {
  const rem = counted % per;
  return rem === 0 ? per : per - rem;
}

function scoringFromDetail(
  d: CardVictoryPointsDetail,
  amount: number,
  vpVisible: boolean,
): {scoring?: ExtrasScoringVm, otherVp?: {vpNow: number | undefined, conditional: boolean}} {
  const m = d.mechanics;
  if (d.kind === 'resource') {
    if (m?.shape === 'per') {
      const per = m.per ?? 1;
      const each = m.each ?? 1;
      const counted = m.counted ?? amount;
      return {
        scoring: {
          kind: 'per',
          each,
          per,
          vpNow: vpVisible ? d.victoryPoint : undefined,
          toNext: vpVisible && per > 1 ? resourcesToNextVp(counted, per) : undefined,
        },
      };
    }
    // 'special' (Search For Life) or an old model without mechanics — the
    // value is server truth; no universal «N more» exists for it.
    return {scoring: {kind: 'special', each: 0, per: 0, vpNow: vpVisible ? d.victoryPoint : undefined, toNext: undefined}};
  }
  // The holder scores from something ELSE (a printed number, tags, …) —
  // its VP is real but never «VP from resources».
  return {otherVp: {vpNow: vpVisible ? d.victoryPoint : undefined, conditional: d.kind !== 'fixed'}};
}

/** The hidden-score fallback: state the PRINTED rule (public — it is on
 *  the card face), keep every computed number withheld. */
function scoringFromPrintedRule(rule: {per: number, each: number} | 'special' | undefined):
  {scoring?: ExtrasScoringVm} {
  if (rule === undefined) {
    return {};
  }
  if (rule === 'special') {
    return {scoring: {kind: 'special', each: 0, per: 0, vpNow: undefined, toNext: undefined}};
  }
  return {scoring: {kind: 'per', each: rule.each, per: rule.per, vpNow: undefined, toNext: undefined}};
}

/**
 * The HUMAN seat's type list — one entry per unlocked card-resource type,
 * first-appearance order, holders in play order, zeros included.
 */
export function buildExtrasTypes(input: ExtrasModelInput): ReadonlyArray<ExtrasTypeVm> {
  const detailByName = new Map<string, CardVictoryPointsDetail>();
  for (const d of input.detailsCards) {
    // Tableau card names are unique; pseudo-rows never match a holder.
    detailByName.set(d.cardName, d);
  }
  return input.groups.map((group): ExtrasTypeVm => {
    let vpFromResources = 0;
    let vpConditional = 0;
    let scoringCards = 0;
    let actionCards = 0;
    const cards = group.cards.map((entry): ExtrasCardVm => {
      const decl = input.lookup(entry.name);
      const detail = detailByName.get(entry.name);
      const facts = detail !== undefined ?
        scoringFromDetail(detail, entry.amount, input.vpVisible) :
        (input.vpVisible ? {} : scoringFromPrintedRule(decl?.printedRule));
      if (facts.scoring !== undefined) {
        scoringCards++;
        if (facts.scoring.vpNow !== undefined) {
          if (facts.scoring.kind === 'per') {
            vpFromResources += facts.scoring.vpNow;
          } else {
            vpConditional += facts.scoring.vpNow;
          }
        }
      }
      const hasAction = decl?.hasAction === true;
      if (hasAction) {
        actionCards++;
      }
      // The payment grant belongs to the ENABLING card alone — same-typed
      // resources on other holders are storage (railValueModel's own law).
      const payFact = input.payments?.get(group.resource)?.facts.find((f) => f.source === entry.name);
      return {
        name: entry.name,
        amount: entry.amount,
        isCorporation: entry.isCorporation,
        ...facts,
        hasAction,
        payRate: payFact !== undefined ? String(payFact.rate) : undefined,
      };
    });
    return {
      key: extrasTypeKey(group.resource),
      resource: group.resource,
      iconClass: input.iconFor?.(group.resource) ?? '',
      label: group.resource,
      total: group.total,
      cards,
      holders: [],
      vpFromResources: input.vpVisible ? vpFromResources : undefined,
      vpConditional: input.vpVisible ? vpConditional : undefined,
      scoringCards,
      actionCards,
      protection: input.protections?.get(group.resource),
      payment: input.payments?.get(group.resource),
    };
  });
}

/**
 * The BOT seat's type list — the same semantic shape over the Automa's
 * REAL pools (floaters + shipping storage by type). No card faces, no
 * scoring rows: the bot's VP never comes from these pools, and the model
 * shows only what the MarsBot model actually supports.
 */
export function buildBotExtrasTypes(groups: ReadonlyArray<MarsBotExtraGroup>): ReadonlyArray<ExtrasTypeVm> {
  return groups.map((g): ExtrasTypeVm => ({
    key: g.key,
    resource: undefined,
    iconClass: g.iconClass,
    label: g.label,
    total: g.total,
    cards: [],
    holders: g.holders,
    botOrigin: g.origin,
    vpFromResources: undefined,
    vpConditional: undefined,
    scoringCards: 0,
    actionCards: 0,
  }));
}

// ── navigation (one real focus over two zones) ─────────────────────────────

export type ExtrasNavState = {
  zone: ExtrasZone;
  typeCursor: number;
  cardCursor: number;
};

/**
 * D-pad movement over the two zones. The TYPE COLUMN is vertical (up/down
 * clamp — the console's no-wrap grammar); `right` crosses into the gallery.
 * The GALLERY is one row per page: left/right walk the whole card list
 * (crossing a page edge IS the page turn — the page is derived from the
 * cursor); `left` at the first card returns to the type column. Up/down in
 * the gallery are inert (one row by construction).
 */
export function extrasNavigate(
  state: ExtrasNavState,
  dir: 'up' | 'down' | 'left' | 'right',
  typeCount: number,
  cardCount: number,
): ExtrasNavState {
  const clampType = (i: number) => Math.min(Math.max(i, 0), Math.max(0, typeCount - 1));
  const clampCard = (i: number) => Math.min(Math.max(i, 0), Math.max(0, cardCount - 1));
  if (state.zone === 'types') {
    if (dir === 'up' || dir === 'down') {
      return {...state, typeCursor: clampType(state.typeCursor + (dir === 'down' ? 1 : -1))};
    }
    if (dir === 'right' && cardCount > 0) {
      return {...state, zone: 'cards', cardCursor: clampCard(state.cardCursor)};
    }
    return state;
  }
  // zone === 'cards'
  if (dir === 'left') {
    if (state.cardCursor === 0) {
      return {...state, zone: 'types'};
    }
    return {...state, cardCursor: state.cardCursor - 1};
  }
  if (dir === 'right') {
    return {...state, cardCursor: clampCard(state.cardCursor + 1)};
  }
  return state;
}

/** The active gallery page — DERIVED from the cursor (no second state). */
export function extrasPageOf(cardCursor: number, perPage: number): number {
  return perPage > 0 ? Math.floor(cardCursor / perPage) : 0;
}

export function extrasPageCount(cardCount: number, perPage: number): number {
  return perPage > 0 ? Math.max(1, Math.ceil(cardCount / perPage)) : 1;
}
