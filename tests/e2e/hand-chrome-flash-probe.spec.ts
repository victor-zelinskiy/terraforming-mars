import {test, expect, Page} from './consoleTest';
import {bootIntoGame, press, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {armWitness, Witness} from './witness';

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
 *
 * RECORDED off the product's own writes (FLAKE ZERO — `armWitness`, armed
 * before the press): a mutation observer over the document plus a frame
 * tick, every distinct state kept with the page's time — a starved renderer
 * can slow the flash, never hide it between two timer ticks.
 */

test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

type Row = {rail: string, op: string, wait: boolean, cls: string, fly: boolean};

async function arm(page: Page): Promise<Witness<Row>> {
  return armWitness<Row>(page, 'hand-chrome-rail', () => {
    const hand = document.querySelector<HTMLElement>('.con-hand');
    const rail = document.querySelector<HTMLElement>('.con-hand__verdictbar');
    return {
      rail: rail === null ? 'none' : 'mounted',
      op: rail === null ? '-' : getComputedStyle(rail).opacity,
      wait: hand?.classList.contains('con-hand--chrome-wait') ?? false,
      cls: hand === null ? '(no hand)' : '',
      fly: document.querySelector('.con-handreveal-layer [data-reveal-card]') !== null,
    };
  });
}

const rises = (r: Row) => !r.wait && r.rail === 'mounted' && Number.parseFloat(r.op) > 0.9;

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
  // The board home at rest before the record starts (the turn's own arrival
  // played out) — a state, never a fixed pause.
  await settle(page);
  const rec = await arm(page);
  await press(page, 'Period', 700);
  await press(page, 'Enter', 3200);
  // The window ends on the END STATE the claims read — the rail risen after
  // the handover — never on a fixed duration (bounded: never rising is red).
  await rec.waitFor(rises, {timeoutMs: 30_000, message: 'the chrome rose after the handover'}).catch(() => undefined);
  const samples = await rec.stop();
  const t0 = samples[0]?.t ?? 0;
  const rows = samples.map((s) => ({t: s.t - t0, ...s.v}));
  for (const r of rows) {
    console.log(`[cf] t=${r.t} rail=${r.rail} op=${r.op} wait=${String(r.wait)} fly=${String(r.fly)} ${r.cls}`);
  }
  // The recorder's own liveness only (a dead recorder records nothing); the
  // claims below judge the open themselves.
  expect(rows.length, 'the recorder sampled the open').toBeGreaterThan(0);
  // THE LAW: while chrome-wait holds, the rail paints NOTHING — a mount
  // animation overriding the hold is exactly the flash this file pins.
  const flashes = rows.filter((r) => r.wait && r.rail === 'mounted' && Number.parseFloat(r.op) > 0.05);
  expect(flashes.map((r) => `t=${r.t} op=${r.op}`),
    'the rail painted while chrome-wait held (the mount animation broke through)').toEqual([]);
  // …and it DID rise afterwards (the restarted animation is not dead).
  const rose = rows.some(rises);
  expect(rose, 'the chrome rose after the handover').toBe(true);
});
