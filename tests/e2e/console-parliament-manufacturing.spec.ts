import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, fetchPlayerModel, openCardActions, press, pressUntil, settle, waitForBoardHome, walkFocusUntil} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * MANUFACTURING RUN (Turmoil Redux, RX37) — «Серийный выпуск», the ONE e2e of a
 * law whose action is taken MORE THAN ONCE a generation: «add 2 floaters OR 1
 * fighter OR 1 mech to one of your cards; twice a generation, 3 times at
 * influence 2+».
 *
 *   · THE COUNT. Red opens generation 2 at influence 1 — «Действия карт» reads
 *     the law's tile «2 из 2»; after one use «1 из 2»; after the second the tile
 *     leaves the default view (RT shows it, spent) and «Ваши эффекты» read
 *     «2 раза за поколение» — never «раз за поколение».
 *   · THE FORM IS THE SCIENTISTS'. A on the tile opens the law's stage
 *     («ДЕЙСТВИЯ КАРТ › СЕРИЙНЫЙ ВЫПУСК»): the row «РЕСУРС» with THREE variants
 *     (the kinds red holds — floater, fighter, mech), the row «КАРТА-ЦЕЛЬ» with
 *     the holders of the chosen kind and their `current → resulting`.
 *   · THE TOKEN LANDS ON THE CARD (PL-427, the class): the commit's token is born
 *     on the law's face and lands on the chosen card's miniature in the target
 *     row — never on the ДОП. РЕСУРСЫ satellite under the glass.
 *
 * Fixture `parliament-manufacturing-enacted`. Screens under screenshots/parliament-manufacturing/.
 */
const OUT = path.resolve('screenshots', 'parliament-manufacturing');
const LAW = 'RDX_INDUSTRIALISTS_MANUFACTURING_RUN';
const MECHS = 'Construction Mechs';
const FLOATERS = 'Titan Shuttles';
const STAGE = '.con-pact--resolution';

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {tableau: ReadonlyArray<{name: string, resources?: number}>},
  game: {parliament?: {
    enacted?: {resolution: string},
    viewer?: {resolutionAction?: {resolution: string, usesLeft: number, usesPerGeneration: number, available: boolean}},
  }},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const resourcesOn = (m: Wire, card: string): number => m.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
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

/** Poll the SERVER until `ok` holds — never a fixed sleep. */
async function untilServer(request: APIRequestContext, playerId: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 160; i++) {
    last = await wireOf(request, playerId);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached: ${what} (last: uses ${JSON.stringify(last?.game.parliament?.viewer?.resolutionAction)})`);
}

/** In «ДЕЙСТВИЯ КАРТ»: steer the cursor onto the LAW's tile (geometry-steered, the focused tile as the witness). */
async function focusLawTile(page: Page): Promise<void> {
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-resolution') ?? '');
  await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'the law\'s tile is in the menu').toHaveCount(1);
  for (let i = 0; i < 16 && await focused() !== LAW; i++) {
    const dir = await page.evaluate((target) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile[data-action-resolution="${target}"]`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, LAW);
    await press(page, dir, 260);
  }
  if (await focused() !== LAW) {
    await walkFocusUntil(page, async () => await focused() === LAW, focused, 30);
  }
  expect(await focused(), 'never focused the law\'s tile').toBe(LAW);
}

/** The law's «N из M» on its plate in «Действия карт». */
async function lawUsesText(page: Page): Promise<string> {
  const chip = page.locator('.con-cardactions__group', {has: page.locator(`[data-action-resolution="${LAW}"]`)}).locator('.con-cardactions__plate-chip--uses');
  return ((await chip.first().textContent()) ?? '').trim();
}

/** Open the law's stage from «Действия карт» and pick `kind` (the variant's index) and `card` — the commit row armed, nothing sent. */
async function composeUse(page: Page, variant: number, card: string): Promise<void> {
  await openCardActions(page);
  await focusLawTile(page);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}), 'A opens the law\'s stage').toBeTruthy();
  await expect(page.locator(`${STAGE} [data-pact-opt]`).first(), 'the stage stands').toBeVisible({timeout: 20_000});
  await settle(page, {timeoutMs: 15_000});
  for (let i = 0; i < variant; i++) {
    await press(page, 'ArrowRight', 200);
  }
  expect(await pressUntil(page, 'Enter', async () => await page.locator(`${STAGE} [data-pact-card="${card}"]`).count() > 0, {tries: 3, settleMs: 700}),
    `A picks the variant whose holders include ${card}`).toBeTruthy();
  await expect(page.locator(`${STAGE} [data-pact-row="0"].con-pact__row--answered`), 'the resource row is answered').toHaveCount(1);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(`${STAGE} [data-pact-cta][data-pact-ready]`).count() > 0, {tries: 3, settleMs: 700}),
    'A picks the card: the commit is ready').toBeTruthy();
}

