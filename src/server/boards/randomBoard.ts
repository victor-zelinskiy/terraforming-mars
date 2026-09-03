import {BoardName} from '../../common/boards/BoardName';
import {RandomBoardOption} from '../../common/boards/RandomBoardOption';
import {AUTOMA_SUPPORTED_BOARDS} from '../../common/automa/automaCompatibility';

// Maps temporarily excluded from the "Random (all)" pool: their space bonuses are
// tied to expansions this fork hasn't adapted yet. Drop an entry once that map's
// expansion-linked bonuses are adapted. They are still selectable explicitly —
// only the random-all pool skips them.
const RANDOM_ALL_EXCLUSIONS: ReadonlyArray<BoardName> = [
  BoardName.VASTITAS_BOREALIS_NOVA,
  BoardName.ARABIA_TERRA,
];

/** Facts about the game being created that narrow a random pool. */
export type RandomBoardContext = {
  /** True for a game seating MarsBot — its pool is the boards it has an adaptation for. */
  automa?: boolean;
};

/** The concrete boards a request resolves to: the random-all pool, the 3 official ones, or a single explicit board. */
export function boardOptions(board: RandomBoardOption | BoardName, context: RandomBoardContext = {}): Array<BoardName> {
  const allBoards = Object.values(BoardName);

  let pool: Array<BoardName>;
  if (board === RandomBoardOption.ALL) {
    pool = allBoards.filter((name) => !RANDOM_ALL_EXCLUSIONS.includes(name));
  } else if (board === RandomBoardOption.OFFICIAL) {
    pool = allBoards.filter((name) =>
      name === BoardName.THARSIS ||
      name === BoardName.HELLAS ||
      name === BoardName.ELYSIUM);
  } else {
    return [board];
  }
  // MarsBot only draws boards it has a MarsBotMapProfile for — otherwise the
  // roll could land on a board `AutomaSetup.validateOptions` rejects and fail
  // the whole creation. An explicit pick is validated (and refused) as-is.
  if (context.automa === true) {
    pool = pool.filter((name) => AUTOMA_SUPPORTED_BOARDS.includes(name));
  }
  return pool;
}

export function isRandomBoardOption(board: RandomBoardOption | BoardName): board is RandomBoardOption {
  return board === RandomBoardOption.ALL || board === RandomBoardOption.OFFICIAL;
}

/** Picks one concrete board for the request (random when the request is a RandomBoardOption). */
export function chooseBoard(board: RandomBoardOption | BoardName, context: RandomBoardContext = {}): BoardName {
  const options = boardOptions(board, context);
  return options[Math.floor(Math.random() * options.length)];
}
