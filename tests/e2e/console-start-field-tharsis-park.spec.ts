import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {openConsole, pickCards, press, soloGameConfig, submitSummary, waitForStartRelease, walkToSummary} from './consoleStart';

/**
 * THE OWNER'S EXPORT OF 2026-11-01 13:50 (`game-pdb745eb`, game g72f0cf2c5b5a — a fresh game on the box, build
 * 1.2.2207): «только начал партию — в начале уже зависло активация первого действия Tharsis (был ход бота, и т. к. он
 * был скрыт под workspace старта партии, оно зависло на 30 секунд)». The export's one line: `[presentation-ledger]
 * story «board-beat-park» degraded after 30s — the release edge never came — {"watchable":false, "held":
 * ["temperature","oxygenLevel","oceans"]}`. The saves: research → the action phase at 13:48:50 with the temperature
 * −30 → −28 and the oxygen 0 → 1 moved by the BOT, Tharsis owing its first action, the preludes still in hand; the
 * park waited for a board the start's workspace covered, 30 s to the second.
 *
 * The field's table on the real UI: solo against MarsBot (official solo, the second shift), Vastitas Borealis Nova,
 * Ares, the Delta Project, Turmoil Redux, colonies, Venus, promo; Tharsis Republic with Corridors of Power and Unity
 * Campaign. The contract: the opening reaches the corporation's first action WITHOUT the board's story standing
 * unreleased for its whole safety — no `board-beat-park` degrade in the run — and A on the first action puts the city's
 * grid on the board within a beat.
 */
const OUT = path.resolve('screenshots', 'console-start-field-tharsis-park');
const CORP = 'Tharsis Republic';
const PRELUDES = ['Corridors of Power:redux', 'Unity Campaign'];

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', secondShift: true},
  board: 'vastitas borealis nova',
  expansions: {prelude: true, turmoilRedux: true, colonies: true, venus: true, promo: true, ares: true, deltaProject: true},
  customCorporationsList: [CORP],
  startingCorporations: 1,
  customPreludes: PRELUDES,
  startingPreludes: 2,
  draftVariant: true,
});

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

test('the field\'s opening (Tharsis, the bot moving the scales under the start) reaches the first action with no 30 s park', async ({page, request}) => {
  test.setTimeout(480_000);
  const ledger: Array<{at: number, line: string}> = [];
  const started = Date.now();
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('[presentation-ledger]') || t.includes('[start-shadow]') || t.includes('[screen-shadow]') ||
        t.includes('[liveness]') || t.includes('[start-stranded]')) {
      ledger.push({at: Math.round((Date.now() - started) / 1000), line: t.slice(0, 500)});
    }
  });
  const created = await request.post('/api/creategame', {data: CONFIG});
  expect(created.ok(), `the server accepted the config (${created.status()} ${await created.text().catch(() => '')})`).toBeTruthy();
  const {players} = await created.json() as {players: Array<{id: string}>};
  await openConsole(page, players[0].id, '&consoleProfile=tv');

  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        expect(await pickCards(p, [CORP]), 'the corporation was picked').toContain(CORP);
      } else if (kind === 'prelude') {
        expect(await pickCards(p, PRELUDES), 'both preludes were picked').toEqual(expect.arrayContaining(PRELUDES));
      }
    },
  });
  await submitSummary(page);
  const submittedAt = Date.now();

  // The deployment, driven by the deployment's own primitives, up to the corporation's first-action stage — Unity
  // Campaign's colony is built on the hosted colonies' stage (A descends into the focused tile, A builds).
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline && await page.locator('.con-start__firstact').count() === 0) {
    if (await page.locator('.con-colonies').isVisible().catch(() => false)) {
      await press(page, 'Enter', 1500);
      continue;
    }
    await waitForStartRelease(page, 8_000).catch(() => undefined);
  }
  const stageAt = Date.now();
  await shoot(page, '01-first-action-stage');
  const firstAction = page.locator('.con-start__firstact');
  expect(await firstAction.count(), `the first-action stage stands (${JSON.stringify(ledger)})`).toBeGreaterThan(0);

  // A on the first action: the city's grid on the board.
  const gridAt = await expect.poll(async () => {
    if (await page.locator('.con-board--placing').count() === 0) {
      await press(page, 'Enter');
    }
    return page.locator('.con-board--placing').count();
  }, {timeout: 20_000, intervals: [1500]}).toBeGreaterThan(0).then(() => Date.now(), () => -1);
  await shoot(page, '02-the-city-grid');

  const report = `summary → stage ${Math.round((stageAt - submittedAt) / 1000)} s; stage → grid ${gridAt < 0 ? 'never' : `${Math.round((gridAt - stageAt) / 1000)} s`}; lines ${JSON.stringify(ledger)}`;
  console.log(`[field-tharsis] ${report}`);
  expect(ledger.filter((l) => l.line.includes('board-beat-park') && l.line.includes('degraded')),
    `the board's story never stands unreleased for its whole safety (${report})`).toEqual([]);
  expect(gridAt, `A on the first action puts the city's grid on the board (${report})`).toBeGreaterThan(0);
});
