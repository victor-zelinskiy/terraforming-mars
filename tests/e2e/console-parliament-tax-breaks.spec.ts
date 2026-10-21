import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, answerGateOnScreen, armLeakWitness, closeSitting, expectParliamentFits, mandatoryPlate, openParliament, parliament, sittingStage,
  strandedReports, waitSittingAtRest,
} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TAX BREAKS (Turmoil Redux, RX41) — the ONE e2e of the card: an ASSEMBLY of Central Power Grid's payout (M€ production
 * = count + influence, max 5) over Sponsored Projects' reading of the seat's cards, measured BY KIND. Two profiles
 * (standard-1080 · tv4k):
 *
 *   PART 0 (`parliament-tax-breaks-vote` — blue Fish 2 · Birds 1 · Dirigibles 1 · Supercomputer 3 · Pets 0 at influence 3):
 *   ① the vote panel reads «[holder ?] 3 + [influence] 3 → +5 MAX» with the sum before the cap (6) on the plate, and
 *      the KINDS line: animals (Fish · Birds), floaters (Dirigibles), data (Supercomputer) — Pets, at 0, nowhere;
 *      the counted object is the holder carrying the printed «?», never RX40's three cubes; the inspector (X) names
 *      the kinds in words.
 *   PART 1 (`parliament-tax-breaks-assembly` — the same table, blue's delegate on the card):
 *   ② the verdict's A (red over the API) → the reward wave: ONE production token born on the law and landing on the
 *      rail's M€ PRODUCTION cell, the cell ticking 2 → 7 on the touchdown, never before; nothing over glass;
 *   ③ the results: blue «+5» production; server truth — M€ production 2 → 7, red 1 → 3 (1 type + influence 1).
 *   PART 2: the «Полигон» stand — the counted-holders family's cap scenario reads «6 → 5 MAX».
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF. Screens + the storyboard under
 * screenshots/parliament-tax-breaks/<profile>/ (the 4K storyboard is trusted on the GPU only — `TM_E2E_GPU=1`).
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-tax-breaks');
const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;
const TAX_INSTANCE = 'RDX_INDUSTRIALISTS_TAX_BREAKS#0';

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Wire = {
  thisPlayer: {color: string, megacreditProduction: number},
  game: {generation: number, parliament: {lastPhase?: {outcomes?: Array<{player: string, kind: string, amount?: number}>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type CastFrame = {wall: number, data: string};

async function recordFrames(page: Page): Promise<{frames: Array<CastFrame>, stop: () => Promise<void>}> {
  const frames: Array<CastFrame> = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (frame) => {
    frames.push({wall: (frame.metadata.timestamp ?? 0) * 1000, data: frame.data});
    if (frames.length > 900) {
      frames.splice(0, 300);
    }
    cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return {
    frames,
    stop: async () => {
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    },
  };
}

function writeFrameAt(frames: ReadonlyArray<CastFrame>, wall: number, preset: string, name: string): void {
  let best: CastFrame | undefined;
  for (const frame of frames) {
    if (best === undefined || Math.abs(frame.wall - wall) < Math.abs(best.wall - wall)) {
      best = frame;
    }
  }
  if (best === undefined || Math.abs(best.wall - wall) > 300) {
    console.log(`[tax-breaks ${preset}] no screencast frame near ${name}`);
    return;
  }
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${name}.jpg`), Buffer.from(best.data, 'base64'));
  console.log(`[tax-breaks ${preset}] ${name}: frame Δ${Math.round(best.wall - wall)} ms`);
}

type Sample = {t: number, wall: number, tick: boolean, stage: string, prod: string, chips: number, beat: string, ruler: string, rulerFits: boolean, rulerDiag: string};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered: the M€ production cell, the chips in the air, the sitting's beat. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__rx41: Probe};
    w.__rx41 = {samples: []};
    const sample = (tick: boolean) => {
      const root = document.querySelector('.con-parl');
      // THE RULER'S NAME on the dais: whole in its own box AND inside the government's plate — never cut by an ancestor.
      const name = document.querySelector<HTMLElement>('[data-parl-ruler-slot] .con-pseal__name');
      const plate = document.querySelector('.con-parl__gov')?.getBoundingClientRect();
      const nr = name?.getBoundingClientRect();
      const range = name === null ? undefined : document.createRange();
      range?.selectNodeContents(name!);
      const ink = range?.getBoundingClientRect();
      // A change of government FLIPs the tile across tiers (`con-parl--swapping`): mid-flight it legitimately stands outside.
      const swapping = root?.classList.contains('con-parl--swapping') === true;
      const rulerFits = swapping || name === null || plate === undefined || nr === undefined || ink === undefined || nr.width < 1 ||
        (name.scrollWidth <= name.clientWidth + 1 && ink.left >= plate.left - 1 && ink.right <= plate.right + 1);
      w.__rx41.samples.push({
        ruler: name?.textContent?.trim() ?? '',
        rulerFits,
        rulerDiag: name === null || ink === undefined || plate === undefined ? '' :
          `sw ${name.scrollWidth}/${name.clientWidth} ink ${Math.round(ink.left)}..${Math.round(ink.right)} plate ${Math.round(plate.left)}..${Math.round(plate.right)} fs ${getComputedStyle(name).fontSize} ${name.className}` +
          ['.con-parl__ruler', '[data-parl-ruler-slot]', '[data-parl-ruler-slot] .con-pseal', '[data-parl-ruler-slot] .con-pseal__head'].map((sel) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return r === undefined ? '' : ` ${sel.replace(/.*\s/, '')} ${Math.round(r.left)}..${Math.round(r.right)}`;
          }).join('') + ((el) => el === null ? '' : ` pad ${getComputedStyle(el).paddingLeft}/${getComputedStyle(el).paddingRight} cols ${getComputedStyle(el).gridTemplateColumns} cls ${el.className}`)(
            document.querySelector('[data-parl-ruler-slot] .con-pseal')),
        t: performance.now(),
        wall: Date.now(),
        tick,
        stage: root?.getAttribute('data-sitting-stage') ?? '',
        prod: document.querySelector('.con-res__row--megacredits .con-res__prod')?.textContent?.trim() ?? '',
        chips: Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').length,
        beat: `${root?.getAttribute('data-sitting-page') ?? ''}/${root?.getAttribute('data-sitting-motion') ?? ''}/${root?.getAttribute('data-sitting-beat') ?? ''}`,
      });
      if (w.__rx41.samples.length > 16000) {
        w.__rx41.samples.splice(0, 2000);
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['style', 'class', 'data-sitting-beat', 'data-sitting-stage']});
    window.setInterval(() => sample(true), 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__rx41: Probe}).__rx41);

test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__rx41?: Probe, __conReady?: () => unknown};
    return {samples: w.__rx41?.samples.slice(-16000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('tax-breaks-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('tax-breaks-probe', {path: file, contentType: 'application/json'});
  }
});

for (const preset of PRESETS) {
  test.describe(`Tax Breaks (RX41) · the count by kind · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test(`the vote reads 3 types + influence 3 = 6 → +5 MAX, the kinds with their cards — Pets at 0 nowhere (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'parliament-tax-breaks-vote', {query: preset.query});
      await armLeakWitness(page);
      await openParliament(page);
      const face = page.locator(`.con-parl__slot[data-instance="${TAX_INSTANCE}"] .pcard`);
      await expect(face, 'Tax Breaks stands in the voting area').toHaveCount(1);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX41');
      // THE FACE's counted object: the holder carrying ONE printed «?» — never RX40's three cubes.
      await expect(face.locator('.pcard__mech .presourcecard--wild'), 'the holder with the printed «?»').toHaveCount(1);
      await expect(face.locator('.pcard__mech .presourcecard__cube'), 'no three cubes on this face').toHaveCount(0);
      await expect(face.locator('.pcard__mech'), 'the cap on the face').toContainText(/макс\. 5|max 5/i);

      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      const plate = block.locator('[data-yield-context="estimate"]');
      await expect(plate, 'one reading: the estimate').toHaveCount(1);
      await expect(plate).toHaveAttribute('data-yield-count', '3');
      await expect(plate).toHaveAttribute('data-yield-influence', '3');
      await expect(plate).toHaveAttribute('data-yield-amount', '5');
      await expect(plate, 'the sum before the cap rides the plate').toHaveAttribute('data-yield-uncapped', '6');
      await expect(plate, 'MAX is part of the number').toHaveAttribute('data-yield-max', 'true');
      await expect(block.locator('.pcglyph[data-count-resource-kinds="true"]').first(), 'the counted object in the reading is the holder with the «?»').toBeVisible();
      // THE KINDS LINE: three kinds, each with its cards; Pets (at 0) is not one.
      const kinds = page.locator('[data-parl-vote-kinds]');
      await expect(kinds, 'the kinds line').toHaveAttribute('data-parl-vote-kinds-count', '3');
      expect(await kinds.locator('[data-parl-vote-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-parl-vote-kind'))), 'the kinds in play order').toEqual(['Animal', 'Floater', 'Data']);
      await expect(kinds.locator('[data-parl-vote-kind="Animal"]'), 'Fish and Birds under one kind').toContainText(/Рыба.*Птицы|Fish.*Birds/);
      await expect(kinds, 'Pets, at 0, is not in the breakdown').not.toContainText(/Домашние любимцы|Pets/);
      await expect(kinds.locator('[data-parl-vote-kinds-total]'), 'the count\'s own noun').toContainText(/3/);
      await expect(page.locator('[data-parl-vote-holders]'), 'no RX40 holders line — nothing lands on these cards').toHaveCount(0);
      // PL-785: the reading SITS in its frame — scaled up from ×1 when the frame has room, and the plate stays ONE line
      // (its inputs and its result on one row — a scale bought by wrapping the plate is refused).
      const fit = Number(await page.locator('.con-parl__info-readings').getAttribute('data-reading-fit'));
      console.log(`[tax-breaks ${preset.id}] reading fit ×${fit}`);
      expect(fit, 'the reading took the frame\'s room').toBeGreaterThan(1);
      const rows = await plate.evaluate((el) => {
        const top = (sel: string) => el.querySelector(sel)?.getBoundingClientRect();
        const a = top('.con-iyield__in');
        const b = top('.con-iyield__out');
        return a === undefined || b === undefined ? 'missing' : Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < Math.max(a.height, b.height) / 2 ? 'one' : 'two';
      });
      expect(rows, 'the plate reads on ONE line — inputs and result side by side').toBe('one');
      await expectParliamentFits(page, `${preset.id} vote`);
      await shoot(page, preset.id, '01-vote-panel');

      // THE INSPECTOR (X): the face large, and «ДЛЯ ВАС» names the kinds in words.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(/rdx-industrialists-tax-breaks/);
      await expect(zoom.locator('.con-zoom-sidecol'), 'the counted kinds behind the number').toContainText(/Учтены сейчас|Counted right now/);
      await expect(zoom.locator('.con-zoom-sidecol')).toContainText(/Животное — Рыба, Птицы|Animal — Fish, Birds/);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '02-face-inspector');
      await closeZoomViewer(page);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    });

    test(`the enactment: ONE production token from the law to the rail, the cell ticking 2 → 7 on its touchdown; the results +5 (${preset.id})`, async ({page, request}) => {
      test.setTimeout(600_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-tax-breaks-assembly', {query: preset.query, landing: 'prompt'});
      const red = seats[1];
      await armLeakWitness(page);
      await expect(mandatoryPlate(page), 'the sitting is announced').toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      await waitSittingAtRest(page, 30_000);
      const before = await wireOf(request, playerId);
      expect(before.thisPlayer.megacreditProduction, 'blue\'s M€ production before the law').toBe(2);
      const redBefore = await wireOf(request, red);

      await armProbe(page);
      await armTransferWitness(page);
      const cast = await recordFrames(page);
      await answerGateOnScreen(page, request, playerId, 'assembly');
      await answerGateAs(request, red, 'assembly');

      // ② THE WAVE: the production token leaves the law and lands on the rail's M€ production cell.
      await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.chips > 0), {timeout: 60_000, message: 'the wave left the law'}).toBe(true);
      await expect.poll(() => sittingStage(page), {timeout: 180_000, message: 'the walk reaches the results'}).toBe('results');
      const probe = await readProbe(page);
      const ticks = probe.samples.filter((s) => s.tick);
      {
        let lastKey = '';
        const lines: Array<string> = [];
        ticks.forEach((s) => {
          const key = `${s.stage} ${s.beat} prod:${s.prod} chips:${s.chips}`;
          if (key !== lastKey) {
            lines.push(`${Math.round(s.t)} ${key}`);
            lastKey = key;
          }
        });
        console.log(`[tax-breaks ${preset.id}] ${lines.join(' | ')}`);
      }
      const witness = await transferWitness(page);
      console.log(`[tax-breaks ${preset.id}] ${transferTrail(witness)}`);
      expect(endsOverGlass(witness), 'no end of a flight over glass').toEqual([]);
      const railLandings = witness.landings.filter((end) => end.under === 'rail:megacredits');
      expect(railLandings.length, 'a token landed on the M€ row of the rail').toBeGreaterThanOrEqual(1);
      const births = witness.births.filter((b) => railLandings.some((l) => l.id === b.id));
      expect(births.every((b) => b.under === 'law'), `the token is born on the law's own face (births: ${births.map((b) => b.under).join(', ')})`).toBe(true);
      // THE CELL TICKS ON THE TOUCHDOWN: «2» until the token's contact, then «7» — never before.
      const witnessT0 = await page.evaluate(() => (window as unknown as {__transferWitness?: {t0: number}}).__transferWitness?.t0 ?? 0);
      const touchedAt = witnessT0 + Math.min(...railLandings.map((end) => end.touched ?? end.t));
      const tickedAt = probe.samples.find((s) => s.prod !== '' && !/^\+?2$/.test(s.prod))?.t;
      expect(tickedAt, 'the M€ production cell ticked').toBeDefined();
      expect(tickedAt!, `the cell ticks on the token's touchdown, not before (tick ${Math.round(tickedAt!)} · touch ${Math.round(touchedAt)})`).toBeGreaterThanOrEqual(touchedAt - 40);

      // THE RULER'S NAME on the dais — «ИНДУСТРИАЛИСТЫ», one long word — stands whole on every sample it is drawn in
      // (PL-801: an ancestor cut it to «…ДУСТРИАЛИСТЫ» at 1080 and 4K).
      const industrial = probe.samples.filter((s) => /ИНДУСТРИАЛИСТЫ|INDUSTRIALISTS/i.test(s.ruler));
      expect(industrial.length, 'the Industrialists stood on the dais').toBeGreaterThan(0);
      const cut = industrial.filter((s) => s.tick && !s.rulerFits);
      expect(cut.length, `the ruler's name is never cut on the dais (first: ${cut[0]?.stage} ${cut[0]?.rulerDiag})`).toBe(0);

      // THE STORYBOARD (4K on the GPU): the first chip in the air, the touchdown, the results.
      // The REWARD's production token in the air (the Agenda step's TR token flies a page earlier, on the enactment).
      // Mid-flight: halfway between the token's birth on the law and the cell's tick.
      const born = ticks.find((s) => s.stage === 'reward' && s.chips > 0);
      const mid = born === undefined || tickedAt === undefined ? undefined : (born.t + tickedAt) / 2;
      const air = mid === undefined ? born : ticks.find((s) => s.t >= mid);
      const after = ticks.find((s) => tickedAt !== undefined && s.t >= tickedAt);
      await cast.stop();
      for (const [sample, name] of [[air, '03-wave-air'], [after, '03b-wave-landed']] as const) {
        if (sample !== undefined) {
          writeFrameAt(cast.frames, sample.wall, preset.id, name);
        }
      }

      // ③ THE RESULTS and the server's truth.
      await expect(page.locator('[data-sit-results-hidden]'), 'the results card revealed by its own beat').toHaveCount(0, {timeout: 30_000});
      await waitSittingAtRest(page, 20_000);
      const blueRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${before.thisPlayer.color}"]`);
      await expect(blueRow.locator('[data-sit-part="production"] [data-sit-part-amount]'), 'blue: +5 production').toHaveAttribute('data-sit-part-amount', '5');
      await shoot(page, preset.id, '04-results');
      // RED's NAMED SKIP (Tardigrades at 0, influence 0): the reason is printed WHOLE — never «Ни на одной…» (PL-796).
      const redRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${redBefore.thisPlayer.color}"]`);
      const reason = redRow.locator('[data-sit-part="skipped"] [data-sit-part-reason]');
      await expect(reason, 'red\'s skip names its reason').toContainText(/Ни на одной карте нет ресурса и нет влияния|No resources on your cards and no influence/);
      expect(await reason.evaluate((el) => {
        const plate = el.closest('[data-sit-payout]')!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return el.scrollWidth <= el.clientWidth + 1 && r.left >= plate.left - 1 && r.right <= plate.right + 1;
      }), 'the skip\'s reason stands whole inside its plate — no ellipsis, nothing past the plate').toBe(true);
      await expectParliamentFits(page, `${preset.id} results`);
      const end = await wireOf(request, playerId);
      expect(end.thisPlayer.megacreditProduction, 'blue: 3 types + influence 3 = 6 → +5').toBe(7);
      const redEnd = await wireOf(request, red);
      expect(redEnd.thisPlayer.megacreditProduction, 'red: a holder at 0 is no type, influence 0 — nothing').toBe(redBefore.thisPlayer.megacreditProduction);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      await closeSitting(page, request, playerId);
      await answerGateAs(request, red, 'adjourn');
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    });

    test(`the stand: the counted-holders family's cap scenario reads «6 → 5 MAX» (${preset.id})`, async ({page}) => {
      test.setTimeout(180_000);
      await page.goto(`/?resolutionsPlayground${preset.query}`);
      await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});
      const onRx41 = await pressUntil(page, 'ArrowRight',
        async () => await page.locator('[data-rxpg-catalog] .con-rxpg__slot--cursor[data-rxpg-code="RX41"]').count() > 0,
        {tries: 60, settleMs: 300});
      expect(onRx41, 'the catalog cursor reaches RX41').toBe(true);
      await pressUntil(page, 'BracketRight', async () => await page.locator('[data-rxpg-scenario="kinds-three"]').count() > 0, {tries: 3, settleMs: 700});
      await expect(page.locator('[data-rxpg-scenario="kinds-three"]'), 'the family opens on «three types on four cards»').toHaveClass(/con-rxpg__scenario--active/, {timeout: 15_000});
      await expect(page.locator('[data-rxpg-scenario="each-three-kinds"]'), 'RX40\'s receipt scenarios are not this law\'s').toHaveCount(0);
      await page.locator('[data-rxpg-scenario="kinds-vote"]').click();
      await expect(page.locator('[data-rxpg-scenario="kinds-vote"]')).toHaveClass(/con-rxpg__scenario--active/);
      await settle(page, {timeoutMs: 10_000});
      const capped = page.locator('[data-rxpg-yield] [data-yield-uncapped="6"][data-yield-amount="5"]');
      await expect(capped.first(), '«3 + 3 = 6 → 5 MAX» on the stand').toBeVisible();
      // PL-803: «КАРТЫ В ИГРЕ» reads the seat's HOLDINGS — the four holders ticked (Fish and Birds two cards, one kind),
      // Pets at 0 named and not counted, and the row's number IS the reading's 3 (it printed «0 · Карт в игре нет»).
      const tableau = page.locator('[data-rxpg-tableau="blue"]');
      await expect(tableau.locator('[data-rxpg-count]'), 'the row\'s number is the measure — 3 kinds').toHaveText('3');
      await expect(tableau.locator('[data-rxpg-card][data-rxpg-counts="true"]'), 'four holders ticked').toHaveCount(4);
      await expect(tableau.locator('[data-rxpg-card="Pets"]'), 'Pets at 0 is named, not counted').toHaveAttribute('data-rxpg-counts', 'false');
      await expect(tableau.locator('[data-rxpg-card="Fish"] .con-rxpg__tcard-verdict'), 'a holder names its kind and its number').toContainText(/(Животное|Animal) 2/);
      await shoot(page, preset.id, '05-stand-cap');
      await tableau.scrollIntoViewIfNeeded();
      // The faces' art is `loading="lazy"`: scrolled into view, it loads now — the frame waits for every picture.
      await expect.poll(async () => await tableau.locator('img').evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).complete)),
        {timeout: 10_000}).toBe(true);
      await shoot(page, preset.id, '05b-stand-holders');
    });
  });
}
