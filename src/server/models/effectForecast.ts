import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {ICard} from '../cards/ICard';
import {isIProjectCard} from '../cards/IProjectCard';
import {armedPlayEffectsOf} from '../cards/armedPlayEffects';
import {armedPlayForecastOf} from './armedPlayForecast';
import {CardName} from '../../common/cards/CardName';
import {SpaceId} from '../../common/Types';
import {CardResource} from '../../common/CardResource';
import {CardType} from '../../common/cards/CardType';
import {Resource} from '../../common/Resource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {SpaceType} from '../../common/boards/SpaceType';
import {BASE_OCEAN_TILES, CITY_TILES, GREENERY_TILES, OCEAN_TILES, TileType} from '../../common/TileType';
import {
  ALT_VENUS_MINIMUM_BONUS, MAX_OCEAN_TILES, MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MAX_VENUS_SCALE, OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS,
  TEMPERATURE_BONUS_FOR_HEAT_1, TEMPERATURE_BONUS_FOR_HEAT_2, TEMPERATURE_FOR_OCEAN_BONUS, VENUS_LEVEL_FOR_CARD_BONUS, VENUS_LEVEL_FOR_TR_BONUS,
} from '../../common/constants';
import {Behavior} from '../behavior/Behavior';
import {PartyHooks} from '../turmoil/parties/PartyHooks';
import {PartyName} from '../../common/turmoil/PartyName';
import {isPlanetaryTag} from '../pathfinders/PathfindersData';
import {AutomaCorporations} from '../automa/corps/AutomaCorporations';
import {marsBotOf} from '../automa/AutomaUtil';
import {ActionEffect, ActionPreview, ActionPreviewBranch, ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {SelectCardModel} from '../../common/models/PlayerInputModel';
import {
  EffectForecast,
  EffectForecastCertainty,
  EffectForecastDiscounts,
  EffectForecastFact,
  EffectForecastPaymentValue,
  EffectForecastRecipient,
  EffectForecastSource,
  emptyEffectForecast,
} from '../../common/models/EffectForecastModel';
import {EffectForecastContext, EffectForecastGrant, EffectForecastTile} from '../cards/EffectForecastContext';
import {cardResourceGain, cardResourceIcon, drawGain, globalGain, globalParameterStepSize, oceanGain, productionChange, stockGain, trGain} from '../cards/actionPreviews';
import {divertedDataOf} from './divertedTerraforming';
import {vetoedStepsOf} from './vetoedRating';
import {ratingVetoed} from '../parliament/ratingVetoGate';
import * as forecast from '../cards/effectForecastPreviews';
import {GREENS_MEGACREDITS_PER_TR} from '../parliament/parties/PartyEffects';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES, SpendableCardResource} from '../../common/inputs/Spendable';
import {DEFAULT_PAYMENT_VALUES} from '../../common/inputs/Payment';
import {WorldParameterMove} from '../../common/parliament/parameterMove';

/**
 * THE EFFECT FORECAST ENGINE — what the table answers to a card play / a card
 * action, computed on the server by the SAME code the live hooks read, and
 * attached to the two preview responses by their routes.
 *
 * It is a MIRROR of the live fan-out, never a simulation:
 *
 *  1. `Player.onCardPlayed`'s walk, in its order — the acting player's own
 *     tableau (`onCardPlayed`), the Turmoil policy hook, EVERY seat's tableau
 *     in generation order (`onCardPlayedByAnyPlayer`), Pathfinders, the
 *     MarsBot corporation (`onHumanCardPlayed`). Each reactor answers through
 *     its co-located `cardPlayedForecast`; a reactor with the live hook and no
 *     forecast is reported as `unknown` — the honesty law («сработает,
 *     результат не рассчитан»), never silence. The played card is a reactor
 *     of its own play («including this» — the live path pushes it into the
 *     tableau BEFORE the fan-out).
 *  2. A SECOND-ORDER pass: every grant the operation makes (the preview's own
 *     chips, plus the exact / deferred first-order facts' chips, each on its
 *     recipient's tableau) is offered to the `onProductionGain` /
 *     `onResourceAdded` reactors through `grantForecast`.
 *  3. A TILE pass: every tile the operation will place (the preview's board
 *     placement steps and the reserved off-Mars slots) is offered to every
 *     seat's `onTilePlaced` reactors through `tilePlacedForecast` — `deferred`
 *     facts, since the cell is not chosen yet.
 *  3b. A COLONY pass: every colony the operation will build (a declarative
 *     `buildColony`, a colony pick carrying `buildSites`) is offered to every
 *     seat's `onColonyAddedByAnyPlayer` reactors through `grantForecast` (a
 *     `colony` grant) — the reaction does not depend on the tile chosen.
 *  4. The DISCOUNTS through `getCardCostBreakdown` (the same itemization the
 *     analytics record) and the PAYMENT VALUES through the play prompt's own
 *     `paymentOptionsForCard`.
 *
 * READ-ONLY by contract: nothing here defers, logs, adds, removes or records
 * — the purity spec serializes the game before and after.
 */

// ── the card-played fan-out ─────────────────────────────────────────────────

/** A cardless source (a party policy, the Pathfinders track). */
function ruleSource(name: string, owner: IPlayer): EffectForecastSource {
  return {kind: 'rule', name, owner: owner.color, channel: 'card-played'};
}

function unknownFor(card: ICard, owner: IPlayer, active: IPlayer, channel: EffectForecastSource['channel'], reason: string, timing?: EffectForecastFact['timing']): EffectForecastFact {
  return forecast.unknown(forecast.sourceOf(card, owner, channel), reason, {
    recipient: forecast.recipientOf(active, owner),
    timing,
  });
}

/**
 * The reactors of ONE seat for the card-played channel — the seat's tableau
 * plus, for the ACTING seat, the card being played when it is not in the
 * tableau yet (a hand card / a prelude / the picked corporation): the live
 * path pushes it in before the fan-out, so its own hooks fire on its own play.
 */
function reactorsOf(owner: IPlayer, active: IPlayer, card: ICard | undefined): Array<ICard> {
  const out: Array<ICard> = [...owner.playedCards];
  if (card !== undefined && owner.id === active.id && !owner.playedCards.has(card.name)) {
    out.push(card);
  }
  return out;
}

/**
 * TURMOIL REDUX — the ENACTED RESOLUTION's passive answers the acting seat's
 * PLAY through its own card-played twin (`ResolutionPassive.cardPlayedForecast`
 * — Urban Development draws a card per Building tag). It is asked from INSIDE
 * the fan-out, at the position the live hook occupies, not appended to the end
 * like the grant/tile twin (`resolutionFacts`): this module is a mirror of the
 * live walk, and a mirror that reorders is not one. Nothing while no law with
 * a card-played passive stands, and never for a seat outside the parliament.
 */
function resolutionCardPlayedFacts(player: IPlayer, card: ICard): Array<EffectForecastFact> {
  const parliament = player.game.parliament;
  const enacted = parliament?.enactedDefinition();
  const passive = enacted?.passive;
  if (parliament === undefined || enacted === undefined || passive === undefined ||
      passive.onCardPlayed === undefined || !parliament.participates(player, 'enactment')) {
    return [];
  }
  const source = (channel: EffectForecastSource['channel']): EffectForecastSource =>
    ({kind: 'resolution', name: enacted.id, owner: player.color, channel});
  if (passive.cardPlayedForecast === undefined) {
    // Unreachable while the contract guard stands (it refuses the live hook
    // without its twin) — and stated honestly all the same, as for a card.
    return [forecast.unknown(source('card-played'), 'The enacted resolution reacts to the play, but its result is not described')];
  }
  return passive.cardPlayedForecast({
    player,
    card,
    source,
    exact: (factSource, effects, title, opts) => forecast.exact(factSource, effects, title, opts),
    stockGain: (resource, amount) => stockGain(player, resource, amount),
    productionChange: (resource, delta) => productionChange(player, resource, delta),
    drawGain: (count) => drawGain(count),
  });
}

