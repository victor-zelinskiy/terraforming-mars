import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * THE INFORMATION WORKSPACE (Y) — the overlay workspace probe.
 *
 * The info-panel rework made the Y panel a full WORKSPACE in everything but
 * stacking: the ConsoleWsHead crumb (ИНФОРМАЦИЯ › <участник> › <раздел>),
 * semantic ROUTES with a capability fallback, ONE participant summary for
 * humans and the bot, the premium live score in the endgame's own category
 * system, and «Экран бота» hosting the bot's internals. This spec drives a
 * real human+MarsBot game and asserts the load-bearing contracts:
 *
 *  1. GEOMETRY — the workspace fills the area right of the rail between the
 *     two bars; the rail stays visible as the mode's summary half.
 *  2. ROUTE PRESERVATION — LB/RB switches the participant, NEVER the place:
 *     «ПО» stays «ПО» across the seat ring; an inapplicable route presents
 *     the FALLBACK at the same depth, never a silent reset.
 *  3. PARITY — the shared summary zones sit at the same coordinates for a
 *     human and the bot; the bot's rail keeps the human geometry (the same
 *     tag matrix, filled from the tracks).
 *  4. «ЭКРАН БОТА» — R3 opens the hub; the printed board is one A deeper;
 *     B returns one level at a time; Y closes from any depth.
 *  5. RESTORE — closing returns the rail to the viewer's own seat.
 *
 * Also the screenshot source for the workspace gallery
 * (screenshots/info-workspace/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'info-workspace');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  deviceScaleFactor: number;
  profileQuery: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=handheld'},
];

/** Deterministic base+corpEra game, human + MarsBot. `testMode` gives 500 of
 *  every resource, so the viewer's own rail reads a distinct value from the
 *  bot's — that difference is what the context-sync assertions key on. */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'InfoTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  automa: {difficulty: 'normal'},
});

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/**
 * Press B until the fullscreen viewer is gone. The close is a CHOREOGRAPHED
 * flight and input is deliberately swallowed for its duration — under a
 * loaded 3-worker 4K run a single press can land inside that window.
 */
async function closeZoom(page: Page): Promise<void> {
  const plate = page.locator('.con-zoom__prov');
  for (let i = 0; i < 5 && await plate.count() > 0; i++) {
    await key(page, 'Escape', 900);
  }
  await expect(plate).toHaveCount(0);
}

const railMc = (page: Page) => page.locator('.con-res__row--megacredits .con-res__value');
/** The crumb's stage segment (the route tail) inside the workspace header. */
const crumbStage = (page: Page) => page.locator('.con-info .con-wshead__step');
/** Is the BOT participant on stage? The corp meta wears the bot accent. */
const botOnStage = (page: Page) => page.locator('.con-info .con-info__corp--bot');

/** Cycle LB/RB until the bot participant (or the human) is on stage. */
async function cycleTo(page: Page, want: 'bot' | 'human'): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const isBot = await botOnStage(page).count() > 0;
    if ((want === 'bot') === isBot) {
      return;
    }
    await key(page, 'KeyE', 900);
  }
  expect((await botOnStage(page).count() > 0) === (want === 'bot'),
    `the seat ring must reach the ${want} participant`).toBeTruthy();
}

