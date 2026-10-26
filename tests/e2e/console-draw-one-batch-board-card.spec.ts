/*
 * «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» · Ф-Б «поле + карта» (the owner's own scene, 2026-10-26; contract
 * `docs/claude/console/card-intake-one-batch.md`).
 *
 * Natural Preserve (a tile) is played from the hand with Mars University on the table; its discard is answered in the
 * composer, the tile is placed on a cell with a PRINTED CARD BONUS. ONE press draws twice — the cell's bonus and the
 * university's exchange — and the server merges them into ONE batch (`tile ×1 · card ×1`); the console presents ONE
 * scene: the cell's cover lifts at the submit and flies its card into the row (the board card-bonus scene), the cards
 * of the cell HOVER in their slots while the university SURFACES beside the row and deals its card (the deck layer's
 * guest run), one head names both causes, one take.
 *  ① ONE reveal, ONE batch on the wire with two segments (`tile`, `card:Mars University`) and one root;
 *  ② the cover's proxy (`.con-bonusfly-proxy`) AND the trigger face (`[data-dd-trigger="Mars University"]`) both stood
 *     while the reveal was up — the two layers dealt one row;
 *  ③ the head: «ПОЛУЧЕНО 2» + the cell (by its printed face) + the university;
 *  ④ never two reveals, never the viewer.
 * Fixture `mu-natural-preserve`.
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {answerTableQuestions, bootFixture, cinematicBeat, commitFocusedSpace, focusCard, press, pressUntil, settle, walkToSpace} from './consoleStart';

const OUT = path.resolve('screenshots', 'draw-one-batch');
const NP = 'Natural Preserve';
const MU = 'Mars University';
const MU_RU = 'Марсианский университет';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{id: number, actionId?: number, cards: Array<{name: string}>, segments?: Array<{source?: {type: string, cardName?: string, spaceId?: string}, count: number}>}>,
  game: {spaces: Array<{id: string, spaceType: string, bonus: Array<number>, tileType?: number, x: number, y: number}>},
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}

type Sample = {reveals: number, slots: number, cover: number, triggers: Array<string>, viewer: boolean};

declare global {
  interface Window {
    __obWatchB?: {samples: Array<Sample>, stop: () => void},
  }
}

async function installWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Array<Sample> = [];
    const sample = () => {
      samples.push({
        reveals: document.querySelectorAll('.con-reveal').length,
        slots: document.querySelectorAll('.con-reveal .con-cards__slot').length,
        cover: Array.from(document.querySelectorAll<HTMLElement>('.con-bonusfly-proxy, .con-bonusfly-cover'))
          .filter((el) => getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.5).length,
        triggers: Array.from(document.querySelectorAll<HTMLElement>('.con-deckdraw [data-dd-trigger]'))
          .filter((el) => getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.5)
          .map((el) => el.getAttribute('data-dd-trigger') ?? ''),
        viewer: document.querySelector('.con-zoom') !== null,
      });
    };
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-dd-run', 'class', 'style']});
    const iv = setInterval(sample, 80);
    window.__obWatchB = {samples, stop: () => {
      mo.disconnect();
      clearInterval(iv);
    }};
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

test.describe('one press, a cell bonus and a table draw — ONE batch, the cell first, the trigger beside the row', () => {
  test.setTimeout(300_000);

  test(`Natural Preserve on a card-bonus cell under Mars University · ${PRESET.id}`, async ({page, request}) => {
    await page.setViewportSize(PRESET.viewport);
    const id = await bootFixture(page, request, 'mu-natural-preserve', {query: PRESET.query});
    const wire0 = await wireOf(request, id);
    // A free LAND cell printing a card bonus (Tharsis: the volcanic cell of row 2 — any such cell is fine).
    const cell = wire0.game.spaces.find((s) => s.spaceType === 'land' && s.tileType === undefined && s.bonus.includes(SpaceBonus.DRAW_CARD));
    expect(cell, 'a free land cell with a printed card bonus').toBeDefined();

    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
    await page.locator(`.con-hand [data-zoom-slot="${NP}"]`).waitFor({timeout: 15_000});
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, NP, slots * 2 + 6), 'the cursor reached Natural Preserve').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand__stage .con-composer--play').count() > 0, {tries: 3, settleMs: 900}),
      'A opens the play composer').toBe(true);
    await settle(page);
    await answerTableQuestions(page, {[MU]: 'discard'});
    await settle(page);
    await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on the commit').toHaveCount(1);
    await shoot(page, 'B0-composer-ready');

    await installWatch(page);
    await press(page, 'Enter', 900); // «Разыграть на поле» — the staged pick
    await expect(page.locator('.con-context'), 'the board took the pick').toContainText(/размещение тайла/i, {timeout: 30_000});
    await walkToSpace(page, cell!.id);
    expect(await commitFocusedSpace(page), 'the cell committed').toBe(true);

    await expect(page.locator('.con-reveal').first(), 'the batch is presented').toBeVisible({timeout: 90_000});
    await expect(page.locator('[data-reveal-received] .con-ws-stage-badge__num'), '«ПОЛУЧЕНО 2»').toHaveText('2', {timeout: 30_000});
    await expect(page.locator('[data-reveal-source]'), 'two causes named').toHaveCount(2, {timeout: 15_000});
    const sources = await page.locator('[data-reveal-source]').allTextContents();
    expect(sources.join(' | '), 'the university named').toContain(MU_RU);
    await expect(page.locator('[data-reveal-source-cell]'), 'the cell named by its printed face').toHaveCount(1);
    const wire = await wireOf(request, id);
    const batches = wire.cardDrawReveals ?? [];
    expect(batches.length, `ONE batch on the wire (${JSON.stringify(batches.map((b) => b.cards.map((c) => c.name)))})`).toBe(1);
    expect(batches[0].cards.length).toBe(2);
    expect(batches[0].actionId).toBeDefined();
    expect((batches[0].segments ?? []).map((s) => s.source?.type), 'the cell first, the card after').toEqual(['tile', 'card']);
    expect(batches[0].segments?.[0].source?.spaceId).toBe(cell!.id);
    await cinematicBeat(page, 2200, 'the assembly settles — the cover landed, the university surfaced, dealt and receded');
    await shoot(page, 'B1-batch-assembled');

    for (let i = 0; i < 6 && await page.locator('.con-reveal').count() > 0; i++) {
      await press(page, 'Enter', 900);
      await cinematicBeat(page, 700, 'the taken card flies to the dock');
    }
    await expect(page.locator('.con-reveal'), 'the batch is taken').toHaveCount(0, {timeout: 30_000});

    const watch = await page.evaluate(() => {
      window.__obWatchB?.stop();
      return window.__obWatchB?.samples ?? [];
    });
    const withReveal = watch.filter((s) => s.reveals > 0);
    expect(withReveal.length, 'the reveal stood in the samples').toBeGreaterThan(5);
    expect(Math.max(...watch.map((s) => s.reveals)), 'never two reveals').toBe(1);
    expect(Math.max(...withReveal.map((s) => s.slots)), 'one row of the whole batch').toBe(2);
    expect(withReveal.some((s) => s.viewer), 'never the viewer').toBe(false);
    expect(watch.some((s) => s.cover > 0), 'the cell\'s cover flew').toBe(true);
    expect(withReveal.some((s) => s.triggers.includes(MU)), 'the university surfaced beside the row').toBe(true);
  });
});
