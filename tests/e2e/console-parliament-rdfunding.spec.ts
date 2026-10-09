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
 *   · THE ACTION IS A SLOT, AND THE PICK IS THE SHARED ONE. «Which of my
 *     already-used actions» has ONE surface in this console — the ДЕЙСТВИЯ
 *     КАРТ list in repeat mode, reached through the bridge Viron, Project
 *     Inspection and the Hydronetwork already use. The law's stage shows the
 *     repeat as a slot, A opens that list, the chosen action lands back in the
 *     slot, and the commit is a SECOND deliberate press on the law's own CTA.
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

/**
 * THE LAW'S NAME over the МЕТКИ matrix (PL-097): never cut — no overflow in its
 * own box, inside the matrix's column, and the matrix's last row still whole
 * above the zone's bottom (the second line is paid by the grid, which re-solves
 * its rows into the height left). `lines` is the rendered line count.
 */
async function lawNoteFit(page: Page): Promise<{whole: boolean, lines: number, text: string, box: string}> {
  return page.locator('[data-tag-bonus-law]').evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const zone = el.closest('.con-tagmx')?.getBoundingClientRect();
    const cells = Array.from(el.closest('.con-tagmx')?.querySelectorAll('.con-tagmx__cell') ?? []);
    const lastBottom = Math.max(...cells.map((c) => c.getBoundingClientRect().bottom));
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.1;
    const whole = el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1 &&
      zone !== undefined && r.left >= zone.left - 1 && r.right <= zone.right + 1 && lastBottom <= zone.bottom + 1;
    return {
      whole, lines: Math.round(r.height / lineHeight), text: (el.textContent ?? '').trim(),
      box: `${Math.round(r.width)}x${Math.round(r.height)} sw=${el.scrollWidth} cw=${el.clientWidth} zone=${zone === undefined ? '-' : `${Math.round(zone.left)}..${Math.round(zone.right)}/${Math.round(zone.bottom)}`} last=${Math.round(lastBottom)}`,
    };
  });
}

