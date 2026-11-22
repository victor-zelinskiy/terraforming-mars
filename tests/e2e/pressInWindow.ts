import type {Page} from '@playwright/test';
import {expect} from './consoleTest';

/**
 * ⭐ A PRESS THAT MUST LAND INSIDE A WINDOW IS SENT BY THE PAGE, IN THE TASK THAT SEES THE WINDOW OPEN
 * (the e2e writing law 21 — issue #87, the hunt 45036059639: 2 red of 40).
 *
 * «The press arrives WHILE the bought cards are still flying» is a claim about a window the product opens and closes
 * by itself — 0.8 s of flight at the functional motion. A driver that reaches it by its own steps (a poll, a focus
 * read, a hop, the key) spends protocol round-trips between «the window is open» and the press, and on a 300 ms frame
 * the press arrives after the window has shut: the product then HONOURS it, correctly, and the spec calls the honest
 * answer a failure. No amount of care in the driver removes that — every step between the observation and the press is
 * the machine's speed.
 *
 * So the press is ARMED before the action that opens the window: a MutationObserver over the document asks the reader
 * in the very task the product wrote, and the first time the reader answers (anything but `undefined`) the key is
 * dispatched in THAT task — nothing of the driver stands between the two. What the reader answered is kept: it is the
 * stand the press met (what was in the air), read in the same task, and the spec asserts it by name — «the stand was
 * built» and «the product refused» are two different sentences.
 *
 *   const early = await armPressInWindow(page, 'legacy-early', 'Enter', () => rowFocused() ? {flights: n()} : undefined);
 *   … the press that opens the window …
 *   const met = await early.sent();          // the page pressed; this is what stood in that task
 *
 * The reader runs IN THE PAGE and must be self-contained (it is serialized, like a witness's). The key reaches the
 * console's key bridge exactly as a keyboard's does (`window` keydown → keyup). One shot: the observer leaves with it.
 */
export type ArmedPress<T> = {
  /** Wait until the page has sent the press; the reader's answer in the task of the press. */
  sent(opts?: {timeoutMs?: number, message?: string}): Promise<T>,
};

type PressSlot = {sent: boolean, met?: unknown};

export async function armPressInWindow<T>(page: Page, key: string, code: string, open: () => T | undefined): Promise<ArmedPress<T>> {
  await page.evaluate(({key, code, src}) => {
    const read = new Function(`return (${src});`)() as () => unknown;
    const slots = ((window as unknown as {__e2ePressInWindow?: Record<string, PressSlot>}).__e2ePressInWindow ??= {});
    const slot: PressSlot = slots[key] = {sent: false};
    const watch: {mo?: MutationObserver} = {};
    const ask = () => {
      if (slot.sent) {
        return;
      }
      let met: unknown;
      try {
        met = read();
      } catch (_) {
        met = undefined;
      }
      if (met === undefined) {
        return;
      }
      slot.sent = true;
      slot.met = met;
      watch.mo?.disconnect();
      window.dispatchEvent(new KeyboardEvent('keydown', {code, key: code, bubbles: true, cancelable: true}));
      window.dispatchEvent(new KeyboardEvent('keyup', {code, key: code, bubbles: true, cancelable: true}));
    };
    watch.mo = new MutationObserver(ask);
    watch.mo.observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
    ask();
  }, {key, code, src: open.toString()});
  const slotOf = () => page.evaluate((key) =>
    (window as unknown as {__e2ePressInWindow?: Record<string, PressSlot>}).__e2ePressInWindow?.[key] ?? {sent: false}, key);
  return {
    sent: async (opts = {}) => {
      await expect.poll(async () => (await slotOf()).sent, {
        timeout: opts.timeoutMs ?? 30_000,
        message: opts.message ?? `the armed press «${key}» was never sent — its window never opened`,
      }).toBe(true);
      return (await slotOf()).met as T;
    },
  };
}
