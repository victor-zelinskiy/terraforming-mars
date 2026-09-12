import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, playCardFromHand, press, pressUntil, settle, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * THE EFFECTS EXPLORER — the Information workspace's «Эффекты» vertical:
 *
 *   summary zone (per-EFFECT family counts + the whole-game line)
 *     → (unfold out of the zone) → the BROWSE grid in the card-actions
 *       language (dossier column · card groups · one tile per effect ·
 *       honest live metas) with the LT/RT family facet
 *       → (descend out of the pressed tile) → the effect DOSSIER (hero
 *         card · printed rule · the «За партию» stats panel)
 *         → X — the ONE console fullscreen inspector; B folds one level,
 *           the crumb tail retreating with it.
 *
 * Drives a real human+MarsBot game with three guaranteed effect cards
 * played through the real hand flow — Carbon Nanosystems FIRST (its
 * science-tag trigger then genuinely fires when Olympus Conference is
 * played), so the stats the panel shows are the server's own, not fixtures.
 * The corporation is pinned to UNMI (no passive effect box), so the four
 * family counts are deterministic.
 *
 * Also the screenshot source (screenshots/effects-explorer/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'effects-explorer');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  profileQuery: string;
  /** The full journey runs once (1080); the others sweep fit + parity. */
  journey: boolean;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto', journey: true},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv', journey: false},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld', journey: false},
];

/** CN first (multi-effect: trigger + graphene-as-M€), then the science-tag
 *  play that FIRES it, then a plain city trigger. All requirement-free. */
const EFFECT_CARDS = ['Carbon Nanosystems', 'Olympus Conference', 'Rover Construction'];

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'EffectsTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.47,
  automa: {difficulty: 'normal'},
  expansions: {corpera: true, promo: true},
  // Deck-top guarantee (Deck.putOnTop) — the FIRST deal offers all three.
  customProjectCards: EFFECT_CARDS,
  // A corporation with NO passive effect box (its ability is an action), so
  // the family counts below are exact whatever the seeder would have drawn.
  customCorporationsList: ['United Nations Mars Initiative'],
});

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const infoRoot = (page: Page) => page.locator('.con-info');
const crumbStage = (page: Page) => page.locator('.con-info .con-wshead__step');
const effectsZone = (page: Page) => page.locator('.con-info [data-zone="effects"]');
const explorer = (page: Page) => page.locator('.con-efx');
const detailStage = (page: Page) => page.locator('.con-efx__stage');

