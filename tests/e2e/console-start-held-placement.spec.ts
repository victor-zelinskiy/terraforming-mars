import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  answerPrompt, cinematicBeat, commitFocusedSpace, fetchPlayerModel, openConsole, playQueueCard, press, queueCards, sendPlayerInput, settle,
  takeRevealCards, waitQueueIdle, walkToSpace,
} from './consoleStart';

/**
 * THE START NEVER STANDS EMPTY OVER A QUESTION (the reliability iteration of 2026-10-28 — the owner's field report:
 * Strategic Base Planning → a colony on Triton → the start scene stood blank, crumb «КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ»,
 * while the server waited for the prelude's CITY; only a reload got the player out).
 *
 * The fixture IS the owner's game (`field-start-sbp-triton.json` — campaign mission 2 captured from the box, nobody's
 * preludes played yet): the rival plays Ecology Experts + Experimental Forest over the API (its greenery is a FOREIGN
 * tile owed to the viewer's board while the start covers it), the viewer walks the deployment in the console — Metals
 * Company, then Strategic Base Planning: the colony on Triton in the start's own step, the city on 36 on the board —
 * and the corporation's first action is owed.
 *
 * Asserted along that road:
 *  · while the city is asked and its grid is not lit, the scene is never painted serving something else
 *    (`data-start-serves` ∈ yielded · beat), and the grid lights within a beat of the question;
 *  · the scene never stood «serving nothing» for longer than the watchdog's confirm (sampled every 150 ms) — and the
 *    harness's `startStrandGuard` fails the test on any confirmed `[start-stranded]` besides;
 *  · the first-action stage stands at the end.
 */
const PRESET = {viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const FIXTURE = path.resolve(__dirname, 'fixtures', 'field-start-sbp-triton.json');
const ME = 'French_Fries';
const RIVAL = 'victor';
const OUT = path.resolve('screenshots', 'start-held-placement', 'tv');

type WireOption = {type: string, title?: unknown};
type Wire = {waitingFor?: {type: string, startGamePrompt?: {kind: string}, options?: Array<WireOption>}, thisPlayer: {coloniesCount: number}};
const wireOf = async (r: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(r, id) as unknown as Wire;
type Probe = {samples: Array<string>};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** From now on: the scene's own verdict, every 150 ms (a task clock — never rAF). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__heldProbe: {samples: Array<string>}};
    w.__heldProbe = {samples: []};
    window.setInterval(() => {
      w.__heldProbe.samples.push(document.querySelector('.con-start')?.getAttribute('data-start-serves') ?? 'absent');
    }, 150);
  });
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__heldProbe: Probe}).__heldProbe);

test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

