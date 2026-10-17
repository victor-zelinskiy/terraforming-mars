/*
 * «МАРС ТЕРРАФОРМИРОВАН» — THE PLANET SHOWS (TR70's iteration, `docs/claude/console/terraformed-scene.md`).
 *
 * The owner's accent: «wherever the player is, take them to the PLANET ITSELF — the interface steps aside, the real
 * planet comes into focus and shows the ceremony, the text is readable from the couch, it is short, and the player
 * returns exactly where they were». The probe reads the product's own tacts off the DOM (a 100 ms sampler on
 * `setInterval` — never rAF — plus the shell's read-only `__conTerraformedDiag`, which is the only witness of the
 * ARMED wait: that tact paints nothing by design):
 *  (A) from the board home (fhd + tv4k): the rails / the bar / the dock RECEDE by opacity (through intermediate
 *      values — a transition, never a cut; never `display: none`), the camera enters in its `ceremony` mode and
 *      settles, the ARCS stay visible on the focused stage, the HUD keeps the player's last numbers until the SHOW and
 *      reads 100 % after, the title stands as a CAPTION in the zone the player rail vacated (left of the disc — nothing overlapped), whole inside the viewport, every line ≥ the TV floor,
 *      the burst detonates on the real disc, the surfaces return, the stage's box is ONE box in every state, and the
 *      whole phrase (recede → the surfaces back) is ≤ 4.5 s;
 *  (B) over the Information dossier (fhd): the dossier recedes and returns in the SAME snapshot — the crumb and the
 *      focused zone — never unmounted;
 *  (C) over the hand album (fhd + tv4k): the same page and the same card in focus after the scene;
 *  (D) the viewer's OWN placement through the UI onto a two-card cell (fhd + tv4k): the received-cards reveal stands
 *      when the scene arms — the scene WAITS for the take, then plays, then the board home;
 *  (E) a RIVAL finishes the planet (fhd + tv4k): the viewer's page plays the same scene off the poll / WS frame;
 *  (F) a SKIP (fhd): a press after the camera is in ends the show at once — the return plays once, the HUD gold;
 *  (G) the finale's announce after the scene (fhd, PL-290): the prompt arriving mid-scene reaches its plate no later
 *      than the scene's own end + the read beat — the number is printed for the ledger;
 *  (H) reduced motion (fhd): no camera, the title reads, ≤ 1.5 s;
 *  (I) a reload after the scene never replays it;
 *  (J) the surrogate's root (`.con-terracere`) is gone from the product — the liveness guard
 *      (`tests/console/e2eLiveness.spec.ts`) refuses any spec that waits for it, so no check here can name it.
 * Storyboard of (A): `TM_E2E_STORYBOARD=1` → `screenshots/tr70/<profile>/story-scene/`; the 4K timing claim is
 * taken on the GPU (`TM_E2E_GPU=1`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {drive, getModel, terraformed} from './consoleEndgameHarness';
import {
  bootFixtureSeats, cinematicBeat, commitFocusedSpace, focusInfoZone, focusedCard, press, pressUntil, pressUntilGone,
  reloadConsole, settle, walkToSpace,
} from './consoleStart';
import {openHand} from './cardTradeDoor';

const OUT = path.resolve('screenshots', 'tr70');
const PRESETS = [
  // The ≤ 4.5 s claim is taken on the GPU (PL-211); SwiftShader stretches every transition's first frame and two pages
  // of a parallel run share one software compositor — measured 4.3–4.5 s alone, up to 6.1 s at 4K under two workers.
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto', budgetMs: process.env.TM_E2E_GPU === '1' ? 4_600 : 5_400},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', budgetMs: process.env.TM_E2E_GPU === '1' ? 4_600 : 6_800},
] as const;
type Preset = typeof PRESETS[number];
const FHD = PRESETS[0];

type Diag = {phase: string, stage: string, nonce: number, showNonce: number, skipped: boolean, lastEnd: string, up: boolean, parkHeld: boolean, camera: {phase: string, mode: string}};
type Sample = {
  t: number,
  phase: string,
  diag: string,
  root: string,
  board: string,
  stage: string,
  plate: string,
  breath: string,
  burst: number,
  texts: Array<number>,
  hud: string,
  arcs: string,
  arcChild: string,
  rail: string,
  bar: string,
  dock: string,
  info: string,
  hand: string,
  reveal: string,
  anyNone: Array<string>,
};

async function diagOf(page: Page): Promise<Diag> {
  return page.evaluate(() => (window as unknown as {__conTerraformedDiag: () => Diag}).__conTerraformedDiag());
}

/** The 100 ms sampler — `setInterval`, never rAF (headless rAF stops on a quiet screen). */
async function armSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__tfSamples: Array<Sample>, __tfTimer?: number};
    w.__tfSamples = [];
    const t0 = performance.now();
    const op = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el === null) {
        return '-';
      }
      const cs = getComputedStyle(el);
      return cs.display === 'none' ? 'none' : cs.opacity;
    };
    const rect = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el === null) {
        return '-';
      }
      const r = el.getBoundingClientRect();
      return `${Math.round(r.width)}×${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`;
    };
    // The parked surfaces (a section on the board's slot — the hand / the colonies / the hydro — is the scene's one display
    // flip and is asserted by its own walk). A surface already `display: none` BEFORE the scene (the strategy rail under a
    // workspace) is that surface's own policy, not the scene's — the baseline is taken at the arm.
    const RECEDING = ['.con-res-host', '.con-cmdbar', '.con-handdock', '.con-info', '.con-reveal', '.con-strat'];
    const baselineNone = new Set(RECEDING.filter((sel) => op(sel) === 'none'));
    w.__tfTimer = window.setInterval(() => {
      const root = document.querySelector<HTMLElement>('.con-root');
      const board = document.querySelector<HTMLElement>('.con-board');
      const title = document.querySelector<HTMLElement>('.con-terraformed');
      const d = (window as unknown as {__conTerraformedDiag?: () => Diag}).__conTerraformedDiag?.();
      w.__tfSamples.push({
        t: Math.round(performance.now() - t0),
        phase: title?.getAttribute('data-terraformed-phase') ?? '',
        diag: d === undefined ? '-' : `${d.phase}/${d.stage}/${d.parkHeld ? 'held' : 'free'}/${d.camera.phase}:${d.camera.mode}`,
        root: Array.from(root?.classList ?? []).filter((c) => /terraformed/.test(c)).map((c) => c.replace('con-root--', '')).join(' '),
        board: Array.from(board?.classList ?? []).filter((c) => /pfocus/.test(c)).map((c) => c.replace('con-board--', '')).join(' '),
        stage: rect('.con-board__stage'),
        plate: rect('.con-terraformed__plate'),
        breath: rect('[data-terraformed-breath]'),
        burst: document.querySelectorAll('[data-terraformed-breath] .con-ceremony-fx').length,
        texts: title === null ? [] : Array.from(title.querySelectorAll<HTMLElement>('.con-terraformed__kicker, .con-terraformed__name, .con-terraformed__claim'))
          .map((el) => Math.round(parseFloat(getComputedStyle(el).fontSize))),
        hud: (document.querySelector('.con-status__terra')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        arcs: op('.con-board .global-numbers'),
        arcChild: op('.con-board .global-numbers .arc-scale'),
        rail: op('.con-res-host'),
        bar: op('.con-cmdbar'),
        dock: op('.con-handdock'),
        info: op('.con-info'),
        hand: op('.con-hand'),
        reveal: op('.con-reveal'),
        // The law: a parked surface recedes by OPACITY — `display: none` on any of them while the scene is up is the defect.
        anyNone: (root?.classList.contains('con-root--terraformed') ?? false) ? RECEDING.filter((sel) => !baselineNone.has(sel) && op(sel) === 'none') : [],
      });
    }, 100);
  });
}

