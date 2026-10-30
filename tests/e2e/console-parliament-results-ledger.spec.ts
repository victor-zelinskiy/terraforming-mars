import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, crumbText, fetchPlayerModel, openMandatoryAnnounce, pressUntil, settle} from './consoleStart';
import {
  armLeakWitness, closeSitting, expectParliamentFits, expectResultsContained, ledgerRecords, mandatoryPlate, parliament, sittingStage, strandedReports,
  waitSittingAtRest,
} from './parliamentDrive';

/**
 * THE RESULTS LEDGER (P71 · ledger CY — «ИТОГИ ЗАСЕДАНИЯ — ВЕДОМОСТЬ ИТОГОВ, НЕ ЧИП НА ЗАПИСЬ · РАЗБОР ПО МЕСТАМ —
 * ВЛИЯНИЕ С СОСТАВОМ ИЗ СНИМКА»). `parliament-results-colonial-three`: Colonial Affairs on three seats, the sitting over:
 *  · the CARD — ONE ROW PER SEAT with the seat's TOTALS: blue (P71 on its table, influence 1 + 1 = 2 → k = 3) reads
 *    «+6 M€ · +3 floaters on a card · +6 cards · ⌫3» — Pluto's three pairs never six chips — with a planet ×3 per tile
 *    under them; red is the winner of the vote, the crown on its own line; yellow's row is one named skip;
 *  · X — the BREAKDOWN per seat: blue's column reads its influence «2 = Карьера 1 + Колониальное представительство
 *    +1» off the server's snapshot, what it meant (×3), a line per tile (Pluto ×3), and ИТОГО token for token the
 *    card's row; B folds it back; A closes the sitting. No POST but the close.
 * Screens under screenshots/p71/tv4k/ (the storyboard of the visual acceptance: `TM_E2E_STORYBOARD=1`).
 */
const OUT = path.resolve('screenshots', 'p71');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const DETAILS = '[data-sit-payout-details]';

type Wire = {
  thisPlayer: {color: string},
  game: {parliament?: {lastPhase?: {outcomes?: Array<{player?: string, kind: string}>}, phase?: {outcomes?: Array<{player?: string, kind: string}>}}},
};

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** The results card on screen: the plate, the sitting, its results page at rest. */
async function openResults(page: Page): Promise<void> {
  await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
  expect(await openMandatoryAnnounce(page), 'the plate opens the sitting').toBe(true);
  await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
  await expect.poll(() => sittingStage(page), {timeout: 30_000}).toBe('results');
  await waitSittingAtRest(page, 30_000);
  await expect(page.locator('[data-sit-results]:not([data-sit-results-hidden])')).toHaveCount(1, {timeout: 30_000});
  await settle(page, {timeoutMs: 20_000});
}

async function serverRecords(request: APIRequestContext, id: string, color: string): Promise<number> {
  const wire = await fetchPlayerModel(request, id) as unknown as Wire;
  const outcomes = wire.game.parliament?.lastPhase?.outcomes ?? wire.game.parliament?.phase?.outcomes ?? [];
  return outcomes.filter((o) => o.player === color).length;
}

const tokenTexts = (page: Page, scope: string) => page.locator(`${scope} [data-sit-total]`).evaluateAll((els) => els.map((el) =>
  `${el.getAttribute('data-sit-total-kind')}:${el.getAttribute('data-sit-total-unit')}:${el.getAttribute('data-sit-total-amount') ?? ''}`));

