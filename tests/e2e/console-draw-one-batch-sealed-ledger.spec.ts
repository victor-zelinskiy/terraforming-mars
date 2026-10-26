/*
 * «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» · Ф4 THE SEALED PLACE in the LEDGER (2026-10-26; contract
 * `docs/claude/console/card-intake-one-batch.md` § Ф4).
 *
 * Habitat Science pays «all your colony bonuses» — blue holds TWO cubes on Pluto, so the ledger pays two PAIRS
 * «draw 1, then discard 1», one after another, and the rule never reveals the second card before the first discard
 * is answered. The settlement table — the colony trade's grammar — now stands in the ledger too (the pairs' discard
 * is marked `colonyRepeat` with the card as its source; the batches carry `via`):
 *  ① the first pair's reveal is a TABLE: its card open in place 1, place 2 lying face-down under its seal, ONE table
 *     instance (`data-settlement-table` keeps one value from the first deal to the last turn);
 *  ② the take leaves the socket and IS the step (the ledger hosts no «Сбросить карту» button — TR23's grammar): the
 *     hand opens as the action's own step, the table PARKS under it (never unmounted);
 *  ③ the discard's touchdown breaks the seal, the second pair's card TURNS IN PLACE (`data-settlement-paint`
 *     sealed → turning → open) — nothing flies a second time (`.con-deckdraw` deals nothing for it);
 *  ④ the second take and discard end the payout; the ledger reads every row «получено».
 * Fixture `habitat-science-pluto2` (Luna ×1 · Pluto ×2, a hand of four).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, crumbText, openActionFocus, openCardActions, press, settle, walkFocusUntil} from './consoleStart';

const OUT = path.resolve('screenshots', 'draw-one-batch');
const CARD = 'Habitat Science';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const composer = '.con-cardactions .con-composer';
const zone = `${composer} .con-composer__ledgerzone`;
const ledger = `${composer} [data-colony-ledger-scope="card"]`;
const rowOf = (colony: string) => `${ledger} [data-colony-row="${colony}"]`;
const place = (n: number) => `${zone} .con-reveal [data-settlement-place="${n}"]`;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{id: number, actionId?: number, cards: Array<{name: string}>, sealed?: true, pendingAnswer?: {kind: string, colony?: string, ordinal?: {index: number, total: number}, card?: string}}>,
  waitingFor?: {type: string, discardPrompt?: {colonyRepeat?: {colonyName: string, index: number, total: number}}},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

type Sample = {t: number, table: string, turn: string, holds: string, paints: Array<[string, string]>, deckDeals: number, handStep: boolean, reveal: number};
declare global {
  interface Window {
    __sealedWatch?: {samples: Array<Sample>, stop: () => void},
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
        turn: root?.getAttribute('data-settlement-turn') ?? '',
        holds: ((window as unknown as {__conReady?: () => {holds?: Array<string>}}).__conReady?.().holds ?? []).join('|'),
        paints: Array.from(document.querySelectorAll<HTMLElement>('[data-settlement-place]')).map((el) => [el.getAttribute('data-settlement-place') ?? '', el.getAttribute('data-settlement-paint') ?? '']),
        deckDeals: document.querySelectorAll('.con-deckdraw-proxy').length,
        handStep: document.querySelector('.con-hand.con-hand--embedded') !== null,
        reveal: document.querySelectorAll('.con-reveal').length,
      });
    };
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-settlement-paint', 'data-settlement-table', 'class']});
    const iv = setInterval(sample, 100);
    window.__sealedWatch = {samples, stop: () => {
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

test.describe('the sealed place in the ledger — Pluto\'s two pairs are one table', () => {
  test.setTimeout(420_000);

  test(`Habitat Science · Luna ×1 · Pluto ×2 · ${PRESET.id}`, async ({page, request}) => {
    await page.setViewportSize(PRESET.viewport);
    const id = await bootFixture(page, request, 'habitat-science-pluto2', {query: PRESET.query});
    const handBefore = (await wireOf(request, id)).cardsInHand?.length ?? 0;
    expect(handBefore, 'a hand to discard from').toBe(4);

    await openCardActions(page);
    expect(await walkFocusUntil(page, async () => (await focusedTile(page)) === CARD, () => focusedTile(page), 16),
      `never focused the card's action (at «${await focusedTile(page)}»)`).toBe(true);
    await openActionFocus(page);
    await settle(page);
    for (let i = 0; i < 8 && await page.locator(`${composer} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 200);
    }
    await expect(page.locator(`${composer} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
    await installWatch(page);
    await press(page, 'Enter', 300);

    // ① the first pair's reveal is a TABLE: place 1 open, place 2 sealed, one instance.
    await expect(page.locator(`${zone} .con-reveal[data-settlement-table]`), 'the ledger\'s take is a settlement table').toHaveCount(1, {timeout: 60_000});
    const nonce = await page.locator(`${zone} .con-reveal[data-settlement-table]`).getAttribute('data-settlement-table');
    await expect(page.locator(place(2)), 'place 2 lies sealed').toHaveAttribute('data-settlement-paint', 'sealed', {timeout: 30_000});
    await expect(page.locator(`${zone} .con-reveal [data-settlement-seal="2"]`), 'its seal stands').toHaveCount(1);
    await expect(page.locator(rowOf('Luna')), 'Luna paid first').toHaveAttribute('data-colony-row-state', 'received', {timeout: 20_000});
    const wire1 = await wireOf(request, id);
    const batch1 = (wire1.cardDrawReveals ?? [])[0];
    expect(batch1, 'the first pair\'s batch is on the wire').toBeDefined();
    expect(batch1?.cards.length, 'one card per pair').toBe(1);
    expect(batch1?.sealed, 'sealed by the pair\'s rule').toBe(true);
    expect(batch1?.pendingAnswer, 'the seal names the pair').toMatchObject({kind: 'discard', colony: 'Pluto', ordinal: {index: 1, total: 2}, card: CARD});
    await cinematicBeat(page, 1200, 'the first pair\'s card settles');
    await shoot(page, 'C1-table-pair1');

    // ② the take IS the step (TR23's grammar — the ledger hosts no «Сбросить карту» button): A takes the card and the
    //    action workspace opens its own hand step right after; the table parks under it.
    await expect(page.locator('.con-footer'), 'the take\'s own verb').toContainText('Взять', {timeout: 20_000});
    await waitArrival(page);
    await pressOnce(page, 'Enter', async () => await page.locator('.con-hand.con-hand--embedded').count() > 0, 'A takes the card — the hand opens as the discard step');
    await settle(page);
    expect(await crumbText(page), 'the step is the action\'s').toContain('Сброс');
    await shoot(page, 'C2-discard-step');
    await pressOnce(page, 'Enter', async () => await page.locator('.con-hand.con-hand--embedded').count() === 0, 'A discards the focused card');

    // ③ the seal breaks, the second pair's card turns IN PLACE.
    try {
      await expect(page.locator(place(2)), 'place 2 opened in place').toHaveAttribute('data-settlement-paint', 'open', {timeout: 60_000});
    } catch (e) {
      // A red here NAMES the stage it stalled in: the turn's place:phase, the holds, the paints — the last samples.
      const trail = await page.evaluate(() => (window.__sealedWatch?.samples ?? []).filter((s, i, a) => i === 0 || JSON.stringify([s.turn, s.holds, s.paints, s.handStep]) !== JSON.stringify([a[i - 1].turn, a[i - 1].holds, a[i - 1].paints, a[i - 1].handStep])).slice(-40));
      test.info().annotations.push({type: 'stall-trail', description: JSON.stringify(trail)});
      console.log('── sealed-ledger stall trail ──', JSON.stringify(trail));
      throw e;
    }
    expect(await page.locator(`${zone} .con-reveal[data-settlement-table]`).getAttribute('data-settlement-table'), 'ONE table instance').toBe(nonce);
    await expect(page.locator(place(1)), 'place 1 is done').toHaveAttribute('data-settlement-paint', 'done');
    await cinematicBeat(page, 1000, 'the turned card settles');
    await shoot(page, 'C3-pair2-turned');

    // ④ the second take and discard end the payout.
    await expect(page.locator('.con-footer'), 'the second take\'s verb').toContainText('Взять', {timeout: 20_000});
    await waitArrival(page);
    await pressOnce(page, 'Enter', async () => await page.locator('.con-hand.con-hand--embedded').count() > 0, 'A takes the second card — the second discard opens');
    await settle(page);
    await pressOnce(page, 'Enter', async () => await page.locator('.con-hand.con-hand--embedded').count() === 0, 'A discards');
    await expect(page.locator(rowOf('Pluto')), 'Pluto paid in full').toHaveAttribute('data-colony-row-state', 'received', {timeout: 60_000});
    await expect.poll(async () => (await wireOf(request, id)).cardsInHand?.length, {timeout: 30_000}).toBe(handBefore + 2 - 2);
    await expect.poll(async () => ((await wireOf(request, id)).cardDrawReveals ?? []).length, {timeout: 30_000}).toBe(0);

    const watch = await page.evaluate(() => {
      window.__sealedWatch?.stop();
      return window.__sealedWatch?.samples ?? [];
    });
    expect(watch.length).toBeGreaterThan(20);
    const nonces = [...new Set(watch.map((s) => s.table).filter((n) => n !== ''))];
    expect(nonces, 'one table instance for the whole payout').toHaveLength(1);
    expect(Math.max(...watch.map((s) => s.reveal)), 'never two reveals').toBeLessThanOrEqual(1);
    const paints2 = watch.map((s) => s.paints.find(([p]) => p === '2')?.[1]).filter((p): p is string => p !== undefined && p !== '');
    const firstOpen = paints2.indexOf('open');
    expect(firstOpen, 'place 2 opened').toBeGreaterThan(0);
    expect(paints2.slice(0, firstOpen).every((p) => p === 'sealed' || p === 'turning' || p === 'pending'), `place 2 was sealed, then turned — never re-dealt (${[...new Set(paints2)].join(',')})`).toBe(true);
    // The second pair's card never came off the deck a second time: no deck-draw proxy while place 2 was turning.
    const turning = watch.filter((s) => s.paints.some(([p, paint]) => p === '2' && paint === 'turning'));
    expect(turning.some((s) => s.deckDeals > 0), 'nothing flew for the sealed place').toBe(false);
  });
});
