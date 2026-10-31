import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fetchPlayerModel, openConsole, pickCards, playStartQueue, soloGameConfig, submitSummary, walkToSummary,
} from './consoleStart';

/**
 * THE START THAT STANDS EMPTY OVER THE MENU — the WHOLE opening, as the field played it (2026-10-31 22:15, export
 * `game-pbfed567`, game gbd2cf6a99a8b: solo against MarsBot, Turmoil Redux, Robinson Industries, Power Generation
 * then Metal-Rich Asteroid — the LAST prelude raising the temperature, the ruling Greens answering +2 M€). The scene's
 * LIFETIME HOLD (`holdStartScene`) is armed only by the wizard's summary submit in the same session: a stand that
 * boots onto the prelude pick (`console-start-field-deploy-leave`) never has it, and the shell then drops the scene the
 * moment no start prompt is live — so this one walks the wizard on the real UI first.
 *
 * The contract: once the menu is asked the start LEAVES ON ITS OWN through its deployment release — never because the
 * director cured it (`[start-shadow] cure` / `[start-stranded]` are the field defect reproduced) and never standing
 * past its own release beat. The start's diagnosis (`__conStartDiag` with its `settle` terms) is taken 1.5 s after
 * the menu, before any cure could hide it.
 */
const OUT = path.resolve('screenshots', 'console-start-hold-param-leave');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const CONFIG = soloGameConfig({
  automa: {difficulty: 'normal'},
  expansions: {prelude: true, turmoilRedux: true, colonies: true, venus: true, promo: true},
  customCorporationsList: ['Robinson Industries'],
  startingCorporations: 1,
  customPreludes: ['Power Generation', 'Metal-Rich Asteroid'],
  startingPreludes: 2,
});

const menuAsked = async (request: Parameters<typeof fetchPlayerModel>[0], playerId: string): Promise<boolean> => {
  const m = await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {title?: string | {message?: string}}};
  const t = m.waitingFor?.title;
  const title = typeof t === 'string' ? t : t?.message ?? '';
  return /^Take your (first|next) action$/.test(title);
};

const startState = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('.con-start') as HTMLElement | null;
  return {
    mounted: el !== null,
    painted: el !== null && el.checkVisibility({opacityProperty: true, visibilityProperty: true}),
    serves: el?.getAttribute('data-start-serves') ?? '',
  };
});

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

test('the whole opening → the last prelude raises the temperature → the menu → the start releases itself (no cure)', async ({page, request}) => {
  test.setTimeout(420_000);
  const cures: Array<string> = [];
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('[start-shadow] cure') || t.includes('[start-stranded]')) {
      cures.push(t.slice(0, 400));
    }
  });
  const created = await request.post('/api/creategame', {data: CONFIG});
  expect(created.ok(), 'the server accepted the config').toBeTruthy();
  const {players} = await created.json() as {players: Array<{id: string}>};
  const playerId = players[0].id;
  // The console opens on the WIZARD — nothing answered over the API (that is what would skip the hold).
  await openConsole(page, playerId, '&consoleProfile=tv');

  // ── THE WIZARD on the real UI, and its summary submit — the press that arms the lifetime hold. ──
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        expect(await pickCards(p, ['Robinson Industries']), 'the corporation was picked').toContain('Robinson Industries');
      } else if (kind === 'prelude') {
        expect(await pickCards(p, ['Power Generation', 'Metal-Rich Asteroid']), 'both preludes were picked')
          .toEqual(expect.arrayContaining(['Power Generation', 'Metal-Rich Asteroid']));
      }
    },
  });
  await shoot(page, '01-summary');
  await submitSummary(page);

  // ── THE DEPLOYMENT: Power Generation first (the field's order), so Metal-Rich Asteroid is the LAST prelude. ──
  await playStartQueue(page, {first: 'Power Generation', plays: 10});
  await expect.poll(() => menuAsked(request, playerId), {timeout: 60_000, message: 'the game proper has begun — the action menu is asked'}).toBe(true);
  const menuAt = Date.now();

  // ── THE DIAGNOSIS while the scene may still stand (1.5 s after the menu). ──
  await expect.poll(async () => Date.now() - menuAt, {timeout: 5_000, intervals: [250]}).toBeGreaterThan(1500);
  const standing = await startState(page);
  const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conStartDiag?: () => unknown}).__conStartDiag?.() ?? null));
  const diagLine = `at 1.5 s: ${JSON.stringify(standing)} ${diag.slice(0, 2000)}`;
  await shoot(page, '02-at-the-menu');

  // ── THE LEAVE through the deployment's own release (the scene unmounts — a yield is not a release). ──
  await expect.poll(async () => (await startState(page)).mounted, {
    timeout: 12_000, message: `the start releases itself once the menu is asked — ${diagLine}`,
  }).toBe(false);
  await shoot(page, '03-board');
  expect(cures, `the start released on its own — no cure, no strand (${diagLine})`).toEqual([]);
});
