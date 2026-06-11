import {IPlayer} from '../IPlayer';
import {ICard, IActionCard} from '../cards/ICard';
import {Behavior, TitledBehavior} from '../behavior/Behavior';
import {Counter} from '../behavior/Counter';
import {CardType} from '../../common/cards/CardType';
import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {Units} from '../../common/Units';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MIN_TEMPERATURE, MAX_VENUS_SCALE} from '../../common/constants';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {ActionPreview, ActionPreviewBranch, ActionPreviewStep, ActionEffect} from '../../common/models/ActionPreviewModel';
import {collectActionBehaviorReasons} from './actionUnavailableReasons';
import {DecreaseAnyProduction} from '../deferredActions/DecreaseAnyProduction';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';

/**
 * READ-ONLY preview of an activatable action — the analog of
 * `actionUnavailableReasons.ts` but for "what choices will this action need".
 * Returns the action's branches + the per-branch choice steps the confirmation
 * modal collects BEFORE the final submit.
 *
 * Strategy (mirrors the unavailable-reasons split):
 *   1. BESPOKE action cards supply the preview via the co-located
 *      `ICard.actionPreview?(player)` hook (built from `actionPreviews.ts`).
 *   2. DECLARATIVE action cards (`actionBehavior` set) auto-derive it by walking
 *      the behavior tree — reusing `collectActionBehaviorReasons` as the
 *      read-only executability gate and building the SAME input models the live
 *      path builds (via each deferred action's `previewSelect*` method).
 *   3. Otherwise (bespoke action, no hook) → `kind: 'dynamic'`: a single
 *      confirm-only branch; the legacy follow-up routing handles the rest.
 *
 * NOTHING here mutates game state. It NEVER calls `Executor.canExecute`/`execute`
 * (which add `card.warnings`) — only read-only checks + pure model construction.
 */
export function actionPreview(player: IPlayer, card: ICard & IActionCard): ActionPreview {
  if (card.actionPreview !== undefined) {
    return card.actionPreview(player);
  }

  const base = {
    card: card.name,
    isCorporation: card.type === CardType.CORPORATION,
    cardResource: card.resourceType !== undefined ? {type: card.resourceType, count: card.resourceCount} : undefined,
  };

  const behavior = card.actionBehavior;
  if (behavior !== undefined) {
    return {...base, kind: 'declarative', branches: deriveDeclarativeBranches(player, card, behavior)};
  }

  // Bespoke action with no hook yet: a single confirm-only branch. The action's
  // own prompts (whatever they are) flow through the existing follow-up routing.
  return {
    ...base,
    kind: 'dynamic',
    branches: [{index: -1, title: '', available: card.canAct(player), renderKeys: [], effects: [], steps: []}],
  };
}

/** A behavior is executable iff it collects zero blocking reasons (read-only).
 *  Exported so the card-PLAY preview can gate `behavior.or` sub-branches the
 *  same way (shared with the action preview — never drifts). */
export function subAvailability(player: IPlayer, card: ICard, behavior: Behavior): {available: boolean, reason?: UnplayableReason} {
  const reasons: Array<UnplayableReason> = [];
  collectActionBehaviorReasons(player, card, behavior, reasons);
  return {available: reasons.length === 0, reason: reasons[0]};
}

