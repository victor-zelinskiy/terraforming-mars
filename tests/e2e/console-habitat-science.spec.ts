import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, press, settle, walkFocusUntil} from './consoleStart';

/**
 * TR23 «НАУКА ОБИТАЕМОСТИ» — «THE LEDGER PAYS»: a card's action pays ALL the
 * player's colony bonuses (docs/TURMOIL_REDUX_HABITAT_SCIENCE.md).
 *
 * «2 data from here → gain all your colony bonuses». Before the press the
 * composer reads the server's LEDGER — a row per own colony tile, in the order
 * the engine pays them; after it the very same rows PAY, in that order, each
 * from its own printed bonus, and the questions a row raises (take a card,
 * discard a card) stand as STEPS over the ledger, in the same zone, one after
 * the other. The contract under test, end to end against a real server, on two
 * profiles:
 *
 *   1. «Действия карт» → the card → the composer: the ledger's four rows in
 *      the PAYOUT order (Luna · Miranda · Pluto · Titan — Titan stands second
 *      on the table and is paid last), each naming what it will ask; Titan's
 *      target step names its colony and is NOT pre-answered (one holder is
 *      still a shown choice); the cost chip reads «4 → 2». Nothing is sent.
 *   2. A is EXACTLY ONE POST — the batch `[action, {card: Titan's target}]`.
 *      The card's capsule reads 2. The rows pay IN TURN: Luna's M€ chip is
 *      born in the row's own bonus cell and lands on the rail, the M€ counter
 *      ticks on the touchdown (never with the answer), the row reads
 *      «получено» no earlier than the tick.
 *   3. Miranda's «ДОБОР КАРТ» stands INSIDE the workspace's zone (never a
 *      full-screen reveal, never the colony workspace), A takes; Pluto's take;
 *      then «СБРОС» — the hand as a nested step in the same zone, its header
 *      naming Pluto, B «Свернуть»; the crumb's root and card name are the SAME
 *      NODES all flow long and the zone is never empty.
 *   4. The discard is the second (and last) POST. Titan's floater — parked on
 *      the server behind that discard — then leaves ITS row for the card
 *      resource's cell. The ledger comes back with every row «получено», stands
 *      for one read, and the flow LEAVES for the board: nothing stranded, no
 *      overflow, no degraded walk. Re-entering «Действия карт» finds the action
 *      «Активирована».
 *   5. The server: 2 data on the card, +2 M€, +1 floater on the target, the
 *      hand +2 taken −1 discarded, the discard asked BY THE CARD (its source,
 *      `colonyRepeat` naming the tile, never the colony workspace's marker),
 *      and the journal's four colony-sourced payouts under the card's action.
 *
 * Fixture `habitat-science` (tests/e2e/fixtures/generate.ts).
 */

const CARD = 'Habitat Science';
const CARD_RU = 'Наука обитаемости';
const ROOT_RU = 'Действия карт';
const TARGET = 'Dirigibles';
const ORDER = ['Luna', 'Miranda', 'Pluto', 'Titan'] as const;
const OUT = path.join('screenshots', 'habitat-science');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, megacredits: number, cardsInHandNbr: number, actionsThisGeneration: Array<string>, tableau: Array<{name: string, resources?: number}>};
  waitingFor?: {type?: string, discardPrompt?: {source?: {kind?: string, card?: string}, colonyRepeat?: {colonyName?: string, index?: number, total?: number}, colonyBonus?: unknown}};
  game: {gameAge: number, generation: number};
};
type JournalEvent = {type: string, correlationId: number, category?: string, source?: {kind?: string, card?: string, name?: string, benefit?: string}};

/** The server's own view. One retry on a dropped socket: a loaded per-worker server resets a connection now and then. */
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

