/*
 * «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» · R4 — THE SEARCH RUN of a merged batch plays on ITS OWN tape (2026-10-26; contract
 * `docs/claude/console/card-intake-one-batch.md` § R4).
 *
 * Scientific Breakthrough (a Science event: «remove 2 data → search 2 Science cards») played under Olympus Conference
 * holding a science: Olympus asks first and its pre-collected answer draws the deck's top; the card's own search then
 * turns cards over until it finds two Science cards (two rejects onto the pile). ONE batch of two causes, and ONE scene:
 *  ① Olympus' card is dealt FIRST, from Olympus' own face surfacing beside the row (the server's order);
 *  ② the search run is judged on its OWN tape — exactly the rejects of the search go to the pile («СБРОШЕННЫЕ» reads 2),
 *     never Olympus' card; the finds assemble into the search run's own slots;
 *  ③ one reveal of three cards, the head naming both causes, one take.
 * Fixture `sb-olympus` (Algae → Comet ✗ → Fish ✗ → Research ✓ → Physics Complex ✓ on top of the deck).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, focusCard, press, pressUntil, settle} from './consoleStart';

const OUT = path.resolve('screenshots', 'draw-one-batch');
const OLYMPUS = 'Olympus Conference';
const CARD = 'Scientific Breakthrough';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-hand__stage .con-composer--play';
const zone = '.con-hand__outcome';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{id: number, cards: Array<{name: string}>, segments?: Array<{count: number, sequence?: Array<{matched: boolean}>}>}>,
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}
const handOf = (wire: Wire): Array<string> => (wire.cardsInHand ?? []).map((c) => c.name);

type Sample = {t: number, trigger: string, rejects: number, finds: number, pile: string, reveal: number, slots: number};
declare global {
  interface Window {
    __tapeWatch?: {samples: Array<Sample>, stop: () => void},
  }
}
async function installWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Array<Sample> = [];
    const t0 = performance.now();
    const visible = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const sample = () => {
      const trigger = Array.from(document.querySelectorAll<HTMLElement>('.con-deckdraw__trigger[data-dd-trigger]'))
        .filter(visible).map((el) => el.getAttribute('data-dd-trigger') ?? '').join('|');
      samples.push({
        t: Math.round(performance.now() - t0),
        trigger,
        rejects: Array.from(document.querySelectorAll('.con-deckdraw-proxy[data-dd-matched="no"]')).filter(visible).length,
        finds: Array.from(document.querySelectorAll('.con-deckdraw-proxy[data-dd-matched="yes"]')).filter(visible).length,
        pile: document.querySelector('[data-discard-pile]')?.getAttribute('data-discard-pile-count') ?? '-',
        reveal: document.querySelectorAll('.con-reveal').length,
        slots: document.querySelectorAll('.con-hand__outcome .con-reveal [data-zoom-slot]').length,
      });
    };
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-discard-pile-count']});
    const iv = setInterval(sample, 80);
    window.__tapeWatch = {samples, stop: () => {
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
async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}
const focusedRowOf = (page: Page, card: string) =>
  page.locator(`.con-composer--play .con-composer__row--reaction.con-composer__row--focused[data-reaction-card="${card}"]`);

/** RT → «КАРТЫ» → the card → A: its play composer (the table-question spec's door). */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), 'the cursor reached the card in the hand').toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
    'A opens the play composer').toBe(true);
  await settle(page);
}

