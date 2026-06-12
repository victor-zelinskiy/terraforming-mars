/*
 * Player-colour → hex map tuned for the dark-glass endgame surfaces (charts,
 * accents). Brighter / more saturated than the board-token colours so lines and
 * dots read clearly on the dark panels. Pure (no Vue), shared by the chart and
 * the overview/score components.
 */
import {Color} from '@/common/Color';

export const ENDGAME_PLAYER_HEX: Record<Color, string> = {
  red: '#e8573f',
  green: '#56c95f',
  yellow: '#e8c84a',
  blue: '#4f9be0',
  black: '#aebccd',
  purple: '#b27ce0',
  orange: '#ec934a',
  pink: '#f07ab5',
  neutral: '#9fb3c8',
  bronze: '#cd9b62',
};

export function endgamePlayerHex(color: Color): string {
  return ENDGAME_PLAYER_HEX[color] ?? '#9fb3c8';
}
