import {IPlayer} from '../IPlayer';
import {Space} from './Space';
import {Board, isSpecialTile} from './Board';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {SpaceType} from '../../common/boards/SpaceType';
import {CITY_TILES, OCEAN_TILES, GREENERY_TILES, HAZARD_TILES, TileType, tileTypeToString} from '../../common/TileType';
import {HAZARD_STEPS, hazardSeverity} from '../../common/AresTileType';
import {CardName, baseCardName} from '../../common/cards/CardName';
import {PlacementType} from './PlacementType';
import {PlacementPreviewContext} from './PlacementPreviewContext';
import {PlacementEffect} from '../../common/models/PlayerInputModel';
import {AresHandler} from '../ares/AresHandler';
import {AresHazards} from '../ares/AresHazards';
import {HazardData} from '../../common/ares/AresData';
import {ICard} from '../cards/ICard';
import {newCard} from '../createCard';
import {Phase} from '../../common/Phase';
import {Resource} from '../../common/Resource';
import * as constants from '../../common/constants';
import {
  BoardCellInfo,
  BoardCellStatus,
  BoardFact,
  BoardFactDelta,
  BoardFactRecipient,
  BoardPlacementKind,
  BoardPlacementPreview,
  ZoneProtection,
  ZonePlayerProtection,
} from '../../common/boards/BoardInformationFacts';
import {Color} from '../../common/Color';

/**
 * BoardInformationEngine — the read-only fact collector behind the premium
 * "board explains itself" layer. Given a player + space (+ a placement kind for
 * the active-placement preview) it returns explainable {@link BoardFact}s
 * WITHOUT mutating game state and WITHOUT re-implementing rules: it leans on the
 * SAME helpers the live commit / scoring path uses
 * (`MarsBoard.oceanAdjacencyBonus` / `placementCostInfo` / `illegalReasonFor`,
 * the `Board.is*Space` predicates + `getAdjacentSpaces`, the `constants.*` bonus
 * costs, and the `space.bonus` printed-bonus list).
 *
 * PURITY CONTRACT (enforced by `tests/server/boards/BoardInformationEngine.spec.ts`):
 *   - NEVER call `Game.grantPlacementBonuses` / `grantSpaceBonus` / `addTile` /
 *     `simpleAddTile` (they mutate stock/production/tiles + emit events).
 *   - NEVER enter `game.events` scopes (`withSource` / `beginAction` / `record*`).
 *   - NEVER `game.defer(...)`. Deferred / interactive bonuses are DESCRIBED, not run.
 *
 * Ares: ADAPTED (no longer an extension point). `aresAdjacencyFacts` reads
 * `space.adjacency` GENERICALLY — never "special tile = source" — and emits
 * `ares-adjacency-bonus` / `tile-owner-benefit` / `hazard-cleanup` facts;
 * hazard identity + the adjacency production penalty ride `hazardHoverFacts` /
 * `placementCostFacts`, whose costs come from the REAL `placementCostInfo`
 * gated by the SHARED `AresHandler.subjectToHazardAdjacency` /
 * `placementCostsWaived` predicates. All of it is inert when the module is off.
 */

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Hover info for a cell — what IS here + the standing rules (no placement context). */
export function boardCellInfo(player: IPlayer, space: Space): BoardCellInfo {
  const facts: Array<BoardFact> = [];
  const status = cellStatus(player, space);

  // Standing special-zone / reserved / restricted rules. Placement restrictions
  // (volcanic / reserved / restricted — "what may be placed here") are stale once
  // a tile covers the cell, so suppress them for an occupied cell; only the
  // ongoing Deflection-Zone rule survives.
  facts.push(...specialZoneFacts(player, space, {includePlacementRules: space.tile === undefined}));
  // If THIS tile is an Ares adjacency SOURCE, explain what neighbours + its owner
  // get (so hovering e.g. a Metallic Asteroid shows its adjacency bonus, not just lore).
  facts.push(...aresAdjacencySourceFacts(player, space));

  if (isHazard(space)) {
    // A hazard tile is NOT a "real tile" and the cell isn't placeable, so it
    // falls through both branches below — explain the hazard explicitly.
    facts.push(...hazardHoverFacts(player, space));
  } else if (Board.hasRealTile(space)) {
    if (status.external === true) {
      // Off the Mars grid (reserved off-Mars city slot): no Mars adjacency, so
      // NEVER the city-greenery / ocean-adjacency facts — `countsAs` is shown
      // separately by the client; here we explain why scoring doesn't apply.
      facts.push(externalAreaFact());
    } else {
      // What's already here scores at endgame — show for whom.
      facts.push(...existingTileScoringFacts(player, space));
      // Hovering an OCEAN tile: explain that it's an adjacency SOURCE (the base
      // for the future Ares "source nearby" language).
      if (Board.isOceanSpace(space)) {
        facts.push(oceanNeighbourRuleFact(player));
      }
    }
  } else if (isPlaceable(space)) {
    // An empty placeable cell: what placing ANY tile here would grant (PASSIVE —
    // the popover frames these as "При размещении здесь", not "Вы получите").
    facts.push(...printedBonusFacts(space, false));
    const ocean = oceanAdjacencyFact(player, space);
    if (ocean !== undefined) {
      facts.push(ocean);
    }
  }
  const zoneProtection = space.spaceType === SpaceType.DEFLECTION_ZONE ?
    buildZoneProtection(player) : undefined;
  return {space: space.id, status, description: cellDescription(space, status), zoneProtection, facts};
}

/**
 * Active-placement preview — the consequences of placing `kind` on `space`.
 *
 * `options.cleared` marks a REMOVE-AND-REPLACE placement (KaguyaTech "remove a
 * greenery, place a city regardless of placement rules", LunarMineUrbanization):
 * the cell's existing tile is removed BEFORE the new tile is placed, so unlike an
 * overlay it is NOT a covering placement — the player DOES gain the cell's printed
 * bonus + normal adjacency scoring, "as usual". Such a placement also bypasses the
 * normal legality rules (the card already chose this exact target), so it is shown
 * as legal with the full reward, never a stale "No placement bonus" / "occupied".
 */
export function boardCellPreview(
  player: IPlayer,
  space: Space,
  kind: BoardPlacementKind,
  options?: {
    cleared?: boolean,
    tileType?: TileType,
    sourceCard?: CardName,
    placementEffect?: PlacementEffect}): BoardPlacementPreview {
  const board = player.game.board;
  const cleared = options?.cleared === true;
  const legalSpaces = cleared ? [] : legalSpacesForKind(player, kind);
  const legal = cleared || legalSpaces.some((s) => s.id === space.id);
  // A cleared cell's tile is removed first → treat as an empty cell (grant the
  // bonus), NOT a covering placement (which suppresses it).
  const covering = Board.hasRealTile(space) && !cleared;
  const ctx = previewContext(kind, options?.tileType, cleared, covering, options?.placementEffect);

  const facts: Array<BoardFact> = [];
  facts.push(...placementCostFacts(player, space, ctx.tileType));
  if (ctx.grantsPlacementBonus) {
    facts.push(...printedBonusFacts(space, covering));
  }
  facts.push(...placementEffectFacts(player, ctx));
  // Adjacency-dependent facts (ocean M€ + city-greenery scoring) apply ONLY on
  // the Mars hex grid — an off-grid reserved slot scores 0 for adjacency.
  if (onMarsGrid(board, space)) {
    const ocean = ctx.grantsPlacementBonus ? oceanAdjacencyFact(player, space) : undefined;
    if (ocean !== undefined) {
      facts.push(ocean);
    }
    facts.push(...placementScoringFacts(player, space, ctx));
  }
  // Ares adjacency is earned by a TILE, not by a placement bonus — `Game
  // .grantPlacementBonuses` gates it on `space.tile !== undefined`, and the
  // Mars Nomads ruling says the same ("adjacency bonuses are not placement
  // bonuses"). A marker move earns none.
  if (ctx.placesTile) {
    facts.push(...aresAdjacencyFacts(player, space));
  }
  // What the CARD that owns this placement does about THIS cell, and what every
  // player's tile-placement triggers pay out — the two things the cell alone
  // can never say. Both are co-located, read-only card hooks.
  facts.push(...sourceCardFacts(player, space, options?.sourceCard, ctx));
  facts.push(...tileTriggerFacts(player, space, ctx));
  facts.push(...arcadianCommunityFact(player, space, covering, ctx));
  facts.push(...milestoneAwardFacts(player, space, ctx));
  const deflection = deflectionPlacementFact(player, space);
  if (deflection !== undefined) {
    facts.push(deflection);
  }
  // A remove-and-replace placement ignores the cell's placement-restriction rules
  // (it places "regardless of placement rules"), so don't surface volcanic /
  // reserved / restricted notes that no longer apply.
  facts.push(...specialZoneFacts(player, space, {includePlacementRules: !cleared}));

  const preview = classifyPlacementFacts(stripRedundantSource(facts, options?.sourceCard), player, space.id, kind, legal);
  if (!legal) {
    preview.illegalReason = board.illegalReasonFor(player, kind as PlacementType, space);
  }
  return preview;
}

// ---------------------------------------------------------------------------
// Cell status (hover header)
// ---------------------------------------------------------------------------

function cellStatus(player: IPlayer, space: Space): BoardCellStatus {
  const status = baseCellStatus(player, space);
  status.header = headerFor(space, status);
  return status;
}

