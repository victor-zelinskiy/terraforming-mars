import {IPlayer} from '../IPlayer';
import {Space} from './Space';
import {Board, isSpecialTile} from './Board';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {SpaceType} from '../../common/boards/SpaceType';
import {CITY_TILES, OCEAN_TILES, GREENERY_TILES, HAZARD_TILES, TileType, tileTypeToString} from '../../common/TileType';
import {HAZARD_STEPS, hazardSeverity} from '../../common/AresTileType';
import {CardName} from '../../common/cards/CardName';
import {PlacementType} from './PlacementType';
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
 * Ares-readiness: `space.adjacency` (a generic metadata field) is where a future
 * Ares adaptation adds `ares-adjacency-bonus` / `tile-owner-benefit` facts, and
 * the hazard cost already flows through `placementCostInfo`. No Ares facts are
 * produced today — Ares rules are out of scope.
 */

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Hover info for a cell — what IS here + the standing rules (no placement context). */
export function boardCellInfo(player: IPlayer, space: Space): BoardCellInfo {
  const facts: Array<BoardFact> = [];
  const status = cellStatus(player, space);

  // Standing special-zone / reserved / restricted rules.
  facts.push(...specialZoneFacts(player, space));

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

/** Active-placement preview — the consequences of placing `kind` on `space`. */
export function boardCellPreview(player: IPlayer, space: Space, kind: BoardPlacementKind): BoardPlacementPreview {
  const board = player.game.board;
  const legalSpaces = legalSpacesForKind(player, kind);
  const legal = legalSpaces.some((s) => s.id === space.id);
  const covering = Board.hasRealTile(space);

  const facts: Array<BoardFact> = [];
  facts.push(...placementCostFacts(player, space));
  facts.push(...printedBonusFacts(space, covering));
  facts.push(...placementEffectFacts(player, kind));
  // Adjacency-dependent facts (ocean M€ + city-greenery scoring) apply ONLY on
  // the Mars hex grid — an off-grid reserved slot scores 0 for adjacency.
  if (onMarsGrid(board, space)) {
    const ocean = oceanAdjacencyFact(player, space);
    if (ocean !== undefined) {
      facts.push(ocean);
    }
    facts.push(...placementScoringFacts(player, space, kind));
  }
  facts.push(...aresAdjacencyFacts(player, space));
  const deflection = deflectionPlacementFact(player, space);
  if (deflection !== undefined) {
    facts.push(deflection);
  }
  facts.push(...specialZoneFacts(player, space));

  const preview = classifyPlacementFacts(facts, player, space.id, kind, legal);
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
    if (space.spaceType === SpaceType.OCEAN) return 'Ocean area';
    if (space.spaceType === SpaceType.DEFLECTION_ZONE) return 'Deflection Zone';
    if (space.spaceType === SpaceType.COVE) return 'Cove';
    return hasPrintedBonus(space) ? 'Land with a bonus' : 'Empty land';
  }
}

function hasPrintedBonus(space: Space): boolean {
  return space.bonus.some((b) => b !== SpaceBonus._RESTRICTED);
}

