import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, fetchPlayerModel, openActionFocus, openCardActions, press, settle, waitForBoardHome} from './consoleStart';

/**
 * A TOKEN LANDS ON THE NUMBER IT CHANGES (PL-094), A PRICE ON THE RAIL IS A
 * DEPARTURE (PL-099) — and nobody cries «Экран завис» over a card still flying
 * into the dock (PL-093).
 *
 * The rail's value column is reserved four digits wide and right-aligned, so
 * its box's centre stands left of a short number: a reward chip aimed at the
 * column's box touched down in the EMPTY reserve (measured 2026-10-08: 21 px
 * left of «12» at FHD, 44 px at 4K; a «0» a whole chip-width away) while the
 * counter ticked beside it — «the resources fly off to the left, into
 * nothing». The transfer framework aims at the INK now (`.con-res__digits`,
 * the TR cell's `.con-score__value` — the delta-chip anchor law's own anchors),
 * so the contact beat wakes ON the number and the tick happens under the token.
 *
 * And a blue action's PRICE off the rail (a plant, a steel, 7 M€) no longer
 * ticks silently at the server's answer: its token is born on the row's
 * digits, flies INTO the printed icon of that very cost on the hero card (the
 * row ticks on the departure), and only after it has been absorbed is the
 * result born at the result icon and flown to the rail.
 *
 * Three flights, two profiles, one probe (`MutationObserver` + `setInterval`,
 * never rAF), armed before the press:
 *  · TR13 Political Think Tank — «OK» on the verdict: the 5 M€ off the verdict's
 *    own reward chip (`revealHandoff`) onto the M€ digits;
 *  · Electro Catapult — the ACTION COMMIT: «−1» plant off the plants digits
 *    into the printed plant, THEN «+7» born inside the printed M€ tile onto the
 *    M€ digits;
 *  · Space Mirrors — «−7» off the M€ digits into the printed M€ tile, THEN the
 *    «+1» energy PRODUCTION chip onto the energy row's plate.
 * Each asserts: the chip was seen; its resting point (the sample its contact
 * beat first appears in) is inside the target's ink box (a quarter chip of
 * slack); the counter ticked no earlier than the touchdown (a price: no earlier
 * than its departure); the result is born only after the price has landed; the
 * whole run fired no foreground-watchdog recovery and no «Экран завис» notice.
 */

const OUT = path.resolve('screenshots', 'rail-landing');
type Wire = Record<string, any>;

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: '&consoleProfile=auto'},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

type Rect = {l: number, t: number, r: number, b: number} | null;
type Chip = {id: string, v: string, x: number, y: number, w: number, op: number};
type Sample = {
  t: number, chips: Array<Chip>, beats: Array<{x: number, y: number}>,
  targets: Record<string, Rect>, readouts: Record<string, string>, toast: string, ws: number,
};

