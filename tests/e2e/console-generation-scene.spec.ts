import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, crumbText, fetchPlayerModel, press, pressUntil, pressUntilVisible, sendPlayerInput, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness, TransferWitness} from './transferWitness';
import {storyboard} from './consoleEndgameHarness';

/**
 * THE GENERATION CHANGE IS ONE SCENE (TR61 — «СМЕНА ПОКОЛЕНИЯ — ОДНА СЦЕНА»).
 *
 * The moment that comes every generation to every player used to be three
 * unrelated ticks: the «ПКЛ.» flip, the conversion gate, six `+N` chips
 * changing the rail in one frame — and a buy PLATE a second later (solo), or
 * the draft workspace (a drafting table). What this pins down:
 *  · A — the solo table without a draft: the pass → the counter flips FIRST →
 *        the energy turns to heat → the income flows into the rail row by row
 *        (every landing on its own row, no end over glass) → the research buy
 *        RISES inside the draft workspace itself (crumb «ИССЛЕДОВАНИЕ › ПОКУПКА»,
 *        four cards, the financial strip); the standalone `cardSelect buy`
 *        plate never mounts for one sample, and no mandatory plate stands
 *        between the scene and the purchase (the scene stood the flow up);
 *  · B — the drafting table: the same scene, then the draft's picks in the SAME
 *        workspace; driven to the buy stage, the buy wears the SAME chrome;
 *  · C — no energy: two beats — no conversion layer, the income still flows;
 *  · D — reduced motion: the numbers snap (no flights), the purchase still rises;
 *  · E — the journal: ONE group per seat («Производство»), its rows the phase's.
 *
 * The scene is played off the SERVER'S RECORD of the phase (the view's
 * `productionIncome`), so the stocks the probe reads back must equal the
 * fixture's arithmetic: 20 + 22 (rating) + 3 M€ · 1 + 2 steel · 0 + 1 titanium ·
 * 3 + 2 plants · 4 energy → heat + 2 produced · 2 + 4 + 1 heat.
 */
const OUT = path.resolve('screenshots', 'generation-scene', process.env.TM_E2E_SHOTS_TAG ?? '');
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  game: {phase: string, generation: number},
  thisPlayer: {megacredits: number, steel: number, titanium: number, plants: number, energy: number, heat: number, terraformRating: number},
  waitingFor?: {type: string, buyMode?: boolean, draftPrompt?: unknown, cards?: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** The fixture's arithmetic — what every rail row must read AFTER the scene. */
const AFTER = {megacredits: 20 + 22 + 3, steel: 1 + 2, titanium: 0 + 1, plants: 3 + 2, energy: 0 + 2, heat: 2 + 4 + 1};
const AFTER_NO_ENERGY = {...AFTER, energy: 2, heat: 2 + 1};

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

function writeTrail(preset: string, name: string, w: TransferWitness): void {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  fs.writeFileSync(path.join(OUT, preset, `trail-${name}.txt`), transferTrail(w) + '\n');
}

/** The pad's PASS: hold LT (the basic wheel — «Пас» on its DOWN slot), step down, release, confirm the plate with A. */
async function passOnUi(page: Page): Promise<void> {
  await page.keyboard.down('Comma');
  await cinematicBeat(page, 550, 'the held LT opens the basic wheel (its own entrance)');
  await page.keyboard.press('ArrowDown');
  await cinematicBeat(page, 450, 'the slot step reads before the release');
  await page.keyboard.up('Comma');
  await expect(page.locator('.con-confirm'), 'the pass asks on its plate').toBeVisible({timeout: 10_000});
  await press(page, 'Enter', 300);
}

type Sample = {
  t: number, gen: string, flipping: boolean, convert: boolean, draftws: boolean, buy: boolean, pick: boolean,
  taskWide: boolean, mandatory: boolean, rows: Record<string, string>,
};

/** ARM the scene probe: a MutationObserver + a 40 ms sampler (never rAF) over the strip, the rail and the surfaces. */
async function armSceneProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const st = {samples: [] as Array<Sample>};
    (window as unknown as {__genScene?: typeof st}).__genScene = st;
    const t0 = performance.now();
    const rowText = (key: string) => (document.querySelector(`.con-res__row--${key} .con-res__value`)?.textContent ?? '').trim();
    const read = () => {
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        gen: (document.querySelector('.con-status__gen .con-flipval__card:not(.con-flipval__card--out)')?.textContent ?? '').trim(),
        flipping: document.querySelector('.con-status__gen .con-flipval--flip') !== null,
        convert: document.querySelector('.resource-conversion-layer') !== null,
        draftws: document.querySelector('.con-draftws') !== null,
        buy: document.querySelector('.con-draftws__stage--buy .con-cards__slot') !== null,
        pick: document.querySelector('.con-draftws__stage--pick .con-cards__slot') !== null,
        taskWide: document.querySelector('.con-task--wide') !== null,
        mandatory: document.querySelector('.con-mandatory') !== null,
        rows: {
          megacredits: rowText('megacredits'), steel: rowText('steel'), titanium: rowText('titanium'),
          plants: rowText('plants'), energy: rowText('energy'), heat: rowText('heat'),
        },
      };
      const last = st.samples[st.samples.length - 1];
      if (last === undefined || JSON.stringify({...last, t: 0}) !== JSON.stringify({...s, t: 0})) {
        st.samples.push(s);
      }
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true});
    const iv = setInterval(read, 40);
    setTimeout(() => {
      clearInterval(iv);
      mo.disconnect();
    }, 90_000);
  });
}

