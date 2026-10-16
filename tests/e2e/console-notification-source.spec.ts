import {test, expect, APIRequestContext, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, bootFixtureSeats, fetchPlayerModel, pressUntil, sendPlayerInput, settle} from './consoleStart';
import {TileType} from '../../src/common/TileType';

/**
 * TR59 · THE SOURCE OF A PAYOUT ON THE VIEWER'S OWN TILE — the STAND of the iteration.
 *
 * The owner's report (2026-10-16): another seat (a human rival or MarsBot) places a tile next to the viewer's
 * Ares tile; the viewer's toast says «Вы получили +1 M€», and its cause line («ИСТОЧНИК …») names the ACTOR's
 * card — the standard project, the card the actor played, the bot's bonus card — instead of the viewer's own tile
 * (the card that placed it). The server pays the adjacent tile's owner with no scope of its own
 * (`AresHandler.earnAdacencyBonus` → the owner bonus), so the event inherits the actor's source.
 *
 * Two live scenes on one board (fixtures `notification-source-ares*`, `tests/e2e/fixtures/generate.ts` § TR59):
 * blue's Restricted Area (Ares) on 47 — placed BY its card, the card in blue's tableau — and the free cell 48 beside it.
 *   A · a HUMAN rival (red) builds the City standard project on 48 over the API (the real `player/input`);
 *   B · MarsBot (a solo table) — blue passes on the LT wheel, the bot's B05 Expedited Construction puts its city on
 *       48 (the generator proves it on a dry-run copy: the only cell beside three greeneries).
 * Each scene records the viewer's positive card: one full frame once the card stands at rest, one crop of the card,
 * the card's whole text + its zones + its geometry (size against the screen, what it covers, the painted type
 * sizes) into the test output and an annotation — the material the fix is judged against.
 *
 * THE ASSERTIONS hold BEFORE and AFTER the fix (the spec shoots both: `TR59_SHOT_PREFIX=before|after`, default
 * `after`): a positive card arrives, its band says +1 and M€, and the server paid the owner (A: the viewer's M€ +1;
 * B: the bot's city stands on 48). What the cause line SAYS is the fix's to assert.
 *
 * Waits are state-waits (the server's model, the card's own rest — two equal samples of its box at full opacity,
 * each sample pumping a frame with a tiny screenshot so headless rAF never starves the entrance).
 */

const PREFIX = (process.env.TR59_SHOT_PREFIX ?? 'after').trim() || 'after';
const OUT_ROOT = path.resolve('screenshots', 'tr59');

const VIEWER_TILE = '47';
const CITY_CELL = '48';

const PROFILES = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const POSITIVE = '.con-notif.con-notif--sign-positive';

type Wire = {
  thisPlayer: {megaCredits?: number, megacredits?: number, color: string},
  game: {spaces?: Array<{id: string, tileType?: number, color?: string}>},
  waitingFor?: {
    type: string,
    spaces?: Array<string>,
    options?: Array<{type: string, title?: string | {message: string}, cards?: Array<{name: string, calculatedCost?: number}>}>,
  },
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

function megacreditsOf(wire: Wire): number {
  return wire.thisPlayer.megaCredits ?? wire.thisPlayer.megacredits ?? NaN;
}

function optionTitle(o: {title?: string | {message: string}}): string {
  return typeof o.title === 'string' ? o.title : (o.title?.message ?? '');
}

async function shootFull(page: Page, profile: string, name: string): Promise<string> {
  const dir = path.join(OUT_ROOT, profile);
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, `${PREFIX}-${name}.png`);
  await page.screenshot({path: file});
  return file;
}

async function shootCrop(page: Page, profile: string, name: string, box: {x: number, y: number, width: number, height: number}): Promise<string> {
  const dir = path.join(OUT_ROOT, profile);
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, `${PREFIX}-${name}-card.png`);
  const view = page.viewportSize() ?? {width: 1920, height: 1080};
  const pad = Math.round(view.width / 120);
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const clip = {x, y, width: Math.min(view.width - x, Math.ceil(box.width + 2 * pad)), height: Math.min(view.height - y, Math.ceil(box.height + 2 * pad))};
  await page.screenshot({path: file, clip});
  return file;
}

