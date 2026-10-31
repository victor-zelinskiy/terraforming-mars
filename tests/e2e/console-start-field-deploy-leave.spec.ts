import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openConsole, press, settle} from './consoleStart';

/**
 * THE FIRST FIELD CURE OF THE START DIRECTOR — 2026-10-31 21:48, the owner's export `game-pab1793c` (game
 * g2cb6cfc844aa, a solo table against MarsBot, the TV): pink played the LAST of two preludes, the server asked the
 * action menu and the start scene stood over it serving NOTHING for three seconds (`flow: deploying`, `flowStage:
 * ready`, no queue card, no blocker but the menu itself; the strand watchdog silent — masked by a hold the shadow does
 * not read) until the shadow's `cure «yield»` handed the screen to the shell. The table AS SAVED one step before
 * (`field-start-deploy-leave`: pink on the prelude pick, both preludes in hand).
 *
 * The contract: the two preludes play on the real UI (A on each, their steps answered the player's way), and once the
 * menu is asked the start LEAVES ON ITS OWN — within the strand watchdog's own grace — without the director having to
 * cure it: a `[start-shadow] cure` line here is the field defect reproduced (the stand is RED on it), and so is a
 * scene still painting with nothing served once the menu stands.
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
    bar: (document.querySelector('.con-cmdbar, .con-bar, [data-command-bar]')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
  };
});

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

test('the deployment\'s last prelude played → the menu asked → the start LEAVES by itself (no cure, no empty scene)', async ({page, request}) => {
  test.setTimeout(300_000);
  const cures: Array<string> = [];
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('[start-shadow] cure') || t.includes('[start-stranded]')) {
      cures.push(t.slice(0, 300));
    }
  });
  const booted = await bootFixtureSeats(page, request, 'field-start-deploy-leave', {query: '&consoleProfile=tv', landing: 'prompt'});
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
  await shoot(page, '01-preludes');

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

  // ── THE LEAVE: the scene stops serving the opening on its own, within the strand watchdog's grace (2.5 s to its
  //    first heal, 5 s to its yield) plus the deployment's own closing beat — and NOT because the director cured it. ──
  await expect.poll(async () => {
    const s = await startState(page);
    return !s.painted || s.serves === 'yielded' || s.serves === '';
  }, {timeout: 9_000, message: 'the start scene lets go of the screen once the menu is asked'}).toBe(true);
  const leftAfterMs = Date.now() - menuAt;
  await settle(page, {timeoutMs: 20_000});
  await shoot(page, '02-after-the-last-prelude');
  expect(cures, `the start left on its own — no cure, no strand (took ${leftAfterMs} ms)`).toEqual([]);
});
