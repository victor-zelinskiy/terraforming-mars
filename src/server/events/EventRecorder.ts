import {Color} from '../../common/Color';
import {Phase} from '../../common/Phase';
import {CardName} from '../../common/cards/CardName';
import {SpaceId} from '../../common/Types';
import {TileType} from '../../common/TileType';
import {Space} from '../boards/Space';
import {ColonyName} from '../../common/colonies/ColonyName';
import {GlobalParameter} from '../../common/GlobalParameter';
import {Resource, StandardResource} from '../../common/Resource';
import {GameEvent, GameEventType, EventTrigger, EventVisibility, EventTag, JournalEntryRole, JournalActionCategory} from '../../common/events/GameEvent';
import {EventSource} from '../../common/events/EventSource';
import {EventImpact} from '../../common/events/EventImpact';
import {From, isFromPlayer} from '../logs/From';
import {fromToEventSource} from './fromToEventSource';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {CardType} from '../../common/cards/CardType';

// Minimal structural view of the game (avoids a circular Game import).
type GameClock = {generation: number; phase: Phase};

/**
 * A live correlation scope. NOT serialized. Captured by reference at
 * `game.defer()` time and restored when the deferred action runs, so an effect
 * deferred inside an action still links to that action's chain. `triggerEmitted`
 * is mutated in place (shared between the capturing deferred and the scope) so
 * a lazy `effect-triggered` marker is emitted exactly once, on first impact.
 */
type EventContext = {
  rootId: number | undefined; // correlationId; undefined until the first event resolves it
  parentId: number | undefined;
  source: EventSource | undefined;
  playerColor: Color | undefined;
  kind: 'action' | 'effect' | 'copied' | 'source';
  trigger: EventTrigger | undefined;
  triggerEmitted: boolean;
  // Whether this action/copied scope has already produced its header log
  // (the first log → 'root-action', the rest → 'detail'). Unused for effects.
  rootLogEmitted: boolean;
  // The journal category stamped on this scope's root-action log.
  category: JournalActionCategory | undefined;
};

/** Opaque handle a deferred action carries so its impact links to the live chain. */
export type CapturedEventContext = EventContext;

type RecordInput = {
  type: GameEventType;
  source?: EventSource;
  player?: Color;
  target?: {player?: Color; card?: CardName};
  trigger?: EventTrigger;
  impact: EventImpact;
  space?: SpaceId;
  tile?: TileType;
  visibility?: EventVisibility;
  tags?: ReadonlyArray<EventTag>;
  category?: JournalActionCategory;
};

export class EventRecorder {
  private seq = 0;
  public readonly events: Array<GameEvent> = [];
  private stack: Array<EventContext> = [];

  constructor(private game: GameClock) {}

  private get current(): EventContext | undefined {
    return this.stack[this.stack.length - 1];
  }

  // ───────────────────────── core record ─────────────────────────

  private emit(input: RecordInput, ctx: EventContext | undefined, correlationOverride?: number): GameEvent {
    const id = ++this.seq;
    const event: GameEvent = {
      id,
      generation: this.game.generation,
      phase: this.game.phase,
      type: input.type,
      impact: input.impact,
      correlationId: correlationOverride ?? ctx?.rootId ?? id,
      visibility: input.visibility ?? 'analytics',
    };
    const source = input.source ?? ctx?.source;
    if (source !== undefined) {
      event.source = source;
    }
    const player = input.player ?? ctx?.playerColor;
    if (player !== undefined) {
      event.player = player;
    }
    if (input.target !== undefined) {
      event.target = input.target;
    }
    if (input.space !== undefined) {
      event.space = input.space;
    }
    if (input.tile !== undefined) {
      event.tile = input.tile;
    }
    if (input.trigger !== undefined) {
      event.trigger = input.trigger;
    }
    if (input.tags !== undefined) {
      event.tags = input.tags;
    }
    if (input.category !== undefined) {
      event.category = input.category;
    }
    if (ctx?.parentId !== undefined) {
      event.parentId = ctx.parentId;
    }
    this.events.push(event);
    return event;
  }

