/*
 * T05 · CG — THE TOP STRIP'S MATERIAL, three MOCKUPS for the owner's batch (decision 6) — «ВЕРХНЯЯ ПОЛОСА — ПРИБОРНАЯ
 * ДОСКА: МАТЕРИАЛ, НЕ ФОРМА (2)», the second always-visible edge after CF's player board.
 *
 * CSS injected over the LIVE scene by `console-status-material.spec.ts` (`TM_E2E_STATUS_MOCK=M1|M2|M3`), never shipped.
 * Every mockup is PAINT ONLY: no width / height / padding / margin / gap / font-size / font-family / letter-spacing
 * change, no `transform` / `filter` on a chip, a cell or the strip — the stand measures every anchor before and after and
 * fails on a move of more than 1 px. Decorative layers ride pseudo-elements, backgrounds and box-shadows (zero layout).
 * The instruments read `--con-param-fill` (0…1) / `--con-param-steps` (the oceans), written onto the cells by the stand
 * from the strip's own readouts (the shipped strip binds them from the game).
 *
 *   M1 · «приборная доска» — the beam on the rail's glass; a SEAT CHIP as a cross: the seat's colour a LIT EDGE (never a
 *        fill), the name on the chip's glass, the status an ENGRAVED label (active: lit mint engraving; waiting: recessed);
 *        the three global parameters as three DIALS round their own icons — the temperature an arc in the heat's tone
 *        (from the bottom, −30 → +8 °C), the oxygen an arc in its blue, the oceans a dial of nine segments; the terraforming rail in the same glass;
 *        the deck's count and the generation on engraved counter plates.
 *   M2 · decision 6b — the seat chips + the beam's material only; the parameters stay as text.
 *   M3 · M1 with ONE COCKPIT GLASS: the beam's gradient runs INTO the player board's plate through the seam (the light at
 *        the beam's lower edge = the plate's top light), the seam accent quiet over the rail's projection.
 */

/** A seat's LIT EDGE — the player colours lifted for a light on dark glass (the chips' `data-color`). */
const SEATS: ReadonlyArray<[string, string]> = [
  ['red', '#e2492f'], ['yellow', '#e3d23a'], ['green', '#3fcf5a'], ['black', '#c9ced6'],
  ['blue', '#4d93ff'], ['purple', '#a35cff'], ['orange', '#f08a2c'], ['pink', '#f784c4'],
];

const seatTokens = SEATS.map(([color, tone]) => `html.console-native .con-status__player[data-color="${color}"] { --seat: ${tone}; }`).join('\n');

/** The beam on the rail's glass (the shipped `.con-res__rows` recipe). */
const BEAM = `
html.console-native .con-status {
  background: linear-gradient(180deg, rgba(255, 255, 255, .035), transparent .9rem), linear-gradient(180deg, rgba(30, 42, 58, .95), rgba(11, 18, 28, .97));
  box-shadow: inset 0 .07rem 0 rgba(255, 255, 255, .08), inset 0 -.08rem 0 rgba(0, 0, 0, .5), 0 .45rem 1.5rem rgba(0, 0, 0, .42);
}
`;

/** One cockpit glass (M3): the beam lightens INTO the seam, where the player board's plate takes the light up. */
const COCKPIT = `
html.console-native .con-status {
  background: linear-gradient(0deg, rgba(255, 255, 255, .05), transparent .7rem), linear-gradient(0deg, rgba(32, 44, 60, .95), rgba(10, 16, 25, .98));
  box-shadow: inset 0 .07rem 0 rgba(255, 255, 255, .05), 0 .45rem 1.5rem rgba(0, 0, 0, .42);
}
html.console-native .con-status::after {
  background: linear-gradient(90deg, rgba(106, 176, 230, .04), rgba(106, 176, 230, .06) calc(var(--con-rail-outer-w, 10.7rem) * .9),
    rgba(106, 176, 230, .42) calc(var(--con-rail-outer-w, 10.7rem) + 2.4rem), rgba(106, 176, 230, .38) 58%, rgba(106, 176, 230, .07));
}
`;

