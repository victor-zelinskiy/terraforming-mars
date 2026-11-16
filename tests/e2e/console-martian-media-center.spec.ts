import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle, walkFocusUntil} from './consoleStart';
import {ObservedSample} from './observeCore';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';

/**
 * T07 «МЕДИА-ЦЕНТР НА МАРСЕ» — «pay 3 M€ → add a delegate»: under Turmoil Redux a vote from the RESERVE for 3 M€,
 * taken as the ACTION of a blue card through the vote's FOURTH door (the staged action vote of TR15 —
 * docs/TURMOIL_REDUX_MARTIAN_CENSUS.md §5), now for a DECLARATIVE action whose price is on the RAIL. End to end
 * against a real server:
 *
 *   1. «Действия карт» → the card → the composer: the price «3 M€», the reserve chip, the next step «Резолюция — выбор
 *      в Парламенте», the CTA «Выбрать резолюцию»; its A sends NOTHING (no POST, the server's change counter stands,
 *      the M€ on the rail).
 *   2. ONE flow: the crumb keeps its root and the card's name; the tail reads НАСТРОЙКА → ГОЛОСОВАНИЕ; the Parliament is
 *      the ONE instance, INSIDE «Действия карт»; the stage is never empty while the hero + setup hand over.
 *   3. The mode takes the WHOLE stage (the owner, 2026-10-24): the source card is parked under it (L3 reads it), the
 *      Parliament spans the stage; the locked receipt «Карта · 3 [M€]», the source «из резерва · по карте», no ordinary
 *      vote price anywhere (no «5»); B walks back to the composer with the card on screen again, nothing sent; in again.
 *   4. A is EXACTLY ONE POST (`input-batch`), its tail ADDRESSED to the card.
 *   5. PL-104 → the cube: the «−3» M€ token is born on the rail's M€ row, leaves SIDEWAYS, is absorbed on the vote's
 *      locked RECEIPT (the card's price as it stands on screen while the card is parked); the row ticks 20 → 17 on its
 *      departure, never before; THEN the cube lifts off the reserve stack for the card's ribbon; the lobby's socket stands
 *      full throughout. No commit impulse plays over the parked card (no ring is lit).
 *   6. The server: 17 M€, the viewer's vote on the slot, the action used, the reserve one short, the lobby intact.
 *   7. It ends on the board: no workspace, nothing stranded, no overflow, no page error, no flight confessed a missing rect.
 *   8. The refusals, SHOWN with ONE reason each: 2 M€ «Не хватает 1 M€» · an empty voting area «Нет резолюций на
 *      голосовании» · an empty reserve «Делегатов в резерве: 0 из 1».
 *   9. The play's requirement: Mars First does not rule and blue has ONE delegate on its resolution — «✕», «1/2».
 *
 * Fixtures `martian-media-center*` (tests/e2e/fixtures/generate.ts). TIMING class (PL-104 order): `--exclusive --workers=1`.
 */

const CARD = 'Martian Media Center';
const CARD_RU = 'Медиа-центр на Марсе';
const ROOT_RU = 'Действия карт';
const OUT = path.resolve('screenshots', 't07');

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const MC_ROW = '.con-res__row--megacredits';
const MC_DIGITS = '.con-res__row--megacredits .con-res__digits';
const HERO = '.con-cardactions .con-composer__actcardwrap';
const RECEIPT = '[data-parl-vote-receipt-icon]';

type Wire = {
  thisPlayer: {color: string, megacredits: number, actionsThisGeneration: Array<string>, tableau: Array<{name: string}>};
  game: {
    gameAge: number;
    parliament: {
      slots: Array<{party: string, totalVotes: number, votes: Array<{owner: string}>}>;
      players: Array<{color: string, lobby: boolean, reserve: number}>;
    };
  };
};

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

async function shot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

type Rect = {l: number, t: number, r: number, b: number};
type Box = {x: number, y: number, w: number, h: number};
type Chip = {x: number, y: number, w: number, v: string};
type Flight = {first: Box, last: Box, n: number, firstAt: number, lastAt: number};
type Probe = {
  /** The states the recording kept (one per CHANGE — never a count of frames). */
  samples: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  parlOutside: boolean;
  parlMax: number;
  wsMax: number;
  ownHead: boolean;
  gaps: Array<string>;
  degraded: Array<string>;
  stranded: boolean;
  /** The Parliament's own flights (the cube). */
  flights: Record<string, Flight>;
  reserve: Array<[number, number]>;
  votes: Array<[number, number]>;
  lobbyEmptied: boolean;
  ringAt: number;
  /** The rail's transfer tokens, sample by sample (only samples that hold one). */
  chips: Array<{t: number, chips: Array<Chip>, beats: Array<{x: number, y: number}>, row?: Rect, receipt?: Rect}>;
  /** The M€ digits as read, deduped. */
  mc: Array<[number, string]>;
};

