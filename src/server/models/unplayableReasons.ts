import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {IProjectCard} from '../cards/IProjectCard';
import {CardRequirements} from '../cards/requirements/CardRequirements';
import {CardRequirement} from '../cards/requirements/CardRequirement';
import {InequalityRequirement} from '../cards/requirements/InequalityRequirement';
import {GlobalParameterRequirement} from '../cards/requirements/GlobalParameterRequirement';
import {TagCardRequirement} from '../cards/requirements/TagCardRequirement';
import {ProductionRequirement} from '../cards/requirements/ProductionRequirement';
import {RequirementType} from '../../common/cards/RequirementType';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {GlobalParameter} from '../../common/GlobalParameter';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {MAX_TEMPERATURE, MAX_OXYGEN_LEVEL, MAX_VENUS_SCALE} from '../../common/constants';
import {Counter} from '../behavior/Counter';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
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
  // Card-specific bespoke reason the generic checks can't introspect (opt-in
  // `ICard.unplayableReason` — e.g. Robotic Workforce: "no card to copy").
  // ALWAYS considered, not just as a fallback: a card can be blocked by BOTH
  // affordability AND its bespoke rule (Robotic Workforce with too little M€
  // AND nothing to copy), and we promised to surface every reason, not one.
  const bespoke = card.unplayableReason?.(player);
  if (bespoke !== undefined) {
    reasons.push(bespoke);
  }
  if (reasons.length === 0) {
    // Nothing concrete surfaced — be honest rather than silent.
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
  // Per-TYPE ordinal, counted over EVERY requirement (met ones included) —
  // the card-information generator numbers its blocks the same way, so the
  // two addresses line up (see `requirementBlockId`).
  const seen = new Map<string, number>();
  for (const req of compiled.requirements) {
    const ordinal = (seen.get(req.type) ?? 0) + 1;
    seen.set(req.type, ordinal);
    if (req.satisfies(player, card)) {
      continue;
    }
    // MARKED HERE, once, rather than in each of the twenty branches below:
    // everything this loop emits IS a printed card requirement by
    // construction, and a per-branch flag is a flag somebody forgets.
    const reason: UnplayableReason = {...requirementReason(req, player, card), requirement: true};
    if (req instanceof GlobalParameterRequirement) {
      const effective = req.effectiveThreshold(player);
      if (effective !== req.count) {
        reason.effectiveCount = effective;
      }
      if (requirementUnattainable(player, card, req)) {
        reason.unattainable = true;
      }
    }
    const key = requirementBlockId(req, ordinal);
    if (key !== undefined) {
      reason.requirementKey = key;
    }
    out.push(reason);
  }
}

/**
 * The requirement TYPES whose reason above is a COMPLETE restatement of the
 * printed rule, so a surface showing the reason may hide that rule.
 *
 * Deliberately an allow-list, not «everything except the odd ones»: the rules
 * text is generated independently (`buildCardInformation.requirementBlock`),
 * and a type whose generated sentence one day says MORE than the reason must
 * fail CLOSED — showing a rule twice is a blemish, hiding half of one is a
 * lie. Excluded on purpose: CHAIRMAN / PARTY (the reason only says "a
 * specific political situation"), REMOVED_PLANTS and every Moon / Underworld
 * type (no templated reason of their own), and anything reaching the generic
 * fallback.
 */
const FULLY_RESTATED_REQUIREMENTS: ReadonlySet<RequirementType> = new Set([
  RequirementType.OXYGEN, RequirementType.TEMPERATURE, RequirementType.VENUS, RequirementType.OCEANS,
  RequirementType.TR, RequirementType.TAG, RequirementType.PRODUCTION,
  RequirementType.CITIES, RequirementType.GREENERIES, RequirementType.COLONIES,
  RequirementType.FLOATERS, RequirementType.RESOURCE_TYPES,
  // «Requires N step(s) advanced on the Hydronetwork» restates the whole
  // printed rule — the rules block adds nothing over the reason.
  RequirementType.DELTA_POSITION,
]);

/**
 * The address of the RULES block this requirement generated, mirroring
 * `buildCardInformation.requirementBlock`: `req:<type>[:<tag|resource>]`
 * plus `~<n>` for the second and later requirements of the same TYPE.
 * `undefined` = do not suppress anything (see the allow-list above, plus the
 * two qualifiers the reason text does not carry: `all` («any player») and
 * `nextTo` (adjacency), and any card whose rule block was consolidated —
 * those simply never match an address we produce).
 */
