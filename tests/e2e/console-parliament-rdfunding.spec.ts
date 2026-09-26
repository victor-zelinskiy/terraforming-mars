import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openCardActions, press, pressUntil, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * R&D FUNDING (Turmoil Redux, RX26) — the ONE e2e of the new mechanics: a law
 * that gives NOTHING at its enactment and everything while it stands.
 *
 *   · THE PASSIVE IS VISIBLE AND NAMED. The МЕТКИ zone keeps printing the
 *     PRINTED science count and states the law's addition BESIDE it — a mint
 *     «+N» — with the law named in the zone's own head. A player must be able
 *     to read «what I have played» and «what is counted right now» at once,
 *     and a «+2» whose author lived only in a tooltip would be a bonus from
 *     nowhere (this console has no hover popovers).
 *   · THE ACTION IS A DECISION ON THE TABLE. Open IP Trade's pick is made in
 *     the HAND (its cards leave); a repeat spends nothing and touches only
 *     cards already on the table, so the candidates stand in the law's own
 *     stage as premium faces, and the commit is a SECOND deliberate press.
 *   · THE REPEAT REALLY RUNS. The picked card's action happens a second time
 *     and its result is on the card (Tardigrades: one microbe → two).
 *   · THE USE IS SPENT. The law's tile leaves the default view and reads as
 *     activated.
 *
 * Fixture `parliament-rdfunding-enacted` (the law enacted, red opening
 * generation 2 at influence ≥ 1, with one action already used this
 * generation). Screens under screenshots/parliament-rdfunding/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-rdfunding');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const LAW = 'RDX_SCIENTISTS_RD_FUNDING';
const REPEATED = 'Tardigrades';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Wire = {
  thisPlayer: {
    color: string,
    tags: Record<string, number>,
    tagBonuses?: ReadonlyArray<{tag: string, amount: number, resolution: string}>,
    tableau: ReadonlyArray<{name: string, resources?: number}>,
  },
  game: {parliament?: {
    enacted?: {resolution: string},
    viewer?: {resolutionAction?: {resolution: string, usesLeft: number, available: boolean, reason: string}},
  }},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

const resourcesOf = (wire: Wire, name: string): number =>
  wire.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0;

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

test.describe(`R&D Funding · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the law is READ on the tag zone and WORKED from the table: «+N» beside the printed count, the repeat picked and run, the use spent', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-rdfunding-enacted', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    expect(before.game.parliament?.enacted?.resolution, 'the law stands enacted').toBe(LAW);
    expect(before.game.parliament?.viewer?.resolutionAction, 'the server offers the action').toMatchObject({resolution: LAW, usesLeft: 1, available: true});

    const bonus = (before.thisPlayer.tagBonuses ?? []).find((b) => b.tag === 'science');
    expect(bonus, 'the model carries the science addition, named by the law').toMatchObject({resolution: LAW});
    const added = bonus!.amount;
    expect(added, 'the seat holds influence, so the addition is real').toBeGreaterThan(0);
    const printed = before.thisPlayer.tags.science ?? 0;
    expect(printed, 'and a PRINTED count for it to stand beside').toBeGreaterThan(0);
    const microbesBefore = resourcesOf(before, REPEATED);
    expect(microbesBefore, 'the candidate already ran once this generation').toBe(1);

    // ── ① THE TAG ZONE: the printed count, the addition beside it, the law named.
    await waitForBoardHome(page, 40);
    await settle(page, {timeoutMs: 20_000});
    const cell = page.locator('[data-tag-cell="science"]');
    await expect(cell.locator('.con-tagmx__num'), 'the PRINTED count keeps printing').toHaveText(String(printed));
    await expect(cell.locator('.con-tagmx__bonus'), 'the law\'s addition stands beside it').toHaveText(`+${added}`);
    await expect(page.locator('[data-tag-bonus-law]'), 'and the head names the law').toHaveText(/Финансирование исследований/i);
    // No other cell gained anything: the addition belongs to ONE tag.
    await expect(page.locator('.con-tagmx__bonus'), 'exactly one cell carries an addition').toHaveCount(1);
    expect((await cell.getAttribute('aria-label') ?? ''), 'the cell\'s own sentence names the law too').toMatch(/Финансирование исследований/i);
    await shoot(page, '01-tag-zone-addition');

    // ── ② THE LAW'S STAGE: the candidates stand on the TABLE, inside the law's own stage.
    await openCardActions(page);
    await expect(page.locator('.con-cardactions__plate', {hasText: /Финансирование исследований/i}), 'the plate names the law').toHaveCount(1);
    await focusLawTile(page);
    await settle(page, {timeoutMs: 10_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-pact--resolution').count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the law\'s stage').toBeTruthy();
    const candidate = page.locator(`.con-pact--resolution .con-pact__card[data-pact-card="${REPEATED}"]`);
    await expect(candidate, 'the used action stands as a candidate in the stage itself').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-pact--resolution .con-pact__hero--bill .pcard'), 'the law\'s face is the hero').toBeVisible();
    await expect(page.locator('.con-pact--resolution .con-pact__handzone'), 'the hand is NOT the decision here — nothing is spent').toHaveCount(0);
    await settle(page, {timeoutMs: 15_000});
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `one crumb: the menu, the law, the stage (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('ФИНАНСИРОВАНИЕ ИССЛЕДОВАНИЙ');
    await shoot(page, '02-repeat-candidates');

    // ── ③ A PICKS, a SECOND press COMMITS — the choice is never the commit.
    expect(await page.locator('[data-pact-cta][data-pact-ready]').count(), 'nothing is pre-answered').toBe(0);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-pact__card--picked').count() > 0, {tries: 4, settleMs: 500}),
      'A picks the card').toBeTruthy();
    await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'and only then is the commit ready').toHaveCount(1);
    await shoot(page, '03-candidate-picked');
    expect(await pressUntil(page, 'Enter',
      async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 0,
      {tries: 4, settleMs: 900}), 'the second press commits and spends the use').toBeTruthy();

    // ── ④ THE REPEAT RAN: the card's action happened a second time.
    await expect.poll(async () => resourcesOf(await wireOf(request, playerId), REPEATED), {timeout: 60_000,
      message: 'the picked action ran AGAIN'}).toBe(microbesBefore + 1);
    await waitForBoardHome(page, 40);
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '04-repeat-done');

    // ── ⑤ THE USE IS SPENT, and the tag addition is untouched by any of it.
    const after = await wireOf(request, playerId);
    expect(after.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 0, available: false});
    expect(after.thisPlayer.tags.science, 'the PRINTED count never moved').toBe(printed);
    expect((after.thisPlayer.tagBonuses ?? []).find((b) => b.tag === 'science')?.amount, 'and the law still adds the same').toBe(added);
    await openCardActions(page);
    await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'a spent action leaves the default view').toHaveCount(0);
    expect(await pressUntil(page, 'Period', async () => await page.locator(`.con-cardactions__tile--activated[data-action-resolution="${LAW}"]`).count() > 0, {tries: 3, settleMs: 700}),
      'RT shows the activated actions: the law\'s tile is there, spent').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await shoot(page, '05-tile-spent');
  });
});
