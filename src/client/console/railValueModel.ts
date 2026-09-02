/*
 * railValueModel — the PURE read-model behind the console left rail's VALUE
 * BADGES:
 *
 *  (1) МС-БЕЙДЖИ: «one unit of this resource replaces N M€ when payment with
 *      it is allowed» — the mini-coin pinned on the resource rows and on the
 *      ДОП.РЕСУРСЫ satellite chips;
 *  (2) VP-БЕЙДЖИ: «this tag is currently converted into VP by the displayed
 *      player's own played scoring cards, at this coefficient» — the
 *      mini-shield pinned on the МЕТКИ matrix medallions.
 *
 * The module restates NO rule of its own:
 *  - a RATE comes from paymentPlan.rateFor — the exact function every console
 *    payment surface charges by (live steelValue / titaniumValue from the
 *    model, incl. the Luna-Trade-Federation −1 branch; card-resource rates
 *    are DEFAULT_PAYMENT_VALUES);
 *  - ELIGIBILITY comes from the server's own grants: steel/titanium are the
 *    base-game payment pair, heat/plants/titanium-anywhere ride the standing
 *    flags the model mirrors from IPlayer (canUseHeatAsMegaCredits — Helion,
 *    canUseTitaniumAsMegacredits — Luna Trade Federation,
 *    canUsePlantsAsMegacredits — Martian Lumber Corp), and a card-bound unit
 *    is payable exactly when its ENABLING card — CARD_FOR_SPENDABLE_RESOURCE,
 *    the same registry Player.pay() spends from — is in the displayed
 *    player's tableau. A same-typed resource on any OTHER card is therefore
 *    just storage and earns nothing here (Stormcraft floaters vs Dirigibles);
 *  - TAG SCORING reads the same declarative `victoryPoints` the server's
 *    Counter scores at endgame: `each` multiplies FIRST, `per` floors second,
 *    and the count base ('raw') excludes wild tags — so a wild cell can never
 *    carry a coefficient, and `PublicPlayerModel.tags` (countAllTags = raw)
 *    is exactly the count the badge's implied math applies to. Bespoke
 *    ('special') scorers — Agricola Inc's thresholds — are not a linear
 *    coefficient and deliberately earn NO badge (desktop PointsPerTag parity).
 *
 * Presentation decisions carried from the deleted desktop implementation
 * (PointsPerTag.vue, removed in wave 3 — see the PR notes in docs):
 *  - fractional coefficients render as vulgar fractions (½ ⅓ ⅔), the integer
 *    part suppressed at zero;
 *  - TWO half-point cards on one tag print the literal «2⁄2» (fraction slash),
 *    deliberately NOT simplified to 1 — the player sees it is two half-cards
 *    (upstream #5236). Detection here is STRUCTURAL (per === 2), never the
 *    card-name pair the desktop hardcoded;
 *  - a placement-dependent score (nextToThis) renders «*», never a number.
 *
 * Multi-rate honesty: when one badge must speak for TWO legal rates (LTF
 * titanium: full value on space cards, value−1 anywhere else; a shared-icon
 * chip whose two enabling cards pay at different rates — Luna Archives ×1 +
 * Spire ×2 science), the badge text carries BOTH figures («3/2»), primary
 * context first, and the facts list names each context for the aria label.
 * Showing one arbitrarily would be a lie; showing none would hide a grant.
 *
 * No Vue / DOM / i18n. Memoized by model identity — structural sharing keeps
 * unchanged objects' refs, so the always-mounted rail pays O(1) per response.
 */

import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SPENDABLE_CARD_RESOURCES, CARD_FOR_SPENDABLE_RESOURCE, SpendableCardResource, SpendableResource} from '@/common/inputs/Spendable';
import {rateFor} from '@/client/console/paymentPlan';
import {getCard} from '@/client/cards/ClientCardManifest';

/**
 * WHERE a unit is legal tender — mirrors the server's own payment registry
 * (`Player.paymentOptionsForCard` + the standard projects' `canPayWith`).
 * Display/a11y vocabulary only: eligibility itself never derives from this.
 */
export type RailMcContext =
  | 'building'          // cards with a building tag (steel; plants via MLC)
  | 'space'             // cards with a space tag (titanium)
  | 'non-space-ltf'     // any NON-space card, at value−1 (Luna Trade Federation)
  | 'any-card'          // any card (Helion heat)
  | 'plant'             // cards with a plant tag (Psychrophiles microbes)
  | 'plant-or-greenery' // plant tag or the greenery standard project (Soylent seeds)
  | 'venus'             // cards with a Venus tag (Dirigibles floaters)
  | 'moon'              // cards with a Moon tag (Luna Archives science)
  | 'city-or-space'     // city or space tag (Carbon Nanosystems graphene)
  | 'standard-project'  // standard projects (Spire science, Aurorai data)
  | 'aquifer-asteroid'; // the aquifer / asteroid standard projects (Kuiper)

