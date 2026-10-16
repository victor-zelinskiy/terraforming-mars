import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, press, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR48 «СУПЕРКОМПЬЮТЕР» — the set's THIRD card-bound payment unit
 * (`supercomputerData`: the data here pay 2 M€ for a Science card), −1 energy
 * production, and «+2 data on ANY card». Against a real server, on two
 * profiles, three fixtures (the Scientists ruling):
 *
 *   (A) THE PLAY (`supercomputer`, 1 energy production, TR05 on the table): the
 *       composer names «1 → 0» energy production and TR05's +2 data before the
 *       press; ONE POST; the server: production 0, TR05 +2 data.
 *   (B) THE UNIT (`supercomputer-pay`, 4 data, 4 M€ + 2 steel; TR46 and Mine in
 *       hand): the hand's TENDER PLATE names the data on TR46 only (К-H1); TR46's
 *       panel lists «Data» FIRST (the owner's order) beside steel, Mine's panel
 *       has no data lane; A → the data tokens are born on their PAY ROW and
 *       absorbed into the card's cost badge (PL-163); the server: TR48 0 data.
 *   (C) THE ACTION (`supercomputer-action`, 0 data beside four other holders):
 *       «где +2 data»: every candidate's reading of what the 2 do there (К-T1)
 *       — TR48 «+4 M€ · Наука», TR15 «Хватит на делегата: 3 / 3», TR38 «Действие
 *       откроется: 2 / 2», TR46 «Карт к вскрытию: 2 → 4», the Fiber «ПО 0 → 1»;
 *       the pick of TR15 → ONE POST → the data land on TR15's miniature, the
 *       Fiber's +2 M€ after; red's journal names the target.
 *
 * Fixtures `supercomputer`, `-pay`, `-action`. Heavy 4K: run with
 * `--workers=1`. Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Supercomputer';
const STARTUPS = 'Research Startups';
const CENSUS = 'Martian Census';
const SIMS = 'Biological Simulations';
const FIBER = 'Martian Fiber';
const VECTOR = 'Vector Computations';
const OUT = path.resolve('screenshots', 'supercomputer', process.env.TM_E2E_SHOTS_TAG ?? '');
const PLAY_COMPOSER = '.con-composer--play';
const ACTION_COMPOSER = '.con-cardactions .con-composer';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, steel: number, energyProduction?: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

function watchPage(page: Page): {posts: Array<string>, errors: Array<string>} {
  const out = {posts: [] as Array<string>, errors: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => {
    if (/rail-reward|action-commit|transfer/.test(m.text())) {
      console.log(`[page ${m.type()}] ${m.text()}`);
    }
  });
  return out;
}

function writeTrail(preset: string, scene: string, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/supercomputer-${scene}-${preset}.txt`, trail);
}

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1400);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `the hand focused «${card}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY_COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** Walk the cursor to the composer's commit row and press A until ONE request left. */
async function commit(page: Page, root: string, seen: {posts: Array<string>}): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${root} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(seen.posts.length, 'A sent exactly one request').toBe(1);
}

const focusedRow = (page: Page) => text(page, `${ACTION_COMPOSER} .con-composer__row--focused`);
/** The played-target step's focused candidate: 'self' for the «Эта карта» proxy, else the card's name. */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

/** The rail's reading of the focused candidate, every outcome chip with its state (К-T1). */
async function railReading(page: Page): Promise<{text: string, outcomes: Array<string>}> {
  return page.evaluate(() => {
    const rail = document.querySelector('.con-ptsel__rail');
    // TR56 (П4): the digits the tag under the focused card prints (its count, its VP) are the TAG's — read with the rail.
    const tag = document.querySelector('.con-ptsel__cell[data-focused="1"] .con-ptsel__tag');
    return {
      text: `${rail?.textContent ?? ''} | ${tag?.textContent ?? ''}`.replace(/\s+/g, ' ').trim(),
      outcomes: Array.from(rail?.querySelectorAll('[data-impact-outcome]') ?? []).map((el) => el.getAttribute('data-impact-outcome') ?? ''),
    };
  });
}

for (const preset of PRESETS) {
  test.describe(`TR48 Supercomputer · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) the play: «1 → 0» energy production and TR05's answer before the press, ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'supercomputer', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(before.thisPlayer.energyProduction, 'the fixture: 1 energy production').toBe(1);
      await openPlayComposer(page, CARD);
      const production = page.locator(`${PLAY_COMPOSER} .action-effect-chip--cost`).filter({hasText: /1\s*→\s*0/});
      await expect(production.first(), 'the composer names the energy production leaving: 1 → 0').toBeVisible();
      const answer = page.locator(`${PLAY_COMPOSER} [data-forecast-row] [data-forecast-chip="own"]`);
      await expect(answer.first(), 'TR05 answers the Science tag before the press').toBeVisible();
      await expect(answer.first()).toHaveText(/\+2/);
      await shoot(page, preset.id, 'a-01-composer');
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'play');
      await commit(page, PLAY_COMPOSER, seen);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.energyProduction, {timeout: 30_000, message: 'energy production 0'}).toBe(0);
      const after = await wireOf(request, playerId);
      expect(resourcesOf(after, VECTOR), 'TR05 +2 data (the Science tag)').toBe(resourcesOf(before, VECTOR) + 2);
      expect(after.thisPlayer.tableau.map((c) => c.name)).toContain(CARD);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'a', transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'a-02-board');
    });

    test(`(B) the unit: the tender plate, «Data» first beside steel on TR46, none on Mine; the data leave their pay row (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'supercomputer-pay', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(resourcesOf(before, CARD), 'the fixture: 4 data on the card').toBe(4);
      // The satellite: the data's coin reads 2 and wears the Science tag (the rail's context `science`).
      const coin = page.locator('[data-aux-resource^="data"] [data-mc-badge]').first();
      await expect(coin, 'the satellite\'s data coin').toBeVisible();
      await expect(coin).toHaveText(/2/);
      // One tender pool of data: the coin names its «where» in its aria (a second pool would also hang the tag on it — PL-136).
      await expect(coin, 'the coin says where the data pay').toHaveAttribute('aria-label', /Наука/);
      await shoot(page, preset.id, 'b-01-rail');
      // К-H1: the hand names the tender on TR46 (M€ 4 < 8) and nothing on Mine (M€ alone pays it).
      for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
        await press(page, 'Period', 600);
        await press(page, 'Enter', 1400);
      }
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${STARTUPS}"] [data-hand-pay]`), 'TR46 wears the tender plate').toHaveAttribute('data-hand-pay', 'supercomputerData:4');
      await expect(page.locator('.con-hand__slot[data-zoom-slot="Mine"] [data-hand-pay]'), 'Mine wears none').toHaveCount(0);
      await shoot(page, preset.id, 'b-02-hand');
      // Mine's panel: no data lane (no Science tag).
      await openPlayComposer(page, 'Mine');
      await expect(page.locator(`${PLAY_COMPOSER} .con-payrow[data-pay-unit="supercomputerData"]`), 'no data lane on a card without a Science tag').toHaveCount(0);
      await press(page, 'Escape', 900);
      await expect(page.locator(PLAY_COMPOSER), 'back to the hand').toHaveCount(0, {timeout: 15_000});
      // TR46's panel: «Data» FIRST, steel beside it; the opening mix cashes the data (4 × 2 = 8 — exact).
      await openPlayComposer(page, STARTUPS);
      const units = await page.evaluate((root) => Array.from(document.querySelectorAll(`${root} .con-payrow[data-pay-unit]`))
        .map((el) => el.getAttribute('data-pay-unit') ?? ''), PLAY_COMPOSER);
      expect(units.filter((u) => u !== 'megacredits'), 'the panel lists the data FIRST, steel beside them (the owner\'s order)').toEqual(['supercomputerData', 'steel']);
      await expect(page.locator(`${PLAY_COMPOSER} .con-payrow[data-pay-unit="supercomputerData"] .con-payrow__used`), 'four data pay by default').toHaveText('4');
      await expect(page.locator(`${PLAY_COMPOSER} .con-paystatus`), 'exact').toHaveClass(/con-paystatus--exact/);
      await shoot(page, preset.id, 'b-03-payment');
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'pay');
      await commit(page, PLAY_COMPOSER, seen);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: 'the data leave TR48'}).toBe(0);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, 'M€ untouched').toBe(before.thisPlayer.megacredits);
      expect(after.thisPlayer.steel, 'steel kept (data first)').toBe(before.thisPlayer.steel);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'TR46 was played').toContain(STARTUPS);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'b', transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      // PL-163: the price paid with the data is a token per unit — born on the DATA pay row, absorbed into the cost badge.
      const minus = witness.births.filter((e) => e.under === 'payrow:supercomputerData');
      expect(minus.length, `the data price tokens were born on their pay row\n${transferTrail(witness)}`).toBeGreaterThan(0);
      const absorbed = witness.landings.filter((e) => minus.some((m) => m.id === e.id));
      expect(absorbed.every((e) => e.under === 'play-card'), `absorbed into the standing card's cost badge\n${transferTrail(witness)}`).toBe(true);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'b-04-board');
    });

    test(`(C) the action: what +2 data do on each holder (К-T1); TR15 picked → ONE POST, the data on its miniature, the Fiber's +2 M€ (${preset.id})`, async ({page, request, browser}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'supercomputer-action', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect([resourcesOf(before, CARD), resourcesOf(before, CENSUS), resourcesOf(before, STARTUPS), resourcesOf(before, SIMS), resourcesOf(before, FIBER)],
        'the fixture: TR48 0 · TR15 1 · TR46 2 · TR38 0 · the Fiber 0').toEqual([0, 1, 2, 0, 0]);

      const redContext = await browser.newContext({viewport: preset.viewport});
      const red = await redContext.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await page.bringToFront();

      await openCardActions(page);
      const focusedTile = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
      const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
      for (let i = 0; i < 24 && await focusedTile() !== CARD; i++) {
        await press(page, moves[i % moves.length], 260);
      }
      expect(await focusedTile(), 'the action tile of the card is focused').toBe(CARD);
      await openActionFocus(page);
      await settle(page);
      await expect(page.locator(ACTION_COMPOSER), 'the composer stands').toBeVisible();
      // The table's answer to the action stands before the press: the Fiber's +2 M€ (whatever the target).
      const answer = page.locator(`${ACTION_COMPOSER} [data-forecast-row] [data-forecast-chip="own"]`);
      await expect(answer.first(), 'the Fiber answers the 2 data before the press').toBeVisible();
      await expect(answer.first()).toHaveText(/\+2/);
      await shoot(page, preset.id, 'c-01-composer');

      // ── The target step: every candidate's reading of what the 2 do there.
      for (const key of ['ArrowUp', 'ArrowDown']) {
        for (let i = 0; i < 8 && !/получател|Куда/i.test(await focusedRow(page)); i++) {
          await press(page, key, 220);
        }
      }
      expect(await focusedRow(page), 'the target row is focused').toMatch(/получател|Куда/i);
      await press(page, 'Enter', 600);
      await expect(page.locator('.con-ptsel'), 'the played-target step opened').toBeVisible();
      const cells = await page.locator('.con-ptsel__cell').count();
      expect(cells, 'five holders: TR48 itself + four').toBe(5);
      const readings: Record<string, {text: string, outcomes: Array<string>}> = {};
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft']) {
        for (let i = 0; i < 6; i++) {
          const name = await focusedCandidate(page);
          if (name !== '' && readings[name] === undefined) {
            readings[name] = await railReading(page);
          }
          await press(page, key, 220);
        }
      }
      console.log(`[${preset.id} c readings] ${JSON.stringify(readings, null, 1)}`);
      expect(Object.keys(readings).sort(), 'every candidate was read').toEqual(['self', CENSUS, STARTUPS, SIMS, FIBER].sort());
      expect(readings.self.text, 'TR48 itself: the money the 2 data become').toMatch(/Оплата:\s*\+4\s*M€.*Наука/);
      expect(readings[CENSUS].text, 'TR15: a delegate within reach').toMatch(/Хватит на делегата:\s*3\s*\/\s*3/);
      expect(readings[CENSUS].outcomes).toContain('opens');
      expect(readings[SIMS].text, 'TR38: its action opens').toMatch(/Действие откроется:\s*2\s*\/\s*2/);
      expect(readings[STARTUPS].text, 'TR46: two more cards turned over').toMatch(/Карт к вскрытию:\s*2\s*→\s*4/);
      expect(readings[FIBER].text, 'the Fiber: its VP').toMatch(/0\s*→\s*1/);
      expect(Object.values(readings).every((r) => !/\$\{/.test(r.text)), 'no raw template on the rail').toBe(true);
      for (const key of ['ArrowRight', 'ArrowLeft']) {
        for (let i = 0; i < 6 && await focusedCandidate(page) !== CENSUS; i++) {
          await press(page, key, 220);
        }
      }
      expect(await focusedCandidate(page)).toBe(CENSUS);
      await shoot(page, preset.id, 'c-02-target-census');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
      const row = await text(page, `${ACTION_COMPOSER} .con-composer__target`);
      expect(row, 'the answered row carries the outcome').toMatch(/Хватит на делегата/);
      await shoot(page, preset.id, 'c-03-composer-answered');

      await armTransferWitness(page);
      // The commit's rail half, sampled on a task clock (never rAF): its phase and how it ended — a flight that never
      // left names why («not flown», «superseded», a release reason) instead of an empty trail.
      await page.evaluate(() => {
        const w = window as unknown as {__rail: Array<string>, __conReady?: () => Record<string, unknown>};
        w.__rail = [];
        let last = '';
        window.setInterval(() => {
          const ready = w.__conReady?.() ?? {};
          const now = JSON.stringify({rail: ready.actionCommitRail, reward: (ready.railReward as {pending?: unknown} | undefined)?.pending});
          if (now !== last) {
            w.__rail.push(`${Math.round(performance.now())} ${now}`);
            last = now;
          }
        }, 25);
      });
      const stop = await storyboard(page, preset.id, 'action');
      await commit(page, ACTION_COMPOSER, seen);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CENSUS), {timeout: 30_000, message: 'TR15 3 data'}).toBe(3);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'the Fiber +2 M€').toBe(2);
      expect(resourcesOf(after, CARD), 'nothing on TR48').toBe(0);
      await expect(page.locator('.con-ws'), 'the workspace left').toHaveCount(0, {timeout: 40_000});
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'c', transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      const railTrail = (await page.evaluate(() => (window as unknown as {__rail?: Array<string>}).__rail ?? [])).join('\n');
      writeTrail(preset.id, 'c-rail', railTrail);
      expect(witness.landings.some((l) => l.under === `composer-card:${CENSUS}`), `the data landed on TR15's miniature in the composer\n${transferTrail(witness)}\n${railTrail}`).toBe(true);
      // PL-220 — THE TABLE'S ANSWER FLIES FROM ITS PROMISE: the Fiber's +2 M€ is born on the composer's «Сработает» chip
      // (the workspace stands until it has left it) and lands on its rail row — never a bare tick under a dissolving
      // workspace.
      const lastAnswer = await page.evaluate(() => {
        const ready = (window as unknown as {__conReady?: () => {railReward?: {lastAnswer?: {flown: Array<string>, ticked: Array<string>}}}}).__conReady?.();
        return ready?.railReward?.lastAnswer;
      });
      expect(lastAnswer?.flown, `the Fiber's answer flew (not ticked)\n${railTrail}`).toEqual(['stock:megacredits']);
      expect(witness.births.some((b) => b.under === 'forecast:stock:megacredits'),
        `the answer was born on the «Сработает» chip\n${transferTrail(witness)}`).toBe(true);
      expect(witness.landings.some((l) => l.under === 'rail:megacredits'),
        `the answer landed on the M€ row\n${transferTrail(witness)}`).toBe(true);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'c-04-board');

      // ── Red's journal names the target.
      await red.bringToFront();
      await settle(red, {timeoutMs: 30_000});
      await press(red, 'KeyR', 900);
      await expect(red.locator('.con-journal'), 'the journal of red opens').toBeVisible({timeout: 10_000});
      await expect.poll(async () => (await red.locator('.con-journal').innerText()).replace(/\s+/g, ' '), {timeout: 20_000, message: 'red reads the target'}).toMatch(/Марсианская перепись/);
      await shoot(red, preset.id, 'c-05-red-journal');
      expect(redErrors, 'no page errors on red').toEqual([]);
      await redContext.close();
    });
  });
}
