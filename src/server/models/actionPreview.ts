import {IPlayer} from '../IPlayer';
import {ICard, IActionCard} from '../cards/ICard';
import {Behavior, TitledBehavior, AddResource} from '../behavior/Behavior';
import {Counter} from '../behavior/Counter';
import {CardType} from '../../common/cards/CardType';
import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {Units} from '../../common/Units';
import {TileType} from '../../common/TileType';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MIN_TEMPERATURE, MAX_VENUS_SCALE} from '../../common/constants';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {ActionPreview, ActionPreviewBranch, ActionPreviewStep, ActionEffect, ActionEffectBasis} from '../../common/models/ActionPreviewModel';
import {_Countable} from '../behavior/Countable';
import {collectActionBehaviorReasons} from './actionUnavailableReasons';
import {DecreaseAnyProduction} from '../deferredActions/DecreaseAnyProduction';
import {RemoveAnyPlants} from '../deferredActions/RemoveAnyPlants';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import * as actionPreviews from '../cards/actionPreviews';

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
    const preview: ActionPreview = {...base, kind: 'declarative', branches: deriveDeclarativeBranches(player, card, behavior)};
    // A `spend.heat` action paid via Stormcraft floaters prompts a heat-SOURCE
    // choice BEFORE the effect — pre-collect it as a preStep so the action-confirm
    // modal hosts the heat payment + the effect in one pass (no follow-up).
    const heat = behavior.spend?.heat;
    const heatStep = typeof heat === 'number' && heat > 0 ? actionPreviews.spendHeatStep(player, heat) : undefined;
    return heatStep !== undefined ? {...preview, preSteps: [heatStep]} : preview;
  }

  // Bespoke action with no hook yet: a single confirm-only branch. The action's
  // own prompts (whatever they are) flow through the existing follow-up routing.
  // When BLOCKED, surface the co-located `actionUnavailableReason` so the branch
  // carries the CONCRETE reason (used by the Actions overlay's per-branch
  // availability AND the repeat picker — never a bare "unavailable").
  const available = card.canAct(player);
  const reason = available ? undefined : card.actionUnavailableReason?.(player);
  return {
    ...base,
    kind: 'dynamic',
    branches: [{
      index: -1, title: '', available,
      unavailableReason: reason?.message,
      unavailableReasonParams: reason?.params,
      renderKeys: [], effects: [], steps: [],
    }],
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

/** A single "add to any card" instruction. `addResourcesToAnyCard` is single-OR-
 *  ARRAY (e.g. Imported Nitrogen adds 3 microbes AND 2 animals); both walkers
 *  normalize via `addToAnyCardList` so EVERY addition is shown — a missing
 *  array branch silently dropped the whole chip + picker (the Imported Nitrogen bug). */
type AddToAnyCard = Omit<AddResource, 'mustHaveCard'>;

/** Normalize the single-or-array `addResourcesToAnyCard` to its list of additions,
 *  in the SAME order `Executor.execute` defers them (so the pre-collected picks line
 *  up positionally with the live follow-up prompts). */
function addToAnyCardList(behavior: Behavior): ReadonlyArray<AddToAnyCard> {
  const a = behavior.addResourcesToAnyCard;
  if (a === undefined) {
    return [];
  }
  return Array.isArray(a) ? a : [a];
}

/** The eligible target cards for ONE `addResourcesToAnyCard` addition. EMPTY means
 *  the resource would be SILENTLY LOST — no card can hold it — so the preview warns
 *  instead of showing a fake "+N" gain (read-only; mirrors the live filter). `card`
 *  is the card being PLAYED (not on the tableau yet) — passed as `cardBeingPlayed` so
 *  an on-play "add to ANY card" can target the card ITSELF (Jovian Lanterns adds its
 *  own floaters), which the live `getResourceCards` would only see post-play. */
function addAnyCardCandidates(player: IPlayer, card: ICard, a: AddToAnyCard): ReadonlyArray<ICard> {
  return new AddResourcesToCard(player, a.type, {
    restrictedTag: a.tag,
    min: a.min,
    robotCards: a.robotCards !== undefined,
    cardBeingPlayed: card,
  }).getCards();
}

/**
 * TRUE when a behavior amount is VARIABLE — a `Countable` object read from live
 * game state ("1 M€ per space tag your opponents have") rather than a printed
 * number. The distinction is what makes a ZERO worth showing: a fixed 0 is
 * nothing (no card declares one), while a variable 0 is the whole answer to
 * «what does this card give me right now» — see `effectsForBehavior`.
 */
function isVariableAmount(raw: unknown): boolean {
  return raw !== null && typeof raw === 'object';
}

/**
 * For a VARIABLE amount counted from game state (e.g. "1 M€ per city on Mars"),
 * the live BASIS — how many of each counted entity exist right now — so the chip
 * can explain the amount ("+3 M€ · Cities on Mars: 3") instead of a bare number
 * the player can't account for. `raw` is the behavior's countable; a plain number
 * (a fixed amount) has no basis. Read-only (counts board / tableau state).
 *
 * TWO rules this pays for, both learned from the single-label version:
 *  - ONE TERM PER COUNTED ENTITY, each counted ON ITS OWN. A composite
 *    («1 M€ per city AND colony in play») used to take its label from the first
 *    key while counting the SUM, i.e. it reported a city count the board did
 *    not contain.
 *  - THE SCOPE IS PART OF THE LABEL. `{colonies}` counts YOUR colonies and
 *    `{colonies, all}` counts everyone's; labelling both «Colonies» makes the
 *    two indistinguishable, and for tags the scope IS the card's rule
 *    (Toll Station counts opponents' space tags and nothing of yours).
 */
function countableBasis(ctx: Counter, raw: unknown): ReadonlyArray<ActionEffectBasis> | undefined {
  if (!isVariableAmount(raw)) {
    return undefined;
  }
  const r = raw as _Countable;
  // Each term is counted in isolation, but keeps the countable's SCOPE / filter
  // modifiers (they select which of the entity is counted, not which entity).
  // `each` / `per` are deliberately dropped: they convert the count into the
  // amount, and the amount is already the chip's headline number.
  const count = (part: Partial<_Countable>): number => ctx.count({
    ...part,
    all: r.all,
    others: r.others,
    includeEvents: r.includeEvents,
    nextToThis: r.nextToThis,
  });
  const terms: Array<ActionEffectBasis> = [];
  if (r.tag !== undefined) {
    // Scope-keyed label + the tag ICON, so a rule that counts one of thirteen
    // tags needs three keys rather than thirty-nine. An ARRAY of tags («Venus
    // OR Earth tags») has no single icon — it keeps the label alone.
    const label = r.others === true ? 'Opponent tags' : r.all === true ? 'Tags in play' : 'Your tags';
    const term: ActionEffectBasis = {count: count({tag: r.tag}), label};
    if (!Array.isArray(r.tag)) {
      term.tag = r.tag;
    }
    terms.push(term);
  }
  if (r.cities !== undefined) {
    // `all: false` is the only thing that narrows tiles to the player's own.
    const mine = r.all === false;
    const label = r.cities.where === 'offmars' ? (mine ? 'Your cities off Mars' : 'Cities off Mars') :
      r.cities.where === 'onmars' ? (mine ? 'Your cities on Mars' : 'Cities on Mars') :
        (mine ? 'Your cities' : 'Cities');
    terms.push({count: count({cities: r.cities}), label});
  }
  if (r.oceans !== undefined) {
    terms.push({count: count({oceans: r.oceans}), label: 'Oceans'});
  }
  if (r.greeneries !== undefined) {
    terms.push({count: count({greeneries: r.greeneries}), label: r.all === false ? 'Your greeneries' : 'Greeneries'});
  }
  if (r.colonies !== undefined) {
    // Colonies invert the tile convention: WITHOUT `all` only the player's own
    // colonies count (Counter's `colonies` branch), with it everyone's.
    terms.push({count: count({colonies: r.colonies}), label: r.all === true ? 'Colonies in play' : 'Your colonies'});
  }
  if (r.floaters !== undefined) {
    terms.push({count: count({floaters: r.floaters}), label: 'Your floaters'});
  }
  if (r.resourcesHere !== undefined) {
    terms.push({count: count({resourcesHere: r.resourcesHere}), label: 'Resources on this card'});
  }
  // Moon / Underworld group several distinct entities under ONE key
  // («roads AND habitats»), so each sub-key becomes its own term.
  for (const key of MOON_KEYS) {
    if (r.moon?.[key] !== undefined) {
      const moon: NonNullable<_Countable['moon']> = {};
      moon[key] = {};
      terms.push({count: count({moon}), label: MOON_LABEL[key]});
    }
  }
  for (const key of UNDERWORLD_KEYS) {
    if (r.underworld?.[key] !== undefined) {
      const underworld: NonNullable<_Countable['underworld']> = {};
      underworld[key] = {};
      terms.push({count: count({underworld}), label: UNDERWORLD_LABEL[key]});
    }
  }
  return terms.length > 0 ? terms : undefined;
}

const MOON_KEYS = ['habitatRate', 'miningRate', 'logisticRate', 'habitat', 'mine', 'road'] as const;
const MOON_LABEL: Record<typeof MOON_KEYS[number], string> = {
  habitatRate: 'Habitat rate',
  miningRate: 'Mining rate',
  logisticRate: 'Logistic rate',
  habitat: 'Habitat tiles',
  mine: 'Mine tiles',
  road: 'Road tiles',
};

const UNDERWORLD_KEYS = ['corruption', 'excavationMarkers', 'undergroundTokens'] as const;
const UNDERWORLD_LABEL: Record<typeof UNDERWORLD_KEYS[number], string> = {
  corruption: 'Corruption',
  excavationMarkers: 'Excavation markers',
  undergroundTokens: 'Underground tokens',
};

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
  // `addResourcesToAnyCard` is single-OR-ARRAY (Imported Nitrogen: +3 microbes AND
  // +2 animals). Show a "+N to a card" gain PER addition — only when a card can
  // actually HOLD it (with no eligible card the effect is skipped, the warning step
  // says so, and a gain chip would be a lie — the silent-loss bug this closes).
  for (const a of addToAnyCardList(behavior)) {
    if (addAnyCardCandidates(player, card, a).length > 0) {
      out.push({direction: 'gain', icon: a.type !== undefined ? cardResourceIcon(a.type) : 'resources', amount: ctx.count(a.count), note: 'to a card'});
    }
  }
  for (const g of GLOBAL) {
    const steps = behavior.global?.[g.key];
    if (typeof steps === 'number') {
      const cur = g.get(game);
      const delta = steps * g.step;
      out.push({direction: delta >= 0 ? 'gain' : 'cost', icon: g.key, amount: Math.abs(delta), current: cur, resulting: clampValue(cur + delta, g.min, g.max), unit: g.unit});
    }
  }
  // A VARIABLE amount that currently counts to ZERO stays on screen. Dropping it
  // hid the card's headline clause outright: Toll Station («+1 M€ production per
  // space tag your OPPONENTS have») previewed as nothing but its own tag against
  // a bot with no space tags, so the one number worth 12 M€ of thought was the
  // one number the player never saw. A fixed 0 is still dropped — no card prints
  // one, and it would carry no information if it did. The chip renders it muted
  // with its basis («0 → 0 · Метки соперников: 0»), which is the honest reading.
  const zeroIsNews = (raw: unknown, n: number): boolean => n !== 0 || isVariableAmount(raw);
  if (behavior.stock !== undefined) {
    for (const s of STANDARD) {
      const raw = behavior.stock[s.key];
      if (raw === undefined) {
        continue;
      }
      const n = ctx.count(raw);
      if (!zeroIsNews(raw, n)) {
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
      if (!zeroIsNews(raw, n)) {
        continue;
      }
      const cur = player.production.get(s.resource);
      out.push({direction: n >= 0 ? 'gain' : 'cost', icon: s.resource, amount: Math.abs(n), current: cur, resulting: cur + n, note: 'production', basis: countableBasis(ctx, raw)});
    }
  }
  if (behavior.tr !== undefined) {
    const n = ctx.count(behavior.tr);
    if (zeroIsNews(behavior.tr, n)) {
      out.push({direction: n >= 0 ? 'gain' : 'cost', icon: 'tr', amount: Math.abs(n), current: player.terraformRating, resulting: player.terraformRating + n, basis: countableBasis(ctx, behavior.tr)});
    }
  }
  if (behavior.drawCard !== undefined) {
    const dc = behavior.drawCard;
    const raw = typeof dc === 'number' ? dc : dc.count;
    const n = ctx.count(raw);
    if (n > 0 || isVariableAmount(raw)) {
      // A draw has no pool, so it carries no `current → resulting`: the chip
      // reads the zero off the amount itself and mutes on that.
      out.push({direction: 'gain', icon: 'cards', amount: Math.max(0, n), note: 'draw', basis: countableBasis(ctx, raw)});
    }
  }

  return out;
}

/**
 * The PLAYER production a copy-production card (Robotic Workforce / Cyberia
 * Systems) would copy from `card`, computed READ-ONLY + authoritatively (mirrors
 * the copy order in `RoboticWorkforceBase.selectBuildingCard`):
 *   1. a bespoke `produce()` MUTATES state → can't preview → `undefined` (no chip);
 *   2. `productionBox(player)` — a read-only Units query (MiningCard, SolarFarm, …);
 *   3. `behavior.production` — the per-resource delta, computed via the Counter
 *      (so a "per X" production resolves to the live number).
 * `decreaseAnyProduction` (also copied) targets an OPPONENT's production, so it
 * doesn't change the PLAYER's own production and is intentionally NOT in this delta.
 * The client folds this into the displayed RESULT so the player sees EXACTLY what
 * the chosen card copies — for ANY copyable card, not just full-Units declarative ones.
 */
export function copiedProductionUnits(player: IPlayer, card: ICard): Units | undefined {
  if (card.produce !== undefined) {
    return undefined;
  }
  if (card.productionBox !== undefined) {
    return card.productionBox(player);
  }
  const production = card.behavior?.production;
  if (production === undefined) {
    return undefined;
  }
  const ctx = new Counter(player, card);
  const units: Units = {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0};
  for (const key of ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const) {
    const raw = (production as Record<string, unknown>)[key];
    if (raw !== undefined) {
      units[key] = ctx.count(raw as Parameters<Counter['count']>[0]);
    }
  }
  return units;
}

/**
 * THE VICTORY POINTS A RESOURCE DELTA WOULD MOVE — `before → after`, computed
 * AUTHORITATIVELY here and never re-derived by a UI.
 *
 * WHY THE SERVER. «Добавьте астероид на любую карту» is not only a resource
 * change: on a card that scores per resource it is also a VP change, and on a
 * threshold card («3 ПО, если есть хотя бы 1 ресурс») it can be the WHOLE point
 * of the choice. The client cannot work that out — the rule lives in each
 * card's `victoryPoints` descriptor, and re-implementing it there is exactly
 * the duplication the preview subsystem exists to prevent.
 *
 * HOW, WITHOUT MUTATING. `Counter` reads `card.resourceCount` directly, so the
 * naive way to get the «after» value is to set the count, read, and put it back
 * — a mutation inside a read-only builder, which this fork's purity guard
 * rightly forbids. Instead the descriptor is evaluated in two halves: the
 * NON-resource part goes through the real Counter (so a mixed «per tag + per
 * resource» card still counts its tags correctly), and the resource term is
 * substituted arithmetically. `each` / `per` are then applied exactly as the
 * Counter applies them, which is what keeps a `per: 2` card honest (2 → 3
 * resources is often 1 → 1 VP, and saying otherwise would be a lie).
 *
 * `undefined` means «no honest answer»: a fixed VP (a resource cannot move it),
 * a `'special'` card (its `getVictoryPoints` is bespoke — guessing would be
 * worse than silence), or a descriptor with no resource term at all. That is the
 * same contract `copiedProductionUnits` keeps for bespoke `produce()`.
 */
export function resourceVictoryPoints(
  player: IPlayer,
  card: ICard,
  delta: number,
): {from: number, to: number} | undefined {
  const vp = card.victoryPoints;
  if (vp === undefined || typeof vp === 'number' || vp === 'special') {
    return undefined;
  }
  if (vp.resourcesHere === undefined) {
    return undefined; // nothing here responds to a resource
  }
  const {each, per} = vp;
  // The non-resource half, through the REAL counter (tags, cities, oceans…).
  const rest = new Counter(player, card).count({...vp, resourcesHere: undefined, each: undefined, per: undefined}, 'vps');
  const scale = (raw: number): number => {
    let n = raw;
    if (each !== undefined) {
      n = n * each;
    }
    if (per !== undefined) {
      n = Math.floor(n / per);
    }
    return n;
  };
  const before = card.resourceCount;
  const after = Math.max(0, before + delta);
  return {from: scale(rest + before), to: scale(rest + after)};
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

  // Add a resource to ANY card → a card-target picker PER addition (the value is
  // single-OR-ARRAY — Imported Nitrogen adds microbes AND animals), OR a WARNING when
  // no card can hold it (the resource would be silently lost). Emitted in array order
  // (the SAME order `Executor.execute` defers them) so the batched picks line up.
  for (const a of addToAnyCardList(behavior)) {
    const count = ctx.count(a.count);
    // ONE instance, asked twice: the candidate set the VP reading is computed
    // over is then the set the picker presents BY CONSTRUCTION, rather than by
    // two separate constructions that happen to agree today.
    const target = new AddResourcesToCard(player, a.type, {
      count,
      restrictedTag: a.tag,
      min: a.min,
      robotCards: a.robotCards !== undefined,
      // ALWAYS pre-collect the target pick in the modal — even for one
      // candidate — so the player ALWAYS sees WHERE the resource goes (matches
      // the live `Executor` defer; no silent single-apply).
      autoSelect: false,
      // The card being played can be its OWN target (Jovian Lanterns adds its own
      // floaters) — it isn't on the tableau yet, so add it explicitly.
      cardBeingPlayed: card,
    });
    const candidates = target.getCards();
    if (candidates.length === 0) {
      // Name WHICH resource is lost via its icon — never an ambiguous "this
      // resource" (the gain chip is suppressed, so this warning is the only
      // mention of it). Pass the NORMALIZED icon key (`cardResourceIcon`, same as
      // the input step's `cardResource`) so `iconClassFor` resolves the sprite —
      // the raw `CardResource` value ('Animal') would yield `card-resource-Animal`,
      // which has no CSS class, so no icon showed. Undefined = any-resource → no icon.
      const icon = a.type !== undefined ? cardResourceIcon(a.type) : 'resources';
      steps.push({
        kind: 'note',
        noteKind: 'warning',
        text: 'No eligible card — this resource is not added.',
        resource: a.type !== undefined ? cardResourceIcon(a.type) : undefined,
        // NAME the skipped effect: the gain chip is suppressed above, so without
        // this the player only learns that "a resource" is lost — ambiguous on a
        // card that adds several (Imported Nitrogen: microbes AND animals).
        skipped: {
          label: actionPreviews.SKIPPED_LABEL.addToCard,
          effect: {direction: 'gain', icon, amount: count, note: 'to a card'},
        },
      });
    } else {
      const model = target.previewSelectCard();
      if (model !== undefined) {
        // The signed delta lets the picker show "N → N+count" per candidate card;
        // `cardResource` (the icon key) makes the picker prompt name the resource.
        steps.push({
          kind: 'input',
          input: model,
          amount: count,
          cardResource: a.type !== undefined ? cardResourceIcon(a.type) : undefined,
          // AUTOMATIC, never opt-in — the same rule `selectCardStep` states. This
          // is the walker EVERY declarative card goes through (play, blue action
          // and corp first action alike), so a card that moves a resource onto a
          // scoring card cannot forget to say what that does to its VP. Returns
          // `undefined` when nothing in the set scores per resource, so the field
          // stays absent rather than shipping an empty map on every pick.
          vpBox: actionPreviews.targetVictoryPoints(player, candidates, count),
        });
      }
    }
  }

  // Decrease ANY player's production → a target picker (when a choice is offered),
  // ELSE a "no production can be reduced" warning outside solo (nobody's mapped
  // production/track can drop) so the modal is never mute about the skipped attack.
  if (behavior.decreaseAnyProduction !== undefined) {
    const dap = behavior.decreaseAnyProduction;
    const model = new DecreaseAnyProduction(player, dap.type, {count: dap.count}).previewSelectPlayer();
    const step = actionPreviews.targetStepOrWarning(player,
      model !== undefined ? {kind: 'input', input: model} : undefined,
      'No production can be reduced.',
      {
        label: actionPreviews.SKIPPED_LABEL.reduceProduction,
        effect: actionPreviews.skippedAttackChip(dap.type, dap.count, 'production'),
      });
    if (step !== undefined) {
      steps.push(step);
    }
  }

  // Remove plants from ANY player (Mining Expedition / Asteroid / Big Asteroid /
  // Deimos Down / Small Asteroid / Impactor Swarm / Comet / Giant Ice Asteroid /
  // Deimos Down promo) → the SAME premium OrOptions target picker the live follow-up
  // would show, hosted INSIDE the play modal (ModernOptionPicker): every pickable
  // player with its plants `current → resulting`, a self-removal option with a
  // warning, the "skip" option, and opponents who can't be targeted shown disabled
  // with a reason. Built read-only via the side-effect-free `previewOptions` (shared
  // with the live `execute`), so the chosen `{type:'or', index, response}` replays
  // BYTE-IDENTICALLY against the live OrOptions in the batch. `undefined` (solo mode /
  // no opponent has plants) → no step, exactly matching the live path.
  //
  // PRE-COLLECTED EVEN WHEN THE CARD ALSO PLACES A TILE. The plant attack is
  // INDEPENDENT of where the tile lands, so it's resolved up front, not deferred.
  // The placement defers at PLACE_OCEAN_TILE / DEFAULT (BEFORE ATTACK_OPPONENT), so
  // normally it would prompt FIRST and the positional batch couldn't pre-collect a
  // pick queued behind a SelectSpace. `Executor.execute` therefore ELEVATES the plant
  // removal to `Priority.PLAY_CARD_PLANT_REMOVAL` (ahead of every placement) whenever
  // the card has a co-placement, so the OrOptions prompts FIRST; this step is emitted
  // BEFORE the placement note below, matching that elevated order. The tile then rides
  // PlacementBanner after confirm (it's inherently post-confirm — it CAN'T be
  // pre-collected). See Priority.PLAY_CARD_PLANT_REMOVAL + cardPlayPreviewCoverage.spec.ts.
  // `undefined` (no opponent has removable plants and none is protected) → a
  // "no valid target" warning outside solo, so the plant attack is never blank.
  if (behavior.removeAnyPlants !== undefined) {
    const orOptions = new RemoveAnyPlants(player, behavior.removeAnyPlants).previewOptions();
    const step = actionPreviews.targetStepOrWarning(player,
      orOptions !== undefined ? {kind: 'input', input: orOptions.toModel(player)} : undefined,
      undefined,
      {
        label: actionPreviews.SKIPPED_LABEL.removePlants,
        effect: actionPreviews.skippedAttackChip(Resource.PLANTS, behavior.removeAnyPlants),
      });
    if (step !== undefined) {
      steps.push(step);
    }
  }

  // Board / colony placement → inherently interactive; collected AFTER submit
  // (PlacementBanner for tiles, ColoniesOverlay for a colony). The modal shows an
  // honest note. Emitted last, matching the executor defer order.
  // `tileType` mirrors what `Executor` actually places (`Executor.execute`
  // reads BOTH `tile.type` and `tile.on`) — it is what lets the preview NAME the
  // tile. `placementType` is only the terrain filter and cannot substitute:
  // every special tile on land collapses to `'land'`.
  if (behavior.colonies?.buildColony !== undefined) {
    // A colony is built off-Mars — no tile, so no tile identity to name.
    steps.push({kind: 'boardPlacement', placementType: 'colony'});
  }
  if (behavior.ocean !== undefined) {
    steps.push({kind: 'boardPlacement', placementType: 'ocean', tileType: TileType.OCEAN, count: behavior.ocean.count});
  }
  if (behavior.city !== undefined && behavior.city.space === undefined) {
    steps.push({kind: 'boardPlacement', placementType: behavior.city.on ?? 'city', tileType: TileType.CITY});
  }
  if (behavior.greenery !== undefined) {
    steps.push({kind: 'boardPlacement', placementType: behavior.greenery.on ?? 'greenery', tileType: TileType.GREENERY});
  }
  if (behavior.tile !== undefined) {
    steps.push({kind: 'boardPlacement', placementType: behavior.tile.on, tileType: behavior.tile.type});
  }

  return steps;
}
