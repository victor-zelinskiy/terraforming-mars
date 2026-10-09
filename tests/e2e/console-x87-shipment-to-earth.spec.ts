import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openZoomViewer, press, settle, waitForBoardHome,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * X87 «ПОСТАВКА НА ЗЕМЛЮ» — THE PRICE A PLAY TAKES OFF THE RAIL IS A DEPARTURE
 * (PL-107: the rail-spend law, PL-099 / PL-104, at the play door —
 * `consolePlayedHero.ts` § the shipment beat; `consoleActionCommit.playSpendReward`).
 * The first EVENT whose effect takes TWO resources off the rail. Two profiles,
 * the TV first:
 *
 *   1. «Карты в руке» with two steel: the verdict bar names the ONE blocker
 *      («Недостаточно стали · Сейчас: 2»); X — the fullscreen inspect: the rules
 *      on the right with the same reason, the archive entry on the left.
 *   2. With four steel: the composer reads the whole trade before the press —
 *      the shipment FIRST (5 → 2, 4 → 1), the rating N → N + 3, the «+4» for
 *      two Earth tags; nothing sent. R3 opens the effects layer INSIDE the
 *      composer and B returns to it whole.
 *   3. A → EXACTLY ONE POST. The phrase, by ORDER (MutationObserver +
 *      setInterval — never rAF): the «−3» plant token is BORN on the plants
 *      row's digits, leaves SIDEWAYS (never above its own row's ink) and is
 *      absorbed at the printed plant icon of the card still STANDING in the
 *      composer; the plants row reads 5 on every sample before the birth and 2
 *      from the departure; the steel token the same (4 → 1); the card LIFTS only
 *      after both have been absorbed; the «+3» TR token is born on the event's
 *      face-down pile after the landing, the rating N on every sample until its
 *      touchdown; the «+4» M€ after; the M€ row reads mc0 → mc0 − 17 (the
 *      landing) → mc0 − 13. The beat names itself `flown`; nothing degrades.
 *   4. The journal: one entry for the card, its chips reading the shipment and
 *      the pay-back. The board: no workspace, nothing stranded, no
 *      `[console-overflow]`, no page error; the server: 2 plants, 1 steel,
 *      N + 3, mc0 − 13.
 *
 * Fixture `shipment-to-earth` (tests/e2e/fixtures/generate.ts); the «short»
 * profile arranges the serialized steel down to 2 at boot. Storyboard with
 * `TM_E2E_STORYBOARD=1` (a CDP screencast — the compositor's own frames).
 * Heavy 4K: run with `--workers=1`.
 */

const CARD = 'Shipment to Earth';
const RU_NAME = 'Поставка на Землю';
const PRICE = 17;
const OUT = path.resolve('screenshots', 'x87-shipment-to-earth');

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
] as const;

type Wire = {
  thisPlayer: {color: string, megacredits: number, plants: number, steel: number, terraformRating: number},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
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

/** The hand verdict bar's current card name + its reason lines. */
async function handVerdict(page: Page) {
  return await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('.con-hand__verdictbar');
    return {
      name: (bar?.querySelector<HTMLElement>('.con-cards__verdict-name')?.innerText ?? '').trim(),
      blocked: bar?.classList.contains('con-hand__verdictbar--blocked') ?? false,
      ok: bar?.classList.contains('con-hand__verdictbar--ok') ?? false,
      reasons: Array.from(bar?.querySelectorAll<HTMLElement>('.con-hand__reason--bar') ?? [])
        .map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
    };
  });
}

