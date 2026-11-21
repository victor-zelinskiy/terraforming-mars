/*
 * A RANDOM LEGAL ANSWER TO ANY QUESTION (FREEZE ZERO, stage 5 — docs/claude/console/freeze-zero/PLAN.md §8).
 *
 * `randomAnswer(model, ctx, rng)` reads a prompt's WIRE MODEL — what a seat's page gets — and returns an
 * `InputResponse` the engine's own `process` accepts. Every `PlayerInputModel` type has a case (the `switch` is
 * exhaustive: a new model type does not compile until it has one).
 *
 * THE MODEL IS THE SOURCE wherever it carries enough: which option is live, which card is enabled, which cell is
 * legal, the bounds of an amount. WHERE IT DOES NOT, the engine's own objects are read (`ctx.player`, `ctx.input` —
 * the engine's node behind this model node), and every such read says so at its spot. They are two: a payment's
 * split (the page derives it from the card's tags in its own manifest and the seat's stock) and the opening hand's
 * budget (the page reads the picked corporation off its manifest).
 *
 * EVERY DRAW IS FROM `rng` — no `Math.random`, no clock: the same model and the same generator state give the same
 * answer, which is what makes a violation replayable by its seed.
 *
 * A model that offers NOTHING this generator can answer throws `NoLegalAnswer` — the fuzz's second half of «no
 * unanswerable question» (the first is the engine's own judge, `liveness/UnanswerablePrompt.ts`).
 */
import {CardName} from '../../src/common/cards/CardName';
import {ColorWithNeutral} from '../../src/common/Color';
import {AresGlobalParametersResponse} from '../../src/common/inputs/AresGlobalParametersResponse';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Payment, PaymentOptions} from '../../src/common/inputs/Payment';
import {SPENDABLE_CARD_RESOURCES, SPENDABLE_RESOURCES, SpendableResource} from '../../src/common/inputs/Spendable';
import {CardModel} from '../../src/common/models/CardModel';
import {
  AndOptionsModel, OrOptionsModel, PlayerInputModel, SelectAmountModel, SelectCardModel, SelectColonyModel,
  SelectInitialCardsModel, SelectPartyModel, SelectPaymentModel, SelectProjectCardToPlayModel, SelectSpaceModel,
} from '../../src/common/models/PlayerInputModel';
import {Units} from '../../src/common/Units';
import {Random} from '../../src/common/utils/Random';
import {IPlayer} from '../../src/server/IPlayer';
import {PlayerInput} from '../../src/server/PlayerInput';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {isIStandardProjectCard, IStandardProjectCard} from '../../src/server/cards/IStandardProjectCard';
import {ICorporationCard} from '../../src/server/cards/corporation/ICorporationCard';

/** The model offers nothing this generator can answer (a dead question — or a hole in the generator: the fuzz says which it believes). */
export class NoLegalAnswer extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoLegalAnswer';
  }
}

/** The bias knobs. Each is a probability, each is drawn from the seeded generator only. */
export type FuzzKnobs = {
  /** PASS on a menu that offers it (the option the engine marks `warnings: ['pass']`) — games must end. */
  pass: number;
  /** On an action menu: go for a CARD first (play one / use one's action) — where the engine's rules live. */
  eager: number;
  /** CANCEL a standing placement the engine marks cancellable. */
  cancel: number;
  /** Pay M€ first, another resource only for the deficit (otherwise a random mix). */
  frugal: number;
  /** A card pick takes its MINIMUM (otherwise any legal count). */
  minimal: number;
};

export const DEFAULT_KNOBS: FuzzKnobs = {
  pass: 0.12,
  eager: 0.5,
  cancel: 0.04,
  frugal: 0.6,
  minimal: 0.55,
};

export type AnswerContext = {
  /** The engine's seat. Read ONLY where the wire model cannot carry the answer (see the header). */
  player: IPlayer;
  /** The engine's input behind this node of the model (the same reason; `undefined` when the walk lost it). */
  input?: PlayerInput;
  /** This model IS the seat's standing question (not a part of one) — a CANCEL is an answer to the standing question only. */
  top: boolean;
  knobs: FuzzKnobs;
  /** Every model type the returned answer answers, in order — the fuzz's coverage of prompt types. */
  visited: Array<PlayerInputModel['type']>;
};

