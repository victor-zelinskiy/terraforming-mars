import * as constants from '../constants';
import {BoardName} from './BoardName';

/**
 * A bonus printed on a global-parameter track, granted to the player who raises the parameter
 * across the threshold value (upward).
 *
 * Player benefits (production, cards, a colony, TR) are skipped during the solar (World Government)
 * phase; `ocean`/`temperature` apply regardless and can cascade.
 *
 * vize1215 fork: this module is DATA only. Upstream's `grantGlobalParameterTrackBonuses` is not ported — the fork's
 * `Game.increaseTemperature` / `increaseOxygenLevel` / `increaseVenusScaleLevel` keep their own grant code (MarsBot's
 * substitutions, the rating attribution, the scale-bonus claims) and read WHICH bonuses the map prints from here.
 */
export type GlobalParameterTrackBonus =
  'heatproduction' |
  'ocean' |
  'temperature' |
  'plant' |
  'drawcard' |
  'colony' |
  'tr';

/**
 * A threshold on a global-parameter track and the bonus granted when the track rises from below
 * `value` to at-or-above it.
 */
export type GlobalParameterThreshold = {
  value: number;
  bonus: GlobalParameterTrackBonus;
};

/**
 * The bonuses printed along a map's temperature, oxygen and Venus tracks.
 *
 * Standard maps share the classic layout (heat production at -24/-20C, an ocean at 0C, a temperature
 * step at 8% oxygen, a card at 8% Venus, TR at 16% Venus). The larger Amazonis Planitia, with its
 * longer tracks, spreads out a richer set of bonuses.
 */
export type GlobalParameterTracks = {
  temperature: ReadonlyArray<GlobalParameterThreshold>;
  oxygen: ReadonlyArray<GlobalParameterThreshold>;
  venus: ReadonlyArray<GlobalParameterThreshold>;
};

const STANDARD: GlobalParameterTracks = {
  temperature: [
    {value: constants.TEMPERATURE_BONUS_FOR_HEAT_1, bonus: 'heatproduction'},
    {value: constants.TEMPERATURE_BONUS_FOR_HEAT_2, bonus: 'heatproduction'},
    {value: constants.TEMPERATURE_FOR_OCEAN_BONUS, bonus: 'ocean'},
  ],
  oxygen: [
    {value: constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS, bonus: 'temperature'},
  ],
  venus: [
    {value: constants.VENUS_LEVEL_FOR_CARD_BONUS, bonus: 'drawcard'},
    {value: constants.VENUS_LEVEL_FOR_TR_BONUS, bonus: 'tr'},
  ],
};

const AMAZONIS_PLANITIA: GlobalParameterTracks = {
  temperature: [
    {value: constants.TEMPERATURE_BONUS_FOR_HEAT_1, bonus: 'heatproduction'},
    {value: constants.TEMPERATURE_BONUS_FOR_HEAT_2, bonus: 'heatproduction'},
    {value: constants.TEMPERATURE_BONUS_FOR_PLANT, bonus: 'plant'},
    {value: constants.TEMPERATURE_FOR_OCEAN_BONUS, bonus: 'ocean'},
  ],
  oxygen: [
    {value: constants.OXYGEN_LEVEL_FOR_AMAZONIS_CARD_BONUS, bonus: 'drawcard'},
    {value: constants.OXYGEN_LEVEL_FOR_AMAZONIS_TEMPERATURE_BONUS, bonus: 'temperature'},
  ],
  venus: [
    {value: constants.VENUS_LEVEL_FOR_CARD_BONUS, bonus: 'drawcard'},
    {value: constants.VENUS_LEVEL_FOR_AMAZONIS_COLONY_BONUS, bonus: 'colony'},
    {value: constants.VENUS_LEVEL_FOR_AMAZONIS_TR_BONUS, bonus: 'tr'},
  ],
};

/**
 * Does a move of the `type` track from `from` to `to` cross a printed `bonus` of this map? The read-only engines
 * (previews, forecasts) walk the map's thresholds through this instead of the classic constants (vize1215 fork).
 */
export function crossesTrackBonus(
  tracks: GlobalParameterTracks, type: keyof GlobalParameterTracks, bonus: GlobalParameterTrackBonus, from: number, to: number): boolean {
  return tracks[type].some((threshold) => threshold.bonus === bonus && from < threshold.value && to >= threshold.value);
}

export function getGlobalParameterTracks(boardName: BoardName): GlobalParameterTracks {
  if (boardName === BoardName.AMAZONIS_PLANITIA) {
    return AMAZONIS_PLANITIA;
  } else {
    return STANDARD;
  }
}

/**
 * The English i18n key that names crossing a printed track bonus AT THE MAP'S OWN THRESHOLD (vize1215 fork — the
 * forecast and the board's chain note say «Crossing 11 % oxygen…» on Amazonis Planitia, «8 %» elsewhere). Literal keys
 * (the locale audit reads them); `undefined` when the map prints no such bonus, or at a threshold with no key yet — the
 * caller falls back to its classic key.
 */
export function trackBonusReason(tracks: GlobalParameterTracks, type: keyof GlobalParameterTracks, bonus: GlobalParameterTrackBonus): string | undefined {
  const value = tracks[type].find((threshold) => threshold.bonus === bonus)?.value;
  if (value === undefined) {
    return undefined;
  }
  return TRACK_BONUS_REASONS[`${type}:${bonus}:${value}`];
}

const TRACK_BONUS_REASONS: Readonly<Record<string, string>> = {
  'venus:drawcard:8': 'Crossing 8 % Venus draws a card',
  'venus:tr:16': 'Crossing 16 % Venus raises your TR a step',
  'venus:tr:22': 'Crossing 22 % Venus raises your TR a step',
  'venus:colony:16': 'Crossing 16 % Venus builds a colony',
  'oxygen:temperature:8': 'Crossing 8 % oxygen raises the temperature a step',
  'oxygen:temperature:11': 'Crossing 11 % oxygen raises the temperature a step',
  'oxygen:drawcard:7': 'Crossing 7 % oxygen draws a card',
  'temperature:plant:-12': 'Crossing −12 °C raises your plant production a step',
};