  /**
   * Record an impact event under the current scope. If the scope is an effect
   * whose trigger marker hasn't been emitted yet, emit it first (lazily) so a
   * no-op hook leaves no trace while a firing hook gets a single
   * `effect-triggered` parent.
   */
  private record(input: RecordInput): GameEvent {
    const ctx = this.current;
    if (ctx !== undefined) {
      this.ensureTriggerMarker(ctx);
      // Mark impacts produced INSIDE a passive-effect scope, so the effects overlay
      // can aggregate per card EXCLUDING on-play / action gains (a card's immediate
      // `behavior` bonus runs under an 'action' scope, NOT 'effect').
      if (ctx.kind === 'effect' && input.tags?.includes('passive-effect') !== true) {
        input = {...input, tags: [...(input.tags ?? []), 'passive-effect']};
      }
    }
    return this.emit(input, this.current);
  }

  /**
   * For an effect scope whose `effect-triggered` marker hasn't been emitted yet,
   * emit it now (lazily) so a no-op hook leaves no trace while a firing hook
   * gets exactly one marker — whether it fires via an impact event OR a log.
   */
  private ensureTriggerMarker(ctx: EventContext): void {
    if (ctx.kind === 'effect' && ctx.triggerEmitted === false) {
      const marker = this.emit(
        {type: 'effect-triggered', source: ctx.source, player: ctx.playerColor, trigger: ctx.trigger, impact: {}, tags: ['passive-effect']},
        {...ctx, triggerEmitted: true}); // emit the marker under the PARENT of the effect scope
      if (ctx.rootId === undefined) {
        ctx.rootId = marker.id;
        marker.correlationId = marker.id;
      }
      ctx.parentId = marker.id;
      ctx.triggerEmitted = true;
    }
  }

  /**
   * Bridge a {@link LogMessage} to the live correlation chain so the journal can
   * group "action → effect → result" by `correlationId` (a structured field),
   * NOT by parsing the message text. Stamps nothing for an ungrouped log (no
   * active scope) → it renders flat, exactly as today.
   */
  public stampJournal(log: {correlationId?: number; parentId?: number; role?: JournalEntryRole; category?: JournalActionCategory}): void {
    const ctx = this.current;
    if (ctx === undefined) {
      return;
    }
    this.ensureTriggerMarker(ctx);
    if (ctx.rootId !== undefined) {
      log.correlationId = ctx.rootId;
    }
    if (ctx.parentId !== undefined) {
      log.parentId = ctx.parentId;
    }
    if (ctx.kind === 'effect') {
      log.role = 'effect-result';
    } else if (ctx.rootLogEmitted === false) {
      log.role = 'root-action';
      log.category = ctx.category;
      ctx.rootLogEmitted = true;
    } else {
      log.role = 'detail';
    }
  }

  // ───────────────────────── scopes ─────────────────────────

  /** Begin a top-level player action (card play, blue-card action, standard project). */
  public beginAction(player: IPlayer, source: EventSource | undefined, opts?: {category?: JournalActionCategory; visibility?: EventVisibility}): void {
    const root = this.emit(
      {type: 'action', source, player: player.color, impact: {}, visibility: opts?.visibility ?? 'journal', tags: source?.kind === 'corporation' ? ['corporation'] : undefined, category: opts?.category},
      this.current);
    this.stack.push({rootId: root.id, parentId: root.id, source, playerColor: player.color, kind: 'action', trigger: undefined, triggerEmitted: true, rootLogEmitted: false, category: opts?.category});
  }