type Summary = ReturnType<typeof summarize>;
function summarize(samples: Array<Sample>) {
  const firstAt = (pred: (s: Sample) => boolean) => samples.find(pred)?.t;
  const lastAt = (pred: (s: Sample) => boolean) => [...samples].reverse().find(pred)?.t;
  const num = (v: string) => (v === '-' || v === 'none' ? NaN : Number(v));
  const receded = samples.filter((s) => /\bterraformed\b/.test(s.root));
  const settled = samples.filter((s) => /pfocus-settled/.test(s.board) && /pfocus-ceremony/.test(s.board));
  const showing = samples.filter((s) => s.phase === 'show');
  const titled = samples.filter((s) => s.plate !== '-');
  const mid = titled[Math.floor(titled.length / 2)];
  return {
    samples: samples.length,
    armedAt: firstAt((s) => s.diag.startsWith('armed')),
    recedeAt: firstAt((s) => /\bterraformed\b/.test(s.root)),
    focusAt: firstAt((s) => /pfocus-ceremony/.test(s.board)),
    settledAt: firstAt((s) => /pfocus-settled/.test(s.board) && /pfocus-ceremony/.test(s.board)),
    showAt: firstAt((s) => s.phase === 'show'),
    returnAt: firstAt((s) => s.phase === 'return'),
    recededGoneAt: lastAt((s) => /\bterraformed\b/.test(s.root)),
    returningGoneAt: lastAt((s) => /terraformed-returning/.test(s.root)),
    titleGoneAt: lastAt((s) => s.plate !== '-'),
    idleAt: firstAt((s) => s.diag.startsWith('idle') && s.t > (firstAt((x) => /\bterraformed\b/.test(x.root)) ?? 0)),
    stageBoxes: [...new Set(samples.map((s) => s.stage))].filter((b) => b !== '0×0@0,0'),
    hudBefore: samples[0]?.hud,
    hudAtShow: showing[0]?.hud,
    hudAfter: samples[samples.length - 1]?.hud,
    hudWhileHeld: [...new Set(samples.filter((s) => s.diag.includes('/held/')).map((s) => s.hud))],
    railMin: Math.min(...receded.map((s) => num(s.rail)).filter((v) => !Number.isNaN(v))),
    barMin: Math.min(...receded.map((s) => num(s.bar)).filter((v) => !Number.isNaN(v))),
    railIntermediate: samples.some((s) => {
      const v = num(s.rail); return v > 0.08 && v < 0.92;
    }),
    arcsWhileSettled: [...new Set(settled.map((s) => `${s.arcs}/${s.arcChild}`))],
    burstSeen: samples.some((s) => s.burst > 0),
    breathSeen: samples.some((s) => s.breath !== '-'),
    plate: mid?.plate,
    breathAtTitle: mid?.breath,
    texts: mid?.texts ?? [],
    anyNone: [...new Set(samples.flatMap((s) => s.anyNone))],
    cameraModes: [...new Set(samples.map((s) => s.diag.split('/')[3]).filter((m) => m !== undefined && m !== 'idle:placement'))],
    infoStates: [...new Set(samples.map((s) => s.info))],
    handStates: [...new Set(samples.map((s) => s.hand))],
    revealStates: [...new Set(samples.map((s) => s.reveal))],
  };
}

