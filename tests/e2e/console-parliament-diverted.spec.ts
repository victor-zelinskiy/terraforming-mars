import {test, expect, Page, APIRequestContext} from './consoleTest';
import {expectLawLeadsEffects} from './parliamentDrive';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, cinematicBeat, closeZoomViewer, fetchPlayerModel, focusInfoZone, press, pressUntil, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * DIVERTED RESEARCH (Turmoil Redux, RX35) — the ONE e2e of the new mechanic: a
 * law that REPLACES a seat's terraforming BEFORE it happens. The card stands
 * ENACTED (fixture `parliament-diverted-enacted`: red opens generation 2 with
 * 30 M€, 8 heat, «Supercomputer» — a data holder — on its table, oxygen at
 * 13 %, the temperature at −20 °C), and the journey asserts, on two profiles:
 *
 *   ① the Information effects list carries the LAW's row — first, marked
 *     «Принятая резолюция», with the card's own printed graphic;
 *   ② LT → the heat conversion: the mini-stage stands (the press has a
 *     «where» to collect), the temperature step reads STRUCK «→ +1 [data]»
 *     with no implied rating beside it; A opens the shared picker INSIDE the
 *     plate; the pick answers the batch — the temperature NEVER moves (the
 *     wire and the readout), the data lands on the card, and the token's
 *     flight is WITNESSED: born in view, landed on the holder, never over glass;
 *   ③ the LAW's own card: «Сработал эффект», the resolution as the source,
 *     «+1 [data]» as its chip; hold X → the resolution's inspector;
 *   ④ the standard project «Астероид»: the row's foot reads the struck step and
 *     «Далее: выберите карту для данных.» — no board trip; A opens the picker
 *     in the workspace's own step zone; the batch commits — 14 M€ paid, the
 *     temperature still −20 °C, one more data on the card.
 *
 * `TM_E2E_STORYBOARD=1` writes every compositor frame of the heat beat
 * (`screenshots/parliament-diverted/<profile>/story-*`). Screens under
 * screenshots/parliament-diverted/<profile>/.
 */
const OUT = path.resolve('screenshots', 'parliament-diverted');
const LAW_ID = 'RDX_REDS_DIVERTED_RESEARCH';
const LAW_CLASS = /rdx-reds-diverted-research/;
const HOLDER = 'Supercomputer';
const CONFIRM = '.con-confirm';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, heat: number, terraformRating: number, tableau: Array<{name: string, resources?: number}>},
  game: {temperature: number, oxygenLevel: number},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const dataOn = (w: Wire, card = HOLDER): number => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
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

