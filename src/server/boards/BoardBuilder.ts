import {Space} from './Space';
import {SpaceId, isSpaceId, safeCast} from '../../common/Types';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {SpaceName} from '../../common/boards/SpaceName';
import {SpaceType} from '../../common/boards/SpaceType';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';
import {GameOptions} from '../game/GameOptions';
import {expansionSpaceColonies} from '../../common/boards/expansionSpaceColonies';
import {CardName} from '../../common/cards/CardName';
import {Expansion} from '../../common/cards/GameModule';

function colonySpace(id: SpaceId): Space {
  return {id, spaceType: SpaceType.COLONY, x: -1, y: -1, bonus: []};
}

/**
 * THE SPACE COLONIES A GAME WITH THESE OPTIONS HAS beyond the two every board
 * carries (Ganymede, Phobos) — the cells of `expansionSpaceColonies` whose
 * expansion is on or whose card is included. ONE reading of the table: the
 * builder lays them down at setup and a LOAD asks the same question
 * (`restoreExpansionSpaceColonies`), so a game and its save cannot disagree
 * about which cells exist.
 */
function expansionSpaceColonyIds(gameOptions: GameOptions): Array<SpaceId> {
  const ids: Array<SpaceId> = [];
  for (const entry of expansionSpaceColonies) {
    // Special case for Venera Base when Pathfinders is included, but Turmoil or Venus is not
    if (entry.card === CardName.VENERA_BASE) {
      const pathfindersTurmoilVenusInPlay = gameOptions.pathfindersExpansion && gameOptions.turmoilExtension && gameOptions.venusNextExtension;
      if (gameOptions.includedCards.includes(entry.card) || pathfindersTurmoilVenusInPlay) {
        ids.push(entry.name);
      }
      continue;
    }
    // A row may name SEVERAL modules — the cell exists only where every one of them is on.
    const modules: ReadonlyArray<Expansion> = typeof entry.expansion === 'string' ? [entry.expansion] : entry.expansion;
    if (modules.every((module) => gameOptions.expansions[module]) || gameOptions.includedCards.includes(entry.card)) {
      ids.push(entry.name);
    }
  }
  return ids;
}

/**
 * A LOADED board's list of cells is the one that was SAVED
 * (`Board.deserialize`) — so a cell the table gained AFTER the save was made
 * (Turmoil Redux TR22 Nova City's) is missing from it, and the card that
 * places a tile there would throw on `getSpaceOrThrow`. This appends, in the
 * table's order, every expansion space colony the game's options call for
 * that the save does not carry: an empty off-board cell, exactly what the
 * builder would have laid at setup. A save that already has them is returned
 * untouched. Never a second list — the builder's own reading.
 */
export function restoreExpansionSpaceColonies(spaces: Array<Space>, gameOptions: GameOptions): Array<Space> {
  // A save older than the `expansions` record (or the included-cards list) cannot be asked
  // the builder's question at all — its board is restored exactly as it was saved.
  const legacy = gameOptions as Partial<GameOptions>;
  if (legacy.expansions === undefined || legacy.includedCards === undefined) {
    return spaces;
  }
  const present = new Set(spaces.map((space) => space.id));
  for (const id of expansionSpaceColonyIds(gameOptions)) {
    if (!present.has(id)) {
      spaces.push(colonySpace(id));
    }
  }
  return spaces;
}

export class BoardBuilder {
  // This builder assumes the map has nine rows, of tile counts [5,6,7,8,9,8,7,6,5].
  //
  // "Son I am able, " she said "though you scare me."
  // "Watch, " said I
  // "Beloved, " I said "watch me scare you though." said she,
  // "Able am I, Son."

  private spaceTypes: Array<SpaceType> = [];
  private bonuses: Array<Array<SpaceBonus>> = [];
  private spaces: Array<Space> = [];
  private unshufflableSpaces: Array<number> = [];
  private volcanicSpaces: Array<number> = [];
  private gameOptions: GameOptions;
  private rng: Random;

  constructor(gameOptions: GameOptions, rng: Random) {
    this.gameOptions = gameOptions;
    this.rng = rng;
  }

  ocean(...bonus: Array<SpaceBonus>): this {
    this.spaceTypes.push(SpaceType.OCEAN);
    this.bonuses.push(bonus);
    return this;
  }

