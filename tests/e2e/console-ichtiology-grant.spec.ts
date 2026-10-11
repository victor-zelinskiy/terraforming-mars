import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, crumbText, fetchPlayerModel, focusCard, press, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR43 «ИХТИОЛОГИЧЕСКИЙ ГРАНТ» — the set's first PLAY whose `or` branch holds a
 * CARD TARGET: two pre-selects in one batch (the variant, then the holder), the
 * route the pre-select law (`common/inputs/preselectAddress.ts`) carries first.
 * Against a real server, on two profiles, three holder sets:
 *
 *   (A) BOTH KINDS (Pets · Tardigrades, TR38 with 2 data): the composer states
 *       the production ONCE above the «ИЛИ» row («+3 · Океаны: 3» — the keys
 *       beside the choice, `sharedLeadingEffects`), two options to choose;
 *       the animal option → its target row → the EMBEDDED played-target step
 *       (the crumb names the card) → Pets → A → EXACTLY ONE POST, the branch
 *       pick and the target both ADDRESSED; the server: Pets 2 animals, M€
 *       production +3, TR38 +2 data (one answer of 2 — the card's microbe AND
 *       animal tags); every flight's ends visible (`transferWitness`).
 *   (B) ONE KIND (Pets only): the microbe option greyed WITH its reason, the
 *       animal option chosen for the player; the target still SHOWN (never
 *       applied silently); one POST with the bare target answer.
 *   (C) NO HOLDER: the card still plays (`OrBehavior.optional`) — both options
 *       greyed, the skip NAMED in the composer, the production stands; one
 *       POST; the server records the two named skips.
 *
 * The harness's `preselectGuard` fails any test whose route asks an answered
 * question again. Fixtures `ichtiology-grant`, `-one`, `-none`. Heavy 4K: run
 * with `--workers=1`.
 */

const CARD = 'Ichtiology Grant';
const CARD_RU = 'Ихтиологический грант';
const OUT = path.resolve('screenshots', 'ichtiology-grant');
const PLAY_COMPOSER = '.con-composer--play';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacreditProduction: number, tableau: Array<{name: string, resources?: number}>};
  waitingFor?: {type: string, title?: unknown};
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function watchPage(page: Page): {posts: Array<string>, errors: Array<string>} {
  const out = {posts: [] as Array<string>, errors: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  page.on('pageerror', (e) => out.errors.push(e.message));
  return out;
}

async function openPlayComposerOf(page: Page, card: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY_COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** The «ИЛИ» group: the option tiles, which are greyed, which is chosen. */
async function variants(page: Page): Promise<Array<{text: string, off: boolean, selected: boolean}>> {
  return page.locator(`${PLAY_COMPOSER} .con-composer__variant`).evaluateAll((els) => els.map((el) => ({
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    off: el.classList.contains('con-composer__variant--off'),
    selected: el.classList.contains('con-composer__variant--selected'),
  })));
}

/** Open the embedded target step (the CTA check inside the loop — A on the CTA would PLAY). */
async function openTargetStep(page: Page): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 5 && await step.count() === 0; i++) {
    if (await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() > 0) {
      await press(page, 'ArrowUp', 700);
    }
    await press(page, 'Enter', 1300);
  }
  await expect(step, 'the embedded played-target step opens').toHaveCount(1, {timeout: 10_000});
  await settle(page);
}

async function confirmTarget(page: Page): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 4 && await step.count() > 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(step, 'A on the candidate answers the target').toHaveCount(0, {timeout: 8000});
  await settle(page);
}

async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'A sent exactly one request').toBe(1);
}

type Answer = {type: string, index?: number, cards?: Array<string>, for?: {role: string, source?: {card?: string}}};
const batchOf = (post: string) => (JSON.parse(post) as {responses?: Array<Answer>}).responses ?? [];

