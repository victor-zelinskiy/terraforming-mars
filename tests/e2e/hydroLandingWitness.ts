import {expect, Page} from './consoleTest';
import {readTransient, recordTransient, stopTransient} from './transientRecorder';

/**
 * THE CEREMONY AND THE CLOSE, RECORDED FROM BEFORE THE PRESS (tests.md — a transient is recorded, never polled after
 * the press that starts it). The seat stands for a couple of seconds and the flow then closes ITSELF; a press now
 * waits for the motion it started, so a `waitForSelector` begun after it met a workspace that had already played its
 * ceremony and left (3 / 3 on the box with the motion-aware press — and the same race on any frame slow enough). The
 * recorder keeps every change of «the workspace stands · the seat stands» with the product's own times, so the
 * contract — ceremony → close within the budget — is read off what the product wrote, whenever the spec gets to look.
 */
type Landing = {hydro: boolean, cere: boolean};
export async function armLandingRecord(page: Page): Promise<void> {
  await recordTransient(page, 'hydro-landing', () => {
    const cere = document.querySelector<HTMLElement>('.con-hydro__cere');
    return JSON.stringify({
      hydro: document.querySelector('.con-hydro') !== null,
      cere: cere !== null && cere.getClientRects().length > 0 && getComputedStyle(cere).visibility !== 'hidden',
    });
  });
}
/** Wait for the ceremony's seat, then for the workspace to leave; `closeMs` = between the two, on the product's clock. */
export async function landingClose(page: Page, cereMs: number, closeMs: number): Promise<{cere: boolean, closed: boolean, closeMs: number}> {
  const read = async () => (await readTransient<string>(page, 'hydro-landing')).map((x) => ({t: x.t, ...(JSON.parse(x.v) as Landing)}));
  const cereAt = async () => (await read()).find((x) => x.cere)?.t;
  const closedAt = async (from: number) => (await read()).find((x) => x.t >= from && !x.hydro)?.t;
  await expect.poll(async () => await cereAt() !== undefined, {timeout: cereMs}).toBe(true).catch(() => undefined);
  const seat = await cereAt();
  if (seat === undefined) {
    await stopTransient(page, 'hydro-landing');
    return {cere: false, closed: false, closeMs: 0};
  }
  await expect.poll(async () => await closedAt(seat) !== undefined, {timeout: closeMs}).toBe(true).catch(() => undefined);
  const gone = await closedAt(seat);
  await stopTransient(page, 'hydro-landing');
  return {cere: true, closed: gone !== undefined, closeMs: gone === undefined ? closeMs : gone - seat};
}
