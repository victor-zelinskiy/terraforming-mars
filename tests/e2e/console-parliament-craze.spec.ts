import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {
  bootFixtureSeats, cinematicBeat, closeZoomViewer, commitFocusedSpace, fetchPlayerModel, press, pressUntil, settle,
  walkToSpace,
} from './consoleStart';

/**
 * DEVELOPMENT CRAZE (Turmoil Redux, RX10) — the first LIVE PASSIVE, and the
 * one thing new about it: a placement's bonuses PAID TWICE, made VISIBLE.
 *
 * ONE e2e on ONE profile (the card's verification budget). The card stands
 * ENACTED (fixture `parliament-craze-enacted`: red opens generation 2 with
 * 30 M€); the viewer builds a standard-project GREENERY on a cell printing two
 * steel (a greenery, not a city: a city would also complete the card's own
 * chairman quest and draw Mars First's card — two other flows over the one
 * under test), and the journey asserts the four things the owner asked to see:
 *   ① the Information effects list carries the LAW's row — first, marked
 *     «Принятая резолюция», with the card's own printed graphic;
 *   ② the placement pays the cell TWICE, as two waves IN TURN: the scene
 *     announces the echo (`data-echo`), and the steel counter passes through
 *     an intermediate value on its way from «before» to «before + 5»
 *     (2 printed + 2 echoed + the ruling Mars First's 1) — never one jump;
 *   ③ the LAW's own card: the viewer's action is suppressed, the resolution's
 *     answer to it is not — «Сработал эффект», the resolution as the source,
 *     +2 steel as its own chips;
 *   ④ hold X on that card opens the RESOLUTION's own inspector (the one
 *     viewer the Parliament's X opens), and closes back to the board.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; the wire
 * (`/api/player`) is the truth the screen is checked against.
 * Screenshots under screenshots/parliament-craze/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-craze', 'standard-1080');
const CRAZE_ID = 'RDX_MARS_DEVELOPMENT_CRAZE';
const CRAZE_CLASS = /rdx-mars-development-craze/;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Sample = {t: number, src: 'mo' | 'tick', phase: string, echo: boolean, steel: number | undefined, toast: boolean};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the commit. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__crazeProbe: Probe};
    const probe: Probe = {samples: []};
    w.__crazeProbe = probe;
    const read = (src: 'mo' | 'tick'): void => {
      const scene = document.querySelector<HTMLElement>('.con-tileplace');
      const digits = document.querySelector<HTMLElement>('.con-res__row--steel .con-res__digits')?.textContent?.trim() ?? '';
      const m = digits.match(/^-?\d+/);
      probe.samples.push({
        t: performance.now(),
        src,
        phase: scene?.getAttribute('data-tile-phase') ?? '',
        echo: scene?.getAttribute('data-echo') === '1',
        steel: m === null ? undefined : Number(m[0]),
        toast: document.querySelector('.con-notif[data-notif-id$=":law"]') !== null,
      });
    };
    new MutationObserver(() => read('mo')).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => read('tick'), 40);
  });
}

const probeOf = (page: Page) => page.evaluate(() => (window as unknown as {__crazeProbe: Probe}).__crazeProbe);

type WireSpaces = {game: {spaces?: Array<{id: string, bonus: Array<number>, tileType?: number}>}};
type WireSteel = {thisPlayer?: {steel?: number}};

/** Walk the standard-projects sheet until the FOCUSED card is «Озеленение». */
async function focusGreenery(page: Page): Promise<boolean> {
  const focusedName = () => page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
  await settle(page, {timeoutMs: 10_000, notifications: false});
  const walk = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown'];
  for (let i = 0; i <= walk.length; i++) {
    if (/^озеленение/i.test((await focusedName()).trim())) {
      return true;
    }
    if (i < walk.length) {
      await press(page, walk[i], 500);
    }
  }
  return false;
}

