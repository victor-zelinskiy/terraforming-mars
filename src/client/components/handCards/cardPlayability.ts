import {CardModel} from '@/common/models/CardModel';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {getCard} from '@/client/cards/ClientCardManifest';

/**
 * Why a project card in hand can't be played right now — a STRUCTURED
 * reason the premium hand overlay renders into a custom popover (no native
 * `title` tooltip). The reason is DISPLAY-ONLY: the button's enabled state
 * is gated strictly by the server's playable-cards list (see
 * `PlayerHome.playableProjectCardNames`), so an approximate reason can
 * never let a player commit an illegal play. When we can't pin down a
 * specific blocker we fall back to `{kind: 'generic'}` rather than guess.
 *
 *   turn        — it's simply not the player's action window right now.
 *   megacredits — affordability gap (M€-equivalent), with the deficit.
 *   param       — a global parameter / TR text requirement (templated).
 *   tag         — a tag-count requirement (rendered as a tag icon).
 *   production  — a production requirement (rendered as a resource icon).
 *   generic     — unplayable for a reason we can't introspect client-side.
 */
export type UnplayableReason =
  | {kind: 'turn'}
  | {kind: 'megacredits'; deficit: number}
  | {kind: 'param'; message: string; params: ReadonlyArray<string>}
  | {kind: 'tag'; tag: Tag; count: number}
  | {kind: 'production'; resource: Resource; count: number}
  | {kind: 'generic'};

export type HandCardPlayState = {
  playable: boolean;
  reason?: UnplayableReason;
};

function productionOf(player: PublicPlayerModel, resource: Resource): number {
  switch (resource) {
  case Resource.MEGACREDITS: return player.megacreditProduction;
  case Resource.STEEL: return player.steelProduction;
  case Resource.TITANIUM: return player.titaniumProduction;
  case Resource.PLANTS: return player.plantProduction;
  case Resource.ENERGY: return player.energyProduction;
  case Resource.HEAT: return player.heatProduction;
  default: return 0;
  }
}

function globalParamReason(
  current: number,
  required: number,
  max: boolean,
  minKey: string,
  maxKey: string,
): UnplayableReason | undefined {
  const unmet = max ? current > required : current < required;
  if (!unmet) {
    return undefined;
  }
  return {kind: 'param', message: max ? maxKey : minKey, params: [String(required)]};
}

/**
 * Evaluate a single requirement descriptor against live game / player
 * state. Returns a reason when we're CONFIDENT the requirement is unmet,
 * otherwise `undefined` (either satisfied, or a requirement type we don't
 * introspect — in which case we stay silent rather than fabricate a
 * reason). Tag counts fold in Wild tags the way the server does, so the
 * common "needs N science" case reads correctly.
 */
function checkRequirement(
  d: CardRequirementDescriptor,
  game: GameModel,
  player: PublicPlayerModel,
): UnplayableReason | undefined {
  const count = d.count ?? 1;
  const max = d.max === true;

  if (d.oxygen !== undefined) {
    return globalParamReason(game.oxygenLevel, d.oxygen, max, 'Requires ${0}% oxygen', 'Requires ${0}% oxygen or less');
  }
  if (d.temperature !== undefined) {
    return globalParamReason(game.temperature, d.temperature, max, 'Requires ${0}°C', 'Requires ${0}°C or colder');
  }
  if (d.oceans !== undefined) {
    return globalParamReason(game.oceans, d.oceans, max, 'Requires ${0} ocean(s)', 'Requires ${0} ocean(s) or fewer');
  }
  if (d.venus !== undefined) {
    return globalParamReason(game.venusScaleLevel, d.venus, max, 'Requires Venus ${0}%', 'Requires Venus ${0}% or less');
  }
  if (d.tr !== undefined) {
    return globalParamReason(player.terraformRating, d.tr, max, 'Requires a terraform rating of ${0}', 'Requires a terraform rating of ${0} or less');
  }
  if (d.tag !== undefined) {
    const own = player.tags[d.tag] ?? 0;
    const wild = d.tag === Tag.WILD ? 0 : (player.tags[Tag.WILD] ?? 0);
    const have = own + wild;
    const unmet = max ? have > count : have < count;
    return unmet ? {kind: 'tag', tag: d.tag, count} : undefined;
  }
  if (d.production !== undefined) {
    const have = productionOf(player, d.production);
    const unmet = max ? have > count : have < count;
    return unmet ? {kind: 'production', resource: d.production, count} : undefined;
  }
  if (d.cities !== undefined && d.all !== true) {
    const unmet = max ? player.citiesCount > d.cities : player.citiesCount < d.cities;
    return unmet ? {kind: 'param', message: 'Requires ${0} city tile(s)', params: [String(d.cities)]} : undefined;
  }
  if (d.colonies !== undefined && d.all !== true) {
    const unmet = max ? player.coloniesCount > d.colonies : player.coloniesCount < d.colonies;
    return unmet ? {kind: 'param', message: 'Requires ${0} colony(ies)', params: [String(d.colonies)]} : undefined;
  }
  // Requirement types we can't reliably introspect client-side
  // (greeneries, all-players tile counts, moon rates, Turmoil parties,
  // Underworld tokens, resource-type spread, etc.) — stay silent so the
  // overlay falls back to a generic reason instead of a wrong one.
  return undefined;
}

