import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, openMandatoryAnnounce, press, pressUntil,
  settle, waitForBoardHome,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR41 «ПЛАЗМЕННЫЕ ВЕНТИЛЯТОРЫ» — the Greens' fourth plate, the set's second
 * Venus card, and ONE DECLARATION of two engine classes (Caretaker Contract's
 * price, Thermophiles' reward). What is new here is not the card but TWO
 * FLOWS it is the first to carry through a workspace, end to end against a
 * real server on two profiles, a second client watching:
 *
 *   (A) A SCALE STEP FROM A CARD ACTION. «Действия карт» → TR41 → the composer
 *       names the price («−8 heat»), the step («Venus 6 → 8 %») and the
 *       table's answers before the press (the Greens' «+2 M€», the census's
 *       «+2 data»); A → EXACTLY ONE POST; the ACTION COMMIT: the «−8» is BORN
 *       on the rail's heat digits (PL-094), leaves SIDEWAYS (PL-104) and is
 *       absorbed at the hero's printed heat icon (PL-099) — the row ticks
 *       8 → 0 on the departure, never before; the workspace LEAVES; and only
 *       then, on a board the player can see, the scale tells its story (the
 *       board-beat park): the HUD held «6%» for as long as the workspace
 *       stood, the marker glides 6 → 8 and ARRIVES before the first census
 *       token, the two data tokens are born on the marker and the data cell
 *       ticks 1 → 2 → 3 on their touchdowns, the rating reads +1 and the
 *       Greens' «+2» ticks a beat AFTER it, no fullscreen surface ever stands
 *       over the open workspace, and the 8 % cover presents over the board,
 *       after the tokens. The server agrees; red — Aphrodite — is told and
 *       paid.
 *   (B) THE PLAY THAT CLOSES THE PRINTED GENERATION-1 QUEST. «Карты в руке» →
 *       TR41 → the composer names «+3 heat production» and the Greens' «+3 M€
 *       production»; A → one POST; the landing: the production tokens are born
 *       in the printed production box and land on the heat row's plate, which
 *       ticks on the touchdowns; the Greens' plate ticks a beat after; the
 *       chairman-quest plate («Вы выполнили задание председателя») stands
 *       AFTER the landing — never over it — and A on it opens the Parliament
 *       with the office and the Agenda step played on a section that is on
 *       screen (the `console-parliament-chairman-quest` class). The server
 *       agrees: heat production 3, M€ production 3, the quest completed by
 *       blue, blue in the office, Agenda 0 → 1.
 *
 * Fixtures `plasma-fans` / `plasma-fans-play` (tests/e2e/fixtures/generate.ts).
 * Heavy 4K: run with `--workers=1`.
 */

const CARD = 'Plasma Fans';
const CENSUS = 'Venusian Census';
const OUT = path.resolve('screenshots', 'plasma-fans');

/** The table's answer ticks one beat after the cause's last touchdown (`resourceTransferModel.TOUCHDOWN_TICK_GAP_MS`). */
const TOUCHDOWN_TICK_GAP_MS = 90;

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const PLAY_COMPOSER = '.con-composer--play';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const HERO = '.con-composer__actcardwrap';
const AUX_DATA = '.con-res-aux__cell[data-aux-resource="data"] .con-res-aux__value';
const HEAT_ROW = '.con-res__row--heat';
const HEAT_DIGITS = '.con-res__row--heat .con-res__digits';
const HEAT_PROD = '.con-res__row--heat .con-res__prod';
const MC_PROD = '.con-res__row--megacredits .con-res__prod';
const MC_DIGITS = '.con-res__row--megacredits .con-res__digits';
const TR_CELL = '.con-res .con-score__value--tr';
const VENUS_STRIP = '.con-status__param--venus .con-status__value';
const VENUS_MARKER = '.scale-marker[data-scale-marker="venus"]';

