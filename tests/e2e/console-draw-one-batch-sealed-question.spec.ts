/*
 * «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» · Ф4 host 2 — THE SEALED PLACE of a QUESTION (2026-10-26; contract
 * `docs/claude/console/card-intake-one-batch.md` § Ф4).
 *
 * Mars University played under Olympus Conference: Olympus' answer («remove a science to draw») draws with the press,
 * the university's question («discard a card to draw one») is left for AFTER the draw — so the play's own batch is
 * SEALED by that question (`pendingAnswer {kind: 'question', card: 'Mars University'}`). The console shows the whole
 * press as ONE table in the hand's zone:
 *  ① the sealed batch stands as the strip and ONE place lies face-down under its seal beside it, the seal reading
 *     «Откроется после ответа «Марсианский университет»» — one instance (`data-settlement-table`);
 *  ② the take IS the step: the university asks live (the album) over the parked table;
 *  ③ the discard's touchdown breaks the seal and the answer's card TURNS IN PLACE (`data-settlement-paint`
 *     sealed → turning → open; `.con-deckdraw` deals nothing for it — the deck answers with the turn);
 *  ④ the take ends the flow; the table is gone with it.
 * Fixture `mu-olympus` (the table-question spec's own; its (A) path).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, crumbText, focusCard, press, pressUntil, settle} from './consoleStart';

const OUT = path.resolve('screenshots', 'draw-one-batch');
const OLYMPUS = 'Olympus Conference';
const MU = 'Mars University';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-hand__stage .con-composer--play';
const ALBUM = '.con-hand[data-flow="picking"]';
const zone = '.con-hand__outcome';
const place = (n: number) => `${zone} .con-reveal [data-settlement-place="${n}"]`;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{id: number, actionId?: number, cards: Array<{name: string}>, sealed?: true, pendingAnswer?: {kind: string, card?: string, draws?: true}}>,
  waitingFor?: {type: string, choiceContext?: {source?: {card?: string}}},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}
const handOf = (wire: Wire): Array<string> => (wire.cardsInHand ?? []).map((c) => c.name);

type Sample = {t: number, table: string, paints: Array<[string, string]>, deckDeals: number, reveal: number};
declare global {
  interface Window {
    __questionWatch?: {samples: Array<Sample>, stop: () => void},
  }
}
async function installWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Array<Sample> = [];
    const t0 = performance.now();
    const sample = () => {
      const root = document.querySelector('.con-reveal[data-settlement-table]');
      samples.push({
        t: Math.round(performance.now() - t0),
        table: root?.getAttribute('data-settlement-table') ?? '',
        paints: Array.from(document.querySelectorAll<HTMLElement>('[data-settlement-place]')).map((el) => [el.getAttribute('data-settlement-place') ?? '', el.getAttribute('data-settlement-paint') ?? '']),
        deckDeals: document.querySelectorAll('.con-deckdraw-proxy').length,
        reveal: document.querySelectorAll('.con-reveal').length,
      });
    };
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-settlement-paint', 'data-settlement-table', 'class']});
    const iv = setInterval(sample, 100);
    window.__questionWatch = {samples, stop: () => {
      mo.disconnect();
      clearInterval(iv);
    }};
  });
}
/** ONE press, then the witness polled — never a retry: a second A would land on whatever the first one opened (the hand). */
async function pressOnce(page: Page, key: string, witness: () => Promise<boolean>, what: string, timeout = 30_000): Promise<void> {
  await press(page, key, 300);
  await expect.poll(witness, {timeout, message: what}).toBe(true);
}
/** THE ARRIVAL GATE of the embedded stage: a press before it opens is swallowed by law — wait for it, never retry. */
async function waitArrival(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as unknown as {__conReady?: () => {outcome?: {arrivalDone?: boolean}}}).__conReady?.().outcome?.arrivalDone === true), {timeout: 20_000, message: 'the arrival gate of the stage opened'}).toBe(true);
}
async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}
const rowOf = (page: Page, card: string) => page.locator(`.con-composer--play .con-composer__row--reaction[data-reaction-card="${card}"]`);
const focusedRowOf = (page: Page, card: string) =>
  page.locator(`.con-composer--play .con-composer__row--reaction.con-composer__row--focused[data-reaction-card="${card}"]`);