/**
 * THE CARD LOG — every notification card that ever mounts, by id: its sign, variant and its LAST text (a
 * MutationObserver + a setInterval floor, never rAF). The record outlives the card's own TTL, so the test output
 * names what the viewer was shown even when a frame is missed.
 */
async function armCardLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__tr59Cards?: Record<string, {sign: string, variant: string, text: string, firstText?: string, firstAt: number, lastAt: number}>};
    w.__tr59Cards = {};
    const t0 = Date.now();
    const sample = (): void => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-notif'))) {
        const id = el.getAttribute('data-notif-id') ?? '(no id)';
        const cls = Array.from(el.classList);
        const entry = w.__tr59Cards![id] ?? {sign: '', variant: '', text: '', firstAt: Date.now() - t0, lastAt: 0};
        entry.sign = (cls.find((c) => c.startsWith('con-notif--sign-')) ?? '').replace('con-notif--sign-', '');
        entry.variant = (cls.find((c) => c.startsWith('notification-card--variant-')) ?? '').replace('notification-card--variant-', '');
        const text = el.innerText.replace(/\s+/g, ' ').trim();
        if (text !== '') {
          entry.text = text;
          entry.firstText = entry.firstText ?? text;
        }
        entry.lastAt = Date.now() - t0;
        w.__tr59Cards![id] = entry;
      }
    };
    new MutationObserver(sample).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-notif-id']});
    setInterval(sample, 150);
    sample();
  });
}

type LoggedCard = {sign: string, variant: string, text: string, firstText?: string, firstAt: number, lastAt: number};

async function cardLog(page: Page): Promise<Record<string, LoggedCard>> {
  return await page.evaluate(() => (window as unknown as {__tr59Cards?: Record<string, LoggedCard>}).__tr59Cards ?? {});
}

/**
 * The card STANDS AT REST: two consecutive equal samples of its box with the opacity chain at 1. Each sample is
 * preceded by a tiny screenshot, which forces a compositor frame (headless Chromium parks rAF on a quiet screen,
 * and the entrance would never finish without one).
 */
async function cardAtRest(page: Page, selector: string, maxSamples = 120): Promise<{x: number, y: number, width: number, height: number}> {
  let previous = '';
  let last = '';
  for (let i = 0; i < maxSamples; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => undefined);
    last = await page.evaluate((sel) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el === null) {
        return '';
      }
      const r = el.getBoundingClientRect();
      let opacity = 1;
      for (let a: HTMLElement | null = el; a !== null; a = a.parentElement) {
        opacity *= Number(getComputedStyle(a).opacity);
      }
      return `${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)},${opacity.toFixed(3)}`;
    }, selector);
    if (last !== '' && last === previous && last.endsWith(',1.000')) {
      const [x, y, width, height] = last.split(',').map(Number);
      return {x, y, width, height};
    }
    previous = last;
  }
  throw new Error(`the card «${selector}» never came to rest — last sample ${last || '(gone)'}`);
}

type CardAudit = {
  text: string,
  id: string,
  classes: Array<string>,
  zones: Record<string, Array<string>>,
  causes: Array<{label: string, name: string, detail: string, trigger: string}>,
  type: Array<{part: string, text: string, fontPx: number, boxH: number}>,
  rect: {x: number, y: number, width: number, height: number},
  viewport: {width: number, height: number},
  share: {width: number, height: number, area: number},
  covers: Array<{member: string, overlap: number}>,
  under: Array<string>,
  /** Every text-bearing element below the couch's type floor, read in the SAME sample the card stands in (a card leaves
   *  by its own TTL — read later, it may be gone). */
  floor: {floorPx: number, below: Array<string>},
};

/** Every zone of the card in the DOM's own words, its painted type sizes, its box against the screen and the HUD
 *  members it stands over (the strategy rail first) — the record the fix is judged against. */
