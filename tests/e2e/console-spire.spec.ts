import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, crumbText, fetchPlayerModel, focusCard, playQueueCard, press, pressUntil, reloadConsole, settle, takeRevealCards, waitQueueIdle, yieldToPurchase} from './consoleStart';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * PC05 SPIRE — «ПЕРВОЕ ДЕЙСТВИЕ „+4 / −3“ — ОДНА ФРАЗА» (docs/claude/prompts/prelude2-pc05-spire-and-full-inclusion.md,
 * ledgers GV · GW). The corporation's first action draws 4 cards and asks, in the SAME response, to discard 3 from the
 * WHOLE hand: one phrase — the draw → the hand → the discard of three.
 *
 *   A · the start (`spire-start` — three projects bought): the reveal (50 M€, 1 science «including this»), then the
 *       first action whole: the briefing, the draw of four, the album of seven, three picks, the discard, the return.
 *
 * Every report and frame: `screenshots/pc05/` (`TM_E2E_STORYBOARD=1` — the storyboard of A).
 */

const CORP = 'Spire';
const BOUGHT = ['Mine', 'Tardigrades', 'Lichen'];
const OUT = path.resolve('screenshots', 'pc05');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type WireCard = {name: string, resources?: number};
type Wire = {
  waitingFor?: {type: string, cards?: Array<WireCard>, discardPrompt?: {source?: {card?: string}}, startGamePrompt?: {kind: string}},
  cardsInHand?: Array<WireCard>,
  thisPlayer: {megacredits: number, tableau: Array<WireCard>},
  game: {gameAge: number, discardPileSize?: number, automa?: {corporation?: {id: string, original: string}}},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const handOf = (w: Wire) => (w.cardsInHand ?? []).map((c) => c.name);
const scienceOf = (w: Wire) => w.thisPlayer.tableau.find((c) => c.name === CORP)?.resources ?? 0;

function writeText(name: string, text: string): void {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, name), text + '\n');
}
async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, PRESET.id, `story-${name}`);
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

/**
 * WHAT THE PLAYER SEES OF THE FIRST ACTION, off the product's own writes: the start's serving answer, the briefing,
 * the deck dealing, a reveal standing (and where), the hand album (where, how many cards, how many fresh, how many
 * picked, its question), the dock's count, a plate, the crumb, the bar.
 */
type Pose = {
  serves: string, firstact: number, deal: number, reveal: string, revealCards: number,
  album: string, slots: number, fresh: number, picked: number, question: string,
  dock: string, plate: number, crumb: string, bar: string, science: string,
};
async function recordFirstAction(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, (): Pose => {
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const painted = (el: Element | null) => el !== null && (el as HTMLElement).offsetWidth > 0 &&
      (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
    const reveals = Array.from(document.querySelectorAll('.con-reveal')).filter(painted);
    const hands = Array.from(document.querySelectorAll('.con-hand')).filter(painted);
    const hand = hands[0];
    const where = (el: Element) => (el.closest('.con-start__handslot') !== null ? 'slot' : el.closest('.con-start') !== null ? 'start' : 'band');
    return {
      serves: document.querySelector('[data-start-serves]')?.getAttribute('data-start-serves') ?? '',
      firstact: document.querySelectorAll('.con-start__firstact').length,
      deal: document.querySelectorAll('.con-deckdraw').length,
      reveal: reveals.map(where).join(','),
      revealCards: reveals.reduce((n, r) => n + r.querySelectorAll('[data-zoom-slot]').length, 0),
      album: hands.map(where).join(','),
      slots: hand === undefined ? 0 : hand.querySelectorAll('.con-hand__slot[data-zoom-slot]').length,
      fresh: hand === undefined ? 0 : hand.querySelectorAll('[data-hand-fresh]').length,
      picked: hand === undefined ? 0 : hand.querySelectorAll('.con-hand__slot--select-picked').length,
      question: text(document.querySelector('.con-hand__question')).slice(0, 80),
      dock: document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? '',
      plate: Array.from(document.querySelectorAll('.con-mandatory')).filter(painted).length,
      crumb: text(document.querySelector('.con-wshead')).slice(0, 90),
      bar: text(document.querySelector('.con-cmdbar')).slice(0, 90),
      science: text(document.querySelector('[data-aux-cards*="Spire"]')).slice(0, 20),
    };
  });
}