function cardPlayedFacts(player: IPlayer, card: ICard, ctx: EffectForecastContext): Array<EffectForecastFact> {
  const game = player.game;
  const facts: Array<EffectForecastFact> = [];
  if (card.type === CardType.PROXY) {
    return facts;
  }

  // 1. The acting player's own tableau (`onCardPlayed`).
  for (const effectCard of reactorsOf(player, player, card)) {
    if (effectCard.onCardPlayed === undefined) {
      continue;
    }
    const own = effectCard.cardPlayedForecast?.(player, player, card, ctx);
    facts.push(...(own ?? [unknownFor(effectCard, player, player, 'card-played', 'This card reacts to the play, but its result is not described')]));
  }

  // 2. The Turmoil policy hook — out of scope: one honest unknown when a
  //    policy that reacts to card plays is in force.
  if (game.gameOptions.turmoilExtension === true &&
      (PartyHooks.shouldApplyPolicy(player, PartyName.GREENS, 'gp03') || PartyHooks.shouldApplyPolicy(player, PartyName.MARS, 'mp02'))) {
    facts.push(forecast.unknown(ruleSource('Ruling party policy', player), 'The ruling party\'s policy reacts to card plays'));
  }

  // 2.5. THE ENACTED RESOLUTION (Turmoil Redux) — the law answers the play
  //      exactly where `ParliamentHandler.onCardPlayed` stands in the live
  //      walk: after the Turmoil policy, before the other seats' tableaus.
  facts.push(...resolutionCardPlayedFacts(player, card));

  // 3. Every seat's tableau, in generation order (`onCardPlayedByAnyPlayer`).
  for (const somePlayer of game.playersInGenerationOrder) {
    for (const effectCard of reactorsOf(somePlayer, player, card)) {
      if (effectCard.onCardPlayedByAnyPlayer === undefined) {
        continue;
      }
      const any = effectCard.cardPlayedForecast?.(somePlayer, player, card, ctx);
      facts.push(...(any ?? [unknownFor(effectCard, somePlayer, player, 'card-played-by-any', 'This card reacts to the play, but its result is not described')]));
    }
  }

  // 4. Pathfinders — out of scope: an honest unknown per planetary tag play.
  if (game.gameOptions.pathfindersExpansion === true && card.tags.some((tag) => isPlanetaryTag(tag))) {
    facts.push(forecast.unknown(ruleSource('Pathfinders track', player), 'The Pathfinders track advances on this tag'));
  }

  // 5. The MarsBot corporation watching the human side of the table.
  const bot = AutomaCorporations.humanCardPlayedForecast(game, player, card, ctx);
  if (bot === undefined) {
    const corp = AutomaCorporations.activeCorp(game);
    const marsBot = marsBotOf(game);
    facts.push(forecast.unknown(
      {kind: 'automa-corporation', name: corp?.info.original ?? CardName.SATURN_SYSTEMS, owner: marsBot.color, channel: 'automa-corporation'},
      'MarsBot\'s corporation reacts to this play, but its result is not described',
      {recipient: {kind: 'bot', color: marsBot.color}}));
  } else if (bot !== null) {
    facts.push(...bot);
  }
  return facts;
}

// ── the second-order pass (grants → onProductionGain / onResourceAdded) ────

const STANDARD_ICONS: ReadonlySet<string> = new Set(Object.values(Resource));
const GLOBAL_ICONS: Readonly<Record<string, GlobalParameter>> = {
  oxygen: GlobalParameter.OXYGEN,
  temperature: GlobalParameter.TEMPERATURE,
  venus: GlobalParameter.VENUS,
  oceans: GlobalParameter.OCEANS,
};

let cardResourceByIcon: Map<string, CardResource> | undefined;
function cardResourceForIcon(icon: string): CardResource | undefined {
  if (cardResourceByIcon === undefined) {
    cardResourceByIcon = new Map(Object.values(CardResource).map((r) => [cardResourceIcon(r), r]));
  }
  return cardResourceByIcon.get(icon);
}

/**
 * The STEPS a global chip makes — never its percent / degree amount: a Venus
 * chip «+4 %» is two steps, a temperature «+2 °C» one, and a raise the ceiling
 * cuts (`globalGain` clamps `resulting`) makes only the steps up to it — Venus
 * at 28 % «raised by 2» is ONE step, the very number the engine pays its
 * reactors with (`Game.increaseVenusScaleLevel`). The oceans count tiles.
 */
function scaleStepsOf(effect: ActionEffect, parameter: GlobalParameter): number {
  const scale = parameter === GlobalParameter.OXYGEN ? 'oxygen' :
    parameter === GlobalParameter.TEMPERATURE ? 'temperature' :
      parameter === GlobalParameter.VENUS ? 'venus' : undefined;
  if (scale === undefined) {
    return effect.amount;
  }
  const delta = effect.current !== undefined && effect.resulting !== undefined ? effect.resulting - effect.current : effect.amount;
  return Math.floor(delta / globalParameterStepSize(scale));
}

/** ONE chip → the grant the second-order hooks see (undefined = a cost, a gain
 *  that changes NOTHING — a parameter already at its cap reads `current ===
 *  resulting` — or nothing a hook reacts to). */
export function grantOfEffect(effect: ActionEffect): EffectForecastGrant | undefined {
  // A STRUCK chip (a law's replacement, RX35) grants nothing: the scale does not move, the tile is not seated — no
  // rating for the Greens, no bonus step, no reactor of the raise. A VETOED rating (RX42) grants nothing either: the
  // seat gains no rating, so the Greens have nothing to pay for.
  if (effect.direction !== 'gain' || effect.amount <= 0 || effect.implied === true || effect.diverted !== undefined || effect.vetoed !== undefined) {
    return undefined;
  }
  if (effect.current !== undefined && effect.resulting !== undefined && effect.resulting <= effect.current) {
    return undefined;
  }
  if (effect.icon === 'tr') {
    return {kind: 'tr', amount: effect.amount};
  }
  if (effect.icon === 'cards') {
    return {kind: 'cards', amount: effect.amount};
  }
  const parameter = GLOBAL_ICONS[effect.icon];
  if (parameter !== undefined) {
    const steps = scaleStepsOf(effect, parameter);
    return steps > 0 ? {kind: 'global', parameter, steps} : undefined;
  }
  if (STANDARD_ICONS.has(effect.icon)) {
    const resource = effect.icon as Resource;
    return effect.note === 'production' ?
      {kind: 'production', resource, amount: effect.amount} :
      {kind: 'stock', resource, amount: effect.amount};
  }
  const cardResource = cardResourceForIcon(effect.icon);
  if (cardResource === undefined) {
    return undefined;
  }
  return {kind: 'cardResource', resource: cardResource, amount: effect.amount, target: effect.note === 'on this card' ? 'self' : 'any'};
}

/**
 * TURMOIL REDUX — the PARTY EFFECTS the acting seat holds react to its own
 * operation exactly like a card in its tableau would: the Greens to the TR it
 * gains and to its plant / heat production steps, Mars First to the tiles it
 * places on Mars. Read from the SAME predicates the live hooks read
 * (`Parliament.hasPartyEffect`, `PARTY_EFFECTS`); the source is the party
 * (cardless — the client never resolves it to a card). A SCALE STEP IS A TR
 * STEP for the raiser (temperature, oxygen, Venus — and an ocean tile), so the
 * Greens' TR count is the explicit `tr` grants PLUS every `global` grant's
 * steps (the steps the ceiling leaves — `scaleStepsOf`): an asteroid's degree,
 * a standard aquifer's tile, a card's Venus step all name their 2 M€ before
 * the press. A chip that merely RESTATES a scale's own TR beside the scale
 * (`ActionEffect.implied`) is no grant, so nothing is counted twice; the
 * greenery revision's own TR arrives as an explicit chip beside the oxygen
 * and is honestly a second step.
 */
function partyFacts(player: IPlayer, grants: ReadonlyArray<EffectForecastGrant>, tiles: ReadonlyArray<EffectForecastTile>, effects: ReadonlyArray<ActionEffect> = []): Array<EffectForecastFact> {
  const parliament = player.game.parliament;
  if (parliament === undefined || !parliament.participates(player, 'party-effects')) {
    return [];
  }
  // THE RATING VETO (RX42): a seat first by rating gains NO rating from this operation — the Greens have nothing to
  // pay for; a seat below the top gains until it is first, and the exit pass struck the rest (`vetoed` on the chips).
  const vetoedRating = ratingVetoed(player) ? Number.POSITIVE_INFINITY : vetoedStepsOf(effects);
  const facts: Array<EffectForecastFact> = [];
  const partySource = (party: PartyName, channel: EffectForecastSource['channel']): EffectForecastSource =>
    ({kind: 'party', name: party, owner: player.color, channel});
  if (parliament.hasPartyEffect(player, PartyName.GREENS)) {
    const tr = Math.max(0, grants.reduce((sum, g) => sum + (g.kind === 'tr' ? g.amount : g.kind === 'global' ? g.steps : 0), 0) - vetoedRating);
    if (tr > 0) {
      facts.push(forecast.exact(partySource(PartyName.GREENS, 'tr-increase'),
        [stockGain(player, Resource.MEGACREDITS, GREENS_MEGACREDITS_PER_TR * tr)],
        'The Greens pay 2 M€ per TR step you gain', {id: 'greens-tr'}));
    }
    const steps = grants.reduce((sum, g) => sum + (g.kind === 'production' && (g.resource === Resource.PLANTS || g.resource === Resource.HEAT) ? g.amount : 0), 0);
    if (steps > 0) {
      facts.push(forecast.exact(partySource(PartyName.GREENS, 'production-gain'),
        [productionChange(player, Resource.MEGACREDITS, steps)],
        'The Greens raise your M€ production with your plant or heat production', {id: 'greens-production'}));
    }
  }
  if (parliament.hasPartyEffect(player, PartyName.MARS)) {
    const marsTiles = tiles.filter((tile) => !tile.offMars);
    const count = marsTiles.reduce((sum, tile) => sum + tile.count, 0);
    if (count > 0) {
      facts.push(forecast.deferred(partySource(PartyName.MARS, 'tile-placed'),
        [stockGain(player, Resource.STEEL, count)],
        'Mars First pays 1 steel per tile you place on Mars', {id: 'mars-steel'}));
      const cities = marsTiles.filter((tile) => tile.countsAsCity).reduce((sum, tile) => sum + tile.count, 0);
      if (cities > 0) {
        facts.push(forecast.deferred(partySource(PartyName.MARS, 'tile-placed'),
          [drawGain(cities)],
          'Mars First draws a card for a city you place on Mars', {id: 'mars-card'}));
      }
    }
  }
  return facts;
}