for (const preset of PRESETS) {
  test.describe(`information workspace · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: preset.deviceScaleFactor,
      screen: preset.viewport,
    });

    test('overlay workspace: routes, parity, bot screen, restore', async ({page, request}) => {
      // ONE budget for every profile — the bulk of the cost is the pregame
      // boot, which is identical at every size.
      test.setTimeout(480_000);

      await bootIntoGame(page, request, {config: GAME_CONFIG, query: preset.profileQuery});

      // ── 1 · Open the workspace (retry through a lingering cinematic).
      // The deal is not reproducible: the bot may still be presenting its
      // own flip (a reveal / turn review owns the pad and eats Y), so the
      // walk ACKNOWLEDGES whatever stands (A confirms a review, B clears a
      // toast) and retries — never a fixed count of blind presses. ──────
      const workspace = page.locator('.con-info');
      for (let i = 0; i < 10 && await workspace.count() === 0; i++) {
        if (i > 0) {
          await key(page, 'Enter', 700);
          await key(page, 'Escape', 500);
        }
        await key(page, 'KeyY', 1100);
      }
      await expect(workspace,
        `the info workspace must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toHaveCount(1);
      const ownMc = (await railMc(page).textContent()) ?? '';
      expect(ownMc).not.toBe('');
      await shoot(page, preset, '01-summary-self');

      // THE CRUMB: the workspace header speaks the one grammar.
      await expect(workspace.locator('.con-wshead__root')).toHaveText('Информация');
      await expect(workspace.locator('.con-wshead__subject')).toBeVisible();

      // GEOMETRY: fills .con-main right of the rail (±4px tolerance).
      const main = await page.locator('.con-main').boundingBox();
      const rail = await page.locator('.con-res-host').boundingBox();
      const ws = await workspace.boundingBox();
      expect(main && rail && ws).toBeTruthy();
      if (main && rail && ws) {
        expect(Math.abs(ws.y - main.y)).toBeLessThanOrEqual(4);
        expect(Math.abs((ws.y + ws.height) - (main.y + main.height))).toBeLessThanOrEqual(4);
        expect(Math.abs((ws.x + ws.width) - (main.x + main.width))).toBeLessThanOrEqual(4);
        expect(ws.x).toBeGreaterThan(rail.x + rail.width - 2); // right of the rail
        expect(ws.x - (rail.x + rail.width)).toBeLessThanOrEqual(16 * preset.viewport.width / 1920 + 6);
        await expect(page.locator('.con-res')).toBeVisible();
      }

      // DEDUP + the ONE summary layout: no rail summary repeats; the
      // canonical zone grid renders with the premium score zone focused.
      await expect(workspace.locator('.con-info__res-grid')).toHaveCount(0);
      await expect(workspace.locator('.con-tagmx')).toHaveCount(0);
      await expect(workspace.locator('.con-info__layout')).toHaveCount(1);
      await expect(workspace.locator('.con-info__zone--vp.con-info__zone--focused')).toHaveCount(1);
      await expect(workspace.locator('.con-infovp__bar')).toHaveCount(1);

      // PARITY BASELINE: capture the shared zones' boxes on the human seat.
      const zoneBox = async (zone: string) =>
        await workspace.locator(`[data-zone="${zone}"]`).boundingBox();
      const humanVp = await zoneBox('vp');
      const humanPlayed = await zoneBox('played');
      const humanCards = await zoneBox('cards');
      const humanExtras = await zoneBox('extras');
      await expect(workspace.locator('[data-zone="actions"]')).toHaveCount(1);
      await expect(workspace.locator('[data-zone="effects"]')).toHaveCount(1);

      // ── 2 · RB → the MarsBot participant: ONE canonical summary ─────
      await cycleTo(page, 'bot');
      const botMc = await railMc(page).textContent();
      expect(botMc, 'rail M€ must switch to the inspected bot').not.toBe(ownMc);
      // THE RAIL KEEPS THE HUMAN GEOMETRY: the SAME tag matrix (filled
      // from the tracks — no progress-bar array), no production chips,
      // and the rows zone reserves the six-row height.
      await expect(page.locator('.con-res .con-res__prod')).toHaveCount(0);
      await expect(page.locator('.con-res .con-tagmx__grid')).toHaveCount(1);
      await expect(page.locator('.con-res .con-tagmx__trackrow')).toHaveCount(0);
      await expect(page.locator('.con-res .con-res__rows--bot')).toHaveCount(1);
      // THE SHARED ZONES SIT AT THE SAME COORDINATES (±2px):
      const botVp = await zoneBox('vp');
      const botPlayed = await zoneBox('played');
      const botCards = await zoneBox('cards');
      const botExtras = await zoneBox('extras');
      for (const [label, a, b] of [
        ['vp', humanVp, botVp], ['played', humanPlayed, botPlayed],
        ['cards', humanCards, botCards], ['extras', humanExtras, botExtras],
      ] as const) {
        expect(a && b, `${label} exists on both seats`).toBeTruthy();
        if (a && b) {
          expect(Math.abs(a.x - b.x), `${label} x parity`).toBeLessThanOrEqual(2);
          expect(Math.abs(a.y - b.y), `${label} y parity`).toBeLessThanOrEqual(2);
          expect(Math.abs(a.width - b.width), `${label} width parity`).toBeLessThanOrEqual(2);
        }
      }
      // The human-only pair is HIDDEN (never disabled-looking, never a gap
      // that shifts the shared zones); the bot's own door replaces them.
      await expect(workspace.locator('[data-zone="actions"]')).toHaveCount(0);
      await expect(workspace.locator('[data-zone="effects"]')).toHaveCount(0);
      await expect(workspace.locator('[data-zone="botdoor"]')).toHaveCount(1);
      // NO separate corporation summary zone — the corp lives inside
      // «Разыграно» (and «Экран бота» carries its rules read).
      await expect(workspace.locator('.con-info__block--botcorp')).toHaveCount(0);
      // The premium score zone renders for the bot in the SAME system —
      // no opaque «Подсчёт бота» row anywhere on the summary.
      await expect(workspace.locator('.con-infovp__bar')).toHaveCount(1);
      await expect(workspace.locator('.con-infovp__legend')).not.toContainText('Подсчёт бота');
      await shoot(page, preset, '02-summary-bot');

      // ── 3 · ROUTE PRESERVATION: «ПО» survives the seat ring ─────────
      await key(page, 'Enter', 800); // A on the focused VP zone → the explorer
      await expect(workspace.locator('.con-vpx')).toHaveCount(1);
      await expect(workspace.locator('.con-vpx__grid')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки/i);
      await shoot(page, preset, '03-vp-detail-bot');
      await key(page, 'KeyQ', 900); // LB → the human, SAME route
      await expect(workspace.locator('.con-vpx'), 'the score explorer survives the seat switch').toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки/i);
      await expect(botOnStage(page)).toHaveCount(0);
      await shoot(page, preset, '03b-vp-detail-human');
      await key(page, 'Escape', 700); // B → the summary, ring on the VP zone
      await expect(workspace.locator('.con-info__layout')).toHaveCount(1);
      await expect(workspace.locator('.con-info__zone--vp.con-info__zone--focused')).toHaveCount(1);

      // ── 4 · CAPABILITY FALLBACK: «Действия» is human-only ───────────
      await key(page, 'Comma', 800); // LT → the actions route (human seat)
      await expect(workspace.locator('.con-info__acrow, .con-info__empty--big').first()).toBeVisible();
      await expect(crumbStage(page)).toHaveText(/Действия/i);
      await cycleTo(page, 'bot');
      // The route KEPT: the crumb still names the place, the zone presents
      // the workspace fallback — never a silent reset to the summary.
      await expect(crumbStage(page)).toHaveText(/Действия/i);
      await expect(workspace.locator('.con-info__na')).toHaveCount(1);
      await expect(workspace.locator('.con-info__na-title')).toHaveText(/Не применимо/i);
      await shoot(page, preset, '04-fallback-bot');
      await cycleTo(page, 'human');
      await expect(workspace.locator('.con-info__na'), 'the human serves the route again').toHaveCount(0);
      await expect(workspace.locator('.con-info__acrow, .con-info__empty--big').first()).toBeVisible();
      await key(page, 'Escape', 700);

      // ── 5 · «ЭКРАН БОТА»: R3 opens the hub, the board is one A deeper ─
      await cycleTo(page, 'bot');
      await key(page, 'KeyV', 900); // R3 → the internals hub
      await expect(workspace.locator('.con-botscr__entry')).toHaveCount(2);
      await expect(workspace.locator('.con-info__block--botcorp')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Экран бота/i);
      await shoot(page, preset, '05-bot-screen');
      // A on the focused entry (the printed board) descends one level.
      await key(page, 'Enter', 900);
      await expect(workspace.locator('.mb-guide')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Экран бота · Планшет бота/i);
      await shoot(page, preset, '05b-bot-board');
      // B returns to the HUB (one level), a second B to the summary.
      await key(page, 'Escape', 700);
      await expect(workspace.locator('.con-botscr__entry')).toHaveCount(2);
      await key(page, 'Escape', 700);
      await expect(workspace.locator('.con-info__layout')).toHaveCount(1);

      // ── 6 · X → the SAME premium embedded table for the bot ─────────
      await key(page, 'KeyX', 900);
      const embeddedBot = page.locator('.con-info .con-played--embedded');
      await expect(embeddedBot).toHaveCount(1);
      await expect(embeddedBot.locator('.con-played__provenance')).toBeVisible();
      await shoot(page, preset, '06-bot-played');
      await key(page, 'Escape', 800);
      await expect(page.locator('.con-info .con-played--embedded')).toHaveCount(0);
      await expect(workspace.locator('.con-info__layout')).toHaveCount(1);

      // ── 7 · The human played table + the fullscreen provenance ──────
      await cycleTo(page, 'human');
      await key(page, 'KeyX', 900);
      await expect(page.locator('.con-info .con-played--embedded')).toHaveCount(1);
      await expect(page.locator('.con-info .con-played__provenance')).toHaveCount(0);
      await shoot(page, preset, '07-played-human');
      // SMART OPEN: the корпорация zone holds ONE card → A goes straight
      // to fullscreen, carrying the PROVENANCE plate.
      await key(page, 'Enter', 1200);
      const plate = page.locator('.con-zoom__prov');
      await expect(plate).toHaveCount(1);
      await expect(plate.locator('.con-zoom__prov-kicker')).toHaveText('Разыграно');
      await expect(plate.locator('.con-zoom__prov-cat')).toHaveText('Корпорация');
      await expect(plate.locator('.con-zoom__prov-ord')).toHaveCount(0);
      await expect(page.locator('.con-info .con-played--embedded')).toBeVisible();
      await closeZoom(page);
      await expect(page.locator('.con-info .con-played--embedded')).toHaveCount(1);
      await key(page, 'Escape', 800);
      await expect(workspace.locator('.con-info__layout')).toHaveCount(1);
      // B from the played route lands the ring on ITS zone.
      await expect(workspace.locator('.con-info__zone--played.con-info__zone--focused')).toHaveCount(1);

      // ── 8 · Close: the rail atomically returns to the OWN seat ──────
      await key(page, 'KeyY', 800);
      await expect(page.locator('.con-info')).toHaveCount(0);
      await expect(railMc(page)).toHaveText(ownMc);
      await expect(page.locator('.con-res .con-res__prod')).toHaveCount(6);
      await expect(page.locator('.con-res .con-tagmx__grid')).toHaveCount(1);
      await expect(page.locator('.con-res .con-res__rows--bot')).toHaveCount(0);
      await shoot(page, preset, '08-closed-restored');

      // ── 9 · The board-home «Разыграно» (X): the SAME table serves the
      // bot seat with the LOCALIZED name («Бот», never a raw MarsBot). ──
      await key(page, 'KeyX', 1000);
      await expect(page.locator('.con-played')).toHaveCount(1);
      await key(page, 'KeyE', 800);
      await expect(page.locator('.con-played__seat-name')).toHaveText('Бот');
      await expect(page.locator('.con-played__provenance')).toBeVisible();
      await key(page, 'Escape', 800);
      await expect(page.locator('.con-played')).toHaveCount(0);

      // ── 10 · THE OVERLAY CONTRACT: Y opens OVER a live workspace and
      // hands it back UNTOUCHED — same frame, same focused row, nothing
      // committed, cancelled or replayed (the info panel never enters the
      // workspace stack; the snapshot restores the transient cursors). ──
      if (preset.id === 'standard-1080') {
        await key(page, 'Comma', 1100); // LT wheel
        await key(page, 'Enter', 1400); // → «Стандартные проекты»
        await page.waitForSelector('.con-stdp', {timeout: 15_000});
        await key(page, 'ArrowDown', 500); // move the cursor off the default row
        const focusedRow = async () =>
          (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
        const rowBefore = await focusedRow();
        expect(rowBefore, 'a standard-project row is focused').not.toBe('');
        await key(page, 'KeyY', 1000);
        await expect(page.locator('.con-info'), 'the overlay opens OVER the workspace').toHaveCount(1);
        await cycleTo(page, 'bot');
        await key(page, 'Enter', 700); // the score explorer on the bot
        await expect(page.locator('.con-info .con-vpx')).toHaveCount(1);
        await key(page, 'KeyY', 900); // close from depth — restores the context
        await expect(page.locator('.con-info')).toHaveCount(0);
        await expect(page.locator('.con-stdp'), 'the workspace below SURVIVED the overlay').toBeVisible();
        expect(await focusedRow(), 'the focused row survived the round trip').toBe(rowBefore);
        await key(page, 'Escape', 900); // B closes the workspace normally
        await page.waitForSelector('.con-stdp', {state: 'detached', timeout: 15_000});
      }

      // ── 11 · Reduced motion: the mode still switches cleanly ────────
      if (preset.id === 'standard-1080') {
        await page.emulateMedia({reducedMotion: 'reduce'});
        await key(page, 'KeyY', 700);
        await expect(page.locator('.con-info')).toHaveCount(1);
        await key(page, 'KeyE', 500);
        await expect(railMc(page)).not.toHaveText(ownMc);
        await key(page, 'KeyY', 600);
        await expect(page.locator('.con-info')).toHaveCount(0);
        await expect(railMc(page)).toHaveText(ownMc);
        await page.emulateMedia({reducedMotion: 'no-preference'});
      }
    });
  });
}
