import {test, expect, Page} from './consoleTest';
import {bootIntoGame, press, settle, soloGameConfig} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console MILESTONES/AWARDS WORKSPACE — the North-Star flow guard
 * (docs/claude/console/ma-workspace.md):
 *
 *   Overview → Hero Detail → Commit → Ceremony INSIDE the workspace →
 *   Settle → auto-Close.
 *
 * What this proves at the real surface, driven the way a player drives it:
 *  1. the overview carries NO per-item CTA (A only SELECTS);
 *  2. A descends into the detail stage; the pressed card's emblem goes dark
 *     the moment the hero pedestal carries it (ONE physical object, never a
 *     double image); the crumb grows the «› <name> › <stage>» tail;
 *  3. B before the commit folds back and the focus lands on the SAME item;
 *  4. A on the stage commits; the EXISTING ceremony plays INSIDE the
 *     workspace (`.con-mafocus__cere`) — the global centre-stage shell
 *     (`.con-macere__scene`) must NOT also present it;
 *  5. the workspace closes only after the ceremony's own completion — and
 *     leaves no ceremony layers, with the funded state already on the books.
 */

const OUT = path.resolve('screenshots', 'ma-workspace');

/** Human + MarsBot (awards/milestones are DISABLED in true solo — the rules'
 *  own «for 1 player games» carve-out), deterministic base+corpEra board.
 *  `testMode` gives 500 M€, so the first award is fundable on action one. */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'MATester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  automa: {difficulty: 'normal'},
});

async function key(page: Page, code: string, settle = 500): Promise<void> {
  await press(page, code, settle);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The bottom command bar's visible labels (the semantic footer; the bar
 *  renders uppercase — compare in one case). */
async function barText(page: Page): Promise<string> {
  return (await page.locator('.con-cmdbar').innerText().catch(() => '')).replace(/\s+/g, ' ').toUpperCase();
}

/**
 * THE GRID STANDS WHOLE (FB′ — the owner, 2026-11-03: the one-screen split scrolled with Venus): every tile of the
 * workspace sits inside the scroll viewport, nothing to scroll, two columns of tiles of ONE width (no span). Read AT
 * REST (`settledListFit` — FLAKE ZERO class C): the workspace's entrance on a 300 ms software frame is a grid still
 * moving.
 */
async function listFit(page: Page): Promise<{overflow: number, rows: number, lastBottom: number, vpBottom: number, widths: number, columns: number}> {
  return page.evaluate(() => {
    const tenth = (v: number) => Math.round(v * 10) / 10;
    const vp = document.querySelector('.con-ma__scroll-host .con-scroll-area__viewport');
    const cards = [...document.querySelectorAll('.con-ma__card')].map((el) => el.getBoundingClientRect());
    const box = vp?.getBoundingClientRect();
    return {
      overflow: vp === null ? -1 : vp.scrollHeight - vp.clientHeight,
      rows: cards.length,
      lastBottom: tenth(Math.max(...cards.map((r) => r.bottom))),
      vpBottom: tenth(box?.bottom ?? 0),
      widths: new Set(cards.map((r) => Math.round(r.width))).size,
      columns: new Set(cards.map((r) => Math.round(r.left))).size,
    };
  });
}

/** A tenth of a pixel — what the geometry claims compare (a subpixel that jitters is not motion). */
const tenth = (v: number) => Math.round(v * 10) / 10;

async function settledListFit(page: Page, tag: string): Promise<Awaited<ReturnType<typeof listFit>>> {
  return readSettled(page, () => listFit(page), {message: `the MA grid (${tag})`});
}

type Rect = {x: number, w: number};

/**
 * The CORONATION'S POSE, frame by frame (runs IN THE PAGE — the witness's reader): the ceremony zone, the dressing
 * (the kicker past 0.6 — the coronation lines have faded in), the hero emblem's box and the ceremony seat's.
 */
function coronationReader(): {cere: boolean, dressed: boolean, hero: Rect | null, seat: Rect | null} {
  const rect = (sel: string): Rect | null => {
    const el = document.querySelector(sel);
    if (el === null) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.x * 10) / 10, w: Math.round(r.width * 10) / 10};
  };
  const kicker = document.querySelector('.con-mafocus__cere-kicker');
  return {
    cere: document.querySelector('.con-mafocus__cere') !== null,
    dressed: kicker !== null && Number(getComputedStyle(kicker).opacity) > 0.6,
    hero: rect('[data-ma-focus-hero]'),
    seat: rect('[data-ma-cere-seat]'),
  };
}