function requirementBlockId(req: CardRequirement, ordinal: number): string | undefined {
  if (req.all || req.nextTo || !FULLY_RESTATED_REQUIREMENTS.has(req.type)) {
    return undefined;
  }
  const qualifier = req instanceof TagCardRequirement ? `:${req.tag}` :
    req instanceof ProductionRequirement ? `:${req.resource}` : '';
  return `req:${req.type}${qualifier}${ordinal > 1 ? `~${ordinal}` : ''}`;
}

/**
 * Is this UNMET printed requirement provably beyond reach for the rest of the
 * game? Only a MAX bound on a planetary parameter can be: the parameter must
 * be unable to ever go back down, and no mechanism the player currently has
 * may still bridge the gap. The verdict is about the CURRENT game state — the
 * caller already ran the real `satisfies`, which folds in every requirement
 * bonus the player holds right now (Adaptation Technology, Inventrix, Morning
 * Star, an ARMED Special Design via `lastCardPlayed`, the Scientists sp02
 * policy, Underworld requirement tokens, `temporaryGlobalParameterRequirementBonus`)
 * without consuming any of them. Future ACQUISITIONS (drawing Adaptation
 * Technology two generations from now) are deliberately out of scope; when
 * such a modifier does arrive, this recomputes and the verdict softens on its
 * own. When permanence cannot be PROVEN, the answer is `false` and the UI
 * keeps the conservative "not met yet" voice.
 */
function requirementUnattainable(player: IPlayer, card: IProjectCard, req: GlobalParameterRequirement): boolean {
  if (!req.max) {
    // A minimum stays reachable for as long as the parameter can rise; a
    // maxed-out scale trivially satisfies any printed minimum on it.
    return false;
  }
  const parameter = req.globalParameter;
  if (parameter !== GlobalParameter.TEMPERATURE && parameter !== GlobalParameter.OXYGEN &&
      parameter !== GlobalParameter.VENUS && parameter !== GlobalParameter.OCEANS) {
    // Moon rates: the Reds rp03 political action can lower them and their
    // interplay is untested here — stay conservative, never claim "forever".
    return false;
  }
  if (parameterCanStillDecrease(player.game, parameter)) {
    return false;
  }
  // In-play bridging engines close the gap by SPENDING card resources, and
  // their stock can still grow — Think Tank data (any card), Aeron Genomics
  // animals (animal-resource cards only). `satisfies` consulted their CURRENT
  // resources; while the card itself is on the table the door stays open.
  if (player.tableau.get(CardName.THINK_TANK) !== undefined) {
    return false;
  }
  if (card.resourceType === CardResource.ANIMAL && player.tableau.get(CardName.AERON_GENOMICS) !== undefined) {
    return false;
  }
  return true;
}

/**
 * Whether this planetary parameter can still go DOWN in this specific game.
 * Every decrease mechanic in the codebase is Turmoil-gated: the Reds rp03
 * political action (temperature / oxygen / Venus down, or an ocean tile
 * removed), the Snow Cover and Dry Deserts global events, and Pathfinders'
 * Magnetic Field Stimulation Delays global event (global events only exist
 * with Turmoil). One exception inside Turmoil games: once a scale reaches its
 * maximum, `Game.increaseTemperature` / `increaseOxygenLevel` /
 * `increaseVenusScaleLevel` early-return before their negative branches, so a
 * maxed scale is frozen forever. Oceans are physically removed from the board
 * instead and never freeze.
 */
function parameterCanStillDecrease(game: IGame, parameter: GlobalParameter): boolean {
  if (!game.gameOptions.turmoilExtension) {
    return false;
  }
  switch (parameter) {
  case GlobalParameter.TEMPERATURE:
    return game.getTemperature() < MAX_TEMPERATURE;
  case GlobalParameter.OXYGEN:
    return game.getOxygenLevel() < MAX_OXYGEN_LEVEL;
  case GlobalParameter.VENUS:
    return game.getVenusScaleLevel() < MAX_VENUS_SCALE;
  default:
    return true;
  }
}

