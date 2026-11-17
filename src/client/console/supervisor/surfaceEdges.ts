/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE EDGES OF THE PICTURE — how many times a surface of the console MOUNTED or LEFT, counted as it happens
 * (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4, stage 1).
 *
 * The arbiter looks at the picture once a second (`supervisorController.checkLiveness` — the signature), and the loop
 * judge (`livenessOscillation.ts`) counted how often two looks in a row differed. A look is a SAMPLE: a reveal band
 * that is up for a quarter of a second of every second or two is seen or missed by the PHASE of the look — the loop
 * of 2026-11-17 stood on a green gate for a day, then turned it red, on the same code (the lesson of the blind
 * announce again: «three looks are not three seconds»). A sampler can hide a loop and it can invent one.
 *
 * So the surfaces say it themselves: every mount and every unmount of a surface the picture counts is an EDGE,
 * counted when the DOM changes — and the judge reads how many edges fell BETWEEN two looks. A surface that left and
 * came back inside one second is a round trip no look can see, and no phase can hide.
 *
 * One observer over the document (surfaces are teleported), `childList` only — a motion writes styles, never this.
 */

/** The surfaces of the arbiter's picture, by their root class — ONE list: the signature counts them, this counts their edges. */
export const PICTURE_SURFACES = ['con-ws', 'con-hand', 'con-reveal', 'con-task', 'con-mandatory', 'con-deckdraw', 'con-zoom', 'con-journal', 'con-sys'] as const;

const SELECTOR = PICTURE_SURFACES.map((name) => `.${name}`).join(',');

export type SurfaceEdges = {
  /** Every mount and unmount of a picture surface so far — a count that only grows. */
  count(): number,
  /** Which surfaces had edges since the last call, with how many (`con-reveal×8`) — '' when none. Reading it starts the next span. */
  turned(): string,
  stop(): void,
};

/** The surfaces a node carries: itself, and whatever stands inside it (a parent mounted with its surface). */
function surfacesOf(node: Node): Array<string> {
  if (node.nodeType !== 1) {
    return [];
  }
  const el = node as Element;
  const own = PICTURE_SURFACES.filter((name) => el.classList.contains(name));
  if (el.firstElementChild === null) {
    return own;
  }
  const inside = Array.from(el.querySelectorAll(SELECTOR)).flatMap((child) => PICTURE_SURFACES.filter((name) => child.classList.contains(name)));
  return [...own, ...inside];
}

/** Count the edges of the picture's surfaces under `root` until `stop()`. Inert where there is no observer to make. */
export function watchSurfaceEdges(root: Node): SurfaceEdges {
  let total = 0;
  let span = new Map<string, number>();
  const note = (node: Node): void => {
    for (const name of surfacesOf(node)) {
      total++;
      span.set(name, (span.get(name) ?? 0) + 1);
    }
  };
  if (typeof MutationObserver === 'undefined') {
    return {count: () => 0, turned: () => '', stop: () => undefined};
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach(note);
      record.removedNodes.forEach(note);
    }
  });
  observer.observe(root, {childList: true, subtree: true});
  const drain = (): void => {
    for (const record of observer.takeRecords()) {
      record.addedNodes.forEach(note);
      record.removedNodes.forEach(note);
    }
  };
  return {
    count: () => {
      drain();
      return total;
    },
    turned: () => {
      drain();
      const text = [...span.entries()].map(([name, n]) => `${name}×${n}`).join(' ');
      span = new Map();
      return text;
    },
    stop: () => observer.disconnect(),
  };
}
