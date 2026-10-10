import {Units} from '../Units';
import {CardResource} from '../CardResource';
import {GlobalParameter} from '../GlobalParameter';
import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';
import {ColonyRosterChange} from '../colonies/ColonyRoster';
import {AdjacencyVpChange, TileMoveFact} from '../boards/TileMove';
import {RevealOrigin, RevealResult} from '../logs/RevealLogMeta';
import {PartyName} from '../turmoil/PartyName';
import {AgendaAdvanceReason, AgendaAdvanceStep} from '../parliament/ParliamentTypes';

/**
 * WHY a card-resource amount is what it is, when a RULE counted it — «1 data
 * for each adjacent city» paid 3 (Turmoil Redux TR21 Arboretum):
 * `{count: 3, unitKey: 'adjacent {city|cities}'}`. The journal prints «· for 3
 * adjacent cities» beside the chip, so the number explains itself. `unitKey`
 * is an English i18n key whose plural group agrees with `count`; shared by
 * every later «for each X» payout — never a per-card field.
 */
export type CardResourceBasis = {count: number; unitKey: string};

/**
 * FACTUAL impact of a {@link GameEvent}. Facts only — never an estimated
 * "M€ equivalent" valuation. Turning facts into a value score is a SEPARATE
 * layer (see `valuation()` in the client analytics), so the persisted stream
 * stays objective and reproducible while valuation heuristics can change
 * without a data migration.
 *
 * All numeric deltas are SIGNED (a loss is negative). Empty fields are omitted.
 */
/** THE ROAD a party's effect came or went by (`EventImpact.partyEffect`). */
export type PartyEffectBasis = 'ruling' | 'delegates' | 'card';

