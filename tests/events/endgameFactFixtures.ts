import {GameEvent, JournalActionCategory} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {EventSource} from '@/common/events/EventSource';
import {Phase} from '@/common/Phase';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {GlobalParameter} from '@/common/GlobalParameter';

/**
 * Synthetic {@link GameEvent} streams for the endgame-analyzer scenarios — the seed
 * of the fixture suite future analyzer modules will be tested against (EVENT_STAT_
 * FOUNDATION.md Iteration 3 §14). Built with a tiny stream builder so each scenario
 * reads as "player did X in generation N"; deterministic (no Date/random), so fact
 * snapshots are stable.
 */
export class FactStream {
  private seq = 0;
  public readonly events: Array<GameEvent> = [];

  private push(e: Omit<GameEvent, 'id' | 'phase' | 'visibility'> & {id?: number}): GameEvent {
    const id = ++this.seq;
    const full: GameEvent = {phase: Phase.ACTION, visibility: 'analytics', ...e, id, correlationId: e.correlationId ?? id};
    this.events.push(full);
    return full;
  }

  /** A root action (card play / blue action / colony trade / standard project). */
  root(opts: {gen: number; player: Color; source: EventSource; category: JournalActionCategory}): number {
    const e = this.push({generation: opts.gen, player: opts.player, type: 'action', source: opts.source, category: opts.category, impact: {}, correlationId: 0});
    e.correlationId = e.id;
    return e.id;
  }

  /** A factual impact child of a root (inherits the root's correlationId). */
  child(opts: {corr: number; gen: number; player: Color; source?: EventSource; type?: GameEvent['type']; impact: EventImpact; target?: {player?: Color}; tags?: GameEvent['tags']}): void {
    this.push({
      generation: opts.gen, player: opts.player, type: opts.type ?? 'resource-changed',
      source: opts.source, impact: opts.impact, correlationId: opts.corr, target: opts.target, tags: opts.tags,
    });
  }
}

const card = (c: CardName, owner: Color): EventSource => ({kind: 'card', card: c, owner});

// ── Scenario 1 — economy engine (discounts + steel/titanium value bonus) ──
export function economyEngineStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  for (let gen = 2; gen <= 5; gen++) {
    const r = s.root({gen, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), category: 'card-play'});
    s.child({corr: r, gen, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), type: 'discount-applied', impact: {megacreditsSaved: 2}, tags: ['discount', 'passive-effect']});
    s.child({corr: r, gen, player: 'red', source: card(CardName.ADVANCED_ALLOYS, 'red'), impact: {paymentValueBonus: [{resource: 'titanium', amountSpent: 3, bonusValue: 3}]}, tags: ['passive-effect', 'payment-bonus']});
  }
  return s.events;
}

// ── Scenario 2 — colony engine (trades + trade discount + track bonus) ──
export function colonyEngineStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  for (let gen = 3; gen <= 6; gen++) {
    const r = s.root({gen, player: 'blue', source: {kind: 'colony', name: ColonyName.CERES}, category: 'colony'});
    s.child({corr: r, gen, player: 'blue', source: card(CardName.TRADING_COLONY, 'blue'), type: 'effect-triggered', impact: {colonyTrackAdvanced: [{colony: ColonyName.CERES, steps: 1, extraReward: 1}]}, tags: ['passive-effect', 'colony-track']});
    s.child({corr: r, gen, player: 'blue', source: card(CardName.CRYO_SLEEP, 'blue'), type: 'effect-triggered', impact: {tradeDiscountSaved: [{colony: ColonyName.CERES, resource: 'energy', amount: 1}]}, tags: ['passive-effect', 'trade-discount']});
  }
  return s.events;
}

// ── Scenario 3 — blue-action engine (one card activated many times) ──
export function blueActionEngineStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  // Played in gen 2.
  s.root({gen: 2, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), category: 'card-play'});
  for (let gen = 3; gen <= 7; gen++) {
    const r = s.root({gen, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), category: 'card-action'});
    s.child({corr: r, gen, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), type: 'cards-drawn', impact: {cardsDrawn: 2}});
  }
  return s.events;
}

// ── Scenario 4 — negative interaction (steal + destroy) ──
export function negativeInteractionStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  // red's action removes blue's plants (destroy: victim event sourced to red's card).
  for (let gen = 4; gen <= 5; gen++) {
    const r = s.root({gen, player: 'red', source: card(CardName.PREDATORS, 'red'), category: 'card-action'});
    s.child({corr: r, gen, player: 'blue', source: card(CardName.PREDATORS, 'red'), impact: {stock: {plants: -2}}});
  }
  // red steals 4 M€ from green (steal: victim event carries target.player = red).
  const r2 = s.root({gen: 6, player: 'red', source: card(CardName.HIRED_RAIDERS, 'red'), category: 'card-play'});
  s.child({corr: r2, gen: 6, player: 'green', source: card(CardName.HIRED_RAIDERS, 'red'), impact: {stock: {megacredits: -4}}, target: {player: 'red'}});
  s.child({corr: r2, gen: 6, player: 'red', source: card(CardName.HIRED_RAIDERS, 'red'), impact: {stock: {megacredits: 4}}});
  return s.events;
}

