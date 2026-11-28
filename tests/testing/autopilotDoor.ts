/**
 * THE DOOR UNDER ONE SCREEN, AS A WHOLE GAME's OWN END — shared by the two pilots (the real browser's
 * `tests/e2e/console-autopilot.spec.ts`, the bottle's `tests/client/bottle/autopilot.ts`).
 *
 * FREEZE ZERO, stage M (docs/claude/console/freeze-zero/PLAN.md § 8 — AUDIT-2026-11-28.md A1). A pilot's DOOR answers
 * a question the walk did not get through on the screen, «as a second device of the same seat would», and the game
 * goes on. When the door answers AGAIN AND AGAIN at one unchanged screen — the same frames, the same bar, whatever the
 * question — with not one answer ON the screen in between, the walk is not going round a hard place: the screen cannot
 * be answered, and playing on behind it hides exactly the freeze a whole game exists to find. CI's browser game 632
 * (`983c3b60d0`) stood on «Парламент · A Выполняется…» from generation 4 to the press cap: twenty-four questions
 * through the door, half an hour of a runner, «1 capped», a passed test, no issue.
 *
 * `DOOR_RUN_STUCK` answers IN A ROW at one screen end the game `stuck`, the screen named — before the door answers
 * once more for a screen that cannot. (Measured on CI's pass 585 – 632 and the box's count on the pin: game 632's run
 * is 24; no other game of either world has a run above 1.) The report names the softer form by itself — three at one
 * screen anywhere in a game (`scripts/monkey-report.mjs` «THE DOOR UNDER ONE SCREEN»), and reads a row the same way:
 * `tests/scripts/autopilotDoor.spec.ts` holds the two readings together.
 *
 * Pure — no import: both worlds bundle it.
 */
export const DOOR_RUN_STUCK = 6;

/**
 * The SCREEN a door's row stood under — its frames and its bar (`… · frames <frames> · bar «…»[ · grey <key>]`): the
 * question, the generation, the owner's word and what followed the gesture taken out. `undefined` for a row that
 * names no screen.
 */
export function doorScreenOf(row: string): string | undefined {
  const from = row.indexOf('frames ');
  if (from < 0) {
    return undefined;
  }
  const ends = [row.indexOf(' → after the gesture', from), row.indexOf(' · owner «', from)].filter((i) => i >= 0);
  return row.slice(from, ends.length > 0 ? Math.min(...ends) : undefined).trim();
}

export type DoorRun = {
  /** A door's row was just written: `undefined` while the game goes on, or WHY it is stuck. */
  door(row: string): string | undefined,
  /** The SCREEN answered a question (a pass by the wheel included): the run is over. */
  answeredOnScreen(): void,
};

export function createDoorRun(stuckAt: number = DOOR_RUN_STUCK): DoorRun {
  let run: {screen: string, n: number} | undefined;
  return {
    door(row) {
      const screen = doorScreenOf(row);
      run = screen === undefined ? undefined : run?.screen === screen ? {screen, n: run.n + 1} : {screen, n: 1};
      return run !== undefined && run.n >= stuckAt ?
        `the door answered ${run.n} questions in a row under one unchanged screen — «${run.screen}»: it could not be answered` :
        undefined;
    },
    answeredOnScreen() {
      run = undefined;
    },
  };
}
