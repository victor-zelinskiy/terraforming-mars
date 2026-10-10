import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, press, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR38 «БИОЛОГИЧЕСКИЕ СИМУЛЯЦИИ» — the set's first Greens' plate, a data
 * holder with a TWO-TAG trigger and an action that buys PLANT PRODUCTION.
 * What is new here is not the card but two CLASSES it carries first, end to
 * end against a real server on two profiles, a second client watching:
 *
 *   (A) THE TABLE'S ANSWER TO A PLAY FLIES (К-S1). «Карты в руке» → Tardigrades
 *       → its composer names the answer before the press («Сработает: +1
 *       [data]»); A → EXACTLY ONE POST; in the landing scene the HOLDER (TR38)
 *       EMERGES from its strip, a «+1 data» token is BORN on the PRINTED
 *       MICROBE TAG of the landed card — the tag that woke the holder — and
 *       flies into the holder's capsule; the capsule and the ДОП. РЕСУРСЫ
 *       satellite read 2 on every sample until the TOUCHDOWN and 3 after it;
 *       the holder settles back; the flow leaves. The server agrees: 3 data,
 *       the hand one card shorter.
 *   (B) A PRODUCTION ANSWER AFTER AN ACTION. «Действия карт» → TR38 → the
 *       composer names the Greens' answer («Сработает: +1 [M€ production]»);
 *       A → the ACTION COMMIT: the «−2» leaves the hero's CAPSULE into a
 *       printed data icon (the capsule ticks 2 → 0 on the departure, never
 *       before); the «+1» plant-production token is born INSIDE the printed
 *       production box and lands on the plants row's plate — the plate ticks
 *       on the touchdown; the Greens' «+1 M€ production» ticks IN PLACE a
 *       beat AFTER that touchdown (`TOUCHDOWN_TICK_GAP_MS`), never with the
 *       price, never before, never as a flown token of its own. The server
 *       agrees: 0 data, plant production 1, M€ production 1. Red is told.
 *
 * Fixture `biological-simulations` (tests/e2e/fixtures/generate.ts): blue's
 * action phase, the Greens ruling by the STARTING RULE, TR38 on blue's table
 * with 2 data, Tardigrades in hand, 30 M€; red at Thorgate (no first action).
 * Heavy 4K: run with `--workers=1`.
 */

const CARD = 'Biological Simulations';
const CARD_RU = 'Биологические симуляции';
const TRIGGER = 'Tardigrades';
const TRIGGER_RU = 'Тихоходки';
const OUT = path.resolve('screenshots', 'biological-simulations');

/** The table's answer ticks one beat after the cause's last touchdown (`resourceTransferModel.TOUCHDOWN_TICK_GAP_MS`). */
const TOUCHDOWN_TICK_GAP_MS = 90;

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const PLAY_COMPOSER = '.con-composer--play';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const HERO = '.con-composer__actcardwrap';
const AUX_DATA = '.con-res-aux__cell[data-exr-type="data"] .con-res-aux__value';
const PLANT_PROD = '.con-res__row--plants .con-res__prod';
const MC_PROD = '.con-res__row--megacredits .con-res__prod';

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {
    color: string, megacredits: number, plantProduction: number, megacreditProduction: number, cardsInHandNbr: number,
    tableau: Array<{name: string, resources?: number}>,
  };
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