function poseReport(label: string, poses: ReadonlyArray<{t: number, v: Pose}>, extra: Array<string> = []): string {
  const lines = [`# ${label}`];
  let last = '';
  for (const s of poses) {
    const line = JSON.stringify(s.v);
    if (line !== last) {
      lines.push(`${Math.round(s.t)} ${line}`);
      last = line;
    }
  }
  return [...lines, ...extra].join('\n');
}

/** Every distinct value a field took, in order. */
function sequence<K extends keyof Pose>(poses: ReadonlyArray<{v: Pose}>, field: K): Array<Pose[K]> {
  const out: Array<Pose[K]> = [];
  for (const s of poses) {
    if (out[out.length - 1] !== s.v[field]) {
      out.push(s.v[field]);
    }
  }
  return out;
}

/** Console lines the start / screen / transfer sentinels write — collected for the report. */
function watchConsole(page: Page): Array<string> {
  const lines: Array<string> = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (/told twice|end not painted|surface folded|start-stranded|start-shadow|screen-shadow|RE-ASKED PRE-SELECT|COVERED PROMPT|\[liveness\]|\[transfer\]/.test(t)) {
      lines.push(t.slice(0, 400));
    }
  });
  return lines;
}

/** The album's focused card — the English name its slot carries. */
const focusedSlot = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-hand .con-hand__slot--selected[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');

/** Pick `names` in the standing album: walk to each, A toggles it in place. */
async function pickInAlbum(page: Page, names: ReadonlyArray<string>): Promise<Array<string>> {
  const picked: Array<string> = [];
  for (const name of names) {
    for (let hop = 0; hop < 16 && await focusedSlot(page) !== name; hop++) {
      await press(page, hop < 8 ? 'ArrowRight' : 'ArrowLeft', 300);
    }
    if (await focusedSlot(page) !== name) {
      continue;
    }
    await press(page, 'Enter', 500);
    picked.push(name);
  }
  return picked;
}

/** The play composer's «⚡ Сработает» line — an EXACT answer of the table reads there. */
const ROWS = '.con-composer--play [data-forecast-row]';

/** OPEN the play composer of `card` and STOP there — the hand through the quick wheel, the card focused, ONE A. */
async function openComposer(page: Page, card: string): Promise<void> {
  const composer = page.locator('.con-composer--play');
  for (let attempt = 0; attempt < 3 && await composer.count() === 0; attempt++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
    await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000}).catch(() => undefined);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    if (!await focusCard(page, card, Math.max(slots, 1) * 3 + 4)) {
      await press(page, 'Escape', 700);
      continue;
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 3, settleMs: 1500});
  }
  await expect(composer, `the play composer of «${card}» stands`).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
}

/** Walk to the composer's commit and press it until the server holds the card on the table. */
async function commitComposer(page: Page, request: APIRequestContext, id: string, card: string): Promise<void> {
  const cta = page.locator('.con-composer--play .con-composer__cta');
  for (let i = 0; i < 10 && !(await cta.getAttribute('class') ?? '').includes('--focused'); i++) {
    await press(page, 'ArrowDown', 250);
  }
  const played = await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === card), {tries: 3, settleMs: 2000});
  expect(played, `«${card}» was played`).toBe(true);
}

const stdpFocused = async (page: Page) => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
/** Walk the standard projects' grid until the focused row matches (home first, then snake through both columns). */
async function focusStdpRow(page: Page, re: RegExp): Promise<void> {
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 6 && !re.test(await stdpFocused(page)); i++) {
    await press(page, 'ArrowUp', 200);
  }
  if (!re.test(await stdpFocused(page))) {
    await press(page, 'ArrowLeft', 200);
  }
  for (let i = 0; i < snake.length && !re.test(await stdpFocused(page)); i++) {
    await press(page, snake[i], 240);
  }
  expect(re.test(await stdpFocused(page)), `could not focus ${re}`).toBeTruthy();
}