/** What a tile counts AS for rules/scoring (a composite tile is several). */
function countsAsFor(tileType: TileType): Array<'city' | 'ocean' | 'greenery'> {
  const out: Array<'city' | 'ocean' | 'greenery'> = [];
  if (CITY_TILES.has(tileType)) out.push('city');
  if (OCEAN_TILES.has(tileType)) out.push('ocean');
  if (GREENERY_TILES.has(tileType)) out.push('greenery');
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
    const tileLabel = space.tile.card ?? (isSpecialTile(tileType) ? tileTypeToString[tileType] : undefined);
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

function specialZoneFacts(player: IPlayer, space: Space): Array<BoardFact> {
  const out: Array<BoardFact> = [];
  const board = player.game.board;
  if (space.id === board.noctisCitySpaceId) {
    out.push(rule('reserved-noctis', 'reserved-area', 'Reserved for Noctis City', 'This space is permanently reserved for the Noctis City card and cannot host any other tile.', 'nobody'));
  } else if (space.spaceType === SpaceType.COLONY) {
    out.push(rule('reserved-colony', 'reserved-area', 'Colony space', 'A reserved colony location — tiles cannot be placed here.', 'nobody'));
  } else if (space.spaceType === SpaceType.RESTRICTED) {
    out.push(rule('restricted', 'restriction', 'Restricted area', 'No tiles can ever be placed on this space.', 'nobody'));
  } else if (space.spaceType === SpaceType.DEFLECTION_ZONE) {
    // The REAL Hollandia rule (implemented via player.withinDeflectionZone /
    // plantsAreProtected): protection from plant destruction while ALL your tiles
    // are inside the zone. NOT a "fixed position on a random map" layout note.
    out.push(rule('deflection-zone', 'map-special-zone', 'Deflection Zone', 'Protects you from plant destruction while ALL your tiles are inside this zone.', 'neutral'));
  } else if (space.volcanic === true) {
    out.push(rule('volcanic', 'map-special-zone', 'Volcanic area', 'A volcanic space. Some cards may only place their tile on a volcanic space.', 'neutral'));
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
  case SpaceBonus.ENERGY_PRODUCTION: return {title: 'Cell bonus', deferred: false, delta: gain('energy', true), description: 'Production'};
  case SpaceBonus.MICROBE: return {title: 'Add to a card', deferred: true, delta: gain('microbe'), description: 'Added to a card you choose'};
  case SpaceBonus.ANIMAL: return {title: 'Add to a card', deferred: true, delta: gain('animal'), description: 'Added to a card you choose'};
  case SpaceBonus.DATA: return {title: 'Add to a card', deferred: true, delta: gain('data'), description: 'Added to a card you choose'};
  case SpaceBonus.SCIENCE: return {title: 'Add to a card', deferred: true, delta: gain('science'), description: 'Added to a card you choose'};
  case SpaceBonus.ASTEROID: return {title: 'Add to a card', deferred: true, delta: gain('asteroid'), description: 'Added to a card you choose'};
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
  const order: Array<SpaceBonus> = [];
  const counts = new Map<SpaceBonus, number>();
  for (const bonus of bonuses) {
    if (bonus === SpaceBonus._RESTRICTED) {
      continue;
    }
    if (!counts.has(bonus)) {
      order.push(bonus);
    }
    counts.set(bonus, (counts.get(bonus) ?? 0) + 1);
  }
  return order.map((bonus) => [bonus, counts.get(bonus)!] as [SpaceBonus, number]);
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
    description: oceans === 1 ? 'A tile placed next to an ocean grants M€.' : 'A tile placed next to oceans grants M€ per ocean.',
    delta: {icon: 'megacredits', amount: megacredits, direction: 'gain'},
    source: {type: 'global-rule', label: 'Ocean adjacency'},
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

function placementEffectFacts(player: IPlayer, kind: BoardPlacementKind): Array<BoardFact> {
  const game = player.game;
  const out: Array<BoardFact> = [];
  if (kind === 'greenery') {
    if (game.getOxygenLevel() < constants.MAX_OXYGEN_LEVEL) {
      out.push(gainFact('effect-oxygen', 'placement-effect', 'Raises oxygen', {icon: 'oxygen', amount: 1, direction: 'gain', unit: '%'}));
      out.push(gainFact('effect-tr-oxygen', 'placement-effect', 'Terraform rating', {icon: 'tr', amount: 1, direction: 'gain'}));
    }
  } else if (kind === 'ocean') {
    if (game.canAddOcean()) {
      out.push(gainFact('effect-ocean', 'placement-effect', 'Raises the ocean parameter', {icon: 'ocean', amount: 1, direction: 'gain'}));
      out.push(gainFact('effect-tr-ocean', 'placement-effect', 'Terraform rating', {icon: 'tr', amount: 1, direction: 'gain'}));
    }
  }
  return out;
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
  if (tt === TileType.CAPITAL && ownerColor !== undefined) {
    const oceans = board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
    out.push(adjacencyVpFact('score-capital', recipientFor(player, ownerColor), oceans,
      'Capital scores for adjacent oceans', 'Scores +1 VP per adjacent ocean at game end.', 'No adjacent oceans yet.'));
  }
  if (tt === TileType.COMMERCIAL_DISTRICT && ownerColor !== undefined) {
    const cities = board.getAdjacentSpaces(space).filter(Board.isCitySpace).length;
    out.push(adjacencyVpFact('score-commercial', recipientFor(player, ownerColor), cities,
      'Commercial District scores for adjacent cities', 'Scores +1 VP per adjacent city at game end.', 'No adjacent cities yet.'));
  }
  return out;
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

/** For a PLACEMENT preview: the endgame VP this placement creates, and for whom. */
function placementScoringFacts(player: IPlayer, space: Space, kind: BoardPlacementKind): Array<BoardFact> {
  const board = player.game.board;
  const out: Array<BoardFact> = [];
  if (kind === 'greenery') {
    // The greenery itself scores +1 VP for the placing player.
    out.push(vpFact('place-greenery-self', 'city-greenery-scoring', 'Greenery scores at game end', {kind: 'current-player'}, 0, 1, '+1 VP at game end.'));
    // Each adjacent city scores +1 more for ITS owner — possibly an opponent.
    for (const adj of board.getAdjacentSpaces(space)) {
      if (Board.isCitySpace(adj)) {
        const ownerColor = adj.player?.color ?? adj.coOwner?.color;
        if (ownerColor !== undefined) {
          out.push(vpFact(
            `place-greenery-city-${adj.id}`,
            'city-greenery-scoring',
            'Adjacent city scores at game end',
            recipientFor(player, ownerColor),
            0, 1,
            'The adjacent city scores +1 VP for its owner at game end.'));
        }
      }
    }
  } else if (kind === 'city') {
    const greeneries = board.getAdjacentSpaces(space).filter(Board.isGreenerySpace).length;
    out.push(cityScoringFact('place-city', {kind: 'current-player'}, greeneries, true));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ares-ready extension point (NOT populated — Ares rules are out of scope)
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
  if (cleanupCost > 0) {
    out.push({
      id: 'hazard-cleanup-cost',
      category: 'hazard-cleanup',
      timing: 'cost',
      severity: 'warning',
      recipient: {kind: 'current-player'},
      title: 'Cleanup cost',
      delta: {icon: 'megacredits', amount: cleanupCost, direction: 'cost'},
    });
  }
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

function placementCostFacts(player: IPlayer, space: Space): Array<BoardFact> {
  const info = player.game.board.placementCostInfo(player, space);
  const out: Array<BoardFact> = [];
  if (info.megacredits > 0) {
    out.push({
      id: 'cost-mc',
      category: 'placement-cost',
      timing: 'cost',
      severity: info.affordable ? 'warning' : 'danger',
      recipient: {kind: 'current-player'},
      title: 'Placement cost',
      delta: {icon: 'megacredits', amount: info.megacredits, direction: 'cost'},
      source: {type: 'map-rule', label: 'Placement cost'},
    });
  }
  if (info.production > 0) {
    out.push({
      id: 'cost-production',
      category: 'placement-penalty',
      timing: 'cost',
      severity: 'warning',
      recipient: {kind: 'current-player'},
      title: 'Production cost',
      description: 'Placing here costs production (adjacent hazard).',
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
      delta: {icon: 'megacredits', amount: info.deficit, direction: 'cost'},
      description: 'You need more M€ to place here.',
      source: {type: 'map-rule', label: 'Placement cost'},
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fact classification → BoardPlacementPreview groups
// ---------------------------------------------------------------------------

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
  };
  for (const fact of facts) {
    const isOther = (fact.recipient.kind === 'player' || fact.recipient.kind === 'tile-owner') &&
      fact.recipient.color !== player.color;
    if (fact.timing === 'cost') {
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
  description: string): BoardFact {
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
