import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR57 «ГОРНЫЕ МЕХИ» — the Industrialists' fifth plate and the mechs' EIGHTH holder: one declaration, one PRICE
 * («2 mechs here») and two GOODS (+1 steel OR titanium production). Against a real server, on two profiles:
 *
 *   (A) THE PLAY (`mining-mechs`): the card plays for 7 M€ — ONE POST, the card on the table with its four mechs,
 *       every flight's ends visible.
 *   (B) THE ACTION (`mining-mechs-action`, 3 mechs): «Действия карт» shows ONE tile — the card prints ONE row,
 *       the price once over its two goods; its composer asks the variant as two OUTCOME TILES (steel · titanium), A
 *       selects steel (the press, never the cursor), the commit is ONE POST; the server: mechs 3 → 1, +1 steel prod.
 *   (C) TOO FEW MECHS (`mining-mechs-short`, 1 mech): the tile refused with ONE counted reason — «1 из 2 мехов на
 *       этой карте» (PL-197), never the bare «недостаточно ресурсов».
 *   (D) THE REDS RULE (`mining-mechs-locked`): «✕ Нельзя разыграть» with the Industrialists' count.
 *   (E) THE SATELLITE (`mining-mechs-split`, TR57 beside TR40 — PL-484): the mechs split by meaning, TR57's lane wears
 *       its CHOICE — steel / titanium production on one plate — and TR40's lane its one good.
 */

const CARD = 'Mining Mechs';
const OUT = path.resolve('screenshots', 'tr57', 'e2e');
const PLAY_COMPOSER = '.con-composer--play';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, steelProduction: number, titaniumProduction: number, tableau: Array<{name: string, resources?: number}>},
};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const mechsOf = (wire: Wire) => wire.thisPlayer.tableau.find((c) => c.name === CARD)?.resources;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function postsOf(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** Walk the composer's cursor to its commit row and press A until exactly one request has left. */
async function commit(page: Page, root: string, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${root} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'A sent exactly one request').toBe(1);
}

/** The focused «Действия карт» tile: its card and its printed variant (0 when the card prints one). */
const focusedTile = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  const variant = (tile?.querySelector('.con-cardactions__tile-variant')?.textContent ?? '').replace(/\D+/g, '');
  return {card: tile?.getAttribute('data-action-card') ?? '', variant: variant === '' ? 0 : Number(variant)};
});

async function focusVariant(page: Page, variant: number): Promise<void> {
  await openCardActions(page);
  const at = async () => {
    const f = await focusedTile(page);
    return f.card === CARD && f.variant === variant;
  };
  expect(await walkFocusUntil(page, at, async () => JSON.stringify(await focusedTile(page)), 10),
    `never focused «${CARD}» · variant ${variant} (at ${JSON.stringify(await focusedTile(page))})`).toBe(true);
}