/**
 * TURMOIL REDUX — the ENACTED RESOLUTION's passive effect answers the acting
 * seat's operation through its own forecast twin (`ResolutionPassive.forecast`),
 * fed the same grants and tiles the party facts read; the source is the
 * resolution (cardless — the client resolves it through the parliament
 * manifest). Nothing while no resolution with a passive stands enacted.
 */
function resolutionFacts(player: IPlayer, grants: ReadonlyArray<EffectForecastGrant>, tiles: ReadonlyArray<EffectForecastTile>, effects: ReadonlyArray<ActionEffect> = []): Array<EffectForecastFact> {
  const parliament = player.game.parliament;
  const enacted = parliament?.enactedDefinition();
  const passive = enacted?.passive;
  if (parliament === undefined || enacted === undefined || passive === undefined || !parliament.participates(player, 'enactment')) {
    return [];
  }
  const id = enacted.id;
  // What the exit pass of a REPLACING law already struck on the operation's own chips (RX35) — the law reads its sum.
  const diverted = {data: divertedDataOf(effects), holder: !effects.some((e) => e.diverted?.lost === true)};
  // …and what the rating veto's exit pass struck (RX42) — the law reads its own refusal's sum.
  const vetoed = {steps: vetoedStepsOf(effects)};
  return passive.forecast({
    player,
    grants,
    tiles,
    diverted,
    vetoed,
    source: (channel) => ({kind: 'resolution', name: id, owner: player.color, channel}),
    exact: (source, effects, title, opts) => forecast.exact(source, effects, title, opts),
    deferred: (source, effects, title, opts) => forecast.deferred(source, effects, title, opts),
    skipped: (source, effects, title, opts) => forecast.skipped(source, effects, title, opts),
    stockGain: (resource, amount) => stockGain(player, resource, amount),
    productionChange: (resource, delta) => productionChange(player, resource, delta),
    drawGain: (count) => drawGain(count),
    cardResourceGain: (resource, amount) => cardResourceGain(resource, amount),
  });
}

/** The second-order reactors of ONE seat (+ the acting seat's own played card, «including this»). */
function grantReactorsOf(owner: IPlayer, active: IPlayer, card: ICard | undefined): Array<ICard> {
  return reactorsOf(owner, active, card).filter((c) => c.onProductionGain !== undefined || c.onResourceAdded !== undefined);
}

function reactsToGrant(card: ICard, grant: EffectForecastGrant): boolean {
  if (grant.kind === 'production') {
    return card.onProductionGain !== undefined;
  }
  if (grant.kind === 'cardResource') {
    return card.onResourceAdded !== undefined;
  }
  return false;
}

/**
 * The second-order facts for a list of GRANTS landing on `recipient`. A
 * reactor with the live hook but no forecast is reported as `unknown` once
 * per card (never per grant). The certainty / timing of a cascaded fact is
 * inherited from what caused it (a deferred tile gain cascades deferred).
 */
function grantFacts(
  recipient: IPlayer,
  active: IPlayer,
  card: ICard | undefined,
  grants: ReadonlyArray<EffectForecastGrant>,
  ctx: EffectForecastContext,
  inherit?: {certainty: EffectForecastCertainty, timing: EffectForecastFact['timing'], sequence?: number},
): Array<EffectForecastFact> {
  const facts: Array<EffectForecastFact> = [];
  const unknownNamed = new Set<CardName>();
  for (const reactor of grantReactorsOf(recipient, active, card)) {
    for (const grant of grants) {
      if (!reactsToGrant(reactor, grant)) {
        continue;
      }
      const channel = grant.kind === 'production' ? 'production-gain' : 'resource-added';
      if (reactor.grantForecast === undefined) {
        if (!unknownNamed.has(reactor.name)) {
          unknownNamed.add(reactor.name);
          facts.push(unknownFor(reactor, recipient, active, channel, 'This card reacts to the gain, but its result is not described'));
        }
        continue;
      }
      for (const fact of reactor.grantForecast(recipient, active, grant, ctx)) {
        facts.push(addressed(fact, active, recipient, inherit));
      }
    }
  }
  facts.push(...scaleRaiseFacts(recipient, active, card, grants, ctx, inherit));
  return facts;
}

type GrantInheritance = {certainty: EffectForecastCertainty, timing: EffectForecastFact['timing'], sequence?: number};

/** A second-order fact addressed to its reactor's OWNER, inheriting a cascade's certainty / timing / sequence. */
function addressed(fact: EffectForecastFact, active: IPlayer, owner: IPlayer, inherit: GrantInheritance | undefined): EffectForecastFact {
  const recipient = forecast.recipientOf(active, owner);
  return inherit === undefined ?
    {...fact, recipient} :
    {...fact, recipient, certainty: fact.certainty === 'exact' ? inherit.certainty : fact.certainty, timing: inherit.timing, sequence: inherit.sequence ?? fact.sequence};
}

/**
 * THE SCALE PASS — a `global` grant (the operation raises a scale by N STEPS)
 * offered to the reactors the live engine calls for it, in the engine's order
 * (`Game.increaseVenusScaleLevel` / `increaseTemperature` /
 * `increaseOxygenLevel`): the RAISER's own played cards first
 * (`onGlobalParameterIncrease` — inside the reward gate, an own raise only:
 * Homeostasis Bureau), then EVERY seat's tableau in generation order
 * (`onGlobalParameterRaised` — `Game.globalParameterRaised`, whoever raised:
 * Aphrodite, Venusian Census), each fact addressed to its reactor's owner.
 * Through the same `grantForecast` twins as the other grants — never a table of
 * «who reacts to Venus». A reactor with the live hook and no twin is an honest
 * `unknown`, once per card. The oceans are no scale step (no dispatch).
 */
function scaleRaiseFacts(
  raiser: IPlayer,
  active: IPlayer,
  card: ICard | undefined,
  grants: ReadonlyArray<EffectForecastGrant>,
  ctx: EffectForecastContext,
  inherit: GrantInheritance | undefined,
): Array<EffectForecastFact> {
  const raises = grants.filter((g) => g.kind === 'global' && g.parameter !== GlobalParameter.OCEANS);
  if (raises.length === 0) {
    return [];
  }
  const facts: Array<EffectForecastFact> = [];
  const unknownNamed = new Set<string>();
  const ask = (reactor: ICard, owner: IPlayer): void => {
    if (reactor.grantForecast === undefined) {
      const key = `${owner.color}|${reactor.name}`;
      if (!unknownNamed.has(key)) {
        unknownNamed.add(key);
        facts.push(unknownFor(reactor, owner, active, 'global-parameter', 'This card reacts to the gain, but its result is not described'));
      }
      return;
    }
    for (const grant of raises) {
      for (const fact of reactor.grantForecast(owner, active, grant, ctx)) {
        facts.push(addressed(fact, active, owner, inherit));
      }
    }
  };
  // A WORLD move has no raiser (PL-052): the «when YOU raise» reactors are nobody's.
  if (ctx.world !== true) {
    for (const reactor of reactorsOf(raiser, active, card)) {
      if (reactor.onGlobalParameterIncrease !== undefined) {
        ask(reactor, raiser);
      }
    }
  }
  for (const owner of raiser.game.playersInGenerationOrder) {
    for (const reactor of reactorsOf(owner, active, card)) {
      if (reactor.onGlobalParameterRaised !== undefined) {
        ask(reactor, owner);
      }
    }
  }
  return facts;
}