/** RT → «КАРТЫ» → the card focused in the album. */
async function openHandOn(page: Page, card: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

/** …and A: the play composer of `card`, nothing sent. */
async function openPlayComposerOf(page: Page, card: string): Promise<void> {
  await openHandOn(page, card);
  for (let i = 0; i < 3 && await page.locator(composer).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(composer), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

type Rect = {l: number, t: number, r: number, b: number};
/** One flying token: its centre, its size and its KIND with its signed amount (`plants−3` · `tr+3` · `mc+4`). */
type Chip = {x: number, y: number, w: number, h: number, v: string};
type Sample = {
  t: number, tick: boolean, ws: number, phase: string, shipment: string,
  plants: string, steel: string, mc: string, tr: string,
  chips: Array<Chip>, stranded: boolean,
  /** The INK of the plants / steel rows (where a price token is born). */
  plantsRow?: Rect, steelRow?: Rect,
  /** The printed plant / steel icons of the card STANDING in the composer (where the tokens are absorbed). */
  plantIcon?: Rect, steelIcon?: Rect,
  /** The event's face-down pile on the receiving stage (where the pay-back is born). */
  front?: Rect,
};
type Probe = {samples: Array<Sample>, ticks: number};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__x87: Probe, __conReady?: () => {playedHero: {phase: string, shipment: string}}};
    const p: Probe = {samples: [], ticks: 0};
    w.__x87 = p;
    const t0 = performance.now();
    const read = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const digits = (sel: string) => (read(sel).match(/^-?\d+/) ?? [''])[0];
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
    const printed = (needle: string): Rect | undefined => {
      const card = document.querySelector('.con-composer--play [data-zoom-handoff="play-card"] .pcard');
      const icon = Array.from(card?.querySelectorAll<HTMLElement>('.pcard-ic') ?? []).find((el) => el.style.backgroundImage.includes(needle));
      return icon !== undefined && shown(icon) ? rect(icon) : undefined;
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
      let phase = '';
      let shipment = '';
      try {
        const ready = w.__conReady?.();
        phase = ready?.playedHero.phase ?? '';
        shipment = ready?.playedHero.shipment ?? '';
      } catch {
        // the readiness snapshot is diagnostics — never a reason to stop sampling
      }
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        tick,
        ws: document.querySelectorAll('.con-ws').length,
        phase, shipment,
        plants: digits('.con-res .con-res__row--plants .con-res__digits'),
        steel: digits('.con-res .con-res__row--steel .con-res__digits'),
        mc: digits('.con-res .con-res__row--megacredits .con-res__digits'),
        tr: read('.con-res .con-score__value--tr'),
        chips,
        stranded: document.querySelector('.con-stranded') !== null,
        plantsRow: rect(document.querySelector('.con-res .con-res__row--plants .con-res__digits')),
        steelRow: rect(document.querySelector('.con-res .con-res__row--steel .con-res__digits')),
        plantIcon: printed('plant.'),
        steelIcon: printed('steel.'),
        front: rect(document.querySelector('.con-recv [data-recv-front]')),
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

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__x87: Probe}).__x87);

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

