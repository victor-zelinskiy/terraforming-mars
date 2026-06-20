import {BoardName} from '../../common/boards/BoardName';
import {RandomBoardOption} from '../../common/boards/RandomBoardOption';

// Maps temporarily excluded from the "Random (all)" pool: their space bonuses are
// tied to expansions this fork hasn't adapted yet. Drop an entry once that map's
// expansion-linked bonuses are adapted. They are still selectable explicitly —
// only the random-all pool skips them.
const RANDOM_ALL_EXCLUSIONS: ReadonlyArray<BoardName> = [
  BoardName.VASTITAS_BOREALIS_NOVA,
  BoardName.ARABIA_TERRA,
];

/** The concrete boards a request resolves to: the random-all pool, the 3 official ones, or a single explicit board. */
export function boardOptions(board: RandomBoardOption | BoardName): Array<BoardName> {
  const allBoards = Object.values(BoardName);

  if (board === RandomBoardOption.ALL) {
    return allBoards.filter((name) => !RANDOM_ALL_EXCLUSIONS.includes(name));
  }
  if (board === RandomBoardOption.OFFICIAL) {
    return allBoards.filter((name) =>
      name === BoardName.THARSIS ||
      name === BoardName.HELLAS ||
      name === BoardName.ELYSIUM);
  }
  return [board];
}

export function isRandomBoardOption(board: RandomBoardOption | BoardName): board is RandomBoardOption {
  return board === RandomBoardOption.ALL || board === RandomBoardOption.OFFICIAL;
}

/** Picks one concrete board for the request (random when the request is a RandomBoardOption). */
export function chooseBoard(board: RandomBoardOption | BoardName): BoardName {
  const options = boardOptions(board);
  return options[Math.floor(Math.random() * options.length)];
}
