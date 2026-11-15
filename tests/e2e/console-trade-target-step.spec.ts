import {test, expect, Page, Locator} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootWithCards, composerLoaded, focusCard, openCardActions, press, pressUntil, pressUntilVisible, settle, soloGameConfig,
  walkFocusUntil,
} from './consoleStart';
import {LAUNCHPAD, cardTradeConfig} from './cardTradeDoor';
import {readSettled} from './settledRead';
import {armWitness, Witness} from './witness';
import type {ObservedSample} from './observeCore';

/**
 * THE COLONY CARD-TARGET STEP — «куда положить награду» is a LEVEL of the
 * colony flow, on the SHARED played-card selector, and its reward physically
 * lands on the card that was chosen.
 *
 *   ① Колонии door (trade) — the decision row descends into the shared step
 *     (physical faces, «ЦЕЛЬ НАГРАДЫ» crumb tail), B keeps the pre-select,
 *     «Изменить выбор» re-enters locked, a payment change survives, and the
 *     confirm lands the floater ON the presented card (counter frozen until
 *     the touchdown; the closing glide never runs under the standing scene).
 *   ② tv4k — the step composes at the couch profile, and the review panel
 *     USES the band: no scroll rail, no clipped configuration or rail.
 *   ③ BUILD on Titan — the placement bonus is pre-collected the same way and
 *     answered in the build's own batch: no prompt after the cube, and the
 *     floaters land on the chosen card.
 *   ④ card door (Летающая платформа) — the same step under the card's own
 *     crumb, proving the two doors are one flow.
 *
 * FLAKE ZERO: every press is act → verify (its effect is the witness), every
 * live state is read by a poll or AT REST (`readSettled`), and the landing is
 * RECORDED from before the confirm (`armWitness`) — never a sampler, never a
 * pause standing in for a state.
 *
 * Evidence: screenshots/trade-target-step/.
 */

const OUT = path.resolve('screenshots', 'trade-target-step');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

function soloTitanConfig(): Record<string, unknown> {
  return soloGameConfig({
    expansions: {colonies: true},
    customCorporationsList: ['Stormcraft Incorporated'],
    customProjectCards: [LAUNCHPAD],
    customColoniesList: ['Titan', 'Luna', 'Triton', 'Callisto'],
  });
}

/**
 * RT wheel → a slot (on the wheel the direction / centre press IS the activation) — each round verified by the
 * surface it opens, which gets the press's WHOLE window before the round is repeated.
 */
async function openFromWheel(page: Page, slotKey: string, opened: Locator, tries: number, settleMs: number): Promise<void> {
  for (let i = 0; i < tries && await opened.count() === 0; i++) {
    await press(page, 'Period', 900);
    await pressUntil(page, slotKey, async () => await opened.count() > 0, {tries: 1, settleMs});
  }
}

/** Play a simple card from hand all the way (no follow-ups expected). */
async function playFromHand(page: Page, card: string): Promise<void> {
  const hand = page.locator('.con-hand');
  await openFromWheel(page, 'Enter', hand, 5, 1600);
  await expect.poll(() => hand.count(), {message: 'the hand screen must open'}).toBeGreaterThan(0);
  // The dock-to-hand reveal gates input on purpose — the hand is walked once it has landed.
  await page.locator('.con-hand:not(.con-hand--transit)').first().waitFor({state: 'visible', timeout: 20_000}).catch(() => undefined);
  expect(await focusCard(page, card, 16), `${card} must be reachable in hand`).toBe(true);
  // ACT → VERIFY → RETRY: at 4K the descend takes visibly longer, and a fixed
  // press count silently left the card sitting in the hand.
  const composer = page.locator('.con-composer--play');
  await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 4, settleMs: 1800});
  await expect.poll(() => composer.count(), {message: `${card} must open its play stage`}).toBeGreaterThan(0);
  await composerLoaded(page);
  await pressUntil(page, 'Enter', async () => await composer.count() === 0, {tries: 8, settleMs: 1600});
  await expect(composer, `${card} must commit`).toHaveCount(0, {timeout: 25_000});
  await settle(page); // the landing + fold at rest
}

/** The focused colony tile's identity ('' when none). */
async function focusedColony(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.con-coltile--focused')?.getAttribute('data-test') ?? '');
}

