import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * PL-001 FOR PLAYS — A CARD PLAY'S DIRECT TR IS A REWARD (docs/claude/console/
 * workspace-band.md § РОЗЫГРЫШ КАРТЫ; `consolePlayedHero.ts`'s rail half). Two
 * profiles, three cards, a second client:
 *
 *   1. «Карты в руке» → the card → its composer: the rating N → N + k and the
 *      ruling Greens' «+2k» named before the press; nothing sent.
 *   2. A → EXACTLY ONE POST.
 *   3. The landing, by ORDER (MutationObserver + setInterval — never rAF): the
 *      price ticks with the card's landing, the card's OWN gains fly first (the
 *      Dome's production wave), the TR token is BORN on the landed card's
 *      printed TR — on the face-down pile for an EVENT, where that card now
 *      lies — the rating reads N on every sample until the token's touchdown
 *      on the rating cell, the VP cell no earlier, the Greens' M€ after it: the
 *      M€ row reads three values, never the price and the answer as one. The
 *      workspace stands until the token is born; no degradation is named.
 *   4. The board: no workspace, nothing stranded, no `[console-overflow]`, no
 *      page error; the server: N + k, the price paid, 2k M€ back.
 *   5. Red, never reloaded: blue's rating N + k.
 *
 * Fixture `play-tr-reward` (tests/e2e/fixtures/generate.ts). Heavy 4K: run with
 * `--workers=1`.
 */

const OUT = path.resolve('screenshots', 'play-tr-reward');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const CASES = [
  {card: 'Bribed Committee', key: 'bribed', tr: 2, event: true, wave: false},
  {card: 'Terraforming Ganymede', key: 'ganymede', tr: 1, event: false, wave: false},
  {card: 'Magnetic Field Dome', key: 'dome', tr: 1, event: false, wave: true},
] as const;

type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number, plantProduction: number},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
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

const composer = '.con-composer--play';
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

type Rect = {l: number, t: number, r: number, b: number};

async function rectOf(page: Page, selector: string): Promise<Rect | undefined> {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r === undefined || r.width < 2 ? undefined : {l: r.left, t: r.top, r: r.right, b: r.bottom};
  }, selector);
}

/** One flying token: its centre, its size and its KIND (`tr` · `prod:<res>` · `mc` · `<res>`) with its amount. */
type Chip = {x: number, y: number, w: number, h: number, v: string};
type Sample = {
  t: number, tick: boolean, ws: number, tr: string, vp: string, mc: string, chips: Array<Chip>, stranded: boolean,
  /** The landed card's printed TR icon (a face) and the landing place itself (a face or the event's pile). */
  icon?: Rect, front?: Rect,
};
type Probe = {samples: Array<Sample>, ticks: number};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__pl001: Probe};
    const p: Probe = {samples: [], ticks: 0};
    w.__pl001 = p;
    const t0 = performance.now();
    const read = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const rect = (el: Element | null | undefined): Rect | undefined => {
      const r = el?.getBoundingClientRect();
      return r === undefined || r.width < 2 ? undefined : {l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom)};
    };
    const kindOf = (el: HTMLElement): string => {
      const icon = el.querySelector('.con-transfer__icon')?.className ?? '';
      const res = (icon.match(/resource_icon--([a-z]+)/) ?? ['', ''])[1];
      if (el.classList.contains('con-transfer__chip--mc')) {
        return 'mc';
      }
      if (res === 'rating') {
        return 'tr';
      }
      return el.classList.contains('con-transfer__chip--production') ? `prod:${res}` : res;
    };
    const sample = (tick: boolean) => {
      if (tick) {
        p.ticks++;
      }
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter(shown).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: Math.round((r.left + r.width / 2) * 10) / 10, y: Math.round((r.top + r.height / 2) * 10) / 10,
          w: Math.round(r.width), h: Math.round(r.height),
          v: `${kindOf(el)}${(el.querySelector('.con-transfer__amt')?.textContent ?? '').replace(/\s+/g, '')}`,
        };
      });
      const front = document.querySelector('.con-recv [data-recv-front]');
      const icon = Array.from(front?.querySelectorAll<HTMLElement>('.pcard-ic') ?? []).find((el) => el.style.backgroundImage.includes('tr.'));
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        tick,
        ws: document.querySelectorAll('.con-ws').length,
        tr: read('.con-res .con-score__value--tr'),
        // The VP cell states its value in its own aria-label («Победные очки: 20» — absent while the score is masked).
        vp: ((document.querySelector('.con-res .con-score__cell--vp')?.getAttribute('aria-label') ?? '').match(/(-?\d+)\s*$/) ?? ['', ''])[1],
        mc: (read('.con-res .con-res__row--megacredits .con-res__digits').match(/^-?\d+/) ?? [''])[0],
        chips,
        stranded: document.querySelector('.con-stranded') !== null,
        icon: rect(icon),
        front: rect(front),
      };
      const last = p.samples[p.samples.length - 1];
      if (last === undefined || JSON.stringify({...last, t: 0, tick: false}) !== JSON.stringify({...s, t: 0, tick: false})) {
        p.samples.push(s);
      }
    };
    sample(true);
    new MutationObserver(() => sample(false)).observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'],
    });
    window.setInterval(() => sample(true), 30);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__pl001: Probe}).__pl001);

