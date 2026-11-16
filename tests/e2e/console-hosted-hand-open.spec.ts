import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, press, settle} from './consoleStart';
import {armWitness, witnessOf} from './witness';

/**
 * P86 (the owner's report): «при открытии "Продажи патентов" не виден веер раскрытия руки из дока». The bodies' flight
 * dock → album RAN, but UNDER the opaque «Стандартные проекты» panel: the reveal layer drops to z 11469 under a
 * dockcover surface whenever `con-root--dock-intake` is off, and the shell's intake lease was released the very tick the
 * episode was INSTALLED (the timeline plays after). Now the reveal director holds its own lease for the episode's whole
 * life (`installEpisode` → `teardown`), and the footer-behind tuck yields to the intake too.
 *
 * The witness RECORDS the STATE that paints, frame by frame from before the press: while any body flies
 * (`[data-reveal-card]`), the root carries `con-root--dock-intake` and the layer is NOT demoted under the panel; the
 * hosted hand does not «appear with its cards down» (its root is not transparent while the flight is its entry —
 * `data-hand-arrives="flight"`). Hosts covered here: the patent sale (dockcover). NOT covered by this stand (printed
 * so, never pretended): Pluto's discard in the colonies section (footer-behind), the Reds' discard in the Parliament,
 * the composer's own pick, the start step, a law's live step — they share the same lease and rule by construction.
 *
 * TIMING class (a flight witness). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'hosted-hand-open', 'stdp-sale');

const focusedRow = async (page: Page) =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

async function focusRow(page: Page, re: RegExp): Promise<void> {
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown',
    'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 6 && !re.test(await focusedRow(page)); i++) {
    await press(page, 'ArrowUp', 200);
  }
  if (!re.test(await focusedRow(page))) {
    await press(page, 'ArrowLeft', 200);
  }
  for (let i = 0; i < snake.length && !re.test(await focusedRow(page)); i++) {
    await press(page, snake[i], 240);
  }
  expect(re.test(await focusedRow(page)), `could not focus ${re}`).toBeTruthy();
}

type Sample = {t: number, flying: number, intake: boolean, dockcover: boolean, layerZ: string, handOpacity: number, arrives: string};
/** One moment as the reader sees it — the sample without its clock (the recording stamps the page's time). */
type Seen = Omit<Sample, 't'>;
const FLIGHT_WITNESS = 'hosted-hand-open';

/**
 * THE FLIGHT'S RECORDING (FLAKE ZERO — `armWitness`, armed before the press): every painted frame and every write of the
 * product, kept on change with the page's time. «No flight frame demoted / transparent» is a claim about what a FRAME
 * shows, so the record is `settled` — the state a task leaves (what the old 16 ms timer, a task of its own, saw).
 */
async function armFlightWitness(page: Page): Promise<void> {
  await armWitness<Seen>(page, FLIGHT_WITNESS, () => {
    const root = document.querySelector('.con-root');
    const layer = document.querySelector('.con-handreveal-layer');
    const hand = document.querySelector<HTMLElement>('.con-stdp .con-hand');
    return {
      flying: document.querySelectorAll('.con-handbody[data-reveal-card]').length,
      intake: root?.classList.contains('con-root--dock-intake') === true,
      dockcover: root?.classList.contains('con-root--ws-dockcover') === true,
      layerZ: layer !== null ? getComputedStyle(layer).zIndex : '',
      handOpacity: hand !== null ? Number(getComputedStyle(hand).opacity) : -1,
      arrives: hand?.dataset.handArrives ?? '',
    };
  }, {settled: true, max: 20_000});
}

test.describe(`a HOSTED hand opens with its flight in view · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('«Продажа патентов»: the bodies fly OVER the panel, the intake lease stands for the whole flight', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'unexpected-application', {query: PRESET.query});
    await settle(page);
    await press(page, 'Comma', 1100);
    await press(page, 'Enter', 1400);
    await page.waitForSelector('.con-stdp', {timeout: 15_000});
    await settle(page);
    await focusRow(page, /продажа патентов/i);
    await armFlightWitness(page);
    await press(page, 'Enter', 400);
    await page.waitForSelector('.con-stdp .con-hand', {timeout: 15_000});
    // The window ends on the END STATE of the episode, never on a duration: the bodies flew, and then none flies and the
    // intake lease the episode held is let go (`teardown`).
    const witness = witnessOf<Seen>(page, FLIGHT_WITNESS);
    await witness.waitFor((s) => s.flying > 0, {timeoutMs: 20_000, message: 'the bodies never took off'});
    await expect.poll(async () => {
      const seen = await witness.values();
      return seen.slice(seen.findIndex((s) => s.flying > 0)).some((s) => s.flying === 0 && !s.intake);
    }, {timeout: 20_000, message: 'the flight ended and the episode let its intake lease go'}).toBe(true);
    const recorded = await witness.stop();
    const t0 = recorded[0]?.t ?? 0;
    const samples: Array<Sample> = recorded.map((s) => ({...s.v, t: s.t - t0}));
    const flight = samples.filter((s) => s.flying > 0);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify(samples, null, 1));
    expect(flight.length, `the bodies flew (${samples.length} samples)`).toBeGreaterThan(0);
    const demoted = flight.filter((s) => s.dockcover && (!s.intake || s.layerZ === '11469'));
    expect(demoted, 'no flight frame with the layer demoted under the dockcover panel').toEqual([]);
    const hidden = flight.filter((s) => s.handOpacity >= 0 && s.handOpacity < 0.5);
    expect(hidden, 'the hosted hand is not transparent while its cards fly in (the flight IS its entry)').toEqual([]);
    expect(flight.some((s) => s.arrives === 'flight'), 'the hosted hand declares its flight entry').toBe(true);
    await settle(page);
    await page.screenshot({path: path.join(OUT, 'settled.png')});
    test.info().annotations.push({type: 'hosts-not-covered', description: 'pluto-discard (colonies, footer-behind) · reds-discard (parliament) · composer pick · start step · law live step'});
  });
});