/**
 * Focus `colony` on the colonies grid — the cursor WALKED (`walkFocusUntil`: act → verify, turning round at a wall)
 * along a row, a row down when the row does not hold it.
 */
async function focusColony(page: Page, colony: string, message: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${colony}"]`);
  const hit = async () => await focused.count() > 0;
  for (let row = 0; row < 5 && !await walkFocusUntil(page, hit, () => focusedColony(page), 10, 400); row++) {
    await press(page, 'ArrowDown', 400);
  }
  await expect.poll(() => focused.count(), {message}).toBeGreaterThan(0);
}

/** Open the colonies section (RT wheel → right slot), focus Titan, descend. */
async function descendIntoTitanTrade(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  await openFromWheel(page, 'ArrowRight', colonies, 4, 1300);
  await expect.poll(() => colonies.count(), {message: 'colonies section did not open'}).toBeGreaterThan(0);
  await focusColony(page, 'Titan', 'could not focus Titan');
  await press(page, 'Enter', 1500); // descend into the focus stage
  await expect(page.locator('.con-colfocus')).toHaveCount(1, {timeout: 8000});
}

/** Walk the review cursor onto the trade-reward target row. (Reads via
 *  `evaluate` — a locator read on an absent node WAITS its whole timeout.) */
async function focusedRowText(page: Page): Promise<string> {
  return await page.evaluate(() =>
    (document.querySelector('.con-colfocus__steprow--focused')?.textContent ?? '').toUpperCase());
}

async function focusTargetRow(page: Page, tries = 10): Promise<void> {
  await pressUntil(page, 'ArrowDown', async () => (await focusedRowText(page)).includes('ЦЕЛЬ'), {tries, settleMs: 350});
  await expect.poll(() => focusedRowText(page), {message: 'the target decision row must take focus'}).toContain('ЦЕЛЬ');
}

type StepReadout = {
  stageUp: boolean,
  faces: number,
  proxies: number,
  crumb: string,
  focusedCard: string,
  lockedCard: string,
  ask: string,
};

async function readStep(page: Page): Promise<StepReadout> {
  return await page.evaluate(() => {
    const stage = document.querySelector('.con-colfocus__targetstage');
    const crumb = (document.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const focusedCell = document.querySelector('.con-ptsel__slot--focused .pcard')?.closest('[data-ptsel-cell]');
    const lockedCell = document.querySelector('.con-ptsel__slot--locked .pcard')?.closest('[data-ptsel-cell]');
    const nameOf = (cell: Element | null): string => {
      const slot = cell?.querySelector('[data-zoom-slot]');
      return slot?.getAttribute('data-zoom-slot') ?? '';
    };
    return {
      stageUp: stage !== null,
      faces: document.querySelectorAll('.con-colfocus__targetstage .con-ptsel__slot .pcard').length,
      proxies: document.querySelectorAll('.con-colfocus__targetstage .con-ptsel__self').length,
      crumb,
      focusedCard: nameOf(focusedCell ?? null),
      lockedCard: nameOf(lockedCell ?? null),
      ask: (document.querySelector('.con-colfocus__targetstage .con-ptsel__contract-ask')?.textContent ?? '').trim(),
    };
  });
}

/** The embedded target step, opened by the press just made, read AT REST (its entrance over, two equal reads). */
async function settledStep(page: Page, what: string): Promise<StepReadout> {
  await page.locator('.con-colfocus__targetstage').first().waitFor({state: 'attached', timeout: 8_000}).catch(() => undefined);
  return readSettled(page, () => readStep(page), {message: what});
}

/** The target decision row's own reading («выбрано что и N → M», or empty). */
async function targetRowText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.con-colfocus__steprow'));
    const target = rows.find((r) => (r.textContent ?? '').toUpperCase().includes('ЦЕЛЬ'));
    return (target?.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

/** Every decision row of the review, as the player reads it. */
async function reviewRows(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(document.querySelectorAll('.con-colfocus__steprow'))
    .map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()));
}

type LandingState = {
  cardland: boolean,
  /** The scene is receding (`--leaving`) — no longer «standing». */
  leaving: boolean,
  landed: boolean,
  counter: string,
  chip: boolean,
  flash: boolean,
  marker: boolean,
  /** The stage itself (its root classes name the pose it is in). */
  cls: string,
};