for (const preset of PRESETS) {
  test.describe(`TR57 Mining Mechs · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) the play: ONE POST, the card on the table with its four mechs (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const posts = postsOf(page);
      const {playerId} = await bootFixtureSeats(page, request, 'mining-mechs', {query: preset.query});
      await settle(page);
      expect(await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900})).toBeTruthy();
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600})).toBeTruthy();
      expect(await focusCard(page, CARD, 12), 'TR57 focused in the hand').toBe(true);
      expect(await pressUntil(page, 'Enter', async () => await page.locator(PLAY_COMPOSER).count() > 0, {tries: 3, settleMs: 900})).toBeTruthy();
      await settle(page);
      await shoot(page, preset.id, 'a-01-composer');
      await armTransferWitness(page);
      await commit(page, PLAY_COMPOSER, posts);
      await expect.poll(async () => mechsOf(await wireOf(request, playerId)), {timeout: 30_000, message: 'TR57 on the table with 4 mechs'}).toBe(4);
      expect((await wireOf(request, playerId)).thisPlayer.megacredits, 'the 7 M€ were paid').toBe(13);
      await settle(page);
      const witness = await transferWitness(page);
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      await shoot(page, preset.id, 'a-02-played');
    });

    test(`(B) the action: one tile, the price once; two outcome tiles in the composer; steel → mechs 3 → 1, +1 steel production, ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const posts = postsOf(page);
      const {playerId} = await bootFixtureSeats(page, request, 'mining-mechs-action', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      expect(mechsOf(before)).toBe(3);
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'ONE tile — the card prints ONE row, the price once').toHaveCount(1);
      await focusVariant(page, 0);
      await shoot(page, preset.id, 'b-01-tiles');
      await openActionFocus(page);
      await settle(page);
      await expect(page.locator(ACTION_COMPOSER), 'the composer stands').toBeVisible();
      // The variant is asked as two OUTCOME TILES; A on the steel tile is the ANSWER (the cursor alone chooses nothing).
      const options = page.locator(`${ACTION_COMPOSER} .con-vchoice__opt`);
      await expect(options, 'two outcome tiles — steel · titanium').toHaveCount(2);
      for (let i = 0; i < 6 && await page.locator(`${ACTION_COMPOSER} .con-vchoice__opt--focused`).count() === 0; i++) {
        await press(page, 'ArrowUp', 220);
      }
      for (let i = 0; i < 3 && await options.first().evaluate((el) => !el.classList.contains('con-vchoice__opt--focused')); i++) {
        await press(page, 'ArrowLeft', 220);
      }
      expect(await pressUntil(page, 'Enter', async () => await options.first().evaluate((el) => el.classList.contains('con-vchoice__opt--selected')),
        {tries: 3, settleMs: 400}), 'A seals the steel tile').toBeTruthy();
      await shoot(page, preset.id, 'b-02-composer');
      await armTransferWitness(page);
      await commit(page, ACTION_COMPOSER, posts);
      await expect.poll(async () => mechsOf(await wireOf(request, playerId)), {timeout: 30_000, message: 'two mechs spent'}).toBe(1);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.steelProduction, '+1 steel production').toBe(before.thisPlayer.steelProduction + 1);
      expect(after.thisPlayer.titaniumProduction, 'titanium untouched').toBe(before.thisPlayer.titaniumProduction);
      await settle(page);
      const witness = await transferWitness(page);
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
    });

    test(`(C) one mech: the tile refused with ONE counted reason — «1 из 2 мехов на этой карте» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'mining-mechs-short', {query: preset.query});
      await settle(page);
      await openCardActions(page);
      const reasons = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"] .con-cardactions__tile-reason`);
      await expect(reasons, 'ONE blocker — the two goods share the price').toHaveCount(1);
      await expect(reasons.first(), 'the counted reason, the resource named').toContainText('1 из 2 мехов на этой карте');
      await shoot(page, preset.id, 'c-01-short');
    });

    test(`(D) the Reds rule: «✕ Нельзя разыграть» with the Industrialists' count (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'mining-mechs-locked', {query: preset.query});
      expect(await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900})).toBeTruthy();
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600})).toBeTruthy();
      expect(await focusCard(page, CARD, 12), 'TR57 focused in the hand').toBe(true);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
      await expect(verdict, 'the count of your delegates on the party').toContainText('0/2');
      await shoot(page, preset.id, 'd-01-locked');
    });

    test(`(E) the satellite: ONE PRICE, A CHOICE — TR57's mechs wear steel / titanium production beside TR40's plants (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'mining-mechs-split', {query: preset.query});
      await settle(page);
      const satellite = page.locator('.con-res-aux');
      await expect(satellite).toBeVisible();
      // Two mech lanes by MEANING (PL-484): the choice is its own lane, never the plain count beside TR40's good.
      const choice = satellite.locator('[data-exr-type="mech:action:production-steel|production-titanium"]');
      const forestry = satellite.locator('[data-exr-type="mech:action:production-plants"]');
      await expect(choice.locator('.con-res-aux__value')).toHaveText('3');
      await expect(forestry.locator('.con-res-aux__value')).toHaveText('2');
      const badge = choice.locator('[data-role-badge="action"]');
      await expect(badge, 'the choice badge holds two goods').toHaveAttribute('data-role-choice', '2');
      await expect(badge).toHaveAttribute('data-role-plate', 'production');
      await expect(badge.locator('.resource_icon--steel')).toHaveCount(1);
      await expect(badge.locator('.resource_icon--titanium')).toHaveCount(1);
      await expect(badge, 'the reading names the choice').toHaveAttribute('aria-label', /на выбор/);
      await expect(forestry.locator('[data-role-badge="action"] .con-res-aux__roleicon'), 'TR40 keeps its one good').toHaveCount(1);
      // Both goods are PAINTED inside the plate, side by side, at the single badge's height — never clipped by it.
      const geometry = await badge.evaluate((el) => {
        const plate = el.getBoundingClientRect();
        const single = document.querySelector('[data-exr-type="mech:action:production-plants"] [data-role-badge="action"]')?.getBoundingClientRect();
        const icons = Array.from(el.querySelectorAll('.con-res-aux__roleicon')).map((i) => i.getBoundingClientRect());
        return {
          plateH: plate.height, singleH: single?.height ?? 0,
          inside: icons.every((r) => r.width > 0 && r.left >= plate.left - 0.5 && r.right <= plate.right + 0.5 && r.top >= plate.top - 0.5 && r.bottom <= plate.bottom + 0.5),
          apart: icons.length === 2 && icons[0].right <= icons[1].left + 0.5,
        };
      });
      expect(Math.abs(geometry.plateH - geometry.singleH), `the choice plate keeps the single badge's height (${JSON.stringify(geometry)})`).toBeLessThanOrEqual(1);
      expect(geometry.inside, `both goods inside the plate (${JSON.stringify(geometry)})`).toBe(true);
      expect(geometry.apart, `the goods stand side by side (${JSON.stringify(geometry)})`).toBe(true);
      await shoot(page, preset.id, 'e-01-satellite-choice');
    });
  });
}
