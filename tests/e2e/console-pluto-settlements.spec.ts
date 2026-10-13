import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, FixtureName, openMandatoryAnnounce, press, settle} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * SEVERAL SETTLEMENTS ON PLUTO — «draw 1, then discard 1» PER SETTLEMENT, each in full before the next card is drawn
 * (docs/claude/prompts/colony-polish-iteration-1-pluto-settlements.md). Driven against a REAL server from the
 * `pluto-settlements-*` fixtures: the viewer trades with Pluto holding 2 (or 3) of its own cubes there.
 *
 * The probe records, off the DOM the player looks at (MutationObserver + setInterval, never rAF):
 *   · every reveal ROOT that ever mounted (an instance nonce) — «the table is one instance» is a nonce count;
 *   · every flying card PROXY (trade covers, deck-draw proxies) with its birth / last rect and the bonus zone it
 *     landed in — «no second flight to place N» is a count per place;
 *   · the bonus zones' states and what each zone paints (a card, a back, a socket) per sample;
 *   · the crumb's tail every time it settles; the stage / hand / reveal presence; the HUD deck counter.
 *
 * `TM_E2E_STORYBOARD=1` writes every compositor frame of the whole resolution (press → the board) to
 * `screenshots/pluto-settlements/<profile>/<fixture>/story/`.
 */

