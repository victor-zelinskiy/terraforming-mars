import {Units} from '../Units';
import {CardResource} from '../CardResource';
import {GlobalParameter} from '../GlobalParameter';
import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';

/**
 * FACTUAL impact of a {@link GameEvent}. Facts only — never an estimated
 * "M€ equivalent" valuation. Turning facts into a value score is a SEPARATE
 * layer (see `valuation()` in the client analytics), so the persisted stream
 * stays objective and reproducible while valuation heuristics can change
 * without a data migration.
 *
 * All numeric deltas are SIGNED (a loss is negative). Empty fields are omitted.
 */
export type EventImpact = {
  /** Standard resource stock change (signed). */
  stock?: Partial<Units>;
  /** Production change (signed). */
  production?: Partial<Units>;
  /** Card-resource (microbe/animal/floater/asteroid/…) additions/removals. */
  cardResources?: ReadonlyArray<{cardResource: CardResource; target?: CardName; amount: number}>;
  /** Terraform Rating change (signed). */
  tr?: number;
  /** Global-parameter steps moved (temperature/oxygen/oceans/venus). */
  globalParameter?: {parameter: GlobalParameter; steps: number};
  /** Cards drawn. */
  cardsDrawn?: number;
  /** Cards discarded. */
  cardsDiscarded?: number;
  /** Direct VP grant (rare mid-game; most VP is computed at endgame). */
  vp?: number;
  /** Tiles placed on a board. */
  tilesPlaced?: number;
  /** M€ actually paid (payment events). */
  megacreditsPaid?: number;
  /**
   * M€ saved by a discount OR by spending a card resource as payment (the SAVING,
   * not the spend). The "hidden value" the effect overlay surfaces — populated by
   * `discount-applied` events and by resource-as-payment events (Psychrophiles
   * microbes, Carbon Nanosystems graphene, …), never inferred from a stock delta.
   */
  megacreditsSaved?: number;
  /**
   * Card resources SPENT as payment (Psychrophiles microbes worth 2 M€, Carbon
   * Nanosystems graphene worth 4 M€, …) — tracked SEPARATELY from accumulation
   * (`cardResources`) so the effect overlay shows "used as payment" distinctly
   * from "added to the card".
   */
  cardResourcesSpentAsPayment?: ReadonlyArray<{cardResource: CardResource; amount: number}>;
  /**
   * EXTRA value a payment-VALUE modifier contributed when paying — a standard
   * resource (steel/titanium) worth MORE than its base (Advanced Alloys +1 steel
   * & titanium, Rego Plastics +1 steel, PhoboLog +1 titanium, …). `amountSpent` is
   * how many of that resource were spent in this payment; `bonusValue` is the EXTRA
   * M€ value the modifier added (`amountSpent × the card's per-unit bonus`). This is
   * an EXACT economic saving (each +1 modifier makes each unit worth 1 more M€),
   * attributed to the OWNING card — the hidden value the effect overlay surfaces as
   * "payment value bonus" (also folded into `megacreditsSaved` for economy totals).
   */
  paymentValueBonus?: ReadonlyArray<{resource: 'steel' | 'titanium'; amountSpent: number; bonusValue: number}>;
  /**
   * Colony-track steps a TRADE-OFFSET effect (Trading Colony) advanced BEFORE a
   * trade — the card's whole value is that "+1 track step before you trade here".
   * `steps` is the advance (EXACT); `extraReward` is the EXACT extra trade-reward
   * units the bump produced (`quantity[after] − quantity[before]` of the colony's
   * trade resource — its M€ value is intentionally NOT estimated, see the confidence
   * note in effectSummary). Attributed to the owning card via a `colony` target.
   */
  colonyTrackAdvanced?: ReadonlyArray<{colony: ColonyName; steps: number; extraReward: number}>;
};