/** Every prompt MODEL type, for the coverage table (kept exhaustive by `ALL_TYPES_ARE_LISTED` below). */
export const MODEL_TYPES = [
  'and', 'or', 'initialCards', 'option', 'projectCard', 'card', 'amount', 'colony', 'delegate', 'party', 'payment',
  'player', 'productionToLose', 'space', 'aresGlobalParameters', 'globalEvent', 'resource', 'resources',
  'claimedUndergroundToken', 'deltaProject', 'deltaStageReward', 'deltaEspionage', 'deltaBlockade',
] as const satisfies ReadonlyArray<PlayerInputModel['type']>;
// (A model type missing from the list above fails the type check here.)
const ALL_TYPES_ARE_LISTED: Exclude<PlayerInputModel['type'], typeof MODEL_TYPES[number]> extends never ? true : false = true;
void ALL_TYPES_ARE_LISTED;

function chance(rng: Random, p: number): boolean {
  return rng.next() < p;
}

function pick<T>(rng: Random, list: ReadonlyArray<T>): T {
  return list[rng.nextInt(list.length)];
}

/** An integer in [min, max], both inclusive. */
function between(rng: Random, min: number, max: number): number {
  return max <= min ? min : min + rng.nextInt(max - min + 1);
}

function shuffled<T>(rng: Random, list: ReadonlyArray<T>): Array<T> {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The engine's child input behind option `idx` of an OR / an AND / the opening (they serialize 1:1). */
function childInput(input: PlayerInput | undefined, idx: number): PlayerInput | undefined {
  const options = (input as unknown as {options?: ReadonlyArray<PlayerInput>} | undefined)?.options;
  return options?.[idx];
}

/**
 * `total` units over parts bounded by [min, max] each — a random composition. `undefined` when the bounds cannot
 * hold the total.
 */
function distribute(rng: Random, total: number, bounds: ReadonlyArray<{min: number, max: number}>): Array<number> | undefined {
  const amounts = bounds.map((b) => b.min);
  let left = total - amounts.reduce((a, b) => a + b, 0);
  if (left < 0) {
    return undefined;
  }
  const order = shuffled(rng, bounds.map((_, i) => i));
  // A random first pass (so the split is not always «everything on one part»), then whatever is left, greedily.
  for (const i of order) {
    const add = between(rng, 0, Math.min(left, bounds[i].max - amounts[i]));
    amounts[i] += add;
    left -= add;
  }
  for (const i of order) {
    const add = Math.min(left, bounds[i].max - amounts[i]);
    amounts[i] += add;
    left -= add;
  }
  return left === 0 ? amounts : undefined;
}

/**
 * A PAYMENT worth at least `cost`, or `undefined` when the seat cannot pay it.
 *
 * READS THE ENGINE'S SEAT (the header's first exception): what the seat holds (`megaCredits`, `steel`, …,
 * `getSpendable`) and what a unit of each resource is worth HERE (`payingAmount` — the engine's own arithmetic:
 * the live steel / titanium value, Luna Trade Federation's titanium, a unit that is not usable on this bill is
 * worth 0). The page computes the same from the public player model and its card manifest.
 */
function randomPayment(
  rng: Random,
  ctx: AnswerContext,
  cost: number,
  options: Partial<PaymentOptions>,
  reserve: Readonly<Units> | undefined,
): Payment | undefined {
  const player = ctx.player;
  const available: Payment = {
    ...Payment.EMPTY,
    megacredits: player.megaCredits - (reserve?.megacredits ?? 0),
    steel: player.steel - (reserve?.steel ?? 0),
    titanium: player.titanium - (reserve?.titanium ?? 0),
    plants: player.plants - (reserve?.plants ?? 0),
    heat: player.availableHeat() - (reserve?.heat ?? 0),
  };
  for (const resource of SPENDABLE_CARD_RESOURCES) {
    available[resource] = player.getSpendable(resource);
  }
  const worth = (resource: SpendableResource) => player.payingAmount({...Payment.EMPTY, [resource]: 1}, options);
  const others = shuffled(rng, SPENDABLE_RESOURCES.filter((resource) => resource !== 'megacredits' && available[resource] > 0 && worth(resource) > 0));
  const payment: Payment = {...Payment.EMPTY};
  let left = cost;
  const spend = (resource: SpendableResource, units: number) => {
    const n = Math.max(0, Math.min(units, available[resource] - payment[resource]));
    payment[resource] += n;
    left -= n * worth(resource);
  };
  if (!chance(rng, ctx.knobs.frugal)) {
    // A random mix: some of every other resource first (never more units than the bill can still take).
    for (const resource of others) {
      if (left <= 0) {
        break;
      }
      spend(resource, between(rng, 0, Math.ceil(left / worth(resource))));
    }
  }
  if (left > 0) {
    spend('megacredits', left);
  }
  for (const resource of others) {
    if (left <= 0) {
      break;
    }
    spend(resource, Math.ceil(left / worth(resource)));
  }
  if (left > 0) {
    return undefined;
  }
  // (An over-payment in a coarse unit may have made the M€ share unnecessary — give it back, the bill stays covered.)
  const refund = Math.min(payment.megacredits, -left);
  payment.megacredits -= refund;
  return payment;
}

function enabledCards(cards: ReadonlyArray<CardModel>): Array<CardModel> {
  return cards.filter((card) => card.isDisabled !== true);
}

function answerOr(model: OrOptionsModel, ctx: AnswerContext, rng: Random): InputResponse {
  if (model.options.length === 0) {
    throw new NoLegalAnswer('an OR with no branch');
  }
  // The engine's own mark of the PASS option (`Player.passOption` — never a title).
  const passIdx = model.options.findIndex((option) => option.type === 'option' && option.warnings?.includes('pass') === true);
  let order = shuffled(rng, model.options.map((_, i) => i));
  if (passIdx >= 0 || model.bonusActionPrompt !== undefined) {
    // AN ACTION MENU. A card is where the engine's rules live: the knob puts «play a project card» and «use a card's
    // action» ahead of the menu's other verbs (told by structure: a card to play that is no standard project, a
    // pick the engine marks `selectBlueCardAction`).
    const cardVerbs = order.filter((i) => {
      const option = model.options[i];
      return (option.type === 'projectCard' && option.cards.some((card) => card.standardProjectCanPayWith === undefined && card.standardProjectPreview === undefined)) ||
        (option.type === 'card' && option.selectBlueCardAction);
    });
    if (cardVerbs.length > 0 && chance(rng, ctx.knobs.eager)) {
      order = [...cardVerbs, ...order.filter((i) => !cardVerbs.includes(i))];
    }
  }
  if (passIdx >= 0) {
    // The knob decides the pass; otherwise it is the LAST resort (a menu with nothing else alive still has it).
    const rest = order.filter((i) => i !== passIdx);
    order = chance(rng, ctx.knobs.pass) ? [passIdx, ...rest] : [...rest, passIdx];
  }
  let firstDead: string | undefined;
  for (const index of order) {
    const mark = ctx.visited.length;
    try {
      const response = randomAnswer(model.options[index], {...ctx, top: false, input: childInput(ctx.input, index)}, rng);
      return {type: 'or', index, response};
    } catch (err) {
      if (!(err instanceof NoLegalAnswer)) {
        throw err;
      }
      ctx.visited.length = mark;
      firstDead ??= err.message;
    }
  }
  throw new NoLegalAnswer(`every branch of the OR is dead (${firstDead})`);
}

/** Stormcraft's «how to spend N heat»: heat + 2 × floaters covers N exactly, neither part over-spent. */
function answerSpendHeat(model: AndOptionsModel, target: number, rng: Random): Array<number> | undefined {
  const [heat, floaters] = model.options as Array<SelectAmountModel>;
  const fits: Array<number> = [];
  for (let f = floaters.min; f <= floaters.max; f++) {
    const h = Math.max(0, target - 2 * f);
    if (h >= heat.min && h <= heat.max && (f === 0 || h + 2 * (f - 1) < target)) {
      fits.push(f);
    }
  }
  if (fits.length === 0) {
    return undefined;
  }
  const f = pick(rng, fits);
  return [Math.max(0, target - 2 * f), f];
}

function answerAnd(model: AndOptionsModel, ctx: AnswerContext, rng: Random): InputResponse {
  const parts = model.options;
  // AN AND OF AMOUNTS IS ONE DISTRIBUTION: its parts answer to one total the AND's own callback checks («gain N
  // resources», «distribute N card resources», «spend N heat») — independent amounts would be refused.
  if (parts.length > 0 && parts.every((part) => part.type === 'amount')) {
    const amounts = parts as Array<SelectAmountModel>;
    let split: Array<number> | undefined;
    if (model.spendHeatPrompt !== undefined && amounts.length === 2) {
      split = answerSpendHeat(model, model.spendHeatPrompt.amount, rng);
    } else {
      // The total: the distribution's marker, else the bound every part shares (`GainResources`: each 0…N, N in all).
      const shared = amounts.every((part) => part.max === amounts[0].max) ? amounts[0].max : undefined;
      const total = model.cardResourceDistributionPrompt?.amount ?? shared;
      split = total === undefined ?
        amounts.map((part) => between(rng, part.min, part.max)) :
        distribute(rng, total, amounts);
    }
    if (split === undefined) {
      throw new NoLegalAnswer('an AND of amounts whose bounds cannot hold its total');
    }
    for (const part of amounts) {
      ctx.visited.push(part.type);
    }
    return {type: 'and', responses: split.map((amount) => ({type: 'amount', amount}))};
  }
  return {
    type: 'and',
    responses: parts.map((part, idx) => randomAnswer(part, {...ctx, top: false, input: childInput(ctx.input, idx)}, rng)),
  };
}

function answerInitialCards(model: SelectInitialCardsModel, ctx: AnswerContext, rng: Random): InputResponse {
  const responses = model.options.map((part, idx) => randomAnswer(part, {...ctx, top: false, input: childInput(ctx.input, idx)}, rng));
  // THE OPENING'S BUDGET. READS THE ENGINE (the header's second exception): the picked corporation's starting M€ and
  // card price are on the corporation's own object — the page reads them off its card manifest.
  const engine = ctx.input as unknown as {options: ReadonlyArray<PlayerInput>, inputs?: {corp?: PlayerInput, project?: PlayerInput}} | undefined;
  const corpIdx = engine?.inputs?.corp === undefined ? -1 : engine.options.indexOf(engine.inputs.corp);
  const projectIdx = engine?.inputs?.project === undefined ? -1 : engine.options.indexOf(engine.inputs.project);
  const corpResponse = responses[corpIdx];
  const projectResponse = responses[projectIdx];
  if (corpResponse?.type === 'card' && projectResponse?.type === 'card') {
    const corps = (engine?.inputs?.corp as unknown as {cards: ReadonlyArray<ICorporationCard>}).cards;
    const corp = corps.find((card) => card.name === corpResponse.cards[0]);
    if (corp !== undefined) {
      const price = corp.cardCost ?? ctx.player.cardCost;
      const affordable = price <= 0 ? projectResponse.cards.length : Math.floor(corp.startingMegaCredits / price);
      projectResponse.cards = projectResponse.cards.slice(0, Math.max(0, affordable));
    }
  }
  return {type: 'initialCards', responses};
}

function answerCard(model: SelectCardModel, ctx: AnswerContext, rng: Random): InputResponse {
  const cards = enabledCards(model.cards);
  if (cards.length < model.min) {
    throw new NoLegalAnswer(`${model.min} card(s) asked of ${cards.length} enabled`);
  }
  // (A purchase needs no look at the seat's M€: the engine already narrowed `max` to what the seat can pay for.)
  const count = chance(rng, ctx.knobs.minimal) ? model.min : between(rng, model.min, Math.min(model.max, cards.length));
  return {type: 'card', cards: shuffled(rng, cards).slice(0, count).map((card) => card.name)};
}

function answerProjectCard(model: SelectProjectCardToPlayModel, ctx: AnswerContext, rng: Random): InputResponse {
  // READS THE ENGINE (the header's first exception): which resources may pay for THIS card is a function of the
  // card's tags (`paymentOptionsForCard`) / of the standard project (`canPayWith`) — the page reads both off its
  // card manifest. The card, its price and whether it is enabled come from the model.
  const engine = ctx.input as unknown as {cards?: ReadonlyArray<IProjectCard | IStandardProjectCard>} | undefined;
  const player = ctx.player;
  for (const card of shuffled(rng, enabledCards(model.cards))) {
    const real = engine?.cards?.find((candidate) => candidate.name === card.name);
    let options: Partial<PaymentOptions> = model.paymentOptions;
    if (real !== undefined && isIStandardProjectCard(real)) {
      const canPayWith = real.canPayWith(player);
      options = {
        heat: player.canUseHeatAsMegaCredits,
        steel: canPayWith.steel,
        titanium: canPayWith.titanium,
        seeds: canPayWith.seeds,
        lunaTradeFederationTitanium: player.canUseTitaniumAsMegacredits,
      };
    } else if (real !== undefined) {
      options = player.paymentOptionsForCard(real);
    }
    const payment = randomPayment(rng, ctx, card.calculatedCost ?? 0, options, card.reserveUnits);
    if (payment !== undefined) {
      return {type: 'projectCard', card: card.name, payment};
    }
  }
  throw new NoLegalAnswer('no enabled card the seat can pay for');
}

function answerPayment(model: SelectPaymentModel, ctx: AnswerContext, rng: Random): InputResponse {
  const payment = randomPayment(rng, ctx, model.amount, model.paymentOptions, model.reserveUnits);
  if (payment === undefined) {
    throw new NoLegalAnswer(`a bill of ${model.amount} the seat cannot pay`);
  }
  return {type: 'payment', payment};
}

function answerSpace(model: SelectSpaceModel, ctx: AnswerContext, rng: Random): InputResponse {
  // (A cancel answers the STANDING placement — the page's `cancelPlacement`; a placement that is still an option of a
  // menu is «cancelled» by not choosing it, and the engine refuses a cancel sent there.)
  const cancellable = ctx.top && model.placementContext?.cancellable === true;
  if (model.tileMove !== undefined) {
    // A MOVE names both cells in one answer.
    const sources = model.tileMove.sources.filter((source) => source.to.length > 0);
    if (sources.length > 0 && !(cancellable && chance(rng, ctx.knobs.cancel))) {
      const source = pick(rng, sources);
      return {type: 'space', spaceId: pick(rng, source.to), movedFrom: source.from};
    }
  } else if (model.spaces.length > 0 && !(cancellable && chance(rng, ctx.knobs.cancel))) {
    return {type: 'space', spaceId: pick(rng, model.spaces)};
  }
  if (cancellable) {
    return {type: 'cancel'};
  }
  throw new NoLegalAnswer('a cell asked with no legal cell and no cancel');
}

function answerColony(model: SelectColonyModel, ctx: AnswerContext, rng: Random): InputResponse {
  if (ctx.top && model.placementContext?.cancellable === true && chance(rng, ctx.knobs.cancel)) {
    return {type: 'cancel'};
  }
  const disabled = new Set((model.disabledColonies ?? []).map((entry) => entry.name));
  const tiles = model.coloniesModel.map((colony) => colony.name).filter((name) => !disabled.has(name));
  if (model.rosterChange?.kind === 'replace') {
    // ONE answer names both tiles: the one that enters and the one that leaves.
    const outgoing = (model.rosterChange.outgoing ?? []).filter((tile) => tile.reason === undefined);
    if (tiles.length === 0 || outgoing.length === 0) {
      throw new NoLegalAnswer('a colony replacement with no tile to enter or none to leave');
    }
    return {type: 'colony', colonyName: pick(rng, tiles), replaces: pick(rng, outgoing).colony};
  }
  const docks = (model.fleetDocks ?? []).filter((dock) => dock.available);
  const choices = tiles.length + docks.length;
  if (choices === 0) {
    throw new NoLegalAnswer('a colony asked with no tile and no fleet dock');
  }
  const at = rng.nextInt(choices);
  return at < tiles.length ? {type: 'colony', colonyName: tiles[at]} : {type: 'colony', fleetDock: docks[at - tiles.length].card};
}

function answerParty(model: SelectPartyModel, rng: Random): InputResponse {
  if (model.delegatePrompt !== undefined) {
    // A DELEGATE PICK: which cube, of whom, in which place of which party.
    const targets = model.delegatePrompt.targets;
    if (targets.length === 0) {
      throw new NoLegalAnswer('a delegate pick with no delegate on the table');
    }
    const target = pick(rng, targets);
    return {type: 'party', partyName: target.party, delegate: {place: target.place, owner: target.owner}};
  }
  if (model.parties.length === 0) {
    throw new NoLegalAnswer('a party asked with none to choose');
  }
  return {type: 'party', partyName: pick(rng, model.parties)};
}

/**
 * A Hydronetwork advance of `amount` steps WITH ITS MIX. The model names the step counts only; who pays them —
 * energy, and under Delta Works steel from the stock and steel on Modular Floodgates, 1:1 — is the answer's to say
 * (the menu's door always passes a mix on: an answer naming none is read as «all energy»).
 *
 * READS THE ENGINE'S SEAT (the payment exception of the header): the three stocks the mix is drawn from — the page
 * reads the same off the public player model and the track's own preview.
 */
function answerDeltaProject(amount: number, ctx: AnswerContext, rng: Random): InputResponse {
  const player = ctx.player;
  const works = player.tableau.has(CardName.DELTA_WORKS);
  const pools: Array<['energy' | 'steel' | 'cardSteel', number]> = [
    ['energy', player.energy],
    ['steel', works ? player.steel : 0],
    ['cardSteel', works ? player.getSpendable('floodgateSteel') : 0],
  ];
  // Energy first as a rule; sometimes steel first, so the substitution is walked too.
  const order = chance(rng, ctx.knobs.frugal) ? pools : shuffled(rng, pools);
  const mix = {energy: 0, steel: 0, cardSteel: 0};
  let left = amount;
  for (const [pool, have] of order) {
    const take = Math.max(0, Math.min(left, have));
    mix[pool] = take;
    left -= take;
  }
  return {
    type: 'deltaProject',
    amount,
    ...(mix.steel > 0 ? {steel: mix.steel} : {}),
    ...(mix.cardSteel > 0 ? {cardSteel: mix.cardSteel} : {}),
  };
}

const STANDARD_RESOURCES = Units.keys;

/**
 * A RANDOM LEGAL ANSWER to `model`. Throws `NoLegalAnswer` when the model offers nothing answerable.
 */
export function randomAnswer(model: PlayerInputModel, ctx: AnswerContext, rng: Random): InputResponse {
  ctx.visited.push(model.type);
  switch (model.type) {
  case 'option':
    return {type: 'option'};
  case 'or':
    return answerOr(model, ctx, rng);
  case 'and':
    return answerAnd(model, ctx, rng);
  case 'initialCards':
    return answerInitialCards(model, ctx, rng);
  case 'card':
    return answerCard(model, ctx, rng);
  case 'projectCard':
    return answerProjectCard(model, ctx, rng);
  case 'payment':
    return answerPayment(model, ctx, rng);
  case 'space':
    return answerSpace(model, ctx, rng);
  case 'colony':
    return answerColony(model, ctx, rng);
  case 'party':
    return answerParty(model, rng);
  case 'player':
    if (model.players.length === 0) {
      throw new NoLegalAnswer('a player asked with nobody to choose');
    }
    return {type: 'player', player: pick(rng, model.players)};
  case 'delegate':
    if (model.players.length === 0) {
      throw new NoLegalAnswer('a delegate asked with nobody to choose');
    }
    return {type: 'delegate', player: pick<ColorWithNeutral>(rng, model.players)};
  case 'amount':
    if (model.max < model.min) {
      throw new NoLegalAnswer(`an amount asked between ${model.min} and ${model.max}`);
    }
    return {type: 'amount', amount: model.maxByDefault && chance(rng, 0.5) ? model.max : between(rng, model.min, model.max)};
  case 'productionToLose': {
    // Each production may fall to 0 — M€ production to −5 (`Production.canAdjust`).
    const have = model.payProduction.units;
    const split = distribute(rng, model.payProduction.cost, STANDARD_RESOURCES.map((key) => ({
      min: 0,
      max: Math.max(0, key === 'megacredits' ? have.megacredits + 5 : have[key]),
    })));
    if (split === undefined) {
      throw new NoLegalAnswer(`${model.payProduction.cost} production step(s) asked of a seat that cannot lose them`);
    }
    return {type: 'productionToLose', units: Units.of(Object.fromEntries(STANDARD_RESOURCES.map((key, i) => [key, split[i]])))};
  }
  case 'aresGlobalParameters': {
    const delta = () => pick(rng, [-1, 0, 1] as const);
    const response: AresGlobalParametersResponse = {lowOceanDelta: delta(), highOceanDelta: delta(), temperatureDelta: delta(), oxygenDelta: delta()};
    return {type: 'aresGlobalParameters', response};
  }
  case 'globalEvent':
    if (model.globalEventNames.length === 0) {
      throw new NoLegalAnswer('a global event asked with none to choose');
    }
    return {type: 'globalEvent', globalEventName: pick(rng, model.globalEventNames)};
  case 'resource':
    if (model.include.length === 0) {
      throw new NoLegalAnswer('a resource asked with none to choose');
    }
    return {type: 'resource', resource: pick(rng, model.include)};
  case 'resources': {
    const split = distribute(rng, model.count, STANDARD_RESOURCES.map(() => ({min: 0, max: model.count}))) ?? [];
    return {type: 'resources', units: Units.of(Object.fromEntries(STANDARD_RESOURCES.map((key, i) => [key, split[i] ?? 0])))};
  }
  case 'claimedUndergroundToken': {
    if (model.tokens.length < model.min) {
      throw new NoLegalAnswer(`${model.min} token(s) asked of ${model.tokens.length}`);
    }
    const count = between(rng, model.min, Math.min(model.max, model.tokens.length));
    return {type: 'claimedUndergroundToken', selected: shuffled(rng, model.tokens.map((_, i) => i)).slice(0, count)};
  }
  case 'deltaProject':
    if (model.validSteps.length === 0) {
      throw new NoLegalAnswer('a Hydronetwork advance asked with no valid step');
    }
    return answerDeltaProject(pick(rng, model.validSteps), ctx, rng);
  case 'deltaStageReward':
    if (model.claimable.length === 0) {
      throw new NoLegalAnswer('a Hydronetwork stage reward asked with none claimable');
    }
    return {type: 'deltaStageReward', position: pick(rng, model.claimable)};
  case 'deltaEspionage': {
    // A target is REQUIRED exactly when a legal one exists, FORBIDDEN otherwise.
    const legal = model.projection.targets.filter((target) => target.legal);
    if (!model.projection.hasLegalTarget || legal.length === 0) {
      return {type: 'deltaEspionage'};
    }
    const target = pick(rng, legal);
    return {type: 'deltaEspionage', target: target.color, expectedTargetFrom: target.fromPosition, expectedOwnerFrom: model.projection.owner.fromPosition};
  }
  case 'deltaBlockade': {
    const legal = model.projection.targets.filter((target) => target.legal);
    if (!model.projection.hasLegalTarget || legal.length === 0 || model.projection.cardSteel < 1) {
      throw new NoLegalAnswer('a Hydronetwork blockade asked with no legal target or no steel on the card');
    }
    const target = pick(rng, legal);
    return {type: 'deltaBlockade', target: target.color, expectedTargetFrom: target.position};
  }
  default: {
    const unknown: never = model;
    throw new NoLegalAnswer(`the generator has no answer for a «${(unknown as {type: string}).type}» question`);
  }
  }
}

/** A card an answer NAMES as its subject (the card played / the action card picked) — the trace's «source». */
export function cardNamedBy(response: InputResponse): CardName | undefined {
  switch (response.type) {
  case 'projectCard':
    return response.card;
  case 'or':
    return cardNamedBy(response.response);
  case 'card':
    return response.cards.length === 1 ? response.cards[0] : undefined;
  default:
    return undefined;
  }
}