/** `PLU_OUT` names another folder — a BEFORE run on an older snapshot must not overwrite the AFTER frames. */
const OUT = path.join('screenshots', process.env.PLU_OUT ?? 'pluto-settlements');
const PLUTO = 'Pluto';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Box = {x: number, y: number, w: number, h: number};
type Flight = {kind: string, nonce: number, bornAt: number, lastAt: number, first: Box, last: Box, zone: number, face: string};
type Probe = {
  samples: number,
  ticks: number,
  /** Every reveal root that ever mounted, by nonce, with the time it first and last stood. */
  reveals: Array<[number, number, number]>,
  /** The bonus zones' reading, every change: `<index><state><paint>` per zone (paint: c card · b back · s socket · - none). */
  zones: Array<[number, string]>,
  tails: Array<[number, string]>,
  flights: Record<string, Flight>,
  /** Presence, every change: stage · hand · reveal (visible). */
  scene: Array<[number, string]>,
  deck: Array<[number, string]>,
  /** Main-thread long tasks (start, duration) — a frozen screen is often a blocked thread, not a held scene. */
  longtasks: Array<[number, number]>,
  /** Every distinct (table nonce @ reveal root instance) pair that ever stood — ONE per resolution. */
  tables: Array<string>,
  /** The probe clock's origin (Date.now() mod 1e5) — aligns the debug console lines with the series. */
  t0: number,
};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__plu: Probe, __pluNonce: number};
    const p: Probe = {samples: 0, ticks: 0, reveals: [], zones: [], tails: [], flights: {}, scene: [], deck: [], longtasks: [], t0: 0, tables: []};
    w.__plu = p;
    w.__pluNonce = 0;
    const t0 = Date.now();
    p.t0 = t0 % 100000;
    const perf0 = performance.now();
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration >= 120) {
            p.longtasks.push([Math.round(e.startTime - perf0), Math.round(e.duration)]);
          }
        }
      }).observe({type: 'longtask', buffered: false});
    } catch {
      // no long-task timing in this browser — the series stays empty
    }
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const seen = (el: Element | null): number => {
      if (el === null) {
        return 0;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return 0;
      }
      let o = 1;
      for (let n = el as HTMLElement | null; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        o *= Number(cs.opacity);
      }
      return o;
    };
    const nonceOf = (el: Element): number => {
      const e = el as unknown as {__pluNonce?: number};
      if (e.__pluNonce === undefined) {
        e.__pluNonce = ++w.__pluNonce;
      }
      return e.__pluNonce;
    };
    const push = <T>(series: Array<[number, T]>, now: number, v: T) => {
      if (series[series.length - 1]?.[1] !== v) {
        series.push([now, v]);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const now = Date.now() - t0;
      // The reveal roots (one instance = one nonce for the whole resolution).
      for (const el of Array.from(document.querySelectorAll('.con-reveal'))) {
        const n = nonceOf(el);
        const rec = p.reveals.find((r) => r[0] === n);
        if (rec === undefined) {
          p.reveals.push([n, now, now]);
        } else {
          rec[2] = now;
        }
      }
      // The settlement table's instance: its nonce on the root, and WHICH root carries it.
      for (const el of Array.from(document.querySelectorAll('[data-settlement-table]'))) {
        const key = `${el.getAttribute('data-settlement-table')}@${nonceOf(el)}`;
        if (!p.tables.includes(key)) {
          p.tables.push(key);
        }
      }
      // The zones and what each paints.
      const zones = Array.from(document.querySelectorAll('.con-reveal__bonus-zone')).map((z, i) => {
        const state = ['active', 'future', 'done', 'sealed'].find((s) => z.classList.contains(`con-reveal__bonus-zone--${s}`)) ?? '?';
        // A settlement table states what each place paints; an old zone is read off its content.
        const paint = (z as HTMLElement).dataset.settlementPaint ?? (z.querySelector('.pcard, .card-container') !== null ? 'c' :
          z.querySelector('.con-card-back') !== null ? 'b' :
            z.querySelector('.con-reveal__bonus-socket') !== null ? 's' : '-');
        const seal = z.querySelector('.con-reveal__seal') !== null ? (z.querySelector('.con-reveal__seal--breaking') !== null ? '!' : '#') : '';
        return `${i + 1}${state[0]}:${paint}${seal}${seen(z) > 0.5 ? '' : '~'}`;
      }).join(' ');
      push(p.zones, now, zones);
      const head = document.querySelector('.con-colonies .con-wshead');
      if (head !== null) {
        const steps = Array.from(head.querySelectorAll('.con-wshead__step')).map(text).filter((s) => s !== '');
        push(p.tails, now, steps.join(' › '));
      }
      const scene = [
        seen(document.querySelector('.con-colfocus')) > 0.5 ? 'STAGE' : 'stage-',
        document.querySelector('.con-colonies .con-hand') !== null ? 'HAND' : 'hand-',
        seen(document.querySelector('.con-reveal')) > 0.5 ? 'REVEAL' : document.querySelector('.con-reveal') !== null ? 'reveal~' : 'reveal-',
        document.querySelector('.con-reveal--bonus-held') !== null ? 'held' : '',
        document.querySelector('.con-reveal--bonus-veiled') !== null ? 'veiled' : '',
        `px${document.querySelectorAll('.con-coltrade-proxy, .con-deckdraw-proxy').length}`,
        document.querySelector('.con-colfocus--receded') !== null ? 'receded' : '',
        document.querySelector('.con-colfocus--unreceding') !== null ? 'unreceding' : '',
        document.querySelector('.con-hand') !== null && document.querySelector('.con-colonies .con-hand') === null ? 'hand@elsewhere' : '',
        `dp${document.querySelectorAll('.con-discard-proxy').length}`,
        // The table's ONE discard pile beside the HUD deck (TR52): armed = it waits for the hand's card.
        document.querySelector('[data-discard-pile] .con-dpile__plate--armed') !== null ? 'pile!' : document.querySelector('[data-discard-pile]') !== null ? 'pile' : '',
        `hb${document.querySelectorAll('.con-handbody').length}`,
        (() => {
          // Where the hand's bodies stand: the topmost-left visible one's box (album pose = big and high up).
          const all = Array.from(document.querySelectorAll<HTMLElement>('.con-handbody'));
          // The first body that is actually SEEN (a shelved body sits at its slot with no alpha — not evidence).
          const seenBody = all.find((b) => getComputedStyle(b).visibility !== 'hidden' && Number(getComputedStyle(b).opacity) > 0.1 &&
            b.dataset.handBodyMode !== 'docked');
          if (seenBody === undefined) {
            return `hb@dock[${all.map((b) => (b.dataset.handBodyMode ?? '?')[0]).join('')}]`;
          }
          const r = seenBody.getBoundingClientRect();
          const modes = Array.from(document.querySelectorAll<HTMLElement>('.con-handbody'))
            .map((b) => (b.dataset.handBodyMode ?? '?')[0]).join('');
          const pack = document.querySelector('.con-handdock__pack')?.getBoundingClientRect();
          const rev = document.querySelector<HTMLElement>('.con-handreveal-layer')?.dataset.handRevealRev ?? '?';
          return `hb@${Math.round(r.left)},${Math.round(r.top)}w${Math.round(r.width)}[${modes}] pack${Math.round(pack?.height ?? -1)} rev${rev}`;
        })(),
        (() => {
          const bar = document.querySelector('.con-cmdbar');
          return bar === null ? '' : `bar[${text(bar).replace(/\s+/g, ' ').slice(0, 40)}]`;
        })(),
      ].filter((s) => s !== '').join(' ');
      push(p.scene, now, scene);
      push(p.deck, now, text(document.querySelector('.con-deckstack__count')));
      // Every card flying over the table, with where it came down.
      const zoneRects = Array.from(document.querySelectorAll('.con-reveal__bonus-zone')).map((z) => z.getBoundingClientRect());
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-coltrade-proxy, .con-deckdraw-proxy, .con-bonusfly-proxy'))) {
        const r = el.getBoundingClientRect();
        if (r.width < 2) {
          continue;
        }
        const kind = el.classList.contains('con-coltrade-proxy') ? 'trade' : el.classList.contains('con-deckdraw-proxy') ? 'deck' : 'lift';
        const n = nonceOf(el);
        const box = {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height)};
        const key = `${kind}#${n}`;
        const zone = zoneRects.findIndex((z) => box.x >= z.left && box.x <= z.right && box.y >= z.top && box.y <= z.bottom) + 1;
        const face = text(el.querySelector('.con-deal-proxy__face')).slice(0, 30);
        const rec = p.flights[key] ?? (p.flights[key] = {kind, nonce: n, bornAt: now, lastAt: now, first: box, last: box, zone, face});
        rec.last = box;
        rec.lastAt = now;
        rec.zone = zone;
        if (face !== '') {
          rec.face = face;
        }
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
    window.setInterval(() => sample(true), 40);
    sample(true);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__plu: Probe}).__plu);

