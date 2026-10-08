import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, fetchPlayerModel, openActionFocus, openCardActions, press, settle, waitForBoardHome} from './consoleStart';

/**
 * A TOKEN LANDS ON THE NUMBER IT CHANGES (PL-094) — and nobody cries «Экран
 * завис» over a card still flying into the dock (PL-093).
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
 * Three flights, two profiles, one probe (`MutationObserver` + `setInterval`,
 * never rAF), armed before the press:
 *  · TR13 Political Think Tank — «OK» on the verdict: the 5 M€ off the verdict's
 *    own reward chip (`revealHandoff`) onto the M€ digits;
 *  · Electro Catapult — a plain blue action's ACTION COMMIT wave: the +7 M€
 *    born INSIDE the selected variant's printed M€ tile, landing on the digits;
 *  · Space Mirrors — the +1 energy PRODUCTION chip onto the energy row's plate.
 * Each asserts: the chip was seen; its resting point (the sample the contact
 * beat first appears in) is inside the target's ink box (a quarter chip of
 * slack); the counter ticked no earlier than the touchdown; the whole run fired
 * no foreground-watchdog recovery and no «Экран завис» notice.
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
  t: number, chips: Array<Chip>, beats: Array<{x: number, y: number}>, target: Rect, readout: string, toast: string, ws: number,
};

/** Arm the landing probe: `targetSel` is the INK the token must land on, `readoutSel` the counter that must tick. */
async function armProbe(page: Page, targetSel: string, readoutSel: string): Promise<void> {
  await page.evaluate(([target, readout]) => {
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
      const s = {
        t: +(performance.now() - t0).toFixed(1), chips, beats,
        target: rectOf(target),
        readout: (document.querySelector(readout)?.textContent ?? '').trim().match(/^[-+]?\d+/)?.[0] ?? '',
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
  }, [targetSel, readoutSel]);
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

async function mcOf(request: APIRequestContext, playerId: string): Promise<number> {
  const model = await fetchPlayerModel(request, playerId) as Wire;
  return Number((model.thisPlayer as Wire)?.megacredits ?? -1);
}

async function noChipsLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-transfer__chip').length), {timeout: 15_000}).toBe(0);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const inside = (p: {x: number, y: number}, r: NonNullable<Rect>, slack: number) =>
  p.x >= r.l - slack && p.x <= r.r + slack && p.y >= r.t - slack && p.y <= r.b + slack;

/**
 * THE LANDING: the sample the contact beat first appears in — the chip is at rest on its destination there —
 * checked against the target's ink box of that same sample (a quarter chip of slack: the halo is centred on the
 * landing point, the chip is bigger than a two-digit number).
 */
function expectLanding(tag: string, samples: Array<Sample>, amount: string, before: string, after: string): void {
  const withChips = samples.filter((s) => s.chips.some((c) => c.v === amount));
  expect(withChips.length, `${tag}: a «${amount}» chip was seen in the air`).toBeGreaterThan(3);
  const landing = samples.find((s) => s.beats.length > 0 && s.chips.some((c) => c.v === amount));
  expect(landing, `${tag}: the contact beat played while the chip stood on its destination`).toBeTruthy();
  const chip = landing!.chips.find((c) => c.v === amount)!;
  const target = landing!.target;
  expect(target, `${tag}: the target ink was measurable at the landing`).not.toBeNull();
  const slack = chip.w * 0.25;
  expect(inside(chip, target!, slack), `${tag}: the chip rests ON the ink — chip ${chip.x},${chip.y} (w=${chip.w}) vs ink ${JSON.stringify(target)}`).toBe(true);
  expect(inside(landing!.beats[0], target!, slack), `${tag}: the contact beat wakes ON the ink — beat ${JSON.stringify(landing!.beats[0])} vs ink ${JSON.stringify(target)}`).toBe(true);
  // The counter ticks at the touchdown — never before the chip got there.
  const ticked = samples.find((s) => s.readout === after);
  expect(ticked, `${tag}: the counter read ${after}`).toBeTruthy();
  expect(ticked!.t, `${tag}: the counter ticked (${ticked!.t}) no earlier than the touchdown (${landing!.t})`).toBeGreaterThanOrEqual(landing!.t - 60);
  const early = samples.filter((s) => s.t < landing!.t - 60 && s.readout !== '' && s.readout !== before);
  expect(early.map((s) => `${s.t}:${s.readout}`), `${tag}: the readout stayed ${before} until the touchdown`).toEqual([]);
  expect(samples.filter((s) => s.toast !== '').map((s) => s.toast), `${tag}: no «Экран завис» notice`).toEqual([]);
}

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
      await armProbe(page, '.con-res__row--megacredits .con-res__digits', '.con-res__row--megacredits .con-res__digits');
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
      expectLanding(`tr13-${profile.tag}`, samples, '+5', '12', '17');
      expect(seen.watchdog, 'no foreground-watchdog recovery during the verdict\'s handoff').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(await mcOf(request, playerId)).toBe(17);
    });

    test('Electro Catapult: the ACTION COMMIT\'s +7 M€ is born in the printed M€ tile and lands on the M€ digits', async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const playerId = await bootFixture(page, request, 'rail-reward-action', {query: profile.query});
      const mc0 = await mcOf(request, playerId);
      await openAction(page, 'Electro Catapult');
      await readyToCommit(page);
      // The printed M€ tiles of the hero card at the press — the chip must be BORN inside one of them.
      const tiles = await page.evaluate(() => Array.from(document.querySelectorAll('.con-composer__actcardwrap .pcard-mi--mc')).map((el) => {
        const r = el.getBoundingClientRect();
        return {l: r.left, t: r.top, r: r.right, b: r.bottom};
      }));
      expect(tiles.length, 'the hero prints its M€ tiles').toBeGreaterThan(0);
      await armProbe(page, '.con-res__row--megacredits .con-res__digits', '.con-res__row--megacredits .con-res__digits');
      await shoot(page, `${profile.tag}-catapult-setup`);
      await press(page, 'Enter', 300);
      await expect(page.locator('.con-res__row--megacredits .con-res__digits')).toContainText(String(mc0 + 7), {timeout: 30_000});
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      const samples = await readProbe(page);
      await shoot(page, `${profile.tag}-catapult-board`);
      expectLanding(`catapult-${profile.tag}`, samples, '+7', String(mc0), String(mc0 + 7));
      const born = samples.find((s) => s.chips.some((c) => c.v === '+7'))!.chips.find((c) => c.v === '+7')!;
      expect(tiles.some((r) => inside(born, r, born.w * 0.25)), `the chip is born INSIDE a printed M€ tile — born ${born.x},${born.y} vs tiles ${JSON.stringify(tiles)}`).toBe(true);
      expect(seen.watchdog, 'no foreground-watchdog recovery').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(await mcOf(request, playerId)).toBe(mc0 + 7);
    });

    test('Space Mirrors: the +1 energy production lands on the energy row\'s production plate', async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const playerId = await bootFixture(page, request, 'rail-reward-action', {query: profile.query});
      const mc0 = await mcOf(request, playerId);
      await openAction(page, 'Space Mirrors');
      await readyToCommit(page);
      await armProbe(page, '.con-res__row--energy .con-res__prod', '.con-res__row--energy .con-res__prod');
      await press(page, 'Enter', 300);
      await expect(page.locator('.con-res__row--energy .con-res__prod')).toHaveText(/\+1/, {timeout: 30_000});
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      const samples = await readProbe(page);
      await shoot(page, `${profile.tag}-mirrors-board`);
      expectLanding(`mirrors-${profile.tag}`, samples, '+1', '+0', '+1');
      expect(seen.watchdog, 'no foreground-watchdog recovery').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(await mcOf(request, playerId)).toBe(mc0 - 7);
    });
  });
}