type Wire = {
  cardsInHand?: Array<{name: string}>;
  waitingFor?: {type: string};
  thisPlayer: {
    color: string, megacredits: number, heat: number, terraformRating: number, heatProduction: number, megacreditProduction: number,
    cardsInHandNbr: number, actionsThisGeneration: Array<string>,
    tableau: Array<{name: string, resources?: number}>,
  };
  players: Array<{color: string, megacredits: number, terraformRating: number}>;
  game: {venusScaleLevel: number, parliament?: {chairman?: string, quest?: {completedBy?: string}}};
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

const dataOn = (wire: Wire) => wire.thisPlayer.tableau.find((c) => c.name === CENSUS)?.resources ?? -1;

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
/** One flying token: its centre, its width and its KIND (`prod:<res>` · `mc` · `tr` · `<res>`) with its amount. */
type Chip = {x: number, y: number, w: number, v: string};
type Sample = {
  t: number, tick: boolean, ws: number, chips: Array<Chip>, beats: Array<{x: number, y: number}>, stranded: boolean,
  /** The ACTION COMMIT's one-shot rings (`.con-commit-ring` — the impulse's landing on a printed icon). */
  rings: Array<Rect>,
  /** A fullscreen surface over the screen (the reveal band / the zoom viewer) and the HUD's Venus readout. */
  fullscreen: boolean, strip: string,
  /** The Venus marker's resting value (`''` while it glides) and its box. */
  marker: string, markerBox?: Rect,
  /** The scale-reward scene's tokens (born on the marker's rim) — how many have been seen so far. */
  tokens: number,
  /** The rail: the heat row's digits and box, the rating, the M€ digits, the data cell, the production plates. */
  heat: string, heatBox?: Rect, tr: string, mc: string, aux: string, heatProd: string, mcProd: string, heatProdBox?: Rect, mcProdBox?: Rect,
  /** The action composer's hero: its printed heat icon (the absorb place of the price) and its printed Venus gauge. */
  heatIcon?: Rect, venusIcon?: Rect, prodBox?: Rect,
  /** The chairman-quest plate and the Parliament section. */
  plate: boolean, parl: boolean,
};
type Probe = {samples: Array<Sample>};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({hero, heatSel, heatRowSel, trSel, mcSel, auxSel, heatProdSel, mcProdSel, stripSel, markerSel}) => {
    const w = window as unknown as {__tr41: Probe, __tr41stop?: () => void};
    w.__tr41stop?.();
    const p: Probe = {samples: []};
    w.__tr41 = p;
    const t0 = performance.now();
    const read = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: HTMLElement) => {
      let node: Element | null = el;
      let opacity = 1;
      while (node !== null) {
        const cs = getComputedStyle(node);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        opacity *= Number(cs.opacity === '' ? 1 : cs.opacity);
        node = node.parentElement;
      }
      const r = el.getBoundingClientRect();
      return r.width > 2 && opacity > 0.05;
    };
    const rect = (el: Element | null | undefined): Rect | undefined => {
      const r = el?.getBoundingClientRect();
      return r === undefined || r.width < 2 ? undefined : {l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom)};
    };
    const kindOf = (el: HTMLElement): string => {
      const icon = el.querySelector('.con-transfer__icon')?.className ?? '';
      const res = (icon.match(/resource_icon--([a-z]+)/) ?? icon.match(/card-resource-([a-z-]+)/) ?? ['', ''])[1];
      if (el.classList.contains('con-transfer__chip--mc')) {
        return 'mc';
      }
      if (res === 'rating') {
        return 'tr';
      }
      return el.classList.contains('con-transfer__chip--production') ? `prod:${res}` : res;
    };
    const heroIcon = (needle: string) => Array.from(document.querySelectorAll<HTMLElement>(`${hero} .pcard-ic`)).find((el) => (el.style.backgroundImage ?? '').includes(needle));
    const seenTokens = new Set<Element>();
    const sample = (tick: boolean) => {
      if (p.samples.length > 12000) {
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
      const rings = Array.from(document.querySelectorAll<HTMLElement>('.con-commit-ring')).map(rect).filter((r): r is Rect => r !== undefined);
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-scalepay__token'))) {
        if (!seenTokens.has(el) && shown((el.querySelector('.con-tileplace__coin-body') as HTMLElement | null) ?? el)) {
          seenTokens.add(el);
        }
      }
      const marker = document.querySelector<HTMLElement>(markerSel);
      const s: Sample = {
        t: Math.round(performance.now() - t0), tick,
        ws: document.querySelectorAll('.con-ws').length,
        chips, beats, rings,
        stranded: document.querySelector('.con-stranded') !== null,
        fullscreen: document.querySelector('.con-reveal') !== null || document.querySelector('.card-zoom-dialog') !== null,
        strip: read(stripSel),
        marker: marker?.getAttribute('data-scale-marker-at') ?? '',
        markerBox: rect(marker),
        tokens: seenTokens.size,
        heat: (read(heatSel).match(/^-?\d+/) ?? [''])[0],
        heatBox: rect(document.querySelector(heatRowSel)),
        tr: read(trSel),
        mc: (read(mcSel).match(/^-?\d+/) ?? [''])[0],
        aux: (read(auxSel).match(/^\d+/) ?? [''])[0],
        heatProd: (read(heatProdSel).match(/^[-+]?\d+/) ?? [''])[0],
        mcProd: (read(mcProdSel).match(/^[-+]?\d+/) ?? [''])[0],
        heatProdBox: rect(document.querySelector(heatProdSel)),
        mcProdBox: rect(document.querySelector(mcProdSel)),
        heatIcon: rect(heroIcon('heat')),
        venusIcon: rect(heroIcon('venus')),
        prodBox: rect(document.querySelector('.con-recv [data-recv-front] .pcard-prod') ?? document.querySelector(`${hero} .pcard-prod`)),
        plate: document.querySelector('.con-mandatory') !== null,
        parl: document.querySelector('.con-parl') !== null,
      };
      const last = p.samples[p.samples.length - 1];
      if (last === undefined || JSON.stringify({...last, t: 0, tick: false}) !== JSON.stringify({...s, t: 0, tick: false})) {
        p.samples.push(s);
      }
    };
    sample(true);
    const mo = new MutationObserver(() => sample(false));
    mo.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-scale-marker-at']});
    const timer = window.setInterval(() => sample(true), 30);
    w.__tr41stop = () => {
      mo.disconnect();
      window.clearInterval(timer);
    };
  }, {hero: HERO, heatSel: HEAT_DIGITS, heatRowSel: HEAT_ROW, trSel: TR_CELL, mcSel: MC_DIGITS, auxSel: AUX_DATA, heatProdSel: HEAT_PROD, mcProdSel: MC_PROD, stripSel: VENUS_STRIP, markerSel: VENUS_MARKER});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr41: Probe}).__tr41);