async function shoot(page: Page, dir: string, name: string): Promise<void> {
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** The acceptance storyboard (opt-in, `TM_E2E_STORYBOARD=1`): every frame the compositor produced. Returns the stop. */
async function storyboard(page: Page, dir: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const story = path.join(dir, 'story');
  fs.rmSync(story, {recursive: true, force: true});
  fs.mkdirSync(story, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(story, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 80, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

/** The shell's own decision terms of «may the reveal mount» (`__conColonyDiag().revealDecision`). */
async function revealDecision(page: Page): Promise<unknown> {
  return page.evaluate(() => (window as unknown as {__conColonyDiag?: () => {revealDecision?: unknown}}).__conColonyDiag?.()?.revealDecision ?? null);
}

type Door = 'own' | 'foreign';

const SCENARIOS: ReadonlyArray<{fixture: FixtureName, cubes: number, door: Door, title: string, emptyHand?: true}> = [
  {fixture: 'pluto-settlements-2', cubes: 2, door: 'own', title: 'own trade, 2 settlements'},
  {fixture: 'pluto-settlements-3', cubes: 3, door: 'own', title: 'own trade, 3 settlements'},
  {fixture: 'pluto-settlements-foreign', cubes: 2, door: 'foreign', title: 'an opponent trades, 2 settlements'},
  {fixture: 'pluto-settlements-empty-hand', cubes: 2, door: 'foreign', title: 'an opponent trades, the viewer\'s hand empty', emptyHand: true},
];

/** An opponent's trade, answered over the API (the action menu's «Trade with a colony tile»: the first usable fee + the colony). */
async function tradeAs(request: APIRequestContext, seat: string, colony: string): Promise<void> {
  const res = await request.get(`/api/player?id=${seat}`);
  expect(res.ok(), 'the opponent\'s model').toBeTruthy();
  const model = await res.json() as {waitingFor?: {options?: Array<{title?: string | {message?: string}}>}};
  const options = model.waitingFor?.options ?? [];
  const titleOf = (o: {title?: string | {message?: string}}) => typeof o.title === 'string' ? o.title : o.title?.message;
  const index = options.findIndex((o) => titleOf(o) === 'Trade with a colony tile');
  expect(index, `the opponent can trade (${options.map(titleOf).join(' · ')})`).toBeGreaterThanOrEqual(0);
  const post = await request.post(`/player/input?id=${seat}`, {data: {
    type: 'or', index,
    response: {type: 'and', responses: [{type: 'or', index: 0, response: {type: 'option'}}, {type: 'colony', colonyName: colony}]},
  }});
  expect(post.ok(), `the opponent's trade was accepted (${post.status()} ${await post.text().catch(() => '')})`).toBeTruthy();
}

/** The zone samples of place `place`: `[time, state letter, paint, seal]` in order. */
function placeSeries(probe: Probe, place: number): Array<{t: number, state: string, paint: string, seal: string}> {
  const out: Array<{t: number, state: string, paint: string, seal: string}> = [];
  for (const [t, line] of probe.zones) {
    const cell = line.split(' ').find((c) => c.startsWith(`${place}`) && /^\d[a-z?]:/.test(c));
    const m = cell === undefined ? null : /^\d([a-z?]):([a-z-]+)([#!]?)/.exec(cell);
    if (m !== null) {
      out.push({t, state: m[1], paint: m[2], seal: m[3]});
    }
  }
  return out;
}

for (const preset of PRESETS) {
  for (const scenario of SCENARIOS) {
    test.describe(`Pluto settlements · ${scenario.fixture} · ${preset.id}`, () => {
      test.use({viewport: preset.viewport});

      test(`${scenario.title}: one table, one object per place, the rule read by eye (${preset.id})`, async ({page, request}) => {
        test.setTimeout(480_000);
        const dir = path.join(OUT, preset.id, scenario.fixture);
        const log: Array<string> = [];
        page.on('console', (m) => {
          const t = m.text();
          if (/\[console-leak-detector\]|\[colony-trade\]|\[console-overflow\]|Vue warn|STRANDED/.test(t)) {
            log.push(t.slice(0, 220));
          }
          if (process.env.PLU_DEBUG === '1' && /^\[(hand-reveal|card-discard|hand-intake)\]/.test(t)) {
            console.log(`[dbg] ${Date.now() % 100000} ${t.slice(0, 200)}`);
          }
          if (process.env.PLU_DEBUG === '1' && t.startsWith('[ws-stack]')) {
            const frames = t.split('\n').filter((l) => /at /.test(l)).slice(1, 7).map((l) => l.trim().replace(/\(.*\)/, ''));
            console.log(`[ws] ${Date.now() % 100000} ${t.split('\n')[0]} <- ${frames.join(' <- ')}`);
          }
        });
        const {seats} = await bootFixtureSeats(page, request, scenario.fixture, {query: preset.query, keepColony: PLUTO});
        await settle(page);
        await armLeakWitness(page);
        if (process.env.PLU_DEBUG === '1') {
          await page.evaluate(() => {
            (window as unknown as {__wsTrace?: boolean}).__wsTrace = true;
          });
        }

        let stop: () => Promise<void>;
        if (scenario.door === 'own') {
          await openColonies(page);
          await focusTile(page, PLUTO);
          await press(page, 'Enter', 2000);
          expect(await page.locator('.con-colfocus').count(), 'the trade stage did not open').toBeGreaterThan(0);
          await shoot(page, dir, '00-stage');
          stop = await storyboard(page, dir);
          await armProbe(page);
          await press(page, 'KeyX', 300); // confirm the trade
        } else {
          stop = await storyboard(page, dir);
          await armProbe(page);
          await tradeAs(request, seats[1], PLUTO);
          if (scenario.emptyHand === true) {
            // К-5 · AN EMPTY HAND: «discard 1» meets a hand holding only the card just drawn, so the RULES discard it
            // with no question — nothing is announced. Each settlement's card is still SHOWN (no silent loss), named
            // as discarded by the rule, and sent «В сброс» — never offered to be taken (it is not in the hand).
            for (let cycle = 1; cycle <= scenario.cubes; cycle++) {
              const pill = page.locator('.con-zoom__status--discarded');
              await expect(pill, `settlement ${cycle}: its card is shown, named as discarded by the rule`).toBeVisible({timeout: 45_000});
              await expect(pill).toContainText(/Сброшена/i);
              await expect(page.locator('.con-cmdbar'), 'the verb sends it to the discard').toContainText(/В сброс/i);
              await expect(page.locator('.con-cmdbar'), 'nothing offers to TAKE a card the hand does not hold').not.toContainText(/Взять/i);
              await shoot(page, dir, `c${cycle}-auto-discard`);
              await press(page, 'Enter', 1800);
            }
            await expect(page.locator('.con-zoom__status--discarded'), 'both cards were sent away').toHaveCount(0, {timeout: 15_000});
            await stop();
            const viewer = await (await request.get(`/api/player?id=${seats[0]}`)).json() as {cardsInHand?: Array<unknown>};
            expect(viewer.cardsInHand ?? [], 'the server holds the viewer\'s hand empty — the cards were discarded').toHaveLength(0);
            expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
            return;
          }
          // The bonus an opponent's trade owes is ANNOUNCED (the mandatory gate); A opens it onto the colony's stage.
          expect(await openMandatoryAnnounce(page, 45_000), 'the opponent\'s trade announced the viewer\'s colony bonus').toBeTruthy();
        }

        const embeddedHand = page.locator('.con-colonies .con-hand--embedded');
        let cycles = 0;
        for (let cycle = 1; cycle <= scenario.cubes; cycle++) {
          const active = page.locator(`.con-colonies .con-reveal__bonus-zone--active`);
          const up = await active.first().waitFor({state: 'visible', timeout: 45_000}).then(() => true).catch(() => false);
          if (!up) {
            console.log(`[cycle ${cycle}] the payout never presented — decision:`, JSON.stringify(await revealDecision(page)));
            await shoot(page, dir, `c${cycle}-missing`);
            break;
          }
          await cinematicBeat(page, 2600, 'the payout lands before the frame is read');
          await shoot(page, dir, `c${cycle}-1-table`);
          // A takes each card; once the table is empty the same A opens the discard step. (A hand the server can
          // answer for itself — one card, one choice — never opens: the card is simply gone, К-5.)
          for (let i = 0; i < 14 && await embeddedHand.count() === 0 && await active.count() > 0; i++) {
            await press(page, 'Enter', 2000);
          }
          if (await embeddedHand.count() > 0) {
            await cinematicBeat(page, 1600, 'the hand opens');
            await shoot(page, dir, `c${cycle}-2-discard`);
            await press(page, 'Enter', 600); // discard the focused card
            await cinematicBeat(page, 700, 'the discarded card is on its way');
            await shoot(page, dir, `c${cycle}-3-discarding`);
            await page.locator('.con-colonies .con-hand').waitFor({state: 'detached', timeout: 25_000}).catch(() => undefined);
          }
          cycles++;
        }
        await expect.poll(async () => page.locator('.con-colonies').count(), {timeout: 60_000, message: 'the finished resolution leaves for the board'}).toBe(0);
        await stop();
        await shoot(page, dir, '99-board');

        const probe = await readProbe(page);
        const flights = Object.values(probe.flights);
        console.log(`── ${scenario.fixture} · ${preset.id} ──`);
        console.log('tables (nonce@root):', JSON.stringify(probe.tables));
        console.log('reveals (nonce, first, last):', JSON.stringify(probe.reveals));
        console.log('longtasks (start, ms):', JSON.stringify(probe.longtasks));
        console.log('zones:', probe.zones.map(([t, v]) => `${t}:${v}`).join(' | '));
        console.log('tails:', probe.tails.map(([t, v]) => `${t}:${v}`).join(' | '));
        console.log('scene:', probe.scene.map(([t, v]) => `${t}:${v}`).join(' | '));
        console.log('deck:', probe.deck.map(([t, v]) => `${t}:${v}`).join(' | '));
        console.log('flights:', flights.map((f) => `${f.kind}#${f.nonce} ${f.bornAt}-${f.lastAt} zone=${f.zone} «${f.face}»`).join('\n  '));
        console.log('console:', JSON.stringify(log.slice(-20)));

        // ── THE PROBE SAW THE RESOLUTION ───────────────────────────────────────────────────────────────────────────
        expect(probe.ticks, 'the probe was alive').toBeGreaterThan(30);
        expect(cycles, 'every settlement presented its place').toBe(scenario.cubes);

        // ① ONE TABLE: one table nonce on one reveal root, from the first deal to the marker's return.
        expect(probe.tables.length, `the settlement table is ONE instance (${JSON.stringify(probe.tables)})`).toBe(1);

        // ② ONE OBJECT PER PLACE: no place is flown to twice, and a later place's flight is a back with no name.
        const placeOf = (f: Flight) => f.zone; // the probe numbers zones from 1 in strip order — the places
        const perPlace = new Map<number, number>();
        for (const f of flights) {
          if (placeOf(f) > 0) {
            perPlace.set(placeOf(f), (perPlace.get(placeOf(f)) ?? 0) + 1);
          }
        }
        for (const [place, n] of perPlace) {
          expect(n, `place ${place} received ${n} flights — a card already on the table never flies again`).toBeLessThanOrEqual(1);
        }
        for (const f of flights.filter((x) => placeOf(x) >= 2)) {
          expect(f.face, `the cover dealt to sealed place ${placeOf(f)} carries no face (the card is not drawn yet)`).toBe('');
        }

        // ③ THE RULE READS BY EYE: every later place stood SEALED, its seal was gone before its card turned, and the
        //    card turned IN PLACE (paint «turning» → «open») — never a fresh flight.
        for (let place = 2; place <= scenario.cubes; place++) {
          const series = placeSeries(probe, place);
          const sealedAt = series.find((s) => s.paint === 'sealed' && s.seal !== '');
          const openAt = series.find((s) => s.paint === 'open');
          expect(sealedAt, `place ${place} lay sealed under its lock`).toBeDefined();
          expect(openAt, `place ${place} opened`).toBeDefined();
          const lastSealBeforeOpen = series.filter((s) => openAt !== undefined && s.t < openAt.t && s.seal === '#').pop();
          const turnedAt = series.find((s) => s.paint === 'turning' && s.seal === '');
          expect(turnedAt, `place ${place}'s card turned in place once its seal was gone`).toBeDefined();
          if (lastSealBeforeOpen !== undefined && turnedAt !== undefined) {
            expect(turnedAt.t, `place ${place}: the seal stood until the discard before it touched down`).toBeGreaterThan(lastSealBeforeOpen.t);
          }
        }

        // ④ ONE FLOW: the crumb's tail only ever moves forward, with the ordinals.
        const stages = probe.tails.map(([, v]) => v.split(' › ').pop() ?? '').filter((v) => /из \d/.test(v));
        const order: Array<string> = [];
        for (let k = 1; k <= scenario.cubes; k++) {
          order.push(`Бонус ${k} из ${scenario.cubes}`, `Сброс ${k} из ${scenario.cubes}`);
        }
        let cursor = -1;
        for (const st of stages) {
          const at = order.findIndex((o) => o.toLowerCase() === st.toLowerCase());
          if (at === -1) {
            continue;
          }
          expect(at, `the crumb went BACK to «${st}» (${stages.join(' → ')})`).toBeGreaterThanOrEqual(cursor);
          cursor = at;
        }
        expect(cursor, `the crumb reached the last stage (${stages.join(' → ')})`).toBeGreaterThanOrEqual(order.length - 2);

        // ⑤ The run stranded nothing.
        expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
      });
    });
  }
}