/**
 * THE SECOND-ORDER PASS FOR A CELL — what the table answers to a grant a card
 * makes BECAUSE OF THE CELL under the cursor (Arboretum's «+N data for N
 * adjacent cities»: Martian Fiber pays N M€). The placement dossier's card
 * hook hands its own chip here and gets back the very facts the composer's
 * forecast would state for the same grant — the same reactors, the same
 * `grantForecast` twins, never a table of «who reacts to data». Read-only.
 */
export function grantReactionFacts(player: IPlayer, card: ICard, effects: ReadonlyArray<ActionEffect>): Array<EffectForecastFact> {
  return grantFacts(player, player, card, grantsOf(effects), {operation: 'play', card, tiles: []});
}

/**
 * A grant whose AMOUNT THE CELL DECIDES — a target step carrying `amountBasis`
 * and no amount (Arboretum: «1 data for each adjacent city»). The reactors to
 * «a resource was added» WILL fire, but how much they pay does not exist
 * before the cell: they are asked through the same `grantForecast` twins with
 * ONE unit, and each answer is stated in the Forestry form — DEFERRED, after
 * the placement, with no chip (a number would be a guess). The reacting card
 * and its reason stay; the cell's dossier then states the number per cell.
 */
function basisGrantFacts(player: IPlayer, card: ICard, steps: ReadonlyArray<ActionPreviewStep>, ctx: EffectForecastContext): Array<EffectForecastFact> {
  const out: Array<EffectForecastFact> = [];
  for (const step of steps) {
    if (step.kind !== 'input' || step.input.type !== 'card') {
      continue;
    }
    const meta = (step.input as SelectCardModel).resourceGainPrompt;
    const resource = meta?.cardResource !== undefined ? cardResourceForIcon(meta.cardResource) : undefined;
    if (meta?.amountBasis === undefined || meta.amount !== undefined || resource === undefined) {
      continue;
    }
    for (const fact of grantFacts(player, player, card, [{kind: 'cardResource', resource, amount: 1, target: 'any'}], ctx)) {
      out.push(fact.certainty === 'unknown' ? fact :
        {...fact, certainty: 'deferred', timing: 'after-placement', effects: [], note: 'For every unit — how many depends on the cell'});
    }
  }
  return out;
}

function grantsOf(effects: ReadonlyArray<ActionEffect>): Array<EffectForecastGrant> {
  const out: Array<EffectForecastGrant> = [];
  for (const effect of effects) {
    const grant = grantOfEffect(effect);
    if (grant !== undefined) {
      out.push(grant);
    }
  }
  return out;
}

/** The three scales whose raise can cross a printed bonus step (the oceans count tiles — a tile's own bonus is the cell dossier's). */
type BonusScale = 'venus' | 'oxygen' | 'temperature';

const BONUS_SCALE_OF: Partial<Record<GlobalParameter, BonusScale>> = {
  [GlobalParameter.VENUS]: 'venus',
  [GlobalParameter.OXYGEN]: 'oxygen',
  [GlobalParameter.TEMPERATURE]: 'temperature',
};

/**
 * THE BONUS STEPS A RAISE CROSSES (PL-147) — the engine's own thresholds
 * (`Game.claimCrossedScaleBonuses` and the `constants` it reads): Venus 8 %
 * draws a card and 16 % pays a rating step; oxygen 8 % raises the temperature
 * a step; temperature −24 °C and −20 °C each raise the heat production, 0 °C
 * places an ocean. The composer printed none of them — «Venus 6 % → 8 %» stood
 * with no word of the card the press draws — so each crossing is a fact of its
 * own under a RULE source (the «Сработает» row's «+1 [карта]» beside the
 * Greens' M€; the layer names the track), and what a crossing GRANTS joins the
 * grants the reactors and the party effects read: the 16 % rating is a TR
 * step the Greens pay for, the 8 % temperature step is a scale step like any
 * other (its own thresholds included — the pass walks the step it grants), a
 * heat production step is a production gain. One operation can move one
 * scale twice (a card's own step, then the oxygen bonus's), so a CURSOR per
 * scale carries the level forward instead of re-reading the board. A step
 * the ceiling cuts crosses nothing. The alternate Venus track pays resources
 * of the player's choice past 16 % — an honest unknown. The 0 °C ocean with
 * no ocean left is a named skip, never silence. Read-only.
 */
function scaleBonusPass(player: IPlayer, grants: ReadonlyArray<EffectForecastGrant>): {facts: Array<EffectForecastFact>, grants: Array<EffectForecastGrant>} {
  const game = player.game;
  const facts: Array<EffectForecastFact> = [];
  const extra: Array<EffectForecastGrant> = [];
  const cursor: Record<BonusScale, number> = {venus: game.getVenusScaleLevel(), oxygen: game.getOxygenLevel(), temperature: game.getTemperature()};
  const crosses = (from: number, to: number, threshold: number): boolean => from < threshold && to >= threshold;
  const visit = (scale: BonusScale, steps: number): void => {
    if (steps <= 0) {
      return;
    }
    const from = cursor[scale];
    if (scale === 'venus') {
      const to = Math.min(MAX_VENUS_SCALE, from + steps * globalParameterStepSize('venus'));
      cursor.venus = to;
      const source = ruleSource('Venus track bonus', player);
      if (crosses(from, to, VENUS_LEVEL_FOR_CARD_BONUS) && !player.isMarsBot) {
        facts.push(forecast.exact(source, [drawGain(1)], 'Crossing 8 % Venus draws a card', {id: 'venus-card-bonus'}));
      }
      if (crosses(from, to, VENUS_LEVEL_FOR_TR_BONUS)) {
        // …refused for a seat first by rating under the veto (RX42) — a named skip, no grant.
        if (ratingVetoed(player)) {
          facts.push(forecast.skipped(source, [trGain(player, 1)], 'Crossing 16 % Venus raises your TR a step', {id: 'venus-tr-bonus', note: 'Your terraform rating is the highest — the enacted resolution ignores the gain'}));
        } else {
          facts.push(forecast.exact(source, [trGain(player, 1)], 'Crossing 16 % Venus raises your TR a step', {id: 'venus-tr-bonus'}));
          extra.push({kind: 'tr', amount: 1});
        }
      }
      if (game.gameOptions.altVenusBoard && (Math.min(to, MAX_VENUS_SCALE) - Math.max(from, ALT_VENUS_MINIMUM_BONUS) > 0 || to >= MAX_VENUS_SCALE)) {
        facts.push(forecast.unknown(source, 'The alternate Venus track pays a bonus of your choice past 16 %'));
      }
      return;
    }
    if (scale === 'oxygen') {
      const to = Math.min(MAX_OXYGEN_LEVEL, from + steps * globalParameterStepSize('oxygen'));
      cursor.oxygen = to;
      if (crosses(from, to, OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS)) {
        const source = ruleSource('Oxygen track bonus', player);
        const reason = 'Crossing 8 % oxygen raises the temperature a step';
        // The chip reads the temperature where the operation has already left it (a card raising both scales).
        const chip: ActionEffect = {...globalGain(player, 'temperature', 1), current: cursor.temperature, resulting: Math.min(MAX_TEMPERATURE, cursor.temperature + globalParameterStepSize('temperature'))};
        const grant = grantOfEffect(chip);
        if (grant === undefined) {
          facts.push(forecast.skipped(source, [chip], reason, {id: 'oxygen-temperature-bonus', note: 'The temperature is at its maximum'}));
          return;
        }
        facts.push(forecast.exact(source, [chip], reason, {id: 'oxygen-temperature-bonus'}));
        extra.push(grant);
        visit('temperature', grant.kind === 'global' ? grant.steps : 0);
      }
      return;
    }
    const to = Math.min(MAX_TEMPERATURE, from + steps * globalParameterStepSize('temperature'));
    cursor.temperature = to;
    const source = ruleSource('Temperature track bonus', player);
    const heatSteps: ReadonlyArray<{threshold: number, reason: string, id: string}> = [
      {threshold: TEMPERATURE_BONUS_FOR_HEAT_1, reason: 'Crossing −24 °C raises your heat production a step', id: 'temperature-heat-bonus-1'},
      {threshold: TEMPERATURE_BONUS_FOR_HEAT_2, reason: 'Crossing −20 °C raises your heat production a step', id: 'temperature-heat-bonus-2'},
    ];
    for (const step of heatSteps) {
      if (crosses(from, to, step.threshold)) {
        facts.push(forecast.exact(source, [productionChange(player, Resource.HEAT, 1)], step.reason, {id: step.id}));
        extra.push({kind: 'production', resource: Resource.HEAT, amount: 1});
      }
    }
    if (crosses(from, to, TEMPERATURE_FOR_OCEAN_BONUS)) {
      const reason = 'Crossing 0 °C places an ocean tile';
      if (game.canAddOcean()) {
        facts.push(forecast.exact(source, [oceanGain(player, 1)], reason, {id: 'temperature-ocean-bonus', timing: 'after-card', note: 'Asked once the step is made'}));
        extra.push({kind: 'global', parameter: GlobalParameter.OCEANS, steps: 1});
      } else {
        facts.push(forecast.skipped(source, [oceanGain(player, 1)], reason, {id: 'temperature-ocean-bonus', note: 'No ocean is left to place'}));
      }
    }
  };
  for (const grant of grants) {
    if (grant.kind !== 'global') {
      continue;
    }
    const scale = BONUS_SCALE_OF[grant.parameter];
    if (scale !== undefined) {
      visit(scale, grant.steps);
    }
  }
  return {facts, grants: [...grants, ...extra]};
}