  /**
   * Begin a copied/repeated action (VIRON, Project Inspection). Emits an eager
   * `copied-action` marker (we know the corp is acting and which card it
   * copies) and roots the copied impact at it — so corp-impact aggregation
   * attributes the copied card's gains to the copying corporation even across
   * the card-pick input boundary.
   */
  public beginCopiedAction(player: IPlayer, source: EventSource, copiedCard: ICard): void {
    const ctx = this.current;
    const marker = this.emit(
      {type: 'copied-action', source, player: player.color, target: {card: copiedCard.name}, impact: {}, visibility: 'journal', tags: ['corporation', 'copy'], category: 'copied-action'},
      ctx);
    const rootId = ctx?.rootId ?? marker.id;
    if (ctx?.rootId === undefined) {
      marker.correlationId = marker.id;
    }
    this.stack.push({rootId, parentId: marker.id, source, playerColor: player.color, kind: 'copied', trigger: undefined, triggerEmitted: true, rootLogEmitted: false, category: 'copied-action'});
  }

  /** Begin a passive-effect scope (lazy: nothing is emitted unless the hook acts). */
  public beginEffect(player: IPlayer, source: EventSource | undefined, trigger: EventTrigger): void {
    const parent = this.current;
    this.stack.push({rootId: parent?.rootId, parentId: parent?.parentId, source, playerColor: player.color, kind: 'effect', trigger, triggerEmitted: false, rootLogEmitted: true, category: undefined});
  }

  public endScope(): void {
    this.stack.pop();
  }

  /** Run `fn` wrapped in a passive-effect scope. */
  public withEffect<T>(player: IPlayer, sourceCard: ICard, trigger: EventTrigger, fn: () => T): T {
    const kind = sourceCard.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.beginEffect(player, {kind, card: sourceCard.name, owner: player.color}, trigger);
    try {
      return fn();
    } finally {
      this.endScope();
    }
  }

  /**
   * Run `fn` with an explicit source OVERRIDE for nested mutations that carry no
   * `from` of their own — e.g. space-bonus or ocean-adjacency resource gains,
   * which should read as "Бонус клетки" / "Бонус океанов" rather than be
   * attributed to the surrounding action. Same correlation chain; logs inside
   * stay 'detail'.
   */
  public withSource<T>(source: EventSource, fn: () => T): T {
    const parent = this.current;
    this.stack.push({
      rootId: parent?.rootId, parentId: parent?.parentId, source, playerColor: parent?.playerColor,
      kind: 'source', trigger: undefined, triggerEmitted: true, rootLogEmitted: true, category: undefined,
    });
    try {
      return fn();
    } finally {
      this.endScope();
    }
  }

  /** Record a tile placement (carries the space for "show on map" + the tile type). */
  public recordTilePlaced(player: IPlayer, space: Space, tile: TileType): void {
    this.record({type: 'tile-placed', player: player.color, impact: {tilesPlaced: 1}, space: space.id, tile, tags: ['terraforming']});
  }

  /** Run `fn` (the copied card's action) wrapped in a copied-action scope. */
  public withCopiedAction<T>(player: IPlayer, corp: ICard, copiedCard: ICard, fn: () => T): T {
    const kind = corp.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.beginCopiedAction(player, {kind, card: corp.name, owner: player.color}, copiedCard);
    try {
      return fn();
    } finally {
      this.endScope();
    }
  }

  // ───────────────── deferred correlation propagation ─────────────────

  /** Snapshot the live scope (by reference) for a deferred action to carry. */
  public captureContext(): EventContext | undefined {
    return this.current;
  }

  /** Restore a captured scope around a deferred action's execution. */
  public runWithContext<T>(ctx: EventContext | undefined, fn: () => T): T {
    if (ctx === undefined) {
      return fn();
    }
    this.stack.push(ctx);
    try {
      return fn();
    } finally {
      this.stack.pop();
    }
  }

  // ───────────────────────── chokepoint helpers ─────────────────────────

  private hasContext(): boolean {
    return this.current !== undefined;
  }

  /** The source of the active action/effect scope, if any — used to attribute a
   *  TR gain to the card/corp/effect currently executing (for the score breakdown). */
  public currentSource(): EventSource | undefined {
    return this.current?.source;
  }

