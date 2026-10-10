import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, openActionFocus, openCardActions, openConsole, press, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR29 «УТИЛИЗАЦИЯ КОСМОЛЁТОВ» — A SPEND IS A DEPARTURE FROM ITS REAL SOURCE
 * (docs/claude/console/workspace-band.md § ACTION COMMIT; PL-064 in general;
 * `consoleActionCommit.spendLinkSpecs`, `consoleActionCommitRail.ts`). One
 * action, one price taken from a card the player CHOOSES, two outcomes. Two
 * profiles, a second client:
 *
 *   1. «Действия карт» → the composer: the SOURCE row (a card-level step, asked
 *      first) reads each candidate — «Эта карта» 2 → 1, Formula Zero 1 → 0 ·
 *      ПО 1 → 0; the variants; variant B's TARGET row — EVA Mechs 1 → 2, Mech
 *      Sports 0 → 1 · ПО 0 → 1; nothing sent.
 *   2. A, the source THIS card: ONE POST; the «−1» token is born on the hero's
 *      capsule, which reads 2 on every sample until it leaves, then 1; it is
 *      absorbed at the printed titanium; the «+2» is born there AFTER it; the
 *      titanium row reads 0 until its touchdown; the workspace stands until
 *      the result is born. No token above the screen, nothing degraded.
 *   3. B, the source Formula Zero, the target Mech Sports: the «−1» is born on
 *      Formula Zero's miniature in the source row — its capsule 1 → 0 and the
 *      VP cell −1 on the DEPARTURE, never earlier; the mech is born on the
 *      printed mech AFTER the spend landed and lands on Mech Sports' miniature
 *      in the target row — its capsule 0 → 1 and the VP back on the TOUCHDOWN;
 *      the workspace stands until that touchdown. The server: Formula Zero 0,
 *      Mech Sports 1, this card 2, no titanium.
 *   4. No mech holder: variant B disabled with its reason, no target row, A is
 *      the whole action (no OrOptions answer in the POST).
 *   5. No fighter on any card of yours: the tile refused with its reason.
 *   6. The neighbours, the class (A/B — fixture `earth-army-contract` arranged
 *      with Nitrite Reducing Bacteria ×3 and Titan Air-scrapping ×2): the
 *      «−3» / «−2» token leaves the hero's capsule, the capsule ticks on the
 *      departure, the TR token is born after it and the rating ticks on its
 *      touchdown.
 *   7. Red, never reloaded: blue's titanium after A.
 *
 * Fixture `spaceship-recycling` (tests/e2e/fixtures/generate.ts). Heavy 4K: run with `--workers=1`.
 */

const CARD = 'Spaceship Recycling';
const FZ = 'Formula Zero';
const EVA = 'EVA Mechs';
const MS = 'Mech Sports';
const NITRITE = 'Nitrite Reducing Bacteria';
const TITAN = 'Titan Air-scrapping';
const OUT = path.resolve('screenshots', 'spaceship-recycling');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, titanium: number, terraformRating: number, megacredits: number, tableau: Array<{name: string, resources?: number}>},
  players: Array<{color: string, titanium: number, terraformRating: number, tableau?: Array<{name: string, resources?: number}>}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

const countOf = (w: Wire, card: string) => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

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
const miniature = (card: string) => `${composer} [data-composer-card="${card}"]`;
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

type Rect = {l: number, t: number, r: number, b: number};

