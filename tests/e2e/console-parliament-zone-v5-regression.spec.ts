import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, bootFixtureSeats, openMandatoryAnnounce, openZoomViewer, closeZoomViewer, press, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, expectParliamentFits, focusParliamentZone, mandatoryPlate, openParliament, parliamentWire,
  sittingStage, waitSittingAtRest,
} from './parliamentDrive';

/**
 * «ЗАСЕДАНИЕ v5» §7 — THE REGRESSION SHEET.
 *
 * The zone rework took ~1.2 rem out of the body on every profile and put a permanent reading band above it,
 * so every surface that stands in (or grows out of) the middle zone has to be looked at again. This spec is
 * FRAMES + FIT: it walks the scenes the brief lists, photographs each one under `artifacts/parliament-v5/`
 * and asserts the ONE structural thing that the height budget can break — `expectParliamentFits` (nothing
 * spills its box, no pose runs past the stage's body, no stray scroll container).
 *
 * The behavioural claims for each of these scenes live in their own suites; this sheet does not repeat them.
 * The zone contract itself is `console-parliament-zone-v5.spec.ts`.
 *
 * NOT HERE, and why: «стенд» (the resolutions playground) is a standalone screen (`/?resolutionsPlayground`)
 * that mounts no parliament section at all, so the band and the body cannot reach it.
 */
const OUT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'parliament-v5');

const PROFILES = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** A scene is photographed and measured in one gesture — a frame nobody checks is a frame nobody reviewed. */
async function scene(page: Page, id: string, name: string, root = '.con-parl'): Promise<void> {
  await settle(page, {timeoutMs: 20_000});
  await shoot(page, `r-${id}-${name}`);
  await expectParliamentFits(page, `${id} ${name}`, root);
}

for (const preset of PROFILES) {
  test.describe(`«Заседание v5» · регрессия зон (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('обзор → осмотр партии → режим голосования → осмотр резолюции', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixture(page, request, 'parliament', {query: preset.query});
      await openParliament(page);
      await focusParliamentZone(page, 'parties');
      await scene(page, preset.id, '01-overview-parties');

      await openZoomViewer(page);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 15_000});
      await scene(page, preset.id, '02-party-inspect', 'dialog.con-zoom[open]');
      await closeZoomViewer(page);

      await focusParliamentZone(page, 'voting');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}),
        'A opens the vote mode').toBe(true);
      await waitSittingAtRest(page, 20_000);
      await scene(page, preset.id, '03-vote-mode');

      await openZoomViewer(page);
      await expect(page.locator('dialog.con-zoom[open].con-zoom--parliament')).toHaveCount(1, {timeout: 15_000});
      await scene(page, preset.id, '04-resolution-inspect', 'dialog.con-zoom[open]');
      await closeZoomViewer(page);
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-parl__vote--up').count() === 0, {tries: 4, settleMs: 900}),
        'B leaves the vote mode').toBe(true);
    });

    test('отправка делегата из режима голосования', async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-aquifer-vote', {query: preset.query});
      await openParliament(page);
      await focusParliamentZone(page, 'voting');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}),
        'A opens the vote mode').toBe(true);
      await waitSittingAtRest(page, 20_000);
      await scene(page, preset.id, '05-vote-before');
      const before = ((await parliamentWire(request, playerId)).game.parliament as unknown as {slots?: Array<{totalVotes: number}>})?.slots
        ?.reduce((sum, s) => sum + s.totalVotes, 0) ?? 0;
      // A on a slot sends the delegate; the flow leaves on its own.
      await pressUntil(page, 'Enter', async () => {
        const now = ((await parliamentWire(request, playerId)).game.parliament as unknown as {slots?: Array<{totalVotes: number}>})?.slots
          ?.reduce((sum, s) => sum + s.totalVotes, 0) ?? 0;
        return now > before;
      }, {tries: 5, settleMs: 1400});
      await settle(page, {timeoutMs: 30_000});
      await openParliament(page);
      await scene(page, preset.id, '06-vote-after');
    });

    test('пик кресла председателя', async ({page, request}) => {
      test.setTimeout(300_000);
      // The seat pick OWNS the screen straight away (it is its own body state, not an announced sitting).
      await bootFixture(page, request, 'parliament-seat', {query: preset.query, landing: 'prompt'});
      await expect(page.locator('.con-parl__stage[data-parl-stage="seat"]'), 'the seat pick owns the screen').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator('.con-band'), 'the band stands above it like everywhere else').toHaveCount(1);
      await scene(page, preset.id, '07-seat-pick');
    });

    test('действие партии из Парламента', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'parliament-actions', {query: preset.query});
      await openParliament(page);
      await focusParliamentZone(page, 'parties');
      await scene(page, preset.id, '08-parties-focus');
      // WHICH party is under the cursor is the fixture's business, and only some of them have a live action —
      // walk the row until one opens (a refusal is the product speaking, never a missed key).
      let opened = false;
      for (let i = 0; i < 6 && !opened; i++) {
        opened = await pressUntil(page, 'Enter', async () => await page.locator('.con-pact').count() > 0, {tries: 2, settleMs: 1100});
        if (!opened) {
          await press(page, 'ArrowRight', 500);
        }
      }
      expect(opened, 'A on a party with a live action opens its workspace inside the Parliament').toBe(true);
      await scene(page, preset.id, '09-party-action', '.con-pact');
    });

    test('награда с ВЫБОРОМ карты (Биокуполы)', async ({page, request}) => {
      test.setTimeout(360_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-biodome-assembly', {query: preset.query, landing: 'prompt'});
      await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect.poll(() => sittingStage(page), {timeout: 20_000}).toBe('verdict');
      await waitSittingAtRest(page, 20_000);
      await scene(page, preset.id, '10-biodome-verdict');
      expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
        {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
      await answerGateAs(request, seats[1], 'assembly');
      await expect.poll(() => sittingStage(page), {timeout: 60_000}).not.toBe('verdict');
      await waitSittingAtRest(page, 60_000);
      await scene(page, preset.id, '11-biodome-reward');
    });

    test('награда с ТАЙЛОМ (Конкурс водоносных пластов)', async ({page, request}) => {
      test.setTimeout(360_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-aquifer-assembly', {query: preset.query, landing: 'prompt'});
      await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect.poll(() => sittingStage(page), {timeout: 20_000}).toBe('verdict');
      await waitSittingAtRest(page, 20_000);
      expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
        {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
      await answerGateAs(request, seats[1], 'assembly');
      // v5: the winner's TILE reads as a chip of the BAND, beside the payout — whatever step of the reward the
      // seat happens to be standing in (this resolution also asks a card pick). The DOOR's own verb stays on
      // the command bar, and the board is never live before the press.
      await expect(page.locator('.con-band__winner'), 'the band names the winner\'s tile').toHaveCount(1, {timeout: 90_000});
      await waitSittingAtRest(page, 60_000);
      await scene(page, preset.id, '12-aquifer-winner-tile');
    });
  });
}