test.describe(`PC05 Spire · the first action «+4 / −3» · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · the reveal, then the first action whole: the briefing, the draw of four, the album of seven, three picks, the discard, the return', async ({page, request}) => {
    test.setTimeout(480_000);
    const sentinels = watchConsole(page);
    const id = await bootFixture(page, request, 'spire-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CORP}"]`), 'the corporation stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    expect(await focusCard(page, CORP), `focused «${CORP}»`).toBe(true);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    await shoot(page, 'a-01-queue');
    const promise = (await page.locator('[data-start-prelude-forecast] [data-forecast-row]').allTextContents().catch(() => [])).map((t) => t.replace(/\s+/g, ' ').trim());

    // ── the reveal
    expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
    await expect.poll(async () => scienceOf(await wireOf(request, id)), {timeout: 40_000, message: 'the server: 1 science on Spire'}).toBe(1);
    await waitQueueIdle(page);
    // The three bought projects are paid next («ОПЛАТИТЬ» — the start's purchase), then the first action stands.
    expect(await yieldToPurchase(page), 'the start purchase was paid').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 30_000, message: 'the server: 50 − 9 = 41 M€'}).toBe(41);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);

    // ── the first action: the briefing stands
    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    await shoot(page, 'a-02-briefing');
    const briefing = {
      ask: (await stage.locator('.con-start__firstact-ask').textContent().catch(() => '') ?? '').replace(/\s+/g, ' ').trim(),
      next: (await stage.locator('.con-start__firstact-next').allTextContents().catch(() => [])).map((t) => t.replace(/\s+/g, ' ').trim()),
      chips: (await stage.textContent().catch(() => '') ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
      crumb: await crumbText(page),
    };
    const before = await wireOf(request, id);

    // ── the press, recorded from the frame before it
    await recordFirstAction(page, 'a');
    const stop = await storyboard(page, 'a-first-action');
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.discardPrompt?.source?.card ?? 'none',
      {timeout: 40_000, message: 'the server asks the discard, naming Spire'}).toBe(CORP);
    const asked = await wireOf(request, id);
    // What stands on screen: the draw's reveal first (take it if it stands), then the album.
    await page.locator('.con-reveal, .con-hand').first().waitFor({timeout: 40_000}).catch(() => undefined);
    await shoot(page, 'a-03-after-press');
    if (await page.locator('.con-reveal').count() > 0) {
      await takeRevealCards(page);
    }
    await page.locator('.con-hand').first().waitFor({timeout: 40_000}).catch(() => undefined);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    await shoot(page, 'a-04-album');
    const albumCrumb = await crumbText(page);
    writeText('a-first-action-early.txt', poseReport('A · up to the album', await readTransient<Pose>(page, 'a'), [`albumCrumb ${albumCrumb}`, `sentinels ${JSON.stringify(sentinels)}`]));

    // ── three picks of the bought cards, the fourth refused, RT confirms
    const picked = await pickInAlbum(page, BOUGHT);
    await shoot(page, 'a-05-picked');
    const drawn = handOf(asked).filter((n) => !BOUGHT.includes(n));
    await pickInAlbum(page, [drawn[0]]);
    await shoot(page, 'a-06-fourth');
    const fullRefusal = ((await page.locator('[data-hand-set-full]').first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
    const pileBefore = (await wireOf(request, id)).game.discardPileSize ?? 0;
    for (let i = 0; i < 4 && (await wireOf(request, id)).waitingFor?.discardPrompt !== undefined; i++) {
      await press(page, 'Period', 1500);
    }
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.discardPrompt === undefined,
      {timeout: 30_000, message: 'the discard was answered'}).toBe(true);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await shoot(page, 'a-07-after-discard');
    await stop();
    const after = await wireOf(request, id);

    const poses = await readTransient<Pose>(page, 'a');
    writeText('a-first-action.txt', poseReport('A · the first action', poses, [
      `promise ${JSON.stringify(promise)}`,
      `briefing ${JSON.stringify(briefing)}`,
      `albumCrumb ${albumCrumb}`,
      `picked ${JSON.stringify(picked)}`,
      `before hand ${JSON.stringify(handOf(before))} asked hand ${JSON.stringify(handOf(asked))} after hand ${JSON.stringify(handOf(after))}`,
      `pile ${pileBefore} → ${after.game.discardPileSize}`,
      `serves ${JSON.stringify(sequence(poses, 'serves'))}`,
      `reveal ${JSON.stringify(sequence(poses, 'reveal'))} album ${JSON.stringify(sequence(poses, 'album'))} plate ${JSON.stringify(sequence(poses, 'plate'))}`,
      `dock ${JSON.stringify(sequence(poses, 'dock'))}`,
      `crumb ${JSON.stringify(sequence(poses, 'crumb'))}`,
      `sentinels ${JSON.stringify(sentinels)}`,
    ]));

    // The server: four drawn into a hand of three, three discarded, the first action spent, the bot off its twin.
    expect(handOf(before), 'the three bought cards in the hand').toEqual(expect.arrayContaining(BOUGHT));
    expect(handOf(asked).length, 'the hand of seven when the discard is asked').toBe(7);
    expect(after.cardsInHand?.length, 'four left in the hand').toBe(4);
    expect(after.game.automa?.corporation?.original, 'the bot is never Spire\'s twin C45').not.toBe(CORP);
    expect(after.game.discardPileSize, 'three cards into the discard pile').toBe(pileBefore + 3);
    expect(picked, 'the three bought cards picked').toEqual(BOUGHT);
    expect(sentinels.filter((l) => /told twice|end not painted|surface folded|start-stranded|RE-ASKED|COVERED PROMPT/.test(l)), 'no sentinel').toEqual([]);

    // ── THE PHRASE (decision 9 — the «ДО» verdict: the discard was a PLATE over the start, the album never opened, a
    //    reload lost the step). ① the briefing names both steps; ② the four come ONE batch, taken in the start; ③ only
    //    then the hand opens as the start's step, every card of the hand, the drawn ones marked; ④ three, never four;
    //    and never a plate, never a crumb stepping back to «КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ» between the draw and the discard.
    expect(briefing.ask, '① the ask names the draw and the discard').toMatch(/4 карты.*3 карты/);
    expect(briefing.next.join(' '), '① the next step is named before the press').toMatch(/сбросьте 3 карты/i);
    expect(sequence(poses, 'plate').filter((n) => n > 0), 'no plate announced the discard').toEqual([]);
    const firstReveal = poses.findIndex((p) => p.v.reveal === 'start');
    const firstAlbum = poses.findIndex((p) => p.v.album === 'slot');
    expect(firstReveal, '② the draw is presented INSIDE the start').toBeGreaterThanOrEqual(0);
    expect(Math.max(...poses.map((p) => p.v.revealCards)), '② one batch of four').toBe(4);
    expect(firstAlbum, '③ the album stands in the start\'s hand slot').toBeGreaterThan(firstReveal);
    expect(poses.slice(firstReveal, firstAlbum).every((p) => p.v.album === ''), '③ the album never stood over the batch').toBe(true);
    expect(poses.filter((p) => p.v.album !== '').every((p) => p.v.album === 'slot'), '③ the album never stood outside the start').toBe(true);
    expect(poses[firstAlbum].v.slots, '③ every card of the hand: three bought + four drawn').toBe(7);
    expect(Math.max(...poses.map((p) => p.v.fresh)), '③ the four drawn wear «НОВАЯ КАРТА»').toBe(4);
    expect(Math.max(...poses.map((p) => p.v.picked)), '④ three picked, the fourth refused').toBe(3);
    expect(fullRefusal, '④ the fourth is a NAMED refusal (the limit with its numbers)').toMatch(/3\/3/);
    const backwards = poses.slice(firstReveal, firstAlbum).filter((p) => /^◈Старт партии›Корпорация›/.test(p.v.crumb));
    expect(backwards.map((p) => p.v.crumb), 'the crumb never steps back between the draw and the discard').toEqual([]);
    expect(albumCrumb, 'the crumb names the corporation and the stage').toMatch(/^◈Старт партии›Spire›Сброс карт/);
  });

  test('B · a play from the hand: two tags «Сработает: +1» and a science onto Spire, one tag and a lone wild — silence; no science lane on a card from the hand', async ({page, request}) => {
    test.setTimeout(420_000);
    const sentinels = watchConsole(page);
    const id = await bootFixture(page, request, 'spire-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    expect(scienceOf(await wireOf(request, id)), 'five science on Spire').toBe(5);
    const runs: Array<{card: string, gain: number}> = [
      {card: 'Development Center', gain: 1},
      {card: 'Mine', gain: 0},
      {card: 'Research Coordination', gain: 0},
    ];
    const lines: Array<string> = [];
    for (const run of runs) {
      await openComposer(page, run.card);
      const rows = (await page.locator(ROWS).allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
      const scienceLane = await page.locator('.con-composer--play .con-payrow[data-pay-unit="spireScience"]').count();
      await shoot(page, `b-${run.card.replace(/\s+/g, '-').toLowerCase()}-composer`);
      const before = scienceOf(await wireOf(request, id));
      await commitComposer(page, request, id, run.card);
      await expect.poll(async () => scienceOf(await wireOf(request, id)), {timeout: 30_000, message: `${run.card}: the science on Spire`}).toBe(before + run.gain);
      await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
      lines.push(`${run.card}: rows ${JSON.stringify(rows)} scienceLane ${scienceLane} science ${before} → ${before + run.gain}`);
      expect(scienceLane, `${run.card}: a card from the hand takes no science`).toBe(0);
      if (run.gain > 0) {
        expect(rows.join(' '), `${run.card}: «Сработает: +1» before the press`).toMatch(/\+1/);
      } else {
        expect(rows.filter((r) => /наук/i.test(r)), `${run.card}: Spire forecasts nothing`).toEqual([]);
      }
    }
    writeText('b-plays.txt', [...lines, `sentinels ${JSON.stringify(sentinels)}`].join('\n'));
    expect(sentinels.filter((l) => /told twice|end not painted|surface folded|RE-ASKED|COVERED PROMPT/.test(l)), 'no sentinel').toEqual([]);
  });

  test('C · a standard project paid with science: the lane with its rate and stock, «3 science + 8 M€», the server spent exactly that; D · the role read on the satellite', async ({page, request}) => {
    test.setTimeout(420_000);
    const sentinels = watchConsole(page);
    const id = await bootFixture(page, request, 'spire-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    // ── D · the satellite: Spire's science wears its tender value and its role in words.
    const cell = page.locator('[data-aux-cards*="Spire"]').first();
    await expect(cell, 'the satellite cell of Spire\'s science').toHaveCount(1, {timeout: 20_000});
    const satellite = await cell.evaluate((el) => ({
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      badge: (el.querySelector('[data-mc-badge]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      words: Array.from(el.querySelectorAll('[aria-label], [data-hint]')).map((n) => `${n.getAttribute('aria-label') ?? ''} ${n.getAttribute('data-hint') ?? ''}`.trim()).join(' | '),
    }));
    await shoot(page, 'd-satellite');

    // ── C · the Asteroid standard project (14 M€): the payment step, the science lane.
    const before = await wireOf(request, id);
    const stop = await storyboard(page, 'c-stdp-science');
    await press(page, 'Comma', 1100);
    await press(page, 'Enter', 1400);
    await page.waitForSelector('.con-stdp', {timeout: 15_000});
    await focusStdpRow(page, /Астероид/);
    await press(page, 'Enter', 1400);
    const lane = page.locator('.con-payrow[data-pay-unit="spireScience"]');
    await expect(lane, 'the science lane stands in the payment').toHaveCount(1, {timeout: 20_000});
    const laneRead = await lane.evaluate((el) => ({
      rate: (el.querySelector('.con-payrow__rate')?.textContent ?? '').trim(),
      stock: (el.querySelector('.con-payrow__stock')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }));
    await shoot(page, 'c-01-payment');
    const used = async () => Number((await lane.locator('.con-payrow__used').first().textContent().catch(() => '0') ?? '0').replace(/\D+/g, '') || '0');
    for (let i = 0; i < 8 && await used() < 3; i++) {
      await press(page, 'KeyE', 320);
    }
    for (let i = 0; i < 8 && await used() > 3; i++) {
      await press(page, 'KeyQ', 320);
    }
    await shoot(page, 'c-02-three-science');
    const paid = await used();
    for (let i = 0; i < 4 && scienceOf(await wireOf(request, id)) === 5; i++) {
      await press(page, 'Enter', 1500);
    }
    await expect.poll(async () => scienceOf(await wireOf(request, id)), {timeout: 30_000, message: 'the server took the science'}).toBe(2);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'c-03-after');
    const after = await wireOf(request, id);
    writeText('c-payment.txt', [
      `satellite ${JSON.stringify(satellite)}`,
      `lane ${JSON.stringify(laneRead)} used ${paid}`,
      `M€ ${before.thisPlayer.megacredits} → ${after.thisPlayer.megacredits} · science ${scienceOf(before)} → ${scienceOf(after)}`,
      `sentinels ${JSON.stringify(sentinels)}`,
    ].join('\n'));
    expect(laneRead.rate, 'the lane names its rate').toBe('×2');
    expect(paid, 'three science dialled').toBe(3);
    expect(before.thisPlayer.megacredits - after.thisPlayer.megacredits, '14 − 3 × 2 = 8 M€').toBe(8);
    expect(satellite.badge, 'D · the satellite prints the tender value').toMatch(/2/);
    expect(sentinels.filter((l) => /told twice|end not painted|surface folded|RE-ASKED|COVERED PROMPT/.test(l)), 'no sentinel').toEqual([]);
  });

  test('H · a reload inside the discard: the start stands back up around its step', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'spire-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    expect(await focusCard(page, CORP), `focused «${CORP}»`).toBe(true);
    expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
    await waitQueueIdle(page);
    expect(await yieldToPurchase(page), 'the start purchase was paid').toBe(true);
    await page.locator('.con-start__firstact').waitFor({state: 'visible', timeout: 60_000});
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.discardPrompt?.source?.card ?? 'none',
      {timeout: 40_000, message: 'the server asks the discard'}).toBe(CORP);
    await page.locator('.con-reveal').first().waitFor({timeout: 40_000}).catch(() => undefined);
    if (await page.locator('.con-reveal').count() > 0) {
      await takeRevealCards(page);
    }
    await page.locator('.con-start__handslot .con-hand').first().waitFor({timeout: 60_000});
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await page.locator('.con-hand').first().waitFor({timeout: 60_000}).catch(() => undefined);
    await shoot(page, 'h-01-reload-discard');
    const crumb = await crumbText(page);
    const where = await page.evaluate(() => {
      const hand = document.querySelector('.con-hand');
      return hand === null ? 'none' : hand.closest('.con-start') !== null ? 'start' : 'band';
    });
    writeText('h-reload.txt', `crumb ${crumb}\nalbum ${where}`);
    expect(where, 'the album stands inside the start after the reload').toBe('start');
    expect(crumb, 'the start stands back up around ITS step').toMatch(/^◈Старт партии›Spire›Сброс карт/);
    // …and after the answer, the first action is spent and the start lets go by itself.
    await pickInAlbum(page, BOUGHT);
    for (let i = 0; i < 4 && (await wireOf(request, id)).waitingFor?.discardPrompt !== undefined; i++) {
      await press(page, 'Period', 1500);
    }
    await expect.poll(async () => (await wireOf(request, id)).cardsInHand?.length ?? -1, {timeout: 30_000, message: 'the discard answered after the reload'}).toBe(4);
  });
});
