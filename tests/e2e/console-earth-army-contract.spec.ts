import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, openActionFocus, openCardActions, openConsole, press, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR28 «КОНТРАКТ С АРМИЕЙ ЗЕМЛИ» — A CARD ACTION'S TR IS A REWARD, AND THE
 * PRINTED ROW IS A TIMELINE (docs/claude/console/workspace-band.md § ACTION
 * COMMIT; `consoleActionCommitRail.ts`). Two profiles, a second client:
 *
 *   1. «Действия карт» → the composer: ONE chip for the card's capsule
 *      («1 → 0 · +1 −2» — two movements, never a bare net), the rating
 *      N → N + 1, the ruling Greens' «+2» named before the press; nothing sent.
 *   2. A → EXACTLY ONE POST.
 *   3. The phrase, by ORDER (MutationObserver + setInterval — never rAF): the
 *      first token is BORN inside the printed fighter icon; the capsule reads 1
 *      on every sample until it lands, then 2; the «−2» token leaves the
 *      capsule and the capsule reads 0 from its departure; the TR token is born
 *      inside the printed TR icon; the rating reads N on every sample until its
 *      touchdown on the rating's cell, the VP cell no earlier, the Greens' M€
 *      after; the workspace stands until the TR token is born. Never a capsule
 *      below 0, never a token above the screen, no degradation named.
 *   4. The board: no workspace, nothing stranded, no `[console-overflow]`, no
 *      page error; the server: 0 fighters, N + 1, +2 M€.
 *   5. At 0 fighters: one link, the capsule 0 → 1, the rating untouched, no
 *      «сработает».
 *   6. UNMI (the class, A/B — fixture `unmi-liner` with the corporation): the
 *      token from the corporation's printed TR, the rating on the touchdown,
 *      «−3» at the commit and «+2» after it — two changes, never «−1».
 *   7. Red, never reloaded: blue's rating N + 1 in red's reading of blue's seat.
 *
 * Fixture `earth-army-contract` (tests/e2e/fixtures/generate.ts). Heavy 4K: run
 * with `--workers=1`.
 */

const CARD = 'Earth Army Contract';
const UNMI = 'United Nations Mars Initiative';
const OUT = path.resolve('screenshots', 'earth-army-contract');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string, resources?: number}>},
  players: Array<{color: string, terraformRating: number}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
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

const composer = '.con-cardactions .con-composer';
const hero = `${composer} .con-composer__actcardwrap`;
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

type Rect = {l: number, t: number, r: number, b: number};

/** The hero's printed icons by sprite (`fighter.`, `tr.`), in print order — the anchors the phrase is measured against. */
const heroIcons = (page: Page, needle: string): Promise<Array<Rect>> => page.evaluate(([sel, bg]) =>
  Array.from(document.querySelectorAll<HTMLElement>(`${sel} .pcard-ic`))
    .filter((el) => el.style.backgroundImage.includes(bg))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {l: r.left, t: r.top, r: r.right, b: r.bottom};
    }), [hero, needle] as const);

async function rectOf(page: Page, selector: string): Promise<Rect | undefined> {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r === undefined || r.width < 2 ? undefined : {l: r.left, t: r.top, r: r.right, b: r.bottom};
  }, selector);
}

type Chip = {x: number, y: number, w: number, h: number, v: string};
type Sample = {
  t: number, tick: boolean, ws: number, cap: string, tr: string, vp: string, mc: string, link: string, chips: Array<Chip>, bar: string,
  stranded: boolean, heroOp: number,
};
type Probe = {samples: Array<Sample>, ticks: number};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate((heroSel) => {
    const w = window as unknown as {__tr28: Probe};
    const p: Probe = {samples: [], ticks: 0};
    w.__tr28 = p;
    const t0 = performance.now();
    const read = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const sample = (tick: boolean) => {
      if (tick) {
        p.ticks++;
      }
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter(shown).map((el) => {
        const r = el.getBoundingClientRect();
        return {x: Math.round((r.left + r.width / 2) * 10) / 10, y: Math.round((r.top + r.height / 2) * 10) / 10, w: Math.round(r.width), h: Math.round(r.height), v: (el.textContent ?? '').replace(/\s+/g, '')};
      });
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        tick,
        ws: document.querySelectorAll('.con-ws').length,
        cap: read(`${heroSel} .pcard__res-count`),
        tr: read('.con-res .con-score__value--tr'),
        vp: read('.con-res .con-score__cell--vp .con-score__value'),
        // The digits only — the row's delta chips ride the same node.
        mc: (read('.con-res .con-res__row--megacredits .con-res__digits').match(/^-?\d+/) ?? [''])[0],
        link: document.querySelector(heroSel)?.getAttribute('data-commit-link') ?? '',
        chips,
        bar: read('.con-cmdbar').slice(0, 60),
        stranded: document.querySelector('.con-stranded') !== null,
        heroOp: (() => {
          // The hero card's PAINTED opacity — every ancestor's opacity multiplies in.
          let op = document.querySelector(`${heroSel} .pcard`) === null ? 0 : 1;
          for (let n = document.querySelector<HTMLElement>(`${heroSel} .pcard`); n !== null; n = n.parentElement) {
            op *= Number(getComputedStyle(n).opacity);
          }
          return Math.round(op * 100) / 100;
        })(),
      };
      const last = p.samples[p.samples.length - 1];
      if (last === undefined || JSON.stringify({...last, t: 0, tick: false}) !== JSON.stringify({...s, t: 0, tick: false})) {
        p.samples.push(s);
      }
    };
    sample(true);
    new MutationObserver(() => sample(false)).observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-commit-link'],
    });
    window.setInterval(() => sample(true), 30);
  }, hero);
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr28: Probe}).__tr28);