/** The seat a fact's recipient stands for. */
function playerOfRecipient(game: IGame, active: IPlayer, recipient: EffectForecastRecipient): IPlayer | undefined {
  if (recipient.kind === 'you') {
    return active;
  }
  return game.players.find((p) => p.color === recipient.color);
}

/** The cascade: every exact / deferred first-order fact's chips, offered to ITS recipient's second-order hooks. */
function cascadeFacts(active: IPlayer, card: ICard | undefined, first: ReadonlyArray<EffectForecastFact>, ctx: EffectForecastContext): Array<EffectForecastFact> {
  const out: Array<EffectForecastFact> = [];
  for (const fact of first) {
    if ((fact.certainty !== 'exact' && fact.certainty !== 'deferred') || fact.effects.length === 0) {
      continue;
    }
    const recipient = playerOfRecipient(active.game, active, fact.recipient);
    if (recipient === undefined || recipient.isMarsBot) {
      continue;
    }
    const grants = grantsOf(fact.effects);
    if (grants.length === 0) {
      continue;
    }
    out.push(...grantFacts(recipient, active, card, grants, ctx, {certainty: fact.certainty, timing: fact.timing, sequence: fact.sequence}));
  }
  return out;
}

// ── the tile pass ───────────────────────────────────────────────────────────

function tileOf(tileType: TileType | undefined, count: number, placementType: string | undefined, offMars: boolean, space?: SpaceId): EffectForecastTile {
  const tile: EffectForecastTile = {
    tileType,
    count,
    countsAsCity: tileType !== undefined && CITY_TILES.has(tileType),
    countsAsOcean: tileType !== undefined && OCEAN_TILES.has(tileType),
    countsAsGreenery: tileType !== undefined && GREENERY_TILES.has(tileType),
    placementType,
    offMars,
  };
  if (space !== undefined) {
    tile.space = space;
  }
  return tile;
}

/**
 * The tiles a branch WILL place — THREE sources:
 *  · its board placement steps that carry a tile identity (a marker prompt —
 *    Land Claim, Mars Nomads — places nothing and fires no trigger);
 *  · the card's RESERVED off-Mars city (placed with no prompt, so it has no
 *    step — Ganymede Colony, Phobos Space Haven);
 *  · a COLONY PICK whose prompt carries `tileSite` — the pick places a tile
 *    ON the chosen colony tile (Turmoil Redux TR22 Nova City): one city, off
 *    Mars, on the hosted cell the marker names. Whichever colony tile is
 *    chosen, the tile and its cell are the same, so it is known before the pick.
 */
export function tilesOfBranch(player: IPlayer, branch: ActionPreviewBranch, behavior: Behavior | undefined): Array<EffectForecastTile> {
  const tiles: Array<EffectForecastTile> = [];
  // A PLAIN ocean only lands while the oceans are not maxed (`canAddOcean` —
  // the live `PlaceOceanTile` silently skips otherwise), and a two-ocean card
  // with one ocean left places ONE. The declarative walker already clamps its
  // step; this is the engine's own floor for a bespoke preview that does not.
  let oceansLeft = Math.max(0, MAX_OCEAN_TILES - player.game.board.getOceanSpaces().length);
  for (const step of branch.steps) {
    if (step.kind !== 'boardPlacement' || step.placementType === 'colony' || step.tileType === undefined) {
      continue;
    }
    let count = step.count ?? 1;
    if (BASE_OCEAN_TILES.has(step.tileType)) {
      count = Math.min(count, oceansLeft);
      if (count <= 0) {
        continue;
      }
      oceansLeft -= count;
    }
    tiles.push(tileOf(step.tileType, count, step.placementType, false));
  }
  const fixed = behavior?.city?.space;
  if (fixed !== undefined) {
    const space = player.game.board.spaces.find((s) => s.id === fixed);
    tiles.push(tileOf(TileType.CITY, 1, 'city', space?.spaceType === SpaceType.COLONY, fixed));
  }
  for (const step of branch.steps) {
    const site = step.kind === 'colonyPick' ? step.staged.prompt.tileSite : undefined;
    if (site !== undefined) {
      tiles.push(tileOf(site.tile, 1, 'city', true, site.space));
    }
  }
  return tiles;
}

/** A tile's identity for the shared / own split — type, count, prompt kind, off-Mars. */
function tileKey(tile: EffectForecastTile): string {
  return `${tile.tileType ?? ''}|${tile.count}|${tile.placementType ?? ''}|${tile.offMars}`;
}

