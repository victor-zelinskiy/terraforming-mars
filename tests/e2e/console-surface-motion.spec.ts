import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console surface-motion system · the Search For Life reveal chain + wheels.
 *
 * Drives a real solo game through the console-native shell:
 *  1. RT/LT quick wheels — open / dismiss / handoff (the shared `.con-shade`
 *     dim must stay CONTINUOUS across the wheel → Standard-Projects handoff,
 *     and the wheel must carry no private backdrop anymore);
 *  2. play Search For Life from hand, then run its blue-card action through
 *     the composer confirm → the committed AWAITING hold → the reveal result
 *     as ONE scene: the shade never blinks through the swap, the composer's
 *     source card FLIPs into the result's «Источник» slot (both carry the
 *     `data-motion-anchor="card:Search For Life"` contract), and OK after
 *     the semantic commit lands on the RESULT — never back on the confirm.
 *
 * The regression this guards: the composer used to unmount synchronously on
 * confirm (bare board for the whole round-trip), the reveal then faded in as
 * an unrelated modal — three backdrop blinks per action.
 */

const OUT_DIR = path.resolve('screenshots', 'console-surface-motion');

/** Deterministic solo game config (the seed is varied by the retry loop). */
function newGameConfig() {
  return {
    players: [{name: 'MotionTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      // deltaProject ON: the Hydronetwork workspace section drives the
      // section-exit regression probe (the planet must never rescale).
      starwars: false, underworld: false, deltaProject: true,
    },
    board: 'tharsis',
    seed: 0.03,
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

/** Sample the shade's ON state every `stepMs` — the anti-blink probe. */
async function sampleShadeContinuity(page: Page, samples: number, stepMs: number): Promise<boolean[]> {
  const out: boolean[] = [];
  for (let i = 0; i < samples; i++) {
    out.push(await page.locator('.con-shade--on').count() > 0);
    await page.waitForTimeout(stepMs);
  }
  return out;
}

/** The target profiles: the 1080 logical console, the 4K TV recomposition
 *  (`consoleProfile=tv` — rem scale ×2, the same live-rect choreography) and
 *  the reduced-motion axis (same stage order / input / commits, short fades —
 *  every DOM assertion must hold identically). */
const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: '', reduced: false},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv', reduced: false},
  {tag: 'fhd-reduced', width: 1920, height: 1080, query: '', reduced: true},
] as const;

for (const profile of PROFILES) {
  test.describe(`console surface motion · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
      contextOptions: {reducedMotion: profile.reduced ? 'reduce' : 'no-preference'},
    });

    test('wheel handoff + composer → reveal as one scene', async ({page, request}) => {
      test.setTimeout(480_000);

      // The deal is not perfectly seed-stable across a live server — retry
      // the creation (varying the seed) until Search For Life is among the
      // dealt projects. API-only, so the loop is cheap.
      let playerId = '';
      for (let attempt = 0; attempt < 40 && playerId === ''; attempt++) {
        const config = {...newGameConfig(), seed: 0.03 + attempt * 0.017};
        const created = await request.post('/api/creategame', {data: config});
        expect(created.ok()).toBeTruthy();
        const {players} = await created.json();
        const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
        const dealt = (pv.waitingFor?.options ?? [])
          .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
        if (dealt.includes('Search For Life')) {
          playerId = players[0].id;
        }
      }
      expect(playerId, 'a deal containing Search For Life').not.toBe('');
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800); // deal cinematic settle

      // ── The start wizard, step by explicit step. ────────────────────────
      const startScene = page.locator('.con-start__frame');
      await page.waitForSelector('.con-start__frame .con-cards__slot', {timeout: 25_000});
      // Pick a corporation WITHOUT a mandatory first action (it would gate
      // the whole turn behind its confirm) and WITHOUT alternative payment
      // resources (Helion's heat-as-M€ turns the action's 1 M€ into a full
      // payment prompt) — different scenarios than the one under test.
      const corpWithFirstAction = new Set(['Inventrix', 'Tharsis Republic', 'CrediCor', 'United Nations Mars Initiative', 'Helion']);
      for (let step = 0; step < 12; step++) {
        const focusedCorp = await page.locator('.con-start__frame .con-cards__slot[class*="--focused"]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedCorp !== null && !corpWithFirstAction.has(focusedCorp)) {
          break;
        }
        await key(page, 'ArrowRight', 240);
      }
      // Corp pick with a confirmation retry: on the 4K profile the scene's
      // first frames render long — an Enter landing before the scene accepts
      // input is silently dropped, so verify the «Выбрано 1» tally (or the
      // projects step already showing) and re-press when needed.
      const searchSlot = page.locator('.con-cards__slot[data-zoom-slot="Search For Life"]');
      for (let tries = 0; tries < 4; tries++) {
        await key(page, 'Enter', 1400);
        const picked = await page.locator('.con-start__frame', {hasText: 'Выбрано 1'}).count() > 0;
        if (picked || await searchSlot.count() > 0) {
          break;
        }
      }
      // Reach step 2 (projects): RT forward until the Search slot renders; if
      // the walk overshot to the summary («Вы не покупаете…»), LT back.
      for (let hop = 0; hop < 5 && await searchSlot.count() === 0; hop++) {
        const onSummary = await page.locator('.con-start__frame', {hasText: 'Сводка'}).count() > 0;
        await key(page, onSummary ? 'Comma' : 'Period', 1400);
      }
      await searchSlot.waitFor({timeout: 8000});
      for (let step = 0; step < 40; step++) {
        const focused = await page.locator('.con-cards__slot[data-zoom-slot="Search For Life"][class*="--focused"]').count() > 0;
        if (focused) {
          break;
        }
        // The grid focus wraps across rows on Right — a pure sweep reaches
        // every slot in DOM order.
        await key(page, 'ArrowRight', 230);
      }
      expect(await page.locator('.con-cards__slot[data-zoom-slot="Search For Life"][class*="--focused"]').count(),
        'the focus must reach Search For Life').toBeGreaterThan(0);
      // Toggle-buy with verification: the slot must actually flip to
      // --picked (an Enter landing on a busy frame is silently dropped).
      const pickedSearch = page.locator('.con-cards__slot[data-zoom-slot="Search For Life"][class*="--picked"]');
      for (let tries = 0; tries < 3 && await pickedSearch.count() === 0; tries++) {
        await key(page, 'Enter', 700);
      }
      expect(await pickedSearch.count(), 'Search For Life must be picked').toBeGreaterThan(0);
      await key(page, 'Period', 1400); // RT → next step
      // Remaining steps (summary launches on Enter).
      for (let i = 0; i < 10 && await startScene.count() > 0; i++) {
        await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
      }
      await page.waitForSelector('.con-start__frame', {state: 'detached', timeout: 30_000});
      // The start SEQUENCE follows (play the corp, pay for the bought cards) —
      // press A while its scene asks, until the turn status chip reads
      // «ДЕЙСТВИЕ» (the action menu is live).
      const turnChip = page.locator('.con-status', {hasText: 'ДЕЙСТВИЕ'});
      for (let i = 0; i < 12 && await turnChip.count() === 0; i++) {
        if (await page.locator('.con-start').count() > 0) {
          await key(page, 'Enter', 1300);
        } else {
          await page.waitForTimeout(1000);
        }
      }
      await expect(turnChip).toHaveCount(1, {timeout: 20_000});
      await page.waitForTimeout(4000); // intake / delivery settle

      // ── 1. The RT wheel: open (no private backdrop, shared shade ON). ───
      await key(page, 'Period', 600);
      await expect(page.locator('.con-quick')).toHaveCount(1);
      expect(await page.locator('.con-quick__backdrop').count(), 'the wheel has no private backdrop').toBe(0);
      await expect(page.locator('.con-shade--on')).toHaveCount(1);
      await shoot(page, `${profile.tag}-01-rt-wheel-open`);
      // Dismiss (B): the wheel leaves through the director; the shade lets go.
      await key(page, 'Escape', 700);
      await expect(page.locator('.con-quick')).toHaveCount(0);
      await expect(page.locator('.con-shade--on')).toHaveCount(0);

      // ── 2. The LT wheel → Standard Projects handoff: the shade must stay
      // ON through the whole swap (the anti-blink probe samples it live). ──
      await key(page, 'Comma', 600);
      await expect(page.locator('.con-quick')).toHaveCount(1);
      await page.keyboard.press('Enter'); // center slot = Standard Projects
      const handoffShade = await sampleShadeContinuity(page, 8, 45);
      expect(handoffShade.every(Boolean), `shade blinked during wheel→stdp handoff: ${handoffShade}`).toBeTruthy();
      await expect(page.locator('.con-stdp')).toHaveCount(1);
      expect(await page.locator('.con-stdp__backdrop').count(), 'std-projects has no private backdrop').toBe(0);
      await shoot(page, `${profile.tag}-02-stdp-after-wheel-handoff`);
      await key(page, 'Escape', 700);
      await expect(page.locator('.con-stdp')).toHaveCount(0);

      // ── 2b. WORKSPACE section exit — the planet must NOT rescale. Open
      // the Hydronetwork (RT wheel → ← slot), close with B, and sample
      // --board-scale through the whole exit: the frozen leaver dissolves
      // OVER a full-size board, so the stored scale never wobbles (the
      // regression: the planet mounted half-width, then jumped to size
      // while the departing screen flashed squeezed on the right).
      const boardScale = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--board-scale'));
      const baseScale = await boardScale();
      expect(baseScale, 'the board scale must be set on the board home').not.toBe('');
      await key(page, 'Period', 600); // RT wheel
      await key(page, 'ArrowLeft', 1000); // ← slot = Hydronetwork
      await expect(page.locator('.con-hydro')).toHaveCount(1);
      await page.keyboard.press('Escape'); // B → close → board
      const scaleSamples: string[] = [];
      for (let i = 0; i < 10; i++) {
        scaleSamples.push(await boardScale());
        await page.waitForTimeout(45);
      }
      expect(scaleSamples.every((s2) => s2 === baseScale),
        `--board-scale wobbled through the section exit: [${scaleSamples.join(', ')}] vs ${baseScale}`).toBeTruthy();
      await expect(page.locator('.con-hydro')).toHaveCount(0);
      await shoot(page, `${profile.tag}-02b-board-after-hydro-exit`);

      // ── 3. Play Search For Life from hand (RT → center = КАРТЫ). ────────
      await key(page, 'Period', 600);
      await key(page, 'Enter', 1600); // hand reveal choreography
      await expect(page.locator('.con-hand [data-zoom-slot="Search For Life"]')).toBeVisible({timeout: 10_000});
      for (let step = 0; step < 12; step++) {
        const focusedName = await page.locator('.con-hand .con-hand__slot--selected[data-zoom-slot]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedName === 'Search For Life') {
          break;
        }
        await key(page, 'ArrowRight', 260);
      }
      await key(page, 'Enter', 900); // open the play composer
      // Confirm the play (adaptive: press A until the composer is gone).
      for (let i = 0; i < 5 && await page.locator('.con-composer--play, .con-play').count() > 0; i++) {
        await key(page, 'Enter', 900);
      }
      await page.waitForTimeout(4200); // played-hero scene settles, card lands

      // ── 4. The blue-card action: RT → ↑ (card actions) → composer.
      // Verified entry (a press on a busy 4K frame is silently dropped). ───
      for (let tries = 0; tries < 4 && await page.locator('.con-cardactions').count() === 0; tries++) {
        await key(page, 'Period', 700);
        await key(page, 'ArrowUp', 1200);
      }
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 10_000});
      expect(await page.locator('.con-cardactions__backdrop').count(), 'action center has no private backdrop').toBe(0);
      await key(page, 'Enter', 800); // open the composer for Search For Life
      await expect(page.locator('.con-composer')).toHaveCount(1);
      expect(await page.locator('.con-composer__backdrop').count(), 'action composer has no private backdrop').toBe(0);
      await expect(page.locator('.con-composer [data-motion-anchor="card:Search For Life"]')).toHaveCount(1);
      await expect(page.locator('.con-shade--on')).toHaveCount(1);
      await shoot(page, `${profile.tag}-03-action-composer-confirm`);

      // ── 5. Confirm → the IN-FRAME reveal phase: the ACTION FOCUS stage
      // STAYS («Действия карт › Результат вскрытия») — the deck flight +
      // flip present the outcome in the SAME frame, the standalone reveal
      // overlay never mounts for the claimed reveal, and the shade cannot
      // blink (the center owns it through the whole operation).
      await page.keyboard.press('Enter');
      const phaseShade = await sampleShadeContinuity(page, 10, 45);
      expect(phaseShade.every(Boolean), `shade blinked during confirm→reveal: ${phaseShade}`).toBeTruthy();
      await expect(page.locator('.con-composer--stage .con-composer__revealzone')).toHaveCount(1, {timeout: 10_000});
      expect(await page.locator('.con-reveal').count(), 'no standalone overlay for the claimed reveal').toBe(0);
      // The source-card anchor never left the stage (the hero column holds).
      await expect(page.locator('.con-composer--stage [data-motion-anchor="card:Search For Life"]')).toHaveCount(1);
      // The outcome settles (deck flight + the in-place flip). The longer
      // beat lets the status → verdict crossfade finish even on a heavy 4K
      // frame, so the screenshot always carries the verdict pill.
      await expect(page.locator('.con-composer__revealoutcome')).toHaveCount(1, {timeout: 10_000});
      await page.waitForTimeout(900);
      await shoot(page, `${profile.tag}-04-reveal-result`);

      // ── 6. OK returns to the REFRESHED browse grid (semantic commit:
      // never back to a re-confirmable state); B then closes the center and
      // the shade lets go once the band is empty. ─────────────────────────
      await key(page, 'Enter', 800);
      await expect(page.locator('.con-composer--stage')).toHaveCount(0);
      await expect(page.locator('.con-cardactions')).toHaveCount(1);
      await key(page, 'Escape', 800);
      await expect(page.locator('.con-cardactions')).toHaveCount(0);
      await page.waitForTimeout(600);
      await expect(page.locator('.con-shade--on')).toHaveCount(0);
      await shoot(page, `${profile.tag}-05-back-to-board`);
    });
  });
}