type Box = {x: number, y: number, w: number, h: number};
type Flight = {res: string, text: string, first: Box, last: Box, n: number, firstAt: number, lastAt: number};
type Probe = {
  samples: number;
  /** Interval (task) samples only — the probe's own liveness floor, and the only samples a FRAME claim is made on. */
  ticks: number;
  /** The crumb's tail, every time it SETTLED on a new word (one stage node standing). */
  tails: Array<[number, string]>;
  /** The root / the card's name changed its text — or its NODE — while the workspace stood. */
  crumbMisses: Array<string>;
  /** Per colony: the row's state (`*` = marked as the row paying now), every change. */
  rows: Record<string, Array<[number, string]>>;
  /** Task samples past the press where neither the ledger's surface nor a step could be seen in the column. */
  zoneGaps: Array<string>;
  revealOutside: boolean;
  handOutside: boolean;
  coloniesOpen: boolean;
  wsMax: number;
  plate: boolean;
  degraded: boolean;
  stranded: boolean;
  revealInZone: boolean;
  handDiscardInZone: boolean;
  mc: Array<[number, number]>;
  capsule: Array<[number, number]>;
  flights: Record<string, Flight>;
  /** The ledger's box (left, top, width, height — rounded), every time it CHANGED while the ledger stood fully seen. */
  ledgerBoxes: Array<[number, string]>;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({card, root}) => {
    const w = window as unknown as {__tr23: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, tails: [], crumbMisses: [], rows: {}, zoneGaps: [], revealOutside: false, handOutside: false,
      coloniesOpen: false, wsMax: 0, plate: false, degraded: false, stranded: false, revealInZone: false, handDiscardInZone: false,
      mc: [], capsule: [], flights: {}, ledgerBoxes: [],
    };
    w.__tr23 = p;
    const t0 = Date.now();
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Array<[number, number]>, raw: string | null | undefined) => {
      if (raw === null || raw === undefined || raw === '') {
        return;
      }
      const value = Number(raw);
      if (Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    /** What the player can SEE of an element: its own opacity times every ancestor's, 0 when hidden or not laid out. */
    const seenOpacity = (el: Element | null): number => {
      if (el === null) {
        return 0;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return 0;
      }
      let opacity = 1;
      for (let n = el as HTMLElement | null; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        opacity *= Number(cs.opacity);
      }
      return opacity;
    };
    let emptySince = -1;
    let rootNode: Element | null = null;
    let subjectNode: Element | null = null;
    const miss = (line: string) => {
      if (p.crumbMisses.length < 8) {
        p.crumbMisses.push(`${Date.now() - t0}ms ${line}`);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const now = Date.now() - t0;
      const ws = document.querySelector('.con-cardactions');
      const head = ws?.querySelector('.con-wshead') ?? null;
      if (head !== null) {
        const rootEl = head.querySelector('.con-wshead__root');
        const subjectEl = Array.from(head.querySelectorAll('.con-wshead__subject')).find((el) => text(el).toLowerCase() === card.toLowerCase()) ?? null;
        if (text(rootEl).toLowerCase() !== root.toLowerCase() || subjectEl === null) {
          miss(`root=«${text(rootEl)}» subject=«${Array.from(head.querySelectorAll('.con-wshead__subject')).map(text).join('|')}»`);
        } else {
          // THE SAME NODES all flow long: a crumb that re-renders its root or its subject restarts the line.
          if (rootNode === null) {
            rootNode = rootEl;
            subjectNode = subjectEl;
          } else if (rootNode !== rootEl || subjectNode !== subjectEl) {
            miss(`the ${rootNode !== rootEl ? 'root' : 'subject'} node was replaced`);
            rootNode = rootEl;
            subjectNode = subjectEl;
          }
        }
        const steps = Array.from(head.querySelectorAll('.con-wshead__step')).map(text).filter((s) => s !== '');
        if (steps.length === 1 && p.tails[p.tails.length - 1]?.[1] !== steps[0]) {
          p.tails.push([now, steps[0]]);
        }
      }
      const composer = ws?.querySelector('.con-composer') ?? null;
      if (composer?.hasAttribute('data-colony-ledger-degraded') === true) {
        p.degraded = true;
      }
      for (const row of Array.from(document.querySelectorAll<HTMLElement>('[data-colony-ledger-scope="card"] [data-colony-row]'))) {
        const colony = row.dataset.colonyRow ?? '';
        const state = `${row.dataset.colonyRowState ?? ''}${row.hasAttribute('data-colony-row-active') ? '*' : ''}`;
        const series = p.rows[colony] ?? (p.rows[colony] = []);
        if (series[series.length - 1]?.[1] !== state) {
          series.push([now, state]);
        }
      }
      // WHERE THE STEPS STAND: inside the action workspace's own zone — never a band of their own, never the colonies.
      const zone = ws?.querySelector('.con-composer__ledgerzone') ?? null;
      document.querySelectorAll('.con-reveal').forEach((el) => {
        if (zone === null || !zone.contains(el)) {
          p.revealOutside = true;
        } else {
          p.revealInZone = true;
        }
      });
      document.querySelectorAll('.con-hand').forEach((el) => {
        if (zone === null || !zone.contains(el)) {
          p.handOutside = true;
        } else if (el.classList.contains('con-hand--discard')) {
          p.handDiscardInZone = true;
        }
      });
      if (document.querySelector('.con-colonies, .con-colfocus') !== null) {
        p.coloniesOpen = true;
      }
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      if (document.querySelector('.con-mandatory') !== null) {
        p.plate = true;
      }
      // THE ZONE IS NEVER EMPTY, judged on task samples only (a microtask sample can see a state the browser never
      // paints). Past the press the column shows the ledger's surface or a step standing over it:
      //  · PARKED (the surface is put away under a step) with no step to be seen is a gap at once;
      //  · RELEASED, the surface is coming back on its own 200 ms fade. A transition's clock advances with PAINTED
      //    frames, so between two frames of a starved renderer (a 4K software frame takes hundreds of ms) every
      //    sample reads the last painted value — 0 — while the fade is provably LIVE: that is «coming back», never
      //    «empty». Only a surface at 0 with NO fade running, for longer than a fade, is a ledger that did not return.
      if (tick && ws !== null && composer?.hasAttribute('data-colony-ledger-flow') === true && seenOpacity(ws) > 0.9) {
        const surface = seenOpacity(composer.querySelector('.con-composer__actright > .con-composer__surface'));
        const step = Math.max(seenOpacity(zone?.querySelector('.con-reveal') ?? null), seenOpacity(zone?.querySelector('.con-hand') ?? null));
        const parked = composer.classList.contains('con-composer--ledgerstep');
        const surfaceEl = composer.querySelector<HTMLElement>('.con-composer__actright > .con-composer__surface');
        const fading = !parked && surfaceEl !== null && typeof surfaceEl.getAnimations === 'function' &&
          surfaceEl.getAnimations().some((a) => (a as CSSTransition).transitionProperty === 'opacity' && a.playState !== 'finished' && a.playState !== 'idle');
        const empty = surface < 0.05 && step < 0.05 && !fading;
        if (!empty) {
          emptySince = -1;
        } else if (emptySince < 0) {
          emptySince = now;
        }
        if (empty && (parked || now - emptySince > 400) && p.zoneGaps.length < 8) {
          p.zoneGaps.push(`${now}ms ${parked ? 'parked with no step' : `the ledger has not come back for ${now - emptySince} ms`} flow=${composer.getAttribute('data-colony-ledger-flow')}`);
        }
      }
      document.querySelectorAll<HTMLElement>('.con-transfer__chip').forEach((el) => {
        if (el.style.transform === '') {
          return;
        }
        const r = el.getBoundingClientRect();
        if (r.width < 2 || getComputedStyle(el).visibility === 'hidden') {
          return;
        }
        const icon = el.querySelector<HTMLElement>('.con-transfer__icon');
        // A M€ chip draws its coin without the resource sprite (no icon = megacredits).
        const res = icon === null ? 'megacredits' : (Array.from(icon.classList).find((c) => c !== 'con-transfer__icon') ?? '?');
        const id = el.dataset.transferId ?? '?';
        const at = {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
        const rec = p.flights[id] ?? (p.flights[id] = {res, text: text(el), first: at, last: at, n: 0, firstAt: now, lastAt: now});
        rec.last = at;
        rec.lastAt = now;
        rec.n++;
      });
      const ledgerEl = composer?.querySelector('[data-colony-ledger-scope="card"]') ?? null;
      if (tick && ledgerEl !== null && seenOpacity(ledgerEl) > 0.98) {
        const r = ledgerEl.getBoundingClientRect();
        const key = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
        if (p.ledgerBoxes[p.ledgerBoxes.length - 1]?.[1] !== key) {
          p.ledgerBoxes.push([now, key]);
        }
      }
      const digits = document.querySelector('.con-res__row--megacredits .con-res__digits');
      note(p.mc, (digits?.firstChild?.textContent ?? '').trim());
      note(p.capsule, text(document.querySelector('.con-cardactions .con-composer__actcard .pcard__res-count')));
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 30);
    // THE BASELINE, read synchronously at the arm: the press that follows flips the stage in its own frame, and a
    // sampler that first runs a tick later would never have seen the state the flow started from.
    sample(true);
  }, {card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr23: Probe}).__tr23);

/** An element's centre box and whether the player can actually SEE it (a rect, an effective opacity, not hidden, in view). */
async function seen(page: Page, selector: string): Promise<(Box & {visible: boolean}) | undefined> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    let opacity = 1;
    let hidden = false;
    for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      hidden = hidden || cs.visibility === 'hidden' || cs.display === 'none';
    }
    const inView = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, visible: r.width > 1 && r.height > 1 && opacity > 0.6 && !hidden && inView};
  }, selector);
}

