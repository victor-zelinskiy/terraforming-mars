import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, press, settle, waitForBoardHome, crumbText} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR46 «ИССЛЕДОВАТЕЛЬСКИЕ СТАРТАПЫ» — the set's first answer to THE PATENT
 * SALE (+1 data here per card sold; Martian Fiber answers the data with M€)
 * and «ALL the data → as many cards off the deck → keep 1». Against a real
 * server, on two profiles, three fixtures (the Scientists ruling, Martian
 * Fiber on blue's table):
 *
 *   (A) THE PLAY (`research-startups`): the composer names «+3 [data]» and the
 *       Fiber's answer before the press; steel is offered; ONE POST; the
 *       server: 3 data on the card, the Fiber's +3 M€.
 *   (B) THE SALE (`research-startups-sale`, TR46 with 2 data, a hand of six):
 *       the standard-projects row and the hand's sale summary name the table's
 *       answer BEFORE the first pick (per card) and grow it with every pick —
 *       «+4 [data] Исследовательские стартапы · +4 M€ Марсианское оптоволокно ·
 *       20 → 28»; the confirm → the terminal stands the receiving card up, the
 *       data land in ITS capsule (2 → 6) and the Fiber's M€ fly from its face;
 *       every flight's ends visible; the server: data 6, M€ 28.
 *   (C) THE ACTION (`research-startups-action`, 5 data): «5 → 0» and «+1 · of 5
 *       turned over · 4 to the discard» before the press; A → five cards off
 *       the deck INSIDE the workspace (the crumb grows), the pick of one → the
 *       hand; the server: data 0, hand +1, four discarded.
 *
 * Fixtures `research-startups`, `-sale`, `-action`. Heavy 4K: run with
 * `--workers=1`. Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Research Startups';
const FIBER = 'Martian Fiber';
const OUT = path.resolve('screenshots', 'research-startups');
const PLAY_COMPOSER = '.con-composer--play';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, steel: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

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
  return out;
}

/** The sale summary's answer chips, read off their own DOM: «source → its number». */
async function saleAnswers(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const el of Array.from(document.querySelectorAll('.con-hand__salebar [data-sale-answer]'))) {
      out[el.getAttribute('data-sale-answer') ?? ''] = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    return out;
  });
}

const salebarText = async (page: Page) => ((await page.locator('.con-hand__salebar').first().textContent()) ?? '').replace(/\s+/g, ' ').trim();

const focusedRow = async (page: Page) =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

async function focusRow(page: Page, re: RegExp): Promise<void> {
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 6 && !re.test(await focusedRow(page)); i++) {
    await press(page, 'ArrowUp', 200);
  }
  for (let i = 0; i < snake.length && !re.test(await focusedRow(page)); i++) {
    await press(page, snake[i], 240);
  }
  expect(re.test(await focusedRow(page)), `could not focus ${re}`).toBeTruthy();
}

/** setInterval sampler (never rAF): the receivers, their capsules, the data cells — what the terminal shows when. */
async function armSaleProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type S = {t: number, up: boolean, caps: Record<string, string>, phase: string};
    const w = window as unknown as {__sale: Array<S>};
    const samples: Array<S> = [];
    w.__sale = samples;
    const t0 = performance.now();
    window.setInterval(() => {
      const recvs = document.querySelector('.con-sale-hero__recvs');
      const caps: Record<string, string> = {};
      for (const el of Array.from(document.querySelectorAll('.con-sale-hero__recv-card'))) {
        caps[el.getAttribute('data-sale-receiver') ?? ''] = (el.querySelector('.pcard__res-count')?.textContent ?? '').trim();
      }
      samples.push({
        t: Math.round(performance.now() - t0),
        up: recvs !== null && recvs.classList.contains('con-sale-hero__recvs--up'),
        caps,
        phase: document.querySelector('.con-sale-hero') === null ? 'none' : 'hero',
      });
    }, 25);
  });
}

