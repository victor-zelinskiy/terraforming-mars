import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {ParameterSwingDown, ParameterSwingUp} from '../../common/models/ParameterSwingModel';
import {ParameterMoveId} from '../../common/parliament/parameterMove';
import {Space} from '../boards/Space';
import {TileType} from '../../common/TileType';

/**
 * «UP AND BACK» — the one writer of the board scene's record
 * (`IGame.parameterSwings`, Turmoil Redux TR47 Ecological Experiment;
 * docs/TURMOIL_REDUX_ECOLOGICAL_EXPERIMENT.md).
 *
 * A card that raises the Mars parameters and then lowers what is not at its
 * maximum snapshots the planet BEFORE its raise (`snapshotParameters` in
 * `bespokePlayBefore`), reads it again once everything the raise set off has
 * resolved (the card's ocean, the 0 °C bonus ocean, the 8 % temperature
 * step — the PEAK), lowers through the engine's one function
 * (`Game.lowerParameters`) and the one removal step (`RemoveOceanTile`), and
 * then calls this with what it measured. The record carries the raise's
 * legs (`upLegs` — before → peak, the rating each paid, the thresholds it
 * claimed), the fall's (`Game.lowerParameters` returns them; the removal
 * adds the oceans'), the ocean removed and the rating the mover was left
 * with — so the client never infers «this was a swing» from a diff that may
 * be zero. Purely presentational: a restart loses the animation, never the rule.
 */

/** The planet and the mover as they stand at one moment — what the raise's legs are measured against. */
export type ParameterSnapshot = {
  temperature: number;
  oxygenLevel: number;
  oceans: number;
  terraformRating: number;
  /** The scale-bonus claim keys standing (`<scale>-<step>`). */
  claims: ReadonlyArray<string>;
};

export function snapshotParameters(game: IGame, player: IPlayer): ParameterSnapshot {
  return {
    temperature: game.getTemperature(),
    oxygenLevel: game.getOxygenLevel(),
    oceans: game.board.getOceanSpaces().length,
    terraformRating: player.terraformRating,
    claims: [...game.scaleBonusClaims.keys()],
  };
}

const STEP_SIZE: Readonly<Record<'temperature' | 'oxygen' | 'oceans', number>> = {temperature: 2, oxygen: 1, oceans: 1};
const SCALE_OF: Readonly<Record<'temperature' | 'oxygen' | 'oceans', 'temperature' | 'oxygen' | undefined>> = {
  temperature: 'temperature', oxygen: 'oxygen', oceans: undefined,
};

/**
 * THE RAISE'S LEGS — per Mars parameter that went UP between the two
 * snapshots: before → peak, the rating steps that raise paid (one per step
 * made — the scale's own rule; a raise nobody was credited for pays none,
 * and the card measures that off the mover's rating), the thresholds the
 * raise claimed on that scale. A parameter that did not move is not a leg
 * (the fall names it at its maximum, in `down`).
 */
export function upLegs(before: ParameterSnapshot, peak: ParameterSnapshot, rewarded = true): Array<ParameterSwingUp> {
  const out: Array<ParameterSwingUp> = [];
  const claimedNow = new Set(peak.claims);
  const newClaims = [...claimedNow].filter((key) => !before.claims.includes(key));
  const legs: Array<{parameter: 'temperature' | 'oxygen' | 'oceans', from: number, to: number}> = [
    {parameter: 'temperature', from: before.temperature, to: peak.temperature},
    {parameter: 'oxygen', from: before.oxygenLevel, to: peak.oxygenLevel},
    {parameter: 'oceans', from: before.oceans, to: peak.oceans},
  ];
  for (const leg of legs) {
    if (leg.to <= leg.from) {
      continue;
    }
    const steps = Math.round((leg.to - leg.from) / STEP_SIZE[leg.parameter]);
    const scale = SCALE_OF[leg.parameter];
    out.push({
      parameter: leg.parameter as ParameterMoveId,
      before: leg.from,
      after: leg.to,
      tr: rewarded ? steps : 0,
      claimed: scale === undefined ? [] : newClaims.filter((key) => key.startsWith(scale + '-')),
    });
  }
  return out;
}

/**
 * PUBLISH the swing — once, after the fall. `removed` is the cell the
 * oceans' fall took its tile from (the removal step's answer), when one left.
 */
export function recordParameterSwing(
  player: IPlayer,
  source: ICard,
  swing: {up: ReadonlyArray<ParameterSwingUp>, down: ReadonlyArray<ParameterSwingDown>, removed?: Space},
): void {
  player.game.publishParameterSwing({
    source: {card: source.name},
    player: player.color,
    up: swing.up,
    down: swing.down,
    ...(swing.removed === undefined ? {} : {removed: {space: swing.removed.id, tile: TileType.OCEAN}}),
    rating: player.terraformRating,
  });
}