/** The hero's printed icons by sprite (`titanium.`, `mech`, `tr.`), in print order — the anchors the phrase is measured against. */
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
  t: number, tick: boolean, ws: number, cap: string, fz: string, ms: string, ti: string, vp: string, tr: string, link: string,
  chips: Array<Chip>, heroOp: number, stranded: boolean,
  /** The crumb's tail (the ARRIVING word of a crossfade) and whether it wears the past-commit amber (PL-062). */
  stage: string, amber: boolean,
  /** The command bar's context — the stage again, from the same fact. */
  barCtx: string,
  /** The VP cell's delta chips as painted: text and opacity (PL-069 — the old sign never stands over the new number). */
  vpChips: string,
};
type Probe = {samples: Array<Sample>, ticks: number};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(([heroSel, composerSel, fz, ms]) => {
    const w = window as unknown as {__tr29: Probe};
    const p: Probe = {samples: [], ticks: 0};
    w.__tr29 = p;
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
        fz: read(`${composerSel} [data-composer-card="${fz}"] .pcard__res-count`),
        ms: read(`${composerSel} [data-composer-card="${ms}"] .pcard__res-count`),
        // The digits only — the row's delta chips ride the same node.
        ti: (read('.con-res .con-res__row--titanium .con-res__digits').match(/^-?\d+/) ?? [''])[0],
        vp: read('.con-res .con-score__cell--vp .con-score__value'),
        tr: read('.con-res .con-score__value--tr'),
        link: document.querySelector(heroSel)?.getAttribute('data-commit-link') ?? '',
        chips,
        heroOp: (() => {
          let op = document.querySelector(`${heroSel} .pcard`) === null ? 0 : 1;
          for (let n = document.querySelector<HTMLElement>(`${heroSel} .pcard`); n !== null; n = n.parentElement) {
            op *= Number(getComputedStyle(n).opacity);
          }
          return Math.round(op * 100) / 100;
        })(),
        stranded: document.querySelector('.con-stranded') !== null,
        ...(() => {
          const step = Array.from(document.querySelectorAll<HTMLElement>('.con-cardactions .con-wshead__step'))
            .filter((el) => !el.classList.contains('con-wshead-swap-leave-active')).pop();
          return {
            stage: (step?.textContent ?? '').trim(),
            amber: step?.classList.contains('con-wshead__step--committed') === true,
            barCtx: read('.con-cmdbar__context'),
            vpChips: Array.from(document.querySelectorAll<HTMLElement>('.con-res .con-score__cell--vp .delta-chip'))
              .map((el) => `${(el.textContent ?? '').replace(/\s+/g, '')}@${Math.round(Number(getComputedStyle(el).opacity) * 10) / 10}`).join(' '),
          };
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
  }, [hero, composer, FZ, MS] as const);
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr29: Probe}).__tr29);

const inside = (chip: Chip, rect: Rect, slack: number) =>
  chip.x >= rect.l - slack && chip.x <= rect.r + slack && chip.y >= rect.t - slack && chip.y <= rect.b + slack;

/** Each token's BIRTH: a sample holding MORE chips of one value than the one before; the newborn is the one farthest from the old. */
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

/** The last position a token of `value` held before it vanished (its touchdown / absorption) and the sample it was last seen in. */
function lastSeen(samples: ReadonlyArray<Sample>, value: string, from: number): {at: number, chip: Chip} | undefined {
  let found: {at: number, chip: Chip} | undefined;
  for (let i = from; i < samples.length; i++) {
    const chip = samples[i].chips.find((c) => c.v === value);
    if (chip === undefined) {
      if (found !== undefined) {
        break;
      }
      continue;
    }
    found = {at: i, chip};
  }
  return found;
}

/** The sample a token of `value` ARRIVED at its end point — the first one it stands still where it was last seen (it lingers there through the contact beat). */
function arrival(samples: ReadonlyArray<Sample>, value: string, from: number): {at: number, chip: Chip} | undefined {
  const end = lastSeen(samples, value, from);
  if (end === undefined) {
    return undefined;
  }
  for (let i = from; i <= end.at; i++) {
    const chip = samples[i].chips.find((c) => c.v === value);
    if (chip !== undefined && Math.hypot(chip.x - end.chip.x, chip.y - end.chip.y) <= 3) {
      return {at: i, chip};
    }
  }
  return end;
}

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 140).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} ws=${s.ws} cap=${s.cap} fz=${s.fz} ms=${s.ms} ti=${s.ti} vp=${s.vp} [${s.vpChips}] tr=${s.tr} link=${s.link} st=${s.stage}${s.amber ? '!' : ''} bar=${s.barCtx} chips=${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}`).join('\n');
}

/** The focused tile is the card's (and, with `row`, the printed row whose text matches it — a card prints one tile per row). */
const tileFocused = (page: Page, card: string, row?: RegExp) => page.evaluate(([name, source]) => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  return tile?.getAttribute('data-action-card') === name && (source === '' || new RegExp(source).test(tile.textContent ?? ''));
}, [card, row?.source ?? ''] as const);

/** «Действия карт» → the card's tile (its row matching `row`) → its composer. */
async function openComposer(page: Page, card: string, row?: RegExp): Promise<void> {
  await openCardActions(page);
  expect(await walkFocusUntil(page, () => tileFocused(page, card, row), () => focusedTile(page), 16),
    `never focused «${card}»${row === undefined ? '' : ` · ${row}`} (at «${await focusedTile(page)}»)`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(composer), 'the composer stands').toBeVisible();
}

const focusedRow = (page: Page) => text(page, `${composer} .con-composer__row--focused`);

/** Walk the composer's cursor (↑ / ↓) until `ok` holds. */
async function walkComposer(page: Page, ok: () => Promise<boolean>, label: string): Promise<void> {
  for (const key of ['ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 8; i++) {
      if (await ok()) {
        return;
      }
      await press(page, key, 220);
    }
  }
  expect(await ok(), `the composer's cursor never reached ${label} (at «${await focusedRow(page)}»)`).toBe(true);
}

