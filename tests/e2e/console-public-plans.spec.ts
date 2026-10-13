import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, press, settle} from './consoleStart';

/**
 * X77 Public Plans — «reveal any number of OTHER cards from your hand, +1 M€ each»: the play composer's pre-select is a
 * MULTI pick in the hand album (the owner's report, 2026-10-14):
 *
 *  1. the card being played is NOT among the choices — the rules say OTHER, so it is not shown (it stays the
 *     composer's hero; L3 inspects it as the source: the viewer opens over the album and closes back into it);
 *  2. «select all» is R3 — L3 is the source's, and the two once shared it (the source, checked first, always won, so
 *     the bar promised a select-all that never fired); R3 selects every candidate (bounded by `max`), R3 again clears;
 *  3. the choice lands: every other card revealed, +1 M€ each — server truth.
 */
const CARD = 'Public Plans';
const OTHERS = ['Acquired Company', 'Rover Construction', 'Investment Loan', 'Lichen', 'Algae'];
const PLAY = '.con-composer--play';
const ALBUM = '.con-hand[data-flow="picking"]';
const OUT = path.resolve('screenshots', 'public-plans');
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {thisPlayer: {megacredits: number, cardsInHandNbr: number}, cardsInHand?: Array<{name: string, calculatedCost?: number}>};

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

async function openPlayComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `the cursor reaches «${CARD}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY)).toHaveCount(1);
  await settle(page);
}

/** The composer's reveal row → A → the album in pick mode. */
async function openRevealPick(page: Page): Promise<void> {
  const rowText = () => page.evaluate((play) => (document.querySelector(`${play} .con-composer__row--focused`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), PLAY);
  for (let i = 0; i < 8 && !/карт/i.test(await rowText()); i++) {
    await press(page, 'ArrowDown', 300);
  }
  expect(await rowText(), 'the cursor stands on the reveal row').toMatch(/карт/i);
  for (let i = 0; i < 3 && await page.locator(ALBUM).count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(page.locator(ALBUM), 'the hand album opens in pick mode').toBeVisible({timeout: 15_000});
  await settle(page);
}

const bar = (page: Page) => page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const picked = (page: Page) => page.locator(`${ALBUM} .con-hand__slot--select-picked`);
const viewer = (page: Page) => page.locator('dialog.con-zoom[open]');

for (const preset of PRESETS) {
  test.describe(`Public Plans · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the reveal pick: the played card absent, R3 selects all, L3 inspects the source, the choice lands (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'public-plans', {query: preset.query});
      await settle(page);
      const before = await fetchPlayerModel(request, playerId) as unknown as Wire;
      await openPlayComposer(page);
      await openRevealPick(page);
      await shoot(page, preset.id, 'a-01-pick');

      // ① The card being played is not among the choices; every other card is.
      await expect(page.locator(`${ALBUM} [data-zoom-slot="${CARD}"]`), 'the played card is not shown').toHaveCount(0);
      for (const name of OTHERS) {
        await expect(page.locator(`${ALBUM} [data-zoom-slot="${name}"]`), `«${name}» stands in the album`).toHaveCount(1);
      }
      const candidates = await page.locator(`${ALBUM} .con-hand__slot[data-zoom-slot]`).count();
      expect(candidates, 'the whole rest of the hand').toBeGreaterThanOrEqual(OTHERS.length);

      // ② ONE verb per button: R3 is «select all», L3 the source — never two L3s on the bar.
      const b = await bar(page);
      expect(b, 'R3 names the select-all').toMatch(/R3\s*Выбрать все/i);
      expect(b, 'L3 names the source').toMatch(/L3\s*Осмотреть источник/i);
      expect((b.match(/L3/g) ?? []).length, 'one L3 on the bar').toBe(1);
      await press(page, 'KeyV', 600); // R3
      await expect(picked(page), 'R3 selects every candidate').toHaveCount(candidates);
      expect(await bar(page), 'R3 now reads unselect all').toMatch(/R3\s*Снять все/i);
      await shoot(page, preset.id, 'a-02-all-selected');
      await press(page, 'KeyV', 600); // R3 again
      await expect(picked(page), 'R3 again clears the selection').toHaveCount(0);
      await press(page, 'KeyV', 600);
      await expect(picked(page)).toHaveCount(candidates);

      // L3 — the source, over the album; the selection survives the viewer.
      await press(page, 'KeyC', 900); // L3
      await expect(viewer(page), 'L3 opens the source viewer').toHaveCount(1, {timeout: 8_000});
      expect(await page.evaluate(() => (document.querySelector('dialog.con-zoom[open]')?.textContent ?? '')), 'the viewer shows the card being played').toMatch(/Общественные планы/i);
      await shoot(page, preset.id, 'a-03-source');
      await press(page, 'Escape', 900);
      await expect(viewer(page), 'B closes the viewer back into the album').toHaveCount(0, {timeout: 8_000});
      await expect(page.locator(ALBUM)).toBeVisible();
      await expect(picked(page), 'the selection survived the inspection').toHaveCount(candidates);

      // ③ RT confirms the set into the composer; A plays — +1 M€ per revealed card, server truth.
      await press(page, 'Period', 1200); // RT
      await expect(page.locator(`${PLAY}:visible`), 'the composer returns with the answer').toHaveCount(1, {timeout: 15_000});
      await settle(page);
      await shoot(page, preset.id, 'a-04-answered');
      for (let i = 0; i < 6 && await page.locator(`${PLAY} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 300);
      }
      await expect(page.locator(`${PLAY} .con-composer__cta--focused`), 'the cursor reaches the play row').toHaveCount(1);
      await press(page, 'Enter', 1200);
      // The price is the server's OWN reading of the card in this hand (a corporation's discount applies), never the
      // printed 7: the deal of the fixture's table is not this spec's subject.
      const cost = before.cardsInHand?.find((c) => c.name === CARD)?.calculatedCost ?? 7;
      await expect.poll(async () => ((await fetchPlayerModel(request, playerId)) as unknown as Wire).thisPlayer.megacredits, {
        timeout: 30_000, message: `M€ ${before.thisPlayer.megacredits} − ${cost} + ${candidates} revealed`,
      }).toBe(before.thisPlayer.megacredits - cost + candidates);
      await settle(page, {timeoutMs: 30_000});
    });
  });
}
