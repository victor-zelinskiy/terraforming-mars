/*
 * view → EndgameModel projection, extracted from EndgameExperience.vue so the
 * console-native scoring workspace and the desktop endgame experience build
 * THE SAME model from THE SAME projection — one set of numbers, two shells.
 *
 * Client-side (needs the card manifest for corporations / strategy inputs);
 * everything downstream (`buildEndgameModel`, the reveal/console VMs) stays
 * pure and unit-tested.
 */
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import type {EndgameFact} from '@/common/events/endgameFacts';
import {getCard} from '@/client/cards/ClientCardManifest';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {buildEndgameModel, EndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {decomposePlayerCardVp, type CardDecl} from '@/client/components/endgame/cardScoreContribution';
import type {StrategyInput, ResourceTotals} from '@/client/components/endgame/strategyArchetypes';

export function corporationsOf(p: PublicPlayerModel): Array<string> {
  return p.tableau
    .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
    .map((card) => card.name);
}

export function playerCardsFromView(view: ViewModel): Partial<Record<Color, ReadonlyArray<CardName>>> {
  const out: Partial<Record<Color, ReadonlyArray<CardName>>> = {};
  for (const p of view.players) {
    out[p.color] = p.tableau.map((c) => c.name);
  }
  return out;
}

/** Resource counts on each player's cards (for Vermin 2.0 — animals on Vermin, etc.). */
export function cardResourcesFromView(view: ViewModel): Partial<Record<Color, Partial<Record<CardName, number>>>> {
  const out: Partial<Record<Color, Partial<Record<CardName, number>>>> = {};
  for (const p of view.players) {
    const byCard: Partial<Record<CardName, number>> = {};
    for (const c of p.tableau) {
      if (c.resources !== undefined && c.resources > 0) {
        byCard[c.name] = c.resources;
      }
    }
    out[p.color] = byCard;
  }
  return out;
}

// The minimal manifest declaration the VP decomposition needs (injected, keeps
// the pure module manifest-free).
function cardDecl(name: string): CardDecl | undefined {
  const c = getCard(name as CardName);
  if (c === undefined) {
    return undefined;
  }
  return {victoryPoints: c.victoryPoints, resourceType: c.resourceType, tags: c.tags, type: c.type};
}

// Build the per-player strategy-archetype inputs from the view + the card
// manifest: tag counts, colonies owned, the best-effort card-VP decomposition,
// and accumulated card resources by type.
function strategyInputFor(
  view: ViewModel,
  p: PublicPlayerModel,
  cardResources: Partial<Record<Color, Partial<Record<CardName, number>>>>,
): StrategyInput {
  const totals: ResourceTotals = {animals: 0, microbes: 0, floaters: 0, animalCards: 0, microbeCards: 0, floaterCards: 0};
  for (const card of p.tableau) {
    const def = getCard(card.name);
    const n = card.resources ?? 0;
    if (def?.resourceType === CardResource.ANIMAL) {
      totals.animalCards++; totals.animals += n;
    } else if (def?.resourceType === CardResource.MICROBE) {
      totals.microbeCards++; totals.microbes += n;
    } else if (def?.resourceType === CardResource.FLOATER) {
      totals.floaterCards++; totals.floaters += n;
    }
  }
  const coloniesOwned = (view.game.colonies ?? [])
    .filter((c) => c.colonies.includes(p.color))
    .map((c) => c.name);
  const details = p.victoryPointsBreakdown?.detailsCards ?? [];
  const {bySource, contributions} = decomposePlayerCardVp(details, cardResources[p.color] ?? {}, cardDecl);
  const cardContributions = contributions
    .filter((c) => c.totalVp > 0)
    .map((c) => ({cardName: c.cardName, totalVp: c.totalVp, source: c.source, confidence: c.confidence}));
  return {tags: p.tags ?? {}, coloniesOwned, cardVp: bySource, resourceTotals: totals, cardContributions};
}

/**
 * Build the endgame model from a Phase.END view. `facts` are optional (the
 * analytics fall back to the base template analyzers while absent).
 */
export function endgameModelFromView(view: ViewModel, facts?: ReadonlyArray<EndgameFact>): EndgameModel {
  const game = view.game;
  const cardResources = cardResourcesFromView(view);
  const inputs: Array<EndgamePlayerInput> = view.players
    .filter((p) => p.victoryPointsBreakdown !== undefined)
    .map((p) => ({
      color: p.color,
      // The Automa seat localizes («Бот») — the whole endgame stack
      // (hero, reveal lanes, narrative) inherits the display name here.
      name: participantDisplayName(p),
      // The RAW server name is kept so the narrative can match the server's
      // award-funder log tokens (which use the raw name) back to a player.
      rawName: p.name,
      corporations: corporationsOf(p),
      megacredits: p.megacredits,
      breakdown: p.victoryPointsBreakdown,
      vpByGeneration: p.victoryPointsByGeneration ?? [],
      globalSteps: p.globalParameterSteps ?? {},
      leftover: {steel: p.steel, titanium: p.titanium, heat: p.heat, plants: p.plants, energy: p.energy},
      production: {
        megacredits: p.megacreditProduction, steel: p.steelProduction, titanium: p.titaniumProduction,
        plants: p.plantProduction, energy: p.energyProduction, heat: p.heatProduction,
      },
      strategyInput: strategyInputFor(view, p, cardResources),
      // The bot seat carries its difficulty — the endgame identity chip and
      // the icon-VP formula note both read this one canonical value.
      ...(p.isMarsBot === true && game.automa !== undefined ? {botDifficulty: game.automa.difficulty} : {}),
    }));
  // MarsBot clock win: entering the final generation means the human lost
  // regardless of totals (Automa rules) — the bot is the forced winner.
  const automaClockWinner = game.automa?.instantWin === true ?
    view.players.find((p) => p.isMarsBot === true)?.color :
    undefined;
  return buildEndgameModel(inputs, {
    hasMoon: game.moon !== undefined,
    hasPathfinders: game.pathfinders !== undefined,
    hasVenus: game.gameOptions.expansions.venus === true,
    generation: game.generation,
    soloWin: game.isSoloModeWin,
    automaClockWinner,
    facts,
    playerCards: playerCardsFromView(view),
    cardResources,
  });
}

/** Colors of the MarsBot seats — the console VM's bot-normalisation input. */
export function botColorsFromView(view: ViewModel): Array<Color> {
  return view.players.filter((p) => p.isMarsBot === true).map((p) => p.color);
}