async function readSampler(page: Page, name: string): Promise<{samples: Array<Sample>, summary: Summary}> {
  const samples = await page.evaluate(() => {
    const w = window as unknown as {__tfSamples: Array<Sample>, __tfTimer?: number};
    if (w.__tfTimer !== undefined) {
      window.clearInterval(w.__tfTimer);
    }
    return w.__tfSamples;
  });
  const summary = summarize(samples);
  console.log(`[terraformed:${name}] ${JSON.stringify(summary)}`);
  return {samples, summary};
}

function box(s: string | undefined): {w: number, h: number, l: number, t: number} | undefined {
  const m = /^(\d+)×(\d+)@(-?\d+),(-?\d+)$/.exec(s ?? '');
  return m === null ? undefined : {w: Number(m[1]), h: Number(m[2]), l: Number(m[3]), t: Number(m[4])};
}

/** A STORYBOARD of the scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** The scene has played out: the module is idle again after having shown once. */
async function waitSceneOver(page: Page, timeoutMs = 30_000): Promise<Diag> {
  await page.waitForFunction(() => {
    const d = (window as unknown as {__conTerraformedDiag: () => Diag}).__conTerraformedDiag();
    return d.phase === 'idle' && d.nonce > 0 && !d.up;
  }, undefined, {timeout: timeoutMs});
  return diagOf(page);
}