function deriveDeclarativeBranches(player: IPlayer, card: ICard & IActionCard, behavior: Behavior): ReadonlyArray<ActionPreviewBranch> {
  // Multi-branch `or` → one branch per sub-behavior. The RUNTIME OrOptions index
  // is the position among EXECUTABLE subs only (Executor.execute filters then
  // maps), so we assign `index` in that filtered order. When `autoSelect` is on
  // and exactly one sub is executable, the server resolves it WITHOUT an
  // OrOptions — so that lone branch gets index -1 (no branch pick submitted).
  if (behavior.or !== undefined) {
    const subs: ReadonlyArray<TitledBehavior> = behavior.or.behaviors;
    const availabilities = subs.map((sub) => subAvailability(player, card, sub));
    const availableCount = availabilities.filter((a) => a.available).length;
    const autoResolve = behavior.or.autoSelect === true && availableCount === 1;
    let runtimeIdx = 0;
    return subs.map((sub, i): ActionPreviewBranch => {
      const a = availabilities[i];
      const index = (a.available && !autoResolve) ? runtimeIdx : -1;
      if (a.available) {
        runtimeIdx++;
      }
      return {
        index,
        title: sub.title,
        available: a.available,
        unavailableReason: a.reason?.message,
        unavailableReasonParams: a.reason?.params,
        renderKeys: [String(i)],
        // Effects are computed for EVERY branch — an unavailable branch shows its
        // costs/gains too (the chip frames an unaffordable cost as "have / need"),
        // so the player understands WHY it can't be taken, not just that it can't.
        effects: effectsForBehavior(player, card, sub),
        // Interactive steps only for an executable branch.
        steps: a.available ? stepsForBehavior(player, card, sub) : [],
      };
    });
  }

  // Single-action card → one branch (no branch pick). `canAct` is the
  // authoritative availability gate (handles bespoke `bespokeCanAct` too).
  const available = card.canAct(player);
  const reason = available ? undefined : subAvailability(player, card, behavior).reason;
  return [{
    index: -1,
    title: '',
    available,
    unavailableReason: reason?.message,
    unavailableReasonParams: reason?.params,
    renderKeys: [],
    effects: effectsForBehavior(player, card, behavior),
    steps: available ? stepsForBehavior(player, card, behavior) : [],
  }];
}

// ── Effects: the at-a-glance cost/gain chips (icon + current → resulting) ────

const STANDARD: ReadonlyArray<{key: keyof Units, resource: Resource}> = [
  {key: 'megacredits', resource: Resource.MEGACREDITS},
  {key: 'steel', resource: Resource.STEEL},
  {key: 'titanium', resource: Resource.TITANIUM},
  {key: 'plants', resource: Resource.PLANTS},
  {key: 'energy', resource: Resource.ENERGY},
  {key: 'heat', resource: Resource.HEAT},
];

const GLOBAL: ReadonlyArray<{key: 'oxygen' | 'temperature' | 'venus', step: number, min: number, max: number, unit: string, get: (game: IPlayer['game']) => number}> = [
  {key: 'oxygen', step: 1, min: 0, max: MAX_OXYGEN_LEVEL, unit: '%', get: (g) => g.getOxygenLevel()},
  {key: 'temperature', step: 2, min: MIN_TEMPERATURE, max: MAX_TEMPERATURE, unit: '°C', get: (g) => g.getTemperature()},
  {key: 'venus', step: 2, min: 0, max: MAX_VENUS_SCALE, unit: '%', get: (g) => g.getVenusScaleLevel()},
];

