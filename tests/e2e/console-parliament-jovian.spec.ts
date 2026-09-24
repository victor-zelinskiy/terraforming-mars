import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, pressUntil, settle,
} from './consoleStart';
import {answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, openParliament, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';

/**
 * JOVIAN TAX RIGHTS (Turmoil Redux, RX17) — the ONE e2e of the card's new
 * mechanism: a counted term over the seat's COLONIES (its cubes on the colony
 * tiles — the sixth kind of count), read beside a plain titanium-by-influence
 * part, with the cap on the production part alone and influence NOT a term of
 * it. Two moments of one journey, on one profile (the owner's budget — one e2e
 * per new mechanic):
 *
 *   PART 1 · THE VOTE (fixture `parliament-jovian-vote`): the panel reads TWO
 *   lines, each with its own inputs — «[influence] 3 → +3 titanium» and
 *   «[colony] 4 → +4 M€ production»; the production line prints NO influence
 *   input (the card prints no influence beside the colony) and wears its
 *   HORIZON («pays from the next generation») — today's titanium and next
 *   generation's income are never one sum. The fullscreen prints the
 *   production formula WITHOUT an influence term, the qualification rule and
 *   the LIST of tiles behind the number («Луна ×2 · Титан · Миранда»).
 *
 *   PART 2 · THE SITTING (fixture `parliament-jovian-assembly`; red wins, so
 *   blue is paid exactly the vote's numbers): the «+3» titanium chip is born
 *   inside the law's printed graphic and lands on the rail's TITANIUM cell,
 *   the counter ticking on contact; only after it has landed does the «+4»
 *   production step leave the card for the M€ production zone. Two parts of
 *   one seat, in turn. The record is the server's — titanium, then production
 *   with the frozen list of tiles — and the results read the parts «+3 · +4».
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; every sample
 * carries whether the source and the destination were VISIBLE and where each
 * chip stood, so a claim of «born here, landed there» is judged on frames.
 * Screens under screenshots/parliament-jovian/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-jovian', 'standard-1080');
const RIGHTS_ID = 'RDX_UNITY_JOVIAN_TAX_RIGHTS';
const RIGHTS_INSTANCE = `${RIGHTS_ID}#0`;
const RIGHTS_CLASS = /rdx-unity-jovian-tax-rights/;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Reading = {effect: string | null, context: string | null, count: string | null, influence: string | null, amount: string | null, max: string | null, skipped: string | null};

/** The readings a yield block prints, by effect and context — every input the number stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    effect: el.closest<HTMLElement>('[data-yield-effect]')?.getAttribute('data-yield-effect') ?? null,
    context: el.getAttribute('data-yield-context'),
    count: el.getAttribute('data-yield-count'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    max: el.getAttribute('data-yield-max'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

type Outcome = {player: string, step: string, kind: string, amount?: number, count?: number, influence?: number, countedColonies?: Array<string>, uncapped?: number, before?: number, after?: number, reason?: string};
type Wire = {
  thisPlayer: {color: string, titanium: number, megaCreditProduction?: number},
  game: {parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Rect = {x: number, y: number, w: number, h: number};
type Chip = {id: string, x: number, y: number, kind: 'stock' | 'production', dir: string, amt: string};
type Sample = {
  t: number; stage: string; chips: Array<Chip>;
  mech: Rect | undefined; mechVisible: boolean;
  titaniumCell: Rect | undefined; titaniumVisible: boolean;
  prod: Rect | undefined;
  titanium: string; production: string;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__jovianProbe: Probe};
    w.__jovianProbe = {samples: []};
    const rectOf = (el: Element | null): Rect | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width < 2 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const visible = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return false;
      }
      for (let a: Element | null = el; a !== null; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) {
          return false;
        }
      }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && (el.contains(hit) || hit.contains(el));
    };
    const sample = () => {
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        const kind: 'stock' | 'production' = el.classList.contains('con-transfer__chip--production') ? 'production' : 'stock';
        return {
          id: `${el.dataset.transferId ?? '?'}`, x: r.left + r.width / 2, y: r.top + r.height / 2, kind,
          dir: el.dataset.transferDirection ?? 'gain', amt: el.textContent?.trim() ?? '',
        };
      });
      const card = document.querySelector('[data-parl-sit-hero] .con-parl__gov-card .pcard') ?? document.querySelector('.con-parl [data-parl-gov-carry] .con-parl__gov-card .pcard');
      const mech = card?.querySelector('.pcard__mech') ?? null;
      const titaniumRow = document.querySelector('.con-res__row--titanium');
      const titaniumCell = titaniumRow?.querySelector('.con-res__stockwrap') ?? null;
      const mcRow = document.querySelector('.con-res__row--megacredits');
      const prod = mcRow?.querySelector('.con-res__prod') ?? null;
      w.__jovianProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        chips,
        mech: rectOf(mech),
        mechVisible: visible(mech),
        titaniumCell: rectOf(titaniumCell),
        titaniumVisible: visible(titaniumCell),
        prod: rectOf(prod),
        titanium: titaniumRow?.querySelector('.con-res__digits')?.textContent?.trim() ?? '',
        production: prod?.textContent?.trim() ?? '',
      });
      if (w.__jovianProbe.samples.length > 9000) {
        w.__jovianProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__jovianProbe: Probe}).__jovianProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__jovianProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__jovianProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('jovian-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('jovian-probe', {path: file, contentType: 'application/json'});
  }
});

function inside(p: {x: number, y: number}, r: Rect | undefined, slack = 2): boolean {
  return r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}

/** The LANDING frame of a chip: the first sample from which it stays AT REST where it ends (the absorb scales it in place). */
function landingIndex(track: ReadonlyArray<{i: number, c: Chip}>, slack: number): number {
  const end = track[track.length - 1].c;
  let rest = track.length - 1;
  while (rest > 0 && Math.hypot(track[rest - 1].c.x - end.x, track[rest - 1].c.y - end.y) <= slack) {
    rest--;
  }
  return track[rest].i;
}

/** The chips of the probe, grouped into TRACKS by id, in the order they first appeared. */
function tracksOf(samples: ReadonlyArray<Sample>): Array<Array<{i: number, s: Sample, c: Chip}>> {
  const tracks = new Map<string, Array<{i: number, s: Sample, c: Chip}>>();
  samples.forEach((s, i) => {
    for (const c of s.chips) {
      const track = tracks.get(c.id) ?? [];
      track.push({i, s, c});
      tracks.set(c.id, track);
    }
  });
  return Array.from(tracks.values());
}

const digitsOf = (text: string): number => Number((text.match(/-?\d+/) ?? ['NaN'])[0]);

const REST_SLACK_PX = 1;
const TICK_WINDOW_BEFORE_MS = 34;
const TICK_WINDOW_AFTER_MS = 260;

test.describe('Jovian Tax Rights · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the vote reads two lines — titanium by influence, production by colonies with no influence term and its horizon — and the fullscreen names the tiles; then the sitting: the titanium chip lands on its cell, the production step follows, the record keeps the list', async ({page, request}) => {
    test.setTimeout(600_000);

    // ════════════════ PART 1 · THE VOTE — two lines, each with its own inputs ════════════════
    {
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-jovian-vote', {query: '&consoleProfile=auto'});
      await armLeakWitness(page);
      await openParliament(page);

      // ── THE FACE in the voting area: its art (keyed by RX17), Unity's emblem, ONE production box, the Jovian quest graphic.
      const face = page.locator(`.con-parl__slot[data-instance="${RIGHTS_INSTANCE}"] .pcard`);
      await expect(face, 'Jovian Tax Rights stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(RIGHTS_CLASS);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX17');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'Unity\'s emblem').toContain('unity');
      await expect(face.locator('.pcard__mech .pcard-prod'), 'one production box — the counted formula').toHaveCount(1);
      await expect(face.locator('.pcard__quest-graphic'), 'the two-Jovian-tags quest as a graphic').toHaveCount(1);
      await shoot(page, '01-overview');

      // ── THE VOTE MODE: «[influence] 3 → +3 [titanium]» and «[colony] 4 → +4 [M€ production] · from the next generation».
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      await expect(block, 'the two-part block').toHaveCount(1);
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        {effect: 'titanium', context: 'estimate', count: null, influence: '3', amount: '3', max: null, skipped: null},
        {effect: 'production', context: 'estimate', count: '4', influence: '3', amount: '4', max: null, skipped: null},
      ]);
      // THE TITANIUM LINE: the influence is its input.
      await expect(block.locator('[data-yield-effect="titanium"] [data-yield-in="influence"]')).toHaveText('3');
      await expect(block.locator('[data-yield-effect="titanium"] [data-yield-in="count"]'), 'no count on the titanium').toHaveCount(0);
      // THE PRODUCTION LINE: the colonies are its ONLY input — no influence beside them.
      await expect(block.locator('[data-yield-effect="production"] [data-yield-in="count"]')).toHaveText('4');
      await expect(block.locator('[data-yield-effect="production"] [data-yield-in="influence"]'), 'influence is not a term of the production').toHaveCount(0);
      await expect(block.locator('[data-yield-effect="production"] .pcglyph--colony'), 'the counted object is the COLONY tile').toHaveCount(1);
      // …and its HORIZON: it first pays in the next generation — never summed with today's titanium.
      await expect(block.locator('[data-yield-effect="production"] [data-yield-horizon]'), 'the production part wears its horizon').toHaveCount(1);
      await expect(block.locator('[data-yield-effect="production"] [data-yield-horizon]')).toContainText(/следующего поколения|next generation/i);
      await expect(block.locator('[data-yield-effect="titanium"] [data-yield-horizon]'), 'the titanium is today\'s').toHaveCount(0);
      await expect(block.locator('[data-yield-net-line]'), 'no levy — no net line').toHaveCount(0);
      await expect(block.locator('[data-parl-vote-suffix]'), 'Agenda 5 → 6 keeps influence 3: the win changes no number, so no suffix').toHaveCount(0);
      await expect(block.locator('[data-yield-note]'), 'nothing to warn about').toHaveCount(0);
      await expectParliamentFits(page, 'vote mode');
      await shoot(page, '02-vote-two-lines');

      // ── THE FULLSCREEN: the production formula WITHOUT an influence term, the rule, the LIST of tiles behind the number.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(RIGHTS_CLASS);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        {effect: 'titanium', context: 'estimate', count: null, influence: '3', amount: '3', max: null, skipped: null},
        {effect: 'production', context: 'estimate', count: '4', influence: '3', amount: '4', max: null, skipped: null},
      ]);
      // The card beside the readings prints the formula (the block draws none here): the readings alone — the
      // production's inputs are its colonies, never the influence; its horizon rides along.
      const zoomYield = zoom.locator('[data-zoom-yield]');
      await expect(zoomYield.locator('[data-yield-effect="production"] [data-yield-in="count"]')).toHaveText('4');
      await expect(zoomYield.locator('[data-yield-effect="production"] [data-yield-in="influence"]'), 'influence is not a term of the production').toHaveCount(0);
      await expect(zoomYield.locator('[data-yield-effect="titanium"] [data-yield-in="influence"]')).toHaveText('3');
      await expect(zoomYield.locator('[data-yield-effect="production"] [data-yield-horizon]')).toHaveCount(1);
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules, 'the rule says what counts').toContainText(/две колонии на одном тайле дают 2|two colonies on one tile count twice/);
      await expect(rules, 'the list behind the number').toContainText(/Учтены сейчас|Counted right now/);
      await expect(rules).toContainText(/Луна ×2 · Титан · Миранда|Luna ×2 · Titan · Miranda/);
      await expect(rules, 'never «no card»').not.toContainText(/ни одна карта|No card counts/i);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, '03-fullscreen-tiles');
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 15_000});
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      void playerId;
    }

    // ════════════════ PART 2 · THE SITTING — the titanium lands first, the production step follows ════════════════
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-jovian-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);
    const before = await wireOf(request, playerId);
    await shoot(page, '04-verdict');

    // ── GATE 1: A on the verdict; red answers over the API — the effects run by themselves.
    await armProbe(page);
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await expect(page.locator('.con-band [data-sit-awaiting]')).toHaveCount(1, {timeout: 15_000});
    const titaniumBefore = (await readProbe(page)).samples.slice(-1)[0].titanium;
    await answerGateAs(request, red, 'assembly');

    // ── THE TWO WAVES of the viewer's seat: a titanium gain IN, then a production step IN.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.stage === 'reward' && s.chips.some((c) => c.kind === 'stock')),
      {timeout: 30_000, message: 'the titanium chip flew on the reward page'}).toBe(true);
    await shoot(page, '05-titanium-flies');
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.chips.some((c) => c.kind === 'production')),
      {timeout: 60_000, message: 'the production step\'s chip flew'}).toBe(true);
    await expect.poll(async () => (await readProbe(page)).samples.slice(-1)[0].chips.length, {timeout: 60_000, message: 'the last chip landed'}).toBe(0);
    await shoot(page, '06-production-lands');

    const probe = await readProbe(page);
    const tracks = tracksOf(probe.samples).filter((tr) => tr[0].s.stage === 'reward');
    const gain = tracks.find((tr) => tr[0].c.kind === 'stock');
    const prod = tracks.find((tr) => tr[0].c.kind === 'production');
    expect(tracks.some((tr) => tr[0].c.dir === 'loss'), 'nothing leaves — the card takes nothing').toBe(false);
    expect(gain, 'a titanium GAIN chip flew on the reward page').toBeDefined();
    expect(prod, 'a PRODUCTION chip flew on the reward page').toBeDefined();
    if (gain === undefined || prod === undefined) {
      return;
    }

    // ① THE TITANIUM: born inside the card's printed mechanic (visible), reads «+3», lands on the TITANIUM cell (visible), ticking on contact.
    const gainFirst = gain[0];
    expect(gainFirst.c.amt, 'the chip carries the paid amount').toContain('+3');
    expect(gainFirst.s.mechVisible, 'the card\'s mechanic was VISIBLE when the chip was born').toBe(true);
    expect(inside({x: gainFirst.c.x, y: gainFirst.c.y}, gainFirst.s.mech, 8), `the titanium is BORN inside the card's printed mechanic (${JSON.stringify({chip: [gainFirst.c.x, gainFirst.c.y], mech: gainFirst.s.mech})})`).toBe(true);
    const gainLandedAt = landingIndex(gain, REST_SLACK_PX);
    const gainLast = gain[gain.length - 1];
    expect(gainLast.s.titaniumVisible, 'the titanium cell was VISIBLE when the chip landed').toBe(true);
    expect(inside({x: gainLast.c.x, y: gainLast.c.y}, gainLast.s.titaniumCell, 10), `the titanium LANDED on the titanium cell (${JSON.stringify({chip: [gainLast.c.x, gainLast.c.y], cell: gainLast.s.titaniumCell})})`).toBe(true);
    const gainTravel = gain.slice(1).reduce((sum, p, k) => sum + Math.hypot(p.c.x - gain[k].c.x, p.c.y - gain[k].c.y), 0);
    expect(gainTravel, `the titanium TRAVELLED (${Math.round(gainTravel)} px)`).toBeGreaterThan(200);
    const gainTickAt = probe.samples.findIndex((s, i) => i >= gainFirst.i && digitsOf(s.titanium) !== digitsOf(titaniumBefore));
    expect(gainTickAt, `the titanium counter ticked (was «${titaniumBefore}»)`).toBeGreaterThan(0);
    const gainLag = probe.samples[gainTickAt].t - probe.samples[gainLandedAt].t;
    expect(gainLag, `the tick rides the touchdown (${Math.round(gainLag)} ms)`).toBeGreaterThanOrEqual(-TICK_WINDOW_BEFORE_MS);
    expect(gainLag).toBeLessThanOrEqual(TICK_WINDOW_AFTER_MS);
    expect(digitsOf(probe.samples[gainTickAt].titanium) - digitsOf(titaniumBefore), 'the whole +3 landed').toBe(3);
    test.info().annotations.push({type: 'titanium', description: `born ${Math.round(gainFirst.c.x)},${Math.round(gainFirst.c.y)} → landed ${Math.round(gainLast.c.x)},${Math.round(gainLast.c.y)}; tick ${Math.round(gainLag)} ms after landing`});

    // ② THE PRODUCTION STEP: only AFTER the titanium landed, the «+4» chip into the M€ production zone — two parts, in turn.
    const prodFirst = prod[0];
    expect(prodFirst.i, 'the production step left the card only once the titanium had landed — surfaces in turn').toBeGreaterThan(gainLandedAt);
    expect(prodFirst.c.amt).toContain('+4');
    expect(inside({x: prodFirst.c.x, y: prodFirst.c.y}, prodFirst.s.mech, 8), 'the production step is BORN inside the card\'s printed mechanic').toBe(true);
    const prodLast = prod[prod.length - 1];
    expect(inside({x: prodLast.c.x, y: prodLast.c.y}, prodLast.s.prod, 10), 'the production step LANDED on the M€ production zone').toBe(true);
    await expect.poll(async () => digitsOf((await readProbe(page)).samples.slice(-1)[0].production), {timeout: 10_000, message: 'the production readout reached +4'}).toBe(4);

    // ── THE RECORD is the server's: +3 titanium by influence 3, then +4 production from FOUR cubes with the frozen LIST — the printed order.
    const wire = await wireOf(request, playerId);
    const mine = (wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === wire.thisPlayer.color);
    expect(mine.map((o) => o.step)).toEqual(['titanium', 'production']);
    expect(mine[0]).toMatchObject({kind: 'stock', amount: 3, influence: 3});
    expect(mine[1]).toMatchObject({kind: 'production', amount: 4, count: 4, uncapped: 4});
    expect(mine[1].countedColonies).toEqual(['Luna', 'Luna', 'Titan', 'Miranda']);
    expect(wire.thisPlayer.titanium - before.thisPlayer.titanium, 'the titanium is in the supply').toBe(3);

    // ── THE RESULTS read the two parts signed — «+3 · +4», no skip, no net.
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    const row = page.locator(`[data-sit-payout][data-sit-payout-seat="${wire.thisPlayer.color}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-sit-part-amount]')).toHaveCount(2);
    await expect(row.locator('[data-sit-part-amount]').nth(0)).toHaveText('+3');
    await expect(row.locator('[data-sit-part-amount]').nth(1)).toHaveText('+4');
    await expect(row.locator('[data-sit-part="skipped"]'), 'nothing was skipped for this seat').toHaveCount(0);
    await expect(row.locator('[data-sit-net]'), 'no levy — no net').toHaveCount(0);
    await settle(page, {timeoutMs: 30_000});
    await expectParliamentFits(page, 'results');
    await shoot(page, '07-results');
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
