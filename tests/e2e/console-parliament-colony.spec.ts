import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, fetchPlayerModel, openMandatoryAnnounce, placeTile, placementState, press, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * COLONY CONTEST (Turmoil Redux, RX09) — titanium by influence for everyone and
 * the winner's COLONY built FOR FREE: the first winner's part that is not a tile
 * on Mars, and the first time the COLONIES SCREEN stands INSIDE the sitting as
 * its own step. ONE e2e, the whole reward stage on one profile (the owner's
 * budget: one new e2e per new mechanic, a few frames of the NEW):
 *
 *   ① the TITANIUM WAVE first: the chip leaves the hero card, the rail's titanium
 *     counter ticks on the touchdown — the colony grid does NOT stand before it
 *     (the door is admission-gated: «one press, several effects — in turn»);
 *   ② the COLONIES GRID stands INSIDE the Parliament's stage zone — the frame's
 *     own slot, not a band of its own: host-agnostic (no head, no motion id),
 *     the hero card stays, the crumb reads «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › КОЛОНИИ»;
 *   ③ TITAN: the build stage inside the same zone, its build-bonus TARGET step
 *     (3 floaters onto one of two holders) — the recipient pick opens ONE level
 *     deeper, still inside the sitting; X commits the build;
 *   ④ the frame LEAVES, the sitting comes back to its stage and walks on by
 *     itself to the RESULTS: blue's payouts read the titanium and the colony on
 *     Titan; the floaters landed; nothing stranded, no two live bodies at once,
 *     the crumb continuous, the band still.
 *   ⑤ (a separate journey) EUROPA: the build's own ocean — the sitting steps to
 *     the BOARD with the colonies frame alive in the yielded stack, the ocean
 *     is placed, the stack comes back, the frame leaves, the results name Europa.
 *
 * Fixture: `parliament-colony-assembly` (blue: delegate on the card, Agenda step
 * 2 → 3 = influence 2 → 2 titanium, Atmo Collectors + Jovian Lanterns; red:
 * step 1 → 1 titanium, a cube on Callisto; the table Luna · Titan · Europa ·
 * Callisto). Screenshots under screenshots/parliament-colony/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-colony');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const STAGE = '.con-parl [data-embed-slot="parliament-stage"]';
