/*
 * TR82 PROTEUS — the fifth new corporation of Turmoil Redux (`docs/TURMOIL_REDUX_PROTEUS.md`): «45 M€ + 2 data; after
 * you play a non-wild tag that matches a non-wild tag on your Preludes, add 1 data here (your Preludes count); spend 6
 * data from here to place a colony or an ocean tile». On the TV profile:
 *
 *  A · THE START (a real start flow, Proteus forced, two Building Preludes): the corporation lands with 2 data; the
 *      FIRST Prelude draws no «Сработает» (nothing of its own to match); the SECOND one's status rail reads «Сработает»
 *      with the corporation's data, R3 opens the «Эффекты» layer («… · ЭФФЕКТЫ»), B folds it; A → the Prelude lands on
 *      «РАЗЫГРАНО», Proteus RISES IN ITS SLOT on the shelf, the data token is born on its printed effect row and lands
 *      in its OWN capsule (2 → 3 on the touchdown); the server: 3 data.
 *  B · A HAND PLAY (the `proteus` fixture, 5 data, Mohole + Martian Industries on the table): the composer's
 *      «Сработает» names the data for Titanium Mine (Building), A → Proteus answers in its place → 6 data. Then the
 *      ACTION: two tiles (a colony · an ocean); the colony one → the colonies take the stage → a colony is built, the
 *      6 data left the card first.
 *  C · NOTHING TO GAIN (`proteus-futile`: every colony tile full, the oceans at their maximum): the colony tile is
 *      refused with its reason, the ocean tile carries the futility verdict — and stays available.
 *
 * TIMING class (`timingSpecs.ts`): the rise and the birth are sampled motion — `--exclusive --workers=1` on the box. The
 * rule (the match predicate, the forecast twin, the action's branches) is pinned server-side (`Proteus.spec.ts`).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, createGameWithCards, crumbText, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, pickCards, playQueueCard,
  press, pressUntil, sendPlayerInput, settle, soloGameConfig, submitSummary, waitForBoardHome, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 'proteus');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PROTEUS = 'Proteus';
const MOHOLE = 'Mohole';
const MARTIAN = 'Martian Industries';
const BUILDING_CARD = 'Titanium Mine';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

type Wire = {
  thisPlayer: {color: string, coloniesCount: number, megacredits: number, tableau: Array<{name: string, resources?: number}>},
  waitingFor?: {type: string, options?: Array<{cards?: Array<{name: string}>}>},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const proteusData = (w: Wire): number => w.thisPlayer.tableau.find((c) => c.name === PROTEUS)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, PRESET.id, `${name}.png`)});
}

function writeTrail(scene: string, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/proteus-${scene}-${PRESET.id}.txt`, trail);
}

/** The shelf's Proteus slot — lifted or not, and its capsule's count — sampled on a task clock (never rAF). */
async function armShelfProbe(page: Page): Promise<void> {
  await page.evaluate((card) => {
    const w = window as unknown as {__shelf: Array<{t: number, lifted: boolean, count: string}>};
    w.__shelf = [];
    const t0 = performance.now();
    let last = '';
    const sample = () => {
      const slot = document.querySelector<HTMLElement>(`.con-start__played .con-splayed__top[data-played-key="${card}"]`);
      const lifted = slot !== null && (slot.hasAttribute('data-reaction-lifted') || slot.querySelector('[data-reaction-lifted]') !== null);
      const count = slot?.querySelector('.pcard__res-count')?.textContent?.trim() ?? '';
      const dock = document.querySelector<HTMLElement>('.con-start__played');
      const where = `${document.querySelector('.con-start') !== null ? 'S' : '-'}${dock !== null ? 'D' : '-'}${slot !== null ? 'T' : '-'}` +
        `${dock === null ? '' : ':' + getComputedStyle(dock).opacity}`;
      const now = `${lifted}/${count}/${where}`;
      if (now !== last) {
        last = now;
        (w.__shelf as Array<unknown>).push({t: performance.now() - t0, lifted, count, where});
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(sample, 16);
  }, PROTEUS);
}

async function shelfProbe(page: Page): Promise<Array<{t: number, lifted: boolean, count: string}>> {
  return page.evaluate(() => (window as unknown as {__shelf?: Array<{t: number, lifted: boolean, count: string}>}).__shelf ?? []);
}

/** Any face of Proteus lifted in its place, risen out of the receiving stage, or at a seat of the reaction layer. */
async function armRiseProbe(page: Page): Promise<void> {
  await page.evaluate((card) => {
    const w = window as unknown as {__rose: boolean};
    w.__rose = false;
    window.setInterval(() => {
      if (document.querySelector(`[data-played-key="${card}"][data-reaction-lifted], [data-played-key="${card}"] [data-reaction-lifted], ` +
        `.con-recv__emerge[data-played-key="${card}"], .con-reaction__face[data-reaction-card="${card}"]`) !== null) {
        w.__rose = true;
      }
    }, 16);
  }, PROTEUS);
}

async function roseSeen(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as {__rose?: boolean}).__rose === true);
}