function requirementReason(req: CardRequirement, player: IPlayer, card: IProjectCard): UnplayableReason {
  const required = req.count;
  const max = req.max;
  // For a global parameter the "now" badge shows the RAW scale value — the
  // same number the HUD readout shows. `getScore` folds the player's
  // requirement bonus into the level, which would make the badge disagree
  // with the header; the bonus is reported on the threshold side instead
  // (`effectiveCount`, set by the caller).
  const current = req instanceof GlobalParameterRequirement ? req.getGlobalValue(player) :
    req instanceof InequalityRequirement ? req.getScore(player, card) : undefined;
  switch (req.type) {
  case RequirementType.OXYGEN:
    return {type: 'globalParameter', globalParameter: 'oxygen', message: max ? 'Requires ${0}% oxygen or less' : 'Requires ${0}% oxygen', params: [String(required)], current};
  case RequirementType.TEMPERATURE:
    return {type: 'globalParameter', globalParameter: 'temperature', message: max ? 'Requires ${0}°C or colder' : 'Requires ${0}°C', params: [String(required)], current};
  case RequirementType.VENUS:
    return {type: 'globalParameter', globalParameter: 'venus', message: max ? 'Requires Venus ${0}% or less' : 'Requires Venus ${0}%', params: [String(required)], current};
  case RequirementType.OCEANS:
    return {type: 'globalParameter', globalParameter: 'oceans', message: max ? 'Requires ${0} ocean(s) or fewer' : 'Requires ${0} ocean(s)', params: [String(required)], current};
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
  case RequirementType.FLOATERS:
    return {type: 'count', message: 'Requires ${0} floater(s)', params: [String(required)], current};
  case RequirementType.RESOURCE_TYPES:
    return {type: 'count', message: 'Requires ${0} resource type(s)', params: [String(required)], current};
  case RequirementType.HABITAT_RATE:
    return {type: 'count', message: 'Requires a habitat rate of ${0}', params: [String(required)], current};
  case RequirementType.MINING_RATE:
    return {type: 'count', message: 'Requires a mining rate of ${0}', params: [String(required)], current};
  case RequirementType.LOGISTIC_RATE:
    return {type: 'count', message: 'Requires a logistic rate of ${0}', params: [String(required)], current};
  case RequirementType.HABITAT_TILES:
    return {type: 'count', message: 'Requires ${0} habitat tile(s)', params: [String(required)], current};
  case RequirementType.MINING_TILES:
    return {type: 'count', message: 'Requires ${0} mine tile(s)', params: [String(required)], current};
  case RequirementType.ROAD_TILES:
    return {type: 'count', message: 'Requires ${0} road tile(s)', params: [String(required)], current};
  case RequirementType.CORRUPTION:
    return {type: 'count', message: 'Requires ${0} corruption', params: [String(required)], current};
  case RequirementType.UNDERGROUND_TOKENS:
    return {type: 'count', message: 'Requires ${0} underground token(s)', params: [String(required)], current};
  case RequirementType.DELTA_POSITION:
    // The position IS the steps-moved count (movement is monotone) — the
    // `current` badge shows honest progress («сейчас: 3») against the bar.
    return {type: 'count', message: 'Requires ${0} step(s) advanced on the Hydronetwork', params: [String(required)], current};
  case RequirementType.PARTY_LEADERS:
    return {type: 'party', message: 'Requires ${0} party leader(s)', params: [String(required)], current};
  case RequirementType.CHAIRMAN:
  case RequirementType.PARTY:
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
      // Name the production via its resource icon so the player sees WHICH
      // production has no reducible target (e.g. nobody has heat production).
      out.push({type: 'target', message: 'No target to reduce production', resource: dap.type});
    }
  }

  if (b.colonies?.buildColony !== undefined) {
    if (player.colonies.getPlayableColonies(b.colonies.buildColony.allowDuplicates).length === 0) {
      out.push({type: 'target', message: 'No colony available to build on'});
    }
  }

  // A card that MUST add a card-resource to some card on play (mustHaveCard) is
  // unplayable when no owned card can hold it (CEO's Favorite Project with no
  // resource-holding card in play). Mirror the SAME check `Executor.canExecute`
  // runs so the reason is the real one ("No card to add the resource to") rather
  // than the generic fallback — the play-side analog of the action reason.
  if (b.addResourcesToAnyCard !== undefined && !Array.isArray(b.addResourcesToAnyCard)) {
    const arctac = b.addResourcesToAnyCard;
    if (arctac.mustHaveCard === true) {
      const ctx = new Counter(player, card);
      const action = new AddResourcesToCard(player, arctac.type, {
        count: ctx.count(arctac.count),
        restrictedTag: arctac.tag,
        min: arctac.min,
        robotCards: arctac.robotCards !== undefined,
      });
      if (action.getCards().length === 0) {
        out.push({type: 'target', message: 'No card to add the resource to'});
      }
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