  public recordResourceDelta(player: IPlayer, resource: Resource | StandardResource, amount: number, production: boolean, from?: From, stealing?: boolean, after?: number): void {
    if (amount === 0) {
      return;
    }
    const source = fromToEventSource(from, player.color);
    // A cross-player LOSS inflicted via another player's `from` is always an
    // attack the VICTIM must be told about (the "you were attacked" red card).
    // Never drop it as loose bookkeeping even if the active scope was lost across
    // an input boundary (e.g. a deferred attack resolved after a SelectPlayer) —
    // the `target` below still attributes the attacker.
    const crossPlayerAttack = amount < 0 && isFromPlayer(from) && from.player.color !== player.color;
    // Loose internal bookkeeping (no source, no active action/effect) is not analytics-meaningful.
    if (source === undefined && !this.hasContext() && !crossPlayerAttack) {
      return;
    }
    const impact: EventImpact = production ?
      {production: {[resource]: amount}} :
      {stock: {[resource]: amount}};
    // Before/after snapshot, captured live (the chokepoint already mutated the value,
    // so `after` is the current value and `before = after − amount`). Lets a loss read
    // "plants 506 → 504", not just "−2".
    if (after !== undefined) {
      impact.snapshot = {resource, scope: production ? 'production' : 'stock', before: after - amount, after};
    }
    const target = stealing && from !== undefined && 'player' in from ? {player: from.player.color} : undefined;
    this.record({
      type: production ? 'production-changed' : 'resource-changed',
      source, player: player.color, target, impact,
      tags: production ? ['production'] : undefined,
    });
  }

  /**
   * Record a PUBLIC card reveal / show / search (PublicPlans shows hand, SearchForLife
   * / AsteroidDeflectionSystem reveal the deck top) — counts + semantics ONLY, never
   * card names (so nothing private leaks; the public names ride the log's CARD tokens).
   * Attributed to the source card under the active scope. Tagged `reveal` (analytics-
   * only — excluded from the journal, which already shows the reveal via its log).
   * NEVER called for a private draw, so a private draw can't become a public fact.
   */
  public recordCardReveal(player: IPlayer, source: ICard, reveal: {origin: 'deck' | 'hand'; result: 'discarded' | 'shown' | 'kept' | 'revealed'; count: number; found?: boolean}): void {
    if (reveal.count <= 0) {
      return;
    }
    const kind = source.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.emit({
      type: 'card-revealed',
      source: {kind, card: source.name, owner: player.color},
      player: player.color,
      impact: {reveal},
      tags: ['reveal'],
    }, this.current);
  }

  public recordCardResourceDelta(player: IPlayer, card: ICard, amount: number, from?: From): void {
    if (amount === 0 || card.resourceType === undefined) {
      return;
    }
    const source = fromToEventSource(from, player.color);
    if (source === undefined && !this.hasContext()) {
      return;
    }
    this.record({
      type: 'card-resource-changed',
      source, player: player.color,
      impact: {cardResources: [{cardResource: card.resourceType, target: card.name, amount}]},
      tags: ['card-impact'],
    });
  }

  public recordTrDelta(player: IPlayer, steps: number, from?: From): void {
    if (steps === 0) {
      return;
    }
    const source = fromToEventSource(from, player.color);
    if (source === undefined && !this.hasContext()) {
      return;
    }
    this.record({type: 'tr-changed', source, player: player.color, impact: {tr: steps}, tags: ['terraforming']});
  }

  public recordCardsDrawn(player: IPlayer, count: number, from?: From): void {
    if (count === 0) {
      return;
    }
    const source = fromToEventSource(from, player.color);
    if (source === undefined && !this.hasContext()) {
      return;
    }
    this.record({type: 'cards-drawn', source, player: player.color, impact: {cardsDrawn: count}});
  }