function clampValue(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Icon key for a card resource (lowercase, spaces→hyphens — `iconClassFor`). */
function cardResourceIcon(resource: CardResource): string {
  return String(resource).toLowerCase().replace(/\s+/g, '-');
}

/**
 * For a VARIABLE amount counted from game state (e.g. "1 M€ per city on Mars"),
 * the live BASIS — how many of the counted entity exist right now — so the chip
 * can explain the amount ("+3 M€ · Cities on Mars: 3") instead of a bare number
 * the player can't account for. `raw` is the behavior's countable; a plain number
 * (a fixed amount) has no basis. Read-only (counts board / tableau state).
 */
function countableBasis(ctx: Counter, raw: unknown): {count: number, label: string} | undefined {
  if (raw === null || typeof raw !== 'object') {
    return undefined;
  }
  const r = raw as {cities?: {where?: string}, oceans?: unknown, greeneries?: unknown, colonies?: unknown, each?: number, per?: number};
  let label: string | undefined;
  if (r.cities !== undefined) {
    label = r.cities.where === 'offmars' ? 'Cities off Mars' : r.cities.where === 'onmars' ? 'Cities on Mars' : 'Cities';
  } else if (r.oceans !== undefined) {
    label = 'Oceans';
  } else if (r.greeneries !== undefined) {
    label = 'Greeneries';
  } else if (r.colonies !== undefined) {
    label = 'Colonies';
  }
  if (label === undefined) {
    return undefined;
  }
  // The count of the counted entity itself (drop the each/per rate multiplier),
  // so "1 M€ per city" shows the CITY count, not the M€ amount (they're equal at
  // rate 1, but distinct when the per-unit rate isn't 1).
  const count = ctx.count({...r, each: undefined, per: undefined} as Parameters<Counter['count']>[0]);
  return {count, label};
}

/**
 * The branch's costs + gains as display chips. NEVER mutates — reads current
 * pools and computes the resulting value with the same step sizes / caps the
 * live game uses (oxygen +1, temperature/venus +2 per step).
 */
export function effectsForBehavior(player: IPlayer, card: ICard, behavior: Behavior): Array<ActionEffect> {
  const out: Array<ActionEffect> = [];
  const ctx = new Counter(player, card);
  const game = player.game;

  // ── Costs ──
  const resourcesHere = behavior.spend?.resourcesHere;
  if (typeof resourcesHere === 'number' && card.resourceType !== undefined) {
    out.push({direction: 'cost', icon: cardResourceIcon(card.resourceType), amount: resourcesHere, current: card.resourceCount, resulting: Math.max(0, card.resourceCount - resourcesHere), note: 'on this card'});
  }
  for (const s of STANDARD) {
    const v = behavior.spend?.[s.key];
    if (typeof v === 'number' && v > 0) {
      const cur = player.stock.get(s.resource);
      out.push({direction: 'cost', icon: s.resource, amount: v, current: cur, resulting: Math.max(0, cur - v)});
    }
  }

  // ── Gains ──
  if (behavior.addResources !== undefined && card.resourceType !== undefined) {
    const n = ctx.count(behavior.addResources);
    out.push({direction: 'gain', icon: cardResourceIcon(card.resourceType), amount: n, current: card.resourceCount, resulting: card.resourceCount + n, note: 'on this card'});
  }
  if (behavior.addResourcesToAnyCard !== undefined && !Array.isArray(behavior.addResourcesToAnyCard)) {
    const a = behavior.addResourcesToAnyCard;
    out.push({direction: 'gain', icon: a.type !== undefined ? cardResourceIcon(a.type) : 'resources', amount: ctx.count(a.count), note: 'to a card'});
  }
  for (const g of GLOBAL) {
    const steps = behavior.global?.[g.key];
    if (typeof steps === 'number') {
      const cur = g.get(game);
      const delta = steps * g.step;
      out.push({direction: delta >= 0 ? 'gain' : 'cost', icon: g.key, amount: Math.abs(delta), current: cur, resulting: clampValue(cur + delta, g.min, g.max), unit: g.unit});
    }
  }
  if (behavior.stock !== undefined) {
    for (const s of STANDARD) {
      const raw = behavior.stock[s.key];
      if (raw === undefined) {
        continue;
      }
      const n = ctx.count(raw);
      if (n === 0) {
        continue;
      }
      const cur = player.stock.get(s.resource);
      out.push({direction: n >= 0 ? 'gain' : 'cost', icon: s.resource, amount: Math.abs(n), current: cur, resulting: Math.max(0, cur + n), basis: countableBasis(ctx, raw)});
    }
  }
  if (behavior.production !== undefined) {
    for (const s of STANDARD) {
      const raw = behavior.production[s.key];
      if (raw === undefined) {
        continue;
      }
      const n = ctx.count(raw);
      if (n === 0) {
        continue;
      }
      const cur = player.production.get(s.resource);
      out.push({direction: n >= 0 ? 'gain' : 'cost', icon: s.resource, amount: Math.abs(n), current: cur, resulting: cur + n, note: 'production', basis: countableBasis(ctx, raw)});
    }
  }
  if (behavior.tr !== undefined) {
    const n = ctx.count(behavior.tr);
    if (n !== 0) {
      out.push({direction: n >= 0 ? 'gain' : 'cost', icon: 'tr', amount: Math.abs(n), current: player.terraformRating, resulting: player.terraformRating + n, basis: countableBasis(ctx, behavior.tr)});
    }
  }
  if (behavior.drawCard !== undefined) {
    const dc = behavior.drawCard;
    const n = typeof dc === 'number' ? dc : ctx.count(dc.count);
    if (n > 0) {
      out.push({direction: 'gain', icon: 'cards', amount: n, note: 'draw'});
    }
  }

  return out;
}

/**
 * The ordered choice steps a (sub-)behavior needs, built by constructing the
 * SAME input the live path constructs (read-only) and serializing it. A behavior
 * key that resolves automatically (addResources to self, global, tr, drawCard)
 * produces NO step. Payment (`spend.megacredits`), colony build, and the
 * less-common pickers are added as their card groups are migrated — until then
 * they produce no step and the leftover prompt rides the graceful fallback.
 */
export function stepsForBehavior(player: IPlayer, card: ICard, behavior: Behavior): ReadonlyArray<ActionPreviewStep> {
  const steps: Array<ActionPreviewStep> = [];
  const ctx = new Counter(player, card);

  // ORDER IS LOAD-BEARING: each `input` step's captured response is replayed
  // POSITIONALLY against the live follow-up prompts (the batch endpoint applies
  // them in sequence). So the steps MUST be emitted in the SAME order
  // `Executor.execute` DEFERS them (the deferred queue drains FIFO within a
  // priority). Executor defer order for these keys:
  //   addResourcesToAnyCard → decreaseAnyProduction → removeAnyPlants →
  //   colonies.buildColony → ocean → city → greenery → tile.
  // (removeAnyPlants is an OrOptions with no clean controlled capture yet, so it
  // is NOT pre-collected — it rides the post-batch follow-up routing; it sits
  // between the two below in defer order, which is harmless since no step is
  // emitted for it.)

  // Add a resource to ANY card → a card-target picker (when a choice is offered).
  if (behavior.addResourcesToAnyCard !== undefined && !Array.isArray(behavior.addResourcesToAnyCard)) {
    const a = behavior.addResourcesToAnyCard;
    const count = ctx.count(a.count);
    const model = new AddResourcesToCard(player, a.type, {
      count,
      restrictedTag: a.tag,
      min: a.min,
      robotCards: a.robotCards !== undefined,
      autoSelect: a.autoSelect,
    }).previewSelectCard();
    if (model !== undefined) {
      // The signed delta lets the picker show "N → N+count" per candidate card.
      steps.push({kind: 'input', input: model, amount: count});
    }
  }

  // Decrease ANY player's production → a target picker (when a choice is offered).
  if (behavior.decreaseAnyProduction !== undefined) {
    const dap = behavior.decreaseAnyProduction;
    const model = new DecreaseAnyProduction(player, dap.type, {count: dap.count}).previewSelectPlayer();
    if (model !== undefined) {
      steps.push({kind: 'input', input: model});
    }
  }

  // Board / colony placement → inherently interactive; collected AFTER submit
  // (PlacementBanner for tiles, ColoniesOverlay for a colony). The modal shows an
  // honest note. Emitted last, matching the executor defer order.
  if (behavior.colonies?.buildColony !== undefined) {
    steps.push({kind: 'boardPlacement', placementType: 'colony'});
  }
  if (behavior.ocean !== undefined) {
    steps.push({kind: 'boardPlacement', placementType: 'ocean'});
  }
  if (behavior.city !== undefined && behavior.city.space === undefined) {
    steps.push({kind: 'boardPlacement', placementType: behavior.city.on ?? 'city'});
  }
  if (behavior.greenery !== undefined) {
    steps.push({kind: 'boardPlacement', placementType: behavior.greenery.on ?? 'greenery'});
  }
  if (behavior.tile !== undefined) {
    steps.push({kind: 'boardPlacement', placementType: behavior.tile.on});
  }

  return steps;
}