function firstUnmetRequirement(
  requirements: ReadonlyArray<CardRequirementDescriptor>,
  game: GameModel,
  player: PublicPlayerModel,
): UnplayableReason | undefined {
  for (const d of requirements) {
    const reason = checkRequirement(d, game, player);
    if (reason !== undefined) {
      return reason;
    }
  }
  return undefined;
}

/**
 * Best-effort M€-equivalent affordability gap. Counts plain M€ plus the
 * substitutions that apply to THIS card's tags (steel for Building,
 * titanium for Space) and Helion's heat-as-M€. Rarer substitutions
 * (microbes/floaters on specific cards) are intentionally ignored: if the
 * card is in the unplayable set the gap we compute is an honest upper
 * bound, and a small mismatch only affects the displayed number, never the
 * (server-gated) enabled state. Returns `undefined` when nothing is owed.
 */
function affordabilityReason(
  card: CardModel,
  clientCard: ClientCard,
  player: PublicPlayerModel,
): UnplayableReason | undefined {
  const baseCost = card.calculatedCost ?? clientCard.cost ?? 0;
  const reds = card.additionalProjectCosts?.redsCost ?? 0;
  const effectiveCost = baseCost + reds;

  const tags = clientCard.tags ?? [];
  let maxPay = player.megacredits;
  if (tags.includes(Tag.BUILDING)) {
    maxPay += player.steel * player.steelValue;
  }
  if (tags.includes(Tag.SPACE)) {
    maxPay += player.titanium * player.titaniumValue;
  }
  if (player.tableau.some((c) => c.name === CardName.HELION)) {
    maxPay += player.heat;
  }

  const deficit = effectiveCost - maxPay;
  return deficit > 0 ? {kind: 'megacredits', deficit} : undefined;
}

/**
 * The intrinsic blocker for a hand card — an unmet requirement first
 * (more actionable), then affordability. `undefined` means we found no
 * client-derivable blocker (the card may still be blocked by a bespoke
 * server-side condition we can't see — the caller handles that).
 */
export function deriveIntrinsicReason(
  card: CardModel,
  game: GameModel,
  player: PublicPlayerModel,
): UnplayableReason | undefined {
  const clientCard = getCard(card.name);
  if (clientCard === undefined) {
    return undefined;
  }
  const reqReason = firstUnmetRequirement(clientCard.requirements ?? [], game, player);
  if (reqReason !== undefined) {
    return reqReason;
  }
  return affordabilityReason(card, clientCard, player);
}

/**
 * Final play-state for one hand card, combining the authoritative server
 * gate with the client-derived explanation.
 *
 *   - `playable` is true ONLY when it's the player's action window
 *     (`turnAvailable`) AND the server lists the card as playable
 *     (`serverPlayable`). This strictly mirrors the action menu so the
 *     button can never offer an illegal play.
 *   - Otherwise we pick the most informative reason: a concrete intrinsic
 *     blocker if we can derive one; else "not your turn" when it isn't the
 *     player's window; else a generic "can't play now".
 */
export function computeHandCardPlayState(
  card: CardModel,
  game: GameModel,
  player: PublicPlayerModel,
  turnAvailable: boolean,
  serverPlayable: boolean,
): HandCardPlayState {
  if (turnAvailable && serverPlayable) {
    return {playable: true};
  }
  const intrinsic = deriveIntrinsicReason(card, game, player);
  if (intrinsic !== undefined) {
    return {playable: false, reason: intrinsic};
  }
  return {playable: false, reason: turnAvailable ? {kind: 'generic'} : {kind: 'turn'}};
}
