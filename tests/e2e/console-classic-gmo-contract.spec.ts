/*
 * T06 GMO CONTRACT («Контракты на ГМО») — the first classic Turmoil card with a LIVE EFFECT through the Redux channel
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The ONE e2e of the card — justified by its new class (the checklist §5):
 * a classic card's effect is the table's answer to a play, and that answer FLIES (T06 «оба конца живые»). fhd + tv4k:
 *
 *   A · `gmo-contract-locked` — the Greens do not rule, one of blue's delegates on their resolution: the hand refuses by
 *       NAME («Нельзя разыграть», «1/2»); X → the viewer states both roads where they stand.
 *   B · `gmo-contract-hand` — the composer of GMO Contract forecasts its own answer («Сработает» — «including this»);
 *       A plays it: the server pays −3 + 2.
 *   C · `gmo-contract` (the contract on the table) — Lichen: the composer's «Сработает» names GMO Contract; A → the
 *       witness: the «+2» answer is BORN on the landed card's printed PLANT tag and lands on the M€ row's ink, its contact
 *       beat played; both ends painted; the server pays −7 + 2.
 *   D · `gmo-contract` — Ecology Research (plant + animal + microbe): «+6» in the composer and on the server.
 *
 * Frames: `screenshots/t06/{fhd,tv4k}/card-*.png`. 4K timing claims: `TM_E2E_GPU=1`, `--workers=1`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openZoomViewer, press, pressUntil, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const T06 = 'GMO Contract';
const OUT = path.resolve('screenshots', 't06');

type Wire = {thisPlayer: {megacredits: number, tableau: Array<{name: string}>}};

async function serverModel(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `card-${name}.png`)});
}

/** RT wheel → the hand, the cursor on `card`. */
async function focusInHand(page: Page, card: string): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, Math.max(14, slots * 3)), `the cursor stands on ${card}`).toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

async function openComposer(page: Page, card: string): Promise<void> {
  await focusInHand(page, card);
  await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
}

async function playAndWait(page: Page, request: APIRequestContext, playerId: string, card: string): Promise<Wire> {
  for (let i = 0; i < 5 && await page.locator('.con-composer--play').count() > 0; i++) {
    await press(page, 'Enter', 900);
  }
  let after = await serverModel(request, playerId);
  for (let i = 0; i < 120 && !after.thisPlayer.tableau.some((c) => c.name === card); i++) {
    await new Promise((r) => setTimeout(r, 250));
    after = await serverModel(request, playerId);
  }
  expect(after.thisPlayer.tableau.some((c) => c.name === card), `${card} is on the table`).toBe(true);
  await expect(page.locator('.con-ws'), 'the scene left').toHaveCount(0, {timeout: 45_000});
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-transfer__chip').length), {timeout: 20_000}).toBe(0);
  await settle(page, {timeoutMs: 30_000});
  return after;
}

