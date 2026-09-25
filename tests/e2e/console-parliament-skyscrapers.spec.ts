import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, commitFocusedSpace, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, placementState, press,
  pressUntil, sendPlayerInput, settle, walkToSpace,
} from './consoleStart';
import {answerGateAs, armLeakWitness, mandatoryPlate, parliament, strandedReports, turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * SKYSCRAPERS (Turmoil Redux, RX20) — the ONE e2e of the card, on one profile:
 * the CITY STACK and the TIER'S LANDING, end to end at the console's real surface.
 *
 *   · the fixture: the sitting stands at the effects step with BLUE's city-tier
 *     prompt live — blue owns one city on Mars with one greenery beside it, red
 *     (influence 1, not the winner) is passed over by the rule;
 *   · the PROMPT is honest: the plate names the resolution, A opens the STANDARD
 *     placement whose ONE candidate is still asked; the dossier on the city
 *     promises the stack's scoring («1 → 2 tiers») and says out loud that the
 *     cell pays no bonus; L3 opens the source;
 *   · the SCENE (the owner's order, sampled in-page at 30 ms): the tier swings
 *     over the site (its x still moving), HANGS while the base takes the load
 *     (the cell's `--stack-loading`, the counter at «×1»), comes STRAIGHT DOWN
 *     (x fixed on the stack's centre, y monotone), and at CONTACT the counter
 *     ticks «×2» in the SAME sample the cell's height changes; the dust rises
 *     at the contact; the cell ends as a stack of 2 with its states released;
 *   · server truth: the record `city · space · stackHeight 2`, two cities for
 *     blue, no bonus paid (M€ and the printed pool unchanged);
 *   · the sitting comes back and walks to the results; the score breakdown
 *     reads TWO city contributions on ONE cell.
 *
 * Fixture: `parliament-skyscrapers-enact`. Screens under
 * screenshots/parliament-skyscrapers/standard-1080/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-skyscrapers');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const SKY_ID = 'RDX_MARS_SKYSCRAPERS';
const SKY_CLASS = /rdx-mars-skyscrapers/;
/** TileType.CITY (`common/TileType`). */
const CITY = 2;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Outcome = {player: string, step: string, part?: string, kind: string, space?: string, stackHeight?: number, reason?: string, influence?: number};
type Wire = {
  thisPlayer: {color: string, megacredits: number, plants: number, steel: number, citiesCount: number, cardsInHandNbr: number},
  game: {
    generation: number, phase: string,
    spaces: Array<{id: string, bonus: Array<number>, tileType?: number, color?: string, stackHeight?: number}>,
    parliament: {phase?: {step: string, pending?: {player: string, key: string, input?: string}, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}},
  },
  waitingFor?: {type?: string, spaces?: Array<string>, placementType?: string, placementContext?: {source?: {kind: string, resolution?: string}}},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

const dossierRows = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-context .con-dossier-row')).map((row) => ({
  label: (row.querySelector('.con-dossier-row__title')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  value: (row.querySelector('.con-dossier-row__val')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  note: (row.querySelector('.con-dossier-row__note')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
})));

type CastFrame = {wall: number, data: string};

/** A CDP screencast — a frame of a short scene is picked AFTER the fact, at the moment the probe named (never chased from Node). */
async function recordFrames(page: Page): Promise<{frames: ReadonlyArray<CastFrame>, stop: () => Promise<void>}> {
  const frames: Array<CastFrame> = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (frame) => {
    frames.push({wall: (frame.metadata.timestamp ?? 0) * 1000, data: frame.data});
    cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {format: 'png', everyNthFrame: 1});
  return {
    frames,
    stop: async () => {
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    },
  };
}

/** Write the recorded frame nearest a moment the probe named. */
function writeFrameAt(frames: ReadonlyArray<CastFrame>, wall: number, name: string): boolean {
  let best: CastFrame | undefined;
  for (const frame of frames) {
    if (best === undefined || Math.abs(frame.wall - wall) < Math.abs(best.wall - wall)) {
      best = frame;
    }
  }
  if (best === undefined || Math.abs(best.wall - wall) > 250) {
    return false;
  }
  const dir = path.join(OUT_ROOT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(best.data, 'base64'));
  return true;
}

type Sample = {
  t: number,
  /** WALL clock, so a sample can be matched against a screencast frame's own timestamp. */
  wall: number,
  /** The flying tier's proxy: shown, and its centre. */
  landing: boolean, lx: number, ly: number,
  /** The real cell: the counter's text, the model's height, the scene's two states, the dust. */
  count: string | undefined, height: string | undefined, loading: boolean, contact: boolean, dust: boolean,
  cellVisible: boolean,
};

/** The board-cursor walk to the city + the two-press commit. */
async function commitOnCity(page: Page, city: string): Promise<void> {
  await walkToSpace(page, city);
  expect(await commitFocusedSpace(page), 'the tier is placed through the standard two-press flow').toBe(true);
}

/** Walk the score explorer's overview cursor onto a category tile. */
async function focusTile(page: Page, tileKey: string): Promise<void> {
  const keys = await page.locator('.con-vpx__tile').evaluateAll((els) => els.map((el) => el.getAttribute('data-vpx-tile') ?? ''));
  const target = keys.indexOf(tileKey);
  expect(target, `the ${tileKey} tile must exist (have: ${keys.join(', ')})`).toBeGreaterThanOrEqual(0);
  const cols = await page.locator('.con-vpx__grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  for (let guard = 0; guard < 16; guard++) {
    const at = await page.locator('.con-vpx__tile').evaluateAll((els) => els.findIndex((el) => el.classList.contains('con-vpx__tile--focused')));
    if (at === target) {
      return;
    }
    const [ar, ac] = [Math.floor(at / cols), at % cols];
    const [tr, tc] = [Math.floor(target / cols), target % cols];
    await press(page, tr > ar ? 'ArrowDown' : tr < ar ? 'ArrowUp' : tc > ac ? 'ArrowRight' : 'ArrowLeft', 260);
  }
  expect(false, `could not reach the ${tileKey} tile`).toBeTruthy();
}

test.describe(`Skyscrapers · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1});

  test('the city tier: an honest prompt, the crane descent with the counter ticking at contact, a stack of 2 that scores twice', async ({page, request}) => {
    test.setTimeout(600_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-skyscrapers-enact', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);

    // ── THE PROMPT stands on the server: the standard placement over the stack's own kind, its ONE candidate still asked.
    const before = await wireOf(request, playerId);
    expect(before.game.phase, 'the political phase stands').toBe('parliament');
    expect(before.waitingFor?.type, 'blue\'s tier is asked').toBe('space');
    expect(before.waitingFor?.placementType).toBe('city-tier');
    expect(before.waitingFor?.placementContext?.source).toMatchObject({kind: 'resolution', resolution: SKY_ID});
    expect(before.waitingFor?.spaces, 'ONE candidate — still a question (no auto-select)').toHaveLength(1);
    const city = before.waitingFor!.spaces![0];
    const cellBefore = before.game.spaces.find((s) => s.id === city)!;
    expect(cellBefore.tileType).toBe(CITY);
    expect(cellBefore.color).toBe(before.thisPlayer.color);
    expect(cellBefore.stackHeight, 'one city before').toBeUndefined();
    expect(before.game.parliament.phase?.pending).toEqual({player: before.thisPlayer.color, key: 'city-tier', input: 'space'});
    // Red's seat is walked AFTER blue's answer (generation order): its record comes later.
    const redBefore = await wireOf(request, red);
    expect(redBefore.game.parliament.phase?.outcomes ?? [], 'no record yet — the walk waits on blue').toHaveLength(0);

    // ── A on the plate → the placement; the DOSSIER promises the stack and says out loud that the cell pays nothing.
    await expect(mandatoryPlate(page), 'the sitting is announced').toHaveCount(1, {timeout: 30_000});
    expect(await placementState(page), 'no placement before the press').toBe('none');
    await shoot(page, '01-announce');
    expect(await openMandatoryAnnounce(page), 'A on the plate starts the placement').toBe(true);
    await expect.poll(async () => await placementState(page), {timeout: 30_000, message: 'the tier placement stands'}).not.toBe('none');
    await settle(page, {timeoutMs: 20_000});
    await walkToSpace(page, city);
    await settle(page, {timeoutMs: 15_000});
    await expect.poll(async () => (await dossierRows(page)).some((r) => /Стопка городов: 1 → 2|City stack: 1 → 2/.test(r.label)), {
      timeout: 15_000, message: 'the dossier promises the stack\'s scoring',
    }).toBe(true);
    const rows = await dossierRows(page);
    const stackRow = rows.find((r) => /Стопка городов: 1 → 2|City stack: 1 → 2/.test(r.label))!;
    expect(stackRow.value, `one greenery beside: 1 → 2 VP (${JSON.stringify(rows)})`).toMatch(/1\s*→\s*2|\+1/);
    expect(rows.some((r) => /Без бонуса размещения|No placement bonus/.test(r.label)), `no silent loss: the cell pays nothing, said aloud (${JSON.stringify(rows)})`).toBe(true);
    await shoot(page, '02-tier-dossier');

    // ── L3 = THE SOURCE: the resolution's inspector; closing it leaves the placement standing.
    await openZoomViewer(page, 'KeyC');
    await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]'), 'L3 opens the RESOLUTION inspector').toHaveCount(1);
    await expect(page.locator('dialog.con-zoom[open] .card-zoom-stage .pcard').first()).toHaveClass(SKY_CLASS);
    await shoot(page, '03-source-inspector');
    await closeZoomViewer(page);
    await expect.poll(async () => await placementState(page), {timeout: 10_000, message: 'inspection does not cancel the placement'}).not.toBe('none');

    // ── THE SCENE, sampled IN THE PAGE before the press (a Node loop samples three beats late).
    //    `setInterval`, never rAF — headless Chromium stops rAF the moment the screen goes quiet.
    const mcBefore = (await wireOf(request, playerId)).thisPlayer.megacredits;
    const cast = await recordFrames(page);
    await page.evaluate((spaceId) => {
      type S = {t: number, wall: number, landing: boolean, lx: number, ly: number, count: string | undefined, height: string | undefined, loading: boolean, contact: boolean, dust: boolean, cellVisible: boolean};
      const w = window as unknown as {__sky?: {samples: Array<S>, stop: () => void}};
      const samples: Array<S> = [];
      const shown = (el: Element | null): boolean => {
        if (el === null) {
          return false;
        }
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02 && r.width > 2 && r.height > 2;
      };
      const t0 = performance.now();
      const timer = window.setInterval(() => {
        const cell = document.querySelector<HTMLElement>(`.board-space[data_space_id="${spaceId}"]`);
        const proxy = document.querySelector<HTMLElement>('.con-tileplace__tile:not(.con-tileplace__tile--depart):not(.con-tileplace__tile--remote)');
        const pr = proxy?.getBoundingClientRect();
        const cr = cell?.getBoundingClientRect();
        samples.push({
          t: Math.round(performance.now() - t0),
          wall: Date.now(),
          landing: shown(proxy),
          lx: pr === undefined ? -1 : pr.left + pr.width / 2,
          ly: pr === undefined ? -1 : pr.top + pr.height / 2,
          count: cell?.querySelector('[data-stack-count]')?.textContent?.trim() ?? undefined,
          height: cell?.getAttribute('data-stack-height') ?? undefined,
          loading: cell?.classList.contains('board-space--stack-loading') ?? false,
          contact: cell?.classList.contains('board-space--stack-contact') ?? false,
          dust: shown(document.querySelector('.con-tileplace__dust')),
          cellVisible: cr !== undefined && cr.width > 8 && cr.height > 8,
        });
      }, 30);
      w.__sky = {samples, stop: () => window.clearInterval(timer)};
    }, city);
    await commitOnCity(page, city);
    // THE SCENE'S END is a STATE the sampler itself reads: the stack at 2, the proxy gone, the cell's states and
    // the dust released — held for a run of samples (the settled frame the report picks is a frame at rest).
    await expect.poll(async () => await page.evaluate(() => {
      const w = window as unknown as {__sky: {samples: Array<{height?: string, landing: boolean, loading: boolean, contact: boolean, dust: boolean}>}};
      const tail = w.__sky.samples.slice(-12);
      return tail.length === 12 && tail.every((s) => s.height === '2' && !s.landing && !s.loading && !s.contact && !s.dust);
    }), {timeout: 30_000, message: 'the scene comes to rest on a stack of 2'}).toBe(true);
    const samples = await page.evaluate(() => {
      const w = window as unknown as {__sky: {samples: Array<Record<string, unknown>>, stop: () => void}};
      w.__sky.stop();
      return w.__sky.samples;
    }) as Array<Sample>;
    await cast.stop();
    const first = (pred: (s: Sample) => boolean) => samples.findIndex(pred);
    const loadingAt = first((s) => s.loading);
    const count1At = first((s) => s.count === '×1');
    const contactAt = first((s) => s.contact);
    const height2At = first((s) => s.height === '2');
    const count2At = first((s) => s.count === '×2');
    const dustAt = first((s) => s.dust);
    const landingAt = first((s) => s.landing);
    // The trail: one line per sample, attached to the report (read it when a claim below fails); the console gets the beats only.
    const trail = samples.map((s) => `${s.t} land:${s.landing ? 1 : 0}@${Math.round(s.lx)},${Math.round(s.ly)} cnt:${s.count ?? '-'} h:${s.height ?? '-'} ` +
      `load:${s.loading ? 1 : 0} con:${s.contact ? 1 : 0} dust:${s.dust ? 1 : 0}`).join('\n');
    await test.info().attach('skyscrapers-scene-trail', {body: trail, contentType: 'text/plain'});
    const at = (i: number) => i < 0 ? '—' : `${samples[i].t}ms`;
    console.log(`[skyscrapers] ${samples.length} samples over ${samples[samples.length - 1]?.t}ms · fly ${at(landingAt)} · load ${at(loadingAt)} (×1 ${at(count1At)}) · contact ${at(contactAt)} (×2 ${at(count2At)}, h2 ${at(height2At)}, dust ${at(dustAt)})`);
    // A dead sampler must fail loudly rather than pass every claim vacuously.
    expect(samples.length, 'the in-page sampler never ran').toBeGreaterThan(30);
    // THE STAGE IS VISIBLE: the target cell is on screen and the tier physically flew (the source and the destination both seen).
    expect(samples.every((s) => s.cellVisible), 'the target cell stays visible through the scene').toBe(true);
    expect(landingAt, 'the tier must physically FLY to the stack').toBeGreaterThanOrEqual(0);
    // THE ORDER: the swing → the base takes the load (counter at ×1) → the contact (counter ×2, height 2 in the SAME sample).
    expect(loadingAt, 'the base must take the load before the contact').toBeGreaterThanOrEqual(0);
    expect(count1At, 'the counter appears at «×1» while the tier hangs').toBeGreaterThanOrEqual(0);
    expect(count1At, 'the ×1 counter belongs to the load, not to the contact').toBeLessThanOrEqual(loadingAt + 1);
    expect(contactAt, 'the contact must be seen').toBeGreaterThan(loadingAt);
    expect(height2At, 'the stack must reach 2').toBeGreaterThanOrEqual(0);
    expect(count2At, 'the counter ticks «×2» in the SAME sample the cell\'s height changes — not before, not later').toBe(height2At);
    expect(Math.abs(contactAt - height2At), 'the contact state and the paint are one frame').toBeLessThanOrEqual(1);
    expect(dustAt, 'the dust rises AT the contact').toBeGreaterThanOrEqual(0);
    expect(Math.abs(dustAt - contactAt)).toBeLessThanOrEqual(2);
    // THE SWING: before the load the tier's x is still moving (it comes from the supply, not from nowhere).
    const swing = samples.filter((s, i) => s.landing && i < loadingAt);
    const xs = swing.map((s) => s.lx);
    expect(swing.length, 'the swing was sampled').toBeGreaterThan(2);
    expect(Math.max(...xs) - Math.min(...xs), 'the tier travels horizontally on its way to the site').toBeGreaterThan(30);
    // THE VERTICAL DESCENT: from the load to the contact the tier's x is FIXED on the stack's centre and its y only grows (screen down).
    const descent = samples.filter((s, i) => s.landing && i >= loadingAt && i < contactAt);
    expect(descent.length, 'the descent was sampled').toBeGreaterThan(4);
    const dx = Math.max(...descent.map((s) => s.lx)) - Math.min(...descent.map((s) => s.lx));
    expect(dx, `the lowering is VERTICAL — x fixed (spread ${dx.toFixed(1)} px)`).toBeLessThanOrEqual(2);
    // (the only upward motion allowed is the contact's damped settle — under 3 px, the mass being felt once)
    for (let i = 1; i < descent.length; i++) {
      expect(descent[i].ly, `y never goes back up during the lowering (sample ${i})`).toBeGreaterThanOrEqual(descent[i - 1].ly - 3);
    }
    expect(descent[descent.length - 1].ly - descent[0].ly, 'the tier actually came DOWN').toBeGreaterThan(10);
    // THE FRAMES — picked after the fact at the moments the probe named: the tier hanging over the loaded base,
    // the contact (the counter's «×2» in that very frame), the settled stack with its dust down.
    const hangingAt = Math.min(samples.length - 1, loadingAt + 2);
    const settledAt = samples.findIndex((s, i) => i > contactAt && !s.landing && !s.dust);
    expect(writeFrameAt(cast.frames, samples[hangingAt].wall, '04-tier-hanging'), 'a frame of the tier hanging').toBe(true);
    expect(writeFrameAt(cast.frames, samples[height2At].wall, '05-contact'), 'a frame of the contact').toBe(true);
    expect(writeFrameAt(cast.frames, samples[settledAt < 0 ? samples.length - 1 : settledAt].wall, '06-stack-settled'), 'a frame of the settled stack').toBe(true);
    // THE END: a stack of 2, its scene states released, nothing hanging.
    const last = samples[samples.length - 1];
    expect(last.height).toBe('2');
    expect(last.count).toBe('×2');
    expect(last.loading || last.contact, 'the cell\'s scene states are released').toBe(false);
    expect(last.landing, 'the proxy is gone').toBe(false);

    // ── SERVER TRUTH: the record names the cell and the stack; two cities for blue; the cell paid nothing.
    await expect.poll(async () => (await wireOf(request, playerId)).game.spaces.find((s) => s.id === city)?.stackHeight, {timeout: 30_000}).toBe(2);
    const mid = await wireOf(request, playerId);
    expect(mid.game.parliament.phase?.outcomes?.find((o) => o.player === mid.thisPlayer.color) ?? mid.game.parliament.lastPhase?.outcomes?.find((o) => o.player === mid.thisPlayer.color))
      .toMatchObject({kind: 'city', step: 'city-tier', part: 'effect', space: city, stackHeight: 2});
    expect(mid.thisPlayer.citiesCount, 'a QUANTITY of cities counts the tier').toBe(2);
    expect(mid.thisPlayer.megacredits, 'no ocean adjacency, no bonus — nothing paid').toBe(mcBefore);
    // …but what answers A CITY PLACED still answers: Skyscrapers is enacted before its effect, so Mars First
    // rules — 1 steel for the tile and a CARD for the city, which the shared reveal presents; A takes it.
    expect(mid.thisPlayer.steel, 'the ruling party\'s steel for a tile placed on Mars').toBe(before.thisPlayer.steel + 1);
    await expect.poll(async () => await page.locator('dialog.con-zoom[open]').count(), {timeout: 30_000, message: 'the party\'s card is presented'}).toBe(1);
    await shoot(page, '06b-party-card');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('dialog.con-zoom[open]').count() === 0, {tries: 6, settleMs: 1500}), 'take the card').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, {timeout: 30_000}).toBe(before.thisPlayer.cardsInHandNbr + 1);
    const redMid = await wireOf(request, red);
    expect((redMid.game.parliament.phase?.outcomes ?? redMid.game.parliament.lastPhase?.outcomes ?? []).find((o) => o.player === redMid.thisPlayer.color), 'red is passed over BY THE RULE — named').toMatchObject({
      kind: 'skipped', reason: 'Below 2 influence and not the winner of the vote', influence: 1,
    });

    // ── THE SITTING comes back with the receipt and walks to the results; the phase ends through the adjourn gate.
    await expect(parliament(page), 'the sitting is back after the board').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '07-sitting-receipt');
    expect(await turnTo(page, 'results'), 'the results page').toBe(true);
    await expect(page.locator(`[data-sit-payout-seat="${mid.thisPlayer.color}"] [data-sit-part="city"]`), 'the results name blue\'s tier').toHaveCount(1, {timeout: 15_000});
    await expect(page.locator(`[data-sit-payout-seat="${redBefore.thisPlayer.color}"] .con-sit__part--skipped`), 'and red\'s named skip').toHaveCount(1);
    await shoot(page, '08-results');
    await press(page, 'Enter', 1200);
    await answerGateAs(request, red, 'adjourn');
    await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    await settle(page, {timeoutMs: 30_000});

    // ── THE SCORE BREAKDOWN reads TWO city contributions on ONE cell — the score explorer's city category.
    const info = page.locator('.con-info');
    for (let i = 0; i < 8 && await info.count() === 0; i++) {
      if (i > 0) {
        await press(page, 'Enter', 700);
        await press(page, 'Escape', 500);
      }
      await press(page, 'KeyY', 1100);
    }
    await expect(info, 'the Information mode opens').toHaveCount(1);
    const vpFocused = () => page.locator('.con-info__zone--vp.con-info__zone--focused').count();
    for (const move of ['ArrowLeft', 'ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'] as const) {
      if (await vpFocused() > 0) {
        break;
      }
      await press(page, move, 300);
    }
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-vpx').count() > 0, {tries: 3, settleMs: 1100}), 'the score explorer opens').toBe(true);
    await focusTile(page, 'city');
    await press(page, 'Enter', 1000);
    const cityRows = page.locator('.con-vpx__factrow');
    await expect(cityRows, 'two contributions, one cell').toHaveCount(2, {timeout: 10_000});
    const names = await cityRows.locator('.con-vpx__factrow-label').allTextContents();
    expect(names.map((n) => n.trim()), 'one row per tier').toEqual(expect.arrayContaining([expect.stringMatching(/ярус 1 из 2|tier 1 of 2/), expect.stringMatching(/ярус 2 из 2|tier 2 of 2/)]));
    const vps = await cityRows.locator('.con-vpx__factrow-value').allTextContents();
    expect(vps.map((v) => v.trim()), 'each tier scores the one greenery').toEqual(['1', '1']);
    await shoot(page, '09-score-two-tiers');
    for (let i = 0; i < 6 && await page.locator('.con-info, .con-vpx').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }

    // ── THE CELL'S INSPECTION (board home, L3): the stack's own header and ONE scoring row per tier. The new
    //    generation's research purchase stands over the board — answered over the API for both seats (the
    //    purchase is not the subject), so the board home is idle and L3 is the inspection.
    for (const seat of [playerId, red]) {
      const wire = await fetchPlayerModel(request, seat) as unknown as {waitingFor?: {type?: string, promptId?: string}};
      if (wire.waitingFor?.type === 'card') {
        await sendPlayerInput(request, seat, {type: 'card', cards: [], promptId: wire.waitingFor.promptId} as never);
      }
    }
    await expect.poll(async () => await page.locator('dialog[open]').count(), {timeout: 30_000, message: 'the purchase leaves the screen'}).toBe(0);
    await settle(page, {timeoutMs: 30_000});
    expect(await pressUntil(page, 'KeyC', async () => await page.locator('.con-board--inspecting').count() > 0, {tries: 4, settleMs: 700}), 'L3 opens the board inspection').toBe(true);
    await walkToSpace(page, city);
    const cellPanel = page.locator('.con-context');
    await expect.poll(async () => (await cellPanel.innerText().catch(() => '')).replace(/\s+/g, ' '), {timeout: 15_000, message: 'the inspection names the stack'})
      .toMatch(/стопка городов|city stack/i); // (`innerText` renders the kicker's CSS uppercase)
    const panelText = (await cellPanel.innerText()).replace(/\s+/g, ' ');
    expect(panelText, 'one scoring row per tier').toMatch(/(Ярус|Tier) 1 (из|of) 2/);
    expect(panelText).toMatch(/(Ярус|Tier) 2 (из|of) 2/);
    await shoot(page, '10-cell-inspection');
    await press(page, 'Escape', 600);
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
