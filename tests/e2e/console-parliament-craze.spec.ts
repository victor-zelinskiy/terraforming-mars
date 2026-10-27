import {test, expect, Page} from './consoleTest';
import {expectLawLeadsEffects} from './parliamentDrive';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {
  bootFixtureSeats, cinematicBeat, commitFocusedSpace, fetchPlayerModel, press, pressUntil, settle,
  walkToSpace, focusInfoZone,
} from './consoleStart';

/**
 * DEVELOPMENT CRAZE (Turmoil Redux, RX10) — the first LIVE PASSIVE, and the
 * one thing new about it: a placement's bonuses PAID TWICE, made VISIBLE.
 *
 * ONE e2e on ONE profile (the card's verification budget). The card stands
 * ENACTED (fixture `parliament-craze-enacted`: red opens generation 2 with
 * 30 M€); the viewer builds a standard-project GREENERY on a cell printing two
 * steel (a greenery closes nothing: the card's own chairman quest asks for a
 * SPECIAL tile — a city does not close it either — and a special tile would
 * seat the chairman and draw Mars First's card, two other flows over the one
 * under test), and the journey asserts the four things the owner asked to see:
 *   ① the Information effects list carries the LAW's row — first, marked
 *     «Принятая резолюция», with the card's own printed graphic;
 *   ② the placement pays the cell TWICE, as two waves IN TURN: the scene
 *     announces its own wave (`data-law-wave`), and the steel counter passes through
 *     an intermediate value on its way from «before» to «before + 5»
 *     (2 printed + 2 echoed + the ruling Mars First's 1) — never one jump;
 *   ③ the LAW ITSELF rises at the stage for its second wave («СРАБАТЫВАНИЕ
 *     КАРТЫ», iteration 4: the enacted resolution is the reactor) — the centre of
 *     the central opening, a readable beat — the cell's icons answering it again;
 *   ④ NO second telling: the feed builds no «Сработал эффект» card about the
 *     chain the scene just played.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; the wire
 * (`/api/player`) is the truth the screen is checked against.
 * Screenshots under screenshots/parliament-craze/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-craze', 'standard-1080');
const CRAZE_ID = 'RDX_MARS_DEVELOPMENT_CRAZE';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Sample = {t: number, src: 'mo' | 'tick', phase: string, echo: boolean, steel: number | undefined, toast: boolean, face: boolean};
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
        echo: scene?.getAttribute('data-law-wave') === '1',
        steel: m === null ? undefined : Number(m[0]),
        toast: document.querySelector('.con-notif[data-notif-id$=":law"]') !== null,
        face: (() => {
          const el = document.querySelector<HTMLElement>('.con-reaction__face[data-reaction-card="RDX_MARS_DEVELOPMENT_CRAZE"]');
          return el !== null && el.getBoundingClientRect().width > 4 && Number(getComputedStyle(el).opacity) >= 0.3;
        })(),
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

  test('the effects list names the law; a greenery on a steel cell is paid twice in two waves — the law rising for the second; no card tells it again', async ({page, request}) => {
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
    // The dossier is two tiers (TR60): the driver walks the zones' own geometry, never a memorised key sequence.
    expect(await focusInfoZone(page, 'effects'), 'the effects zone takes the focus').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
    // «Один фреймворк»: the law is a GROUP of the explorer's grid, and it leads it.
    await expectLawLeadsEffects(page, {id: CRAZE_ID, name: /Строительная лихорадка/i});
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
      echoSeen = (await page.locator('.con-tileplace[data-law-wave="1"]').count()) > 0;
      if (!echoSeen) {
        await cinematicBeat(page, 50, 'polling the placement scene for the echo wave');
      }
    }
    if (echoSeen) {
      await shoot(page, '02-placement-echo');
    }
    await expect(page.locator('.con-tileplace[data-tile-phase]'), 'the scene finished').toHaveCount(0, {timeout: 30_000});

    // ③ + ④ NO SECOND TELLING — the law's second wave was PLAYED (the law rose at the stage; the counters ticked on
    //    the touchdowns): the feed builds no «Сработал эффект» card about that chain (iteration 4).
    const toast = page.locator('.con-notif[data-notif-id$=":law"]');
    await cinematicBeat(page, 1500, 'the window a law card would have entered the feed in');
    await expect(toast, 'no law card — the scene told it').toHaveCount(0);
    await shoot(page, '03-after-the-waves');
    await settle(page, {timeoutMs: 30_000, notifications: false});

    // The wire: 2 printed + 2 echoed + the ruling Mars First's 1.
    const after = await fetchPlayerModel(request, playerId) as WireSteel;
    expect((after.thisPlayer?.steel ?? 0) - steelBefore, 'the cell was paid twice (+ the party steel)').toBe(5);

    // The probe: the echo was announced, and the counter passed through the middle — two waves, never one jump.
    const probe = await probeOf(page);
    const ticks = probe.samples.filter((s) => s.src === 'tick');
    expect(ticks.length, 'the sampler ran').toBeGreaterThan(10);
    expect(ticks.some((s) => s.echo), 'the scene announced the ECHO wave on painted frames').toBe(true);
    expect(ticks.filter((s) => s.face).length, 'the LAW\'s face stood at the stage for a readable beat (the second wave\'s reactor)').toBeGreaterThanOrEqual(3);
    expect(ticks.some((s) => s.toast), 'no law card at any instant').toBe(false);
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