/** Poll the SERVER until `ok` holds (the press is answered) — never a fixed sleep. */
async function untilServer(request: APIRequestContext, playerId: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 160; i++) {
    last = await wireOf(request, playerId);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached: ${what} (last: heat ${last?.thisPlayer.heat}, M€ ${last?.thisPlayer.megacredits}, data ${last === undefined ? '?' : dataOn(last)}, t ${last?.game.temperature})`);
}

const onBoard = (p: Page) => () => p.evaluate(() => {
  const board = document.querySelector<HTMLElement>('.con-board');
  return document.querySelector('.con-ws') === null && board !== null && board.offsetParent !== null;
});

/** The temperature READOUT as the player sees it. */
const temperatureText = (page: Page) => page.evaluate(() => {
  const host = Array.from(document.querySelectorAll('.con-status__param')).find((el) => el.querySelector('.wgt-icon--temperature') !== null);
  return (host?.querySelector('.con-status__value')?.textContent ?? '').trim();
});

/** The picker's candidate under the cursor (the shared task host, wherever it is hosted). */
const focusedCandidate = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-task-host .con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '');

/** Answer the hosted «where»: the holder under the cursor, A (a single pick commits on A; the host then stands SEALED while the scene plays). */
async function answerWhere(page: Page, host: string): Promise<void> {
  const slot = page.locator(`${host} .con-task-host .con-cards__slot`);
  await slot.first().waitFor({timeout: 30_000});
  await expect(page.locator(`${host} .con-task-host [data-zoom-slot="${HOLDER}"]`), 'the holder is the candidate').toHaveCount(1);
  for (let i = 0; i < 4 && await focusedCandidate(page) !== HOLDER; i++) {
    await press(page, 'ArrowRight', 400);
  }
  expect(await focusedCandidate(page)).toBe(HOLDER);
  await press(page, 'Enter', 500);
}

/** The standard-projects sheet's focused row name. */
const focusedRow = async (page: Page): Promise<string> =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

async function focusRow(page: Page, re: RegExp): Promise<void> {
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 6 && !re.test(await focusedRow(page)); i++) {
    await press(page, 'ArrowUp', 200);
  }
  if (!re.test(await focusedRow(page))) {
    await press(page, 'ArrowLeft', 200);
  }
  for (let i = 0; i < snake.length && !re.test(await focusedRow(page)); i++) {
    await press(page, snake[i], 240);
  }
  expect(re.test(await focusedRow(page)), `could not focus ${re} (at «${await focusedRow(page)}»)`).toBeTruthy();
}

for (const preset of PRESETS) {
  test.describe(`Diverted Research (RX35) · the law replaces the seat's terraforming with data · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('the effects list names the law; the heat conversion asks WHERE and moves no scale; the law\'s card; the asteroid asks no cell', async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-diverted-enacted', {query: preset.query});
      await settle(page);
      const start = await wireOf(request, playerId);
      expect(start.thisPlayer.heat, 'the fixture: 8 heat').toBe(8);
      expect(start.game.temperature, 'the fixture: −20 °C').toBe(-20);
      expect(start.game.oxygenLevel, 'the fixture: 13 %').toBe(13);
      const data0 = dataOn(start);

      // ① THE EFFECTS LIST — Information → the effects zone → the explorer's Parliament strip.
      const infoRoot = page.locator('.con-info');
      for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
        if (i > 0) {
          await press(page, 'Enter', 700);
          await press(page, 'Escape', 500);
        }
        await press(page, 'KeyY', 1100);
      }
      await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
      expect(await focusInfoZone(page, 'effects'), 'the effects zone takes the focus').toBe(true);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
      // «Один фреймворк»: the law is a GROUP of the explorer's grid, and it leads it.
      await expectLawLeadsEffects(page, {id: LAW_ID, name: /Перенаправленные исследования/i});
      await settle(page, {timeoutMs: 15_000, notifications: false});
      await shoot(page, preset.id, '01-effects-strip');
      for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
        await press(page, 'Escape', 700);
      }
      await expect(page.locator('.con-info, .con-efx')).toHaveCount(0, {timeout: 10_000});

      // ② THE HEAT CONVERSION — LT → the right slot: the mini-stage stands because the press has a «where» to collect.
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'the viewer stands on the board').toBe(true);
      const readoutBefore = await temperatureText(page);
      expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}), 'the basic-actions wheel opens').toBe(true);
      const confirm = page.locator(`${CONFIRM}[data-confirm-kind="convertHeat"]`);
      expect(await pressUntil(page, 'ArrowRight', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), 'the heat confirm stands').toBe(true);
      await settle(page);
      const formula = page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip`);
      await expect(formula, 'the price and the STRUCK step — no implied rating beside a step that never happens').toHaveCount(2);
      const struck = page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip--diverted`);
      await expect(struck, 'the temperature step is struck').toHaveCount(1);
      await expect(struck.locator('[data-chip-diverted]'), 'and reads the data it becomes').toContainText('+1');
      await expect(struck.locator('.action-effect-chip__diverted-icon')).toHaveClass(/card-resource-data/);
      await expect(page.locator(`${CONFIRM} [data-forecast-row]`), 'the law answers — the «Сработает» row stands').toHaveCount(1);
      await shoot(page, preset.id, '02-heat-confirm');

      // A → the «where» INSIDE the plate; the pick → one batch. The flight is witnessed; the scale never moves.
      const stop = await storyboard(page, preset.id, 'heat-where');
      await press(page, 'Enter', 900);
      await expect(page.locator(`${CONFIRM} .con-task-host`), 'the shared picker stands inside the plate').toHaveCount(1, {timeout: 20_000});
      await expect(page.locator(`${CONFIRM} .con-confirm__step--up`), 'the plate\'s own zone hosts it').toHaveCount(1);
      await shoot(page, preset.id, '03-heat-where');
      await armTransferWitness(page);
      await answerWhere(page, CONFIRM);
      const afterHeat = await untilServer(request, playerId, (m) => m.thisPlayer.heat === 0 && dataOn(m) === data0 + 1, '8 heat spent, 1 data on the holder');
      expect(afterHeat.game.temperature, 'the temperature NEVER moved').toBe(-20);
      expect(afterHeat.thisPlayer.terraformRating, 'no rating').toBe(start.thisPlayer.terraformRating);
      await expect(confirm, 'the plate leaves with the press').toHaveCount(0, {timeout: 20_000});
      await settle(page, {timeoutMs: 40_000, notifications: false});
      await stop();

      // ③ THE LAW's CARD — the viewer's own action is suppressed; the resolution's answer to it is not. Read and HELD
      // right after the scene: the card lives its toast's lifetime, and a 4K frame costs seconds — the board's own
      // readings wait their turn after the inspector.
      const toast = page.locator('.con-notif[data-notif-id$=":law"]');
      await expect(toast, 'the law\'s card').toHaveCount(1, {timeout: 20_000});
      await expect(toast.locator('.con-notif__type')).toHaveText(/Сработал эффект/i);
      const source = toast.locator('.con-notif__source[data-effect-source="resolution"]');
      await expect(source, 'the source is the resolution').toHaveCount(1);
      await expect(source).toContainText(/Принятая резолюция/i);
      await expect(toast.locator('.con-notif__lawline'), 'what the law did, in its own words').toContainText(/заменяет/i);
      await expect(toast.locator('.con-notif__chip'), 'the law\'s own +1 data').toContainText(/\+1/);
      await expect(toast.locator('.con-notif__action--detail'), 'hold X → Осмотреть').toContainText(/Осмотреть/i);
      await cinematicBeat(page, 300, 'the toast finishes its entrance before the frame is taken');
      await shoot(page, preset.id, '05-law-toast');
      expect(await toast.count(), 'the card still stands for the hold (its lifetime outlives the frame)').toBe(1);
      await page.keyboard.down('KeyX');
      await cinematicBeat(page, 900, 'the X-hold fills past NOTIF_HOLD_MS (500 ms)');
      await page.keyboard.up('KeyX');
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom, 'the inspector opens').toHaveCount(1, {timeout: 15_000});
      await expect(zoom, 'the Parliament\'s own viewer').toHaveClass(/con-zoom--parliament/);
      await expect(zoom.locator('.pcard').first(), 'the resolution\'s face').toHaveClass(LAW_CLASS);
      await settle(page, {timeoutMs: 15_000, notifications: false});
      await shoot(page, preset.id, '06-inspect-resolution');
      await closeZoomViewer(page);
      await expect(zoom).toHaveCount(0, {timeout: 10_000});
      await settle(page, {timeoutMs: 30_000, notifications: false});

      // …the board after the heat: the readout where it stood, the flight witnessed end to end.
      expect(await temperatureText(page), 'the readout stands where it stood').toBe(readoutBefore);
      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      expect(endsOverGlass(witness), `no flight end over glass:\n${trail}`).toEqual([]);
      expect(witness.births.some((b) => /^struck:/.test(b.under)), `the data's token was born on the STRUCK printed icon:\n${trail}`).toBe(true);
      expect(witness.births.every((b) => b.y >= 0 && b.x >= 0), `born in view (never above the frame):\n${trail}`).toBe(true);
      expect(witness.landings.some((e) => /^slot:Supercomputer/.test(e.under)), `landed on the holder:\n${trail}`).toBe(true);
      await shoot(page, preset.id, '04-after-heat');

      // ④ THE ASTEROID — LT → standard projects → «Астероид»: a struck step, the next step named, no board trip.
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'back on the board').toBe(true);
      await press(page, 'Comma', 1100);
      await press(page, 'Enter', 1400);
      await page.waitForSelector('.con-stdp', {timeout: 15_000});
      await focusRow(page, /^Астероид/i);
      await settle(page, {timeoutMs: 15_000, notifications: false});
      const foot = page.locator('.con-stdp__foot');
      await expect(foot.locator('.action-effect-chip--diverted'), 'the row\'s step is struck').toHaveCount(1);
      await expect(foot.locator('.con-stdp__context-next'), 'the next step is the card, never a cell').toContainText(/карту для данных/i);
      await expect(foot.locator('.con-stdp__context-next')).not.toContainText(/место на поле/i);
      await shoot(page, preset.id, '07-asteroid-row');
      const mcBefore = afterHeat.thisPlayer.megacredits;
      await press(page, 'Enter', 1200);
      await expect(page.locator('.con-stdp__step--up .con-task-host'), 'the picker stands in the workspace\'s own zone').toHaveCount(1, {timeout: 20_000});
      await expect(page.locator('.con-stdp__step--up [data-task-law-seal]'), 'the plate names the law that pays — its seal').toHaveCount(1);
      await shoot(page, preset.id, '08-asteroid-where');
      await armTransferWitness(page);
      await answerWhere(page, '.con-stdp__step--up');
      const afterAsteroid = await untilServer(request, playerId, (m) => m.thisPlayer.megacredits === mcBefore - 14 && dataOn(m) === data0 + 2, '14 M€ paid, one more data');
      expect(afterAsteroid.game.temperature, 'the temperature still never moved').toBe(-20);
      await expect(page.locator('.con-stdp'), 'the workspace leaves after its commit').toHaveCount(0, {timeout: 30_000});
      await settle(page, {timeoutMs: 40_000, notifications: false});
      const w2 = await transferWitness(page);
      const trail2 = transferTrail(w2);
      expect(endsOverGlass(w2), `no flight end over glass:\n${trail2}`).toEqual([]);
      expect(w2.births.some((b) => b.under === 'lawseal'), `the row is parked under its step — the token is born on the plate's LAW SEAL:\n${trail2}`).toBe(true);
      expect(w2.landings.some((e) => /^slot:Supercomputer/.test(e.under)), `landed on the holder:\n${trail2}`).toBe(true);
      await shoot(page, preset.id, '09-after-asteroid');
    });
  });
}
