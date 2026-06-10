import {IPlayer} from '../IPlayer';
import {ICard, IActionCard} from './ICard';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {CardType} from '../../common/cards/CardType';
import {Resource} from '../../common/Resource';
import {Message} from '../../common/logs/Message';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MIN_TEMPERATURE, MAX_VENUS_SCALE} from '../../common/constants';
import {ActionPreview, ActionPreviewBranch, ActionPreviewStep, ActionEffect} from '../../common/models/ActionPreviewModel';
import {PlayerInputModel} from '../../common/models/PlayerInputModel';
import {effectsForBehavior} from '../models/actionPreview';
import {RemoveResourcesFromCard} from '../deferredActions/RemoveResourcesFromCard';
import {AddResourcesToCard, Options as AddResourceOptions} from '../deferredActions/AddResourcesToCard';
import {SelectPaymentDeferred, Options as SelectPaymentOptions} from '../deferredActions/SelectPaymentDeferred';
import {SelectAmount} from '../inputs/SelectAmount';
import {SelectCard} from '../inputs/SelectCard';
import {SelectPlayer} from '../inputs/SelectPlayer';
import {OrOptions} from '../inputs/OrOptions';

/** Icon key for a card resource (lowercase, spaces→hyphens — `iconClassFor`). */
function cardResourceIcon(resource: CardResource): string {
  return String(resource).toLowerCase().replace(/\s+/g, '-');
}

