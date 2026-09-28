import {ColonyBenefit} from './ColonyBenefit';
import {Resource} from '../Resource';
import {ColonyName} from './ColonyName';
import {CardResource} from '../CardResource';
import {Expansion, GameModule} from '../cards/GameModule';
import {OneOrArray} from '../utils/types';

/**
 * `K` is the benefit KIND. It is a single `ColonyBenefit` for the build and
 * colony bonuses, and `OneOrArray<ColonyBenefit>` for the TRADE income —
 * exactly as `resource` is per-position there (Europa, Mercury, Hygiea). The
 * Turmoil Redux Pluto pays DATA at positions 1–5 and CARDS at 6–7: the KIND
 * of the income moves along the track, not only its resource or amount.
 * Read it through {@link tradeBenefitAt} — never index `type` by hand.
 */
type Benefit<S, T, K = ColonyBenefit> = {
  description: string,
  type: K;
  quantity: S
  resource?: T;
}

/**
 * THE FIXED PART of a trade income — paid on EVERY trade, whatever the marker
 * says, BEFORE the marker's own bonus. The Turmoil Redux Venus prints exactly
 * this shape: «Terraform Venus 1 step, AND gain the bonus indicated by the
 * colony marker» — the tile's TRADE INCOME line reads «[Venus] + X», a constant
 * beside a per-position bonus. Declared as DATA (never a per-colony hook) so
 * the client draws it from the same metadata the server pays it from: the
 * tile's trade cell, the dossier's rule line and the reward package all read
 * `trade.fixed` and can never disagree with `Colony.handleTrade`. One benefit,
 * because the printed rule names one; a tile that needs two fixed parts
 * declares the second here as a list — not as a second hook.
 */
export type FixedTradeIncome = Readonly<{
  description: string,
  type: ColonyBenefit,
  quantity: number,
  resource?: Resource,
}>;

export type ColonyMetadata = Readonly<{
  module?: GameModule; // TODO(kberg): attach gameModule to the server colonies themselves.
  name: ColonyName;
  build: Benefit<Array<number>, Resource>, // Default is [1,1,1]
  trade: Benefit<Array<number>, OneOrArray<Resource>, OneOrArray<ColonyBenefit>> & {fixed?: FixedTradeIncome}, // Default is [1,1,1,1,1,1,1]
  colony: Benefit<number, Resource>, // Default is 1
  cardResource?: CardResource,
  /**
   * The tile's printed flavour line — the sentence under the name on the
   * physical colony tile («Our own moon is the natural gate…»). The console
   * dossier's archive entry (`src/client/colonies/colonyLore.ts`). English IS
   * the i18n key; the Russian lives in `src/locales/<lang>/lore_texts.json`.
   * Co-located with the colony (never a central table) so an upstream change
   * to the colony lands in the same diff. Optional: a colony without one
   * renders the honest «no archive entry» fallback.
   */
  lore?: string,
  expansion: Expansion | undefined,

  /**
   * If the player may increase the colony track, this determines whether to ask the player.
   *
   * Colonies that give resources should be set to 'yes' since they'll typically get more resources the higher
   * the track goes.
   *
   * Colonies should be set to 'no' when the the reward is worse the higher the track goes. (This is limited to Titania.)
   *
   * Mercury and Hygeia give _different_ rewards at different levels of the track, so it is worth asking the player whether
   * to move up the track.
   */
  shouldIncreaseTrack: 'yes' | 'no' | 'ask'
}>;

type InputBenefit<T extends Benefit<any, any, any>> = {
  description: string,
  type: T['type'],
  quantity?: T['quantity'],
  resource?: T['resource'],
}
// {[P in Exclude<keyof T, 'quantity'>]: T[P]} &
// {quantity?: T['quantity']};

export type InputColonyMetadata = {
  module?: ColonyMetadata['module'],
  name: ColonyMetadata['name'];
  build: InputBenefit<ColonyMetadata['build']>,
  trade: InputBenefit<ColonyMetadata['trade']> & {fixed?: FixedTradeIncome},
  colony: InputBenefit<ColonyMetadata['colony']>,
  cardResource?: CardResource,
  lore?: string,
  expansion?: Expansion,
} & Partial<{
  shouldIncreaseTrack: ColonyMetadata['shouldIncreaseTrack'],
}>;

const DEFAULT_BUILD_QUANTITY = [1, 1, 1];
const DEFAULT_TRADE_QUANTITY = [1, 1, 1, 1, 1, 1, 1];

export function benefitMetadata<S, T, K = ColonyBenefit>(partial: InputBenefit<Benefit<S, T, K>>, defaultQuantity: S): Benefit<S, T, K> {
  return {
    ...partial,
    quantity: partial.quantity ?? defaultQuantity,
  };
}

/** The benefit KIND at one track position of a per-position `type`. */
export function benefitTypeAt(type: OneOrArray<ColonyBenefit>, position: number): ColonyBenefit {
  if (!Array.isArray(type)) {
    return type;
  }
  const last = type.length - 1;
  return type[Math.min(Math.max(position, 0), last)];
}

/** The trade income at ONE track position, every per-position field resolved. */
export type TradeBenefitAt = {
  type: ColonyBenefit;
  quantity: number;
  resource: Resource | undefined;
};

/**
 * THE ONE READING of a colony's trade income at a track position — the kind,
 * the amount and the standard resource, each of which may vary along the
 * track. The server pays exactly this (`Colony.handleTrade`), the preview
 * plans it, and every client surface draws it; none may index the arrays
 * itself, because a reader that resolves the resource but not the kind shows
 * the Redux Pluto paying «3 cards» where the tile prints three data.
 */
export function tradeBenefitAt(metadata: ColonyMetadata, position: number): TradeBenefitAt {
  const trade = metadata.trade;
  const last = trade.quantity.length - 1;
  const pos = Math.min(Math.max(position, 0), last);
  const resource = Array.isArray(trade.resource) ? trade.resource[pos] : trade.resource;
  return {
    type: benefitTypeAt(trade.type, pos),
    quantity: trade.quantity[pos] ?? 0,
    resource,
  };
}

/**
 * The FIXED part of the trade income — what EVERY trade here pays before the
 * marker's bonus (see {@link FixedTradeIncome}); undefined for a tile whose
 * whole income is the marker's. The one reading, beside `tradeBenefitAt`.
 */
export function tradeFixedIncome(metadata: ColonyMetadata): FixedTradeIncome | undefined {
  return metadata.trade.fixed;
}

/** Every DISTINCT kind the trade track pays, in track order (one entry for a uniform track). */
export function tradeBenefitTypes(metadata: ColonyMetadata): ReadonlyArray<ColonyBenefit> {
  const type = metadata.trade.type;
  if (!Array.isArray(type)) {
    return [type];
  }
  const out: Array<ColonyBenefit> = [];
  for (const kind of type) {
    if (!out.includes(kind)) {
      out.push(kind);
    }
  }
  return out;
}

export function colonyMetadata(partial: InputColonyMetadata): ColonyMetadata {
  return {
    expansion: partial.expansion,
    shouldIncreaseTrack: 'yes',
    ...partial,
    build: benefitMetadata(partial.build, DEFAULT_BUILD_QUANTITY),
    trade: benefitMetadata(partial.trade, DEFAULT_TRADE_QUANTITY),
    colony: benefitMetadata(partial.colony, 1),
  };
}