function dataOf(wire: Wire): number {
  return wire.thisPlayer.tableau.find((c) => c.name === CARD)?.resources ?? -1;
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

type Rect = {l: number, t: number, r: number, b: number};
/** One flying token: its centre, its size and its KIND (`prod:<res>` · `mc` · `<res>`) with its amount. */
type Chip = {x: number, y: number, w: number, v: string};
type Sample = {
  t: number, tick: boolean, ws: number, chips: Array<Chip>, beats: Array<{x: number, y: number}>, stranded: boolean,
  /** The holder EMERGED forward in the landing scene: its box, its capsule and the capsule's count. */
  emerge?: Rect, emergeCap?: Rect, emergeCount: string,
  /** The landing scene's FRONT card and the zone it is composed in (PL-126: the protagonist is a third of the zone). */
  front?: Rect, recv?: Rect,
  /** The landed card's printed MICROBE tag (the front card of the receiving stage). */
  tag?: Rect,
  /** The ДОП. РЕСУРСЫ satellite's data cell. */
  aux: string,
  /** The action composer's hero: its capsule box and count, its printed production box. */
  cap?: Rect, capCount: string, prodBox?: Rect,
  /** The rail's production plates. */
  plantProd: string, mcProd: string, plantProdBox?: Rect, mcProdBox?: Rect,
};
type Probe = {samples: Array<Sample>};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({card, hero, auxSel, plantSel, mcSel}) => {
    const w = window as unknown as {__tr38: Probe};
    const p: Probe = {samples: []};
    w.__tr38 = p;
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
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card;
    const kindOf = (el: HTMLElement): string => {
      // A standard resource is the panel's sprite (`resource_icon--plants`); a card resource the global
      // `card-resource-<key>` class (`iconClassFor`).
      const icon = el.querySelector('.con-transfer__icon')?.className ?? '';
      const res = (icon.match(/resource_icon--([a-z]+)/) ?? icon.match(/card-resource-([a-z-]+)/) ?? ['', ''])[1];
      if (el.classList.contains('con-transfer__chip--mc')) {
        return 'mc';
      }
      return el.classList.contains('con-transfer__chip--production') ? `prod:${res}` : res;
    };
    const sample = (tick: boolean) => {
      if (p.samples.length > 9000) {
        return;
      }
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter(shown).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: Math.round((r.left + r.width / 2) * 10) / 10, y: Math.round((r.top + r.height / 2) * 10) / 10, w: Math.round(r.width),
          v: `${kindOf(el)}${(el.querySelector('.con-transfer__amt')?.textContent ?? el.textContent ?? '').replace(/\s+/g, '')}`,
        };
      });
      const beats = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__beat')).filter(shown).map((el) => {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};
      });
      const emerge = document.querySelector(`.con-recv__emerge[data-played-key="${esc}"]`);
      const s: Sample = {
        t: Math.round(performance.now() - t0), tick,
        ws: document.querySelectorAll('.con-ws').length,
        chips, beats,
        stranded: document.querySelector('.con-stranded') !== null,
        emerge: rect(emerge), emergeCap: rect(emerge?.querySelector('.pcard__res')),
        emergeCount: emerge === null ? '' : (emerge.querySelector('.pcard__res-count')?.textContent ?? '').trim(),
        tag: rect(document.querySelector('.con-recv [data-recv-front] .pcard-tag[data-tag="microbe"]')),
        front: rect(document.querySelector('.con-recv [data-recv-front]')),
        recv: rect(document.querySelector('.con-recv')),
        aux: read(auxSel).match(/^\d+/)?.[0] ?? '',
        cap: rect(document.querySelector(`${hero} .pcard__res`)),
        capCount: read(`${hero} .pcard__res-count`),
        prodBox: rect(document.querySelector(`${hero} .pcard-prod`)),
        plantProd: read(plantSel).match(/^[-+]?\d+/)?.[0] ?? '',
        mcProd: read(mcSel).match(/^[-+]?\d+/)?.[0] ?? '',
        plantProdBox: rect(document.querySelector(plantSel)),
        mcProdBox: rect(document.querySelector(mcSel)),
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
  }, {card: CARD, hero: HERO, auxSel: AUX_DATA, plantSel: PLANT_PROD, mcSel: MC_PROD});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr38: Probe}).__tr38);

const inside = (p: {x: number, y: number}, r: Rect, slack: number) =>
  p.x >= r.l - slack && p.x <= r.r + slack && p.y >= r.t - slack && p.y <= r.b + slack;

/** The sample a chip of `v` is BORN in (its first appearance) and that chip. */
function birthOf(samples: ReadonlyArray<Sample>, v: string): {s: Sample, chip: Chip} | undefined {
  const s = samples.find((x) => x.chips.some((c) => c.v === v));
  return s === undefined ? undefined : {s, chip: s.chips.find((c) => c.v === v)!};
}