/** Open the Information workspace, acknowledging whatever cinematic stands. */
async function openInfo(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await infoRoot(page).count() === 0; i++) {
    if (i > 0) {
      await press(page, 'Enter', 700);
      await press(page, 'Escape', 500);
    }
    await press(page, 'KeyY', 1100);
  }
  await expect(infoRoot(page),
    `the info workspace must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toHaveCount(1);
}

/** Walk the summary ring onto the effects zone (positive witness, never a
 *  memorised key sequence — the ring's shape depends on the seat). */
async function focusEffectsZone(page: Page): Promise<void> {
  const focused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown'];
  for (const move of moves) {
    if (await focused() > 0) {
      return;
    }
    await press(page, move, 300);
  }
  expect(await focused(), 'the ring must reach the effects zone').toBeGreaterThan(0);
}

async function openExplorer(page: Page): Promise<void> {
  await focusEffectsZone(page);
  expect(await pressUntil(page, 'Enter', async () => await explorer(page).count() > 0, {tries: 3, settleMs: 1100}),
    'A on the effects zone must open the explorer').toBeTruthy();
}

/** A container proves «no scroll»: its content fits its own box. */
async function expectFits(page: Page, selector: string, label: string): Promise<void> {
  const verdict = await page.locator(selector).first().evaluate((el) => ({
    sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth,
  }));
  expect(verdict.sh, `${label}: content height ${verdict.sh} must fit ${verdict.ch}`)
    .toBeLessThanOrEqual(verdict.ch + 2);
  expect(verdict.sw, `${label}: content width ${verdict.sw} must fit ${verdict.cw}`)
    .toBeLessThanOrEqual(verdict.cw + 2);
}

for (const preset of PRESETS) {
  test.describe(`effects explorer · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: 1,
      screen: preset.viewport,
    });

    test('the effects vertical: zone → browse grid → dossier → fullscreen', async ({page, request}) => {
      test.setTimeout(560_000);

      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));

      await bootIntoGame(page, request, {
        config: GAME_CONFIG,
        cards: EFFECT_CARDS,
        // ⚠️ NAME the corporation — the config only guarantees UNMI is IN the
        // eight-corp deal; unnamed, the seeder picks some other calm corp
        // (Splice arrived once and its two effects broke every exact count).
        corporation: 'United Nations Mars Initiative',
        query: preset.profileQuery,
      });

      // ── MATERIAL: the three effect cards through the real hand flow. CN
      // FIRST — its own science tag fires it once at play, and Olympus
      // Conference's tag fires it again, so «Срабатываний» below is the
      // server's own recorded fact. ──
      for (const card of EFFECT_CARDS) {
        expect(await playCardFromHand(page, card), `${card} must play`).toBeTruthy();
      }
      await settle(page);

      // ── THE ZONE: per-EFFECT family counts (CN counts TWICE — its trigger
      // and its spending-power rule are two different families). ──
      await openInfo(page);
      const zone = effectsZone(page);
      await expect(zone).toHaveCount(1);
      // Triggers: Rover Construction + Olympus Conference + CN#0 = 3.
      const triggersRow = zone.locator('.con-info__stat-line', {has: page.locator('.con-info__efam-dot--triggers')});
      await expect(triggersRow.locator('b')).toHaveText('3');
      // Spending power: CN#1 = 1 (the per-effect counting this rework exists for).
      const payRow = zone.locator('.con-info__stat-line', {has: page.locator('.con-info__efam-dot--payValue')});
      await expect(payRow.locator('b')).toHaveText('1');
      // The whole-game line arrives WITH the stats (async — poll the locator);
      // CN + Olympus Conference both genuinely fired during the material plays.
      await expect(zone.locator('.con-info__efam-note'), 'the stats line lands once /effect-stats answers')
        .toContainText('Срабатываний', {timeout: 25_000});
      await shoot(page, preset, '1-summary-zone');

      // ── ZONE → BROWSE: the explorer unfolds out of the pressed zone; the
      // crumb tail advances to «ЭФФЕКТЫ» and the zone's numbers become the
      // grid: three groups, CN wide with two tiles. ──
      await openExplorer(page);
      // The DOM carries the sentence case («Эффекты») — the caps are CSS.
      await expect(crumbStage(page)).toContainText(/эффекты/i);
      await expect(explorer(page).locator('.con-efx__group')).toHaveCount(3);
      const wide = explorer(page).locator('.con-efx__group--wide');
      if (preset.id !== 'deck-handheld') {
        await expect(wide, 'CN is the one multi-effect group').toHaveCount(1);
        await expect(wide.locator('.con-efx__tile')).toHaveCount(2);
      }
      // The dossier column is the browse twin of the hero: the focused
      // group's source card stands in it, zoom-slot armed.
      await expect(explorer(page).locator('.con-efx__detail [data-zoom-slot]')).toHaveCount(1);
      // HONEST METAS: CN#0's trigger genuinely fired TWICE (its own science
      // tag at play + the OC play) — the tile says so through the channel
      // split, not a card-level blur.
      const cnTrigger = explorer(page).locator('[data-effect-key="Carbon Nanosystems#0"] .con-efx__meta-line--stat b');
      await expect(cnTrigger, 'CN#0 carries its own per-effect count').toHaveText('2', {timeout: 25_000});
      await expectFits(page, '.con-efx__detail', 'the dossier column');
      await shoot(page, preset, '2-browse-grid');

      // ── THE FAMILY FACET (LT/RT): narrowing to «Ценность оплаты» keeps
      // only CN's payment tile; R3 resets. Counts stay filter-independent. ──
      await press(page, 'Period', 500); // RT → next facet
      const chipActive = explorer(page).locator('.con-efx__chip--active');
      await expect(chipActive).toHaveCount(1);
      const facetedTiles = explorer(page).locator('.con-efx__tile');
      expect(await facetedTiles.count(), 'a facet narrows the grid').toBeLessThan(4);
      await press(page, 'KeyV', 500); // R3 → reset
      await expect(explorer(page).locator('.con-efx__tile')).toHaveCount(4);

      if (!preset.journey) {
        // The fit sweep is this preset's whole job; the journey runs at 1080.
        expect(pageErrors, `no page errors; saw: ${pageErrors.join(' | ')}`).toEqual([]);
        return;
      }

      // ── BROWSE → DOSSIER: A on the CN payment tile descends — the crumb
      // gains the card name (the tail only ever advances), the browse layer
      // parks, the stage carries the hero + the printed rule + «За партию». ──
      await press(page, 'ArrowRight', 300); // CN#0 → CN#1 (the wide pair)
      await expect(explorer(page).locator('.con-efx__tile--focused')).toHaveAttribute('data-effect-key', 'Carbon Nanosystems#1');
      expect(await pressUntil(page, 'Enter', async () => await detailStage(page).count() > 0, {tries: 3, settleMs: 900}),
        'A must descend into the dossier').toBeTruthy();
      await expect(crumbStage(page)).toContainText('Углеродные наносистемы');
      await expect(detailStage(page).locator('[data-effect-focus-card]')).toHaveCount(1);
      // The «За партию» panel: the payment effect has NOT been used — the
      // panel says so honestly (per-effect scope, never a dead state).
      await expect(detailStage(page).locator('.con-efx__sum'), 'the stats panel stands')
        .toBeVisible({timeout: 25_000});
      await expect(detailStage(page).locator('.con-efx__sum-note')).toBeVisible({timeout: 25_000});
      await shoot(page, preset, '3-dossier-payment');

      // ── LB/RB AT THE DOSSIER: the sibling effect steps IN the standing
      // stage (no re-descend) — CN#0's dossier now shows its real count. ──
      await press(page, 'KeyQ', 700); // LB → previous effect
      await expect(detailStage(page).locator('.con-efx__sum-metric b')).toHaveText('2', {timeout: 25_000});
      await shoot(page, preset, '4-dossier-trigger');

      // ── X — the ONE fullscreen inspector over the hero; B returns. ──
      await press(page, 'KeyX', 900);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom).toHaveCount(1);
      await press(page, 'Escape', 900);
      await expect(zoom).toHaveCount(0, {timeout: 15_000});
      await expect(detailStage(page), 'the dossier survived the inspection').toHaveCount(1);

      // ── THE B CHAIN: dossier → browse (fold into the tile) → summary
      // (fold into the zone) — the crumb tail retreating each level. ──
      await press(page, 'Escape', 900);
      await expect(detailStage(page)).toHaveCount(0, {timeout: 15_000});
      await expect(explorer(page)).toHaveCount(1);
      await expect(crumbStage(page)).not.toContainText('Углеродные наносистемы');
      await press(page, 'Escape', 900);
      await expect(explorer(page)).toHaveCount(0, {timeout: 15_000});
      await expect(effectsZone(page), 'B lands the ring back on the zone').toHaveCount(1);

      // ── PARITY: LB/RB to the bot seat — the zone does not exist for it;
      // standing ON the route it presents the honest fallback instead. ──
      await openExplorer(page);
      await press(page, 'KeyE', 1100); // RB → the bot seat (route survives)
      await expect(page.locator('.con-info__na'), 'the capability fallback stands for the bot')
        .toHaveCount(1, {timeout: 15_000});
      await press(page, 'KeyE', 1100); // RB → back to the human
      await expect(explorer(page), 'the route survived the round trip').toHaveCount(1, {timeout: 15_000});
      await press(page, 'Escape', 900);
      await expect(effectsZone(page)).toHaveCount(1);
      await expect(page.locator('.con-info [data-zone="effects"].con-info__zone--focused'),
        'the ring stands where the player left').toHaveCount(1);

      expect(pageErrors, `no page errors; saw: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  });
}

// ── REDUCED MOTION: the whole vertical still lands (microtask done — the
// out-in wedge class this panel documents). One preset is the claim. ──
test.describe('effects explorer · reduced motion', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
  });

  test('zone → browse → dossier → back, snapping', async ({page, request}) => {
    test.setTimeout(480_000);
    await bootIntoGame(page, request, {
      config: GAME_CONFIG,
      cards: EFFECT_CARDS,
      corporation: 'United Nations Mars Initiative',
      query: '&consoleProfile=auto',
    });
    // The live matchMedia is what the console's reduced-motion reads — the
    // info-workspace spec's precedent (no boot-time latch to re-arm).
    await page.emulateMedia({reducedMotion: 'reduce'});
    for (const card of EFFECT_CARDS) {
      expect(await playCardFromHand(page, card), `${card} must play`).toBeTruthy();
    }
    await settle(page);
    await openInfo(page);
    await openExplorer(page);
    await expect(explorer(page).locator('.con-efx__group')).toHaveCount(3);
    expect(await pressUntil(page, 'Enter', async () => await detailStage(page).count() > 0, {tries: 3, settleMs: 700}),
      'the descend lands under reduced motion').toBeTruthy();
    await press(page, 'Escape', 700);
    await expect(detailStage(page)).toHaveCount(0, {timeout: 10_000});
    await expect(explorer(page), 'the browse layer is back and live').toHaveCount(1);
    await press(page, 'Escape', 700);
    await expect(effectsZone(page)).toHaveCount(1, {timeout: 10_000});
  });
});
