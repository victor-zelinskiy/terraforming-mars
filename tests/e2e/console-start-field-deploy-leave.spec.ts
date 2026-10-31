import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openConsole, press, settle} from './consoleStart';
import type {FixtureName} from './consoleStart';

/**
 * THE START THAT STANDS EMPTY OVER THE MENU — two field tables of 2026-10-31, both cured by the start director's
 * `yield` three seconds after the menu was asked:
 *   · 21:48, export `game-pab1793c` (game g2cb6cfc844aa): Orbital Construction Yard · Established Methods — its
 *     standard project (Air Scrapping) raised Venus;
 *   · 22:15, export `game-pbfed567` (game gbd2cf6a99a8b): Power Generation · Metal-Rich Asteroid — the LAST prelude
 *     raises the temperature, the ruling Greens answer +2 M€.
 * Both times the scene stood serving NOTHING (`flow: deploying`, `flowStage: ready`, no queue, every named blocker
 * free), the strand watchdog silent, and the board-beat park plus the scale-step rating degraded at 30 s — a global
 * parameter moved by the last prelude while the start covered the board. Each table AS SAVED one step before (pink on
 * the prelude pick, both preludes in hand).
 *
 * The contract: the two preludes play on the real UI (A on each; a prelude's own step answered with A), and once the
 * menu is asked the start LEAVES ON ITS OWN — never because the director cured it: a `[start-shadow] cure` /
 * `[start-stranded]` line is the field defect reproduced, and so is a scene still painting with nothing served. The
 * start's diagnosis (`__conStartDiag`, its `settle` terms) is taken 1.5 s after the menu, before any cure could hide it.
 */
const OUT = path.resolve('screenshots', 'console-start-field-deploy-leave');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const promptKind = async (request: Parameters<typeof fetchPlayerModel>[0], playerId: string): Promise<string> => {
  const m = await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {type?: string, title?: string | {message?: string}, startGamePrompt?: {kind?: string}}};
  const wf = m.waitingFor;
  if (wf === undefined) {
    return '-';
  }
  const title = typeof wf.title === 'string' ? wf.title : wf.title?.message ?? '';
  const menu = /^Take your (first|next) action$/.test(title) ? ':menu' : '';
  return `${wf.type}:${wf.startGamePrompt?.kind ?? ''}${menu}«${title}»`;
};

const startState = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('.con-start') as HTMLElement | null;
  return {
    mounted: el !== null,
    painted: el !== null && el.checkVisibility({opacityProperty: true, visibilityProperty: true}),
    serves: el?.getAttribute('data-start-serves') ?? '',
  };
});

const TABLES: ReadonlyArray<FixtureName> = ['field-start-deploy-leave', 'field-start-deploy-param'];

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

for (const fixture of TABLES) {
  test(`${fixture}: the last prelude played → the menu asked → the start LEAVES by itself (no cure, no empty scene)`, async ({page, request}) => {
    test.setTimeout(300_000);
    const cures: Array<string> = [];
    page.on('console', (m) => {
      const t = m.text();
      if (t.includes('[start-shadow] cure') || t.includes('[start-stranded]')) {
        cures.push(t.slice(0, 300));
      }
    });
    const booted = await bootFixtureSeats(page, request, fixture, {query: '&consoleProfile=tv', landing: 'prompt'});
    let playerId = booted.playerId;
    for (const id of booted.seats) {
      const m = await fetchPlayerModel(request, id) as unknown as {thisPlayer?: {color?: string}};
      if (m.thisPlayer?.color === 'pink') {
        playerId = id;
      }
    }
    expect(await promptKind(request, playerId), 'pink opens on the prelude pick').toMatch(/^card:preludeSelection/);
    await openConsole(page, playerId, '&consoleProfile=tv');
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, `${fixture}-01-preludes`);

    // ── The two preludes, the player's way: A plays the focused one; a prelude's own step is answered with A too (up to
    //    three presses per server prompt, each judged by the prompt MOVING). ──
    for (let step = 0; step < 8; step++) {
      const before = await promptKind(request, playerId);
      if (before === '-' || before.includes(':menu')) {
        break;
      }
      let moved = false;
      for (let tap = 0; tap < 3 && !moved; tap++) {
        await settle(page, {timeoutMs: 20_000});
        await press(page, 'Enter', 900);
        // STATE, never a sleep: the server's prompt polled until it moves (or the beat's budget is spent).
        moved = await expect.poll(async () => (await promptKind(request, playerId)) !== before, {timeout: 12_000, intervals: [400]}).toBe(true)
          .then(() => true, () => false);
      }
      expect(moved, `A answers «${before}» within three presses`).toBe(true);
    }
    const menuAt = Date.now();
    expect(await promptKind(request, playerId), 'the game proper has begun — the action menu is asked').toContain(':menu');

    // ── THE DIAGNOSIS while the scene stands (1.5 s after the menu — before the director's 3 s cure could hide it). ──
    await expect.poll(async () => Date.now() - menuAt, {timeout: 5_000, intervals: [250]}).toBeGreaterThan(1500);
    const standing = await startState(page);
    const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conStartDiag?: () => unknown}).__conStartDiag?.() ?? null));
    const diagLine = `at 1.5 s: ${JSON.stringify(standing)} ${diag.slice(0, 1800)}`;
    await shoot(page, `${fixture}-02-at-the-menu`);

    // ── THE LEAVE: the scene stops serving the opening on its own (or has already). ──
    await expect.poll(async () => {
      const s = await startState(page);
      return !s.painted || s.serves === 'yielded' || s.serves === '';
    }, {timeout: 9_000, message: `the start scene lets go of the screen once the menu is asked — ${diagLine}`}).toBe(true);
    const leftAfterMs = Date.now() - menuAt;
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await shoot(page, `${fixture}-03-after`);
    expect(cures, `the start left on its own — no cure, no strand (took ${leftAfterMs} ms; ${diagLine})`).toEqual([]);
  });
}