async function auditCard(page: Page, selector: string): Promise<CardAudit> {
  return await page.evaluate((sel) => {
    const card = document.querySelector<HTMLElement>(sel)!;
    const textOf = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
    const all = (q: string) => Array.from(card.querySelectorAll(q)).map(textOf).filter((t) => t !== '');
    const zones: Record<string, Array<string>> = {
      head: all('.con-notif__head'),
      type: all('.con-notif__type'),
      typeCard: all('.con-notif__type-card'),
      actor: all('.con-notif__actor'),
      meta: all('.con-notif__meta'),
      band: all('.con-notif__you'),
      bandSign: all('.con-notif__you-sign'),
      bandChips: all('.con-notif__you-chips .con-notif__chip'),
      why: all('.con-notif__why'),
      headline: all('.con-notif__headline'),
      source: all('.con-notif__source'),
      summary: all('.con-notif__summary-line'),
      clusters: all('.con-notif__cluster-tag'),
      reveal: all('.con-notif__revealline'),
    };
    const causes = Array.from(card.querySelectorAll('.con-notif__cause')).map((line) => ({
      label: textOf(line.querySelector('.con-notif__cause-label') ?? document.createElement('i')),
      name: textOf(line.querySelector('.con-notif__card') ?? document.createElement('i')),
      detail: textOf(line.querySelector('.con-notif__cause-detail') ?? document.createElement('i')),
      trigger: textOf(line.querySelector('.con-notif__cause-trigger') ?? document.createElement('i')),
    }));
    const zoomOf = (el: Element): number => {
      let zoom = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const z = parseFloat(getComputedStyle(n).zoom || '1');
        zoom *= Number.isFinite(z) && z > 0 ? z : 1;
      }
      return zoom;
    };
    const parts = ['.con-notif__type', '.con-notif__type-card', '.con-notif__actor', '.con-notif__you-sign', '.con-notif__chip-value',
      '.con-notif__chip-unit', '.con-notif__cause-label', '.con-notif__why .con-notif__card', '.con-notif__cause-trigger',
      '.con-notif__headline', '.con-notif__summary-line', '.con-notif__cluster-tag'];
    const type = parts.flatMap((part) => {
      const el = card.querySelector(part);
      if (el === null) {
        return [];
      }
      return [{part, text: textOf(el).slice(0, 80), fontPx: Math.round(parseFloat(getComputedStyle(el).fontSize) * zoomOf(el) * 10) / 10,
        boxH: Math.round(el.getBoundingClientRect().height * 10) / 10}];
    });
    const r = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const members = ['.con-strat', '.con-res', '.con-status', '.con-cmdbar', '.con-main', '.con-board'];
    const covers = members.flatMap((member) => {
      const el = document.querySelector(member);
      if (el === null) {
        return [];
      }
      const m = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, m.right) - Math.max(r.left, m.left));
      const h = Math.max(0, Math.min(r.bottom, m.bottom) - Math.max(r.top, m.top));
      return [{member, overlap: Math.round(w * h / Math.max(1, r.width * r.height) * 1000) / 1000}];
    });
    // WHAT STANDS UNDER the card: at five points inside it, the top-most element that is NOT the card's own.
    const points = [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]];
    const under = points.map(([fx, fy]) => {
      const stack = document.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy);
      const below = stack.find((el) => !card.contains(el) && !el.closest('.con-notif'));
      if (below === undefined) {
        return `(${fx},${fy}) nothing`;
      }
      const chain: Array<string> = [];
      for (let n: Element | null = below; n !== null && chain.length < 3; n = n.parentElement) {
        const cls = Array.from(n.classList).filter((c) => c.startsWith('con-') || c.startsWith('board')).slice(0, 2).join('.');
        if (cls !== '') {
          chain.push(cls);
        }
      }
      return `(${fx},${fy}) ${chain.join(' < ') || below.tagName.toLowerCase()}`;
    });
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const floorPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor')) * rem;
    const below: Array<string> = [];
    for (const el of Array.from(card.querySelectorAll<HTMLElement>('*'))) {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      if (!own || el.closest('.gp-glyph') !== null) {
        continue;
      }
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px + 0.5 < floorPx) {
        below.push(`${el.className} «${(el.textContent ?? '').trim().slice(0, 30)}» ${px}px`);
      }
    }
    return {
      floor: {floorPx, below},
      text: card.innerText.replace(/\s+/g, ' ').trim(),
      id: card.getAttribute('data-notif-id') ?? '',
      classes: Array.from(card.classList),
      zones, causes, type,
      rect: {x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height)},
      viewport: {width: vw, height: vh},
      share: {width: Math.round(r.width / vw * 1000) / 1000, height: Math.round(r.height / vh * 1000) / 1000,
        area: Math.round(r.width * r.height / (vw * vh) * 1000) / 1000},
      covers, under,
    };
  }, selector);
}