/** One unit's contribution to a badge — what pays, at what rate, where. */
export type RailMcUnitFact = {
  unit: SpendableResource;
  rate: number;
  context: RailMcContext;
  /** The enabling card for a card-bound unit (the registry's own entry). */
  source?: CardName;
  /** Card-bound: units sitting ON the enabling card (the spendable part of an
   *  aggregated chip total — Stormcraft floaters are storage, not tender). */
  spendableAmount?: number;
};

/** One rendered MC-value badge (a resource row's or an aux chip's corner coin). */
export type RailMcBadge = {
  /** Ready display text: '3', or '3/2' when two legal rates coexist. */
  text: string;
  /** The distinct figures behind the text, display order (primary first). */
  rates: ReadonlyArray<number>;
  /** ≥1 fact; the aria label is composed from these. */
  facts: ReadonlyArray<RailMcUnitFact>;
};

/** Standard-row keys that can carry an MC badge (M€ itself and energy never do). */
export type RailMcStandardKey = 'steel' | 'titanium' | 'heat' | 'plants';

export type RailMcBadges = {
  standard: Partial<Record<RailMcStandardKey, RailMcBadge>>;
  /** Keyed by the aux satellite's group resource (additionalResourceGroups). */
  cardBound: ReadonlyMap<CardResource, RailMcBadge>;
};

const CONTEXT_FOR_CARD_UNIT: Record<SpendableCardResource, RailMcContext> = {
  microbes: 'plant',
  floaters: 'venus',
  lunaArchivesScience: 'moon',
  spireScience: 'standard-project',
  seeds: 'plant-or-greenery',
  auroraiData: 'standard-project',
  graphene: 'city-or-space',
  kuiperAsteroids: 'aquifer-asteroid',
  // Modular Floodgates steel pays exactly where ordinary steel does.
  floodgateSteel: 'building',
};

function badgeOf(facts: Array<RailMcUnitFact>): RailMcBadge {
  const rates: Array<number> = [];
  for (const fact of facts) {
    if (!rates.includes(fact.rate)) {
      rates.push(fact.rate);
    }
  }
  return {text: rates.join('/'), rates, facts};
}

const mcMemo = new WeakMap<PublicPlayerModel, RailMcBadges>();

/**
 * Every MC-value badge for the DISPLAYED player (self or an inspected seat —
 * all inputs live on their own PublicPlayerModel, never on the local viewer).
 */
export function railMcBadges(player: PublicPlayerModel): RailMcBadges {
  const memoized = mcMemo.get(player);
  if (memoized !== undefined) {
    return memoized;
  }

  const standard: Partial<Record<RailMcStandardKey, RailMcBadge>> = {};

  // Steel — the base-game tender for building-tag cards; the live value
  // already carries every modifier (Advanced Alloys, Rego Plastics, …).
  standard.steel = badgeOf([{unit: 'steel', rate: rateFor('steel', player, {steel: true}), context: 'building'}]);

  // Titanium — space-tag tender; with Luna Trade Federation it additionally
  // pays ANY other card at value−1, so the badge carries both legal rates.
  const titaniumFull = rateFor('titanium', player, {titanium: true});
  if (player.canUseTitaniumAsMegacredits === true) {
    const titaniumAnywhere = rateFor('titanium', player, {titanium: false, lunaTradeFederationTitanium: true});
    standard.titanium = badgeOf([
      {unit: 'titanium', rate: titaniumFull, context: 'space'},
      {unit: 'titanium', rate: titaniumAnywhere, context: 'non-space-ltf'},
    ]);
  } else {
    standard.titanium = badgeOf([{unit: 'titanium', rate: titaniumFull, context: 'space'}]);
  }

  // Heat / plants — payment resources ONLY under their standing grants.
  if (player.canUseHeatAsMegaCredits === true) {
    standard.heat = badgeOf([{unit: 'heat', rate: rateFor('heat', player, {heat: true}), context: 'any-card'}]);
  }
  if (player.canUsePlantsAsMegacredits === true) {
    standard.plants = badgeOf([{unit: 'plants', rate: rateFor('plants', player, {plants: true}), context: 'building'}]);
  }

  // Card-bound units: payable exactly while the ENABLING card is in the
  // tableau. Grouped by the card's resource TYPE — the same key the
  // ДОП.РЕСУРСЫ satellite groups by — so a chip that aggregates several
  // holders gets ONE badge fed only by its true payment source(s).
  const factsByResource = new Map<CardResource, Array<RailMcUnitFact>>();
  for (const unit of SPENDABLE_CARD_RESOURCES) {
    const enabler = CARD_FOR_SPENDABLE_RESOURCE[unit];
    const played = player.tableau.find((card) => card.name === enabler);
    if (played === undefined) {
      continue;
    }
    const resourceType = getCard(enabler)?.resourceType;
    if (resourceType === undefined) {
      continue;
    }
    const facts = factsByResource.get(resourceType) ?? [];
    facts.push({
      unit,
      rate: rateFor(unit, player, {}),
      context: CONTEXT_FOR_CARD_UNIT[unit],
      source: enabler,
      spendableAmount: played.resources ?? 0,
    });
    factsByResource.set(resourceType, facts);
  }
  const cardBound = new Map<CardResource, RailMcBadge>();
  factsByResource.forEach((facts, resource) => cardBound.set(resource, badgeOf(facts)));

  const result: RailMcBadges = {standard, cardBound};
  mcMemo.set(player, result);
  return result;
}

