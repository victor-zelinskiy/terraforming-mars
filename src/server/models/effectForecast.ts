import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {ICard} from '../cards/ICard';
import {isIProjectCard} from '../cards/IProjectCard';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {CardType} from '../../common/cards/CardType';
import {Resource} from '../../common/Resource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {SpaceType} from '../../common/boards/SpaceType';
import {CITY_TILES, GREENERY_TILES, OCEAN_TILES, TileType} from '../../common/TileType';
import {Behavior} from '../behavior/Behavior';
import {PartyHooks} from '../turmoil/parties/PartyHooks';
import {PartyName} from '../../common/turmoil/PartyName';
import {isPlanetaryTag} from '../pathfinders/PathfindersData';
import {AutomaCorporations} from '../automa/corps/AutomaCorporations';
import {marsBotOf} from '../automa/AutomaUtil';
import {ActionEffect, ActionPreview, ActionPreviewBranch} from '../../common/models/ActionPreviewModel';
import {
  EffectForecast,
  EffectForecastCertainty,
  EffectForecastDiscounts,
  EffectForecastFact,
  EffectForecastPaymentValue,
  EffectForecastRecipient,
  EffectForecastSource,
} from '../../common/models/EffectForecastModel';
import {EffectForecastContext, EffectForecastGrant, EffectForecastTile} from '../cards/EffectForecastContext';
import {cardResourceIcon} from '../cards/actionPreviews';
import * as forecast from '../cards/effectForecastPreviews';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES, SpendableCardResource} from '../../common/inputs/Spendable';
import {DEFAULT_PAYMENT_VALUES} from '../../common/inputs/Payment';

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
function reactorsOf(owner: IPlayer, active: IPlayer, card: ICard): Array<ICard> {
  const out: Array<ICard> = [...owner.playedCards];
  if (owner.id === active.id && !owner.playedCards.has(card.name)) {
    out.push(card);
  }
  return out;
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

/** ONE chip → the grant the second-order hooks see (undefined = a cost, or nothing a hook reacts to). */
export function grantOfEffect(effect: ActionEffect): EffectForecastGrant | undefined {
  if (effect.direction !== 'gain' || effect.amount <= 0) {
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
    return {kind: 'global', parameter, steps: effect.amount};
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

/** The second-order reactors of ONE seat (+ the acting seat's own played card, «including this»). */
function grantReactorsOf(owner: IPlayer, active: IPlayer, card: ICard): Array<ICard> {
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
  card: ICard,
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
        const recipientOf = forecast.recipientOf(active, recipient);
        facts.push(inherit === undefined ?
          {...fact, recipient: recipientOf} :
          {...fact, recipient: recipientOf, certainty: fact.certainty === 'exact' ? inherit.certainty : fact.certainty, timing: inherit.timing, sequence: inherit.sequence ?? fact.sequence});
      }
    }
  }
  return facts;
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

/** The seat a fact's recipient stands for. */
function playerOfRecipient(game: IGame, active: IPlayer, recipient: EffectForecastRecipient): IPlayer | undefined {
  if (recipient.kind === 'you') {
    return active;
  }
  return game.players.find((p) => p.color === recipient.color);
}

/** The cascade: every exact / deferred first-order fact's chips, offered to ITS recipient's second-order hooks. */
function cascadeFacts(active: IPlayer, card: ICard, first: ReadonlyArray<EffectForecastFact>, ctx: EffectForecastContext): Array<EffectForecastFact> {
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

function tileOf(tileType: TileType | undefined, count: number, placementType: string | undefined, offMars: boolean): EffectForecastTile {
  return {
    tileType,
    count,
    countsAsCity: tileType !== undefined && CITY_TILES.has(tileType),
    countsAsOcean: tileType !== undefined && OCEAN_TILES.has(tileType),
    countsAsGreenery: tileType !== undefined && GREENERY_TILES.has(tileType),
    placementType,
    offMars,
  };
}

/**
 * The tiles a branch WILL place: its board placement steps that carry a tile
 * identity (a marker prompt — Land Claim, Mars Nomads — places nothing and
 * fires no trigger), plus the card's RESERVED off-Mars city (placed with no
 * prompt, so it has no step — Ganymede Colony, Phobos Space Haven).
 */
export function tilesOfBranch(player: IPlayer, branch: ActionPreviewBranch, behavior: Behavior | undefined): Array<EffectForecastTile> {
  const tiles: Array<EffectForecastTile> = [];
  for (const step of branch.steps) {
    if (step.kind !== 'boardPlacement' || step.placementType === 'colony' || step.tileType === undefined) {
      continue;
    }
    tiles.push(tileOf(step.tileType, step.count ?? 1, step.placementType, false));
  }
  const fixed = behavior?.city?.space;
  if (fixed !== undefined) {
    const space = player.game.board.spaces.find((s) => s.id === fixed);
    tiles.push(tileOf(TileType.CITY, 1, 'city', space?.spaceType === SpaceType.COLONY));
  }
  return tiles;
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

// ── discounts + payment values ──────────────────────────────────────────────

function discountsOf(player: IPlayer, card: ICard, operation: 'play' | 'action'): EffectForecastDiscounts {
  if (operation !== 'play' || !isIProjectCard(card)) {
    const base = card.cost ?? 0;
    return {base, final: base, items: [], other: 0};
  }
  const breakdown = player.getCardCostBreakdown(card);
  const itemized = breakdown.discounts.reduce((sum, d) => sum + d.amount, 0);
  return {
    base: breakdown.base,
    final: breakdown.final,
    items: breakdown.discounts.map((d) => ({source: d.source, amount: d.amount})),
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
 * `current → resulting` is only honest for a pool the card being played does
 * not touch ITSELF: its own chip already moves that pool, so a reaction's
 * arrow would start from a number the play has already changed. Strip the
 * arrow (keep the delta) wherever the operation's own chips name the same
 * pool — the UI then says «сверх собственного эффекта карты».
 */
function stripTouchedPools(facts: ReadonlyArray<EffectForecastFact>, own: ReadonlyArray<ActionEffect>): Array<EffectForecastFact> {
  const touched = new Set(own.map((e) => `${e.icon}|${e.note === 'production' ? 'production' : 'stock'}`));
  if (touched.size === 0) {
    return [...facts];
  }
  const strip = (effects: ReadonlyArray<ActionEffect>): Array<ActionEffect> => effects.map((e) => {
    if (e.current === undefined || !touched.has(`${e.icon}|${e.note === 'production' ? 'production' : 'stock'}`)) {
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

function buildForecast(player: IPlayer, card: ICard, preview: ActionPreview, operation: 'play' | 'action'): EffectForecast {
  const behavior = operation === 'play' ? card.behavior : card.actionBehavior;
  const branches = preview.branches;
  const single = branches.length <= 1;
  const baseCtx: EffectForecastContext = {operation, card, tiles: []};

  // The branch-independent tiles: a single branch's own; with several, only
  // the tiles EVERY available branch shares (rare — identical sub-behaviors).
  const perBranchTiles = branches.map((b) => tilesOfBranch(player, b, behavior));
  const sharedTiles = single ?
    (perBranchTiles[0] ?? tilesOfBranch(player, {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}, behavior)) :
    [];
  const ctx: EffectForecastContext = {...baseCtx, tiles: sharedTiles};

  // 1. The card-played fan-out (a play only — an action plays no card).
  const played = operation === 'play' ? cardPlayedFacts(player, card, ctx) : [];

  // 2 + 3. The branch-independent grants and tiles.
  const facts: Array<EffectForecastFact> = [...played];
  const ownEffects: Array<ActionEffect> = [];
  const byBranch: Record<number, Array<EffectForecastFact>> = {};
  if (single) {
    const effects = branches[0]?.effects ?? [];
    ownEffects.push(...effects);
    facts.push(...grantFacts(player, player, card, grantsOf(effects), ctx));
    facts.push(...tileFacts(player, card, sharedTiles, ctx));
  } else {
    for (let pos = 0; pos < branches.length; pos++) {
      const branch = branches[pos];
      if (!branch.available) {
        continue;
      }
      ownEffects.push(...branch.effects);
      const branchCtx: EffectForecastContext = {...baseCtx, tiles: perBranchTiles[pos], branchPos: pos};
      const branchFacts = [
        ...grantFacts(player, player, card, grantsOf(branch.effects), branchCtx),
        ...tileFacts(player, card, perBranchTiles[pos], branchCtx),
      ];
      if (branchFacts.length > 0) {
        byBranch[pos] = branchFacts.map((fact) => ({
          ...fact,
          certainty: fact.certainty === 'unknown' ? 'unknown' : 'conditional',
          condition: {text: fact.condition?.text ?? fact.reason, state: 'depends', branchPos: pos},
        }));
      }
    }
  }
  // The cascade of the first-order facts (Saturn's production → Manutech's
  // steel, Pets' animal → Meat Industry's M€), on each recipient's own table.
  facts.push(...cascadeFacts(player, card, facts, ctx));
  for (const pos of Object.keys(byBranch)) {
    const list = byBranch[Number(pos)];
    list.push(...cascadeFacts(player, card, list, {...baseCtx, branchPos: Number(pos)}).map((fact) => ({
      ...fact,
      certainty: fact.certainty === 'unknown' ? 'unknown' as const : 'conditional' as const,
      condition: {text: fact.condition?.text ?? fact.reason, state: 'depends' as const, branchPos: Number(pos)},
    })));
  }

  const stripped = stripTouchedPools(facts, ownEffects);
  const strippedByBranch: Record<number, ReadonlyArray<EffectForecastFact>> = {};
  for (const pos of Object.keys(byBranch)) {
    strippedByBranch[Number(pos)] = stripTouchedPools(byBranch[Number(pos)], ownEffects);
  }
  const all = [...stripped, ...Object.values(strippedByBranch).flat()];
  return {
    facts: stripped,
    byBranch: Object.keys(strippedByBranch).length > 0 ? strippedByBranch : undefined,
    discounts: discountsOf(player, card, operation),
    paymentValues: paymentValuesOf(player, card, operation),
    coverage: all.some((f) => f.certainty === 'unknown') ? 'partial' : 'complete',
  };
}

/** The forecast of PLAYING `card` (a hand card, a prelude, the picked corporation). */
export function effectForecastForPlay(player: IPlayer, card: ICard, preview: ActionPreview): EffectForecast {
  return buildForecast(player, card, preview, 'play');
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
];
