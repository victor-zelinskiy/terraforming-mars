import {IPlayer} from '../IPlayer';
import {Space} from './Space';
import {Board} from './Board';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {SpaceType} from '../../common/boards/SpaceType';
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

  if (Board.hasRealTile(space)) {
    // What's already here scores at endgame — show for whom.
    facts.push(...existingTileScoringFacts(player, space));
  } else if (isPlaceable(space)) {
    // An empty placeable cell: what placing ANY tile here would grant.
    facts.push(...printedBonusFacts(space, false));
    const ocean = oceanAdjacencyFact(player, space);
    if (ocean !== undefined) {
      facts.push(ocean);
    }
  }
  return {space: space.id, status, facts};
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
  const ocean = oceanAdjacencyFact(player, space);
  if (ocean !== undefined) {
    facts.push(ocean);
  }
  facts.push(...placementEffectFacts(player, kind));
  facts.push(...placementScoringFacts(player, space, kind));
  facts.push(...aresAdjacencyFacts(player, space));
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
  const board = player.game.board;
  if (space.id === player.game.nomadSpace) {
    return {content: 'special-tile', reserved: 'nomad', spaceTypeLabel: 'Mars Nomads camp'};
  }
  if (space.id === board.noctisCitySpaceId) {
    return {content: 'empty', reserved: 'noctis', spaceTypeLabel: 'Reserved for Noctis City'};
  }
  if (space.spaceType === SpaceType.COLONY) {
    return {content: 'empty', reserved: 'colony', spaceTypeLabel: 'Colony space'};
  }
  if (space.spaceType === SpaceType.RESTRICTED) {
    return {content: 'empty', reserved: 'restricted', spaceTypeLabel: 'Restricted area'};
  }
  if (space.tile !== undefined) {
    const ownerColor = space.player?.color ?? space.coOwner?.color;
    const tileLabel = space.tile.card;
    if (!Board.hasRealTile(space)) {
      return {content: 'hazard', spaceTypeLabel: spaceTypeLabel(space.spaceType)};
    }
    if (Board.isOceanSpace(space)) {
      return {content: 'ocean', ownerColor, tileLabel};
    }
    if (Board.isCitySpace(space)) {
      return {content: 'city', ownerColor, tileLabel};
    }
    if (Board.isGreenerySpace(space)) {
      return {content: 'greenery', ownerColor, tileLabel};
    }
    return {content: 'special-tile', ownerColor, tileLabel};
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
    out.push(rule('deflection-zone', 'map-special-zone', 'Deflection Zone', 'A special stretch of land on the Hollandia map. Tiles place here exactly as on normal land; these cells keep their fixed position even when the map is randomized.', 'neutral'));
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
    out.push(vpFact('score-city', 'city-greenery-scoring', 'City scores for adjacent greeneries', recipientFor(player, ownerColor), 0, greeneries, 'Scores +1 VP per adjacent greenery at game end (currently counted above).'));
  }
  return out;
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
    out.push(vpFact(
      'place-city',
      'city-greenery-scoring',
      'City will score for adjacent greeneries',
      {kind: 'current-player'},
      0, greeneries,
      'Scores +1 VP per adjacent greenery at game end (and for any greenery placed next to it later).'));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ares-ready extension point (NOT populated — Ares rules are out of scope)
// ---------------------------------------------------------------------------

/**
 * Where a future Ares adaptation surfaces ADJACENCY facts. Today returns no
 * facts. When Ares is adapted, read each neighbour's GENERIC `space.adjacency`
 * metadata (NOT a hardcoded "special tile = source" rule) and emit:
 *   - `ares-adjacency-bonus` for what the PLACING player gains from an adjacent
 *     Ares tile's `adjacency.bonus` (recipient `current-player`), and
 *   - `tile-owner-benefit` for the income the adjacent tile's OWNER earns when a
 *     tile is placed next to their Ares tile (recipient `tile-owner`, their colour).
 * The hazard PENALTY (cost) already flows through `placementCostFacts` →
 * `MarsBoard.placementCostInfo` → `Board.computeAdditionalCosts` (which handles
 * `aresExtension`); `hazard-cleanup` / `ocean-upgrade` facts would be added here too.
 */
function aresAdjacencyFacts(_player: IPlayer, _space: Space): Array<BoardFact> {
  // TODO(ares): populate from neighbour `space.adjacency` once Ares is in scope.
  return [];
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