async function sceneSamples(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => (window as unknown as {__genScene?: {samples: Array<Sample>}}).__genScene?.samples ?? []);
}

/** The row's FIGURE — the leading integer of the digits span (a delta chip still standing beside it is not the value). */
async function railText(page: Page, key: string): Promise<string> {
  const raw = (await page.locator(`.con-res__row--${key} .con-res__digits`).innerText()).trim();
  return /^-?\d+/.exec(raw)?.[0] ?? raw;
}

/** The scene's verdicts shared by A / B / C: order, surfaces, the rail's final numbers against the server's. */
async function expectScene(page: Page, request: APIRequestContext, playerId: string, samples: Array<Sample>, after: typeof AFTER, opts: {convert: boolean}): Promise<void> {
  expect(samples.length, 'the probe sampled the scene').toBeGreaterThan(5);
  // THE STANDALONE PLATE NEVER MOUNTS — not for one sample: the purchase has ONE surface (TR61 part В).
  expect(samples.filter((s) => s.taskWide).length, 'the standalone cardSelect plate never rose').toBe(0);
  // …AND NO MANDATORY PLATE STANDS BETWEEN THE SCENE AND THE PURCHASE — the scene stood the flow up itself (decision 6а).
  expect(samples.filter((s) => s.mandatory).length, 'no announce plate interrupted the phrase').toBe(0);
  // THE ORDER: the counter flips FIRST, the conversion (when there is one) after it, the purchase rises last.
  const flipAt = samples.findIndex((s) => s.gen === '2');
  const convertAt = samples.findIndex((s) => s.convert);
  const buyAt = samples.findIndex((s) => s.draftws);
  expect(flipAt, 'the generation readout reached 2').toBeGreaterThanOrEqual(0);
  expect(samples.some((s) => s.flipping), 'the readout FLIPPED (never a snap)').toBeTruthy();
  if (opts.convert) {
    expect(convertAt, 'the conversion layer played').toBeGreaterThanOrEqual(0);
    expect(flipAt, 'the flip came before the conversion').toBeLessThanOrEqual(convertAt);
    expect(convertAt, 'the conversion came before the purchase').toBeLessThan(buyAt);
  } else {
    expect(convertAt, 'nothing to convert — the conversion layer never mounted').toBe(-1);
  }
  expect(buyAt, 'the workspace rose').toBeGreaterThan(flipAt);
  // THE RAIL READS THE SERVER'S NUMBERS — the record changed nothing of the arithmetic.
  const wire = await wireOf(request, playerId);
  for (const key of Object.keys(after) as Array<keyof typeof after>) {
    expect(wire.thisPlayer[key], `the server's ${key}`).toBe(after[key]);
    expect(await railText(page, key), `the rail's ${key}`).toBe(String(after[key]));
  }
}

