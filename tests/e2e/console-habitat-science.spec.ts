import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, press, settle, walkFocusUntil} from './consoleStart';
import type {ObservedSample} from './observeCore';
import {readSettled} from './settledRead';
import {effectiveVisibility} from './transferWitness';
import {armWitness, witnessOf} from './witness';

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
const CARD_RU = 'Наука о поселениях';
const ROOT_RU = 'Действия карт';
const TARGET = 'Dirigibles';
const ORDER = ['Luna', 'Miranda', 'Pluto', 'Titan'] as const;
const OUT = path.join('screenshots', 'habitat-science');

const PRESETS = [
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
/** `glassAtLast` — at the chip's last painted sample a band surface (`.con-ws`, opacity ≥ 0.5) still stood: it landed under glass. */
type Flight = {res: string, text: string, first: Box, last: Box, n: number, firstAt: number, lastAt: number, glassAtLast: boolean};
type Probe = {
  /** Distinct states the recorder kept (a value is kept only when it CHANGES) — the probe's own liveness floor. */
  samples: number;
  /** The crumb's tail, every time it SETTLED on a new word (one stage node standing). */
  tails: Array<[number, string]>;
  /** The root / the card's name changed its text — or its NODE — while the workspace stood. */
  crumbMisses: Array<string>;
  /** Per colony: the row's state (`*` = marked as the row paying now), every change. */
  rows: Record<string, Array<[number, string]>>;
  /** Recorded spans past the press where neither the ledger's surface nor a step could be seen in the column. */
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

/** ONE recorded observation of the flow: what stands NOW. The folding into a `Probe` is `foldLedger`'s. */
type LedgerSeen = {
  /** The action workspace's head: its root / subject texts, their NODES' identities (kept in the page), the stage words. */
  head: null | {root: string, subjects: Array<string>, rootId: number, subjectId: number | null, steps: Array<string>};
  degraded: boolean;
  /** Per colony row: its state (`*` = marked as the row paying now). */
  rows: Array<[string, string]>;
  revealOutside: boolean;
  revealInZone: boolean;
  handOutside: boolean;
  handDiscardInZone: boolean;
  colonies: boolean;
  ws: number;
  stranded: boolean;
  plate: boolean;
  /** The ledger's column, judged only while the workspace stands opaque in its ledger flow (null otherwise). */
  zone: null | {empty: boolean, parked: boolean, flow: string};
  /** Every placed, painted transfer chip — the product's own id, its resource, its text, its box now. */
  chips: Array<{id: string, res: string, text: string, at: Box}>;
  /** A band surface (`.con-ws`, opacity ≥ 0.5) stands. */
  glass: boolean;
  /** The ledger's box key while it stands fully seen (null otherwise). */
  ledger: string | null;
  mc: string;
  capsule: string;
};
const LEDGER_WITNESS = 'tr23-ledger';

/**
 * THE FLOW PROBE — RECORDED (FLAKE ZERO — `armWitness`, armed before the press, replace-proof): the reader returns what
 * stands now, every change is kept with the page's time, and the folding (the crumb's tails, each row's states, each
 * chip's flight, the zone's empty spans) is `foldLedger`'s. Its claims are about ORDER (the rows in turn, the tick after
 * the chip's birth) and COEXISTENCE (never two bands, the zone never empty), so the record is `settled` — the state a
 * task LEAVES, the state a frame can paint (a microtask sample can see a state the browser never paints — the reason the
 * old sampler judged the zone on its interval ticks only). The recorder also samples once a frame; on a quiet compositor
 * no frame comes and nothing changes, so a span is measured from one recorded change to the next.
 */
async function armProbe(page: Page): Promise<void> {
  await armWitness<LedgerSeen, {card: string}>(page, LEDGER_WITNESS, ({card}) => {
    const w = window as unknown as {__tr23Ids?: WeakMap<Element, number>, __tr23Seq?: number};
    const ids = (w.__tr23Ids ??= new WeakMap<Element, number>());
    /** A node's identity across samples — THE SAME NODES all flow long: a crumb that re-renders a node restarts the line. */
    const idOf = (el: Element): number => {
      let id = ids.get(el);
      if (id === undefined) {
        w.__tr23Seq = (w.__tr23Seq ?? 0) + 1;
        id = w.__tr23Seq;
        ids.set(el, id);
      }
      return id;
    };
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
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
    const ws = document.querySelector('.con-cardactions');
    const headEl = ws?.querySelector('.con-wshead') ?? null;
    let head: LedgerSeen['head'] = null;
    if (headEl !== null) {
      const rootEl = headEl.querySelector('.con-wshead__root');
      const subjects = Array.from(headEl.querySelectorAll('.con-wshead__subject'));
      const subjectEl = subjects.find((el) => text(el).toLowerCase() === card.toLowerCase()) ?? null;
      head = {
        root: text(rootEl), subjects: subjects.map(text), rootId: rootEl === null ? 0 : idOf(rootEl),
        subjectId: subjectEl === null ? null : idOf(subjectEl),
        steps: Array.from(headEl.querySelectorAll('.con-wshead__step')).map(text).filter((s) => s !== ''),
      };
    }
    const composer = ws?.querySelector('.con-composer') ?? null;
    // WHERE THE STEPS STAND: inside the action workspace's own zone — never a band of their own, never the colonies.
    const zone = ws?.querySelector('.con-composer__ledgerzone') ?? null;
    const reveals = Array.from(document.querySelectorAll('.con-reveal'));
    // The hand (Pluto's discard) takes the WHOLE STAGE — its own layer of the composer (`__handzone`, the owner's
    // full-stage law of 2026-10-24), never the ledger's column.
    const handZone = ws?.querySelector('.con-composer__handzone') ?? null;
    const hands = Array.from(document.querySelectorAll('.con-hand'));
    // THE ZONE IS NEVER EMPTY. Past the press the column shows the ledger's surface or a step standing over it:
    //  · PARKED (the surface is put away under a step) with no step to be seen is a gap at once;
    //  · RELEASED, the surface is coming back on its own 200 ms fade. A transition's clock advances with PAINTED
    //    frames, so between two frames of a starved renderer (a 4K software frame takes hundreds of ms) every
    //    sample reads the last painted value — 0 — while the fade is provably LIVE: that is «coming back», never
    //    «empty». Only a surface at 0 with NO fade running, for longer than a fade, is a ledger that did not return.
    let zoneSeen: LedgerSeen['zone'] = null;
    if (ws !== null && composer?.hasAttribute('data-colony-ledger-flow') === true && seenOpacity(ws) > 0.9) {
      const surfaceEl = composer.querySelector<HTMLElement>('.con-composer__actright > .con-composer__surface');
      const surface = seenOpacity(surfaceEl);
      // The take stands in the ledger's column, the hand on the whole stage (its own layer) — either is the step.
      const step = Math.max(seenOpacity(zone?.querySelector('.con-reveal') ?? null), seenOpacity(handZone?.querySelector('.con-hand') ?? null));
      const parked = composer.classList.contains('con-composer--ledgerstep');
      const fading = !parked && surfaceEl !== null && typeof surfaceEl.getAnimations === 'function' &&
        surfaceEl.getAnimations().some((a) => (a as CSSTransition).transitionProperty === 'opacity' && a.playState !== 'finished' && a.playState !== 'idle');
      zoneSeen = {empty: surface < 0.05 && step < 0.05 && !fading, parked, flow: composer.getAttribute('data-colony-ledger-flow') ?? ''};
    }
    const chips: LedgerSeen['chips'] = [];
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
      chips.push({id: el.dataset.transferId ?? '?', res, text: text(el),
        at: {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height)}});
    });
    const ledgerEl = composer?.querySelector('[data-colony-ledger-scope="card"]') ?? null;
    let ledger: string | null = null;
    if (ledgerEl !== null && seenOpacity(ledgerEl) > 0.98) {
      const r = ledgerEl.getBoundingClientRect();
      ledger = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    }
    return {
      head,
      degraded: composer?.hasAttribute('data-colony-ledger-degraded') === true,
      rows: Array.from(document.querySelectorAll<HTMLElement>('[data-colony-ledger-scope="card"] [data-colony-row]'))
        .map((row): [string, string] => [row.dataset.colonyRow ?? '', `${row.dataset.colonyRowState ?? ''}${row.hasAttribute('data-colony-row-active') ? '*' : ''}`]),
      revealOutside: reveals.some((el) => zone === null || !zone.contains(el)),
      revealInZone: reveals.some((el) => zone !== null && zone.contains(el)),
      handOutside: hands.some((el) => handZone === null || !handZone.contains(el)),
      handDiscardInZone: hands.some((el) => handZone !== null && handZone.contains(el) && el.classList.contains('con-hand--discard')),
      colonies: document.querySelector('.con-colonies, .con-colfocus') !== null,
      ws: document.querySelectorAll('.con-ws').length,
      stranded: document.querySelector('.con-stranded') !== null,
      plate: document.querySelector('.con-mandatory') !== null,
      zone: zoneSeen,
      chips,
      glass: Array.from(document.querySelectorAll('.con-ws')).some((el) => seenOpacity(el) >= 0.5),
      ledger,
      mc: (document.querySelector('.con-res__row--megacredits .con-res__digits')?.firstChild?.textContent ?? '').trim(),
      capsule: text(document.querySelector('.con-cardactions .con-composer__actcard .pcard__res-count')),
    };
  }, {args: {card: CARD_RU}, settled: true, max: 20_000});
}

