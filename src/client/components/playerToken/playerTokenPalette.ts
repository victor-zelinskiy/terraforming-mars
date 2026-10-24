import {Color} from '@/common/Color';

/**
 * THE PLAYER-TOKEN PALETTE — one source for every physical piece a player
 * owns on the table: the cube (`PlayerCube.vue` — city / greenery / colony /
 * milestone ownership) and the delegate figure (`PlayerDelegate.vue` — the
 * Parliament). A player's delegate stands in EXACTLY the RGB of that player's
 * cube: both components read the one `--pt-*` set `tokenStyleVars` derives
 * here, so the two can never drift apart (guard:
 * `tests/client/components/playerTokenPalette.spec.ts`).
 *
 * This is the PIECE palette, not the UI palette: `variables.less`,
 * `endgameColors.ts` and the VP chart keep their own chip/text tones.
 */

export type RGB = readonly [number, number, number];

// Base player-token colours. The eight player colours mirror the game palette
// (`src/styles/variables.less`); `black` is a dark gunmetal so the token reads
// as a black piece (the UI `player_black` grey is for chips/text, not the
// physical piece), and `bronze`/`neutral` share one bronze tone.
export const BASE_RGB: Readonly<Record<Color, RGB>> = {
  red: [153, 17, 0],
  green: [0, 153, 0],
  yellow: [170, 170, 0],
  blue: [0, 102, 255],
  black: [86, 90, 98],
  purple: [140, 0, 255],
  orange: [236, 113, 12],
  // Pink deepened from the flat UI value (245,116,187) into a richer satin
  // rose so the token reads as lacquered acrylic, not a candy sticker — still
  // unmistakably the pink player.
  pink: [240, 100, 174],
  bronze: [176, 121, 71],
  neutral: [176, 121, 71],
};

/** The neutral delegate's steel: a cool light alloy — lit top, mid-grey sides. */
export const STEEL_RGB: RGB = [178, 186, 200];

// Colour-blind overlay glyphs (carried over from the legacy sprite overlay).
export const SYMBOL: Readonly<Record<Color, string>> = {
  red: '▲',
  blue: '+',
  black: '∇',
  yellow: '∗',
  green: '◆',
  purple: '◉',
  orange: '▢',
  pink: '◈',
  bronze: '▦',
  neutral: '★',
};

/** The steel (neutral delegate) piece's colour-blind glyph. */
export const STEEL_SYMBOL = '○';

export function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
export function scaleRgb(c: RGB, f: number): RGB {
  return [clampByte(c[0] * f), clampByte(c[1] * f), clampByte(c[2] * f)];
}
export function mixWhite(c: RGB, t: number): RGB {
  return [
    clampByte(c[0] + (255 - c[0]) * t),
    clampByte(c[1] + (255 - c[1]) * t),
    clampByte(c[2] + (255 - c[2]) * t),
  ];
}
function toRgb(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
function toRgba(c: RGB, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}
function luma(c: RGB): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

export type TokenOptions = {
  /** The neutral delegate's steel instead of the colour's own tone. */
  steel?: boolean;
};

/** The piece's base tone. An unknown / absent colour falls back to neutral. */
export function tokenBaseRgb(color: Color | undefined, opts: TokenOptions = {}): RGB {
  if (opts.steel === true) {
    return STEEL_RGB;
  }
  return BASE_RGB[color ?? 'neutral'] ?? BASE_RGB.neutral;
}

/** The piece's colour-blind glyph (steel carries its own). */
export function tokenSymbol(color: Color | undefined, opts: TokenOptions = {}): string {
  if (opts.steel === true) {
    return STEEL_SYMBOL;
  }
  return SYMBOL[color ?? 'neutral'] ?? SYMBOL.neutral;
}

/**
 * The `--pt-*` CSS variables every player piece paints with. The body stays
 * RICH — the per-face depth gradients + satin sheen supply the lighting, so
 * the shades stay saturated (not washed toward white). DEEP shadow tones give
 * clear physical thickness at real table scale. The lit lift is ADAPTIVE: an
 * already-light body (pink / yellow) gets barely any whitening so it reads as
 * deep satin acrylic, not a milky candy chip; a dark body gets a touch more.
 */
export function tokenStyleVars(color: Color | undefined, opts: TokenOptions = {}): Record<string, string> {
  const base = tokenBaseRgb(color, opts);
  const lightBody = luma(base) > 140;
  const top = mixWhite(base, lightBody ? 0.05 : 0.13); // lit face
  const left = scaleRgb(base, 0.80); // mid side
  const right = scaleRgb(base, 0.50); // deep shadow side — physical thickness
  // The back tones of a piece seen from every side (a SOLID flight proxy):
  // the far side mirrors the mid side, the back the deep one, the bottom is
  // the darkest — it faces the ground.
  const far = scaleRgb(base, 0.72);
  const back = scaleRgb(base, 0.56);
  const bottom = scaleRgb(base, 0.36);
  const edgeHi = mixWhite(base, 0.55);
  const symbol = luma(top) > 150 ? 'rgba(20, 18, 14, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  return {
    '--pt-base': toRgb(base),
    '--pt-top': toRgb(top),
    '--pt-left': toRgb(left),
    '--pt-right': toRgb(right),
    '--pt-far': toRgb(far),
    '--pt-back': toRgb(back),
    '--pt-bottom': toRgb(bottom),
    '--pt-edge-hi': toRgb(edgeHi),
    '--pt-glow': toRgba(base, 0.55),
    '--pt-symbol': symbol,
  };
}