/**
 * THE CARRY, frame by frame (runs IN THE PAGE): is the hero pedestal CARRYING (the descent's own tween stands on it —
 * an inline transform, or the reveal's inline opacity), and the pressed browse card's emblem opacity.
 */
function carryReader(): {carry: boolean, emblem: number | null} {
  const hero = document.querySelector<HTMLElement>('.con-mafocus [data-ma-focus-hero]');
  const art = document.querySelector('.con-ma__card--focused .con-ma__stage');
  return {
    carry: hero !== null && (hero.style.transform !== '' || hero.style.opacity !== ''),
    emblem: art === null ? null : Math.round(Number(getComputedStyle(art).opacity) * 1000) / 1000,
  };
}

function expectListFits(fit: Awaited<ReturnType<typeof listFit>>, rows: number, tag: string): void {
  expect(fit.rows, `${rows} tiles`).toBe(rows);
  expect(fit.overflow, `no scroll on ${tag}: ${JSON.stringify(fit)}`).toBeLessThanOrEqual(1);
  expect(fit.lastBottom, `the last tile stands whole on ${tag}: ${JSON.stringify(fit)}`).toBeLessThanOrEqual(fit.vpBottom + 1);
  expect(fit.widths, `every tile the one width (nothing spans) on ${tag}: ${JSON.stringify(fit)}`).toBe(1);
  expect(fit.columns, `two columns of tiles on ${tag}: ${JSON.stringify(fit)}`).toBe(2);
}

/** Walk the 2-column grid's focus onto the tile at `target` (rows first, then the column). */
async function walkMaGrid(page: Page, target: number): Promise<void> {
  for (let hop = 0; hop < 12; hop++) {
    const cur = await page.evaluate(() => [...document.querySelectorAll('.con-ma__card')]
      .findIndex((c) => c.classList.contains('con-ma__card--focused')));
    if (cur === target || cur < 0 || target < 0) {
      return;
    }
    const curRow = Math.floor(cur / 2);
    const tgtRow = Math.floor(target / 2);
    if (curRow !== tgtRow) {
      await press(page, curRow < tgtRow ? 'ArrowDown' : 'ArrowUp', 320);
    } else {
      await press(page, cur % 2 < target % 2 ? 'ArrowRight' : 'ArrowLeft', 320);
    }
  }
}