for (const preset of PROFILES) {
  test.describe(`T06 GMO Contract · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the Greens do not rule: «✕», «1/2»; X states both roads (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'gmo-contract-locked', {query: preset.query});
      await focusInHand(page, T06);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
      await expect(verdict, 'one of your delegates out of two').toContainText('1/2');
      expect(await page.locator(`.con-hand__slot[data-zoom-slot="${T06}"] img`).evaluateAll((imgs) => imgs.some((i) => (i as HTMLImageElement).src.includes('T06'))),
        'the face wears the T06 art').toBe(true);
      await shot(page, preset.id, 'A-locked');
      await openZoomViewer(page);
      const viewer = page.locator('dialog.con-zoom[open]');
      await expect(viewer, 'road 1 — the party does not rule').toContainText(/«Зелёные» не у власти/);
      await expect(viewer, 'road 2 — your delegates on its resolution').toContainText(/1 из 2/);
      await shot(page, preset.id, 'A-viewer');
      await closeZoomViewer(page);
    });

    test(`B · in hand: the composer forecasts its own answer; A pays −3 + 2 (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'gmo-contract-hand', {query: preset.query});
      const before = await serverModel(request, playerId);
      await openComposer(page, T06);
      const forecast = page.locator('.con-composer--play [data-forecast-row]');
      await expect(forecast, 'the «Сработает» row stands').toHaveCount(1, {timeout: 15_000});
      await expect(forecast, 'its own microbe tag answers: +2 M€').toContainText('2');
      await shot(page, preset.id, 'B-composer');
      const after = await playAndWait(page, request, playerId, T06);
      expect(after.thisPlayer.megacredits, 'the server: − 3 + 2 (including this)').toBe(before.thisPlayer.megacredits - 3 + 2);
    });

    test(`C · Lichen: the answer is BORN on the plant tag and lands on the M€ ink (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'gmo-contract', {query: preset.query});
      const before = await serverModel(request, playerId);
      await openComposer(page, 'Lichen');
      const forecast = page.locator('.con-composer--play [data-forecast-row]');
      await expect(forecast, 'the «Сработает» row stands').toHaveCount(1, {timeout: 15_000});
      await expect(forecast, '+2 M€ from GMO Contract').toContainText('2');
      await shot(page, preset.id, 'C-composer');
      await armTransferWitness(page);
      // THE RECEIVER ANNOUNCES ITSELF (the owner's decision 7): while the «+2» is in the air a ring stands over the M€ ink.
      await page.evaluate(() => {
        const w = window as unknown as {__expectHits?: Array<number>};
        w.__expectHits = [];
        const timer = window.setInterval(() => {
          const digits = document.querySelector('.con-res__row--megacredits .con-res__digits')?.getBoundingClientRect();
          for (const ring of Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__expect[data-expect-resource="megacredits"]'))) {
            const r = ring.getBoundingClientRect();
            const op = Number(getComputedStyle(ring).opacity);
            if (digits !== undefined && op > 0.3 && r.left <= digits.left + 2 && r.right >= digits.right - 2 && r.top <= digits.top + 2 && r.bottom >= digits.bottom - 2) {
              w.__expectHits!.push(op);
            }
          }
        }, 16);
        window.setTimeout(() => window.clearInterval(timer), 30_000);
      });
      const after = await playAndWait(page, request, playerId, 'Lichen');
      const ringHits = await page.evaluate(() => (window as unknown as {__expectHits?: Array<number>}).__expectHits?.length ?? 0);
      expect(ringHits, 'a ring stood over the M€ ink while the answer flew').toBeGreaterThan(0);
      const w = await transferWitness(page);
      fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
      fs.writeFileSync(path.join(OUT, preset.id, 'card-C-trail.txt'), transferTrail(w) + '\n');
      const answer = w.births.find((e) => e.value === '+2');
      expect(answer, `the «+2» answer flew (trail:\n${transferTrail(w)})`).toBeTruthy();
      expect(answer!.under, 'born on the landed card\'s printed PLANT tag').toBe('tag:plant');
      const landed = w.landings.find((e) => e.id === answer!.id);
      expect(landed?.under, 'landed on the M€ row').toBe('rail:megacredits');
      expect(landed?.touched, 'its contact beat played').toBeDefined();
      expect(endsOverGlass(w), 'no end over glass or nothing').toEqual([]);
      expect(after.thisPlayer.megacredits, 'the server: − 7 + 2').toBe(before.thisPlayer.megacredits - 7 + 2);
      await shot(page, preset.id, 'C-played');
    });

    test(`D · Ecology Research: three matching tags — «+6» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'gmo-contract', {query: preset.query});
      const before = await serverModel(request, playerId);
      await openComposer(page, 'Ecology Research');
      await expect(page.locator('.con-composer--play [data-forecast-row]'), '+6 M€ from GMO Contract').toContainText('6', {timeout: 15_000});
      const after = await playAndWait(page, request, playerId, 'Ecology Research');
      expect(after.thisPlayer.megacredits, 'the server: − 21 + 6').toBe(before.thisPlayer.megacredits - 21 + 6);
    });
  });
}