const inside = (p: {x: number, y: number}, r: Rect, slack: number) =>
  p.x >= r.l - slack && p.x <= r.r + slack && p.y >= r.t - slack && p.y <= r.b + slack;

/** The sample a chip of `v` is BORN in (its first appearance) and that chip. */
function birthOf(samples: ReadonlyArray<Sample>, v: string): {s: Sample, chip: Chip} | undefined {
  const s = samples.find((x) => x.chips.some((c) => c.v === v));
  return s === undefined ? undefined : {s, chip: s.chips.find((c) => c.v === v)!};
}

/** The sample a chip of `v` RESTS in — its contact beat first appears beside it, once it has travelled its own width. */
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

/** The last sample a chip of `v` is seen in. */
function lastSeen(samples: ReadonlyArray<Sample>, v: string): Sample | undefined {
  return [...samples].reverse().find((x) => x.chips.some((c) => c.v === v));
}

/** The first sample whose `field` reads `value`. */
function firstReading(samples: ReadonlyArray<Sample>, field: 'heat' | 'tr' | 'mc' | 'aux' | 'heatProd' | 'mcProd' | 'strip' | 'marker', value: string): Sample | undefined {
  return samples.find((s) => s[field] === value);
}

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 400).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} ws=${s.ws} fs=${s.fullscreen ? 1 : 0} strip=${s.strip} mk=${s.marker || '…'} tok=${s.tokens} heat=${s.heat} tr=${s.tr} mc=${s.mc} aux=${s.aux} hp=${s.heatProd} mp=${s.mcProd} plate=${s.plate ? 1 : 0} parl=${s.parl ? 1 : 0} chips=${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}${s.beats.length > 0 ? ` beats=${s.beats.map((b) => `${b.x},${b.y}`).join(' ')}` : ''}${s.rings.length > 0 ? ` rings=${s.rings.map((r) => `${r.l},${r.t},${r.r},${r.b}`).join(' ')}` : ''}`,
  ).join('\n');
}

/** The trail is kept beside the screenshots — Playwright empties `test-results/` at the start of the NEXT run. */
function keepTrail(preset: string, name: string, samples: ReadonlyArray<Sample>): void {
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, `${preset}-${name}-trail.txt`), trail(samples));
}

/**
 * A token is BORN on a printed box when its first painted sample stands over the box or just above it: the
 * transfer language POPS a token out of its source before the arc, so the first sample may already be a chip's
 * height above the icon it left.
 */
function bornOn(chip: Chip, box: Rect): boolean {
  const slack = Math.max(chip.w, box.r - box.l) * 0.75;
  return chip.x >= box.l - slack && chip.x <= box.r + slack && chip.y >= box.t - chip.w * 2 - slack && chip.y <= box.b + slack;
}

const overlaps = (a: Rect, b: Rect, pad: number) => a.l <= b.r + pad && a.r >= b.l - pad && a.t <= b.b + pad && a.b >= b.t - pad;

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

/** Both clients on the board (the fixture may resume on a surface). */
const onBoard = (p: Page) => () => p.evaluate(() => {
  const board = document.querySelector<HTMLElement>('.con-board');
  return document.querySelector('.con-ws') === null && board !== null && board.offsetParent !== null;
});

type RedNote = {at: number, text: string};
/** RED'S WITNESS: every notification card as it APPEARS, and red's own M€ reading. */
async function armRedProbe(page: Page): Promise<void> {
  await page.evaluate((mcSel) => {
    const w = window as unknown as {__red: Array<RedNote>, __redMc: Array<[number, string]>};
    const notes: Array<RedNote> = [];
    const mc: Array<[number, string]> = [];
    w.__red = notes;
    w.__redMc = mc;
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
      const value = (text(document.querySelector(mcSel)).match(/^-?\d+/) ?? [''])[0];
      if (value !== '' && mc[mc.length - 1]?.[1] !== value) {
        mc.push([Date.now() - t0, value]);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(sample, 50);
  }, MC_DIGITS);
}
const readRedProbe = (page: Page): Promise<Array<RedNote>> => page.evaluate(() => (window as unknown as {__red: Array<RedNote>}).__red);
const readRedMc = (page: Page): Promise<Array<[number, string]>> => page.evaluate(() => (window as unknown as {__redMc: Array<[number, string]>}).__redMc);

for (const preset of PRESETS) {
  test.describe(`TR41 Plasma Fans · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) a SCALE STEP from a card action: the price off the rail, the impulse into the gauge, the workspace leaves, the board tells the story — marker, rating, the Greens, the census, the cover (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'plasma-fans', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect([before.thisPlayer.heat, before.game.venusScaleLevel, dataOn(before)], 'the fixture: 8 heat, Venus 6 %, the census with 1 data').toEqual([8, 6, 1]);
      const trBefore = before.thisPlayer.terraformRating;
      const mcBefore = before.thisPlayer.megacredits;
      const handBefore = before.thisPlayer.cardsInHandNbr;
      const redBefore = before.players.find((p) => p.color !== blue)!;

      // THE SECOND CLIENT — red (Aphrodite), on the board.
      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      expect(await pressUntil(red, 'Escape', onBoard(red), {tries: 4, settleMs: 1200}), 'red stands on the board').toBe(true);
      await armRedProbe(red);
      await page.bringToFront();
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'blue stands on the board').toBe(true);
      await settle(page, {timeoutMs: 20_000});

      // ── 1. The composer: the price, the step and the table's answers named before the press; nothing sent.
      await openActionOf(page, CARD);
      const hero = page.locator(`${ACTION_COMPOSER} .con-composer__hero`);
      await expect(hero, 'the formula names the heat price').toContainText('8');
      await expect(hero, 'the formula names the Venus step «6 → 8»').toContainText(/6\s*%?\s*→\s*8/);
      const row = page.locator(`${ACTION_COMPOSER} [data-forecast-row]`);
      await expect(row, 'the «Сработает» row stands').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"] .resource_icon--megacredits'), 'the Greens\' M€ chip').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"] .card-resource-data'), 'the census\'s data chip').toHaveCount(1);
      await readyToCommit(page);
      await shoot(page, preset.id, 'a-01-composer');
      expect(seen.posts, 'nothing sent before A').toEqual([]);

      // ── 2. A → ONE POST; the ACTION COMMIT, the leave, the board's story.
      await armProbe(page);
      const stopStory = await storyboard(page, preset.id, 'action');
      await commit(page, seen.posts);
      expect(seen.posts.length, 'A sent exactly one input').toBe(1);
      await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.aux === '3'), {timeout: 60_000, message: 'the data cell reaches 3'}).toBe(true);
      // The 8 % cover presents over the board; its take is the surface's own A.
      await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.fullscreen && s.ws === 0), {timeout: 45_000, message: 'the 8 % reward presents over the board'}).toBe(true);
      await shoot(page, preset.id, 'a-02-cover');
      for (let i = 0; i < 12 && await page.evaluate(() => document.querySelector('.con-reveal, .card-zoom-dialog') !== null); i++) {
        await press(page, 'Enter', 800);
      }
      await noChipsLeft(page);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      await stopStory();
      const {samples} = await readProbe(page);
      keepTrail(preset.id, 'action', samples);
      await shoot(page, preset.id, 'a-03-board');

      // ── 3. THE PRICE (PL-094 / PL-099 / PL-104): «−8 heat» born on the rail's heat row, leaves SIDEWAYS, absorbed at the
      //       hero's printed heat icon; the row ticks 8 → 0 on the departure, never before.
      const price = birthOf(samples, `heat${'−'}8`);
      expect(price, `a «−8 heat» token was born\n${trail(samples)}`).toBeDefined();
      expect(price!.s.heatBox, 'the rail\'s heat row was measurable at the birth').toBeDefined();
      expect(inside(price!.chip, price!.s.heatBox!, price!.chip.w), `the price is BORN on the rail's heat row — ${price!.chip.x},${price!.chip.y} vs ${JSON.stringify(price!.s.heatBox)}`).toBe(true);
      const priceLanding = landingOf(samples, price!.chip.v);
      expect(priceLanding, 'the price rested with its contact beat').toBeDefined();
      expect(priceLanding!.s.heatIcon, 'the hero\'s printed heat icon was measurable at the absorb').toBeDefined();
      expect(inside(priceLanding!.chip, priceLanding!.s.heatIcon!, priceLanding!.chip.w * 0.75), `the price is absorbed at the printed heat icon — ${priceLanding!.chip.x},${priceLanding!.chip.y} vs ${JSON.stringify(priceLanding!.s.heatIcon)}`).toBe(true);
      // SIDEWAYS (PL-104): on its way off the rail the token never climbs above the row it left — it leaves to the side.
      const rowTop = price!.s.heatBox!.t;
      const climbed = samples.filter((s) => s.t > price!.s.t && s.t < priceLanding!.s.t).flatMap((s) => s.chips.filter((c) => c.v === price!.chip.v))
        .filter((c) => c.y < rowTop - price!.chip.w && Math.abs(c.x - price!.chip.x) < price!.chip.w);
      expect(climbed, `the price leaves SIDEWAYS, never straight up over the rows above — ${JSON.stringify(climbed.slice(0, 3))}`).toEqual([]);
      const heatZero = firstReading(samples, 'heat', '0');
      expect(heatZero, 'the heat row ticked to 0').toBeDefined();
      expect(heatZero!.t, `the row ticked (${heatZero!.t}) no earlier than the price's birth (${price!.s.t})`).toBeGreaterThanOrEqual(price!.s.t - 60);
      expect(heatZero!.t, `the row ticked (${heatZero!.t}) no later than the price's landing (${priceLanding!.s.t})`).toBeLessThanOrEqual(priceLanding!.s.t + 60);
      const heatEarly = samples.filter((s) => s.t < price!.s.t - 60 && s.heat !== '' && s.heat !== '8').map((s) => `${s.t}:${s.heat}`);
      expect(heatEarly, 'the heat row read 8 until the price left').toEqual([]);

      // ── 4. THE IMPULSE reached the printed Venus gauge: the commit's landing ring on the gauge (`.con-commit-ring`).
      const gaugeRing = samples.find((s) => s.venusIcon !== undefined && s.rings.some((r) => overlaps(r, s.venusIcon!, 12)));
      expect(gaugeRing, `the impulse landed on the printed Venus gauge\n${trail(samples)}`).toBeDefined();

      // ── 5. THE LEAVE, and THE HOLD: the workspace left; the HUD read «6%» on every sample it stood on; the marker did not
      //       move until it was gone; no fullscreen surface stood over it.
      const wsGone = samples.find((s) => s.ws === 0 && s.t > price!.s.t);
      expect(wsGone, 'the workspace LEFT for the board').toBeDefined();
      const stripUnderWs = samples.filter((s) => s.ws > 0 && s.strip !== '' && !s.strip.startsWith('6')).map((s) => `${s.t}:${s.strip}`);
      expect(stripUnderWs, 'the HUD held «6%» for as long as the workspace stood').toEqual([]);
      const fullscreenUnderWs = samples.filter((s) => s.ws > 0 && s.fullscreen).map((s) => s.t);
      expect(fullscreenUnderWs, 'no fullscreen surface over the open workspace').toEqual([]);
      const markerMoved = samples.find((s) => s.marker !== '' && s.marker !== '6');
      expect(markerMoved, 'the marker reached a new value').toBeDefined();
      expect(markerMoved!.t, `the marker left 6 % (${markerMoved!.t}) only once the workspace was gone (${wsGone!.t})`).toBeGreaterThanOrEqual(wsGone!.t);
      const arrival = firstReading(samples, 'marker', '8');
      expect(arrival, 'the marker rests on 8 %').toBeDefined();
      const strip8 = firstReading(samples, 'strip', '8%');
      expect(strip8, 'the HUD reads 8%').toBeDefined();

      // ── 6. THE STORY'S ORDER: the rating ticks on its chip's touchdown; the Greens' «+2» ticks a beat AFTER it; the marker
      //       ARRIVED before the first census token; the data cell ticks 1 → 2 → 3 on the touchdowns, never ahead; the cover
      //       presents after the tokens.
      const trAfter = String(trBefore + 1);
      const trTick = firstReading(samples, 'tr', trAfter);
      expect(trTick, `the rating ticked to ${trAfter}`).toBeDefined();
      expect(trTick!.t, 'the rating ticked on the board, never under the workspace').toBeGreaterThanOrEqual(wsGone!.t);
      const trEarly = samples.filter((s) => s.t < trTick!.t - 60 && s.tr !== '' && s.tr !== String(trBefore)).map((s) => `${s.t}:${s.tr}`);
      expect(trEarly, `the rating read ${trBefore} until its tick`).toEqual([]);
      // THE RATING TOKEN (the scale-step rating beat): born on the marker's rim once it has ARRIVED, it rests on the rating
      // cell with its contact beat — the cell ticks on that touchdown, never before and never with the response.
      const trBirth = birthOf(samples, 'tr+1');
      expect(trBirth, `a «+1 TR» token was born for the scale step\n${trail(samples)}`).toBeDefined();
      expect(trBirth!.s.t, `the rating token was born (${trBirth!.s.t}) after the marker arrived (${arrival!.t})`).toBeGreaterThanOrEqual(arrival!.t);
      expect(trBirth!.s.markerBox, 'the marker was measurable at the token\'s birth').toBeDefined();
      expect(bornOn(trBirth!.chip, trBirth!.s.markerBox!), `the rating token is BORN on the marker — ${trBirth!.chip.x},${trBirth!.chip.y} vs ${JSON.stringify(trBirth!.s.markerBox)}`).toBe(true);
      const trLanding = landingOf(samples, 'tr+1');
      expect(trLanding, 'the rating token rested with its contact beat').toBeDefined();
      expect(trTick!.t, `the rating ticked (${trTick!.t}) no earlier than its token's touchdown (${trLanding!.s.t})`).toBeGreaterThanOrEqual(trLanding!.s.t - 60);
      expect(trTick!.t, `the rating ticked (${trTick!.t}) ON its token's touchdown (${trLanding!.s.t}), not long after`).toBeLessThanOrEqual(trLanding!.s.t + 200);
      expect(lastSeen(samples, 'tr+1'), 'the token was seen').toBeDefined();
      const mcAfter = String(mcBefore + 2);
      const mcTick = firstReading(samples, 'mc', mcAfter);
      expect(mcTick, `the M€ reads ${mcAfter} — the Greens' answer`).toBeDefined();
      expect(mcTick!.t - trTick!.t, `the Greens' +2 ticks a beat AFTER the rating (gap ${mcTick!.t - trTick!.t} ms, law ${TOUCHDOWN_TICK_GAP_MS})`).toBeGreaterThanOrEqual(TOUCHDOWN_TICK_GAP_MS - 30);
      const firstToken = samples.find((s) => s.tokens > 0);
      expect(firstToken, 'the census tokens were born').toBeDefined();
      expect(firstToken!.t, `the marker ARRIVED (${arrival!.t}) before the first token (${firstToken!.t})`).toBeGreaterThanOrEqual(arrival!.t);
      const auxRun = samples.map((s) => s.aux).filter((v, i, a) => v !== '' && v !== a[i - 1]);
      expect(auxRun, 'the data cell reads 1 → 2 → 3, one unit per touchdown').toEqual(['1', '2', '3']);
      const dataChips = samples.flatMap((s) => s.chips.filter((c) => c.v === 'data+1').map(() => s.t));
      const auxTwo = firstReading(samples, 'aux', '2');
      expect(auxTwo!.t, 'the first data tick came no earlier than the first data token').toBeGreaterThanOrEqual((dataChips[0] ?? Infinity) - 60);
      const cover = samples.find((s) => s.fullscreen && s.ws === 0);
      expect(cover, 'the 8 % cover presented over the board').toBeDefined();
      const auxThree = firstReading(samples, 'aux', '3');
      expect(cover!.t, `the cover rose (${cover!.t}) after the tokens landed (${auxThree!.t})`).toBeGreaterThanOrEqual(auxThree!.t - 60);
      expect(samples.some((s) => s.stranded), 'nothing stranded').toBe(false);
      expect(await strandedReports(page), 'no stranded report').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(seen.overflow, 'no [console-overflow]').toEqual([]);

      // ── 7. The server; red — Aphrodite — is paid and told.
      const after = await wireOf(request, playerId);
      expect([after.thisPlayer.heat, after.game.venusScaleLevel, after.thisPlayer.terraformRating, after.thisPlayer.megacredits, dataOn(after)], 'heat 0, Venus 8, +1 TR, +2 M€, 3 data')
        .toEqual([0, 8, trBefore + 1, mcBefore + 2, 3]);
      expect(after.thisPlayer.cardsInHandNbr, 'the 8 % card is in the hand').toBe(handBefore + 1);
      expect(after.thisPlayer.actionsThisGeneration, 'the use is spent').toContain(CARD);
      const redAfter = after.players.find((p) => p.color !== blue)!;
      expect(redAfter.megacredits, 'Aphrodite answered the step with 2 M€').toBe(redBefore.megacredits + 2);
      await red.bringToFront();
      // Red's card: blue's ACTION with Aphrodite's own +2 inside it (the card names the action's kind and Aphrodite — the
      // action's CARD is not named on it: PL-150, the journal line below it carries the deltas only).
      await expect.poll(async () => (await readRedProbe(red)).some((n) => /Действие карты/.test(n.text) && /Aphrodite|Афродит/.test(n.text)), {timeout: 30_000, message: 'red was told of the action'}).toBe(true);
      await expect.poll(async () => (await readRedMc(red)).some(([, v]) => v === String(redBefore.megacredits + 2)), {timeout: 30_000, message: 'red\'s own M€ read +2 on red\'s screen'}).toBe(true);
      await shoot(red, preset.id, 'a-04-red');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await red.close();
    });

    test(`(B) the PLAY that closes the printed generation-1 quest: +3 heat production from the printed box, the Greens' +3 M€ production a beat after, the chairman plate AFTER the landing, the office on a Parliament that is on screen (${preset.id})`, async ({page, request}) => {
      test.setTimeout(480_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'plasma-fans-play', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect(before.cardsInHand?.some((c) => c.name === CARD), 'the fixture: TR41 in hand').toBe(true);
      expect([before.thisPlayer.heatProduction, before.thisPlayer.megacreditProduction], 'the fixture: no heat / M€ production').toEqual([0, 0]);
      expect(before.game.parliament?.chairman, 'the fixture: nobody in the office').toBeFalsy();
      const handBefore = before.thisPlayer.cardsInHandNbr;
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'blue stands on the board').toBe(true);

      // ── 1. The composer: the production step and the Greens' answer named before the press.
      await openPlayComposerOf(page, CARD);
      const row = page.locator(`${PLAY_COMPOSER} [data-forecast-row]`);
      await expect(row, 'the «Сработает» row names the Greens\' answer').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"] .resource_icon--megacredits'), 'an M€ production chip').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"]')).toContainText('3');
      await shoot(page, preset.id, 'b-01-composer');
      expect(seen.posts, 'nothing sent before A').toEqual([]);

      // ── 2. A → ONE POST; the landing; the plate; the Parliament.
      await armProbe(page);
      const stopStory = await storyboard(page, preset.id, 'play');
      await commit(page, seen.posts);
      expect(seen.posts.length, 'A sent exactly one input').toBe(1);
      await expect(page.locator(MC_PROD), 'the M€ production plate reads +3').toHaveText(/\+3/, {timeout: 60_000});
      await noChipsLeft(page);
      await expect(page.locator('.con-mandatory'), 'the chairman-quest plate stands').toHaveCount(1, {timeout: 40_000});
      await expect(page.locator('.con-mandatory')).toContainText('задание председателя', {timeout: 10_000});
      await shoot(page, preset.id, 'b-02-plate');
      expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBeTruthy();
      await settle(page, {timeoutMs: 25_000});
      await shoot(page, preset.id, 'b-03-parliament');
      await stopStory();
      const {samples} = await readProbe(page);
      keepTrail(preset.id, 'play', samples);

      // ── 3. THE LANDING, by ORDER: the production tokens are born on the printed production box and rest on the heat
      //       row's plate; the plate ticks on the touchdowns, never before; the Greens' plate ticks a beat after the last.
      const steps = samples.flatMap((s) => s.chips.filter((c) => c.v.startsWith('prod:heat')).map((c) => ({s, c})));
      expect(steps.length, `heat-production tokens flew\n${trail(samples)}`).toBeGreaterThan(0);
      const stepBirth = steps[0];
      expect(stepBirth.s.prodBox, 'the printed production box was measurable at the birth').toBeDefined();
      expect(bornOn(stepBirth.c, stepBirth.s.prodBox!), `the step is BORN on the printed production box — ${stepBirth.c.x},${stepBirth.c.y} vs ${JSON.stringify(stepBirth.s.prodBox)}`).toBe(true);
      const kinds = [...new Set(steps.map(({c}) => c.v))];
      const landings = kinds.map((v) => landingOf(samples, v)).filter((l): l is NonNullable<typeof l> => l !== undefined);
      expect(landings.length, `the production tokens rested with their contact beats (${kinds.join(', ')})`).toBeGreaterThan(0);
      for (const landing of landings) {
        expect(landing.s.heatProdBox, 'the heat row\'s plate was measurable at the landing').toBeDefined();
        expect(inside(landing.chip, landing.s.heatProdBox!, landing.chip.w), `the token rests on the heat row's plate — ${landing.chip.x},${landing.chip.y} vs ${JSON.stringify(landing.s.heatProdBox)}`).toBe(true);
      }
      const firstLanding = Math.min(...landings.map((l) => l.s.t));
      const lastLanding = Math.max(...landings.map((l) => l.s.t));
      const heatProdThree = firstReading(samples, 'heatProd', '+3');
      expect(heatProdThree, 'the heat plate reads +3').toBeDefined();
      const heatProdEarly = samples.filter((s) => s.t < firstLanding - 60 && s.heatProd !== '' && s.heatProd !== '0' && s.heatProd !== '+0').map((s) => `${s.t}:${s.heatProd}`);
      expect(heatProdEarly, 'the heat plate read 0 on every sample until the first touchdown').toEqual([]);
      const mcProdThree = firstReading(samples, 'mcProd', '+3');
      expect(mcProdThree, 'the M€ plate reads +3 — the Greens\' answer').toBeDefined();
      expect(mcProdThree!.t - lastLanding, `the Greens' +3 ticks a beat AFTER the last touchdown (gap ${mcProdThree!.t - lastLanding} ms, law ${TOUCHDOWN_TICK_GAP_MS})`).toBeGreaterThanOrEqual(TOUCHDOWN_TICK_GAP_MS - 30);
      expect(samples.some((s) => s.chips.some((c) => c.v.startsWith('prod:megacredits'))), 'the Greens\' answer is a tick in place, never a flown token of its own').toBe(false);

      // ── 4. THE PLATE stands AFTER the landing — never over it: its first sample has no token in the air and the plates
      //       already read their values; the Parliament was not open before the press.
      const plate = samples.find((s) => s.plate);
      expect(plate, 'the chairman-quest plate was seen').toBeDefined();
      expect(plate!.t, `the plate rose (${plate!.t}) after the Greens' tick (${mcProdThree!.t})`).toBeGreaterThanOrEqual(mcProdThree!.t);
      expect(plate!.chips, 'no token in the air when the plate rose').toEqual([]);
      const parlBeforePlate = samples.find((s) => s.parl && s.t < plate!.t);
      expect(parlBeforePlate, 'the Parliament is NOT open before the player presses A on the plate').toBeUndefined();
      expect(samples.some((s) => s.parl), 'A on the plate opened the Parliament — the office and the step play on a section that is on screen').toBe(true);
      expect(samples.some((s) => s.stranded), 'nothing stranded').toBe(false);
      expect(await strandedReports(page), 'no stranded report').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(seen.overflow, 'no [console-overflow]').toEqual([]);

      // ── 5. The flow ENDS: A closes the Parliament; the server agrees.
      await press(page, 'Enter', 900);
      await settle(page, {timeoutMs: 20_000});
      await expect.poll(() => page.locator('.con-parl').count(), {timeout: 20_000, message: 'the finished flow LEAVES'}).toBe(0);
      await waitForBoardHome(page, 30);
      await shoot(page, preset.id, 'b-04-board');
      const after = await wireOf(request, playerId);
      expect([after.thisPlayer.heatProduction, after.thisPlayer.megacreditProduction], 'heat production 3, M€ production 3').toEqual([3, 3]);
      expect(after.thisPlayer.cardsInHandNbr, 'the hand is one card shorter').toBe(handBefore - 1);
      expect(after.game.parliament?.quest?.completedBy, 'the quest is blue\'s').toBe(blue);
      expect(after.game.parliament?.chairman, 'blue holds the office').toBe(blue);
    });
  });
}