/** RT → «КАРТЫ» → Mars University → A: its play composer (the table-question spec's door). */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${MU}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, MU, slots * 2 + 6), 'the cursor reached Mars University in the hand').toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
    'A opens the play composer').toBe(true);
  await settle(page);
}

test.describe('the sealed place of a question — the university\'s answer turns beside the play\'s own draw', () => {
  test.setTimeout(420_000);

  test(`Mars University under Olympus · the question left for after the draw · ${PRESET.id}`, async ({page, request}) => {
    await page.setViewportSize(PRESET.viewport);
    const id = await bootFixture(page, request, 'mu-olympus', {query: PRESET.query});
    await openComposer(page);
    // Olympus' question holds the cursor; its first answer draws. The university's row then MAY WAIT (offered, left as is).
    await expect(focusedRowOf(page, OLYMPUS), 'Olympus\' question holds the cursor').toHaveCount(1);
    const options = page.locator('.con-composer--play .con-composer__sublist .con-vchoice__opt');
    expect(await pressUntil(page, 'Enter', async () => await options.count() > 0, {tries: 3, settleMs: 900}), 'A opens Olympus\' answers').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await options.count() === 0, {tries: 3, settleMs: 900}), 'the answer closes the list').toBe(true);
    await settle(page);
    await expect(rowOf(page, MU)).toHaveAttribute('data-tq-state', 'deferred');
    for (let i = 0; i < 6 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
      await press(page, 'ArrowDown', 300);
    }
    await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on «Разыграть карту»').toHaveCount(1);
    const before = handOf(await wireOf(request, id)).filter((n) => n !== MU);
    await installWatch(page);
    await page.keyboard.press('Enter');

    // ① the sealed batch is a TABLE in the hand's zone: the drawn card in the strip, ONE place sealed by the question.
    await expect(page.locator(`${zone} .con-reveal[data-settlement-table]`), 'the play\'s draw stands as a question table').toHaveCount(1, {timeout: 60_000});
    const nonce = await page.locator(`${zone} .con-reveal[data-settlement-table]`).getAttribute('data-settlement-table');
    await expect(page.locator(place(1)), 'the one place lies sealed').toHaveAttribute('data-settlement-paint', 'sealed', {timeout: 30_000});
    await expect(page.locator(`${zone} .con-reveal [data-settlement-seal="1"]`), 'its seal stands').toHaveCount(1);
    await expect(page.locator(`${zone} .con-reveal .con-reveal__bonus-zone-label`), 'the place is the university\'s').toContainText('Марсианский университет');
    await expect(page.locator(`${zone} .con-reveal .con-reveal__sealcond-text`), 'the seal names its condition').toContainText('после ответа');
    await cinematicBeat(page, 1200, 'the drawn card settles');
    await shoot(page, 'D1-question-table');
    test.info().annotations.push({type: 'geometry', description: JSON.stringify(await page.evaluate(() => {
      const box = (sel: string) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r === undefined ? null : [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
      };
      return {reveal: box('.con-hand__outcome .con-reveal'), place: box('[data-settlement-place="1"]'), card: box('.con-hand__outcome .con-reveal [data-zoom-slot]'), fit: document.querySelector('.con-hand__outcome .con-reveal [data-fit]')?.getAttribute('data-fit') ?? null};
    }))});
    const wire1 = await wireOf(request, id);
    const sealed = (wire1.cardDrawReveals ?? []).find((b) => b.pendingAnswer?.kind === 'question');
    // The seal itself is set when the LIVE answer is applied (the input routes); while the question stands the batch
    // announces what it waits on — the pending answer, and that it may draw.
    expect(sealed, 'the batch announces the university\'s question on the wire').toBeDefined();
    expect(sealed?.pendingAnswer).toMatchObject({kind: 'question', card: MU, draws: true});

    // ② the take IS the step — the university asks live, as the album, over the parked table.
    await expect(page.locator('.con-footer'), 'the take\'s own verb').toContainText('Взять', {timeout: 20_000});
    await waitArrival(page);
    await pressOnce(page, 'Enter', async () => await page.locator(`${ALBUM} .con-hand__question [data-decline-plate]`).count() > 0, 'A takes the card — the university asks live', 60_000);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    const wire2 = await wireOf(request, id);
    expect(wire2.waitingFor?.choiceContext?.source?.card, 'the server asks the university now').toBe(MU);
    const drawn = handOf(wire2).filter((n) => !before.includes(n));
    expect(drawn.length, `Olympus' card is in the hand (${handOf(wire2).join(', ')})`).toBe(1);
    expect(await crumbText(page), 'the album is a stage of the play').toContain('Сброс карты');
    await shoot(page, 'D2-question-album');

    // ③ the discard breaks the seal — the answer's card turns IN PLACE: nothing flies a second time.
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, drawn[0], slots * 2 + 6), 'the cursor reached the new card').toBe(true);
    const answered = page.waitForResponse((r) => r.request().method() === 'POST' && /\/player\/input/.test(r.url()));
    await press(page, 'Enter', 900);
    await answered;
    await expect(page.locator(place(1)), 'the place opened in place').toHaveAttribute('data-settlement-paint', 'open', {timeout: 60_000});
    expect(await page.locator(`${zone} .con-reveal[data-settlement-table]`).getAttribute('data-settlement-table'), 'ONE table instance').toBe(nonce);
    await cinematicBeat(page, 1000, 'the turned card settles');
    await shoot(page, 'D3-answer-turned');

    // ④ the take ends the flow; the table goes with it.
    await expect(page.locator('.con-footer')).toContainText('Взять', {timeout: 20_000});
    await waitArrival(page);
    await pressOnce(page, 'Enter', async () => await page.locator(`${zone} .con-reveal`).count() === 0, 'A takes the answer — the table is gone');
    await expect.poll(async () => ((await wireOf(request, id)).cardDrawReveals ?? []).length, {timeout: 30_000}).toBe(0);
    const after = handOf(await wireOf(request, id));
    expect(after.includes(drawn[0]), 'the new card discarded').toBe(false);
    expect(after.length, 'one card drawn back for the discard').toBe(before.length + 1);

    const watch = await page.evaluate(() => {
      window.__questionWatch?.stop();
      return window.__questionWatch?.samples ?? [];
    });
    expect(watch.length).toBeGreaterThan(20);
    const nonces = [...new Set(watch.map((s) => s.table).filter((n) => n !== ''))];
    expect(nonces, 'one table instance for the whole press').toHaveLength(1);
    expect(Math.max(...watch.map((s) => s.reveal)), 'never two reveals').toBeLessThanOrEqual(1);
    const paints1 = watch.map((s) => s.paints.find(([p]) => p === '1')?.[1]).filter((p): p is string => p !== undefined && p !== '');
    const firstOpen = paints1.indexOf('open');
    expect(firstOpen, 'the place opened').toBeGreaterThan(0);
    expect(paints1.slice(0, firstOpen).every((p) => p === 'sealed' || p === 'turning' || p === 'pending'), `the place was sealed, then turned — never re-dealt (${[...new Set(paints1)].join(',')})`).toBe(true);
    const turning = watch.filter((s) => s.paints.some(([p, paint]) => p === '1' && paint === 'turning'));
    expect(turning.some((s) => s.deckDeals > 0), 'nothing flew for the sealed place').toBe(false);
  });
});