async function waitShow(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(() => document.querySelector('[data-terraformed-phase="show"]') !== null, undefined, {timeout: timeoutMs});
}

/** The LAST raise from the API — the viewer's own prompt answered off the page (the scene off a view it did not press for). */
async function finishFromApi(request: APIRequestContext, seats: ReadonlyArray<string>): Promise<void> {
  const m = await drive(request, seats, terraformed);
  expect((m.game as {isTerraformed?: boolean}).isTerraformed, 'the server\'s word').toBe(true);
}

function expectScenePlayed(summary: Summary, preset: Preset, rootFontPx: number): void {
  expect(summary.armedAt, 'the scene ARMED off the server\'s word').toBeDefined();
  expect(summary.recedeAt, 'the interface receded').toBeDefined();
  expect(summary.focusAt, 'the ceremony camera came in').toBeDefined();
  expect(summary.settledAt, 'the camera settled').toBeDefined();
  expect(summary.showAt, 'the planet showed').toBeDefined();
  expect(summary.returnAt, 'the return played').toBeDefined();
  expect(summary.returningGoneAt, 'the surfaces came back').toBeDefined();
  const total = (summary.returningGoneAt ?? 0) - (summary.recedeAt ?? 0);
  if (preset.id === 'tv4k' && process.env.TM_E2E_GPU !== '1') {
    // A 4K timing claim is taken on the GPU (PL-211): SwiftShader stalls a 4K page for seconds under a reveal's intake.
    console.log(`[terraformed] the 4K phrase measured ${total} ms on the software renderer — the budget (${preset.budgetMs}) is asserted on the GPU`);
  } else {
    expect(total, `the whole phrase (${total} ms) fits the budget`).toBeLessThanOrEqual(preset.budgetMs);
  }
  expect(summary.stageBoxes, 'the stage keeps ONE box through recede / focus / return').toHaveLength(1);
  expect(summary.railMin, 'the player rail receded').toBeLessThanOrEqual(0.05);
  expect(summary.barMin, 'the command bar receded').toBeLessThanOrEqual(0.05);
  expect(summary.railIntermediate, 'the recede is a TRANSITION (an intermediate opacity was painted), never a cut').toBe(true);
  expect(summary.anyNone, 'no parked surface is `display: none` while the scene is up').toEqual([]);
  expect(summary.hudWhileHeld.every((h) => !/9\/9/.test(h) || /8\/9/.test(h)), 'the HUD keeps the player\'s last numbers while the step is held').toBe(true);
  expect(summary.hudAfter, 'the HUD reads the finished planet after').toMatch(/9\/9/);
  expect(summary.hudAfter, 'the HUD reads 100 % after').toMatch(/100%/);
  expect(summary.arcsWhileSettled.length, 'the arcs were sampled on the settled stage').toBeGreaterThan(0);
  for (const a of summary.arcsWhileSettled) {
    const [band, child] = a.split('/');
    expect(Number(band), `the arc band is VISIBLE on the ceremony stage (${a})`).toBeGreaterThanOrEqual(0.9);
    expect(Number(child), `the arcs themselves are visible on the ceremony stage (${a})`).toBeGreaterThanOrEqual(0.9);
  }
  expect(summary.breathSeen, 'the atmosphere layer stood on the real disc').toBe(true);
  expect(summary.burstSeen, 'the burst detonated over the disc').toBe(true);
  const plate = box(summary.plate);
  const breath = box(summary.breathAtTitle);
  expect(plate, 'the title plate was measured').toBeDefined();
  expect(plate!.t + plate!.h, 'the plate stands WHOLE inside the viewport').toBeLessThanOrEqual(preset.viewport.height);
  expect(plate!.l, 'the plate inside the viewport (left)').toBeGreaterThanOrEqual(0);
  expect(plate!.l + plate!.w, 'the plate inside the viewport (right)').toBeLessThanOrEqual(preset.viewport.width);
  if (breath !== undefined) {
    // The owner's M2: the caption in the zone the player rail vacated — LEFT of the disc, so the disc, the arcs and the
    // markers stay whole (a plate under the disc covered the ocean track's foot, PL-655).
    expect(plate!.l + plate!.w, 'the caption stands LEFT of the disc, overlapping nothing').toBeLessThanOrEqual(breath.l);
  }
  const floor = 0.8 * rootFontPx;
  expect(summary.texts.length, 'the three lines of the title').toBe(3);
  for (const px of summary.texts) {
    expect(px, `a title line (${px}px) reads at the couch floor (${floor}px)`).toBeGreaterThanOrEqual(floor - 0.5);
  }
  expect(summary.cameraModes.some((m) => /ceremony/.test(m)), 'the camera rode its ceremony mode').toBe(true);
}