const inside = (chip: Chip, rect: Rect, slack: number) =>
  chip.x >= rect.l - slack && chip.x <= rect.r + slack && chip.y >= rect.t - slack && chip.y <= rect.b + slack;

/**
 * Each token's BIRTH: a sample holding MORE chips of one value than the sample before it (a token in flight moves
 * far between two samples — its position says nothing about its identity; the count does). The newborn is the chip
 * of that value farthest from every chip of that value the previous sample held.
 */
function births(samples: ReadonlyArray<Sample>): Array<{at: number, chip: Chip}> {
  const out: Array<{at: number, chip: Chip}> = [];
  samples.forEach((s, i) => {
    const prev = i === 0 ? [] : samples[i - 1].chips;
    for (const v of [...new Set(s.chips.map((c) => c.v))]) {
      const now = s.chips.filter((c) => c.v === v);
      const was = prev.filter((c) => c.v === v);
      if (now.length <= was.length) {
        continue;
      }
      const distance = (c: Chip) => Math.min(Infinity, ...was.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
      const fresh = [...now].sort((a, b) => distance(b) - distance(a)).slice(0, now.length - was.length);
      fresh.forEach((chip) => out.push({at: i, chip}));
    }
  });
  return out;
}

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 120).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} ws=${s.ws} cap=${s.cap} link=${s.link} tr=${s.tr} vp=${s.vp} mc=${s.mc} chips=${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}`).join('\n');
}

/** «Действия карт» → the card → its composer, the cursor on the commit row. */
async function openComposer(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  expect(await walkFocusUntil(page, async () => (await focusedTile(page)) === card, () => focusedTile(page), 16),
    `never focused «${card}» (at «${await focusedTile(page)}»)`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  for (let i = 0; i < 8 && await page.locator(`${composer} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${composer} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

/** A → one POST (a retry only while nothing was sent). */
async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 6000}).toBeGreaterThan(0).catch(() => undefined);
  }
}

function watchPage(page: Page): {posts: Array<string>, errors: Array<string>, overflow: Array<string>} {
  const out = {posts: [] as Array<string>, errors: [] as Array<string>, overflow: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => {
    if (m.text().includes('[console-overflow]')) {
      out.overflow.push(m.text().slice(0, 200));
    }
  });
  return out;
}

