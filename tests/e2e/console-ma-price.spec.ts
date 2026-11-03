import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, crumbText, fetchPlayerModel, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * THE MILESTONE'S PRICE AND HELION'S BILL — the MA workspace's commit (ledger FB · PL-1621 / PL-1622):
 *
 *   I (`ma-claim-price`)  — Terraformer claimed for 8 M€: the price token is born on the rail's M€ row and absorbed in
 *     the detail's printed «ЦЕНА» (`ma-price`) BEFORE the ceremony stands; the server's M€ 20 → 12; nothing over glass.
 *   J (`ma-claim-helion`) — Helion, 5 M€ + 20 heat: A on the detail stands «› ОПЛАТА» INSIDE it (the crumb's tail, the
 *     shared payment panel with its heat row; the workspace stays); B folds it with nothing sent; A again and A pays —
 *     ONE POST carries the claim AND the addressed payment; the milestone is claimed, the ceremony plays in the stage
 *     (never the standalone payment surface), the heat leaves its own row.
 */

const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'ma-price', PRESET.id);

type Wire = {
  thisPlayer: {megaCredits?: number, megacredits?: number, heat: number, color: string},
  game: {milestones: Array<{name: string, color?: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const mcOf = (w: Wire) => w.thisPlayer.megaCredits ?? w.thisPlayer.megacredits ?? 0;
const claimedByMe = (w: Wire) => w.game.milestones.some((m) => m.name.startsWith('Terraformer') && m.color === w.thisPlayer.color);

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
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

/** The milestones workspace, the cursor on Terraformer, its detail stage open. */
async function openTerraformer(page: Page): Promise<void> {
  await press(page, 'KeyQ', 1400);
  await page.waitForSelector('.con-ma', {timeout: 10_000});
  // Two columns of three tiles: walk the grid onto Terraformer (rows first, then the column).
  for (let hop = 0; hop < 8; hop++) {
    const at = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.con-ma__card')];
      return {
        cur: cards.findIndex((c) => c.classList.contains('con-ma__card--focused')),
        target: cards.findIndex((c) => (c.getAttribute('data-ma-row') ?? '').startsWith('Terraformer')),
      };
    });
    if (at.cur === at.target || at.cur < 0 || at.target < 0) {
      break;
    }
    const [curRow, tgtRow] = [Math.floor(at.cur / 2), Math.floor(at.target / 2)];
    await press(page, curRow !== tgtRow ? (curRow < tgtRow ? 'ArrowDown' : 'ArrowUp') : (at.cur % 2 < at.target % 2 ? 'ArrowRight' : 'ArrowLeft'), 300);
  }
  expect(await page.locator('.con-ma__card--focused').getAttribute('data-ma-row'), 'the cursor on Terraformer').toMatch(/^Terraformer/);
  await press(page, 'Enter', 1200);
  await page.waitForSelector('.con-mafocus', {timeout: 8_000});
  await cinematicBeat(page, 500, 'the detail must be READABLE before its commit arms (COMMIT_ARM_MS)');
}

test.describe(`MA · the price leaves the rail first, Helion pays inside · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('I · the claim\'s 8 M€ leave the M€ row into the printed price before the ceremony', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'ma-claim-price', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    await openTerraformer(page);
    await expect(page.locator('.con-mafocus [data-ma-price-target]'), 'the printed price on the detail').toHaveCount(1);
    await shoot(page, 'i-detail');
    await armTransferWitness(page);
    const posts = watchPosts(page);
    await press(page, 'Enter', 200);
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    expect(posts.length, 'ONE POST').toBe(1);
    await expect.poll(async () => claimedByMe(await wireOf(request, id)), {timeout: 20_000, message: 'the server: Terraformer claimed'}).toBe(true);
    await expect(page.locator('.con-ma'), 'the workspace leaves after its ceremony').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(mcOf(before) - mcOf(after), 'the claim cost 8 M€').toBe(8);
    const witness = await transferWitness(page);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'i-trail.txt'), transferTrail(witness) + '\n');
    const price = witness.births.find((b) => b.under === 'rail:megacredits');
    expect(price, `the price token is born on the M€ row — ${transferTrail(witness)}`).toBeDefined();
    const absorbed = witness.landings.find((l) => l.id === price!.id);
    expect(absorbed?.under, `…and absorbed in the printed price — ${transferTrail(witness)}`).toBe('ma-price');
    const crown = witness.births.find((b) => b.under === 'ma-vp');
    if (crown !== undefined && absorbed !== undefined) {
      expect(crown.t, 'price, THEN crown: the +5 is born after the price was absorbed').toBeGreaterThanOrEqual(absorbed.t);
    }
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
  });

  test('J · Helion: «› ОПЛАТА» inside the detail — B folds it, A pays — ONE POST, the claim and its addressed bill', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'ma-claim-helion', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    const posts = watchPosts(page);
    await openTerraformer(page);
    // A on the detail stands the payment INSIDE it — nothing sent, the workspace stays.
    await press(page, 'Enter', 700);
    await expect(page.locator('[data-ma-pay]'), 'the payment stands in the detail').toBeVisible();
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb\'s tail moves forward', timeout: 5_000}).toContain('ОПЛАТА');
    await expect(page.locator('[data-ma-pay] .con-payrow[data-pay-unit="heat"]'), 'Helion\'s heat row').toHaveCount(1);
    expect(posts.length, 'nothing sent').toBe(0);
    await shoot(page, 'j-pay');
    // B — one level back to the detail, nothing sent.
    await press(page, 'Escape', 700);
    await expect(page.locator('.con-mafocus'), 'still the detail').toHaveCount(1);
    await expect(page.locator('[data-ma-pay]'), 'the payment face folded').toHaveCount(0);
    expect(posts.length, 'B sent nothing').toBe(0);
    // The detail's rail names the payment step — never an M€-only «5 → −3» for a claim paid in heat.
    await expect(page.locator('.con-mafocus .con-marail'), 'the rail names the payment step').toContainText('Способ оплаты');
    // A again, then A pays.
    await press(page, 'Enter', 700);
    await expect(page.locator('[data-ma-pay]')).toBeVisible();
    await armTransferWitness(page);
    await press(page, 'Enter', 200);
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    expect(posts.length, 'ONE POST').toBe(1);
    expect(posts[0], 'the POST carries the payment').toContain('"payment"');
    await expect.poll(async () => claimedByMe(await wireOf(request, id)), {timeout: 20_000, message: 'the server: Terraformer claimed'}).toBe(true);
    await expect(page.locator('.con-ma'), 'the workspace leaves after its ceremony').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(before.thisPlayer.heat - after.thisPlayer.heat + (mcOf(before) - mcOf(after)), 'the bill was 8, heat first').toBe(8);
    expect(before.thisPlayer.heat - after.thisPlayer.heat, 'Helion paid in heat').toBeGreaterThan(0);
    const witness = await transferWitness(page);
    fs.writeFileSync(path.join(OUT, 'j-trail.txt'), transferTrail(witness) + '\n');
    const railTrail = await page.evaluate(() => JSON.stringify(
      ((window as unknown as {__conReady?: () => {transfer: {trail: ReadonlyArray<unknown>}}}).__conReady?.().transfer.trail ?? [])
        .filter((e) => JSON.stringify(e).includes('rail:'))));
    expect(witness.births.some((b) => b.under === 'rail:heat'), `the heat leaves its own row — ${transferTrail(witness)}
${railTrail}`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
  });
});