async function rootFontPx(page: Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

test.describe('«Марс терраформирован» — the planet shows (TR70)', () => {
  for (const preset of PRESETS) {
    test(`(A · ${preset.id}) from the board home: recede → camera → the scales' last step → title → burst → return, one stage box, ≤ 4.5 s`, async ({page, request}) => {
      test.setTimeout(240_000);
      await page.setViewportSize(preset.viewport);
      const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink', {query: preset.query});
      await settle(page).catch(() => undefined);
      const stop = await storyboard(page, preset.id, 'scene');
      await armSampler(page);
      await finishFromApi(request, seats);
      const diag = await waitSceneOver(page);
      await cinematicBeat(page, 800, 'the title plate leaving after the scene ends');
      await stop();
      const {summary} = await readSampler(page, `A:${preset.id}`);
      expectScenePlayed(summary, preset, await rootFontPx(page));
      expect(diag.lastEnd, 'the scene concluded on the camera\'s landing').toBe('concluded');
      expect(diag.skipped).toBe(false);
      await shoot(page, preset.id, 'scene-after');
    });
  }

  test('(B · fhd) over the Information dossier: it recedes and returns in the SAME snapshot', async ({page, request}) => {
    test.setTimeout(240_000);
    await page.setViewportSize(FHD.viewport);
    const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink', {query: FHD.query});
    await settle(page).catch(() => undefined);
    expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info [data-dossier]').count() > 0, {tries: 4, settleMs: 1100}),
      'the Information dossier opened').toBe(true);
    expect(await focusInfoZone(page, 'effects'), 'the EFFECTS zone focused').toBe(true);
    const before = await page.evaluate(() => ({
      crumb: (document.querySelector('.con-info__head')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      zone: document.querySelector('.con-info__zone--focused')?.getAttribute('data-zone') ?? '',
    }));
    expect(before.zone).toBe('effects');
    await armSampler(page);
    await finishFromApi(request, seats);
    await waitSceneOver(page);
    await cinematicBeat(page, 600, 'the title plate leaving after the scene ends');
    const {summary} = await readSampler(page, 'B');
    expect(summary.showAt, 'the scene showed over the dossier').toBeDefined();
    expect(summary.infoStates.some((s) => s !== '-' && s !== 'none' && Number(s) <= 0.05), 'the dossier RECEDED (opacity)').toBe(true);
    expect(summary.infoStates.includes('none'), 'the dossier was never `display: none`').toBe(false);
    expect(summary.infoStates.includes('-'), 'the dossier was never unmounted').toBe(false);
    const after = await page.evaluate(() => ({
      crumb: (document.querySelector('.con-info__head')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      zone: document.querySelector('.con-info__zone--focused')?.getAttribute('data-zone') ?? '',
      opacity: getComputedStyle(document.querySelector('.con-info')!).opacity,
    }));
    expect(after.crumb, 'the same crumb').toBe(before.crumb);
    expect(after.zone, 'the same focused zone').toBe(before.zone);
    expect(Number(after.opacity), 'the dossier is back').toBeGreaterThanOrEqual(0.99);
    await shoot(page, FHD.id, 'scene-over-info-after');
  });

  for (const preset of PRESETS) {
    test(`(C · ${preset.id}) over the hand album: the same page and the same card in focus after the scene`, async ({page, request}) => {
      test.setTimeout(240_000);
      await page.setViewportSize(preset.viewport);
      const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink', {query: preset.query});
      await settle(page).catch(() => undefined);
      await openHand(page);
      await press(page, 'ArrowRight', 500);
      const before = {card: await focusedCard(page), pager: await page.locator('.con-handdock__pager').textContent().catch(() => '')};
      expect(before.card, 'a card is in focus before').not.toBe('');
      await armSampler(page);
      await finishFromApi(request, seats);
      await waitSceneOver(page);
      await cinematicBeat(page, 600, 'the title plate leaving after the scene ends');
      const {samples, summary} = await readSampler(page, `C:${preset.id}`);
      expect(summary.showAt, 'the scene showed over the album').toBeDefined();
      expect(summary.handStates.includes('-'), 'the album was never unmounted').toBe(false);
      // The ONE `display` flip of the scene: a section on the board's slot leaves the row only once its own opacity has
      // reached 0 (the player sees nothing switch), and is back in the row before it fades in.
      const firstNone = samples.findIndex((s) => s.hand === 'none');
      expect(firstNone, 'the album left the row for the board').toBeGreaterThan(0);
      const fadedBefore = samples.slice(0, firstNone).some((s) => s.hand !== 'none' && s.hand !== '-' && Number(s.hand) <= 0.5);
      expect(fadedBefore, 'the album was faded OUT before it left the row').toBe(true);
      const lastNone = samples.map((s) => s.hand).lastIndexOf('none');
      const fadedAfter = samples.slice(lastNone + 1).some((s) => s.hand !== 'none' && s.hand !== '-' && Number(s.hand) <= 0.5);
      expect(fadedAfter, `the album came back into the row still faded, then faded in (after the flip: ${samples.slice(lastNone + 1, lastNone + 7).map((s) => s.hand).join(' → ')})`).toBe(true);
      expect(summary.stageBoxes, 'the stage keeps ONE box (the board stood in for the album)').toHaveLength(1);
      const after = {card: await focusedCard(page), pager: await page.locator('.con-handdock__pager').textContent().catch(() => '')};
      expect(after.card, 'the same card in focus').toBe(before.card);
      expect(after.pager, 'the same page').toBe(before.pager);
      expect(await page.locator('.con-hand').count(), 'the album stands').toBe(1);
      await shoot(page, preset.id, 'scene-over-hand-after');
    });
  }

  for (const preset of PRESETS) {
    test(`(D · ${preset.id}) the viewer's own last ocean through the UI onto a two-card cell: the reveal stands, the scene waits for the take`, async ({page, request}) => {
      test.setTimeout(300_000);
      await page.setViewportSize(preset.viewport);
      await bootFixtureSeats(page, request, 'terraformed-brink', {query: preset.query});
      await settle(page).catch(() => undefined);
      // LT → the standard projects, the aquifer row (a grid — the stdp spec's own snake), A → the board.
      expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick, .con-stdp').count() > 0, {tries: 4, settleMs: 1100}), 'LT opened').toBe(true);
      if (await page.locator('.con-stdp').count() === 0) {
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-stdp').count() > 0, {tries: 4, settleMs: 1400}), 'the standard projects opened').toBe(true);
      }
      const focused = async () => ((await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '').trim();
      const AQUIFER = /океан|aquifer/i;
      for (let i = 0; i < 6 && !AQUIFER.test(await focused()); i++) {
        await press(page, 'ArrowUp', 200);
      }
      const snake = ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
      for (let i = 0; i < snake.length && !AQUIFER.test(await focused()); i++) {
        await press(page, snake[i], 240);
      }
      expect(AQUIFER.test(await focused()), `the aquifer row is focused (got «${await focused()}»)`).toBe(true);
      await armSampler(page);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 4, settleMs: 1400}), 'the board placement opened').toBe(true);
      await walkToSpace(page, '13');
      expect(await commitFocusedSpace(page), 'the ocean committed on 13').toBe(true);
      // The cell pays two cards: the reveal stands, and the scene — armed off the same response — WAITS for the take.
      await page.locator('.con-reveal').waitFor({state: 'visible', timeout: 30_000});
      await cinematicBeat(page, 2_500, 'the reveal stands — the ARMED wait is observed holding nothing');
      const held = await diagOf(page);
      expect(held.phase, 'armed while the reveal stands').toBe('armed');
      expect(held.parkHeld, 'the scales\' last step held for the stage').toBe(true);
      expect(await page.locator('.con-terraformed').count(), 'no title over a standing reveal').toBe(0);
      expect(await pressUntilGone(page, 'KeyB', '.con-reveal', {tries: 4, settleMs: 1600}) ||
        await pressUntilGone(page, 'Enter', '.con-reveal', {tries: 6, settleMs: 1600}), 'the cards taken').toBe(true);
      const diag = await waitSceneOver(page, 40_000);
      await cinematicBeat(page, 800, 'the title plate leaving after the scene ends');
      const {summary} = await readSampler(page, `D:${preset.id}`);
      expectScenePlayed(summary, preset, await rootFontPx(page));
      expect(summary.showAt!, 'the show came AFTER the reveal left').toBeGreaterThan(summary.armedAt!);
      expect(diag.lastEnd).toBe('concluded');
      expect(await page.locator('.con-reveal').count(), 'the board home after — no reveal').toBe(0);
      await shoot(page, preset.id, 'scene-own-placement-after');
    });
  }

  for (const preset of PRESETS) {
    test(`(E · ${preset.id}) a rival finishes the planet: the viewer's page plays the same scene off the poll / WS frame`, async ({page, request}) => {
      test.setTimeout(240_000);
      await page.setViewportSize(preset.viewport);
      const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink-rival', {query: preset.query});
      await settle(page).catch(() => undefined);
      await armSampler(page);
      await finishFromApi(request, seats);
      const diag = await waitSceneOver(page);
      await cinematicBeat(page, 800, 'the title plate leaving after the scene ends');
      const {summary} = await readSampler(page, `E:${preset.id}`);
      expectScenePlayed(summary, preset, await rootFontPx(page));
      expect(diag.lastEnd).toBe('concluded');
      await shoot(page, preset.id, 'scene-rival-after');
    });
  }

  test('(F · fhd) a SKIP: a press after the camera is in ends the show at once — the return plays once, the HUD gold', async ({page, request}) => {
    test.setTimeout(240_000);
    await page.setViewportSize(FHD.viewport);
    const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink', {query: FHD.query});
    await settle(page).catch(() => undefined);
    await armSampler(page);
    await finishFromApi(request, seats);
    await waitShow(page);
    const atShow = Date.now();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as unknown as {__conTerraformedDiag: () => Diag}).__conTerraformedDiag().phase === 'return', undefined, {timeout: 2_000});
    const toReturn = Date.now() - atShow;
    const skipped = await diagOf(page);
    expect(skipped.skipped, 'the press SKIPPED').toBe(true);
    const diag = await waitSceneOver(page, 10_000);
    await cinematicBeat(page, 600, 'the title plate leaving after the scene ends');
    const {summary} = await readSampler(page, 'F');
    expect(toReturn, 'the return followed the press at once').toBeLessThanOrEqual(1_000);
    expect(summary.hudAfter, 'the HUD reads the finished planet').toMatch(/9\/9/);
    expect(summary.hudAfter).toMatch(/100%/);
    expect(summary.returningGoneAt, 'the surfaces came back').toBeDefined();
    expect(summary.stageBoxes).toHaveLength(1);
    expect(diag.lastEnd, 'one atomic finish').toBe('concluded');
    expect(await page.locator('.con-terraformed').count(), 'the title is gone').toBe(0);
    expect(await page.locator('.con-board--pfocus').count(), 'the camera is home').toBe(0);
  });

  test('(G · fhd) PL-290: the finale\'s announce after the scene — the prompt arriving mid-scene reaches its plate no later than the scene\'s end + the read beat', async ({page, request}) => {
    test.setTimeout(300_000);
    await page.setViewportSize(FHD.viewport);
    const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink', {query: FHD.query});
    await settle(page).catch(() => undefined);
    await armSampler(page);
    await finishFromApi(request, seats);
    // Both seats pass at once — the generation ends under the scene and the FINAL GREENERY prompt stands for the viewer.
    const askedAt = Date.now();
    await drive(request, seats, (m) => m.waitingFor?.finalGreeneryPrompt !== undefined);
    const promptAt = Date.now();
    await page.locator('.con-mandatory').first().waitFor({state: 'visible', timeout: 30_000});
    const plateAt = Date.now();
    const atPlate = await diagOf(page);
    expect(atPlate.phase, 'the announce stood only once the scene was over — never under the recede').toBe('idle');
    const diag = atPlate;
    const {summary} = await readSampler(page, 'G');
    const delay = plateAt - promptAt;
    console.log(`[terraformed:G] PL-290 — the finale's announce ${delay} ms after the server's prompt (asked ${promptAt - askedAt} ms after the last raise; scene ${JSON.stringify({recede: summary.recedeAt, back: summary.returningGoneAt})})`);
    expect(summary.showAt, 'the scene showed').toBeDefined();
    expect(diag.nonce, 'one scene').toBe(1);
    // The old ceremony held every announce for its 6.7 s lifetime; the scene's whole phrase is ≤ 4.5 s + the read beat.
    expect(delay, `the announce waited ${delay} ms — no longer than the scene's remainder + the read beat`).toBeLessThanOrEqual(9_000);
  });

  test('(H · fhd) reduced motion: no camera, the title reads, the scales snap, ≤ 1.5 s', async ({page, request}) => {
    test.setTimeout(240_000);
    await page.setViewportSize(FHD.viewport);
    await page.emulateMedia({reducedMotion: 'reduce'});
    const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink', {query: FHD.query});
    await settle(page).catch(() => undefined);
    expect(await page.evaluate(() => document.documentElement.classList.contains('con-reduced-motion')), 'the page runs under reduced motion').toBe(true);
    await armSampler(page);
    await finishFromApi(request, seats);
    const diag = await waitSceneOver(page);
    await cinematicBeat(page, 600, 'the title plate leaving after the scene ends');
    const {summary} = await readSampler(page, 'H');
    expect(summary.recedeAt, 'the scene played').toBeDefined();
    expect(summary.showAt, 'the title showed').toBeDefined();
    expect(summary.focusAt, 'NO camera under reduced motion').toBeUndefined();
    expect(summary.stageBoxes).toHaveLength(1);
    const total = (summary.returningGoneAt ?? summary.recededGoneAt ?? 0) - (summary.recedeAt ?? 0);
    expect(total, `the reduced phrase (${total} ms) ≤ 1.5 s`).toBeLessThanOrEqual(1_600);
    expect(summary.hudAfter).toMatch(/9\/9/);
    expect(diag.lastEnd).toBe('concluded');
  });

  test('(I · fhd) a reload after the scene never replays it', async ({page, request}) => {
    test.setTimeout(240_000);
    await page.setViewportSize(FHD.viewport);
    const {seats} = await bootFixtureSeats(page, request, 'terraformed-brink', {query: FHD.query});
    await settle(page).catch(() => undefined);
    await finishFromApi(request, seats);
    await waitSceneOver(page);
    await reloadConsole(page);
    await armSampler(page);
    await cinematicBeat(page, 4_000, 'a reload window in which no scene may start');
    const {samples} = await readSampler(page, 'I');
    expect(samples.length, 'the sampler ran').toBeGreaterThan(10);
    expect(samples.some((s) => s.phase !== '' || /terraformed/.test(s.root)), 'no scene after a reload').toBe(false);
    const diag = await diagOf(page);
    expect(diag.phase).toBe('idle');
    expect(diag.nonce, 'seeded silently — never armed').toBe(0);
    expect(((await getModel(request, seats[0])).game as {isTerraformed?: boolean}).isTerraformed, 'the server still says terraformed').toBe(true);
    expect(await page.locator('.con-status__terra').textContent(), 'the HUD reads the finished planet').toMatch(/9\/9/);
  });
});