/** The last sample index in which a chip of kind `v` is seen, from `from` on. */
function lastSeen(samples: ReadonlyArray<Sample>, v: string, from: number): number {
  let at = -1;
  samples.forEach((s, i) => {
    if (i >= from && s.chips.some((c) => c.v === v)) {
      at = i;
    }
  });
  return at;
}

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 260).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} ws=${s.ws} ph=${s.phase} sh=${s.shipment} pl=${s.plants} st=${s.steel} mc=${s.mc} tr=${s.tr}` +
    ` plRow=${s.plantsRow === undefined ? '-' : `${s.plantsRow.l},${s.plantsRow.t},${s.plantsRow.r},${s.plantsRow.b}`}` +
    ` plIcon=${s.plantIcon === undefined ? '-' : `${s.plantIcon.l},${s.plantIcon.t}`} stIcon=${s.steelIcon === undefined ? '-' : `${s.steelIcon.l},${s.steelIcon.t}`}` +
    ` front=${s.front === undefined ? '-' : `${s.front.l},${s.front.t}`} chips=${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}`).join('\n');
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

/**
 * ONE PRICE TOKEN's whole departure: born on its row's ink, never above that ink on the way (PL-104 — it leaves
 * sideways), absorbed at the standing card's printed icon of that resource (PL-099 — the price goes INTO the
 * card); the row reads `before` on every sample until the birth and `after` from the departure on; the whole
 * token is absorbed while the card still STANDS (the scene's phase is still the shipment's).
 */
function expectDeparture(
  samples: ReadonlyArray<Sample>, kind: string, amount: number, before: number, after: number,
  row: (s: Sample) => Rect | undefined, icon: (s: Sample) => Rect | undefined, readout: (s: Sample) => string,
): {born: number, gone: number} {
  const v = `${kind}−${amount}`;
  const token = births(samples).find((b) => b.chip.v === v);
  expect(token, `a «−${amount}» ${kind} token was born — births: ${births(samples).map((b) => b.chip.v).join(', ')}`).toBeDefined();
  const bornAt = samples[token!.at];
  const rowRect = row(bornAt);
  expect(rowRect, `the ${kind} row's ink is measurable where the token is born`).toBeDefined();
  expect(inside(token!.chip, rowRect!, Math.max(token!.chip.w, token!.chip.h) / 2), `the ${kind} token is BORN on the row's digits — ${JSON.stringify(token!.chip)} vs ${JSON.stringify(rowRect)}`).toBe(true);
  // Never above its own row's ink on the way (the side launch).
  const climbs = samples.slice(token!.at).flatMap((s) => s.chips.filter((c) => c.v === v).filter((c) => c.y < (row(s) ?? rowRect!).t - c.h / 4).map((c) => `${s.t}:${c.y}`));
  expect(climbs, `the ${kind} token never rose above its row's ink — it did at ${climbs.join(', ')}`).toEqual([]);
  const gone = lastSeen(samples, v, token!.at);
  const last = samples[gone].chips.find((c) => c.v === v)!;
  const iconRect = icon(samples[gone]) ?? icon(bornAt);
  expect(iconRect, `the standing card prints its ${kind} icon while the token is absorbed`).toBeDefined();
  expect(inside(last, iconRect!, Math.max(last.w, last.h)), `the ${kind} token is absorbed at the printed ${kind} icon — last seen ${JSON.stringify(last)} vs ${JSON.stringify(iconRect)}`).toBe(true);
  // The row: `before` on every sample until the birth, `after` from the departure on — never a third value.
  const early = samples.slice(0, token!.at).map(readout).filter((r) => r !== '' && r !== String(before));
  expect(early, `the ${kind} row read ${before} on every sample before the token was born — it read ${[...new Set(early)].join(', ')}`).toEqual([]);
  const ticked = samples.findIndex((s, i) => i >= token!.at && readout(s) === String(after));
  expect(ticked, `the ${kind} row ticked ${before} → ${after} at the departure`).toBeGreaterThanOrEqual(token!.at);
  expect(ticked, `…and no later than the token's absorption`).toBeLessThanOrEqual(gone + 1);
  const values = [...new Set(samples.map(readout).filter((r) => r !== ''))];
  expect(values, `the ${kind} row read exactly two values`).toEqual([String(before), String(after)]);
  // The card stands for the whole departure: the scene has not lifted it.
  const lifted = samples.findIndex((s) => s.phase === 'lifting' || s.phase === 'flying' || s.phase === 'landing');
  expect(lifted, 'the card lifted only after the shipment was absorbed').toBeGreaterThan(gone);
  return {born: token!.at, gone};
}