for (const preset of PRESETS) {
  test.describe(`TR28 Earth Army Contract · two beats on one card · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('the composer names both movements → one POST → the fighter lands → two leave → the TR token from its own icon → the rating on the touchdown → the Greens after; red watches', async ({page, request, context}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'earth-army-contract', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const N = before.thisPlayer.terraformRating;
      expect(before.thisPlayer.tableau.find((c) => c.name === CARD)?.resources, 'the fixture: ONE fighter on the card').toBe(1);
      expect(before.thisPlayer.megacredits, 'the fixture: 20 M€').toBe(20);

      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await page.bringToFront();

      // ── 1. The composer: the capsule as ONE chip with its two movements, the rating, the table's answer.
      await openComposer(page, CARD);
      const timeline = page.locator(`${composer} [data-capsule-timeline]`);
      await expect(timeline, 'ONE chip for the card\'s capsule').toHaveCount(1);
      expect((await timeline.locator('.action-effect-chip__value').textContent() ?? '').replace(/\s+/g, ''), 'start → end').toBe('1→0');
      expect(await timeline.locator('.action-effect-chip__move').allTextContents(), 'its two movements, in order').toEqual(['+1', '−2']);
      const formula = await text(page, `${composer} .con-composer__hero`);
      expect(formula, `the rating N → N + 1 — got «${formula}»`).toMatch(new RegExp(`${N}\\s*→\\s*${N + 1}`));
      expect(formula, 'nothing reads as a PRICE: the spend is the action\'s consequence').not.toMatch(/Будет списано/i);
      expect(await text(page, `${composer} .con-composer__hero-side--forecast`), 'the Greens\' «+2» named before the press').toMatch(/\+\s*2/);
      expect(seen.posts, 'nothing sent before A').toEqual([]);
      const fighters = await heroIcons(page, 'fighter.');
      const trIcon = (await heroIcons(page, 'tr.'))[0];
      const capsule = await rectOf(page, `${hero} .pcard__res`);
      const ratingCell = await rectOf(page, '.con-res .con-score__cell--tr .con-score__valwrap');
      expect(fighters.length, 'two printed fighter icons').toBe(2);
      expect(trIcon, 'the printed TR icon').toBeDefined();
      expect(capsule, 'the capsule').toBeDefined();
      expect(ratingCell, 'the rail\'s rating cell').toBeDefined();
      await shoot(page, preset.id, '01-composer');

      // ── 2–3. A → one POST → the phrase.
      await armProbe(page);
      const stop = await storyboard(page, preset.id, 'phrase');
      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.terraformRating, {timeout: 30_000, message: 'the server paid the TR'}).toBe(N + 1);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const probe = await readProbe(page);
      const samples = probe.samples;
      console.log(`[${preset.id}] N=${N} fighters=${JSON.stringify(fighters)} tr=${JSON.stringify(trIcon)} capsule=${JSON.stringify(capsule)}\n${trail(samples)}`);
      expect(probe.ticks, 'the probe was alive').toBeGreaterThan(10);
      expect(seen.posts.length, 'A sent EXACTLY ONE request').toBe(1);
      expect(seen.posts[0], 'the card\'s action').toContain(`"cards":["${CARD}"]`);

      const born = births(samples);
      const landing = born.find((b) => b.chip.v === '+1');
      const leaving = born.find((b) => b.chip.v === '−2');
      expect(landing, 'a «+1» token was born').toBeDefined();
      expect(leaving, 'a «−2» token was born').toBeDefined();
      const tr = born.find((b) => b.chip.v === '+1' && b.at > leaving!.at);
      expect(tr, 'a second «+1» — the TR — after the two left').toBeDefined();
      expect(inside(landing!.chip, fighters[0], 2), `the fighter is BORN inside the first printed fighter — ${JSON.stringify(landing!.chip)} vs ${JSON.stringify(fighters[0])}`).toBe(true);
      expect(inside(leaving!.chip, capsule!, Math.max(leaving!.chip.w, leaving!.chip.h) / 2), `the two LEAVE the capsule — ${JSON.stringify(leaving!.chip)} vs ${JSON.stringify(capsule)}`).toBe(true);
      expect(inside(tr!.chip, trIcon!, 2), `the TR is BORN inside the printed TR icon — ${JSON.stringify(tr!.chip)} vs ${JSON.stringify(trIcon)}`).toBe(true);

      const capTwo = samples.findIndex((s) => s.cap === '2');
      const capZero = samples.findIndex((s) => s.cap === '0');
      expect(capTwo, 'the capsule read 2 when the fighter landed').toBeGreaterThan(landing!.at);
      expect(samples.slice(0, capTwo).every((s) => s.cap === '1'), 'the capsule read 1 on EVERY sample until the fighter landed').toBe(true);
      expect(leaving!.at, 'the two leave only after the fighter has landed').toBeGreaterThanOrEqual(capTwo);
      expect(capZero, 'the capsule read 0 from the two\'s departure').toBeGreaterThanOrEqual(leaving!.at);
      expect(samples.every((s) => s.cap === '' || ['0', '1', '2'].includes(s.cap)), `the capsule never read below c − 1 = 0, never c − 2 — it read ${[...new Set(samples.map((s) => s.cap))].join(', ')}`).toBe(true);
      expect(samples.slice(capZero).every((s) => s.cap !== '2' && s.cap !== '1'), 'and never climbed back').toBe(true);

      const trUp = samples.findIndex((s) => s.tr === String(N + 1));
      const vpUp = samples.findIndex((s) => s.vp !== samples[0].vp);
      const mcUp = samples.findIndex((s) => s.mc !== samples[0].mc);
      expect(trUp, 'the rating ticked on the TR token\'s flight').toBeGreaterThan(tr!.at);
      expect(samples.slice(0, trUp).every((s) => s.tr === String(N)), 'the rating read N on every sample before the touchdown').toBe(true);
      const lastFlown = [...samples.slice(0, trUp + 1)].reverse().find((s) => s.chips.some((c) => c.v === '+1'))!.chips.find((c) => c.v === '+1')!;
      expect(inside(lastFlown, ratingCell!, Math.max(lastFlown.w, lastFlown.h)), `the tick is the token's TOUCHDOWN on the rating's cell — ${JSON.stringify(lastFlown)} vs ${JSON.stringify(ratingCell)}`).toBe(true);
      expect(vpUp, 'the VP cell no earlier than the rating').toBeGreaterThanOrEqual(trUp);
      expect(mcUp, 'the Greens\' M€ AFTER the TR has landed').toBeGreaterThan(trUp);
      const wsGone = samples.findIndex((s) => s.ws === 0);
      expect(wsGone, 'the workspace stood until the TR token was born').toBeGreaterThanOrEqual(tr!.at);
      // The card is a SOURCE until then: painted (never blanked by the fold) on every sample up to the TR's birth —
      // a fold to the board dissolves it WITH the surface (a capture nobody claims blanks nothing).
      expect(samples.slice(0, tr!.at + 1).filter((s) => s.heroOp < 0.5).map((s) => `${s.t}:${s.heroOp}`),
        'the hero card is painted while its tokens are born on it').toEqual([]);
      expect(samples.slice(0, wsGone).filter((s) => s.link !== '').map((s) => s.link).filter((v, i, a) => a.indexOf(v) === i),
        'the half flew its links in the printed order').toEqual(expect.arrayContaining(['0', '1', '2']));
      const highest = Math.min(...samples.flatMap((s) => s.chips).map((c) => c.y - c.h / 2));
      expect(highest, `no token above the screen — top edge reached y = ${highest}`).toBeGreaterThanOrEqual(0);
      const ready = await page.evaluate(() => (window as unknown as {__conReady: () => {railReward: {degraded?: {key: string}}, actionCommitRail: {lastEnd: string}}}).__conReady());
      expect(ready.railReward.degraded?.key, `no degradation was named — ${JSON.stringify(ready.railReward.degraded)}`).not.toBe(`action-commit:${CARD}`);
      expect(ready.actionCommitRail.lastEnd, 'the half flew in full').toBe('');

      // ── 4. The board, the server.
      await waitForBoardHome(page);
      await shoot(page, preset.id, '02-board');
      expect(await page.locator('.con-ws').count(), 'no workspace').toBe(0);
      expect(samples.some((s) => s.stranded), 'nothing stranded on the way').toBe(false);
      expect(await strandedReports(page), 'no prompt was stranded').toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.find((c) => c.name === CARD)?.resources, '0 fighters').toBe(0);
      expect(after.thisPlayer.terraformRating, '+1 TR').toBe(N + 1);
      expect(after.thisPlayer.megacredits, 'the Greens\' 2 M€').toBe(22);

      // ── 7. Red, never reloaded: blue's rating in red's reading of blue's seat.
      await red.bringToFront();
      const blue = before.thisPlayer.color;
      await expect.poll(async () => (await wireOf(request, seats[1])).players.find((p) => p.color === blue)?.terraformRating, {timeout: 20_000}).toBe(N + 1);
      await press(red, 'KeyY', 1200);
      await expect(red.locator('.con-info'), 'red opened the Information workspace').toBeVisible();
      const onBlue = async () => ((await red.locator('.con-info .con-wshead').textContent()) ?? '').includes('player1');
      for (let i = 0; i < 4 && !await onBlue(); i++) {
        await press(red, 'KeyE', 900);
      }
      expect(await onBlue(), 'blue\'s seat is on stage').toBe(true);
      await expect.poll(() => text(red, '.con-res .con-score__value--tr'), {timeout: 20_000, message: 'red reads blue\'s rating N + 1'}).toBe(String(N + 1));
      await shoot(red, preset.id, '03-watcher-blue-seat');
      expect(redErrors, `no page error on the watcher — ${redErrors.join(' | ')}`).toEqual([]);
    });

    test('at 0 fighters: one link — the fighter lands, the rating is untouched, nothing «сработает»', async ({page, request}) => {
      test.setTimeout(240_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'earth-army-contract', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string, resourceCount?: number}>}>)[0];
          blue.playedCards = blue.playedCards.map((card) => card.name === CARD ? {...card, resourceCount: 0} : card);
        },
      });
      await settle(page);
      const before = await wireOf(request, playerId);
      const N = before.thisPlayer.terraformRating;
      await openComposer(page, CARD);
      await expect(page.locator(`${composer} [data-capsule-timeline]`), 'no timeline: the +1 alone').toHaveCount(0);
      const formula = await text(page, `${composer} .con-composer__hero`);
      expect(formula, `the capsule 0 → 1 — got «${formula}»`).toMatch(/0\s*→\s*1/);
      expect(formula, 'no TR promised').not.toMatch(new RegExp(`${N}\\s*→\\s*${N + 1}`));
      await expect(page.locator(`${composer} .con-composer__hero-side--forecast`), 'nothing «сработает»').toHaveCount(0);
      await armProbe(page);
      await commit(page, seen.posts);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      const samples = (await readProbe(page)).samples;
      expect(seen.posts.length, 'one POST').toBe(1);
      const born = births(samples);
      expect(born.map((b) => b.chip.v), 'ONE token — the fighter').toEqual(['+1']);
      expect(samples.every((s) => s.tr === String(N)), 'the rating never moved').toBe(true);
      expect(samples.every((s) => s.link === ''), 'no rail half stood').toBe(true);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.find((c) => c.name === CARD)?.resources, '1 fighter').toBe(1);
      expect(after.thisPlayer.terraformRating, 'no TR').toBe(N);
      expect(after.thisPlayer.megacredits, 'no M€').toBe(before.thisPlayer.megacredits);
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
    });

    test('UNMI — the class: the corporation\'s TR flies from its own icon, «−3» at the commit and «+2» after the touchdown', async ({page, request}) => {
      test.setTimeout(240_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'unmi-liner', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string}>, hasIncreasedTerraformRatingThisGeneration: boolean}>)[0];
          blue.playedCards = blue.playedCards
            .filter((card) => card.name !== 'UNMI Liner' && card.name !== 'Water Hauling')
            .map((card, i) => i === 0 ? {name: UNMI, resourceCount: 0, isDisabled: false} : card);
          blue.hasIncreasedTerraformRatingThisGeneration = true;
        },
      });
      await settle(page);
      const before = await wireOf(request, playerId);
      const N = before.thisPlayer.terraformRating;
      expect(before.thisPlayer.megacredits, 'the fixture: 20 M€').toBe(20);
      await openComposer(page, UNMI);
      const trIcon = (await heroIcons(page, 'tr.'))[0];
      const ratingCell = await rectOf(page, '.con-res .con-score__cell--tr .con-score__valwrap');
      expect(trIcon, 'the corporation\'s printed TR').toBeDefined();
      await armProbe(page);
      const stop = await storyboard(page, preset.id, 'unmi');
      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.terraformRating, {timeout: 30_000}).toBe(N + 1);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const samples = (await readProbe(page)).samples;
      console.log(`[${preset.id}] UNMI N=${N}\n${trail(samples)}`);
      expect(seen.posts.length, 'one POST').toBe(1);
      const token = births(samples).find((b) => b.chip.v === '+1');
      expect(token, 'a TR token').toBeDefined();
      expect(inside(token!.chip, trIcon!, 2), `born inside the corporation's printed TR — ${JSON.stringify(token!.chip)} vs ${JSON.stringify(trIcon)}`).toBe(true);
      const trUp = samples.findIndex((s) => s.tr === String(N + 1));
      expect(trUp, 'the rating ticked after the token was born').toBeGreaterThan(token!.at);
      expect(samples.slice(0, trUp).every((s) => s.tr === String(N)), 'N on every sample before the touchdown').toBe(true);
      const lastFlown = [...samples.slice(0, trUp + 1)].reverse().find((s) => s.chips.length > 0)!.chips[0];
      expect(inside(lastFlown, ratingCell!, Math.max(lastFlown.w, lastFlown.h)), 'the tick is the touchdown on the rating cell').toBe(true);
      // The M€ row: the fee ticks with the commit, the Greens' answer after the TR — two changes, never one «−1».
      const mcValues = samples.map((s) => s.mc).filter((v, i, a) => i === 0 || v !== a[i - 1]);
      expect(mcValues, `the M€ row read 20 → 17 → 19 — it read ${mcValues.join(' → ')}`).toEqual(['20', '17', '19']);
      const mcGreens = samples.findIndex((s) => s.mc === '19');
      expect(mcGreens, 'the Greens\' «+2» after the TR has landed').toBeGreaterThan(trUp);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, '−3 + 2').toBe(19);
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
    });
  });
}