  /** Record a discount (the M€ saving) applied to a played card / project. A
   *  discount is a passive CARD effect, so it carries the 'passive-effect' tag for
   *  the effects overlay (which excludes on-play / action gains). */
  public recordDiscount(player: IPlayer, source: EventSource, saved: number, target?: CardName): void {
    if (saved <= 0) {
      return;
    }
    this.record({
      type: 'discount-applied',
      source, player: player.color,
      target: target !== undefined ? {card: target} : undefined,
      impact: {megacreditsSaved: saved},
      tags: source.kind === 'corporation' ? ['discount', 'corporation', 'passive-effect'] : ['discount', 'passive-effect'],
    });
  }

  /**
   * Record a CARD RESOURCE spent as payment (Psychrophiles microbes @2 M€, Carbon
   * Nanosystems graphene @4 M€, Dirigibles floaters @3 M€, …) — a passive-effect
   * saving attributed to the SOURCE card. Tracked SEPARATELY from accumulation
   * (`cardResourcesSpentAsPayment`, not `cardResources`) so the effect overlay can
   * show "used as payment" + its M€ value distinctly from "added to the card".
   */
  public recordResourceAsPayment(player: IPlayer, card: ICard, amount: number, megacredits: number): void {
    if (amount <= 0 || card.resourceType === undefined) {
      return;
    }
    const kind = card.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.emit({
      type: 'resource-changed',
      source: {kind, card: card.name, owner: player.color},
      player: player.color,
      impact: {
        megacreditsSaved: megacredits,
        cardResourcesSpentAsPayment: [{cardResource: card.resourceType, amount}],
      },
      tags: ['passive-effect', 'resource-payment'],
    }, this.current);
  }

  /**
   * Record HEAT spent as M€ via Helion's "use heat as M€" ability
   * (`canUseHeatAsMegaCredits`) — a passive-effect M€ saving attributed to the
   * granting card. Heat is a STOCK resource (not a CardResource), so only
   * `megacreditsSaved` is tracked (each heat = 1 M€ substituted); the effects
   * overlay then shows the corporation ability actually performed rather than
   * "hasn't triggered yet". Mirrors {@link recordResourceAsPayment} but for the
   * stock-resource case (which that method's `resourceType` guard excludes).
   */
  public recordHeatAsPayment(player: IPlayer, card: ICard, heat: number): void {
    if (heat <= 0) {
      return;
    }
    const kind = card.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.emit({
      type: 'resource-changed',
      source: {kind, card: card.name, owner: player.color},
      player: player.color,
      impact: {megacreditsSaved: heat},
      tags: ['passive-effect', 'resource-payment'],
    }, this.current);
  }

  /**
   * Record the EXTRA M€ value a payment-VALUE modifier (Advanced Alloys +1 steel &
   * titanium, Rego Plastics +1 steel, PhoboLog +1 titanium, …) contributed to a
   * single payment — attributed to the OWNING card. `entries` are the per-resource
   * bonuses this ONE card gave in this payment (steel and/or titanium), so a card
   * that boosts both (Advanced Alloys) records ONE event = ONE "payment touched".
   * Overlay-analytics only (excluded from the journal route): the journal already
   * shows the actual spend; this is the HIDDEN value the modifier added.
   */
  public recordPaymentValueBonus(player: IPlayer, card: ICard, entries: ReadonlyArray<{resource: 'steel' | 'titanium'; amountSpent: number; bonusValue: number}>): void {
    const useful = entries.filter((e) => e.amountSpent > 0 && e.bonusValue > 0);
    if (useful.length === 0) {
      return;
    }
    const kind = card.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.emit({
      type: 'resource-changed',
      source: {kind, card: card.name, owner: player.color},
      player: player.color,
      impact: {paymentValueBonus: useful},
      tags: ['passive-effect', 'payment-bonus'],
    }, this.current);
  }