for (const preset of PRESETS) {
  test.describe(`Manufacturing Run (RX37) · twice a generation, the Scientists' form · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('«2 из 2» → mech onto Construction Mechs (the token lands on the card) → «1 из 2» → floaters onto Titan Shuttles → spent → «Ваши эффекты» read 2 a generation', async ({page, request}) => {
      test.setTimeout(480_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-manufacturing-enacted', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(before.game.parliament?.enacted?.resolution, 'the law stands enacted').toBe(LAW);
      expect(before.game.parliament?.viewer?.resolutionAction, 'influence 1 — twice').toMatchObject({resolution: LAW, usesLeft: 2, usesPerGeneration: 2, available: true});

      // ── ① «ДЕЙСТВИЯ КАРТ» — the law's tile, «2 из 2».
      await waitForBoardHome(page, 40);
      await settle(page, {timeoutMs: 20_000});
      await openCardActions(page);
      await focusLawTile(page);
      expect(await lawUsesText(page), 'the tile reads the live count').toMatch(/2\D+2/);
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset.id, '01-card-actions-law-tile');

      // ── ② THE STAGE: «РЕСУРС» with three variants, then «КАРТА-ЦЕЛЬ» for the mech: Construction Mechs 0 → 1.
      expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}), 'A opens the law\'s stage').toBeTruthy();
      await expect(page.locator(`${STAGE} [data-pact-opt]`), 'three kinds held — three variants').toHaveCount(3, {timeout: 20_000});
      await settle(page, {timeoutMs: 15_000});
      const crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `one crumb: the menu, the law (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
      expect(crumb).toContain('СЕРИЙНЫЙ ВЫПУСК');
      expect(await page.locator(`${STAGE} [data-pact-cta][data-pact-ready]`).count(), 'nothing chosen — the commit dims').toBe(0);
      await shoot(page, preset.id, '02-law-stage-three-variants');
      await press(page, 'ArrowRight', 200);
      await press(page, 'ArrowRight', 200);
      expect(await pressUntil(page, 'Enter', async () => await page.locator(`${STAGE} [data-pact-card="${MECHS}"]`).count() > 0, {tries: 3, settleMs: 700}),
        'A on the mech lists its holders').toBeTruthy();
      await expect(page.locator(`${STAGE} [data-pact-card="${MECHS}"] .con-pact__card-delta`), 'current → resulting').toContainText(/0\s*→\s*1/);
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset.id, '03-mech-targets');
      expect(await pressUntil(page, 'Enter', async () => await page.locator(`${STAGE} [data-pact-cta][data-pact-ready]`).count() > 0, {tries: 3, settleMs: 700}),
        'A picks the card: the commit is ready').toBeTruthy();

      // ── ③ THE COMMIT: the token is born on the law's face and lands ON the card (never the satellite under the glass).
      await armTransferWitness(page);
      const stopStory = await storyboard(page, preset.id, 'commit');
      expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 1,
        {tries: 3, settleMs: 2500}), 'A on the CTA commits one use').toBeTruthy();
      const one = await untilServer(request, playerId, (m) => resourcesOn(m, MECHS) === 1, 'a mech on Construction Mechs');
      expect(one.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 1, usesPerGeneration: 2, available: true});
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      const witness = await transferWitness(page);
      expect(endsOverGlass(witness), `no end on glass: ${transferTrail(witness)}`).toEqual([]);
      expect(witness.landings.some((l) => l.under === `composer-card:${MECHS}`), `the mech lands on the card in the target row: ${transferTrail(witness)}`).toBe(true);
      expect(witness.landings.some((l) => l.under.startsWith('aux:')), `never on the satellite: ${transferTrail(witness)}`).toBe(false);
      await shoot(page, preset.id, '04-after-first-use');

      // ── ④ «1 из 2» — and the SECOND use: 2 floaters onto Titan Shuttles.
      await openCardActions(page);
      await focusLawTile(page);
      expect(await lawUsesText(page), 'one use left').toMatch(/1\D+2/);
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset.id, '05-tile-one-left');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-cardactions').count() === 0, {tries: 3, settleMs: 900}), 'B closes the menu').toBeTruthy();
      await composeUse(page, 0, FLOATERS);
      expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 0,
        {tries: 3, settleMs: 2500}), 'the second use commits').toBeTruthy();
      const two = await untilServer(request, playerId, (m) => resourcesOn(m, FLOATERS) === 2, '2 floaters on Titan Shuttles');
      expect(two.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 0, usesPerGeneration: 2, available: false});
      await settle(page, {timeoutMs: 30_000});

      // ── ⑤ SPENT: the tile leaves the default view; RT shows it, «Активирована».
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'a spent action leaves the default view').toHaveCount(0);
      expect(await pressUntil(page, 'Period', async () => await page.locator(`.con-cardactions__tile--activated[data-action-resolution="${LAW}"]`).count() > 0,
        {tries: 3, settleMs: 700}), 'RT shows the law\'s tile, spent').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset.id, '06-tile-activated');
    });
  });
}
