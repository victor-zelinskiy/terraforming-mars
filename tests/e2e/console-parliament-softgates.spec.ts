import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats} from './consoleStart';
import {closeSitting, closeSittingAs, enterSittingByPass, parliament, parliamentWire, turnTo} from './parliamentDrive';

/**
 * THE SOFT GATES ON SCREEN (docs/claude/console/parliament-soft-gates.md — П5 · П6), two seats, the TV profile.
 *
 * The table is ONE PASS before its sitting (red has passed; Architecture Award — a law that asks nobody — leads
 * the vote on blue's delegate). Blue's own pass carries the WHOLE sitting in one response; the walk then plays it
 * from its records — the VERDICT read, the ENACTMENT, the REWARD, the RENEWAL, the RESULTS — with no press in between,
 * and the generation counter does not move while it stands. The results carry the quiet «Ещё в заседании» line for
 * red; blue's «Закрыть заседание» flips the counter and admits blue to the next generation (its research), while red
 * — on the server — still reads its own sitting: nobody waited for anybody. No «Ожидание» anywhere in the sitting.
 *
 * Screens under screenshots/softgates/.
 */
const OUT = path.resolve('screenshots', 'softgates');
const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${TV.id}-${name}.png`)});
}

/** A sampler (setInterval — never rAF) of what the seat SEES: the counter, the sitting, a draft surface, a wait chip. */
type Sample = {t: number, gen: string, parl: boolean, stage: string, draft: boolean, awaitChip: boolean};
async function armSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__softgates?: Array<Sample>};
    const samples: Array<Sample> = [];
    w.__softgates = samples;
    const take = () => {
      samples.push({
        t: Math.round(performance.now()),
        gen: (document.querySelector('.con-status__gen .con-status__value')?.textContent ?? '').trim(),
        parl: document.querySelector('.con-parl') !== null,
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        draft: document.querySelector('.con-draftws') !== null,
        awaitChip: document.querySelector('.con-parl [data-sit-asking]') !== null,
      });
      if (samples.length > 6000) {
        samples.splice(0, 3000);
      }
    };
    take();
    setInterval(take, 50);
  });
}
const samplesOf = (page: Page): Promise<Array<Sample>> => page.evaluate(() => (window as unknown as {__softgates: Array<Sample>}).__softgates);

test.describe(`the soft gates · ${TV.id}`, () => {
  test.use({viewport: TV.viewport});

  test('one pass → the whole sitting walks by itself under its holds → «Закрыть заседание» flips the counter and admits blue alone', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly', {query: TV.query});
    const red = seats[1];
    const start = await parliamentWire(request, blue);
    expect(start.game.phase, 'one pass before the sitting').toBe('action');
    expect(start.game.generation).toBe(1);
    await armSampler(page);
    await shoot(page, '00-one-pass-away');

    // ── THE PASS — the viewer's own submit: the whole sitting rides its response, and it comes up.
    await enterSittingByPass(page, request, blue);
    const after = await parliamentWire(request, blue);
    expect(after.game.generation, 'the next generation already runs on the server').toBe(2);
    expect(after.waitingFor?.parliamentPhasePrompt?.stage, 'blue holds its ONE confirmation').toBe('close');
    expect(after.game.parliament?.phase?.step, 'for blue the sitting stands at its end').toBe('done');
    expect(after.game.parliament?.sitting?.pending.length, 'both seats still to close it').toBe(2);
    const redWire = await parliamentWire(request, red);
    expect(redWire.waitingFor?.parliamentPhasePrompt?.stage, 'red holds its own confirmation — nothing of generation 2').toBe('close');

    await shoot(page, '01-sitting-up');
    // ── THE WALK: every page turns by itself — the verdict included — up to the RESULTS, the one stop.
    expect(await turnTo(page, 'enact', 60_000), 'the verdict is read, then the walk goes on — no press').toBe(true);
    await shoot(page, '02-enact');
    expect(await turnTo(page, 'results', 120_000), 'the walk reaches the results by itself').toBe(true);
    await expect(page.locator('[data-sit-row="results-in-sitting"] [data-sit-in-sitting]'), 'the quiet line names red, still in its sitting').toHaveCount(1, {timeout: 20_000});
    // The seat chips name where each seat IS — both still in the sitting, never the phase-derived «Покупка карт».
    await expect.poll(async () => (await page.locator('.con-status').innerText()).includes('ЗАСЕДАНИЕ'), {timeout: 10_000}).toBe(true);
    await shoot(page, '03-results-red-still-in-sitting');

    const walk = (await samplesOf(page)).filter((s) => s.parl);
    expect(walk.length, 'the sampler saw the sitting').toBeGreaterThan(10);
    const stages = [...new Set(walk.map((s) => s.stage).filter((s) => s !== ''))];
    expect(stages, 'the walk played its pages in order').toEqual(expect.arrayContaining(['verdict', 'enact', 'reward', 'renewal', 'results']));
    expect(stages.indexOf('verdict'), 'it starts on the verdict').toBe(0);
    expect(walk.every((s) => s.gen === '1'), `the counter holds generation 1 while the sitting stands (${[...new Set(walk.map((s) => s.gen))].join(',')})`).toBe(true);
    expect(walk.some((s) => s.draft), 'no draft surface over the open sitting').toBe(false);
    expect(walk.some((s) => s.awaitChip), 'no «Ожидание» in a sitting whose law asks nobody').toBe(false);

    // ── «ЗАКРЫТЬ ЗАСЕДАНИЕ»: blue alone is admitted — the counter flips, the research is blue's.
    await closeSitting(page, request, blue);
    await expect(parliament(page), 'the sitting leaves with its close').toHaveCount(0, {timeout: 30_000});
    await expect.poll(async () => (await samplesOf(page)).slice(-1)[0]?.gen, {timeout: 20_000, message: 'the counter flips at the close'}).toBe('2');
    const admitted = await parliamentWire(request, blue);
    expect(admitted.waitingFor?.type, 'blue holds its research buy').toBe('card');
    expect(admitted.waitingFor?.parliamentPhasePrompt).toBeUndefined();
    const stillRed = await parliamentWire(request, red);
    expect(stillRed.waitingFor?.parliamentPhasePrompt?.stage, 'red still reads its sitting — nobody waited for it').toBe('close');
    await shoot(page, '04-blue-admitted-red-in-sitting');

    // ── RED CLOSES over the API: red is admitted; the record goes.
    await closeSittingAs(request, red);
    await expect.poll(async () => (await parliamentWire(request, red)).waitingFor?.type, {timeout: 20_000}).toBe('card');
    expect((await parliamentWire(request, blue)).game.parliament?.sitting, 'nothing owed').toBeUndefined();
  });
});
