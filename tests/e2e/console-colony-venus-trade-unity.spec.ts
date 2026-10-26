import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, cinematicBeat, crumbText, openCardActions, press, pressUntil, settle, walkFocusUntil} from './consoleStart';
import {armLeakWitness, parliamentWire, strandedReports} from './parliamentDrive';

/**
 * THE UNITY DOOR'S VENUS TRADE ON THE DELEGATE CELL (the 2026-10-26 report, fixture `venus-trade-unity` — the
 * marker on the 7th cell, «2 delegates to a resolution», blue holding Unity's effect): the trade is entered from
 * «ДЕЙСТВИЯ КАРТ › СОЮЗ», so the colonies stand INSIDE the action workspace and the Parliament's vote step nests
 * inside the colonies (card-actions ⊃ colonies ⊃ parliament). The report: the delegates were sent, and the colony
 * grid stayed on screen («ДЕЙСТВИЯ КАРТ › СОЮЗ › ОСМОТР», the fleet already on Venus) over the seat's next action —
 * only a reload helped. The colonies' flow-complete fired while the vote still stood nested above them; the ending
 * was routed through the guarded conclusion only for colonies at the ROOT, so a hosted one dropped its ending.
 *
 * Evidence → screenshots/venus-trade-unity/.
 */

const OUT = path.resolve('screenshots', 'venus-trade-unity');
const VENUS = 'Venus Redux';

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

const readScene = (page: Page) => page.evaluate(() => {
  const ready = (window as unknown as {__conReady?: () => {wsFrames?: Array<string>, holds: Array<string>}}).__conReady?.();
  return {
    cardActions: document.querySelectorAll('.con-cardactions').length,
    colonies: document.querySelectorAll('.con-colonies').length,
    parls: document.querySelectorAll('.con-parl').length,
    zone: document.querySelector('.con-parl')?.closest('[data-embed-slot]')?.getAttribute('data-embed-slot') ?? '(none)',
    crumbs: Array.from(document.querySelectorAll('.con-wshead')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()),
    wsFrames: ready?.wsFrames ?? [],
    holds: ready?.holds ?? [],
  };
});

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

test('Unity door · Venus trade on the delegate cell: the vote nests in the hosted colonies, and the sent delegates end the WHOLE flow', async ({page, request}) => {
  test.setTimeout(420_000);
  const playerId = await bootFixture(page, request, 'venus-trade-unity', {keepColony: VENUS, query: '&consoleProfile=tv'});
  await settle(page);
  await armLeakWitness(page);

  // ДЕЙСТВИЯ КАРТ → the Unity tile → its composer → «Выбрать колонию».
  await openCardActions(page);
  const focusedParty = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-party') ?? '');
  await expect(page.locator('.con-cardactions__tile[data-action-party="Unity"]'), 'the Unity action is in the menu').toHaveCount(1);
  expect(await walkFocusUntil(page, async () => await focusedParty() === 'Unity', focusedParty, 20), 'focus the Unity tile').toBe(true);
  const composer = page.locator('.con-cardactions .con-composer[data-composer-source="party:Unity"]');
  expect(await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 3, settleMs: 1100}), 'A opens the Unity composer').toBeTruthy();
  await settle(page, {timeoutMs: 8_000});
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies').count() > 0, {tries: 3, settleMs: 1200}),
    'A on the commit opens the colony workspace inside the action menu').toBeTruthy();
  await settle(page, {timeoutMs: 15_000});
  expect((await crumbText(page)).toUpperCase(), 'one crumb: the action menu, the party').toContain('ДЕЙСТВИЯ КАРТ');

  await focusTile(page, VENUS);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 3, settleMs: 1500}),
    'A on Venus opens its trade stage').toBeTruthy();
  await settle(page, {timeoutMs: 10_000});
  await shoot(page, '00-trade-review');

  // The trade's confirm — the Unity path is locked, nothing to decide; the income is the vote step.
  await press(page, 'KeyX', 300);
  await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type ?? 'none',
    {timeout: 45_000, message: 'the trade answered with the grant (a party prompt)'}).toBe('party');
  await expect.poll(async () => (await readScene(page)).zone, {timeout: 30_000, message: 'the vote stands embedded in the hosted colonies'})
    .toBe('colonies-parliament');
  await cinematicBeat(page, 1500, 'the vote step settles in its zone');
  const step = await readScene(page);
  console.log('── the vote step ──', JSON.stringify(step));
  await shoot(page, '01-vote-step');
  expect(step.parls, 'ONE Parliament instance').toBe(1);
  expect(step.crumbs.join(' || ').toUpperCase(), 'the crumb roots in the action menu').toContain('ДЕЙСТВИЯ КАРТ');

  // A sends the delegates.
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type ?? 'none',
    {timeout: 30_000, message: 'A answered the grant'}).not.toBe('party');

  // THE REPORT: the whole flow — the action workspace, the colonies, the vote — leaves for the board. Read it on a
  // 1 s grid so a red names where it stuck.
  const reads: Array<Awaited<ReturnType<typeof readScene>> & {t: number}> = [];
  const t0 = Date.now();
  let gone = false;
  for (let i = 0; i < 60 && !gone; i++) {
    const read = await readScene(page);
    reads.push({...read, t: Date.now() - t0});
    gone = read.cardActions + read.colonies + read.parls === 0;
    if (!gone) {
      await cinematicBeat(page, 1000, 'the flow\'s ending is read on a 1 s grid');
    }
  }
  console.log('── after the vote ──\n' + reads.map((r) => JSON.stringify(r)).join('\n'));
  await shoot(page, '02-after-vote');
  expect(gone, `the finished flow leaves for the board (last: ${JSON.stringify(reads[reads.length - 1])})`).toBe(true);
  expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
});