/** What the recording keeps per change — an OBSERVATION of the screen; the folding into `Probe` is `foldProbe`'s. */
type MmcSeen = {
  /** The workspace's crumb: its root and subjects (null while no «Действия карт» head stands). */
  head: {root: string, subjects: Array<string>} | null;
  /** The crumb's standing stage segments. */
  steps: Array<string>;
  parls: number;
  parlOutside: boolean;
  ownHead: boolean;
  degraded: Array<string>;
  ws: number;
  stranded: boolean;
  /** An empty stage inside a standing frame — what it was made of ('' when the stage is not empty). */
  gap: string;
  /** The Parliament's own flights on screen. */
  flights: Array<Box & {id: string}>;
  reserve: string | null;
  votes: string | null;
  ring: boolean;
  lobbyEmpty: boolean;
  mc: string;
  chips: Array<Chip>;
  beats: Array<{x: number, y: number}>;
  row?: Rect;
  receipt?: Rect;
};
const MMC_WITNESS = 't07-media-center';

/**
 * THE PROBE — RECORDED (FLAKE ZERO — `armWitness`, armed before the door, replace-proof): the reader returns what stands
 * NOW, every change is kept with the page's time, and the folding (the crumb's steps in order, the first ring, each
 * flight's first and last pose, the counters' series) is `foldProbe`'s on the Node side. `settled` — the state a TASK
 * leaves: «never two Parliaments», «the stage never empty», «the row ticks no earlier than the price's birth» are claims
 * about what a frame paints and in which order, never about what stands between two writes of one task.
 */
