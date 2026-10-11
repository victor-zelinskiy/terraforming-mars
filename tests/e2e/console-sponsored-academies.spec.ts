import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * THE PRE-SELECT LAW'S REGRESSION STAND — the owner's report of 2026-10-11:
 * «Sponsored Academies: the card to discard is picked in the composer, and then
 * the discard comes as a SEPARATE prompt, although it was pre-selected».
 *
 * Root (docs/claude/action-prompt-audit.md § CLASS 8): since `186ddae340` every
 * marked discard counted as «hidden information» in the batch replay, so a
 * PRE-COLLECTED discard parked and never landed — and the console honestly
 * served the discard a second time on the hand screen. The fix is the ADDRESS:
 * the composer posts the discard addressed to Sponsored Academies' own discard
 * (`role: 'discard'`), and the server lands it there in the play's ONE POST.
 *
 * Here, against a real server, on two profiles, a second client watching:
 *   «Карты в руке» → Sponsored Academies → its composer → the discard row →
 *   the HAND in pick mode → Algae → back in the composer, the row answered →
 *   A → EXACTLY ONE POST → the server: Algae discarded, three cards drawn, no
 *   discard standing; the hand screen never comes back in discard mode; the
 *   harness's `preselectGuard` (consoleTest.ts) and the stranded witness stay
 *   silent; red is handed its external draw of one.
 *
 * Fixture `sponsored-academies` (tests/e2e/fixtures/generate.ts). Heavy 4K:
 * run with `--workers=1`.
 */

const CARD = 'Sponsored Academies';
const DISCARD = 'Algae';
const OUT = path.resolve('screenshots', 'sponsored-academies');
const PLAY_COMPOSER = '.con-composer--play';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  waitingFor?: {type: string, discardPrompt?: unknown, externalDrawPrompt?: unknown, options?: Array<{discardPrompt?: unknown}>};
  thisPlayer: {cardsInHandNbr: number, tableau: Array<{name: string}>};
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

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

/** RT → «КАРТЫ» → the card → A: the play composer, nothing sent. */
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

/** The hand in PICK mode — the select classes on its slots (the card being played rides it DISABLED with its reason). */
const handPicking = (page: Page) => page.locator('.con-hand .con-hand__slot--select-disabled, .con-hand .con-hand__slot--select-picked');

for (const preset of PRESETS) {
  test.describe(`Sponsored Academies — the pre-selected discard · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the discard picked in the composer rides the play's ONE POST and is never asked again (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'sponsored-academies', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const handBefore = before.thisPlayer.cardsInHandNbr;
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: the card and the discard candidate in hand').toEqual(expect.arrayContaining([CARD, DISCARD]));

      const redHandBefore = (await wireOf(request, seats[1])).thisPlayer.cardsInHandNbr;
      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await page.bringToFront();

      // ── 1. The composer; its discard row opens the HAND in pick mode (never a flat list).
      await openPlayComposerOf(page, CARD);
      await shoot(page, preset.id, '01-composer');
      for (let i = 0; i < 4 && await handPicking(page).count() === 0; i++) {
        if (await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() > 0) {
          await press(page, 'ArrowUp', 600);
        }
        await press(page, 'Enter', 1400);
      }
      await expect(handPicking(page).first(), 'the discard row opens the hand in pick mode').toBeVisible({timeout: 15_000});
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await settle(page);
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, DISCARD, slots * 2 + 6), `never focused «${DISCARD}» in the pick`).toBe(true);
      await shoot(page, preset.id, '02-pick');
      for (let i = 0; i < 3 && await page.locator(`${PLAY_COMPOSER}:visible`).count() === 0; i++) {
        await press(page, 'Enter', 1400);
      }
      await expect(page.locator(`${PLAY_COMPOSER}:visible`), 'A on the card answers the pick and returns to the composer').toHaveCount(1, {timeout: 15_000});
      await settle(page);
      expect(seen.posts, 'nothing sent before the play\'s own A').toEqual([]);
      await shoot(page, preset.id, '03-answered');

      // ── 2. The commit: ONE POST, carrying the discard ADDRESSED to the card's own discard.
      for (let i = 0; i < 8 && await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 250);
      }
      for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
        await press(page, 'Enter', 400);
        await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(seen.posts.length, 'A sent exactly one request').toBe(1);
      const body = JSON.parse(seen.posts[0]) as {responses?: Array<{type: string, cards?: Array<string>, for?: {role: string, source?: {card?: string}}}>};
      const discardAnswer = (body.responses ?? []).find((r) => r.type === 'card');
      expect(discardAnswer?.cards, 'the batch carries the picked card').toEqual([DISCARD]);
      expect(discardAnswer?.for, 'the answer is ADDRESSED to the card\'s own discard').toMatchObject({role: 'discard', source: {card: CARD}});

      // ── 3. The server: the discard landed in that POST, three cards came, nothing asks again.
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000, message: 'the card is on the table'}).toBe(true);
      const after = await wireOf(request, playerId);
      expect(after.cardsInHand?.map((c) => c.name), 'Algae was discarded by the pre-selected answer').not.toContain(DISCARD);
      expect(after.thisPlayer.cardsInHandNbr, 'the hand: −the card −the discard +3').toBe(handBefore - 2 + 3);
      const wf = after.waitingFor;
      const discardStanding = wf?.discardPrompt !== undefined || (wf?.options ?? []).some((o) => o.discardPrompt !== undefined);
      expect(discardStanding, 'no discard prompt stands after the batch').toBe(false);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      await expect(handPicking(page), 'the hand screen never comes back in discard / pick mode').toHaveCount(0);
      expect(await page.locator('.con-cards__pickband--discard').count(), 'no discard band on screen').toBe(0);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, '04-board');

      // ── 4. Red is handed its draw of one (the external intake — the play's last beat).
      await red.bringToFront();
      await expect.poll(async () => {
        const redWire = await wireOf(request, seats[1]);
        return redWire.waitingFor?.externalDrawPrompt !== undefined || redWire.thisPlayer.cardsInHandNbr > redHandBefore;
      }, {timeout: 30_000, message: 'red was handed its draw'}).toBe(true);
      await shoot(red, preset.id, '05-red');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await red.close();
    });
  });
}
