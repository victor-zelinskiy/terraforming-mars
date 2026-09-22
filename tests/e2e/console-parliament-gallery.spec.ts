import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, bootFixtureSeats, closeZoomViewer, openCardActions, openMandatoryAnnounce, openZoomViewer, placeTile, press, pressUntil, settle} from './consoleStart';
import {
  answerAsksAs, answerGateAs, expectInspectorFooterWhole, expectParliamentFits, expectRailHonest, focusParliamentZone, mandatoryPlate, openParliament,
  parliament, PARLIAMENT_PRESETS, ParliamentPreset, parliamentWire, sittingStage, sittingStep, waitSittingAtRest,
} from './parliamentDrive';

/*
 * THE PARLIAMENT GALLERY — Э8 (docs/TURMOIL_REDUX_PARLIAMENT_FINISH.md § Э8):
 * every Parliament surface, on every display profile (1080 · TV 4K · Deck
 * handheld), in every motion mode ({standard, reduced}), photographed into
 * screenshots/parliament-final/<preset>/<mode>/NN-<surface>.png — and on every
 * pose the same three verdicts:
 *   · FITS — nothing off screen, nothing clipped, no scroll container
 *     (`expectParliamentFits`);
 *   · PAINT BASELINE — no element carries a computed `filter` or
 *     `text-shadow` (the console's permanent perf baseline, 2026-08: there is
 *     no perf-lite switch to flip, so the verdict rides every standard pose);
 *   · REDUCED — under `prefers-reduced-motion` no flight proxy is ever on
 *     stage and no parliament hold stands longer than 2 s: the same objects,
 *     the same A, the poses simply arrive.
 *
 * The probes are `MutationObserver` + `setInterval`, never rAF.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-final');
/**
 * The three modes: standard · reduced motion (OS `prefers-reduced-motion`,
 * emulated) · fx-lite («Reduced graphics effects» — `tm_console_fx_lite`,
 * the surviving opt-in tier that stops the ambient loops; the old perf-lite
 * became the permanent paint baseline in 2026-08).
 */
const MODES = ['standard', 'reduced', 'fx-lite'] as const;
type Mode = typeof MODES[number];

/**
 * The reduced sampler, on every mutation and every 50 ms: the PARLIAMENT's own
 * flight proxies (its flight layer, the reward chips, the Agenda cover — all
 * SKIPPED under reduced motion, so they must never appear), the SHARED deal
 * proxies a hosted step still spawns (the take's deal rides the console-wide
 * 160 ms cap, not a skip — allowed, but never for longer than a pose may take),
 * and the parliament holds.
 */
type ReducedSample = {t: number, proxies: number, deals: number, holds: Array<string>};
type ReducedProbe = {samples: Array<ReducedSample>};

async function shoot(page: Page, preset: string, mode: Mode, nn: string, surface: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset, mode);
  fs.mkdirSync(dir, {recursive: true});
  // Every image DECODED before the frame (P-31: the Deck's six-card picker was shot with three black art
  // windows — `img.complete` is not painted). Bounded: a broken image never holds the gallery.
  await page.evaluate(() => Promise.race([
    Promise.all(Array.from(document.images).filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.decode().catch(() => undefined))),
    new Promise<void>((resolve) => window.setTimeout(resolve, 4000)),
  ]));
  await page.screenshot({path: path.join(dir, `${nn}-${surface}.png`)});
}

/**
 * THE PAINT BASELINE VERDICT: no element under `roots` (or the whole
 * document when none is given) resolves a `filter` or a `text-shadow` —
 * the state cues must ride box-shadow / outline / colour. Reports the
 * offenders by their first class.
 */
async function expectPaintBaseline(page: Page, label: string, roots = ['.con-parl', '.con-sit', 'dialog.con-zoom[open]', '.con-mandatory', '.con-journal', '.con-cmdbar']): Promise<void> {
  const offenders = await page.evaluate((sel) => {
    const out: Array<string> = [];
    const scopes = sel.map((s) => document.querySelector(s)).filter((el): el is Element => el !== null);
    for (const scope of scopes) {
      for (const el of [scope, ...Array.from(scope.querySelectorAll('*'))]) {
        const cs = getComputedStyle(el);
        if (cs.filter !== 'none' || cs.textShadow !== 'none') {
          out.push(`${el.className.toString().split(' ')[0] || el.tagName.toLowerCase()} filter=${cs.filter} text-shadow=${cs.textShadow}`);
        }
        if (out.length > 12) {
          return out;
        }
      }
    }
    return out;
  }, roots);
  expect(offenders, `${label}: the paint baseline holds (no filter / text-shadow)`).toEqual([]);
}

async function armReducedProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__reducedProbe: ReducedProbe, __conReady?: () => {holds: Array<string>}};
    w.__reducedProbe = {samples: []};
    const sample = () => {
      w.__reducedProbe.samples.push({
        t: performance.now(),
        proxies: document.querySelectorAll('.con-parl__flight:not([data-parl-flight^="sit-park"]), .con-transfer__chip, .con-bonusfly-proxy').length,
        deals: document.querySelectorAll('.con-deckpick-fly .con-deal-proxy, .con-handdelivery-layer .con-deal-proxy, .con-deckdraw-proxy').length,
        holds: (w.__conReady?.().holds ?? []).filter((h) => h.startsWith('parliament') || h.startsWith('resource-transfer')),
      });
      if (w.__reducedProbe.samples.length > 12000) {
        w.__reducedProbe.samples.splice(0, 3000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage']});
    window.setInterval(sample, 50);
  });
}