async function armProbe(page: Page, viewer: string): Promise<void> {
  type Args = {viewer: string, mcRow: string, mcDigits: string, receipt: string};
  await armWitness<MmcSeen, Args>(page, MMC_WITNESS, ({viewer, mcRow, mcDigits, receipt}) => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const seenOpacity = (el: Element | null): number => {
      let opacity = 1;
      for (let n = el as HTMLElement | null; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        opacity *= Number(cs.opacity);
      }
      return el === null ? 0 : opacity;
    };
    const rect = (el: Element | null | undefined): Rect | undefined => {
      const r = el?.getBoundingClientRect();
      return r === undefined || r.width < 2 ? undefined : {l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom)};
    };
    const ws = document.querySelector('.con-cardactions');
    const head = ws?.querySelector('.con-wshead') ?? null;
    const steps = head === null ? [] : Array.from(head.querySelectorAll('.con-wshead__step')).map(text).filter((step) => step !== '');
    let parlOutside = false;
    let ownHead = false;
    const degraded: Array<string> = [];
    const parls = document.querySelectorAll('.con-parl');
    parls.forEach((el) => {
      if (el.closest('.con-cardactions') === null || el.classList.contains('con-ws')) {
        parlOutside = true;
      }
      if (el.querySelector('.con-wshead') !== null) {
        ownHead = true;
      }
      const d = el.getAttribute('data-parl-grant-degraded') ?? el.getAttribute('data-renewal-degraded');
      if (d !== null && !degraded.includes(d)) {
        degraded.push(d);
      }
    });
    let gap = '';
    if (ws !== null && document.querySelector('.con-composer__parlzone--on') !== null) {
      const parlSeen = seenOpacity(document.querySelector('.con-composer__parlzone .con-parl'));
      const setupSeen = Math.max(0, ...Array.from(document.querySelectorAll('.con-composer__actmain'))
        .map((el) => seenOpacity(el)));
      // THE STAGE IS JUDGED INSIDE A FRAME THAT STANDS: the surface director fades a workspace's PANELS, never its band
      // root (`surfaceLeaveHook` — `[data-motion-panel]`, every one of them as one), so the root reads 1 for the whole of
      // the finished action's leave. Measured on the root, the leave's last frames (frozen on a starved one: CI 42591455049
      // — frame and composer panel both at 0.23, no animation of their own) read as an empty stage between the hero and the
      // vote. A leaving surface (`data-motion-leaving`) or a frame below 0.9 is not a handover.
      const frameStands = ws.closest('[data-motion-leaving]') === null &&
        seenOpacity(ws.querySelector('.con-cardactions__frame') ?? ws) > 0.9;
      if (frameStands && parlSeen < 0.05 && setupSeen < 0.05) {
        // WHAT the empty stage was made of: each side's running animations, the Parliament's root classes and the
        // crumb's stage — an entry that started late and a leave inside a standing workspace read the same numbers.
        const anims = (el: Element | null): string => el === null ? '∅' :
          el.getAnimations({subtree: false}).map((a) => `${(a as CSSAnimation).animationName ?? ((a as CSSTransition).transitionProperty !== undefined ? `transition(${(a as CSSTransition).transitionProperty})` : 'waapi')}:${a.playState}@${Math.round(Number(a.currentTime ?? -1))}`).join(',') || '-';
        const parlEl = document.querySelector('.con-composer__parlzone .con-parl');
        // WHICH node carries the missing opacity — the Parliament's own entry, or an ancestor's (the zone, the composer).
        const chain: Array<string> = [];
        for (let n = parlEl as HTMLElement | null; n !== null && n !== ws.parentElement; n = n.parentElement) {
          const o = Number(getComputedStyle(n).opacity);
          if (o < 0.99) {
            chain.push(`${(n.className.toString().split(' ')[0] || n.tagName)}=${o.toFixed(2)}[${anims(n)}]`);
          }
        }
        gap = `parl=${parlSeen.toFixed(2)} setup=${setupSeen.toFixed(2)} chain=${chain.join('>')}` +
          ` parlAnim=${anims(parlEl)} setupAnim=${anims(document.querySelector('.con-composer__actmain'))}` +
          ` parlCls=${(parlEl?.className ?? '').replace(/\s+/g, '.')} step=${text(head?.querySelector('.con-wshead__step:last-child') ?? null)}`;
      }
    }
    const flights = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__flight')).flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || getComputedStyle(el).visibility === 'hidden') {
        return [];
      }
      return [{id: el.getAttribute('data-parl-flight') ?? '?', x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height}];
    });
    const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => seenOpacity(el) > 0.05).map((el) => {
      const r = el.getBoundingClientRect();
      const kind = el.classList.contains('con-transfer__chip--mc') ? 'mc' : (el.querySelector('.con-transfer__icon')?.className.match(/resource_icon--([a-z]+)/) ?? ['', '?'])[1];
      return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width),
        v: `${kind}${(el.querySelector('.con-transfer__amt')?.textContent ?? '').replace(/\s+/g, '').replace('−', '-')}`};
    });
    const beats = chips.length === 0 ? [] : Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__beat')).filter((el) => seenOpacity(el) > 0.05).map((el) => {
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};
    });
    const lobby = document.querySelector(`[data-parl-seat-lobby="${viewer}"]`);
    return {
      head: head === null ? null : {root: text(head.querySelector('.con-wshead__root')), subjects: Array.from(head.querySelectorAll('.con-wshead__subject')).map(text)},
      steps,
      parls: parls.length,
      parlOutside,
      ownHead,
      degraded,
      ws: document.querySelectorAll('.con-ws').length,
      stranded: document.querySelector('.con-stranded') !== null,
      gap,
      flights,
      reserve: document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count') ?? null,
      votes: document.querySelector('[data-parl-vote-ribbon]')?.getAttribute('data-votes') ?? null,
      ring: Array.from(document.querySelectorAll('.con-commit-ring')).some((el) => Number(getComputedStyle(el).opacity) > 0.05),
      lobbyEmpty: lobby !== null && lobby.classList.contains('con-parl__socket--empty'),
      mc: (text(document.querySelector(mcDigits)).match(/^-?\d+/) ?? [''])[0],
      chips,
      beats,
      ...(chips.length === 0 ? {} : {row: rect(document.querySelector(mcRow)), receipt: rect(document.querySelector(receipt))}),
    };
  }, {args: {viewer, mcRow: MC_ROW, mcDigits: MC_DIGITS, receipt: RECEIPT}, settled: true, max: 40_000});
}