/**
 * The ACTION's beats, sampled on a task clock (never rAF): the prepared stage's own heading (PL-205 — a look turns
 * cards over, it does not receive them), the rest of the batch leaving (`con-exit-reject`) and the kept card's proxy
 * in the delivery layer (PL-207 — the rest leave while the pick is in the air).
 */
async function armActionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type S = {t: number, head: string, rejects: number, carried: number};
    const samples: Array<S> = [];
    (window as unknown as {__act: Array<S>}).__act = samples;
    const t0 = performance.now();
    window.setInterval(() => {
      samples.push({
        t: Math.round(performance.now() - t0),
        head: (document.querySelector('.con-composer__beathead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        rejects: document.querySelectorAll('.con-deckpick .con-exit-reject').length,
        carried: document.querySelectorAll('.con-handdelivery-layer > *').length,
      });
    }, 25);
  });
}

for (const preset of PRESETS) {
  test.describe(`TR46 Research Startups · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) the play: «+3 [data]» and the Fiber's answer before the press, steel offered, ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'research-startups', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 12_000});
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, CARD, slots * 2 + 6), 'the card is focused in the hand').toBe(true);
      for (let i = 0; i < 3 && await page.locator(PLAY_COMPOSER).count() === 0; i++) {
        await press(page, 'Enter', 900);
      }
      await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
      await settle(page);
      // The Fiber's answer to the 3 data stands BEFORE the press: «⚡ Сработает: +3 M€» (its source behind R3).
      const answer = page.locator(`${PLAY_COMPOSER} [data-forecast-row] [data-forecast-chip="own"]`);
      await expect(answer, 'the table\'s answer to the data stands in the composer').toHaveCount(1);
      await expect(answer).toHaveText(/\+3/);
      await expect(page.locator(`${PLAY_COMPOSER} [data-pay-unit="steel"], ${PLAY_COMPOSER} .con-payrow[data-pay-unit="steel"]`).first(), 'steel is offered for the Building tag').toBeVisible();
      // PL-198: on the couch the hero is a quarter of the play composer's zone (PL-139's class, carried over).
      const share = await page.evaluate((root) => {
        const zone = document.querySelector(root)?.getBoundingClientRect();
        const hero = document.querySelector(`${root} .con-composer__playcard .pcard`)?.getBoundingClientRect();
        return zone === undefined || hero === undefined ? 0 : (hero.width * hero.height) / (zone.width * zone.height);
      }, PLAY_COMPOSER);
      console.log(`[${preset.id} a hero share] ${(share * 100).toFixed(1)} %`);
      if (preset.id === 'tv4k') {
        expect(share, 'the hero is at least a quarter of the zone on the TV').toBeGreaterThanOrEqual(0.25);
      }
      await shoot(page, preset.id, 'a-01-composer');
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'play');
      for (let i = 0; i < 8 && await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 250);
      }
      for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
        await press(page, 'Enter', 400);
        await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(seen.posts.length, 'A sent exactly one request').toBe(1);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: '3 data on the card'}).toBe(3);
      const after = await wireOf(request, playerId);
      const paid = (before.thisPlayer.megacredits - after.thisPlayer.megacredits) + 2 * (before.thisPlayer.steel - after.thisPlayer.steel);
      expect(paid - 3, 'the price 8 (M€ + steel at 2), the Fiber paid +3 M€').toBe(8 - 3 - 3);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/research-startups-a-${preset.id}.txt`, transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'a-02-board');
    });

    test(`(B) the sale: the table's answer named before the first pick, growing with it; the terminal pays the data into the card (${preset.id})`, async ({page, request, browser}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'research-startups-sale', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(resourcesOf(before, CARD), 'the fixture: 2 data on the card').toBe(2);
      expect(before.cardsInHand?.length, 'the fixture: a hand of six').toBe(6);

      const redContext = await browser.newContext({viewport: preset.viewport});
      const red = await redContext.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await page.bringToFront();

      // ── 1. The standard-projects row names the answer per card (its forecast door).
      await press(page, 'Comma', 1100);
      await press(page, 'Enter', 1400);
      await page.waitForSelector('.con-stdp', {timeout: 15_000});
      await focusRow(page, /продажа патентов/i);
      await settle(page);
      await shoot(page, preset.id, 'b-01-stdp-row');

      // ── 2. The sale summary at 0 / 1 / 4 picks — the rate of the server × the pick.
      await press(page, 'Enter', 1800);
      await page.waitForSelector('.con-stdp .con-hand', {timeout: 15_000});
      await settle(page);
      const zero = await saleAnswers(page);
      expect(Object.keys(zero), 'the table\'s answers stand BEFORE the first pick, in the server\'s order').toEqual([CARD, FIBER]);
      expect(zero[CARD], 'per card').toMatch(/\+1.*Исследовательские стартапы.*за каждую карту/);
      expect(zero[FIBER]).toMatch(/\+1.*Марсианское оптоволокно/);
      await shoot(page, preset.id, 'b-02-sale-0');
      await press(page, 'Enter', 500);
      await expect.poll(() => salebarText(page), {timeout: 5000}).toMatch(/20\s*→\s*22/);
      const one = await saleAnswers(page);
      expect(one[CARD]).toMatch(/\+1/);
      for (let i = 0; i < 3; i++) {
        await press(page, 'ArrowRight', 300);
        await press(page, 'Enter', 400);
      }
      await expect.poll(() => salebarText(page), {timeout: 5000, message: 'the wallet counts the Fiber too'}).toMatch(/20\s*→\s*28/);
      const four = await saleAnswers(page);
      expect(four[CARD], 'the data grow with the pick').toMatch(/\+4/);
      expect(four[FIBER], 'the Fiber grows with them').toMatch(/\+4/);
      await shoot(page, preset.id, 'b-03-sale-4');

      // ── 3. The confirm: the terminal stands the receiving card up; the data land in ITS capsule.
      await armTransferWitness(page);
      await armSaleProbe(page);
      const stop = await storyboard(page, preset.id, 'sale');
      await press(page, 'Period', 300);
      await expect.poll(() => seen.posts.length, {timeout: 10_000}).toBe(1);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: '6 data on the card'}).toBe(6);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, '20 + 4 (the sale) + 4 (the Fiber)').toBe(before.thisPlayer.megacredits + 8);
      expect(after.cardsInHand?.length).toBe(2);
      await page.waitForSelector('.con-sale-hero', {state: 'detached', timeout: 30_000});
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const samples = await page.evaluate(() => (window as unknown as {__sale: Array<{t: number, up: boolean, caps: Record<string, string>}>}).__sale);
      const stood = samples.filter((s) => s.up);
      expect(stood.length, 'the receiving cards stood beside the terminal').toBeGreaterThan(0);
      const caps = [...new Set(samples.map((s) => s.caps[CARD]).filter((c) => c !== undefined && c !== ''))];
      expect(caps, 'the receiving card\'s capsule only climbs: 2, then 6 at the contact — never the result first').toEqual(['2', '6']);
      const witness = await transferWitness(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/research-startups-b-${preset.id}.txt`, transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(witness.landings.some((l) => l.under === `recv:${CARD}`), `the data landed ON the receiving card\n${transferTrail(witness)}`).toBe(true);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'b-04-board');

      // ── 4. Red's journal names the reason: «… за 4 проданных патента».
      await red.bringToFront();
      await settle(red, {timeoutMs: 30_000});
      await press(red, 'KeyR', 900);
      await expect(red.locator('.con-journal'), 'the journal of red opens').toBeVisible({timeout: 10_000});
      await expect.poll(async () => (await red.locator('.con-journal').innerText()).replace(/\s+/g, ' '), {timeout: 20_000, message: 'the journal of red names the reason'}).toMatch(/4 проданных патента/);
      await shoot(red, preset.id, 'b-05-red-journal');
      expect(redErrors, 'no page errors on red').toEqual([]);
      await redContext.close();
    });

    test(`(C) the action: «5 → 0» and «of 5 turned over» before the press; five cards off the deck in the workspace, keep 1 (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'research-startups-action', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(resourcesOf(before, CARD), 'the fixture: 5 data on the card').toBe(5);
      await openCardActions(page);
      const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
      const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
      for (let i = 0; i < 18 && await focused() !== CARD; i++) {
        await press(page, moves[i % moves.length], 260);
      }
      expect(await focused(), 'the action tile of the card is focused').toBe(CARD);
      await openActionFocus(page);
      await settle(page);
      const look = page.locator(`${ACTION_COMPOSER} [data-chip-look]`).first();
      await expect(look, 'the draw chip names how many cards leave the deck').toHaveText(/из 5 вскрытых · 4 в сброс/);
      for (let i = 0; i < 8 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 200);
      }
      await shoot(page, preset.id, 'c-01-composer');
      await armTransferWitness(page);
      await armActionProbe(page);
      const stop = await storyboard(page, preset.id, 'action');
      for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(seen.posts.length, 'A sent exactly one input').toBe(1);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: 'the data leave'}).toBe(0);
      // The pick stands INSIDE the workspace; the crumb grows a stage.
      const pick = page.locator('.con-deckpick');
      await expect(pick, 'the deck pick stands').toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => page.locator('.con-deckpick__slot').count(), {timeout: 15_000, message: 'five cards off the deck'}).toBe(5);
      await expect.poll(async () => page.locator('.con-deckpick[data-flow="choosing"]').count(), {timeout: 15_000}).toBe(1);
      const crumb = await crumbText(page);
      expect(crumb, 'the crumb keeps the card and grows a stage').toMatch(/Исследовательские стартапы/i);
      await shoot(page, preset.id, 'c-02-pick');
      await press(page, 'Enter', 500);
      if (await page.locator('.con-deckpick[data-flow="choosing"]').count() > 0) {
        await press(page, 'Period', 500);
      }
      await expect.poll(async () => (await wireOf(request, playerId)).cardsInHand?.length ?? 0, {timeout: 30_000, message: 'one card into the hand'}).toBe((before.cardsInHand?.length ?? 0) + 1);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const act = await page.evaluate(() => (window as unknown as {__act: Array<{t: number, head: string, rejects: number, carried: number}>}).__act);
      expect(act.length, 'the action probe sampled').toBeGreaterThan(10);
      // PL-205: the prepared stage says the cards are TURNED OVER — four of five go to the discard, none is «received».
      const heads = [...new Set(act.map((s) => s.head).filter((h) => h !== ''))];
      expect(heads.some((h) => /Вскрыты карты/.test(h)), `the stage reads «Вскрыты карты» (${JSON.stringify(heads)})`).toBe(true);
      expect(heads.filter((h) => /Получен[аы] карт/.test(h)), 'never «Получены карты» over a look').toEqual([]);
      // PL-207: the rest start leaving while the kept card is still in the air — never after it has landed.
      const overlap = act.find((s) => s.rejects >= 4 && s.carried >= 1);
      expect(overlap, `the four left behind leave while the pick is carried (${JSON.stringify(act.filter((s) => s.rejects > 0 || s.carried > 0).slice(0, 6))})`).toBeTruthy();
      const witness = await transferWitness(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/research-startups-c-${preset.id}.txt`, transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      // PL-201: the five data LEAVE the hero's capsule as a token (never a bare 5 → 0 tick), drawn into the printed row.
      expect(witness.births.some((b) => b.under === 'hero' && /5/.test(b.value)), `the data's token was born on the hero\n${transferTrail(witness)}`).toBe(true);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'c-03-board');
    });
  });
}
