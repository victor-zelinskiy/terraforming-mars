import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, cinematicBeat, press, settle} from './consoleStart';
import {armLeakWitness, parliamentWire, strandedReports} from './parliamentDrive';

/**
 * THE REDUX VENUS TRADE ON THE DELEGATE CELLS (the 2026-10-25 report, fixture
 * `venus-trade-delegates` — the marker on the 7th cell, «2 delegates to a
 * resolution»): the trade's income is the Parliament's vote step, and it must
 * open as an EMBEDDED STEP of the colony workspace that paid it — one
 * Parliament instance teleported into the colonies' own zone, the crumb
 * «КОЛОНИИ › ВЕНЕРА › ГОЛОСОВАНИЕ», the pad driving the vote. The report: the
 * Parliament rose OVER the colonies and nothing navigated it; only a reload
 * helped.
 *
 * Evidence → screenshots/venus-trade-delegates/.
 */

const OUT = path.resolve('screenshots', 'venus-trade-delegates');
const VENUS = 'Venus Redux';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
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

type StepRead = {
  parls: number,
  embedded: boolean,
  standalone: boolean,
  zone: string,
  hostStep: boolean,
  colfocus: boolean,
  stage: string,
  crumbs: Array<string>,
  onTop: string,
  wsFrames: Array<string>,
  holds: Array<string>,
  /** The vote's whole text — the reading panel names the resolution under the cursor, so a step changes it. */
  voteText: string,
  /** The colony stage under the step has RECEDED (inert, unpainted) instead of standing over / under the vote. */
  stageReceded: boolean,
  bar: string,
};

const readStep = (page: Page): Promise<StepRead> => page.evaluate(() => {
  const t = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const parl = document.querySelector('.con-parl');
  const r = parl?.getBoundingClientRect();
  const hit = r === undefined ? null : document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const ready = (window as unknown as {__conReady?: () => {wsFrames?: Array<string>, holds: Array<string>}}).__conReady?.();
  return {
    parls: document.querySelectorAll('.con-parl').length,
    embedded: parl?.classList.contains('con-parl--embedded') ?? false,
    standalone: parl?.classList.contains('con-ws') ?? false,
    zone: parl?.closest('[data-embed-slot]')?.getAttribute('data-embed-slot') ?? '(none)',
    hostStep: document.querySelector('[data-colonies-parliament-step]') !== null,
    colfocus: document.querySelector('.con-colfocus') !== null,
    stage: parl?.getAttribute('data-stage') ?? '',
    crumbs: Array.from(document.querySelectorAll('.con-wshead')).map(t),
    onTop: hit === null ? '(none)' : (parl?.contains(hit) ? 'parl' : (hit.closest('[class]')?.className.toString().slice(0, 80) ?? '?')),
    wsFrames: ready?.wsFrames ?? [],
    holds: ready?.holds ?? [],
    voteText: t(parl),
    stageReceded: document.querySelector('.con-colfocus--receded') !== null,
    bar: t(document.querySelector('.con-cmdbar')),
  };
});

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

test('Venus trade on the delegate cells: the vote opens EMBEDDED in the colony workspace and the pad answers it', async ({page, request}) => {
  test.setTimeout(420_000);
  const playerId = await bootFixture(page, request, 'venus-trade-delegates', {keepColony: VENUS, query: '&consoleProfile=tv'});
  await settle(page);
  await armLeakWitness(page);

  await openColonies(page);
  await focusTile(page, VENUS);
  await press(page, 'Enter', 2000);
  expect(await page.locator('.con-colfocus').count(), 'the trade stage did not open').toBeGreaterThan(0);
  await shoot(page, '00-trade-review');

  // The trade's confirm — no decision rows (no card target), the stage commits.
  const before = await parliamentWire(request, playerId);
  console.log('── waitingFor before ──', JSON.stringify(before.waitingFor?.type));
  await press(page, 'KeyX', 300);
  await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type ?? 'none',
    {timeout: 45_000, message: 'the trade answered with the grant (a party prompt)'}).toBe('party');

  // Read the step over its arrival: every 500 ms for 12 s.
  const reads: Array<StepRead & {t: number}> = [];
  const t0 = Date.now();
  for (let i = 0; i < 24; i++) {
    reads.push({...await readStep(page), t: Date.now() - t0});
    await cinematicBeat(page, 500, 'the arrival of the step is read on a 500 ms grid');
  }
  console.log('── the step over its arrival ──\n' + reads.map((r) => JSON.stringify({...r, voteText: r.voteText.slice(0, 80)})).join('\n'));
  await shoot(page, '01-vote-step');

  const step = reads[reads.length - 1];
  expect(step.parls, 'ONE Parliament instance').toBe(1);
  expect(step.embedded, 'the Parliament is EMBEDDED').toBe(true);
  expect(step.standalone, 'never a standalone band').toBe(false);
  expect(step.zone, 'teleported into the colonies\' zone').toBe('colonies-parliament');
  expect(step.onTop, 'the Parliament is the painted surface').toBe('parl');
  expect(step.stage, 'straight into the vote pose').toBe('vote');
  expect(step.crumbs.join(' || '), 'the crumb gains ГОЛОСОВАНИЕ').toMatch(/ГОЛОСОВАНИЕ/i);
  // THE REPORT: the trade stage kept the pad and the bar under the vote («Колонии · B Назад», A dead).
  expect(step.stageReceded, 'the trade stage recedes under the vote').toBe(true);
  expect(step.bar, 'the bar is the VOTE\'s contract').toMatch(/Отправить делегатов/);
  expect(step.bar, 'B minimizes the hosting flow').toMatch(/Свернуть/);

  // The pad drives the vote: → moves the cursor to another resolution, ← back, A sends the delegates.
  await press(page, 'ArrowRight', 600);
  const moved = await readStep(page);
  expect(moved.voteText, '→ moved the vote\'s cursor (the reading panel names another resolution)').not.toBe(step.voteText);
  await press(page, 'ArrowLeft', 600);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type ?? 'none',
    {timeout: 30_000, message: 'A answered the grant'}).not.toBe('party');
  await cinematicBeat(page, 1400, 'the cubes leave the reserve');
  await shoot(page, '02-cubes');

  await expect.poll(async () => page.evaluate(() => document.querySelectorAll('.con-colonies, .con-parl').length),
    {timeout: 60_000, message: 'the finished flow leaves for the board'}).toBe(0);
  await shoot(page, '03-board');
  expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
});