export type EventImpact = {
  /** Standard resource stock change (signed). */
  stock?: Partial<Units>;
  /** Production change (signed). */
  production?: Partial<Units>;
  /** Card-resource (microbe/animal/floater/asteroid/…) additions/removals. */
  cardResources?: ReadonlyArray<{cardResource: CardResource; target?: CardName; amount: number; basis?: CardResourceBasis}>;
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
  /**
   * `tile-placed` only — the tile was placed ON A COLONY TILE, and this is the
   * colony tile (Turmoil Redux TR22 Nova City). The event's `space` is then a
   * HOSTED cell (`common/boards/hostedSpaces.ts`): it has no place on the
   * board, so the journal names the colony tile instead of offering «show on
   * map». Absent for every placement on the board.
   */
  colonyTile?: ColonyName;
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
  /**
   * Trade resources a TRADE-DISCOUNT effect (Cryo-Sleep / Rim Freighters —
   * `behavior.colonies.tradeDiscount`) saved on a trade (you pay N fewer of the trade
   * resource). `amount` is the EXACT units saved of `resource` (energy/titanium/M€) on
   * a trade with `colony` — or with the fleet-dock card `dock` (a trade whose
   * destination is a card pays the same fee, so the same discount saves on it;
   * exactly one of the two is set). Attributed to the owning card. Only titanium/M€
   * have a clean M€ value, so the saving is shown in resource units (confidence partial).
   */
  tradeDiscountSaved?: ReadonlyArray<{colony?: ColonyName; dock?: CardName; resource: 'energy' | 'titanium' | 'megacredits'; amount: number}>;
  /**
   * Plants a GREENERY-DISCOUNT effect (EcoLine — `behavior.greeneryDiscount`) saved on
   * ONE plants→greenery conversion (you pay N fewer plants than the base 8). `plants` is
   * the EXACT plants saved (the card's per-conversion discount); one event = one
   * conversion under the effect. Attributed to the owning card — the hidden value the
   * effect overlay surfaces as "greenery discount" (EXACT, in plant units).
   */
  greeneryDiscountSaved?: number;
  /**
   * A PUBLIC card reveal / show / search (PublicPlans shows hand, SearchForLife /
   * AsteroidDeflectionSystem reveal the deck top). Carries ONLY counts + semantics —
   * NEVER card names (so it leaks nothing private; the names that ARE public ride the
   * log's CARD tokens). `found` flags a successful search (a deck reveal that matched).
   */
  reveal?: {origin: RevealOrigin; result: RevealResult; count: number; found?: boolean};
  /**
   * ONE committed movement on the Delta Project («Гидросеть») track — the
   * canonical machine-readable position fact (`delta-position-changed`).
   * `steps` is SIGNED (`to - from`): negative = the marker was pushed BACK
   * (Corporate Espionage). The mover is the event's `player`; for an attack
   * the acting player rides `target.player` + `source.owner`. Emitted by the
   * movement ledger for every commit, so the victim's notification and a
   * future journal read positions off THIS — never off a localized log line.
   */
  deltaPosition?: {from: number; to: number; steps: number};
  /**
   * A Modular Floodgates blockade fact (`delta-blockade-changed`): the
   * event's `player` is the BLOCKED one; for `phase: 'placed'` the deployer
   * rides `target.player` + `source.owner` (the attack grammar every
   * cross-player event uses). `untilGeneration` names the boundary the
   * blockade is removed at (the start of that generation). `'expired'` is
   * the quiet journal fact of that removal — never a notification.
   */
  deltaBlockade?: {phase: 'placed' | 'expired'; untilGeneration: number};
  /**
   * Before/after snapshot of the SINGLE resource a stock / production delta moved —
   * captured AT the event from live state (`before = after − amount`), so a loss can
   * read "plants 506 → 504" not just "−2". Only the affected resource; attached by the
   * resource/production chokepoint when the value is known (the most important attack /
   * loss cases). Absent where the live value wasn't threaded (documented partial).
   */
  snapshot?: {resource: string; scope: 'stock' | 'production'; before: number; after: number};
  /**
   * Delegates an EFFECT placed on a resolution of the voting area
   * (`delegates-placed`): `count` cubes of the event's `player`, onto the
   * resolution `resolution` (a catalog id — the client names it through the
   * parliament manifest, never from a log line).
   */
  delegates?: {
    count: number;
    resolution: string;
    /**
     * The cubes are the NEUTRAL player's (`neutral-delegates-placed`, Turmoil
     * Redux TR31): the chip is the dark figure, never the event player's own
     * colour — the player is whose effect it was, the delegate is nobody's.
     */
    neutral?: true;
  };
  /**
   * Neutral delegates an EFFECT added to a party's Popular Support
   * (`popular-support-gained`): how many landed and what the area holds now.
   * SIGNED: its pair `popular-support-discarded` (TR12) carries `gained` < 0 —
   * how many left the area for the common supply — and `total` after it.
   */
  popularSupport?: {party: PartyName; gained: number; total: number};
  /**
   * A PARTY'S EFFECT changed hands for the event's seat (`party-effect-gained`
   * / `party-effect-lost`, Turmoil Redux — PL-112): the party and the ROAD the
   * change took — `delegates` (the seat's own cubes on the party's resolution
   * reached / fell under the law's number, `delegates` = that number), or
   * `card` (a grant given / revoked, the card's name in `source`). A gain
   * never names `ruling`: the enactment is told once, for everyone, by the
   * sitting.
   */
  partyEffect?: {party: PartyName; basis: PartyEffectBasis; delegates?: number; source?: string};
  /**
   * A WALK OF THE AGENDA TRACK (`agenda-advanced`, Turmoil Redux): where the
   * marker started and ended, EVERY step in order with the bonus that step
   * paid, and which engine walked it — the sitting's winner step, the chairman
   * quest, or a card (TR04; the card itself rides the event's `source`). One
   * event per walk, written after the last step.
   */
  agenda?: {from: number; to: number; steps: ReadonlyArray<AgendaAdvanceStep>; reason: AgendaAdvanceReason};
  /**
   * A CARD EFFECT MOVED A COLONY TILE'S TRACK (`colony-track-moved`, Turmoil
   * Redux TR07): the tile and the marker's 0-based position before and after.
   * A position fact, never a delta.
   */
  colonyTrackMove?: {colony: ColonyName; before: number; after: number};
  /**
   * THE COLONY ROSTER CHANGED (`colony-roster-changed`): which tile entered,
   * which left, and the slot of the table it happened in — see
   * {@link ColonyRosterChange}. A fact about the TABLE, never a delta.
   */
  colonyRoster?: ColonyRosterChange;
  /**
   * A TILE MOVED BETWEEN TWO CELLS (`tile-moved`, Turmoil Redux TR14): the
   * cell it left, the cell it came to, the tile, and the stack it left
   * shorter — see {@link TileMoveFact}. A position fact, never a delta: it
   * does NOT count as a tile placed.
   */
  tileMove?: TileMoveFact;
  /**
   * THE CAPITALS' RECOUNT (PL-041 / PL-141): an OCEAN placed beside (or removed
   * from beside) somebody's Capital changes that Capital's adjacency VP — a
   * projection the engine already computes, stated on the event that moved it
   * (`tile-placed` for a placement, `tile-removed` for a removal; a MOVE states
   * it on `tileMove.adjacencyVp`). Never a VP mutation: the score stays
   * endgame-computed. Read by the owner's notification and the journal.
   */
  adjacencyVp?: ReadonlyArray<AdjacencyVpChange>;
  /** An effect that could not apply (`effect-skipped`) — see {@link SkippedEffectFact}. Nothing moved. */
  skipped?: SkippedEffectFact;
};

/**
 * WHAT an `effect-skipped` event lost — the after-the-fact twin of the play
 * preview's `warning` note (`skipped: {label, effect}`), in the same
 * vocabulary so the promise and the record read alike: `label` names the
 * effect (the shared `SKIPPED_LABEL` keys), `reason` says why it could not
 * apply (a short i18n key: «No eligible card», «No valid target available»),
 * `effect` is the magnitude it would have moved (a gain on the player's own
 * card, or a cost on someone else's pool), absent when no single magnitude is
 * honest (an either/or attack).
 */
export type SkippedEffectFact = {
  label: string;
  reason: string;
  effect?: {direction: 'gain' | 'cost'; icon: string; amount: number; note?: string};
};