/** The reader of the resolution: the presented card, its counter, the chip flight, the contact flash and the closing
 *  track marker — in the page, self-contained. */
function readLanding(): LandingState {
  return {
    cardland: document.querySelector('.con-colfocus__cardland') !== null,
    leaving: document.querySelector('.con-colfocus__cardland--leaving') !== null,
    landed: document.querySelector('.con-colfocus__landcell--landed') !== null,
    counter: (document.querySelector('.con-colfocus__landcell .pcard__res')?.textContent ?? '').replace(/\s+/g, ''),
    chip: document.querySelector('.con-transfer__chip') !== null,
    flash: document.querySelector('.con-colfocus__landflash') !== null,
    marker: document.querySelector('.con-coltrade-marker') !== null,
    cls: (document.querySelector('.con-colfocus') as HTMLElement | null)?.className ?? '',
  };
}

/**
 * RECORD THE RESOLUTION FROM BEFORE THE CONFIRM (FLAKE ZERO — `armWitness`): the landed beat is shorter than any
 * poll's own overhead (a run once shot `06b-landed-tick.png` — the class was there — while every 200 ms tick read
 * `landed: false`), so every state the product writes is kept in the task that writes it. `settled`: the reads below
 * are ORDER claims (the counter before / after the touchdown, the glide after the standing scene) — judged on the
 * states a task leaves.
 */
async function armLandingWitness(page: Page, key: string): Promise<Witness<LandingState>> {
  return armWitness<LandingState>(page, key, readLanding, {settled: true});
}

/** After the confirm: the scene's moments screenshotted where the record shows them, then the whole resolution at
 *  rest (its holds, the closing glide, the fold) — and what was recorded. */
async function landingTimeline(page: Page, landing: Witness<LandingState>, shots: {scene?: string, landed?: string}):
  Promise<Array<ObservedSample<LandingState>>> {
  if (await landing.waitFor((s) => s.cardland, {timeoutMs: 20_000}).catch(() => undefined) !== undefined && shots.scene !== undefined) {
    await shoot(page, shots.scene);
  }
  if (await landing.waitFor((s) => s.landed, {timeoutMs: 20_000}).catch(() => undefined) !== undefined && shots.landed !== undefined) {
    await shoot(page, shots.landed);
  }
  await settle(page);
  return landing.stop();
}

/*
 * NOT `serial`. Each test below boots its OWN game (`bootWithCards`) and drives
 * its OWN page, so a failure in one says nothing about the others — while
 * `serial` marks them «did not run» and drops them from the report. Measured:
 * the failure at «build on Titan» hid the card-door test entirely, which is the
 * last of the «did not run» entries this suite used to produce.
 */