test('the owner\'s start: Strategic Base Planning → Triton → the city lands on the board, the start never stands empty', async ({page, request}) => {
  test.setTimeout(420_000);
  const errors: Array<string> = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = await request.post('/api/dev/load-game', {data: JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))});
  expect(res.ok(), `the dev load-game door accepted the field fixture (status ${res.status()})`).toBeTruthy();
  const model = await res.json() as {players: Array<{id: string, name: string}>};
  const me = model.players.find((p) => p.name === ME)!.id;
  const rival = model.players.find((p) => p.name === RIVAL)!.id;

  // THE RIVAL answers in the background over the API: its preludes (a greenery among them — a foreign tile owed to the
  // viewer's board), then a pass on every action turn.
  let stop = false;
  const rivalLoop = (async () => {
    while (!stop) {
      try {
        const wf = (await wireOf(request, rival)).waitingFor;
        if (wf !== undefined) {
          const pass = (wf.options ?? []).findIndex((o) => JSON.stringify(o.title ?? '').includes('Pass for this generation'));
          await sendPlayerInput(request, rival, wf.type === 'or' && pass >= 0 && wf.startGamePrompt === undefined ?
            {type: 'or', index: pass, response: {type: 'option'}} : answerPrompt(wf as never, {}) as never);
        }
      } catch {
        // the rival's prompt moved between the read and the write — the next round re-reads
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  })();

  try {
    await openConsole(page, me, PRESET.query);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await armProbe(page);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, '01-deployment');

    // THE DEPLOYMENT, as the player walks it: every item of the queue pressed where it stands, Metals Company, then
    // Strategic Base Planning; the colony on Triton in the start's own step, then the prelude's CITY on the board.
    let metalsPlayed = false;
    let sbpPlayed = false;
    let spaceAskedAt = 0;
    let gridLitAfter = -1;
    for (let i = 0; i < 200; i++) {
      const wf = (await wireOf(request, me)).waitingFor;
      if (wf?.type === 'or' && wf.startGamePrompt?.kind === 'corporationInitialAction' && sbpPlayed) {
        break;
      }
      if (await page.locator('.con-reveal').count() > 0) {
        await takeRevealCards(page);
        continue;
      }
      if (wf?.type === 'colony' && await page.locator('.con-coltile').count() > 0) {
        const focused = page.locator('.con-coltile--focused[data-test="con-colony-Triton"]');
        for (let k = 0; k < 8 && await focused.count() === 0; k++) {
          await press(page, 'ArrowRight', 380);
        }
        for (let k = 0; k < 8 && await focused.count() === 0; k++) {
          await press(page, 'ArrowLeft', 380);
        }
        for (let k = 0; k < 4 && await page.locator('.con-colfocus').count() === 0; k++) {
          await press(page, 'Enter', 1500);
        }
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await wireOf(request, me)).thisPlayer.coloniesCount,
          {timeout: 30_000, message: 'the colony on Triton'}).toBe(1);
        continue;
      }
      if (wf?.type === 'space') {
        if (spaceAskedAt === 0) {
          spaceAskedAt = Date.now();
          await shoot(page, '02-city-asked');
        }
        if (await page.locator('.con-board--placing').count() > 0) {
          if (gridLitAfter < 0) {
            gridLitAfter = Date.now() - spaceAskedAt;
            await shoot(page, '03-city-grid');
          }
          await walkToSpace(page, '36');
          await commitFocusedSpace(page);
          await settle(page, {timeoutMs: 30_000});
          continue;
        }
        // The city is asked and its grid is not lit yet: whatever holds it, the START must not stand painted over it.
        const serves = await page.locator('.con-start').getAttribute('data-start-serves', {timeout: 2000}).catch(() => null);
        expect(serves === null || serves === 'yielded' || serves === 'beat',
          `the city is asked — the start yields or moves, never stands serving «${serves}»`).toBe(true);
        await cinematicBeat(page, 400, 'the held city: sampling the scene until its grid lights');
        continue;
      }
      const queue = await queueCards(page);
      if (!metalsPlayed && queue.includes('Metals Company') && !queue.some((c) => c !== 'Metals Company' && c !== 'Strategic Base Planning')) {
        await waitQueueIdle(page);
        metalsPlayed = await playQueueCard(page, 'Metals Company');
        await settle(page, {timeoutMs: 30_000});
        continue;
      }
      if (metalsPlayed && !sbpPlayed && queue.includes('Strategic Base Planning')) {
        await waitQueueIdle(page);
        sbpPlayed = await playQueueCard(page, 'Strategic Base Planning');
        continue;
      }
      // Every other deployment item (the corporation, the campaign bonus, the merges, the payment, the legacy): A on
      // whatever the queue focuses — the real player's press.
      if (!sbpPlayed && wf?.startGamePrompt !== undefined) {
        await press(page, 'Enter', 1800);
        continue;
      }
      if (wf?.type === 'payment') {
        await press(page, 'Enter', 1500);
        continue;
      }
      await cinematicBeat(page, 600, 'the deployment between two answers (the rival plays its preludes over the API)');
    }
    expect(sbpPlayed, 'Strategic Base Planning was played').toBe(true);
    test.info().annotations.push({type: 'city-grid', description: `the grid lit ${gridLitAfter} ms after the city was asked`});
    expect(gridLitAfter, 'the city\'s grid lit').toBeGreaterThanOrEqual(0);
    expect(gridLitAfter, 'the city\'s grid lit within a beat of the question (never the remote landing\'s 20 s bound)').toBeLessThan(12_000);

    // THE END: the city's printed bonus draws a card (cell 36) — the player takes it — and the corporation's first
    // action stands as the start's own stage.
    const endBy = Date.now() + 90_000;
    while (await page.locator('.con-start__firstact').count() === 0 && Date.now() < endBy) {
      if (await page.locator('.con-reveal').count() > 0) {
        await takeRevealCards(page);
        continue;
      }
      await cinematicBeat(page, 500, 'the taken card flies into the dock; the first-action stage enters after it');
    }
    await page.locator('.con-start__firstact').waitFor({timeout: 10_000});
    await shoot(page, '04-first-action');
    const probe = await readProbe(page);
    // An empty sample is legitimate between two answers; a RUN of them longer than the watchdog's confirm is not.
    let run = 0;
    let longest = 0;
    for (const s of probe.samples) {
      run = s === 'none' ? run + 150 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest, `the scene never stood empty for long (${probe.samples.filter((s) => s === 'none').length}/${probe.samples.length} empty samples)`)
      .toBeLessThan(2500);
    expect(errors, 'no page errors').toEqual([]);
  } finally {
    stop = true;
    await rivalLoop.catch(() => undefined);
  }
});