/** The popover KICKER for a cell (distinct from the long zone descriptions). */
function headerFor(space: Space, status: BoardCellStatus): string {
  switch (status.reserved) {
  case 'nomad': return 'Mars Nomads camp';
  case 'noctis': return 'Reserved area';
  case 'colony': return 'Colony space';
  case 'restricted': return 'Restricted area';
  }
  // A SPECIAL / composite tile never degrades to "City"/"Ocean" — it reads as a
  // special (city) tile, with its NAME shown beside the header.
  if (status.special === true) {
    return status.countsAs?.includes('city') === true ? 'Special city' : 'Special tile';
  }
  switch (status.content) {
  case 'ocean': return 'Ocean';
  case 'city': return 'City';
  case 'greenery': return 'Greenery';
  case 'special-tile': return 'Special tile';
  case 'hazard': {
    const tt = space.tile?.tileType;
    return (tt === TileType.EROSION_SEVERE || tt === TileType.DUST_STORM_SEVERE) ? 'Severe hazard zone' : 'Hazard zone';
  }
  case 'empty':
  default:
    if (space.spaceType === SpaceType.OCEAN) {
      return 'Ocean area';
    }
    if (space.spaceType === SpaceType.DEFLECTION_ZONE) {
      return 'Deflection Zone';
    }
    if (space.spaceType === SpaceType.COVE) {
      return 'Cove';
    }
    return hasPrintedBonus(space) ? 'Land with a bonus' : 'Empty land';
  }
}

function hasPrintedBonus(space: Space): boolean {
  return space.bonus.some((b) => b !== SpaceBonus._RESTRICTED);
}

/** What a tile counts AS for rules/scoring (a composite tile is several). */
function countsAsFor(tileType: TileType): Array<'city' | 'ocean' | 'greenery'> {
  const out: Array<'city' | 'ocean' | 'greenery'> = [];
  if (CITY_TILES.has(tileType)) {
    out.push('city');
  }
  if (OCEAN_TILES.has(tileType)) {
    out.push('ocean');
  }
  if (GREENERY_TILES.has(tileType)) {
    out.push('greenery');
  }
  return out;
}

/**
 * Whether the cell participates in the normal Mars hex adjacency graph. The REAL
 * source of truth for scoring/adjacency — mirrors `getAdjacentSpaces`, which
 * returns `[]` for off-grid `COLONY` slots (the reserved off-Mars city spaces:
 * Maxwell Base, Ganymede Colony, the Venus city slots). So a tile that
 * `countsAs` a city/ocean but sits off-grid scores 0 for adjacency — we suppress
 * the misleading "city scores for greeneries" / "ocean adjacency" facts for it.
 * This is the gate that keeps `countsAs` SEPARATE from actual scoring.
 */
function onMarsGrid(board: Board, space: Space): boolean {
  return board.getAdjacentSpaces(space).length > 0;
}

/** A neutral "this tile is off the Mars surface" explainer (replaces the false
 *  Mars-adjacency facts for an occupied off-grid city). */
function externalAreaFact(): BoardFact {
  return {
    id: 'external-area',
    category: 'external-area',
    timing: 'rule',
    severity: 'info',
    recipient: {kind: 'neutral'},
    title: 'External area',
    description: 'This tile is outside the normal Mars surface. Normal Mars adjacency does not apply.',
  };
}

/** A passive one-liner under the header — never says "Вы получите" (hover, no action). */
function cellDescription(space: Space, status: BoardCellStatus): string | undefined {
  if (status.content === 'ocean') {
    return 'This cell is occupied by an ocean.';
  }
  if (status.content === 'empty' && status.reserved === undefined) {
    if (space.spaceType === SpaceType.OCEAN) {
      return 'Only an ocean tile can be placed here.';
    }
    if (space.spaceType !== SpaceType.DEFLECTION_ZONE && !hasPrintedBonus(space)) {
      return 'A tile can be placed here when an action allows it.';
    }
  }
  return undefined;
}

function baseCellStatus(player: IPlayer, space: Space): BoardCellStatus {
  const board = player.game.board;
  if (space.id === player.game.nomadSpace) {
    return {content: 'special-tile', reserved: 'nomad', spaceTypeLabel: 'Mars Nomads camp'};
  }
  // "Reserved" describes an EMPTY reserved cell. Once a tile is placed (an
  // off-Mars city slot like Maxwell Base / Ganymede Colony, or Noctis City),
  // the OCCUPIED cell flows to the tile branch below, which shows the real tile
  // identity (and, for off-grid slots, marks it external instead of "reserved").
  if (space.tile === undefined) {
    if (space.id === board.noctisCitySpaceId) {
      return {content: 'empty', reserved: 'noctis', spaceTypeLabel: 'Reserved for Noctis City'};
    }
    if (space.spaceType === SpaceType.COLONY) {
      return {content: 'empty', reserved: 'colony', spaceTypeLabel: 'Colony space'};
    }
    if (space.spaceType === SpaceType.RESTRICTED) {
      return {content: 'empty', reserved: 'restricted', spaceTypeLabel: 'Restricted area'};
    }
  }
  if (space.tile !== undefined) {
    const ownerColor = space.player?.color ?? space.coOwner?.color;
    if (!Board.hasRealTile(space)) {
      return {content: 'hazard', spaceTypeLabel: spaceTypeLabel(space.spaceType)};
    }
    const tileType = space.tile.tileType;
    // OFF the Mars adjacency grid? A reserved off-Mars city slot (Maxwell Base,
    // Ganymede Colony, the Venus city slots) has no adjacency, so it never scores
    // for greeneries / grants ocean M€ even though it `countsAs` a city. Such a
    // tile is inherently SPECIAL even when its TileType is a plain CITY.
    const external = !onMarsGrid(board, space);
    const special = isSpecialTile(tileType) || external;
    const countsAs = countsAsFor(tileType);
    // Prefer the recorded SOURCE card (set by `behavior.city`/`behavior.tile`);
    // fall back to the canonical tile-type name for a special TileType, but NEVER
    // the generic 'city'/'ocean'/'greenery' pseudo-names (an ordinary CITY tile
    // off-grid — Maxwell Base — is named only by its source card). Ordinary
    // on-grid tiles keep their placing card but never SHOW it (special !== true).
    // The card name is stripped to its base (Nuclear Zone:ares → Nuclear Zone) so
    // the UI never shows the expansion suffix / an untranslated variant id.
    const tileLabel = space.tile.card !== undefined ?
      baseCardName(space.tile.card) :
      (isSpecialTile(tileType) ? tileTypeToString[tileType] : undefined);
    // City wins the dot/content for a COMPOSITE (New Holland / Ocean City count
    // as both) — they read as city-like, not plain ocean.
    const content = Board.isCitySpace(space) ? 'city' :
      Board.isOceanSpace(space) ? 'ocean' :
        Board.isGreenerySpace(space) ? 'greenery' : 'special-tile';
    return {content, ownerColor, tileLabel, special, countsAs, external};
  }
  return {content: 'empty', spaceTypeLabel: spaceTypeLabel(space.spaceType)};
}

function spaceTypeLabel(spaceType: SpaceType): string {
  switch (spaceType) {
  case SpaceType.OCEAN: return 'Ocean';
  case SpaceType.COVE: return 'Cove';
  case SpaceType.DEFLECTION_ZONE: return 'Deflection Zone';
  case SpaceType.COLONY: return 'Colony space';
  case SpaceType.RESTRICTED: return 'Restricted area';
  case SpaceType.LUNAR_MINE: return 'Lunar mine';
  default: return 'Land';
  }
}

// ---------------------------------------------------------------------------
// Special zones / reserved / restricted (standing rules)
// ---------------------------------------------------------------------------

/**
 * Standing map-zone rules for a cell. Two distinct kinds:
 *  - The Deflection Zone is an ONGOING rule (plant protection via
 *    `player.plantsAreProtected`) — relevant whether or not the cell holds a
 *    tile, so it is ALWAYS emitted.
 *  - Everything else (Noctis / colony reserve / restricted / volcanic) is a
 *    PLACEMENT restriction — what may (not) be placed here. Once a tile covers
 *    the cell those rules are stale and no longer affect anything, so the hover
 *    passes `includePlacementRules: false` to drop them. The placement PREVIEW
 *    keeps them (there the player is actively deciding to place on this cell).
 */