function tileCounts(tiles: ReadonlyArray<EffectForecastTile>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    const key = tileKey(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * The tiles EVERY available branch places — the card puts them down whatever
 * the player picks, so their reactions are BRANCH-INDEPENDENT. A multiset
 * intersection over the available branches (an unavailable branch carries no
 * steps at all, so it cannot vote): Imported Hydrogen's ocean stands in the
 * plants branch AND in the two «to another card» branches, and used to land
 * INSIDE whichever option happened to be available — the opponent's Neptunian
 * Power Consultants question drawn as if it depended on choosing the plants.
 */
export function sharedTilesOf(perBranch: ReadonlyArray<ReadonlyArray<EffectForecastTile>>, available: ReadonlyArray<boolean>): Array<EffectForecastTile> {
  const lists = perBranch.filter((_, i) => available[i] === true);
  if (lists.length === 0) {
    return [];
  }
  const [first, ...rest] = lists;
  const others = rest.map(tileCounts);
  const taken = new Map<string, number>();
  const shared: Array<EffectForecastTile> = [];
  for (const tile of first) {
    const key = tileKey(tile);
    const nth = (taken.get(key) ?? 0) + 1;
    if (others.every((counts) => (counts.get(key) ?? 0) >= nth)) {
      shared.push(tile);
      taken.set(key, nth);
    }
  }
  return shared;
}

/** A branch's OWN tiles — its list minus the shared ones (multiset subtraction). */
export function ownTilesOf(tiles: ReadonlyArray<EffectForecastTile>, shared: ReadonlyArray<EffectForecastTile>): Array<EffectForecastTile> {
  const remaining = tileCounts(shared);
  const own: Array<EffectForecastTile> = [];
  for (const tile of tiles) {
    const key = tileKey(tile);
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      continue;
    }
    own.push(tile);
  }
  return own;
}

function tileFacts(player: IPlayer, card: ICard, tiles: ReadonlyArray<EffectForecastTile>, ctx: EffectForecastContext): Array<EffectForecastFact> {
  const facts: Array<EffectForecastFact> = [];
  if (tiles.length === 0) {
    return facts;
  }
  const game = player.game;
  for (const tile of tiles) {
    for (const owner of game.playersInGenerationOrder) {
      for (const effectCard of reactorsOf(owner, player, card)) {
        if (effectCard.onTilePlaced === undefined) {
          continue;
        }
        const own = effectCard.tilePlacedForecast?.(owner, player, tile, ctx);
        facts.push(...(own ?? [unknownFor(effectCard, owner, player, 'tile-placed', 'This card reacts to the tile placement, but its result is not described', 'after-placement')]));
      }
    }
  }
  const corp = AutomaCorporations.reactsToTilePlacement(game);
  if (corp !== undefined) {
    const marsBot = marsBotOf(game);
    facts.push(forecast.unknown(
      {kind: 'automa-corporation', name: corp.info.original, owner: marsBot.color, channel: 'automa-corporation'},
      'MarsBot\'s corporation reacts to the tile placement, but its result is not described',
      {recipient: {kind: 'bot', color: marsBot.color}, timing: 'after-placement'}));
  }
  return facts;
}

// ── the colony pass ─────────────────────────────────────────────────────────

/**
 * How many COLONIES a branch builds — TWO sources, both structural:
 *  · a `boardPlacement` step of `placementType: 'colony'` — the declarative
 *    `colonies.buildColony` (the colony is picked after the commit);
 *  · a COLONY PICK whose prompt carries `buildSites` — a card that builds by
 *    being played and enters the staged colony door (Turmoil Redux TR25
 *    Exclusive Colony; `BuildColony.previewSelectColony`).
 * A pick that moves a track, places a city or changes the roster builds none
 * here (the roster's own «place a colony on it, if possible» is decided by
 * the tile chosen — never promised before it).
 */
export function colonyBuildsOfBranch(branch: ActionPreviewBranch): number {
  let count = 0;
  for (const step of branch.steps) {
    if (step.kind === 'boardPlacement' && step.placementType === 'colony') {
      count += step.count ?? 1;
    } else if (step.kind === 'colonyPick' && step.staged.prompt.buildSites !== undefined) {
      count += 1;
    }
  }
  return count;
}

/**
 * THE COLONY PASS — «a colony was built» offered to the reactors the live
 * engine calls for it (`Colony.addColony`'s loop: EVERY seat's tableau, the
 * table's order — `onColonyAddedByAnyPlayer`: Poseidon, Colony Trade Hub),
 * each fact addressed to its reactor's owner, then the MarsBot corporation
 * that reads the same sentence (C33 Poseidon). Through the same `grantForecast`
 * twins as every other grant — never a table of «who reacts to a colony». A
 * reactor with the live hook and no twin is an honest `unknown`.
 */
function colonyBuiltFacts(player: IPlayer, card: ICard | undefined, count: number, ctx: EffectForecastContext): Array<EffectForecastFact> {
  if (count <= 0) {
    return [];
  }
  const game = player.game;
  const grant: EffectForecastGrant = {kind: 'colony', count};
  const facts: Array<EffectForecastFact> = [];
  for (const owner of game.players) {
    for (const reactor of reactorsOf(owner, player, card)) {
      if (reactor.onColonyAddedByAnyPlayer === undefined) {
        continue;
      }
      if (reactor.grantForecast === undefined) {
        facts.push(unknownFor(reactor, owner, player, 'colony-added', 'This card reacts to the colony, but its result is not described'));
        continue;
      }
      for (const fact of reactor.grantForecast(owner, player, grant, ctx)) {
        facts.push(addressed(fact, player, owner, undefined));
      }
    }
  }
  const corp = AutomaCorporations.reactsToColonyBuilt(game);
  if (corp !== undefined) {
    const marsBot = marsBotOf(game);
    facts.push(forecast.unknown(
      {kind: 'automa-corporation', name: corp.info.original, owner: marsBot.color, channel: 'automa-corporation'},
      'MarsBot\'s corporation reacts to the colony, but its result is not described',
      {recipient: {kind: 'bot', color: marsBot.color}}));
  }
  return facts;
}

// ── discounts + payment values ──────────────────────────────────────────────

function discountsOf(player: IPlayer, card: ICard, operation: 'play' | 'action'): EffectForecastDiscounts {
  if (operation !== 'play' || !isIProjectCard(card)) {
    const base = card.cost ?? 0;
    return {base, final: base, items: [], other: 0};
  }
  const breakdown = player.getCardCostBreakdown(card);
  const itemized = breakdown.discounts.reduce((sum, d) => sum + d.amount, 0);
  // The ONE-PLAY discounts this play spends (TR49 class) — named as such in the payment group.
  const armedDiscounts = new Set(armedPlayEffectsOf(player).filter((a) => a.effect.kind === 'discount').map((a) => a.source));
  return {
    base: breakdown.base,
    final: breakdown.final,
    items: breakdown.discounts.map((d) => {
      const oneShot = (d.source.kind === 'card' || d.source.kind === 'corporation') && armedDiscounts.has(d.source.card);
      return oneShot ? {source: d.source, amount: d.amount, oneShot: true} : {source: d.source, amount: d.amount};
    }),
    other: Math.max(0, breakdown.base - breakdown.final - itemized),
  };
}

function paymentValuesOf(player: IPlayer, card: ICard, operation: 'play' | 'action'): Array<EffectForecastPaymentValue> {
  if (operation !== 'play' || !isIProjectCard(card)) {
    return [];
  }
  const options = player.paymentOptionsForCard(card);
  const out: Array<EffectForecastPaymentValue> = [];
  for (const unit of SPENDABLE_CARD_RESOURCES) {
    if (options[unit as keyof typeof options] !== true) {
      continue;
    }
    const sourceName = CARD_FOR_SPENDABLE_RESOURCE[unit as SpendableCardResource];
    const source = player.playedCards.get(sourceName);
    if (source === undefined || source.resourceType === undefined) {
      continue;
    }
    out.push({
      source: {kind: source.type === CardType.CORPORATION ? 'corporation' : 'card', card: sourceName, owner: player.color},
      resource: source.resourceType,
      value: unit === 'floodgateSteel' ? player.getSteelValue() : DEFAULT_PAYMENT_VALUES[unit as SpendableCardResource],
      count: player.getSpendable(unit as SpendableCardResource),
    });
  }
  return out;
}

// ── assembly ────────────────────────────────────────────────────────────────

/**
 * A fact TIED to one branch: its condition becomes «depends» on that option.
 * An `exact` / `asks` / `deferred` fact reads `conditional` (it fires if the
 * option is picked); a degree that already says the effect will NOT run stays
 * what it is — an `unknown` stays uncomputed, a `skipped` stays skipped, a
 * `no` stays no. Relabelling a skipped reaction «conditional» once promised
 * Neptunian's 5 M€ question inside an option whose owner could not pay.
 */
export function asBranchFact(fact: EffectForecastFact, pos: number): EffectForecastFact {
  const keep = fact.certainty === 'unknown' || fact.certainty === 'skipped' || fact.certainty === 'no';
  return {
    ...fact,
    certainty: keep ? fact.certainty : 'conditional',
    condition: {
      text: fact.condition?.text ?? fact.reason, state: 'depends', branchPos: pos,
      // What the fact is once the option IS chosen — a composer whose option is fixed restores it.
      chosen: fact.condition === undefined ? {certainty: fact.certainty} : {certainty: fact.certainty, condition: fact.condition},
    },
  };
}

/**
 * THE HOST of a reaction chip — the explicit target marker (`ActionEffect.host`),
 * stamped from the builders' own vocabulary so no hook has to type it:
 * «on this card» is the reacting SOURCE's own pool (every `cardGain(this, …)`
 * in a hook), «on the played card» is the card being played (Splice's / Viral
 * Enhancers' microbe on the new card). Anything else (`to a card` — a target
 * chosen in a later step) stays host-less. Only a card-resource icon has a
 * host; a player's stock / production pool never does.
 */
function stampHosts(fact: EffectForecastFact, played: ICard | undefined): EffectForecastFact {
  if (fact.source.kind === 'rule') {
    return fact;
  }
  const stamp = (e: ActionEffect): ActionEffect => {
    if (e.host !== undefined || cardResourceForIcon(e.icon) === undefined) {
      return e;
    }
    if (e.note === 'on this card') {
      return {...e, host: fact.source.name};
    }
    if (e.note === 'on the played card' && played !== undefined) {
      return {...e, host: played.name};
    }
    return e;
  };
  return {
    ...fact,
    effects: fact.effects.map(stamp),
    alternatives: fact.alternatives?.map((a) => ({...a, effects: a.effects.map(stamp)})),
  };
}

/**
 * The POOL a chip moves, as the arrow rule needs it:
 *  · a player's resource — `icon|player` (stock AND production collapse into
 *    ONE pool for the arrow test: two arrows about one resource, one from the
 *    card's own production step and one from a reaction's stock gain, read as
 *    a contradiction on one screen — Manutech's energy beside the card's
 *    energy production);
 *  · a card resource — `icon|card:<host>`, or `icon|card:*` when the host is
 *    not known yet (a target chosen in a step): an own chip with no host
 *    touches EVERY pool of that icon, a reaction with no host is touched by
 *    any own chip of that icon.
 */
export function chipPool(effect: ActionEffect, playedHost?: string): string {
  if (cardResourceForIcon(effect.icon) === undefined) {
    return `${effect.icon}|player`;
  }
  const host = effect.host ?? (effect.note === 'on this card' ? playedHost : undefined);
  return `${effect.icon}|card:${host ?? '*'}`;
}

function poolTouched(pool: string, touched: ReadonlySet<string>): boolean {
  if (touched.has(pool)) {
    return true;
  }
  const bar = pool.indexOf('|card:');
  if (bar < 0) {
    return false;
  }
  const icon = pool.slice(0, bar);
  if (pool.endsWith(':*')) {
    for (const t of touched) {
      if (t.startsWith(`${icon}|card:`)) {
        return true;
      }
    }
    return false;
  }
  return touched.has(`${icon}|card:*`);
}

/**
 * `current → resulting` is only honest for a pool the card being played does
 * not touch ITSELF: its own chip already moves that pool, so a reaction's
 * arrow would start from a number the play has already changed. Strip the
 * arrow (keep the delta) wherever the operation's own chips name the same
 * pool — the UI then says «сверх собственного эффекта карты».
 *
 * A pool is `icon + host` for a card resource (`chipPool`): the card's own
 * «on this card» touches the PLAYED card's pool only, so Decomposers' or
 * Carbon Nanosystems' microbe / graphene arrow on their OWN card survives a
 * play that puts the same resource on itself, while Splice's microbe «on the
 * played card» loses its arrow. A foreign recipient's pool is never touched
 * by the actor's own chips.
 */
export function stripTouchedPools(facts: ReadonlyArray<EffectForecastFact>, own: ReadonlyArray<ActionEffect>, played: ICard | undefined): Array<EffectForecastFact> {
  const touched = new Set(own.map((e) => chipPool(e, played?.name)));
  if (touched.size === 0) {
    return [...facts];
  }
  const strip = (effects: ReadonlyArray<ActionEffect>): Array<ActionEffect> => effects.map((e) => {
    if (e.current === undefined || !poolTouched(chipPool(e), touched)) {
      return e;
    }
    const {current: _c, resulting: _r, ...rest} = e;
    return rest;
  });
  return facts.map((fact) => {
    if (fact.recipient.kind !== 'you') {
      return fact;
    }
    return {
      ...fact,
      effects: strip(fact.effects),
      alternatives: fact.alternatives?.map((a) => ({...a, effects: strip(a.effects)})),
    };
  });
}

/**
 * Every branch's tiles, and the BRANCH-INDEPENDENT ones: a single branch's
 * own; with several, the tiles EVERY available branch places.
 */
function branchIndependentTiles(player: IPlayer, branches: ReadonlyArray<ActionPreviewBranch>, behavior: Behavior | undefined): {perBranch: Array<Array<EffectForecastTile>>, shared: Array<EffectForecastTile>} {
  const perBranch = branches.map((b) => tilesOfBranch(player, b, behavior));
  const shared = branches.length <= 1 ?
    (perBranch[0] ?? tilesOfBranch(player, {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}, behavior)) :
    sharedTilesOf(perBranch, branches.map((b) => b.available));
  return {perBranch, shared};
}

function buildForecast(player: IPlayer, card: ICard, preview: ActionPreview, operation: 'play' | 'action'): EffectForecast {
  const behavior = operation === 'play' ? card.behavior : card.actionBehavior;
  const branches = preview.branches;
  const single = branches.length <= 1;
  const baseCtx: EffectForecastContext = {operation, card, tiles: []};

  // The branch-independent tiles: a single branch's own; with several, the
  // tiles EVERY available branch places (a card's own placement rides every
  // option's steps — Imported Hydrogen's ocean, Large Convoy's — so it is the
  // play's, not the option's; a tile only one option places stays that
  // option's).
  const {perBranch: perBranchTiles, shared: sharedTiles} = branchIndependentTiles(player, branches, behavior);
  const ctx: EffectForecastContext = {...baseCtx, tiles: sharedTiles};

  // 1. The card-played fan-out (a play only — an action plays no card).
  const played = operation === 'play' ? cardPlayedFacts(player, card, ctx) : [];

  // 2 + 3. The branch-independent grants and tiles.
  const facts: Array<EffectForecastFact> = [...played];
  const ownEffects: Array<ActionEffect> = [];
  const byBranch: Record<number, Array<EffectForecastFact>> = {};
  // The grants the party effects read — the chips' own PLUS what the bonus steps they cross grant (PL-147).
  let ownGrants: Array<EffectForecastGrant> = [];
  const branchGrants: Record<number, Array<EffectForecastGrant>> = {};
  if (single) {
    // A lone branch the rules refuse (a blocked action's setup) grants and
    // places nothing — its reactions would describe an operation that cannot run.
    const effects = branches[0]?.available === false ? [] : (branches[0]?.effects ?? []);
    ownEffects.push(...effects);
    const bonuses = scaleBonusPass(player, grantsOf(effects));
    ownGrants = bonuses.grants;
    facts.push(...bonuses.facts);
    facts.push(...grantFacts(player, player, card, ownGrants, ctx));
    facts.push(...basisGrantFacts(player, card, branches[0]?.available === false ? [] : (branches[0]?.steps ?? []), ctx));
    facts.push(...tileFacts(player, card, branches[0]?.available === false ? [] : sharedTiles, ctx));
    facts.push(...colonyBuiltFacts(player, card, branches[0] === undefined || branches[0].available === false ? 0 : colonyBuildsOfBranch(branches[0]), ctx));
  } else {
    // The tiles every option places are the PLAY's: their reactions stand in
    // `facts`, never inside an option card.
    facts.push(...tileFacts(player, card, sharedTiles, ctx));
    for (let pos = 0; pos < branches.length; pos++) {
      const branch = branches[pos];
      if (!branch.available) {
        continue;
      }
      ownEffects.push(...branch.effects);
      // The hooks see every tile THIS option would place (shared ones included);
      // only the option's OWN remainder is asked as a branch-tied tile pass.
      const branchCtx: EffectForecastContext = {...baseCtx, tiles: perBranchTiles[pos], branchPos: pos};
      const bonuses = scaleBonusPass(player, grantsOf(branch.effects));
      branchGrants[pos] = bonuses.grants;
      const branchFacts = [
        ...bonuses.facts,
        ...grantFacts(player, player, card, bonuses.grants, branchCtx),
        ...tileFacts(player, card, ownTilesOf(perBranchTiles[pos], sharedTiles), branchCtx),
        // A colony an OPTION builds is that option's (no card builds one in every option today).
        ...colonyBuiltFacts(player, card, colonyBuildsOfBranch(branch), branchCtx),
      ];
      if (branchFacts.length > 0) {
        byBranch[pos] = branchFacts.map((fact) => asBranchFact(fact, pos));
      }
    }
  }
  // The cascade of the first-order facts (Saturn's production → Manutech's
  // steel, Pets' animal → Meat Industry's M€), on each recipient's own table.
  facts.push(...cascadeFacts(player, card, facts, ctx));
  for (const pos of Object.keys(byBranch)) {
    const list = byBranch[Number(pos)];
    list.push(...cascadeFacts(player, card, list, {...baseCtx, branchPos: Number(pos)}).map((fact) => asBranchFact(fact, Number(pos))));
  }
  // Turmoil Redux: the acting seat's PARTY EFFECTS answer its own grants and
  // tiles — the branch-independent ones in `facts`, an option's own inside it.
  facts.push(
    ...partyFacts(player, ownGrants, sharedTiles, single ? ownEffects : []),
    ...resolutionFacts(player, ownGrants, sharedTiles, single ? ownEffects : []));
  if (!single) {
    for (let pos = 0; pos < branches.length; pos++) {
      const branch = branches[pos];
      if (!branch.available) {
        continue;
      }
      const own = [
        ...partyFacts(player, branchGrants[pos] ?? [], ownTilesOf(perBranchTiles[pos], sharedTiles), branch.effects),
        ...resolutionFacts(player, branchGrants[pos] ?? [], ownTilesOf(perBranchTiles[pos], sharedTiles), branch.effects),
      ];
      if (own.length > 0) {
        const list = byBranch[pos] ?? (byBranch[pos] = []);
        list.push(...own.map((fact) => asBranchFact(fact, pos)));
      }
    }
  }

  // The explicit target marker first (`host`), then the arrow rule over it.
  const stripped = stripTouchedPools(facts.map((f) => stampHosts(f, card)), ownEffects, card);
  const strippedByBranch: Record<number, ReadonlyArray<EffectForecastFact>> = {};
  for (const pos of Object.keys(byBranch)) {
    strippedByBranch[Number(pos)] = stripTouchedPools(byBranch[Number(pos)].map((f) => stampHosts(f, card)), ownEffects, card);
  }
  const all = [...stripped, ...Object.values(strippedByBranch).flat()];
  const modifiers = operation === 'play' && isIProjectCard(card) ? armedPlayForecastOf(player, card) : undefined;
  return {
    facts: stripped,
    byBranch: Object.keys(strippedByBranch).length > 0 ? strippedByBranch : undefined,
    discounts: discountsOf(player, card, operation),
    paymentValues: paymentValuesOf(player, card, operation),
    coverage: coverageOf(all),
    ...(modifiers !== undefined ? {modifiers} : {}),
  };
}

/** `partial` when at least one live hook stayed uncomputed — the ONE reading of a fact list, for every builder. */
function coverageOf(facts: ReadonlyArray<EffectForecastFact>): EffectForecast['coverage'] {
  return facts.some((f) => f.certainty === 'unknown') ? 'partial' : 'complete';
}

/**
 * THE TABLE'S WHOLE ANSWER TO A REWARD PAID OUTSIDE A COMPOSER — a fleet dock's
 * reward (`colonies/FleetDock.ts`), a colony's trade income or build bonus
 * (`colonies/colonyTradePreview.ts`), a standard project's own bump
 * (`models/standardProjectPreview.ts`): the stage shows it before the press.
 * The grants of `effects` go through every pass a play's own grants go through
 * in `buildForecast`: the card reactors and their cascade, the seat's PARTY
 * EFFECTS (the ruling Greens' 2 M€ per TR step) and the ENACTED resolution's
 * passive — with no card played and no tile placed (a placement the reward
 * defers is the cell dossier's to forecast, where the cell is known).
 * `card` is the source of the reward, already in the tableau — or `undefined`
 * for a reward no card pays (a colony's): the reactors are then the tableaux
 * alone and no chip has «the played card» to point at. `coloniesBuilt` adds
 * the colony pass (every seat's «when any colony is placed») for a BUILD.
 * Read-only.
 *
 * `grantReactionFacts` stays the CELL's narrower pass (the card reactors only,
 * for a grant a cell decides); this is the operation-level twin for a reward
 * that is no card play and no card action.
 */
export function rewardReactionFacts(
  player: IPlayer,
  card: ICard | undefined,
  effects: ReadonlyArray<ActionEffect>,
  opts: {coloniesBuilt?: number, world?: boolean} = {},
): Array<EffectForecastFact> {
  const world = opts.world === true;
  const ctx: EffectForecastContext = {operation: 'action', ...(card !== undefined ? {card} : {}), tiles: [], ...(world ? {world: true as const} : {})};
  // The bonus steps the raise crosses (PL-147) come first: their grants are what the reactors and the parties read.
  // A WORLD move (PL-052) crosses them for nobody and pays no party: the reactors to anyone's raise, and nothing else.
  const bonuses = world ? {facts: [] as Array<EffectForecastFact>, grants: grantsOf(effects)} : scaleBonusPass(player, grantsOf(effects));
  const grants = bonuses.grants;
  const facts = [...bonuses.facts, ...grantFacts(player, player, card, grants, ctx)];
  facts.push(...cascadeFacts(player, card, facts, ctx));
  if (!world) {
    facts.push(...partyFacts(player, grants, [], effects), ...resolutionFacts(player, grants, [], effects));
  }
  facts.push(...colonyBuiltFacts(player, card, opts.coloniesBuilt ?? 0, ctx));
  return stripTouchedPools(facts.map((fact) => stampHosts(fact, card)), effects, card);
}

/**
 * WHAT THE TABLE ANSWERS TO A RESOLUTION'S WORLD MOVE (PL-052, Gas Export
 * RX12): the enactment terraforms Venus for nobody — no rating, no party, no
 * bonus step — yet a card that pays on ANY player's raise (Aphrodite's 2 M€
 * per Venus step) is paid, and the vote's reading said nothing of it. The
 * forecast engine's own pass over the declared moves, as the viewer sees it
 * (their own card's gain is «yours», a rival's is named), for the slot's
 * inspector. A lowering (the oxygen) moves nothing a reactor answers.
 * `undefined` when nothing reacts, so the wire carries no empty object.
 */
export function worldMoveForecast(viewer: IPlayer, moves: ReadonlyArray<WorldParameterMove>): EffectForecast | undefined {
  const effects: Array<ActionEffect> = [];
  for (const move of moves) {
    if (move.steps <= 0) {
      continue;
    }
    if (move.parameter === 'oceans') {
      effects.push(oceanGain(viewer, move.steps));
    } else if (move.parameter !== 'venus' || viewer.game.gameOptions.venusNextExtension) {
      effects.push(globalGain(viewer, move.parameter, move.steps));
    }
  }
  return effects.length === 0 ? undefined : rewardReactionForecast(viewer, undefined, effects, {world: true});
}

/**
 * The same answer as ONE `EffectForecast` — what the dock's stage hands its
 * R3 «Эффекты» layer (the explorer reads a forecast, never a bare list): the
 * facts above, no discount and no payment value (a trade's fee is the stage's
 * own payment rows, not a card's price), the coverage read as every builder
 * reads it. `undefined` when nothing reacts, so the wire carries no empty
 * object and the client's «absent = nothing reacts» stays one test.
 */
export function rewardReactionForecast(
  player: IPlayer,
  card: ICard | undefined,
  effects: ReadonlyArray<ActionEffect>,
  opts: {coloniesBuilt?: number, world?: boolean} = {},
): EffectForecast | undefined {
  const facts = rewardReactionFacts(player, card, effects, opts);
  return facts.length === 0 ? undefined : {...emptyEffectForecast(), facts, coverage: coverageOf(facts)};
}

/**
 * WHAT THE TABLE ANSWERS TO THE PATENT SALE of `count` cards (the standard
 * project «Sell patents» — `common/models/PatentSaleModel.ts`): the project's
 * own M€ through the reward pass above (a reactor to the gain, the parties,
 * the enacted law); then the SELLER's `onPatentsSold` reactors in the live
 * walk's order (`SellPatentsStandardProject` walks the seller's tableau) each
 * through its co-located `patentsSoldForecast` — a reactor with the live hook
 * and no twin is an honest `unknown`; then what answers THEM (the cascade:
 * TR18 Martian Fiber's M€ for TR46 Research Startups' data, PL-189). `project`
 * is the sale's card — the source no reactor is. Read-only.
 */
export function patentSaleFacts(player: IPlayer, project: ICard, count: number): Array<EffectForecastFact> {
  if (count <= 0) {
    return [];
  }
  const ctx: EffectForecastContext = {operation: 'action', card: project, tiles: []};
  const sold: Array<EffectForecastFact> = [];
  for (const reactor of player.tableau) {
    if (reactor.onPatentsSold === undefined) {
      continue;
    }
    const own = reactor.patentsSoldForecast?.(player, count);
    sold.push(...(own ?? [unknownFor(reactor, player, player, 'standard-project', 'This card reacts to the sale, but its result is not described')]));
  }
  const answers = [...sold, ...cascadeFacts(player, project, sold, ctx)].map((fact) => stampHosts(fact, project));
  return [...rewardReactionFacts(player, project, [stockGain(player, Resource.MEGACREDITS, count)]), ...answers];
}

/** The forecast of PLAYING `card` (a hand card, a prelude, the picked corporation). */
export function effectForecastForPlay(player: IPlayer, card: ICard, preview: ActionPreview): EffectForecast {
  return buildForecast(player, card, preview, 'play');
}

/**
 * THE TILES THE PLAY OF `card` PUTS DOWN whatever the player picks — the very
 * list the forecast's tile pass reacts to (`buildForecast`: a lone branch's
 * own tiles; with several, the tiles every available branch places). Exported
 * for the play's VP projection (`cardVictoryPointsAtPlay`), which must count
 * the cities the play itself adds by THIS reading, never by its own.
 */
export function tilesOfPlay(player: IPlayer, card: ICard, preview: ActionPreview): Array<EffectForecastTile> {
  return branchIndependentTiles(player, preview.branches, card.behavior).shared;
}

/** The forecast of ACTIVATING `card`'s action. */
export function effectForecastForAction(player: IPlayer, card: ICard, preview: ActionPreview): EffectForecast {
  return buildForecast(player, card, preview, 'action');
}

/**
 * The live COMBAT hooks a card carries that the forecast family mirrors —
 * the coverage guard's worklist reads this so the two lists cannot drift:
 * every entry here MUST have its forecast twin, or the guard names the card.
 */
export const FORECAST_HOOK_PAIRS: ReadonlyArray<{live: keyof ICard, forecast: keyof ICard}> = [
  {live: 'onCardPlayed', forecast: 'cardPlayedForecast'},
  {live: 'onCardPlayedByAnyPlayer', forecast: 'cardPlayedForecast'},
  {live: 'onProductionGain', forecast: 'grantForecast'},
  {live: 'onResourceAdded', forecast: 'grantForecast'},
  {live: 'onTilePlaced', forecast: 'tilePlacedForecast'},
  // A scale raise is a `global` grant: the raiser's own rewarded reactors and every seat's «whoever raised».
  {live: 'onGlobalParameterIncrease', forecast: 'grantForecast'},
  {live: 'onGlobalParameterRaised', forecast: 'grantForecast'},
  // A colony built is a `colony` grant: every seat's «when any colony is placed».
  {live: 'onColonyAddedByAnyPlayer', forecast: 'grantForecast'},
  // The patent sale (TR46): the seller's «when you sell patents» — the sale prompt's `patentSale` model.
  {live: 'onPatentsSold', forecast: 'patentsSoldForecast'},
];
