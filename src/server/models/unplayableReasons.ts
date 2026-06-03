import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {CardRequirements} from '../cards/requirements/CardRequirements';
import {CardRequirement} from '../cards/requirements/CardRequirement';
import {InequalityRequirement} from '../cards/requirements/InequalityRequirement';
import {TagCardRequirement} from '../cards/requirements/TagCardRequirement';
import {ProductionRequirement} from '../cards/requirements/ProductionRequirement';
import {RequirementType} from '../../common/cards/RequirementType';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {Counter} from '../behavior/Counter';
import {MoonExpansion} from '../moon/MoonExpansion';
import {Turmoil} from '../turmoil/Turmoil';

/**
 * Authoritative, structured explanation of why `card` (a project card in the
 * player's hand) can't be played right now. Reuses the REAL playability
 * logic: each card requirement's own `satisfies`, the player's affordability
 * computation, and the board placement / target checks the behavior executor
 * runs in `canExecute`. Returns `[]` when the card IS playable (ignoring
 * whose turn it is — the client adds the turn/phase reason).
 *
 * Read-only with respect to game state. (It does call `player.canPlay`, which
 * refreshes the card's ephemeral `additionalProjectCosts` / `warnings`
 * exactly as the action menu already does each turn — no lasting effect.)
 */
export function unplayableReasons(player: IPlayer, card: IProjectCard): ReadonlyArray<UnplayableReason> {
  if (player.canPlay(card)) {
    return [];
  }
  const reasons: Array<UnplayableReason> = [];
  collectRequirementReasons(player, card, reasons);
  collectAffordabilityReason(player, card, reasons);
  collectBehaviorReasons(player, card, reasons);
  if (reasons.length === 0) {
    // The server said "no" but the block is a bespoke can-play rule we can't
    // introspect. Be honest rather than silent — this is the fallback path,
    // not the common one.
    reasons.push({type: 'rule', message: 'Card is unavailable due to unmet conditions'});
  }
  // Don't overwhelm the popover — a hand card rarely needs more than a few
  // lines. De-dupe identical entries (e.g. two tiles both lacking space).
  return dedupe(reasons).slice(0, 5);
}

function collectRequirementReasons(player: IPlayer, card: IProjectCard, out: Array<UnplayableReason>): void {
  // card.requirements are the (translated) descriptors; recompiling them
  // yields requirement objects whose `satisfies` is byte-for-byte the same
  // check Card.canPlay runs — so the reasons we surface are authoritative.
  const compiled = CardRequirements.compile([...card.requirements]);
  for (const req of compiled.requirements) {
    if (req.satisfies(player, card)) {
      continue;
    }
    out.push(requirementReason(req, player, card));
  }
}

function requirementReason(req: CardRequirement, player: IPlayer, card: IProjectCard): UnplayableReason {
  const required = req.count;
  const max = req.max;
  const current = req instanceof InequalityRequirement ? req.getScore(player, card) : undefined;
  switch (req.type) {
  case RequirementType.OXYGEN:
    return {type: 'globalParameter', message: max ? 'Requires ${0}% oxygen or less' : 'Requires ${0}% oxygen', params: [String(required)], current};
  case RequirementType.TEMPERATURE:
    return {type: 'globalParameter', message: max ? 'Requires ${0}°C or colder' : 'Requires ${0}°C', params: [String(required)], current};
  case RequirementType.VENUS:
    return {type: 'globalParameter', message: max ? 'Requires Venus ${0}% or less' : 'Requires Venus ${0}%', params: [String(required)], current};
  case RequirementType.OCEANS:
    return {type: 'globalParameter', message: max ? 'Requires ${0} ocean(s) or fewer' : 'Requires ${0} ocean(s)', params: [String(required)], current};
  case RequirementType.TR:
    return {type: 'tr', message: max ? 'Requires a terraform rating of ${0} or less' : 'Requires a terraform rating of ${0}', params: [String(required)], current};
  case RequirementType.TAG:
    return {type: 'tag', message: 'Requires ${0} tag(s)', params: [String(required)], tag: (req as TagCardRequirement).tag, current};
  case RequirementType.PRODUCTION:
    return {type: 'production', message: 'Requires ${0} production', params: [String(required)], resource: (req as ProductionRequirement).resource, current};
  case RequirementType.CITIES:
    return {type: 'count', message: 'Requires ${0} city tile(s)', params: [String(required)], current};
  case RequirementType.COLONIES:
    return {type: 'count', message: 'Requires ${0} colony(ies)', params: [String(required)], current};
  case RequirementType.GREENERIES:
    return {type: 'count', message: 'Requires ${0} greenery(ies)', params: [String(required)], current};
  case RequirementType.CHAIRMAN:
  case RequirementType.PARTY:
  case RequirementType.PARTY_LEADERS:
    return {type: 'party', message: 'Requires a specific political situation'};
  default:
    return {type: 'generic', message: 'Card requirement not met', current};
  }
}

