/*
 * T03 · CF — THE PLAYER BOARD'S MATERIAL, three MOCKUPS for the owner's batch (decisions 4 · 5).
 *
 * CSS injected over the LIVE scene by `console-rail-material.spec.ts` (`TM_E2E_RAIL_MOCK=M1|M2|M3`), never shipped.
 * Every mockup is PAINT ONLY: no width / height / padding / margin / gap / font-size / grid track changes, no
 * `transform` / `filter` on a row or the hull — the stand measures every flight anchor before and after and fails
 * on a move of more than 1 px. Decorative layers ride pseudo-elements and box-shadows (zero layout).
 *
 *   M1 · «приборный банк»  — a bevelled dark-glass plate per row with a chamfered corner and a tone edge, the icon in a
 *        round socket ringed in its resource's TONE, the digits tinted by the tone, the production an ENGRAVED «+N»
 *        in the tone (negative: red engraving); the tag matrix a bank of medallions on bronze rims, the count on an
 *        engraved plate, a zero receding by MATERIAL (steel rim, no light), the score cap on the same material.
 *   M2 · M1 with the brown production pill kept (decision 4b).
 *   M3 · «стеклянный планшет» — ONE glass plate under all six rows, hairline dividers instead of six plates; the
 *        sockets, the engraving and the medallion bank as in M1.
 */

/** The resource's TONE — one source per resource (the colours its own icon and the console already speak). */
const TONES: ReadonlyArray<[string, string]> = [
  ['megacredits', '#f2c14e'],
  ['steel', '#c98a4e'],
  ['titanium', '#cfd9e8'],
  ['plants', '#8fd45f'],
  ['energy', '#b57ae0'],
  ['heat', '#f0975a'],
];

const toneTokens = TONES.map(([key, tone]) => `html.console-native .con-res__row--${key} { --rt: ${tone}; }`).join('\n');

/** The icon socket + the toned digits — shared by every mockup. */
const SOCKET = `
html.console-native .con-res .con-res__iconwrap::before {
  content: ''; position: absolute; inset: -.16rem; border-radius: 34%; pointer-events: none; z-index: 0;
  background: radial-gradient(circle at 50% 36%, rgba(46, 60, 80, .95), rgba(8, 12, 19, .98) 78%);
  box-shadow: inset 0 0 0 .09rem color-mix(in srgb, var(--rt, #8fb3d6) 72%, transparent),
              inset 0 .18rem .3rem rgba(0, 0, 0, .75), 0 0 0 .05rem rgba(0, 0, 0, .7),
              0 0 .45rem color-mix(in srgb, var(--rt, #8fb3d6) 22%, transparent);
}
html.console-native .con-res .con-res__icon { position: relative; z-index: 1; }
html.console-native .con-res .con-res__value { color: color-mix(in srgb, #ffffff 80%, var(--rt, #ffffff)); }
`;

/** The row as a bevelled plate (M1 / M2). */
const PLATE = `
html.console-native .con-res .con-res__row {
  border-radius: 0 .55rem .18rem 0;
  background:
    linear-gradient(225deg, rgba(9, 15, 23, 1) .42rem, transparent .43rem),
    linear-gradient(90deg, color-mix(in srgb, var(--rt, #8fb3d6) 20%, transparent), transparent 34%),
    linear-gradient(180deg, rgba(36, 48, 64, .94), rgba(13, 20, 30, .95));
  box-shadow: inset 0 .07rem 0 rgba(255, 255, 255, .08), inset 0 -.08rem 0 rgba(0, 0, 0, .5),
              inset -.06rem 0 0 color-mix(in srgb, var(--rt, #8fb3d6) 38%, transparent),
              0 .14rem .4rem rgba(0, 0, 0, .45);
}
`;

/** One glass plate under the six rows, hairline dividers (M3). */
const GLASS = `
html.console-native .con-res .con-res__rows {
  border-radius: 0 .6rem .6rem 0;
  background: linear-gradient(180deg, rgba(34, 46, 62, .9), rgba(12, 19, 29, .94));
  box-shadow: calc(-1 * var(--con-pad-x, 0rem)) 0 0 0 rgba(22, 31, 44, .92), inset 0 .07rem 0 rgba(255, 255, 255, .08),
              inset -.06rem 0 0 rgba(106, 176, 230, .28), 0 .2rem .6rem rgba(0, 0, 0, .45);
}
html.console-native .con-res .con-res__row {
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--rt, #8fb3d6) 16%, transparent), transparent 30%),
    linear-gradient(0deg, rgba(255, 255, 255, .06) .05rem, transparent .05rem);
  box-shadow: none;
}
html.console-native .con-res .con-res__row:last-child { background: linear-gradient(90deg, color-mix(in srgb, var(--rt, #8fb3d6) 16%, transparent), transparent 30%); }
`;