test('Колонии door: the target is a nested step, B keeps the pick, the reward lands on the card', async ({page, request}) => {
  test.setTimeout(540_000);
  const t0 = Date.now();
  const lap = (label: string) => console.log(`[t+${Math.round((Date.now() - t0) / 1000)}s] ${label}`);
  await bootWithCards(page, request, {
    cards: [LAUNCHPAD],
    config: soloTitanConfig(),
    corporation: 'Stormcraft Incorporated',
    keepColony: 'Titan',
  });
  await settle(page);
  lap('booted');
  // The SECOND floater host: playing the launch-pad makes the Titan reward a
  // real PICK (Stormcraft + the launch-pad), not the single-candidate auto.
  await playFromHand(page, LAUNCHPAD);
  await shoot(page, '00-launchpad-played');
  lap('launchpad played');

  await descendIntoTitanTrade(page);
  await shoot(page, '01-trade-review');
  lap('trade review up');

  // 1 · NO inline candidate list in the review — a decision ROW instead.
  await expect.poll(async () => (await reviewRows(page)).some((r) => r.toUpperCase().includes('ЦЕЛЬ')),
    {message: 'the target decision row exists'}).toBe(true);
  console.log('review rows:', JSON.stringify(await reviewRows(page)));

  // 2 · A on the row DESCENDS into the shared step: physical faces, crumb tail.
  await focusTargetRow(page);
  await press(page, 'Enter', 1200);
  let step = await settledStep(page, 'the target step');
  await shoot(page, '02-target-step');
  console.log('step:', JSON.stringify(step));
  expect(step.stageUp, 'the embedded target stage stands').toBe(true);
  expect(step.faces, 'physical candidate faces').toBeGreaterThanOrEqual(2);
  expect(step.proxies, 'no «ЭТА КАРТА» proxy on the colony stage').toBe(0);
  expect(step.crumb.toUpperCase(), 'the crumb tail advanced').toContain('ЦЕЛЬ НАГРАДЫ');

  // 3 · The d-pad walks the physical row; B returns with NOTHING chosen.
  const first = step.focusedCard;
  await press(page, 'ArrowRight', 500);
  await expect.poll(async () => (await readStep(page)).focusedCard, {message: 'the cursor moved to the neighbour'}).not.toBe(first);
  await press(page, 'Escape', 900);
  await expect.poll(() => page.locator('.con-colfocus__targetstage').count(), {message: 'B folds the step'}).toBe(0);
  let row = await readSettled(page, () => targetRowText(page), {message: 'the target row after a bare B'});
  console.log('row after bare B:', row);
  expect(row.includes('Выберите карту') || row.includes('…'), 'nothing was chosen by B').toBe(true);

  // 4 · Re-enter and CHOOSE — the row shows the card and its before → after.
  await press(page, 'Enter', 1000);
  await page.locator('.con-colfocus__targetstage').first().waitFor({state: 'attached', timeout: 8_000}).catch(() => undefined);
  await press(page, 'Enter', 1000); // A on the focused candidate
  await expect.poll(() => page.locator('.con-colfocus__targetstage').count(), {message: 'the pick returns to the review'}).toBe(0);
  await expect.poll(() => targetRowText(page)).toMatch(/\d+\s*→\s*\d+/);
  console.log('row after pick:', await targetRowText(page));
  await shoot(page, '03-picked');

  // 5 · «Изменить выбор»: re-entry lands LOCKED on the chosen card; B keeps it.
  await press(page, 'Enter', 1000);
  step = await settledStep(page, 'the re-entered step');
  await shoot(page, '04-reentry-locked');
  expect(step.lockedCard, 're-entry pre-locks the chosen card').not.toBe('');
  const kept = step.lockedCard;
  await press(page, 'ArrowRight', 400); // wander…
  await press(page, 'Escape', 900); // …and leave without confirming
  await expect.poll(() => page.locator('.con-colfocus__targetstage').count(), {message: 'B folds the re-entered step'}).toBe(0);
  row = await readSettled(page, () => targetRowText(page), {message: 'the target row after B on the re-entry'});
  expect(row.includes('Выберите карту'), 'B after re-entry must NOT clear the pick').toBe(false);

  // 6 · Change the payment path — the pick SURVIVES.
  const payIndex = () => page.evaluate(() => Array.from(document.querySelectorAll('.con-colfocus__payrow'))
    .findIndex((el) => el.classList.contains('con-colfocus__payrow--focused')));
  await pressUntil(page, 'ArrowUp', async () => await payIndex() >= 0, {tries: 6, settleMs: 300});
  const payAt = await payIndex();
  // A DIFFERENT pay row (up — never back down onto the step row); verified by the cursor's own move.
  await pressUntil(page, 'ArrowUp', async () => await payIndex() !== payAt, {tries: 1, settleMs: 300});
  await press(page, 'Enter', 600); // pick it
  row = await readSettled(page, () => targetRowText(page), {message: 'the target row after the payment change'});
  expect(row.includes('Выберите карту'), 'the payment change must not clear the target').toBe(false);
  await expect.poll(() => page.locator('.con-colfocus__targetstage').count(), {message: 'the review, not the step, owns the screen'}).toBe(0);
  await shoot(page, '05-payment-changed');

  // 7 · CONFIRM (X) — the presented card stands, the chip lands, the counter
  //     ticks AT the touchdown, the marker glides only after the scene leaves.
  const before = ((await page.evaluate(() =>
    (document.querySelector('.con-colfocus__steprow em')?.textContent ?? ''))) ?? '').trim();
  console.log('review impact before confirm:', before, '| chosen:', kept);
  const landing = await armLandingWitness(page, 'trade-target-landing');
  await press(page, 'KeyX', 300);
  const samples = await landingTimeline(page, landing, {scene: '06a-scene-standing', landed: '06b-landed-tick'});
  const timeline = samples.map((s) => s.v);
  await shoot(page, '06-after-landing');
  console.log('timeline:', JSON.stringify(samples.map((s) => ({...s.v, t: s.t - (samples[0]?.t ?? 0)})), null, 1));

  const sawScene = timeline.some((s) => s.cardland);
  const sawChip = timeline.some((s) => s.chip);
  const sawLanded = timeline.some((s) => s.landed);
  const firstLanded = timeline.findIndex((s) => s.landed);
  const preLanding = timeline.slice(0, Math.max(0, firstLanded)).filter((s) => s.counter !== '');
  const postLanding = timeline.slice(firstLanded).filter((s) => s.counter !== '');
  const firstMarker = timeline.findIndex((s) => s.marker);
  // «Standing» = up and NOT receding: the element lingers faded (`--leaving`)
  // until the transaction clears it, and a glide over THAT is fine.
  const lastStanding = timeline.map((s) => s.cardland && !s.leaving).lastIndexOf(true);
  console.log('sawScene', sawScene, 'sawChip', sawChip, 'sawLanded', sawLanded,
    'firstLanded@', firstLanded, 'firstMarker@', firstMarker, 'lastStanding@', lastStanding);
  expect(sawScene, 'the presented target scene stood during the resolution').toBe(true);
  expect(sawLanded, 'a chip physically landed on the presented card').toBe(true);
  if (preLanding.length > 0 && postLanding.length > 0) {
    console.log('counter before landing:', preLanding[preLanding.length - 1].counter,
      '→ after:', postLanding[postLanding.length - 1].counter);
    expect(preLanding[preLanding.length - 1].counter, 'the counter must CHANGE at the touchdown')
      .not.toBe(postLanding[postLanding.length - 1].counter);
  }
  if (firstMarker >= 0) {
    expect(firstMarker, 'the closing glide never runs under the STANDING scene')
      .toBeGreaterThanOrEqual(lastStanding);
  }
});

