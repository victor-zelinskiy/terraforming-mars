import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, closeZoomViewer, crumbText, fetchPlayerModel, focusCard, openQuickWheel, openZoomViewer, press, pressUntil, settle,
  visibleSurfaces,
} from './consoleStart';

/**
 * THE MARS PARLIAMENT (Turmoil Redux, iteration 0) — the EARLY WORKING PATH
 * the iteration was built around (docs/TURMOIL_REDUX_ITERATION0_PLAN.md):
 *
 *   the wheel's «ПАРЛАМЕНТ» slot opens the workspace · the browse layer
 *   shows the three dummy resolutions with their delegates, the ruling party,
 *   the chairman quest, the parties row and the Agenda · A on a resolution
 *   opens the VOTE stage with the transaction and the consequences · A
 *   commits the vote (the server's own menu option, byte-identical) and the
 *   delegate lands on the card · X opens the fullscreen inspector over the
 *   resolution's premium face with the three rule blocks (resolution effect ·
 *   party effect · chairman quest).
 *
 * STATE IS DECLARED (the `parliament` fixture): a 2p Redux table in the
 * first action phase — red's free delegate on slot 1, blue's two delegates
 * on slot 2 (a party effect held by delegates), blue with the lobby delegate
 * and 40 M€. Also the screenshot source (screenshots/parliament/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'parliament');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  profileQuery: string;
  /** The full journey runs once (1080); the others prove composition. */
  journey: boolean;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto', journey: true},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv', journey: false},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld', journey: false},
];

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const parliament = (page: Page) => page.locator('.con-parl');
const slots = (page: Page) => page.locator('.con-parl__slot');
const stage = (page: Page) => page.locator('.con-parl__stage');

/** Open the Parliament from the wheel (RT → down). */
async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

/** Nothing of the workspace may stick out of the viewport (no scroll, no crop). */
async function expectFits(page: Page, preset: Preset): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.querySelector('.con-parl');
    if (root === null) {
      return ['no root'];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot, .con-parl__party, .con-parl__tile, .con-parl__enacted, .con-parl__agenda'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        continue;
      }
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`${el.className.split(' ')[0]} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
    }
    return out;
  });
  expect(overflow, `${preset.id}: every parliament block inside the viewport`).toEqual([]);
}

/** The «ИЛИ» play whose plant branch the ruling Greens answer (+1 M€ production). */
const OR_CARD = 'Artificial Photosynthesis';

const composer = (page: Page) => page.locator('.con-composer--play');

/** Open the Information workspace (Y), acknowledging whatever cinematic stands. */
async function openInfo(page: Page): Promise<void> {
  const infoRoot = page.locator('.con-info');
  for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
    if (i > 0) {
      await press(page, 'Enter', 700);
      await press(page, 'Escape', 500);
    }
    await press(page, 'KeyY', 1100);
  }
  await expect(infoRoot, `the info workspace must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toHaveCount(1);
}

/** Walk the summary ring onto the effects zone and open the explorer (positive witness, never a memorised key sequence). */
async function openInfoEffects(page: Page): Promise<void> {
  const focused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
  for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
    if (await focused() > 0) {
      break;
    }
    await press(page, move, 300);
  }
  expect(await focused(), 'the ring must reach the effects zone').toBeGreaterThan(0);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}),
    'A on the effects zone must open the explorer').toBeTruthy();
}

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/** Leave the composer and the hand — back to the board home. */
async function closeToBoard(page: Page): Promise<void> {
  expect(await pressUntil(page, 'Escape', async () => await composer(page).count() === 0, {tries: 4, settleMs: 900}),
    'B must fold the composer').toBeTruthy();
  expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 900}),
    'B must leave the hand').toBeTruthy();
  await settle(page);
}

async function parliamentModel(request: APIRequestContext, playerId: string) {
  const model = await fetchPlayerModel(request, playerId) as unknown as {
    game: {parliament: {slots: Array<{party: string, totalVotes: number, viewerVotes: number, votes: Array<{owner: string}>}>, rulingParty: string, players: Array<{color: string, lobby: boolean, reserve: number}>}},
    thisPlayer: {color: string},
  };
  return model;
}