/** Arm the landing probe: `targets` — the INK boxes tokens must land on / leave from; `readouts` — the counters. */
async function armProbe(page: Page, targets: Record<string, string>, readouts: Record<string, string>): Promise<void> {
  await page.evaluate(([targetSels, readoutSels]) => {
    const t0 = performance.now();
    const samples: Array<unknown> = [];
    const rectOf = (sel: string) => {
      const el = document.querySelector(sel);
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {l: +r.left.toFixed(1), t: +r.top.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1)};
    };
    const visible = (el: Element): number => {
      let op = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        op *= Number(cs.opacity);
      }
      return op;
    };
    let last = '';
    const sample = (tick: boolean) => {
      if (samples.length > 9000) {
        return;
      }
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.getAttribute('data-transfer-id') ?? '', v: (el.textContent ?? '').trim(),
          x: +(r.left + r.width / 2).toFixed(1), y: +(r.top + r.height / 2).toFixed(1), w: +r.width.toFixed(1), op: +visible(el).toFixed(2),
        };
      }).filter((c) => c.op > 0.05);
      const beats = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__beat')).map((el) => {
        const r = el.getBoundingClientRect();
        return {x: +(r.left + r.width / 2).toFixed(1), y: +(r.top + r.height / 2).toFixed(1), op: visible(el)};
      }).filter((b) => b.op > 0.05).map((b) => ({x: b.x, y: b.y}));
      const targets: Record<string, unknown> = {};
      for (const [key, sel] of Object.entries(targetSels as Record<string, string>)) {
        targets[key] = rectOf(sel);
      }
      const readouts: Record<string, string> = {};
      for (const [key, sel] of Object.entries(readoutSels as Record<string, string>)) {
        readouts[key] = (document.querySelector(sel)?.textContent ?? '').trim().match(/^[-+]?\d+/)?.[0] ?? '';
      }
      const s = {
        t: +(performance.now() - t0).toFixed(1), chips, beats, targets, readouts,
        toast: Array.from(document.querySelectorAll('[role="status"]')).map((e) => (e.textContent ?? '').trim()).find((x) => x.includes('завис')) ?? '',
        ws: document.querySelectorAll('.con-ws').length,
      };
      const key = JSON.stringify({...s, t: 0});
      if (tick || key !== last) {
        last = key;
        samples.push(s);
      }
    };
    sample(true);
    const timer = window.setInterval(() => sample(true), 30);
    const mo = new MutationObserver(() => sample(false));
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['class', 'style']});
    (window as unknown as {__railLanding: unknown}).__railLanding = {samples, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  }, [targets, readouts]);
}

async function readProbe(page: Page): Promise<Array<Sample>> {
  return await page.evaluate(() => {
    const p = (window as unknown as {__railLanding: {samples: Array<unknown>, stop: () => void}}).__railLanding;
    p.stop();
    return p.samples;
  }) as Array<Sample>;
}

function watchPage(page: Page): {watchdog: Array<string>, errors: Array<string>} {
  const out = {watchdog: [] as Array<string>, errors: [] as Array<string>};
  page.on('console', (m) => {
    if (m.text().includes('[console-foreground-watchdog]')) {
      out.watchdog.push(m.text().slice(0, 400));
    }
  });
  page.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
  return out;
}

/** «Действия карт» → the tile → its composer. The action centre is a GRID: a 2D walk, right/right/down/left/left/down. */
async function openAction(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  const focusedAction = () => page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[data-action-card]'));
    const at = tiles.findIndex((e) => e.classList.contains('con-cardactions__tile--focused'));
    return at < 0 ? '' : `${tiles[at].getAttribute('data-action-card')}#${at}`;
  });
  const hit = async () => (await focusedAction()).startsWith(`${card}#`);
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && !(await hit()); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await hit(), `never focused the «${card}» action (at «${await focusedAction()}»)`).toBe(true);
  await openActionFocus(page);
  await settle(page);
}

const COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const HERO = '.con-composer__actcardwrap';