test.describe('tv4k', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});

  test('the step composes at the TV profile (couch target)', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootWithCards(page, request, {
      cards: [LAUNCHPAD],
      config: soloTitanConfig(),
      corporation: 'Stormcraft Incorporated',
      keepColony: 'Titan',
      query: '&consoleProfile=tv',
    });
    await settle(page);
    await playFromHand(page, LAUNCHPAD);
    await descendIntoTitanTrade(page);
    await focusTargetRow(page);
    await press(page, 'Enter', 1400);
    const step = await settledStep(page, 'the tv4k target step');
    await shoot(page, '20-tv4k-target-step');
    console.log('tv4k step:', JSON.stringify(step));
    expect(step.stageUp).toBe(true);
    expect(step.faces).toBeGreaterThanOrEqual(2);
    expect(step.crumb.toUpperCase()).toContain('ЦЕЛЬ НАГРАДЫ');
    // No scroll rail over a two-candidate step at 4K (the solver owns the fit).
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('.con-colfocus__targetstage .con-ptsel')?.getAttribute('data-overflow') ?? ''),
    {message: 'two candidates never scroll on the TV'}).toBe('');

    // …and back on the REVIEW: the panel must USE the band it has. The stage
    // measured what its columns want (`--colfocus-need`); with room to grow
    // there may be no scroll rail and no clipped configuration — measured AT REST.
    await press(page, 'Escape', 900);
    await expect.poll(() => page.locator('.con-colfocus__targetstage').count(), {message: 'B folds the step'}).toBe(0);
    const fit = await readSettled(page, () => page.evaluate(() => {
      const root = document.querySelector('.con-colfocus') as HTMLElement | null;
      const surface = root?.querySelector('.con-colfocus__surface') as HTMLElement | null;
      const band = root?.parentElement as HTMLElement | null;
      const viewport = root?.querySelector('.con-colfocus__configscroll .con-scroll-area__viewport') as HTMLElement | null;
      const content = viewport?.querySelector('.con-scroll-area__content') as HTMLElement | null;
      const rail = root?.querySelector('.con-colfocus__result') as HTMLElement | null;
      return {
        band: band?.clientHeight ?? 0,
        panel: surface?.clientHeight ?? 0,
        need: root?.style.getPropertyValue('--colfocus-need') ?? '',
        cfgViewport: viewport?.clientHeight ?? 0,
        cfgContent: content?.scrollHeight ?? 0,
        cfgRail: document.querySelectorAll('.con-colfocus__configscroll .con-scroll-area__rail').length,
        railClip: (rail?.scrollHeight ?? 0) - (rail?.clientHeight ?? 0),
      };
    }), {message: 'the review panel\'s fit'});
    await shoot(page, '21-tv4k-review-fit');
    console.log('tv4k fit:', JSON.stringify(fit));
    expect(fit.cfgContent, 'the configuration fits without scrolling')
      .toBeLessThanOrEqual(fit.cfgViewport + 2);
    expect(fit.cfgRail, '…so no scroll rail is advertised').toBe(0);
    expect(fit.railClip, 'and the summary rail is not clipped either').toBeLessThanOrEqual(2);
  });
});

