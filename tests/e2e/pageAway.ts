import {Page} from '@playwright/test';
import {cinematicBeat} from './consoleStart';

/*
 * THE PAGE NOBODY LOOKS AT — the monkey's `hidden` perturbation, as a primitive of the harness (freeze zero, stage 1:
 * «a hidden / starved page is a state the judges know»).
 *
 * The first form of it put a blank page in front of the game page. Measured on CI (run 44240483948, 101 spells): the
 * headless browser kept painting the page behind in 60 of them, and `visibilityState` read `visible` in every one — a
 * spell that perturbs nothing. So the perturbation is made IN the page, deterministically, on every machine:
 *
 *   · THE FRAME QUEUE IS HELD. While the page is away every `requestAnimationFrame` callback is queued and none
 *     runs — what a browser does to a page it does not show. GSAP's ticker, the kernel's `nextFrame`, a transition's
 *     own frame waits: none of them advances. Timers go on (a browser clamps them to one wake-up a second; they are
 *     left as they are — a judge that would fire on a clamped timer fires on a free one too).
 *   · A HIDDEN TAB SAYS SO. `hidden: true` — the document reads `visibilityState: 'hidden'` and `visibilitychange`
 *     is dispatched on the way out and on the way back; `false` is a window BEHIND ANOTHER, which no event announces.
 *   · BACK IN FRONT, every queued callback runs in the first real frame — the long gap is one frame to GSAP's lag
 *     smoothing, as it is in a browser.
 *
 * What it does not do: stop the compositor (a CSS transition already running finishes on its own clock, and its
 * `transitionend` is dispatched — in a truly hidden tab that event would wait for the page to come back).
 *
 * This file holds the frame clock ON PURPOSE (the driver guard's PRIMITIVES names it): it is the perturbation, never a
 * sampler and never a wait.
 */

type AwayWindow = Window & {__pageAway?: (on: boolean, hidden: boolean) => void};

/** Install the gate — BEFORE the page loads (a library that captures the frame clock at its start takes the gate). */
export async function installPageAway(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as Window & {__pageAway?: (on: boolean, hidden: boolean) => void};
    if (w.__pageAway !== undefined) {
      return;
    }
    const realRequest = window.requestAnimationFrame.bind(window);
    const realCancel = window.cancelAnimationFrame.bind(window);
    const held = new Map<number, (time: number) => void>();
    let away = false;
    let nextHeld = -1;
    window.requestAnimationFrame = (callback: (time: number) => void): number => {
      if (!away) {
        return realRequest(callback);
      }
      const id = nextHeld--;
      held.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id: number): void => {
      if (id < 0) {
        held.delete(id);
      } else {
        realCancel(id);
      }
    };
    w.__pageAway = (on: boolean, hidden: boolean): void => {
      away = on;
      if (hidden) {
        Object.defineProperty(document, 'visibilityState', {value: on ? 'hidden' : 'visible', configurable: true});
        Object.defineProperty(document, 'hidden', {value: on, configurable: true});
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (!on) {
        const due = [...held.values()];
        held.clear();
        realRequest((time) => due.forEach((callback) => callback(time)));
      }
    };
  });
}

/**
 * The page is not looked at for `ms`, then comes back. Nothing is pressed meanwhile — nobody presses a page they are
 * not looking at. Returns WHAT THE PAGE SAID OF ITSELF at the end of the spell: its `visibilityState`, and the
 * PRODUCT's own word on its paint (`__conWaitGraph().pageStarved` — `kernel/frameWitness.pageStarvedNow`, the state its
 * judges read). A spell that returns no `starved` perturbed nothing.
 */
export async function awayFromConsole(page: Page, ms: number, hidden: boolean, why: string): Promise<{visibility: string, starved: string | undefined}> {
  const set = (on: boolean): Promise<void> => page.evaluate(([flag, tab]) => (window as AwayWindow).__pageAway?.(flag, tab), [on, hidden] as const);
  await set(true);
  try {
    await cinematicBeat(page, ms, why);
    return await page.evaluate(() => {
      const graph = (window as unknown as {__conWaitGraph?: () => {pageStarved?: string | null}}).__conWaitGraph?.();
      return {visibility: document.visibilityState, starved: graph?.pageStarved ?? undefined};
    });
  } finally {
    if (!page.isClosed()) {
      await set(false);
    }
  }
}
