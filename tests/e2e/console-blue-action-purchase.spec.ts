import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console BLUE ACTION · the COMMIT half — the EMBEDDED PURCHASE stage
 * (iteration 17 premium presentation).
 *
 * Drives Business Network («Коммерческая сеть») end to end and proves, at the
 * real surface, the parts console-action-focus.spec deliberately stops before:
 *
 *  1. SETUP — the stage marker reads «НАСТРОЙКА» (one word, never an echo of
 *     the root's noun) and the configuration plate carries the CTA;
 *  2. COMMIT → the outcome arrives EMBEDDED: the task host renders inside the
 *     workspace zone (`--embedded`), never as a standalone band;
 *  3. the ADAPTIVE single-card presentation: «Купить открытую карту?» instead
 *     of the mass-selector title, no «Выбрано 0/1» pickline, the economics on
 *     the card's own STATUS line (price / after-purchase), and NO duplicated
 *     A/X/RT glyph chips under the card (the bottom bar is the one command
 *     source);
 *  4. the SOURCE stays inspectable past the commit: the «ИСТОЧНИК» caption
 *     under the hero, the L3 hint in the bar, and the L3 → fullscreen source
 *     round trip that never unmounts the stage (selection survives);
 *  5. X inspects the RESULT (the X/L3 split);
 *  6. buying: A picks (the after-purchase readout appears), RT commits, the
 *     result leaves for the dock and the workspace folds — no stranded prompt.
 */

const OUT_DIR = path.resolve('screenshots', 'console-blue-action-purchase');

function newGameConfig() {
  return {
    players: [{name: 'BuyTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.31,
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
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console blue-action purchase · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('setup → commit → embedded buy stage → L3 source → buy → fold', async ({page, request}) => {
      test.setTimeout(480_000);

      // A deal containing Business Network (the reveal-and-buy archetype).
      let playerId = '';
      for (let attempt = 0; attempt < 40 && playerId === ''; attempt++) {
        const config = {...newGameConfig(), seed: 0.31 + attempt * 0.017};
        const created = await request.post('/api/creategame', {data: config});
        expect(created.ok()).toBeTruthy();
        const {players} = await created.json();
        const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
        const dealt = (pv.waitingFor?.options ?? [])
          .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
        if (dealt.includes('Business Network')) {
          playerId = players[0].id;
        }
      }
      expect(playerId, 'a deal containing Business Network').not.toBe('');
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800);

      // ── The start wizard (console-action-focus drive, verbatim). ────────
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
      const targetSlot = page.locator('.con-cards__slot[data-zoom-slot="Business Network"]');
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
        const focused = await page.locator('.con-cards__slot[data-zoom-slot="Business Network"][class*="--focused"]').count() > 0;
        if (focused) {
          break;
        }
        await key(page, 'ArrowRight', 230);
      }
      const pickedTarget = page.locator('.con-cards__slot[data-zoom-slot="Business Network"][class*="--picked"]');
      for (let tries = 0; tries < 3 && await pickedTarget.count() === 0; tries++) {
        await key(page, 'Enter', 700);
      }
      expect(await pickedTarget.count(), 'Business Network must be picked').toBeGreaterThan(0);
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

      // ── Play Business Network from the hand (RT wheel → КАРТЫ). ─────────
      await key(page, 'Period', 600);
      await key(page, 'Enter', 1600);
      await expect(page.locator('.con-hand [data-zoom-slot="Business Network"]')).toBeVisible({timeout: 10_000});
      for (let step = 0; step < 14; step++) {
        const focusedName = await page.locator('.con-hand .con-hand__slot--selected[data-zoom-slot]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedName === 'Business Network') {
          break;
        }
        await key(page, 'ArrowRight', 260);
      }
      await key(page, 'Enter', 900);
      for (let i = 0; i < 5 && await page.locator('.con-composer--play, .con-play').count() > 0; i++) {
        await key(page, 'Enter', 900);
      }
      await page.waitForTimeout(4200);

      // ── Into the workspace → ACTION FOCUS. ──────────────────────────────
      for (let tries = 0; tries < 4 && await page.locator('.con-cardactions').count() === 0; tries++) {
        await key(page, 'Period', 700);
        await key(page, 'ArrowUp', 1200);
      }
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 10_000});
      await page.waitForTimeout(700); // the wheel-handoff enter fully settles
      const emblemInBrowse = await page.locator('.con-cardactions__kicker-emblem').evaluate((el) => {
        const cs = getComputedStyle(el);
        return {opacity: cs.opacity, visibility: cs.visibility, inline: el.getAttribute('style') ?? ''};
      });
      await key(page, 'Enter', 1200);
      await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage')).toHaveCount(1);
      // The one-word stage marker: «НАСТРОЙКА», never «НАСТРОЙКА ДЕЙСТВИЯ».
      expect((await page.locator('.con-cardactions__kicker-step').innerText()).trim().toUpperCase()).toBe('НАСТРОЙКА');
      await page.waitForTimeout(600); // the entry FLIP fully settles
      // THE IDENTITY SYMBOL: the lightning is part of the parent anchor in
      // EVERY state — measurably drawn, not just a reserved box (a stranded
      // wheel-echo once left it at inline opacity 0 for the workspace's life).
      const emblemProbe = await page.locator('.con-cardactions__kicker-emblem').evaluate((el) => {
        const cs = getComputedStyle(el);
        const svg = el.querySelector('svg');
        const r = el.getBoundingClientRect();
        return {opacity: cs.opacity, visibility: cs.visibility, inline: el.getAttribute('style') ?? '', w: r.width, h: r.height, hasSvg: svg !== null,
          svgOpacity: svg !== null ? getComputedStyle(svg).opacity : ''};
      });
      const emblemStory = `browse=${JSON.stringify(emblemInBrowse)} setup=${JSON.stringify(emblemProbe)}`;
      expect(emblemProbe.hasSvg, `emblem: ${emblemStory}`).toBe(true);
      expect(parseFloat(emblemProbe.opacity), `emblem: ${emblemStory}`).toBeGreaterThan(0.9);
      expect(emblemProbe.visibility, `emblem: ${emblemStory}`).toBe('visible');
      expect(emblemProbe.w).toBeGreaterThan(4);
      // The SOURCE STABILITY baseline: the hero card wrap's box at setup.
      const heroAtSetup = await page.locator('.con-composer__actcardwrap').boundingBox();
      expect(heroAtSetup).not.toBeNull();
      await shoot(page, `${profile.tag}-01-setup`);

      // ── COMMIT (the CTA is the focused row of a no-decision action). ────
      await key(page, 'Enter', 400);

      // ── The EMBEDDED purchase stage arrives inside the workspace zone. ──
      const embeddedHost = page.locator('[data-embed-slot="workspace-reveal"] .con-task-host--embedded');
      await expect(embeddedHost).toHaveCount(1, {timeout: 25_000});
      // Never a standalone band while the workspace owns the outcome.
      expect(await page.locator('.con-task-host:not(.con-task-host--embedded)').count()).toBe(0);
      // The workspace chrome and the source hero never went anywhere.
      await expect(page.locator('.con-cardactions')).toHaveCount(1);
      await expect(page.locator('.con-composer--stage [data-action-focus-card][data-zoom-slot="Business Network"]')).toHaveCount(1);
      // THE SOURCE STABILITY CONTRACT (NORTH STAR): the hero card is the same
      // spatial object across the commit — same box to the pixel. Any
      // stage-specific label leaking into its column shows up here.
      const heroAtBuy = await page.locator('.con-composer__actcardwrap').boundingBox();
      expect(heroAtBuy).not.toBeNull();
      expect(Math.abs(heroAtBuy!.x - heroAtSetup!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(heroAtBuy!.y - heroAtSetup!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(heroAtBuy!.width - heroAtSetup!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(heroAtBuy!.height - heroAtSetup!.height)).toBeLessThanOrEqual(1);
      // THE IDENTITY SYMBOL holds on the COMMITTED stage too (§ NORTH STAR:
      // present through every state, never re-hidden by a stage transition).
      const emblemAtBuy = await page.locator('.con-cardactions__kicker-emblem').evaluate((el) => {
        const cs = getComputedStyle(el);
        return {opacity: cs.opacity, visibility: cs.visibility};
      });
      expect(parseFloat(emblemAtBuy.opacity), `emblem@buy: ${JSON.stringify(emblemAtBuy)}`).toBeGreaterThan(0.9);
      expect(emblemAtBuy.visibility).toBe('visible');
      // The breadcrumb advanced its TAIL only, into the committed accent.
      // (Both keyed words coexist in the swap cell during the crossfade —
      // wait for the leaving one to finish before asserting the survivor.)
      const step = page.locator('.con-cardactions__kicker-step');
      await expect(step).toHaveCount(1, {timeout: 5000});
      await expect(step).toHaveClass(/--committed/);
      expect((await step.innerText()).trim().toUpperCase()).toBe('ПОКУПКА');
      // ADAPTIVE single-card copy: the actual question, not the mass selector.
      await expect(page.locator('.con-task__title--embedded')).toContainText('Купить открытую карту?', {timeout: 10_000});
      expect(await page.locator('.con-task__pickline').count(), 'the counters fold away for one card').toBe(0);
      // The status line carries the economics and NO duplicated command chips.
      await expect(page.locator('.con-cards__verdict--price')).toBeVisible();
      expect(await page.locator('.con-cards__verdictbar .con-cards__verdict--zoom').count()).toBe(0);
      expect(await page.locator('.con-cards__verdictbar .con-cards__verdict--go').count()).toBe(0);
      // No stage-specific labels under the SOURCE card — its column must be
      // byte-identical across phases (the stability contract); the L3 verb
      // lives in the ONE command bar only.
      expect(await page.locator('.con-composer__cardrole').count()).toBe(0);
      // (Source text, not the CSS uppercase; the Deck bar drops the
      //  self-evident hints first — this one must survive on every profile.)
      await expect(page.locator('.con-cmdbar')).toContainText(/Источник/i);
      // The deal cinematic has fully HANDED OVER (no slot still holds its
      // card for a flying proxy) — the screenshot shows the settled stage.
      await expect(page.locator('.con-cards__slot.con-deal-hold')).toHaveCount(0, {timeout: 12_000});
      await page.waitForTimeout(900);
      await shoot(page, `${profile.tag}-02-embedded-buy`);

      // ── L3: fullscreen the SOURCE over the living stage. ────────────────
      // (Retry discipline: a press during a still-settling flight on a heavy
      //  4K frame is deliberately consumed — same as every wizard step.)
      const zoom = page.locator('dialog.con-zoom[open]');
      for (let tries = 0; tries < 3 && await zoom.count() === 0; tries++) {
        await key(page, 'KeyC', 1600);
      }
      await expect(zoom).toHaveCount(1, {timeout: 8000});
      await expect(zoom).toContainText(/Коммерческая сеть/i);
      await shoot(page, `${profile.tag}-03-l3-source`);
      await key(page, 'Escape', 1200);
      await expect(zoom).toHaveCount(0);
      // The stage survived the round trip untouched.
      await expect(embeddedHost).toHaveCount(1);
      await expect(page.locator('.con-task__title--embedded')).toContainText('Купить открытую карту?');
      // The FULLSCREEN RETURN did not move the source either (§17): the hero
      // box after the zoom round trip equals the setup box to the pixel.
      await page.waitForTimeout(400); // the return flight fully settles
      const heroAfterZoom = await page.locator('.con-composer__actcardwrap').boundingBox();
      expect(heroAfterZoom).not.toBeNull();
      expect(Math.abs(heroAfterZoom!.x - heroAtSetup!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(heroAfterZoom!.y - heroAtSetup!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(heroAfterZoom!.width - heroAtSetup!.width)).toBeLessThanOrEqual(1);

      // ── X: fullscreen the RESULT (the X/L3 split). ──────────────────────
      for (let tries = 0; tries < 3 && await zoom.count() === 0; tries++) {
        await key(page, 'KeyX', 1600);
      }
      await expect(zoom).toHaveCount(1, {timeout: 8000});
      await key(page, 'Escape', 1200);
      await expect(zoom).toHaveCount(0);
      await expect(embeddedHost).toHaveCount(1);

      // ── COLLAPSE (B) → the committed decision survives → reopen. ────────
      // (Retry: a press inside the zoom's still-settling return flight is
      //  consumed on a heavy 4K frame — the loop stops the moment the fold
      //  lands, so a second press can never hit the board home.)
      for (let tries = 0; tries < 3; tries++) {
        await key(page, 'Escape', 1700);
        if (await page.locator('.con-cardactions').count() === 0) {
          break;
        }
      }
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 8000});
      // The deferred-return card waits on the board home.
      const restore = page.locator('.con-mandatory');
      await expect(restore).toHaveCount(1, {timeout: 8000});
      await shoot(page, `${profile.tag}-04-collapsed`);
      // Restore: A on the return card is the primary path; B (the board
      // home's restore branch) is the fallback — either must land back in
      // the SAME committed stage.
      await key(page, 'Enter', 1800);
      if (await page.locator('[data-embed-slot="workspace-reveal"] .con-task-host--embedded').count() === 0) {
        await key(page, 'Escape', 1800);
      }
      // The SAME committed stage comes back: same phase, same title, no
      // replayed cinematic, no second server trip.
      await expect(page.locator('[data-embed-slot="workspace-reveal"] .con-task-host--embedded')).toHaveCount(1, {timeout: 15_000});
      await expect(page.locator('.con-task__title--embedded')).toContainText('Купить открытую карту?');
      await expect(step).toHaveCount(1, {timeout: 5000});
      await expect(step).toHaveClass(/--committed/);

      // ── Buy: A picks (the after-purchase readout appears), RT commits. ──
      await key(page, 'Enter', 700);
      await expect(page.locator('.con-cards__slot--picked')).toHaveCount(1);
      await expect(page.locator('.con-cards__verdict--picked')).toContainText('После покупки');
      await shoot(page, `${profile.tag}-04-picked`);
      await key(page, 'Period', 800);

      // ── The result leaves for the dock; the workspace folds; no strand. ──
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 25_000});
      await expect(page.locator('.con-task-host')).toHaveCount(0);
      await expect(turnChip).toHaveCount(1, {timeout: 20_000});
      await page.waitForTimeout(2500);
      await shoot(page, `${profile.tag}-05-after-buy`);
    });
  });
}
