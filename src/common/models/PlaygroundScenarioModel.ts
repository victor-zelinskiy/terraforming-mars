import {GameId, PlayerId} from '../Types';

/**
 * A LIVE SCENARIO of a «Полигон» stand: an engine-generated fixture booted as a
 * real game (`/api/dev/playground-scenario`). The name is the fixture's own
 * (`tests/e2e/fixtures/<name>.json`) and is whitelisted BY SHAPE — a
 * parliament fixture, lowercase words joined by dashes, nothing path-like.
 */
const PLAYGROUND_SCENARIO_PATTERN = /^parliament-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPlaygroundScenarioName(name: string): boolean {
  return PLAYGROUND_SCENARIO_PATTERN.test(name);
}

/** What the door answers: the booted game and the seat to open (the fixture's viewer — the first of the generation order). */
export type PlaygroundScenarioBoot = {
  gameId: GameId;
  playerId: PlayerId;
  /** Every seat, in the table's generation order. */
  seats: ReadonlyArray<PlayerId>;
};