const proteusTiles = (page: Page) => page.locator(`.con-cardactions__tile[data-action-card="${PROTEUS}"]`);

test.describe(`console · TR82 Proteus · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A — the start: the second Prelude says «Сработает», R3 opens the layer; Proteus answers OUT OF ITS SLOT on the shelf into its own capsule', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true, prelude: true},
      startingCorporations: 1,
      customCorporationsList: [PROTEUS],
      customPreludes: [MOHOLE, MARTIAN, 'Allied Bank', 'Business Empire'],
    })});
    // THE REAL START: the wizard is answered through the console (its commit takes the workspace's lifetime hold — the
    // hold the completion sequence releases only once the table's last answer has played; seeded over the API there is no
    // hold and the workspace leaves with the last prompt).
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, [PROTEUS]), 'Proteus was offered and picked').toContain(PROTEUS);
        } else if (kind === 'prelude') {
          const got = await pickCards(p, [MOHOLE, MARTIAN]);
          expect(got, 'both Building Preludes were picked').toEqual(expect.arrayContaining([MOHOLE, MARTIAN]));
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});

    // The corporation first: it lands with its 2 data.
    expect(await playQueueCard(page, PROTEUS), 'the corporation was played from the queue').toBe(true);
    // The solo setup's colony removal is deferred ahead of the corporation's own data — answered over the API when it stands.
    for (let i = 0; i < 20; i++) {
      const wf = (await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {type: string, coloniesModel?: Array<{name: string}>}}).waitingFor;
      if (wf?.type === 'colony') {
        await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wf.coloniesModel ?? [])[0]?.name ?? ''});
        break;
      }
      if (proteusData(await wireOf(request, playerId)) > 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await expect.poll(async () => proteusData(await wireOf(request, playerId)), {timeout: 30_000, message: 'the server: 2 data on Proteus'}).toBe(2);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});

    // The FIRST Prelude: nothing of its own to match — no data of Proteus in its «Сработает» (the table may still answer
    // its Building tag otherwise: a party's M€ — the door is standing there already).
    expect(await focusCard(page, MOHOLE), `never focused «${MOHOLE}»`).toBe(true);
    await settle(page);
    await shoot(page, 'A-00-first-prelude');
    await expect(page.locator('[data-start-prelude-forecast] .card-resource-data'), 'the first Prelude wakes no data on Proteus').toHaveCount(0);
    expect(await playQueueCard(page, MOHOLE), 'the first Prelude was played').toBe(true);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 40_000});
    expect(proteusData(await wireOf(request, playerId)), 'the first Prelude paid nothing').toBe(2);

    // The SECOND Prelude: «Сработает» with the corporation's data, R3 → the layer, B folds it.
    expect(await focusCard(page, MARTIAN), `never focused «${MARTIAN}»`).toBe(true);
    const row = page.locator('[data-start-prelude-forecast] [data-forecast-row]');
    await expect(row, '«Сработает» stands on the status rail').toHaveCount(1, {timeout: 20_000});
    await expect(row.locator('[data-forecast-chip="own"] .card-resource-data'), 'its chip is the corporation\'s own data').not.toHaveCount(0);
    await expect(page.locator('.con-cmdbar'), 'the bar offers R3 «Эффекты»').toContainText(/Эффекты/i);
    await shoot(page, 'A-01-second-prelude');
    expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-start [data-forecast-layer]').count() > 0, {tries: 3, settleMs: 1100}),
      'R3 opens the «Эффекты» layer').toBeTruthy();
    expect((await crumbText(page)).toUpperCase(), 'the crumb gains its tail').toMatch(/ЭФФЕКТЫ/);
    await expect(page.locator('.con-start [data-forecast-layer]'), 'the layer names Proteus').toContainText(PROTEUS);
    await shoot(page, 'A-02-layer');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-start [data-forecast-layer]').count() === 0, {tries: 3, settleMs: 900}),
      'B folds the layer').toBeTruthy();

    // A → the Prelude lands; Proteus answers out of its slot on the shelf.
    await armTransferWitness(page);
    await armShelfProbe(page);
    await armRiseProbe(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => proteusData(await wireOf(request, playerId)), {timeout: 30_000, message: 'the server: 3 data'}).toBe(3);
    const lifted = await expect.poll(() => shelfProbe(page).then((s) => s.some((x) => x.lifted)), {timeout: 30_000}).toBe(true).then(() => true, () => false);
    if (!lifted) {
      // Name what happened instead: the shelf's samples, a rise anywhere, the transfer trail, the reaction state.
      const diag = await page.evaluate(() => JSON.stringify({
        shelf: (window as unknown as {__shelf?: unknown}).__shelf,
        rose: (window as unknown as {__rose?: boolean}).__rose,
        ready: (window as unknown as {__conReady?: () => unknown}).__conReady?.(),
      }));
      writeTrail('a-diag', diag + '\n' + transferTrail(await transferWitness(page)));
    }
    expect(lifted, 'Proteus rose in its slot on the shelf (see test-results/proteus-a-diag)').toBe(true);
    await shoot(page, 'A-03-rises');
    await settle(page, {timeoutMs: 60_000});
    const witness = await transferWitness(page);
    writeTrail('a', transferTrail(witness));
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const births = witness.births.filter((b) => b.under === `reactor:${PROTEUS}:data`);
    expect(births.length, `one data token was born on Proteus' printed data\n${transferTrail(witness)}`).toBe(1);
    const landing = witness.landings.find((l) => l.id === births[0]?.id);
    expect(landing?.under, `…and landed on its own face on the shelf\n${transferTrail(witness)}`).toBe(`played:${PROTEUS}`);
    const shelf = await shelfProbe(page);
    const counts = shelf.map((s) => s.count).filter((c) => c !== '');
    expect(counts.indexOf('3'), `the capsule ticked 2 → 3 on the touchdown (${counts.join(' ')})`).toBeGreaterThan(-1);
    const firstLift = shelf.find((s) => s.lifted)?.t ?? Infinity;
    expect(firstLift, 'Proteus rose before its data touched down').toBeLessThan(shelf.find((s) => s.count === '3')?.t ?? -1);
    await shoot(page, 'A-04-landed');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('B — a Building card from the hand wakes Proteus; then 6 data → a colony, the colonies take the stage', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootFixture(page, request, 'proteus', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const start = await wireOf(request, playerId);
    expect(proteusData(start), 'the fixture: 5 data on Proteus').toBe(5);

    // ── the hand play.
    for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1400);
    }
    await page.locator(`.con-hand [data-zoom-slot="${BUILDING_CARD}"]`).waitFor({timeout: 20_000});
    expect(await focusCard(page, BUILDING_CARD, 24), `never focused «${BUILDING_CARD}»`).toBeTruthy();
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}),
      'A opens the play composer').toBeTruthy();
    await settle(page);
    await expect(page.locator('.con-composer--play [data-forecast-row]'), '«Сработает» names the corporation\'s data').toHaveCount(1);
    await shoot(page, 'B-01-composer');
    await armTransferWitness(page);
    await armRiseProbe(page);
    // ONE press — a second A during the landing is the scene's own «hurry».
    await page.keyboard.press('Enter');
    await expect.poll(async () => proteusData(await wireOf(request, playerId)), {timeout: 30_000, message: 'the server: +1 data'}).toBe(6);
    await expect.poll(() => roseSeen(page), {timeout: 30_000, message: 'Proteus rose (in its place, or at the stage)'}).toBe(true);
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witnessB = await transferWitness(page);
    writeTrail('b', transferTrail(witnessB));
    expect(endsOverGlass(witnessB), `every end visible\n${transferTrail(witnessB)}`).toEqual([]);
    expect(witnessB.births.filter((b) => b.under === `reactor:${PROTEUS}:data`).length,
      `one data token born on Proteus' printed data\n${transferTrail(witnessB)}`).toBe(1);

    // ── the action: two tiles, the colony one.
    await openCardActions(page);
    // ONE printed row («6 [data] → [colony] OR [ocean]») covering both branches: ONE tile, the choice in the composer.
    await expect(proteusTiles(page), 'the printed row is one tile').toHaveCount(1);
    await shoot(page, 'B-02-tile');
    await openActionFocus(page);
    const options = page.locator(`${ACTION_COMPOSER} .con-vchoice__opt`);
    await expect(options, 'two outcome tiles — a colony, an ocean').toHaveCount(2);
    await shoot(page, 'B-03-outcome-tiles');
    for (let i = 0; i < 6 && await page.locator(`${ACTION_COMPOSER} .con-vchoice__opt--focused`).count() === 0; i++) {
      await press(page, 'ArrowUp', 220);
    }
    for (let i = 0; i < 3 && !((await options.nth(0).getAttribute('class')) ?? '').includes('--focused'); i++) {
      await press(page, 'ArrowLeft', 300);
    }
    expect(await pressUntil(page, 'Enter', async () => ((await options.nth(0).getAttribute('class')) ?? '').includes('con-vchoice__opt--selected'), {tries: 3, settleMs: 500}),
      'A seals the colony tile').toBeTruthy();
    const before = await wireOf(request, playerId);
    await armTransferWitness(page);
    // The commit — then the colonies take the whole stage.
    for (let i = 0; i < 5 && await page.locator('.con-colonies').count() === 0; i++) {
      await press(page, 'Enter', 1500);
    }
    await page.locator('.con-colonies').waitFor({timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'B-04-colonies');
    for (let i = 0; i < 4 && await page.locator('.con-colfocus').count() === 0; i++) {
      await press(page, 'Enter', 1800);
    }
    await page.locator('.con-colfocus').waitFor({timeout: 20_000});
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.coloniesCount, {timeout: 30_000, message: 'the server: a colony built'})
      .toBe(before.thisPlayer.coloniesCount + 1);
    expect(proteusData(await wireOf(request, playerId)), 'the 6 data left the card').toBe(0);
    await settle(page, {timeoutMs: 60_000});
    const witnessC = await transferWitness(page);
    writeTrail('b-action', transferTrail(witnessC));
    expect(endsOverGlass(witnessC), `every end visible\n${transferTrail(witnessC)}`).toEqual([]);
    await shoot(page, 'B-05-colony-built');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('C — nothing to gain: the colony tile refused with its reason, the ocean tile with the verdict, the action available', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'proteus-futile', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    expect(proteusData(await wireOf(request, playerId)), 'the fixture: 6 data on Proteus').toBe(6);
    await openCardActions(page);
    const tile = proteusTiles(page);
    await expect(tile, 'one tile').toHaveCount(1);
    await expect(tile, 'the whole action carries the futility verdict').toHaveAttribute('data-action-futile', 'parameter-maxed');
    await expect(tile.locator('[data-tile-futile]'), '…in words').toHaveCount(1);
    await shoot(page, 'C-01-futile-tile');
    // Still available: A opens the composer, the colony refused with its reason, the ocean live.
    await openActionFocus(page);
    const options = page.locator(`${ACTION_COMPOSER} .con-vchoice__opt`);
    await expect(options, 'two outcome tiles').toHaveCount(2);
    await expect(options.nth(0), 'the colony tile is refused').toHaveClass(/con-vchoice__opt--off/);
    await expect(options.nth(0).locator('.con-vchoice__reason'), '…with its reason').not.toHaveText('');
    await expect(options.nth(1), 'the ocean tile stays live').not.toHaveClass(/con-vchoice__opt--off/);
    await shoot(page, 'C-02-futile-composer');
  });
});