// ── VP-за-метки ──────────────────────────────────────────────────────────

/** One scoring card behind a tag's coefficient (aria / debugging detail). */
export type TagVpSource = {
  card: CardName;
  /** VP per counted tag before the divisor (server `each`, default 1). */
  each: number;
  /** Tags needed per one scoring step (server `per`, default 1). */
  per: number;
};

/** One rendered VP-coefficient badge (a МЕТКИ medallion's corner shield). */
export type TagVpBadge = {
  /** '1' · '2' · '½' · '⅓' · '1⅓' · '2⁄2' · '*' — desktop PointsPerTag parity. */
  text: string;
  /** True when the text needs the compact type step (2+ characters). */
  wide: boolean;
  sources: ReadonlyArray<TagVpSource>;
};

/**
 * The desktop PointsPerTag formatter, ported verbatim: integer part
 * (suppressed at 0) + a vulgar fraction, the «2⁄2» two-half-cards special
 * case, and the «*» placement-dependent marker.
 */
export function formatTagVpRate(points: number, halfPoints: number, asterisk: boolean): string {
  const star = asterisk ? '*' : '';
  if (halfPoints === 2) {
    // The deliberate «two half-cards» read (fraction slash) — never «1».
    return `2⁄2${star}`;
  }
  const total = points + halfPoints / 2;
  const integer = Math.floor(total);
  const fraction = total - integer;
  let vulgar = '';
  if (fraction === 0.5) {
    vulgar = '½';
  } else if (Math.abs(fraction - 1 / 3) < Number.EPSILON) {
    vulgar = '⅓';
  } else if (Math.abs(fraction - 2 / 3) < Number.EPSILON) {
    vulgar = '⅔';
  }
  return `${integer || ''}${vulgar}${star}`;
}

const tagVpMemo = new WeakMap<ReadonlyArray<CardModel>, ReadonlyMap<Tag, TagVpBadge>>();

/**
 * The active per-tag VP coefficients of a tableau: every played card whose
 * declarative victoryPoints target a tag count, summed per tag. `'special'`
 * scorers and plain numbers contribute nothing (not a linear coefficient);
 * a `nextToThis` score renders «*» rather than a wrong number.
 */
export function tagVpBadges(tableau: ReadonlyArray<CardModel>): ReadonlyMap<Tag, TagVpBadge> {
  const memoized = tagVpMemo.get(tableau);
  if (memoized !== undefined) {
    return memoized;
  }
  type Bucket = {points: number, halfPoints: number, asterisk: boolean, sources: Array<TagVpSource>};
  const buckets = new Map<Tag, Bucket>();
  for (const card of tableau) {
    const vps = getCard(card.name)?.victoryPoints;
    if (vps === undefined || typeof vps === 'number' || vps === 'special' || vps.tag === undefined) {
      continue;
    }
    const each = vps.each ?? 1;
    const per = vps.per ?? 1;
    const bucket = buckets.get(vps.tag) ?? {points: 0, halfPoints: 0, asterisk: false, sources: []};
    if (vps.nextToThis !== undefined) {
      bucket.asterisk = true;
    } else if (per === 2 && each === 1) {
      // Structural form of the desktop's Cultivation-of-Venus / Venera-Base
      // name pair: a half-point card goes into its own bucket so two of them
      // read «2⁄2» instead of a silently simplified «1».
      bucket.halfPoints++;
    } else {
      bucket.points += each / per;
    }
    bucket.sources.push({card: card.name, each, per});
    buckets.set(vps.tag, bucket);
  }
  const result = new Map<Tag, TagVpBadge>();
  buckets.forEach((bucket, tag) => {
    const text = formatTagVpRate(bucket.points, bucket.halfPoints, bucket.asterisk);
    // An exotic future ratio (per = 4, …) has no vulgar glyph and would
    // format to '' — no badge is honest, an empty plate is not.
    if (text !== '') {
      result.set(tag, {text, wide: text.length > 1, sources: bucket.sources});
    }
  });
  tagVpMemo.set(tableau, result);
  return result;
}