/** The record folded into the scene's facts — times are the PAGE's, from the first recorded state. */
function foldProbe(samples: ReadonlyArray<ObservedSample<MmcSeen>>): Probe {
  const p: Probe = {
    samples: samples.length, steps: [], crumbMisses: [], parlOutside: false, parlMax: 0, wsMax: 0, ownHead: false,
    gaps: [], degraded: [], stranded: false, flights: {}, reserve: [], votes: [], lobbyEmptied: false, ringAt: -1, chips: [], mc: [],
  };
  const origin = samples[0]?.t ?? 0;
  const note = (series: Array<[number, number]>, t: number, raw: string | null) => {
    if (raw === null || raw === '') {
      return;
    }
    const value = Number(raw);
    if (Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
      series.push([t, value]);
    }
  };
  for (const s of samples) {
    const t = s.t - origin;
    const v = s.v;
    if (v.head !== null) {
      if (v.head.root.toLowerCase() !== ROOT_RU.toLowerCase() || !v.head.subjects.some((x) => x.toLowerCase() === CARD_RU.toLowerCase())) {
        if (p.crumbMisses.length < 8) {
          p.crumbMisses.push(`${t}ms root=«${v.head.root}» subject=«${v.head.subjects.join('|')}»`);
        }
      }
      for (const step of v.steps) {
        if (!p.steps.includes(step)) {
          p.steps.push(step);
        }
      }
    }
    p.parlMax = Math.max(p.parlMax, v.parls);
    p.parlOutside ||= v.parlOutside;
    p.ownHead ||= v.ownHead;
    for (const d of v.degraded) {
      if (!p.degraded.includes(d)) {
        p.degraded.push(d);
      }
    }
    p.wsMax = Math.max(p.wsMax, v.ws);
    p.stranded ||= v.stranded;
    if (v.gap !== '' && p.gaps.length < 8) {
      p.gaps.push(`${t}ms ${v.gap}`);
    }
    for (const f of v.flights) {
      const now: Box = {x: f.x, y: f.y, w: f.w, h: f.h};
      const rec = p.flights[f.id] ?? (p.flights[f.id] = {first: now, last: now, n: 0, firstAt: t, lastAt: 0});
      rec.last = now;
      rec.lastAt = t;
      rec.n++;
    }
    note(p.reserve, t, v.reserve);
    note(p.votes, t, v.votes);
    if (p.ringAt < 0 && v.ring) {
      p.ringAt = t;
    }
    p.lobbyEmptied ||= v.lobbyEmpty;
    if (v.mc !== '' && p.mc[p.mc.length - 1]?.[1] !== v.mc) {
      p.mc.push([t, v.mc]);
    }
    if (v.chips.length > 0) {
      p.chips.push({t, chips: v.chips, beats: v.beats, row: v.row, receipt: v.receipt});
    }
  }
  return p;
}

const readProbe = async (page: Page): Promise<Probe> => foldProbe(await witnessOf<MmcSeen>(page, MMC_WITNESS).samples());

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
const inside = (p: {x: number, y: number}, r: Rect, slack: number) => p.x >= r.l - slack && p.x <= r.r + slack && p.y >= r.t - slack && p.y <= r.b + slack;

const voteMode = '.con-cardactions .con-parl--embedded [data-parl-vote-door="card"]';
const composer = '.con-cardactions .con-composer';

/** The Parliament's width over the stage's — the step takes the WHOLE stage, never the column beside the card. */
const parliamentShareOfStage = (page: Page) => page.evaluate(() => {
  const parl = document.querySelector('.con-cardactions .con-composer__parlzone .con-parl')?.getBoundingClientRect();
  const stage = document.querySelector('.con-cardactions__stagewrap')?.getBoundingClientRect();
  return parl === undefined || stage === undefined || stage.width < 2 ? 0 : parl.width / stage.width;
});

const focusedTile = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  return tile?.getAttribute('data-action-card') ?? '';
});

/** «ВЫБРАТЬ РЕЗОЛЮЦИЮ» — one press, verified by what it opens; a second A on the standing mode would be the COMMIT. */
async function chooseResolution(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) => document.querySelector(sel) !== null, voteMode);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 3_000}).toBe(true).catch(() => undefined);
  }
  await page.locator(voteMode).waitFor({timeout: 30_000});
  await expect(page.locator('.con-cardactions .con-composer--parlstep'), 'the setup parked under the step').toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** «Действия карт» with the cursor on the card's tile. */