/** The production as an ENGRAVED label in the tone (M1 / M3). */
const ENGRAVED = `
html.console-native .con-res .con-res__prod:not(.con-res__prod--void) {
  background: linear-gradient(180deg, rgba(0, 0, 0, .5), rgba(0, 0, 0, .28));
  box-shadow: inset 0 .07rem .14rem rgba(0, 0, 0, .75), inset 0 -.05rem 0 color-mix(in srgb, var(--rt, #8fb3d6) 30%, transparent),
              0 0 0 .05rem color-mix(in srgb, var(--rt, #8fb3d6) 48%, transparent);
  color: color-mix(in srgb, #ffffff 30%, var(--rt, #ffffff));
  border-radius: .18rem;
}
html.console-native .con-res .con-res__prod--negative {
  box-shadow: inset 0 .07rem .14rem rgba(0, 0, 0, .75), 0 0 0 .05rem rgba(255, 110, 96, .6);
  color: #ff9c90;
}
`;

/** The score cap on the plate's material (TR ring / VP shield untouched). */
const SCORE = `
html.console-native .con-res .con-score {
  border-radius: 0 .55rem .18rem 0;
  background:
    linear-gradient(225deg, rgba(9, 15, 23, 1) .42rem, transparent .43rem),
    linear-gradient(180deg, rgba(48, 50, 56, .95), rgba(16, 20, 28, .96));
  box-shadow: inset 0 0 0 .05rem rgba(242, 215, 149, .34), inset 0 .07rem 0 rgba(255, 255, 255, .09),
              inset 0 -.08rem 0 rgba(0, 0, 0, .5), 0 .16rem .45rem rgba(0, 0, 0, .45);
}
`;

/** The tag matrix as a medallion bank (decision 5a). */
const MEDALS = `
html.console-native .con-tagmx { border-top: .05rem solid rgba(0, 0, 0, .65); box-shadow: inset 0 .05rem 0 rgba(255, 255, 255, .05); }
html.console-native .con-tagmx__title { color: rgba(242, 215, 149, .82); }
html.console-native .con-tagmx__rule { background: linear-gradient(90deg, rgba(242, 215, 149, .4), transparent); }
html.console-native .con-tagmx__cell { background: radial-gradient(circle at 50% 36%, rgba(30, 42, 58, .55), transparent 70%); box-shadow: none; }
html.console-native .con-tagmx__medal.tag-count {
  box-shadow: 0 0 0 .08rem #b98b52, 0 0 0 .14rem rgba(0, 0, 0, .6), 0 .12rem .3rem rgba(0, 0, 0, .55),
              0 0 .45rem rgba(242, 193, 78, .3);
}
/* The count's engraved plate: drawn by spread shadows around the digits' own box and lifted onto the medal's rim by
   \`top\` (relative offset — zero layout); never a padding or a margin, which re-solve the matrix's rows. */
html.console-native .con-tagmx__numwrap {
  z-index: 1; top: -.22rem; padding-inline: .32rem; border-radius: .5rem;
  background: rgba(8, 12, 19, .95);
  box-shadow: 0 0 0 .06rem rgba(8, 12, 19, .95), 0 0 0 .11rem rgba(185, 139, 82, .75), 0 .1rem .25rem .1rem rgba(0, 0, 0, .5);
}
html.console-native .con-tagmx__num { color: #ffe9bf; }
html.console-native .con-tagmx__cell--zero .con-tagmx__medal.tag-count {
  opacity: .38; box-shadow: 0 0 0 .08rem #4a5463, 0 0 0 .14rem rgba(0, 0, 0, .55);
}
html.console-native .con-tagmx__cell--zero .con-tagmx__numwrap { box-shadow: 0 0 0 .06rem rgba(8, 12, 19, .9), 0 0 0 .11rem rgba(90, 102, 118, .45); }
html.console-native .con-tagmx__cell--zero .con-tagmx__num { color: rgba(196, 210, 228, .5); }
`;

export type RailMock = 'M1' | 'M2' | 'M3';

export const RAIL_MOCKS: Readonly<Record<RailMock, string>> = {
  M1: [toneTokens, PLATE, SOCKET, ENGRAVED, SCORE, MEDALS].join('\n'),
  M2: [toneTokens, PLATE, SOCKET, SCORE, MEDALS].join('\n'),
  M3: [toneTokens, GLASS, SOCKET, ENGRAVED, SCORE, MEDALS].join('\n'),
};
