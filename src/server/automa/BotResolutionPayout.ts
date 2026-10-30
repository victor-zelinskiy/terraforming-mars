import {Resource} from '../../common/Resource';
import {
  declaredCardResourceKinds,
  InfluenceScaledEffect,
  levelAmount,
  levelTakesAway,
  scaledAmount,
  sequelAmount,
  uncappedAmount,
} from '../../common/parliament/influenceScaling';
import {ResolutionCountModel} from '../../common/parliament/resolutionCounts';
import {EnactContext, EnactOutcome, EnactStep, ResolutionDefinition} from '../parliament/resolutions/IResolution';
import {levyStep} from '../parliament/resolutions/ResolutionLevy';
import {resolutionCount} from '../parliament/resolutions/ResolutionCounts';
import {countedBreakdown} from '../parliament/resolutions/ResolutionProductionCount';
import {ownColonyBonuses} from '../colonies/allColonyBonuses';
import {botProductionEquivalent} from './BotResolutionCounts';

/**
 * WHAT AN ENACTED RESOLUTION PAYS MARSBOT (decision D16, the owner
 * 2026-10-27, replacing D3): the bot is paid and charged like every seat —
 * under the hood every unit becomes MEGACREDITS, which its end-game exchange
 * turns into points (`AutomaScoring.mcPerVp`), while every surface reads the
 * payout in the PLAYER's units («+3 steel production»), so the bot sits at the
 * table as one more player.
 *
 * ONE executor for every resolution, read off the card's DECLARATION — the
 * same `scaled` formula the human steps pay by (the influence term, the count
 * term, the flat part, the cap, the level, the sequel): nothing per card, so a
 * new resolution pays the bot the day it declares its formula. Its counts are
 * the bot's OWN (`BotResolutionCounts` behind `resolutionCount`: the tracks for
 * tags, the played pile for cards, the tracks for production, the stores for
 * holders; the board, the colonies and the rating are real). The LEVY is the
 * shared step (M€, the bot pays it from its M€ like any seat). The deeds a law
 * grants (a tile, a step of the Career) stay the bot's own primitives
 * (`runBotSeatGrant`), the winner's part its own pass.
 *
 * THE RATE — the Automa rulebook's own conversions (the owner's choice):
 * 1 M€ per unit of a standard resource, per card, per resource onto a card and
 * per colony bonus paid (the bot's colony bonus is one stored resource, RB-A);
 * 2 M€ per step of production (p.9 — the heat-production bonuses of the
 * temperature track). A cut (Plant Ban) takes the bot's real stock.
 */
export const BOT_UNIT_MEGACREDITS = 1;
export const BOT_PRODUCTION_STEP_MEGACREDITS = 2;

/** The bot's steps for `definition`'s enactment, in the card's order: the levy, then every scaled part it receives. */
export function botPayoutSteps(definition: ResolutionDefinition): ReadonlyArray<EnactStep> {
  const steps: Array<EnactStep> = [];
  if (definition.levy !== undefined) {
    steps.push(levyStep(definition.id, definition.levy));
  }
  for (const effect of definition.scaled ?? []) {
    steps.push(botScaledStep(definition, effect));
  }
  return steps;
}

/** The M€ the bot receives for `amount` units of `effect`'s unit (a colony bonus is counted by the caller). */
export function botMegacreditsOf(effect: InfluenceScaledEffect, amount: number): number {
  switch (effect.unit.kind) {
  case 'production': return amount * BOT_PRODUCTION_STEP_MEGACREDITS;
  case 'stock':
  case 'cards':
  case 'cardResource':
  case 'colonyBonuses':
    return amount * BOT_UNIT_MEGACREDITS;
  }
}

const GAINED_KEY = 'bot:gained:';