/** The record into the test output AND the report: what the viewer read, zone by zone. */
function report(scene: string, audit: CardAudit, files: Array<string>): void {
  console.log(`[tr59] ${scene} · ${PREFIX} · card text: «${audit.text}»`);
  console.log(`[tr59] ${scene} · ${PREFIX} · audit: ${JSON.stringify(audit, null, 1)}`);
  console.log(`[tr59] ${scene} · ${PREFIX} · frames: ${files.join(' · ')}`);
  test.info().annotations.push({type: `notif-card ${scene}`, description: audit.text});
  test.info().annotations.push({type: `notif-cause ${scene}`, description: audit.causes.map((c) => `${c.label} | ${c.name} | ${c.detail} | ${c.trigger}`).join(' ‖ ') || '(no cause line)'});
  test.info().annotations.push({type: `notif-geometry ${scene}`, description: JSON.stringify({rect: audit.rect, share: audit.share, covers: audit.covers})});
}

/** Shoot the standing positive card (full frame + crop), audit it, report it, and pin the band's two facts. */
async function recordPositiveCard(page: Page, profile: string, scene: string): Promise<CardAudit> {
  const card = page.locator(POSITIVE).first();
  await card.waitFor({state: 'visible', timeout: 60_000});
  const box = await cardAtRest(page, POSITIVE);
  const full = await shootFull(page, profile, scene);
  const crop = await shootCrop(page, profile, scene, box);
  const audit = await auditCard(page, POSITIVE);
  report(scene, audit, [full, crop]);
  // WHAT, on both sides of the fix: the band states the viewer's own +1 M€.
  const band = card.locator('.con-notif__you');
  await expect(band, 'the positive card leads with the viewer band').toHaveCount(1);
  await expect(band).toContainText('+1');
  await expect(band).toContainText('M€');
  return audit;
}

/**
 * A SECOND frame once the console has gone quiet (the remote tile's landing, the payout's counter) — context for the
 * card frame, which is taken the moment the card stands, usually with the board scene still in flight. Bounded and
 * best-effort: the card may have left by then (its own TTL), and that is recorded, not failed.
 */
async function shootSettled(page: Page, profile: string, scene: string): Promise<void> {
  const quiet = await settle(page, {timeoutMs: 10_000}).then(() => 'quiet', (e: Error) => `not quiet (${e.message.slice(0, 160)})`);
  const cardStill = await page.locator(POSITIVE).count();
  const file = await shootFull(page, profile, `${scene}-settled`);
  console.log(`[tr59] ${scene} · ${PREFIX} · settled frame (${quiet}; positive card still on screen: ${cardStill}): ${file}`);
}

/**
 * THE AFTER CONTRACT (TR59 — skipped for a `before` run on HEAD): the cause names the viewer's TILE and the actor's
 * move as a tail; the card answers at ONE GLANCE — the actor named once, no «Марс» cluster, no bot bookkeeping under
 * the band; it stands in the CENTRAL OPENING (never over the strategy rail); on the TV every zone at or above the
 * couch's type floor; the visible card never changes in place.
 */