const inside = (chip: Chip, rect: Rect, slack: number) =>
  chip.x >= rect.l - slack && chip.x <= rect.r + slack && chip.y >= rect.t - slack && chip.y <= rect.b + slack;

/**
 * Each token's BIRTH: a sample holding MORE chips of one kind than the sample before it (a token in flight moves far
 * between two samples — its position says nothing about its identity; the count does). The newborn is the chip of
 * that kind farthest from every chip of that kind the previous sample held.
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
      const distance = (c: Chip) => Math.min(Infinity, ...was.map((q) => Math.hypot(q.x - c.x, q.y - c.y)));
      const fresh = [...now].sort((a, b) => distance(b) - distance(a)).slice(0, now.length - was.length);
      fresh.forEach((chip) => out.push({at: i, chip}));
    }
  });
  return out;
}

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 160).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} ws=${s.ws} tr=${s.tr} vp=${s.vp} mc=${s.mc} icon=${s.icon === undefined ? '-' : `${s.icon.l},${s.icon.t}`} front=${s.front === undefined ? '-' : `${s.front.l},${s.front.t},${s.front.r},${s.front.b}`} chips=${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}`).join('\n');
}

/** RT → «КАРТЫ» → the card → A: the play composer of `card`, nothing sent. */
async function openPlayComposerOf(page: Page, card: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  for (let i = 0; i < 3 && await page.locator(composer).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(composer), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** A → one POST (a retry only while nothing was sent). */
async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
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
  test.describe(`PL-001 for plays · a play's direct TR is a reward · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    for (const c of CASES) {
      test(`${c.card}: one POST → ${c.wave ? 'the production wave → ' : ''}the TR token from ${c.event ? 'the event\'s pile' : 'the printed TR'} → the rating on the touchdown → the Greens after`, async ({page, request, context}) => {
        test.setTimeout(360_000);
        const seen = watchPage(page);
        const {playerId, seats} = await bootFixtureSeats(page, request, 'play-tr-reward', {query: preset.query});
        await settle(page);
        await armLeakWitness(page);
        const before = await wireOf(request, playerId);
        const N = before.thisPlayer.terraformRating;
        const mc0 = before.thisPlayer.megacredits;
        expect(mc0, 'the fixture: 60 M€').toBe(60);
        const inHand = before.cardsInHand?.find((h) => h.name === c.card);
        expect(inHand, `the fixture: «${c.card}» in hand`).toBeDefined();
        // The PRICE is the server's (a corporation's tag discount moves it) — never a printed number.
        const cost = inHand!.calculatedCost ?? 0;

        const red = c.key === 'bribed' ? await context.newPage() : undefined;
        if (red !== undefined) {
          await openConsole(red, seats[1], preset.query);
          await settle(red, {timeoutMs: 30_000});
          await page.bringToFront();
        }

        // ── 1. The composer: the rating and the table's answer, before the press.
        await openPlayComposerOf(page, c.card);
        const reading = await text(page, composer);
        expect(reading, `the rating N → N + ${c.tr} — got «${reading.slice(0, 400)}»`).toMatch(new RegExp(`${N}\\s*→\\s*${N + c.tr}`));
        expect(reading, `the Greens' «+${2 * c.tr}» named before the press`).toMatch(new RegExp(`\\+\\s*${2 * c.tr}`));
        expect(seen.posts, 'nothing sent before A').toEqual([]);
        const ratingCell = await rectOf(page, '.con-res .con-score__cell--tr .con-score__valwrap');
        expect(ratingCell, 'the rail\'s rating cell').toBeDefined();
        await shoot(page, preset.id, `${c.key}-01-composer`);

        // ── 2–3. A → one POST → the landing and its reward beat.
        await armProbe(page);
        const stop = await storyboard(page, preset.id, c.key);
        await commit(page, seen.posts);
        await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.terraformRating, {timeout: 30_000, message: 'the server paid the TR'}).toBe(N + c.tr);
        await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
        await settle(page, {timeoutMs: 30_000});
        await stop();
        const probe = await readProbe(page);
        const samples = probe.samples;
        const log = `[${preset.id}] ${c.card} N=${N} mc0=${mc0} cell=${JSON.stringify(ratingCell)}\n${trail(samples)}`;
        fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
        fs.writeFileSync(path.join(OUT, preset.id, `${c.key}-trail.txt`), log);
        console.log(log);
        expect(probe.ticks, 'the probe was alive').toBeGreaterThan(10);
        expect(seen.posts.length, 'A sent EXACTLY ONE request').toBe(1);

        const born = births(samples);
        const token = born.find((b) => b.chip.v === `tr+${c.tr}`);
        expect(token, `a TR token «+${c.tr}» was born — births: ${born.map((b) => b.chip.v).join(', ')}`).toBeDefined();
        const at = samples[token!.at];
        if (c.event) {
          expect(at.front, 'the event\'s pile stands where the token is born').toBeDefined();
          expect(inside(token!.chip, at.front!, 2), `an EVENT's TR is born on its face-down pile — ${JSON.stringify(token!.chip)} vs ${JSON.stringify(at.front)}`).toBe(true);
        } else {
          expect(at.icon, 'the landed face prints its TR icon').toBeDefined();
          expect(inside(token!.chip, at.icon!, 2), `the TR is BORN inside the landed card's printed TR — ${JSON.stringify(token!.chip)} vs ${JSON.stringify(at.icon)}`).toBe(true);
        }
        if (c.wave) {
          const wave = born.find((b) => b.chip.v.startsWith('prod:plants'));
          expect(wave, 'the card\'s own production wave flew').toBeDefined();
          expect(wave!.at, 'the card\'s own gains fly BEFORE its TR').toBeLessThan(token!.at);
        }

        const trUp = samples.findIndex((s) => s.tr === String(N + c.tr));
        expect(trUp, 'the rating ticked after the token was born').toBeGreaterThan(token!.at);
        expect(samples.slice(0, trUp).every((s) => s.tr === String(N)), `the rating read N on every sample before the touchdown — it read ${[...new Set(samples.slice(0, trUp).map((s) => s.tr))].join(', ')}`).toBe(true);
        const lastFlown = [...samples.slice(0, trUp + 1)].reverse().find((s) => s.chips.some((ch) => ch.v === token!.chip.v))!.chips.find((ch) => ch.v === token!.chip.v)!;
        expect(inside(lastFlown, ratingCell!, Math.max(lastFlown.w, lastFlown.h)), `the tick is the token's TOUCHDOWN on the rating's cell — ${JSON.stringify(lastFlown)} vs ${JSON.stringify(ratingCell)}`).toBe(true);
        // The VP cell is the score INCLUDING the rating: between the landing (the price ticks) and the TR's touchdown it
        // reads the final score minus the TR's points — the card's own VP lands with the card, the TR's with its token.
        const vpEnd = Number(samples[samples.length - 1].vp);
        const landed = samples.findIndex((s) => s.mc === String(mc0 - cost));
        expect(landed, 'the price ticked with the landing').toBeGreaterThanOrEqual(0);
        const early = samples.slice(landed, trUp).filter((s) => s.vp !== '' && Number(s.vp) !== vpEnd - c.tr).map((s) => `${s.t}:${s.vp}`);
        expect(early, `the VP cell read ${vpEnd - c.tr} from the landing to the TR's touchdown (the TR's points no earlier)`).toEqual([]);
        // The M€ row: the price ticks with the landing, the Greens' answer after the TR — two changes, never one.
        const mcValues = samples.map((s) => s.mc).filter((v, i, a) => v !== '' && (i === 0 || v !== a[i - 1]));
        const priced = String(mc0 - cost);
        const answered = String(mc0 - cost + 2 * c.tr);
        expect(mcValues, `the M€ row read ${mc0} → ${priced} → ${answered} — it read ${mcValues.join(' → ')}`).toEqual([String(mc0), priced, answered]);
        // (Bribed Committee's answer brings the row back to where it started — the search starts at the landing.)
        expect(samples.findIndex((s, i) => i > landed && s.mc === answered), 'the Greens\' answer AFTER the TR has landed').toBeGreaterThan(trUp);
        const wsGone = samples.findIndex((s) => s.ws === 0);
        expect(wsGone, 'the workspace stood until the TR token was born').toBeGreaterThanOrEqual(token!.at);
        const highest = Math.min(...samples.flatMap((s) => s.chips).map((ch) => ch.y - ch.h / 2));
        expect(highest, `no token above the screen — top edge reached y = ${highest}`).toBeGreaterThanOrEqual(0);
        const ready = await page.evaluate(() => (window as unknown as {__conReady: () => {railReward: {degraded?: {key: string, why: string, detail?: string}, pending: Array<unknown>}}}).__conReady());
        expect(ready.railReward.degraded?.key, `no degradation was named — ${JSON.stringify(ready.railReward.degraded)}`).not.toBe(`played-hero:${c.card}`);
        expect(ready.railReward.pending, 'nothing is left held on the rail').toEqual([]);

        // ── 4. The board, the server.
        await waitForBoardHome(page);
        await shoot(page, preset.id, `${c.key}-02-board`);
        expect(await page.locator('.con-ws').count(), 'no workspace').toBe(0);
        expect(samples.some((s) => s.stranded), 'nothing stranded on the way').toBe(false);
        expect(await strandedReports(page), 'no prompt was stranded').toEqual([]);
        expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
        expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
        const after = await wireOf(request, playerId);
        expect(after.thisPlayer.terraformRating, `+${c.tr} TR`).toBe(N + c.tr);
        expect(after.thisPlayer.megacredits, `the price and the Greens' ${2 * c.tr} M€`).toBe(mc0 - cost + 2 * c.tr);
        if (c.wave) {
          expect(after.thisPlayer.plantProduction, '+1 plant production').toBe(before.thisPlayer.plantProduction + 1);
        }

        // ── 5. Red, never reloaded: blue's rating in red's reading of blue's seat.
        if (red !== undefined) {
          const blue = before.thisPlayer.color;
          await expect.poll(async () => (await wireOf(request, seats[1])).players.find((p) => p.color === blue)?.terraformRating, {timeout: 20_000}).toBe(N + c.tr);
          await red.bringToFront();
          await press(red, 'KeyY', 1200);
          await expect(red.locator('.con-info'), 'red opened the Information workspace').toBeVisible();
          const onBlue = async () => ((await red.locator('.con-info .con-wshead').textContent()) ?? '').includes('player1');
          for (let i = 0; i < 4 && !await onBlue(); i++) {
            await press(red, 'KeyE', 900);
          }
          expect(await onBlue(), 'blue\'s seat is on stage').toBe(true);
          await expect.poll(() => text(red, '.con-res .con-score__value--tr'), {timeout: 20_000, message: 'red reads blue\'s rating'}).toBe(String(N + c.tr));
          await shoot(red, preset.id, `${c.key}-03-watcher-blue-seat`);
        }
      });
    }
  });
}