/** The played-target step's focused candidate: 'self' for the «Эта карта» proxy, else the card's name. */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

/** A on a card-pick row → the played-target step → walk to `want` ('self' or a card's name) → A. */
async function pickCard(page: Page, rowLabel: RegExp, want: string): Promise<void> {
  await walkComposer(page, async () => rowLabel.test(await focusedRow(page)), `the row ${rowLabel}`);
  await press(page, 'Enter', 500);
  await expect(page.locator('.con-ptsel'), 'the played-target step opened').toBeVisible();
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    for (let i = 0; i < 6 && !(await focusedCandidate(page)).includes(want); i++) {
      await press(page, key, 220);
    }
  }
  expect(await focusedCandidate(page), `the step's cursor reached ${want}`).toContain(want);
  await press(page, 'Enter', 500);
  await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
}

/** The variant radiogroup: A on option `pos`. */
async function pickVariant(page: Page, pos: number): Promise<void> {
  const at = () => page.evaluate(() => Number(document.querySelector('.con-composer__branch--focused')?.getAttribute('data-branch-pos') ?? -1));
  await walkComposer(page, async () => (await at()) === pos, `variant ${pos}`);
  await press(page, 'Enter', 400);
}

async function toCommitRow(page: Page): Promise<void> {
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

type Ready = {railReward: {degraded?: {key: string, why: string}}, actionCommitRail: {lastEnd: string, fallback: string}};
const readyOf = (page: Page) => page.evaluate(() => (window as unknown as {__conReady: () => Ready}).__conReady());

for (const preset of PRESETS) {
  test.describe(`TR29 Spaceship Recycling · a spend leaves its real source · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('A from THIS card — the «−1» leaves the hero\'s capsule, the titanium is born where it landed; red watches', async ({page, request, context}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'spaceship-recycling', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect([countOf(before, CARD), countOf(before, FZ), countOf(before, EVA), countOf(before, MS), before.thisPlayer.titanium],
        'the fixture: TR29 ×2 · Formula Zero ×1 · EVA ×1 · Mech Sports ×0, no titanium').toEqual([2, 1, 1, 0, 0]);

      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await page.bringToFront();

      // ── 1. The composer: the source asked FIRST, every candidate read; the variants; nothing sent.
      await openComposer(page, CARD);
      expect(await focusedRow(page), 'the source row is the first decision — its ask names the source').toMatch(/Выберите карту-источник/);
      await walkComposer(page, async () => /Выберите карту-источник/.test(await focusedRow(page)), 'the source row');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'the source step').toBeVisible();
      await expect(page.locator('.con-ptsel [data-ptsel-self]'), '«Эта карта» — this card is a candidate, by its proxy').toHaveCount(1);
      await expect(page.locator('.con-ptsel [data-zoom-slot]'), 'Formula Zero is the other candidate').toHaveCount(1);
      // Formula Zero in focus reads its own move and its point.
      for (let i = 0; i < 4 && !(await focusedCandidate(page)).includes(FZ); i++) {
        await press(page, 'ArrowRight', 220);
      }
      const fzReading = await text(page, `${composer} .con-ptsel`);
      expect(fzReading, `Formula Zero: 1 → 0 and ПО 1 → 0 — got «${fzReading}»`).toMatch(/1\s*→\s*0[\s\S]*ПО\s*1\s*→\s*0/);
      await shoot(page, preset.id, '01-source-step');
      for (let i = 0; i < 4 && (await focusedCandidate(page)) !== 'self'; i++) {
        await press(page, 'ArrowLeft', 220);
      }
      expect(await focusedCandidate(page), 'back on «Эта карта»').toBe('self');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'answered').toHaveCount(0);
      expect(await text(page, `${composer} .con-composer__row`), 'the source row: the role and this card\'s 2 → 1').toMatch(/Карта-источник[\s\S]*2\s*→\s*1/);
      expect(await page.locator(`${composer} .con-composer__branch`).count(), 'two variants').toBe(2);
      // PL-074 — the price both variants share is printed ONCE, on the price side, before a variant is chosen; the
      // variant cards read only what each gives.
      expect(await text(page, `${composer} .con-composer__hero`), 'the formula states the common price').toMatch(/Будет списано/);
      expect(await page.locator(`${composer} .con-composer__branch .action-effect-chip--cost`).count(), 'no variant card repeats it').toBe(0);
      expect(await page.locator(`${composer} .con-composer__branch .action-effect-chip--gain`).count(), 'each card keeps its result').toBeGreaterThanOrEqual(2);
      await pickVariant(page, 0);
      await toCommitRow(page);
      expect(seen.posts, 'nothing sent before A').toEqual([]);
      const capsule = await rectOf(page, `${hero} .pcard__res`);
      const titaniumIcons = await heroIcons(page, 'titanium.');
      const titaniumRow = await rectOf(page, '.con-res .con-res__row--titanium');
      expect(capsule, 'the hero\'s capsule').toBeDefined();
      expect(titaniumIcons.length, 'the two printed titanium').toBe(2);
      await shoot(page, preset.id, '02-ready-a');

      // ── 2. A → one POST → the phrase.
      await armProbe(page);
      const stop = await storyboard(page, preset.id, 'a');
      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.titanium, {timeout: 30_000, message: 'the server paid the titanium'}).toBe(2);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const probe = await readProbe(page);
      const samples = probe.samples;
      console.log(`[${preset.id}] A capsule=${JSON.stringify(capsule)} ti=${JSON.stringify(titaniumIcons)}\n${trail(samples)}`);
      expect(probe.ticks, 'the probe was alive').toBeGreaterThan(10);
      expect(seen.posts.length, 'A sent EXACTLY ONE request').toBe(1);
      expect(seen.posts[0], 'the source is this card, the variant A').toMatch(new RegExp(`"cards":\\["${CARD}"\\]\\},\\{"type":"or","index":0`));

      const born = births(samples);
      const spend = born.find((b) => b.chip.v === '−1');
      expect(spend, 'a «−1» token was born').toBeDefined();
      expect(inside(spend!.chip, capsule!, Math.max(spend!.chip.w, spend!.chip.h) / 2), `the «−1» is born ON the hero's capsule — ${JSON.stringify(spend!.chip)} vs ${JSON.stringify(capsule)}`).toBe(true);
      const absorbed = arrival(samples, '−1', spend!.at)!;
      expect(inside(absorbed.chip, titaniumIcons[0], Math.max(absorbed.chip.w, absorbed.chip.h)), `the «−1» is absorbed at the printed titanium — ${JSON.stringify(absorbed.chip)} vs ${JSON.stringify(titaniumIcons[0])}`).toBe(true);
      const result = born.find((b) => b.chip.v === '+2');
      expect(result, 'a «+2» token was born').toBeDefined();
      expect(result!.at, 'the titanium is born only AFTER the spend has landed').toBeGreaterThanOrEqual(absorbed.at - 1);
      expect(inside(result!.chip, titaniumIcons[0], 2), `the «+2» is born on the printed titanium — ${JSON.stringify(result!.chip)}`).toBe(true);

      const capOne = samples.findIndex((s) => s.cap === '1');
      expect(capOne, 'the capsule ticked 2 → 1').toBeGreaterThan(0);
      expect(samples.slice(0, capOne).every((s) => s.cap === '2'), 'the capsule read 2 on EVERY sample until the spend left').toBe(true);
      expect(capOne, 'the capsule ticked on the DEPARTURE — never before the token was born').toBeGreaterThanOrEqual(spend!.at);
      expect(samples.every((s) => s.cap === '' || s.cap === '2' || s.cap === '1'), 'the capsule never read 0').toBe(true);
      const tiUp = samples.findIndex((s) => s.ti === '2');
      expect(tiUp, 'the titanium row ticked on the «+2»').toBeGreaterThan(result!.at);
      expect(samples.slice(0, tiUp).every((s) => s.ti === '0'), 'the titanium read 0 on every sample before the touchdown').toBe(true);
      const touchdown = lastSeen(samples, '+2', result!.at)!;
      expect(inside(touchdown.chip, titaniumRow!, Math.max(touchdown.chip.w, touchdown.chip.h)), `the tick is the «+2»'s touchdown on the titanium row — ${JSON.stringify(touchdown.chip)} vs ${JSON.stringify(titaniumRow)}`).toBe(true);
      const wsGone = samples.findIndex((s) => s.ws === 0);
      expect(wsGone, 'the workspace stood until the result was born').toBeGreaterThanOrEqual(result!.at);
      // PL-062 — past the press the tail is «ВЫПОЛНЕНИЕ», amber, for the whole phrase; never the setup it left.
      expect(samples[0].stage, 'the setup before the press').toBe('Настройка');
      const phrase = samples.slice(spend!.at).filter((s) => s.ws === 1 && s.stage !== '');
      expect(phrase.length, 'the crumb was read during the phrase').toBeGreaterThan(0);
      expect(phrase.filter((s) => s.stage !== 'Выполнение' || !s.amber).map((s) => `${s.t}:${s.stage}:${s.amber}`),
        'the tail reads «Выполнение» in the past-commit amber while the phrase plays').toEqual([]);
      // The bar names the same stage until the fold hands it to the board (the leave window reads the board's own word).
      const pressed = samples.findIndex((s) => s.stage === 'Выполнение');
      const folding = samples.findIndex((s, i) => i > pressed && s.barCtx !== 'Выполнение');
      expect(samples[pressed]?.barCtx, 'the bar turns with the crumb').toBe('Выполнение');
      expect(samples.slice(pressed).filter((s) => s.barCtx === 'Настройка').map((s) => `${s.t}`), 'the bar never goes back to the setup').toEqual([]);
      expect(folding < 0 || samples[folding].t >= samples[result!.at].t, `the bar left «Выполнение» only past the result's birth (${samples[folding]?.t} ms: «${samples[folding]?.barCtx}»)`).toBe(true);
      expect(samples.slice(0, result!.at + 1).filter((s) => s.heroOp < 0.5).map((s) => `${s.t}:${s.heroOp}`), 'the hero is painted while its tokens are born on it').toEqual([]);
      const highest = Math.min(...samples.flatMap((s) => s.chips).map((c) => c.y - c.h / 2));
      expect(highest, `no token above the screen — top edge reached y = ${highest}`).toBeGreaterThanOrEqual(0);
      const ready = await readyOf(page);
      expect(ready.railReward.degraded?.key, `no degradation was named — ${JSON.stringify(ready.railReward.degraded)}`).not.toBe(`action-commit:${CARD}`);
      expect(ready.actionCommitRail.fallback, 'the spend was born on its source\'s own face').toBe('');

      // ── The board, the server.
      await waitForBoardHome(page);
      await shoot(page, preset.id, '03-board-a');
      expect(samples.some((s) => s.stranded), 'nothing stranded on the way').toBe(false);
      expect(await strandedReports(page), 'no prompt was stranded').toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
      const after = await wireOf(request, playerId);
      expect([countOf(after, CARD), countOf(after, FZ), after.thisPlayer.titanium], 'TR29 1 · Formula Zero 1 · titanium 2').toEqual([1, 1, 2]);

      // ── 7. Red, never reloaded: blue's titanium.
      await red.bringToFront();
      const blue = before.thisPlayer.color;
      await expect.poll(async () => (await wireOf(request, seats[1])).players.find((p) => p.color === blue)?.titanium, {timeout: 20_000}).toBe(2);
      await press(red, 'KeyY', 1200);
      await expect(red.locator('.con-info'), 'red opened the Information workspace').toBeVisible();
      const onBlue = async () => ((await red.locator('.con-info .con-wshead').textContent()) ?? '').includes('player1');
      for (let i = 0; i < 4 && !await onBlue(); i++) {
        await press(red, 'KeyE', 900);
      }
      expect(await onBlue(), 'blue\'s seat is on stage').toBe(true);
      await expect.poll(async () => ((await red.locator('.con-res .con-res__row--titanium .con-res__digits').textContent()) ?? '').match(/^-?\d+/)?.[0],
        {timeout: 20_000, message: 'red reads blue\'s titanium 2'}).toBe('2');
      await shoot(red, preset.id, '04-watcher-blue-seat');
      expect(redErrors, `no page error on the watcher — ${redErrors.join(' | ')}`).toEqual([]);
    });

    test('B from Formula Zero onto Mech Sports — the spend leaves the source row\'s miniature, the mech lands on the target row\'s', async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'spaceship-recycling', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);

      await openComposer(page, CARD);
      await pickCard(page, /Выберите карту-источник/, FZ);
      expect(await text(page, `${composer} .con-composer__row`), 'the source row: Formula Zero 1 → 0 · ПО 1 → 0').toMatch(/Карта-источник[\s\S]*1\s*→\s*0[\s\S]*ПО\s*1\s*→\s*0/);
      await pickVariant(page, 1);
      // The target row: both holders read before the press — EVA Mechs 1 → 2, Mech Sports 0 → 1 · ПО 0 → 1.
      await walkComposer(page, async () => /Выберите карту-получатель/.test(await focusedRow(page)), 'the target row');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'the target step').toBeVisible();
      for (let i = 0; i < 4 && !(await focusedCandidate(page)).includes(EVA); i++) {
        await press(page, 'ArrowLeft', 220);
      }
      expect(await text(page, `${composer} .con-ptsel`), 'EVA Mechs 1 → 2').toMatch(/1\s*→\s*2/);
      for (let i = 0; i < 4 && !(await focusedCandidate(page)).includes(MS); i++) {
        await press(page, 'ArrowRight', 220);
      }
      expect(await text(page, `${composer} .con-ptsel`), 'Mech Sports 0 → 1 · ПО 0 → 1').toMatch(/0\s*→\s*1[\s\S]*ПО\s*0\s*→\s*1/);
      await shoot(page, preset.id, '05-target-step');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'answered').toHaveCount(0);
      const rows = await page.locator(`${composer} .con-composer__row`).allTextContents();
      expect(rows.map((r) => r.replace(/\s+/g, ' ')).join(' | '), 'the two answered rows name their roles').toMatch(/Карта-источник.*Формула-0.*\|.*Карта-получатель.*Мех-спорт/);
      await toCommitRow(page);
      expect(seen.posts, 'nothing sent before A').toEqual([]);
      const source = await rectOf(page, miniature(FZ));
      const target = await rectOf(page, miniature(MS));
      const mechIcon = (await heroIcons(page, 'mech'))[0];
      expect(source, 'Formula Zero\'s miniature in the source row').toBeDefined();
      expect(target, 'Mech Sports\' miniature in the target row').toBeDefined();
      expect(mechIcon, 'the printed mech').toBeDefined();
      await shoot(page, preset.id, '06-ready-b');

      await armProbe(page);
      const stop = await storyboard(page, preset.id, 'b');
      await commit(page, seen.posts);
      await expect.poll(async () => countOf(await wireOf(request, playerId), MS), {timeout: 30_000, message: 'the server put the mech'}).toBe(1);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const samples = (await readProbe(page)).samples;
      console.log(`[${preset.id}] B source=${JSON.stringify(source)} target=${JSON.stringify(target)} mech=${JSON.stringify(mechIcon)}\n${trail(samples)}`);
      expect(seen.posts.length, 'one POST').toBe(1);
      expect(seen.posts[0], 'source Formula Zero, variant B, target Mech Sports').toMatch(new RegExp(`"cards":\\["${FZ}"\\]\\},\\{"type":"or","index":1[^\\]]*\\},\\{"type":"card","cards":\\["${MS}"\\]`));

      const born = births(samples);
      const spend = born.find((b) => b.chip.v === '−1');
      expect(spend, 'a «−1» token was born').toBeDefined();
      expect(inside(spend!.chip, source!, Math.max(spend!.chip.w, spend!.chip.h) / 2), `the «−1» is born on Formula Zero's miniature — ${JSON.stringify(spend!.chip)} vs ${JSON.stringify(source)}`).toBe(true);
      const vp0 = samples[0].vp;
      const fzZero = samples.findIndex((s) => s.fz === '0');
      expect(samples.slice(0, fzZero).every((s) => s.fz === '1'), 'Formula Zero read 1 on every sample until the spend left').toBe(true);
      expect(fzZero, 'its capsule ticked on the DEPARTURE').toBeGreaterThanOrEqual(spend!.at);
      const vpDown = samples.findIndex((s) => s.vp !== vp0);
      expect(vpDown, 'its point no earlier than the departure').toBeGreaterThanOrEqual(spend!.at);
      expect(Number(samples[vpDown].vp), 'the VP cell dips by Formula Zero\'s point').toBe(Number(vp0) - 1);
      const absorbed = arrival(samples, '−1', spend!.at)!;
      expect(inside(absorbed.chip, mechIcon!, Math.max(absorbed.chip.w, absorbed.chip.h)), `the «−1» is absorbed at the printed mech — ${JSON.stringify(absorbed.chip)}`).toBe(true);
      const mech = born.find((b) => b.chip.v === '+1');
      expect(mech, 'a «+1» mech was born').toBeDefined();
      expect(mech!.at, 'the mech is born only AFTER the spend has landed').toBeGreaterThanOrEqual(absorbed.at - 1);
      expect(inside(mech!.chip, mechIcon!, 2), `the mech is born on the printed mech — ${JSON.stringify(mech!.chip)}`).toBe(true);
      const landed = lastSeen(samples, '+1', mech!.at)!;
      expect(inside(landed.chip, target!, Math.max(landed.chip.w, landed.chip.h) / 2), `the mech lands on Mech Sports' miniature — ${JSON.stringify(landed.chip)} vs ${JSON.stringify(target)}`).toBe(true);
      const msOne = samples.findIndex((s) => s.ms === '1');
      expect(samples.slice(0, msOne).every((s) => s.ms === '0'), 'Mech Sports read 0 until the mech arrived').toBe(true);
      expect(msOne, 'its capsule ticked on the touchdown').toBeGreaterThan(mech!.at);
      const vpBack = samples.findIndex((s, i) => i > vpDown && s.vp === vp0);
      expect(vpBack, 'the point came back with the mech').toBeGreaterThan(mech!.at);
      const wsGone = samples.findIndex((s) => s.ws === 0);
      expect(wsGone, 'the workspace stood until the mech had landed on its card').toBeGreaterThanOrEqual(msOne);
      // PL-138 (the owner's decision 2026-10-10): …and not for long — the token sinks into the card in one quick beat
      // and the workspace leaves; a surface standing ≈ 0.5 s past its own last tick («Выполняется…» over a card that
      // had already answered) was the pause the A scene of every mech paid. Budget: the quick absorb (180) + the
      // surface's leave (≈ 150) + the renderer's commit of the board's return (≈ 200 at 4K), with room for a loaded runner.
      expect(samples[wsGone].t - samples[msOne].t, `the workspace left within one quick beat of the capsule's tick (tick ${samples[msOne].t}, gone ${samples[wsGone].t})`).toBeLessThanOrEqual(550);
      const highest = Math.min(...samples.flatMap((s) => s.chips).map((c) => c.y - c.h / 2));
      expect(highest, `no token above the screen — y = ${highest}`).toBeGreaterThanOrEqual(0);
      const ready = await readyOf(page);
      expect(ready.railReward.degraded?.key, `no degradation was named — ${JSON.stringify(ready.railReward.degraded)}`).not.toBe(`action-commit:${CARD}`);
      expect(ready.actionCommitRail.fallback, 'the spend was born on its source\'s own face').toBe('');

      await waitForBoardHome(page);
      await shoot(page, preset.id, '07-board-b');
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
      const after = await wireOf(request, playerId);
      expect([countOf(after, CARD), countOf(after, FZ), countOf(after, MS), after.thisPlayer.titanium], 'TR29 2 · Formula Zero 0 · Mech Sports 1 · titanium 0')
        .toEqual([2, 0, 1, before.thisPlayer.titanium]);
    });

    test('no mech holder — variant B refused with its reason, A is the whole action (no OrOptions answer)', async ({page, request}) => {
      test.setTimeout(240_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'spaceship-recycling', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string}>}>)[0];
          blue.playedCards = blue.playedCards.filter((card) => card.name !== EVA && card.name !== MS);
        },
      });
      await settle(page);
      await openComposer(page, CARD);
      const refused = page.locator(`${composer} .con-composer__branch-reason`);
      await expect(refused, 'one variant refused').toHaveCount(1);
      expect(await refused.textContent(), 'with its reason').toContain('Нет вашей карты, которая примет мех');
      await pickCard(page, /Выберите карту-источник/, 'self');
      await expect(page.locator(`${composer} .con-composer__row`), 'no target row — the source alone').toHaveCount(1);
      await toCommitRow(page);
      await shoot(page, preset.id, '08-no-holder');
      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.titanium, {timeout: 30_000}).toBe(2);
      expect(seen.posts.length, 'one POST').toBe(1);
      expect(seen.posts[0], 'the batch: the activation and the source — no variant answer').not.toMatch(/"type":"or","index":\d+,"response":\{"type":"option"\}/);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000}).toBe(0);
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
    });

    test('no fighter on any card of yours — the tile refused with its reason', async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'spaceship-recycling', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string, resourceCount?: number}>}>)[0];
          blue.playedCards = blue.playedCards.map((card) => card.name === CARD || card.name === FZ ? {...card, resourceCount: 0} : card);
        },
      });
      await settle(page);
      await openCardActions(page);
      const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
      await expect(tile, 'the tile is shown').toHaveCount(1);
      await expect(tile, 'with its reason').toContainText('Нет истребителей на ваших картах');
      await shoot(page, preset.id, '09-no-fighters');
    });

    for (const neighbour of [{card: NITRITE, count: 3, spent: '−3', resource: 'microbe'}, {card: TITAN, count: 2, spent: '−2', resource: 'floater'}]) {
      test(`the class — ${neighbour.card}: «${neighbour.spent}» leaves the hero's capsule on its departure, the TR is born after it`, async ({page, request}) => {
        test.setTimeout(240_000);
        const seen = watchPage(page);
        const {playerId} = await bootFixtureSeats(page, request, 'earth-army-contract', {
          query: preset.query,
          arrange: (serialized) => {
            const blue = (serialized.players as Array<{playedCards: Array<{name: string, resourceCount?: number}>}>)[0];
            blue.playedCards = [...blue.playedCards.filter((card) => card.name !== 'Earth Army Contract'), {name: neighbour.card, resourceCount: neighbour.count}];
          },
        });
        await settle(page);
        const before = await wireOf(request, playerId);
        const N = before.thisPlayer.terraformRating;
        await openComposer(page, neighbour.card, /РТ/);
        const formula = await text(page, `${composer} .con-composer__hero`);
        expect(formula, `the TR branch: the rating N → N + 1 — got «${formula}»`).toMatch(new RegExp(`${N}\\s*→\\s*${N + 1}`));
        await toCommitRow(page);
        const capsule = await rectOf(page, `${hero} .pcard__res`);
        const trIcon = (await heroIcons(page, 'tr.'))[0];
        await armProbe(page);
        const stop = await storyboard(page, preset.id, `class-${neighbour.resource}`);
        await commit(page, seen.posts);
        await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.terraformRating, {timeout: 30_000}).toBe(N + 1);
        await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000}).toBe(0);
        await settle(page, {timeoutMs: 30_000});
        await stop();
        const samples = (await readProbe(page)).samples;
        console.log(`[${preset.id}] ${neighbour.card} N=${N} capsule=${JSON.stringify(capsule)} tr=${JSON.stringify(trIcon)}\n${trail(samples)}`);
        expect(seen.posts.length, 'one POST').toBe(1);
        const born = births(samples);
        const spend = born.find((b) => b.chip.v === neighbour.spent);
        expect(spend, `a «${neighbour.spent}» token was born`).toBeDefined();
        expect(inside(spend!.chip, capsule!, Math.max(spend!.chip.w, spend!.chip.h) / 2), `born on the hero's capsule — ${JSON.stringify(spend!.chip)} vs ${JSON.stringify(capsule)}`).toBe(true);
        const capZero = samples.findIndex((s) => s.cap === '0');
        expect(samples.slice(0, capZero).every((s) => s.cap === String(neighbour.count)), `the capsule read ${neighbour.count} on every sample until the spend left`).toBe(true);
        expect(capZero, 'the capsule ticked on the departure').toBeGreaterThanOrEqual(spend!.at);
        const tr = born.find((b) => b.chip.v === '+1');
        expect(tr, 'a TR token').toBeDefined();
        expect(tr!.at, 'the TR is born after the spend').toBeGreaterThan(spend!.at);
        expect(inside(tr!.chip, trIcon!, 2), `the TR is born on the printed TR — ${JSON.stringify(tr!.chip)}`).toBe(true);
        const trUp = samples.findIndex((s) => s.tr === String(N + 1));
        expect(trUp, 'the rating ticked after the TR token was born').toBeGreaterThan(tr!.at);
        expect(samples.slice(0, trUp).every((s) => s.tr === String(N)), 'N on every sample before the touchdown').toBe(true);
        const after = await wireOf(request, playerId);
        expect(countOf(after, neighbour.card), 'the card spent its resources').toBe(0);
        expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
      });
    }
  });
}