test.describe('Development Craze (RX10) · the law pays a placement twice, visibly', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the effects list names the law; a greenery on a steel cell is paid twice in two waves; the law\'s card opens the resolution\'s inspector', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-craze-enacted');

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
    // The effects zone sits BELOW the actions column — the ring walk needs the down arrow (the gallery's own route).
    const effectsFocused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
    for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
      if (await effectsFocused() > 0) {
        break;
      }
      await press(page, move, 300);
    }
    expect(await effectsFocused(), 'the effects zone takes the focus').toBeGreaterThan(0);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
    const strip = page.locator('.con-pfx');
    await expect(strip, 'the Parliament strip stands in the explorer').toHaveCount(1, {timeout: 10_000});
    const law = strip.locator('.con-pfx__item').first();
    await expect(law, 'the LAW leads the strip').toHaveClass(/con-pfx__item--resolution/);
    await expect(law).toHaveAttribute('data-resolution', CRAZE_ID);
    await expect(law.locator('.con-pfx__law'), 'said for what it is').toHaveText(/Принятая резолюция/i);
    await expect(law.locator('.con-pfx__why b'), 'titled by the card').toHaveText(/Строительная лихорадка/i);
    await expect(law.locator('.con-pformula__mech'), 'the card\'s own printed graphic').toHaveCount(1);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '01-effects-strip');
    // Back to the board home.
    for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await expect(page.locator('.con-info, .con-efx')).toHaveCount(0, {timeout: 10_000});

    // ② THE PLACEMENT — LT wheel → standard projects (the centre slot) → «Озеленение» → pay → the board.
    const before = await fetchPlayerModel(request, playerId) as WireSteel;
    const steelBefore = before.thisPlayer?.steel ?? 0;
    await press(page, 'Comma', 1200);
    await press(page, 'Enter', 1500);
    expect(await focusGreenery(page), 'never focused «Озеленение»').toBe(true);
    await press(page, 'Enter', 1600);
    if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
      await press(page, 'KeyX', 2600);
    }
    const panel = page.locator('.con-context');
    await expect(panel, 'a board placement is open').toContainText(/Размещение тайла/i, {timeout: 15_000});
    // The target: a LEGAL cell (the server's own list) printing two steel — the wire, never a remembered id.
    const live = await fetchPlayerModel(request, playerId) as WireSpaces & {waitingFor?: {spaces?: Array<string>}};
    const legal = new Set(live.waitingFor?.spaces ?? []);
    const cell = (live.game.spaces ?? []).find((s) => legal.has(s.id) && s.tileType === undefined && s.bonus.filter((b) => b === SpaceBonus.STEEL).length === 2);
    expect(cell, `a legal greenery cell printing two steel (legal: ${[...legal].join(',')})`).toBeTruthy();
    await walkToSpace(page, cell!.id);
    await armProbe(page);
    expect(await commitFocusedSpace(page), 'the greenery commits on the two-steel cell').toBe(true);

    // The scene: watch for the ECHO and shoot it while it plays.
    let echoSeen = false;
    for (let i = 0; i < 200 && !echoSeen; i++) {
      echoSeen = (await page.locator('.con-tileplace[data-echo="1"]').count()) > 0;
      if (!echoSeen) {
        await cinematicBeat(page, 50, 'polling the placement scene for the echo wave');
      }
    }
    if (echoSeen) {
      await shoot(page, '02-placement-echo');
    }
    await expect(page.locator('.con-tileplace[data-tile-phase]'), 'the scene finished').toHaveCount(0, {timeout: 30_000});

    // ③ THE LAW's CARD — the viewer's own action is suppressed; the resolution's answer to it is not.
    const toast = page.locator('.con-notif[data-notif-id$=":law"]');
    await expect(toast, 'the law\'s card').toHaveCount(1, {timeout: 20_000});
    await expect(toast.locator('.con-notif__type')).toHaveText(/Сработал эффект/i);
    const source = toast.locator('.con-notif__source[data-effect-source="resolution"]');
    await expect(source, 'the source is the resolution').toHaveCount(1);
    await expect(source).toContainText(/Принятая резолюция/i);
    // The card is named ONCE — by the resolution chip of the law's own line («получает бонусы … второй раз — …»).
    await expect(toast.locator('.con-notif__lawline'), 'what the law did, in its own words').toContainText(/второй раз/i);
    await expect(toast.locator('.con-notif__lawline')).toContainText(/Строительная лихорадка/i);
    await expect(toast.locator('.con-notif__chip'), 'the law\'s own +2 steel').toContainText(/\+2/);
    await expect(toast.locator('.con-notif__action--detail'), 'hold X → Осмотреть').toContainText(/Осмотреть/i);
    await cinematicBeat(page, 450, 'the toast finishes its entrance before the frame is taken');
    await shoot(page, '03-law-toast');

    // ④ HOLD X — the resolution's OWN inspector.
    await page.keyboard.down('KeyX');
    await cinematicBeat(page, 900, 'the X-hold fills past NOTIF_HOLD_MS (500 ms)');
    await page.keyboard.up('KeyX');
    const zoom = page.locator('dialog.con-zoom[open]');
    await expect(zoom, 'the inspector opens').toHaveCount(1, {timeout: 15_000});
    await expect(zoom, 'the Parliament\'s own viewer').toHaveClass(/con-zoom--parliament/);
    await expect(zoom.locator('.pcard').first(), 'the resolution\'s face').toHaveClass(CRAZE_CLASS);
    await expect(toast, 'the card handed over to the inspector').toHaveCount(0, {timeout: 10_000});
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '04-inspect-resolution');
    await closeZoomViewer(page);
    await expect(zoom).toHaveCount(0, {timeout: 10_000});
    await settle(page, {timeoutMs: 30_000, notifications: false});

    // The wire: 2 printed + 2 echoed + the ruling Mars First's 1.
    const after = await fetchPlayerModel(request, playerId) as WireSteel;
    expect((after.thisPlayer?.steel ?? 0) - steelBefore, 'the cell was paid twice (+ the party steel)').toBe(5);

    // The probe: the echo was announced, and the counter passed through the middle — two waves, never one jump.
    const probe = await probeOf(page);
    const ticks = probe.samples.filter((s) => s.src === 'tick');
    expect(ticks.length, 'the sampler ran').toBeGreaterThan(10);
    expect(ticks.some((s) => s.echo), 'the scene announced the ECHO wave on painted frames').toBe(true);
    const steels = ticks.map((s) => s.steel).filter((v): v is number => v !== undefined);
    const distinct = [...new Set(steels)].sort((a, b) => a - b);
    const target = steelBefore + 5;
    expect(distinct[distinct.length - 1], 'the counter reached the doubled total').toBe(target);
    expect(distinct.some((v) => v > steelBefore && v < target), `the counter ticked through an intermediate value (${distinct.join(',')})`).toBe(true);
    const firstEcho = ticks.find((s) => s.echo);
    const lastNonEchoRewarding = [...ticks].reverse().find((s) => !s.echo && s.phase === 'rewarding' && s.t < (firstEcho?.t ?? 0));
    expect(lastNonEchoRewarding, 'the first wave played BEFORE the echo (in turn)').toBeTruthy();
  });
});