for (const preset of PRESETS) {
  test.describe(`TR43 Ichtiology Grant · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) both kinds: the production once above the «ИЛИ» row, the animal option, the target step embedded — ONE POST, every answer addressed (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'ichtiology-grant', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect([resourcesOf(before, 'Pets'), resourcesOf(before, 'Biological Simulations')], 'the fixture: Pets 0, TR38 2 data').toEqual([0, 2]);

      await openPlayComposerOf(page, CARD);
      const shared = page.locator(`${PLAY_COMPOSER} [data-variants-shared]`);
      await expect(shared, 'the production stands ONCE above the «ИЛИ» row').toHaveCount(1);
      await expect(shared).toContainText('3');
      const options = await variants(page);
      expect(options.length, 'two options').toBe(2);
      expect(options.every((o) => !o.off), 'both options are open').toBe(true);
      expect(options.every((o) => !/\+?3\b.*M€/.test(o.text)), 'no option repeats the shared production').toBe(true);
      await shoot(page, preset.id, 'a-01-composer');

      // The ANIMAL option (the first) — chosen with A on it.
      for (let i = 0; i < 4 && !(await variants(page))[0].selected; i++) {
        await press(page, 'ArrowLeft', 300);
        await press(page, 'Enter', 700);
      }
      expect((await variants(page))[0].selected, 'the animal option is chosen').toBe(true);
      await openTargetStep(page);
      expect((await crumbText(page)).toLowerCase(), 'the crumb names the card the step belongs to').toContain(CARD_RU.toLowerCase());
      await shoot(page, preset.id, 'a-02-target');
      await confirmTarget(page);
      expect(seen.posts, 'nothing sent before the play\'s own A').toEqual([]);

      await armTransferWitness(page);
      await commit(page, seen.posts);
      const batch = batchOf(seen.posts[0]);
      const pick = batch.find((r) => r.type === 'or' && r.for !== undefined);
      const target = batch.find((r) => r.type === 'card');
      expect(pick?.for, 'the branch pick is ADDRESSED to the card\'s own choice').toMatchObject({role: 'or', source: {card: CARD}});
      expect(target?.cards, 'the target is Pets').toEqual(['Pets']);
      expect(target?.for, 'the target is ADDRESSED to the card\'s own pick').toMatchObject({role: 'card', source: {card: CARD}});

      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), 'Pets'), {timeout: 30_000, message: 'Pets holds 2 animals'}).toBe(2);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacreditProduction - before.thisPlayer.megacreditProduction, 'M€ production +3 (three oceans)').toBe(3);
      expect(resourcesOf(after, 'Biological Simulations'), 'TR38 answered the two tags with +2 data').toBe(4);
      expect(resourcesOf(after, 'Tardigrades'), 'the other holder untouched').toBe(0);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      const witness = await transferWitness(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/ichtiology-grant-a-${preset.id}.txt`, transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'a-03-board');
    });

    test(`(B) one kind: the microbe option greyed with its reason, the animal target still SHOWN — ONE POST with the bare target (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'ichtiology-grant-one', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);

      await openPlayComposerOf(page, CARD);
      const options = await variants(page);
      expect(options.length, 'both options stand — the unavailable one is shown, never hidden').toBe(2);
      expect(options.map((o) => o.off), 'the microbe option is greyed').toEqual([false, true]);
      expect(options[0].selected, 'the lone open option is chosen for the player').toBe(true);
      await expect(page.locator(`${PLAY_COMPOSER} .con-composer__variant--off .con-composer__variant-reason`), 'the greyed option says why').toHaveCount(1);
      await shoot(page, preset.id, 'b-01-composer');

      await openTargetStep(page);
      await shoot(page, preset.id, 'b-02-target');
      await confirmTarget(page);
      await commit(page, seen.posts);
      const batch = batchOf(seen.posts[0]);
      expect(batch.some((r) => r.type === 'or' && r.for !== undefined), 'no branch pick — the lone branch collapses').toBe(false);
      expect(batch.find((r) => r.type === 'card')?.for, 'the bare target is ADDRESSED').toMatchObject({role: 'card', source: {card: CARD}});
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), 'Pets'), {timeout: 30_000}).toBe(2);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
    });

    test(`(C) no holder: the card still plays — both options greyed, the skip named, the production stands (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'ichtiology-grant-none', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);

      await openPlayComposerOf(page, CARD);
      const options = await variants(page);
      expect(options.map((o) => o.off), 'both options greyed — and no third «play the card» tile among them').toEqual([true, true]);
      await expect(page.locator(`${PLAY_COMPOSER} [data-variants-shared]`), 'the production still stands above the row').toContainText('3');
      await expect(page.locator(`${PLAY_COMPOSER} .con-composer__warn`), 'the two skips are NAMED').toHaveCount(2);
      await shoot(page, preset.id, 'c-01-composer');

      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.megacreditProduction - before.thisPlayer.megacreditProduction,
        {timeout: 30_000, message: 'M€ production +3'}).toBe(3);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'c-02-board');
    });
  });
}
