import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * THE CHROME NEVER FLASHES THROUGH THE OPEN — the verdict rail stays
 * invisible for the WHOLE flight and rises exactly once, after the episode
 * hands over. The shipped defect: the section's mount animation
 * (`con-hand-chrome-in`) OVERRODE `.con-hand--chrome-wait`'s `opacity: 0`
 * for its 480 ms run — the rail faded in mid-flight and snapped back to 0
 * when the animation's fill let go («status rail появляется → пропадает →
 * появляется»). chrome-wait now also sets `animation: none`, and lifting
 * it re-triggers the rise (none → named restarts a CSS animation).
 * The probe records every distinct (presence, opacity, wait, flying)
 * state and asserts no sample ever shows the rail while chrome-wait holds.
 */

test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

async function arm(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Row = {t: number, rail: string, op: string, wait: boolean, cls: string, fly: number};
    const w = window as unknown as {__cf?: {timer: number, rows: Array<Row>}};
    if (w.__cf !== undefined) {
      clearInterval(w.__cf.timer);
    }
    const st = {timer: 0, rows: [] as Array<Row>};
    const t0 = performance.now();
    let last = '';
    const scan = () => {
      const hand = document.querySelector<HTMLElement>('.con-hand');
      const rail = document.querySelector<HTMLElement>('.con-hand__verdictbar');
      const row: Row = {
        t: Math.round(performance.now() - t0),
        rail: rail === null ? 'none' : 'mounted',
        op: rail === null ? '-' : getComputedStyle(rail).opacity,
        wait: hand?.classList.contains('con-hand--chrome-wait') ?? false,
        cls: hand === null ? '(no hand)' : '',
        fly: document.querySelectorAll('.con-handreveal-layer [data-reveal-card]').length,
      };
      const key = `${row.rail}|${row.op}|${String(row.wait)}|${row.cls}|${row.fly > 0 ? 'fly' : 'idle'}`;
      if (key !== last && st.rows.length < 400) {
        last = key;
        st.rows.push(row);
      }
    };
    st.timer = window.setInterval(scan, 8) as unknown as number;
    new MutationObserver(scan).observe(document.body, {childList: true, subtree: true, attributes: true});
    w.__cf = st as never;
    scan();
  });
}

test('trace the verdict rail through the open', async ({page, request}) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('tm_console_album', 'large');
    } catch { /* fine */ }
  });
  await bootIntoGame(page, request, {
    buy: 9,
    config: soloGameConfig({
      players: [{name: 'ChromeFlash', color: 'red', beginner: false, handicap: 0, first: true}],
      seed: 0.37,
    }),
  });
  await waitForTurn(page);
  await page.waitForTimeout(2000);
  await arm(page);
  await press(page, 'Period', 700);
  await press(page, 'Enter', 3200);
  const rows = await page.evaluate(() => {
    const w = window as unknown as {__cf: {timer: number, rows: Array<{t: number, rail: string, op: string, wait: boolean, cls: string, fly: number}>}};
    window.clearInterval(w.__cf.timer);
    return w.__cf.rows;
  });
  for (const r of rows) {
    console.log(`[cf] t=${r.t} rail=${r.rail} op=${r.op} wait=${String(r.wait)} fly=${r.fly} ${r.cls}`);
  }
  expect(rows.length, 'the recorder sampled the open').toBeGreaterThan(2);
  // THE LAW: while chrome-wait holds, the rail paints NOTHING — a mount
  // animation overriding the hold is exactly the flash this file pins.
  const flashes = rows.filter((r) => r.wait && r.rail === 'mounted' && Number.parseFloat(r.op) > 0.05);
  expect(flashes.map((r) => `t=${r.t} op=${r.op}`),
    'the rail painted while chrome-wait held (the mount animation broke through)').toEqual([]);
  // …and it DID rise afterwards (the restarted animation is not dead).
  const rose = rows.some((r) => !r.wait && r.rail === 'mounted' && Number.parseFloat(r.op) > 0.9);
  expect(rose, 'the chrome rose after the handover').toBe(true);
});