function botScaledStep(definition: ResolutionDefinition, effect: InfluenceScaledEffect): EnactStep {
  return {
    key: `bot:${effect.id}`,
    run(ctx) {
      const bot = ctx.player;
      if (effect.recipient === 'winner' && ctx.winner?.id !== bot.id) {
        return undefined;
      }
      const influence = ctx.influence;
      const counted = effect.count === undefined ? undefined : resolutionCount(bot, effect.count.id);
      const recorded: Partial<EnactOutcome> = {
        effect: effect.id,
        influence,
        ...(counted === undefined ? {} : countedFields(counted)),
      };
      if (effect.level !== undefined) {
        return payLevel(ctx, definition, effect, recorded, counted);
      }
      const amount = effect.sequel !== undefined ?
        sequelAmount(effect, sequelTotal(ctx, effect)) :
        scaledAmount(effect, influence, counted?.count ?? 0);
      const uncapped = effect.sequel === undefined ? uncappedAmount(effect, influence, counted?.count ?? 0) : amount;
      if (effect.unit.kind === 'colonyBonuses') {
        return payColonyBonuses(ctx, definition, amount, recorded);
      }
      const unitFields = unitRecordFields(effect);
      if (amount <= 0) {
        ctx.game.log('${0} gains nothing from ${1}', (b) => b.player(bot).resolution(definition.id));
        ctx.report({kind: 'skipped', ...recorded, ...unitFields, amount: 0, reason: counted !== undefined ? 'Nothing counted' : 'No influence'});
        return undefined;
      }
      const megacredits = botMegacreditsOf(effect, amount);
      bot.stock.add(Resource.MEGACREDITS, megacredits, {log: false, from: {resolution: definition.id}});
      if (effect.unit.kind === 'production') {
        const key = GAINED_KEY + effect.unit.resource;
        ctx.state[key] = (typeof ctx.state[key] === 'number' ? ctx.state[key] as number : 0) + amount;
      }
      logPayout(ctx, definition, effect, amount);
      ctx.report({kind: recordKind(effect), ...recorded, ...unitFields, amount, ...(uncapped > amount ? {uncapped} : {}), megacredits});
      return undefined;
    },
  };
}

/** The total a SEQUENTIAL part divides: the bot's production equivalent of the term's resource + what this enactment just added. */
function sequelTotal(ctx: EnactContext, effect: InfluenceScaledEffect): number {
  const total = effect.sequel?.total;
  if (total === undefined || total.kind !== 'production') {
    return 0;
  }
  const gained = ctx.state[GAINED_KEY + total.resource];
  return botProductionEquivalent(ctx.player, total.resource) + (typeof gained === 'number' ? gained : 0);
}

/** A LEVEL part: a top-up the bot receives in full (it holds no hand), a cut taken from its real stock. */
function payLevel(ctx: EnactContext, definition: ResolutionDefinition, effect: InfluenceScaledEffect, recorded: Partial<EnactOutcome>, counted: ResolutionCountModel | undefined): undefined {
  const bot = ctx.player;
  const unit = effect.unit;
  const current = unit.kind === 'stock' ? bot.stock.get(unit.resource) : 0;
  const target = scaledAmount(effect, ctx.influence, counted?.count ?? 0);
  const amount = levelAmount(effect, ctx.influence, current, counted?.count ?? 0);
  const unitFields = unitRecordFields(effect);
  if (amount <= 0) {
    ctx.report({kind: 'skipped', ...recorded, ...unitFields, amount: 0, target, reason: levelTakesAway(effect) ? 'Nothing to lose' : 'Nothing to draw'});
    return undefined;
  }
  if (levelTakesAway(effect) && unit.kind === 'stock') {
    bot.stock.add(unit.resource, -amount, {log: false, from: {resolution: definition.id}});
    ctx.game.log('${0} loses ${1} ${2} to ${3}', (b) => b.player(bot).number(amount).resource(unit.resource).resolution(definition.id));
    ctx.report({kind: 'stock', ...recorded, ...unitFields, amount: -amount, owed: amount, target});
    return undefined;
  }
  const megacredits = botMegacreditsOf(effect, amount);
  bot.stock.add(Resource.MEGACREDITS, megacredits, {log: false, from: {resolution: definition.id}});
  logPayout(ctx, definition, effect, amount);
  ctx.report({kind: recordKind(effect), ...recorded, ...unitFields, amount, target, megacredits});
  return undefined;
}