/** The record folded into the flow's facts — times are the PAGE's, from the arm (the record's first sample is the baseline). */
function foldLedger(samples: ReadonlyArray<ObservedSample<LedgerSeen>>): Probe {
  const p: Probe = {
    samples: samples.length, tails: [], crumbMisses: [], rows: {}, zoneGaps: [], revealOutside: false, handOutside: false,
    coloniesOpen: false, wsMax: 0, plate: false, degraded: false, stranded: false, revealInZone: false, handDiscardInZone: false,
    mc: [], capsule: [], flights: {}, ledgerBoxes: [],
  };
  const t0 = samples[0]?.t ?? 0;
  const note = (series: Array<[number, number]>, raw: string, now: number) => {
    if (raw === '') {
      return;
    }
    const value = Number(raw);
    if (Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
      series.push([now, value]);
    }
  };
  const miss = (now: number, line: string) => {
    if (p.crumbMisses.length < 8) {
      p.crumbMisses.push(`${now}ms ${line}`);
    }
  };
  let rootNode: string | undefined;
  let subjectNode: string | undefined;
  let emptySince = -1;
  samples.forEach((s, i) => {
    const now = s.t - t0;
    const v = s.v;
    if (v.head !== null) {
      if (v.head.root.toLowerCase() !== ROOT_RU.toLowerCase() || v.head.subjectId === null) {
        miss(now, `root=«${v.head.root}» subject=«${v.head.subjects.join('|')}»`);
      } else {
        // THE SAME NODES all flow long: a crumb that re-renders its root or its subject restarts the line.
        const rootKey = `${s.doc}:${v.head.rootId}`;
        const subjectKey = `${s.doc}:${v.head.subjectId}`;
        if (rootNode !== undefined && (rootNode !== rootKey || subjectNode !== subjectKey)) {
          miss(now, `the ${rootNode !== rootKey ? 'root' : 'subject'} node was replaced`);
        }
        rootNode = rootKey;
        subjectNode = subjectKey;
      }
      const steps = v.head.steps;
      if (steps.length === 1 && p.tails[p.tails.length - 1]?.[1] !== steps[0]) {
        p.tails.push([now, steps[0]]);
      }
    }
    p.degraded ||= v.degraded;
    for (const [colony, state] of v.rows) {
      const series = p.rows[colony] ?? (p.rows[colony] = []);
      if (series[series.length - 1]?.[1] !== state) {
        series.push([now, state]);
      }
    }
    p.revealOutside ||= v.revealOutside;
    p.revealInZone ||= v.revealInZone;
    p.handOutside ||= v.handOutside;
    p.handDiscardInZone ||= v.handDiscardInZone;
    p.coloniesOpen ||= v.colonies;
    p.wsMax = Math.max(p.wsMax, v.ws);
    p.stranded ||= v.stranded;
    p.plate ||= v.plate;
    // THE ZONE'S EMPTY SPANS: nothing changes between two recorded samples, so an empty state stands until the NEXT
    // one — a gap is parked-with-no-step at once, or empty (no fade running) for longer than a fade.
    if (v.zone !== null) {
      if (!v.zone.empty) {
        emptySince = -1;
      } else {
        if (emptySince < 0) {
          emptySince = now;
        }
        const until = i + 1 < samples.length ? samples[i + 1].t - t0 : Infinity;
        if ((v.zone.parked || until - emptySince > 400) && p.zoneGaps.length < 8) {
          p.zoneGaps.push(`${now}ms ${v.zone.parked ? 'parked with no step' :
            `the ledger has not come back for ${until === Infinity ? 'the rest of the record' : `${until - emptySince} ms`}`} flow=${v.zone.flow}`);
        }
      }
    }
    for (const chip of v.chips) {
      const key = `${s.doc}:${chip.id}`;
      const rec = p.flights[key] ?? (p.flights[key] = {res: chip.res, text: chip.text, first: chip.at, last: chip.at, n: 0, firstAt: now, lastAt: now, glassAtLast: v.glass});
      rec.last = chip.at;
      rec.lastAt = now;
      rec.glassAtLast = v.glass;
      rec.n++;
    }
    if (v.ledger !== null && p.ledgerBoxes[p.ledgerBoxes.length - 1]?.[1] !== v.ledger) {
      p.ledgerBoxes.push([now, v.ledger]);
    }
    note(p.mc, v.mc, now);
    note(p.capsule, v.capsule, now);
  });
  return p;
}