  /**
   * Record a TRADE-OFFSET effect (Trading Colony) advancing a colony track by
   * `steps` before a trade — attributed to the OWNING card. `extraReward` is the
   * EXACT extra trade-reward units the bump produced (its M€ value is intentionally
   * not estimated). Emitted as an `effect-triggered` so the passive effect's
   * trigger count reflects it; overlay-analytics only (excluded from the journal,
   * which already logs the track increase as text).
   */
  public recordColonyTrackBonus(player: IPlayer, card: ICard, colony: ColonyName, steps: number, extraReward: number): void {
    if (steps <= 0) {
      return;
    }
    const kind = card.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.emit({
      type: 'effect-triggered',
      source: {kind, card: card.name, owner: player.color},
      player: player.color,
      impact: {colonyTrackAdvanced: [{colony, steps, extraReward}]},
      tags: ['passive-effect', 'colony-track', 'engine'],
    }, this.current);
  }

  /**
   * Record a TRADE-DISCOUNT effect (Cryo-Sleep / Rim Freighters) saving trade
   * resources on a trade, attributed to the OWNING card. `amount` is the EXACT units
   * of `resource` saved. Overlay-analytics only (the trade fee is already logged).
   */
  public recordTradeDiscount(player: IPlayer, card: ICard, colony: ColonyName, resource: 'energy' | 'titanium' | 'megacredits', amount: number): void {
    if (amount <= 0) {
      return;
    }
    const kind = card.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.emit({
      type: 'effect-triggered',
      source: {kind, card: card.name, owner: player.color},
      player: player.color,
      impact: {tradeDiscountSaved: [{colony, resource, amount}]},
      tags: ['passive-effect', 'trade-discount', 'engine'],
    }, this.current);
  }

  /**
   * Record a GREENERY-DISCOUNT effect (EcoLine — `behavior.greeneryDiscount`) saving
   * `plants` on ONE plants→greenery conversion (you pay fewer than the base 8),
   * attributed to the OWNING card. `plants` is EXACT (the card's per-conversion
   * discount); one event = one conversion under the effect. Overlay-analytics only
   * (excluded from the journal — the conversion itself is already logged).
   */
  public recordGreeneryDiscount(player: IPlayer, card: ICard, plants: number): void {
    if (plants <= 0) {
      return;
    }
    const kind = card.type === CardType.CORPORATION ? 'corporation' : 'card';
    this.emit({
      type: 'effect-triggered',
      source: {kind, card: card.name, owner: player.color},
      player: player.color,
      impact: {greeneryDiscountSaved: plants},
      tags: ['passive-effect', 'greenery-discount', 'engine'],
    }, this.current);
  }

  /**
   * Record a global-parameter raise (oxygen / temperature / oceans / venus) under
   * the active scope, so the source card / action / standard project is attributed
   * the parameter steps it moved (the "who terraformed the planet" feed). The TR
   * itself is recorded separately by `recordTrDelta`. Tagged `global-parameter`
   * (analytics-only — excluded from the journal, which shows the TR + tile); the
   * `record()` chokepoint adds `passive-effect` automatically inside an effect scope.
   */
  public recordGlobalParameterChange(player: IPlayer, parameter: GlobalParameter, steps: number): void {
    if (steps <= 0) {
      return;
    }
    this.record({
      type: 'global-parameter-changed',
      player: player.color,
      impact: {globalParameter: {parameter, steps}},
      tags: ['global-parameter'],
    });
  }

  /** Record what was actually paid for a card / project. */
  public recordPayment(player: IPlayer, paid: number, target: CardName): void {
    this.record({type: 'payment', player: player.color, target: {card: target}, impact: {megacreditsPaid: paid}});
  }

  // ───────────────────────── serialization ─────────────────────────

  public get sequence(): number {
    return this.seq;
  }

  public serialize(): {events: Array<GameEvent>; seq: number} {
    return {events: this.events, seq: this.seq};
  }

  public restore(events: ReadonlyArray<GameEvent> | undefined, seq: number | undefined): void {
    // Copy first: `events` may alias `this.events` (serialize() returns the live
    // array), and clearing before copying would empty the input.
    const copy = events === undefined ? [] : [...events];
    this.events.length = 0;
    this.events.push(...copy);
    this.seq = seq ?? this.events.reduce((max, e) => Math.max(max, e.id), 0);
    this.stack = [];
  }
}