/**
 * REDUCED verdict: no proxy ever, no parliament hold longer than `maxHoldMs`.
 *
 * ⚠ REDUCED MOTION REMOVES MOTION, NOT READING TIME («Заседание v4»). The reward page of a resolution that pays
 * nothing carries the ONE sentence that says what the enactment leaves behind, and that page dwells on purpose —
 * under reduced motion too, where there is no beat to spend. So its hold has a bound of its own: still bounded,
 * still far under the stage ceiling, and every OTHER hold keeps the strict 2 s.
 */
const READING_HOLDS: Record<string, number> = {'parliament-sitting:reward[blocking]': 2600};

async function expectReducedQuiet(page: Page, label: string, maxHoldMs = 2000): Promise<void> {
  const probe = await page.evaluate(() => (window as unknown as {__reducedProbe: ReducedProbe}).__reducedProbe);
  const s = probe.samples;
  expect(s.length, `${label}: the reduced sampler ran`).toBeGreaterThan(5);
  const withProxies = s.filter((x) => x.proxies > 0);
  expect(withProxies.length, `${label}: no parliament flight proxy under reduced motion (${withProxies.length} samples had one)`).toBe(0);
  // Every hold's longest continuous stand — and the shared deal's longest continuous stretch, as one more «hold».
  const longest = new Map<string, number>();
  const since = new Map<string, number>();
  for (const x of s) {
    const standing = [...x.holds, ...(x.deals > 0 ? ['shared-deal-proxies'] : [])];
    for (const h of standing) {
      if (!since.has(h)) {
        since.set(h, x.t);
      }
    }
    for (const [h, t0] of Array.from(since.entries())) {
      if (!standing.includes(h)) {
        longest.set(h, Math.max(longest.get(h) ?? 0, x.t - t0));
        since.delete(h);
      }
    }
  }
  const last = s[s.length - 1];
  for (const [h, t0] of Array.from(since.entries())) {
    longest.set(h, Math.max(longest.get(h) ?? 0, last.t - t0));
  }
  const over = Array.from(longest.entries()).filter(([h, ms]) => ms > (READING_HOLDS[h] ?? maxHoldMs)).map(([h, ms]) => `${h} ${Math.round(ms)} ms`);
  expect(over, `${label}: no parliament hold stands longer than ${maxHoldMs} ms under reduced motion`).toEqual([]);
}

/**
 * FX-LITE verdict: the root carries the class, and no INFINITE animation runs
 * under the parliament roots (the ambient loops are what the tier stops; a
 * one-shot feedback animation is allowed and simply ends).
 */
async function expectFxLiteQuiet(page: Page, label: string, roots = ['.con-parl', '.con-sit', 'dialog.con-zoom[open]', '.con-mandatory']): Promise<void> {
  const verdict = await page.evaluate((sel) => {
    const on = document.documentElement.classList.contains('con-fx-lite');
    const scopes = sel.map((s) => document.querySelector(s)).filter((el): el is Element => el !== null);
    const loops: Array<string> = [];
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
      if (target === null || target === undefined || !scopes.some((s) => s.contains(target))) {
        continue;
      }
      const timing = (a.effect as KeyframeEffect).getTiming();
      if (timing.iterations === Infinity) {
        loops.push(`${target.className.toString().split(' ')[0] || target.tagName.toLowerCase()} ${(a as CSSAnimation).animationName ?? ''}`);
      }
    }
    return {on, loops};
  }, roots);
  expect(verdict.on, `${label}: html.con-fx-lite stands`).toBe(true);
  expect(verdict.loops, `${label}: no ambient (infinite) animation under fx-lite`).toEqual([]);
}

/** The pose's verdicts + the photograph. `root` is the chassis the fit probe measures (the parliament, the plate, the inspect dialog). */
/**
 * The draw rail's HIERARCHY under width pressure (`console_extdraw.less` § THE
 * STATUS RAIL BUDGET): the availability note may lose text only once the cause
 * has given everything down to its minimum — a rail that trims every member a
 * little reads as three fragments, none of them the fact the player needs.
 */
async function expectDrawRailHierarchy(page: Page, label: string): Promise<void> {
  const state = await page.evaluate(() => {
    const cut = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      return el === null ? undefined : el.scrollWidth > el.clientWidth + 1;
    };
    const cause = document.querySelector<HTMLElement>('.con-extdraw__status-cause');
    const causeAtMin = cause === null ? undefined : cause.clientWidth <= parseFloat(getComputedStyle(cause).minWidth) + 1;
    return {
      cause: cut('.con-extdraw__status-cause'), causeAtMin,
      title: cut('.con-extdraw__status .con-cardavail__title'), text: cut('.con-extdraw__status .con-cardavail__text'),
    };
  });
  if (state.title === true || state.text === true) {
    expect(state.causeAtMin, `${label}: the availability note lost text while the cause still had width to give ${JSON.stringify(state)}`).toBe(true);
  }
  if (state.text === true) {
    expect(state.title, `${label}: the note's fact was trimmed before its title ${JSON.stringify(state)}`).toBe(true);
  }
}