/** Select the focused variant when a choice is open, walk the cursor to the commit row. */
async function readyToCommit(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`${COMPOSER} [data-branch-pos].con-composer__branch--selected, ${COMPOSER} .con-composer__cta--ready`).count() === 0; i++) {
    await press(page, 'Enter', 300);
  }
  for (let i = 0; i < 8 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${COMPOSER} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

/** The hero card's printed icons of one sprite (`'plant.'`) or its M€ tiles (`'mc'`) — the birth / absorb places. */
async function heroIcons(page: Page, needle: string): Promise<Array<NonNullable<Rect>>> {
  return await page.evaluate(([hero, n]) => {
    const els = n === 'mc' ?
      Array.from(document.querySelectorAll<HTMLElement>(`${hero} .pcard-mi--mc`)) :
      Array.from(document.querySelectorAll<HTMLElement>(`${hero} .pcard-ic`)).filter((el) => (el.style.backgroundImage ?? '').includes(n));
    return els.map((el) => {
      const r = el.getBoundingClientRect();
      return {l: r.left, t: r.top, r: r.right, b: r.bottom};
    }).filter((r) => r.r - r.l > 4);
  }, [HERO, needle]);
}

async function mcOf(request: APIRequestContext, playerId: string): Promise<number> {
  const model = await fetchPlayerModel(request, playerId) as Wire;
  return Number((model.thisPlayer as Wire)?.megacredits ?? -1);
}

async function noChipsLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-transfer__chip').length), {timeout: 20_000}).toBe(0);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const inside = (p: {x: number, y: number}, r: NonNullable<Rect>, slack: number) =>
  p.x >= r.l - slack && p.x <= r.r + slack && p.y >= r.t - slack && p.y <= r.b + slack;

/** The sample a chip of `amount` is BORN in (its first appearance) and that chip. */
function birthOf(samples: Array<Sample>, amount: string): {s: Sample, chip: Chip} | undefined {
  const s = samples.find((x) => x.chips.some((c) => c.v === amount));
  return s === undefined ? undefined : {s, chip: s.chips.find((c) => c.v === amount)!};
}

/** The sample a chip of `amount` RESTS in — the contact beat first appears beside it — and that chip. */
function landingOf(samples: Array<Sample>, amount: string): {s: Sample, chip: Chip, beat: {x: number, y: number}} | undefined {
  for (const s of samples) {
    const chip = s.chips.find((c) => c.v === amount);
    if (chip === undefined || s.beats.length === 0) {
      continue;
    }
    const beat = s.beats.find((b) => Math.hypot(b.x - chip.x, b.y - chip.y) <= chip.w);
    if (beat !== undefined) {
      return {s, chip, beat};
    }
  }
  return undefined;
}

/**
 * A GAIN'S LANDING: the chip rests ON the target's ink box of that same sample (a quarter chip of slack: the halo
 * is centred on the landing point, the chip is bigger than a two-digit number); the counter ticks at the touchdown
 * — never before the chip got there.
 */
function expectLanding(tag: string, samples: Array<Sample>, amount: string, target: string, readout: string, before: string, after: string): {s: Sample, chip: Chip} {
  const withChips = samples.filter((s) => s.chips.some((c) => c.v === amount));
  expect(withChips.length, `${tag}: a «${amount}» chip was seen in the air`).toBeGreaterThan(3);
  const landing = landingOf(samples, amount);
  expect(landing, `${tag}: the contact beat played while the «${amount}» chip stood on its destination`).toBeTruthy();
  const ink = landing!.s.targets[target];
  expect(ink, `${tag}: the target ink «${target}» was measurable at the landing`).not.toBeNull();
  const slack = landing!.chip.w * 0.25;
  expect(inside(landing!.chip, ink!, slack), `${tag}: the «${amount}» chip rests ON the ink — chip ${landing!.chip.x},${landing!.chip.y} (w=${landing!.chip.w}) vs ink ${JSON.stringify(ink)}`).toBe(true);
  expect(inside(landing!.beat, ink!, slack), `${tag}: the contact beat wakes ON the ink — beat ${JSON.stringify(landing!.beat)} vs ink ${JSON.stringify(ink)}`).toBe(true);
  const ticked = samples.find((s) => s.readouts[readout] === after);
  expect(ticked, `${tag}: the counter «${readout}» read ${after}`).toBeTruthy();
  expect(ticked!.t, `${tag}: the counter ticked (${ticked!.t}) no earlier than the touchdown (${landing!.s.t})`).toBeGreaterThanOrEqual(landing!.s.t - 60);
  const early = samples.filter((s) => s.t < landing!.s.t - 60 && s.readouts[readout] !== '' && s.readouts[readout] !== before);
  expect(early.map((s) => `${s.t}:${s.readouts[readout]}`), `${tag}: the readout «${readout}» stayed ${before} until the touchdown`).toEqual([]);
  return landing!;
}

/**
 * A PRICE'S DEPARTURE (PL-099): the «−N» chip is BORN on its row's ink, flies into one of the hero's printed
 * icons of that very cost (its contact beat wakes there), the row ticks no earlier than the birth and no later
 * than the landing — and the RESULT's chip is born only after the price has landed.
 */
function expectDeparture(tag: string, samples: Array<Sample>, amount: string, row: string, readout: string, before: string, after: string,
  costIcons: Array<NonNullable<Rect>>, resultAmount: string): void {
  const birth = birthOf(samples, amount);
  expect(birth, `${tag}: a «${amount}» chip was born`).toBeTruthy();
  const rowInk = birth!.s.targets[row];
  expect(rowInk, `${tag}: the row's ink «${row}» was measurable at the birth`).not.toBeNull();
  const slack = birth!.chip.w * 0.25;
  expect(inside(birth!.chip, rowInk!, slack), `${tag}: the «${amount}» chip is BORN on the row's ink — ${birth!.chip.x},${birth!.chip.y} vs ${JSON.stringify(rowInk)}`).toBe(true);
  const landing = landingOf(samples, amount);
  expect(landing, `${tag}: the «${amount}» chip rested somewhere with its contact beat`).toBeTruthy();
  expect(costIcons.length, `${tag}: the hero prints the cost's icon`).toBeGreaterThan(0);
  expect(costIcons.some((r) => inside(landing!.chip, r, slack)), `${tag}: the price is absorbed at the printed cost icon — ${landing!.chip.x},${landing!.chip.y} vs ${JSON.stringify(costIcons)}`).toBe(true);
  expect(costIcons.some((r) => inside(landing!.beat, r, slack)), `${tag}: the contact beat wakes on the cost icon — ${JSON.stringify(landing!.beat)}`).toBe(true);
  const ticked = samples.find((s) => s.readouts[readout] === after);
  expect(ticked, `${tag}: the row «${readout}» read ${after}`).toBeTruthy();
  expect(ticked!.t, `${tag}: the row ticked (${ticked!.t}) no earlier than the chip's birth (${birth!.s.t})`).toBeGreaterThanOrEqual(birth!.s.t - 60);
  expect(ticked!.t, `${tag}: the row ticked (${ticked!.t}) no later than the price's landing (${landing!.s.t})`).toBeLessThanOrEqual(landing!.s.t + 60);
  const early = samples.filter((s) => s.t < birth!.s.t - 60 && s.readouts[readout] !== '' && s.readouts[readout] !== before);
  expect(early.map((s) => `${s.t}:${s.readouts[readout]}`), `${tag}: the row «${readout}» stayed ${before} until the price left`).toEqual([]);
  const result = birthOf(samples, resultAmount);
  expect(result, `${tag}: the result «${resultAmount}» was born`).toBeTruthy();
  expect(result!.s.t, `${tag}: the result (${result!.s.t}) is born only after the price has landed (${landing!.s.t})`).toBeGreaterThanOrEqual(landing!.s.t - 60);
}

const M_DIGITS = '.con-res__row--megacredits .con-res__digits';
const PLANT_DIGITS = '.con-res__row--plants .con-res__digits';
const ENERGY_PROD = '.con-res__row--energy .con-res__prod';

for (const profile of PROFILES) {
  test.describe(`rail landing · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('TR13 verdict → the 5 M€ land on the M€ digits; no watchdog recovery over the card\'s delivery', async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const playerId = await bootFixture(page, request, 'political-think-tank', {query: profile.query});
      await openAction(page, 'Political Think Tank');
      await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
      await armProbe(page, {mc: M_DIGITS}, {mc: M_DIGITS});
      await press(page, 'Enter', 800);
      await expect(page.locator(`${COMPOSER} .con-verdict`)).toHaveClass(/con-verdict--met/, {timeout: 30_000});
      await settle(page, {timeoutMs: 30_000});
      await press(page, 'Enter', 400);
      await expect(page.locator('.con-res__row--megacredits .con-res__value')).toHaveText('17', {timeout: 30_000});
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      const samples = await readProbe(page);
      await shoot(page, `${profile.tag}-tr13-board`);
      expectLanding(`tr13-${profile.tag}`, samples, '+5', 'mc', 'mc', '12', '17');
      expect(samples.filter((s) => s.toast !== '').map((s) => s.toast), 'no «Экран завис» notice').toEqual([]);
      expect(seen.watchdog, 'no foreground-watchdog recovery during the verdict\'s handoff').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(await mcOf(request, playerId)).toBe(17);
    });

    test('Electro Catapult: the plant LEAVES the plants digits into the printed plant, THEN +7 M€ is born in the printed M€ tile and lands on the M€ digits', async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const playerId = await bootFixture(page, request, 'rail-reward-action', {query: profile.query});
      const mc0 = await mcOf(request, playerId);
      await openAction(page, 'Electro Catapult');
      await readyToCommit(page);
      const mcTiles = await heroIcons(page, 'mc');
      const plantIcons = await heroIcons(page, 'plant.');
      expect(mcTiles.length, 'the hero prints its M€ tiles').toBeGreaterThan(0);
      expect(plantIcons.length, 'the hero prints its plant').toBeGreaterThan(0);
      await armProbe(page, {mc: M_DIGITS, plants: PLANT_DIGITS}, {mc: M_DIGITS, plants: PLANT_DIGITS});
      await shoot(page, `${profile.tag}-catapult-setup`);
      await press(page, 'Enter', 300);
      await expect(page.locator(M_DIGITS)).toContainText(String(mc0 + 7), {timeout: 30_000});
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      const samples = await readProbe(page);
      await shoot(page, `${profile.tag}-catapult-board`);
      const tag = `catapult-${profile.tag}`;
      expectDeparture(tag, samples, '−1', 'plants', 'plants', '4', '3', plantIcons, '+7');
      expectLanding(tag, samples, '+7', 'mc', 'mc', String(mc0), String(mc0 + 7));
      const born = birthOf(samples, '+7')!;
      expect(mcTiles.some((r) => inside(born.chip, r, born.chip.w * 0.25)), `the +7 is born INSIDE a printed M€ tile — born ${born.chip.x},${born.chip.y} vs tiles ${JSON.stringify(mcTiles)}`).toBe(true);
      expect(samples.filter((s) => s.toast !== '').map((s) => s.toast), 'no «Экран завис» notice').toEqual([]);
      expect(seen.watchdog, 'no foreground-watchdog recovery').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(await mcOf(request, playerId)).toBe(mc0 + 7);
    });

    test('Space Mirrors: the 7 M€ LEAVE the M€ digits into the printed M€ tile, THEN +1 energy production lands on the energy row\'s plate', async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const playerId = await bootFixture(page, request, 'rail-reward-action', {query: profile.query});
      const mc0 = await mcOf(request, playerId);
      await openAction(page, 'Space Mirrors');
      await readyToCommit(page);
      const mcTiles = await heroIcons(page, 'mc');
      expect(mcTiles.length, 'the hero prints its M€ tile').toBeGreaterThan(0);
      await armProbe(page, {mc: M_DIGITS, eprod: ENERGY_PROD}, {mc: M_DIGITS, eprod: ENERGY_PROD});
      await press(page, 'Enter', 300);
      await expect(page.locator(ENERGY_PROD)).toHaveText(/\+1/, {timeout: 30_000});
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      const samples = await readProbe(page);
      await shoot(page, `${profile.tag}-mirrors-board`);
      const tag = `mirrors-${profile.tag}`;
      expectDeparture(tag, samples, '−7', 'mc', 'mc', String(mc0), String(mc0 - 7), mcTiles, '+1');
      expectLanding(tag, samples, '+1', 'eprod', 'eprod', '+0', '+1');
      expect(samples.filter((s) => s.toast !== '').map((s) => s.toast), 'no «Экран завис» notice').toEqual([]);
      expect(seen.watchdog, 'no foreground-watchdog recovery').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(await mcOf(request, playerId)).toBe(mc0 - 7);
    });
  });
}