async function focusMediaCenter(page: Page): Promise<void> {
  await openCardActions(page);
  await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'the card offers its one action').toHaveCount(1);
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === CARD, () => focusedTile(page), 16),
    `never focused the card's tile (at «${await focusedTile(page)}»)`).toBe(true);
}

for (const preset of PRESETS) {
  test.describe(`T07 Martian Media Center · the staged action vote for 3 M€ · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`«Действия карт» → «Выбрать резолюцию» → the vote inside the workspace → B → back → A → −3 M€ → the cube → the board (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<{url: string, body: string}> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });

      const playerId = await bootFixture(page, request, 'martian-media-center', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      const party0 = before.game.parliament.slots[0].party;
      expect(before.thisPlayer.megacredits, 'the fixture: 20 M€').toBe(20);
      expect(me(before).lobby, 'the fixture: the free delegate stands in the lobby').toBe(true);

      // ── 1. the composer: the price, the reserve, the door ──
      await focusMediaCenter(page);
      await openActionFocus(page);
      await settle(page);
      await expect(page.locator(`${composer} .con-composer__cta`), 'the CTA is the door\'s navigation verb').toContainText('Выбрать резолюцию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Резолюция — выбор в Парламенте');
      await expect(page.locator(composer), 'the delegate leaves the reserve').toContainText('из резерва');
      await shot(page, preset.id, 'a1-composer');

      await armProbe(page, viewer);

      await chooseResolution(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      const still = await wireOf(request, playerId);
      expect(still.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect(still.thisPlayer.megacredits, 'the M€ are still on the rail').toBe(20);

      // ── 3. the mode takes the WHOLE stage: the card parked under it (L3 reads it), the Parliament the stage's width ──
      // Read AT REST (`readSettled`): a box read mid-park is wherever the machine had got to.
      expect((await readSettled(page, () => seen(page, HERO), {message: 'the parked source card'}))?.visible,
        'the source card is parked under the step — never a column beside the Parliament').toBe(false);
      expect(await readSettled(page, () => parliamentShareOfStage(page), {message: 'the Parliament\'s share of the stage'}),
        'the Parliament spans the whole stage').toBeGreaterThan(0.95);
      await expect(page.locator('.con-footer'), 'L3 lifts the source').toContainText('Источник');
      // …the receipt in M€, the card's source, no ordinary vote price ──
      const receipt = page.locator('[data-parl-vote-receipt]');
      await expect(receipt, 'the locked receipt is the card\'s own price').toHaveAttribute('data-receipt-cost', '3');
      await expect(receipt, '…in M€').toHaveAttribute('data-receipt-icon', 'megacredits');
      await expect(receipt).toContainText('Карта');
      await expect(page.locator('[data-parl-vote-source]'), 'the delegate is the card\'s').toContainText('из резерва · по карте');
      await expect(page.locator('[data-parl-vote-source] .con-parl__info-src-num'), 'no ordinary reserve price in the source line').toHaveCount(0);
      expect(await page.locator('[data-parl-cta-cost]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cost-amount'))),
        'the confirm carries no vote price (the grant is the card\'s)').not.toContain('5');
      await expect(page.locator('.con-footer'), 'A is the action\'s commit verb').toContainText('Подтвердить');
      await expect(page.locator('.con-footer'), 'B is reversible').toContainText('Назад');
      await shot(page, preset.id, 'a2-vote-mode');

      // ── B and A again INSIDE the step's own dissolve (a double-tap): the same section is re-shown mid-leave, and the
      //    leave's `fill: 'forwards'` fade must not finish the re-entered vote at opacity 0 (it did — a live, invisible
      //    vote over a released setup: the box probe B → 90 ms → A, 2 / 2). Raw keys: the gap IS the subject.
      await page.keyboard.press('Escape');
      await cinematicBeat(page, 90, 'A lands inside the step\'s 240 ms leave');
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => {
        const parl = document.querySelector('.con-cardactions .con-composer__parlzone .con-parl');
        return parl === null ? 'none' : `${Number(getComputedStyle(parl).opacity).toFixed(2)}${parl.getAnimations().some((a) => a.playState === 'finished') ? ' stale-fill' : ''}`;
      }), {timeout: 10_000, message: 'the vote re-shown mid-leave stands at full opacity, no stale fill'}).toBe('1.00');
      await settle(page);

      // B walks back to the composer — nothing sent.
      const backTaken = () => page.evaluate(() => document.querySelector('.con-cardactions .con-parl') === null);
      for (let attempt = 0; attempt < 3 && !await backTaken(); attempt++) {
        await press(page, 'Escape', 300);
        await expect.poll(backTaken, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator('.con-cardactions .con-composer--parlstep'), 'the setup un-parked').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await expect(page.locator(`${composer} .con-composer__cta`), 'back on the door').toContainText('Выбрать резолюцию');
      await expect.poll(async () => (await seen(page, HERO))?.visible, {timeout: 5_000, message: 'B brings the source card back where it stood'}).toBe(true);
      await shot(page, preset.id, 'a3-back');
      expect(posts).toEqual([]);
      expect((await wireOf(request, playerId)).thisPlayer.megacredits, 'the round trip left the M€ on the rail').toBe(20);

      // ── 4. in again; A is ONE POST, addressed to the card ──
      await chooseResolution(page);
      // The flight's two ends, measured AT REST before the commit (both through one settled read).
      const {reserveBox, ribbonBox} = await readSettled(page, async () => ({
        reserveBox: await seen(page, `[data-parl-seat-reserve="${viewer}"]`),
        ribbonBox: await seen(page, '[data-parl-vote-ribbon]'),
      }), {message: 'the reserve stack and the card\'s ribbon'});
      expect(reserveBox?.visible, 'the reserve stack is on screen').toBe(true);
      expect(ribbonBox?.visible, 'the card\'s ribbon is on screen').toBe(true);
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.map((p) => new URL(p.url).pathname), 'the action is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail is the resolution, ADDRESSED to the card').toMatchObject({type: 'party', partyName: party0, stagedFor: CARD});

      // ── 6. the server ──
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.actionsThisGeneration,
        {timeout: 30_000, message: 'the action is recorded as used'}).toContain(CARD);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, 'the card\'s 3 M€ — never the ordinary vote\'s price').toBe(17);
      expect(after.game.parliament.slots[0].votes.map((v) => v.owner), 'the viewer\'s delegate stands on the chosen card').toEqual([viewer]);
      expect(after.game.parliament.slots.slice(1).map((s) => s.totalVotes), 'and on no other').toEqual([0, 0]);
      expect(me(after).reserve, 'the delegate left the RESERVE').toBe(me(before).reserve - 1);
      expect(me(after).lobby, 'the lobby\'s cube never moved').toBe(true);

      // ── 7. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        cardActions: document.querySelectorAll('.con-cardactions').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished action leaves for the board'}).toEqual({cardActions: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await shot(page, preset.id, 'a4-board');
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const trail = probe.chips.slice(0, 120).map((s) => `${s.t}: ${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}${s.beats.length > 0 ? ' beat' : ''}`).join('\n');
      const dump = JSON.stringify({steps: probe.steps, reserve: probe.reserve, votes: probe.votes, mc: probe.mc, ringAt: probe.ringAt,
        flights: Object.values(probe.flights).map((f) => [Math.round(f.first.x), Math.round(f.first.y), Math.round(f.last.x), Math.round(f.last.y), f.n, f.firstAt, f.lastAt])});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/martian-media-center-${preset.id}.json`, JSON.stringify(probe, null, 1));
      // The recording's liveness floor: it recorded at all (only a dead recorder fails it — the real claims judge below).
      expect(probe.samples, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(0);

      // ── 2. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps, `the tail only ever moved forward (${dump})`).toEqual(['Настройка', 'Голосование']);
      expect(probe.parlOutside, 'the Parliament stood inside «Действия карт»').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);
      expect(probe.gaps, 'the stage was never empty while the hero + setup handed over').toEqual([]);

      // ── 5. PL-104 → the cube ──
      const priceBirth = probe.chips.find((s) => s.chips.some((c) => /^mc-3$/.test(c.v)));
      expect(priceBirth, `a «−3» M€ token was born (${dump})\n${trail}`).toBeDefined();
      const priceChip = priceBirth!.chips.find((c) => /^mc-3$/.test(c.v))!;
      expect(priceBirth!.row, 'the rail\'s M€ row was measurable at the birth').toBeDefined();
      expect(inside(priceChip, priceBirth!.row!, priceChip.w), `the price is BORN on the rail's M€ row — ${priceChip.x},${priceChip.y} vs ${JSON.stringify(priceBirth!.row)}`).toBe(true);
      const priceSeen = probe.chips.filter((s) => s.chips.some((c) => c.v === priceChip.v));
      const priceLast = priceSeen[priceSeen.length - 1];
      const lastChip = priceLast.chips.find((c) => c.v === priceChip.v)!;
      expect(priceLast.receipt, 'the vote\'s receipt was measurable at the absorb').toBeDefined();
      expect(inside(lastChip, priceLast.receipt!, lastChip.w), `the price is absorbed ON the vote's receipt (the card's price as it stands on screen) — ${lastChip.x},${lastChip.y} vs ${JSON.stringify(priceLast.receipt)}`).toBe(true);
      const rowTop = priceBirth!.row!.t;
      const climbed = priceSeen.flatMap((s) => s.chips.filter((c) => c.v === priceChip.v))
        .filter((c) => c.y < rowTop - priceChip.w && Math.abs(c.x - priceChip.x) < priceChip.w);
      expect(climbed, `the price leaves SIDEWAYS, never straight up over the rows above — ${JSON.stringify(climbed.slice(0, 3))}`).toEqual([]);
      const tick17 = probe.mc.find(([, v]) => v === '17');
      expect(tick17, `the M€ row ticked to 17 (${dump})`).toBeDefined();
      expect(tick17![0], `the row ticked no earlier than the price's birth (${priceBirth!.t})`).toBeGreaterThanOrEqual(priceBirth!.t - 60);
      expect(tick17![0], `…and no later than its absorb (${priceLast.t})`).toBeLessThanOrEqual(priceLast.t + 60);
      expect(probe.mc.filter(([t, v]) => t < priceBirth!.t - 60 && v !== '20'), 'the M€ row read 20 until the price left').toEqual([]);
      // No impulse over a card nobody sees: the parked hero plays no commit ring (it would light over the Parliament).
      expect(probe.ringAt, `no commit ring lit over the parked card (${dump})`).toBe(-1);
      const slack = preset.viewport.width / 24;
      const near = (a: {x: number, y: number}, b: Box | undefined) => b !== undefined && dist(a, b) <= Math.max(b.w, b.h) + slack;
      const cube = Object.values(probe.flights).filter((f) => f.n >= 2 && dist(f.first, f.last) > 24 && near(f.first, reserveBox));
      expect(cube.length, `the viewer's cube left the RESERVE stack (${dump})`).toBe(1);
      expect(near(cube[0].last, ribbonBox), `…and landed on the card's ribbon (${dump})`).toBe(true);
      expect(cube[0].firstAt, `the cube lifted only after the price was absorbed (${priceLast.t} ms; ${dump})`).toBeGreaterThanOrEqual(priceLast.t - 60);
      expect(probe.reserve.map(([, v]) => v), 'the reserve stack gave exactly one cube').toEqual([me(before).reserve, me(before).reserve - 1]);
      expect(probe.votes[probe.votes.length - 1]?.[1], 'the card\'s count ticked to 1').toBe(1);
      expect(probe.lobbyEmptied, 'the lobby\'s socket was never empty').toBe(false);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });

    // ── 8. the refusals: SHOWN, one reason each ──
    for (const [fixture, reason, label] of [
      ['martian-media-center-poor', /Не хватает 1 M€/, 'b-poor'],
      ['martian-media-center-quiet', /Нет резолюций на голосовании/, 'b-quiet'],
      ['martian-media-center-reserve', /Делегатов в резерве: 0 из 1/, 'b-reserve'],
    ] as const) {
      test(`${fixture}: the action SHOWN disabled with ONE reason (${preset.id})`, async ({page, request}) => {
        test.setTimeout(180_000);
        await bootFixture(page, request, fixture, {query: preset.query});
        await focusMediaCenter(page);
        const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
        await expect(tile.locator('.con-cardactions__tile-reason'), 'the reason is named').toContainText(reason);
        await expect.poll(() => tile.locator('.con-cardactions__tile-reason').count(), {message: 'ONE reason'}).toBe(1);
        await shot(page, preset.id, label);
      });
    }

    // ── 9. the play's requirement: «1/2» ──
    test(`martian-media-center-hand: Mars First does not rule, one delegate of yours — «✕», «1/2» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixture(page, request, 'martian-media-center-hand', {query: preset.query});
      await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
      await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, CARD, Math.max(14, slots * 3)), 'the cursor stands on the card').toBe(true);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'one of your delegates out of two').toContainText('1/2');
      await shot(page, preset.id, 'c-hand-locked');
    });
  });
}