const GRID = `${STAGE} .con-colonies`;
const FOCUS = `${STAGE} .con-colfocus`;
const TARGETS = `${STAGE} .con-colfocus__targetstage`;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Outcome = {player: string, step: string, kind: string, part?: string, amount?: number, colony?: string, reason?: string};
type Wire = {
  thisPlayer: {color: string, titanium: number, tableau: Array<{name: string, resources?: number}>},
  game: {generation: number, phase: string, oceans: number, parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
  waitingFor?: {type?: string, parliamentPhasePrompt?: unknown},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Rect = {x: number, y: number, w: number, h: number};
type Sample = {
  t: number;
  stage: string;
  step: string;
  crumb: string;
  /** What stands in the stage's zone / the panel right now (laid out and visible). */
  zone: {grid: boolean, focus: boolean, targets: boolean, task: boolean, results: boolean};
  /** The embedded grid carries no motion id and no head of its own. */
  gridMotionId: string | null;
  gridHead: boolean;
  chips: Array<{x: number, y: number, res: string}>;
  ti: string;
  /** The director's own state on the section root (page / beat / motion), the field pose and the step's door. */
  walk: string;
  field: boolean;
  door: boolean;
  /** The reward ledger's counts (owed · flying · landed) — the console's own readiness facts. */
  pr: string;
  heroRect: Rect | undefined;
  bandH: number;
  bodyEmpty: boolean;
  hero: boolean;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — a task clock (`setInterval` + `MutationObserver`), never rAF; armed BEFORE the gate is answered. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({stage, grid, focus, targets}) => {
    const w = window as unknown as {__colonyProbe: Probe};
    w.__colonyProbe = {samples: []};
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
      for (let n: Element | null = el; n !== null && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
          return false;
        }
      }
      return true;
    };
    const sample = () => {
      const gridEl = document.querySelector<HTMLElement>(grid);
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        const icon = el.querySelector<HTMLElement>('.con-transfer__icon');
        const res = icon === null ? 'megacredits' : (Array.from(icon.classList).find((c) => c.startsWith('resource_icon--')) ?? '').replace('resource_icon--', '');
        return {x: r.left + r.width / 2, y: r.top + r.height / 2, res};
      });
      const heads = Array.from(document.querySelectorAll<HTMLElement>('.con-wshead')).filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
      const head = heads[heads.length - 1];
      const body = document.querySelector<HTMLElement>('.con-parl__bodyzone');
      const bodyEmpty = body !== null && !Array.from(body.children).some((child) => {
        const r = child.getBoundingClientRect();
        const cs = getComputedStyle(child);
        return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      w.__colonyProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        step: document.querySelector('.con-sit')?.getAttribute('data-sit-step') ?? '',
        crumb: head === undefined ? '' : (head.textContent ?? '').replace(/\s+/g, ' ').trim(),
        zone: {
          grid: visible(gridEl),
          focus: visible(document.querySelector(focus)),
          targets: visible(document.querySelector(targets)),
          task: visible(document.querySelector(`${stage} .con-task`)),
          results: visible(document.querySelector('.con-sit__panel--results.con-sit__panel--on [data-sit-results]')),
        },
        gridMotionId: gridEl === null ? null : gridEl.getAttribute('data-motion-surface'),
        gridHead: gridEl !== null && gridEl.querySelector('.con-wshead') !== null,
        chips,
        // The digits' LEADING number only: the delta chip («+2») rides inside the same span for ~2.4 s after the
        // touchdown, and reading the whole text as the count put the tick 2.4 s after the counter had moved.
        ti: ((document.querySelector('.con-res__row--titanium .con-res__digits')?.textContent?.trim() ?? '').match(/^-?\d+/) ?? [''])[0],
        walk: (() => {
          const root = document.querySelector('.con-parl');
          return root === null ? '' : `${root.getAttribute('data-sitting-page') ?? ''}/${root.getAttribute('data-sitting-beat') ?? ''}/${root.getAttribute('data-sitting-motion') ?? ''}`;
        })(),
        field: document.querySelector('.con-parl__stage--field') !== null,
        door: document.querySelector('.con-sit__embed--on') !== null,
        pr: (() => {
          const fn = (window as unknown as {__conReady?: () => {parliamentReward?: {owed: Array<string>, flying: Array<string>, landed: Array<string>}}}).__conReady;
          const pr = fn?.()?.parliamentReward;
          return pr === undefined ? '' : `${pr.owed.length}·${pr.flying.length}·${pr.landed.length}`;
        })(),
        // The CARRIER card wherever it stands: in the government while the wave flies (a plain payout keeps the row of
        // parties), on the sitting's hero slot once the field opens for the step — one element, teleported.
        heroRect: rectOf(document.querySelector('.con-parl [data-parl-sit-hero] .con-parl__gov-card .pcard') ??
          document.querySelector('.con-parl [data-parl-gov-carry] .con-parl__gov-card .pcard')),
        bandH: Math.round(document.querySelector('.con-band')?.getBoundingClientRect().height ?? 0),
        bodyEmpty,
        hero: document.querySelector('[data-parl-sit-hero] .con-parl__gov-card .pcard') !== null,
      });
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 16);
  }, {stage: STAGE, grid: GRID, focus: FOCUS, targets: TARGETS});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__colonyProbe: Probe}).__colonyProbe);

/** The console's own readiness facts (`e2eReadiness.ts`). */
const ready = (page: Page): Promise<{wsDepth: number, wsYielded: boolean, holds: Array<string>}> =>
  page.evaluate(() => (window as unknown as {__conReady: () => {wsDepth: number, wsYielded: boolean, holds: Array<string>}}).__conReady());

/** Walk the embedded grid until the named tile carries the cursor (the tiles are one row; a wrap is guarded). */
async function focusColonyTile(page: Page, name: string): Promise<void> {
  const focused = page.locator(`${GRID} .con-coltile--focused[data-test="con-colony-${name}"]`);
  for (let i = 0; i < 8 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 8 && await focused.count() === 0; i++) {
    await press(page, 'ArrowLeft', 380);
  }
  expect(await focused.count(), `could not focus ${name} on the embedded grid`).toBeGreaterThan(0);
}