test.describe('the search run of a merged batch plays on its own tape', () => {
  test.setTimeout(420_000);

  test(`Scientific Breakthrough under Olympus · Olympus deals first from its face, the search judges its own tape · ${PRESET.id}`, async ({page, request}) => {
    await page.setViewportSize(PRESET.viewport);
    const id = await bootFixture(page, request, 'sb-olympus', {query: PRESET.query});
    const before = handOf(await wireOf(request, id)).filter((n) => n !== CARD);
    await openComposer(page);

    // Olympus' question holds the cursor; its first answer draws.
    await expect(focusedRowOf(page, OLYMPUS), 'Olympus\' question holds the cursor').toHaveCount(1);
    const options = page.locator('.con-composer--play .con-composer__sublist .con-vchoice__opt');
    expect(await pressUntil(page, 'Enter', async () => await options.count() > 0, {tries: 3, settleMs: 900}), 'A opens Olympus\' answers').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await options.count() === 0, {tries: 3, settleMs: 900}), 'the answer closes the list').toBe(true);
    await settle(page);
    // The card's mandatory removal: the census is the ONE holder with enough data — SEEDED, shown and marked (T14), never
    // asked as a question of one; the cursor goes on to the commit row.
    await expect(page.locator(`${COMPOSER} .con-composer__row[data-seeded="sole"]`), 'the removal\'s one target is seeded').toHaveCount(1);
    await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'nothing left to ask').toHaveCount(0);
    for (let i = 0; i < 6 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
      await press(page, 'ArrowDown', 300);
    }
    await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on «Разыграть карту»').toHaveCount(1);
    await installWatch(page);
    await page.keyboard.press('Enter');

    // ③ ONE reveal of three cards in the hand's zone, both causes named; the pile holds the search's TWO rejects.
    const reveal = page.locator(`${zone} .con-reveal`);
    await expect(reveal, 'one reveal').toHaveCount(1, {timeout: 60_000});
    await expect(page.locator(`${zone} .con-reveal [data-zoom-slot]`), 'three cards: Olympus\' and the two finds').toHaveCount(3, {timeout: 60_000});
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    const wire = await wireOf(request, id);
    const batch = (wire.cardDrawReveals ?? [])[0];
    expect(wire.cardDrawReveals?.length, 'ONE batch on the wire').toBe(1);
    expect(batch?.segments?.map((s) => `${s.count}:${s.sequence?.filter((x) => !x.matched).length ?? 0}`), 'Olympus ×1 (no tape), the search ×2 with two rejects').toEqual(['1:0', '2:2']);
    await expect(page.locator('[data-discard-pile]'), 'the pile holds the search\'s rejects').toHaveAttribute('data-discard-pile-count', '2');
    await expect(page.locator(`${zone} .con-reveal [data-reveal-source-count]`), 'the head names both causes with their shares').toHaveCount(2);
    await cinematicBeat(page, 900, 'the row settles');
    await shoot(page, 'E1-search-tape-assembled');

    const watch = await page.evaluate(() => {
      window.__tapeWatch?.stop();
      return window.__tapeWatch?.samples ?? [];
    });
    expect(watch.length, 'the sampler ran').toBeGreaterThan(20);
    // ① Olympus' face surfaced and dealt BEFORE the search's first reject left the deck (the server's order).
    const firstTrigger = watch.find((s) => s.trigger.includes(OLYMPUS));
    const firstReject = watch.find((s) => s.rejects > 0);
    expect(firstTrigger, 'Olympus\' face surfaced beside the row').toBeDefined();
    expect(firstReject, 'the search\'s rejects were judged on screen').toBeDefined();
    expect((firstTrigger?.t ?? 0) < (firstReject?.t ?? 0), `Olympus dealt first (face at ${firstTrigger?.t} ms, first reject at ${firstReject?.t} ms)`).toBe(true);
    // ② exactly the search's rejects went to the pile — never more than two flyers face-down at once beyond the tape's.
    expect(Math.max(...watch.map((s) => s.rejects)), 'two rejects, no more').toBeLessThanOrEqual(2);
    const piles = [...new Set(watch.map((s) => s.pile).filter((p) => p !== '-'))];
    expect(piles[piles.length - 1], 'the pile ends at the search\'s two').toBe('2');
    expect(Math.max(...watch.map((s) => s.reveal)), 'never two reveals').toBeLessThanOrEqual(1);

    // The take: B takes all three; the hand grew by three, nothing left on the wire.
    await pressOnce(page, 'Escape', async () => await page.locator(`${zone} .con-reveal`).count() === 0, 'B takes every card');
    await expect.poll(async () => ((await wireOf(request, id)).cardDrawReveals ?? []).length, {timeout: 30_000}).toBe(0);
    const after = handOf(await wireOf(request, id));
    expect(after.length, 'three cards came in').toBe(before.length + 3);
  });
});
