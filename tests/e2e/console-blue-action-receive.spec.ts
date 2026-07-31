import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console BLUE ACTION · the RECEIVE (plain draw) stage — the twin of the
 * purchase stage, ONE premium language (iteration 21).
 *
 * Drives Development Center («Центр разработки»: spend 1 energy → draw a
 * card — no on-play tile, the cleanest plain-draw archetype) and proves, at
 * the real surface, the receive-specific contracts:
 *
 *  1. the EXECUTION BEAT actually flies — the face-down pull launches after
 *     the Action Commit's handoff and the stage NEVER falls back to the
 *     2.6 s backstop («delta-chip → дилей → карта появляется»);
 *  2. the embedded presentation speaks the BUY voice: centred instruction
 *     close over a HERO-sized card, no count chip for one card, no on-card
 *     command pill, the status line = name + the ONE take verb («A Взять»);
 *  3. taking the card FOLDS the workspace (atomically) and the hand intake
 *     actually lands — the dock count grows, no proxy is left hanging.
 */

const OUT_DIR = path.resolve('screenshots', 'console-blue-action-receive');

function newGameConfig() {
  return {
    players: [{name: 'DrawTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.47,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
] as const;

for (const profile of PROFILES) {
  test.describe(`console blue-action receive · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('commit → beat flight → embedded receive (buy voice) → take → fold + dock landing', async ({page, request}) => {
      test.setTimeout(480_000);

      let playerId = '';
      for (let attempt = 0; attempt < 40 && playerId === ''; attempt++) {
        const config = {...newGameConfig(), seed: 0.47 + attempt * 0.019};
        const created = await request.post('/api/creategame', {data: config});
        expect(created.ok()).toBeTruthy();
        const {players} = await created.json();
        const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
        const dealt = (pv.waitingFor?.options ?? [])
          .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
        if (dealt.includes('Development Center')) {
          playerId = players[0].id;
        }
      }
      expect(playerId, 'a deal containing Development Center').not.toBe('');
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800);

      // ── The start wizard (the shared drive). ────────────────────────────
      const startScene = page.locator('.con-start__frame');
      await page.waitForSelector('.con-start__frame .con-cards__slot', {timeout: 25_000});
      const corpWithFirstAction = new Set(['Inventrix', 'Tharsis Republic', 'CrediCor', 'United Nations Mars Initiative', 'Helion']);
      for (let step = 0; step < 12; step++) {
        const focusedCorp = await page.locator('.con-start__frame .con-cards__slot[class*="--focused"]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedCorp !== null && !corpWithFirstAction.has(focusedCorp)) {
          break;
        }
        await key(page, 'ArrowRight', 240);
      }
      const targetSlot = page.locator('.con-cards__slot[data-zoom-slot="Development Center"]');
      for (let tries = 0; tries < 4; tries++) {
        await key(page, 'Enter', 1400);
        const picked = await page.locator('.con-start__frame', {hasText: 'Выбрано 1'}).count() > 0;
        if (picked || await targetSlot.count() > 0) {
          break;
        }
      }
      for (let hop = 0; hop < 5 && await targetSlot.count() === 0; hop++) {
        const onSummary = await page.locator('.con-start__frame', {hasText: 'Сводка'}).count() > 0;
        await key(page, onSummary ? 'Comma' : 'Period', 1400);
      }
      await targetSlot.waitFor({timeout: 8000});
      for (let step = 0; step < 40; step++) {
        const focused = await page.locator('.con-cards__slot[data-zoom-slot="Development Center"][class*="--focused"]').count() > 0;
        if (focused) {
          break;
        }
        await key(page, 'ArrowRight', 230);
      }
      const pickedTarget = page.locator('.con-cards__slot[data-zoom-slot="Development Center"][class*="--picked"]');
      for (let tries = 0; tries < 3 && await pickedTarget.count() === 0; tries++) {
        await key(page, 'Enter', 700);
      }
      expect(await pickedTarget.count(), 'Development Center must be picked').toBeGreaterThan(0);
      await key(page, 'Period', 1400);
      for (let i = 0; i < 10 && await startScene.count() > 0; i++) {
        await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
      }
      await page.waitForSelector('.con-start__frame', {state: 'detached', timeout: 30_000});
      const turnChip = page.locator('.con-status', {hasText: 'ДЕЙСТВИЕ'});
      for (let i = 0; i < 12 && await turnChip.count() === 0; i++) {
        if (await page.locator('.con-start').count() > 0) {
          await key(page, 'Enter', 1300);
        } else {
          await page.waitForTimeout(1000);
        }
      }
      await expect(turnChip).toHaveCount(1, {timeout: 20_000});
      await page.waitForTimeout(4000);

      // ── Play Development Center from the hand. ─────────────────────────────
      await key(page, 'Period', 600);
      await key(page, 'Enter', 1600);
      await expect(page.locator('.con-hand [data-zoom-slot="Development Center"]')).toBeVisible({timeout: 10_000});
      for (let step = 0; step < 14; step++) {
        const focusedName = await page.locator('.con-hand .con-hand__slot--selected[data-zoom-slot]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedName === 'Development Center') {
          break;
        }
        await key(page, 'ArrowRight', 260);
      }
      await key(page, 'Enter', 900);
      for (let i = 0; i < 5 && await page.locator('.con-composer--play, .con-play').count() > 0; i++) {
        await key(page, 'Enter', 900);
      }
      await page.waitForTimeout(4200);

      // ── Workspace → setup → COMMIT. ─────────────────────────────────────
      for (let tries = 0; tries < 4 && await page.locator('.con-cardactions').count() === 0; tries++) {
        await key(page, 'Period', 700);
        await key(page, 'ArrowUp', 1200);
      }
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 10_000});
      await key(page, 'Enter', 1200);
      await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage')).toHaveCount(1);
      await page.waitForTimeout(600);
      // The precise beat-health probe: the [WSBEAT] diagnostics name the
      // backstop explicitly when the flight dies — wall-clock alone cannot
      // distinguish a slow healthy chain from the 2.6 s failure path.
      const wsLogs: Array<string> = [];
      page.on('console', (m) => {
        const t = m.text();
        if (t.includes('WSBEAT')) {
          wsLogs.push(t);
        }
      });
      const dockCountBefore = await page.locator('.con-handdock').innerText().catch(() => '');
      const tPress = Date.now();
      await page.keyboard.press('Enter'); // CTA confirm — the Action Commit starts

      // ── 1. The BEAT actually flies: the flight layer mounts after the
      //       commit handoff (it NEVER did when a fast answer cancelled the
      //       delayed launch — the backstop bug this spec exists to catch). ──
      await expect(page.locator('.con-composer__revealfly')).toHaveCount(1, {timeout: 4000});

      // ── 2. The embedded receive stage, in the BUY voice. ────────────────
      const embedded = page.locator('[data-embed-slot="workspace-reveal"] .con-reveal--embedded');
      await expect(embedded).toHaveCount(1, {timeout: 10_000});
      const arriveMs = Date.now() - tPress;
      // Sanity ceiling only (the precise probe is the backstop log below —
      // a healthy chain on a busy runner can legitimately take ~2.8 s).
      expect(arriveMs, `stage arrived in ${arriveMs}ms`).toBeLessThan(3600);
      expect(wsLogs.some((l) => l.includes('BACKSTOP FIRED')),
        `the beat fell back to the backstop:\n${wsLogs.join('\n')}`).toBe(false);
      await expect(page.locator('.con-reveal__title')).toContainText('Получена карта');
      // PRIMARY-HEADING PARITY: the title reads the SHARED .con-ws-stage-heading
      // role — the same computed voice the buy stage's «Купить открытую карту?»
      // gets (its spec asserts the identical numbers; fhd: 1.3rem = 26px/700).
      const headStyle = await page.locator('.con-reveal__title').evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {size: cs.fontSize, weight: cs.fontWeight};
      });
      expect(headStyle, `heading ${JSON.stringify(headStyle)}`).toEqual({size: '26px', weight: '700'});
      expect(await page.locator('.con-reveal__count').count(), 'no count chip for ONE card').toBe(0);
      expect(await page.locator('.con-start__slot-a').count(), 'no on-card command pill').toBe(0);
      // The status line: focused card's name + the ONE take verb.
      await expect(page.locator('.con-reveal__namebar .con-cards__verdict-name')).toBeVisible();
      await expect(page.locator('.con-reveal__namebar .con-cards__verdict--ok')).toBeVisible();
      // HERO size — the same weight the buy stage gives its card (fhd: an
      // unscaled 320px face; anything under ~300 is the old 0.79 ladder).
      const slotBox = await page.locator('.con-reveal--embedded .con-cards__slot').first().boundingBox();
      expect(slotBox).not.toBeNull();
      expect(slotBox!.width, `slot width ${slotBox!.width}`).toBeGreaterThan(300);
      // The kicker mirrors the stage, never a generic «КАРТЫ».
      await expect(page.locator('.con-cmdbar')).toContainText(/Добор карт/i);
      await page.waitForTimeout(700);
      await shoot(page, `${profile.tag}-01-receive-stage`);

      // ── 3. TAKE → the workspace folds, the card lands in the dock. ──────
      await key(page, 'Enter', 600);
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 8000});
      // No proxy left hanging: the delivery layer empties once the flight lands.
      await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0, {timeout: 8000});
      await page.waitForTimeout(1200);
      const dockCountAfter = await page.locator('.con-handdock').innerText().catch(() => '');
      expect(dockCountAfter, `dock ${dockCountBefore} → ${dockCountAfter}`).not.toEqual(dockCountBefore);
      await expect(turnChip).toHaveCount(1, {timeout: 15_000});
      await shoot(page, `${profile.tag}-02-after-take`);
    });
  });
}
