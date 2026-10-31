import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openConsole, press, settle, waitForBoardHome} from './consoleStart';
import type {FixtureName} from './consoleStart';

/**
 * THE FIELD'S FIRST-ACTION STAGE — phase 2 of the start director (2026-10-31). The box's per-step saves of 227 real
 * tables put ELEVEN of the twelve long waits past the lobby on ONE prompt: `corporationInitialAction`, the start's own
 * «ПЕРВОЕ ДЕЙСТВИЕ» stage — different games, both human seats (the owner's TV and the LAN Deck), different
 * corporations, the game age ticking between IDENTICAL saves (a reload re-priming the prompt). Four of those tables,
 * taken as saved, on BOTH profiles the field plays on.
 *
 * The contract: the viewer opens onto the stage SERVING the action (`data-start-serves="stage"`, the stage panel, the
 * crumb's «ПЕРВОЕ ДЕЙСТВИЕ»), A takes it (the server's prompt moves on), what the action sets off is presented and
 * the table reaches the game proper — with the harness red on `[start-stranded] confirmed`, `[liveness] stall`,
 * `[workspace-stall] beat`, and the start shadow's findings (a CURE included) filed per test.
 */
const OUT = path.resolve('screenshots', 'console-start-field-first-action');

const TABLES = [
  ['field-first-action-inventrix', 'pink'],
  ['field-first-action-vitor', 'pink'],
  ['field-first-action-celestic', 'red'],
  ['field-first-action-inventrix-owner', 'blue'],
] as const satisfies ReadonlyArray<readonly [FixtureName, string]>;

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: ''},
] as const;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const serves = (page: Page) => page.evaluate(() => document.querySelector('.con-start')?.getAttribute('data-start-serves') ?? '');
/** The server's prompt as a token: `type:startKind[:menu]«title»` (the title is a KEY — never a rendered text). */
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
const FIRST_ACTION = /^or:corporationInitialAction/;

for (const profile of PROFILES) {
  test.describe(`the field's first-action stage · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1});

    for (const [fixture, color] of TABLES) {
      test(`${fixture}: the stage serves the action, A takes it, the table reaches the game — nothing strands`, async ({page, request}) => {
        test.setTimeout(300_000);
        // `landing: 'prompt'` — the driver's default seeds every start prompt of seats[0] over the API, which is the very prompt this
        // stand exists to look at (Celestic's table has one human: the boot answered the first action and opened on the menu).
        const booted = await bootFixtureSeats(page, request, fixture, {query: profile.query, landing: 'prompt'});
        let playerId = booted.playerId;
        for (const id of booted.seats) {
          const m = await fetchPlayerModel(request, id) as unknown as {thisPlayer?: {color?: string}};
          if (m.thisPlayer?.color === color) {
            playerId = id;
          }
        }
        expect(await promptKind(request, playerId), 'the field seat opens ON the first-action prompt').toMatch(FIRST_ACTION);
        await openConsole(page, playerId, profile.query);

        // ── THE STAGE SERVES. ──
        const stage = page.locator('.con-start__firstact');
        await stage.waitFor({state: 'visible', timeout: 60_000});
        await expect.poll(() => serves(page), {timeout: 15_000, message: 'the scene answers «stage» for the first action'}).toBe('stage');
        const crumb = (await page.locator('.con-wshead').innerText()).toUpperCase();
        expect(crumb, 'the crumb names the stage').toContain('ПЕРВОЕ ДЕЙСТВИЕ');
        expect(await page.locator('.con-mandatory').count(), 'no announce plate over the stage').toBe(0);
        await settle(page, {timeoutMs: 20_000});
        await shoot(page, `${profile.id}-${fixture}-01-stage`);

        // ── A TAKES IT: the server's prompt moves on within the chain's honest budget. ──
        await press(page, 'Enter', 800);
        await expect.poll(() => promptKind(request, playerId), {timeout: 30_000, message: 'the first action was taken (the prompt moved on)'})
          .not.toMatch(FIRST_ACTION);
        await settle(page, {timeoutMs: 30_000});
        await shoot(page, `${profile.id}-${fixture}-02-after`);

        // ── WHAT THE ACTION SET OFF is answered the player's way — A on the surface the start hosts for it (Vitor's
        //    award sheet, Celestic's reveal, Inventrix's draw): each press must MOVE the server's prompt within the
        //    chain's budget, or the stage is standing deaf (the field's shape). Bounded: the action menu ends it. ──
        for (let step = 0; step < 6; step++) {
          const before = await promptKind(request, playerId);
          if (before === '-' || before.includes(':menu')) {
            break;
          }
          // A surface may take TWO presses by design (an award's pick → its confirm): up to three A, each given its beat,
          // judged by the SERVER's prompt moving — not by one press.
          let moved = false;
          for (let tap = 0; tap < 3 && !moved; tap++) {
            await settle(page, {timeoutMs: 20_000});
            await press(page, 'Enter', 900);
            // STATE, never a sleep: the server's prompt polled until it moves (or the beat's budget is spent).
            moved = await expect.poll(async () => (await promptKind(request, playerId)) !== before, {timeout: 12_000, intervals: [400]}).toBe(true)
              .then(() => true, () => false);
          }
          expect(moved, `A answers «${before}» within three presses — the prompt moves on`).toBe(true);
        }
        await settle(page, {timeoutMs: 30_000});

        // ── THE TABLE REACHES THE GAME: the start scene leaves; the board (or the sitting) is the player's. ──
        await waitForBoardHome(page, 45);
        expect(await page.locator('.con-start').count(), 'the start scene has left').toBe(0);
        await shoot(page, `${profile.id}-${fixture}-03-game`);
      });
    }
  });
}
