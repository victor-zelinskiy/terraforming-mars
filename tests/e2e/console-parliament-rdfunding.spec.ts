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
 *   · THE PASSIVE IS VISIBLE AND SOURCED. The МЕТКИ zone's science digit is
 *     the count the law makes (printed + the addition) and the law's party —
 *     the Scientists — wears the medallion's corner as an emblem badge (the
 *     owner's grammar, 2026-10-25: no «+N», no line of text in the rail); the
 *     cell's own sentence names the law and the amount.
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
    tagBonuses?: ReadonlyArray<{tag: string, amount: number, resolution?: string, party?: string}>,
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

  test('the law is READ on the tag zone and WORKED from the table: the counted total and the party emblem, the repeat picked and run, the use spent', async ({page, request}) => {
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

    // ── ① THE TAG ZONE: the COUNTED total on the digit, the source party's emblem on the medallion
    // (the owner's grammar, 2026-10-25 — no «+N» beside the digit, no law's name over the matrix).
    await waitForBoardHome(page, 40);
    await settle(page, {timeoutMs: 20_000});
    const cell = page.locator('[data-tag-cell="science"]');
    await expect(cell.locator('.con-tagmx__num'), 'the digit is the count the law makes').toHaveText(String(printed + added));
    await expect(cell.locator('.con-tagmx__src'), 'the party of the law wears the medallion').toHaveAttribute('data-tag-bonus-source', LAW);
    // The addition belongs to ONE tag: no other cell carries the LAW's badge (the ruling Scientists' own
    // wild tag may wear theirs on the wild cell — that one is the party effect, not this law).
    await expect(page.locator(`.con-tagmx__src[data-tag-bonus-source="${LAW}"]`), 'exactly one cell carries the addition of the law').toHaveCount(1);
    expect((await cell.getAttribute('aria-label') ?? ''), 'the own sentence of the cell names the law').toMatch(/Финансирование исследований/i);
    await shoot(page, '01-tag-zone-addition');

    // ── ② THE LAW'S STAGE: the repeat is a SLOT, empty and inviting.
    await openCardActions(page);
    await expect(page.locator('.con-cardactions__plate', {hasText: /Финансирование исследований/i}), 'the plate names the law').toHaveCount(1);
    await focusLawTile(page);
    await settle(page, {timeoutMs: 10_000});
    // «Один фреймворк» (С4): THE card composer composes the law's action — Viron's repeat slot, the law's face the hero.
    const STAGE = `.con-cardactions .con-composer[data-composer-source="law:${LAW}"]`;
    expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the law\'s stage').toBeTruthy();
    const slot = page.locator(`${STAGE} [data-composer-repeat-slot]`);
    await expect(slot, 'the repeat stands as a SLOT').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator(`${STAGE} [data-composer-target-row]`), 'and never as a picker of its own').toHaveCount(0);
    await expect(page.locator(`${STAGE} .con-composer__actlaw .pcard`), 'the law\'s face is the hero').toBeVisible();
    await expect(page.locator('.con-cardactions .con-hand'), 'the hand is NOT the decision here — nothing is spent').toHaveCount(0);
    await settle(page, {timeoutMs: 15_000});
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `one crumb: the menu, the law, the stage (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('ФИНАНСИРОВАНИЕ ИССЛЕДОВАНИЙ');
    expect(await page.locator(`${STAGE} .con-composer__cta--ready`).count(), 'an empty slot arms nothing').toBe(0);
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
      async () => await page.locator('.con-cardactions').count() === 1 && await page.locator('[data-composer-repeat-name]').count() === 1,
      {tries: 6, settleMs: 900}), 'the pick resolves back into the law\'s slot').toBeTruthy();
    expect(resourcesOf(await wireOf(request, playerId), REPEATED),
      'and nothing was performed by choosing').toBe(microbesBefore);
    await expect(page.locator(`${STAGE} .con-composer__cta--ready`), 'only now is the commit ready').toHaveCount(1);
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

  // THE OWNER'S FIELD FREEZE (2026-10-31): the law repeating a DECK-CHECK action (Asteroid Deflection System —
  // «reveal the top card; a space tag adds an asteroid»). The commit claimed a deck-check verdict while the stage
  // stood in the draw-only pending beat: no verdict, the pad absorbed, only a reload helped. The verdict must stand
  // IN the law's stage, and its «ОК» must give the player the board back.
  test('a repeated DECK-CHECK action presents its verdict in the law\'s stage and lets the player go', async ({page, request}) => {
    test.setTimeout(300_000);
    const REVEALER = 'Asteroid Deflection System';
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-rdfunding-reveal', {query: PRESET.query});
    await waitForBoardHome(page, 40);
    await settle(page, {timeoutMs: 20_000});

    await openCardActions(page);
    await focusLawTile(page);
    await settle(page, {timeoutMs: 10_000});
    const STAGE = `.con-cardactions .con-composer[data-composer-source="law:${LAW}"]`;
    expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the law\'s stage').toBeTruthy();
    await expect(page.locator(`${STAGE} [data-composer-repeat-slot]`), 'the repeat stands as a SLOT').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() === 2, {tries: 4, settleMs: 900}),
      'A opens the shared repeat pick').toBeTruthy();
    await expect(page.locator('.con-cardactions').nth(1).locator(`[data-action-card="${REVEALER}"]`),
      'the deck-check action is the candidate').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    expect(await pressUntil(page, 'Enter',
      async () => await page.locator('.con-cardactions').count() === 1 && await page.locator('[data-composer-repeat-name]').count() === 1,
      {tries: 6, settleMs: 900}), 'the pick resolves back into the law\'s slot').toBeTruthy();
    await settle(page, {timeoutMs: 15_000});

    // ── THE COMMIT: the use is spent on the server…
    expect(await pressUntil(page, 'Enter',
      async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 0,
      {tries: 4, settleMs: 900}), 'the law\'s own CTA commits and spends the use').toBeTruthy();
    await shoot(page, '11-reveal-committed');

    // …and the VERDICT stands inside the workspace the press was made in (never the pending beat forever).
    await expect(page.locator('.con-cardactions .con-verdict'), 'the deck-check verdict is presented in the stage')
      .toBeVisible({timeout: 30_000});
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '12-reveal-verdict');

    // ── «ОК» ENDS THE OPERATION: the workspace leaves and the board is the player's again.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() === 0,
      {tries: 3, settleMs: 1500}), 'A on the verdict concludes the workspace').toBeTruthy();
    await expect(page.locator('.con-reveal'), 'no standalone reveal rises over the board after the take').toHaveCount(0, {timeout: 10_000});
    await waitForBoardHome(page, 20);
    await shoot(page, '13-reveal-done');
  });
});