function clampValue(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Effect-chip builders (icon + cost/gain + current → resulting) ───────────
// These are the bespoke counterpart of `effectsForBehavior` in actionPreview.ts:
// a hook declares its branch's costs/gains with these one-liners.

/** Spend N of the card's OWN stored resource (e.g. 2 floaters from this card). */
export function cardCost(card: ICard, amount: number): ActionEffect {
  return {
    direction: 'cost',
    icon: card.resourceType !== undefined ? cardResourceIcon(card.resourceType) : 'resources',
    amount,
    current: card.resourceCount,
    resulting: Math.max(0, card.resourceCount - amount),
    note: 'on this card',
  };
}
/** Add N of the card's OWN stored resource (e.g. add 2 floaters here). */
export function cardGain(card: ICard, amount: number): ActionEffect {
  return {
    direction: 'gain',
    icon: card.resourceType !== undefined ? cardResourceIcon(card.resourceType) : 'resources',
    amount,
    current: card.resourceCount,
    resulting: card.resourceCount + amount,
    note: 'on this card',
  };
}
/** Spend N of a standard resource from the player's stock (M€/steel/Ti/…). */
export function stockCost(player: IPlayer, resource: Resource, amount: number): ActionEffect {
  const cur = player.stock.get(resource);
  return {direction: 'cost', icon: resource, amount, current: cur, resulting: Math.max(0, cur - amount)};
}
/** Gain N of a standard resource into the player's stock. */
export function stockGain(player: IPlayer, resource: Resource, amount: number): ActionEffect {
  const cur = player.stock.get(resource);
  return {direction: 'gain', icon: resource, amount, current: cur, resulting: cur + amount};
}
/** Lose/gain N of a standard production. */
export function productionChange(player: IPlayer, resource: Resource, amount: number): ActionEffect {
  const cur = player.production.get(resource);
  return {direction: amount >= 0 ? 'gain' : 'cost', icon: resource, amount: Math.abs(amount), current: cur, resulting: cur + amount, note: 'production'};
}
/** Raise terraform rating by N. */
export function trGain(player: IPlayer, amount: number): ActionEffect {
  return {direction: 'gain', icon: 'tr', amount, current: player.terraformRating, resulting: player.terraformRating + amount};
}

const GLOBAL_META = {
  oxygen: {step: 1, min: 0, max: MAX_OXYGEN_LEVEL, unit: '%', get: (p: IPlayer) => p.game.getOxygenLevel()},
  temperature: {step: 2, min: MIN_TEMPERATURE, max: MAX_TEMPERATURE, unit: '°C', get: (p: IPlayer) => p.game.getTemperature()},
  venus: {step: 2, min: 0, max: MAX_VENUS_SCALE, unit: '%', get: (p: IPlayer) => p.game.getVenusScaleLevel()},
} as const;

/** Raise a global parameter by `steps` increments (current → resulting, clamped). */
export function globalGain(player: IPlayer, parameter: 'oxygen' | 'temperature' | 'venus', steps: number): ActionEffect {
  const m = GLOBAL_META[parameter];
  const cur = m.get(player);
  const delta = steps * m.step;
  return {direction: delta >= 0 ? 'gain' : 'cost', icon: parameter, amount: Math.abs(delta), current: cur, resulting: clampValue(cur + delta, m.min, m.max), unit: m.unit};
}
/** Draw N cards (no single pool — shown as a "+N draw" chip). */
export function drawGain(amount: number): ActionEffect {
  return {direction: 'gain', icon: 'cards', amount, note: 'draw'};
}
/** Add a card resource to ANOTHER / ANY card (target chosen in a step) — no current. */
export function cardResourceGain(resource: CardResource, amount: number): ActionEffect {
  return {direction: 'gain', icon: cardResourceIcon(resource), amount, note: 'to a card'};
}

// ── Interactive step builders (the choices a branch needs after activation) ──

/**
 * "Add N `resource` to a card" target picker, mirroring what `action()` defers
 * (`new AddResourcesToCard(player, resource, opts)`). Returns `undefined` when
 * the live path would auto-apply (a single candidate, default autoSelect) or
 * there's no candidate — i.e. no step is shown, exactly like the live action.
 */
export function addToCardStep(player: IPlayer, resource: CardResource | undefined, opts: AddResourceOptions = {}): ActionPreviewStep | undefined {
  const model = new AddResourcesToCard(player, resource, opts).previewSelectCard();
  return model !== undefined ? {kind: 'input', input: model} : undefined;
}

/**
 * A PAYMENT step, mirroring a `SelectPaymentDeferred` the action defers (e.g.
 * "pay 12 M€, titanium usable" for Water Import From Europa). Returns the
 * `SelectPayment` model so the confirm modal hosts the SAME premium payment
 * widget the live follow-up would, and the chosen payment is collected into the
 * single batch submit. Returns `undefined` when the live path would NOT prompt —
 * the player can only pay in M€ (`SelectPaymentDeferred` auto-pays) or amount ≤ 0
 * — so NO step is shown (the caller falls back to a flat `stockCost` effect chip,
 * exactly matching the live behaviour). Drift-free: it asks the SAME deferred
 * (`previewPaymentModel`) that `execute` uses.
 */
export function paymentStep(player: IPlayer, amount: number, options?: SelectPaymentOptions): ActionPreviewStep | undefined {
  const model = new SelectPaymentDeferred(player, amount, options).previewPaymentModel();
  return model !== undefined ? {kind: 'input', input: model} : undefined;
}

/**
 * An honest "you will place a tile on the board after confirming" note (the
 * board placement is inherently interactive and can't be pre-chosen in the
 * modal — the leftover `SelectSpace` hands off to `PlacementBanner` after the
 * batch submit). `placementType` is informational (e.g. `'ocean'`, `'city'`).
 */
export function boardPlacementStep(placementType: string): ActionPreviewStep {
  return {kind: 'boardPlacement', placementType};
}

/** A "choose an amount" step (e.g. spend X floaters) — hosts the modern stepper. */
export function amountStep(
  title: string | Message,
  label: string,
  min: number,
  max: number,
  opts?: {icon?: string, unit?: string, maxByDefault?: boolean},
): ActionPreviewStep {
  return {kind: 'input', input: amountInput(title, label, min, max, opts)};
}

/**
 * A `SelectAmount` model to use as a branch's `optionInput` — when the card's
 * `OrOptions` option IS a `SelectAmount` directly (e.g. TitanShuttles "remove X
 * floaters"). The modal hosts it and NESTS the chosen amount into the branch pick.
 */
export function amountInput(
  title: string | Message,
  label: string,
  min: number,
  max: number,
  opts?: {icon?: string, unit?: string, maxByDefault?: boolean},
): PlayerInputModel {
  return new SelectAmount(title, label, min, max, opts?.maxByDefault ?? true, {icon: opts?.icon, unit: opts?.unit}).toModel();
}

/**
 * A `SelectCard` model to use as a branch's `optionInput` — when the card's
 * `OrOptions` option IS a `SelectCard` DIRECTLY (e.g. AsteroidRights / CometAiming
 * "add 1 asteroid to ANY card" when several candidate cards exist). The modal
 * hosts the target picker and NESTS the `{type:'card', cards}` response into the
 * branch pick (or, when this is the lone auto-resolved branch and the action
 * returns the bare `SelectCard`, submits it directly). Mirror the exact title /
 * label / candidate set the card's `action()` builds.
 */
export function cardInput(
  player: IPlayer,
  title: string | Message,
  label: string,
  cards: ReadonlyArray<ICard>,
  opts?: {
    showOwner?: boolean,
    /** Display mode (e.g. `SELF_REPLICATING_ROBOTS` to show the discounted cost). */
    played?: boolean | CardName.SELF_REPLICATING_ROBOTS,
    /** Relevant-but-unselectable candidates shown greyed with a reason — the
     *  premium picker's Available/Unavailable filter (e.g. Self-Replicating
     *  Robots hand cards WITHOUT a building/space tag). */
    disabled?: ReadonlyArray<{card: ICard, reason: string | Message}>,
  },
): PlayerInputModel {
  return new SelectCard(title, label, cards, {
    showOwner: opts?.showOwner,
    played: opts?.played,
    disabled: opts?.disabled,
  }).toModel(player);
}

/** A `SelectCard` target picker as a STEP (the modal hosts it + captures the
 *  `{type:'card', cards}` response into the batch). Mirror the exact title /
 *  label / candidate set the card's `bespokePlay()` builds. */
export function selectCardStep(
  player: IPlayer,
  title: string | Message,
  label: string,
  cards: ReadonlyArray<ICard>,
  opts?: {showOwner?: boolean, disabled?: ReadonlyArray<{card: ICard, reason: string | Message}>},
): ActionPreviewStep {
  return {kind: 'input', input: cardInput(player, title, label, cards, opts)};
}

/** A single-target `SelectPlayer` as a STEP (the modal hosts the premium
 *  owner-aware picker + captures `{type:'player', player}`). Mirror the exact
 *  candidate set / icon / scope the card's `bespokePlay()` builds. */
export function selectPlayerStep(
  players: ReadonlyArray<IPlayer>,
  title: string | Message,
  buttonLabel: string,
  options?: {icon?: string, amount?: number, scope?: 'stock' | 'production', disabled?: ReadonlyArray<{player: IPlayer, reason: string | Message}>},
): ActionPreviewStep {
  return {kind: 'input', input: new SelectPlayer(players, title, buttonLabel, options).toModel()};
}

/** One declared branch of a bespoke `or` action. */
export type BranchSpec = {
  available: boolean;
  title: string | Message;
  effects?: ReadonlyArray<ActionEffect>;
  // Accepts the `actionReason.*` builders (an UnplayableReason) directly, or a
  // plain string / Message; `orBranches` keeps just the message for display.
  unavailableReason?: string | Message | UnplayableReason;
  /** The branch's `OrOptions` option is THIS direct input (a SelectAmount /
   *  SelectCard, NOT a SelectOption) — its response nests into the branch pick. */
  optionInput?: PlayerInputModel;
  /** Interactive steps (a target picker, etc.) — only used when available.
   *  `undefined` entries (an auto-resolved step) are dropped. */
  steps?: ReadonlyArray<ActionPreviewStep | undefined>;
  /** Ordinal of the printed render node for this branch (defaults to its position). */
  renderKey?: string;
};

function reasonMessage(r: string | Message | UnplayableReason | undefined): string | Message | undefined {
  if (r === undefined || typeof r === 'string') {
    return r;
  }
  // UnplayableReason carries a `type`; a Message carries `data`.
  return 'type' in r ? r.message : r;
}

function definedSteps(steps: ReadonlyArray<ActionPreviewStep | undefined> | undefined): ReadonlyArray<ActionPreviewStep> {
  return (steps ?? []).filter((s): s is ActionPreviewStep => s !== undefined);
}

/*
 * Thin, stable builders for a BESPOKE action card's read-only preview (the
 * `ICard.actionPreview` hook). The hook lives IN the card file next to
 * `action()`/`canAct()` ON PURPOSE — same rationale as `actionReasons.ts`: when
 * a card's action logic changes (a refactor or an upstream merge) the preview is
 * in the same diff, so it can't silently drift. These builders only standardise
 * the COMMON preview shapes so the hook stays a one-liner; the per-card CHOICE
 * (which builder) is expressed in the card file. Consumed by
 * `src/server/models/actionPreview.ts`. NOTHING here mutates game state.
 */

type ActionCard = ICard & IActionCard;

function base(card: ICard) {
  return {
    card: card.name,
    isCorporation: card.type === CardType.CORPORATION,
    cardResource: card.resourceType !== undefined ? {type: card.resourceType, count: card.resourceCount} : undefined,
  };
}

/**
 * A single confirm-only branch with the given steps. `available` defaults to the
 * card's own `canAct`. Use for a bespoke action that presents at most one linear
 * choice after activation.
 */
export function singleBranch(
  card: ActionCard,
  player: IPlayer,
  steps: ReadonlyArray<ActionPreviewStep> = [],
  effects: ReadonlyArray<ActionEffect> = [],
): ActionPreview {
  const branch: ActionPreviewBranch = {
    index: -1,
    title: '',
    available: card.canAct(player),
    renderKeys: [],
    effects,
    steps,
  };
  return {...base(card), kind: 'bespoke', branches: [branch]};
}

/**
 * A single-branch PLAY preview (the on-play behavior is ONE branch, no pick) for
 * a bespoke `bespokePlay` card's `cardPlayPreview` hook. AUTO-includes the card's
 * declarative `behavior` effect chips (so the hook only declares the BESPOKE
 * extras on top — the venus/temperature/production the behavior already raises),
 * then the explicit `extraEffects` and `steps`. `available` is always true — the
 * route only previews cards already in `getPlayableCards()`. A `undefined` step
 * (an auto-resolved / no-candidate choice) is dropped, exactly like the live play.
 */
export function playPreview(
  card: ICard,
  player: IPlayer,
  extraEffects: ReadonlyArray<ActionEffect> = [],
  steps: ReadonlyArray<ActionPreviewStep | undefined> = [],
): ActionPreview {
  const behaviorEffects = card.behavior !== undefined ? effectsForBehavior(player, card, card.behavior) : [];
  const branch: ActionPreviewBranch = {
    index: -1,
    title: '',
    available: true,
    renderKeys: [],
    effects: [...behaviorEffects, ...extraEffects],
    steps: definedSteps(steps),
  };
  return {...base(card), kind: 'bespoke', branches: [branch]};
}

/**
 * The escape hatch for actions that resist a static description (Viron copies
 * another player's used action; SelfReplicatingRobots, etc.): a single
 * confirm-only branch with NO steps. The action's own prompts ride the existing
 * follow-up routing after submit. Honest — the modal shows no false promise.
 */
export function dynamic(card: ActionCard, player: IPlayer): ActionPreview {
  return {...base(card), kind: 'dynamic', branches: [{index: -1, title: '', available: card.canAct(player), renderKeys: [], effects: [], steps: []}]};
}

/**
 * Build a MULTI-BRANCH bespoke preview from explicitly declared branches. The
 * hook lists the branches in the SAME order the card's `action()` pushes its
 * `SelectOption`s; this assigns each AVAILABLE branch its runtime `OrOptions`
 * index in that order. Most bespoke `or` actions auto-resolve a lone executable
 * option (`if (opts.length === 1) return opts[0].cb()`), so a single available
 * branch gets index `-1` (no branch pick) — pass `autoResolveSingle: false` for
 * the rare card that always shows the OrOptions. Unavailable branches are shown
 * (disabled, with their reason + chips) but never submitted (index `-1`).
 */
export function orBranches(
  card: ICard,
  specs: ReadonlyArray<BranchSpec>,
  options?: {autoResolveSingle?: boolean},
): ActionPreview {
  const autoResolveSingle = options?.autoResolveSingle ?? true;
  const availableCount = specs.filter((s) => s.available).length;
  const autoResolve = autoResolveSingle && availableCount === 1;
  let runtimeIdx = 0;
  const branches: Array<ActionPreviewBranch> = specs.map((s, i) => {
    const index = (s.available && !autoResolve) ? runtimeIdx : -1;
    if (s.available) {
      runtimeIdx++;
    }
    return {
      index,
      title: s.title,
      available: s.available,
      unavailableReason: reasonMessage(s.unavailableReason),
      renderKeys: [s.renderKey ?? String(i)],
      effects: s.effects ?? [],
      optionInput: s.available ? s.optionInput : undefined,
      steps: s.available ? definedSteps(s.steps) : [],
    };
  });
  return {...base(card), kind: 'bespoke', branches};
}

/**
 * Host a read-only-built top-level `OrOptions` (an on-play CHOICE the card's
 * `bespokePlay` builds — e.g. an attack's "remove X from player A / Y from
 * player B / skip", or a "raise temperature OR venus" pick) as a STEP. The modal
 * renders it with the SAME premium `ModernOptionPicker` the live follow-up uses
 * (rich player-target cards, current→resulting previews, disabled targets, the
 * skip option, and nested player/card picks), and the chosen `{type:'or', index,
 * response}` is collected into the batch — byte-identical to the live OrOptions.
 *
 * The card MUST build the OrOptions via a SIDE-EFFECT-FREE method (the per-option
 * mutations live in `andThen`), shared with `bespokePlay`, so the preview and the
 * live prompt can't drift. Handles every OrOptions shape (flat SelectOptions AND
 * options that nest a SelectPlayer/SelectCard), unlike a flat branch mapping.
 */
export function orOptionsStep(player: IPlayer, orOptions: OrOptions): ActionPreviewStep {
  return {kind: 'input', input: orOptions.toModel(player)};
}

/** Wrap a pre-built input model (e.g. a deferred action's read-only
 *  `previewSelect*` output) as a step, or `undefined` when there's no model
 *  (the live path auto-resolves / offers no choice → no step). */
export function inputStep(model: PlayerInputModel | undefined): ActionPreviewStep | undefined {
  return model !== undefined ? {kind: 'input', input: model} : undefined;
}

/**
 * "Remove 1 `resource` from any card, then add it to this card" (Predators,
 * Ants). The target picker (a `SelectCard` over every card holding the resource,
 * with disabled twins) is hosted in the modal; a single auto-selected / solo
 * target resolves with no step.
 */
export function removeAddCardResource(player: IPlayer, card: ActionCard, resource: CardResource): ActionPreview {
  const model = new RemoveResourcesFromCard(player, resource, 1, {log: true}).previewSelectCard();
  const steps: ReadonlyArray<ActionPreviewStep> = model !== undefined ? [{kind: 'input', input: model}] : [];
  // The gain: the removed resource lands on THIS card (current → resulting). The
  // cost — which card it's taken from — is the picker step above.
  const effects: ReadonlyArray<ActionEffect> = [{
    direction: 'gain',
    icon: cardResourceIcon(resource),
    amount: 1,
    current: card.resourceCount,
    resulting: card.resourceCount + 1,
    note: 'on this card',
  }];
  return singleBranch(card, player, steps, effects);
}