/**
 * BUILDING ON TITAN pre-collects its placement bonus THE SAME WAY — the
 * decision row, the shared picker, and the reward landing on the chosen card.
 * The old flow dropped «выберите карту» on the player AFTER the cube landed.
 */
test('build on Titan: the placement bonus is pre-collected, never a later prompt', async ({page, request}) => {
  test.setTimeout(300_000);
  await bootWithCards(page, request, {
    cards: [LAUNCHPAD],
    config: soloTitanConfig(),
    corporation: 'Stormcraft Incorporated',
    keepColony: 'Titan',
  });
  await settle(page);
  await playFromHand(page, LAUNCHPAD); // a SECOND floater host → a real pick

  // The colonies → Titan → «К строительству» (the build intent comes from the
  // wheel's build slot; the stage's own verb is what we assert).
  await buildOnTitan(page);
});

async function buildOnTitan(page: Page): Promise<void> {
  // The PROVEN drive (console-colony-cube.spec): the LT wheel's centre slot is
  // Standard Projects, and «Колония» is found by walking the grid and READING
  // the focused row — never a fixed key path.
  const sheetRows = page.locator('.con-stdp__card');
  let open = false;
  for (let i = 0; i < 8 && !open; i++) {
    await press(page, 'Comma', 1100);
    if (await page.locator('.con-quick').count() > 0) {
      await pressUntil(page, 'Enter', async () => await sheetRows.count() > 0, {tries: 1, settleMs: 1400});
    }
    open = await sheetRows.count() > 0;
    if (!open) {
      if (await page.locator('.con-quick, .con-sys').count() > 0) {
        await press(page, 'Escape', 600);
      }
      await settle(page); // whatever swallowed the open runs out before the next round
    }
  }
  expect(open, 'standard projects never opened').toBeTruthy();
  const focusedRow = page.locator('.con-stdp__card--focused');
  const walk = [
    'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowLeft',
    'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown',
  ];
  let found = false;
  for (let i = 0; i <= walk.length && !found; i++) {
    const text = await focusedRow.innerText({timeout: 1500}).catch(() => '');
    if (/колони/i.test(text)) {
      found = true;
      break;
    }
    if (i < walk.length) {
      await press(page, walk[i], 420);
    }
  }
  expect(found, 'the Build Colony row was never focused').toBeTruthy();
  await press(page, 'Enter', 2000); // → SelectColony → the colonies in pick mode
  await expect.poll(() => page.locator('.con-colonies').count(), {message: 'the colonies opened for the build'}).toBeGreaterThan(0);
  await focusColony(page, 'Titan', 'could not focus Titan');
  await press(page, 'Enter', 1500); // descend into the build stage
  await expect(page.locator('.con-colfocus')).toHaveCount(1, {timeout: 8000});
  await shoot(page, '30-build-stage');

  // ① THE DECISION EXISTS on the stage — «Цель бонуса постройки».
  await expect.poll(async () => (await reviewRows(page)).some((r) => r.toUpperCase().includes('ЦЕЛЬ')),
    {message: 'the build asks for its host card HERE'}).toBe(true);
  console.log('build rows:', JSON.stringify(await reviewRows(page)));

  // ② A opens the SHARED step; A picks; the row reads the card + delta.
  await press(page, 'Enter', 1300);
  const step = await settledStep(page, 'the build\'s target step');
  await shoot(page, '31-build-target-step');
  console.log('build step:', JSON.stringify(step));
  expect(step.stageUp).toBe(true);
  expect(step.faces).toBeGreaterThanOrEqual(2);
  await press(page, 'Enter', 1200);
  await expect.poll(() => targetRowText(page)).toMatch(/\d+\s*→\s*\d+/);
  console.log('build row after pick:', await targetRowText(page));

  // ③ X commits — and NO card prompt follows the cube (the batch answered it).
  const landing = await armLandingWitness(page, 'build-target-landing');
  await press(page, 'KeyX', 400);
  const timeline = (await landingTimeline(page, landing, {})).map((s) => s.v);
  await shoot(page, '32-build-landed');
  const sawScene = timeline.some((s) => s.cardland);
  const sawLanded = timeline.some((s) => s.landed);
  console.log('build sawScene', sawScene, 'sawLanded', sawLanded);
  // At rest, after the whole resolution: nothing asks for the floater target again.
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('.con-task-host') !== null &&
    (document.querySelector('.con-task .con-prompt-head__title')?.textContent ?? '').toLowerCase().includes('карт')),
  {message: 'the floater target must NEVER be asked again after the cube'}).toBe(false);
  expect(sawScene, 'the chosen card stands while the bonus lands').toBe(true);
  expect(sawLanded, 'the floaters physically landed on it').toBe(true);
}

