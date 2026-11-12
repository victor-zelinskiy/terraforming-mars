/**
 * THE DECK'S TICKS GO ONE CARD PER FRAME (CI run 43066263512, `console-scientific-breakthrough` «actions»: the HUD
 * deck read 283 → 280 in ONE step — and on the green retry 283 → 281 → 280, the two thrown-away cards ticking in the
 * same task).
 *
 * A search's thrown-away cards leave the deck as a stream of GSAP beats scheduled from one start; on a starved frame
 * every beat starts on the same tick and their «drawn» calls fire in one task — the counter's writes merge into one
 * repaint. And the stream's stall net runs on the wall clock while the peels run on GSAP's lag-smoothed clock, so on
 * a long frame it handed the deck to the owner's flight (which RELEASES the hold to the server's number) before a
 * single peel had ticked — every thrown card then ticked a released counter: nothing. Both are animations.md law 1 / 2
 * in the counter's own terms: a card's departure is ONE tick, in its own frame, and a backstop catches the stream up
 * card by card — never in one jump.
 *
 * The pacer is pure: `owe()` records a card that has left (the first tick is written at once — the departure IS the
 * event); every further one waits a frame of its own; `whenDrained(run)` runs a frame AFTER the last tick was written,
 * so whatever the owner does next (the found card's flight releasing the hold) never shares the last tick's repaint.
 */
export interface DeckTickPacer {
  /** `n` cards have left the deck — tick them, one per frame. */
  owe(n?: number): void;
  /** Run once every owed tick has been written AND painted (the frame after the last). At once when nothing is owed. */
  whenDrained(run: () => void): void;
  /** Ticks written so far. */
  readonly ticked: number;
}

export function createDeckTickPacer(opts: {
  /** Write ONE tick (the held count falls by one, the deck's own settle). */
  tick: () => void,
  /** Run `fn` in the next frame (the scene's own scope — torn down with it). */
  nextFrame: (fn: () => void) => void,
}): DeckTickPacer {
  let owed = 0;
  let pumping = false;
  let ticked = 0;
  const waiting: Array<() => void> = [];
  const pump = (): void => {
    if (owed === 0) {
      pumping = false;
      for (const run of waiting.splice(0)) {
        run();
      }
      return;
    }
    owed--;
    ticked++;
    opts.tick();
    opts.nextFrame(pump);
  };
  return {
    owe(n = 1): void {
      if (n <= 0) {
        return;
      }
      owed += n;
      if (!pumping) {
        pumping = true;
        pump();
      }
    },
    whenDrained(run: () => void): void {
      if (!pumping && owed === 0) {
        run();
        return;
      }
      waiting.push(run);
    },
    get ticked(): number {
      return ticked;
    },
  };
}