/** Every income row received its token: the landings by row (the witness's `rail:<row>` anchor). */
function landingsByRow(w: TransferWitness): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of w.landings) {
    const m = /^rail:(.+)$/.exec(l.under);
    if (m !== null) {
      out[m[1]] = (out[m[1]] ?? 0) + 1;
    }
  }
  return out;
}

for (const preset of PRESETS) {
  test.describe(`generation scene · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('A — solo, no draft: flip → conversion → the income flows row by row → the purchase rises in the research workspace', async ({page, request}) => {
      test.setTimeout(600_000);
      const {playerId} = await bootFixtureSeats(page, request, 'generation-end-solo', {query: preset.query});
      await settle(page);
      await shoot(page, preset.id, 'a-00-before-pass');
      await armSceneProbe(page);
      await armTransferWitness(page);
      const stop = await storyboard(page, path.join(OUT, preset.id), 'a-generation');
      await passOnUi(page);
      await expect(page.locator('.con-draftws__stage--buy .con-cards__slot'), 'the purchase row stands in the workspace').toHaveCount(4, {timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const samples = await sceneSamples(page);
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'a-income', witness);
      await shoot(page, preset.id, 'a-01-purchase');

      await expectScene(page, request, playerId, samples, AFTER, {convert: true});
      // EVERY ROW THE RECORD NAMES RECEIVED ITS TOKEN — the rating's M€ and the produced M€ are TWO landings on one row.
      const rows = landingsByRow(witness);
      expect(rows.megacredits ?? 0, `two M€ landings (rating + production) — trail:\n${transferTrail(witness)}`).toBeGreaterThanOrEqual(2);
      for (const key of ['steel', 'titanium', 'plants', 'energy', 'heat']) {
        expect(rows[key] ?? 0, `a landing on the ${key} row — trail:\n${transferTrail(witness)}`).toBeGreaterThanOrEqual(1);
      }
      expect(endsOverGlass(witness), 'no end of a flight over glass').toEqual([]);
      // THE ONE SURFACE: the research workspace with the buy stage — its crumb, its four cards, its financial strip.
      const crumb = await crumbText(page);
      expect(crumb, 'the crumb names the research and the purchase').toMatch(/ИССЛЕДОВАНИЕ/i);
      expect(crumb).toMatch(/ПОКУПКА/i);
      await expect(page.locator('.con-draftws__finstrip')).toBeVisible();
      await expect(page.locator('.con-draftws__shelf'), 'no shelf without a draft (nothing was collected)').toBeHidden();
      // Part Г — THE PURCHASE AT THE COUCH'S SCALE: the card is a protagonist (≥ ⅓ of the workspace's height — the
      // receiving stage's law), and every line of the financial strip reads at or above the TV's type floor
      // (effective — a `zoom` ancestor scales the computed size).
      const scale = await page.evaluate(() => {
        const px = (el: Element | null) => {
          if (el === null) {
            return 0;
          }
          const zoom = (el as HTMLElement & {currentCSSZoom?: number}).currentCSSZoom ?? 1;
          return parseFloat(getComputedStyle(el).fontSize) * zoom;
        };
        const root = document.querySelector('.con-root') as HTMLElement | null;
        const floorRem = parseFloat(root === null ? '0' : getComputedStyle(root).getPropertyValue('--con-t-floor')) || 0;
        const floorPx = floorRem * parseFloat(getComputedStyle(document.documentElement).fontSize);
        const band = document.querySelector('.con-draftws')?.getBoundingClientRect();
        const card = document.querySelector('.con-draftws__stage--buy .con-cards__slot .pcard, .con-draftws__stage--buy .con-cards__slot')?.getBoundingClientRect();
        return {
          bandH: band?.height ?? 0, cardH: card?.height ?? 0, cardW: card?.width ?? 0, floorPx,
          fin: {
            label: px(document.querySelector('.con-draftws__fin-label')),
            total: px(document.querySelector('.con-draftws__fin-total')),
            detail: px(document.querySelector('.con-draftws__fin-detail')),
          },
        };
      });
      console.log(`[tr61 ${preset.id}] buy card ${Math.round(scale.cardW)}×${Math.round(scale.cardH)} in a ${Math.round(scale.bandH)} band (${(scale.cardH / Math.max(1, scale.bandH) * 100).toFixed(0)} %) · finstrip ${scale.fin.label.toFixed(1)} / ${scale.fin.total.toFixed(1)} / ${scale.fin.detail.toFixed(1)} px · floor ${scale.floorPx.toFixed(1)} px`);
      expect(scale.cardH / Math.max(1, scale.bandH), 'the card is a protagonist — at least a third of the workspace').toBeGreaterThanOrEqual(1 / 3);
      if (preset.id === 'tv4k') {
        for (const [k, v] of Object.entries(scale.fin)) {
          expect(v, `the financial strip's ${k} at or above the couch floor`).toBeGreaterThanOrEqual(scale.floorPx - 0.5);
        }
      }
      const wire = await wireOf(request, playerId);
      expect(wire.game.phase).toBe('research');
      expect(wire.waitingFor?.buyMode, 'the server asks the buy').toBe(true);
    });

    test('B — the drafting table: the same scene, the picks in the same workspace, the buy with the SAME chrome', async ({page, request}) => {
      test.setTimeout(600_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'generation-end-draft', {query: preset.query});
      const rival = seats[1];
      await settle(page);
      await armSceneProbe(page);
      await passOnUi(page);
      await expect(page.locator('.con-draftws__stage--pick .con-cards__slot').first(), 'the draft rose in the workspace').toBeVisible({timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      const samples = await sceneSamples(page);
      await shoot(page, preset.id, 'b-01-draft');
      await expectScene(page, request, playerId, samples, AFTER, {convert: true});
      expect(await crumbText(page)).toMatch(/ДРАФТ/i);

      // ── Drive the draft to the buy: the viewer picks on the UI (A on the focused card), the rival over the API. ──
      for (let round = 0; round < 24; round++) {
        const mine = await wireOf(request, playerId);
        if (mine.game.phase === 'research' && mine.waitingFor?.buyMode === true) {
          break;
        }
        const theirs = await wireOf(request, rival);
        if (theirs.waitingFor?.type === 'card' && theirs.waitingFor.draftPrompt !== undefined && (theirs.waitingFor.cards?.length ?? 0) > 0) {
          await sendPlayerInput(request, rival, {type: 'card', cards: [theirs.waitingFor.cards![0].name]} as never);
        }
        if (mine.waitingFor?.type === 'card' && mine.waitingFor.draftPrompt !== undefined) {
          // A on the focused card commits the single pick; the witness is a VISIBLE change of stage (the layers are
          // v-show twins — a count would read the hidden wait stage as already there).
          await pressUntil(page, 'Enter', async () =>
            await page.locator('.con-draftws__stage--pick .con-cards__slot--picked').count() > 0 ||
            await page.locator('.con-draftws__stage--wait').isVisible() ||
            await page.locator('.con-draftws__stage--buy').isVisible(), {settleMs: 900});
        }
        await cinematicBeat(page, 700, 'the rival answers and the packet passes');
      }
      await expect(page.locator('.con-draftws__stage--buy .con-cards__slot'), 'the buy stage after the picks').toHaveCount(4, {timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      await shoot(page, preset.id, 'b-02-purchase');
      // PARITY: the buy chrome is the same set of hooks the no-draft road rendered.
      expect(await crumbText(page)).toMatch(/ПОКУПКА/i);
      await expect(page.locator('.con-draftws__finstrip')).toBeVisible();
      expect(await page.locator('.con-task--wide').count(), 'no standalone plate on the drafting road either').toBe(0);
    });

    test('C — no energy: two beats — no conversion layer, the income still flows, the purchase rises', async ({page, request}) => {
      test.setTimeout(600_000);
      const {playerId} = await bootFixtureSeats(page, request, 'generation-end-solo-no-energy', {query: preset.query});
      await settle(page);
      await armSceneProbe(page);
      await armTransferWitness(page);
      await passOnUi(page);
      await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      const samples = await sceneSamples(page);
      const witness = await transferWitness(page);
      await expectScene(page, request, playerId, samples, AFTER_NO_ENERGY, {convert: false});
      const rows = landingsByRow(witness);
      expect(rows.megacredits ?? 0, transferTrail(witness)).toBeGreaterThanOrEqual(2);
      expect(rows.energy ?? 0, 'the produced energy still arrives').toBeGreaterThanOrEqual(1);
      expect(endsOverGlass(witness)).toEqual([]);
    });
  });
}

test.describe('generation scene · tv4k · the honest degradations and the journal', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('D — reduced motion: the numbers snap with no flights, the purchase still rises', async ({page, request}) => {
    test.setTimeout(600_000);
    await page.emulateMedia({reducedMotion: 'reduce'});
    const {playerId} = await bootFixtureSeats(page, request, 'generation-end-solo', {query: '&consoleProfile=tv'});
    await settle(page);
    await expect(page.locator('html.con-reduced-motion'), 'the console honours the preference').toHaveCount(1);
    await armSceneProbe(page);
    await armTransferWitness(page);
    await passOnUi(page);
    await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const samples = await sceneSamples(page);
    const witness = await transferWitness(page);
    expect(witness.births.length, 'no chip flies under reduced motion').toBe(0);
    expect(samples.filter((s) => s.taskWide).length).toBe(0);
    const wire = await wireOf(request, playerId);
    for (const key of Object.keys(AFTER) as Array<keyof typeof AFTER>) {
      expect(wire.thisPlayer[key]).toBe(AFTER[key]);
      expect(await railText(page, key), `the rail's ${key} snapped to the server's number`).toBe(String(AFTER[key]));
    }
  });

  test('E — the journal: the phase is ONE group per seat, in the production category, its rows the phase\'s', async ({page, request}) => {
    test.setTimeout(600_000);
    await bootFixtureSeats(page, request, 'generation-end-solo', {query: '&consoleProfile=tv'});
    await settle(page);
    await passOnUi(page);
    await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    // The journal is the board home's: collapse the purchase (B — «Свернуть», the decision stays live) and open it.
    await pressUntilVisible(page, 'Escape', '.con-mandatory', {settleMs: 1200});
    await pressUntilVisible(page, 'KeyR', '.con-journal', {settleMs: 1200});
    // The group of generation 1's production stands in generation 1 — step back once from the live generation 2.
    await press(page, 'Comma', 1200);
    const group = page.locator('.con-journal .journal-group--production');
    await expect(group, 'ONE production group for the seat').toHaveCount(1, {timeout: 15_000});
    await expect(group.locator('.journal-group__root-body')).toContainText(/доход/i);
    expect(await group.locator('.journal-child-row').count(), 'the rows: the production values, the rating, the conversion').toBeGreaterThanOrEqual(3);
    await shoot(page, 'tv4k', 'e-journal');
  });
});
