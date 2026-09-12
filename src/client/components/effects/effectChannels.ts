/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * PER-EFFECT scoping of a source card's passive stats via the server aggregate's
 * CHANNEL split (`EffectOverlayStat.byChannel`). The event stream attributes an
 * impact to the CARD; the channel says which MECHANISM produced it (the firing
 * hook's {@link EventTrigger}, or a tag-identified payment/discount family). A
 * multi-effect card whose effects ride DISJOINT channel sets therefore gets
 * honest per-effect stats; any ambiguity falls back to the existing card-level
 * presentation (`cardScoped`) — never a guess.
 *
 * PURE: no Vue / DOM / i18n / manifest. Imports only `common` + the pure
 * `effectSummary` types, so it runs under the server test runner.
 */
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {EffectChannelStat, EffectOverlayStat, EffectStatChannel} from '@/common/events/aggregate';
import {EffectSignature} from '@/client/components/effects/effectSummary';

/** The slice of an `EffectEntry` this module reads (structurally assignable). */
export type ChannelEffectInput = {
  effectIndex: number;
  signature: EffectSignature;
};

/**
 * CURATED channel sets for multi-effect cards whose hook-fired effects the
 * render signature cannot attribute structurally. Indexed by `effectIndex`;
 * `undefined` at a position = "structural rules answer it" (valueAsPayment /
 * discount). A multi-effect card ABSENT here degrades to the honest cardScoped
 * fallback (e.g. PolderTech Dutch — both effects fire on 'tile-placed', a
 * genuine collision the split cannot resolve). The coverage spec keeps the
 * worklist of candidates visible.
 */
const CURATED_EFFECT_CHANNELS: Partial<Record<CardName, ReadonlyArray<ReadonlyArray<EffectStatChannel> | undefined>>> = {
  // #0: graphene lands when the owner plays a science card (onCardPlayed) or
  // gains a non-card science tag (onNonCardTagAdded); #1 is the graphene-as-4M€
  // payment rule — structural (valueAsPayment → 'resource-payment').
  [CardName.CARBON_NANOSYSTEMS]: [['card-played', 'tag-added'], undefined],
  // #0 is the printed Earth discount — structural; #1 draws on the owner's
  // space-event play (onCardPlayed → 'card-played').
  [CardName.SOLAR_LOGISTICS]: [undefined, ['card-played']],
  // #0 «animals may not be removed» is a pure RULE — the EMPTY set says «this
  // effect never tallies»; #1 gains an animal per city tile (onTilePlaced).
  [CardName.PETS]: [[], ['tile-placed']],
};

/**
 * The channel set ONE effect's stats live on, or undefined when unknown.
 * Structural rules first (they are exact by construction): a resource-as-payment
 * effect's savings ride 'resource-payment'; a printed cost-reduction rides
 * 'discount'. Everything else needs a curated entry.
 */
export function expectedChannelsFor(cardName: CardName, effectIndex: number, signature: EffectSignature): ReadonlyArray<EffectStatChannel> | undefined {
  if (signature.valueAsPayment) {
    return ['resource-payment'];
  }
  if (signature.discount) {
    return ['discount'];
  }
  return CURATED_EFFECT_CHANNELS[cardName]?.[effectIndex];
}

/**
 * The whole card's per-effect channel plan (indexed by `effectIndex`), defined
 * ONLY when EVERY effect has a known channel set AND the sets are pairwise
 * disjoint — otherwise a shared channel would double-attribute one impact to
 * two effects, and the honest answer is the card-level fallback.
 */
export function cardChannelPlan(cardName: CardName, entries: ReadonlyArray<ChannelEffectInput>): ReadonlyArray<ReadonlyArray<EffectStatChannel>> | undefined {
  const plan: Array<ReadonlyArray<EffectStatChannel>> = [];
  for (const entry of entries) {
    const channels = expectedChannelsFor(cardName, entry.effectIndex, entry.signature);
    if (channels === undefined) {
      return undefined;
    }
    // An EMPTY set is a valid answer — «this effect never tallies» (a pure
    // printed rule beside a measurable sibling, e.g. Pets #0). Its slice is
    // honest zeros; it contributes nothing to the disjointness check.
    plan[entry.effectIndex] = channels;
  }
  const seen = new Set<EffectStatChannel>();
  for (const channels of plan) {
    for (const channel of channels) {
      if (seen.has(channel)) {
        return undefined;
      }
      seen.add(channel);
    }
  }
  return plan;
}

const UNIT_KEYS: ReadonlyArray<keyof Units> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

function addUnitsInto(into: Units, delta: Units): void {
  for (const k of UNIT_KEYS) {
    into[k] += delta[k];
  }
}

function addRecordInto<K extends string>(into: Partial<Record<K, number>>, delta: Partial<Record<K, number>>): void {
  for (const k of Object.keys(delta) as Array<K>) {
    const v = delta[k];
    if (v !== undefined) {
      into[k] = (into[k] ?? 0) + v;
    }
  }
}

function mergeChannelInto(acc: EffectOverlayStat, ch: EffectChannelStat): void {
  acc.triggerCount += ch.triggerCount;
  acc.megacreditsSaved += ch.megacreditsSaved;
  acc.cardsDrawn += ch.cardsDrawn;
  addUnitsInto(acc.stock, ch.stock);
  addUnitsInto(acc.production, ch.production);
  addRecordInto(acc.cardResources, ch.cardResources);
  addRecordInto(acc.paymentResources, ch.paymentResources);
  acc.paymentValueBonus.steel += ch.paymentValueBonus.steel;
  acc.paymentValueBonus.titanium += ch.paymentValueBonus.titanium;
  acc.paymentValueBonus.bonusValue += ch.paymentValueBonus.bonusValue;
  acc.paymentValueBonus.count += ch.paymentValueBonus.count;
  acc.colonyTrack.steps += ch.colonyTrack.steps;
  acc.colonyTrack.extraReward += ch.colonyTrack.extraReward;
  acc.colonyTrack.count += ch.colonyTrack.count;
  addRecordInto(acc.colonyTrack.colonies, ch.colonyTrack.colonies);
  acc.tradeDiscount.energy += ch.tradeDiscount.energy;
  acc.tradeDiscount.titanium += ch.tradeDiscount.titanium;
  acc.tradeDiscount.megacredits += ch.tradeDiscount.megacredits;
  acc.tradeDiscount.count += ch.tradeDiscount.count;
  addRecordInto(acc.tradeDiscount.colonies, ch.tradeDiscount.colonies);
  acc.greeneryDiscount.plants += ch.greeneryDiscount.plants;
  acc.greeneryDiscount.count += ch.greeneryDiscount.count;
  acc.tr += ch.tr;
  addRecordInto(acc.globalParameterSteps, ch.globalParameterSteps);
  acc.vp += ch.vp;
  if (ch.lastTrigger !== undefined &&
      (acc.lastTrigger === undefined || ch.lastTrigger.generation >= acc.lastTrigger.generation)) {
    acc.lastTrigger = ch.lastTrigger;
  }
}

/**
 * ONE effect's slice of the card stat: the identity fields kept, the body =
 * the field-wise merge of the effect's channels (absent channels contribute
 * nothing — an effect that has not fired gets honest zeros).
 */
export function splitStatForEffect(cardStat: EffectOverlayStat, channels: ReadonlyArray<EffectStatChannel>): EffectOverlayStat {
  const slice: EffectOverlayStat = {
    sourceKey: cardStat.sourceKey,
    kind: cardStat.kind,
    card: cardStat.card,
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    production: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    cardResources: {},
    paymentResources: {},
    paymentValueBonus: {steel: 0, titanium: 0, bonusValue: 0, count: 0},
    colonyTrack: {steps: 0, extraReward: 0, count: 0, colonies: {}},
    tradeDiscount: {energy: 0, titanium: 0, megacredits: 0, count: 0, colonies: {}},
    greeneryDiscount: {plants: 0, count: 0},
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
  };
  for (const channel of channels) {
    const ch = cardStat.byChannel?.[channel];
    if (ch !== undefined) {
      mergeChannelInto(slice, ch);
    }
  }
  return slice;
}

export type PerEffectStat = {
  /** 'effect' → `stat` is honestly THIS effect's; 'card' → the card-level
   *  fallback (the existing `cardScoped` presentation). */
  scope: 'effect' | 'card';
  stat: EffectOverlayStat | undefined;
};

/**
 * Resolve the stat ONE effect should be summarised with. A single-effect card's
 * stat IS the effect's; a multi-effect card gets a channel split only when the
 * plan is complete + disjoint AND the aggregate classified every event (no
 * 'unattributed' residue) — anything less keeps today's honest card scope.
 */
export function perEffectStat(
  entry: ChannelEffectInput & {cardName: CardName},
  cardEntries: ReadonlyArray<ChannelEffectInput>,
  cardStat: EffectOverlayStat | undefined): PerEffectStat {
  if (cardEntries.length <= 1) {
    return {scope: 'effect', stat: cardStat};
  }
  const plan = cardChannelPlan(entry.cardName, cardEntries);
  if (plan === undefined) {
    return {scope: 'card', stat: cardStat};
  }
  if (cardStat === undefined) {
    return {scope: 'effect', stat: undefined};
  }
  const byChannel = cardStat.byChannel;
  if (byChannel === undefined || byChannel.unattributed !== undefined) {
    return {scope: 'card', stat: cardStat};
  }
  const channels = plan[entry.effectIndex] ?? [];
  return {scope: 'effect', stat: splitStatForEffect(cardStat, channels)};
}