for (const preset of PRESETS) {
  test.describe(`parliament · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the workspace opens from the wheel and the browse layer fits (${preset.id})`, async ({page, request}) => {
      // The 1080 journey walks five surfaces (vote · inspector · Information ·
      // composer + R3 · journal) — the default 30 s is a single surface's budget.
      test.setTimeout(preset.journey ? 300_000 : 120_000);
      const playerId = await bootFixture(page, request, 'parliament', {query: preset.profileQuery});
      await openParliament(page);
      expect((await crumbText(page)).toUpperCase()).toContain('ПАРЛАМЕНТ');
      await expect(slots(page)).toHaveCount(3);
      // Three parties, three resolutions, the ruling party in the head chip.
      const before = await parliamentModel(request, playerId);
      expect(before.game.parliament.slots.length).toBe(3);
      expect(before.game.parliament.rulingParty).toBe('Greens');
      await expectFits(page, preset);
      await shoot(page, preset, '01-browse');

      if (!preset.journey) {
        // Composition only: the vote stage's geometry, then the inspector.
        await press(page, 'Enter', 900);
        await expect(stage(page)).toHaveCount(1);
        await expectFits(page, preset);
        await shoot(page, preset, '02-vote-stage');
        await press(page, 'Escape', 600);
        await openZoomViewer(page);
        await shoot(page, preset, '03-inspect');
        await closeZoomViewer(page);
        return;
      }

      // ── THE VOTE. Slot 1 carries red's delegate; blue votes there with the
      //    free lobby delegate: the ribbon grows, the lobby empties, and the
      //    flow LEAVES the workspace (a finished flow never folds back).
      const target = before.game.parliament.slots[0];
      const me = before.thisPlayer.color;
      const meBefore = before.game.parliament.players.find((p) => p.color === me);
      expect(meBefore?.lobby, 'the free delegate waits in the lobby').toBe(true);
      await press(page, 'Enter', 900);
      await expect(stage(page)).toHaveCount(1);
      expect((await crumbText(page)).toUpperCase()).toContain('ГОЛОС');
      await expect(page.locator('.con-parl__consequences li')).not.toHaveCount(0);
      await shoot(page, preset, '02-vote-stage');
      await press(page, 'Enter', 900);
      await expect.poll(async () => (await parliamentModel(request, playerId)).game.parliament.slots[0].viewerVotes,
        {timeout: 20_000, message: 'the delegate landed on slot 1'}).toBe(target.viewerVotes + 1);
      const after = await parliamentModel(request, playerId);
      expect(after.game.parliament.slots[0].totalVotes).toBe(target.totalVotes + 1);
      expect(after.game.parliament.players.find((p) => p.color === me)?.lobby, 'the lobby delegate was spent').toBe(false);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset, '03-after-vote');

      // ── THE INSPECTOR. Back in the Parliament, X over the focused resolution
      //    opens the fullscreen face with the three rule blocks.
      await openParliament(page);
      await openZoomViewer(page);
      const panel = page.locator('.con-zoom-rules').first();
      await expect(panel).toBeVisible({timeout: 10_000});
      await shoot(page, preset, '04-inspect-resolution');
      await closeZoomViewer(page);

      // ── THE PARTY DOSSIER: down to the parties row, X over a party.
      await press(page, 'ArrowDown', 500);
      await openZoomViewer(page);
      await shoot(page, preset, '05-inspect-party');
      await closeZoomViewer(page);
      expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900}),
        'B leaves the Parliament').toBeTruthy();
      await settle(page);

      // ── THE INFORMATION WORKSPACE, «ЭФФЕКТЫ»: the viewer's party effects
      //    (the ruling Greens + the Scientists held by two delegates) stand
      //    in their own strip over the effects explorer — full citizens of
      //    the effects framework, with the reason each one is held.
      await openInfo(page);
      await openInfoEffects(page);
      const strip = page.locator('.con-pfx');
      await expect(strip, 'the party effects strip stands in the effects route').toHaveCount(1);
      await expect(strip.locator('.con-pfx__item[data-party="Greens"]'), 'the ruling Greens').toHaveCount(1);
      await expect(strip.locator('.con-pfx__item[data-party="Scientists"]'), 'the Scientists, held by two delegates').toHaveCount(1);
      await shoot(page, preset, '06-info-effects');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-info').count() === 0, {tries: 5, settleMs: 900}),
        'B leaves the Information workspace').toBeTruthy();
      await settle(page);

      // ── THE FORECAST (R3): the «ИЛИ» play's plant branch carries the
      //    Greens' «⚡ сработает» note (+1 M€ production), the R3 layer lists
      //    the party fact like any table reactor's.
      await openPlayComposer(page, OR_CARD);
      const notes = page.locator('.con-composer__variant [data-forecast-vfx]');
      await expect(notes, 'the plant branch carries the Greens note').not.toHaveCount(0);
      await expect(notes.first(), 'the note reads «⚡ сработает +1» (the M€ is an icon, never text)').toContainText(/\+1/);
      await shoot(page, preset, '07-forecast-or');
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-composer__fxlayer').count() > 0, {tries: 3, settleMs: 1100}),
        'R3 must open the «Эффекты» layer').toBeTruthy();
      await expect(page.locator('.con-composer__fxlayer [data-forecast-group]')).not.toHaveCount(0);
      await shoot(page, preset, '08-forecast-layer');
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-composer__fxlayer').count() === 0, {tries: 3, settleMs: 1100}),
        'R3 folds the layer back').toBeTruthy();
      await closeToBoard(page);

      // ── THE JOURNAL: the vote is a journal line whose resolution renders as
      //    a NAMED chip (the RESOLUTION log token), never a bare id.
      await press(page, 'KeyR', 1200);
      const journal = page.locator('.con-journal');
      await expect(journal, 'the journal opens').toBeVisible({timeout: 10_000});
      await expect(journal, 'the vote line names the resolution').toContainText(/Инициатива/);
      await expect(journal).not.toContainText(/RDX_DUMMY/);
      await shoot(page, preset, '09-journal');
      await press(page, 'Escape', 800);
    });

    if (preset.journey) {
      test(`the previous generation's results play as beats when the Parliament opens (${preset.id})`, async ({page, request}) => {
        test.setTimeout(180_000);
        // Generation 2 has just begun: the first political phase ran (blue's
        // two delegates won, the winner is enacted, blue stepped onto the
        // Agenda, the losers gained support, three fresh resolutions stand).
        await bootFixture(page, request, 'parliament-recap', {query: preset.profileQuery});
        await openParliament(page);
        await expect(stage(page), 'the results scene takes the stage on the first open').toHaveAttribute('data-parl-stage', 'recap');
        expect((await crumbText(page)).toUpperCase()).toContain('ИТОГИ');
        const items = page.locator('.con-parl__recap-item');
        await expect(items).not.toHaveCount(0);
        await expect.poll(async () => await page.locator('.con-parl__recap-item--shown').count(), {timeout: 15_000, message: 'every beat landed'})
          .toBe(await items.count());
        await settle(page, {timeoutMs: 10_000});
        await shoot(page, preset, '10-recap');
        // The objects the beats named: an ENACTED card now stands, blue's
        // marker is on Agenda step 1, three resolutions are in the area.
        await expect(page.locator('.con-parl__enacted .pcard')).toHaveCount(1);
        await expect(page.locator('.con-parl__step[data-step="1"] .player-cube')).not.toHaveCount(0);
        await expect(slots(page)).toHaveCount(3);
        expect(await pressUntil(page, 'Enter', async () => await stage(page).count() === 0, {tries: 3, settleMs: 700}),
          'A lets the player through to the browse layer').toBeTruthy();
        await expect(page.locator('[data-parl-recap]'), 'the compact strip keeps the results').toHaveCount(1);
        await shoot(page, preset, '11-after-recap');
        // The scene plays ONCE: leaving and coming back lands on the browse layer.
        expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
        await openParliament(page);
        await expect(stage(page)).toHaveCount(0);
        expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
        // The journal carries the phase's own lines — under GENERATION 1, where
        // the phase ran (the drawer opens on the current generation; LT steps back).
        await press(page, 'KeyR', 1200);
        const journal = page.locator('.con-journal');
        await expect(journal).toBeVisible({timeout: 10_000});
        expect(await pressUntil(page, 'Comma', async () => /парламент/i.test(await journal.textContent() ?? ''), {tries: 3, settleMs: 900}),
          'generation 1 holds the political phase lines').toBeTruthy();
        await shoot(page, preset, '12-journal-phase');
        await press(page, 'Escape', 800);
      });
    }
  });
}
