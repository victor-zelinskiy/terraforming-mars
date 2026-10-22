/*
 * T04 DIASPORA MOVEMENT («Космическая диаспора») — the FIRST classic Turmoil card through the Redux channel
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1): held back → dealt → in the hand → the party requirement → the play.
 * The ONE e2e of the card (a classic card with no new mechanic gets none — the checklist §5); fhd + tv4k:
 *
 *   A · `diaspora-movement-locked` — the Reds do not rule, one of blue's delegates stands on their resolution: the hand
 *       refuses the play by NAME («Нельзя разыграть», the party, «1/2» — the TR15 class); X opens the viewer, whose
 *       verdict states BOTH roads where they stand («не у власти» · «1 из 2») and «Для вас» the count («3 → +3»).
 *   B · `diaspora-movement` — the Reds rule: the hand plate reads the counted gain «+3» (its own tag + one of blue's +
 *       one of red's — the server's `countedPlay`), the composer says how many and why (the «ПОЧЕМУ» strip — 3 Jovian
 *       tags), the face wears the T04 art; A plays it: the server pays 20 − 7 + 3 = 16 M€ and the card is in the tableau.
 *
 * Frames: `screenshots/t04/{fhd,tv4k}/card-*.png`. 4K timing claims: `TM_E2E_GPU=1`, `--workers=1`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openZoomViewer, press, pressUntil, settle} from './consoleStart';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const T04 = 'Diaspora Movement';
const OUT = path.resolve('screenshots', 't04');

type Wire = {thisPlayer: {megacredits: number, tableau: Array<{name: string}>}};

async function serverModel(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `card-${name}.png`)});
}

/** RT wheel → the hand, the cursor on T04. */
async function focusDiaspora(page: Page): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, T04, Math.max(14, slots * 3)), 'the cursor stands on T04').toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

for (const preset of PROFILES) {
  test.describe(`T04 Diaspora Movement · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the Reds do not rule: «✕», the party and «1/2»; X states both roads (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'diaspora-movement-locked', {query: preset.query});
      await focusDiaspora(page);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
      await expect(verdict, 'one of your delegates out of two').toContainText('1/2');
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${T04}"] [data-hand-count]`), 'a refusal wears no forecast plate').toHaveCount(0);
      await shot(page, preset.id, 'A-locked');
      await openZoomViewer(page);
      const viewer = page.locator('dialog.con-zoom[open]');
      // The viewer's verdict names BOTH roads where they stand now (the TR15 class), and «Для вас» the count it would pay.
      await expect(viewer, 'road 1 — the party does not rule').toContainText(/«Красные» не у власти/);
      await expect(viewer, 'road 2 — your delegates on its resolution').toContainText(/1 из 2/);
      await expect(viewer, '«for you»: 3 Jovian tags → +3').toContainText(/3\s*→\s*\+3/);
      await shot(page, preset.id, 'A-viewer');
      await closeZoomViewer(page);
    });

    test(`B · the Reds rule: «+3» on the plate and in the composer, A pays 3 (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'diaspora-movement', {query: preset.query});
      const before = await serverModel(request, playerId);
      await focusDiaspora(page);
      const slot = page.locator(`.con-hand__slot[data-zoom-slot="${T04}"]`);
      await expect(slot.locator('[data-hand-count]'), 'the counted play wears its plate').toHaveAttribute('data-hand-count', '3');
      expect(await slot.locator('img').evaluateAll((imgs) => imgs.some((i) => (i as HTMLImageElement).src.includes('T04'))), 'the face wears the T04 art').toBe(true);
      await shot(page, preset.id, 'B-hand');
      await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {settleMs: 1200});
      await settle(page, {timeoutMs: 20_000});
      const why = page.locator('.con-composer--play .con-cwhy');
      await expect(why, 'the composer says how many — 3 Jovian tags, its own included').toHaveCount(1);
      await expect(why.locator('.con-cwhy__num').first()).toHaveText('3');
      await expect(page.locator('.con-composer--play .action-effect-chip').filter({hasText: '3'}).first(), 'the +3 M€ chip').toBeVisible();
      await shot(page, preset.id, 'B-composer');
      for (let i = 0; i < 5 && await page.locator('.con-composer--play').count() > 0; i++) {
        await press(page, 'Enter', 900);
      }
      let after = await serverModel(request, playerId);
      for (let i = 0; i < 120 && !after.thisPlayer.tableau.some((c) => c.name === T04); i++) {
        await new Promise((r) => setTimeout(r, 250));
        after = await serverModel(request, playerId);
      }
      expect(after.thisPlayer.tableau.some((c) => c.name === T04), 'T04 is on the table').toBe(true);
      expect(after.thisPlayer.megacredits, 'the server: − 7 + 3').toBe(before.thisPlayer.megacredits - 7 + 3);
      await settle(page, {timeoutMs: 30_000});
      await shot(page, preset.id, 'B-played');
    });
  });
}