/**
 * The sample a chip of `v` RESTS in — its contact beat first appears beside it — and that chip. A beat beside the
 * chip's BIRTH point is somebody else's (a result is born exactly where its price was absorbed, under the price's own
 * contact beat): the landing is sought once the chip has travelled at least its own width.
 */
function landingOf(samples: ReadonlyArray<Sample>, v: string): {s: Sample, chip: Chip, beat: {x: number, y: number}} | undefined {
  const birth = birthOf(samples, v);
  if (birth === undefined) {
    return undefined;
  }
  for (const s of samples) {
    const chip = s.chips.find((c) => c.v === v);
    if (chip === undefined || s.beats.length === 0 || Math.hypot(chip.x - birth.chip.x, chip.y - birth.chip.y) <= chip.w) {
      continue;
    }
    const beat = s.beats.find((b) => Math.hypot(b.x - chip.x, b.y - chip.y) <= chip.w);
    if (beat !== undefined) {
      return {s, chip, beat};
    }
  }
  return undefined;
}

/** The first sample whose `field` reads `value`. */
function firstReading(samples: ReadonlyArray<Sample>, field: 'aux' | 'emergeCount' | 'capCount' | 'plantProd' | 'mcProd', value: string): Sample | undefined {
  return samples.find((s) => s[field] === value);
}

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 220).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} ws=${s.ws} aux=${s.aux} em=${s.emerge === undefined ? '-' : `${s.emerge.l},${s.emerge.t}/${s.emergeCount}`} tag=${s.tag === undefined ? '-' : `${s.tag.l},${s.tag.t}`} cap=${s.capCount} pp=${s.plantProd} mp=${s.mcProd} chips=${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}${s.beats.length > 0 ? ` beats=${s.beats.map((b) => `${b.x},${b.y}`).join(' ')}` : ''}`,
  ).join('\n');
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

/** RT → «КАРТЫ» → the card → A: the play composer of `card`, nothing sent. */
async function openPlayComposerOf(page: Page, card: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000});
  // The album's ENTRY swallows the d-pad on 4K (its fit runs longer there): walk only once it stands.
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY_COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** «Действия карт» → the tile → its composer. The action centre is a GRID: a 2D walk. */
async function openActionOf(page: Page, card: string): Promise<void> {
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

/** Walk the cursor to the commit row of the action composer. */
async function readyToCommit(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

/** The hero card's printed icons of one sprite (`'data.'`) — the absorb places of a price. */
async function heroIcons(page: Page, needle: string): Promise<Array<Rect>> {
  return await page.evaluate(([hero, n]) => {
    return Array.from(document.querySelectorAll<HTMLElement>(`${hero} .pcard-ic`))
      .filter((el) => (el.style.backgroundImage ?? '').includes(n))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {l: r.left, t: r.top, r: r.right, b: r.bottom};
      }).filter((r) => r.r - r.l > 4);
  }, [HERO, needle]);
}

/** A → one POST (a retry only while nothing was sent). */
async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
}

async function noChipsLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-transfer__chip').length), {timeout: 20_000}).toBe(0);
}

type RedNote = {at: number, text: string};
/** RED'S WITNESS: every notification card as it APPEARS. */
async function armRedProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__red: Array<RedNote>};
    const notes: Array<RedNote> = [];
    w.__red = notes;
    const t0 = Date.now();
    const seen = new Set<string>();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = () => {
      document.querySelectorAll<HTMLElement>('.con-notif').forEach((el) => {
        const id = el.getAttribute('data-notif-id') ?? text(el);
        if (seen.has(id)) {
          return;
        }
        seen.add(id);
        notes.push({at: Date.now() - t0, text: text(el)});
      });
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 50);
  });
}
const readRedProbe = (page: Page): Promise<Array<RedNote>> => page.evaluate(() => (window as unknown as {__red: Array<RedNote>}).__red);

for (const preset of PRESETS) {
  test.describe(`TR38 Biological Simulations · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) the table's answer to a PLAY flies: Tardigrades' microbe tag wakes the holder — «+1 data» from the printed tag into TR38's capsule, the holder emerging (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'biological-simulations', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(dataOf(before), 'the fixture: TR38 on the table with 2 data').toBe(2);
      expect(before.cardsInHand?.some((c) => c.name === TRIGGER), 'the fixture: Tardigrades in hand').toBe(true);
      const handBefore = before.thisPlayer.cardsInHandNbr;

      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await armRedProbe(red);
      await page.bringToFront();

      // ── 1. The composer: the table's answer named BEFORE the press; nothing sent.
      await openPlayComposerOf(page, TRIGGER);
      const row = page.locator(`${PLAY_COMPOSER} [data-forecast-row]`);
      await expect(row, 'the «Сработает» row stands').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"]'), 'the holder\'s own gain is its chip').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"] .card-resource-data'), 'the chip is a DATA chip').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"]')).toContainText('1');
      await shoot(page, preset.id, 'a-01-composer');
      expect(seen.posts, 'nothing sent before A').toEqual([]);

      // ── 2. A → ONE POST; the landing scene.
      await armProbe(page);
      const stopStory = await storyboard(page, preset.id, 'play');
      await commit(page, seen.posts);
      expect(seen.posts.length, 'A sent exactly one input').toBe(1);
      await expect.poll(() => page.evaluate((sel) => (document.querySelector(sel)?.textContent ?? '').trim(), AUX_DATA), {timeout: 40_000, message: 'the satellite reads 3'}).toMatch(/^3/);
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      await stopStory();
      const {samples} = await readProbe(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/biological-simulations-play-${preset.id}.txt`, trail(samples));
      await shoot(page, preset.id, 'a-02-board');

      // ── 3. The flight, by ORDER: the holder emerges; the token is born on the printed microbe tag; it rests on the
      //       holder's capsule; the capsule and the satellite tick on the touchdown and never before.
      const v = 'data+1';
      const birth = birthOf(samples, v);
      expect(birth, `a «+1 data» token was seen (К-S1 — the table's answer to a play FLIES)\n${trail(samples)}`).toBeDefined();
      const emergedBefore = samples.find((s) => s.emerge !== undefined && s.t <= birth!.s.t);
      expect(emergedBefore, `the holder EMERGED from its strip before its token was born\n${trail(samples)}`).toBeDefined();
      expect(birth!.s.tag, 'the landed card\'s printed microbe tag was measurable at the birth').toBeDefined();
      // PL-126 (the owner's decision 2026-10-10): THE PROTAGONIST IS A THIRD OF THE ZONE — the landed card at the
      // front of the receiving stage stands at least a third of the zone's height, on the 1080 band and on the TV
      // zone alike (the ladder once topped out at 0.68 and a 4K zone got a 230 × 330 px pile at its foot).
      expect(birth!.s.front !== undefined && birth!.s.recv !== undefined, 'the front card and the scene\'s zone were measurable at the birth').toBe(true);
      const frontH = birth!.s.front!.b - birth!.s.front!.t;
      const zoneH = birth!.s.recv!.b - birth!.s.recv!.t;
      console.log(`[PL-126] ${preset.id}: the front card ${birth!.s.front!.r - birth!.s.front!.l} × ${frontH} in a zone ${birth!.s.recv!.r - birth!.s.recv!.l} × ${zoneH} (${(frontH / zoneH * 100).toFixed(1)} % of its height)`);
      expect(frontH / zoneH, `the front card stands at least a third of the zone's height (${frontH} of ${zoneH} px, ${preset.id})`).toBeGreaterThanOrEqual(1 / 3 - 0.02);
      const tagSlack = Math.max(birth!.chip.w, (birth!.s.tag!.r - birth!.s.tag!.l)) * 0.75;
      expect(inside(birth!.chip, birth!.s.tag!, tagSlack), `the token is BORN on the printed MICROBE TAG — the tag that woke the holder: chip ${birth!.chip.x},${birth!.chip.y} (w=${birth!.chip.w}) vs tag ${JSON.stringify(birth!.s.tag)}`).toBe(true);
      const landing = landingOf(samples, v);
      expect(landing, `the token rested with its contact beat\n${trail(samples)}`).toBeDefined();
      const cap = landing!.s.emergeCap ?? landing!.s.emerge;
      expect(cap, 'the emerged holder (its capsule) was measurable at the landing').toBeDefined();
      expect(inside(landing!.chip, cap!, landing!.chip.w * 0.5), `the token rests ON the holder's capsule — chip ${landing!.chip.x},${landing!.chip.y} vs ${JSON.stringify(cap)}`).toBe(true);
      const auxThree = firstReading(samples, 'aux', '3');
      expect(auxThree, 'the satellite ticked to 3').toBeDefined();
      expect(auxThree!.t, `the satellite ticked (${auxThree!.t}) no earlier than the touchdown (${landing!.s.t})`).toBeGreaterThanOrEqual(landing!.s.t - 60);
      const auxEarly = samples.filter((s) => s.t < landing!.s.t - 60 && s.aux !== '' && s.aux !== '2').map((s) => `${s.t}:${s.aux}`);
      expect(auxEarly, 'the satellite read 2 on every sample until the touchdown').toEqual([]);
      const capThree = firstReading(samples, 'emergeCount', '3');
      expect(capThree, 'the emerged capsule ticked to 3').toBeDefined();
      expect(capThree!.t, `the capsule ticked (${capThree!.t}) no earlier than the touchdown (${landing!.s.t})`).toBeGreaterThanOrEqual(landing!.s.t - 60);
      const capEarly = samples.filter((s) => s.t < landing!.s.t - 60 && s.emergeCount !== '' && s.emergeCount !== '2').map((s) => `${s.t}:${s.emergeCount}`);
      expect(capEarly, 'the capsule read 2 on every sample until the touchdown').toEqual([]);
      const last = samples[samples.length - 1];
      expect(last.emerge, 'the holder settled back (no emergence layer at rest)').toBeUndefined();
      expect(last.ws, 'the flow left for the board').toBe(0);
      expect(samples.some((s) => s.stranded), 'nothing stranded').toBe(false);
      expect(await strandedReports(page), 'no stranded report').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(seen.overflow, 'no [console-overflow]').toEqual([]);

      // ── 4. The server; red is told.
      const after = await wireOf(request, playerId);
      expect(dataOf(after), 'TR38 holds 3 data').toBe(3);
      expect(after.thisPlayer.cardsInHandNbr, 'the hand is one card shorter').toBe(handBefore - 1);
      await red.bringToFront();
      await expect.poll(async () => (await readRedProbe(red)).some((n) => n.text.includes(TRIGGER_RU)), {timeout: 30_000, message: 'red was told of the play'}).toBe(true);
      await shoot(red, preset.id, 'a-03-red');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await red.close();
    });

    test(`(B) a PRODUCTION answer after the action: −2 off the capsule, +1 plant production born in the printed box, the Greens' +1 M€ production a beat AFTER its touchdown (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'biological-simulations', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect([dataOf(before), before.thisPlayer.plantProduction, before.thisPlayer.megacreditProduction], 'the fixture: 2 data, no plant / M€ production').toEqual([2, 0, 0]);

      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await armRedProbe(red);
      await page.bringToFront();

      // ── 1. The composer: the price, the step, the Greens' answer named before the press.
      await openActionOf(page, CARD);
      const row = page.locator(`${ACTION_COMPOSER} [data-forecast-row]`);
      await expect(row, 'the «Сработает» row names the Greens\' answer').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"]'), 'ONE own chip — the M€ production step').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"] .resource_icon--megacredits'), 'an M€ chip').toHaveCount(1);
      await readyToCommit(page);
      const dataIcons = await heroIcons(page, 'data.');
      expect(dataIcons.length, 'the hero prints its data icons (the action row and the bottom block)').toBeGreaterThanOrEqual(2);
      await shoot(page, preset.id, 'b-01-composer');
      expect(seen.posts, 'nothing sent before A').toEqual([]);
      // THE PREMIUM BAR ON THE COUCH (PL-139): on the TV profile the hero card is at least a QUARTER of the stage's
      // zone (it was 11 %), the decision column stands level with it, and the rail's rows the formula does not touch
      // are quiet while the ones it moves (plants, M€) stay lit.
      if (preset.id === 'tv4k') {
        const shares = await page.evaluate(({hero, stage}) => {
          const h = document.querySelector(hero)?.getBoundingClientRect();
          const s = document.querySelector(stage)?.getBoundingClientRect();
          const quiet = Array.from(document.querySelectorAll<HTMLElement>('.con-res__row')).map((el) => `${el.className.match(/con-res__row--(megacredits|steel|titanium|plants|energy|heat)/)?.[1]}:${el.classList.contains('con-res__row--quiet') ? 'quiet' : 'lit'}`);
          return {hero: h === undefined || s === undefined ? 0 : (h.width * h.height) / (s.width * s.height), quiet};
        }, {hero: HERO, stage: '.con-cardactions__stagewrap'});
        expect(shares.hero, `the hero card's share of the stage zone (${shares.hero.toFixed(3)}) is at least a quarter`).toBeGreaterThanOrEqual(0.25);
        expect(shares.quiet, 'the rows the formula touches stay lit, the rest recede').toEqual([
          'megacredits:lit', 'steel:quiet', 'titanium:quiet', 'plants:lit', 'energy:quiet', 'heat:quiet',
        ]);
      }

      // ── 2. A → ONE POST; the ACTION COMMIT.
      await armProbe(page);
      const stopStory = await storyboard(page, preset.id, 'action');
      await commit(page, seen.posts);
      expect(seen.posts.length, 'A sent exactly one input').toBe(1);
      await expect(page.locator(MC_PROD), 'the M€ production plate reads +1').toHaveText(/\+1/, {timeout: 40_000});
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      await stopStory();
      const {samples} = await readProbe(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/biological-simulations-action-${preset.id}.txt`, trail(samples));
      await shoot(page, preset.id, 'b-02-board');

      // ── 3. THE PRICE (PL-099 / PL-107 at the action door): «−2» born on the capsule, absorbed at a printed data icon;
      //       the capsule ticks 2 → 0 on the departure, never before.
      // The chip prints the typographic minus (U+2212) — the transfer language's own sign.
      const price = birthOf(samples, `data${'−'}2`);
      expect(price, `a «−2 data» token was born\n${trail(samples)}`).toBeDefined();
      expect(price!.s.cap, 'the hero\'s capsule was measurable at the birth').toBeDefined();
      expect(inside(price!.chip, price!.s.cap!, Math.max(price!.chip.w, price!.s.cap!.r - price!.s.cap!.l) * 0.75), `the price is BORN on the hero's capsule — ${price!.chip.x},${price!.chip.y} vs ${JSON.stringify(price!.s.cap)}`).toBe(true);
      const priceLanding = landingOf(samples, price!.chip.v);
      expect(priceLanding, 'the price rested with its contact beat').toBeDefined();
      // A CARD's spend is absorbed at the selected variant's printed RESULT (the TR29 law — «the data go INTO the
      // production box»), where its result is then born; a price OFF THE RAIL would land on the printed cost icon.
      expect(priceLanding!.s.prodBox, 'the printed production box was measurable at the absorb').toBeDefined();
      expect(inside(priceLanding!.chip, priceLanding!.s.prodBox!, priceLanding!.chip.w * 0.75), `the price is absorbed at the printed production box — ${priceLanding!.chip.x},${priceLanding!.chip.y} vs ${JSON.stringify(priceLanding!.s.prodBox)}`).toBe(true);
      const capZero = firstReading(samples, 'capCount', '0');
      expect(capZero, 'the capsule ticked to 0').toBeDefined();
      expect(capZero!.t, `the capsule ticked (${capZero!.t}) no earlier than the price's birth (${price!.s.t})`).toBeGreaterThanOrEqual(price!.s.t - 60);
      expect(capZero!.t, `the capsule ticked (${capZero!.t}) no later than the price's landing (${priceLanding!.s.t})`).toBeLessThanOrEqual(priceLanding!.s.t + 60);
      const capEarly = samples.filter((s) => s.t < price!.s.t - 60 && s.capCount !== '' && s.capCount !== '2').map((s) => `${s.t}:${s.capCount}`);
      expect(capEarly, 'the capsule read 2 until the price left').toEqual([]);

      // ── 4. THE STEP: «+1» plant production born INSIDE the printed production box, after the price has landed; lands on
      //       the plants row's plate; the plate ticks on the touchdown.
      const step = birthOf(samples, 'prod:plants+1');
      expect(step, `the «+1 plant production» token was born\n${trail(samples)}`).toBeDefined();
      expect(step!.s.t, `the step (${step!.s.t}) is born only after the price has landed (${priceLanding!.s.t})`).toBeGreaterThanOrEqual(priceLanding!.s.t - 60);
      expect(step!.s.prodBox, 'the hero\'s printed production box was measurable at the birth').toBeDefined();
      expect(inside(step!.chip, step!.s.prodBox!, step!.chip.w * 0.75), `the step is born INSIDE the printed production box — ${step!.chip.x},${step!.chip.y} vs ${JSON.stringify(step!.s.prodBox)}`).toBe(true);
      const stepLanding = landingOf(samples, 'prod:plants+1');
      expect(stepLanding, 'the step rested with its contact beat').toBeDefined();
      expect(stepLanding!.s.plantProdBox, 'the plants plate was measurable at the landing').toBeDefined();
      expect(inside(stepLanding!.chip, stepLanding!.s.plantProdBox!, stepLanding!.chip.w * 0.5), `the step rests ON the plants plate — ${stepLanding!.chip.x},${stepLanding!.chip.y} vs ${JSON.stringify(stepLanding!.s.plantProdBox)}`).toBe(true);
      const plantOne = firstReading(samples, 'plantProd', '+1');
      expect(plantOne, 'the plants plate ticked to +1').toBeDefined();
      expect(plantOne!.t, `the plate ticked (${plantOne!.t}) no earlier than the touchdown (${stepLanding!.s.t})`).toBeGreaterThanOrEqual(stepLanding!.s.t - 60);
      const plantEarly = samples.filter((s) => s.t < stepLanding!.s.t - 60 && s.plantProd !== '' && s.plantProd !== '+0' && s.plantProd !== '0').map((s) => `${s.t}:${s.plantProd}`);
      expect(plantEarly, 'the plants plate read 0 until the touchdown').toEqual([]);

      // ── 5. THE ANSWER: the Greens' «+1 M€ production» ticks IN PLACE a beat AFTER the step's touchdown — never with
      //       the price, never before the step, never as a flown token.
      const mcOne = firstReading(samples, 'mcProd', '+1');
      expect(mcOne, 'the M€ production plate ticked to +1').toBeDefined();
      expect(mcOne!.t, `the Greens' answer (${mcOne!.t}) ticks AFTER the step's touchdown (${stepLanding!.s.t}) plus the beat (${TOUCHDOWN_TICK_GAP_MS})`).toBeGreaterThanOrEqual(stepLanding!.s.t + TOUCHDOWN_TICK_GAP_MS - 60);
      expect(mcOne!.t, 'the answer ticks after the plate it answers').toBeGreaterThanOrEqual(plantOne!.t);
      const mcEarly = samples.filter((s) => s.t < stepLanding!.s.t - 60 && s.mcProd !== '' && s.mcProd !== '+0' && s.mcProd !== '0').map((s) => `${s.t}:${s.mcProd}`);
      expect(mcEarly, 'the M€ production plate read 0 until the step had landed').toEqual([]);
      expect(samples.some((s) => s.chips.some((c) => c.v.startsWith('prod:megacredits'))), 'the answer is never a flown token of its own').toBe(false);
      expect(samples.some((s) => s.stranded), 'nothing stranded').toBe(false);
      expect(await strandedReports(page), 'no stranded report').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(seen.overflow, 'no [console-overflow]').toEqual([]);

      // ── 6. The server; red is told.
      const after = await wireOf(request, playerId);
      expect([dataOf(after), after.thisPlayer.plantProduction, after.thisPlayer.megacreditProduction], 'the server: 0 data, plant production 1, M€ production 1').toEqual([0, 1, 1]);
      await red.bringToFront();
      await expect.poll(async () => (await readRedProbe(red)).some((n) => n.text.includes(CARD_RU)), {timeout: 30_000, message: 'red was told of the action'}).toBe(true);
      await shoot(red, preset.id, 'b-03-red');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await red.close();
    });
  });
}