async function expectAfterContract(page: Page, profile: string, audit: CardAudit, expected: {actor: RegExp, via: RegExp}): Promise<void> {
  if (PREFIX === 'before') {
    return;
  }
  const card = page.locator(POSITIVE).first();
  const why = card.locator('.con-notif__why');
  await expect(why.locator('.con-notif__cause-label'), 'the anchor names what of YOURS paid').toHaveText(/ВАШ ТАЙЛ|Your tile/i);
  await expect(why.locator('.con-notif__card'), 'the tile\'s card is the name').toHaveText(/Закрытая зона|Restricted Area/);
  await expect(why.locator('.con-notif__cause-trigger')).toHaveText(/за город рядом|for a city next to it/i);
  await expect(why.locator('[data-notif-via]'), 'the actor\'s move is only the tail').toHaveText(expected.via);
  // ONE ACTOR STATEMENT — the head's chip, nowhere else.
  const actorHits = (audit.text.match(new RegExp(expected.actor.source, 'gi')) ?? []).length;
  expect(actorHits, `the actor is named once on «${audit.text}»`).toBe(1);
  expect(await card.locator('[data-notif-cluster="planet"]').count(), 'no «Марс» cluster (the HUD shows it)').toBe(0);
  expect(await card.locator('.con-notif__summary-line').count(), 'no bot bookkeeping under the band').toBe(0);
  // DECISION 7 — the corner of the central opening: the strategy rail is never covered.
  const strat = audit.covers.find((c) => c.member === '.con-strat');
  expect(strat?.overlap ?? 0, `the card stands clear of the strategy rail (${JSON.stringify(audit.covers)})`).toBeLessThan(0.01);
  // THE COUCH'S TYPE FLOOR — computed, every text-bearing element of the card (the static guard only sees sizes the
  // TV stylesheet declares; the card's own base sizes were invisible to it).
  if (profile === 'tv4k') {
    expect(audit.floor.below, `every zone at or above the TV floor (${audit.floor.floorPx}px)`).toEqual([]);
  }
  // ITERATION 3 — the visible card never changes in place.
  const log = await cardLog(page);
  const entry = log[audit.id];
  expect(entry?.firstText, 'the card was logged from its first frame').toBeTruthy();
  expect(entry?.text, 'the text the card was born with is the text it keeps').toBe(entry?.firstText);
}

/** Await THIS seat's action menu (an `or` whose options include the standard projects — structural, never a title). */
async function awaitActionMenu(request: APIRequestContext, playerId: string): Promise<NonNullable<Wire['waitingFor']>> {
  await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type, {timeout: 30_000}).toBe('or');
  return (await wireOf(request, playerId)).waitingFor!;
}

/** The rival builds a CITY by standard project on `spaceId` — the real `player/input`, two answers. */
async function rivalBuildsCityOn(request: APIRequestContext, rivalId: string, spaceId: string): Promise<void> {
  const menu = await awaitActionMenu(request, rivalId);
  const idx = (menu.options ?? []).findIndex((o) => o.type === 'projectCard' && (o.cards ?? []).some((c) => c.name === 'City'));
  expect(idx, `the menu offers standard projects (options: ${(menu.options ?? []).map((o) => `${o.type}:${optionTitle(o)}`).join(' | ')})`).toBeGreaterThanOrEqual(0);
  const city = (menu.options?.[idx].cards ?? []).find((c) => c.name === 'City');
  await sendPlayerInput(request, rivalId, {
    type: 'or', index: idx,
    response: {type: 'projectCard', card: 'City', payment: {...NO_PAYMENT, megacredits: city?.calculatedCost ?? 25}},
  });
  await expect.poll(async () => (await wireOf(request, rivalId)).waitingFor?.type, {timeout: 20_000}).toBe('space');
  const legal = (await wireOf(request, rivalId)).waitingFor?.spaces ?? [];
  expect(legal, `the city cell ${spaceId} beside the viewer's tile is legal`).toContain(spaceId);
  await sendPlayerInput(request, rivalId, {type: 'space', spaceId});
}

/** The tile standing on a cell, by the viewer's own model. */
async function tileOn(request: APIRequestContext, playerId: string, spaceId: string): Promise<{tileType?: number, color?: string}> {
  const space = (await wireOf(request, playerId)).game.spaces?.find((s) => s.id === spaceId);
  return {tileType: space?.tileType, color: space?.color};
}