/** «All your colony bonuses k times»: each of the bot's cubes pays its bonus k times — one record per tile, as a human's. */
function payColonyBonuses(ctx: EnactContext, definition: ResolutionDefinition, times: number, recorded: Partial<EnactOutcome>): undefined {
  const bot = ctx.player;
  const own = ownColonyBonuses(ctx.game, bot);
  if (own.length === 0 || times <= 0) {
    ctx.report({kind: 'skipped', ...recorded, amount: 0, multiplier: times, reason: 'No colonies'});
    return undefined;
  }
  for (const {colony, cubes} of own) {
    const amount = times * cubes;
    const megacredits = amount * BOT_UNIT_MEGACREDITS;
    bot.stock.add(Resource.MEGACREDITS, megacredits, {log: false, from: {resolution: definition.id}});
    // What the bot REALLY received is M€ (one per bonus paid, `BOT_UNIT_MEGACREDITS`) — the record says so in its unit
    // (`stock`), never with the tile's printed description: «Draw 1 card, then discard 1 card» over the bot's results
    // row described a draw the bot never made (P71 · CY, R4).
    ctx.report({kind: 'colonyBonus', ...recorded, colony: colony.name, stock: Resource.MEGACREDITS, cubes, multiplier: times, amount: megacredits, megacredits});
  }
  ctx.game.log('${0} gains all colony bonuses ${1} time(s) from ${2}', (b) => b.player(bot).number(times).resolution(definition.id));
  return undefined;
}

function recordKind(effect: InfluenceScaledEffect): EnactOutcome['kind'] {
  switch (effect.unit.kind) {
  case 'stock': return 'stock';
  case 'production': return 'production';
  case 'cards': return 'cards';
  case 'cardResource': return 'cardResource';
  case 'colonyBonuses': return 'colonyBonus';
  }
}

/** The unit as a human's record names it — the icon the results row draws. */
function unitRecordFields(effect: InfluenceScaledEffect): Partial<EnactOutcome> {
  const unit = effect.unit;
  switch (unit.kind) {
  case 'stock': return {stock: unit.resource};
  case 'production': return {production: unit.resource};
  case 'cards': return {};
  case 'colonyBonuses': return {};
  case 'cardResource': {
    if (unit.onto === 'each-counted') {
      return {onto: 'each-counted'};
    }
    const kinds = declaredCardResourceKinds(unit);
    if (kinds === undefined) {
      return {};
    }
    return kinds.length === 1 ? {resource: kinds[0]} : {resources: [...kinds]};
  }
  }
}

function countedFields(counted: ResolutionCountModel): Partial<EnactOutcome> {
  return {count: counted.count, counted: [...counted.cards], ...countedBreakdown(counted)};
}

/** THE JOURNAL — in the player's units (the bot is one more player at the table; the M€ is under the hood). */
function logPayout(ctx: EnactContext, definition: ResolutionDefinition, effect: InfluenceScaledEffect, amount: number): void {
  const bot = ctx.player;
  const unit = effect.unit;
  switch (unit.kind) {
  case 'stock':
    ctx.game.log('${0} gains ${1} ${2} from ${3}', (b) => b.player(bot).number(amount).resource(unit.resource).resolution(definition.id));
    return;
  case 'production':
    ctx.game.log('${0} gains ${1} ${2} production from ${3}', (b) => b.player(bot).number(amount).resource(unit.resource).resolution(definition.id));
    return;
  case 'cards':
    ctx.game.log('${0} draws ${1} card(s) from ${2}', (b) => b.player(bot).number(amount).resolution(definition.id));
    return;
  case 'cardResource':
    ctx.game.log('${0} adds ${1} resource(s) to its cards from ${2}', (b) => b.player(bot).number(amount).resolution(definition.id));
    return;
  case 'colonyBonuses':
    return;
  }
}