for (const preset of PRESETS) {
  test.describe(`X87 Shipment to Earth · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('the hand names the one blocker (two steel) and the fullscreen inspect reads rules right, archive left', async ({page, request}) => {
      test.setTimeout(240_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'shipment-to-earth', {
        query: preset.query,
        arrange: (serialized) => {
          const players = serialized.players as Array<{steel: number}>;
          players[0].steel = 2;
        },
      });
      await settle(page);
      const wire = await wireOf(request, playerId);
      expect(wire.thisPlayer.steel, 'the arranged seat: two steel').toBe(2);
      expect(wire.thisPlayer.plants, 'the fixture: five plants').toBe(5);

      await openHandOn(page, CARD);
      await settle(page);
      const verdict = await handVerdict(page);
      expect(verdict.name.toLowerCase(), 'the card is focused').toBe(RU_NAME.toLowerCase());
      expect(verdict.blocked, `the verdict bar reads BLOCKED — ${JSON.stringify(verdict)}`).toBe(true);
      expect(verdict.reasons.length, 'ONE blocker is named (plants are there — steel is the reason)').toBe(1);
      expect(verdict.reasons[0], 'the steel reason with the current count').toMatch(/Недостаточно стали/);
      expect(verdict.reasons[0]).toMatch(/\b2\b/);
      expect(verdict.reasons[0], 'never the plants (they are there)').not.toMatch(/растени/i);
      // The compact blocker chip over the card's art NAMES the resource (PL-108) — never a bare «Ресурс».
      const chip = await page.evaluate((card) =>
        (document.querySelector(`.con-hand [data-zoom-slot="${card}"] .con-hand__chip`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), CARD);
      expect(chip, 'the blocker chip names the steel').toBe('Недостаточно стали');
      await shoot(page, preset.id, '01-hand-short-steel');

      // X — the fullscreen inspect: the rules and the SAME reason on the right, the archive entry on the left.
      await openZoomViewer(page, 'KeyX');
      await settle(page); // the open flight + the settle nonce — the viewer's content is read once the screen is quiet
      const zoom = await page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('dialog.con-zoom[open]');
        const avail = dialog?.querySelector<HTMLElement>('.con-zoom-sidecol .con-cardavail--panel');
        return {
          text: (dialog?.innerText ?? '').replace(/\s+/g, ' ').trim(),
          reasons: Array.from(avail?.querySelectorAll<HTMLElement>('.con-cardavail__reason .con-cardavail__text') ?? []).map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
        };
      });
      expect(zoom.text, 'the archive entry stands beside the card').toContain('ЗАПИСЬ ИЗ АРХИВА');
      expect(zoom.text, 'the lore is the owner\'s line').toContain('Смягчение временного дефицита');
      expect(zoom.text, 'the three rule blocks').toContain('Потеряйте 3 растения и 3 стали');
      expect(zoom.text).toContain('Повысьте свой РТ на 3');
      expect(zoom.text).toContain('Получите 2 M€ за каждую свою метку Земли');
      expect(zoom.reasons.join(' | '), 'the availability panel names the same steel reason').toMatch(/Недостаточно стали/);
      await shoot(page, preset.id, '02-inspect');
      await closeZoomViewer(page);
      for (let i = 0; i < 3 && await page.locator('.con-hand').count() > 0; i++) {
        await press(page, 'Escape', 700);
      }
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
    });

    test('the composer reads the trade; A → the shipment leaves the rail INTO the standing card, then the card goes, then it pays back', async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'shipment-to-earth', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const N = before.thisPlayer.terraformRating;
      const mc0 = before.thisPlayer.megacredits;
      expect(mc0, 'the fixture: 30 M€').toBe(30);
      expect(before.thisPlayer.plants).toBe(5);
      expect(before.thisPlayer.steel).toBe(4);
      const inHand = before.cardsInHand?.find((h) => h.name === CARD);
      expect(inHand, `the fixture: «${CARD}» in hand`).toBeDefined();
      expect(inHand!.calculatedCost, 'the printed price — no discount at this table').toBe(PRICE);

      // ── 1. The composer: the whole trade before the press, the shipment first.
      await openPlayComposerOf(page, CARD);
      const reading = await text(page, composer);
      expect(reading, `the plants 5 → 2 — got «${reading.slice(0, 500)}»`).toMatch(/5\s*→\s*2/);
      expect(reading, 'the steel 4 → 1').toMatch(/4\s*→\s*1/);
      expect(reading, `the rating ${N} → ${N + 3}`).toMatch(new RegExp(`${N}\\s*→\\s*${N + 3}`));
      // The M€ chip reads the pool (`current → resulting`) with its BASIS — the two Earth tags it counted.
      expect(reading, `the M€ ${mc0} → ${mc0 + 4} for two Earth tags`).toMatch(new RegExp(`${mc0}\\s*→\\s*${mc0 + 4}`));
      expect(reading, 'the basis names the tags').toMatch(/Ваши метки/);
      expect(reading.search(/5\s*→\s*2/), 'the shipment reads BEFORE the rating').toBeLessThan(reading.search(new RegExp(`${N}\\s*→\\s*${N + 3}`)));
      expect(reading, 'nothing at the table answers this play (a calm corporation)').not.toMatch(/Сработает/);
      expect(seen.posts, 'nothing sent before A').toEqual([]);
      await shoot(page, preset.id, '03-composer');
      // (No «⚡ Сработает» group and no R3 door at this table: the shipment is a loss — nothing in a tableau
      // reacts to one — and CrediCor answers nothing. The forecast is the TABLE's answer; a plain loss is the card's own.)

      // ── 2–3. A → one POST → the shipment beat, the landing, the pay-back.
      await armProbe(page);
      const stop = await storyboard(page, preset.id, 'play');
      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.terraformRating, {timeout: 30_000, message: 'the server paid the TR'}).toBe(N + 3);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 60_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const probe = await readProbe(page);
      const samples = probe.samples;
      const log = `[${preset.id}] ${CARD} N=${N} mc0=${mc0}\n${trail(samples)}`;
      fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
      fs.writeFileSync(path.join(OUT, preset.id, 'play-trail.txt'), log);
      console.log(log);
      expect(probe.ticks, 'the probe was alive').toBeGreaterThan(10);
      expect(seen.posts.length, 'A sent EXACTLY ONE request').toBe(1);

      // The shipment: the plants, then the steel — each off its row's digits, sideways, into the printed icon.
      const plants = expectDeparture(samples, 'plants', 3, 5, 2, (s) => s.plantsRow, (s) => s.plantIcon, (s) => s.plants);
      const steel = expectDeparture(samples, 'steel', 3, 4, 1, (s) => s.steelRow, (s) => s.steelIcon, (s) => s.steel);
      expect(steel.born, 'the steel leaves no earlier than the plants (the printed order)').toBeGreaterThanOrEqual(plants.born);
      expect(samples.some((s) => s.phase === 'shipping'), 'the scene published its shipment phase').toBe(true);

      // The pay-back: the TR token is born on the event's face-down pile AFTER the landing, the rating on its touchdown.
      const born = births(samples);
      const token = born.find((b) => b.chip.v === 'tr+3');
      expect(token, `a TR token «+3» was born — births: ${born.map((b) => b.chip.v).join(', ')}`).toBeDefined();
      expect(token!.at, 'the TR is born after the shipment was absorbed').toBeGreaterThan(steel.gone);
      const at = samples[token!.at];
      expect(at.front, 'the event\'s pile stands where the token is born').toBeDefined();
      expect(inside(token!.chip, at.front!, 2), `the TR is born on the face-down pile — ${JSON.stringify(token!.chip)} vs ${JSON.stringify(at.front)}`).toBe(true);
      const trUp = samples.findIndex((s) => s.tr === String(N + 3));
      expect(trUp, 'the rating ticked after the token was born').toBeGreaterThan(token!.at);
      expect(samples.slice(0, trUp).every((s) => s.tr === String(N)), `the rating read ${N} on every sample before the touchdown — it read ${[...new Set(samples.slice(0, trUp).map((s) => s.tr))].join(', ')}`).toBe(true);
      const mcToken = born.find((b) => b.chip.v === 'mc+4');
      expect(mcToken, `an M€ token «+4» was born — births: ${born.map((b) => b.chip.v).join(', ')}`).toBeDefined();
      expect(mcToken!.at, 'the M€ are born after the shipment').toBeGreaterThan(steel.gone);
      // The M€ row: the price ticks with the landing, the Earth tags' pay-back on its touchdown — three values.
      const mcValues = samples.map((s) => s.mc).filter((v, i, a) => v !== '' && (i === 0 || v !== a[i - 1]));
      expect(mcValues, `the M€ row read ${mc0} → ${mc0 - PRICE} → ${mc0 - PRICE + 4} — it read ${mcValues.join(' → ')}`).toEqual([String(mc0), String(mc0 - PRICE), String(mc0 - PRICE + 4)]);
      const priced = samples.findIndex((s) => s.mc === String(mc0 - PRICE));
      expect(priced, 'the price ticked after the shipment had left').toBeGreaterThan(steel.gone);
      const highest = Math.min(...samples.flatMap((s) => s.chips).map((ch) => ch.y - ch.h / 2));
      expect(highest, `no token above the screen — top edge reached y = ${highest}`).toBeGreaterThanOrEqual(0);
      const ready = await page.evaluate(() => (window as unknown as {__conReady: () => {
        playedHero: {phase: string, shipment: string},
        railReward: {degraded?: {key: string, why: string, detail?: string}, pending: Array<unknown>},
      }}).__conReady());
      expect(ready.playedHero.shipment, 'the shipment beat names its ending: flown').toBe('flown');
      expect(ready.railReward.degraded?.key, `no degradation was named — ${JSON.stringify(ready.railReward.degraded)}`).not.toBe(`played-hero:${CARD}`);
      expect(ready.railReward.pending, 'nothing is left held on the rail').toEqual([]);

      // ── 4. The journal: one entry for the card, the shipment and the pay-back as chips.
      await waitForBoardHome(page);
      await press(page, 'KeyR', 1400);
      await expect(page.locator('.con-journal'), 'the journal opened').toBeVisible({timeout: 10_000});
      await settle(page); // the panel's entry rows are built on its own open
      const entry = await page.evaluate((ru) => {
        // A card play is a GROUP: the root line («сыграл …») and its child rows — the card's own chips, the payment.
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('.con-journal .journal-group'));
        const mine = nodes.find((n) => (n.innerText ?? '').includes(ru));
        return mine === undefined ? undefined : mine.innerText.replace(/\s+/g, ' ').trim();
      }, RU_NAME);
      expect(entry, 'the journal holds an entry for the card').toBeDefined();
      // The card's own row: the shipment's two losses, then what the card pays back — four chips, signed.
      expect(entry, `the entry's chips read the shipment and the pay-back — got «${entry}»`).toMatch(/−3[^−+]*−3[^−+]*\+4[^−+]*\+3/);
      expect(entry, 'the price is its own row').toMatch(/−17/);
      await shoot(page, preset.id, '05-journal');
      for (let i = 0; i < 3 && await page.locator('.con-journal').count() > 0; i++) {
        await press(page, 'Escape', 800);
      }

      // The board, the server.
      await waitForBoardHome(page);
      await shoot(page, preset.id, '06-board');
      expect(await page.locator('.con-ws').count(), 'no workspace').toBe(0);
      expect(samples.some((s) => s.stranded), 'nothing stranded on the way').toBe(false);
      expect(await strandedReports(page), 'no prompt was stranded').toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
      expect(seen.errors, `no page error — ${seen.errors.join(' | ')}`).toEqual([]);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.plants, 'three plants shipped').toBe(2);
      expect(after.thisPlayer.steel, 'three steel shipped').toBe(1);
      expect(after.thisPlayer.terraformRating, '+3 TR').toBe(N + 3);
      expect(after.thisPlayer.megacredits, 'the price and the two Earth tags\' 4 M€').toBe(mc0 - PRICE + 4);
    });
  });
}