for (const profile of PROFILES) {
  test.describe(`TR59 · the source of a payout on the viewer's Ares tile · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});

    test(`A · a human rival's city beside the viewer's Restricted Area (${profile.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId: viewer, seats} = await bootFixtureSeats(page, request, 'notification-source-ares', {query: profile.query});
      const rival = seats[1];
      expect(await tileOn(request, viewer, VIEWER_TILE), 'the viewer\'s Restricted Area stands on 47')
        .toEqual({tileType: TileType.RESTRICTED_AREA, color: (await wireOf(request, viewer)).thisPlayer.color});
      await settle(page, {timeoutMs: 20_000});
      await armCardLog(page);
      const before = megacreditsOf(await wireOf(request, viewer));

      // ── THE ACT: the rival's City standard project on 48, next to the viewer's tile.
      await rivalBuildsCityOn(request, rival, CITY_CELL);
      await expect.poll(async () => megacreditsOf(await wireOf(request, viewer)), {timeout: 20_000, message: 'the server paid the tile owner 1 M€'})
        .toBe(before + 1);

      // ── THE CARD the viewer reads.
      const audit = await recordPositiveCard(page, profile.id, 'a-ares-human');
      await expectAfterContract(page, profile.id, audit, {actor: /player2/, via: /ход: Город|move: City/i});
      await shootSettled(page, profile.id, 'a-ares-human');
      console.log(`[tr59] a-ares-human · ${PREFIX} · every card shown: ${JSON.stringify(await cardLog(page), null, 1)}`);
    });

    test(`B · MarsBot's city beside the viewer's Restricted Area (${profile.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId: viewer} = await bootFixtureSeats(page, request, 'notification-source-ares-bot', {query: profile.query});
      expect(await tileOn(request, viewer, VIEWER_TILE), 'the viewer\'s Restricted Area stands on 47')
        .toEqual({tileType: TileType.RESTRICTED_AREA, color: (await wireOf(request, viewer)).thisPlayer.color});
      expect((await tileOn(request, viewer, CITY_CELL)).tileType, '48 is still free').toBeUndefined();
      await settle(page, {timeoutMs: 20_000});
      await armCardLog(page);

      // ── THE ACT: the viewer passes on the LT wheel (the real player's road — an API pass would leave the open
      //    page on a stale prompt); the bot's B05 then lands its city on 48.
      const confirm = page.locator('.con-confirm[data-motion-surface="confirm"][data-confirm-kind="pass"]');
      expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}),
        'the basic-actions wheel opens').toBe(true);
      expect(await pressUntil(page, 'ArrowDown', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}),
        'the pass confirm stands').toBe(true);
      expect(await pressUntil(page, 'Enter', async () => await confirm.count() === 0, {tries: 3, settleMs: 1200}),
        'A answers the pass').toBe(true);
      await expect.poll(async () => tileOn(request, viewer, CITY_CELL), {timeout: 45_000, message: 'the bot\'s city stands on 48'})
        .toMatchObject({tileType: TileType.CITY});

      // ── THE CARD the viewer reads.
      const audit = await recordPositiveCard(page, profile.id, 'b-ares-bot');
      await expectAfterContract(page, profile.id, audit, {actor: /Бот|MarsBot/, via: /ход: Ускоренное строительство|move: Expedited Construction/i});
      await shootSettled(page, profile.id, 'b-ares-bot');
      console.log(`[tr59] b-ares-bot · ${PREFIX} · every card shown: ${JSON.stringify(await cardLog(page), null, 1)}`);
    });

    test(`A2 · «Только моё»: the same payout, nothing but the answer (${profile.id})`, async ({page, request}) => {
      test.skip(PREFIX === 'before', 'the content setting is TR59\'s own');
      test.setTimeout(240_000);
      await page.addInitScript(() => window.localStorage.setItem('tm_notification_content', 'mine'));
      const {playerId: viewer, seats} = await bootFixtureSeats(page, request, 'notification-source-ares', {query: profile.query});
      await settle(page, {timeoutMs: 20_000});
      await armCardLog(page);
      const before = megacreditsOf(await wireOf(request, viewer));
      await rivalBuildsCityOn(request, seats[1], CITY_CELL);
      await expect.poll(async () => megacreditsOf(await wireOf(request, viewer)), {timeout: 20_000}).toBe(before + 1);
      const audit = await recordPositiveCard(page, profile.id, 'a2-ares-human-mine');
      const card = page.locator(POSITIVE).first();
      // The answer is untouched by any mode…
      await expect(card.locator('.con-notif__why .con-notif__cause-label')).toHaveText(/ВАШ ТАЙЛ|Your tile/i);
      await expect(card.locator('[data-notif-actor]')).toContainText('player2');
      // …and nothing else rides it: no actor line, no third player.
      expect(await card.locator('.con-notif__clusters').count(), `no actor line in «Только моё» («${audit.text}»)`).toBe(0);
    });
  });
}