test.describe(`P71 · the sitting's results — a ledger of totals, a breakdown per seat · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the ledger: one row per seat, totals not records, the crown on its line, the skip named; X: blue\'s influence from the snapshot with the card in it', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-results-colonial-three', {query: PRESET.query, landing: 'prompt'});
    await armLeakWitness(page);
    const posts = watchPosts(page);
    // The seats by their table colours (the dev loader opens the first seat of the NEXT generation's order — red here):
    // blue holds the card, red won the vote, yellow has no colony.
    const blue = 'blue';
    const red = 'red';
    const yellow = 'yellow';
    const colors = await Promise.all(seats.map(async (seat) => ((await fetchPlayerModel(request, seat)) as unknown as Wire).thisPlayer.color));
    expect([...colors].sort(), 'the three seats').toEqual([blue, red, yellow].sort());
    const blueId = seats[colors.indexOf(blue)];
    await openResults(page);

    // ── THE CARD: ONE ROW PER SEAT ──
    await expect(page.locator('[data-sit-payout]'), 'three seats, three rows').toHaveCount(3);
    const blueRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${blue}"]`);
    const unit = (u: string) => blueRow.locator(`[data-sit-total][data-sit-total-kind="unit"][data-sit-total-unit="${u}"]`);
    await expect(unit('megacredits'), 'Luna ×3: +6 M€').toHaveAttribute('data-sit-total-amount', '6');
    await expect(unit('cards'), 'Miranda ×3 and Pluto\'s three draws — ONE token').toHaveAttribute('data-sit-total-amount', '6');
    await expect(blueRow.locator('[data-sit-total][data-sit-total-kind="discard"]'), 'Pluto\'s three discards — one token').toHaveAttribute('data-sit-total-amount', '3');
    await expect(blueRow.locator('[data-sit-total][data-sit-total-kind="unit"][data-sit-total-unit="Floater"]'), 'Titan ×3: three floaters').toHaveAttribute('data-sit-total-amount', '3');
    await expect(blueRow.locator('[data-sit-total-card]'), 'the floaters name the card they landed on').toHaveCount(1);
    expect(await ledgerRecords(blueRow), 'every record of blue\'s is in one of its totals').toBe(await serverRecords(request, blueId, blue));
    const marks = blueRow.locator('[data-sit-total-source][data-sit-total-source-kind="colony"]');
    await expect(marks, 'a planet per tile under the tokens').toHaveCount(4);
    expect((await marks.allTextContents()).map((t) => t.trim()), 'each with the law\'s ×3').toEqual(['×3', '×3', '×3', '×3']);
    const redRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${red}"]`);
    await expect(redRow.locator('[data-sit-payout-winner]'), 'the winner of the vote — the crown on its own line').toHaveCount(1);
    await expect(page.locator('[data-sit-payout-winner]'), 'one crown').toHaveCount(1);
    const yellowRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${yellow}"]`);
    await expect(yellowRow.locator('[data-sit-total][data-sit-total-kind="skipped"]'), 'yellow: one named skip').toHaveCount(1);
    await expect(yellowRow.locator('[data-sit-total][data-sit-total-kind="unit"]')).toHaveCount(0);
    await expect(page.locator('[data-sit-row="results-fresh"]').or(page.locator('[data-sit-section="table"]')).first(), 'the next vote stands').toBeVisible();
    await expectResultsContained(page, `${PRESET.id} ledger`);
    await expectParliamentFits(page, `${PRESET.id} ledger`);
    const cardBlue = await tokenTexts(page, `[data-sit-payout][data-sit-payout-seat="${blue}"]`);
    await shoot(page, 'e-ledger-colonial-three');

    // ── X: THE BREAKDOWN PER SEAT ──
    expect(await pressUntil(page, 'KeyX', async () => await page.locator(DETAILS).count() === 1, {tries: 3, settleMs: 900}), 'X opens «ПОДРОБНОСТИ ВЫПЛАТ»').toBe(true);
    await settle(page, {timeoutMs: 20_000});
    expect(await crumbText(page), 'the crumb grows forward one level').toMatch(/ИТОГИ\s*·\s*ВЫПЛАТЫ/i);
    const col = page.locator(`${DETAILS} [data-sitpd-seat="${blue}"]`);
    await expect(col.locator('[data-sitpd-influence]'), 'the influence the law read').toHaveAttribute('data-sitpd-influence-total', '2');
    await expect(col.locator('[data-sitpd-influence-source="career"]'), 'the Career: level 1').toHaveAttribute('data-sitpd-influence-amount', '1');
    const giver = col.locator('[data-sitpd-influence-source="giver"][data-sitpd-influence-giver="Colonial Representation"]');
    await expect(giver, 'the card, by name, in what the influence was made of').toHaveCount(1);
    await expect(giver).toHaveAttribute('data-sitpd-influence-amount', '1');
    await expect(giver, 'translated').toContainText('Колониальное представительство');
    await expect(col.locator('[data-sitpd-meaning][data-sitpd-meaning-effect="colonyBonuses"]'), 'what it meant: the multiplier read at 2').toHaveCount(1);
    await expect(col.locator('[data-sitpd-line][data-sitpd-line-kind="colony"]'), 'a line per tile').toHaveCount(4);
    await expect(col.locator('[data-sitpd-line-id="colony:Pluto"] [data-sitpd-line-times]'), 'Pluto ×3').toHaveText('×3');
    expect(await tokenTexts(page, `${DETAILS} [data-sitpd-seat="${blue}"] [data-sitpd-total]`), 'ИТОГО — the card\'s own row, token for token').toEqual(cardBlue);
    await expect(page.locator(`${DETAILS} [data-sitpd-seat="${yellow}"] [data-sitpd-influence]`).or(page.locator(`${DETAILS} [data-sitpd-seat="${yellow}"] [data-sit-total-kind="skipped"]`)).first(),
      'yellow\'s column says why it got nothing').toBeVisible();
    await expectResultsContained(page, `${PRESET.id} breakdown`);
    await shoot(page, 'f-breakdown-colonial-three');

    // ── B folds it back; A closes the sitting — the close is the only POST ──
    expect(await pressUntil(page, 'Escape', async () => await page.locator(DETAILS).count() === 0, {tries: 3, settleMs: 900}), 'B folds the breakdown back').toBe(true);
    expect(await sittingStage(page), 'B never left the results page').toBe('results');
    expect(posts, 'reading sends nothing').toEqual([]);
    await closeSitting(page, request, playerId);
    expect(posts.length, 'the close is ONE POST').toBe(1);
    expect(await strandedReports(page)).toEqual([]);
  });
});