/** The narrow rail (PL-097): 1280 × 800 handheld — the name wraps whole, it is never an ellipsis. */
const DECK = {id: 'deck-800', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'} as const;

test.describe(`R&D Funding · ${DECK.id}`, () => {
  test.use({viewport: DECK.viewport});

  test('PL-097 — the law\'s name over the МЕТКИ matrix stands WHOLE in the Deck\'s rail: a second line, never an ellipsis', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'parliament-rdfunding-enacted', {query: DECK.query});
    await waitForBoardHome(page, 40);
    await settle(page, {timeoutMs: 20_000});
    await expect(page.locator('[data-tag-bonus-law]'), 'the head names the law').toHaveText(/Финансирование исследований/i);
    const note = await lawNoteFit(page);
    expect(note.whole, `the law's name stands whole in the narrow rail (${JSON.stringify(note)})`).toBe(true);
    expect(note.lines, `it takes a second line rather than an ellipsis (${JSON.stringify(note)})`).toBeLessThanOrEqual(2);
    await expect(page.locator('[data-tag-cell="science"] .con-tagmx__bonus'), 'the addition still stands beside the count').toBeVisible();
    await shoot(page, `deck-01-tag-zone-law`);
  });
});

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
    const note = await lawNoteFit(page);
    expect(note.whole, `the law's name stands whole (${JSON.stringify(note)})`).toBe(true);
    expect(note.lines, `where it fits, the name is the ONE line it always was (${JSON.stringify(note)})`).toBe(1);
    await shoot(page, '01-tag-zone-addition');

    // ── ② THE LAW'S STAGE: the repeat is a SLOT, empty and inviting.
    await openCardActions(page);
    await expect(page.locator('.con-cardactions__plate', {hasText: /Финансирование исследований/i}), 'the plate names the law').toHaveCount(1);
    await focusLawTile(page);
    await settle(page, {timeoutMs: 10_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-pact--resolution').count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the law\'s stage').toBeTruthy();
    const slot = page.locator('.con-pact--resolution [data-pact-repeat-slot]');
    await expect(slot, 'the repeat stands as a SLOT').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-pact--resolution .con-pact__card'), 'and never as a picker of its own').toHaveCount(0);
    await expect(page.locator('.con-pact--resolution .con-pact__hero--bill .pcard'), 'the law\'s face is the hero').toBeVisible();
    await expect(page.locator('.con-pact--resolution .con-pact__handzone'), 'the hand is NOT the decision here — nothing is spent').toHaveCount(0);
    await settle(page, {timeoutMs: 15_000});
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `one crumb: the menu, the law, the stage (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('ФИНАНСИРОВАНИЕ ИССЛЕДОВАНИЙ');
    expect(await page.locator('[data-pact-cta][data-pact-ready]').count(), 'an empty slot arms nothing').toBe(0);
    await shoot(page, '02-repeat-slot-empty');

    // ── ③ A ON THE SLOT opens the SHARED pick: the ДЕЙСТВИЯ КАРТ list in repeat
    //     mode stands OVER the law's stage (two roots — the source is hidden,
    //     never unmounted), and the candidate is in THAT list.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() === 2, {tries: 4, settleMs: 900}),
      'A opens the shared repeat pick').toBeTruthy();
    await expect(page.locator('.con-cardactions').nth(1).locator(`[data-action-card="${REPEATED}"]`),
      'the used action is a candidate in the shared list').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    const pickCrumb = (await crumbText(page)).toUpperCase();
    expect(pickCrumb, `the crumb only GAINS a tail (${pickCrumb})`).toContain('ФИНАНСИРОВАНИЕ ИССЛЕДОВАНИЙ');
    await shoot(page, '03-shared-repeat-pick');

    // ── ④ THE CHOICE LANDS IN THE SLOT — A = «Выбрать», never «Выполнить».
    expect(await pressUntil(page, 'Enter',
      async () => await page.locator('.con-cardactions').count() === 1 && await page.locator('[data-pact-repeat-name]').count() === 1,
      {tries: 6, settleMs: 900}), 'the pick resolves back into the law\'s slot').toBeTruthy();
    expect(resourcesOf(await wireOf(request, playerId), REPEATED),
      'and nothing was performed by choosing').toBe(microbesBefore);
    await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'only now is the commit ready').toHaveCount(1);
    await shoot(page, '04-slot-filled');

    // ── ⑤ THE SECOND PRESS COMMITS.
    expect(await pressUntil(page, 'Enter',
      async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 0,
      {tries: 4, settleMs: 900}), 'the law\'s own CTA commits and spends the use').toBeTruthy();

    // ── ⑥ THE REPEAT RAN: the card's action happened a second time.
    await expect.poll(async () => resourcesOf(await wireOf(request, playerId), REPEATED), {timeout: 60_000,
      message: 'the picked action ran AGAIN'}).toBe(microbesBefore + 1);
    await waitForBoardHome(page, 40);
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '05-repeat-done');

    // ── ⑦ THE USE IS SPENT, and the tag addition is untouched by any of it.
    const after = await wireOf(request, playerId);
    expect(after.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 0, available: false});
    expect(after.thisPlayer.tags.science, 'the PRINTED count never moved').toBe(printed);
    expect((after.thisPlayer.tagBonuses ?? []).find((b) => b.tag === 'science')?.amount, 'and the law still adds the same').toBe(added);
    await openCardActions(page);
    await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'a spent action leaves the default view').toHaveCount(0);
    expect(await pressUntil(page, 'Period', async () => await page.locator(`.con-cardactions__tile--activated[data-action-resolution="${LAW}"]`).count() > 0, {tries: 3, settleMs: 700}),
      'RT shows the activated actions: the law\'s tile is there, spent').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await shoot(page, '06-tile-spent');
  });
});