  cove(...bonus: Array<SpaceBonus>): this {
    this.spaceTypes.push(SpaceType.COVE);
    this.bonuses.push(bonus);
    return this;
  }

  land(...bonus: Array<SpaceBonus>): this {
    this.spaceTypes.push(SpaceType.LAND);
    this.bonuses.push(bonus);
    return this;
  }

  volcanic(...bonus: Array<SpaceBonus>): this {
    this.spaceTypes.push(SpaceType.LAND);
    this.lastSpaceIsVolcanic();
    this.bonuses.push(bonus);
    return this;
  }

  lastSpaceIsVolcanic(): this {
    this.volcanicSpaces.push(this.spaceTypes.length - 1);
    return this;
  }

  restricted(): this {
    this.spaceTypes.push(SpaceType.RESTRICTED);
    this.bonuses.push([]);
    return this;
  }

  deflectionZone(...bonus: Array<SpaceBonus>): this {
    this.spaceTypes.push(SpaceType.DEFLECTION_ZONE);
    this.bonuses.push(bonus);
    return this.doNotShuffleLastSpace();
  }

  doNotShuffleLastSpace(): this {
    this.unshufflableSpaces.push(this.spaceTypes.length - 1);
    return this;
  }


  build(): Array<Space> {
    if (this.gameOptions.shuffleMapOption) {
      this.shuffle(this.rng);
    }

    this.spaces.push(colonySpace(SpaceName.GANYMEDE_COLONY));
    this.spaces.push(colonySpace(SpaceName.PHOBOS_SPACE_HAVEN));

    const tilesPerRow = [5, 6, 7, 8, 9, 8, 7, 6, 5];
    const idOffset = this.spaces.length + 1;
    let idx = 0;

    for (let row = 0; row < 9; row++) {
      const tilesInThisRow = tilesPerRow[row];
      const xOffset = 9 - tilesInThisRow;
      for (let i = 0; i < tilesInThisRow; i++) {
        const spaceId = idx + idOffset;
        const xCoordinate = xOffset + i;
        const space: Space = {
          id: BoardBuilder.spaceId(spaceId),
          spaceType: this.spaceTypes[idx],
          x: xCoordinate,
          y: row,
          bonus: this.bonuses[idx],
        };
        if (this.volcanicSpaces.includes(idx)) {
          space.volcanic = true;
        }
        this.spaces.push(space);
        idx++;
      }
    }

    // Include space colonies if the expansion is included, or if the card is included.
    for (const id of expansionSpaceColonyIds(this.gameOptions)) {
      this.spaces.push(colonySpace(id));
    }

    return this.spaces;
  }

  /*
  public shuffleArray(rng: Random, array: Array<unknown>): void {
    // Reversing the indexes so the elements are pulled from the right.
    // Reversing the result so elements are listed left to right.
    const spliced = this.unshufflableSpaces.reverse().map((idx) => array.splice(idx, 1)[0]).reverse();
    for (let i = array.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    for (let idx = 0; idx < this.unshufflableSpaces.length; idx++) {
      array.splice(this.unshufflableSpaces[idx], 0, spliced[idx]);
    }
  }
*/

  // Shuffle the ocean spaces and bonus spaces. But protect the land spaces supplied by
  // |lands| so that those IDs most definitely have land spaces.
  public shuffle(rng: Random) {
    const preservedSpaces = [...this.unshufflableSpaces, ...this.volcanicSpaces];
    preservedSpaces.sort((a, b) => a - b);
    preservingShuffle(this.spaceTypes, preservedSpaces, rng);
    preservingShuffle(this.bonuses, preservedSpaces, rng);
    return;
  }

  private static spaceId(id: number): SpaceId {
    let strId = id.toString();
    if (id < 10) {
      strId = '0'+strId;
    }
    return safeCast(strId, isSpaceId);
  }
}

export function preservingShuffle(array: Array<unknown>, preservedIndexes: ReadonlyArray<number>, rng: Random): void {
  // Reversing the indexes so the elements are pulled from the right.
  // Reversing the result so elements are listed left to right.
  const forward = [...preservedIndexes].sort((a, b) => a - b);
  const backward = [...forward].reverse();
  const spliced = backward.map((idx) => array.splice(idx, 1)[0]).reverse();
  inplaceShuffle(array, rng);
  for (let idx = 0; idx < forward.length; idx++) {
    array.splice(forward[idx], 0, spliced[idx]);
  }
}