test('card door (Летающая платформа): the SAME target step serves the trade branch', async ({page, request}) => {
  test.setTimeout(300_000);
  await bootWithCards(page, request, {
    cards: [LAUNCHPAD],
    config: cardTradeConfig({
      customCorporationsList: ['Celestic'],
      customColoniesList: ['Titan', 'Luna', 'Triton', 'Callisto'],
    }),
    keepColony: 'Titan',
  });
  await settle(page);

  // Play the launch-pad from hand (its floaters make it a candidate too).
  const {playLaunchpad} = await import('./cardTradeDoor');
  await playLaunchpad(page);
  await shoot(page, '10-launchpad-played');

  // The card door: Действия карт → the TRADE VARIANT tile → A opens the
  // focus stage on that branch → the CTA «Выбрать колонию» hosts the step.
  await openCardActions(page);
  const {focusTradeVariantTile} = await import('./cardTradeDoor');
  await focusTradeVariantTile(page);
  // A on the variant → ACTION FOCUS (trade branch) — verified by the stage standing (a second A there would confirm).
  const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
  await pressUntil(page, 'Enter', async () => await stage.count() > 0, {tries: 1, settleMs: 2000});
  // The CTA — «Выбрать колонию» → the colonies step; act → verify on the grid standing.
  const grid = page.locator('.con-colonies');
  await pressUntilVisible(page, 'Enter', '.con-colonies', {tries: 4, settleMs: 2600});
  await expect.poll(() => grid.count(), {message: 'the colonies step did not open from the card door'}).toBeGreaterThan(0);
  await shoot(page, '11-colonies-step');

  // Focus Titan INSIDE the hosted grid and descend.
  await focusColony(page, 'Titan', 'could not focus Titan in the hosted grid');
  await press(page, 'Enter', 1500);
  await expect(page.locator('.con-colfocus')).toHaveCount(1, {timeout: 8000});
  await shoot(page, '12-trade-review-door2');

  // The SAME decision row and the SAME nested step (2 candidates:
  // Celestic + the played launch-pad), under the card door's crumb.
  await focusTargetRow(page);
  await press(page, 'Enter', 1200);
  const step = await settledStep(page, 'the card door\'s target step');
  await shoot(page, '13-target-step-door2');
  console.log('door2 step:', JSON.stringify(step));
  expect(step.stageUp).toBe(true);
  expect(step.faces).toBeGreaterThanOrEqual(2);
  expect(step.crumb.toUpperCase()).toContain('ЦЕЛЬ НАГРАДЫ');
  expect(step.crumb.toUpperCase(), 'the card door keeps its origin in the crumb').toContain('ДЕЙСТВИЯ КАРТ');

  // Pick, return, and the review still stands under the card door.
  await press(page, 'Enter', 1000);
  await expect.poll(() => targetRowText(page)).toMatch(/\d+\s*→\s*\d+/);
  console.log('door2 row after pick:', await targetRowText(page));
  await shoot(page, '14-door2-picked');
});
