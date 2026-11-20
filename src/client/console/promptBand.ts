/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHO OF THE PAD's PROMPT BAND TAKES A PRESS — the ONE function's word (FREEZE ZERO, the second phase, stage 2 ② —
 * docs/claude/console/freeze-zero/PLAN.md § 8).
 *
 * The pad's ladder (`shell/padRouterController.routeIntent`) has a band of rungs that answer the SERVER's question:
 * the deck pick, the draft, an external draw, the opening, the composites, a decision, the task host. Until this
 * module they were fifteen ordered `if`s: with two prompt surfaces standing at once, the ORDER they were written in
 * decided whose press it was — a second opinion beside `servingOwnerOf`, the screen shadow and each surface's own
 * `v-if`. Now the function is asked (`servingOwner.bandRungOf`, on the facts as they stand AT THE PRESS — once per
 * intent, and only when some prompt surface stands at all): the surface it names takes the press, and every other
 * rung of the band YIELDS to it.
 *
 * THE FALLBACK IS THE LADDER ITSELF, COUNTED. Where the function names no rung of the band (the owner waits, a
 * workspace serves, nothing is asked), names a surface that does not stand, or throws — a prompt surface that stands
 * takes the press in the ladder's old order, exactly as before the swap, and the press says so (`fellBack`: the row
 * `band-fallback` of `servingOwnerMeasure`). The pad can therefore never do worse than the ladder did; what the row
 * counts is the copy still to be derived in step ③ — at zero it is deleted together with the `stands` table.
 *
 * Pure: no Vue, no DOM, no clock — the shell hands in what it reads.
 */

export type PromptBand = {
  /** Does this rung of the band take the press in flight? (Asked by the ladder in its own order.) */
  takes(rung: string): boolean,
};

/**
 * The band's choice for ONE intent.
 * @param stands   each band surface's own «I stand and take the pad», by its rung's name
 * @param wordNow  the function's word right now (`bandRungOf` — `own:<rung>` · `step` · `ws` · `held:<kind>` · `free`)
 * @param fellBack told when the ladder's order routed the press (the word the function gave, the rung that took it)
 */
export function promptBandOf(
  stands: Readonly<Record<string, () => boolean>>,
  wordNow: () => string,
  fellBack: (word: string, rung: string) => void,
): PromptBand {
  let word: string | undefined;
  let chosen = '';
  return {
    takes(rung: string): boolean {
      if (stands[rung]?.() !== true) {
        return false;
      }
      if (word === undefined) {
        try {
          word = wordNow();
        } catch {
          word = 'error';
        }
        const named = word.startsWith('own:') ? word.slice('own:'.length) : '';
        chosen = named !== '' && stands[named]?.() === true ? named : '';
      }
      if (chosen === rung) {
        return true;
      }
      if (chosen === '') {
        fellBack(word, rung);
        return true;
      }
      // (The function named another surface of the band, and it stands: this one yields — the press is not its.)
      return false;
    },
  };
}
