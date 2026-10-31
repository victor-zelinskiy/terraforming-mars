import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, cinematicBeat, fetchPlayerModel, openCardActions, press, pressUntil, settle, walkFocusUntil} from './consoleStart';
import type {FixtureName} from './consoleStart';

/**
 * THE UNITY FREE TRADE WITH AN OWNED REDUX VENUS — the owner's field freeze of 2026-10-31 (game gce2206994265: «при
 * торговле на redux колонии "венера" сработал бонус, вытянулась карта и экран завис — помог только перезаход»). ONE
 * answer carries the fixed Venus step (the park holds the value, the step-rating beat its rating — both waiting for a
 * board the trade's own surfaces cover), the marker's floaters into a holder, the owner bonus's drawn card AND its
 * mandatory discard, inside «ДЕЙСТВИЯ КАРТ › СОЮЗ › ВЕНЕРА».
 *
 * Three tables: the FIELD's own (`field-venus-unity-trade` — the owner's save, Fringe Colony replayed through the
 * engine: three seats, a human rival, MarsBot, a campaign mission), and two reduced ones (solo; two seats with the
 * trade as the turn's second action, so its answer passes the move). On each the player's natural presses — take the
 * card, open the discard, discard — must carry the flow to the board in seconds, with NOTHING stalled on the way (the
 * harness is red on `[liveness] stall` and `[workspace-stall] beat`); the two board stories play AFTER the workspace
 * leaves, on the board they waited for.
 *
 * Evidence → screenshots/venus-unity-bonus/.
 */
const OUT = path.resolve('screenshots', 'venus-unity-bonus');
const VENUS = 'Venus Redux';
const TABLES = ['field-venus-unity-trade', 'venus-trade-unity-bonus', 'venus-trade-unity-bonus-2p'] as const satisfies ReadonlyArray<FixtureName>;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

/** Geometry-steered walk of the action centre to ONE tile (the field's table has fifteen cards). */
async function focusActionTile(page: Page, selector: string, focused: () => Promise<string>, want: string): Promise<void> {
  for (let i = 0; i < 40 && await focused() !== want; i++) {
    const dir = await page.evaluate((sel) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(sel)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, selector);
    await press(page, dir, 260);
  }
  if (await focused() !== want) {
    expect(await walkFocusUntil(page, async () => await focused() === want, focused, 40), `focus ${want}`).toBe(true);
  }
}

const barOf = (page: Page) => page.evaluate(() => (document.querySelector('.con-cmdbar, .con-bar, [data-command-bar]')?.textContent ?? '').replace(/\s+/g, ' '));
const sceneOf = (page: Page) => page.evaluate(() => {
  const ready = (window as unknown as {__conReady?: () => {holds: Array<string>, wsFrames: Array<string>}}).__conReady?.();
  const q = (s: string) => document.querySelectorAll(s).length;
  return {ws: q('.con-ws'), hand: q('.con-hand'), reveal: q('.con-reveal'), holds: ready?.holds ?? [], frames: ready?.wsFrames ?? []};
});

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

for (const fixture of TABLES) {
  test(`${fixture} · the Unity free trade with an owned Venus: take → the discard's door → discard → the board, nothing stalled`, async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await bootFixture(page, request, fixture, {keepColony: VENUS, query: '&consoleProfile=tv'});
    await settle(page);

    // ДЕЙСТВИЯ КАРТ → the Unity tile → its composer → the colonies inside it → Venus → its trade stage.
    await openCardActions(page);
    const focusedParty = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-party') ?? '');
    await expect(page.locator('.con-cardactions__tile[data-action-party="Unity"]'), 'the Unity action is in the menu').toHaveCount(1);
    await focusActionTile(page, '[data-action-party="Unity"]', focusedParty, 'Unity');
    const composer = page.locator('.con-cardactions .con-composer[data-composer-source="party:Unity"]');
    expect(await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 3, settleMs: 1100}), 'A opens the Unity composer').toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies').count() > 0, {tries: 3, settleMs: 1200}),
      'A on the commit opens the colony workspace inside the action menu').toBeTruthy();
    await settle(page, {timeoutMs: 15_000});
    await focusTile(page, VENUS);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 3, settleMs: 1500}),
      'A on Venus opens its trade stage').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    // The floaters' TARGET (two holders — a real pick): walk the «--missing» rows and answer each with its focused candidate.
    for (let i = 0; i < 6 && await page.locator('.con-colfocus__steprow--missing').count() > 0; i++) {
      const focusedMissing = await page.evaluate(() => document.querySelector('.con-colfocus__steprow--focused')?.classList.contains('con-colfocus__steprow--missing') ?? false);
      if (!focusedMissing) {
        await press(page, 'ArrowDown', 350);
        continue;
      }
      await press(page, 'Enter', 900);
      await press(page, 'Enter', 900);
    }
    await shoot(page, `${fixture}-01-trade-ready`);

    // ── THE COMMIT: Venus moves by the trade's fixed step.
    const before = await fetchPlayerModel(request, playerId) as unknown as {game: {venusScaleLevel: number}};
    await press(page, 'KeyX', 300);
    await expect.poll(async () => ((await fetchPlayerModel(request, playerId)) as unknown as {game: {venusScaleLevel: number}}).game.venusScaleLevel,
      {timeout: 45_000, message: 'the trade committed (Venus moved)'}).toBe(before.game.venusScaleLevel + 2);

    // ── THE PLAYER'S PRESSES, each as soon as the bar offers it.
    await expect.poll(async () => (await barOf(page)).includes('Взять'), {timeout: 30_000, message: 'the drawn card becomes takeable'}).toBe(true);
    expect(await pressUntil(page, 'Enter', async () => (await barOf(page)).includes('для сброса'), {tries: 6, settleMs: 1200}),
      'A takes the drawn card — the bar then offers the discard\'s door').toBeTruthy();
    await shoot(page, `${fixture}-02-taken`);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 6, settleMs: 1200}),
      'A opens the discard INSIDE the colonies (the hand hosted in the workspace)').toBeTruthy();
    expect((await sceneOf(page)).frames.join(';'), 'the hand stands as a step of the hosted colonies').toContain('colonies-hand');
    await shoot(page, `${fixture}-03-discard`);
    expect(await pressUntil(page, 'Enter', async () => ((await fetchPlayerModel(request, playerId)) as unknown as {waitingFor?: {type?: string}}).waitingFor?.type !== 'card',
      {tries: 6, settleMs: 1500}), 'A discards the focused card — the server moves past the discard').toBeTruthy();

    // ── THE ENDING: the whole flow leaves for the board within seconds, and the board stories play there.
    let home = false;
    const reads: Array<string> = [];
    for (let i = 0; i < 25 && !home; i++) {
      const s = await sceneOf(page);
      reads.push(`${i}s ws=${s.ws} hand=${s.hand} reveal=${s.reveal} holds=${s.holds.join(',')} frames=${s.frames.join(';')}`);
      home = s.ws === 0 && s.hand === 0 && s.reveal === 0;
      if (!home) {
        await cinematicBeat(page, 1000, 'the flow\'s ending on a 1 s grid');
      }
    }
    await shoot(page, `${fixture}-04-end`);
    expect(home, `the finished trade leaves for the board (${reads.join(' | ')})`).toBe(true);
    await settle(page, {timeoutMs: 20_000});
  });
}