/** The flow's reading — the recording stops here (what comes after is another flow). */
const finishProbe = async (page: Page): Promise<Probe> => foldLedger(await witnessOf<LedgerSeen>(page, LEDGER_WITNESS).stop());

/** The ONE «can the player see it» reader (`transferWitness.effectiveVisibility`), in this spec's own Box shape. */
async function seen(page: Page, selector: string): Promise<(Box & {visible: boolean, coveredBy: string}) | undefined> {
  const v = await effectiveVisibility(page, selector);
  return v.found ? {x: v.x, y: v.y, w: v.w, h: v.h, visible: v.visible, coveredBy: v.coveredBy} : undefined;
}

/** `seen`, read at REST (C — `readSettled`: the same answer twice, a frame apart — never a box mid-entrance). */
async function seenAtRest(page: Page, selector: string, what: string): Promise<(Box & {visible: boolean, coveredBy: string}) | undefined> {
  return await readSettled(page, () => seen(page, selector), {message: what});
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
/** The hand step's layer — over the WHOLE STAGE (a pick from the hand never shares the decision column). */
const handZone = `${composer} .con-composer__handzone`;
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
      await expect.poll(async () => (await rowStates(page)).map(([colony, state, asks]) => [colony, state, asks]),
        {timeout: 10_000, message: 'the ledger: a row per tile, in the order the engine pays'}).toEqual([
        ['Luna', 'pending', ''], ['Miranda', 'pending', 'draw'], ['Pluto', 'pending', 'draw-discard'], ['Titan', 'pending', 'card'],
      ]);
      await expect.poll(async () => (await rowStates(page)).map(([, , , word]) => word),
        {timeout: 10_000, message: 'each row names the step it will raise'}).toEqual(['', 'взять карту', 'карта → сброс', 'выбор карты']);
      await expect(page.locator(`${ledger} [data-colony-ledger-totals]`), 'no «Итого» row — the chips above are the sums').toHaveCount(0);
      await expect(page.locator(composer), 'the cost chip: the card\'s own data, current → resulting').toContainText(/4\s*→\s*2/);
      // Titan's target has ONE holder — SEEDED, shown answered and marked (T14 · CC «ЕДИНСТВЕННАЯ ЦЕЛЬ»): never applied
      // silently (the row stands, names its colony and reads the target's change), never a question with one answer.
      const stepRow = page.locator(`${composer} .con-composer__row[data-seeded="sole"]`);
      await expect(stepRow, 'Titan\'s target is a ROW — its one holder seeded, shown, marked').toHaveCount(1);
      await expect(stepRow.locator('.con-composer__row-label'), 'the step names its colony').toHaveText(/Колония · Титан/i);
      await expect(stepRow.locator('[data-seeded-mark]'), 'the quiet mark').toHaveCount(1);
      await expect(page.locator(`${composer} .con-composer__row--missing`), 'nothing left to ask').toHaveCount(0);
      await shoot(page, preset.id, '01-ledger-promised');
      await expect(page.locator(composer), 'the target\'s own reading').toContainText(/0\s*→\s*1/);
      await settle(page);
      const boxKey = (box: Box | undefined) => box === undefined ? '-' : [box.x - box.w / 2, box.y - box.h / 2, box.w, box.h].map(Math.round).join(',');
      // C — the two sides of «the ledger does not move» are BOTH read at rest (a comparison is only as settled as its
      // least settled side).
      const ledgerAtRest = () => readSettled(page, async () => boxKey(await seen(page, ledger)), {message: 'the ledger\'s box'});
      const ledgerBox = await ledgerAtRest();
      for (let i = 0; i < 8 && await page.locator(`${composer} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 200);
      }
      await expect(page.locator(`${composer} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
      expect(posts, 'no POST before the commit').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect(await ledgerAtRest(), 'the ledger does not move while the cursor walks the rows').toBe(ledgerBox);
      await shoot(page, preset.id, '02-ready');

      // The flights' ends, read at REST before the press — the places the chips are judged against.
      const sources = {luna: await seenAtRest(page, bonusCell('Luna'), 'Luna\'s bonus cell'), titan: await seenAtRest(page, bonusCell('Titan'), 'Titan\'s bonus cell')};
      const targets = {
        mc: await seenAtRest(page, '.con-res__row--megacredits', 'the rail\'s M€ row'),
        aux: await seenAtRest(page, '.con-res-aux__cell[data-aux-resource="floater"], .con-res-aux__cell[data-aux-resource="floaters"]', 'the floater satellite cell'),
      };
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
      // ADDRESSED to Titan's own reward pick, routed by this card (the pre-select law — Pluto's discard in front of it is
      // another role and never meets it; docs/claude/action-prompt-audit.md § CLASS 8).
      expect(responses[1], 'the tail is Titan\'s target').toEqual({
        type: 'card', cards: [TARGET], for: {role: 'card', source: {kind: 'colony', name: 'Titan', via: CARD}},
      });

      // ── 3. Miranda's take stands INSIDE the workspace ──
      const revealCard = page.locator(`${zone} .con-reveal [data-zoom-slot]`);
      await expect(revealCard, 'Miranda\'s card stands in the ledger\'s zone').toHaveCount(1, {timeout: 40_000});
      await expect(page.locator(rowOf('Luna')), 'Luna paid first').toHaveAttribute('data-colony-row-state', 'received', {timeout: 20_000});
      await expect(page.locator(rowOf('Miranda')), 'the walk stands on Miranda').toHaveAttribute('data-colony-row-active', '');
      await expect(page.locator('.con-footer'), 'the take\'s own verb is on the bar (the arrival gate opened)').toContainText('Взять', {timeout: 20_000});
      await expect.poll(() => crumbText(page), {message: 'the tail names the step', timeout: 10_000}).toMatch(/добор карт/i);
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
      await expect(page.locator(`${handZone} .con-hand`), 'the hand does not open before the pair\'s card is taken').toHaveCount(0);
      await shoot(page, preset.id, '04-take-pluto');
      const hand = page.locator(`${handZone} .con-hand.con-hand--embedded`);
      await pressOnce(page, 'Enter', async () => await hand.count() === 1,
        async () => await rowActive('Pluto') && await revealCard.count() === 1, 'A takes Pluto\'s card — the hand stands as the «СБРОС» step');

      // ── «СБРОС» — the hand, nested, on the WHOLE STAGE (the composer's hand layer) ──
      await expect(hand, 'in its discard mode').toHaveClass(/con-hand--discard/);
      await expect(page.locator(`${handZone} .con-hand .con-wshead`), 'host-agnostic: no head of its own').toHaveCount(0);
      await expect(page.locator('.con-hand__discard-src'), 'the header names the tile that demands it').toHaveText(/Плутон/);
      await settle(page, {timeoutMs: 20_000}).catch(() => undefined); // the open episode; the discard's own hold may stand
      // The crumb and the bar are LIVE strings — polled, never read once (A).
      const crumbPoll = (message: string) => expect.poll(() => crumbText(page), {timeout: 10_000, message});
      await crumbPoll('ONE continuous crumb: the workspace, the card, then the step').toMatch(/действия карт/i);
      await crumbPoll('the crumb names the card').toMatch(/наука о поселениях/i);
      await crumbPoll('the crumb names the step').toMatch(/сброс/i);
      const barText = async () => (await page.locator('.con-cmdbar__label').allTextContents()).map((t) => t.trim()).join(' | ');
      await expect.poll(barText, {timeout: 10_000, message: 'B is «Свернуть» past the commit, never a close'}).toMatch(/свернуть/i);
      await expect.poll(barText, {timeout: 10_000, message: 'A discards'}).toMatch(/сбросить/i);
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
      // Titan's floater outlives the composer (PL-165): it lands AFTER the workspace has gone — the storyboard covers it.
      await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-transfer__chip').length),
        {timeout: 10_000, message: 'the detached floater has landed'}).toBe(0);
      await stopStory();
      await settle(page, {timeoutMs: 30_000});
      // The satellite's HOME — measured on the board, at rest: while the composer stood it was in its workspace pose
      // (another place), which is exactly the point a floater must never be aimed at.
      const auxHome = await seenAtRest(page, '.con-res-aux__cell[data-aux-resource="floater"], .con-res-aux__cell[data-aux-resource="floaters"]', 'the satellite\'s home');
      expect(posts.length, 'and nothing else was sent').toBe(2);
      await shoot(page, preset.id, '07-board');
      // The flow is over: the probe's reading is taken HERE (the second visit below is another flow's crumb).
      const probe = await finishProbe(page);

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
      // The recorder's liveness floor: DISTINCT states the product wrote across the flow (seven crumb tails with their
      // crossfades, four rows' states, two takes, the discard, two flights, the counters) — a dead recorder keeps one;
      // never a count of frames or ticks.
      expect(probe.samples, `the probe recorded the flow (${probe.samples} distinct states)`).toBeGreaterThan(0); // a liveness floor catches only a DEAD recorder (tests.md)

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
      // THE RESULT OUTLIVES ITS SURFACE (PL-162 + PL-165, the polish remediation iteration № 1): the floater's home — the
      // ДОП. РЕСУРСЫ satellite — stands UNDER the composer's glass for the whole ledger (measurable, COVERED), so it is not a
      // flight end while the composer stands. The token is BORN on Titan's own bonus cell, waits in the app-level layer
      // while the composer reads and leaves, and lands on the satellite only once it is painted — never into the glass.
      expect(targets.aux?.coveredBy, 'the satellite is COVERED by the glass of the composer while the ledger stands').toMatch(/con-cardactions/);
      const token = moved.filter((f) => f.res !== 'megacredits');
      expect(token.length, `ONE card-resource chip flew (${dump})`).toBe(1);
      expect(near(token[0].first, sources.titan), `…born in Titan's own bonus cell (${dump})`).toBe(true);
      expect(auxHome?.visible, 'the satellite cell stands painted on the board').toBe(true);
      expect(near(token[0].last, auxHome), `…landing on the card resource's cell where it stands on the board (${dump} · home ${JSON.stringify(auxHome)})`).toBe(true);
      expect(token[0].glassAtLast, `…once no band surface covered it — never into the glass (${dump})`).toBe(false);
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