function collectAffordabilityReason(player: IPlayer, card: IProjectCard, out: Array<UnplayableReason>): void {
  const deficit = player.affordabilityDeficit(card);
  if (deficit > 0) {
    out.push({type: 'megacredits', message: 'Need ${0} more M€', params: [String(deficit)]});
  }
}

const PLACEMENT: UnplayableReason = {type: 'placement', message: 'No space available for the tile'};
const TARGET: UnplayableReason = {type: 'target', message: 'No valid target available'};

/**
 * Placement / target / production blockers — mirrors the board and target
 * checks `Executor.canExecute` performs, but emits a structured reason
 * instead of a bare `false`. Covers the cases the client can't see.
 */
function collectBehaviorReasons(player: IPlayer, card: IProjectCard, out: Array<UnplayableReason>): void {
  const b = card.behavior;
  if (b === undefined) {
    return;
  }
  const game = player.game;
  const opts = player.affordOptionsForCard(card);

  if (b.city !== undefined && b.city.space === undefined) {
    if (game.board.getAvailableSpacesForType(player, b.city.on ?? 'city', opts).length === 0) {
      out.push(PLACEMENT);
    }
  }
  if (b.greenery !== undefined) {
    const spaces = game.board.getAvailableSpacesForType(player, b.greenery.on ?? 'greenery', opts);
    if (game.board.filterSpacesAroundRedCity(spaces).length === 0) {
      out.push(PLACEMENT);
    }
  }
  if (b.tile !== undefined) {
    if (game.board.getAvailableSpacesForType(player, b.tile.on, opts).length === 0) {
      out.push(PLACEMENT);
    }
  }

  if (b.moon !== undefined) {
    const moon = MoonExpansion.moonData(game).moon;
    if (b.moon.habitatTile?.space === undefined && b.moon.habitatTile !== undefined && moon.getAvailableSpacesOnLand(player).length === 0) {
      out.push(PLACEMENT);
    }
    if (b.moon.mineTile?.space === undefined && b.moon.mineTile !== undefined && moon.getAvailableSpacesForMine(player).length === 0) {
      out.push(PLACEMENT);
    }
    if (b.moon.roadTile?.space === undefined && b.moon.roadTile !== undefined && moon.getAvailableSpacesOnLand(player).length === 0) {
      out.push(PLACEMENT);
    }
  }

  if (b.decreaseAnyProduction !== undefined && !game.isSoloMode()) {
    const dap = b.decreaseAnyProduction;
    const targets = game.players.filter((p) => p.canHaveProductionReduced(dap.type, dap.count, player));
    if (targets.length === 0) {
      out.push(TARGET);
    }
  }

  if (b.colonies?.buildColony !== undefined) {
    if (player.colonies.getPlayableColonies(b.colonies.buildColony.allowDuplicates).length === 0) {
      out.push(TARGET);
    }
  }

  if (b.production !== undefined) {
    const ctx = new Counter(player, card);
    if (!player.production.canAdjust(ctx.countUnits(b.production))) {
      out.push({type: 'production', message: 'Cannot reduce production'});
    }
  }

  if (b.turmoil?.sendDelegates !== undefined) {
    const ctx = new Counter(player, card);
    const count = ctx.count(b.turmoil.sendDelegates.count);
    if (Turmoil.getTurmoil(game).getAvailableDelegateCount(player) < count) {
      out.push({type: 'party', message: 'Not enough available delegates'});
    }
  }
}

function dedupe(reasons: ReadonlyArray<UnplayableReason>): Array<UnplayableReason> {
  const seen = new Set<string>();
  const out: Array<UnplayableReason> = [];
  for (const r of reasons) {
    const key = `${r.type}|${r.message}|${r.tag ?? ''}|${r.resource ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}