/** The seat chip as a cross: lit edge · name on glass · engraved status. */
const CHIPS = `
html.console-native .con-status__player {
  border-radius: .2rem .45rem .45rem .2rem;
  background: linear-gradient(90deg, color-mix(in srgb, var(--seat, #8fb3d6) 20%, transparent), transparent 42%), linear-gradient(180deg, rgba(42, 56, 74, .92), rgba(15, 22, 33, .95));
  box-shadow: inset .14rem 0 0 var(--seat, #8fb3d6), inset 0 .06rem 0 rgba(255, 255, 255, .08), inset 0 -.06rem 0 rgba(0, 0, 0, .55), 0 0 0 .05rem rgba(0, 0, 0, .6);
}
html.console-native .con-status__player.con-status__player--me {
  box-shadow: inset .14rem 0 0 var(--seat, #8fb3d6), inset 0 .06rem 0 rgba(255, 255, 255, .08), inset 0 -.06rem 0 rgba(0, 0, 0, .55), 0 0 0 .06rem rgba(106, 176, 230, .7), 0 0 .6rem rgba(106, 176, 230, .18);
}
html.console-native .con-status__player.con-status__player--active {
  background: linear-gradient(90deg, color-mix(in srgb, var(--seat, #8fb3d6) 26%, transparent), transparent 48%), linear-gradient(180deg, rgba(40, 62, 70, .95), rgba(14, 26, 32, .97));
  box-shadow: inset .14rem 0 0 var(--seat, #8fb3d6), inset 0 .06rem 0 rgba(255, 255, 255, .1), inset 0 -.06rem 0 rgba(0, 0, 0, .55), 0 0 0 .06rem rgba(88, 214, 166, .72), 0 0 .9rem rgba(88, 214, 166, .26);
}
html.console-native .con-status__player.con-status__player--attention {
  background: linear-gradient(90deg, color-mix(in srgb, var(--seat, #8fb3d6) 22%, transparent), transparent 42%), linear-gradient(180deg, rgba(54, 42, 20, .95), rgba(30, 22, 10, .96));
  box-shadow: inset .14rem 0 0 var(--seat, #8fb3d6), 0 0 0 .06rem rgba(242, 193, 78, .78), 0 0 .9rem rgba(242, 193, 78, .26);
}
html.console-native .con-status__pname { color: #eef4fb; }
html.console-native .con-status__dot { box-shadow: 0 0 0 .07rem rgba(0, 0, 0, .7), 0 0 0 .12rem rgba(255, 255, 255, .14); }
html.console-native .con-status__pstatus {
  background: linear-gradient(180deg, rgba(0, 0, 0, .52), rgba(0, 0, 0, .3));
  box-shadow: inset 0 .07rem .14rem rgba(0, 0, 0, .78), inset 0 -.05rem 0 rgba(255, 255, 255, .06), 0 0 0 .05rem rgba(120, 150, 180, .22);
  color: rgba(196, 210, 228, .62);
}
html.console-native .con-status__pstatus.con-status__pstatus--active {
  color: #dcfbef;
  background: linear-gradient(180deg, rgba(10, 40, 32, .82), rgba(6, 26, 20, .7));
  box-shadow: inset 0 .07rem .14rem rgba(0, 0, 0, .7), 0 0 0 .05rem rgba(88, 214, 166, .62), 0 0 .55rem rgba(88, 214, 166, .25);
}
html.console-native .con-status__pstatus.con-status__pstatus--passed { color: rgba(242, 193, 78, .8); }
`;

/** The three instruments and the counter plates (M1 / M3). */
const INSTRUMENTS = `
html.console-native .con-status__terra > .con-status__param:nth-child(1) .con-status__icon { position: relative; }
html.console-native .con-status__terra > .con-status__param:nth-child(1) .con-status__icon::after {
  content: ''; position: absolute; inset: -.2rem; border-radius: 50%; pointer-events: none;
  background: conic-gradient(from 180deg, #f0975a calc(var(--con-param-fill, 0) * 360deg), rgba(120, 150, 180, .22) 0);
  -webkit-mask: radial-gradient(circle, transparent 62%, #000 64%); mask: radial-gradient(circle, transparent 62%, #000 64%);
}
html.console-native .con-status__terra > .con-status__param:nth-child(2) .con-status__icon,
html.console-native .con-status__terra > .con-status__param:nth-child(3) .con-status__icon { position: relative; }
html.console-native .con-status__terra > .con-status__param:nth-child(2) .con-status__icon::after {
  content: ''; position: absolute; inset: -.2rem; border-radius: 50%; pointer-events: none;
  background: conic-gradient(#7fd3ff calc(var(--con-param-fill, 0) * 360deg), rgba(120, 150, 180, .22) 0);
  -webkit-mask: radial-gradient(circle, transparent 62%, #000 64%); mask: radial-gradient(circle, transparent 62%, #000 64%);
}
html.console-native .con-status__terra > .con-status__param:nth-child(3) .con-status__icon::after {
  content: ''; position: absolute; inset: -.2rem; border-radius: 50%; pointer-events: none;
  background: conic-gradient(#3aa6ff calc(var(--con-param-steps, 0) * 40deg), rgba(120, 150, 180, .24) 0);
  -webkit-mask: repeating-conic-gradient(#000 0 33deg, transparent 33deg 40deg), radial-gradient(circle, transparent 62%, #000 64%);
  -webkit-mask-composite: source-in;
  mask: repeating-conic-gradient(#000 0 33deg, transparent 33deg 40deg), radial-gradient(circle, transparent 62%, #000 64%);
  mask-composite: intersect;
}
html.console-native .con-status__terra-rail { background: linear-gradient(180deg, rgba(0, 0, 0, .7), rgba(10, 18, 28, .85)); box-shadow: inset 0 .05rem .1rem rgba(0, 0, 0, .7), 0 0 0 .05rem rgba(106, 176, 230, .26); }
html.console-native .con-status__gen .con-status__value,
html.console-native .con-deckstack__count {
  border-radius: .22rem;
  background: linear-gradient(180deg, rgba(0, 0, 0, .5), rgba(0, 0, 0, .26));
  box-shadow: 0 0 0 .16rem rgba(0, 0, 0, .42), 0 0 0 .21rem rgba(106, 176, 230, .3), inset 0 .06rem .12rem rgba(0, 0, 0, .7);
}
html.console-native .con-status__gen.con-status__gen--final .con-status__value { box-shadow: 0 0 0 .16rem rgba(0, 0, 0, .42), 0 0 0 .21rem rgba(242, 193, 78, .55), inset 0 .06rem .12rem rgba(0, 0, 0, .7); }
`;

export type StatusMock = 'M1' | 'M2' | 'M3';

export const STATUS_MOCKS: Readonly<Record<StatusMock, string>> = {
  M1: [seatTokens, BEAM, CHIPS, INSTRUMENTS].join('\n'),
  M2: [seatTokens, BEAM, CHIPS].join('\n'),
  M3: [seatTokens, COCKPIT, CHIPS, INSTRUMENTS].join('\n'),
};