const dist = (a: {x: number, y: number}, b: {x: number, y: number}) => Math.hypot(a.x - b.x, a.y - b.y);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** The acceptance storyboard (opt-in, `TM_E2E_STORYBOARD=1`): every frame the compositor produced. Returns the stop. */
async function storyboard(page: Page, preset: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, 'story');
  fs.rmSync(dir, {recursive: true, force: true}); // a storyboard is ONE run's frames
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
const ledger = `${composer} [data-colony-ledger-scope="card"]`;
const zone = `${composer} .con-composer__ledgerzone`;
const rowOf = (colony: string) => `${ledger} [data-colony-row="${colony}"]`;
const bonusCell = (colony: string) => `${rowOf(colony)} [data-colony-bonus]`;

/** The focused action tile's card — the walk's position. */
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

const rowStates = (page: Page) => page.evaluate((sel) =>
  Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-colony-row]`)).map((row) => [
    row.dataset.colonyRow ?? '', row.dataset.colonyRowState ?? '', row.querySelector<HTMLElement>('.con-cledger__state')?.dataset.colonyRowAsks ?? '',
    (row.querySelector('.con-cledger__state')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  ]), ledger);

/**
 * ONE PRESS, verified by what it does. Never a blind retry: past the commit the same A is the NEXT step's verb (a
 * second A after a take is the next take, after that a discard), so a retry happens only while the surface the
 * press was aimed at provably still stands.
 */
async function pressOnce(page: Page, key: string, taken: () => Promise<boolean>, stillStands: () => Promise<boolean>, what: string): Promise<void> {
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    if (attempt > 0 && !await stillStands()) {
      break; // the surface moved on — the earlier press took; only the witness is late
    }
    await press(page, key, 300);
    await expect.poll(taken, {timeout: 10_000}).toBe(true).catch(() => undefined);
  }
  await expect.poll(taken, {timeout: 30_000, message: what}).toBe(true);
}

for (const preset of PRESETS) {
  test.describe(`TR23 Habitat Science · the ledger pays · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`«Действия карт» → the ledger → A → the rows pay in turn → take · take · discard inside the workspace → the read → the board (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const ledgerWarns: Array<string> = [];
      const posts: Array<{url: string, body: string}> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        const line = m.text();
        if (line.includes('[console-overflow]')) {
          overflow.push(line.slice(0, 200));
        }
        if (line.includes('[colony-ledger]') || line.includes('STRANDED PROMPT')) {
          ledgerWarns.push(line.slice(0, 240));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });

      const playerId = await bootFixture(page, request, 'habitat-science', {query: preset.query});
      const before = await wireOf(request, playerId);
      const card = (wire: Wire, name: string) => wire.thisPlayer.tableau.find((c) => c.name === name);
      expect(card(before, CARD)?.resources, 'the fixture: 4 data on the card').toBe(4);
      expect(card(before, TARGET)?.resources ?? 0, 'the fixture: the one floater holder is empty').toBe(0);
      expect(before.thisPlayer.cardsInHandNbr, 'the fixture: a hand of three').toBe(3);

      // ── 1. «Действия карт» → the card → the composer: the ledger BEFORE the press ──
      await openCardActions(page);
      expect(await walkFocusUntil(page, async () => (await focusedTile(page)) === CARD, () => focusedTile(page), 16),
        `never focused the card's action (at «${await focusedTile(page)}»)`).toBe(true);
      await openActionFocus(page);
      await settle(page);
      expect((await rowStates(page)).map(([colony, state, asks]) => [colony, state, asks]), 'the ledger: a row per tile, in the order the engine pays').toEqual([
        ['Luna', 'pending', ''], ['Miranda', 'pending', 'draw'], ['Pluto', 'pending', 'draw-discard'], ['Titan', 'pending', 'card'],
      ]);
      expect((await rowStates(page)).map(([, , , word]) => word), 'each row names the step it will raise').toEqual(['', 'взять карту', 'карта → сброс', 'выбор карты']);
      await expect(page.locator(`${ledger} [data-colony-ledger-totals]`), 'no «Итого» row — the chips above are the sums').toHaveCount(0);
      await expect(page.locator(composer), 'the cost chip: the card\'s own data, current → resulting').toContainText(/4\s*→\s*2/);
      const stepRow = page.locator(`${composer} .con-composer__row--missing`);
      await expect(stepRow, 'Titan\'s target is a STEP — one holder is still shown, never pre-answered').toHaveCount(1);
      await expect(stepRow.locator('.con-composer__row-label'), 'the step names its colony').toHaveText(/Колония · Титан/i);
      await shoot(page, preset.id, '01-ledger-promised');

      // Answer the step: walk to the unanswered row, open it, pick the (one) holder.
      for (let i = 0; i < 8 && await stepRow.count() > 0; i++) {
        if (await page.locator(`${composer} .con-composer__row--missing.con-composer__row--focused`).count() === 0) {
          await press(page, 'ArrowDown', 200);
          continue;
        }
        await press(page, 'Enter', 400);
        await settle(page);
        await press(page, 'Enter', 400);
        await settle(page);
      }
      await expect(stepRow, 'the target is chosen').toHaveCount(0);
      await expect(page.locator(composer), 'the target\'s own reading').toContainText(/0\s*→\s*1/);
      await settle(page);
      const boxKey = (box: Box | undefined) => box === undefined ? '-' : [box.x - box.w / 2, box.y - box.h / 2, box.w, box.h].map(Math.round).join(',');
      const ledgerBox = boxKey(await seen(page, ledger));
      for (let i = 0; i < 8 && await page.locator(`${composer} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 200);
      }
      await expect(page.locator(`${composer} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
      expect(posts, 'no POST before the commit').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect(boxKey(await seen(page, ledger)), 'the ledger does not move while the cursor walks the rows').toBe(ledgerBox);
      await shoot(page, preset.id, '02-ready');

      const sources = {luna: await seen(page, bonusCell('Luna')), titan: await seen(page, bonusCell('Titan'))};
      const targets = {mc: await seen(page, '.con-res__row--megacredits'), aux: await seen(page, '.con-res-aux__cell[data-aux-resource="floater"], .con-res-aux__cell[data-aux-resource="floaters"]')};
      expect(sources.luna?.visible, 'Luna\'s bonus cell is on screen').toBe(true);
      expect(sources.titan?.visible, 'Titan\'s bonus cell is on screen').toBe(true);
      expect(targets.mc?.visible, 'the rail\'s M€ row is on screen').toBe(true);

      await armProbe(page);
      const stopStory = await storyboard(page, preset.id);

      // ── 2. A — exactly ONE POST, the batch with Titan's target ──
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.map((p) => new URL(p.url).pathname), 'the action is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses.length, 'the action and the one pre-collected target').toBe(2);
      expect(responses[0], 'the head performs the card\'s action').toMatchObject({type: 'or', response: {type: 'card', cards: [CARD]}});
      expect(responses[1], 'the tail is Titan\'s target').toEqual({type: 'card', cards: [TARGET]});

      // ── 3. Miranda's take stands INSIDE the workspace ──
      const revealCard = page.locator(`${zone} .con-reveal [data-zoom-slot]`);
      await expect(revealCard, 'Miranda\'s card stands in the ledger\'s zone').toHaveCount(1, {timeout: 40_000});
      await expect(page.locator(rowOf('Luna')), 'Luna paid first').toHaveAttribute('data-colony-row-state', 'received', {timeout: 20_000});
      await expect(page.locator(rowOf('Miranda')), 'the walk stands on Miranda').toHaveAttribute('data-colony-row-active', '');
      await expect(page.locator('.con-footer'), 'the take\'s own verb is on the bar (the arrival gate opened)').toContainText('Взять', {timeout: 20_000});
      expect(await crumbText(page), 'the tail names the step').toMatch(/добор карт/i);
      await expect(page.locator(`${zone} .con-reveal .con-wshead`), 'the embedded take draws no head of its own').toHaveCount(0);
      await shoot(page, preset.id, '03-take-miranda');
      const rowState = (colony: string) => page.locator(rowOf(colony)).getAttribute('data-colony-row-state');
      const rowActive = async (colony: string) => await page.locator(`${rowOf(colony)}[data-colony-row-active]`).count() === 1;
      await pressOnce(page, 'Enter', async () => await rowState('Miranda') === 'received',
        async () => await rowActive('Miranda') && await revealCard.count() === 1, 'A takes Miranda\'s card — the row reads «получено»');

      // …Pluto's take, in the same zone.
      await expect(page.locator(rowOf('Pluto')), 'the walk moved on to Pluto').toHaveAttribute('data-colony-row-active', '', {timeout: 30_000});
      await expect(revealCard, 'Pluto\'s card stands in the same zone').toHaveCount(1, {timeout: 40_000});
      await expect(page.locator('.con-footer')).toContainText('Взять', {timeout: 20_000});
      const asked = (await wireOf(request, playerId)).waitingFor?.discardPrompt;
      expect(asked?.source, 'the discard is asked BY THE CARD').toEqual({kind: 'card', card: CARD});
      expect(asked?.colonyRepeat?.colonyName, '…and names the tile').toBe('Pluto');
      expect(asked?.colonyBonus, '…never by the colony workspace\'s marker').toBeUndefined();
      await expect(page.locator(`${zone} .con-hand`), 'the hand does not open before the pair\'s card is taken').toHaveCount(0);
      await shoot(page, preset.id, '04-take-pluto');
      const hand = page.locator(`${zone} .con-hand.con-hand--embedded`);
      await pressOnce(page, 'Enter', async () => await hand.count() === 1,
        async () => await rowActive('Pluto') && await revealCard.count() === 1, 'A takes Pluto\'s card — the hand stands as the «СБРОС» step');

      // ── «СБРОС» — the hand, nested, in the SAME zone ──
      await expect(hand, 'in its discard mode').toHaveClass(/con-hand--discard/);
      await expect(page.locator(`${zone} .con-hand .con-wshead`), 'host-agnostic: no head of its own').toHaveCount(0);
      await expect(page.locator('.con-hand__discard-src'), 'the header names the tile that demands it').toHaveText(/Плутон/);
      await settle(page, {timeoutMs: 20_000}).catch(() => undefined); // the open episode; the discard's own hold may stand
      const crumb = await crumbText(page);
      expect(crumb, 'ONE continuous crumb: the workspace, the card, then the step').toMatch(/действия карт/i);
      expect(crumb).toMatch(/наука обитаемости/i);
      expect(crumb).toMatch(/сброс/i);
      const bar = (await page.locator('.con-cmdbar__label').allTextContents()).map((t) => t.trim()).join(' | ');
      expect(bar, `B is «Свернуть» past the commit, never a close (${bar})`).toMatch(/свернуть/i);
      expect(bar).toMatch(/сбросить/i);
      await shoot(page, preset.id, '05-discard');
      expect(posts.length, 'nothing was sent by the takes').toBe(1);
      const handAtDiscard = (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr;
      expect(handAtDiscard, 'both cards were drawn').toBe(before.thisPlayer.cardsInHandNbr + 2);
      await pressOnce(page, 'Enter', async () => posts.length === 2, async () => await hand.count() === 1, 'A discards the focused card — the second POST');
      expect(new URL(posts[1].url).pathname, 'the discard is a plain answer').toBe('/player/input');

      // ── 4. Titan's floater lands after the discard; the read; the board ──
      await expect(page.locator(`${ledger} [data-colony-row][data-colony-row-state="received"]`), 'every row reads «получено»').toHaveCount(4, {timeout: 60_000});
      await shoot(page, preset.id, '06-read');
      await expect.poll(() => page.evaluate(() => ({
        cardActions: document.querySelectorAll('.con-cardactions').length,
        ws: document.querySelectorAll('.con-ws').length,
        reveal: document.querySelectorAll('.con-reveal').length,
      })), {timeout: 40_000, message: 'the finished action leaves for the board'}).toEqual({cardActions: 0, ws: 0, reveal: 0});
      await stopStory();
      await settle(page, {timeoutMs: 30_000});
      expect(posts.length, 'and nothing else was sent').toBe(2);
      await shoot(page, preset.id, '07-board');
      // The flow is over: the probe's reading is taken HERE (the second visit below is another flow's crumb).
      const probe = await readProbe(page);

      // ── 5. the server ──
      const after = await wireOf(request, playerId);
      expect(card(after, CARD)?.resources, '2 data left the card').toBe(2);
      expect(after.thisPlayer.megacredits, 'Luna: +2 M€').toBe(before.thisPlayer.megacredits + 2);
      expect(card(after, TARGET)?.resources, 'Titan: +1 floater on the chosen card').toBe(1);
      expect(after.thisPlayer.cardsInHandNbr, 'the hand: +2 taken (Miranda, Pluto) −1 discarded').toBe(before.thisPlayer.cardsInHandNbr + 1);
      expect(after.thisPlayer.actionsThisGeneration, 'the action is used this generation').toContain(CARD);
      expect(after.waitingFor?.discardPrompt, 'nothing of the payout is still asked').toBeUndefined();
      const journal = await request.get(`/api/game/journal-events?id=${playerId}&generation=${after.game.generation}`);
      expect(journal.ok(), 'the journal answers').toBe(true);
      const events = await journal.json() as Array<JournalEvent>;
      const rootEvent = events.find((e) => e.category === 'card-action' && e.source?.kind === 'card' && e.source.card === CARD);
      expect(rootEvent, 'the journal has the card\'s action').toBeDefined();
      const payers = new Set(events.filter((e) => e.correlationId === rootEvent?.correlationId && e.source?.kind === 'colony').map((e) => e.source?.name));
      expect([...payers].sort(), 'every bonus is recorded under the action, by its colony').toEqual([...ORDER].sort());

      // …and a second visit finds the action spent.
      await openCardActions(page);
      await expect(page.locator('.con-cardactions__filters'), 'the workspace counts one spent action').toContainText(/Активированы\s*1/);
      const spent = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
      await expect(spent, 'the default list is «не активированы» — the spent action is not offered there').toHaveCount(0);
      // The activation filter rides the triggers: one step on shows the spent actions.
      for (let i = 0; i < 3 && await spent.count() === 0; i++) {
        await press(page, 'Period', 400);
      }
      await expect(spent, 'the action reads «Активирована»').toHaveClass(/con-cardactions__tile--activated/);
      await shoot(page, preset.id, '08-activated');

      const flights = Object.values(probe.flights);
      const dump = JSON.stringify({tails: probe.tails, rows: probe.rows, mc: probe.mc, capsule: probe.capsule,
        flights: flights.map((f) => [f.res, f.text, Math.round(f.first.x), Math.round(f.first.y), Math.round(f.last.x), Math.round(f.last.y), f.n, f.firstAt, f.lastAt])});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/habitat-science-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── one flow: one crumb, the steps inside it ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name — the same nodes — on every sample').toEqual([]);
      expect(probe.tails.map(([, tail]) => tail), `the tail: the ledger's word, and each step's while it stands (${dump})`).toEqual(
        ['Настройка', 'Бонусы колоний', 'Добор карт', 'Бонусы колоний', 'Добор карт', 'Сброс', 'Бонусы колоний']);
      expect(probe.revealInZone, 'the take stood inside the workspace\'s zone').toBe(true);
      expect(probe.handDiscardInZone, 'the hand stood there in its discard mode').toBe(true);
      expect(probe.revealOutside, 'never a reveal outside «Действия карт»').toBe(false);
      expect(probe.handOutside, 'never a hand outside it').toBe(false);
      expect(probe.coloniesOpen, 'the colony workspace never opened').toBe(false);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.plate, 'the discard was never announced as an interruption').toBe(false);
      expect(probe.zoneGaps, `the zone was never empty (${dump})`).toEqual([]);
      expect(probe.ledgerBoxes.map(([, box]) => box), `the ledger stood in ONE box from «promised» to «received» — it is the wave's source (${JSON.stringify(probe.ledgerBoxes)})`).toEqual([ledgerBox]);

      // ── the rows paid IN TURN, each on its own touchdown ──
      const at = (colony: string, state: string) => probe.rows[colony]?.find(([, s]) => s.replace('*', '') === state)?.[0] ?? -1;
      const received = ORDER.map((colony) => at(colony, 'received'));
      expect(received.every((t) => t >= 0), `every row read «получено» (${dump})`).toBe(true);
      expect([...received].sort((a, b) => a - b), `…in the ledger's own order (${dump})`).toEqual(received);
      for (const colony of ORDER) {
        expect(probe.rows[colony]?.some(([, s]) => s.endsWith('*')), `${colony} was marked while it paid (${dump})`).toBe(true);
      }
      const slack = preset.viewport.width / 24;
      const near = (a: {x: number, y: number}, b: Box | undefined) => b !== undefined && dist(a, b) <= Math.max(b.w, b.h) + slack;
      const moved = flights.filter((f) => f.n >= 2 && dist(f.first, f.last) > 24);
      const coin = moved.filter((f) => f.res === 'megacredits');
      expect(coin.length, `ONE M€ chip flew (${dump})`).toBe(1);
      expect(near(coin[0].first, sources.luna), `…born in Luna's own bonus cell (${dump})`).toBe(true);
      expect(near(coin[0].last, targets.mc), `…landing on the rail's M€ row (${dump})`).toBe(true);
      expect(probe.mc.map(([, v]) => v), `the M€ counter: the old number, then the new one (${dump})`).toEqual([before.thisPlayer.megacredits, before.thisPlayer.megacredits + 2]);
      expect(probe.mc[1][0], `the counter ticked no earlier than its chip was born (${dump})`).toBeGreaterThanOrEqual(coin[0].firstAt);
      expect(received[0], `Luna read «получено» no earlier than the tick (${dump})`).toBeGreaterThanOrEqual(probe.mc[1][0] - 60);
      const token = moved.filter((f) => f.res !== 'megacredits');
      expect(token.length, `ONE card-resource chip flew (${dump})`).toBe(1);
      expect(near(token[0].first, sources.titan), `…born in Titan's own bonus cell (${dump})`).toBe(true);
      if (targets.aux !== undefined) {
        expect(near(token[0].last, targets.aux), `…landing on the card resource's cell (${dump})`).toBe(true);
      }
      expect(token[0].firstAt, `Titan's chip left after Pluto's row had settled (${dump})`).toBeGreaterThanOrEqual(received[2]);
      expect(probe.capsule.map(([, v]) => v), `the card's capsule: 4, then 2 — never a value between (${dump})`).toEqual([4, 2]);

      expect(probe.degraded, 'the walk never confessed a missing ledger / a stall').toBe(false);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(ledgerWarns, 'no ledger warning, no stranded prompt').toEqual([]);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}