const PROFILES = [
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console MA workspace · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('overview → detail → commit → in-workspace ceremony → auto-close', async ({page, request}) => {
      test.setTimeout(480_000);

      await bootIntoGame(page, request, {config: GAME_CONFIG, buy: 2, query: profile.query});
      await page.waitForSelector('.con-board', {timeout: 45_000});

      // ── 1 · The AWARDS overview (LB opens milestones; RB switches over) ────
      await key(page, 'KeyQ', 1400);
      await page.waitForSelector('.con-ma', {timeout: 8_000});
      expectListFits(await settledListFit(page, profile.tag + ' · milestones'), 5, profile.tag + ' · milestones');
      await key(page, 'KeyE', 1400); // → the AWARDS workspace (the family's other screen — a lateral move)
      await expect.poll(() => page.locator('.con-ma').count(), {message: 'one MA workspace on screen after the bumper'}).toBe(1);
      await expect(page.locator('.con-ma.con-ma--awards'), 'RB walked to the awards workspace').toHaveCount(1);
      expectListFits(await settledListFit(page, profile.tag + ' · awards'), 5, profile.tag + ' · awards');

      // No per-item CTA (criterion 1); A carries the CONTEXTUAL verb (2):
      // the focused first fundable award advertises the INTENT («Спонсировать»),
      // and the universal «Выбрать» is gone — a dead race and a live claim no
      // longer promise the same thing.
      await expect.poll(() => page.locator('.con-ma__card .gp-glyph').count(), {message: 'the per-item CTA must be gone'}).toBe(0);
      await expect.poll(() => barText(page), {message: 'the overview footer advertises the intent verb'}).toContain('СПОНСИРОВАТЬ');
      await expect.poll(() => barText(page), {message: 'the universal select verb must be gone'}).not.toContain('ВЫБРАТЬ');

      // THE HEAD-TALLY states the SYSTEM: the live price, never a wallet delta.
      const head = (await page.locator('.con-ma__wshead [data-ma-tally]').innerText()).replace(/\s+/g, ' ');
      expect(head, 'the head-tally carries the live price chip').toContain('ЦЕНА');
      expect(head, 'the head-tally must not project a balance').not.toContain('→');

      // THE STATUS RAIL carries the WHOLE projection of the focused item, in
      // the shared chips (M€ + the category counter), and nothing else does.
      await page.waitForSelector('.con-marail', {timeout: 4_000});
      await expect(page.locator('.con-marail .action-effect-chip'), 'the focused award projects M€ + the slot counter').toHaveCount(2);
      await expect.poll(async () => (await page.locator('.con-marail').innerText()).replace(/\s+/g, ' '),
        {message: 'the rail states the resulting balance'}).toContain('→');
      await expect.poll(async () => (await page.locator('.con-marail').innerText()).replace(/\s+/g, ' '),
        {message: 'no bespoke «будет потрачено» dialect'}).not.toContain('потрачено');
      await shoot(page, profile.tag + '-01-overview');

      // The focused item (the first fundable award — openSheet homes on it), read at rest.
      const focusedName = await readSettled(page,
        async () => (await page.locator('.con-ma__card--focused .con-ma__name').innerText()).trim(),
        {message: 'the focused award\'s name'});
      expect(focusedName.length, 'an award must be focused').toBeGreaterThan(0);

      // ── 2 · A = SELECT → the hero detail descend ───────────────────────────
      // The carry, RECORDED from before the press (never one read 140 ms after it): the pressed card's own emblem
      // must already be DARK while the hero pedestal carries it — one physical object, never two. Every recorded
      // frame of the carry is asked, the first one included (`settled` — the state a frame can paint).
      const carry = await armWitness(page, 'ma-carry', carryReader, {settled: true});
      await page.keyboard.press('Enter');
      await page.waitForSelector('.con-mafocus', {timeout: 6_000});
      await settle(page); // the reveal waves settle
      const carried = (await carry.stop()).filter((s) => s.v.carry && s.v.emblem !== null).map((s) => s.v.emblem as number);
      expect(carried.length, 'the carry was recorded over the pressed card').toBeGreaterThan(0);
      expect(Math.max(...carried), 'the browse emblem must go dark the instant the carry starts').toBeLessThan(0.05);
      await shoot(page, profile.tag + '-02-detail');

      // The stage restates the item; the crumb grew the tail; the bar shows the
      // REAL verb.
      await expect.poll(async () => (await page.locator('.con-wshead__subject').innerText().catch(() => '')).trim().toUpperCase(),
        {message: 'the crumb subject names the descended item'}).toBe(focusedName.toUpperCase());
      await expect.poll(async () => (await page.locator('.con-wshead__step').innerText()).trim().toUpperCase(),
        {message: 'the pre-commit stage word'}).toBe('СПОНСОРСТВО');
      await expect.poll(() => barText(page), {message: 'the detail footer advertises the commit verb', timeout: 10_000}).toContain('СПОНСИРОВАТЬ');

      // The detail state speaks the SAME rail — one projection, one language,
      // and the old «БУДЕТ ПОТРАЧЕНО −8 462 → 454» band is gone with it.
      await expect.poll(() => page.locator('.con-mafocus .con-marail .action-effect-chip').count(), {message: 'the stage projects through the shared rail'}).toBe(2);

      // THE BADGE stays inside its hero column (the clipped «ПОРОГ ДОСТИГНУТ —
      // МОЖНО ВЗЯТЬ СЕЙЧАС» is what this measures against).
      const badgeFits = await readSettled(page, () => page.evaluate(() => {
        const chip = document.querySelector('.con-mafocus__state-chip') as HTMLElement | null;
        const col = document.querySelector('.con-mafocus__side') as HTMLElement | null;
        if (chip === null || col === null) {
          return {ok: false, overflow: 999};
        }
        const c = chip.getBoundingClientRect();
        const s = col.getBoundingClientRect();
        return {ok: true, overflow: Math.round(Math.max(s.left - c.left, c.right - s.right) * 10) / 10};
      }), {message: 'the state badge in its hero column'});
      expect(badgeFits.ok, 'the state badge must exist').toBeTruthy();
      expect(badgeFits.overflow, 'the state badge must stay inside the hero column').toBeLessThan(1);

      // ── 3 · B folds back; the focus survives on the SAME item ──────────────
      await key(page, 'Escape', 1200);
      await expect.poll(() => page.locator('.con-mafocus').count(), {message: 'B must fold the stage'}).toBe(0);
      await expect.poll(async () => (await page.locator('.con-ma__card--focused .con-ma__name').innerText()).trim(),
        {message: 'the fold returns the focus to the entered item'}).toBe(focusedName);
      await expect.poll(async () => Number(await page.locator('.con-ma__card--focused .con-ma__stage').evaluate(
        (el) => getComputedStyle(el).opacity)), {message: 'the browse emblem is whole again after the fold'}).toBeGreaterThan(0.9);
      await shoot(page, profile.tag + '-03-folded-back');

      // ── 4 · Descend again → COMMIT → the ceremony INSIDE the workspace ─────
      await key(page, 'Enter', 1300);
      await page.waitForSelector('.con-mafocus', {timeout: 6_000});
      // The artefact's STATIC size, measured on the stage it is about to leave — at REST (the descent's carry is a
      // box still growing).
      const heroBefore = await readSettled(page, async () => {
        const b = await page.locator('[data-ma-focus-hero]').boundingBox();
        return b === null ? null : {x: tenth(b.x), width: tenth(b.width)};
      }, {message: 'the static hero emblem'});
      // The coronation's pose, RECORDED from before the commit: the ceremony is a scene that ends by closing the
      // workspace, so its pose is a witness's, never a read taken some protocol trips after the dressing arrived.
      const coronation = await armWitness(page, 'ma-coronation', coronationReader, {settled: true});
      await page.keyboard.press('Enter'); // the commit — the stage does NOT close

      // The ceremony arrives ON the stage; the global own-beat scene must not.
      await page.waitForSelector('.con-mafocus__cere', {timeout: 12_000});
      await expect.poll(() => page.locator('.con-ma').count(), {message: 'the workspace stays up for its ceremony'}).toBe(1);
      await expect.poll(() => page.locator('.con-macere__scene').count(), {message: 'the global centre-stage ceremony must not double-present a claimed beat'}).toBe(0);
      // Wait for the SCENE, not for a clock: the dressing is up once the
      // coronation lines have faded in (a busy 4K frame can spend a second on
      // the first paint, and a fixed sleep then measures the wrong moment).
      // The pose is the one the page HAD in that very frame.
      const dressed = await coronation.waitFor((v) => v.cere && v.dressed,
        {timeoutMs: 20_000, message: 'the coronation lines faded in'});
      await coronation.stop();
      await expect.poll(() => barText(page), {message: 'no commit verb may survive the commit', timeout: 10_000}).not.toContain('СПОНСИРОВАТЬ');

      // THE CORONATION MAY NEVER SHRINK THE ARTEFACT. Both are the same
      // physical object, so the ceremony seat is derived from the detail hero
      // (`--mafocus-cere-*`); a fixed seat beside a token-scaled hero made the
      // 4K ceremony smaller than the static emblem it grew out of.
      const heroAfter = dressed.v.hero;
      expect(heroBefore?.width ?? 0, 'the static hero must be measurable').toBeGreaterThan(0);
      expect(heroAfter?.w ?? 0, 'the ceremony emblem must not be smaller than the static one')
        .toBeGreaterThanOrEqual((heroBefore?.width ?? 0) - 1);
      // …and it must actually be IN the seat (the glide ran, not just a fade).
      const seatBox = dressed.v.seat;
      const heroCx = (heroAfter?.x ?? 0) + (heroAfter?.w ?? 0) / 2;
      const seatCx = (seatBox?.x ?? 0) + (seatBox?.w ?? 0) / 2;
      expect(Math.abs(heroCx - seatCx), 'the emblem must have glided into the ceremony seat')
        .toBeLessThan((seatBox?.w ?? 1) * 0.12);
      await shoot(page, profile.tag + '-04-ceremony');

      // ── 5 · The workspace closes ONLY after the ceremony settles ───────────
      await page.waitForSelector('.con-ma', {state: 'detached', timeout: 20_000});
      await expect.poll(() => page.locator('.con-mafocus, .con-mafocus__cere, .con-ceremony-fx').count(), {message: 'no ceremony layer may outlive the workspace'}).toBe(0);
      await expect.poll(() => page.locator('.con-macere__scene').count(), {message: 'the beat was consumed by the stage — never replayed globally'}).toBe(0);
      await settle(page); // the board home at rest for the shot
      await shoot(page, profile.tag + '-05-closed');

      // The final state is already on the books: re-open the awards and the
      // funded slot names the viewer (no second flight, no stale counts).
      await key(page, 'KeyQ', 1400);
      await page.waitForSelector('.con-ma', {timeout: 8_000});
      await key(page, 'KeyE', 1400);
      await expect.poll(async () => (await page.locator('.con-ma').innerText()).replace(/\s+/g, ' '),
        {message: 'the funded tally is live after the close'}).toContain('1/3');
      // …and the PRICE followed the game: the second funding costs 14, from the
      // engine's own ladder (the UI never re-derives it from a constant).
      await expect.poll(async () => (await page.locator('[data-ma-price="awards"]').innerText()).replace(/\s+/g, ' '),
        {message: 'the header price is the LIVE next-award cost'}).toContain('14');
      await shoot(page, profile.tag + '-06-reopened');

      // ── 7 · A blocked item still OPENS, and tells the truth ────────────────
      // (There is no `X` any more: A is the one way in, for every item.)
      await key(page, 'KeyQ', 1400); // → the MILESTONES workspace, where a threshold blocks
      await page.waitForSelector('.con-ma', {timeout: 8_000});
      const rows = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.con-ma__card'));
        return {
          blocked: cards.findIndex((c) => c.classList.contains('con-ma__card--go') === false &&
            c.classList.contains('con-ma__card--taken') === false),
          at: cards.findIndex((c) => c.classList.contains('con-ma__card--focused')),
        };
      });
      const blockedIdx = rows.blocked;
      if (blockedIdx >= 0) {
        await walkMaGrid(page, blockedIdx);
        // A blocked focus advertises the READING verb — never a false intent.
        await expect.poll(() => barText(page), {message: 'a blocked item offers «Осмотреть»', timeout: 10_000}).toContain('ОСМОТРЕТЬ');
        await key(page, 'Enter', 1400);
        if (await page.locator('.con-mafocus').count() > 0) {
          await expect.poll(async () => (await page.locator('.con-mafocus').innerText()).replace(/\s+/g, ' '),
            {message: 'a blocked item opens and explains itself'}).not.toContain('ПОТРАЧЕНО');
          // …and it NEVER draws a success preview of a payment it cannot make.
          await expect.poll(async () => (await page.locator('.con-mafocus .con-marail').getAttribute('class')) ?? '',
            {message: 'a blocked stage rail is blocked, never projected'}).not.toContain('con-marail--projected');
          await shoot(page, profile.tag + '-07-blocked-detail');
          await key(page, 'Escape', 1000);
        }
      }
    });

    // VENUS — the sixth milestone and the sixth award (FB′: the one-screen split scrolled exactly here). Each
    // workspace stands its six full-width rows whole, nothing to scroll, on this profile.
    test('Venus · six rows a workspace stand whole — milestones and awards', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootIntoGame(page, request, {
        config: soloGameConfig({
          players: [{name: 'MAVenus', color: 'red', beginner: false, handicap: 0, first: true}],
          automa: {difficulty: 'normal'},
          expansions: {venus: true},
        }),
        buy: 0,
        query: profile.query,
      });
      await page.waitForSelector('.con-board', {timeout: 45_000});
      await key(page, 'KeyQ', 1400);
      await page.waitForSelector('.con-ma.con-ma--milestones', {timeout: 8_000});
      expectListFits(await settledListFit(page, profile.tag + ' · venus milestones'), 6, profile.tag + ' · venus milestones');
      await shoot(page, profile.tag + '-10-venus-milestones');
      await key(page, 'KeyE', 1400);
      await expect(page.locator('.con-ma.con-ma--awards'), 'RB walked to the awards workspace').toHaveCount(1);
      expectListFits(await settledListFit(page, profile.tag + ' · venus awards'), 6, profile.tag + ' · venus awards');
      await shoot(page, profile.tag + '-11-venus-awards');
    });
  });
}