// ── Scenario 5 — global-parameter pusher (mixed sources) ──
export function globalParameterStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  const raise = (gen: number, source: EventSource, parameter: GlobalParameter, steps: number, category: JournalActionCategory) => {
    const r = s.root({gen, player: 'blue', source, category});
    // The recorder's `record()` inherits the scope source (the card raising it).
    s.child({corr: r, gen, player: 'blue', source, type: 'global-parameter-changed', impact: {globalParameter: {parameter, steps}}, tags: ['global-parameter']});
  };
  raise(2, card(CardName.AI_CENTRAL, 'blue'), GlobalParameter.OXYGEN, 2, 'card-play');
  raise(3, card(CardName.EARTH_CATAPULT, 'blue'), GlobalParameter.TEMPERATURE, 1, 'card-play');
  raise(4, card(CardName.AI_CENTRAL, 'blue'), GlobalParameter.OXYGEN, 1, 'card-action');
  return s.events;
}

// ── Scenario 6 — engine built but never activated ──
export function unusedEngineStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  // An action card played early, then NEVER activated for the rest of the game.
  s.root({gen: 2, player: 'green', source: card(CardName.AI_CENTRAL, 'green'), category: 'card-play'});
  // Some unrelated activity through gen 8 (so finalGeneration = 8).
  for (let gen = 3; gen <= 8; gen++) {
    s.root({gen, player: 'green', source: card(CardName.EARTH_CATAPULT, 'green'), category: 'card-play'});
  }
  return s.events;
}

// ── Scenario 7 — reveal / search card flow (deck reveals, some hits) ──
export function revealSearchStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  for (let gen = 3; gen <= 6; gen++) {
    const r = s.root({gen, player: 'red', source: card(CardName.SEARCH_FOR_LIFE, 'red'), category: 'card-action'});
    // Reveal the deck top; a hit (microbe tag) on even generations.
    s.child({corr: r, gen, player: 'red', source: card(CardName.SEARCH_FOR_LIFE, 'red'), type: 'card-revealed', impact: {reveal: {origin: 'deck', result: 'discarded', count: 1, found: gen % 2 === 0}}, tags: ['reveal']});
  }
  return s.events;
}

// ── Scenario 8 — shown hand / public reveal (PublicPlans) ──
export function shownHandStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  const r = s.root({gen: 4, player: 'blue', source: card(CardName.PUBLIC_PLANS, 'blue'), category: 'card-play'});
  s.child({corr: r, gen: 4, player: 'blue', source: card(CardName.PUBLIC_PLANS, 'blue'), type: 'card-revealed', impact: {reveal: {origin: 'hand', result: 'shown', count: 5}}, tags: ['reveal']});
  s.child({corr: r, gen: 4, player: 'blue', source: card(CardName.PUBLIC_PLANS, 'blue'), impact: {stock: {megacredits: 5}}});
  return s.events;
}

// ── Scenario 9 — production transfer (attacker reduces + takes a victim's production) ──
export function productionTransferStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  const r = s.root({gen: 5, player: 'red', source: card(CardName.HIRED_RAIDERS, 'red'), category: 'card-play'});
  // Victim loses 2 energy production (with a before/after snapshot), marked transfer to red.
  s.child({corr: r, gen: 5, player: 'blue', source: card(CardName.HIRED_RAIDERS, 'red'), type: 'production-changed',
    impact: {production: {energy: -2}, snapshot: {resource: 'energy', scope: 'production', before: 3, after: 1}}, target: {player: 'red'}, tags: ['production']});
  // Attacker gains the 2 energy production.
  s.child({corr: r, gen: 5, player: 'red', source: card(CardName.HIRED_RAIDERS, 'red'), type: 'production-changed', impact: {production: {energy: 2}}, tags: ['production']});
  return s.events;
}

// ── Scenario 10 — late-game economy burst (discounts concentrated late) ──
export function lateEconomyBurstStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  // Small early economy, then a big burst in generation 11.
  const early = s.root({gen: 3, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), category: 'card-play'});
  s.child({corr: early, gen: 3, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), type: 'discount-applied', impact: {megacreditsSaved: 2}, tags: ['discount', 'passive-effect']});
  const late = s.root({gen: 11, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), category: 'card-play'});
  s.child({corr: late, gen: 11, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), type: 'discount-applied', impact: {megacreditsSaved: 16}, tags: ['discount', 'passive-effect']});
  return s.events;
}

// ── Scenario 11 — mixed winner (economy + a blue action + global parameters) ──
export function mixedWinnerStream(): ReadonlyArray<GameEvent> {
  const s = new FactStream();
  const eco = s.root({gen: 4, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), category: 'card-play'});
  s.child({corr: eco, gen: 4, player: 'red', source: card(CardName.EARTH_CATAPULT, 'red'), type: 'discount-applied', impact: {megacreditsSaved: 6}, tags: ['discount', 'passive-effect']});
  s.root({gen: 5, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), category: 'card-play'});
  for (let gen = 6; gen <= 9; gen++) {
    const a = s.root({gen, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), category: 'card-action'});
    s.child({corr: a, gen, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), type: 'cards-drawn', impact: {cardsDrawn: 2}});
  }
  const g = s.root({gen: 7, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), category: 'card-action'});
  s.child({corr: g, gen: 7, player: 'red', source: card(CardName.AI_CENTRAL, 'red'), type: 'global-parameter-changed', impact: {globalParameter: {parameter: GlobalParameter.OXYGEN, steps: 2}}, tags: ['global-parameter']});
  return s.events;
}