/** Boot the fixture, open the sitting, answer gate 1 for both seats — the reward stage begins. */
async function openRewardStage(page: Page, request: APIRequestContext): Promise<{playerId: string, red: string, before: Wire}> {
  const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-colony-assembly', {query: PRESET.query, landing: 'prompt'});
  const red = seats[1];
  await armLeakWitness(page);
  await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
  expect(await openMandatoryAnnounce(page)).toBe(true);
  await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
  await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
  await waitSittingAtRest(page, 30_000);
  await waitSittingAtRest(page, 30_000);
  const before = await wireOf(request, playerId);
  await armProbe(page);
  expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined, {tries: 4, settleMs: 1500}),
    'A answers the assembly gate').toBe(true);
  await answerGateAs(request, red, 'assembly');
  return {playerId, red, before};
}

test.describe(`Colony Contest · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the titanium wave, then the colonies INSIDE the sitting; Titan: the recipient pick one level deeper; the frame leaves and the sitting walks to the results', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId, red, before} = await openRewardStage(page, request);

    // ── ① THE TITANIUM WAVE: the chip flies, the counter ticks on the touchdown — 0 → 2.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.ti === '2'), {timeout: 40_000, message: 'the titanium counter ticked to 2'}).toBe(true);
    let probe = await readProbe(page);
    const tiChips = probe.samples.flatMap((s) => s.chips.filter((c) => c.res === 'titanium').map((c) => ({...c, t: s.t, hero: s.heroRect})));
    expect(tiChips.length, 'the titanium chips flew').toBeGreaterThan(0);
    const first = tiChips[0];
    expect(first.hero, 'the hero card is on screen at the birth').not.toBe(undefined);
    if (first.hero !== undefined) {
      expect(first.x >= first.hero.x - 40 && first.x <= first.hero.x + first.hero.w + 40 && first.y >= first.hero.y - 40 && first.y <= first.hero.y + first.hero.h + 40,
        `the first chip is born on the hero card (chip ${first.x.toFixed(0)},${first.y.toFixed(0)} vs card ${JSON.stringify(first.hero)})`).toBe(true);
    }
    const tick = probe.samples.find((s) => s.ti === '2');
    expect(tick!.t, 'the tick came with the touchdown, never before the chip was in the air').toBeGreaterThan(first.t);

    // ── ② THE COLONIES GRID stands INSIDE the sitting's zone — after the wave, never beside it.
    await expect(page.locator(GRID), 'the colonies stand in the Parliament\'s stage zone').toBeVisible({timeout: 60_000});
    probe = await readProbe(page);
    const gridFirst = probe.samples.find((s) => s.zone.grid);
    // On a miss, the timeline around the two events — the walk's page/beat, the field, the door, the ledger's counts.
    const timeline = (): string => {
      const from = Math.min(gridFirst!.t, tick!.t) - 6000;
      const to = Math.max(gridFirst!.t, tick!.t) + 600;
      let last = -1e9;
      return probe.samples.filter((s) => s.t >= from && s.t <= to && (s.t - last >= 120 ? (last = s.t, true) : false))
        .map((s) => `${(s.t - gridFirst!.t).toFixed(0)}ms stage=${s.stage} step=${s.step} walk=${s.walk} field=${s.field ? 1 : 0} door=${s.door ? 1 : 0} grid=${s.zone.grid ? 1 : 0} ti=${s.ti} chips=${s.chips.filter((c) => c.res === 'titanium').length} pr=${s.pr}`)
        .join('\n');
    };
    expect(gridFirst!.t, `the door opened only after the titanium landed\n${timeline()}`).toBeGreaterThanOrEqual(tick!.t);
    await expect(page.locator(GRID)).toHaveClass(/con-colonies--embedded/);
    await expect(page.locator(`${GRID} .con-wshead`), 'host-agnostic: no head of its own').toHaveCount(0);
    expect(await page.locator(GRID).getAttribute('data-motion-surface'), 'no motion id inside a host zone (the shade guard)').toBeNull();
    await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the resolution is the hero on the left').toHaveClass(/rdx-unity-colony-contest/);
    await expect(page.locator('.con-sit')).toHaveAttribute('data-sit-step', 'colony');
    await expect(page.locator(`${GRID} .con-coltile`)).toHaveCount(4);
    const crumb = await crumbText(page);
    expect(crumb, 'ONE continuous crumb: the workspace, the sitting, the step').toMatch(/парламент|parliament/i);
    expect(crumb).toMatch(/заседание|sitting/i);
    expect(crumb).toMatch(/колонии|colonies/i);
    const barLabels = (await page.locator('.con-cmdbar__label').allTextContents()).map((t) => t.trim()).join(' | ');
    expect(barLabels, `B is «Свернуть» past the commit, never a close (${barLabels})`).toMatch(/свернуть|minimi[sz]e/i);
    await shoot(page, '01-colonies-embedded');
    await expectParliamentFits(page, `${PRESET.id} colonies`);

    // ── ③ TITAN: the build stage inside the same zone; its build-bonus TARGET step opens the recipient pick one level deeper.
    await focusColonyTile(page, 'Titan');
    expect(await pressUntil(page, 'Enter', async () => await page.locator(FOCUS).count() > 0, {tries: 3, settleMs: 1500}), 'A descends into Titan\'s build stage').toBe(true);
    await expect(page.locator(FOCUS)).toBeVisible();
    const stepRows = async (): Promise<Array<{missing: boolean, focused: boolean}>> =>
      page.evaluate((focus) => Array.from(document.querySelectorAll(`${focus} .con-colfocus__steprow`)).map((el) => ({
        missing: el.className.includes('--missing'), focused: el.className.includes('--focused'),
      })), FOCUS);
    expect((await stepRows()).some((r) => r.missing), 'the build asks WHERE the 3 floaters go (two holders)').toBe(true);
    let pickShot = false;
    for (let guard = 0; guard < 12; guard++) {
      const missing = (await stepRows()).find((r) => r.missing);
      if (missing === undefined) {
        break;
      }
      if (!missing.focused) {
        await press(page, 'ArrowDown', 240);
        continue;
      }
      await press(page, 'Enter', 900); // A = descend into the target step
      if (!pickShot && await page.locator(TARGETS).count() > 0) {
        await expect(page.locator(TARGETS), 'the recipient pick stands one level deeper, still inside the sitting').toBeVisible();
        const deeper = await crumbText(page);
        expect(deeper).toMatch(/парламент|parliament/i);
        expect(deeper).toMatch(/заседание|sitting/i);
        await shoot(page, '02-target-pick');
        pickShot = true;
      }
      await press(page, 'Enter', 1200); // A = take the focused candidate
    }
    expect(pickShot, 'the recipient pick was on screen').toBe(true);
    expect((await stepRows()).some((r) => r.missing), 'every decision is in').toBe(false);
    // X commits a build that had a decision (A opens a decision, X commits — one press never means two things).
    expect(await pressUntil(page, 'KeyX', async () => (await wireOf(request, playerId)).game.parliament.phase?.outcomes?.some((o) => o.kind === 'colony') === true,
      {tries: 4, settleMs: 1800}), 'X builds the colony — the server records it').toBe(true);

    // ── ④ THE FRAME LEAVES; the sitting comes back and walks on to the RESULTS by itself.
    await expect(page.locator(GRID), 'the colonies frame left the zone').toHaveCount(0, {timeout: 60_000});
    await expect(page.locator('.con-parl'), 'the Parliament stands — never collapsed by a step\'s end').toHaveCount(1);
    await shoot(page, '03-return');
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    const seat = before.thisPlayer.color;
    const colonyPart = page.locator(`.con-sit [data-sit-payout-seat="${seat}"] [data-sit-part="colony"]`);
    await expect(colonyPart, 'the results read the colony').toHaveCount(1);
    await expect(colonyPart).toContainText(/Титан|Titan/);
    await expect(colonyPart.locator('.con-sit__door-tile--colony'), 'the colony tile glyph').toHaveCount(1);
    await expect(page.locator(`.con-sit [data-sit-payout-seat="${seat}"] [data-sit-part="stock"]`), 'the titanium').toHaveCount(1);
    await expectParliamentFits(page, `${PRESET.id} results`);
    await shoot(page, '04-results');
    // The server's truth: the record names the tile, the floaters landed on a holder, the titanium is in.
    const mid = await wireOf(request, playerId);
    expect(mid.game.parliament.phase?.outcomes?.find((o) => o.player === seat && o.kind === 'colony')).toMatchObject({part: 'winner', colony: 'Titan'});
    expect(mid.thisPlayer.titanium - before.thisPlayer.titanium, '2 titanium for influence 2').toBe(2);
    const floaters = mid.thisPlayer.tableau.filter((c) => c.name === 'Atmo Collectors' || c.name === 'Jovian Lanterns').map((c) => c.resources ?? 0);
    expect(Math.max(...floaters), 'Titan\'s 3 floaters on the chosen holder').toBe(3);
    // The probe's laws: no two live bodies, a continuous crumb, a still band, nothing stranded.
    probe = await readProbe(page);
    const twoBodies = probe.samples.filter((s) => (s.zone.grid || s.zone.focus) && (s.zone.results || s.zone.task));
    expect(twoBodies.length, 'never two live bodies in one frame').toBe(0);
    const gridSamples = probe.samples.filter((s) => s.zone.grid || s.zone.focus || s.zone.targets);
    expect(gridSamples.length, 'the probe saw the colonies inside the zone').toBeGreaterThan(3);
    expect(gridSamples.every((s) => /парламент|parliament/i.test(s.crumb) && /заседание|sitting/i.test(s.crumb)), 'the crumb kept its root and its subject through the whole step').toBe(true);
    expect(gridSamples.every((s) => s.gridMotionId === null && !s.gridHead), 'the embedded grid never carried a motion id or a head').toBe(true);
    expect(gridSamples.every((s) => s.hero), 'the hero stood through the step').toBe(true);
    const bandHeights = Array.from(new Set(probe.samples.map((s) => s.bandH).filter((h) => h > 0)));
    expect(Math.max(...bandHeights) - Math.min(...bandHeights), `the band kept its height (${bandHeights.join(', ')})`).toBeLessThanOrEqual(1);
    expect(probe.samples.filter((s) => s.bodyEmpty).length, 'the body zone never stood empty').toBe(0);
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);

    // ── GATE 2 closes the sitting; the next generation opens.
    await press(page, 'Enter', 1200);
    await answerGateAs(request, red, 'adjourn');
    await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    const after = await wireOf(request, playerId);
    const mine = after.game.parliament.lastPhase?.outcomes?.filter((o) => o.player === seat) ?? [];
    expect(mine.map((o) => `${o.step}:${o.kind}`)).toEqual(['titanium:stock', 'colony:colony']);
    await settle(page, {timeoutMs: 30_000});
  });

  test('Europa: the build\'s own ocean — the sitting steps to the BOARD with the colonies frame alive, comes back, the frame leaves, the results name Europa', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId, red, before} = await openRewardStage(page, request);
    await expect(page.locator(GRID), 'the colonies stand in the Parliament\'s stage zone').toBeVisible({timeout: 90_000});
    await focusColonyTile(page, 'Europa');
    expect(await pressUntil(page, 'Enter', async () => await page.locator(FOCUS).count() > 0, {tries: 3, settleMs: 1500}), 'A descends into Europa\'s build stage').toBe(true);
    // No decision to make: A IS the build confirm. The colony's build bonus is an OCEAN — the engine's own placement.
    expect(await pressUntil(page, 'Enter', async () => (await placementState(page)) !== 'none', {tries: 4, settleMs: 1800}), 'the ocean placement stands').toBe(true);
    const yielded = await ready(page);
    expect(yielded.wsYielded, 'the workspace stack stepped aside for the board — the sitting AND the colonies wait in it').toBe(true);
    expect(yielded.wsDepth).toBe(0);
    await expect(page.locator('.con-parl'), 'the Parliament yielded the screen to the board').toHaveCount(0);
    await shoot(page, '05-europa-board');
    expect(await placeTile(page), 'the ocean is placed').toBe(true);
    // The stack comes back at the same depth; the colonies frame — its demand met — leaves; the sitting walks on.
    await expect(page.locator('.con-parl'), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
    await expect(page.locator(GRID), 'the colonies frame left').toHaveCount(0, {timeout: 60_000});
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '06-europa-return');
    const seat = before.thisPlayer.color;
    await expect(page.locator(`.con-sit [data-sit-payout-seat="${seat}"] [data-sit-part="colony"]`)).toContainText(/Европ|Europa/);
    const mid = await wireOf(request, playerId);
    expect(mid.game.parliament.phase?.outcomes?.find((o) => o.player === seat && o.kind === 'colony')).toMatchObject({part: 'winner', colony: 'Europa'});
    expect(mid.game.oceans - before.game.oceans, 'the ocean is on the board').toBe(1);
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    await press(page, 'Enter', 1200);
    await answerGateAs(request, red, 'adjourn');
    await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    await settle(page, {timeoutMs: 30_000});
  });
});