async function pose(page: Page, preset: ParliamentPreset, mode: Mode, nn: string, surface: string, root = '.con-parl'): Promise<void> {
  await settle(page, {timeoutMs: 30_000});
  const label = `${preset.id}/${mode} ${surface}`;
  await expectParliamentFits(page, label, root);
  await expectPaintBaseline(page, label);
  if (mode === 'fx-lite') {
    await expectFxLiteQuiet(page, label);
  }
  await shoot(page, preset.id, mode, nn, surface);
}

const seatsByPage = new WeakMap<Page, {playerId: string, seats: ReadonlyArray<string>}>();
function rememberSeats(page: Page, booted: {playerId: string, seats: ReadonlyArray<string>}): void {
  seatsByPage.set(page, booted);
}
async function bootedSeats(page: Page): Promise<{playerId: string, seats: ReadonlyArray<string>}> {
  const booted = seatsByPage.get(page);
  if (booted === undefined) {
    throw new Error('no booted seats for this page');
  }
  return booted;
}

async function bootFor(page: Page, request: Parameters<typeof bootFixtureSeats>[1], preset: ParliamentPreset, mode: Mode, fixture: Parameters<typeof bootFixtureSeats>[2], landing: 'board' | 'prompt') {
  if (mode === 'reduced') {
    await page.emulateMedia({reducedMotion: 'reduce'});
  }
  if (mode === 'fx-lite') {
    // Read at bootstrap (main.ts → applyConsoleFxLiteClass) — must precede the navigation.
    await page.addInitScript(() => window.localStorage.setItem('tm_console_fx_lite', '1'));
  }
  const seats = await bootFixtureSeats(page, request, fixture, {query: preset.query, landing});
  if (mode === 'reduced') {
    await armReducedProbe(page);
  }
  return seats;
}