function specialZoneFacts(
  player: IPlayer,
  space: Space,
  options: {includePlacementRules: boolean} = {includePlacementRules: true}): Array<BoardFact> {
  const out: Array<BoardFact> = [];
  const board = player.game.board;
  if (space.spaceType === SpaceType.DEFLECTION_ZONE) {
    out.push(rule('deflection-zone', 'map-special-zone', 'Deflection Zone', 'Protects you from plant destruction while ALL your tiles are inside this zone.', 'neutral'));
    return out;
  }
  if (!options.includePlacementRules) {
    return out;
  }
  if (space.id === board.noctisCitySpaceId) {
    out.push(rule('reserved-noctis', 'reserved-area', 'Reserved for Noctis City', 'This space is permanently reserved for the Noctis City card and cannot host any other tile.', 'nobody'));
  } else if (space.spaceType === SpaceType.COLONY) {
    out.push(rule('reserved-colony', 'reserved-area', 'Colony space', 'A reserved colony location — tiles cannot be placed here.', 'nobody'));
  } else if (space.spaceType === SpaceType.RESTRICTED) {
    out.push(rule('restricted', 'restriction', 'Restricted area', 'No tiles can ever be placed on this space.', 'nobody'));
  } else if (space.volcanic === true) {
    // The first half ("A volcanic space") only repeated the title.
    out.push(rule('volcanic', 'map-special-zone', 'Volcanic area', 'Some cards may only place their tile on a volcanic space.', 'neutral'));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Printed placement bonuses
// ---------------------------------------------------------------------------

function printedBonusFacts(space: Space, covering: boolean): Array<BoardFact> {
  if (covering) {
    return [rule('cover-no-bonus', 'placement-effect', 'No placement bonus', 'Placing over an existing tile does not grant the printed cell bonuses.', 'neutral')];
  }
  const out: Array<BoardFact> = [];
  for (const [bonus, count] of countBonuses(space.bonus)) {
    const d = describeSpaceBonus(bonus, count);
    out.push({
      id: `printed-${bonus}`,
      category: 'printed-placement-bonus',
      timing: 'immediate',
      severity: d.deferred ? 'info' : 'positive',
      recipient: {kind: 'current-player'},
      title: d.title,
      description: d.description,
      delta: d.delta,
      source: {type: 'board-cell', label: 'Cell bonus'},
    });
  }
  return out;
}

type BonusDescription = {title: string, delta?: BoardFactDelta, deferred: boolean, description?: string};

function describeSpaceBonus(bonus: SpaceBonus, count: number): BonusDescription {
  const gain = (icon: string, production = false): BoardFactDelta => ({icon, amount: count, direction: 'gain', production});
  switch (bonus) {
  case SpaceBonus.PLANT: return {title: 'Cell bonus', deferred: false, delta: gain('plants')};
  case SpaceBonus.STEEL: return {title: 'Cell bonus', deferred: false, delta: gain('steel')};
  case SpaceBonus.TITANIUM: return {title: 'Cell bonus', deferred: false, delta: gain('titanium')};
  case SpaceBonus.HEAT: return {title: 'Cell bonus', deferred: false, delta: gain('heat')};
  case SpaceBonus.ENERGY: return {title: 'Cell bonus', deferred: false, delta: gain('energy')};
  case SpaceBonus.DRAW_CARD: return {title: 'Cell bonus', deferred: false, delta: gain('cards')};
  case SpaceBonus.MEGACREDITS: return {title: 'Cell bonus', deferred: false, delta: gain('megacredits')};
  // No descriptions below: the chip already renders the production frame, and
  // "Added to a card you choose" only said the title ("Add to a card") again —
  // five identical restatements when a cell prints several card resources.
  case SpaceBonus.ENERGY_PRODUCTION: return {title: 'Cell bonus', deferred: false, delta: gain('energy', true)};
  case SpaceBonus.MICROBE: return {title: 'Add to a card', deferred: true, delta: gain('microbe')};
  case SpaceBonus.ANIMAL: return {title: 'Add to a card', deferred: true, delta: gain('animal')};
  case SpaceBonus.DATA: return {title: 'Add to a card', deferred: true, delta: gain('data')};
  case SpaceBonus.SCIENCE: return {title: 'Add to a card', deferred: true, delta: gain('science')};
  case SpaceBonus.ASTEROID: return {title: 'Add to a card', deferred: true, delta: gain('asteroid')};
  case SpaceBonus.OCEAN: return {title: 'Place an ocean tile', deferred: true, description: 'Pay M€ to place an ocean tile from this bonus'};
  case SpaceBonus.TEMPERATURE:
  case SpaceBonus.TEMPERATURE_4MC: return {title: 'Raise temperature', deferred: true, description: 'Pay M€ to raise temperature one step (+1 TR)'};
  case SpaceBonus.COLONY: return {title: 'Build a colony', deferred: true, description: 'Pay M€ to build a colony'};
  case SpaceBonus.DELEGATE: return {title: 'Send a delegate', deferred: true};
  case SpaceBonus._RESTRICTED:
  default: return {title: 'Cell bonus', deferred: false};
  }
}

function countBonuses(bonuses: ReadonlyArray<SpaceBonus>): ReadonlyArray<[SpaceBonus, number]> {
  const counts = new Map<SpaceBonus, number>();
  for (const bonus of bonuses) {
    if (bonus === SpaceBonus._RESTRICTED) {
      continue;
    }
    counts.set(bonus, (counts.get(bonus) ?? 0) + 1);
  }
  // A Map preserves insertion (first-seen) order, so entries() is already ordered.
  return [...counts.entries()];
}

// ---------------------------------------------------------------------------
// Ocean adjacency M€
// ---------------------------------------------------------------------------

function oceanAdjacencyFact(player: IPlayer, space: Space): BoardFact | undefined {
  const {oceans, megacredits} = player.game.board.oceanAdjacencyBonus(player, space);
  if (megacredits <= 0) {
    return undefined;
  }
  return {
    id: 'ocean-adjacency',
    category: 'ocean-adjacency-bonus',
    timing: 'immediate',
    severity: 'positive',
    recipient: {kind: 'current-player'},
    title: 'Adjacent to ocean',
    // The old description ("a tile placed next to an ocean grants M€") only said
    // the title again, and the `Ocean adjacency` source tag said it a THIRD time.
    // What the chip's total genuinely cannot show is the ARITHMETIC — and the
    // per-ocean rate is not always 2 (cards move `oceanBonus`). One ocean needs
    // no breakdown, so it spends no line.
    ...(oceans > 1 ?
      {description: 'Adjacent oceans: ${0} × ${1} M€', params: [String(oceans), String(player.oceanBonus)]} :
      {}),
    delta: {icon: 'megacredits', amount: megacredits, direction: 'gain'},
  };
}

/** Passive rule shown when HOVERING an ocean tile — it is an adjacency SOURCE (the
 *  base for the future Ares "source nearby" language). Not a gain to anyone yet. */
function oceanNeighbourRuleFact(player: IPlayer): BoardFact {
  return {
    id: 'ocean-neighbour-rule',
    category: 'ocean-adjacency-bonus',
    timing: 'rule',
    severity: 'info',
    recipient: {kind: 'neutral'},
    title: 'Adjacent placement',
    description: 'A tile placed next to an ocean grants M€ to the player who places it.',
    delta: {icon: 'megacredits', amount: player.oceanBonus, direction: 'gain'},
    source: {type: 'global-rule', label: 'Ocean adjacency'},
  };
}

// ---------------------------------------------------------------------------
// Placement's own global-parameter / TR effect
// ---------------------------------------------------------------------------

/**
 * The global-parameter bump a placement makes is intrinsic to the TILE, not to
 * the eligibility kind. A greenery raises oxygen and a plain ocean raises the
 * ocean parameter EVEN when placed on a cell reserved for the other (Protected
 * Valley / Mangrove put a greenery on an ocean-reserved cell → oxygen, never the
 * ocean track; an ocean can be placed on land → the ocean track). A special
 * tile placed on an ocean cell (Mohole Area) touches NEITHER parameter — its
 * card owns any effect — so keying off the exact tile (not `kind === 'ocean'`)
 * also stops the old false "ocean +1" on those.
 */
function placementEffectFacts(player: IPlayer, ctx: PlacementPreviewContext): Array<BoardFact> {
  const game = player.game;
  const out: Array<BoardFact> = [];
  if (ctx.tileType === TileType.GREENERY) {
    out.push(...oxygenRaiseFacts(player, 'effect'));
  } else if (ctx.tileType === TileType.OCEAN) {
    if (game.canAddOcean()) {
      const current = game.board.getOceanSpaces().length;
      out.push(gainFact('effect-ocean', 'placement-effect', 'Raises the ocean parameter',
        {icon: 'ocean', amount: 1, direction: 'gain', current, resulting: current + 1}));
      out.push(...terraformRatingFact(player, 'effect-tr-ocean', 1));
      // `onOceanPlaced` tests the count AFTER the tile is down, so the preview
      // asks about the resulting count.
      out.push(...oceanPlanetaryEventFacts(player, current + 1));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ares PLANETARY EVENTS — the board-wide consequence of moving a parameter
// ---------------------------------------------------------------------------

/**
 * One tile can set off an event that rewrites the whole map: the 6th ocean wipes
 * every dust storm AND pays the placer +1 TR; a later ocean count drops two new
 * erosions; the oxygen / temperature thresholds turn every existing hazard of a
 * kind SEVERE, which doubles what each one charges every future neighbour.
 *
 * None of it used to be previewed — the player met a second, board-wide event
 * only after confirming, which is precisely the surprise this panel exists to
 * prevent. The trip condition is `AresHazards.wouldFire` (the predicate the live
 * `testConstraint` runs) and the affected counts come from the same filters the
 * mutators walk, so the promise cannot drift from the commit.
 */
function hazardDataFor(player: IPlayer): HazardData | undefined {
  const game = player.game;
  if (game.gameOptions.aresExtension !== true) {
    return undefined;
  }
  return game.aresData?.hazardData;
}

/** The two events an OCEAN placement can trigger via the ocean COUNT. */
function oceanPlanetaryEventFacts(player: IPlayer, resultingOceans: number): Array<BoardFact> {
  const hazardData = hazardDataFor(player);
  if (hazardData === undefined) {
    return [];
  }
  const game = player.game;
  const out: Array<BoardFact> = [];

  if (AresHazards.wouldFire(hazardData.removeDustStormsOceanCount, resultingOceans)) {
    const cleared = AresHazards.spacesToClearDustStorms(game).length;
    out.push({
      id: 'ares-event-dust-storms-recede',
      category: 'hazard-cleanup',
      timing: 'immediate',
      severity: 'premium',
      recipient: {kind: 'current-player'},
      title: 'Planetary event: dust storms recede',
      // The TR is granted whether or not any storm is actually on the board, so
      // the count is a detail of the event, never its precondition.
      ...(cleared > 0 ? {description: 'Clears every dust storm · ${0} on the board', params: [String(cleared)]} : {}),
    });
    // Reuses the solar-phase waiver: WGT crosses thresholds without paying TR.
    out.push(...terraformRatingFact(player, 'ares-event-dust-storms-tr', 1));
  }

  // Ordered as `onOceanPlaced` runs them: erosions appear, then storms recede.
  // Listed after the reward on purpose — the RISK block is where it lands.
  if (AresHazards.erosionPlacementEnabled(game) &&
      AresHazards.wouldFire(hazardData.erosionOceanCount, resultingOceans)) {
    // The live rule drops SEVERE erosions once the severe-erosion temperature
    // threshold has already been consumed.
    const severe = hazardData.severeErosionTemperature.available !== true;
    out.push({
      id: 'ares-event-erosions-appear',
      category: 'hazard-penalty',
      timing: 'warning',
      severity: 'warning',
      recipient: {kind: 'neutral'},
      title: 'Planetary event: erosions appear',
      description: severe ?
        'Two SEVERE erosion tiles are placed on the map' :
        'Two erosion tiles are placed on the map',
    });
  }
  return out;
}

/**
 * The "every hazard of this kind becomes severe" events. Emitted ONLY when
 * something would actually change — the live rule consumes the threshold either
 * way but only logs a real upgrade, and announcing "0 affected" would spend a
 * line of a finite panel on a non-event.
 */
function intensifyEventFact(
  player: IPlayer,
  id: string,
  title: string,
  from: TileType,
  fires: boolean): Array<BoardFact> {
  if (!fires) {
    return [];
  }
  const affected = AresHazards.spacesToMakeSevere(player.game, from).length;
  if (affected === 0) {
    return [];
  }
  return [{
    id,
    category: 'hazard-penalty',
    timing: 'warning',
    severity: 'warning',
    recipient: {kind: 'neutral'},
    title,
    description: 'Becomes severe: ${0} · building next to one then costs −2',
    params: [String(affected)],
  }];
}

/**
 * `+N TR` — suppressed during the World Government phase, which raises the
 * parameter WITHOUT awarding terraform rating (`Game.increaseOxygenLevel` /
 * `increaseTemperature` gate the whole rating block on `phase !== SOLAR`).
 * Showing a TR gain that the commit won't grant is exactly the surprise this
 * preview exists to prevent.
 */
function terraformRatingFact(player: IPlayer, id: string, steps: number): Array<BoardFact> {
  if (player.game.phase === Phase.SOLAR) {
    return [];
  }
  const current = player.terraformRating;
  return [gainFact(id, 'placement-effect', 'Terraform rating',
    {icon: 'tr', amount: steps, direction: 'gain', current, resulting: current + steps})];
}

/**
 * Raising OXYGEN, plus the CHAIN it can set off. Crossing 8% raises the
 * temperature for free (`Game.increaseOxygenLevel`), which can itself cross a
 * heat-production step or the 0 °C free-ocean step. The player is about to place
 * ONE greenery; without this they discover a second terraforming action (and a
 * second TR) only after confirming.
 */
function oxygenRaiseFacts(player: IPlayer, idPrefix: string, steps = 1): Array<BoardFact> {
  const game = player.game;
  const current = game.getOxygenLevel();
  if (current >= constants.MAX_OXYGEN_LEVEL) {
    return [];
  }
  const applied = Math.min(steps, constants.MAX_OXYGEN_LEVEL - current);
  const resulting = current + applied;
  const out: Array<BoardFact> = [
    gainFact(`${idPrefix}-oxygen`, 'placement-effect', 'Raises oxygen',
      {icon: 'oxygen', amount: applied, direction: 'gain', unit: '%', current, resulting}),
    ...terraformRatingFact(player, `${idPrefix}-tr-oxygen`, applied),
  ];
  // The 8% bonus step. NOT gated on the solar phase — `increaseOxygenLevel`
  // raises the temperature outside its `phase !== SOLAR` block.
  if (current < constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS &&
      resulting >= constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS) {
    out.push(chainNote(`${idPrefix}-oxygen-chain`, 'Oxygen bonus step',
      'Reaching 8% oxygen also raises the temperature one step.'));
    out.push(...temperatureRaiseFacts(player, `${idPrefix}-oxygen-bonus`, 1));
  }
  // Ares: `increaseOxygenLevel` runs `onOxygenChange` LAST, after the 8%
  // temperature chain — the facts mirror that order.
  const hazardData = hazardDataFor(player);
  if (hazardData !== undefined) {
    out.push(...intensifyEventFact(player, `${idPrefix}-ares-dust-storms-severe`,
      'Planetary event: dust storms intensify', TileType.DUST_STORM_MILD,
      AresHazards.wouldFire(hazardData.severeDustStormOxygen, resulting)));
  }
  return out;
}

/**
 * Raising TEMPERATURE, plus its own bonus steps: heat production at −24 °C and
 * −20 °C, and a FREE ocean placement at 0 °C (`Game.increaseTemperature`).
 */
function temperatureRaiseFacts(player: IPlayer, idPrefix: string, steps = 1): Array<BoardFact> {
  const game = player.game;
  const current = game.getTemperature();
  if (current >= constants.MAX_TEMPERATURE) {
    return [];
  }
  const applied = Math.min(steps, (constants.MAX_TEMPERATURE - current) / 2);
  const resulting = current + applied * 2;
  const out: Array<BoardFact> = [
    gainFact(`${idPrefix}-temperature`, 'placement-effect', 'Raises temperature',
      {icon: 'temperature', amount: applied * 2, direction: 'gain', unit: '°C', current, resulting}),
    ...terraformRatingFact(player, `${idPrefix}-tr-temperature`, applied),
  ];
  // Heat production steps are inside the `phase !== SOLAR` block upstream.
  if (game.phase !== Phase.SOLAR) {
    const crossed = [constants.TEMPERATURE_BONUS_FOR_HEAT_1, constants.TEMPERATURE_BONUS_FOR_HEAT_2]
      .filter((threshold) => current < threshold && resulting >= threshold).length;
    if (crossed > 0) {
      const heat = player.production.get(Resource.HEAT);
      out.push({
        ...gainFact(`${idPrefix}-temperature-heat`, 'placement-effect', 'Temperature bonus step',
          {icon: 'heat', amount: crossed, direction: 'gain', production: true, current: heat, resulting: heat + crossed}),
        description: 'Crossing the bonus step raises your heat production.',
      });
    }
  }
  if (current < constants.TEMPERATURE_FOR_OCEAN_BONUS && resulting >= constants.TEMPERATURE_FOR_OCEAN_BONUS && game.canAddOcean()) {
    out.push(chainNote(`${idPrefix}-temperature-ocean`, 'Temperature bonus step',
      'Reaching 0 °C lets you place a free ocean tile.'));
  }
  // Ares: the temperature this placement drives can also intensify erosions —
  // reachable from a GREENERY through the 8% oxygen chain.
  const hazardData = hazardDataFor(player);
  if (hazardData !== undefined) {
    out.push(...intensifyEventFact(player, `${idPrefix}-ares-erosions-severe`,
      'Planetary event: erosions intensify', TileType.EROSION_MILD,
      AresHazards.wouldFire(hazardData.severeErosionTemperature, resulting)));
  }
  return out;
}

/** A quiet "and this triggers …" line that introduces a chained bonus step. */
function chainNote(id: string, title: string, description: string): BoardFact {
  return {
    id,
    category: 'placement-effect',
    timing: 'immediate',
    severity: 'premium',
    recipient: {kind: 'current-player'},
    title,
    description,
  };
}

// ---------------------------------------------------------------------------
// City / greenery endgame VP scoring (recipient-aware)
// ---------------------------------------------------------------------------

/** For an EXISTING tile (hover): who scores it at endgame. */
function existingTileScoringFacts(player: IPlayer, space: Space): Array<BoardFact> {
  const board = player.game.board;
  const out: Array<BoardFact> = [];
  const ownerColor = space.player?.color ?? space.coOwner?.color;
  if (Board.isGreenerySpace(space) && ownerColor !== undefined) {
    out.push(vpFact('score-greenery', 'city-greenery-scoring', 'Greenery scores at game end', recipientFor(player, ownerColor), 0, 1, '+1 VP at game end for its owner.'));
  }
  if (Board.isCitySpace(space) && ownerColor !== undefined) {
    const greeneries = board.getAdjacentSpaces(space).filter(Board.isGreenerySpace).length;
    out.push(cityScoringFact('score-city', recipientFor(player, ownerColor), greeneries, false));
  }
  // Special-tile own scoring — shown SEPARATELY from (and in addition to) the
  // city-greenery rule above. Capital ALSO counts as a city, so it gets BOTH.
  const tt = space.tile?.tileType;
  if (ownerColor !== undefined) {
    out.push(...specialTileAdjacencyVpFacts(board, space, tt, recipientFor(player, ownerColor), 'score'));
  }
  // Neural Instance (MarsBot's Local Neural Instance): +1 VP per adjacent space
  // NOT occupied by the human — i.e. empty or holding a MarsBot tile — at game
  // end (mirrors AutomaScoring). Its placement rule forbids reserved neighbors,
  // so the empty/bot-tile reading is total.
  if (tt === TileType.NEURAL_INSTANCE && ownerColor !== undefined) {
    const unoccupied = board.getAdjacentSpaces(space)
      .filter((adj) => adj.tile === undefined || adj.player?.color === ownerColor)
      .length;
    out.push(adjacencyVpFact('score-neural-instance', recipientFor(player, ownerColor), unoccupied,
      'Neural Instance scores for unoccupied neighbors',
      'Scores +1 VP for MarsBot per adjacent space you do not occupy (empty or a MarsBot tile) at game end.',
      'No qualifying adjacent spaces yet.'));
  }
  return out;
}

/**
 * A special tile's OWN adjacency-based endgame VP — Capital scores per adjacent
 * OCEAN, Commercial District per adjacent CITY (`victoryPoints: {oceans|cities,
 * nextToThis}` on those cards). Shared by the hover ("what this tile scores") and
 * the placement preview ("what it WILL score here"), so the two can never drift:
 * before this existed, hovering a placed Capital explained its ocean VP but the
 * preview that decided WHERE to put it said nothing.
 */
function specialTileAdjacencyVpFacts(
  board: Board,
  space: Space,
  tileType: TileType | undefined,
  recipient: BoardFactRecipient,
  idPrefix: 'score' | 'place'): Array<BoardFact> {
  const future = idPrefix === 'place';
  if (tileType === TileType.CAPITAL) {
    const oceans = board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
    return [adjacencyVpFact(`${idPrefix}-capital`, recipient, oceans,
      future ? 'Capital will score for adjacent oceans' : 'Capital scores for adjacent oceans',
      future ?
        'Scores +1 VP per adjacent ocean at game end (including oceans placed next to it later).' :
        'Scores +1 VP per adjacent ocean at game end.',
      'No adjacent oceans yet.')];
  }
  if (tileType === TileType.COMMERCIAL_DISTRICT) {
    const cities = board.getAdjacentSpaces(space).filter(Board.isCitySpace).length;
    return [adjacencyVpFact(`${idPrefix}-commercial`, recipient, cities,
      future ? 'Commercial District will score for adjacent cities' : 'Commercial District scores for adjacent cities',
      future ?
        'Scores +1 VP per adjacent city at game end (any player\'s, including cities placed next to it later).' :
        'Scores +1 VP per adjacent city at game end.',
      'No adjacent cities yet.')];
  }
  return [];
}

/** A generic "+N VP per adjacent X" endgame fact (no +0 badge when the count is 0). */
function adjacencyVpFact(id: string, recipient: BoardFactRecipient, count: number, title: string, descWith: string, descNone: string): BoardFact {
  if (count > 0) {
    return vpFact(id, 'future-scoring', title, recipient, 0, count, descWith);
  }
  return {id, category: 'future-scoring', timing: 'endgame', severity: 'info', recipient, title, description: descNone};
}

/**
 * One city-scoring fact, recipient-aware. With ≥1 adjacent greenery it shows the
 * `+N VP` endgame badge; with NONE it shows an honest count line — NEVER a "+0 VP"
 * reward chip (which reads as a null bonus).
 */
function cityScoringFact(id: string, recipient: BoardFactRecipient, greeneries: number, future: boolean): BoardFact {
  const title = future ? 'City will score for adjacent greeneries' : 'City scores for adjacent greeneries';
  if (greeneries > 0) {
    return vpFact(id, 'city-greenery-scoring', title, recipient, 0, greeneries,
      future ?
        'Scores +1 VP per adjacent greenery at game end (and any placed next to it later).' :
        'Scores +1 VP per adjacent greenery at game end.');
  }
  return {
    id,
    category: 'city-greenery-scoring',
    timing: 'endgame',
    severity: 'info',
    recipient,
    title,
    description: 'No adjacent greeneries yet.',
  };
}

/**
 * For a PLACEMENT preview: the endgame VP this placement creates, and for whom.
 * `tileType` (when known) identifies a COMPOSITE tile whose scoring its placement
 * `kind` can't convey — an `upgradeable-ocean` placement is Ocean City (counts as
 * a CITY → scores for adjacent greeneries) OR Ocean Farm / Ocean Sanctuary (do
 * not). New Holland (its own kind) likewise counts as a city.
 */
function placementScoringFacts(player: IPlayer, space: Space, ctx: PlacementPreviewContext): Array<BoardFact> {
  const board = player.game.board;
  const out: Array<BoardFact> = [];
  // Scoring follows what the tile COUNTS AS, derived from the real tile identity
  // (the eligibility kind can't tell Ocean City from Ocean Farm, nor a greenery
  // placed on an ocean cell / a city placed on an isolated cell from the plain
  // kind). `previewContext` resolves the exact tile; the `*_TILES` sets say what
  // it counts as. A composite over-ocean tile that counts as a CITY scores for
  // adjacent greeneries exactly like a city.
  const {countsAsCity, countsAsGreenery} = ctx;
  // The tile's OWN adjacency VP (Capital / Commercial District) — the same rule
  // the hover shows for an already-placed one.
  out.push(...specialTileAdjacencyVpFacts(board, space, ctx.tileType, {kind: 'current-player'}, 'place'));
  if (countsAsCity) {
    const greeneries = board.getAdjacentSpaces(space).filter(Board.isGreenerySpace).length;
    out.push(cityScoringFact('place-city', {kind: 'current-player'}, greeneries, true));
  }
  if (countsAsGreenery) {
    // The greenery itself scores +1 VP for the placing player. NO description:
    // the title, the `+1 VP` badge and the "At game end" section heading already
    // said it three times over.
    out.push(vpFact('place-greenery-self', 'city-greenery-scoring', 'Greenery scores at game end', {kind: 'current-player'}, 0, 1));
    // Each adjacent city scores +1 more for ITS owner — possibly an opponent.
    // The recipient GROUP names the owner, so a description repeating "for its
    // owner" adds nothing the layout doesn't carry.
    for (const adj of board.getAdjacentSpaces(space)) {
      if (Board.isCitySpace(adj)) {
        const ownerColor = adj.player?.color ?? adj.coOwner?.color;
        if (ownerColor !== undefined) {
          out.push(vpFact(
            `place-greenery-city-${adj.id}`,
            'city-greenery-scoring',
            'Adjacent city scores at game end',
            recipientFor(player, ownerColor),
            0, 1));
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Card-driven facts — the placing card + everyone's placement triggers
// ---------------------------------------------------------------------------

/** What the previewed placement will actually put down, resolved once. */
function previewContext(
  kind: BoardPlacementKind,
  tileType: TileType | undefined,
  cleared: boolean,
  covering: boolean,
  placementEffect: PlacementEffect = 'tile'): PlacementPreviewContext {
  const placesTile = placementEffect === 'tile';
  const tile = placesTile ? placedTileType(kind, tileType) : undefined;
  return {
    kind,
    tileType: tile,
    cleared,
    covering,
    countsAsCity: tile !== undefined && CITY_TILES.has(tile),
    countsAsOcean: tile !== undefined && OCEAN_TILES.has(tile),
    countsAsGreenery: tile !== undefined && GREENERY_TILES.has(tile),
    placesTile,
    grantsPlacementBonus: placementEffect !== 'marker',
  };
}

/**
 * The live card instance, so a hook sees the card's real state. A card being
 * PLAYED right now is not in the tableau yet (its `SelectSpace` runs inside
 * `play()`), so fall back to a fresh instance — every hook is a pure function of
 * (player, space, ctx), so a stateless copy answers identically.
 *
 * A STANDARD PROJECT is never in a tableau and lives in its own manifest, which
 * `newCard` does not search — the game's own (freshly instantiated, read-only)
 * project list is the way to reach its hook.
 */
function resolveCard(player: IPlayer, name: CardName): ICard | undefined {
  const owned = player.tableau.get(name);
  if (owned !== undefined) {
    return owned;
  }
  try {
    return newCard(name);
  } catch {
    return player.game.getStandardProjects().find((project) => project.name === name);
  }
}

/**
 * What the card DRIVING this placement does about this particular cell — Solar
 * Farm's energy production per plant bonus, Mining Area's steel-or-titanium
 * production. Read-only, co-located in the card (`ICard.placementPreview`).
 */
function sourceCardFacts(
  player: IPlayer,
  space: Space,
  sourceCard: CardName | undefined,
  ctx: PlacementPreviewContext): Array<BoardFact> {
  if (sourceCard === undefined) {
    return [];
  }
  const card = resolveCard(player, sourceCard);
  if (card === undefined) {
    return [];
  }
  return [
    ...placedTileAdjacencyFacts(player, card),
    ...(card.placementPreview?.(player, space, ctx) ?? []),
  ];
}

/**
 * What the tile ABOUT TO BE PLACED will hand to its future neighbours (Ares) —
 * derived GENERICALLY from the card's own declaration (`behavior.tile
 * .adjacencyBonus`, or the `Card.adjacencyBonus` property the bespoke placers
 * use), never a per-tile table. The mirror of `aresAdjacencySourceFacts`, which
 * says the same thing about a tile already on the board.
 *
 * It matters BEFORE placing: a Nuclear Zone taxes every future neighbour 2 M€
 * (including your own), and a bonus tile is worth more where you can still build
 * around it.
 */
function placedTileAdjacencyFacts(player: IPlayer, card: ICard): Array<BoardFact> {
  if (player.game.gameOptions.aresExtension !== true) {
    return [];
  }
  const adjacency = card.behavior?.tile?.adjacencyBonus ?? card.adjacencyBonus;
  if (adjacency === undefined) {
    return [];
  }
  const out: Array<BoardFact> = [];
  const concrete = adjacency.bonus.filter((b): b is SpaceBonus => b !== 'callback');
  for (const [bonus, count] of countBonuses(concrete)) {
    const d = describeSpaceBonus(bonus, count);
    if (d.delta === undefined) {
      continue;
    }
    out.push({
      id: `place-adj-${bonus}`,
      category: 'ares-adjacency-bonus',
      timing: 'rule',
      severity: 'positive',
      recipient: {kind: 'neutral'},
      title: 'Your tile will grant an adjacency bonus',
      description: 'Whoever places a tile next to it gains this — and you gain M€.',
      delta: d.delta,
      source: {type: 'card', id: card.name, label: card.name},
    });
  }
  const cost = adjacency.cost ?? 0;
  if (cost > 0) {
    out.push({
      id: 'place-adj-cost',
      category: 'ares-adjacency-bonus',
      timing: 'rule',
      severity: 'warning',
      recipient: {kind: 'neutral'},
      title: 'Your tile will impose an adjacency cost',
      description: 'Anyone placing a tile next to it — including you — pays extra M€.',
      delta: {icon: 'megacredits', amount: cost, direction: 'cost'},
      source: {type: 'card', id: card.name, label: card.name},
    });
  }
  return out;
}

/**
 * What EVERY player's tile-placement triggers pay out for this placement —
 * the read-only mirror of the `onTilePlaced` fan-out in `Game.addTile` (same
 * `tableau` walk, same generation order). This is the block that stops a
 * placement from quietly enriching an opponent: their Arctic Algae takes 2 plants
 * off your ocean, their Tharsis Republic takes M€ production off your city.
 *
 * Facts addressed to another player are classified into "Other players receive".
 */
function tileTriggerFacts(player: IPlayer, space: Space, ctx: PlacementPreviewContext): Array<BoardFact> {
  const out: Array<BoardFact> = [];
  for (const owner of player.game.playersInGenerationOrder) {
    for (const card of owner.tableau) {
      const facts = card.tilePlacedPreview?.(owner, player, space, ctx);
      if (facts !== undefined) {
        // Namespace by owner: two players holding the same card must not collide
        // on the fact id (the client keys its `v-for` on it).
        out.push(...facts.map((fact) => ({...fact, id: `${owner.color}-${fact.id}`})));
      }
    }
  }
  return out;
}

/**
 * Arcadian Communities' +3 M€ for building on an area you reserved with one of
 * its markers. It is granted by `Game.addTile` itself (not a card hook), keyed on
 * `space.player === player`, so it belongs to the engine — and it is purely
 * space-dependent, which makes it exactly the kind of thing the cell preview owes
 * the player.
 */
function arcadianCommunityFact(player: IPlayer, space: Space, covering: boolean, ctx: PlacementPreviewContext): Array<BoardFact> {
  // `Game.grantPlacementBonuses` gates the M€ on `space.tile !== undefined`, so
  // a marker move onto your own reserved area collects nothing.
  if (!ctx.placesTile || covering || space.player?.id !== player.id || !player.tableau.has(CardName.ARCADIAN_COMMUNITIES)) {
    return [];
  }
  const current = player.stock.megacredits;
  return [{
    id: 'arcadian-community',
    category: 'card-trigger',
    timing: 'immediate',
    severity: 'positive',
    recipient: {kind: 'current-player'},
    title: 'Your community area',
    description: 'Building on an area you reserved grants M€.',
    delta: {icon: 'megacredits', amount: 3, direction: 'gain', current, resulting: current + 3},
    source: {type: 'card', id: CardName.ARCADIAN_COMMUNITIES, label: CardName.ARCADIAN_COMMUNITIES},
  }];
}

// ---------------------------------------------------------------------------
// Milestone / award progress
// ---------------------------------------------------------------------------

/**
 * How this placement moves the player along the game's MILESTONES and AWARDS.
 *
 * The scores are read from the REAL `IMilestone.getScore` / `IAward.getScore`
 * implementations — nothing here re-implements "Mayor counts cities". To ask
 * them about a board that does not exist yet, {@link withHypotheticalTile}
 * installs the prospective tile on the space, reads, and restores the exact
 * fields it touched. That keeps the engine's purity contract (state is identical
 * before and after — guarded by the purity spec) while keeping the rule single-
 * sourced, which is the stronger invariant of the two.
 *
 * Only a milestone/award whose score actually MOVES is reported, and a milestone
 * that becomes claimable is called out — a placement that completes Mayor is
 * information the player wants before, not after.
 */
function milestoneAwardFacts(player: IPlayer, space: Space, ctx: PlacementPreviewContext): Array<BoardFact> {
  const game = player.game;
  if (ctx.tileType === undefined) {
    return [];
  }
  const out: Array<BoardFact> = [];
  const milestones = game.milestones.filter((m) => !game.milestoneClaimed(m));
  const before = {
    milestones: milestones.map((m) => m.getScore(player)),
    awards: game.awards.map((a) => a.getScore(player)),
  };
  const after = withHypotheticalTile(player, space, ctx, () => ({
    milestones: milestones.map((m) => m.getScore(player)),
    awards: game.awards.map((a) => a.getScore(player)),
  }));
  milestones.forEach((milestone, i) => {
    const from = before.milestones[i];
    const to = after.milestones[i];
    if (to <= from) {
      return;
    }
    const threshold = milestone.getThreshold?.(game) ?? (milestone as {threshold?: number}).threshold;
    const claimable = threshold !== undefined && from < threshold && to >= threshold;
    out.push({
      id: `milestone-${milestone.name}`,
      category: 'milestone-progress',
      timing: 'future',
      severity: claimable ? 'premium' : 'info',
      recipient: {kind: 'current-player'},
      title: milestone.name,
      // Only the CLAIMABLE case earns a line — "Milestone progress" under a
      // block already titled "Milestones and awards" is pure repetition, and the
      // `from → to / target` badge already states the progress.
      description: claimable ? 'This placement completes the milestone' : undefined,
      progress: {from, to, target: threshold},
    });
  });
  game.awards.forEach((award, i) => {
    const from = before.awards[i];
    const to = after.awards[i];
    if (to <= from) {
      return;
    }
    out.push({
      id: `award-${award.name}`,
      category: 'milestone-progress',
      timing: 'future',
      severity: 'info',
      recipient: {kind: 'current-player'},
      title: award.name,
      progress: {from, to},
    });
  });
  return out;
}

/**
 * Run `read` against the board as it WOULD look with the previewed tile in place,
 * then put the space back exactly as it was.
 *
 * This is the one place the engine touches a mutable field, and it is deliberate:
 * the alternative — hand-computing "which milestones a greenery advances" — would
 * duplicate every milestone's rule in a file that never merges with them. The
 * three fields written here are the same three `Game.simpleAddTile` writes, they
 * are captured before and restored in a `finally`, and NOTHING inside `read` is
 * allowed to mutate (milestone/award `getScore` are pure counts).
 */
function withHypotheticalTile<T>(player: IPlayer, space: Space, ctx: PlacementPreviewContext, read: () => T): T {
  const tile = ctx.tileType;
  if (tile === undefined) {
    return read();
  }
  const savedTile = space.tile;
  const savedPlayer = space.player;
  try {
    space.tile = {tileType: tile, covers: ctx.covering ? savedTile : undefined};
    // Mirrors `Game.simpleAddTile`: an ocean (and the two unowned special tiles)
    // belongs to nobody, so it must NOT count towards the placer's tile awards.
    space.player = UNOWNED_TILES.has(tile) ? undefined : player;
    return read();
  } finally {
    space.tile = savedTile;
    space.player = savedPlayer;
  }
}

/** Tile types `Game.simpleAddTile` leaves unowned (`space.player = undefined`). */
const UNOWNED_TILES: ReadonlySet<TileType> = new Set([
  TileType.OCEAN,
  TileType.MARTIAN_NATURE_WONDERS,
  TileType.REY_SKYWALKER,
]);

// ---------------------------------------------------------------------------
// Ares facts (adapted — inert when the module is off)
// ---------------------------------------------------------------------------

/**
 * Ares ADJACENCY + hazard-cleanup facts for an active PLACEMENT preview. Reads
 * each neighbour's GENERIC `space.adjacency` metadata (NOT a hardcoded "special
 * tile = source" rule), mirroring `AresHandler.earnAdjacencyBonus`:
 *   - `ares-adjacency-bonus` — what the PLACING player gains from an adjacent
 *     tile's `adjacency.bonus` (recipient `current-player`), and
 *   - `tile-owner-benefit` — the M€ the adjacent tile's OWNER earns when a tile is
 *     placed next to it (1, or 2 with Marketing Experts; recipient `tile-owner`).
 * When the placement COVERS a hazard, the cleanup TR REWARD is surfaced here
 * (the M€ cost already flows through `placementCostFacts`). Read-only.
 */
function aresAdjacencyFacts(player: IPlayer, space: Space): Array<BoardFact> {
  if (player.game.gameOptions.aresExtension !== true) {
    return [];
  }
  const board = player.game.board;
  const out: Array<BoardFact> = [];

  // Building on a hazard clears it → +N TR (cost is in placementCostFacts).
  if (isHazard(space)) {
    const steps = HAZARD_STEPS[hazardSeverity(space.tile?.tileType)];
    if (steps > 0) {
      out.push(gainFact('hazard-cleanup-tr', 'hazard-cleanup', 'Clears the hazard', {icon: 'tr', amount: steps, direction: 'gain'}));
    }
  }

  for (const adj of board.getAdjacentSpaces(space)) {
    const adjacency = adj.adjacency;
    if (adjacency === undefined || adjacency.bonus.length === 0) {
      continue;
    }
    const ownerColor = adj.player?.color;
    const tileLabel = adj.tile?.card ?? (adj.tile !== undefined ? tileTypeToString[adj.tile.tileType] : undefined);
    const src: BoardFact['source'] = {type: 'adjacent-tile', id: adj.id, label: tileLabel, ownerColor};

    // What the PLACING player gains (the adjacency bonus). 'callback' bonuses
    // (Crashlanding) are dynamic and out of scope — skip them.
    const concrete = adjacency.bonus.filter((b): b is SpaceBonus => b !== 'callback');
    for (const [bonus, count] of countBonuses(concrete)) {
      const d = describeSpaceBonus(bonus, count);
      if (d.delta === undefined) {
        continue;
      }
      out.push({
        id: `ares-adj-${adj.id}-${bonus}`,
        category: 'ares-adjacency-bonus',
        timing: 'immediate',
        severity: 'positive',
        recipient: {kind: 'current-player'},
        title: 'Adjacent tile bonus',
        delta: d.delta,
        source: src,
      });
    }

    // What the adjacent tile's OWNER gains (1 M€, or 2 with Marketing Experts).
    if (ownerColor !== undefined) {
      const ownerBonus = adj.player?.tableau.has(CardName.MARKETING_EXPERTS) === true ? 2 : 1;
      out.push({
        id: `ares-adj-owner-${adj.id}`,
        category: 'tile-owner-benefit',
        timing: 'immediate',
        severity: 'positive',
        recipient: recipientFor(player, ownerColor),
        title: 'Tile owner gains M€',
        delta: {icon: 'megacredits', amount: ownerBonus, direction: 'gain'},
        source: src,
      });
    }
  }
  return out;
}

/**
 * HOVER facts for a tile that IS an Ares adjacency SOURCE — what a tile placed
 * next to it earns (the adjacency bonus) and what its OWNER earns (1/2 M€). The
 * mirror of `aresAdjacencyFacts` (which is the placer's view during placement);
 * here the source tile explains itself on hover. Read-only, aresExtension-gated.
 */
function aresAdjacencySourceFacts(player: IPlayer, space: Space): Array<BoardFact> {
  if (player.game.gameOptions.aresExtension !== true) {
    return [];
  }
  const adjacency = space.adjacency;
  if (adjacency === undefined) {
    return [];
  }
  const out: Array<BoardFact> = [];
  const concrete = adjacency.bonus.filter((b): b is SpaceBonus => b !== 'callback');
  // A neighbour earns the adjacency bonus + the OWNER earns M€ — but ONLY when
  // there is a bonus (mirrors `AresHandler.earnAdjacencyBonus`, which skips an
  // empty bonus, so a cost-only tile like Nuclear Zone pays its owner nothing).
  if (concrete.length > 0) {
    for (const [bonus, count] of countBonuses(concrete)) {
      const d = describeSpaceBonus(bonus, count);
      if (d.delta === undefined) {
        continue;
      }
      out.push({
        id: `ares-src-${bonus}`,
        category: 'ares-adjacency-bonus',
        timing: 'rule',
        severity: 'positive',
        recipient: {kind: 'neutral'},
        title: 'Bonus to an adjacent tile',
        description: 'Granted to whoever places a tile next to this.',
        delta: d.delta,
      });
    }
    const ownerColor = space.player?.color;
    if (ownerColor !== undefined) {
      const ownerBonus = space.player?.tableau.has(CardName.MARKETING_EXPERTS) === true ? 2 : 1;
      out.push({
        id: 'ares-src-owner',
        category: 'tile-owner-benefit',
        timing: 'rule',
        severity: 'positive',
        recipient: recipientFor(player, ownerColor),
        title: 'Bonus to the owner',
        description: 'The owner gains M€ when a tile is placed next to this.',
        delta: {icon: 'megacredits', amount: ownerBonus, direction: 'gain'},
      });
    }
  }
  // A neighbour PAYS extra to place next to this (Nuclear Zone: adjacency.cost).
  const adjacencyCost = adjacency.cost ?? 0;
  if (adjacencyCost > 0) {
    out.push({
      id: 'ares-src-cost',
      category: 'ares-adjacency-bonus',
      timing: 'rule',
      severity: 'warning',
      recipient: {kind: 'neutral'},
      title: 'Adjacency cost',
      description: 'Placing a tile next to this costs extra M€.',
      delta: {icon: 'megacredits', amount: adjacencyCost, direction: 'cost'},
    });
  }
  return out;
}

/** Whether a hazard tile (dust storm / erosion) occupies the cell. */
function isHazard(space: Space): boolean {
  return space.tile !== undefined && HAZARD_TILES.has(space.tile.tileType);
}

/**
 * Hover facts for a hazard cell: identity (erosion / dust storm), how building
 * here clears it (+N TR, − M€ cleanup cost), and the adjacent-placement
 * production penalty. The M€ cost reuses the REAL `placementCostInfo` source.
 */
function hazardHoverFacts(player: IPlayer, space: Space): Array<BoardFact> {
  const tt = space.tile?.tileType;
  const severe = tt === TileType.EROSION_SEVERE || tt === TileType.DUST_STORM_SEVERE;
  const erosion = tt === TileType.EROSION_MILD || tt === TileType.EROSION_SEVERE;
  const steps = HAZARD_STEPS[hazardSeverity(tt)];
  const cleanupCost = player.game.board.placementCostInfo(player, space).megacredits;
  const out: Array<BoardFact> = [];

  out.push({
    id: 'hazard-identity',
    category: 'hazard-penalty',
    timing: 'rule',
    severity: 'warning',
    recipient: {kind: 'neutral'},
    title: erosion ? 'Erosion' : 'Dust storm',
    description: severe ? 'A severe hazard zone.' : 'A hazard zone.',
  });
  out.push({
    id: 'hazard-cleanup-reward',
    category: 'hazard-cleanup',
    timing: 'rule',
    severity: 'positive',
    recipient: {kind: 'current-player'},
    title: 'Build here to clear it',
    description: 'Building a tile here removes the hazard.',
    delta: {icon: 'tr', amount: steps, direction: 'gain'},
  });
  // The build cost (hazard cleanup + any adjacency surcharge) — broken down when
  // composed, so a price changed by an adjacent Nuclear Zone is explained.
  out.push(...megacreditCostFacts(player, space, cleanupCost, 'hazard-cleanup', true));
  out.push({
    id: 'hazard-adjacency',
    category: 'hazard-penalty',
    timing: 'rule',
    severity: 'warning',
    recipient: {kind: 'neutral'},
    title: 'Placing adjacent costs production',
    description: severe ?
      'Placing a tile next to this hazard costs 2 production of your choice.' :
      'Placing a tile next to this hazard costs 1 production of your choice.',
  });
  return out;
}

// ---------------------------------------------------------------------------
// Hollandia Asteroid Deflection Zone — plant-destruction protection
// ---------------------------------------------------------------------------
// Mirrors the REAL rule (`Game.ts` sets `player.withinDeflectionZone`, consumed by
// `Player.plantsAreProtected`): a player is protected from plant destruction while
// ALL their owned tiles are inside the zone.

function deflectionCounts(p: IPlayer): {inside: number, outside: number} {
  let inside = 0;
  let outside = 0;
  for (const space of p.game.board.spaces) {
    if (!Board.spaceOwnedBy(space, p)) {
      continue;
    }
    if (space.spaceType === SpaceType.DEFLECTION_ZONE) {
      inside++;
    } else {
      outside++;
    }
  }
  return {inside, outside};
}

function deflectionStatusOf(p: IPlayer): ZonePlayerProtection['status'] {
  const {inside, outside} = deflectionCounts(p);
  if (inside > 0 && outside === 0) {
    return 'active';
  }
  if (inside === 0) {
    return 'inactive-no-zone-tiles';
  }
  return 'inactive-has-tiles-outside';
}

/** Per-player deflection-zone protection status, the viewing player first. */
function buildZoneProtection(player: IPlayer): ZoneProtection {
  const players = [...player.game.players];
  players.sort((a, b) => (a.id === player.id ? -1 : b.id === player.id ? 1 : 0));
  const statuses: Array<ZonePlayerProtection> = players.map((p) => ({color: p.color, status: deflectionStatusOf(p)}));
  return {zoneName: 'Deflection Zone', statuses};
}

/** The impact of placing on `space` on the CURRENT player's deflection protection. */
function deflectionPlacementFact(player: IPlayer, space: Space): BoardFact | undefined {
  if (space.spaceType === SpaceType.DEFLECTION_ZONE) {
    const {inside, outside} = deflectionCounts(player);
    if (outside > 0) {
      return zoneImpact('warning', 'Plant protection will not be restored — you have tiles outside the zone.');
    }
    if (inside > 0) {
      return zoneImpact('rule', 'Keeps your protection from plant destruction.');
    }
    return zoneImpact('rule', 'Activates protection from plant destruction (while all your tiles stay in the zone).');
  }
  // Placing OUTSIDE the zone while currently protected by it loses the protection.
  if (player.withinDeflectionZone === true) {
    return zoneImpact('warning', 'Disables your protection from plant destruction (a tile outside the zone).');
  }
  return undefined;
}

function zoneImpact(timing: 'warning' | 'rule', description: string): BoardFact {
  return {
    id: 'deflection-impact',
    category: 'map-special-zone',
    timing,
    severity: timing === 'warning' ? 'warning' : 'info',
    recipient: {kind: 'current-player'},
    title: 'Deflection Zone',
    description,
  };
}

// ---------------------------------------------------------------------------
// Placement cost
// ---------------------------------------------------------------------------

// Per-step hazard cleanup M€ (mild = 1 step = 8 M€, severe = 2 steps = 16 M€).
// Mirrors Board.computeAdditionalCosts.
const HAZARD_MEGACREDITS_PER_STEP = 8;

/**
 * Whether Ares placement costs are charged at all right now — the module is on
 * AND the solar phase isn't waiving them (WGT places its tiles for free). The
 * breakdown must not attribute a cost the commit path never charges.
 */
function aresCostsApply(player: IPlayer): boolean {
  return player.game.gameOptions.aresExtension === true && !AresHandler.placementCostsWaived(player.game);
}

type McCostFactor = {id: string, kind: 'cleanup' | 'adjacency' | 'base', amount: number, cardName?: string};

/**
 * Decompose the M€ placement cost into its explainable factors — hazard cleanup
 * (placing ON a hazard), each adjacent tile's surcharge (Nuclear Zone), and the
 * printed cell cost — so the player sees WHY the price differs from the base. The
 * TOTAL is authoritative (`placementCostInfo`); `base` is the reconciling remainder,
 * so the factors always sum to the total. Generic: works for ANY adjacency-cost tile.
 */
function megacreditCostFactors(player: IPlayer, space: Space, total: number): ReadonlyArray<McCostFactor> {
  const board = player.game.board;
  const factors: Array<McCostFactor> = [];
  // Both factor kinds are ARES costs — attribute neither when Ares isn't
  // charging (module off / solar phase), else the remainder-based `base` would
  // mislabel an ordinary printed cell cost as "Cleanup cost".
  const ares = aresCostsApply(player);
  const cleanupSteps = ares ? HAZARD_STEPS[hazardSeverity(space.tile?.tileType)] : 0;
  if (cleanupSteps > 0) {
    factors.push({id: 'mc-cleanup', kind: 'cleanup', amount: cleanupSteps * HAZARD_MEGACREDITS_PER_STEP});
  }
  for (const adj of board.getAdjacentSpaces(space)) {
    const adjCost = ares ? (adj.adjacency?.cost ?? 0) : 0;
    if (adjCost > 0) {
      const cardName = adj.tile?.card !== undefined ?
        baseCardName(adj.tile.card) :
        (adj.tile !== undefined ? tileTypeToString[adj.tile.tileType] : undefined);
      factors.push({id: `mc-adj-${adj.id}`, kind: 'adjacency', amount: adjCost, cardName});
    }
  }
  const accounted = factors.reduce((sum, f) => sum + f.amount, 0);
  const base = total - accounted;
  if (base > 0) {
    factors.unshift({id: 'mc-base', kind: 'base', amount: base});
  }
  return factors;
}

function mcFactorTitle(f: McCostFactor): string {
  switch (f.kind) {
  case 'cleanup': return 'Cleanup cost';
  case 'adjacency': return f.cardName ?? 'Adjacent tile';
  case 'base': return 'Placement cost';
  }
}

/**
 * The M€ placement cost as premium facts: a SINGLE labelled line when one factor
 * makes up the price, else a "Total placement cost" header + the contributing
 * factors — so a price bumped by an adjacent Nuclear Zone / a hazard cleanup is
 * EXPLAINED, not silently shown. `category` lets the same breakdown render in the
 * placement-preview cost section OR the hover hazard section.
 */
function megacreditCostFacts(player: IPlayer, space: Space, total: number, category: BoardFact['category'], affordable: boolean): Array<BoardFact> {
  if (total <= 0) {
    return [];
  }
  const factors = megacreditCostFactors(player, space, total);
  const headSeverity = affordable ? 'warning' : 'danger';
  if (factors.length <= 1) {
    const f = factors[0];
    return [{
      id: 'cost-mc',
      category,
      timing: 'cost',
      severity: headSeverity,
      recipient: {kind: 'current-player'},
      title: f === undefined ? 'Placement cost' : mcFactorTitle(f),
      description: f?.kind === 'adjacency' ? 'Adjacency cost' : undefined,
      delta: {icon: 'megacredits', amount: total, direction: 'cost'},
      source: {type: 'map-rule', label: 'Placement cost'},
    }];
  }
  const out: Array<BoardFact> = [{
    id: 'cost-mc-total',
    category,
    timing: 'cost',
    severity: headSeverity,
    recipient: {kind: 'current-player'},
    title: 'Total placement cost',
    description: 'Adjusted by the factors below.',
    delta: {icon: 'megacredits', amount: total, direction: 'cost'},
    source: {type: 'map-rule', label: 'Placement cost'},
  }];
  for (const f of factors) {
    out.push({
      id: f.id,
      category,
      timing: 'cost',
      severity: 'info',
      recipient: {kind: 'current-player'},
      title: mcFactorTitle(f),
      description: f.kind === 'adjacency' ? 'Adjacency cost' : undefined,
      delta: {icon: 'megacredits', amount: f.amount, direction: 'cost'},
    });
  }
  return out;
}

/**
 * The «why is it this much» line under the forced production loss.
 *
 * The old copy said "reduce ONE production of your choice", which was simply
 * false on any cell touching two hazards or a single severe one — the exact
 * surprise this preview exists to prevent. It now names the COUNT and the RATE,
 * and the mixed case names BOTH rates instead of averaging them into a lie.
 *
 * The count is rendered as `hazards: N` / `×N` rather than a counted noun on
 * purpose: a substituted `${0}` carries no Russian plural agreement, and this
 * text has to render 1..6 zones.
 */
function hazardAdjacencyBreakdown(
  hazards: {mild: number, severe: number} | undefined): {description: string, params: ReadonlyArray<string>} {
  if (hazards === undefined || hazards.mild + hazards.severe === 0) {
    // Defensive: a production cost with no hazard behind it can only come from a
    // future rule, so say the one thing that is still certainly true.
    return {description: 'Your choice of production.', params: []};
  }
  if (hazards.mild > 0 && hazards.severe > 0) {
    return {
      description: 'Your choice · mild ×${0} (−1), severe ×${1} (−2)',
      params: [String(hazards.mild), String(hazards.severe)],
    };
  }
  // Uniform severity — the rate comes from WHICH severity is present, never from
  // dividing the total (a future board-specific production cost would skew that).
  return {
    description: 'Your choice · adjacent hazards: ${0}, −${1} each',
    params: [String(hazards.mild + hazards.severe), hazards.severe > 0 ? '2' : '1'],
  };
}

/**
 * `tileType` is what makes the cost HONEST: the hazard-adjacency production
 * penalty is waived for an OCEAN tile and for Athena's owner, exactly as
 * `Game.addTile` will charge it (both read the shared
 * `AresHandler.subjectToHazardAdjacency` predicate).
 */
function placementCostFacts(player: IPlayer, space: Space, tileType: TileType | undefined): Array<BoardFact> {
  const info = player.game.board.placementCostInfo(player, space, {tileType});
  const out: Array<BoardFact> = [];
  out.push(...megacreditCostFacts(player, space, info.megacredits, 'placement-cost', info.affordable));
  if (info.production > 0) {
    // A FORCED negative: placing next to a hazard makes you reduce production.
    // The TOTAL rides the same premium chip every gain on this panel uses (red,
    // because the row's severity is danger) so the Ares penalty stops reading in
    // a different language than the rest of the board; the line under it carries
    // the WHY the chip can't: how many hazards touch this cell and what each one
    // charges.
    out.push({
      id: 'cost-production',
      category: 'placement-penalty',
      timing: 'cost',
      severity: 'danger',
      recipient: {kind: 'current-player'},
      title: 'Reduce production',
      ...hazardAdjacencyBreakdown(info.hazardAdjacency),
      // No icon: the player picks WHICH production to lose, so there is no one
      // resource sprite that would be honest here.
      delta: {icon: '', amount: info.production, direction: 'cost'},
      source: {type: 'map-rule', label: 'Hazard adjacency'},
    });
  }
  if (!info.affordable && info.deficit > 0) {
    out.push({
      id: 'cost-deficit',
      category: 'placement-cost',
      timing: 'warning',
      severity: 'danger',
      recipient: {kind: 'current-player'},
      title: 'Cannot afford the placement cost',
      // The chip carries the shortfall; "you need more M€" only said the title.
      delta: {icon: 'megacredits', amount: info.deficit, direction: 'cost'},
      source: {type: 'map-rule', label: 'Placement cost'},
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fact classification → BoardPlacementPreview groups
// ---------------------------------------------------------------------------

/**
 * Drop the card-attribution tag when it only repeats the prompt. The panel's
 * title already reads "Select space for the «Solar Farm» tile", so tagging that
 * card's own facts with "Solar Farm" printed the same name three times on one
 * screen. The tag stays where it EARNS its space: another player's trigger, a
 * corporation, a card that is not the one being placed.
 */
function stripRedundantSource(facts: ReadonlyArray<BoardFact>, sourceCard: CardName | undefined): ReadonlyArray<BoardFact> {
  if (sourceCard === undefined) {
    return facts;
  }
  return facts.map((fact) =>
    (fact.source?.type === 'card' && fact.source.id === sourceCard) ?
      {...fact, source: undefined} :
      fact);
}

function classifyPlacementFacts(
  facts: ReadonlyArray<BoardFact>,
  player: IPlayer,
  spaceId: string,
  kind: BoardPlacementKind,
  legal: boolean): BoardPlacementPreview {
  const preview: BoardPlacementPreview = {
    space: spaceId as BoardPlacementPreview['space'],
    kind,
    legal,
    costFacts: [],
    immediateFacts: [],
    recipientFacts: [],
    warningFacts: [],
    futureScoringFacts: [],
    ruleFacts: [],
    progressFacts: [],
  };
  for (const fact of facts) {
    const isOther = (fact.recipient.kind === 'player' || fact.recipient.kind === 'tile-owner') &&
      fact.recipient.color !== player.color;
    // Milestone / award progress is its own block — it is neither an immediate
    // gain nor endgame scoring, and burying it in either misreads the timing.
    if (fact.category === 'milestone-progress') {
      (preview.progressFacts as Array<BoardFact>).push(fact);
    } else if (fact.timing === 'cost') {
      (preview.costFacts as Array<BoardFact>).push(fact);
    } else if (fact.timing === 'warning' || fact.severity === 'danger') {
      (preview.warningFacts as Array<BoardFact>).push(fact);
    } else if (isOther) {
      (preview.recipientFacts as Array<BoardFact>).push(fact);
    } else if (fact.timing === 'rule' || fact.recipient.kind === 'neutral' || fact.recipient.kind === 'nobody') {
      (preview.ruleFacts as Array<BoardFact>).push(fact);
    } else if (fact.timing === 'endgame' || fact.timing === 'future') {
      (preview.futureScoringFacts as Array<BoardFact>).push(fact);
    } else {
      (preview.immediateFacts as Array<BoardFact>).push(fact);
    }
  }
  return preview;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * The TileType this placement will actually put down: the caller's concrete
 * tile when it knows it (`SelectSpace.tileType` — a composite over-ocean tile,
 * a card's special tile), else the kind's own canonical tile.
 *
 * Only OCEAN changes any cost rule, so the kinds whose tile is card-specific
 * ('land' / 'isolated' / 'volcanic' / the upgradeable-ocean pair, which place
 * Ocean City / Ocean Farm / … — NOT an ocean) resolve to undefined = the
 * charged default. Never guess an OCEAN we aren't sure about: that would
 * under-report the cost.
 */
function placedTileType(kind: BoardPlacementKind, tileType: TileType | undefined): TileType | undefined {
  if (tileType !== undefined) {
    return tileType;
  }
  switch (kind) {
  case 'ocean': return TileType.OCEAN;
  case 'greenery': return TileType.GREENERY;
  case 'city':
  case 'away-from-cities': return TileType.CITY;
  default: return undefined;
  }
}

function legalSpacesForKind(player: IPlayer, kind: BoardPlacementKind): ReadonlyArray<Space> {
  try {
    return player.game.board.getAvailableSpacesForType(player, kind as PlacementType);
  } catch {
    return [];
  }
}

function isPlaceable(space: Space): boolean {
  return space.tile === undefined &&
    space.spaceType !== SpaceType.COLONY &&
    space.spaceType !== SpaceType.RESTRICTED;
}

function recipientFor(player: IPlayer, ownerColor: Color): BoardFactRecipient {
  return ownerColor === player.color ? {kind: 'current-player'} : {kind: 'tile-owner', color: ownerColor};
}

function rule(id: string, category: BoardFact['category'], title: string, description: string, recipient: 'neutral' | 'nobody'): BoardFact {
  return {id, category, timing: 'rule', severity: 'info', recipient: {kind: recipient}, title, description};
}

function gainFact(id: string, category: BoardFact['category'], title: string, delta: BoardFactDelta): BoardFact {
  return {id, category, timing: 'immediate', severity: 'positive', recipient: {kind: 'current-player'}, title, delta};
}

function vpFact(
  id: string,
  category: BoardFact['category'],
  title: string,
  recipient: BoardFactRecipient,
  from: number,
  to: number,
  /** Omit when the title + the `VP` badge + the block heading already say it. */
  description?: string): BoardFact {
  return {
    id,
    category,
    timing: 'endgame',
    severity: recipient.kind === 'current-player' ? 'positive' : 'warning',
    recipient,
    title,
    description,
    vp: {from, to},
  };
}
