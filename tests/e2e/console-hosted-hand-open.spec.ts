import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, press, settle} from './consoleStart';

/**
 * P86 (the owner's report): «при открытии "Продажи патентов" не виден веер раскрытия руки из дока». The bodies' flight
 * dock → album RAN, but UNDER the opaque «Стандартные проекты» panel: the reveal layer drops to z 11469 under a
 * dockcover surface whenever `con-root--dock-intake` is off, and the shell's intake lease was released the very tick the
 * episode was INSTALLED (the timeline plays after). Now the reveal director holds its own lease for the episode's whole
 * life (`installEpisode` → `teardown`), and the footer-behind tuck yields to the intake too.
 *
 * The witness reads the STATE that paints, frame by frame from before the press: while any body flies
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

async function armFlightWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t0 = performance.now();
    const samples: Array<{t: number, flying: number, intake: boolean, dockcover: boolean, layerZ: string, handOpacity: number, arrives: string}> = [];
    (window as unknown as {__hostedHandOpen: typeof samples}).__hostedHandOpen = samples;
    const tick = () => {
      const root = document.querySelector('.con-root');
      const layer = document.querySelector('.con-handreveal-layer');
      const hand = document.querySelector<HTMLElement>('.con-stdp .con-hand');
      samples.push({
        t: Math.round(performance.now() - t0),
        flying: document.querySelectorAll('.con-handbody[data-reveal-card]').length,
        intake: root?.classList.contains('con-root--dock-intake') === true,
        dockcover: root?.classList.contains('con-root--ws-dockcover') === true,
        layerZ: layer !== null ? getComputedStyle(layer).zIndex : '',
        handOpacity: hand !== null ? Number(getComputedStyle(hand).opacity) : -1,
        arrives: hand?.dataset.handArrives ?? '',
      });
    };
    const timer = window.setInterval(() => {
      tick();
      if (performance.now() - t0 >= 4000) {
        window.clearInterval(timer);
      }
    }, 16);
  });
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
    // The witness samples its own 4 s window; wait for its LAST sample (state, never a sleep).
    await page.waitForFunction(() => {
      const s = (window as unknown as {__hostedHandOpen?: Array<{t: number}>}).__hostedHandOpen ?? [];
      return s.length > 0 && s[s.length - 1].t >= 3980;
    }, undefined, {timeout: 20_000});
    const samples = await page.evaluate(() => (window as unknown as {__hostedHandOpen: Array<Sample>}).__hostedHandOpen);
    const flight = samples.filter((s) => s.flying > 0);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify(samples, null, 1));
    expect(flight.length, `the bodies flew (${samples.length} samples)`).toBeGreaterThanOrEqual(3);
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