for (const preset of PARLIAMENT_PRESETS) {
  for (const mode of MODES) {
    test.describe(`parliament gallery (${preset.id} · ${mode})`, () => {
      test.use({viewport: preset.viewport});

      test('the SITTING: announce → verdict → enactment → reward (wave · take · source inspect) → results', async ({page, request}) => {
        test.setTimeout(420_000);
        const {playerId, seats} = await bootFor(page, request, preset, mode, 'parliament-climate-assembly', 'prompt');
        const red = seats[1];
        await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
        await pose(page, preset, mode, '10', 'sitting-announce', '.con-mandatory');
        expect(await openMandatoryAnnounce(page)).toBe(true);
        await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
        await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
        await waitSittingAtRest(page, 30_000);
        await pose(page, preset, mode, '11', 'sitting-verdict');
        await waitSittingAtRest(page, 30_000);
        await waitSittingAtRest(page, 30_000);
        // A on the last reward page answers the assembly gate — act → verify → retry (a blind press was swallowed once under reduced motion).
        expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined, {tries: 4, settleMs: 1500}),
          'A answers the assembly gate').toBe(true);
        await pose(page, preset, mode, '14', 'sitting-verdict-gate-wait');
        await answerGateAs(request, red, 'assembly');
        await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take stands').toHaveCount(1, {timeout: 40_000});
        await waitSittingAtRest(page, 30_000);
        await expectRailHonest(page, `${preset.id}/${mode} take rail`, '.con-extdraw__status');
        await expectDrawRailHierarchy(page, `${preset.id}/${mode} take rail`);
        await pose(page, preset, mode, '15', 'sitting-reward-take');
        await press(page, 'KeyC', 1200);
        await expect(page.locator('dialog.con-zoom[open].con-zoom--parliament')).toHaveCount(1, {timeout: 10_000});
        await pose(page, preset, mode, '16', 'resolution-inspect-source', 'dialog.con-zoom[open]');
        await press(page, 'Escape', 1200);
        await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(0, {timeout: 10_000});
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-extdraw').count() === 0, {tries: 8, settleMs: 2200}), 'the cards are taken').toBe(true);
        await settle(page, {timeoutMs: 30_000});
        await expect.poll(() => sittingStep(page), {timeout: 20_000}).toMatch(/received|waiting/);
        await pose(page, preset, mode, '17', 'sitting-reward-received');
        await answerAsksAs(request, red);
        // «Обновление»: the renewal is a page of its own (the tact on the table), then the results card; A on it answers gate 2.
        await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('renewal');
        await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
        await waitSittingAtRest(page, 30_000);
        await pose(page, preset, mode, '18', 'sitting-results');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} sitting`);
        }
      });

      test('the REWARD variants: the pick (choice), the waiting line, the winner tile (placement) and the skip plate', async ({page, request}) => {
        test.setTimeout(420_000);
        const {playerId, seats} = await bootFor(page, request, preset, mode, 'parliament-aquifer-assembly', 'prompt');
        const red = seats[1];
        await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
        expect(await openMandatoryAnnounce(page)).toBe(true);
        await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
        await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
        await waitSittingAtRest(page, 30_000);
        await waitSittingAtRest(page, 30_000);
        // A on the last reward page answers the assembly gate — act → verify → retry (a blind press was swallowed once under reduced motion).
        expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined, {tries: 4, settleMs: 1500}),
          'A answers the assembly gate').toBe(true);
        await answerGateAs(request, red, 'assembly');
        await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-task'), 'the pick stands').toHaveCount(1, {timeout: 40_000});
        await waitSittingAtRest(page, 30_000);
        await pose(page, preset, mode, '20', 'sitting-reward-pick');
        await press(page, 'Enter', 1500);
        await expect.poll(async () => {
          const wire = await parliamentWire(request, playerId);
          return (wire.game.parliament?.phase?.outcomes ?? []).some((o) => o.player === wire.thisPlayer.color && o.kind === 'cardResource');
        }, {timeout: 30_000}).toBe(true);
        // The winner's tile (v2): the reward page stops on the DOOR — «К полю» — and only the press takes the board.
        await expect.poll(() => sittingStep(page), {timeout: 40_000}).toBe('placement');
        await pose(page, preset, mode, '21', 'sitting-reward-door');
        await press(page, 'Enter', 800);
        await expect.poll(() => page.evaluate(() => document.querySelector('.con-board--placing, .con-board--locked') !== null), {timeout: 40_000}).toBe(true);
        await settle(page, {timeoutMs: 30_000});
        await shoot(page, preset.id, mode, '21b', 'sitting-reward-placement-board');
        expect(await placeTile(page)).toBe(true);
        await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
        await waitSittingAtRest(page, 30_000);
        const redWire = await parliamentWire(request, red);
        if (redWire.waitingFor?.type === 'card') {
          await expect.poll(() => sittingStep(page), {timeout: 20_000}).toBe('waiting');
          await pose(page, preset, mode, '22', 'sitting-reward-waiting');
          await answerAsksAs(request, red);
        }
        await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} reward variants`);
        }
      });

      test('the OVERVIEW: the three zones, the party inspect, the vote mode and the resolution inspect, the journal group, the Info strip', async ({page, request}) => {
        test.setTimeout(420_000);
        if (mode === 'reduced') {
          await page.emulateMedia({reducedMotion: 'reduce'});
        }
        if (mode === 'fx-lite') {
          await page.addInitScript(() => window.localStorage.setItem('tm_console_fx_lite', '1'));
        }
        await bootFixture(page, request, 'parliament', {query: preset.query});
        if (mode === 'reduced') {
          await armReducedProbe(page);
        }
        await openParliament(page);
        await focusParliamentZone(page, 'ruler');
        await pose(page, preset, mode, '01', 'overview-ruler');
        await focusParliamentZone(page, 'voting');
        await pose(page, preset, mode, '02', 'overview-voting');
        await focusParliamentZone(page, 'parties');
        await pose(page, preset, mode, '03', 'overview-parties');
        // The PARTY inspect (X on a plaque).
        await openZoomViewer(page);
        await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 15_000});
        await pose(page, preset, mode, '04', 'party-inspect', 'dialog.con-zoom[open]');
        await closeZoomViewer(page);
        // The VOTE mode (A on the voting area) and the resolution inspect from inside it.
        await focusParliamentZone(page, 'voting');
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'A opens the vote mode').toBe(true);
        await waitSittingAtRest(page, 20_000);
        await pose(page, preset, mode, '05', 'vote-mode');
        await openZoomViewer(page);
        await expect(page.locator('dialog.con-zoom[open].con-zoom--parliament')).toHaveCount(1, {timeout: 15_000});
        await pose(page, preset, mode, '06', 'resolution-inspect', 'dialog.con-zoom[open]');
        await closeZoomViewer(page);
        expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-parl__vote--up').count() === 0, {tries: 4, settleMs: 900}), 'B leaves the vote mode').toBe(true);
        expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900}), 'B closes the Parliament').toBe(true);
        if (mode === 'reduced') {
          // The reduced verdict for the Parliament half — the second boot below starts a new document (and a new probe).
          await expectReducedQuiet(page, `${preset.id} overview`);
        }
        // The JOURNAL: a whole sitting's group — the recap table (the political phase ran in generation 1; LT steps back).
        await bootFixture(page, request, 'parliament-recap', {query: preset.query});
        if (mode === 'reduced') {
          await armReducedProbe(page);
        }
        await press(page, 'KeyR', 1200);
        const journal = page.locator('.con-journal');
        await expect(journal).toBeVisible({timeout: 10_000});
        expect(await pressUntil(page, 'Comma', async () => /парламент/i.test(await journal.textContent() ?? ''), {tries: 4, settleMs: 900}), 'the journal holds parliament lines').toBe(true);
        await settle(page, {timeoutMs: 20_000});
        await expectPaintBaseline(page, `${preset.id}/${mode} journal`, ['.con-journal']);
        await shoot(page, preset.id, mode, '07', 'journal-group');
        await press(page, 'Escape', 800);
        // The INFO strip: Information → the effects zone → the party-effects strip.
        const infoRoot = page.locator('.con-info');
        for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
          if (i > 0) {
            await press(page, 'Enter', 700);
            await press(page, 'Escape', 500);
          }
          await press(page, 'KeyY', 1100);
        }
        await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
        const effectsFocused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
        for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
          if (await effectsFocused() > 0) {
            break;
          }
          await press(page, move, 300);
        }
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
        await expect(page.locator('.con-pfx'), 'the Parliament strip stands in the explorer').toHaveCount(1, {timeout: 10_000});
        await settle(page, {timeoutMs: 20_000});
        // The strip is a BAND above the explorer, and the explorer's columns keep the screen (registry R-31: as a
        // row sibling the strip pushed the dossier column past the Deck's right edge and stood as a half-empty
        // plate down the left of 1080).
        const infoLayout = await page.evaluate(() => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const out: Array<string> = [];
          const strip = document.querySelector<HTMLElement>('.con-pfx');
          const efx = document.querySelector<HTMLElement>('.con-efx');
          if (strip !== null && efx !== null) {
            const s = strip.getBoundingClientRect();
            const e = efx.getBoundingClientRect();
            if (s.bottom > e.top + 1) {
              out.push(`the strip is not above the explorer (strip bottom ${Math.round(s.bottom)}, explorer top ${Math.round(e.top)})`);
            }
          }
          for (const sel of ['.con-pfx', '.con-pfx__item', '.con-efx__filters', '.con-efx__body', '.con-efx__detail']) {
            for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) {
                continue;
              }
              if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
                out.push(`off-screen ${sel} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)} (viewport ${vw}×${vh})`);
              }
            }
          }
          return out;
        });
        expect(infoLayout, `${preset.id}/${mode} info strip: the strip is a band above the explorer and every column is on screen`).toEqual([]);
        await expectPaintBaseline(page, `${preset.id}/${mode} info strip`, ['.con-info']);
        await shoot(page, preset.id, mode, '08', 'info-parliament-strip');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} journal + info`);
        }
      });

      test('the PICK on SIX candidates (the recipient picker with six animal holders)', async ({page, request}) => {
        test.setTimeout(300_000);
        const {playerId, seats} = await bootFor(page, request, preset, mode, 'parliament-aquifer-assembly-six', 'prompt');
        const red = seats[1];
        await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
        expect(await openMandatoryAnnounce(page)).toBe(true);
        await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
        await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
        await waitSittingAtRest(page, 30_000);
        await waitSittingAtRest(page, 30_000);
        // A on the last reward page answers the assembly gate — act → verify → retry (a blind press was swallowed once under reduced motion).
        expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined, {tries: 4, settleMs: 1500}),
          'A answers the assembly gate').toBe(true);
        await answerGateAs(request, red, 'assembly');
        await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-task'), 'the pick stands').toHaveCount(1, {timeout: 40_000});
        await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-task .con-cards__slot'), 'six candidates').toHaveCount(6, {timeout: 20_000});
        await waitSittingAtRest(page, 30_000);
        await pose(page, preset, mode, '20b', 'sitting-reward-pick-six');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} pick six`);
        }
      });

      test('the PAYMENT inside the vote mode (a paid delegate)', async ({page, request}) => {
        test.setTimeout(300_000);
        // The stack's opt-in verb trace: a frame that vanishes names the verb and its caller.
        const wsTrace: Array<string> = [];
        await page.addInitScript(() => {
          (window as unknown as {__wsTrace: boolean}).__wsTrace = true;
        });
        page.on('console', (msg) => {
          if (msg.text().startsWith('[ws-stack]')) {
            wsTrace.push(msg.text().split('\n').slice(0, 9).join(' ⏎ '));
          }
        });
        const booted = await bootFor(page, request, preset, mode, 'parliament-paid', 'board');
        rememberSeats(page, booted);
        await openParliament(page);
        await focusParliamentZone(page, 'voting');
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'A opens the vote mode').toBe(true);
        await waitSittingAtRest(page, 20_000);
        await pose(page, preset, mode, '09', 'vote-mode-paid');
        const {playerId} = await bootedSeats(page);
        await press(page, 'Enter', 1500);
        const bill = page.locator('.con-parl__vote [data-embed-slot="parliament-vote"] .con-task-host--embedded');
        await expect.poll(async () => await bill.count(), {timeout: 20_000, message: 'the bill stands inside the mode'}).toBe(1).catch(async (e: unknown) => {
          const wire = await parliamentWire(request, playerId);
          const diag = await page.evaluate(() => {
            const w = window as unknown as {__conReady: () => unknown};
            return {
              ready: w.__conReady(),
              parl: document.querySelector('.con-parl')?.getAttribute('data-stage') ?? 'NO .con-parl',
              stranded: document.querySelector('.con-stranded')?.textContent?.trim().slice(0, 120) ?? '',
              zone: document.querySelector('[data-embed-slot="parliament-vote"]') !== null,
              hosts: Array.from(document.querySelectorAll('.con-task-host')).map((el) => el.className).join(' | '),
            };
          });
          throw new Error(`${String(e)}\nwire.waitingFor=${JSON.stringify(wire.waitingFor)}\ndiag=${JSON.stringify(diag)}\nws-trace (last 6):\n${wsTrace.slice(-6).join('\n')}`);
        });
        await pose(page, preset, mode, '09b', 'vote-payment');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} payment`);
        }
      });

      test('the chairman SEAT pick', async ({page, request}) => {
        test.setTimeout(300_000);
        await bootFor(page, request, preset, mode, 'parliament-seat', 'prompt');
        await expect(page.locator('.con-parl__stage[data-parl-stage="seat"]'), 'the seat pick owns the screen').toHaveCount(1, {timeout: 30_000});
        await pose(page, preset, mode, '23', 'seat-pick');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} seat`);
        }
      });

      test('the party-ACTION composer inside «Действия карт»', async ({page, request}) => {
        test.setTimeout(300_000);
        await bootFor(page, request, preset, mode, 'parliament-actions', 'board');
        await openCardActions(page);
        const focusedParty = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-party') ?? '');
        await expect(page.locator('.con-cardactions__tile[data-action-party="Industrialists"]'), 'the Industrialists tile is in the menu').toHaveCount(1, {timeout: 20_000});
        for (let i = 0; i < 16 && await focusedParty() !== 'Industrialists'; i++) {
          const dir = await page.evaluate(() => {
            const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
            const t = document.querySelector('.con-cardactions__tile[data-action-party="Industrialists"]')?.getBoundingClientRect();
            if (f === undefined || t === undefined) {
              return 'ArrowRight';
            }
            const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
            const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
            return Math.abs(dy) > f.height / 2 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
          });
          await press(page, dir, 300);
        }
        expect(await focusedParty(), 'the Industrialists tile is focused').toBe('Industrialists');
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-pact[data-pact="industrialists"]').count() > 0, {tries: 3, settleMs: 1100}), 'A opens the party composer').toBe(true);
        await settle(page, {timeoutMs: 20_000});
        await expectParliamentFits(page, `${preset.id}/${mode} party composer`, '.con-pact');
        await expectPaintBaseline(page, `${preset.id}/${mode} party composer`, ['.con-cardactions', '.con-pact']);
        await shoot(page, preset.id, mode, '24', 'party-action-composer');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} party composer`);
        }
      });

      test('the resolutions PLAYGROUND («Полигон») and its fullscreen inspect', async ({page}) => {
        test.setTimeout(240_000);
        if (mode === 'reduced') {
          await page.emulateMedia({reducedMotion: 'reduce'});
        }
        if (mode === 'fx-lite') {
          await page.addInitScript(() => window.localStorage.setItem('tm_console_fx_lite', '1'));
        }
        await page.goto(`/?resolutionsPlayground${preset.query}`);
        await expect(page.locator('.cm-stand')).toHaveCount(1, {timeout: 30_000});
        await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});
        await settle(page, {timeoutMs: 20_000});
        // The stand is a SCROLLING showcase by design (R3 scrolls, LB/RB step its sections — a dev instrument, not a
        // game screen): the fit verdict is asked of the catalog section that opens the stand, not of the whole scroll.
        await expectParliamentFits(page, `${preset.id}/${mode} playground catalog`, '[data-rxpg-catalog]');
        await expectPaintBaseline(page, `${preset.id}/${mode} playground`, ['.cm-stand']);
        await shoot(page, preset.id, mode, '25', 'playground');
        await press(page, 'KeyX', 1200);
        await expect(page.locator('dialog.con-zoom[open].con-zoom--parliament')).toHaveCount(1, {timeout: 15_000});
        await settle(page, {timeoutMs: 20_000});
        await expectParliamentFits(page, `${preset.id}/${mode} playground inspect`, 'dialog.con-zoom[open]');
        await expectPaintBaseline(page, `${preset.id}/${mode} playground inspect`, ['dialog.con-zoom[open]']);
        await shoot(page, preset.id, mode, '26', 'playground-inspect');
        await press(page, 'Escape', 1000);
      });

      // ── THE FAMILIES REHEARSAL (final polish D.1): the catalog's next families, walked through the whole path on the
      //    dev examples that stand for them — RDX_DEV_PASSIVE (an effect while enacted, no immediate step) and RDX_DEV_ACTION
      //    (a card action while enacted). The vote, the inspect, the sitting's REWARD stage (which has no wave to show and
      //    must still say what the player got — the quiet pose) and the results card (which names it again).
      test('the FAMILIES rehearsal: a passive and an action resolution — the vote, the inspect, the quiet REWARD pose and the results', async ({page, request}) => {
        test.setTimeout(600_000);
        // ── The VOTE on a passive: the face, the panel, the inspect of a card that pays nothing at the enactment.
        await bootFor(page, request, preset, mode, 'parliament-devpassive-vote', 'board');
        await openParliament(page);
        await focusParliamentZone(page, 'voting');
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'A opens the vote mode').toBe(true);
        await waitSittingAtRest(page, 20_000);
        // The panel's reading on a card that pays nothing at the enactment: the quiet reward's kicker, the same words the sitting prints later.
        await expect(page.locator('.con-parl__vote--up [data-parl-kicker="reading"]'), 'the passive reads as an effect while enacted, not a payout')
          .toHaveText(/Эффект, пока принята|Effect while enacted/i, {timeout: 10_000});
        await expect(page.locator('.con-parl__vote--up [data-yield-context]'), 'no reading pretends a payout').toHaveCount(0);
        await pose(page, preset, mode, '31', 'family-passive-vote-mode');
        await openZoomViewer(page);
        await expect(page.locator('dialog.con-zoom[open].con-zoom--parliament')).toHaveCount(1, {timeout: 15_000});
        await expectInspectorFooterWhole(page, `${preset.id}/${mode} family passive inspect`);
        await pose(page, preset, mode, '31b', 'family-passive-inspect', 'dialog.con-zoom[open]');
        await closeZoomViewer(page);
        expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-parl__vote--up').count() === 0, {tries: 4, settleMs: 900}), 'B leaves the vote mode').toBe(true);
        expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900}), 'B closes the Parliament').toBe(true);
        // ── The VOTE on an action: the same panel reads a card whose payout is an action, not a sum.
        await bootFor(page, request, preset, mode, 'parliament-devaction-vote', 'board');
        await openParliament(page);
        await focusParliamentZone(page, 'voting');
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'A opens the vote mode').toBe(true);
        await waitSittingAtRest(page, 20_000);
        await expect(page.locator('.con-parl__vote--up [data-parl-kicker="reading"]'), 'the action reads as an action while enacted, not a payout')
          .toHaveText(/Действие, пока принята|Action while enacted/i, {timeout: 10_000});
        await pose(page, preset, mode, '31c', 'family-action-vote-mode');
        expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-parl__vote--up').count() === 0, {tries: 4, settleMs: 900}), 'B leaves the vote mode').toBe(true);
        expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900}), 'B closes the Parliament').toBe(true);
        // ── The SITTING for each family (v2): the gate → the walk (enactment → the quiet REWARD pose) → the results.
        const families = [
          {kind: 'passive', fixture: 'parliament-devpassive-assembly', nn: '32', kicker: /Эффект, пока принята|Effect while enacted/i},
          {kind: 'action', fixture: 'parliament-devaction-assembly', nn: '33', kicker: /Действие, пока принята|Action while enacted/i},
        ] as const;
        for (const family of families) {
          const {playerId, seats} = await bootFor(page, request, preset, mode, family.fixture, 'prompt');
          const red = seats[1];
          await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
          expect(await openMandatoryAnnounce(page)).toBe(true);
          await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
          await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
          await waitSittingAtRest(page, 30_000);
          await waitSittingAtRest(page, 30_000);
          // v2: A answers gate 1 first; the other seat answers last — the walk plays, and the REWARD page (turned by the
          // director, about a second for a quiet card) carries its quiet pose: no reading pretends a payout; the stage
          // says what OUTLIVES the enactment, and for an action, where it lives. Read in ONE sample the moment it stands.
          expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined, {tries: 4, settleMs: 1500}),
            'A answers the assembly gate').toBe(true);
          await answerGateAs(request, red, 'assembly');
          const seen: {quiet: {kind: string | null, kicker: string, text: string, where: number, contexts: number, part: string} | null} = {quiet: null};
          await expect.poll(async () => {
            // v5: the quiet pose is the BAND's line — it names what OUTLIVES the enactment and, for an action,
            // where it lives. The card's own declaration is NOT repeated: the enacted resolution prints it in
            // the government, one tier up, and the band never says what an object already says itself.
            seen.quiet = await page.evaluate(() => {
              const band = document.querySelector<HTMLElement>('.con-band[data-parl-band-quiet]');
              if (band === null) {
                return null;
              }
              const labels = Array.from(band.querySelectorAll<HTMLElement>('[data-parl-band-chip="label"]')).map((el) => el.textContent?.trim() ?? '');
              return {
                kind: band.getAttribute('data-parl-band-quiet'),
                kicker: labels[0] ?? '',
                text: '',
                where: labels.length - 1,
                contexts: band.querySelectorAll('[data-yield-context]').length,
                part: document.querySelector('[data-parl-enacted-effect] .con-parl__ruler-own-kicker')?.textContent?.trim() ?? '',
              };
            });
            return seen.quiet !== null;
          }, {timeout: 60_000, message: `${family.kind}: the REWARD stage carries its quiet pose`}).toBe(true);
          const q = seen.quiet!;
          expect(q.kind, `${family.kind}: the pose names its kind`).toBe(family.kind);
          expect(q.kicker).toMatch(family.kicker);
          expect(q.contexts, `${family.kind}: no reading pretends a payout`).toBe(0);
          expect(q.where, 'an action names its address, a passive needs none').toBe(family.kind === 'action' ? 1 : 0);
          // v5: there is no declaration under the kicker at all — the band carries no prose, and the card's own
          // wording stands on the enacted face in the government (frames 32–33 of the earlier runs fixed the
          // wording itself; the line that carried it is gone).
          expect(q.text, 'the band prints no prose').toBe('');
          // The government plaque titles the enacted card's graphic by its PART — an action is not an effect (frame 33 of the first run).
          expect(q.part, `${family.kind}: the government names the part`).toMatch(family.kind === 'action' ? /Действие резолюции|Resolution action/i : /Эффект резолюции|Resolution effect/i);
          await shoot(page, preset.id, mode, family.nn, `family-${family.kind}-walk`);
          // Nothing to pay: the adjourn arrives in the same response — the RESULTS card names the family again.
          await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
          await waitSittingAtRest(page, 30_000);
          // v5 §4: a resolution that pays NOBODY replaces the payout rows with what stands instead — never a
          // column of empty rows, and never the viewer's own reward repeated from the band.
          await expect(page.locator('.con-sit [data-sit-payout-quiet]'), `${family.kind}: the results panel names what outlives the payout`).toHaveText(family.kicker);
          await pose(page, preset, mode, `${family.nn}b`, `family-${family.kind}-results`);
        }
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} families`);
        }
      });

      test('the SKIP: the winner\'s greenery with no legal cell — read as a skip before the record, the skip plate after it', async ({page, request}) => {
        test.setTimeout(300_000);
        const {playerId, seats} = await bootFor(page, request, preset, mode, 'parliament-biodome-nocell-assembly', 'prompt');
        const red = seats[1];
        await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
        expect(await openMandatoryAnnounce(page)).toBe(true);
        await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
        await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
        await waitSittingAtRest(page, 30_000);
        await waitSittingAtRest(page, 30_000);
        // A on the last reward page answers the assembly gate — act → verify → retry (a blind press was swallowed once under reduced motion).
        expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined, {tries: 4, settleMs: 1500}),
          'A answers the assembly gate').toBe(true);
        await answerGateAs(request, red, 'assembly');
        // The record arrives with the skip: the plate names the lost tile and its reason. Photographed the moment it stands
        // (the page holds through the plants' wave, then the results enter).
        // v5: a skip names itself with its reason in the reading BAND — the sitting's own surface carries no
        // readings, and law 4 (never a silent loss) is unchanged.
        await expect(page.locator('.con-band__chip--skip'), 'the skip names the lost tile').toHaveCount(1, {timeout: 40_000});
        // THE TABLE UNDER THE PLATE: a card dealt straight back from the reshuffled discard never left — its face
        // stays (P-28: the fresh-face hold hid both cards of the table for the whole read).
        const hiddenFaces = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-parl__slot[data-instance]')).filter((slot) => {
          const face = slot.querySelector<HTMLElement>('.con-parl__card .pcard');
          if (face === null) {
            return true;
          }
          const cs = getComputedStyle(face);
          return face.getBoundingClientRect().height < 2 || cs.visibility === 'hidden' || cs.opacity === '0' || slot.querySelector('.con-parl__card--dealing') !== null;
        }).map((slot) => slot.getAttribute('data-instance')));
        expect(hiddenFaces, `${preset.id}/${mode}: every card on the table keeps its face under the skip plate`).toEqual([]);
        await expectParliamentFits(page, `${preset.id}/${mode} sitting-reward-skip`);
        await expectPaintBaseline(page, `${preset.id}/${mode} sitting-reward-skip`);
        await shoot(page, preset.id, mode, '27b', 'sitting-reward-skip-plate');
        await waitSittingAtRest(page, 30_000);
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} skip`);
        }
      });

      test('the big draw: six owed cards in the stage zone', async ({page, request}) => {
        test.setTimeout(300_000);
        await bootFor(page, request, preset, mode, 'parliament-climate-big', 'prompt');
        await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
        expect(await openMandatoryAnnounce(page)).toBe(true);
        await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded')).toHaveCount(1, {timeout: 30_000});
        await expect(page.locator('.con-extdraw .con-cards__slot')).toHaveCount(6, {timeout: 30_000});
        await waitSittingAtRest(page, 30_000);
        await expectRailHonest(page, `${preset.id}/${mode} big-draw rail`, '.con-extdraw__status');
        await expectDrawRailHierarchy(page, `${preset.id}/${mode} big-draw rail`);
        await pose(page, preset, mode, '28', 'sitting-reward-bigdraw');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} big draw`);
        }
      });

      test('the DENSE table: five seats in the head line', async ({page, request}) => {
        test.setTimeout(300_000);
        if (mode === 'reduced') {
          await page.emulateMedia({reducedMotion: 'reduce'});
        }
        if (mode === 'fx-lite') {
          await page.addInitScript(() => window.localStorage.setItem('tm_console_fx_lite', '1'));
        }
        await bootFixture(page, request, 'parliament-dense', {query: preset.query});
        if (mode === 'reduced') {
          await armReducedProbe(page);
        }
        await openParliament(page);
        // Five players' seats stand in the head line (it also carries the neutral seat).
        await expect.poll(() => page.locator('[data-parl-seats] .con-parl__seat[data-parl-seat]').count(), {timeout: 10_000}).toBeGreaterThanOrEqual(5);
        await pose(page, preset, mode, '29', 'overview-dense-five-seats');
        await focusParliamentZone(page, 'parties');
        await pose(page, preset, mode, '30', 'overview-dense-parties');
        if (mode === 'reduced') {
          await expectReducedQuiet(page, `${preset.id} dense`);
        }
      });
    });
  }
}
