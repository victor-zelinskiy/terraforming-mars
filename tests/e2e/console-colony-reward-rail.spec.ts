import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, press, soloGameConfig} from './consoleStart';

/**
 * THE COLONY SUMMARY RAIL — the reward PACKAGE, and the overview's ONE verb.
 *
 * Two contracts, one screen:
 *  · «ВАШ ИТОГ» is what the VIEWER ends up with — the track's income plus
 *    their OWN settlements' bonuses, merged per reward type and destination —
 *    «СОСТАВ НАГРАДЫ» is the arithmetic behind it, and «ДРУГИМ ИГРОКАМ» is
 *    everyone else's, deliberately outside the total (it used to sit beside
 *    it and read as part of the payout).
 *  · the overview offers ONE press: «A Выбрать». There is no «X Осмотреть»
 *    (both verbs opened the same stage) and no «К строительству» / «Торговать»
 *    (a destination the overview cannot promise — the stage owns the action
 *    and the reason it may be impossible).
 */

const OUT = path.resolve('screenshots', 'colony-rail');

const CFG = soloGameConfig({
  expansions: {colonies: true},
  // Io pays HEAT on both the track and the owner bonus — the merge case — and
  // the bot owns a settlement there in this seed, so «ДРУГИМ ИГРОКАМ» is real.
  customColoniesList: ['Io', 'Luna', 'Triton', 'Callisto'],
  customCorporationsList: ['CrediCor'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: CFG});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

async function openColoniesAndFocus(page: Page, target: string): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
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

/** The command bar's live contract, as the player reads it. */
async function barLabels(page: Page): Promise<Array<string>> {
  return page.locator('.con-cmdbar__cmd, .con-cmd').allInnerTexts()
    .then((rows) => rows.map((r) => r.replace(/\s+/g, ' ').trim()).filter((r) => r !== ''));
}

test.describe.configure({mode: 'serial'});

test('the colonies OVERVIEW offers one verb: «Выбрать», and no «Осмотреть»', async ({page, request}) => {
  test.setTimeout(300_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 1, keepColony: 'Io'});
  await openColoniesAndFocus(page, 'Io');
  await shoot(page, '01-overview');

  const labels = (await barLabels(page)).join(' | ');
  expect(labels, `the overview bar read: ${labels}`).toMatch(/Выбрать/i);
  expect(labels, 'the overview still advertises «Осмотреть»').not.toMatch(/Осмотр/i);
  expect(labels, 'the overview still names a destination on A').not.toMatch(/строительств|Торговать/i);
});

test('the summary rail reads as a reward PACKAGE (total · breakdown · others)', async ({page, request}) => {
  test.setTimeout(300_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 1, keepColony: 'Io'});
  await openColoniesAndFocus(page, 'Io');
  await press(page, 'Enter', 2200); // A = the focus stage (the only verb)
  expect(await page.locator('.con-colfocus').count(), 'the focus stage did not open').toBeGreaterThan(0);
  await shoot(page, '02-reward-rail');

  const rail = page.locator('.con-colfocus__result');
  const text = (await rail.innerText()).replace(/\s+/g, ' ');
  // The three sections, in the order a player asks the questions.
  expect(text, `the rail read: ${text}`).toMatch(/Ваш итог/i);
  expect(text).toMatch(/Состав награды/i);
  expect(text).toMatch(/Другим игрокам/i);
  // The breakdown names its payers — the track and (when the viewer owns one)
  // their settlements, never a bare pair of numbers.
  expect(text).toMatch(/Торговый трек/i);

  // THE TOTAL IS ONE LINE PER REWARD, and every line carries a reading: a
  // stock pair or a destination. A bare amount is the fault this rework fixed.
  const totals = rail.locator('.con-colfocus__rsec--lead .con-colfocus__rrow--big');
  const n = await totals.count();
  expect(n, 'the total block rendered no reward line').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const row = (await totals.nth(i).innerText()).replace(/\s+/g, ' ').trim();
    expect(row, `a total line with no reading: «${row}»`).toMatch(/→|[А-Яа-я]/);
  }

  // The chip / cover LAUNCH ANCHOR survived the rework — it now rides the
  // track's own value inside the breakdown.
  expect(await page.locator('.con-colfocus [data-colony-trade-source="Io"]').count(),
    'the trade-income launch anchor is gone from the rail').toBeGreaterThan(0);
});
